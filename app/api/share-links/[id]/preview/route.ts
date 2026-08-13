import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { buildClientShareProjection } from "@/lib/share/client-share-projection.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Phase 2D -- authenticated OWNER Preview only. Returns the exact same
 * strict client-facing projection Phase 3's future public route will
 * eventually return, built via the one shared
 * buildClientShareProjection. This route performs NO public-view side
 * effects of any kind: no view_count increment, no last_viewed_at
 * mutation, no share_link_events row, no session/grant creation, no
 * secret reveal. It is a pure, repeatable, owner-authenticated read --
 * exactly like reveal_share_link_secret's own "not a new grant of
 * access" posture, just for the safe projection instead of the secret.
 */

/**
 * Structured, safe error log: a fixed operation/stage plus a fixed
 * category only -- never the caught error's message, stack, or any
 * project/task/resource content.
 */
function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

/**
 * Explicit no-store headers on every response branch, matching every
 * other share-link route -- this response carries authenticated
 * client-projection content that must never be cached by an
 * intermediary or the browser's own HTTP cache.
 */
const SHARE_LINKS_NO_STORE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function errorResponse(code: ShareLinkApiErrorCode, error: string, status: number) {
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: SHARE_LINKS_NO_STORE_HEADERS }
  );
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    const { id } = await context.params;
    const parsedId = shareLinkIdParamSchema.safeParse({ id });

    if (!parsedId.success) {
      return errorResponse("INVALID_REQUEST", "id must be a valid uuid.", 400);
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
    }

    const result = await buildClientShareProjection(supabase, {
      linkId: parsedId.data.id,
      userId: user.id,
    });

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_LINK_NOT_FOUND":
          return errorResponse("SHARE_LINK_NOT_FOUND", "Share link not found.", 404);
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to build the client preview.",
            500
          );
      }
    }

    return NextResponse.json(
      { ok: true, data: result.data },
      { headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }

    logShareLinksRouteError("share_links.preview", error);

    return errorResponse("INTERNAL_ERROR", "Failed to build the client preview.", 500);
  }
}
