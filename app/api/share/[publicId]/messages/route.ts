import { NextRequest, NextResponse } from "next/server";

import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";
import {
  getShareBrowserSessionCookiePolicy,
  hashShareBrowserSessionSecret,
  isValidRawShareBrowserSessionSecret,
} from "@/lib/share/share-browser-session.server";
import { checkShareRateLimit } from "@/lib/share/share-rate-limit.server";
import { isValidSharePublicId } from "@/lib/share/share-public-id.server";
import {
  isSharePublicRequestError,
  readSharePublicRequestJson,
  SHARE_PUBLIC_MESSAGE_REQUEST_MAX_BYTES,
  validateSharePublicRequestOrigin,
} from "@/lib/share/share-public-request.server";
import { isRejectableCrossSiteRequest } from "@/lib/share/share-request-security.server";
import {
  resolveShareLinkCommentsEnabled,
  verifyShareProjectionAuthorization,
} from "@/lib/share/share-session-grant.server";
import {
  insertPublicShareMessage,
  listPublicShareMessages,
  shareMessageSubmissionRequestSchema,
  validateShareMessageSubmission,
} from "@/lib/share/share-public-message.server";

/*
  Phase 5B -- POST /api/share/[publicId]/messages. The anonymous,
  session-authorized public client-message-submission endpoint. Reuses
  the exact same cookie-derived authorization chain as GET
  /api/share/[publicId]/projection (verifyShareProjectionAuthorization),
  plus one additional, Phase-5-specific check (commentsEnabled) and its
  own dedicated comment_submission rate-limit bucket. Accepts NO bearer
  secret, NO project/link/author identity of any kind from the caller --
  every security-relevant column on the inserted row is server-derived.

  This route creates TOP-LEVEL client messages only (parent_id is always
  null) -- public reply-to-owner-message behavior is out of scope for
  this slice.

  Phase 5C -- GET /api/share/[publicId]/messages, added below. Reuses
  the exact same authorization chain as GET .../projection: the GET-
  appropriate `isRejectableCrossSiteRequest` (not POST's
  `validateSharePublicRequestOrigin`), the `projection_read` rate-limit
  bucket (not `comment_submission` -- a history read is a read, not a
  write), `verifyShareProjectionAuthorization`, then the same
  `commentsEnabled` check the POST handler already uses. No new
  authorization model was created for this.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type MessageSubmissionErrorResponse = { ok: false; code: string; error: string };

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

/** One indistinguishable response for every authorization/link/session
 * failure -- invalid publicId, missing/invalid cookie, failed
 * verifyShareProjectionAuthorization, and commentsEnabled=false all
 * return this exact same body/status, matching the projection route's
 * own no-enumeration-oracle posture. */
function genericUnavailable(): NextResponse {
  return jsonResponse(
    {
      ok: false,
      code: "UNAVAILABLE",
      error: "This shared link is not available.",
    } satisfies MessageSubmissionErrorResponse,
    401
  );
}

function rateLimited(retryAfterSeconds: number): NextResponse {
  return jsonResponse(
    {
      ok: false,
      code: "RATE_LIMITED",
      error: "Too many requests. Please try again shortly.",
    } satisfies MessageSubmissionErrorResponse,
    429,
    { "Retry-After": String(retryAfterSeconds) }
  );
}

function invalidRequest(): NextResponse {
  return jsonResponse(
    { ok: false, code: "INVALID_REQUEST", error: "Invalid request." } satisfies MessageSubmissionErrorResponse,
    400
  );
}

const VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  SHARE_MESSAGE_BODY_EMPTY: "Message is required.",
  SHARE_MESSAGE_BODY_TOO_LONG: "Message is too long.",
  SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG: "Name is too long.",
};

function validationFailed(code: string): NextResponse {
  return jsonResponse(
    {
      ok: false,
      code,
      error: VALIDATION_ERROR_MESSAGES[code] ?? "Invalid request.",
    } satisfies MessageSubmissionErrorResponse,
    400
  );
}

