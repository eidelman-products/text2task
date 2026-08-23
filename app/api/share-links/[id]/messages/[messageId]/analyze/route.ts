import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  shareLinkIdParamSchema,
  shareMessageIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { convertShareMessageToClientUpdate } from "@/lib/share/share-message-conversion.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Phase 6B -- the dedicated, authenticated Client Share owner route that
 * explicitly converts one owned, client-authored share message into a
 * Client Update analysis, reusing the existing analyzeProjectUpdateV2
 * pipeline. This is deliberately NOT the generic, browser-callable
 * POST /api/project-updates/analyze (that route's own request schema
 * still only accepts text/image/email/manual -- see its own file and
 * its migration-test boundary assertion -- and this route never calls
 * it internally either; it calls analyzeProjectUpdateV2 directly, the
 * same underlying service function that route itself calls).
 *
 * The request body carries NOTHING but route identity: no rawInput, no
 * sourceType, no source message id, no projectId. Every one of those
 * values is server-derived: convertShareMessageToClientUpdate loads
 * share_messages.body itself (via loadShareMessageForConversion),
 * proves the message is client-authored and belongs to this owner/link/
 * project, and resolves the project id from the message row -- never
 * from anything the browser could supply. A request body is accepted
 * only so a future, still-empty extension point exists without a
 * breaking route-shape change; today any body content is ignored.
 *
 * Link state (active/disabled/expired/revoked) is deliberately NOT
 * checked here -- conversion eligibility depends only on the message/
 * project relationship (see loadShareMessageForConversion's own doc
 * comment), matching Phase 5F's own established "history access is
 * read-only with respect to link lifecycle" precedent exactly. Owner-
 * authored replies are rejected by loadShareMessageForConversion before
 * any AI call is made, and independently rejected a second way by the
 * database (enforce_share_message_conversion_integrity /
 * enforce_project_update_source_provenance) if this check were ever
 * bypassed.
 */

const SHARE_LINKS_NO_STORE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

function errorResponse(code: ShareLinkApiErrorCode, error: string, status: number) {
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: SHARE_LINKS_NO_STORE_HEADERS }
  );
}

type RouteContext = { params: Promise<{ id: string; messageId: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    const { id, messageId } = await context.params;
    const parsedId = shareLinkIdParamSchema.safeParse({ id });
    const parsedMessageId = shareMessageIdParamSchema.safeParse({ messageId });

    if (!parsedId.success || !parsedMessageId.success) {
      return errorResponse("INVALID_REQUEST", "id and messageId must be valid uuids.", 400);
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
    }

    const result = await convertShareMessageToClientUpdate(supabase, {
      shareLinkId: parsedId.data.id,
      messageId: parsedMessageId.data.messageId,
      userId: user.id,
    });

    if (!result.ok) {
      switch (result.code) {
        case "SHARE_MESSAGE_NOT_FOUND":
          return errorResponse("SHARE_MESSAGE_NOT_FOUND", "Message not found.", 404);
        case "SHARE_MESSAGE_NOT_CLIENT_AUTHORED":
          return errorResponse(
            "SHARE_MESSAGE_NOT_CLIENT_AUTHORED",
            "Only client-authored messages can be analyzed as a client update.",
            409
          );
        case "SHARE_MESSAGE_PROJECT_NOT_FOUND":
          return errorResponse("PROJECT_NOT_FOUND", "Project not found.", 404);
        case "UNAUTHENTICATED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        default:
          return errorResponse("INTERNAL_ERROR", "Could not analyze this message.", 500);
      }
    }

    if (result.state === "in_progress") {
      // Phase 6B correction (blocker fix) -- a concurrent request already
      // owns this message's reservation (a fresh analysis or a retry
      // claim, still running). This call ran NO AI and created NO row.
      // Never pretend this is a failure requiring a new attempt, and
      // never open the review UI with an empty/incomplete analysis.
      return NextResponse.json(
        {
          ok: true,
          state: "in_progress",
          projectUpdateId: result.projectUpdateId,
        },
        { headers: SHARE_LINKS_NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        state: "ready",
        resumed: result.resumed,
        update: result.update,
        items: result.items,
        timelineEvent: result.timelineEvent,
        analysis: result.analysis,
      },
      { headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }

    logShareLinksRouteError("share_links.messages.analyze", error);

    return errorResponse("INTERNAL_ERROR", "Could not analyze this message.", 500);
  }
}
