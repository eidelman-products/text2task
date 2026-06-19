"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

import { shouldSkipAnalyticsPath } from "@/lib/analytics/analytics-paths";
import { useAnalyticsConsentAccepted } from "@/lib/analytics/analytics-consent";

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Central Google Tag component for Text2Task.
 *
 * Important:
 * - The website already has a Google Ads tag installed.
 * - GA4 was connected in Google Analytics as a destination of the same Google tag.
 * - We load ONE Google tag script only, using the existing Google Ads ID.
 * - We do NOT call gtag("config", GA_MEASUREMENT_ID) here, because that can create duplicate GA4 page views
 *   when GA4 is already connected as a destination in Google tag settings.
 *
 * Env vars:
 * - NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXXX
 * - NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
 */
export function GoogleAdsTag() {
  const pathname = usePathname();
  const hasConsent = useAnalyticsConsentAccepted();

  if (!GOOGLE_ADS_ID || !hasConsent || shouldSkipAnalyticsPath(pathname)) {
    return null;
  }

  return (
    <>
      <Script
        id="google-tag-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
        strategy="afterInteractive"
      />

      <Script id="google-tag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;

          gtag('js', new Date());

          gtag('config', '${GOOGLE_ADS_ID}');

          ${
            GA_MEASUREMENT_ID
              ? `window.__TEXT2TASK_GA_MEASUREMENT_ID__ = '${GA_MEASUREMENT_ID}';`
              : ""
          }
        `}
      </Script>
    </>
  );
}
