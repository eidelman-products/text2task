import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Owner-analytics only. Records that an authenticated user opened the
 * dashboard, at most once per 4-hour window (rate-limited server-side by
 * the WHERE clause inside public.record_dashboard_visit() -- see migration
 * 202607210002_user_activity_write_rpcs.sql).
 *
 * This route is intentionally NOT owner-restricted: any authenticated user
 * may call it for their own visit. It requires no request body and never
 * returns anything sensitive.
 *
 * Non-negotiable safety contract: this route must ALWAYS resolve to a 200
 * response, regardless of auth state or write outcome. The actual database
 * write is scheduled via next/server after() so it can never delay this
 * response, and every failure mode (auth lookup failure, RPC failure,
 * thrown exception) is swallowed and logged, never surfaced to the caller.
 * The dashboard itself must never depend on this route succeeding.
 */
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only usage in this route handler; nothing to persist.
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
      return null;
    }

    return user.id;
  } catch {
    return null;
  }
}

function scheduleDashboardVisitActivity(userId: string): void {
  try {
    after(async () => {
      try {
        await supabaseAdmin.rpc("record_dashboard_visit", {
          p_user_id: userId,
        });
      } catch (error) {
        console.warn("Owner activity tracking (dashboard visit) failed:", {
          message:
            error instanceof Error ? error.message : "Unknown activity error",
        });
      }
    });
  } catch (error) {
    console.warn("Owner activity tracking scheduling failed:", {
      message:
        error instanceof Error ? error.message : "Unknown activity error",
    });
  }
}

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();

    if (userId) {
      scheduleDashboardVisitActivity(userId);
    }
  } catch (error) {
    console.warn("Dashboard visit activity route failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return NextResponse.json({ ok: true });
}
