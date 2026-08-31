"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { shouldSkipAnalyticsPath } from "@/lib/analytics/analytics-paths";
import { useAnalyticsConsentChoice } from "@/lib/analytics/analytics-consent";

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID;

/**
 * Phase 3A -- narrowly-scoped, OFF-by-default switch for the future
 * pre-consent cookieless Clarity architecture (see the SEO/analytics
 * blueprint's Phase 2 audit). Unset or any value other than the literal
 * string "true" MUST mean false -- production behavior stays identical to
 * pre-Phase-3A Clarity (load only after explicit Accept) until this is
 * deliberately turned on in a later, separate phase, after the Clarity
 * project dashboard's own "Cookies" setting has also been switched off.
 */
const CLARITY_EARLY_NO_CONSENT_MODE_ENABLED =
  process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE === "true";

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

/**
 * Module-level (not React-state) guard. React state/refs are reset on every
 * unmount, which is exactly the failure mode Phase 1/2 identified: this
 * component used to conditionally return null based on path/consent,
 * unmounting and remounting the inline installer script on every
 * tracked -> excluded -> tracked transition. This flag instead lives on the
 * module -- initialized once per real page load/document, surviving any
 * number of React mount/unmount/re-render cycles for as long as the page
 * itself is open. A hard reload naturally resets it (new module instance),
 * which is the correct, expected "new page load = fresh init" behavior.
 */
let clarityLoaderInserted = false;

/**
 * Inserts the official Microsoft Clarity install snippet at most once per
 * document. Reuses window.clarity if it already exists (e.g. some other
 * integration already defined it) instead of assuming we're the only
 * possible installer. Every operation is wrapped in try/catch -- analytics
 * must never be capable of throwing into the render tree or breaking the
 * page, regardless of DOM state, CSP blocking, ad blockers, or anything
 * else that can go wrong with a third-party script.
 */
export function insertClarityLoaderOnce(projectId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (clarityLoaderInserted || typeof window.clarity === "function") {
    clarityLoaderInserted = true;
    return;
  }

  try {
    clarityLoaderInserted = true;

    const w = window as Window & { clarity: NonNullable<Window["clarity"]> };

    w.clarity =
      w.clarity ||
      (function clarityQueue(...args: unknown[]) {
        (w.clarity.q = w.clarity.q || []).push(args);
      } as NonNullable<Window["clarity"]>);

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${projectId}`;

    const anchor = document.getElementsByTagName("script")[0];

    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(script, anchor);
    } else {
      (document.head ?? document.documentElement).appendChild(script);
    }
  } catch {
    // Analytics must never break the page. If insertion fails, Clarity is
    // simply unavailable for this session -- the rest of Text2Task is
    // unaffected.
  }
}

/**
 * Informs Clarity of the current consent decision via the currently
 * documented ConsentV2 API (Microsoft Learn, "Clarity Cookie Consent API -
 * ConsentV2", reference for the exact casing: `ad_Storage` /
 * `analytics_Storage`, capital "S" -- this is Clarity's own casing, distinct
 * from Google Consent Mode's lowercase `ad_storage`/`analytics_storage`).
 *
 * ad_Storage is always "denied": Text2Task does not use Clarity's
 * Microsoft Ads integration and does not need ad-related data sharing, so
 * accepting analytics consent must never implicitly grant ad consent too.
 */
export function sendClarityConsentSignal(analyticsGranted: boolean): void {
  if (typeof window === "undefined" || typeof window.clarity !== "function") {
    return;
  }

  try {
    window.clarity("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: analyticsGranted ? "granted" : "denied",
    });
  } catch {
    // Best-effort only -- never break the page.
  }
}

/**
 * Hard-stop path, used both for explicit rejection and for entering an
 * excluded route while Clarity may already be running. Uses Clarity's
 * documented revocation call (Microsoft Learn, ConsentV2 reference, "Erase
 * cookies": `clarity('consent', false)`), which "clears the Clarity cookies
 * from the user's browser and prevent[s] further tracking until new consent
 * is granted" -- chosen deliberately over sending `consentv2` with denied
 * values, because that path is documented to "restart tracking in
 * no-consent mode" (i.e. keep collecting in a limited form), which does not
 * satisfy Text2Task's requirement that an excluded route mean zero
 * collection. Only meaningful if Clarity was already loaded (e.g. a prior
 * Accept, or a future early-no-consent-mode session) -- a no-op, safely, if
 * it was never loaded at all.
 */
export function revokeClarityConsent(): void {
  if (typeof window === "undefined" || typeof window.clarity !== "function") {
    return;
  }

  try {
    window.clarity("consent", false);
  } catch {
    // Best-effort only -- never break the page.
  }
}

export function MicrosoftClarity() {
  const pathname = usePathname();
  const consentChoice = useAnalyticsConsentChoice();

  const isExcludedPath = shouldSkipAnalyticsPath(pathname);
  const hasAccepted = consentChoice === "accepted";
  const hasRejected = consentChoice === "rejected";
  const shouldLoad =
    Boolean(CLARITY_PROJECT_ID) &&
    !isExcludedPath &&
    !hasRejected &&
    (hasAccepted || CLARITY_EARLY_NO_CONSENT_MODE_ENABLED);

  useEffect(() => {
    if (!CLARITY_PROJECT_ID) {
      return;
    }

    if (isExcludedPath) {
      // Phase 3A.1 -- hard privacy requirement: an excluded path must mean
      // zero Clarity collection on that route, not merely "do not insert a
      // second loader here". window.clarity, once loaded on an earlier
      // tracked route, keeps running independently of this component's own
      // mount state (confirmed in the Phase 1/2 audits) -- not calling
      // anything here would leave an already-accepted visitor's session
      // actively recording on /admin*, /share, and /share/*. Revoking is a
      // safe no-op if Clarity was never loaded at all (e.g. a direct hard
      // load on an excluded path), and actively stops an already-running
      // client if the visitor navigated in from a tracked route.
      revokeClarityConsent();
      return;
    }

    if (shouldLoad) {
      insertClarityLoaderOnce(CLARITY_PROJECT_ID);
      sendClarityConsentSignal(hasAccepted);
      return;
    }

    if (hasRejected) {
      // Do not silently treat explicit rejection as permission to keep
      // collecting: if Clarity had already been loaded (a prior Accept, or
      // a future early-no-consent-mode session), tell it to stop and clear
      // its cookies. Safely a no-op if Clarity was never loaded.
      revokeClarityConsent();
    }
  }, [shouldLoad, isExcludedPath, hasAccepted, hasRejected]);

  return null;
}
