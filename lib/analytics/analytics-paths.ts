export function shouldSkipAnalyticsPath(pathname: string | null | undefined) {
  return typeof pathname === "string" && pathname.startsWith("/admin");
}
