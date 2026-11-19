import { and, asc, count, desc, eq, gt, like, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prompts, turns } from "@/db/schema";
import { DEFAULT_MODEL, DEFAULT_SETTINGS, LIMITS, MODEL_IDS } from "@/lib/models";
import { chat, type ChatMessage } from "@/server/ai";

const id = z.string().uuid();

export const settingsInput = z
  .object({
    model: z.enum(MODEL_IDS),
    compareModel: z.enum(MODEL_IDS).nullable(),
    systemInstruction: z.string().max(20000),
    temperature: z.number().min(LIMITS.temperature.min).max(LIMITS.temperature.max),
    topP: z.number().min(LIMITS.topP.min).max(LIMITS.topP.max),
    maxOutputTokens: z
      .number()
      .int()
      .min(LIMITS.maxOutputTokens.min)
      .max(LIMITS.maxOutputTokens.max),
  })
  .strict();
export type PromptSettings = z.infer<typeof settingsInput>;

const message = z.string().trim().min(1, "Type a message first.").max(50000);

export const startInput = z.object({ settings: settingsInput, text: message }).strict();
export const runInput = z
  .object({ id, settings: settingsInput, text: z.string().trim().max(50000) })
  .strict();
export const updateSettingsInput = z.object({ id, settings: settingsInput }).strict();
export const renameInput = z
  .object({ id, title: z.string().trim().min(1, "Give it a title.").max(200) })
  .strict();
export const idInput = z.object({ id }).strict();
export const editTurnInput = z.object({ id, text: z.string().max(50000) }).strict();
export const rateTurnInput = z
  .object({ id, rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })
  .strict();
export const listInput = z
  .object({
    q: z.string().trim().max(200).default(""),
    sort: z.enum(["updated", "title", "created"]).default("updated"),
    page: z.number().int().min(1).default(1),
  })
  .strict();

export const PAGE_SIZE = 10;

export class NotFound extends Error {
  constructor(what = "Prompt") {
    super(`${what} not found.`);
  }
}

export interface Turn {
  id: string;
  position: number;
  slot: number;
  role: "user" | "model";
  text: string;
  model: string | null;
  rating: number;
  error: string | null;
}

const shownTurn = {
  id: turns.id,
  position: turns.position,
  slot: turns.slot,
  role: turns.role,
  text: turns.text,
  model: turns.model,
  rating: turns.rating,
  error: turns.error,
};

function titleFrom(text: string): string {
  const line = text.trim().split("\n")[0]!.trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

async function ownedPrompt(ownerId: string, promptId: string) {
  const [prompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.ownerId, ownerId)));
  return prompt ?? null;
}

function listTurns(promptId: string): Promise<Turn[]> {
  return db
    .select(shownTurn)
    .from(turns)
    .where(eq(turns.promptId, promptId))
    .orderBy(asc(turns.position), asc(turns.slot));
}

/** A prompt with its turns, or null when the owner has no prompt with the id. */
export async function getPrompt(ownerId: string, promptId: string) {
  const prompt = await ownedPrompt(ownerId, promptId);
  if (!prompt) return null;
  return {
    id: prompt.id,
    title: prompt.title,
    updatedAt: prompt.updatedAt,
    settings: {
      model: prompt.model,
      compareModel: prompt.compareModel,
      systemInstruction: prompt.systemInstruction,
      temperature: prompt.temperature,
      topP: prompt.topP,
      maxOutputTokens: prompt.maxOutputTokens,
    } as PromptSettings,
    turns: await listTurns(prompt.id),
  };
}

export const NEW_PROMPT_SETTINGS: PromptSettings = {
  model: DEFAULT_MODEL,
  compareModel: null,
  systemInstruction: "",
  ...DEFAULT_SETTINGS,
};

