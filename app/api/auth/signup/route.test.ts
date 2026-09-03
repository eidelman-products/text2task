import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/*
  Phase 0A -- first test coverage for this route. Focus: the
  homepage-demo claim intent continuity contract (does signup preserve
  ?intent=homepage-demo-claim through to the right destination/email
  redirect), plus baseline existing-behavior preservation so a future
  change can't silently regress normal signup.
*/

const signUpMock = vi.fn();
const ensureUserMock = vi.fn();
const scheduleEmailSignupAttributionCaptureMock = vi.fn();
const scheduleSignupAttributionMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { signUp: signUpMock } }),
}));

vi.mock("@/lib/supabase/ensureUser", () => ({
  ensureUser: (...args: unknown[]) => ensureUserMock(...args),
}));

vi.mock("@/lib/analytics/signup-attribution.server", () => ({
  scheduleEmailSignupAttributionCapture: (...args: unknown[]) =>
    scheduleEmailSignupAttributionCaptureMock(...args),
  scheduleSignupAttribution: (...args: unknown[]) =>
    scheduleSignupAttributionMock(...args),
}));

const { POST } = await import("./route");

const NORMAL_EMAIL = "regular-user@example.com";

function buildSignupRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  signUpMock.mockReset();
  ensureUserMock.mockReset();
  scheduleEmailSignupAttributionCaptureMock.mockReset();
  scheduleSignupAttributionMock.mockReset();
  ensureUserMock.mockResolvedValue({
    id: "user-1",
    email: NORMAL_EMAIL,
    plan: "free",
  });
});

describe("POST /api/auth/signup - homepage-demo claim intent continuity (Phase 0A)", () => {
  it("an immediate-session signup WITH intent=homepage-demo-claim reports the claim continuation destination", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: {} },
      error: null,
    });

    const response = await POST(
      buildSignupRequest({
        email: NORMAL_EMAIL,
        password: "correct-password",
        intent: "homepage-demo-claim",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.needsEmailConfirmation).toBe(false);
    expect(body.destination).toBe("/homepage-demo/claim/continue");
  });

  it("an immediate-session signup WITHOUT intent reports the normal /dashboard destination", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: {} },
      error: null,
    });

    const response = await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.destination).toBe("/dashboard");
  });

  it("an email-confirmation-required signup WITH intent builds an /auth/confirm redirect carrying the intent", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: null },
      error: null,
    });

    const response = await POST(
      buildSignupRequest({
        email: NORMAL_EMAIL,
        password: "correct-password",
        intent: "homepage-demo-claim",
      })
    );
    await response.json();

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            "/auth/confirm?intent=homepage-demo-claim"
          ),
        }),
      })
    );
  });

  it("an email-confirmation-required signup WITHOUT intent builds a normal /auth/confirm?next=... redirect", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: null },
      error: null,
    });

    const response = await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );
    await response.json();

    const emailRedirectTo = (signUpMock.mock.calls[0][0] as {
      options: { emailRedirectTo: string };
    }).options.emailRedirectTo;

    expect(emailRedirectTo).toContain("/auth/confirm");
    expect(emailRedirectTo).not.toContain("intent=homepage-demo-claim");
  });

  it("an invalid/unrecognized intent value is treated exactly like no intent at all", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: {} },
      error: null,
    });

    const response = await POST(
      buildSignupRequest({
        email: NORMAL_EMAIL,
        password: "correct-password",
        intent: "not-a-real-intent",
      })
    );
    const body = await response.json();

    expect(body.destination).toBe("/dashboard");
  });
});

describe("POST /api/auth/signup - existing behavior preserved", () => {
  it("returns 400 for a missing password", async () => {
    const response = await POST(buildSignupRequest({ email: NORMAL_EMAIL }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing email or password");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a password shorter than 6 characters", async () => {
    const response = await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "abc" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Password must be at least 6 characters");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message on signUp failure", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const response = await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("User already registered");
  });

  it("returns 400 for malformed JSON, without throwing", async () => {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing email or password");
  });

  it("calls ensureUser and fires signup_success only for the immediate-session case", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: {} },
      error: null,
    });

    await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );

    expect(ensureUserMock).toHaveBeenCalledWith({
      id: "user-1",
      email: NORMAL_EMAIL,
    });
    expect(scheduleSignupAttributionMock).toHaveBeenCalledTimes(1);
  });

  it("does not call ensureUser or fire signup_success when email confirmation is required", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: null },
      error: null,
    });

    const response = await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );
    const body = await response.json();

    expect(body.needsEmailConfirmation).toBe(true);
    expect(ensureUserMock).not.toHaveBeenCalled();
    expect(scheduleSignupAttributionMock).not.toHaveBeenCalled();
  });

  it("always fires signup_attribution_captured when a user id exists, regardless of confirmation status", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-1", email: NORMAL_EMAIL }, session: null },
      error: null,
    });

    await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );

    expect(scheduleEmailSignupAttributionCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", authFlow: "email_signup" })
    );
  });

  it("never throws even on an unexpected internal error", async () => {
    signUpMock.mockRejectedValue(new Error("unexpected"));

    const response = await POST(
      buildSignupRequest({ email: NORMAL_EMAIL, password: "correct-password" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unexpected error");
  });
});
