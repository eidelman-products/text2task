import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  HomepageDemoIdentityError,
  HomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";

/*
  Phase 0A -- first test coverage for this route. Mocks every
  @/lib/homepage-demo/* and @/lib/supabase/server import wholesale
  (matching this repo's established convention, e.g.
  app/api/analytics/event/route.test.ts) so these tests protect only
  this route's own request-parsing/branching/response-mapping logic,
  not the internals of the repository/identity helpers themselves.
*/

const assertEnabledMock = vi.fn();
const validateOriginMock = vi.fn();
const readJsonMock = vi.fn();
const parseRequestMock = vi.fn();
const resolveIdentityMock = vi.fn();
const readClaimCookieMock = vi.fn();
const prepareClaimMock = vi.fn();
const createClaimAuthorityMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/homepage-demo/public-extract-request.server", () => ({
  assertHomepageDemoPublicExtractEnabled: (...args: unknown[]) =>
    assertEnabledMock(...args),
  validateHomepageDemoPublicRequestOrigin: (...args: unknown[]) =>
    validateOriginMock(...args),
}));

vi.mock("@/lib/homepage-demo/claim-request.server", () => ({
  readHomepageDemoClaimPrepareRequestJson: (...args: unknown[]) =>
    readJsonMock(...args),
  parseHomepageDemoClaimPrepareRequest: (...args: unknown[]) =>
    parseRequestMock(...args),
}));

vi.mock("@/lib/homepage-demo/identity.server", () => ({
  getHomepageDemoSessionCookiePolicy: () => ({
    name: "t2t_homepage_demo_session_dev",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 3600,
  }),
}));

vi.mock("@/lib/homepage-demo/public-review-identity.server", () => ({
  resolveHomepageDemoPublicReviewIdentity: (...args: unknown[]) =>
    resolveIdentityMock(...args),
}));

vi.mock("@/lib/homepage-demo/claim-identity.server", () => ({
  createHomepageDemoClaimAuthority: (...args: unknown[]) =>
    createClaimAuthorityMock(...args),
  readHomepageDemoClaimCookie: (...args: unknown[]) =>
    readClaimCookieMock(...args),
  getHomepageDemoClaimCookiePolicy: (maxAge: number) => ({
    name: "t2t_homepage_demo_claim_dev",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge,
  }),
}));

