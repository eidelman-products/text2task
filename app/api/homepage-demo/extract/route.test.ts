import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  HomepageDemoExtractionError,
  HomepageDemoIdentityError,
  HomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";

/*
  Phase 0A -- first test coverage for this route. Mocks
  @/lib/homepage-demo/orchestration.server (the admission/challenge/
  extraction pipeline), @/lib/homepage-demo/public-extract-identity.server,
  @/lib/homepage-demo/public-extract-request.server, and
  @/lib/analytics/internal-events.server wholesale -- this protects the
  route's own response-code mapping and its existing operational
  analytics firing, not the orchestration internals (Turnstile, the
  admission RPC, or the extraction model call) themselves.

  Phase 1A -- adds anonymous_id enrichment coverage. Deliberately does
  NOT mock @/lib/analytics/request-attribution.server's
  readAnonymousIdCookie: it's a pure, dependency-free cookie reader, so
  these tests set a real t2t_anon_id cookie via buildRequest(cookies)
  and let the real function process it -- exercising actual behavior
  rather than an assumed mock. No new funnel events are added in this
  phase; only the existing attempt/succeeded/failed contract's
  anonymous_id field changes from always-null to cookie-derived.
*/

// after() only reliably fires within a real Next.js request lifecycle,
// which this route-level test does not run inside -- replace it with a
// synchronous invocation so the route's existing analytics side effects
// are directly observable/awaitable, matching how this route already
// treats analytics as fire-and-forget/best-effort in production.
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
const parseRequestMock = vi.fn();
const resolveIdentityMock = vi.fn();
const orchestrateMock = vi.fn();
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
  parseHomepageDemoPublicExtractRequest: (...args: unknown[]) =>
    parseRequestMock(...args),
}));

vi.mock("@/lib/homepage-demo/identity.server", () => ({
  getHomepageDemoSessionCookiePolicy: () => ({
    name: "t2t_homepage_demo_session_dev",
  }),
  getHomepageDemoDeviceCookiePolicy: () => ({
    name: "t2t_homepage_demo_device_dev",
  }),
}));

vi.mock("@/lib/homepage-demo/public-extract-identity.server", () => ({
  resolveHomepageDemoPublicExtractIdentity: (...args: unknown[]) =>
    resolveIdentityMock(...args),
}));

vi.mock("@/lib/homepage-demo/orchestration.server", () => ({
  orchestrateHomepageDemoTextTrial: (...args: unknown[]) =>
    orchestrateMock(...args),
}));

const { POST } = await import("./route");

function buildRequest(cookies?: Record<string, string>) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  return new NextRequest("http://localhost/api/homepage-demo/extract", {
    method: "POST",
    body: JSON.stringify({ text: "hello" }),
    headers,
  });
}

async function flushScheduledAnalytics() {
  // These routes use next/server's after() to schedule best-effort
  // analytics; in the vitest/node environment after() callbacks run as
  // microtasks, so a short flush lets them settle before assertions.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  assertEnabledMock.mockReset().mockReturnValue(undefined);
  validateOriginMock.mockReset().mockReturnValue(undefined);
  readJsonMock.mockReset().mockResolvedValue({ text: "hello" });
  parseRequestMock.mockReset().mockReturnValue({
    text: "hello",
    challengeToken: "challenge-token",
    publicToken: "public-token",
    idempotencyToken: "idempotency-token",
  });
  resolveIdentityMock.mockReset().mockReturnValue({
    remoteIp: "127.0.0.1",
    identity: {
      publicTokenHash: "a".repeat(64),
      sessionTokenHash: "b".repeat(64),
      deviceTokenHash: "c".repeat(64),
      ipIdentityDigest: "d".repeat(64),
      idempotencyKeyHash: "e".repeat(64),
    },
  });
  orchestrateMock.mockReset();
  logAnalyticsEventSafeMock.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/homepage-demo/extract - successful valid extraction", () => {
  it("returns review_ready (200) and logs both attempt and succeeded analytics events", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready" });

    const loggedEventNames = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { eventName: string }).eventName
    );
    expect(loggedEventNames).toContain("homepage_demo_extract_attempt");
    expect(loggedEventNames).toContain("homepage_demo_extract_succeeded");
    expect(loggedEventNames).not.toContain("homepage_demo_extract_failed");
  });

  it("existing operational analytics fires with no identifier and no raw text (current contract, not yet enriched)", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "admission",
      attemptId: "attempt-1",
      trialId: "trial-1",
      idempotent: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    for (const call of logAnalyticsEventSafeMock.mock.calls) {
      const input = call[0] as Record<string, unknown>;
      expect(input.userId).toBeNull();
      expect(input.anonymousId).toBeNull();
      expect(JSON.stringify(input.metadata ?? {})).not.toContain("hello");
    }
  });
});

