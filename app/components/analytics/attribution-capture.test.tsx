// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

/*
  Phase 4B -- internal anonymous page_view is now SPA-aware (locked product
  decision: a logical page view, not merely a hard browser load). These
  tests protect the two properties that matter most: (1) every genuine
  pathname change produces exactly one deferred send, keyed by its own
  fresh pageViewId, independent of subsequent navigations; and (2) the
  transport itself (sendBeacon/fetch) behaves exactly as before.

  jsdom does not implement window.requestIdleCallback, so the component's
  own fallback path (window.setTimeout(run, 1200)) is what actually runs
  here -- this is real production fallback behavior, not a test-only stub,
  and is driven deterministically with vitest's fake timers.
*/

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

/*
  NEXT_PUBLIC_TEXT2TASK_INTERNAL_ANALYTICS_ENABLED is read into a top-level
  module constant, evaluated once when the module is first imported --
  exactly like MicrosoftClarity's env-derived constants. The env var must
  therefore be set BEFORE each fresh dynamic import, with the module cache
  reset in between, or every test after the first would silently observe
  whatever value was present at the very first import.
*/
async function importFreshAttributionCapture() {
  process.env.NEXT_PUBLIC_TEXT2TASK_INTERNAL_ANALYTICS_ENABLED = "true";
  vi.resetModules();

  const mod = await import("./attribution-capture");

  return mod.AttributionCapture;
}

const CONSENT_STORAGE_KEY = "text2task:analytics_consent";
const ANONYMOUS_STORAGE_KEY = "text2task:anonymous_id";
const ATTRIBUTION_STORAGE_KEY = "text2task:first_touch_attribution";

function setConsent(choice: "accepted" | "rejected" | null) {
  if (choice === null) {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } else {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  }
}

type CapturedRequest = {
  pagePath: string;
  pageViewId: string;
  eventName: string;
};

function parseBeaconPayload(blob: Blob): Promise<CapturedRequest> {
  return blob.text().then((text) => {
    const parsed = JSON.parse(text);
    return {
      pagePath: parsed.page_path,
      pageViewId: parsed.page_view_id,
      eventName: parsed.event_name,
    };
  });
}

async function flushDeferred() {
  await vi.advanceTimersByTimeAsync(1300);
}

/*
  Updates BOTH the mocked usePathname() return value AND the real
  window.location.pathname (via history.pushState, matching what the real
  Next.js router does on every SPA navigation). This matters specifically
  for the deferred-pathname-race regression tests below: captureAttribution()
  internally calls getSafePath() (a live window.location.pathname read) for
  its own nested attribution.page_path/cookie bookkeeping. If a test only
  mocked usePathname() without ever moving window.location, that internal
  live read would trivially keep matching the closure-captured value by
  coincidence -- masking exactly the class of regression this test exists
  to catch (e.g. a future refactor that accidentally swaps the top-level
  page_path for a live read inside sendPageView itself).
*/
function navigateTo(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  window.history.pushState({}, "", pathname);
}

/*
  jsdom does not implement navigator.sendBeacon at all (the property
  doesn't exist on the object), so vi.spyOn cannot attach to it directly.
  Defining it fresh via Object.defineProperty before each test is the
  correct way to stub a browser API jsdom never implemented.
*/
function stubSendBeacon(returnValue: boolean) {
  const mock = vi.fn().mockReturnValue(returnValue);

  Object.defineProperty(navigator, "sendBeacon", {
    value: mock,
    configurable: true,
    writable: true,
  });

  return mock;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  });
  usePathnameMock.mockReturnValue("/");
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_TEXT2TASK_INTERNAL_ANALYTICS_ENABLED;
});

