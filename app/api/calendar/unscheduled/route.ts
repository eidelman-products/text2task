import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dashboardTasksNoStoreHeaders } from "@/lib/tasks/load-dashboard-tasks.server";
import { loadUnscheduledProjects } from "@/lib/calendar/load-unscheduled-projects.server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await loadUnscheduledProjects({ supabase, userId: user.id });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { success: true, items: result.items },
      { headers: dashboardTasksNoStoreHeaders }
    );
  } catch (error) {
    console.error("Unscheduled projects route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load unscheduled projects.",
      },
      { status: 500 }
    );
  }
}
