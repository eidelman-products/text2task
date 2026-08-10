import DashboardClient from "../components/dashboard-client";
import { requireDashboardUser } from "@/lib/supabase/requireDashboardUser";
import { parseDashboardWorkspaceView } from "@/lib/dashboard/workspace-navigation";
import { isClientShareEnabled } from "@/lib/share/share-availability.server";

type DashboardPageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const appUser = await requireDashboardUser();

  const { view } = await searchParams;
  const rawView = Array.isArray(view) ? view[0] : view;
  const initialView = parseDashboardWorkspaceView(rawView);

  return (
    <DashboardClient
      email={appUser.email}
      userId={appUser.id}
      initialPlan={appUser.plan}
      initialView={initialView}
      clientShareEnabled={isClientShareEnabled()}
    />
  );
}