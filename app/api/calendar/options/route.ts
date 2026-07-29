import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dashboardTasksNoStoreHeaders } from "@/lib/tasks/load-dashboard-tasks.server";
import { loadCalendarOptions } from "@/lib/calendar/load-calendar-options.server";

/**
 * `includeProjectId`/`includeClientId` are optional and, when present, must
 * already be syntactically valid UUIDs before any query is attempted --
 * this is the only validation this route performs on them; ownership is
 * enforced by the loader (lib/calendar/load-calendar-options.server.ts),
 * which silently omits a syntactically-valid-but-foreign/nonexistent id
 * rather than surfacing a distinguishable error.
 */
const CalendarOptionsQuerySchema = z.object({
  includeProjectId: z.string().uuid().optional(),
  includeClientId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = CalendarOptionsQuerySchema.safeParse({
      includeProjectId: url.searchParams.get("includeProjectId") ?? undefined,
      includeClientId: url.searchParams.get("includeClientId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "includeProjectId and includeClientId must be valid UUIDs when provided." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await loadCalendarOptions({
      supabase,
      userId: user.id,
      includeProjectId: parsed.data.includeProjectId ?? null,
      includeClientId: parsed.data.includeClientId ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { success: true, ...result.data },
      { headers: dashboardTasksNoStoreHeaders }
    );
  } catch (error) {
    console.error("Calendar options route error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load calendar options." },
      { status: 500 }
    );
  }
}
