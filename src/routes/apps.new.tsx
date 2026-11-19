import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { createApp } from "@/serverFunctions/apps";

export const Route = createFileRoute("/apps/new")({
  head: () => ({ meta: [{ title: "New app" }] }),
  component: NewApp,
});

function NewApp() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    if (!description.trim()) return;
    setError(null);
    setPending(true);
    try {
      const { id } = await createApp({ data: { description } });
      await navigate({ to: "/apps/$appId", params: { appId: id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="New app" />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void build();
        }}
      >
        <Label htmlFor="app-description">What should it do?</Label>
        <Textarea
          id="app-description"
          data-testid="app-description"
          placeholder="A packing list for a weekend trip, with items I can tick off and a progress bar"
          value={description}
          disabled={pending}
          className="min-h-32 bg-card"
          onChange={(event) => setDescription(event.target.value)}
        />
        {error ? (
          <Alert variant="destructive" data-testid="build-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" pending={pending} disabled={!description.trim()}>
            {pending ? null : <Sparkles data-icon="inline-start" />}
            Build
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
