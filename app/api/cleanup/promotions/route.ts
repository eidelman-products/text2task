import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCleanupStatus, addCleanupUsage } from "@/lib/supabase/quota";
import { getValidAccessToken } from "@/lib/gmail/token-manager";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No email ids provided" },
        { status: 400 }
      );
    }

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

    const allowed = Math.min(ids.length, cleanupStatus.remaining);

    if (allowed <= 0) {
      return NextResponse.json(
        {
          error: "Weekly cleanup limit reached",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // 🔥 במקום לקחת טוקן ישירות מה-DB — משתמשים במנהל הטוקנים
    const accessToken = await getValidAccessToken(user.id);

    const idsToDelete = ids.slice(0, allowed);

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: idsToDelete,
          addLabelIds: ["TRASH"],
        }),
      }
    );

    if (!gmailRes.ok) {
      const errorText = await gmailRes.text();
      console.error("Gmail cleanup error:", errorText);

      return NextResponse.json(
        { error: "Failed to clean promotions" },
        { status: 500 }
      );
    }

    await addCleanupUsage(user.id, idsToDelete.length);

    const updatedStatus = await getCleanupStatus(user.id, user.email);

    return NextResponse.json({
      success: true,
      cleaned: idsToDelete.length,
      weekly_cleanup_used: updatedStatus.weekly_cleanup_used,
      remaining: updatedStatus.remaining,
    });
  } catch (err: any) {
    console.error("Cleanup route error:", err);

    return NextResponse.json(
      { error: err.message || "Cleanup failed" },
      { status: 500 }
    );
  }
}