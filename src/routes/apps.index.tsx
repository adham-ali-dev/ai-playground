import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { timeAgo } from "@/client/lib/errors";
import { listApps } from "@/serverFunctions/apps";

export const Route = createFileRoute("/apps/")({
  loader: () => listApps(),
  head: () => ({ meta: [{ title: "Apps" }] }),
  component: Apps,
});

type Card = Awaited<ReturnType<typeof listApps>>["mine"][number];

function Apps() {
  const { mine, gallery } = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader
        title="Apps"
        actions={
          <Button render={<Link to="/apps/new" />}>
            <Plus data-icon="inline-start" />
            New app
          </Button>
        }
      />
      <Section title="Your apps" testId="my-apps">
        {mine.length === 0 ? (
          <EmptyState
            title="No apps yet"
            description="Describe one and it's built for you."
            action={<Button render={<Link to="/apps/new" />}>New app</Button>}
          />
        ) : (
          <Grid>
            {mine.map((app) => (
              <AppCard key={app.id} app={app} showVisibility />
            ))}
          </Grid>
        )}
      </Section>
      <Section title="Shared in your organization" testId="gallery">
        {gallery.length === 0 ? (
          <EmptyState title="Nothing shared yet" description="Apps members share appear here." />
        ) : (
          <Grid>
            {gallery.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </Grid>
        )}
      </Section>
    </AppShell>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function AppCard({ app, showVisibility = false }: { app: Card; showVisibility?: boolean }) {
  return (
    <div
      data-testid="app-card"
      className="relative space-y-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/apps/$appId"
          params={{ appId: app.id }}
          className="min-w-0 font-medium after:absolute after:inset-0"
        >
          {app.name}
        </Link>
        {showVisibility && app.visibility === "organization" ? <Badge variant="secondary">Shared</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {showVisibility ? null : <>{app.ownerEmail ?? "A member"} · </>}
        <time suppressHydrationWarning>{timeAgo(app.updatedAt)}</time>
      </p>
    </div>
  );
}