vi.mock("@/lib/homepage-demo/claim-repository.server", () => ({
  prepareHomepageDemoPendingClaim: (...args: unknown[]) =>
    prepareClaimMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const { POST } = await import("./route");

const VALID_TOKEN_HASH_A =
  "a".repeat(64);
const VALID_TOKEN_HASH_B = "b".repeat(64);

function buildRequest(cookies?: Record<string, string>) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  return new NextRequest("http://localhost/api/homepage-demo/claim/prepare", {
    method: "POST",
    body: JSON.stringify({}),
    headers,
  });
}

beforeEach(() => {
  assertEnabledMock.mockReset().mockReturnValue(undefined);
  validateOriginMock.mockReset().mockReturnValue(undefined);
  readJsonMock.mockReset().mockResolvedValue({});
  parseRequestMock.mockReset().mockReturnValue({ publicToken: "public-token" });
  resolveIdentityMock.mockReset().mockReturnValue({
    publicTokenHash: VALID_TOKEN_HASH_A,
    sessionTokenHash: VALID_TOKEN_HASH_B,
  });
  readClaimCookieMock.mockReset().mockReturnValue(null);
  prepareClaimMock.mockReset();
  createClaimAuthorityMock.mockReset().mockReturnValue({
    rawToken: "raw-claim-token",
    tokenHash: "c".repeat(64),
  });
  getUserMock.mockReset().mockResolvedValue({ data: { user: null }, error: null });
});

describe("POST /api/homepage-demo/claim/prepare - valid claim preparation", () => {
  it("issues the claim cookie and returns claim_prepared for a fresh trial with no existing claim authority", async () => {
    prepareClaimMock
      .mockResolvedValueOnce({ action: "needs_claim_authority" })
      .mockResolvedValueOnce({
        action: "set_cookie",
        code: "claim_prepared",
        cookieMaxAgeSeconds: 1200,
      });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "claim_prepared", authenticated: false });

    const setCookie = response.cookies.get("t2t_homepage_demo_claim_dev");
    expect(setCookie?.value).toBe("raw-claim-token");
    expect(setCookie?.maxAge).toBe(1200);
  });

  it("does not create a new claim authority when one already exists for this trial (action: none)", async () => {
    prepareClaimMock.mockResolvedValueOnce({
      action: "none",
      code: "claim_prepared",
      cookieMaxAgeSeconds: null,
    });

    const response = await POST(
      buildRequest({ t2t_homepage_demo_claim_dev: "existing-claim-token" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "claim_prepared", authenticated: false });
    expect(createClaimAuthorityMock).not.toHaveBeenCalled();
    expect(response.cookies.get("t2t_homepage_demo_claim_dev")).toBeUndefined();
  });

  it("modifies no other cookie/state beyond the claim cookie on success", async () => {
    prepareClaimMock
      .mockResolvedValueOnce({ action: "needs_claim_authority" })
      .mockResolvedValueOnce({
        action: "set_cookie",
        code: "claim_prepared",
        cookieMaxAgeSeconds: 1200,
      });

    const response = await POST(buildRequest());

    const allSetCookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [];
    expect(allSetCookies).toHaveLength(1);
  });
});

describe("POST /api/homepage-demo/claim/prepare - invalid token/public identity", () => {
  it("rejects safely when identity resolution reports invalid input, creating no claim capability", async () => {
    resolveIdentityMock.mockImplementation(() => {
      throw new HomepageDemoIdentityError("identity_input_invalid");
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ code: "invalid_request" });
    expect(prepareClaimMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/homepage-demo/claim/prepare - expired trial/draft", () => {
  it("rejects with expired and creates no claim capability", async () => {
    prepareClaimMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_expired")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ code: "expired" });
    expect(response.cookies.get("t2t_homepage_demo_claim_dev")).toBeUndefined();
  });
});

describe("POST /api/homepage-demo/claim/prepare - already-invalid/unavailable claim state", () => {
  it("returns already_claimed with 409 and does not overwrite the existing claim", async () => {
    prepareClaimMock.mockResolvedValueOnce({
      action: "none",
      code: "already_claimed",
      cookieMaxAgeSeconds: null,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "already_claimed", authenticated: false });
    expect(createClaimAuthorityMock).not.toHaveBeenCalled();
  });

  it("returns draft_unavailable (503) if a claim authority is still needed after the second attempt", async () => {
    prepareClaimMock
      .mockResolvedValueOnce({ action: "needs_claim_authority" })
      .mockResolvedValueOnce({ action: "needs_claim_authority" });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "draft_unavailable" });
  });

  it("returns not_found (404) when the trial does not exist", async () => {
    prepareClaimMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_not_found")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "not_found" });
  });
});

describe("POST /api/homepage-demo/claim/prepare - already-authenticated visitor", () => {
  it("reports authenticated: true without changing the preparation outcome/flow", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    prepareClaimMock
      .mockResolvedValueOnce({ action: "needs_claim_authority" })
      .mockResolvedValueOnce({
        action: "set_cookie",
        code: "claim_prepared",
        cookieMaxAgeSeconds: 1200,
      });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "claim_prepared", authenticated: true });
  });

  it("reports authenticated: false when getUser errors, without failing the request", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "no session" },
    });
    prepareClaimMock
      .mockResolvedValueOnce({ action: "needs_claim_authority" })
      .mockResolvedValueOnce({
        action: "set_cookie",
        code: "claim_prepared",
        cookieMaxAgeSeconds: 1200,
      });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ code: "claim_prepared", authenticated: false });
  });
});

describe("POST /api/homepage-demo/claim/prepare - fail-safe error handling", () => {
  it("never throws even on a completely unexpected error, falling back to a safe 503", async () => {
    prepareClaimMock.mockRejectedValueOnce(new Error("unexpected"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "draft_unavailable" });
  });
});
