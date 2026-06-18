"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { useAnalyticsConsentAccepted } from "@/lib/analytics/analytics-consent";

export function ConsentAwareVercelAnalytics() {
  const hasConsent = useAnalyticsConsentAccepted();

  if (!hasConsent) {
    return null;
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
