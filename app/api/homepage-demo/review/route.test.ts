import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  HomepageDemoIdentityError,
  HomepageDemoPublicRequestError,
  HomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";

/*
  Phase 0A -- first test coverage for this route (the one the review
  page polls while extraction finishes). Mocks every
  @/lib/homepage-demo/* import wholesale, matching the sibling
  claim/prepare, claim/save, and extract route test files. Protects
  only the current review_ready/review_pending/review_expired/
  review_unavailable contract.

  Phase 1B -- adds demo_review_viewed coverage. Mocks
  @/lib/analytics/internal-events.server (matching the extract route's
  own test convention) and next/server's after() the same way
  extract/route.test.ts does. Deliberately does NOT mock
  readAnonymousIdCookie (@/lib/analytics/request-attribution.server):
  it's a pure, dependency-free cookie reader, so these tests set a real
  t2t_anon_id cookie and exercise the real implementation.
*/

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void callback();
    },
  };
});

const assertEnabledMock = vi.fn();
const validateOriginMock = vi.fn();
const readJsonMock = vi.fn();
const parseReviewRequestMock = vi.fn();
const resolveIdentityMock = vi.fn();
const getReviewDraftMock = vi.fn();
const createPublicReviewPayloadMock = vi.fn();
const logAnalyticsEventSafeMock = vi.fn();

vi.mock("@/lib/analytics/internal-events.server", () => ({
  logAnalyticsEventSafe: (...args: unknown[]) =>
    logAnalyticsEventSafeMock(...args),
}));

vi.mock("@/lib/homepage-demo/public-extract-request.server", () => ({
  assertHomepageDemoPublicExtractEnabled: (...args: unknown[]) =>
    assertEnabledMock(...args),
  validateHomepageDemoPublicRequestOrigin: (...args: unknown[]) =>
    validateOriginMock(...args),
  readHomepageDemoPublicExtractRequestJson: (...args: unknown[]) =>
    readJsonMock(...args),
}));

vi.mock("@/lib/homepage-demo/public-review-request.server", () => ({
  parseHomepageDemoPublicReviewRequest: (...args: unknown[]) =>
    parseReviewRequestMock(...args),
}));

vi.mock("@/lib/homepage-demo/identity.server", () => ({
  getHomepageDemoSessionCookiePolicy: () => ({
    name: "t2t_homepage_demo_session_dev",
  }),
}));

vi.mock("@/lib/homepage-demo/public-review-identity.server", () => ({
  resolveHomepageDemoPublicReviewIdentity: (...args: unknown[]) =>
    resolveIdentityMock(...args),
}));

vi.mock("@/lib/homepage-demo/review-repository.server", () => ({
  getHomepageDemoReviewDraft: (...args: unknown[]) =>
    getReviewDraftMock(...args),
}));

vi.mock("@/lib/homepage-demo/review-payload.server", () => ({
  createHomepageDemoPublicReviewPayload: (...args: unknown[]) =>
    createPublicReviewPayloadMock(...args),
}));

const { POST } = await import("./route");

const DRAFT_PAYLOAD = { title: "Demo project", tasks: [] };
const DRAFT_ID = "44444444-4444-4444-8444-444444444444";

function buildRequest(cookies?: Record<string, string>) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  return new NextRequest("http://localhost/api/homepage-demo/review", {
    method: "POST",
    body: JSON.stringify({ publicToken: "public-token" }),
    headers,
  });
}

async function flushScheduledAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  assertEnabledMock.mockReset().mockReturnValue(undefined);
  validateOriginMock.mockReset().mockReturnValue(undefined);
  readJsonMock.mockReset().mockResolvedValue({ publicToken: "public-token" });
  parseReviewRequestMock
    .mockReset()
    .mockReturnValue({ publicToken: "public-token" });
  resolveIdentityMock.mockReset().mockReturnValue({
    publicTokenHash: "a".repeat(64),
    sessionTokenHash: "b".repeat(64),
  });
  getReviewDraftMock
    .mockReset()
    .mockResolvedValue({ trialId: "trial-1", draftId: DRAFT_ID });
  createPublicReviewPayloadMock.mockReset().mockReturnValue(DRAFT_PAYLOAD);
  logAnalyticsEventSafeMock.mockReset().mockResolvedValue(true);
});

describe("POST /api/homepage-demo/review - review_ready", () => {
  it("returns 200 with the sanitized public draft payload", async () => {
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready", draft: DRAFT_PAYLOAD });
  });

  it("passes the resolved public/session token hashes through to the repository lookup, not raw tokens", async () => {
    await POST(buildRequest());

    expect(getReviewDraftMock).toHaveBeenCalledWith({
      publicTokenHash: "a".repeat(64),
      sessionTokenHash: "b".repeat(64),
    });
  });
});

describe("POST /api/homepage-demo/review - review_pending", () => {
  it("returns 202 review_not_ready while extraction is still in progress", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("review_not_ready")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ code: "review_not_ready" });
  });
});

describe("POST /api/homepage-demo/review - review_expired", () => {
  it("returns 410 when the review has expired", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("review_expired")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ code: "review_expired" });
  });

  it("also maps a plain trial_expired repository error to review_expired", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_expired")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ code: "review_expired" });
  });
});

