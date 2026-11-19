import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as apps from "@/server/apps";
import { rememberUser } from "@/server/users";

// Behind ensureUserMiddleware; src/server/apps.ts decides what the signed-in
// person may see and change.
function orNotFound<T>(value: T | null | false): T {
  if (value === null || value === false) throw new Error("App not found, or not yours to change.");
  return value;
}

export const listApps = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await rememberUser(context.user);
    return apps.listApps(context.user);
  });

export const getApp = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.appIdInput.parse(data))
  .handler(({ data, context }) => apps.getApp(context.user, data.id));

export const createApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.createAppInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return apps.createApp(context.user, data);
  });

export const reviseApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.reviseAppInput.parse(data))
  .handler(async ({ data, context }) => orNotFound(await apps.reviseApp(context.user, data)));

export const restoreAppVersion = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.restoreInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await apps.restoreVersion(context.user, data)),
  );

export const setAppVisibility = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.visibilityInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await apps.setVisibility(context.user, data)),
  );

export const renameApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.renameAppInput.parse(data))
  .handler(async ({ data, context }) => orNotFound(await apps.renameApp(context.user, data)));

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.appIdInput.parse(data))
  .handler(async ({ data, context }) =>
    orNotFound(await apps.deleteApp(context.user, data.id)),
  );

export const remixApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => apps.appIdInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return orNotFound(await apps.remixApp(context.user, data.id));
  });
