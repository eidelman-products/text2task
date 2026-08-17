import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";
import {
  isSharePublicRequestError,
  readSharePublicRequestJson,
  validateSharePublicRequestOrigin,
} from "@/lib/share/share-public-request.server";
import {
  createShareLinkRateLimitIdentityDigest,
  createShareNetworkIdentityDigest,
  isShareIdentityError,
} from "@/lib/share/share-identity.server";
import { checkShareRateLimit } from "@/lib/share/share-rate-limit.server";
import { createShareSecretDigest, isValidRawShareSecret } from "@/lib/share/share-secret.server";
import { isValidSharePin, verifySharePin } from "@/lib/share/share-pin.server";
import { isValidSharePublicId } from "@/lib/share/share-public-id.server";
import {
  ensureCurrentGrant,
  isShareLinkCurrentlyPubliclyActive,
  resolveOrCreateBrowserSession,
  resolveShareLinkByPublicId,
} from "@/lib/share/share-session-grant.server";
import { getShareBrowserSessionCookiePolicy } from "@/lib/share/share-browser-session.server";

/*
  Phase 3 -- POST /api/share/session. The fragment-secret bearer exchange
  endpoint for the anonymous Client Share surface: proves possession of
  the #secret, resolves/creates the HttpOnly browser-session cookie, and
  creates the exact-link grant -- never a project projection (that is
  GET /api/share/[publicId]/projection's job, authorized by cookie alone).

  Unknown publicId, invalid secret, disabled/revoked/expired link and a
  deleted project all share ONE generic response (genericUnavailable) --
  no enumeration oracle. A PIN-protected link only ever reveals
  "pin_required" AFTER the secret itself has already verified.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const requestBodySchema = z
  .object({
    publicId: z.string(),
    secret: z.string(),
    pin: z.string().optional(),
  })
  .strict();

type SessionExchangeSuccess =
  | { ok: true; status: "authorized" }
  | { ok: true; status: "pin_required" };

type SessionExchangeError = { ok: false; code: string; error: string };

function jsonResponse(
  body: SessionExchangeSuccess | SessionExchangeError,
  status: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

function genericUnavailable(): NextResponse {
  return jsonResponse(
    { ok: false, code: "UNAVAILABLE", error: "This shared link is not available." },
    404
  );
}

function rateLimited(retryAfterSeconds: number): NextResponse {
  return jsonResponse(
    { ok: false, code: "RATE_LIMITED", error: "Too many attempts. Please try again shortly." },
    429,
    { "Retry-After": String(retryAfterSeconds) }
  );
}

/** Constant-time comparison of two already-hex-encoded digests. Never a
 * `===` string comparison, which would leak timing information about how
 * many leading characters matched. */
