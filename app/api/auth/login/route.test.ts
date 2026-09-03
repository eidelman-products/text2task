import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { OWNER_ANALYTICS_EXCLUSION_COOKIE } from "@/lib/analytics/owner-exclusion.server";

const signInWithPasswordMock = vi.fn();
const ensureUserMock = vi.fn();
const logAnalyticsEventSafeMock = vi.fn();

// Phase 0B -- after() only reliably fires within a real Next.js request
// lifecycle, which this route-level test does not run inside; replace
// it with a synchronous invocation so login_success's best-effort
// analytics call is directly observable, matching the equivalent
// convention already established in
// app/api/homepage-demo/extract/route.test.ts.
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

vi.mock("@/lib/analytics/internal-events.server", () => ({
  logAnalyticsEventSafe: (...args: unknown[]) =>
    logAnalyticsEventSafeMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { signInWithPassword: signInWithPasswordMock },
    }),
}));

vi.mock("@/lib/supabase/ensureUser", () => ({
  ensureUser: (...args: unknown[]) => ensureUserMock(...args),
}));

const { POST } = await import("./route");

const OWNER_EMAIL = "owner@text2task.com";
const NORMAL_EMAIL = "regular-user@example.com";

function buildLoginRequest(
  email: string,
  password: string,
  intent?: string,
  cookies?: Record<string, string>
) {
  const formData = new URLSearchParams();
  formData.set("email", email);
  formData.set("password", password);

  if (intent !== undefined) {
    formData.set("intent", intent);
  }

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };

  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: formData.toString(),
    headers,
  });
}

function getSetCookieHeaderFor(response: Response, cookieName: string) {
  const headers = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];

  return headers.find((header) => header.startsWith(`${cookieName}=`));
}

async function flushScheduledAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  signInWithPasswordMock.mockReset();
  ensureUserMock.mockReset();
  logAnalyticsEventSafeMock.mockReset().mockResolvedValue(true);
  ensureUserMock.mockResolvedValue({ id: "user-1", email: NORMAL_EMAIL, plan: "free" });
  vi.stubEnv("TEXT2TASK_OWNER_EMAILS", OWNER_EMAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/login - login_success analytics (Phase 0B)", () => {
  it("fires login_success with the trusted server-derived user id on a successful login", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.eventName).toBe("login_success");
    expect(call.userId).toBe("user-42");
  });

  it("never accepts a client-supplied user id -- the event always uses the authenticated Supabase user id, never form data", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "real-user-id", email: NORMAL_EMAIL } },
      error: null,
    });

    const formData = new URLSearchParams();
    formData.set("email", NORMAL_EMAIL);
    formData.set("password", "correct-password");
    formData.set("user_id", "attacker-supplied-id");
    formData.set("userId", "attacker-supplied-id");

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: formData.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    await POST(request);
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.userId).toBe("real-user-id");
  });

  it("does NOT fire login_success on invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    await POST(buildLoginRequest(NORMAL_EMAIL, "wrong-password"));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("does NOT fire login_success when email confirmation is required", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Email not confirmed" },
    });

    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("uses a 10-second idempotency bucket: two logins in the same bucket produce the same idempotency key", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));
    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));

    vi.useRealTimers();
    await flushScheduledAnalytics();

    const keys = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it("two logins more than 10 seconds apart produce different idempotency keys (both observable as separate logins)", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));
    vi.setSystemTime(new Date("2026-01-01T00:00:15.000Z"));
    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));

    vi.useRealTimers();
    await flushScheduledAnalytics();

    const keys = logAnalyticsEventSafeMock.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("login still succeeds and redirects correctly even if analytics logging itself throws", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });
    logAnalyticsEventSafeMock.mockRejectedValue(new Error("analytics down"));

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("owner-exclusion cookie behavior is unaffected by the new analytics call", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "owner-1", email: OWNER_EMAIL } },
      error: null,
    });

    const response = await POST(
      buildLoginRequest(OWNER_EMAIL, "correct-password")
    );
    await flushScheduledAnalytics();

    const setCookie = getSetCookieHeaderFor(
      response,
      OWNER_ANALYTICS_EXCLUSION_COOKIE
    );
    expect(setCookie).toBeTruthy();
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
  });

  it("homepage-demo claim intent continuation is unaffected by the new analytics call", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password", "homepage-demo-claim")
    );
    await flushScheduledAnalytics();

    expect(response.headers.get("location")).toContain(
      "/homepage-demo/claim/continue"
    );
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/auth/login - login_success anonymous_id + demo_intent enrichment (Phase 1D)", () => {
  it("t2t_anon_id present -> login_success carries that anonymousId", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password", undefined, {
        t2t_anon_id: "anon-login-1",
      })
    );
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.anonymousId).toBe("anon-login-1");
  });

  it("t2t_anon_id absent -> anonymousId is null, login still succeeds", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password")
    );
    await flushScheduledAnalytics();

    expect(response.status).toBe(303);
    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.anonymousId).toBeNull();
  });

  it("a login submitted with the homepage-demo-claim intent -> metadata.demo_intent: true", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    await POST(
      buildLoginRequest(
        NORMAL_EMAIL,
        "correct-password",
        "homepage-demo-claim"
      )
    );
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(call.metadata.demo_intent).toBe(true);
  });

  it("a login without any claim intent -> metadata.demo_intent: false", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(call.metadata.demo_intent).toBe(false);
  });

  it("an unrecognized intent value -> demo_intent: false (not silently treated as a demo journey)", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-42", email: NORMAL_EMAIL } },
      error: null,
    });

    await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password", "not-a-real-intent")
    );
    await flushScheduledAnalytics();

    const call = logAnalyticsEventSafeMock.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(call.metadata.demo_intent).toBe(false);
  });
});

