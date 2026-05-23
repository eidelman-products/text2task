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
