import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { reenableShareLink } from "@/lib/share/share-links-repository.server";

/**
 * Structured, safe error log: a fixed operation/stage plus a fixed
 * category only -- never `error.name`, and never the caught error's
 * message, stack, code, RPC payload, link id or any secret material.
 */
function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

/**
 * Explicit no-store headers on every response branch, success and
 * failure -- applied uniformly across every share-link route (see
 * app/api/share-links/[id]/activate/route.ts's identical constant for
 * the full rationale: that route's success response carries the raw
 * share secret). Combines this repository's existing Pragma/Expires
 * no-store convention (lib/tasks/load-dashboard-tasks.server.ts's
 * dashboardTasksNoStoreHeaders) with the stricter private/max-age=0
 * semantics this feature requires.
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

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
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

    const result = await reenableShareLink(supabase, parsedId.data.id);

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_LINK_NOT_FOUND":
          return errorResponse("SHARE_LINK_NOT_FOUND", "Share link not found.", 404);
        case "SHARE_LINK_STATE_CONFLICT":
          return errorResponse(
            "SHARE_LINK_STATE_CONFLICT",
            "Share link is not disabled.",
            409
          );
        case "SHARE_LINK_ANOTHER_LINK_ACTIVE":
          return errorResponse(
            "SHARE_LINK_ANOTHER_LINK_ACTIVE",
            "Another share link for this project is already active.",
            409
          );
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to re-enable the share link.",
            500
          );
      }
    }

    return NextResponse.json(
      { ok: true, data: result.data },
      { headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    logShareLinksRouteError("share_links.enable", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to re-enable the share link.",
      500
    );
  }
}
