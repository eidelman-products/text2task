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
import { isValidSharePin, verifySharePin } from "@/lib/share/share-pin.server";
import { isValidSharePublicId } from "@/lib/share/share-public-id.server";
import {
  ensureCurrentGrant,
  findAnyGrantForSession,
  isShareLinkCurrentlyPubliclyActive,
  resolveBrowserSessionFromCookie,
  resolveShareLinkByPublicId,
} from "@/lib/share/share-session-grant.server";
import {
  getShareBrowserSessionCookiePolicy,
  isValidRawShareBrowserSessionSecret,
} from "@/lib/share/share-browser-session.server";

/*
  Phase 8 corrective change (202608250001) -- POST
  /api/share/[publicId]/pin. The ONE deliberate, narrowly-scoped recovery
  path for an already-authorized browser whose grant went stale because
  the owner changed the link's PIN (pin_epoch bump). Accepts a PIN and
  NOTHING ELSE -- no secret, no fragment, no bearer of any kind beyond the
  existing HttpOnly browser-session cookie.

  This is intentionally NOT a general-purpose re-authorization endpoint.
  It exists to close one specific gap: set_share_link_pin's own pin_epoch
  bump (necessary -- an existing grant's own pin_verified_at can already
  be non-null from an OLD PIN, so the PIN-required check alone cannot
  force revalidation against a NEW value) would otherwise permanently
  strand an already-authorized browser with no raw secret to recover
  with, exactly like the original disable/re-enable defect this whole
  corrective change closes.

  SECURITY -- why this cannot become a rotation bypass, and why that
  requires access_epoch and pin_epoch to be two SEPARATE fields rather
  than one shared counter (see share-session-grant.server.ts's own
  verifyShareProjectionAuthorization doc comment for the full design):

    1. This route requires PROOF that this exact browser session once
       completed a genuine secret-based exchange for THIS exact link --
       via findAnyGrantForSession, which returns a row only if
       ensureCurrentGrant (itself only ever reachable after the raw
       secret verified) has ever created one for this (session, link)
       pair, regardless of its current epoch/revoked status. A bare
       browser-session cookie alone is NOT sufficient proof -- it is
       link-agnostic and could have been minted for a completely
       different project's share link.
    2. Even with that proof, this route additionally requires the
       EXISTING grant's own `grantedAccessEpoch` to still exactly match
       the link's LIVE `access_epoch`. If the link's secret has been
       rotated since that grant was issued, access_epoch will have moved
       and this check fails closed -- no PIN, however correct, can
       substitute for a fresh secret-based exchange after rotation. This
       is what makes "old secret must remain unusable" hold even in the
       presence of this recovery path: rotation's own invalidation can
       NEVER be undone here, only PIN-only staleness can.
    3. The submitted PIN must still verify against the link's CURRENT
       pin material (scrypt, constant-time compare) -- this route grants
       nothing merely because a grant once existed; it re-establishes
       full PIN-required authorization exactly the same way the session
       exchange route's own PIN branch does.
    4. Same generic failure shape, same rate-limit action/scope
       (pin_verification, share_link) as the existing session-exchange
       PIN path -- no new abuse surface, no enumeration signal beyond
       what that path already reveals today.

  On success, calls the SAME ensureCurrentGrant used by session/route.ts
  to create/refresh the grant to the link's current access_epoch and
  pin_epoch (both, since a same-epoch check just proved access_epoch is
  already current) -- no new grant-creation code path, no new database
  function.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()",
};

const requestBodySchema = z
  .object({
    pin: z.string(),
  })
  .strict();

type PinRecoverySuccess = { ok: true; status: "authorized" };
type PinRecoveryError = { ok: false; code: string; error: string };

function jsonResponse(
  body: PinRecoverySuccess | PinRecoveryError,
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

    // Rate limit FIRST, before origin validation or body parsing --
    // matching POST /api/share/session's own established Phase 7B
    // ordering exactly.
    const networkIdentity = createShareNetworkIdentityDigest(request.headers);
    const networkLimit = await checkShareRateLimit({
      action: "pin_verification",
      scope: "network_identity",
      identityDigest: networkIdentity.digest,
      identityDigestVersion: networkIdentity.version,
    });

    if (!networkLimit.allowed) {
      return rateLimited(networkLimit.retryAfterSeconds);
    }

    validateSharePublicRequestOrigin({ requestUrl: request.url, headers: request.headers });

    const { publicId } = await context.params;

    if (!isValidSharePublicId(publicId)) {
      return genericUnavailable();
    }

    const bodyJson = await readSharePublicRequestJson(request);
    const parsedBody = requestBodySchema.safeParse(bodyJson);

    if (!parsedBody.success) {
      return jsonResponse({ ok: false, code: "INVALID_REQUEST", error: "Invalid request." }, 400);
    }

    const { pin } = parsedBody.data;

    if (!isValidSharePin(pin)) {
      return jsonResponse({ ok: false, code: "INVALID_REQUEST", error: "Invalid request." }, 400);
    }

    const cookiePolicy = getShareBrowserSessionCookiePolicy();
    const cookieValue = request.cookies.get(cookiePolicy.name)?.value ?? null;

    if (cookieValue === null || !isValidRawShareBrowserSessionSecret(cookieValue)) {
      return genericUnavailable();
    }

    const session = await resolveBrowserSessionFromCookie(cookieValue);
    if (!session) {
      return genericUnavailable();
    }

    const link = await resolveShareLinkByPublicId(publicId);
    if (!link) {
      return genericUnavailable();
    }

    const linkActive = await isShareLinkCurrentlyPubliclyActive(link);
    if (!linkActive) {
      return genericUnavailable();
    }

    if (link.pinMaterial === null) {
      // No PIN is required at all -- nothing for this route to recover.
      // A stale grant against a no-PIN link is an access_epoch matter
      // (rotation), never reachable here.
      return genericUnavailable();
    }

    // Proof this exact browser session once completed a genuine
    // secret-based exchange for THIS exact link (see this file's own
    // header comment, point 1).
    const priorGrant = await findAnyGrantForSession(session.id, link.id);
    if (!priorGrant) {
      return genericUnavailable();
    }

    // The link's secret must NOT have been rotated since that grant was
    // issued -- no PIN, however correct, may substitute for a fresh
    // secret-based exchange after rotation (see this file's own header
    // comment, point 2).
    if (priorGrant.grantedAccessEpoch !== link.accessEpoch) {
      return genericUnavailable();
    }

    // Same share_link-scoped PIN rate-limit bucket the session-exchange
    // route's own PIN branch already uses -- no new abuse budget.
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

    const grantOk = await ensureCurrentGrant({
      browserSessionId: session.id,
      browserSessionExpiresAt: session.expiresAt,
      shareLinkId: link.id,
      linkConfigurationVersion: link.configurationVersion,
      linkAccessEpoch: link.accessEpoch,
      linkPinEpoch: link.pinEpoch,
      pinVerifiedNow: true,
    });

    if (!grantOk) {
      return genericUnavailable();
    }

    return jsonResponse({ ok: true, status: "authorized" }, 200);
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

    logShareRouteError("share.pin.recover", error);

    return jsonResponse(
      { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." },
      500
    );
  }
}
