import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { getOwnerShareLinkMessages } from "@/lib/share/share-messages-repository.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Phase 5C -- authenticated OWNER read of one owned share link's full
 * communication history (both directions, every workflow status) plus
 * its unread count, in one combined call
 * (`getOwnerShareLinkMessages`). Deliberately NOT merged with, or read
 * alongside, any Project Timeline/Project Update data source -- see
 * lib/share/share-messages-repository.server.ts's own module doc for
 * why this stays structurally separate.
 *
 * Owner history remains readable regardless of the link's own state
 * (revoked/disabled/expired) -- there is no state filter on this read
 * at all, unlike the public-facing GET .../projection and
 * GET /api/share/[publicId]/messages routes.
 */

function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

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

    const result = await getOwnerShareLinkMessages(supabase, {
      shareLinkId: parsedId.data.id,
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
            "Failed to load the share link's messages.",
            500
          );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          messages: result.data.messages,
          unreadCount: result.data.unreadCount,
        },
      },
      { headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }

    logShareLinksRouteError("share_links.messages.list", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to load the share link's messages.",
      500
    );
  }
}
