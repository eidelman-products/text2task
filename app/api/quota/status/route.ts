import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCleanupStatus, getUnreadStatus } from "@/lib/supabase/quota";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id || !user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const cleanupStatus = await getCleanupStatus(user.id, user.email);
    const unreadStatus = await getUnreadStatus(user.id, user.email);

    return NextResponse.json({
      plan: cleanupStatus.plan,
      weekly_cleanup_used: cleanupStatus.weekly_cleanup_used,
      cleanup_remaining: cleanupStatus.remaining,
      cleanup_limit: cleanupStatus.limit,
      weekly_reset_date: cleanupStatus.weekly_reset_date,

      weekly_unread_used: unreadStatus.weekly_unread_used,
      unread_remaining: unreadStatus.remaining,
      unread_limit: unreadStatus.limit,
      weekly_unread_reset_date: unreadStatus.weekly_unread_reset_date,
    });
  } catch (error: any) {
    console.error("quota/status route error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to load quota status" },
      { status: 500 }
    );
  }
}