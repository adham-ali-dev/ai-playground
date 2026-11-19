/** The models people may pick, as OpenRouter names them. */
export const MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "mistralai/mistral-small-3.1-24b-instruct", label: "Mistral Small 3.1" },
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const MODEL_IDS = MODELS.map((model) => model.id) as [
  ModelId,
  ...ModelId[],
];

export const DEFAULT_MODEL: ModelId = "openai/gpt-4o-mini";

/** The model building apps. */
export const APP_MODEL: ModelId = "anthropic/claude-3.5-haiku";

export function modelLabel(id: string | null | undefined): string {
  return MODELS.find((model) => model.id === id)?.label ?? id ?? "";
}

export const DEFAULT_SETTINGS = {
  temperature: 1,
  topP: 0.95,
  maxOutputTokens: 2048,
};

export const LIMITS = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  maxOutputTokens: { min: 1, max: 8192 },
};
