import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { Download, GitFork, Pencil, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { RenameDialog } from "@/client/components/RenameDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf, timeAgo } from "@/client/lib/errors";
import { fileNameFor } from "@/lib/html";
import {
  deleteApp,
  getApp,
  remixApp,
  renameApp,
  restoreAppVersion,
  reviseApp,
  setAppVisibility,
} from "@/serverFunctions/apps";

export const Route = createFileRoute("/apps/$appId")({
  loader: async ({ params }) => {
    const app = await getApp({ data: { id: params.appId } }).catch(() => null);
    if (!app) throw notFound();
    return app;
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.name }] : [] }),
  component: AppPage,
  notFoundComponent: () => (
    <AppShell>
      <EmptyState
        kind="filtered"
        title="App not found"
        action={<Button render={<Link to="/apps" />}>Apps</Button>}
      />
    </AppShell>
  ),
});

function AppPage() {
  const app = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"rename" | "delete" | "remove" | null>(null);

  async function act(work: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    try {
      await work();
      await router.invalidate();
      return true;
    } catch (cause) {
      setError(messageOf(cause));
      return false;
    } finally {
      setPending(false);
    }
  }

  function download() {
    if (!app.current) return;
    const url = URL.createObjectURL(new Blob([app.current.html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFor(app.name);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function revise() {
    const text = instruction.trim();
    if (!text) return;
    setRevising(true);
    if (await act(() => reviseApp({ data: { id: app.id, instruction: text } }))) setInstruction("");
    setRevising(false);
  }

  const shared = app.visibility === "organization";
  return (
    <AppShell wide>
      <PageHeader
        title={app.name}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {app.isOwner ? (
              <Badge variant={shared ? "secondary" : "outline"}>{shared ? "Shared" : "Private"}</Badge>
            ) : (
              <span>By {app.ownerEmail ?? "a member"}</span>
            )}
            {app.remixedFromName ? (
              <span data-testid="remixed-from">Remixed from {app.remixedFromName}</span>
            ) : null}
          </div>
        }
        actions={
          <>
            {app.isOwner ? (
              <Button variant="outline" onClick={() => setDialog("rename")}>
                <Pencil data-icon="inline-start" />
                Rename
              </Button>
            ) : (
              <Button
                pending={pending}
                onClick={async () => {
                  setError(null);
                  setPending(true);
                  try {
                    const copy = await remixApp({ data: { id: app.id } });
                    await navigate({ to: "/apps/$appId", params: { appId: copy.id } });
                  } catch (cause) {
                    setError(messageOf(cause));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <GitFork data-icon="inline-start" />
                Remix
              </Button>
            )}
            <Button variant="outline" onClick={download} disabled={!app.current}>
              <Download data-icon="inline-start" />
              Download
            </Button>
            {app.canRemoveFromGallery ? (
              <Button variant="outline" onClick={() => setDialog("remove")}>
                Remove from gallery
              </Button>
            ) : null}
            {app.isOwner ? (
              <Button variant="outline" className="hover:text-destructive" onClick={() => setDialog("delete")}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />
      {error ? (
        <Alert variant="destructive" data-testid="action-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className={app.isOwner ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]" : ""}>
        <Tabs defaultValue="preview" className="min-w-0 gap-3">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>
            <span data-testid="version-label" className="text-sm text-muted-foreground">
              Version {app.current?.number}
            </span>
          </div>
          <TabsContent value="preview">
            <iframe
              key={app.current?.number}
              title={`${app.name} preview`}
              data-testid="app-preview"
              sandbox="allow-scripts"
              srcDoc={app.current?.html ?? ""}
              className="h-[65vh] min-h-96 w-full rounded-xl border border-border bg-card"
            />
          </TabsContent>
          <TabsContent value="code">
            <pre
              data-testid="app-code"
              className="h-[65vh] min-h-96 overflow-auto rounded-xl border border-border bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all"
            >
              {app.current?.html}
            </pre>
          </TabsContent>
        </Tabs>

        {app.isOwner ? (
          <aside className="space-y-6">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-4">
              <Label htmlFor="share-switch">Share with your organization</Label>
              <Switch
                id="share-switch"
                data-testid="share-switch"
                checked={shared}
                disabled={pending}
                onCheckedChange={(on) =>
                  void act(() =>
                    setAppVisibility({ data: { id: app.id, visibility: on ? "organization" : "private" } }),
                  )
                }
              />
            </div>
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void revise();
              }}
            >
              <Label htmlFor="refine-input">Change something</Label>
              <Textarea
                id="refine-input"
                data-testid="refine-input"
                placeholder="Make the header larger"
                value={instruction}
                disabled={revising}
                className="min-h-20 bg-card"
                onChange={(event) => setInstruction(event.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" pending={revising} disabled={!instruction.trim()}>
                  {revising ? null : <Send data-icon="inline-start" />}
                  Send
                </Button>
              </div>
            </form>
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Versions</h2>
              <ol className="space-y-2">
                {[...app.versions].reverse().map((version) => (
                  <li
                    key={version.number}
                    data-testid="version-item"
                    className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Version {version.number}</span>
                      {version.number === app.current?.number ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={pending}
                          onClick={() =>
                            act(() => restoreAppVersion({ data: { id: app.id, number: version.number } }))
                          }
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                    <p className="line-clamp-3 text-muted-foreground">{version.instruction}</p>
                    <p className="text-xs text-muted-foreground">
                      <time suppressHydrationWarning>{timeAgo(version.createdAt)}</time>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        ) : null}
      </div>

      {dialog === "rename" ? (
        <RenameDialog
          title="Rename app"
          label="Name"
          value={app.name}
          onClose={() => setDialog(null)}
          onSave={(name) => act(() => renameApp({ data: { id: app.id, name } }))}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title={`Delete “${app.name}”?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deleteApp({ data: { id: app.id } });
              await navigate({ to: "/apps" });
            } catch (cause) {
              setError(messageOf(cause));
              setDialog(null);
            } finally {
              setPending(false);
            }
          }}
        >
          Every version is deleted with it.
        </ConfirmDialog>
      ) : null}
      {dialog === "remove" ? (
        <ConfirmDialog
          title={`Remove “${app.name}” from the gallery?`}
          confirmLabel="Remove"
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setPending(true);
            try {
              await setAppVisibility({ data: { id: app.id, visibility: "private" } });
              await navigate({ to: "/apps" });
            } catch (cause) {
              setError(messageOf(cause));
              setDialog(null);
            } finally {
              setPending(false);
            }
          }}
        >
          It becomes private to its owner again.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