describe("POST /api/homepage-demo/review - review_unavailable", () => {
  it("returns 404 when the trial/draft cannot be found", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_not_found")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "review_unavailable" });
  });

  it("returns 404 review_unavailable when access is denied (token/session mismatch)", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("review_access_denied")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "review_unavailable" });
  });
});

describe("POST /api/homepage-demo/review - invalid token", () => {
  it("returns 404 review_unavailable when identity resolution rejects malformed input", async () => {
    resolveIdentityMock.mockImplementation(() => {
      throw new HomepageDemoIdentityError("identity_input_invalid");
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "review_unavailable" });
    expect(getReviewDraftMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/homepage-demo/review - malformed request", () => {
  it("returns 400 invalid_request_body when the JSON body cannot be parsed", async () => {
    readJsonMock.mockRejectedValueOnce(
      new HomepageDemoPublicRequestError("invalid_request_body")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ code: "invalid_request_body" });
  });

  it("never throws even on a completely unexpected error, falling back to a safe 503", async () => {
    getReviewDraftMock.mockRejectedValueOnce(new Error("unexpected"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });
});

describe("POST /api/homepage-demo/review - demo_review_viewed (Phase 1B)", () => {
  const ANON_ID = "existing-anon-id-abc123";

  it("a valid ready review emits exactly one demo_review_viewed event", async () => {
    await POST(buildRequest());
    await flushScheduledAnalytics();

    const calls = logAnalyticsEventSafeMock.mock.calls.filter(
      (call) =>
        (call[0] as { eventName: string }).eventName === "demo_review_viewed"
    );
    expect(calls).toHaveLength(1);
  });

  it("anonymous cookie present -> the same value is used as anonymousId", async () => {
    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.anonymousId).toBe(ANON_ID);
  });

  it("anonymous cookie absent -> the event safely uses null and the review still succeeds", async () => {
    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready", draft: DRAFT_PAYLOAD });

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.anonymousId).toBeNull();
  });

  it("review_not_ready -> demo_review_viewed is NOT emitted", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("review_not_ready")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("review_expired -> demo_review_viewed is NOT emitted", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("review_expired")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("review_unavailable -> demo_review_viewed is NOT emitted", async () => {
    getReviewDraftMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_not_found")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an invalid/malformed request -> demo_review_viewed is NOT emitted", async () => {
    readJsonMock.mockRejectedValueOnce(
      new HomepageDemoPublicRequestError("invalid_request_body")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("repeated ready polling/requests for the same draft use the identical idempotency key (analytics-layer dedup, not a route-level count)", async () => {
    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(3);
    const keys = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey
    );
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(`demo_review_viewed:${DRAFT_ID}`);
  });

  it("a refresh-equivalent repeated call (fresh request, same draft) produces the same idempotency key", async () => {
    await POST(buildRequest());
    const first = (logAnalyticsEventSafeMock.mock.calls[0][0] as {
      idempotencyKey: string;
    }).idempotencyKey;

    logAnalyticsEventSafeMock.mockClear();
    await POST(buildRequest());
    const second = (logAnalyticsEventSafeMock.mock.calls[0][0] as {
      idempotencyKey: string;
    }).idempotencyKey;

    expect(first).toBe(second);
  });

  it("a different draft produces a different idempotency key (no cross-draft collision)", async () => {
    getReviewDraftMock.mockResolvedValueOnce({
      trialId: "trial-1",
      draftId: DRAFT_ID,
    });
    await POST(buildRequest());
    const first = (logAnalyticsEventSafeMock.mock.calls[0][0] as {
      idempotencyKey: string;
    }).idempotencyKey;

    logAnalyticsEventSafeMock.mockClear();
    getReviewDraftMock.mockResolvedValueOnce({
      trialId: "trial-2",
      draftId: "55555555-5555-4555-8555-555555555555",
    });
    await POST(buildRequest());
    const second = (logAnalyticsEventSafeMock.mock.calls[0][0] as {
      idempotencyKey: string;
    }).idempotencyKey;

    expect(first).not.toBe(second);
  });

  it("analytics logger failure never affects the review response", async () => {
    logAnalyticsEventSafeMock.mockRejectedValue(new Error("analytics down"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready", draft: DRAFT_PAYLOAD });
  });

  it("pagePath is the safe static route constant -- never the URL hash/bearer material", async () => {
    await POST(buildRequest());
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.pagePath).toBe("/api/homepage-demo/review");
    expect(String(call.pagePath)).not.toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("event userId remains null", async () => {
    await POST(buildRequest());
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.userId).toBeNull();
  });
});

describe("POST /api/homepage-demo/review - owner_flagged tagging (Phase 1D)", () => {
  it("verified owner cookie present -> owner_flagged: true, event still stored", async () => {
    await POST(buildRequest({ t2t_owner_analytics_excluded: "1" }));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(call.metadata.owner_flagged).toBe(true);
  });

  it("no owner cookie -> owner_flagged: false", async () => {
    await POST(buildRequest());
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(call.metadata.owner_flagged).toBe(false);
  });
});
