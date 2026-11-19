import { and, asc, desc, eq, max } from "drizzle-orm";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import { db } from "@/db";
import { appVersions, apps, users } from "@/db/schema";
import { extractHtml } from "@/lib/html";
import { APP_MODEL } from "@/lib/models";
import { chat, type ChatMessage } from "@/server/ai";

interface Viewer {
  id: string;
  orgRole: string;
}

const id = z.string().uuid();
export const createAppInput = z
  .object({ description: z.string().trim().min(1, "Describe the app first.").max(5000) })
  .strict();
export const reviseAppInput = z
  .object({ id, instruction: z.string().trim().min(1, "Say what to change.").max(5000) })
  .strict();
export const restoreInput = z.object({ id, number: z.number().int().min(1) }).strict();
export const visibilityInput = z
  .object({ id, visibility: z.enum(["private", "organization"]) })
  .strict();
export const renameAppInput = z
  .object({ id, name: z.string().trim().min(1, "Give it a name.").max(120) })
  .strict();
export const appIdInput = z.object({ id }).strict();

const SYSTEM = [
  "You build small web apps.",
  "Reply with one complete, self-contained single HTML file: HTML, CSS and JavaScript inline, no external scripts, stylesheets, fonts or images, no network requests.",
  "Put the whole file in one ```html fenced block and write nothing else after it.",
  "The app must work on its own when opened in a browser, and look good on phones and desktops.",
  "When asked for a change, reply with the whole updated file.",
].join(" ");

/** Something a person can fix or act on, shown as it is. */
export class AppError extends Error {}

function nameFrom(description: string): string {
  const first = description.trim().split(/[\n.!?]/)[0]!.trim();
  return (first.length > 60 ? `${first.slice(0, 59)}…` : first) || "Untitled app";
}

async function generate(messages: ChatMessage[]): Promise<string> {
  const result = await chat(APP_MODEL, [{ role: "system", content: SYSTEM }, ...messages], {
    maxTokens: 8000,
  });
  if (!result.ok) throw new AppError(result.error);
  const html = extractHtml(result.text);
  if (!html) throw new AppError("The model didn't return a web page. Try rewording the request.");
  return html;
}

async function findApp(appId: string) {
  const [app] = await db.select().from(apps).where(eq(apps.id, appId));
  return app ?? null;
}

/** The app when the viewer may see it: their own, or one shared with the organization. */
async function visibleApp(viewer: Viewer, appId: string) {
  const app = await findApp(appId);
  if (!app) return null;
  if (app.ownerId !== viewer.id && app.visibility !== "organization") return null;
  return app;
}

async function ownApp(viewer: Viewer, appId: string) {
  const app = await findApp(appId);
  return app && app.ownerId === viewer.id ? app : null;
}

async function latestVersion(appId: string) {
  const [version] = await db
    .select()
    .from(appVersions)
    .where(eq(appVersions.appId, appId))
    .orderBy(desc(appVersions.number))
    .limit(1);
  return version ?? null;
}

const card = {
  id: apps.id,
  name: apps.name,
  ownerId: apps.ownerId,
  ownerEmail: users.email,
  visibility: apps.visibility,
  updatedAt: apps.updatedAt,
};

export async function listApps(viewer: Viewer) {
  const [mine, gallery] = await Promise.all([
    db
      .select(card)
      .from(apps)
      .leftJoin(users, eq(users.id, apps.ownerId))
      .where(eq(apps.ownerId, viewer.id))
      .orderBy(desc(apps.updatedAt)),
    db
      .select(card)
      .from(apps)
      .leftJoin(users, eq(users.id, apps.ownerId))
      .where(eq(apps.visibility, "organization"))
      .orderBy(desc(apps.updatedAt)),
  ]);
  return { mine, gallery };
}

export async function getApp(viewer: Viewer, appId: string) {
  const app = await visibleApp(viewer, appId);
  if (!app) return null;
  const isOwner = app.ownerId === viewer.id;
  const [versions, current, [owner]] = await Promise.all([
    db
      .select({
        number: appVersions.number,
        instruction: appVersions.instruction,
        createdAt: appVersions.createdAt,
      })
      .from(appVersions)
      .where(eq(appVersions.appId, appId))
      .orderBy(asc(appVersions.number)),
    latestVersion(appId),
    db.select({ email: users.email }).from(users).where(eq(users.id, app.ownerId)),
  ]);
  return {
    id: app.id,
    name: app.name,
    visibility: app.visibility,
    ownerEmail: owner?.email ?? null,
    remixedFromId: app.remixedFromId,
    remixedFromName: app.remixedFromName,
    isOwner,
    canRemoveFromGallery: !isOwner && isAdmin(viewer) && app.visibility === "organization",
    versions: isOwner ? versions : [],
    current: current ? { number: current.number, html: current.html } : null,
  };
}

