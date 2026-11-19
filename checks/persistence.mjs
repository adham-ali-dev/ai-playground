import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeAi } from "./fake-ai.mjs";
import { idFromUrl } from "./helpers.mjs";

const runtime = await startRuntime(fakeAi);
try {
  let page = await (await runtime.context("owner")).newPage();
  await page.goto("/prompts/new");
  await page.getByTestId("system-instructions").fill("Answer as a travel planner.");
  await page.getByTestId("message-input").fill("Plan a rainy day in Lisbon.");
  await Promise.all([page.waitForURL(/\/prompts\/[0-9a-f-]{36}$/), page.getByTestId("run").click()]);
  const promptId = idFromUrl(page, "prompts");
  await expect(page.locator("[data-testid=turn][data-role=model]")).toHaveCount(1);

  await page.goto("/apps/new");
  await page.getByTestId("app-description").fill("Habit tracker. Tick off each day you went for a walk.");
  await Promise.all([page.waitForURL(/\/apps\/[0-9a-f-]{36}$/, { timeout: 15000 }), page.getByRole("button", { name: "Build" }).click()]);
  const appId = idFromUrl(page, "apps");
  await page.getByTestId("refine-input").fill("Add a streak counter");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("version-label")).toHaveText("Version 2", { timeout: 15000 });

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto(`/prompts/${promptId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plan a rainy day in Lisbon.");
  await expect(page.getByTestId("system-instructions")).toHaveValue("Answer as a travel planner.");
  await expect(page.locator("[data-testid=turn][data-role=user]")).toContainText("Plan a rainy day in Lisbon.");
  await expect(page.locator("[data-testid=turn][data-role=model]")).toHaveCount(1);
  await page.goto("/");
  await expect(page.getByTestId("prompt-row")).toContainText("Plan a rainy day in Lisbon.");
  await page.goto(`/apps/${appId}`);
  await expect(page.getByTestId("version-label")).toHaveText("Version 2");
  await expect(page.getByTestId("version-item")).toHaveCount(2);
  await expect(page.frameLocator("[data-testid=app-preview]").locator("#change")).toHaveText("Add a streak counter");
} finally {
  await runtime.close();
}