export async function listPrompts(ownerId: string, input: z.infer<typeof listInput>) {
  const where = and(
    eq(prompts.ownerId, ownerId),
    input.q ? like(prompts.title, `%${input.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );
  const order =
    input.sort === "title"
      ? [asc(prompts.title), desc(prompts.updatedAt)]
      : input.sort === "created"
        ? [desc(prompts.createdAt)]
        : [desc(prompts.updatedAt)];
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: prompts.id,
        title: prompts.title,
        model: prompts.model,
        updatedAt: prompts.updatedAt,
      })
      .from(prompts)
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((input.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(prompts).where(where),
  ]);
  const pageCount = Math.max(1, Math.ceil((total?.n ?? 0) / PAGE_SIZE));
  return { rows, total: total?.n ?? 0, page: input.page, pageCount };
}

/** The conversation as the model reads it: the main thread, without failed answers. */
function conversation(settings: PromptSettings, history: Turn[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (settings.systemInstruction.trim())
    messages.push({ role: "system", content: settings.systemInstruction });
  for (const turn of history) {
    if (turn.slot !== 0 || turn.error) continue;
    messages.push({ role: turn.role === "model" ? "assistant" : "user", content: turn.text });
  }
  return messages;
}

/**
 * Sends the prompt's conversation to its model, and to the compare model
 * when one is set, and stores the answers. Without compare, a failed call
 * stores nothing and comes back as `error`; with compare, each side's
 * failure is stored on that side.
 */
async function answer(promptId: string, settings: PromptSettings): Promise<{ error: string | null }> {
  const history = await listTurns(promptId);
  const last = history.at(-1);
  if (!last || last.role !== "user") return { error: "Type a message first." };
  const messages = conversation(settings, history);
  const options = {
    temperature: settings.temperature,
    topP: settings.topP,
    maxTokens: settings.maxOutputTokens,
  };
  const models = settings.compareModel ? [settings.model, settings.compareModel] : [settings.model];
  const results = await Promise.all(models.map((model) => chat(model, messages, options)));
  const now = Date.now();
  const position = last.position + 1;
  if (!settings.compareModel) {
    const [result] = results;
    if (!result!.ok) return { error: result!.error };
  }
  await db.batch([
    db.insert(turns).values(
      results.map((result, slot) => ({
        id: crypto.randomUUID(),
        promptId,
        position,
        slot,
        role: "model" as const,
        text: result.ok ? result.text : "",
        error: result.ok ? null : result.error,
        model: models[slot]!,
        createdAt: now,
      })),
    ),
    db.update(prompts).set({ updatedAt: now }).where(eq(prompts.id, promptId)),
  ]);
  return { error: null };
}

/** Creates a prompt from its first message and runs it. */
export async function startPrompt(ownerId: string, input: z.infer<typeof startInput>) {
  const now = Date.now();
  const promptId = crypto.randomUUID();
  await db.batch([
    db.insert(prompts).values({
      id: promptId,
      ownerId,
      title: titleFrom(input.text),
      ...input.settings,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(turns).values({
      id: crypto.randomUUID(),
      promptId,
      position: 0,
      slot: 0,
      role: "user",
      text: input.text,
      createdAt: now,
    }),
  ]);
  const { error } = await answer(promptId, input.settings);
  return { id: promptId, error };
}

/** Saves the settings, adds the message when there is one, and runs. Null when not the owner's. */
export async function runPrompt(ownerId: string, input: z.infer<typeof runInput>) {
  if (!(await updateSettings(ownerId, { id: input.id, settings: input.settings }))) return null;
  if (input.text) {
    const [top] = await db
      .select({ position: max(turns.position) })
      .from(turns)
      .where(eq(turns.promptId, input.id));
    await db.insert(turns).values({
      id: crypto.randomUUID(),
      promptId: input.id,
      position: (top?.position ?? -1) + 1,
      slot: 0,
      role: "user",
      text: input.text,
      createdAt: Date.now(),
    });
  }
  return answer(input.id, input.settings);
}

export async function updateSettings(ownerId: string, input: z.infer<typeof updateSettingsInput>) {
  const changed = await db
    .update(prompts)
    .set({ ...input.settings, updatedAt: Date.now() })
    .where(and(eq(prompts.id, input.id), eq(prompts.ownerId, ownerId)))
    .returning({ id: prompts.id });
  return changed.length > 0;
}

export async function renamePrompt(ownerId: string, input: z.infer<typeof renameInput>) {
  const changed = await db
    .update(prompts)
    .set({ title: input.title, updatedAt: Date.now() })
    .where(and(eq(prompts.id, input.id), eq(prompts.ownerId, ownerId)))
    .returning({ id: prompts.id });
  return changed.length > 0;
}

/** A new prompt with the source's settings and turns. Null when not the owner's. */
export async function duplicatePrompt(ownerId: string, promptId: string) {
  const source = await ownedPrompt(ownerId, promptId);
  if (!source) return null;
  const now = Date.now();
  const copyId = crypto.randomUUID();
  const sourceTurns = await db.select().from(turns).where(eq(turns.promptId, promptId));
  const statements = [
    db.insert(prompts).values({
      ...source,
      id: copyId,
      title: `Copy of ${source.title}`.slice(0, 200),
      createdAt: now,
      updatedAt: now,
    }),
    // D1 caps bound parameters per statement, so turns go in small groups.
    ...chunk(sourceTurns, 8).map((group) =>
      db.insert(turns).values(
        group.map((turn) => ({ ...turn, id: crypto.randomUUID(), promptId: copyId })),
      ),
    ),
  ] as const;
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { id: copyId };
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export async function deletePrompt(ownerId: string, promptId: string) {
  if (!(await ownedPrompt(ownerId, promptId))) return false;
  await db.batch([
    db.delete(turns).where(eq(turns.promptId, promptId)),
    db.delete(prompts).where(and(eq(prompts.id, promptId), eq(prompts.ownerId, ownerId))),
  ]);
  return true;
}

/** The turn with its prompt, when the prompt is the owner's. */
async function ownedTurn(ownerId: string, turnId: string) {
  const [row] = await db
    .select({ turn: turns, promptId: prompts.id })
    .from(turns)
    .innerJoin(prompts, eq(prompts.id, turns.promptId))
    .where(and(eq(turns.id, turnId), eq(prompts.ownerId, ownerId)));
  return row ?? null;
}

async function touch(promptId: string) {
  await db.update(prompts).set({ updatedAt: Date.now() }).where(eq(prompts.id, promptId));
}

export async function editTurn(ownerId: string, input: z.infer<typeof editTurnInput>) {
  const owned = await ownedTurn(ownerId, input.id);
  if (!owned) return false;
  await db.batch([
    db.update(turns).set({ text: input.text, error: null }).where(eq(turns.id, input.id)),
    db.update(prompts).set({ updatedAt: Date.now() }).where(eq(prompts.id, owned.promptId)),
  ]);
  return true;
}

export async function deleteTurn(ownerId: string, turnId: string) {
  const owned = await ownedTurn(ownerId, turnId);
  if (!owned) return false;
  await db.delete(turns).where(eq(turns.id, turnId));
  await touch(owned.promptId);
  return true;
}

export async function rateTurn(ownerId: string, input: z.infer<typeof rateTurnInput>) {
  const owned = await ownedTurn(ownerId, input.id);
  if (!owned || owned.turn.role !== "model") return false;
  await db.update(turns).set({ rating: input.rating }).where(eq(turns.id, input.id));
  return true;
}

/** Drops every turn after a user turn and runs again from it. Null when not the owner's. */
export async function rerunFrom(ownerId: string, turnId: string) {
  const owned = await ownedTurn(ownerId, turnId);
  if (!owned || owned.turn.role !== "user") return null;
  const prompt = await getPrompt(ownerId, owned.promptId);
  if (!prompt) return null;
  await db
    .delete(turns)
    .where(and(eq(turns.promptId, owned.promptId), gt(turns.position, owned.turn.position)));
  return answer(owned.promptId, prompt.settings);
}
