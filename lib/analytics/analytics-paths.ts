const HOMEPAGE_DEMO_REVIEW_PATH = "/homepage-demo/review";

/** Phase 3 -- the public, no-login Client Share surface must never load
 * Microsoft Clarity, GA/GA4, Google Ads, session replay or any other
 * third-party tracking script. Matches "/share" and every "/share/..."
 * path (the public page itself, e.g. /share/<publicId>). */
const CLIENT_SHARE_PUBLIC_PATH_PREFIX = "/share";

export function shouldSkipAnalyticsPath(pathname: string | null | undefined) {
  return (
    typeof pathname === "string" &&
    (pathname.startsWith("/admin") ||
      pathname === HOMEPAGE_DEMO_REVIEW_PATH ||
      pathname === CLIENT_SHARE_PUBLIC_PATH_PREFIX ||
      pathname.startsWith(`${CLIENT_SHARE_PUBLIC_PATH_PREFIX}/`))
  );
}
