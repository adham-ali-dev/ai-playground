import { useState } from "react";
import { Pencil, RotateCcw, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import { modelLabel } from "@/lib/models";
import type { Turn } from "@/server/prompts";

/** One message of the conversation, with what a person can do to it. */
export function TurnCard({
  turn,
  busy,
  onEdit,
  onDelete,
  onRate,
  onRerun,
}: {
  turn: Turn;
  busy: boolean;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onRate: (rating: -1 | 0 | 1) => void;
  onRerun: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const isModel = turn.role === "model";
  return (
    <div
      data-testid="turn"
      data-role={turn.role}
      data-model={turn.model ?? undefined}
      className={
        isModel
          ? "min-w-0 space-y-2 rounded-xl border border-border bg-card p-4"
          : "min-w-0 space-y-2 rounded-xl bg-muted p-4"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {isModel ? modelLabel(turn.model) : "You"}
        </span>
        <div className="flex items-center gap-0.5">
          {isModel && !turn.error ? (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Good response"
                aria-pressed={turn.rating === 1}
                className="aria-pressed:text-primary"
                disabled={busy}
                onClick={() => onRate(turn.rating === 1 ? 0 : 1)}
              >
                <ThumbsUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Bad response"
                aria-pressed={turn.rating === -1}
                className="aria-pressed:text-primary"
                disabled={busy}
                onClick={() => onRate(turn.rating === -1 ? 0 : -1)}
              >
                <ThumbsDown />
              </Button>
            </>
          ) : null}
          {!isModel ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Rerun from here"
              disabled={busy}
              onClick={onRerun}
            >
              <RotateCcw />
            </Button>
          ) : null}
          {!turn.error ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Edit"
              disabled={busy}
              onClick={() => setEditing(turn.text)}
            >
              <Pencil />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete"
            className="hover:text-destructive"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {editing !== null ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onEdit(editing);
            setEditing(null);
          }}
        >
          <Textarea
            data-testid="turn-editor"
            aria-label="Message text"
            value={editing}
            autoFocus
            onChange={(event) => setEditing(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      ) : turn.error ? (
        <Alert variant="destructive" data-testid="side-error">
          <AlertDescription>{turn.error}</AlertDescription>
        </Alert>
      ) : (
        <p data-testid="turn-text" className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {turn.text}
        </p>
      )}
    </div>
  );
}