function logShareRouteError(stage: string, error: unknown): void {
  console.error("share_public_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

type RouteContext = { params: Promise<{ publicId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    validateSharePublicRequestOrigin({ requestUrl: request.url, headers: request.headers });

    const { publicId } = await context.params;

    if (!isValidSharePublicId(publicId)) {
      return genericUnavailable();
    }

    const cookiePolicy = getShareBrowserSessionCookiePolicy();
    const cookieValue = request.cookies.get(cookiePolicy.name)?.value ?? null;

    if (cookieValue === null || !isValidRawShareBrowserSessionSecret(cookieValue)) {
      return genericUnavailable();
    }

    let sessionDigest: string;
    try {
      sessionDigest = hashShareBrowserSessionSecret(cookieValue);
    } catch {
      return genericUnavailable();
    }

    const submitLimit = await checkShareRateLimit({
      action: "comment_submission",
      scope: "browser_session",
      identityDigest: sessionDigest,
      identityDigestVersion: 1,
    });

    if (!submitLimit.allowed) {
      return rateLimited(submitLimit.retryAfterSeconds);
    }

    const authorization = await verifyShareProjectionAuthorization({
      cookieValue,
      publicId,
    });

    if (!authorization) {
      return genericUnavailable();
    }

    const commentsEnabled = await resolveShareLinkCommentsEnabled(
      authorization.shareLinkId,
      authorization.userId
    );

    if (!commentsEnabled) {
      return genericUnavailable();
    }

    const bodyJson = await readSharePublicRequestJson(
      request,
      SHARE_PUBLIC_MESSAGE_REQUEST_MAX_BYTES
    );
    const parsedBody = shareMessageSubmissionRequestSchema.safeParse(bodyJson);

    if (!parsedBody.success) {
      return invalidRequest();
    }

    const validation = validateShareMessageSubmission(parsedBody.data);

    if (!validation.ok) {
      return validationFailed(validation.code);
    }

    const inserted = await insertPublicShareMessage({
      shareLinkId: authorization.shareLinkId,
      projectId: authorization.projectId,
      userId: authorization.userId,
      body: validation.data.body,
      authorDisplayName: validation.data.authorDisplayName,
    });

    if (!inserted) {
      logShareRouteError("share.messages.insert_failed", null);
      return jsonResponse(
        { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." } satisfies MessageSubmissionErrorResponse,
        500
      );
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return jsonResponse(
        { ok: false, code: "NOT_FOUND", error: "Not found." } satisfies MessageSubmissionErrorResponse,
        404
      );
    }

    if (isSharePublicRequestError(error)) {
      switch (error.code) {
        case "invalid_request_origin":
          return jsonResponse(
            { ok: false, code: "INVALID_ORIGIN", error: "Invalid request origin." } satisfies MessageSubmissionErrorResponse,
            403
          );
        case "invalid_request_content_type":
          return jsonResponse(
            { ok: false, code: "INVALID_CONTENT_TYPE", error: "Invalid content type." } satisfies MessageSubmissionErrorResponse,
            415
          );
        case "unsupported_request_encoding":
          return jsonResponse(
            { ok: false, code: "UNSUPPORTED_ENCODING", error: "Unsupported request encoding." } satisfies MessageSubmissionErrorResponse,
            415
          );
        case "request_body_too_large":
          return jsonResponse(
            { ok: false, code: "BODY_TOO_LARGE", error: "Request body too large." } satisfies MessageSubmissionErrorResponse,
            413
          );
        case "invalid_request_body":
          return invalidRequest();
      }
    }

    logShareRouteError("share.messages.submit", error);

    return jsonResponse(
      { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." } satisfies MessageSubmissionErrorResponse,
      500
    );
  }
}

type PublicMessageReadResponse = {
  ok: true;
  data: {
    messages: ReadonlyArray<{
      authorType: "client" | "owner";
      authorDisplayName: string | null;
      body: string;
      createdAt: string;
    }>;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    if (isRejectableCrossSiteRequest(request.headers)) {
      return jsonResponse(
        { ok: false, code: "INVALID_ORIGIN", error: "Invalid request origin." } satisfies MessageSubmissionErrorResponse,
        403
      );
    }

    const { publicId } = await context.params;

    if (!isValidSharePublicId(publicId)) {
      return genericUnavailable();
    }

    const cookiePolicy = getShareBrowserSessionCookiePolicy();
    const cookieValue = request.cookies.get(cookiePolicy.name)?.value ?? null;

    if (cookieValue === null || !isValidRawShareBrowserSessionSecret(cookieValue)) {
      return genericUnavailable();
    }

    let sessionDigest: string;
    try {
      sessionDigest = hashShareBrowserSessionSecret(cookieValue);
    } catch {
      return genericUnavailable();
    }

    const readLimit = await checkShareRateLimit({
      action: "projection_read",
      scope: "browser_session",
      identityDigest: sessionDigest,
      identityDigestVersion: 1,
    });

    if (!readLimit.allowed) {
      return rateLimited(readLimit.retryAfterSeconds);
    }

    const authorization = await verifyShareProjectionAuthorization({
      cookieValue,
      publicId,
    });

    if (!authorization) {
      return genericUnavailable();
    }

    const commentsEnabled = await resolveShareLinkCommentsEnabled(
      authorization.shareLinkId,
      authorization.userId
    );

    if (!commentsEnabled) {
      return genericUnavailable();
    }

    const messages = await listPublicShareMessages({
      shareLinkId: authorization.shareLinkId,
      projectId: authorization.projectId,
      userId: authorization.userId,
    });

    if (messages === null) {
      logShareRouteError("share.messages.read_failed", null);
      return jsonResponse(
        { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." } satisfies MessageSubmissionErrorResponse,
        500
      );
    }

    return jsonResponse(
      { ok: true, data: { messages } } satisfies PublicMessageReadResponse,
      200
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return jsonResponse(
        { ok: false, code: "NOT_FOUND", error: "Not found." } satisfies MessageSubmissionErrorResponse,
        404
      );
    }

    logShareRouteError("share.messages.read", error);

    return jsonResponse(
      { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." } satisfies MessageSubmissionErrorResponse,
      500
    );
  }
}
