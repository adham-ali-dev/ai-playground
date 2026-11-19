import { env } from "cloudflare:workers";
import {
  aiBaseUrl,
  createGatewayFetch,
  gatewayRefusal,
  refusalFromError,
  type GatewayRefusal,
} from "@every-app/sdk/server";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatResult = { ok: true; text: string } | { ok: false; error: string };

const NOT_CONFIGURED = new Set([
  "ai_provider_not_configured",
  "ai_default_not_configured",
  "integration_not_configured",
]);

function refusalMessage(refusal: GatewayRefusal): string {
  if (NOT_CONFIGURED.has(refusal.code))
    return "No AI provider is set up yet. An admin can add an OpenRouter key on the Gateway.";
  if (refusal.code === "app_monthly_cap_exceeded")
    return "This app has reached its monthly AI spending cap.";
  return refusal.message || "The Gateway refused the model call.";
}

/** One chat completion through the Gateway's OpenRouter route. Never throws for a failed call. */
export async function chat(
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; topP?: number; maxTokens?: number } = {},
): Promise<ChatResult> {
  try {
    const fetcher = createGatewayFetch({ env });
    const response = await fetcher(`${aiBaseUrl("openrouter")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.topP !== undefined && { top_p: options.topP }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
      }),
    });
    if (!response.ok) {
      const refusal = await gatewayRefusal(response.clone());
      if (refusal) return { ok: false, error: refusalMessage(refusal) };
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const detail = body?.error?.message;
      return {
        ok: false,
        error: detail
          ? `The model returned an error: ${detail}`
          : `The model returned an error (${response.status}).`,
      };
    }
    const data = (await response.json()) as {
      choices?: {
        finish_reason?: string;
        message?: { content?: string | null; refusal?: string | null };
      }[];
    };
    const choice = data.choices?.[0];
    if (choice?.message?.refusal)
      return { ok: false, error: `The model declined: ${choice.message.refusal}` };
    if (choice?.finish_reason === "content_filter")
      return { ok: false, error: "The model declined to answer." };
    const text = choice?.message?.content?.trim();
    if (!text) return { ok: false, error: "The model returned no answer." };
    return { ok: true, text };
  } catch (error) {
    const refusal = refusalFromError(error);
    if (refusal) return { ok: false, error: refusalMessage(refusal) };
    console.error("model call failed", error);
    return { ok: false, error: "The model couldn't be reached. Try again." };
  }
}
