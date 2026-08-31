// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

/*
  Phase 3A -- Microsoft Clarity implementation tests (SEO/analytics
  blueprint: Analytics Phase 3A code record). Covers the two things Phase
  1/2's read-only audits flagged as unverified: (1) whether the inline
  installer can be inserted more than once per document across React
  remounts and tracked -> excluded -> tracked path transitions, and (2)
  whether the new ConsentV2 signaling matches Microsoft's documented casing
  exactly (ad_Storage / analytics_Storage, capital "S").

  Module state (the `clarityLoaderInserted` guard and the two top-level
  env-derived constants) is intentionally module-scoped, not React state --
  that's the whole point of the fix. Each test therefore needs a genuinely
  fresh module instance, matching a fresh page load, via vi.resetModules()
  + a fresh dynamic import. Tests that specifically prove "no duplicate
  across remounts/navigation" deliberately reuse ONE imported instance
  across multiple render/rerender/unmount calls within themselves.
*/

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const CONSENT_STORAGE_KEY = "text2task:analytics_consent";
const CLARITY_SCRIPT_SELECTOR = 'script[src*="clarity.ms/tag/"]';

function setConsent(choice: "accepted" | "rejected" | null) {
  if (choice === null) {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } else {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  }
}

function countClarityScripts() {
  return document.querySelectorAll(CLARITY_SCRIPT_SELECTOR).length;
}

/*
  window.clarity, once installed by our own insertClarityLoaderOnce, is the
  Microsoft-documented queue function: it pushes every call's arguments into
  window.clarity.q rather than doing anything itself (the real clarity.js,
  once loaded, drains that queue). Asserting against .q is therefore the
  correct way to observe "what did our code tell Clarity to do", without
  needing the real network script. Pre-assigning our own mock function to
  window.clarity before render would instead trip the "reuse window.clarity
  if it already exists" guard and is deliberately exercised separately.
*/
function getClarityQueueCalls(): unknown[][] {
  return (window.clarity?.q ?? []) as unknown[][];
}

async function importFreshMicrosoftClarity() {
  vi.resetModules();

  const mod = await import("./microsoft-clarity");

  return mod;
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = `${CONSENT_STORAGE_KEY}=; Max-Age=0; Path=/`;
  document.head.innerHTML = "";
  usePathnameMock.mockReturnValue("/");
  process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID = "test-project-id";
  delete process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE;
  window.clarity = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.head.innerHTML = "";
  window.clarity = undefined;
  delete process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID;
  delete process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE;
});

describe("MicrosoftClarity - early mode OFF (production default)", () => {
  it("test 1: fresh user, no choice -> Clarity does not initialize", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent(null);

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(0);
    expect(window.clarity).toBeUndefined();
  });

  it("test 2: accept -> Clarity initializes exactly once with analytics granted / ad denied", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    expect(typeof window.clarity).toBe("function");

    const consentCall = getClarityQueueCalls().find(
      (call) => call[0] === "consentv2"
    );
    expect(consentCall).toBeDefined();
    expect(consentCall?.[1]).toEqual({
      ad_Storage: "denied",
      analytics_Storage: "granted",
    });
  });

  it("test 3: reject -> Clarity does not initialize", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("rejected");

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(0);
  });

  it("test 4: returning accepted visitor -> Clarity initializes once with proper consent state", async () => {
    setConsent("accepted");
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
  });

  it("test 5: returning rejected visitor -> Clarity does not initialize", async () => {
    setConsent("rejected");
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(0);
  });

  it("test 6: re-render does not duplicate the installer", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    const { rerender } = render(<MicrosoftClarity />);
    rerender(<MicrosoftClarity />);
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
  });

  it("test 7: React remount (unmount + mount again) does not duplicate the installer", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    const { unmount } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(1);

    unmount();
    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
  });

  it("test 8: SPA route transition between two tracked paths does not duplicate the installer", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(1);

    usePathnameMock.mockReturnValue("/pricing");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
  });

  it("test 9: tracked -> excluded -> tracked path transition does not insert a duplicate loader, AND actively stops/resumes collection", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(1);
    expect(
      getClarityQueueCalls().some(
        (call) =>
          call[0] === "consentv2" &&
          (call[1] as { analytics_Storage?: string })?.analytics_Storage ===
            "granted"
      )
    ).toBe(true);

    usePathnameMock.mockReturnValue("/admin/analytics");
    rerender(<MicrosoftClarity />);
    // Initialization must not duplicate...
    expect(countClarityScripts()).toBe(1);
    // ...but active collection must actually stop, not merely "not
    // re-initialize" -- window.clarity, once loaded, keeps running unless
    // explicitly told to stop.
    expect(
      getClarityQueueCalls().some(
        (call) => call[0] === "consent" && call[1] === false
      )
    ).toBe(true);

    usePathnameMock.mockReturnValue("/");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    // Returning to a tracked path with a saved "accepted" choice must
    // resume normal tracking via the documented consent API.
    const consentCallsAfterReturn = getClarityQueueCalls().filter(
      (call) => call[0] === "consentv2"
    );
    expect(consentCallsAfterReturn.at(-1)?.[1]).toEqual({
      ad_Storage: "denied",
      analytics_Storage: "granted",
    });
  });

  it("test 10: missing Clarity project ID -> no exception, no script inserted", async () => {
    delete process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID;
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    expect(() => render(<MicrosoftClarity />)).not.toThrow();
    expect(countClarityScripts()).toBe(0);
  });

  it("test 13: repeated consent-change events do not duplicate the installer", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(1);

    for (let i = 0; i < 3; i += 1) {
      window.dispatchEvent(new Event("text2task:analytics-consent-change"));
      rerender(<MicrosoftClarity />);
    }

    expect(countClarityScripts()).toBe(1);
  });

  it("test 14: early-mode flag defaults to OFF (unset env var behaves identically to explicit false)", async () => {
    delete process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE;
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent(null);

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(0);
  });
});

