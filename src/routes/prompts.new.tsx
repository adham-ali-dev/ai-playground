import { createFileRoute } from "@tanstack/react-router";
import { PromptEditor } from "@/client/prompts/PromptEditor";
import { getNewPromptSettings } from "@/serverFunctions/prompts";

export const Route = createFileRoute("/prompts/new")({
  loader: () => getNewPromptSettings(),
  head: () => ({ meta: [{ title: "New prompt" }] }),
  component: NewPrompt,
});

function NewPrompt() {
  const settings = Route.useLoaderData();
  return <PromptEditor prompt={null} initialSettings={settings} />;
}
