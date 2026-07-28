import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { UpdateCalendarEventInputSchema } from "@/lib/calendar/calendar-schemas";
import {
  softDeleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/calendar/calendar-events-repository.server";

const EventIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idResult = EventIdSchema.safeParse(id);

    if (!idResult.success) {
      return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateCalendarEventInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await updateCalendarEvent({
      supabase,
      userId: user.id,
      eventId: idResult.data,
      input: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, item: result.data });
  } catch (error) {
    console.error("Update calendar event route error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update the calendar event." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idResult = EventIdSchema.safeParse(id);

    if (!idResult.success) {
      return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await softDeleteCalendarEvent({
      supabase,
      userId: user.id,
      eventId: idResult.data,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      alreadyDeleted: result.data.alreadyDeleted,
    });
  } catch (error) {
    console.error("Delete calendar event route error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete the calendar event." },
      { status: 500 }
    );
  }
}
