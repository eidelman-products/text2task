import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCleanupStatus, addCleanupUsage } from "@/lib/supabase/quota";
import { getValidAccessToken } from "@/lib/gmail/token-manager";

type ArchiveBySenderBody = {
  ids?: unknown;
};

const MAX_ARCHIVE_IDS_PER_REQUEST = 500;

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

    const body: ArchiveBySenderBody = await req.json();
    const ids = normalizeIds(body.ids);

    if (!ids.length) {
      return NextResponse.json(
        { error: "No valid email ids provided" },
        { status: 400 }
      );
    }

    if (ids.length > MAX_ARCHIVE_IDS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many email ids in one request. Maximum allowed is ${MAX_ARCHIVE_IDS_PER_REQUEST}.`,
          code: "TOO_MANY_IDS",
          maxAllowed: MAX_ARCHIVE_IDS_PER_REQUEST,
          requested: ids.length,
        },
        { status: 400 }
      );
    }

    const cleanupStatus = await getCleanupStatus(user.id, user.email);

    if (cleanupStatus.plan !== "pro") {
      if (cleanupStatus.remaining <= 0) {
        return NextResponse.json(
          {
            error: "Weekly cleanup limit reached",
            code: "WEEKLY_LIMIT_REACHED",
            remaining: 0,
            weekly_cleanup_used: cleanupStatus.weekly_cleanup_used,
            limit: cleanupStatus.limit,
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }

      if (ids.length > cleanupStatus.remaining) {
        return NextResponse.json(
          {
            error: "This action exceeds your weekly free cleanup limit",
            code: "BATCH_EXCEEDS_LIMIT",
            remaining: cleanupStatus.remaining,
            weekly_cleanup_used: cleanupStatus.weekly_cleanup_used,
            limit: cleanupStatus.limit,
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

    const archiveRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids,
          removeLabelIds: ["INBOX"],
        }),
        cache: "no-store",
      }
    );

    if (!archiveRes.ok) {
      const errorText = await archiveRes.text();
      console.error("archive-by-sender Gmail error:", errorText);

      return NextResponse.json(
        { error: "Failed to archive emails" },
        { status: 500 }
      );
    }

    await addCleanupUsage(user.id, ids.length);

    const updatedStatus = await getCleanupStatus(user.id, user.email);

    return NextResponse.json({
      success: true,
      archived: ids.length,
      plan: updatedStatus.plan,
      weekly_cleanup_used: updatedStatus.weekly_cleanup_used,
      remaining: updatedStatus.remaining,
      limit: updatedStatus.limit,
      upgradeRequired: false,
    });
  } catch (error: any) {
    console.error("archive-by-sender route error:", error);

    return NextResponse.json(
      { error: error?.message || "Archive failed" },
      { status: 500 }
    );
  }
}