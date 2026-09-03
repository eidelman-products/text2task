import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/*
  Phase 0A -- first test coverage for this route. Focus: the
  homepage-demo claim intent continuity contract (email-confirmation
  signup path), plus baseline existing-behavior preservation.
*/

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

const NORMAL_EMAIL = "regular-user@example.com";

function buildConfirmRequest(query: string) {
  return new NextRequest(`http://localhost/auth/confirm${query}`);
}

beforeEach(() => {
  exchangeCodeForSessionMock.mockReset().mockResolvedValue({ error: null });
  getUserMock.mockReset().mockResolvedValue({
    data: { user: { id: "user-1", email: NORMAL_EMAIL } },
    error: null,
  });
  ensureUserMock
    .mockReset()
    .mockResolvedValue({ id: "user-1", email: NORMAL_EMAIL, plan: "free" });
  scheduleSignupAttributionMock.mockReset();
});

describe("GET /auth/confirm - homepage-demo claim intent continuity (Phase 0A)", () => {
  it("a successful confirmation WITH intent=homepage-demo-claim redirects to the claim continuation route", async () => {
    const response = await GET(
      buildConfirmRequest("?code=valid-code&intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain(
      "/homepage-demo/claim/continue"
    );
    expect(response.headers.get("location")).not.toContain("/dashboard");
  });

  it("a successful confirmation WITHOUT intent redirects to the normal next destination", async () => {
    const response = await GET(buildConfirmRequest("?code=valid-code"));

    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("a missing code WITH intent preserves the intent on the /check-email retry redirect", async () => {
    const response = await GET(
      buildConfirmRequest("?intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain("/check-email");
    expect(response.headers.get("location")).toContain("error=invalid_link");
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("a failed code exchange WITH intent preserves the intent on the /check-email retry redirect", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const response = await GET(
      buildConfirmRequest("?code=bad-code&intent=homepage-demo-claim")
    );

    expect(response.headers.get("location")).toContain("/check-email");
    expect(response.headers.get("location")).toContain(
      "error=confirmation_failed"
    );
    expect(response.headers.get("location")).toContain(
      "intent=homepage-demo-claim"
    );
  });

  it("still fires signup_attribution for the email_confirmation auth flow when intent is present", async () => {
    await GET(buildConfirmRequest("?code=valid-code&intent=homepage-demo-claim"));

    expect(scheduleSignupAttributionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        authFlow: "email_confirmation",
      })
    );
  });
});

describe("GET /auth/confirm - existing behavior preserved", () => {
  it("redirects to /login?error=invalid_confirmation_link for a missing code on the password-reset path", async () => {
    const response = await GET(
      buildConfirmRequest("?next=%2Freset-password")
    );

    expect(response.headers.get("location")).toContain(
      "error=invalid_confirmation_link"
    );
  });

  it("redirects to /login with confirmation_failed when ensureUser throws", async () => {
    ensureUserMock.mockRejectedValueOnce(new Error("db error"));

    const response = await GET(buildConfirmRequest("?code=valid-code"));

    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain(
      "error=confirmation_failed"
    );
  });

  it("redirects to /login with confirmation_failed when getUser fails after a successful exchange", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "no user" } });

    const response = await GET(buildConfirmRequest("?code=valid-code"));

    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain(
      "error=confirmation_failed"
    );
  });
});
