import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  setShareMessageStatusRequestSchema,
  shareLinkIdParamSchema,
  shareMessageIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import {
  setShareMessageStatus,
  verifyOwnedShareMessageBelongsToLink,
} from "@/lib/share/share-messages-repository.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Phase 5C -- authenticated OWNER workflow-status change for one message.
 * `setShareMessageStatusRequestSchema` accepts only the 4 Phase 5
 * statuses (`new`/`reviewed`/`resolved`/`dismissed`) -- `'converted'`
 * and any other value fail Zod parsing before any repository/RPC call is
 * made, so Phase 6's exclusive value can never reach `set_share_message_status`
 * through this route.
 *
 * `set_share_message_status` itself scopes only by `auth.uid()` and the
 * message id, with no link-id parameter at all -- so
 * `verifyOwnedShareMessageBelongsToLink` runs FIRST, proving the
 * `messageId` path segment actually belongs to the `id` (link) path
 * segment AND to this owner, before the RPC is ever called. Without
 * this check, the route's own `[id]` segment would be purely decorative
 * (a same-owner, cross-link PATCH would otherwise silently succeed).
 *
 * The RPC remains the sole source of truth for `reviewed_at`/
 * `resolved_at` timestamp semantics -- this route never recomputes them.
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

type RouteContext = { params: Promise<{ id: string; messageId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
    }

    const parsedBody = setShareMessageStatusRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return errorResponse(
        "SHARE_MESSAGE_STATUS_INVALID",
        "status must be one of new, reviewed, resolved, dismissed.",
        400
      );
    }

    const ownership = await verifyOwnedShareMessageBelongsToLink(supabase, {
      messageId: parsedMessageId.data.messageId,
      shareLinkId: parsedId.data.id,
      userId: user.id,
    });

    if (!ownership.ok) {
      switch (ownership.error.code) {
        case "SHARE_MESSAGE_NOT_FOUND":
          return errorResponse("SHARE_MESSAGE_NOT_FOUND", "Message not found.", 404);
        default:
          return errorResponse("INTERNAL_ERROR", "Failed to update the message status.", 500);
      }
    }

    const result = await setShareMessageStatus(supabase, {
      messageId: parsedMessageId.data.messageId,
      status: parsedBody.data.status,
    });

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_MESSAGE_NOT_FOUND":
          return errorResponse("SHARE_MESSAGE_NOT_FOUND", "Message not found.", 404);
        case "INVALID_REQUEST":
          return errorResponse(
            "SHARE_MESSAGE_STATUS_INVALID",
            "status must be one of new, reviewed, resolved, dismissed.",
            400
          );
        default:
          return errorResponse("INTERNAL_ERROR", "Failed to update the message status.", 500);
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

    logShareLinksRouteError("share_links.messages.status", error);

    return errorResponse("INTERNAL_ERROR", "Failed to update the message status.", 500);
  }
}