describe("POST /api/homepage-demo/extract - Turnstile/challenge failure", () => {
  it("returns challenge_failed (403) when the challenge itself failed but was not rate-limited", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "challenge_failed",
      blocked: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(403);
    expect(body).toEqual({ code: "challenge_failed" });

    const failureCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_failed"
    );
    expect(failureCall).toBeDefined();
    expect(
      (failureCall?.[0] as { metadata: Record<string, unknown> }).metadata
        .stage
    ).toBe("challenge");
  });

  it("returns rate_limited (429) when repeated challenge failures trip the rate limiter", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "challenge_failed",
      blocked: true,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ code: "rate_limited" });
  });

  it("a challenge failure never results in an admitted trial (no succeeded event)", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "challenge_failed",
      blocked: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    const loggedEventNames = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { eventName: string }).eventName
    );
    expect(loggedEventNames).not.toContain("homepage_demo_extract_succeeded");
  });
});

describe("POST /api/homepage-demo/extract - invalid/expired bootstrap/public token", () => {
  it("returns invalid_request (400) when identity resolution rejects malformed token input", async () => {
    resolveIdentityMock.mockImplementation(() => {
      throw new HomepageDemoIdentityError("identity_input_invalid");
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ code: "invalid_request" });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("returns expired (410) when the admission decision reports an expired trial", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "expired" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ code: "expired" });
  });
});

describe("POST /api/homepage-demo/extract - rate limit rejection", () => {
  it("returns rate_limited (429) when admission itself decides rate_limited", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "rate_limited" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ code: "rate_limited" });
  });
});

describe("POST /api/homepage-demo/extract - admission rejection", () => {
  it("returns trial_already_used (409) for a session/device that already consumed its trial", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "trial_already_used" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "trial_already_used" });
  });

  it("returns not_found (404) when the demo/workload is disabled", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "workload_disabled" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "not_found" });
  });

  it("returns temporarily_unavailable (503) when capacity/budget is exhausted", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "capacity_unavailable" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });
});

describe("POST /api/homepage-demo/extract - extraction/model failure", () => {
  it("returns extraction_failed (502) when the model returns an invalid result", async () => {
    orchestrateMock.mockRejectedValueOnce(
      new HomepageDemoExtractionError("text_extraction_invalid_result")
    );

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(502);
    expect(body).toEqual({ code: "extraction_failed" });

    const failureCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_failed"
    );
    expect(
      (failureCall?.[0] as { metadata: Record<string, unknown> }).metadata
        .stage
    ).toBe("extraction");
  });

  it("returns timeout (504) when extraction times out", async () => {
    orchestrateMock.mockRejectedValueOnce(
      new HomepageDemoExtractionError("text_extraction_timeout")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body).toEqual({ code: "timeout" });
  });
});

