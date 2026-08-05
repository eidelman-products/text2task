import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkManagementStateQuerySchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { getShareLinkManagementState } from "@/lib/share/share-links-repository.server";

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

function errorResponse(code: ShareLinkApiErrorCode, error: string, status: number) {
  return NextResponse.json({ ok: false, code, error }, { status });
}

export async function GET(req: NextRequest) {
  try {
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

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    logShareLinksRouteError("share_links.get_management_state", error);

    return errorResponse("INTERNAL_ERROR", "Failed to load the share link.", 500);
  }
}
