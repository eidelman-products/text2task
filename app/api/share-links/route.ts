import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createShareLinkDraftRequestSchema,
  shareLinkManagementStateQuerySchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import {
  createShareLinkDraft,
  getShareLinkManagementState,
} from "@/lib/share/share-links-repository.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Structured, safe error log: a fixed operation/stage plus a fixed
 * category only -- never `error.name` (a caught Error's `name` is a
 * mutable, arbitrary string an upstream layer could set to anything) and
 * never the caught error's message, stack, code, RPC payload, project id
 * or any future secret material.
 */
function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

/**
 * Explicit no-store headers on every response branch, success and
 * failure. Required for this feature specifically because POST
 * .../[id]/activate's success response carries the raw share secret and
 * must never be cached by a browser, intermediary, framework cache or
 * CDN -- but applied uniformly to every branch of every share-link route
 * so no response ever relies on caller assumptions about POST caching or
 * on implicit Next.js behavior. Combines this repository's existing
 * Pragma/Expires no-store convention
 * (lib/tasks/load-dashboard-tasks.server.ts's
 * dashboardTasksNoStoreHeaders, read before writing this) with the
 * stricter private/max-age=0 semantics this feature requires.
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
      return errorResponse(
        "INVALID_REQUEST",
        "projectId must be a valid uuid.",
        400
      );
    }

    const result = await getShareLinkManagementState(supabase, parsed.data.projectId);

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "PROJECT_NOT_FOUND":
          return errorResponse("PROJECT_NOT_FOUND", "Project not found.", 404);
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to load the share link.",
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

    logShareLinksRouteError("share_links.get_management_state", error);

    return errorResponse("INTERNAL_ERROR", "Failed to load the share link.", 500);
  }
}

export async function POST(req: NextRequest) {
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
    }

    const parsed = createShareLinkDraftRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", "projectId must be a valid uuid.", 400);
    }

    const result = await createShareLinkDraft(supabase, parsed.data.projectId);

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "PROJECT_NOT_FOUND":
          return errorResponse("PROJECT_NOT_FOUND", "Project not found.", 404);
        case "PROJECT_ARCHIVED":
          return errorResponse(
            "PROJECT_ARCHIVED",
            "Project is archived.",
            409
          );
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to create the share link.",
            500
          );
      }
    }

    return NextResponse.json(
      { ok: true, data: result.data },
      { status: 201, headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }

    logShareLinksRouteError("share_links.create_draft", error);

    return errorResponse("INTERNAL_ERROR", "Failed to create the share link.", 500);
  }
}