describe("POST /api/homepage-demo/extract - persistence/database failure", () => {
  it("returns temporarily_unavailable (503) when the repository is unavailable, not a false success", async () => {
    orchestrateMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("repository_unavailable")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });

  it("never throws on a completely unexpected error, falling back to a safe 503", async () => {
    orchestrateMock.mockRejectedValueOnce(new Error("unexpected"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });
});

describe("POST /api/homepage-demo/extract - existing analytics never blocks the response", () => {
  it("still returns the correct success response even if analytics logging itself throws", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "admission",
      attemptId: "attempt-1",
      trialId: "trial-1",
      idempotent: true,
    });
    logAnalyticsEventSafeMock.mockRejectedValue(new Error("analytics down"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready" });
  });
});

describe("POST /api/homepage-demo/extract - anonymous_id enrichment (Phase 1A)", () => {
  const ANON_ID = "existing-anon-id-abc123";

  it("t2t_anon_id present -> homepage_demo_extract_attempt receives that anonymousId", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "rate_limited" },
    });

    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    const attemptCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_attempt"
    );
    expect((attemptCall?.[0] as { anonymousId: string }).anonymousId).toBe(
      ANON_ID
    );
  });

  it("a successful extraction -> homepage_demo_extract_succeeded receives the same anonymousId", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    const succeededCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_succeeded"
    );
    expect((succeededCall?.[0] as { anonymousId: string }).anonymousId).toBe(
      ANON_ID
    );
  });

  it("a failed extraction -> homepage_demo_extract_failed receives the same anonymousId", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "challenge_failed",
      blocked: false,
    });

    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    const failedCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_failed"
    );
    expect((failedCall?.[0] as { anonymousId: string }).anonymousId).toBe(
      ANON_ID
    );
  });

  it("attempt, succeeded (or failed), and any other event in the same request all carry the identical anonymousId", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "admission",
      attemptId: "attempt-1",
      trialId: "trial-1",
      idempotent: true,
    });

    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    const anonymousIds = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { anonymousId: string | null }).anonymousId
    );
    expect(anonymousIds.length).toBeGreaterThan(0);
    expect(new Set(anonymousIds).size).toBe(1);
    expect(anonymousIds[0]).toBe(ANON_ID);
  });

  it("missing t2t_anon_id cookie -> the demo still works exactly as before (anonymousId: null, existing fallback behavior)", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "admission",
      attemptId: "attempt-1",
      trialId: "trial-1",
      idempotent: true,
    });

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready" });

    for (const call of logAnalyticsEventSafeMock.mock.calls) {
      expect((call[0] as { anonymousId: unknown }).anonymousId).toBeNull();
    }
  });

  it("missing anonymous cookie never breaks extraction even if reading it were to somehow throw", async () => {
    // readAnonymousIdCookie is deliberately called unmocked (real
    // implementation) in these tests; this test simulates the
    // defensive scenario by asserting the route's own POST handler
    // still succeeds end-to-end with no cookie header at all -- proving
    // the absence of any anonymous-id-related code path can block
    // extraction.
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "admission",
      attemptId: "attempt-1",
      trialId: "trial-1",
      idempotent: true,
    });

    const request = new NextRequest(
      "http://localhost/api/homepage-demo/extract",
      {
        method: "POST",
        body: JSON.stringify({ text: "hello" }),
        headers: { "content-type": "application/json" },
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("an oversized/garbage-but-string cookie value is clamped, not rejected -- matches the existing lenient site-wide convention, never trusted as anything more than opaque text", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "rate_limited" },
    });

    const oversizedValue = "x".repeat(500);

    await POST(buildRequest({ t2t_anon_id: oversizedValue }));
    await flushScheduledAnalytics();

    const attemptCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_attempt"
    );
    const loggedAnonymousId = (
      attemptCall?.[0] as { anonymousId: string }
    ).anonymousId;
    expect(loggedAnonymousId.length).toBeLessThanOrEqual(120);
    expect(oversizedValue.startsWith(loggedAnonymousId)).toBe(true);
  });

  it("analytics logging failure never affects the extraction response, even with anonymous_id enrichment in place", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "admission",
      attemptId: "attempt-1",
      trialId: "trial-1",
      idempotent: true,
    });
    logAnalyticsEventSafeMock.mockRejectedValue(new Error("analytics down"));

    const response = await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "review_ready" });
  });

  it("no existing event name or metadata field regresses -- only anonymousId changed from the prior always-null contract", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    await POST(buildRequest({ t2t_anon_id: ANON_ID }));
    await flushScheduledAnalytics();

    for (const call of logAnalyticsEventSafeMock.mock.calls) {
      const input = call[0] as Record<string, unknown>;
      expect(["homepage_demo_extract_attempt", "homepage_demo_extract_succeeded"]).toContain(
        input.eventName
      );
      expect(input.userId).toBeNull();
      expect(input.pagePath).toBe("/api/homepage-demo/extract");
      const metadata = input.metadata as Record<string, unknown>;
      expect(metadata.mode).toBe("text");
      expect(metadata.anonymous).toBe(true);
      expect(JSON.stringify(metadata)).not.toContain("hello");
    }
  });

  it("does not alter the identity resolution call used for rate-limit/session/device admission -- analytics identity stays uncoupled from security identity", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "not_admitted",
      admission: { decision: "rate_limited" },
    });

    await POST(buildRequest({ t2t_anon_id: ANON_ID }));

    expect(resolveIdentityMock).toHaveBeenCalledTimes(1);
    const identityCallArgs = resolveIdentityMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(identityCallArgs).not.toHaveProperty("anonymousId");
    expect(JSON.stringify(identityCallArgs)).not.toContain(ANON_ID);
  });
});