function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function logShareRouteError(stage: string, error: unknown): void {
  console.error("share_public_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

export async function POST(request: NextRequest) {
  try {
    assertClientShareEnabled();

    validateSharePublicRequestOrigin({ requestUrl: request.url, headers: request.headers });

    const bodyJson = await readSharePublicRequestJson(request);
    const parsedBody = requestBodySchema.safeParse(bodyJson);

    if (!parsedBody.success) {
      return jsonResponse({ ok: false, code: "INVALID_REQUEST", error: "Invalid request." }, 400);
    }

    const { publicId, secret, pin } = parsedBody.data;

    if (!isValidSharePublicId(publicId) || !isValidRawShareSecret(secret)) {
      return jsonResponse({ ok: false, code: "INVALID_REQUEST", error: "Invalid request." }, 400);
    }

    if (pin !== undefined && !isValidSharePin(pin)) {
      return jsonResponse({ ok: false, code: "INVALID_REQUEST", error: "Invalid request." }, 400);
    }

    // Rate limit session_exchange FIRST, before any secret/PIN
    // verification work -- every attempt consumes this bucket regardless
    // of outcome.
    const networkIdentity = createShareNetworkIdentityDigest(request.headers);
    const exchangeLimit = await checkShareRateLimit({
      action: "session_exchange",
      scope: "network_identity",
      identityDigest: networkIdentity.digest,
      identityDigestVersion: networkIdentity.version,
    });

    if (!exchangeLimit.allowed) {
      return rateLimited(exchangeLimit.retryAfterSeconds);
    }

    async function failInvalidLink(): Promise<NextResponse> {
      const invalidLinkLimit = await checkShareRateLimit({
        action: "invalid_link_access",
        scope: "network_identity",
        identityDigest: networkIdentity.digest,
        identityDigestVersion: networkIdentity.version,
      });

      if (!invalidLinkLimit.allowed) {
        return rateLimited(invalidLinkLimit.retryAfterSeconds);
      }

      return genericUnavailable();
    }

    const link = await resolveShareLinkByPublicId(publicId);
    if (!link) {
      return failInvalidLink();
    }

    const linkActive = await isShareLinkCurrentlyPubliclyActive(link);
    if (!linkActive) {
      return failInvalidLink();
    }

    if (!link.secretDigest || link.secretDigestVersion !== 1) {
      return failInvalidLink();
    }

    let suppliedDigest: string;
    try {
      suppliedDigest = createShareSecretDigest(secret);
    } catch {
      return failInvalidLink();
    }

    if (!constantTimeHexEqual(suppliedDigest, link.secretDigest)) {
      return failInvalidLink();
    }

    // Secret verified from here on -- never re-derive genericUnavailable
    // for anything below except a genuine internal failure.
    const linkRequiresPin = link.pinMaterial !== null;

    if (linkRequiresPin && pin === undefined) {
      return jsonResponse({ ok: true, status: "pin_required" }, 200);
    }

    if (linkRequiresPin && pin !== undefined) {
      const linkIdentity = createShareLinkRateLimitIdentityDigest(link.id);
      const pinLimit = await checkShareRateLimit({
        action: "pin_verification",
        scope: "share_link",
        identityDigest: linkIdentity.digest,
        identityDigestVersion: linkIdentity.version,
        shareLinkId: link.id,
      });

      if (!pinLimit.allowed) {
        return rateLimited(pinLimit.retryAfterSeconds);
      }

      let pinCorrect: boolean;
      try {
        pinCorrect = await verifySharePin(pin, link.pinMaterial);
      } catch {
        pinCorrect = false;
      }

      if (!pinCorrect) {
        return jsonResponse({ ok: false, code: "PIN_INCORRECT", error: "Incorrect PIN." }, 401);
      }
    }

    // Authorized: no PIN required, or the supplied PIN just verified.
    const cookiePolicy = getShareBrowserSessionCookiePolicy();
    const existingCookieValue = request.cookies.get(cookiePolicy.name)?.value ?? null;
    const { session, rawSecretForCookie } = await resolveOrCreateBrowserSession(
      existingCookieValue
    );

    const grantOk = await ensureCurrentGrant({
      browserSessionId: session.id,
      browserSessionExpiresAt: session.expiresAt,
      shareLinkId: link.id,
      linkConfigurationVersion: link.configurationVersion,
      linkExpiresAt: link.expiresAt,
      pinVerifiedNow: linkRequiresPin,
    });

    if (!grantOk) {
      return genericUnavailable();
    }

    const response = jsonResponse({ ok: true, status: "authorized" }, 200);

    if (rawSecretForCookie) {
      response.cookies.set(cookiePolicy.name, rawSecretForCookie, cookiePolicy);
    }

    return response;
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return jsonResponse({ ok: false, code: "NOT_FOUND", error: "Not found." }, 404);
    }

    if (isSharePublicRequestError(error)) {
      switch (error.code) {
        case "invalid_request_origin":
          return jsonResponse(
            { ok: false, code: "INVALID_ORIGIN", error: "Invalid request origin." },
            403
          );
        case "invalid_request_content_type":
          return jsonResponse(
            { ok: false, code: "INVALID_CONTENT_TYPE", error: "Invalid content type." },
            415
          );
        case "unsupported_request_encoding":
          return jsonResponse(
            { ok: false, code: "UNSUPPORTED_ENCODING", error: "Unsupported request encoding." },
            415
          );
        case "request_body_too_large":
          return jsonResponse(
            { ok: false, code: "BODY_TOO_LARGE", error: "Request body too large." },
            413
          );
        case "invalid_request_body":
          return jsonResponse(
            { ok: false, code: "INVALID_REQUEST", error: "Invalid request." },
            400
          );
      }
    }

    if (isShareIdentityError(error)) {
      return jsonResponse(
        { ok: false, code: "TEMPORARILY_UNAVAILABLE", error: "Temporarily unavailable." },
        503
      );
    }

    logShareRouteError("share.session.exchange", error);

    return jsonResponse(
      { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." },
      500
    );
  }
}
