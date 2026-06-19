"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { shouldSkipAnalyticsPath } from "@/lib/analytics/analytics-paths";
import { useAnalyticsConsentAccepted } from "@/lib/analytics/analytics-consent";

const ATTRIBUTION_STORAGE_KEY = "text2task:first_touch_attribution";
const ANONYMOUS_STORAGE_KEY = "text2task:anonymous_id";
const ATTRIBUTION_COOKIE = "t2t_attribution";
const ANONYMOUS_COOKIE = "t2t_anon_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const INTERNAL_ANALYTICS_ENABLED =
  process.env.NEXT_PUBLIC_TEXT2TASK_INTERNAL_ANALYTICS_ENABLED === "true";

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

type AttributionData = {
  anonymous_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_page: string;
  page_path: string;
  captured_at: string;
};

function clamp(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  return text ? text.slice(0, maxLength) : null;
}

function getCookie(name: string) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}

function setCookie(name: string, value: string) {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
}

function getSafePath() {
  return window.location.pathname || "/";
}

function getSafeLandingPage(params: URLSearchParams) {
  const allowedParams = new URLSearchParams();

  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const value = clamp(params.get(key), 160);

    if (value) {
      allowedParams.set(key, value);
    }
  }

  const query = allowedParams.toString();

  return `${getSafePath()}${query ? `?${query}` : ""}`;
}

function getSafeReferrer() {
  const referrer = document.referrer;

  if (!referrer) {
    return null;
  }

  try {
    const url = new URL(referrer);

    return clamp(`${url.origin}${url.pathname}`, 500);
  } catch {
    return clamp(referrer, 500);
  }
}

function generateAnonymousId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `anon_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function getAnonymousId() {
  const stored = clamp(localStorage.getItem(ANONYMOUS_STORAGE_KEY), 120);
  const cookie = clamp(getCookie(ANONYMOUS_COOKIE), 120);
  const anonymousId = stored ?? cookie ?? generateAnonymousId();

  localStorage.setItem(ANONYMOUS_STORAGE_KEY, anonymousId);
  setCookie(ANONYMOUS_COOKIE, anonymousId);

  return anonymousId;
}

function readStoredAttribution() {
  try {
    const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === "object"
      ? (parsed as Partial<AttributionData>)
      : null;
  } catch {
    return null;
  }
}

function writeAttributionCookie(attribution: AttributionData) {
  setCookie(
    ATTRIBUTION_COOKIE,
    JSON.stringify({
      anonymous_id: attribution.anonymous_id,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      referrer: attribution.referrer,
      landing_page: attribution.landing_page,
      page_path: attribution.page_path,
    })
  );
}

function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const anonymousId = getAnonymousId();
  const existing = readStoredAttribution();

  if (existing?.anonymous_id) {
    const attribution = {
      anonymous_id: anonymousId,
      utm_source: clamp(existing.utm_source, 120),
      utm_medium: clamp(existing.utm_medium, 120),
      utm_campaign: clamp(existing.utm_campaign, 160),
      utm_content: clamp(existing.utm_content, 160),
      referrer: clamp(existing.referrer, 500),
      landing_page: clamp(existing.landing_page, 500) ?? getSafeLandingPage(params),
      page_path: getSafePath(),
      captured_at:
        clamp(existing.captured_at, 80) ?? new Date().toISOString(),
    };

    writeAttributionCookie(attribution);

    return attribution;
  }

  const attribution: AttributionData = {
    anonymous_id: anonymousId,
    utm_source: clamp(params.get("utm_source"), 120),
    utm_medium: clamp(params.get("utm_medium"), 120),
    utm_campaign: clamp(params.get("utm_campaign"), 160),
    utm_content: clamp(params.get("utm_content"), 160),
    referrer: getSafeReferrer(),
    landing_page: getSafeLandingPage(params),
    page_path: getSafePath(),
    captured_at: new Date().toISOString(),
  };

  localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  writeAttributionCookie(attribution);

  return attribution;
}

function sendPageView(attribution: AttributionData) {
  try {
    const pagePath = getSafePath();

    if (shouldSkipAnalyticsPath(pagePath)) {
      return;
    }

    const payload = JSON.stringify({
      event_name: "page_view",
      page_path: pagePath,
      attribution,
    });

    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        "/api/analytics/event",
        new Blob([payload], { type: "application/json" })
      );

      if (sent) {
        return;
      }
    }

    void fetch("/api/analytics/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Best-effort analytics must never affect the page.
  }
}

function EnabledAttributionCapture() {
  useEffect(() => {
    const run = () => {
      try {
        const attribution = captureAttribution();

        sendPageView(attribution);
      } catch {
        // Attribution capture is optional and must never affect the page.
      }
    };

    const idleWindow = window as IdleWindow;

    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(run, { timeout: 2000 });

      return () => {
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(run, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}

function ConsentGatedAttributionCapture() {
  const hasConsent = useAnalyticsConsentAccepted();

  if (!hasConsent) {
    return null;
  }

  return <EnabledAttributionCapture />;
}

export function AttributionCapture() {
  const pathname = usePathname();

  if (!INTERNAL_ANALYTICS_ENABLED || shouldSkipAnalyticsPath(pathname)) {
    return null;
  }

  return <ConsentGatedAttributionCapture />;
}
