import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { PromptEditor } from "@/client/prompts/PromptEditor";
import { getPrompt } from "@/serverFunctions/prompts";

export const Route = createFileRoute("/prompts/$promptId")({
  loader: async ({ params }) => {
    const prompt = await getPrompt({ data: { id: params.promptId } }).catch(() => null);
    if (!prompt) throw notFound();
    return prompt;
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.title }] : [] }),
  component: SavedPrompt,
  notFoundComponent: () => (
    <AppShell>
      <EmptyState
        kind="filtered"
        title="Prompt not found"
        action={<Button render={<Link to="/" />}>Your prompts</Button>}
      />
    </AppShell>
  ),
});

function SavedPrompt() {
  const prompt = Route.useLoaderData();
  // Keyed by id: opening another prompt starts from its own settings.
  return <PromptEditor key={prompt.id} prompt={prompt} initialSettings={prompt.settings} />;
}
