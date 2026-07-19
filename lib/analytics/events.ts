interface AnalyticsWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}

function getGtag(): ((...args: unknown[]) => void) | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const gtagFn = (window as AnalyticsWindow).gtag;

  return typeof gtagFn === "function" ? gtagFn : undefined;
}

function trackEvent(...args: unknown[]): void {
  const gtag = getGtag();
  if (!gtag) return;

  try {
    gtag(...args);
  } catch {
    // Fail silently; analytics should never interrupt checkout.
  }
}

export function trackBeginCheckout(): void {
  trackEvent("event", "conversion", {
    send_to: "AW-670652067/IPHJCPi40vICEKOt5b8C",
  });
}

// Homepage conversion-sprint events. Each call is a bare, named event with no
// user content or identifiers — trackEvent() above is already fail-open and
// only ever reaches window.gtag once analytics consent has been accepted.
export function trackHeroLiveDemoClick(): void {
  trackEvent("event", "hero_live_demo_click");
}

export function trackHeroCreateWorkspaceClick(): void {
  trackEvent("event", "hero_create_workspace_click");
}

export function trackLiveDemoExampleClick(): void {
  trackEvent("event", "live_demo_example_click");
}

export function trackLiveDemoSubmit(): void {
  trackEvent("event", "live_demo_submit");
}

export function trackLiveDemoSuccess(): void {
  trackEvent("event", "live_demo_success");
}

export function trackHomepageFreePlanClick(): void {
  trackEvent("event", "homepage_free_plan_click");
}

export function trackHomepageProPlanClick(): void {
  trackEvent("event", "homepage_pro_plan_click");
}

export function trackFinalLiveDemoClick(): void {
  trackEvent("event", "final_live_demo_click");
}

export function trackFinalCreateWorkspaceClick(): void {
  trackEvent("event", "final_create_workspace_click");
}
