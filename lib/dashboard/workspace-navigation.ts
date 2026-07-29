/**
 * Single source of truth for the dashboard's navigation concepts.
 *
 * Two distinct kinds of destination exist, deliberately kept as separate
 * types rather than one ambiguous string union:
 *
 * - `DashboardWorkspaceView` -- an SPA "tab" rendered inside DashboardClient
 *   at the single `/dashboard` route (no URL change on switch). Dashboard,
 *   Extract, and Tasks are workspace views today.
 * - `DashboardRoutedDestination` -- a genuine Next.js route with its own
 *   URL, rendered outside DashboardClient (e.g. `/dashboard/calendar`).
 *
 * Pure module: no React, no Supabase, no side effects -- safe to import
 * from both server and client code, and independently testable.
 */

export type DashboardWorkspaceView = "dashboard" | "extract" | "tasks";

export const DASHBOARD_WORKSPACE_VIEWS: readonly DashboardWorkspaceView[] = [
  "dashboard",
  "extract",
  "tasks",
];

export const DEFAULT_DASHBOARD_WORKSPACE_VIEW: DashboardWorkspaceView = "dashboard";

/**
 * Every routed (real-URL) dashboard destination outside the `/dashboard`
 * SPA. Only "calendar" exists today; this is where a future routed
 * destination would be added.
 */
export type DashboardRoutedDestination = "calendar";

/**
 * What the shared sidebar currently has selected -- either a workspace view
 * (when rendered inside DashboardClient) or a routed destination (when
 * rendered inside a routed shell like the Calendar page).
 */
export type DashboardActiveNavItem =
  | { kind: "workspace"; view: DashboardWorkspaceView }
  | { kind: "routed"; destination: DashboardRoutedDestination };

/**
 * Validates a raw, untrusted value (e.g. a URL search param) as a
 * `DashboardWorkspaceView`. Never throws; anything unrecognized safely
 * falls back to the default view.
 */
export function parseDashboardWorkspaceView(value: unknown): DashboardWorkspaceView {
  if (
    typeof value === "string" &&
    (DASHBOARD_WORKSPACE_VIEWS as readonly string[]).includes(value)
  ) {
    return value as DashboardWorkspaceView;
  }

  return DEFAULT_DASHBOARD_WORKSPACE_VIEW;
}

/**
 * The canonical `/dashboard` URL for a workspace view. The default view
 * omits the query parameter entirely, so `/dashboard` (no param) and
 * `/dashboard?view=dashboard` both resolve to the same canonical href.
 */
export function getDashboardWorkspaceHref(view: DashboardWorkspaceView): string {
  if (view === DEFAULT_DASHBOARD_WORKSPACE_VIEW) {
    return "/dashboard";
  }

  return `/dashboard?view=${view}`;
}

const ROUTED_DESTINATION_HREFS: Record<DashboardRoutedDestination, string> = {
  calendar: "/dashboard/calendar",
};

export function getDashboardRoutedHref(destination: DashboardRoutedDestination): string {
  return ROUTED_DESTINATION_HREFS[destination];
}

const WORKSPACE_VIEW_LABELS: Record<DashboardWorkspaceView, string> = {
  dashboard: "Dashboard",
  extract: "Extract",
  tasks: "Tasks",
};

export function getDashboardWorkspaceViewLabel(view: DashboardWorkspaceView): string {
  return WORKSPACE_VIEW_LABELS[view];
}

/** True when `activeItem` refers to exactly this workspace view. */
export function isWorkspaceViewActive(
  activeItem: DashboardActiveNavItem,
  view: DashboardWorkspaceView
): boolean {
  return activeItem.kind === "workspace" && activeItem.view === view;
}

/** True when `activeItem` refers to exactly this routed destination. */
export function isRoutedDestinationActive(
  activeItem: DashboardActiveNavItem,
  destination: DashboardRoutedDestination
): boolean {
  return activeItem.kind === "routed" && activeItem.destination === destination;
}