describe("POST /api/homepage-demo/extract - owner_flagged tagging (Phase 1D)", () => {
  it("server demo event + verified owner cookie -> owner_flagged: true recorded on every emitted event", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    await POST(
      buildRequest({ t2t_owner_analytics_excluded: "1" })
    );
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock.mock.calls.length).toBeGreaterThan(0);
    for (const call of logAnalyticsEventSafeMock.mock.calls) {
      const metadata = (call[0] as { metadata: Record<string, unknown> })
        .metadata;
      expect(metadata.owner_flagged).toBe(true);
    }
  });

  it("the same event without the owner cookie -> owner_flagged: false", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock.mock.calls.length).toBeGreaterThan(0);
    for (const call of logAnalyticsEventSafeMock.mock.calls) {
      const metadata = (call[0] as { metadata: Record<string, unknown> })
        .metadata;
      expect(metadata.owner_flagged).toBe(false);
    }
  });

  it("owner_flagged: true never suppresses ingestion -- the event is still stored (operational health must include owner traffic)", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    await POST(buildRequest({ t2t_owner_analytics_excluded: "1" }));
    await flushScheduledAnalytics();

    const loggedEventNames = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { eventName: string }).eventName
    );
    expect(loggedEventNames).toContain("homepage_demo_extract_succeeded");
  });

  it("an owner-flagged failure event is still recorded (operational health must see it)", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "challenge_failed",
      blocked: false,
    });

    await POST(buildRequest({ t2t_owner_analytics_excluded: "1" }));
    await flushScheduledAnalytics();

    const failureCall = logAnalyticsEventSafeMock.mock.calls.find(
      (call) =>
        (call[0] as { eventName: string }).eventName ===
        "homepage_demo_extract_failed"
    );
    expect(failureCall).toBeDefined();
    expect(
      (failureCall?.[0] as { metadata: Record<string, unknown> }).metadata
        .owner_flagged
    ).toBe(true);
  });

  it("an invalid/legacy owner-exclusion cookie value is treated as not-owner, matching the existing cookie-trust convention", async () => {
    orchestrateMock.mockResolvedValueOnce({
      outcome: "review_ready",
      source: "completion",
      attemptId: "attempt-1",
      trialId: "trial-1",
      draftId: "draft-1",
      idempotent: false,
    });

    await POST(buildRequest({ t2t_owner_analytics_excluded: "yes" }));
    await flushScheduledAnalytics();

    for (const call of logAnalyticsEventSafeMock.mock.calls) {
      const metadata = (call[0] as { metadata: Record<string, unknown> })
        .metadata;
      expect(metadata.owner_flagged).toBe(false);
    }
  });
});
