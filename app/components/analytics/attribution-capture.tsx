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

function generateRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

/**
 * Phase 4B -- one stable identifier per logical page view. Generated fresh
 * exactly once per genuine navigation (a real pathname change), then reused
 * across any retry/remount of that SAME logical view's send attempt --
 * never regenerated merely because a send was deferred, retried, or the
 * component re-rendered. This is what the server-side idempotency key is
 * built from (see app/api/analytics/event/route.ts): the identity of "one
 * logical page view", not a time bucket or a page-path guess.
 */
function generatePageViewId() {
  return generateRandomId();
}

function getAnonymousId() {
  const stored = clamp(localStorage.getItem(ANONYMOUS_STORAGE_KEY), 120);
  const cookie = clamp(getCookie(ANONYMOUS_COOKIE), 120);
  const anonymousId = stored ?? cookie ?? generateRandomId();

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

/**
 * First-touch attribution capture. Safe to call on every logical page
 * view (not just the first): once a stored record exists, its
 * utm_source/utm_medium/utm_campaign/utm_content/referrer/landing_page are
 * REUSED verbatim, never recalculated from the current page -- only
 * page_path is refreshed to reflect where this specific call is reporting
 * from. This preserves first-touch semantics exactly as before; the only
 * change in this phase is that it is now called once per logical
 * navigation instead of once per hard load.
 */
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

/**
 * Sends exactly one logical page_view. pagePath and pageViewId are passed
 * in explicitly by the caller (captured once, at the moment the logical
 * navigation was detected) rather than re-read live from
 * window.location.pathname -- this event describes a specific, already-
 * decided page view; it must not silently change identity if the visitor
 * has navigated further by the time this deferred call actually runs.
 */
function sendPageView(
  attribution: AttributionData,
  pagePath: string,
  pageViewId: string
) {
  try {
    if (shouldSkipAnalyticsPath(pagePath)) {
      return;
    }

    const payload = JSON.stringify({
      event_name: "page_view",
      page_path: pagePath,
      page_view_id: pageViewId,
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

/**
 * Phase 4B -- fires once per genuine logical navigation (the effect's own
 * dependency is `pathname`, so React only re-invokes it when the pathname
 * itself actually changes -- not on unrelated re-renders, and not on
 * query-string-only changes, since usePathname() never reflects the query
 * string at all). Each invocation captures its own pagePath + a freshly
 * minted pageViewId in local closure variables and schedules exactly one
 * deferred send using those captured values.
 *
 * Deliberately does NOT cancel a still-pending deferred send when the
 * pathname changes again before it fires: under the SPA-aware page_view
 * definition, every genuine navigation must eventually be recorded, even
 * if the visitor moves on quickly. Cancelling on cleanup would silently
 * drop exactly the fast-navigation sessions this phase exists to capture.
 * Nothing here touches React state, so there is no unmount-safety concern
 * with letting a scheduled callback fire after the component has moved on
 * to tracking a different pathname.
 */
function EnabledAttributionCapture({ pathname }: { pathname: string }) {
  useEffect(() => {
    // Effects only re-run when `pathname` itself changes (React's own
    // dependency comparison), so every invocation here already represents
    // a genuine new logical navigation -- including the very first mount,
    // which is exactly "the page currently being viewed" the moment
    // analytics consent is accepted or an excluded->allowed transition
    // occurs (this component doesn't exist in the tree until then).
    const pagePath = pathname;
    const pageViewId = generatePageViewId();

    const run = () => {
      try {
        const attribution = captureAttribution();

        sendPageView(attribution, pagePath, pageViewId);
      } catch {
        // Attribution capture is optional and must never affect the page.
      }
    };

    const idleWindow = window as IdleWindow;

    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(run, { timeout: 2000 });
    } else {
      window.setTimeout(run, 1200);
    }
  }, [pathname]);

  return null;
}

function ConsentGatedAttributionCapture({ pathname }: { pathname: string }) {
  const hasConsent = useAnalyticsConsentAccepted();

  if (!hasConsent) {
    return null;
  }

  return <EnabledAttributionCapture pathname={pathname} />;
}

export function AttributionCapture() {
  const pathname = usePathname();

  if (!INTERNAL_ANALYTICS_ENABLED || shouldSkipAnalyticsPath(pathname)) {
    return null;
  }

  return <ConsentGatedAttributionCapture pathname={pathname} />;
}
