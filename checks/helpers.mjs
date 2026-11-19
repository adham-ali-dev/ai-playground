import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export async function pickOption(page, triggerTestId, optionName) {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(page.getByTestId(triggerTestId)).toContainText(optionName);
}

/** Types a message and runs it; resolves once the run finished. */
export async function runMessage(page, text) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("run")).toBeEnabled({ timeout: 15000 });
  await expect(page.getByTestId("message-input")).toBeEditable();
}

export function turns(page, role) {
  return role ? page.locator(`[data-testid=turn][data-role=${role}]`) : page.getByTestId("turn");
}

export function idFromUrl(page, prefix) {
  const match = new URL(page.url()).pathname.match(new RegExp(`^/${prefix}/([0-9a-f-]{36})$`));
  if (!match) throw new Error(`No id in ${page.url()}`);
  return match[1];
}
