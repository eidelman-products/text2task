import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUnreadStatus, addUnreadUsage } from "@/lib/supabase/quota";
import { getValidAccessToken } from "@/lib/gmail/token-manager";

type MarkReadBody = {
  ids?: unknown;
};

const MAX_MARK_READ_IDS_PER_REQUEST = 500;

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const cleaned = input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(cleaned)];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id || !user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body: MarkReadBody = await req.json();
    const ids = normalizeIds(body.ids);

    if (!ids.length) {
      return NextResponse.json(
        { error: "No valid email ids provided" },
        { status: 400 }
      );
    }

    if (ids.length > MAX_MARK_READ_IDS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many email ids in one request. Maximum allowed is ${MAX_MARK_READ_IDS_PER_REQUEST}.`,
          code: "TOO_MANY_IDS",
          maxAllowed: MAX_MARK_READ_IDS_PER_REQUEST,
          requested: ids.length,
        },
        { status: 400 }
      );
    }

    const unreadStatus = await getUnreadStatus(user.id, user.email);

    if (unreadStatus.plan !== "pro") {
      if (unreadStatus.remaining <= 0) {
        return NextResponse.json(
          {
            error: "Weekly unread limit reached",
            code: "WEEKLY_UNREAD_LIMIT_REACHED",
            remaining: 0,
            weekly_unread_used: unreadStatus.weekly_unread_used,
            limit: unreadStatus.limit,
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }

      if (ids.length > unreadStatus.remaining) {
        return NextResponse.json(
          {
            error: "This action exceeds your weekly unread limit",
            code: "UNREAD_BATCH_EXCEEDS_LIMIT",
            remaining: unreadStatus.remaining,
            weekly_unread_used: unreadStatus.weekly_unread_used,
            limit: unreadStatus.limit,
            requested: ids.length,
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }
    }

    const accessToken = await getValidAccessToken(user.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing Gmail access token" },
        { status: 401 }
      );
    }

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids,
          removeLabelIds: ["UNREAD"],
        }),
        cache: "no-store",
      }
    );

    if (!gmailRes.ok) {
      const errorText = await gmailRes.text();
      console.error("mark-read-by-sender Gmail error:", errorText);

      return NextResponse.json(
        { error: "Failed to mark emails as read" },
        { status: 500 }
      );
    }

    if (unreadStatus.plan !== "pro") {
      await addUnreadUsage(user.id, ids.length);
    }

    const updatedStatus = await getUnreadStatus(user.id, user.email);

    return NextResponse.json({
      success: true,
      markedRead: ids.length,
      plan: updatedStatus.plan,
      weekly_unread_used: updatedStatus.weekly_unread_used,
      remaining: updatedStatus.remaining,
      limit: updatedStatus.limit,
      upgradeRequired: false,
    });
  } catch (error: any) {
    console.error("mark-read-by-sender route error:", error);

    return NextResponse.json(
      { error: error?.message || "Mark as read failed" },
      { status: 500 }
    );
  }
}