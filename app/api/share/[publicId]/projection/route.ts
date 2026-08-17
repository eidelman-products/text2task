import { NextRequest, NextResponse } from "next/server";

import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";
import { buildPublicClientShareProjection } from "@/lib/share/client-share-projection.server";
import {
  getShareBrowserSessionCookiePolicy,
  hashShareBrowserSessionSecret,
  isValidRawShareBrowserSessionSecret,
} from "@/lib/share/share-browser-session.server";
import { checkShareRateLimit } from "@/lib/share/share-rate-limit.server";
import { isValidSharePublicId } from "@/lib/share/share-public-id.server";
import { verifyShareProjectionAuthorization } from "@/lib/share/share-session-grant.server";

/*
  Phase 3 -- GET /api/share/[publicId]/projection. The clean-URL,
  session-authorized public projection read. Accepts NO bearer secret of
  any kind (no query/header/body parameter) -- authorization is derived
  entirely from the HttpOnly browser-session cookie, re-verified in full
  on every call (session live+unrevoked, link active+unexpired+project-
  not-deleted, grant same-session+same-link+unexpired+unrevoked+exact-
  configuration-version-match+PIN-requirement-satisfied). Never trusts
  the cookie or the publicId alone.

  Reuses Phase 2D's exact ClientProjectProjection contract via
  buildPublicClientShareProjection -- no second projection type, no
  duplicated visibility/privacy logic.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type ProjectionErrorResponse = { ok: false; code: string; error: string };

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

function genericUnauthorized(): NextResponse {
  return jsonResponse(
    { ok: false, code: "UNAVAILABLE", error: "This shared link is not available." } satisfies ProjectionErrorResponse,
    401
  );
}

function rateLimited(retryAfterSeconds: number): NextResponse {
  return jsonResponse(
    {
      ok: false,
      code: "RATE_LIMITED",
      error: "Too many requests. Please try again shortly.",
    } satisfies ProjectionErrorResponse,
    429,
    { "Retry-After": String(retryAfterSeconds) }
  );
}

/** Lightweight same-origin defense in depth for a read-only GET: only
 * rejects when Sec-Fetch-Site is PRESENT and not same-origin. A missing
 * Sec-Fetch-Site (top-level navigations, some webviews) is accepted --
 * this route's real authorization boundary is the HttpOnly session
 * cookie plus the browser's own same-origin policy on the response body,
 * not this header. */
function isCrossSiteFetch(headers: Headers): boolean {
  const secFetchSite = headers.get("sec-fetch-site");
  return secFetchSite !== null && secFetchSite.toLowerCase() !== "same-origin";
}

function logShareRouteError(stage: string, error: unknown): void {
  console.error("share_public_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

type RouteContext = { params: Promise<{ publicId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    if (isCrossSiteFetch(request.headers)) {
      return jsonResponse(
        { ok: false, code: "INVALID_ORIGIN", error: "Invalid request origin." } satisfies ProjectionErrorResponse,
        403
      );
    }

    const { publicId } = await context.params;

    if (!isValidSharePublicId(publicId)) {
      return genericUnauthorized();
    }

    const cookiePolicy = getShareBrowserSessionCookiePolicy();
    const cookieValue = request.cookies.get(cookiePolicy.name)?.value ?? null;

    if (cookieValue === null || !isValidRawShareBrowserSessionSecret(cookieValue)) {
      return genericUnauthorized();
    }

    let sessionDigest: string;
    try {
      sessionDigest = hashShareBrowserSessionSecret(cookieValue);
    } catch {
      return genericUnauthorized();
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
      return genericUnauthorized();
    }

    const result = await buildPublicClientShareProjection({
      shareLinkId: authorization.shareLinkId,
      projectId: authorization.projectId,
      userId: authorization.userId,
    });

    if (!result.ok) {
      return genericUnauthorized();
    }

    return jsonResponse({ ok: true, data: result.data }, 200);
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return jsonResponse(
        { ok: false, code: "NOT_FOUND", error: "Not found." } satisfies ProjectionErrorResponse,
        404
      );
    }

    logShareRouteError("share.projection.read", error);

    return jsonResponse(
      { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." } satisfies ProjectionErrorResponse,
      500
    );
  }
}
