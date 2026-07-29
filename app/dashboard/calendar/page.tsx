import type { CSSProperties } from "react";
import RoutedDashboardShell from "@/app/components/dashboard/routed-dashboard-shell";
import { WorkCalendarClient } from "@/app/components/dashboard/calendar/work-calendar-client";
import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from "@/app/components/dashboard/ui/tokens";
import { requireDashboardUser } from "@/lib/supabase/requireDashboardUser";

/**
 * Read-only Work Calendar route: real project deadlines and manual events in
 * a month view, via the shared dashboard shell. This page stays a server
 * component (auth guard + shell only); all interactive month/agenda UI lives
 * in `WorkCalendarClient`.
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

        <WorkCalendarClient />
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
