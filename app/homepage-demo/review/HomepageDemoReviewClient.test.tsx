// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomepageDemoReviewClient from "./HomepageDemoReviewClient";

/*
  Phase 1B -- first test coverage for this component. Focus: the
  demo_account_cta_clicked analytics beacon fired from the "Start for
  free"/"Log in" buttons on a genuinely ready review. Does NOT snapshot
  the rendered draft content or exercise the full polling/backoff
  timing behavior in detail -- fetch is mocked to return review_ready
  immediately, so these tests protect the CTA-click contract itself,
  not the (already-existing, untouched) polling mechanics.
*/

const VALID_PUBLIC_TOKEN = "a".repeat(43);
const DRAFT_BODY = {
  title: "Website refresh",
  summary: null,
  clientName: null,
  contactName: null,
  clientEmail: null,
  clientPhone: null,
  clientNotes: null,
  amountText: null,
  amountValue: null,
  currencyCode: null,
  deadlineText: null,
  deadlineDate: null,
  priority: null,
  subtasks: [],
};

/*
  The component reads response.body via a raw ReadableStream reader
  (see readBoundedResponseText in HomepageDemoReviewClient.tsx), which
  a plain `new Response(text)` does not reliably provide a working
  .getReader() for in this jsdom test environment. This builds a
  minimal, fully-controlled stand-in implementing exactly the subset of
  the Response API the component actually calls: .redirected, .status,
  .headers.get(...), and a real one-chunk-then-done reader over the
  encoded JSON bytes.
*/
function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  // Deliberately NOT TextEncoder().encode(): in this vitest/jsdom
  // environment, TextEncoder's output Uint8Array fails `instanceof
  // Uint8Array` checks against the realm's own Uint8Array binding (a
  // known cross-realm quirk -- confirmed empirically: constructor.name
  // and Object.prototype.toString both report "Uint8Array" correctly,
  // but `instanceof` still returns false), which the component's own
  // readBoundedResponseText relies on. Plain Uint8Array construction
  // from char codes does not have this problem and is safe here since
  // every test payload in this file is ASCII-only JSON.
  const text = JSON.stringify(body);
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0));
  const responseHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  let delivered = false;

  return {
    redirected: false,
    status,
    headers: {
      get: (name: string) => responseHeaders[name.toLowerCase()] ?? null,
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (delivered) {
            return { done: true, value: undefined };
          }
          delivered = true;
          return { done: false, value: bytes };
        },
        releaseLock: () => {},
        cancel: async () => {},
      }),
    },
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let assignMock: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

beforeEach(() => {
  assignMock = vi.fn();
  // jsdom's window.location.assign is non-configurable in this
  // environment (vi.spyOn throws "Cannot redefine property"), so the
  // whole location object is replaced for the duration of each test,
  // matching the standard jsdom workaround for asserting on navigation.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, assign: assignMock, hash: "" },
  });

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/homepage-demo/review")) {
      return jsonResponse({ code: "review_ready", draft: DRAFT_BODY });
    }

    if (url.includes("/api/homepage-demo/claim/prepare")) {
      return jsonResponse({ code: "claim_prepared", authenticated: false });
    }

    if (url.includes("/api/analytics/event")) {
      return new Response(null, { status: 204 });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  window.location.hash = `#${VALID_PUBLIC_TOKEN}`;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

function getAnalyticsCalls() {
  return fetchMock.mock.calls.filter(([input]) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    return url.includes("/api/analytics/event");
  });
}

