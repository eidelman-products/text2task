"use client";

import { useState, type ReactNode } from "react";
import DashboardShell from "./dashboard-shell";
import DashboardSidebarProfile from "./dashboard-sidebar-profile";
import type { DashboardRoutedDestination } from "@/lib/dashboard/workspace-navigation";

/**
 * The shell for a real, routed dashboard page (e.g. /dashboard/calendar),
 * as opposed to DashboardClient's single-URL SPA. Reuses the exact same
 * DashboardShell/DashboardSidebarProfile primitives DashboardClient uses --
 * same sidebar, same logo, same account menu (DashboardShell already
 * renders DashboardUserMenu internally; it self-fetches its own account
 * info, so no user/profile data needs to be threaded through here for
 * that), same responsive mobile behavior, same design tokens. Only the
 * sidebar's navigation mode differs: "routed" instead of "workspace".
 */
export default function RoutedDashboardShell({
  email,
  plan,
  activeDestination,
  activeLabel,
  children,
}: {
  email: string;
  plan: "free" | "pro";
  activeDestination: DashboardRoutedDestination;
  /** The mobile header's active-section label, e.g. "Calendar". */
  activeLabel: string;
  children: ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const sidebar = (
    <DashboardSidebarProfile
      email={email}
      plan={plan}
      mode="routed"
      activeItem={{ kind: "routed", destination: activeDestination }}
    />
  );

  return (
    <DashboardShell
      sidebar={sidebar}
      activeNavLabel={activeLabel}
      isMobileSidebarOpen={isMobileSidebarOpen}
      onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
      onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
    >
      {children}
    </DashboardShell>
  );
}
