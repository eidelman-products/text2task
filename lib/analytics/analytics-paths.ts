const HOMEPAGE_DEMO_REVIEW_PATH = "/homepage-demo/review";

export function shouldSkipAnalyticsPath(pathname: string | null | undefined) {
  return (
    typeof pathname === "string" &&
    (pathname.startsWith("/admin") || pathname === HOMEPAGE_DEMO_REVIEW_PATH)
  );
}
