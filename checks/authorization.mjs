import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";

const ids = {
  ownerPrompt: "11111111-1111-4111-8111-111111111111",
  memberPrompt: "22222222-2222-4222-8222-222222222222",
  ownerPrivateApp: "33333333-3333-4333-8333-333333333333",
  ownerSharedApp: "44444444-4444-4444-8444-444444444444",
  memberApp: "55555555-5555-4555-8555-555555555555",
  memberSharedApp: "66666666-6666-4666-8666-666666666666",
};
const html = (title) => `<!doctype html><html><body><h1 id="app-title">${title}</h1></body></html>`;

async function seed(db) {
  const now = Date.now();
  const prompt = (id, owner, title) =>
    db.prepare("INSERT INTO prompts (id, owner_id, title, model, system_instruction, temperature, top_p, max_output_tokens, created_at, updated_at) VALUES (?, ?, ?, 'openai/gpt-4o-mini', '', 1, 0.95, 2048, ?, ?)").bind(id, owner, title, now, now).run();
  await prompt(ids.ownerPrompt, "owner", "Quarterly pricing strategy");
  await prompt(ids.memberPrompt, "member", "Member draft");
  await db.prepare("INSERT INTO turns (id, prompt_id, position, slot, role, text, created_at) VALUES (?, ?, 0, 0, 'user', 'Confidential margin numbers', ?)").bind(crypto.randomUUID(), ids.ownerPrompt, now).run();
  const app = async (id, owner, name, visibility) => {
    await db.prepare("INSERT INTO apps (id, owner_id, name, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, owner, name, visibility, now, now).run();
    await db.prepare("INSERT INTO app_versions (id, app_id, number, instruction, html, created_at) VALUES (?, ?, 1, ?, ?, ?)").bind(crypto.randomUUID(), id, name, html(name), now).run();
  };
  await app(ids.ownerPrivateApp, "owner", "Private budget tool", "private");
  await app(ids.ownerSharedApp, "owner", "Shared standup timer", "organization");
  await app(ids.memberApp, "member", "Member scratch app", "private");
  await app(ids.memberSharedApp, "member", "Member shared poll", "organization");
}

/** Sends the page's next server-function calls with `from` swapped for `to`, as a forged request would. */
async function forge(page, from, to) {
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    const body = request.postData();
    await route.continue({
      url: request.url().replaceAll(from, to),
      ...(body ? { postData: body.replaceAll(from, to) } : {}),
    });
  });
}

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/prompts/new", "/apps", "/apps/new"]);
  const db = await runtime.database();
  await seed(db);

  // Anonymous and outsider are refused on private objects, shared apps included.
  for (const path of [`/prompts/${ids.ownerPrompt}`, `/apps/${ids.ownerSharedApp}`, "/apps"]) {
    for (const role of [undefined, "outsider"]) {
      const response = await runtime.fetch(path, role ? { role } : {});
      expect(response.status, `${role ?? "anonymous"} ${path}`).not.toBe(200);
      expect(await response.text()).not.toContain("Quarterly pricing strategy");
    }
  }

  // No sign-in page of the app's own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/auth/login", "/logout"]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status, path).toBe(404);
    expect(await response.text()).not.toMatch(/type="password"/i);
  }

  // One member never reads another's prompts.
  const leak = await runtime.fetch(`/prompts/${ids.ownerPrompt}`, { role: "member" });
  const leakText = await leak.text();
  expect(leakText).not.toContain("Quarterly pricing strategy");
  expect(leakText).not.toContain("Confidential margin numbers");
  const member = await (await runtime.context("member")).newPage();
  await member.goto(`/prompts/${ids.ownerPrompt}`);
  await expect(member.getByText("Prompt not found")).toBeVisible();
  await member.goto("/");
  await expect(member.getByTestId("prompt-row")).toHaveCount(1);
  await expect(member.getByTestId("prompt-row")).toContainText("Member draft");

  // Nor another's private app; a shared app is read-only to them.
  const privateApp = await runtime.fetch(`/apps/${ids.ownerPrivateApp}`, { role: "member" });
  expect(await privateApp.text()).not.toContain("Private budget tool");
  await member.goto(`/apps/${ids.ownerPrivateApp}`);
  await expect(member.getByText("App not found")).toBeVisible();
  await member.goto("/apps");
  await expect(member.getByTestId("gallery")).toContainText("Shared standup timer");
  await expect(member.getByText("Private budget tool")).toHaveCount(0);
  await member.goto(`/apps/${ids.ownerSharedApp}`);
  await expect(member.getByRole("heading", { level: 1 })).toHaveText("Shared standup timer");
  for (const name of ["Rename", "Delete", "Remove from gallery", "Send"]) {
    await expect(member.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(member.getByTestId("share-switch")).toHaveCount(0);

  // Forged requests: the member's own ids swapped for the owner's.
  await member.goto(`/prompts/${ids.memberPrompt}`);
  await forge(member, ids.memberPrompt, ids.ownerPrompt);
  await member.getByRole("button", { name: "Rename" }).click();
  await member.getByTestId("rename-input").fill("Hijacked");
  await member.getByRole("button", { name: "Save" }).click();
  await expect(member.getByTestId("action-error")).toBeVisible();
  expect(await db.prepare("SELECT title FROM prompts WHERE id = ?").bind(ids.ownerPrompt).first("title")).toBe("Quarterly pricing strategy");
  await member.getByTestId("message-input").fill("Show me the numbers");
  await member.getByTestId("run").click();
  await expect(member.getByTestId("run-error")).toBeVisible();
  expect(await db.prepare("SELECT count(*) AS n FROM turns WHERE prompt_id = ?").bind(ids.ownerPrompt).first("n")).toBe(1);
  await member.unrouteAll();

  await member.goto("/");
  await forge(member, ids.memberPrompt, ids.ownerPrompt);
  await member.getByTestId("prompt-row").getByRole("button", { name: "Delete" }).click();
  await member.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(member.getByTestId("action-error")).toBeVisible();
  expect(await db.prepare("SELECT count(*) AS n FROM prompts WHERE id = ?").bind(ids.ownerPrompt).first("n")).toBe(1);
  await member.unrouteAll();

  // Changing or deleting another's shared app, and admin-only removal, are refused.
  await member.goto(`/apps/${ids.memberApp}`);
  await forge(member, ids.memberApp, ids.ownerSharedApp);
  await member.getByRole("button", { name: "Rename" }).click();
  await member.getByTestId("rename-input").fill("Hijacked app");
  await member.getByRole("button", { name: "Save" }).click();
  await expect(member.getByTestId("action-error")).toBeVisible();
  await member.getByRole("button", { name: "Delete" }).click();
  await member.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(member.getByTestId("action-error")).toBeVisible();
  await member.getByTestId("share-switch").click();
  await expect(member.getByTestId("action-error")).toBeVisible();
  await member.unrouteAll();
  const ownerShared = await db.prepare("SELECT name, visibility FROM apps WHERE id = ?").bind(ids.ownerSharedApp).first();
  expect(ownerShared).toEqual({ name: "Shared standup timer", visibility: "organization" });

  // Remixing a private app of someone else is refused.
  await member.goto(`/apps/${ids.ownerSharedApp}`);
  await forge(member, ids.ownerSharedApp, ids.ownerPrivateApp);
  await member.getByRole("button", { name: "Remix" }).click();
  await expect(member.getByTestId("action-error")).toBeVisible();
  await member.unrouteAll();
  expect(await db.prepare("SELECT count(*) AS n FROM apps WHERE owner_id = 'member'").first("n")).toBe(2);

  // An admin may remove a member's shared app from the gallery, but sees nothing private.
  const admin = await (await runtime.context("owner")).newPage();
  await admin.goto(`/apps/${ids.memberApp}`);
  await expect(admin.getByText("App not found")).toBeVisible();
  await admin.goto(`/apps/${ids.memberSharedApp}`);
  await expect(admin.getByRole("button", { name: "Rename", exact: true })).toHaveCount(0);
  await admin.getByRole("button", { name: "Remove from gallery" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => db.prepare("SELECT visibility FROM apps WHERE id = ?").bind(ids.memberSharedApp).first("visibility")).toBe("private");
  await admin.goto(`/prompts/${ids.memberPrompt}`);
  await expect(admin.getByText("Prompt not found")).toBeVisible();
} finally {
  await runtime.close();
}
