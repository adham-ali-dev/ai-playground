import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";

/** Asks for a new name. Render it only while it is open. */
export function RenameDialog({
  title,
  label,
  value,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  value: string;
  onSave: (next: string) => void;
  onClose: () => void;
}) {
  const [next, setNext] = useState(value);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!next.trim()) return;
            onClose();
            onSave(next.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">{label}</Label>
            <Input
              id="rename-input"
              data-testid="rename-input"
              value={next}
              autoFocus
              maxLength={200}
              onChange={(event) => setNext(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!next.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