function getAnalyticsRequestBody(callIndex = 0) {
  const call = getAnalyticsCalls()[callIndex];
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("HomepageDemoReviewClient - demo_account_cta_clicked (Phase 1B)", () => {
  it("clicking 'Start for free' on a ready review emits exactly one demo_account_cta_clicked with cta=start_free", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });
    await user.click(startFreeButton);

    await waitFor(() => expect(getAnalyticsCalls()).toHaveLength(1));
    expect(getAnalyticsRequestBody().cta).toBe("start_free");
    expect(getAnalyticsRequestBody().event_name).toBe(
      "demo_account_cta_clicked"
    );
  });

  it("clicking 'Log in' on a ready review emits demo_account_cta_clicked with cta=log_in", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const loginButton = await screen.findByRole("button", { name: "Log in" });
    await user.click(loginButton);

    await waitFor(() => expect(getAnalyticsCalls()).toHaveLength(1));
    expect(getAnalyticsRequestBody().cta).toBe("log_in");
  });

  it("existing claim/prepare behavior still runs after the CTA click", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });
    await user.click(startFreeButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          (typeof input === "string" ? input : (input as URL).toString()).includes(
            "/api/homepage-demo/claim/prepare"
          )
        )
      ).toBe(true)
    );
  });

  it("existing signup/login navigation destinations remain unchanged", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });
    await user.click(startFreeButton);

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    expect(assignMock.mock.calls[0][0]).toBe(
      "/signup?intent=homepage-demo-claim"
    );
  });

  it("a Log in click navigates to the login intent destination", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const loginButton = await screen.findByRole("button", { name: "Log in" });
    await user.click(loginButton);

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    expect(assignMock.mock.calls[0][0]).toBe(
      "/login?intent=homepage-demo-claim"
    );
  });

  it("analytics failure does not block claim prepare/navigation", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/analytics/event")) {
        throw new Error("analytics network failure");
      }
      if (url.includes("/api/homepage-demo/review")) {
        return jsonResponse({ code: "review_ready", draft: DRAFT_BODY });
      }
      if (url.includes("/api/homepage-demo/claim/prepare")) {
        return jsonResponse({ code: "claim_prepared", authenticated: false });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });
    await user.click(startFreeButton);

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    expect(assignMock.mock.calls[0][0]).toBe(
      "/signup?intent=homepage-demo-claim"
    );
  });

  it("no raw review token is placed in analytics metadata -- page_path is the static safe route, not the URL fragment", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });
    await user.click(startFreeButton);

    await waitFor(() => expect(getAnalyticsCalls()).toHaveLength(1));
    const body = getAnalyticsRequestBody();
    expect(body.page_path).toBe("/homepage-demo/review");
    expect(JSON.stringify(body)).not.toContain(VALID_PUBLIC_TOKEN);
  });

  it("no user-generated result data (draft title, etc.) is included in the analytics request", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });
    await user.click(startFreeButton);

    await waitFor(() => expect(getAnalyticsCalls()).toHaveLength(1));
    const body = getAnalyticsRequestBody();
    expect(JSON.stringify(body)).not.toContain(DRAFT_BODY.title);
    expect(Object.keys(body).sort()).toEqual(
      ["cta", "event_name", "page_path"].sort()
    );
  });

  it("the fallback 'Start for free' link on an expired/unavailable review does not fire demo_account_cta_clicked", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/homepage-demo/review")) {
        return jsonResponse({ code: "review_expired" }, 410);
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const fallbackLink = await screen.findByRole("link", {
      name: "Start for free",
    });
    expect(fallbackLink).toHaveAttribute("href", "/signup");
    await user.click(fallbackLink);

    expect(getAnalyticsCalls()).toHaveLength(0);
  });

  it("double-clicking a CTA does not produce a duplicate analytics call or a duplicate claim/prepare call", async () => {
    const user = userEvent.setup();
    render(<HomepageDemoReviewClient />);

    const startFreeButton = await screen.findByRole("button", {
      name: "Start for free",
    });

    await user.click(startFreeButton);
    await user.click(startFreeButton);

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));

    expect(getAnalyticsCalls()).toHaveLength(1);
    const prepareCalls = fetchMock.mock.calls.filter(([input]) =>
      (typeof input === "string" ? input : (input as URL).toString()).includes(
        "/api/homepage-demo/claim/prepare"
      )
    );
    expect(prepareCalls).toHaveLength(1);
  });
});