describe("POST /api/auth/login - owner-exclusion cookie", () => {
  it("a verified owner password login sets the owner-exclusion cookie", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "owner-1", email: OWNER_EMAIL } },
      error: null,
    });

    const response = await POST(buildLoginRequest(OWNER_EMAIL, "correct-password"));

    expect(response.status).toBe(303);
    const setCookie = getSetCookieHeaderFor(
      response,
      OWNER_ANALYTICS_EXCLUSION_COOKIE
    );
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${OWNER_ANALYTICS_EXCLUSION_COOKIE}=1`);
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("a verified normal (non-owner) user login does NOT set the owner-exclusion cookie", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));

    expect(response.status).toBe(303);
    expect(
      getSetCookieHeaderFor(response, OWNER_ANALYTICS_EXCLUSION_COOKIE)
    ).toBeUndefined();
  });

  it("a failed login (invalid credentials) never sets the owner-exclusion cookie, even for an owner email", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(buildLoginRequest(OWNER_EMAIL, "wrong-password"));

    expect(response.status).toBe(303);
    expect(
      getSetCookieHeaderFor(response, OWNER_ANALYTICS_EXCLUSION_COOKIE)
    ).toBeUndefined();
  });
});

describe("POST /api/auth/login - homepage-demo claim intent continuity (Phase 0A)", () => {
  it("password login WITH intent=homepage-demo-claim redirects to the claim continuation route, not the normal destination", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password", "homepage-demo-claim")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(
      "/homepage-demo/claim/continue"
    );
    expect(response.headers.get("location")).not.toContain("/dashboard");
  });

  it("a failed login WITH intent=homepage-demo-claim preserves the intent on the /login retry redirect", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "wrong-password", "homepage-demo-claim")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("error=invalid_credentials");
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("an email-not-confirmed failure WITH intent=homepage-demo-claim also preserves the intent on retry", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Email not confirmed" },
    });

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password", "homepage-demo-claim")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(
      "error=email_not_confirmed"
    );
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("an invalid/unrecognized intent value is treated exactly like no intent at all (normal /dashboard destination)", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await POST(
      buildLoginRequest(NORMAL_EMAIL, "correct-password", "not-a-real-intent")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/dashboard");
  });
});

describe("POST /api/auth/login - existing behavior preserved", () => {
  it("redirects to the dashboard on a normal successful login", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await POST(buildLoginRequest(NORMAL_EMAIL, "correct-password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("redirects to /login with an error on invalid credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(buildLoginRequest(NORMAL_EMAIL, "wrong-password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("error=invalid_credentials");
  });

  it("redirects to /login with invalid_credentials for a malformed email, without calling Supabase", async () => {
    const response = await POST(buildLoginRequest("not-an-email", "password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=invalid_credentials");
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("still succeeds even if the owner-exclusion cookie helper is bypassed by an unexpected error", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "owner-1", email: OWNER_EMAIL } },
      error: null,
    });
    ensureUserMock.mockResolvedValue({ id: "owner-1", email: OWNER_EMAIL, plan: "free" });

    const response = await POST(buildLoginRequest(OWNER_EMAIL, "correct-password"));

    // Login must succeed regardless of analytics-cookie outcome.
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).not.toBeNull();
  });
});