describe("AttributionCapture - SPA-aware page_view (Phase 4B)", () => {
  it("test 1: initial allowed page load sends exactly one page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    render(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [, blob] = beaconSpy.mock.calls[0] as [string, Blob];
    const parsed = await parseBeaconPayload(blob);
    expect(parsed.pagePath).toBe("/");
    expect(parsed.eventName).toBe("page_view");
    expect(typeof parsed.pageViewId).toBe("string");
    expect(parsed.pageViewId.length).toBeGreaterThan(0);
  });

  it("test 2: / -> /features/client-project-tracker sends a second page_view with a unique pageViewId", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();

    usePathnameMock.mockReturnValue("/features/client-project-tracker");
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(2);
    const first = await parseBeaconPayload(
      beaconSpy.mock.calls[0][1] as Blob
    );
    const second = await parseBeaconPayload(
      beaconSpy.mock.calls[1][1] as Blob
    );
    expect(first.pagePath).toBe("/");
    expect(second.pagePath).toBe("/features/client-project-tracker");
    expect(first.pageViewId).not.toBe(second.pageViewId);
  });

  it("test 3: / -> /dashboard sends a second page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();

    usePathnameMock.mockReturnValue("/dashboard");
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(2);
  });

  it("test 4: Back/Forward pathname transitions each produce one page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();

    usePathnameMock.mockReturnValue("/pricing");
    rerender(<AttributionCapture />); // forward
    await flushDeferred();

    usePathnameMock.mockReturnValue("/"); // back
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(3);
    const paths = await Promise.all(
      beaconSpy.mock.calls.map((call) =>
        parseBeaconPayload(call[1] as Blob).then((p) => p.pagePath)
      )
    );
    expect(paths).toEqual(["/", "/pricing", "/"]);
  });

  it("test 5: query-string-only change (pathname unchanged) sends no additional page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/pricing");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();

    // usePathname() never reflects the query string; a query-only change
    // is therefore not observable to this component at all.
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(1);
  });

  it("test 6: consent unknown sends no page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent(null);
    const beaconSpy = stubSendBeacon(true);

    render(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it("test 7: unknown -> accept sends exactly one page_view for the current page", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent(null);
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/features/ai-task-extractor");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();
    expect(beaconSpy).not.toHaveBeenCalled();

    setConsent("accepted");
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const parsed = await parseBeaconPayload(beaconSpy.mock.calls[0][1] as Blob);
    expect(parsed.pagePath).toBe("/features/ai-task-extractor");
  });

  it("test 8: reject sends zero page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("rejected");
    const beaconSpy = stubSendBeacon(true);

    render(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it("test 9: allowed -> excluded sends no page_view for the excluded route", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();
    expect(beaconSpy).toHaveBeenCalledTimes(1);

    usePathnameMock.mockReturnValue("/admin/analytics");
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(1); // unchanged
  });

  it("test 10: excluded -> allowed sends one new page_view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/admin/analytics");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();
    expect(beaconSpy).not.toHaveBeenCalled();

    usePathnameMock.mockReturnValue("/");
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const parsed = await parseBeaconPayload(beaconSpy.mock.calls[0][1] as Blob);
    expect(parsed.pagePath).toBe("/");
  });

  it("test 11: the same pathname visited again via a later real navigation gets a new pageViewId", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/pricing");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();

    usePathnameMock.mockReturnValue("/");
    rerender(<AttributionCapture />);
    await flushDeferred();

    usePathnameMock.mockReturnValue("/pricing"); // same path, later, real nav
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(3);
    const first = await parseBeaconPayload(beaconSpy.mock.calls[0][1] as Blob);
    const third = await parseBeaconPayload(beaconSpy.mock.calls[2][1] as Blob);
    expect(first.pagePath).toBe("/pricing");
    expect(third.pagePath).toBe("/pricing");
    expect(first.pageViewId).not.toBe(third.pageViewId);
  });

  it("test 12: hard refresh (fresh mount) is recordable as a new page view", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/");
    const { unmount } = render(<AttributionCapture />);
    await flushDeferred();
    unmount();

    // A hard refresh tears down and recreates the whole module/document;
    // simulated here by a fresh mount after unmount.
    render(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(2);
  });

  it("test 13: independent component instances (multiple tabs) get independent pageViewIds", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    usePathnameMock.mockReturnValue("/");
    render(<AttributionCapture />);
    render(<AttributionCapture />); // simulates a second independent mount
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(2);
    const first = await parseBeaconPayload(beaconSpy.mock.calls[0][1] as Blob);
    const second = await parseBeaconPayload(beaconSpy.mock.calls[1][1] as Blob);
    expect(first.pageViewId).not.toBe(second.pageViewId);
  });

  it("test 16: sendBeacon returning true does not also trigger the fetch fallback", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    stubSendBeacon(true);
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    render(<AttributionCapture />);
    await flushDeferred();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("test 17: sendBeacon returning false triggers the fetch fallback exactly once", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    stubSendBeacon(false);
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    render(<AttributionCapture />);
    await flushDeferred();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/analytics/event");
    expect((init as RequestInit).keepalive).toBe(true);
  });

  it("test 18: a transport error never throws or produces an uncaught rejection", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    Object.defineProperty(navigator, "sendBeacon", {
      value: () => {
        throw new Error("simulated beacon failure");
      },
      configurable: true,
      writable: true,
    });

    expect(() => render(<AttributionCapture />)).not.toThrow();
    await expect(flushDeferred()).resolves.not.toThrow();
  });

  it("preserves first-touch attribution across multiple logical page views (does not overwrite UTM on later navigations)", async () => {
    const AttributionCapture = await importFreshAttributionCapture();
    setConsent("accepted");
    const beaconSpy = stubSendBeacon(true);

    // Simulate arriving with UTM params captured on the very first view.
    window.localStorage.setItem(ANONYMOUS_STORAGE_KEY, "anon-fixed-id");
    window.localStorage.setItem(
      ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({
        anonymous_id: "anon-fixed-id",
        utm_source: "peerlist",
        utm_medium: "referral",
        utm_campaign: null,
        utm_content: null,
        referrer: "https://peerlist.io/",
        landing_page: "/?utm_source=peerlist",
        page_path: "/",
        captured_at: "2026-08-01T00:00:00.000Z",
      })
    );

    usePathnameMock.mockReturnValue("/");
    const { rerender } = render(<AttributionCapture />);
    await flushDeferred();

    usePathnameMock.mockReturnValue("/pricing");
    rerender(<AttributionCapture />);
    await flushDeferred();

    expect(beaconSpy).toHaveBeenCalledTimes(2);
    const second = beaconSpy.mock.calls[1][1] as Blob;
    const parsedSecond = JSON.parse(await second.text());
    expect(parsedSecond.attribution.utm_source).toBe("peerlist");
    expect(parsedSecond.attribution.anonymous_id).toBe("anon-fixed-id");
  });

  describe("deferred-pathname race (pre-commit correctness check)", () => {
    it("a fast navigation before either deferred send fires still reports each event's OWN page_path, not the page the visitor ended up on", async () => {
      const AttributionCapture = await importFreshAttributionCapture();
      setConsent("accepted");
      const beaconSpy = stubSendBeacon(true);

      navigateTo("/");
      const { rerender } = render(<AttributionCapture />);
      // Deliberately do NOT flush yet -- page_view A is scheduled but has
      // not sent.

      navigateTo("/features/client-project-tracker");
      rerender(<AttributionCapture />);
      // page_view B is now also scheduled. window.location.pathname is
      // ALREADY "/features/client-project-tracker" at this point -- if
      // sendPageView (or anything in its call chain) read it live instead
      // of using the captured closure value, event A would incorrectly
      // report the new path too.

      // Now flush both deferred sends together.
      await flushDeferred();

      expect(beaconSpy).toHaveBeenCalledTimes(2);
      const first = await parseBeaconPayload(beaconSpy.mock.calls[0][1] as Blob);
      const second = await parseBeaconPayload(
        beaconSpy.mock.calls[1][1] as Blob
      );

      expect(first.pagePath).toBe("/");
      expect(second.pagePath).toBe("/features/client-project-tracker");
      expect(first.pageViewId).not.toBe(second.pageViewId);
    });

    it("/a -> /b -> /c navigated in rapid succession before any deferred send fires still produces three events in exact logical order", async () => {
      const AttributionCapture = await importFreshAttributionCapture();
      setConsent("accepted");
      const beaconSpy = stubSendBeacon(true);

      navigateTo("/a");
      const { rerender } = render(<AttributionCapture />);

      navigateTo("/b");
      rerender(<AttributionCapture />);

      navigateTo("/c");
      rerender(<AttributionCapture />);
      // window.location.pathname is now "/c" for all three -- none of the
      // three deferred sends have fired yet.

      await flushDeferred();

      expect(beaconSpy).toHaveBeenCalledTimes(3);
      const payloads = await Promise.all(
        beaconSpy.mock.calls.map((call) => parseBeaconPayload(call[1] as Blob))
      );

      expect(payloads.map((p) => p.pagePath)).toEqual(["/a", "/b", "/c"]);
      const uniqueIds = new Set(payloads.map((p) => p.pageViewId));
      expect(uniqueIds.size).toBe(3);
    });
  });
});
