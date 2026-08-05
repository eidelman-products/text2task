import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkSummaryQuerySchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { listShareLinkSummaries } from "@/lib/share/share-links-repository.server";

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

    // shareLinkSummaryQuerySchema owns the entire raw-value pipeline
    // (split -> trim -> reject missing/empty/over-limit/invalid uuid ->
    // canonicalize -> dedupe), applied in that order to the raw,
    // un-split query value -- see its definition for why rejection must
    // happen before deduplication.
    const parsed = shareLinkSummaryQuerySchema.safeParse({
      projectIds: url.searchParams.get("projectIds"),
    });

    if (!parsed.success) {
      return errorResponse(
        "INVALID_REQUEST",
        "projectIds must be 1-100 comma-separated uuids, with no empty segments.",
        400
      );
    }

    const result = await listShareLinkSummaries(supabase, parsed.data.projectIds);

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "PROJECT_NOT_FOUND":
          return errorResponse(
            "PROJECT_NOT_FOUND",
            "One or more projects were not found.",
            404
          );
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to load share link summaries.",
            500
          );
      }
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    logShareLinksRouteError("share_links.list_summaries", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to load share link summaries.",
      500
    );
  }
}
