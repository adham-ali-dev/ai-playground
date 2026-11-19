import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as prompts from "@/server/prompts";
import { rememberUser } from "@/server/users";

// Every function runs behind ensureUserMiddleware and passes the signed-in
// person's id to queries that only touch that person's prompts.
function orNotFound<T>(value: T | null | false): T {
  if (value === null || value === false) throw new Error("Prompt not found.");
  return value;
}

export const listPrompts = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.listInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return prompts.listPrompts(context.user.id, data);
  });

export const getPrompt = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.idInput.parse(data))
  .handler(({ data, context }) => prompts.getPrompt(context.user.id, data.id));

export const getNewPromptSettings = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await rememberUser(context.user);
    return prompts.NEW_PROMPT_SETTINGS;
  });

export const startPrompt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.startInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return prompts.startPrompt(context.user.id, data);
  });

export const runPrompt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.runInput.parse(data))
  .handler(async ({ data, context }) => orNotFound(await prompts.runPrompt(context.user.id, data)));

export const updatePromptSettings = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.updateSettingsInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await prompts.updateSettings(context.user.id, data)),
  );

export const renamePrompt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.renameInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await prompts.renamePrompt(context.user.id, data)),
  );

export const duplicatePrompt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.idInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await prompts.duplicatePrompt(context.user.id, data.id)),
  );

export const deletePrompt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.idInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await prompts.deletePrompt(context.user.id, data.id)),
  );

export const editTurn = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.editTurnInput.parse(data))
  .handler(async ({ data, context }) => orNotFound(await prompts.editTurn(context.user.id, data)));

export const deleteTurn = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.idInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await prompts.deleteTurn(context.user.id, data.id)),
  );

export const rateTurn = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.rateTurnInput.parse(data))
  .handler(async ({ data, context }) => orNotFound(await prompts.rateTurn(context.user.id, data)));

export const rerunFrom = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => prompts.idInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await prompts.rerunFrom(context.user.id, data.id)),
  );