describe("MicrosoftClarity - installer/consent helper isolation (test 11, 12)", () => {
  it("test 11: DOM insertion failure is swallowed, application remains functional", async () => {
    const { insertClarityLoaderOnce } = await importFreshMicrosoftClarity();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "script") {
          throw new Error("simulated DOM failure");
        }
        return originalCreateElement(tag);
      });

    expect(() => insertClarityLoaderOnce("test-project-id")).not.toThrow();

    createElementSpy.mockRestore();
  });

  it("test 12: calling the consent signal while window.clarity is unavailable does not throw", async () => {
    const { sendClarityConsentSignal, revokeClarityConsent } =
      await importFreshMicrosoftClarity();

    window.clarity = undefined;

    expect(() => sendClarityConsentSignal(true)).not.toThrow();
    expect(() => revokeClarityConsent()).not.toThrow();
  });
});

describe("MicrosoftClarity - early mode ON (future path, testable but not production-default)", () => {
  it("test 15a: unknown consent + early mode ON -> Clarity loads with analytics denied / ad denied", async () => {
    process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE = "true";
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent(null);

    render(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    const consentCall = getClarityQueueCalls().find(
      (call) => call[0] === "consentv2"
    );
    expect(consentCall?.[1]).toEqual({
      ad_Storage: "denied",
      analytics_Storage: "denied",
    });
  });

  it("test 15b: accept + early mode ON -> analytics transitions to granted, ad stays denied", async () => {
    process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE = "true";
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent(null);

    const { rerender } = render(<MicrosoftClarity />);

    setConsent("accepted");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    const consentCalls = getClarityQueueCalls().filter(
      (call) => call[0] === "consentv2"
    );
    const lastCall = consentCalls.at(-1);
    expect(lastCall?.[1]).toEqual({
      ad_Storage: "denied",
      analytics_Storage: "granted",
    });
  });

  it("test 15c: explicit rejection after early-mode load calls the documented revoke API", async () => {
    process.env.NEXT_PUBLIC_CLARITY_EARLY_NO_CONSENT_MODE = "true";
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent(null);

    const { rerender } = render(<MicrosoftClarity />);

    setConsent("rejected");
    rerender(<MicrosoftClarity />);

    const revokeCall = getClarityQueueCalls().find(
      (call) => call[0] === "consent" && call[1] === false
    );
    expect(revokeCall).toBeDefined();
  });
});

/*
  Phase 3A.1 -- excluded routes must mean zero active Clarity collection,
  not merely "no new initialization" (production-safety review finding).
  Every test here asserts on window.clarity.q content (what our code
  actually told Clarity to do), not just on script-tag presence, per the
  explicit requirement that initialization-only assertions are insufficient.
*/
describe("MicrosoftClarity - Phase 3A.1: active collection state on excluded routes", () => {
  it("scenario 2: /  -> /share/test stops active collection, no second loader", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(1);

    usePathnameMock.mockReturnValue("/share/test");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    expect(
      getClarityQueueCalls().some(
        (call) => call[0] === "consent" && call[1] === false
      )
    ).toBe(true);
  });

  it("scenario 3: /share/test -> / restores accepted consent state, ad_Storage stays denied, no duplicate loader", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);

    usePathnameMock.mockReturnValue("/share/test");
    rerender(<MicrosoftClarity />);

    usePathnameMock.mockReturnValue("/");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    const lastConsentCall = getClarityQueueCalls()
      .filter((call) => call[0] === "consentv2")
      .at(-1);
    expect(lastConsentCall?.[1]).toEqual({
      ad_Storage: "denied",
      analytics_Storage: "granted",
    });
  });

  it("scenario 4: / -> /admin stops tracking", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);

    usePathnameMock.mockReturnValue("/admin");
    rerender(<MicrosoftClarity />);

    expect(
      getClarityQueueCalls().some(
        (call) => call[0] === "consent" && call[1] === false
      )
    ).toBe(true);
  });

  it("scenario 5a: /admin -> / resumes tracking only when saved consent is accepted", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/admin");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(0);

    usePathnameMock.mockReturnValue("/");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(1);
    expect(
      getClarityQueueCalls().some(
        (call) =>
          call[0] === "consentv2" &&
          (call[1] as { analytics_Storage?: string })?.analytics_Storage ===
            "granted"
      )
    ).toBe(true);
  });

  it("scenario 5b: /admin -> / does NOT resume tracking when saved consent is rejected", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("rejected");

    usePathnameMock.mockReturnValue("/admin");
    const { rerender } = render(<MicrosoftClarity />);

    usePathnameMock.mockReturnValue("/");
    rerender(<MicrosoftClarity />);

    expect(countClarityScripts()).toBe(0);
  });

  it("scenario 6: / -> /homepage-demo/review stops tracking", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);

    usePathnameMock.mockReturnValue("/homepage-demo/review");
    rerender(<MicrosoftClarity />);

    expect(
      getClarityQueueCalls().some(
        (call) => call[0] === "consent" && call[1] === false
      )
    ).toBe(true);
  });

  it("scenario 7: direct hard load on /share/test or /admin never initializes Clarity", async () => {
    for (const excludedPath of ["/share/test", "/admin", "/admin/analytics"]) {
      const { MicrosoftClarity } = await importFreshMicrosoftClarity();
      setConsent("accepted");
      usePathnameMock.mockReturnValue(excludedPath);

      const { unmount } = render(<MicrosoftClarity />);

      expect(countClarityScripts()).toBe(0);
      expect(window.clarity).toBeUndefined();

      unmount();
      document.head.innerHTML = "";
      window.clarity = undefined;
    }
  });

  it("scenario 8: rejected user entering and leaving excluded routes never starts Clarity", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("rejected");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(0);

    usePathnameMock.mockReturnValue("/share/test");
    rerender(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(0);

    usePathnameMock.mockReturnValue("/");
    rerender(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(0);
  });

  it("scenario 9: unknown consent, early mode OFF, never starts Clarity regardless of route", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent(null);

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(0);

    usePathnameMock.mockReturnValue("/share/test");
    rerender(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(0);
  });

  it("scenario 10: multiple excluded-route round trips insert no duplicate loader and leak no tracking", async () => {
    const { MicrosoftClarity } = await importFreshMicrosoftClarity();
    setConsent("accepted");

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<MicrosoftClarity />);
    expect(countClarityScripts()).toBe(1);

    const roundTrips = ["/admin", "/", "/share/a", "/", "/share/b", "/"];
    for (const path of roundTrips) {
      usePathnameMock.mockReturnValue(path);
      rerender(<MicrosoftClarity />);
    }

    expect(countClarityScripts()).toBe(1);

    // roundTrips ends back on "/" (tracked), so the final state must be
    // "resumed", not "stopped".
    const lastConsentCall = getClarityQueueCalls()
      .filter((call) => call[0] === "consentv2")
      .at(-1);
    expect(lastConsentCall?.[1]).toEqual({
      ad_Storage: "denied",
      analytics_Storage: "granted",
    });
  });
});
