"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname } from "next/navigation";

import { shouldSkipAnalyticsPath } from "@/lib/analytics/analytics-paths";
import { useAnalyticsConsentAccepted } from "@/lib/analytics/analytics-consent";

export function ConsentAwareVercelAnalytics() {
  const pathname = usePathname();
  const hasConsent = useAnalyticsConsentAccepted();

  if (!hasConsent || shouldSkipAnalyticsPath(pathname)) {
    return null;
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
