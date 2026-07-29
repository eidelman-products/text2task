import type { CSSProperties } from "react";
import RoutedDashboardShell from "@/app/components/dashboard/routed-dashboard-shell";
import { DashboardEmptyState } from "@/app/components/dashboard/ui/empty-state";
import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from "@/app/components/dashboard/ui/tokens";
import { requireDashboardUser } from "@/lib/supabase/requireDashboardUser";

/**
 * Route-and-shell foundation for the Work Calendar feature. Deliberately no
 * calendar data, no month grid, and no manual-event UI yet -- those are the
 * next milestone. This page's job is only to prove the route, auth guard,
 * and shared dashboard shell are wired correctly, with a neutral internal
 * placeholder body rather than a fake finished feature.
 */
export default async function CalendarPage() {
  const appUser = await requireDashboardUser();

  return (
    <RoutedDashboardShell
      email={appUser.email}
      plan={appUser.plan}
      activeDestination="calendar"
      activeLabel="Calendar"
    >
      <div style={pageStyle}>
        <div>
          <h1 style={headingStyle}>Calendar</h1>
          <p style={subtitleStyle}>
            Plan project deadlines and scheduled client work.
          </p>
        </div>

        <DashboardEmptyState
          title="Calendar workspace route is live"
          description="This page renders through the shared dashboard shell with real authentication and navigation. The month view, showing project deadlines and manual events together, is built in the next implementation milestone."
        />
      </div>
    </RoutedDashboardShell>
  );
}

const pageStyle: CSSProperties = {
  display: "grid",
  gap: dashboardSpacing[6],
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: dashboardColors.text.primary,
  fontSize: dashboardTypography.size["3xl"],
  lineHeight: dashboardTypography.lineHeight.tight,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.03em",
};

const subtitleStyle: CSSProperties = {
  margin: `${dashboardSpacing[2]}px 0 0`,
  color: dashboardColors.text.muted,
  fontSize: dashboardTypography.size.md,
  lineHeight: dashboardTypography.lineHeight.relaxed,
  fontWeight: dashboardTypography.weight.medium,
};
