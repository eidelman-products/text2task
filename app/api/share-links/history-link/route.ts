import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkManagementStateQuerySchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { resolveMostRecentShareLink } from "@/lib/share/share-messages-repository.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * PHASE 5F REAL PREVIEW DEFECT FIX -- GET /api/share-links/history-link.
 *
 * `GET /api/share-links?projectId=X` (get_share_link_management_state)
 * deliberately excludes revoked links -- correct for its own purpose
 * (what link can the owner activate/reconfigure right now), but that
 * left a real gap: once an owner's only link was revoked, the owner had
 * no way to reach that link's retained Client Communication History at
 * all, because the "Client messages" entry point in `ShareLinkPanel`
 * was conditioned on that same RPC's own (necessarily null) `link`.
 *
 * This route answers a narrower, separate question: is there ANY
 * project_share_links row for this project (including a revoked one)
 * whose id the owner can use to read Client Communication History?
 * Intended to be called by the owner UI ONLY as a fallback, after the
 * management-state call has already returned `link: null` -- see
 * `resolveMostRecentShareLink`'s own doc comment
 * (lib/share/share-messages-repository.server.ts) for why that makes
 * the result unambiguous rather than an arbitrary pick among multiple
 * candidates.
 *
 * Read-only. Never activates, re-enables, or otherwise mutates the
 * resolved link -- revoke remains exactly as irreversible as it already
 * was.
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

export async function GET(req: NextRequest) {
  try {
    assertClientShareEnabled();

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
    }

    const url = new URL(req.url);
    const parsed = shareLinkManagementStateQuerySchema.safeParse({
      projectId: url.searchParams.get("projectId"),
    });

    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", "projectId must be a valid uuid.", 400);
    }

    const result = await resolveMostRecentShareLink(supabase, {
      projectId: parsed.data.projectId,
      userId: user.id,
    });

    if (!result.ok) {
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to resolve share link history.",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: result.data
          ? { linkId: result.data.linkId, state: result.data.state }
          : { linkId: null, state: null },
      },
      { headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }

    logShareLinksRouteError("share_links.history_link", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to resolve share link history.",
      500
    );
  }
}
