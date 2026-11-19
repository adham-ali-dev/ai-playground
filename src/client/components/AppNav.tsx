import { Link } from "@tanstack/react-router";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** The app's own pages, in the bar beside the way back to the Gateway. */
export function AppNav() {
  return (
    <nav className="flex min-w-0 items-center gap-4 overflow-x-auto">
      <Link to="/" className={LINK} activeOptions={{ exact: true }}>
        Prompts
      </Link>
      <Link to="/prompts/new" className={LINK}>
        New prompt
      </Link>
      <Link to="/apps" className={LINK}>
        Apps
      </Link>
    </nav>
  );
}
