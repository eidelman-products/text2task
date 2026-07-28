import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateCalendarEventInputSchema } from "@/lib/calendar/calendar-schemas";
import { createCalendarEvent } from "@/lib/calendar/calendar-events-repository.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateCalendarEventInputSchema.safeParse(body);

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

    const result = await createCalendarEvent({
      supabase,
      userId: user.id,
      input: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, item: result.data }, { status: 201 });
  } catch (error) {
    console.error("Create calendar event route error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create the calendar event." },
      { status: 500 }
    );
  }
}