export async function createApp(viewer: Viewer, input: z.infer<typeof createAppInput>) {
  const html = await generate([{ role: "user", content: input.description }]);
  const now = Date.now();
  const appId = crypto.randomUUID();
  await db.batch([
    db.insert(apps).values({
      id: appId,
      ownerId: viewer.id,
      name: nameFrom(input.description),
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(appVersions).values({
      id: crypto.randomUUID(),
      appId,
      number: 1,
      instruction: input.description,
      html,
      createdAt: now,
    }),
  ]);
  return { id: appId };
}

async function addVersion(appId: string, instruction: string, html: string) {
  const [top] = await db
    .select({ number: max(appVersions.number) })
    .from(appVersions)
    .where(eq(appVersions.appId, appId));
  const now = Date.now();
  const number = (top?.number ?? 0) + 1;
  await db.batch([
    db.insert(appVersions).values({
      id: crypto.randomUUID(),
      appId,
      number,
      instruction,
      html,
      createdAt: now,
    }),
    db.update(apps).set({ updatedAt: now }).where(eq(apps.id, appId)),
  ]);
  return { number };
}

export async function reviseApp(viewer: Viewer, input: z.infer<typeof reviseAppInput>) {
  const app = await ownApp(viewer, input.id);
  if (!app) return null;
  const current = await latestVersion(app.id);
  const [first] = await db
    .select({ instruction: appVersions.instruction })
    .from(appVersions)
    .where(eq(appVersions.appId, app.id))
    .orderBy(asc(appVersions.number))
    .limit(1);
  const html = await generate([
    { role: "user", content: first?.instruction ?? app.name },
    { role: "assistant", content: `\`\`\`html\n${current?.html ?? ""}\n\`\`\`` },
    { role: "user", content: input.instruction },
  ]);
  return addVersion(app.id, input.instruction, html);
}

export async function restoreVersion(viewer: Viewer, input: z.infer<typeof restoreInput>) {
  const app = await ownApp(viewer, input.id);
  if (!app) return null;
  const [version] = await db
    .select()
    .from(appVersions)
    .where(and(eq(appVersions.appId, app.id), eq(appVersions.number, input.number)));
  if (!version) return null;
  return addVersion(app.id, `Restored version ${version.number}`, version.html);
}

/**
 * The owner shares or unshares. An admin may take someone else's shared
 * app out of the gallery, and do nothing else with it.
 */
export async function setVisibility(viewer: Viewer, input: z.infer<typeof visibilityInput>) {
  const app = await findApp(input.id);
  if (!app) return false;
  const isOwner = app.ownerId === viewer.id;
  const adminRemoval =
    !isOwner &&
    isAdmin(viewer) &&
    app.visibility === "organization" &&
    input.visibility === "private";
  if (!isOwner && !adminRemoval) return false;
  await db
    .update(apps)
    .set({ visibility: input.visibility, ...(isOwner && { updatedAt: Date.now() }) })
    .where(eq(apps.id, app.id));
  return true;
}

export async function renameApp(viewer: Viewer, input: z.infer<typeof renameAppInput>) {
  const changed = await db
    .update(apps)
    .set({ name: input.name, updatedAt: Date.now() })
    .where(and(eq(apps.id, input.id), eq(apps.ownerId, viewer.id)))
    .returning({ id: apps.id });
  return changed.length > 0;
}

export async function deleteApp(viewer: Viewer, appId: string) {
  if (!(await ownApp(viewer, appId))) return false;
  await db.batch([
    db.delete(appVersions).where(eq(appVersions.appId, appId)),
    db.delete(apps).where(and(eq(apps.id, appId), eq(apps.ownerId, viewer.id))),
  ]);
  return true;
}

/** A private copy of a visible app's current version, owned by the viewer. */
export async function remixApp(viewer: Viewer, appId: string) {
  const source = await visibleApp(viewer, appId);
  if (!source) return null;
  const current = await latestVersion(source.id);
  if (!current) return null;
  const now = Date.now();
  const copyId = crypto.randomUUID();
  await db.batch([
    db.insert(apps).values({
      id: copyId,
      ownerId: viewer.id,
      name: `Remix of ${source.name}`.slice(0, 120),
      visibility: "private",
      remixedFromId: source.id,
      remixedFromName: source.name,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(appVersions).values({
      id: crypto.randomUUID(),
      appId: copyId,
      number: 1,
      instruction: `Remixed from ${source.name}, version ${current.number}`,
      html: current.html,
      createdAt: now,
    }),
  ]);
  return { id: copyId };
}
