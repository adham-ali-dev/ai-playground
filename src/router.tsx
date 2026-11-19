import { createRouter } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { routeTree } from "./routeTree.gen";

function NotFound() {
  return (
    <AppShell>
      <EmptyState kind="filtered" title="Page not found" />
    </AppShell>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  });
}
