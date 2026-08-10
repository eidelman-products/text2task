import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  setSharePinRequestSchema,
  shareLinkIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import {
  clearShareLinkPin,
  setShareLinkPin,
} from "@/lib/share/share-links-repository.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Structured, safe error log: a fixed operation/stage plus a fixed
 * category only -- never `error.name`, and never the caught error's
 * message, stack, code, RPC payload, link id, PIN or any secret material.
 */
function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

/**
 * Explicit no-store headers on every response branch, matching every
 * other share-link route (see app/api/share-links/[id]/activate/route.ts
 * for the full rationale).
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

export async function PUT(req: NextRequest, context: RouteContext) {
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
    }

    const parsedBody = setSharePinRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return errorResponse(
        "INVALID_REQUEST",
        "pin must be exactly 4-6 ASCII decimal digits.",
        400
      );
    }

    const result = await setShareLinkPin(
      supabase,
      parsedId.data.id,
      parsedBody.data.pin
    );

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_LINK_NOT_FOUND":
          return errorResponse("SHARE_LINK_NOT_FOUND", "Share link not found.", 404);
        case "SHARE_LINK_STATE_CONFLICT":
          return errorResponse(
            "SHARE_LINK_STATE_CONFLICT",
            "Share link is revoked.",
            409
          );
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to set the share link PIN.",
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

    logShareLinksRouteError("share_links.pin.set", error);

    return errorResponse("INTERNAL_ERROR", "Failed to set the share link PIN.", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
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

    const result = await clearShareLinkPin(supabase, parsedId.data.id);

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_LINK_NOT_FOUND":
          return errorResponse("SHARE_LINK_NOT_FOUND", "Share link not found.", 404);
        case "SHARE_LINK_STATE_CONFLICT":
          return errorResponse(
            "SHARE_LINK_STATE_CONFLICT",
            "Share link is revoked.",
            409
          );
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to clear the share link PIN.",
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

    logShareLinksRouteError("share_links.pin.clear", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to clear the share link PIN.",
      500
    );
  }
}
