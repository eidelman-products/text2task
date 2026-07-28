import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { compareDateOnly, dateOnlyToLocalDate, type DateOnly } from "@/lib/tasks/date-only";
import { dashboardTasksNoStoreHeaders } from "@/lib/tasks/load-dashboard-tasks.server";
import { CalendarRangeQuerySchema } from "@/lib/calendar/calendar-schemas";
import { loadCalendarRange } from "@/lib/calendar/load-calendar-range.server";
import { sortCalendarItemsForDay } from "@/lib/calendar/calendar-item-sort";
import type { CalendarItem } from "@/lib/calendar/calendar-types";

// A month grid never needs more than ~6 weeks (42 days); this allows some
// slack for a caller requesting a couple of months at once while still
// rejecting an unbounded/mistaken request that would otherwise scan a
// user's full history.
const MAX_RANGE_DAYS = 120;

function daysBetween(start: DateOnly, end: DateOnly): number {
  const startMs = dateOnlyToLocalDate(start).getTime();
  const endMs = dateOnlyToLocalDate(end).getTime();
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
}

/**
 * calendar-item-sort.ts's sortCalendarItemsForDay orders items within one
 * day -- this groups the range's flat, unsorted CalendarItem[] by date
 * first (chronological, via compareDateOnly) and applies that per-day
 * ordering within each group, without duplicating any of its sorting logic.
 */
function sortCalendarItemsAcrossRange(items: CalendarItem[]): CalendarItem[] {
  const byDate = new Map<DateOnly, CalendarItem[]>();

  for (const item of items) {
    const bucket = byDate.get(item.date);
    if (bucket) {
      bucket.push(item);
    } else {
      byDate.set(item.date, [item]);
    }
  }

  const orderedDates = Array.from(byDate.keys()).sort(compareDateOnly);

  return orderedDates.flatMap((date) => sortCalendarItemsForDay(byDate.get(date) ?? []));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = CalendarRangeQuerySchema.safeParse({
      start: url.searchParams.get("start"),
      end: url.searchParams.get("end"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "start and end must be valid YYYY-MM-DD dates, with start not after end." },
        { status: 400 }
      );
    }

    const { start, end } = parsed.data;

    if (daysBetween(start, end) > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Requested range is too large (maximum ${MAX_RANGE_DAYS} days).` },
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

    const result = await loadCalendarRange({
      supabase,
      userId: user.id,
      range: { start, end },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { success: true, items: sortCalendarItemsAcrossRange(result.items) },
      { headers: dashboardTasksNoStoreHeaders }
    );
  } catch (error) {
    console.error("Calendar range route error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load the calendar." },
      { status: 500 }
    );
  }
}
