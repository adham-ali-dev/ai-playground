import { useNavigate, useRouter } from "@tanstack/react-router";
import { Pencil, Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { RenameDialog } from "@/client/components/RenameDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { GetCodeDialog } from "@/client/prompts/GetCodeDialog";
import { TurnCard } from "@/client/prompts/TurnCard";
import { LIMITS, MODELS, type ModelId } from "@/lib/models";
import type { PromptSettings, Turn } from "@/server/prompts";
import {
  deleteTurn,
  editTurn,
  rateTurn,
  renamePrompt,
  rerunFrom,
  runPrompt,
  startPrompt,
  updatePromptSettings,
} from "@/serverFunctions/prompts";

/** A failed first run, carried across the move from /prompts/new to the saved prompt. */
let carried: { id: string; error: string } | null = null;

type NumberField = "temperature" | "topP" | "maxOutputTokens";

export function PromptEditor({
  prompt,
  initialSettings,
}: {
  prompt: { id: string; title: string; turns: Turn[] } | null;
  initialSettings: PromptSettings;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(initialSettings);
  const [numbers, setNumbers] = useState({
    temperature: String(initialSettings.temperature),
    topP: String(initialSettings.topP),
    maxOutputTokens: String(initialSettings.maxOutputTokens),
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(() => {
    if (prompt && carried?.id === prompt.id) {
      const error = carried.error;
      carried = null;
      return error;
    }
    return null;
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const turns = prompt?.turns ?? [];

  async function act(work: () => Promise<unknown>) {
    setActionError(null);
    setBusy(true);
    try {
      await work();
      await router.invalidate();
    } catch (error) {
      setActionError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  function save(next: PromptSettings) {
    setSettings(next);
    if (prompt) void act(() => updatePromptSettings({ data: { id: prompt.id, settings: next } }));
  }

  /** The typed number, kept within its limits; the last good value when it isn't one. */
  function commitNumber(field: NumberField, persist = true) {
    const parsed = Number(numbers[field]);
    const { min, max } = LIMITS[field];
    let value = Number.isFinite(parsed) && numbers[field].trim() !== "" ? parsed : settings[field];
    value = Math.min(max, Math.max(min, field === "maxOutputTokens" ? Math.round(value) : value));
    setNumbers((current) => ({ ...current, [field]: String(value) }));
    if (persist && value !== settings[field]) save({ ...settings, [field]: value });
    return value;
  }

  /** The settings as typed, which the run saves. */
  function currentSettings(): PromptSettings {
    const next = {
      ...settings,
      temperature: commitNumber("temperature", false),
      topP: commitNumber("topP", false),
      maxOutputTokens: commitNumber("maxOutputTokens", false),
    };
    setSettings(next);
    return next;
  }

  async function run(work: () => Promise<{ error: string | null } | { id: string; error: string | null }>) {
    setRunError(null);
    setActionError(null);
    setBusy(true);
    try {
      const result = await work();
      if ("id" in result) {
        if (result.error) carried = { id: result.id, error: result.error };
        await navigate({ to: "/prompts/$promptId", params: { promptId: result.id } });
        return;
      }
      if (result.error) setRunError(result.error);
      await router.invalidate();
    } catch (error) {
      setRunError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const text = message.trim();
    const last = turns.at(-1);
    if (!text && last?.role !== "user") return;
    const next = currentSettings();
    setMessage("");
    void run(() =>
      prompt
        ? runPrompt({ data: { id: prompt.id, settings: next, text } })
        : startPrompt({ data: { settings: next, text } }),
    );
  }

  const groups = groupByPosition(turns);
  const comparing = settings.compareModel !== null;

  return (
    <AppShell wide>
      <PageHeader
        title={prompt?.title ?? "New prompt"}
        actions={
          <>
            {prompt ? (
              <Button variant="outline" onClick={() => setRenaming(true)}>
                <Pencil data-icon="inline-start" />
                Rename
              </Button>
            ) : null}
            <GetCodeDialog
              input={{
                ...settings,
                temperature: Number(numbers.temperature) || 0,
                topP: Number(numbers.topP) || 0,
                maxOutputTokens: Number(numbers.maxOutputTokens) || 0,
                turns: turns.filter((turn) => turn.slot === 0 && !turn.error),
              }}
            />
          </>
        }
      />
      {renaming && prompt ? (
        <RenameDialog
          title="Rename prompt"
          label="Title"
          value={prompt.title}
          onClose={() => setRenaming(false)}
          onSave={(title) => act(() => renamePrompt({ data: { id: prompt.id, title } }))}
        />
      ) : null}
      {actionError ? (
        <Alert variant="destructive" data-testid="action-error">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          {groups.map((group) =>
            group.length > 1 ? (
              <div
                key={group[0]!.id}
                data-testid="compare-pair"
                className="grid gap-3 md:grid-cols-2"
              >
                {group.map((turn) => (
                  <TurnView key={turn.id} turn={turn} busy={busy} act={act} run={run} />
                ))}
              </div>
            ) : (
              <TurnView key={group[0]!.id} turn={group[0]!} busy={busy} act={act} run={run} />
            ),
          )}
          {runError ? (
            <Alert variant="destructive" data-testid="run-error">
              <AlertDescription>{runError}</AlertDescription>
            </Alert>
          ) : null}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Textarea
              data-testid="message-input"
              aria-label="Message"
              placeholder="Type a message"
              value={message}
              disabled={busy}
              className="min-h-24 bg-card"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex items-center justify-end">
              <Button type="submit" data-testid="run" pending={busy}>
                {busy ? null : <Play data-icon="inline-start" />}
                Run
              </Button>
            </div>
          </form>
        </div>

        <aside className="order-1 space-y-5 lg:order-2">
          <Field label="Model" htmlFor="model-select">
            <ModelSelect
              id="model-select"
              value={settings.model}
              onChange={(model) => save({ ...settings, model })}
            />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="compare-toggle">Compare with a second model</Label>
              <Switch
                id="compare-toggle"
                data-testid="compare-toggle"
                checked={comparing}
                onCheckedChange={(on) =>
                  save({
                    ...settings,
                    compareModel: on
                      ? (MODELS.find((model) => model.id !== settings.model)?.id ?? null)
                      : null,
                  })
                }
              />
            </div>
            {comparing ? (
              <ModelSelect
                id="compare-model-select"
                label="Second model"
                value={settings.compareModel!}
                onChange={(compareModel) => save({ ...settings, compareModel })}
              />
            ) : null}
          </div>
          <Field label="System instructions" htmlFor="system-instructions">
            <Textarea
              id="system-instructions"
              data-testid="system-instructions"
              placeholder="Optional"
              value={settings.systemInstruction}
              className="min-h-24 bg-card"
              onChange={(event) =>
                setSettings({ ...settings, systemInstruction: event.target.value })
              }
              onBlur={() => save(settings)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <NumberInput
              id="temperature"
              label="Temperature"
              hint="0–2"
              step="0.1"
              value={numbers.temperature}
              onChange={(value) => setNumbers({ ...numbers, temperature: value })}
              onCommit={() => commitNumber("temperature")}
            />
            <NumberInput
              id="top-p"
              label="Top-p"
              hint="0–1"
              step="0.05"
              value={numbers.topP}
              onChange={(value) => setNumbers({ ...numbers, topP: value })}
              onCommit={() => commitNumber("topP")}
            />
            <NumberInput
              id="max-tokens"
              label="Max output tokens"
              hint={`1–${LIMITS.maxOutputTokens.max}`}
              step="1"
              value={numbers.maxOutputTokens}
              onChange={(value) => setNumbers({ ...numbers, maxOutputTokens: value })}
              onCommit={() => commitNumber("maxOutputTokens")}
            />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function TurnView({
  turn,
  busy,
  act,
  run,
}: {
  turn: Turn;
  busy: boolean;
  act: (work: () => Promise<unknown>) => Promise<void>;
  run: (work: () => Promise<{ error: string | null }>) => Promise<void>;
}) {
  return (
    <TurnCard
      turn={turn}
      busy={busy}
      onEdit={(text) => act(() => editTurn({ data: { id: turn.id, text } }))}
      onDelete={() => act(() => deleteTurn({ data: { id: turn.id } }))}
      onRate={(rating) => act(() => rateTurn({ data: { id: turn.id, rating } }))}
      onRerun={() => run(() => rerunFrom({ data: { id: turn.id } }))}
    />
  );
}

function groupByPosition(turns: Turn[]): Turn[][] {
  const groups: Turn[][] = [];
  for (const turn of turns) {
    const last = groups.at(-1);
    if (last && last[0]!.position === turn.position && turn.role === "model" && last[0]!.role === "model")
      last.push(turn);
    else groups.push([turn]);
  }
  return groups;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ModelSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (model: ModelId) => void;
}) {
  return (
    <Select
      value={value}
      items={MODELS.map((model) => ({ value: model.id, label: model.label }))}
      onValueChange={(next) => next && onChange(next as ModelId)}
    >
      <SelectTrigger id={id} data-testid={id} aria-label={label} className="w-full bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumberInput({
  id,
  label,
  hint,
  step,
  value,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  hint: string;
  step: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-baseline justify-between gap-1">
        {label}
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </Label>
      <Input
        id={id}
        data-testid={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        className="bg-card"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
      />
    </div>
  );
}
