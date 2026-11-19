import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { RenameDialog } from "@/client/components/RenameDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { messageOf, timeAgo } from "@/client/lib/errors";
import { modelLabel } from "@/lib/models";
import {
  deletePrompt,
  duplicatePrompt,
  listPrompts,
  renamePrompt,
} from "@/serverFunctions/prompts";

const SORTS = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently created" },
  { value: "title", label: "Title A–Z" },
] as const;

const search = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(["updated", "title", "created"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listPrompts({
      data: { q: deps.q ?? "", sort: deps.sort ?? "updated", page: deps.page ?? 1 },
    }),
  head: () => ({ meta: [{ title: "Prompts" }] }),
  component: History,
});

type Row = Awaited<ReturnType<typeof listPrompts>>["rows"][number];

function History() {
  const list = Route.useLoaderData();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const router = useRouter();
  const [query, setQuery] = useState(params.q ?? "");
  const [renaming, setRenaming] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(work: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  const filtered = Boolean(params.q);
  return (
    <AppShell>
      <PageHeader
        title="Prompts"
        actions={
          <Button render={<Link to="/prompts/new" />}>
            <Plus data-icon="inline-start" />
            New prompt
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="search"
            aria-label="Search by title"
            placeholder="Search by title"
            className="bg-card pl-8"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              void navigate({
                search: (prev) => ({ ...prev, q: event.target.value || undefined, page: undefined }),
                replace: true,
              });
            }}
          />
        </div>
        <Select
          value={params.sort ?? "updated"}
          items={SORTS.map((sort) => ({ value: sort.value, label: sort.label }))}
          onValueChange={(sort) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                sort: sort === "updated" || !sort ? undefined : sort,
                page: undefined,
              }),
            })
          }
        >
          <SelectTrigger data-testid="sort-select" aria-label="Sort" className="w-48 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {sort.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <Alert variant="destructive" data-testid="action-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {list.rows.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No prompts match that title." />
        ) : (
          <EmptyState
            title="No prompts yet"
            description="Run a prompt and it saves here."
            action={<Button render={<Link to="/prompts/new" />}>New prompt</Button>}
          />
        )
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((row) => (
                <TableRow key={row.id} data-testid="prompt-row">
                  <TableCell className="font-medium">
                    <Link
                      to="/prompts/$promptId"
                      params={{ promptId: row.id }}
                      className="hover:underline"
                    >
                      {row.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{modelLabel(row.model)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={new Date(row.updatedAt).toISOString()} suppressHydrationWarning>
                      {timeAgo(row.updatedAt)}
                    </time>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" aria-label="Rename" disabled={pending} onClick={() => setRenaming(row)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Duplicate"
                        disabled={pending}
                        onClick={() => act(() => duplicatePrompt({ data: { id: row.id } }))}
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        className="hover:text-destructive"
                        disabled={pending}
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {list.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <span data-testid="page-status" className="text-sm text-muted-foreground">
            Page {list.page} of {list.pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={list.page <= 1}
              onClick={() => void navigate({ search: (prev) => ({ ...prev, page: list.page - 1 }) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={list.page >= list.pageCount}
              onClick={() => void navigate({ search: (prev) => ({ ...prev, page: list.page + 1 }) })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
      {renaming ? (
        <RenameDialog
          title="Rename prompt"
          label="Title"
          value={renaming.title}
          onClose={() => setRenaming(null)}
          onSave={(title) => act(() => renamePrompt({ data: { id: renaming.id, title } }))}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.title}”?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            void act(() => deletePrompt({ data: { id: deleting.id } })).then(() => setDeleting(null))
          }
        >
          Its conversation is deleted with it.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
