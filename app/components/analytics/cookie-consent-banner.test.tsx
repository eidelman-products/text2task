// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const { CookieConsentBanner } = await import("./cookie-consent-banner");

/*
  Real browser defect #4 turn -- analytics finding regression: proves the
  cookie-consent banner no longer renders on /share/** (the public,
  no-login Client Share surface), reusing the exact same
  shouldSkipAnalyticsPath exclusion every actual analytics component
  already used -- confirming the banner-only symptom observed in the
  real browser PIN test is fully closed, without touching consent
  behavior anywhere else on the site.
*/

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "text2task:analytics_consent=; Max-Age=0; Path=/";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CookieConsentBanner - /share/** exclusion (real browser defect #4)", () => {
  it("does not render on the public share page (/share/<publicId>)", () => {
    usePathnameMock.mockReturnValue("/share/abcdefgh12345678ijklmnop");
    render(<CookieConsentBanner />);
    expect(screen.queryByText(/analytics cookies/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /cookie notice/i })).not.toBeInTheDocument();
  });

  it("does not render on the bare /share path", () => {
    usePathnameMock.mockReturnValue("/share");
    render(<CookieConsentBanner />);
    expect(screen.queryByText(/analytics cookies/i)).not.toBeInTheDocument();
  });

  it("does not render on the homepage-demo review path (existing exclusion preserved)", () => {
    usePathnameMock.mockReturnValue("/homepage-demo/review");
    render(<CookieConsentBanner />);
    expect(screen.queryByText(/analytics cookies/i)).not.toBeInTheDocument();
  });

  it("does not render on /admin (existing exclusion preserved)", () => {
    usePathnameMock.mockReturnValue("/admin/analytics");
    render(<CookieConsentBanner />);
    expect(screen.queryByText(/analytics cookies/i)).not.toBeInTheDocument();
  });

  it("still renders normally on an ordinary dashboard/marketing path when no consent choice has been made", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<CookieConsentBanner />);
    expect(screen.getByText(/analytics cookies/i)).toBeInTheDocument();
  });

  it("does not render a path that merely contains 'share' as a substring, only the exact prefix", () => {
    usePathnameMock.mockReturnValue("/shareholder-info");
    render(<CookieConsentBanner />);
    expect(screen.getByText(/analytics cookies/i)).toBeInTheDocument();
  });
});
