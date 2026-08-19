import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendShareMessageReplyRequestSchema,
  shareLinkIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { sendShareMessageReply } from "@/lib/share/share-messages-repository.server";
import { validateShareMessageBody } from "@/lib/share/share-public-message.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Phase 5C -- authenticated OWNER reply to an existing client message.
 * The actual insert happens entirely inside `send_share_message_reply`
 * (Phase 5A) -- this route never touches `share_messages` directly. The
 * RPC itself re-verifies link ownership and that the parent message
 * belongs to the SAME link (`SHARE_MESSAGE_PARENT_LINK_MISMATCH`), so no
 * separate ownership pre-check is needed here (unlike the status route,
 * whose RPC has no link-scoping parameter at all -- see
 * verifyOwnedShareMessageBelongsToLink for why that route needs one).
 *
 * Body validation reuses `validateShareMessageBody`
 * (lib/share/share-public-message.server.ts) -- the exact same
 * normalization (line-ending/control-character handling,
 * 1-4000-codepoint `share_messages_body_check` matching) the public
 * submission path already applies, not a second, potentially-diverging
 * validator.
 *
 * A successful reply is stored with `status='reviewed'` on the REPLY
 * ROW ITSELF (see the Phase 5A migration's own comment) -- it never
 * changes the PARENT client message's own status. This route performs
 * no project/task/timeline mutation and never sets `status='converted'`.
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

export async function POST(req: NextRequest, context: RouteContext) {
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

    const parsedBody = sendShareMessageReplyRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return errorResponse(
        "INVALID_REQUEST",
        "Request body did not match the expected reply shape.",
        400
      );
    }

    const bodyValidation = validateShareMessageBody(parsedBody.data.body);

    if (!bodyValidation.ok) {
      const message =
        bodyValidation.code === "SHARE_MESSAGE_BODY_EMPTY"
          ? "Reply is required."
          : "Reply is too long.";
      return errorResponse("INVALID_REQUEST", message, 400);
    }

    const result = await sendShareMessageReply(supabase, {
      shareLinkId: parsedId.data.id,
      parentMessageId: parsedBody.data.parentMessageId,
      body: bodyValidation.body,
    });

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_LINK_NOT_FOUND":
          return errorResponse("SHARE_LINK_NOT_FOUND", "Share link not found.", 404);
        case "SHARE_MESSAGE_PARENT_NOT_FOUND":
          return errorResponse(
            "SHARE_MESSAGE_PARENT_NOT_FOUND",
            "The message being replied to was not found.",
            404
          );
        case "SHARE_MESSAGE_PARENT_LINK_MISMATCH":
          return errorResponse(
            "SHARE_MESSAGE_PARENT_LINK_MISMATCH",
            "The message being replied to does not belong to this share link.",
            400
          );
        case "INVALID_REQUEST":
          return errorResponse("INVALID_REQUEST", "Reply is invalid.", 400);
        default:
          return errorResponse("INTERNAL_ERROR", "Failed to send the reply.", 500);
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

    logShareLinksRouteError("share_links.messages.reply", error);

    return errorResponse("INTERNAL_ERROR", "Failed to send the reply.", 500);
  }
}
