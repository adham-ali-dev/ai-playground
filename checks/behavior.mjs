import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeAi, aiCalls, setAiMode } from "./fake-ai.mjs";
import { pickOption, runMessage, turns, idFromUrl } from "./helpers.mjs";

const runtime = await startRuntime(fakeAi);
try {
  await runtime.assertPrivateAccess(["/", "/prompts/new", "/apps", "/apps/new"]);
  const owner = await runtime.context("owner");
  const page = await owner.newPage();

  // F001: a new prompt with a model, system instructions and run settings.
  await page.goto("/prompts/new");
  await runtime.assertBackLink(page);
  await pickOption(page, "model-select", "GPT-4o mini");
  await page.getByTestId("system-instructions").fill("You write short, warm notes for a customer support team.");
  await page.getByTestId("temperature").fill("0.4");
  await page.getByTestId("top-p").fill("0.9");
  await page.getByTestId("max-tokens").fill("512");
  await page.getByTestId("message-input").fill("Write a welcome note for new support hires.");
  await Promise.all([page.waitForURL(/\/prompts\/[0-9a-f-]{36}$/), page.getByTestId("run").click()]);
  const promptId = idFromUrl(page, "prompts");
  await expect(turns(page, "model")).toHaveCount(1);
  await expect(turns(page, "model").first()).toContainText("Welcome to the support team!");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Write a welcome note for new support hires.");

  let calls = await aiCalls(runtime);
  let body = calls.at(-1).body;
  expect(body.model).toBe("openai/gpt-4o-mini");
  expect(body.temperature).toBe(0.4);
  expect(body.top_p).toBe(0.9);
  expect(body.max_tokens).toBe(512);
  expect(body.messages[0]).toEqual({ role: "system", content: "You write short, warm notes for a customer support team." });

  // Many turns: the whole conversation is sent.
  await runMessage(page, "Make it shorter, two sentences.");
  await expect(turns(page)).toHaveCount(4);
  calls = await aiCalls(runtime);
  body = calls.at(-1).body;
  expect(body.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);

  // Edit a turn's text.
  const firstModel = turns(page, "model").first();
  await firstModel.getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("turn-editor").fill("Welcome! We're glad you're here.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(turns(page, "model").first().getByTestId("turn-text")).toHaveText("Welcome! We're glad you're here.");

  // Rate a model turn.
  await turns(page, "model").first().getByRole("button", { name: "Good response" }).click();
  await expect(turns(page, "model").first().getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(turns(page, "model").first().getByTestId("turn-text")).toHaveText("Welcome! We're glad you're here.");
  await expect(turns(page, "model").first().getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "true");
  await turns(page, "model").first().getByRole("button", { name: "Bad response" }).click();
  await expect(turns(page, "model").first().getByRole("button", { name: "Bad response" })).toHaveAttribute("aria-pressed", "true");
  await expect(turns(page, "model").first().getByRole("button", { name: "Good response" })).toHaveAttribute("aria-pressed", "false");

  // Delete a turn.
  await turns(page).last().getByRole("button", { name: "Delete" }).click();
  await expect(turns(page)).toHaveCount(3);

  // Rerun from the first user turn: later turns are replaced.
  await turns(page, "user").first().getByRole("button", { name: "Rerun from here" }).click();
  await expect(turns(page)).toHaveCount(2);
  await expect(turns(page, "model").first()).toContainText("Welcome to the support team!");

  // Rename.
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByTestId("rename-input").fill("Support welcome note");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Support welcome note");

  // Errors: provider not configured keeps the user's turn.
  await setAiMode(runtime, { off: true });
  await runMessage(page, "Add a line about the team lunch on Friday.");
  await expect(page.getByTestId("run-error")).toContainText("AI provider");
  await expect(turns(page, "user").last()).toContainText("Add a line about the team lunch on Friday.");
  await expect(turns(page)).toHaveCount(3);
  await setAiMode(runtime, { off: false });
  await page.reload();
  await expect(turns(page)).toHaveCount(3);
  await turns(page).last().getByRole("button", { name: "Delete" }).click();
  await expect(turns(page)).toHaveCount(2);

  // F003: get code reflects model, settings, system instructions and turns.
  await page.getByRole("button", { name: "Get code" }).click();
  const snippet = page.getByTestId("code-snippet");
  await expect(snippet).toContainText("curl");
  await expect(snippet).toContainText("/chat/completions");
  await expect(snippet).toContainText("openai/gpt-4o-mini");
  await expect(snippet).toContainText("0.4");
  await expect(snippet).toContainText("You write short, warm notes");
  await expect(snippet).toContainText("Write a welcome note for new support hires.");
  await expect(snippet).toContainText("API_KEY");
  await page.getByRole("tab", { name: "JavaScript" }).click();
  await expect(snippet).toContainText("fetch(");
  await expect(snippet).toContainText("max_tokens");
  await page.getByRole("tab", { name: "Python" }).click();
  await expect(snippet).toContainText("import");
  await expect(snippet).toContainText("top_p");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Copy" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("temperature").fill("1.2");
  await page.getByTestId("temperature").blur();
  await page.getByRole("button", { name: "Get code" }).click();
  await expect(snippet).toContainText("1.2");
  await page.keyboard.press("Escape");

  // F004: compare two models side by side.
  await page.getByTestId("compare-toggle").click();
  await pickOption(page, "compare-model-select", "Claude 3.5 Haiku");
  await runMessage(page, "Now a version for the team chat, friendly and brief.");
  const pair = page.getByTestId("compare-pair").last();
  await expect(pair.locator("[data-testid=turn][data-model='openai/gpt-4o-mini']")).toContainText("Welcome to the support team!");
  await expect(pair.locator("[data-testid=turn][data-model='anthropic/claude-3.5-haiku']")).toContainText("Hi and welcome aboard.");
  await expect(pair).toContainText("GPT-4o mini");
  await expect(pair).toContainText("Claude 3.5 Haiku");
  calls = await aiCalls(runtime);
  expect(calls.slice(-2).map((c) => c.body.model).sort()).toEqual(["anthropic/claude-3.5-haiku", "openai/gpt-4o-mini"]);
  await page.reload();
  await expect(page.getByTestId("compare-pair").last().locator("[data-testid=turn][data-role=model]")).toHaveCount(2);
  // One side failing shows on that side only.
  await setAiMode(runtime, { failModel: "anthropic/claude-3.5-haiku" });
  await runMessage(page, "And one for the onboarding email subject line.");
  const failed = page.getByTestId("compare-pair").last();
  await expect(failed.locator("[data-testid=turn][data-model='openai/gpt-4o-mini']")).toContainText("Welcome to the support team!");
  await expect(failed.locator("[data-model='anthropic/claude-3.5-haiku'] [data-testid=side-error]")).toBeVisible();
  await expect(failed.locator("[data-model='openai/gpt-4o-mini'] [data-testid=side-error]")).toHaveCount(0);
  await setAiMode(runtime, { failModel: null });
  await failed.locator("[data-model='anthropic/claude-3.5-haiku']").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("compare-pair").last().locator("[data-testid=side-error]")).toHaveCount(0);

  // F002: history lists own prompts with title, model and time; search, sort, page, duplicate, delete.
  const db = await runtime.database();
  const now = Date.now();
  for (let i = 1; i <= 11; i++) {
    await db.prepare("INSERT INTO prompts (id, owner_id, title, model, system_instruction, temperature, top_p, max_output_tokens, created_at, updated_at) VALUES (?, 'owner', ?, 'meta-llama/llama-3.3-70b-instruct', '', 1, 0.95, 2048, ?, ?)")
      .bind(crypto.randomUUID(), `Release notes draft ${String(i).padStart(2, "0")}`, now - 86400000 * (i + 1), now - 86400000 * (i + 1)).run();
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prompts");
  const rows = page.getByTestId("prompt-row");
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText("Support welcome note");
  await expect(rows.first()).toContainText("GPT-4o mini");
  await expect(page.getByTestId("page-status")).toHaveText("Page 1 of 2");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("page-status")).toHaveText("Page 2 of 2");
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Previous" }).click();
  await pickOption(page, "sort-select", "Title A–Z");
  await expect(rows.first()).toContainText("Release notes draft 01");
  await page.getByTestId("search").fill("support");
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole("button", { name: "Duplicate" }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId("prompt-row").filter({ hasText: "Copy of Support welcome note" })).toHaveCount(1);
  await page.getByTestId("prompt-row").filter({ hasText: "Copy of Support welcome note" }).getByRole("button", { name: "Rename" }).click();
  await page.getByTestId("rename-input").fill("Support welcome note (chat)");
  await page.getByRole("button", { name: "Save" }).click();
  const copyRow = page.getByTestId("prompt-row").filter({ hasText: "Support welcome note (chat)" });
  await expect(copyRow).toHaveCount(1);
  await copyRow.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Support welcome note (chat)");
  await expect(turns(page)).toHaveCount(await db.prepare("SELECT count(*) AS n FROM turns WHERE prompt_id = ?").bind(promptId).first("n"));
  await expect(page.getByTestId("temperature")).toHaveValue("1.2");
  await page.goto("/");
  await page.getByTestId("search").fill("(chat)");
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No prompts match")).toBeVisible();
  expect(await db.prepare("SELECT count(*) AS n FROM prompts WHERE title = 'Support welcome note (chat)'").first("n")).toBe(0);

  // F005: app builder.
  await page.goto("/apps/new");
  await page.getByTestId("app-description").fill("Tip calculator. Enter the bill and a tip percentage and see the tip.");
  await Promise.all([page.waitForURL(/\/apps\/[0-9a-f-]{36}$/, { timeout: 15000 }), page.getByRole("button", { name: "Build" }).click()]);
  const appId = idFromUrl(page, "apps");
  await expect(page.getByTestId("version-label")).toHaveText("Version 1");
  const preview = page.getByTestId("app-preview");
  await expect(preview).toHaveAttribute("sandbox", "allow-scripts");
  await expect(page.frameLocator("[data-testid=app-preview]").locator("#app-title")).toHaveText("Tip calculator");
  await expect(page.frameLocator("[data-testid=app-preview]").locator("#out")).toHaveText("Tip: 6.00");
  await page.getByRole("tab", { name: "Code" }).click();
  await expect(page.getByTestId("app-code")).toContainText("<h1 id=\"app-title\">Tip calculator</h1>");
  await page.getByRole("tab", { name: "Preview" }).click();
  await page.getByTestId("refine-input").fill("Make the header larger");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("version-label")).toHaveText("Version 2", { timeout: 15000 });
  await expect(page.frameLocator("[data-testid=app-preview]").locator("#change")).toHaveText("Make the header larger");
  await expect(page.getByTestId("version-item")).toHaveCount(2);
  await page.getByTestId("version-item").filter({ hasText: "Version 1" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByTestId("version-label")).toHaveText("Version 3");
  await expect(page.frameLocator("[data-testid=app-preview]").locator("#change")).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.html$/);
  // Rename, then share with the organization.
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByTestId("rename-input").fill("Tip splitter");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tip splitter");
  await page.getByTestId("share-switch").click();
  await expect(page.getByTestId("share-switch")).toHaveAttribute("aria-checked", "true");

  // Another member sees it in the gallery, previews it and remixes it.
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/apps");
  const card = memberPage.getByTestId("gallery").getByTestId("app-card").filter({ hasText: "Tip splitter" });
  await expect(card).toHaveCount(1);
  await card.getByRole("link").first().click();
  await expect(memberPage.frameLocator("[data-testid=app-preview]").locator("#app-title")).toHaveText("Tip calculator");
  await expect(memberPage.getByTestId("share-switch")).toHaveCount(0);
  await Promise.all([memberPage.waitForURL((url) => !url.pathname.endsWith(appId)), memberPage.getByRole("button", { name: "Remix" }).click()]);
  await expect(memberPage.getByTestId("remixed-from")).toContainText("Tip splitter");
  await expect(memberPage.getByTestId("version-label")).toHaveText("Version 1");
  await expect(memberPage.getByTestId("share-switch")).toHaveAttribute("aria-checked", "false");
  await memberPage.goto("/apps");
  await expect(memberPage.getByTestId("my-apps").getByTestId("app-card")).toHaveCount(1);
  // The member shares the remix; an admin removes it from the gallery.
  await memberPage.getByTestId("my-apps").getByTestId("app-card").getByRole("link").first().click();
  await memberPage.getByTestId("share-switch").click();
  await expect(memberPage.getByTestId("share-switch")).toHaveAttribute("aria-checked", "true");
  await page.goto("/apps");
  const shared = page.getByTestId("gallery").getByTestId("app-card").filter({ hasText: "Remix of Tip splitter" });
  await expect(shared).toHaveCount(1);
  await shared.getByRole("link").first().click();
  await page.getByRole("button", { name: "Remove from gallery" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await page.goto("/apps");
  await expect(page.getByTestId("gallery").getByTestId("app-card").filter({ hasText: "Remix of Tip splitter" })).toHaveCount(0);
  // Delete one of the owner's apps.
  await page.goto("/apps/new");
  await page.getByTestId("app-description").fill("Packing list for a weekend trip.");
  await Promise.all([page.waitForURL((url) => /\/apps\/[0-9a-f-]{36}$/.test(url.pathname) , { timeout: 15000 }), page.getByRole("button", { name: "Build" }).click()]);
  await page.getByRole("button", { name: "Delete" }).click();
  await Promise.all([page.waitForURL((url) => url.pathname === "/apps"), page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()]);
  await expect(page.getByTestId("my-apps").getByTestId("app-card").filter({ hasText: "Packing list" })).toHaveCount(0);
  await expect(page.getByTestId("my-apps").getByTestId("app-card").filter({ hasText: "Tip splitter" })).toHaveCount(1);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/prompts/new");
  await expect(phone.getByTestId("message-input")).toBeVisible();
  await expect(phone.getByTestId("run")).toBeVisible();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await phone.goto("/apps");
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText("Apps");

  // End on the compared prompt, the workflow's result.
  await page.goto(`/prompts/${promptId}`);
  await expect(page.getByTestId("compare-pair").first().locator("[data-testid=turn][data-role=model]")).toHaveCount(2);
  await page.getByTestId("compare-pair").first().scrollIntoViewIfNeeded();
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
