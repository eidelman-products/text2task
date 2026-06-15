import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dashboardTasksNoStoreHeaders,
  loadDashboardTasksForUser,
  type DashboardTasksView,
} from "@/lib/tasks/load-dashboard-tasks.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SnapshotTasksView = Exclude<DashboardTasksView, "stats">;

function normalizeSnapshotView(value: string | null): SnapshotTasksView {
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  return "active";
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: dashboardTasksNoStoreHeaders }
      );
    }

    const view = normalizeSnapshotView(new URL(req.url).searchParams.get("view"));
    const [activeTasks, archivedTasks, statsTasks, allTasks] = await Promise.all([
      loadDashboardTasksForUser({
        supabase,
        userId: user.id,
        view: "active",
      }),
      loadDashboardTasksForUser({
        supabase,
        userId: user.id,
        view: "archived",
      }),
      loadDashboardTasksForUser({
        supabase,
        userId: user.id,
        view: "stats",
      }),
      view === "all"
        ? loadDashboardTasksForUser({
            supabase,
            userId: user.id,
            view: "all",
          })
        : Promise.resolve(null),
    ]);
    const tasks =
      view === "active"
        ? activeTasks
        : view === "archived"
          ? archivedTasks
          : allTasks ?? [];

    return NextResponse.json(
      {
        ok: true,
        view,
        tasks,
        activeTasks,
        archivedTasks,
        statsTasks,
      },
      {
        headers: dashboardTasksNoStoreHeaders,
      }
    );
  } catch (error) {
    console.error("tasks snapshot GET unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500, headers: dashboardTasksNoStoreHeaders }
    );
  }
}
