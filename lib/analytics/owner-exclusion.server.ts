import "server-only";

import type { NextRequest, NextResponse } from "next/server";

/**
 * Marks a browser as belonging to the Text2Task owner. Set only once, from
 * a server-verified owner login (app/api/auth/login/route.ts,
 * app/auth/oauth/callback/route.ts -- see lib/auth/owner.server.ts for the
 * actual identity check). Read by app/api/analytics/event/route.ts to
 * silently skip inserting anonymous analytics rows from that browser.
 *
 * This is NOT an authorization mechanism: possessing or forging this
 * cookie only ever suppresses that one browser's own contribution to
 * anonymous analytics counts. It intentionally persists past logout --
 * it marks a known owner browser, not the current auth session.
 */

export const OWNER_ANALYTICS_EXCLUSION_COOKIE = "t2t_owner_analytics_excluded";
const OWNER_ANALYTICS_EXCLUSION_VALUE = "1";
const OWNER_ANALYTICS_EXCLUSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

/**
 * Attaches the owner-exclusion cookie to an outgoing response. Never
 * throws -- cookie-setting failure must never turn a successful login
 * into a failed one, so any error here is swallowed.
 */
export function setOwnerAnalyticsExclusionCookie(response: NextResponse) {
  try {
    response.cookies.set(
      OWNER_ANALYTICS_EXCLUSION_COOKIE,
      OWNER_ANALYTICS_EXCLUSION_VALUE,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: isProductionRuntime(),
        path: "/",
        maxAge: OWNER_ANALYTICS_EXCLUSION_MAX_AGE_SECONDS,
      }
    );
  } catch {
    // Analytics exclusion is non-critical; never let this affect login.
  }
}

/**
 * Reads the owner-exclusion cookie from an incoming request. Only the
 * exact intended value activates exclusion -- any other value (malformed,
 * tampered, legacy) is treated as absent. Never throws.
 */
export function hasOwnerAnalyticsExclusionCookie(request: NextRequest) {
  try {
    return (
      request.cookies.get(OWNER_ANALYTICS_EXCLUSION_COOKIE)?.value ===
      OWNER_ANALYTICS_EXCLUSION_VALUE
    );
  } catch {
    return false;
  }
}
