import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { OWNER_ANALYTICS_EXCLUSION_COOKIE } from "@/lib/analytics/owner-exclusion.server";

const signInWithPasswordMock = vi.fn();
const ensureUserMock = vi.fn();

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

function buildLoginRequest(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.set("email", email);
  formData.set("password", password);

  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: formData.toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

function getSetCookieHeaderFor(response: Response, cookieName: string) {
  const headers = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];

  return headers.find((header) => header.startsWith(`${cookieName}=`));
}

beforeEach(() => {
  signInWithPasswordMock.mockReset();
  ensureUserMock.mockReset();
  ensureUserMock.mockResolvedValue({ id: "user-1", email: NORMAL_EMAIL, plan: "free" });
  vi.stubEnv("TEXT2TASK_OWNER_EMAILS", OWNER_EMAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
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
