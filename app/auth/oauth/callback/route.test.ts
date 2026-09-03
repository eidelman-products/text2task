import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { OWNER_ANALYTICS_EXCLUSION_COOKIE } from "@/lib/analytics/owner-exclusion.server";

const exchangeCodeForSessionMock = vi.fn();
const getUserMock = vi.fn();
const ensureUserMock = vi.fn();
const scheduleSignupAttributionMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        getUser: getUserMock,
      },
    }),
}));

vi.mock("@/lib/supabase/ensureUser", () => ({
  ensureUser: (...args: unknown[]) => ensureUserMock(...args),
}));

vi.mock("@/lib/analytics/signup-attribution.server", () => ({
  scheduleSignupAttribution: (...args: unknown[]) =>
    scheduleSignupAttributionMock(...args),
}));

const { GET } = await import("./route");

const OWNER_EMAIL = "owner@text2task.com";
const NORMAL_EMAIL = "regular-user@example.com";

function buildCallbackRequest(query: string) {
  return new NextRequest(`http://localhost/auth/oauth/callback${query}`);
}

function getSetCookieHeaderFor(response: Response, cookieName: string) {
  const headers = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];

  return headers.find((header) => header.startsWith(`${cookieName}=`));
}

beforeEach(() => {
  exchangeCodeForSessionMock.mockReset();
  getUserMock.mockReset();
  ensureUserMock.mockReset();
  scheduleSignupAttributionMock.mockReset();
  exchangeCodeForSessionMock.mockResolvedValue({ error: null });
  ensureUserMock.mockResolvedValue({ id: "user-1", email: NORMAL_EMAIL, plan: "free" });
  vi.stubEnv("TEXT2TASK_OWNER_EMAILS", OWNER_EMAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /auth/oauth/callback - owner-exclusion cookie", () => {
  it("a verified owner Google OAuth callback sets the owner-exclusion cookie", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "owner-1", email: OWNER_EMAIL } },
      error: null,
    });
    ensureUserMock.mockResolvedValue({ id: "owner-1", email: OWNER_EMAIL, plan: "free" });

    const response = await GET(buildCallbackRequest("?code=valid-code"));

    expect(response.status).toBe(307);
    const setCookie = getSetCookieHeaderFor(
      response,
      OWNER_ANALYTICS_EXCLUSION_COOKIE
    );
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${OWNER_ANALYTICS_EXCLUSION_COOKIE}=1`);
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("a verified normal (non-owner) Google OAuth callback does NOT set the owner-exclusion cookie", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await GET(buildCallbackRequest("?code=valid-code"));

    expect(response.status).toBe(307);
    expect(
      getSetCookieHeaderFor(response, OWNER_ANALYTICS_EXCLUSION_COOKIE)
    ).toBeUndefined();
  });

  it("a failed code exchange never sets the owner-exclusion cookie, even for an owner email", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const response = await GET(buildCallbackRequest("?code=bad-code"));

    expect(
      getSetCookieHeaderFor(response, OWNER_ANALYTICS_EXCLUSION_COOKIE)
    ).toBeUndefined();
  });

  it("a missing code never sets the owner-exclusion cookie", async () => {
    const response = await GET(buildCallbackRequest(""));

    expect(
      getSetCookieHeaderFor(response, OWNER_ANALYTICS_EXCLUSION_COOKIE)
    ).toBeUndefined();
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });
});

describe("GET /auth/oauth/callback - homepage-demo claim intent continuity (Phase 0A)", () => {
  it("a successful callback WITH intent=homepage-demo-claim redirects to the claim continuation route, not /dashboard", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await GET(
      buildCallbackRequest("?code=valid-code&intent=homepage-demo-claim")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/homepage-demo/claim/continue"
    );
    expect(response.headers.get("location")).not.toContain("/dashboard");
  });

  it("Google reporting an error WITH intent=homepage-demo-claim preserves the intent on the /login retry redirect", async () => {
    const response = await GET(
      buildCallbackRequest("?error=access_denied&intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("error=oauth_cancelled");
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("a missing code WITH intent=homepage-demo-claim preserves the intent on the /login retry redirect", async () => {
    const response = await GET(
      buildCallbackRequest("?intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain(
      "error=oauth_callback_failed"
    );
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("a failed code exchange WITH intent=homepage-demo-claim preserves the intent on retry", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const response = await GET(
      buildCallbackRequest("?code=bad-code&intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain(
      "error=oauth_callback_failed"
    );
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("an ensureUser account-link conflict WITH intent=homepage-demo-claim preserves the intent on retry", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });
    ensureUserMock.mockRejectedValue(
      new Error("already linked to another auth identity")
    );

    const response = await GET(
      buildCallbackRequest("?code=valid-code&intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain(
      "error=account_link_conflict"
    );
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("no intent present behaves exactly as before (redirects to /dashboard)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await GET(buildCallbackRequest("?code=valid-code"));

    expect(response.headers.get("location")).toContain("/dashboard");
    expect(response.headers.get("location")).not.toContain(
      "/homepage-demo/claim/continue"
    );
  });
});

describe("GET /auth/oauth/callback - existing behavior preserved", () => {
  it("redirects to the dashboard on a normal successful callback", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL } },
      error: null,
    });

    const response = await GET(buildCallbackRequest("?code=valid-code"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("redirects to /login with oauth_cancelled when Google reports an error", async () => {
    const response = await GET(buildCallbackRequest("?error=access_denied"));

    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("error=oauth_cancelled");
  });

  it("redirects to /login with oauth_callback_failed when the code is missing", async () => {
    const response = await GET(buildCallbackRequest(""));

    expect(response.headers.get("location")).toContain(
      "error=oauth_callback_failed"
    );
  });
});
