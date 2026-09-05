import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";

/*
  Phase 0A -- first test coverage for this route (the duplicate-override
  save path). Mocks every @/lib/homepage-demo/*,
  @/lib/projects/import-persistence.server, and @/lib/supabase/server
  import wholesale, matching the sibling claim/save route.test.ts
  convention and this repo's established pattern.

  Phase 1C -- adds demo_claim_saved coverage. Mocks
  @/lib/analytics/internal-events.server and next/server's after() the
  same way claim/save/route.test.ts does. Deliberately does NOT mock
  readAnonymousIdCookie (@/lib/analytics/request-attribution.server): a
  real t2t_anon_id cookie is set where relevant and the real
  implementation is exercised.
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

const logAnalyticsEventSafeMock = vi.fn();

vi.mock("@/lib/analytics/internal-events.server", () => ({
  logAnalyticsEventSafe: (...args: unknown[]) =>
    logAnalyticsEventSafeMock(...args),
}));

const assertEnabledMock = vi.fn();
const validateOriginMock = vi.fn();
const readJsonMock = vi.fn();
const parseRequestMock = vi.fn();
const readClaimCookieMock = vi.fn();
const readContinuationCookieMock = vi.fn();
const readDuplicateOverrideCookieMock = vi.fn();
const loadClaimSaveSourceMock = vi.fn();
const claimWithOverrideMock = vi.fn();
const validateProjectImportGroupsMock = vi.fn();
const prepareProjectImportPersistenceInputMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/homepage-demo/public-extract-request.server", () => ({
  assertHomepageDemoPublicExtractEnabled: (...args: unknown[]) =>
    assertEnabledMock(...args),
  validateHomepageDemoPublicRequestOrigin: (...args: unknown[]) =>
    validateOriginMock(...args),
}));

vi.mock("@/lib/homepage-demo/claim-save-request.server", () => ({
  readHomepageDemoClaimSaveRequestJson: (...args: unknown[]) =>
    readJsonMock(...args),
  parseHomepageDemoClaimSaveRequest: (...args: unknown[]) =>
    parseRequestMock(...args),
}));

vi.mock("@/lib/homepage-demo/claim-identity.server", () => ({
  readHomepageDemoClaimCookie: (...args: unknown[]) =>
    readClaimCookieMock(...args),
  getHomepageDemoClaimCookieClearPolicy: () => ({
    name: "t2t_homepage_demo_claim_dev",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 0,
  }),
}));

vi.mock("@/lib/homepage-demo/claim-continuation-identity.server", () => ({
  readHomepageDemoClaimContinuationCookie: (...args: unknown[]) =>
    readContinuationCookieMock(...args),
  getHomepageDemoClaimContinuationCookieClearPolicy: () => ({
    name: "t2t_homepage_demo_claim_continuation_dev",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 0,
  }),
}));

vi.mock("@/lib/homepage-demo/claim-duplicate-override-identity.server", () => ({
  readHomepageDemoDuplicateOverrideCookie: (...args: unknown[]) =>
    readDuplicateOverrideCookieMock(...args),
  getHomepageDemoDuplicateOverrideCookieClearPolicy: () => ({
    name: "t2t_homepage_demo_duplicate_override_dev",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 0,
  }),
}));

vi.mock("@/lib/homepage-demo/claim-duplicate-override-repository.server", () => ({
  claimHomepageDemoProjectWithDuplicateOverride: (...args: unknown[]) =>
    claimWithOverrideMock(...args),
}));

vi.mock("@/lib/homepage-demo/claim-save-repository.server", () => ({
  HOMEPAGE_DEMO_CLAIM_IMPORT_PERSISTENCE_OPTIONS: {
    inheritProjectFieldsToSubtasks: false,
    priorityProvenanceMode: "metadata",
  },
  loadHomepageDemoClaimSaveSource: (...args: unknown[]) =>
    loadClaimSaveSourceMock(...args),
}));

vi.mock("@/lib/projects/import-persistence.server", () => ({
  validateProjectImportGroups: (...args: unknown[]) =>
    validateProjectImportGroupsMock(...args),
  prepareProjectImportPersistenceInput: (...args: unknown[]) =>
    prepareProjectImportPersistenceInputMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const { POST } = await import("./route");

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_TOKEN_HASH = "a".repeat(64);
const CONTINUATION_TOKEN_HASH = "d".repeat(64);
const OVERRIDE_TOKEN_HASH = "b".repeat(64);
const CLAIM_ID = "55555555-5555-4555-8555-555555555555";
const PROJECT_GROUP = { name: "Demo project", tasks: [] };
const PREPARED_INPUT = {
  requestHash: "hash-1",
  payloadJson: [PROJECT_GROUP],
};
const DEMO_CLAIM_SAVED_IDEMPOTENCY_KEY = `demo_claim_saved:${CLAIM_ID}`;

function buildRequest(cookies?: Record<string, string>) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  return new NextRequest(
    "http://localhost/api/homepage-demo/claim/save-anyway",
    {
      method: "POST",
      body: JSON.stringify({}),
      headers,
    }
  );
}

async function flushScheduledAnalytics() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  assertEnabledMock.mockReset().mockReturnValue(undefined);
  validateOriginMock.mockReset().mockReturnValue(undefined);
  readJsonMock.mockReset().mockResolvedValue({});
  parseRequestMock.mockReset().mockReturnValue({});
  readClaimCookieMock.mockReset().mockReturnValue({ tokenHash: CLAIM_TOKEN_HASH });
  readContinuationCookieMock.mockReset().mockReturnValue({ kind: "missing" });
  readDuplicateOverrideCookieMock
    .mockReset()
    .mockReturnValue({ kind: "valid", tokenHash: OVERRIDE_TOKEN_HASH });
  loadClaimSaveSourceMock.mockReset().mockResolvedValue({
    kind: "pending",
    claimId: CLAIM_ID,
    projectGroup: PROJECT_GROUP,
  });
  claimWithOverrideMock.mockReset();
  logAnalyticsEventSafeMock.mockReset().mockResolvedValue(true);
  validateProjectImportGroupsMock.mockReset().mockReturnValue([]);
  prepareProjectImportPersistenceInputMock
    .mockReset()
    .mockReturnValue(PREPARED_INPUT);
  getUserMock
    .mockReset()
    .mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
});

describe("POST /api/homepage-demo/claim/save-anyway - valid duplicate override", () => {
  it("succeeds, clears both cookies, and returns the expected saved contract", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "saved",
      destination: "/dashboard",
      created: true,
    });
    expect(claimWithOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        claimTokenHash: CLAIM_TOKEN_HASH,
        continuationTokenHash: null,
        authenticatedUserId: VALID_USER_ID,
        authorityTokenHash: OVERRIDE_TOKEN_HASH,
      })
    );
    expect(response.cookies.get("t2t_homepage_demo_claim_dev")?.value).toBe("");
    expect(
      response.cookies.get("t2t_homepage_demo_claim_continuation_dev")?.value
    ).toBe("");
    expect(
      response.cookies.get("t2t_homepage_demo_duplicate_override_dev")?.value
    ).toBe("");
  });

  it("succeeds with a valid continuation cookie after the short claim cookie is gone", async () => {
    readClaimCookieMock.mockReturnValueOnce(null);
    readContinuationCookieMock.mockReturnValueOnce({
      kind: "valid",
      tokenHash: CONTINUATION_TOKEN_HASH,
    });
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "saved",
      destination: "/dashboard",
      created: true,
    });
    expect(loadClaimSaveSourceMock).toHaveBeenCalledWith({
      claimTokenHash: null,
      continuationTokenHash: CONTINUATION_TOKEN_HASH,
    });
    expect(claimWithOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        claimTokenHash: null,
        continuationTokenHash: CONTINUATION_TOKEN_HASH,
        authenticatedUserId: VALID_USER_ID,
      })
    );
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - invalid override token", () => {
  it("rejects with duplicate_authority_unavailable when the override cookie is malformed", async () => {
    readDuplicateOverrideCookieMock.mockReturnValueOnce({ kind: "malformed" });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "duplicate_authority_unavailable" });
    expect(claimWithOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects with duplicate_authority_unavailable when the override cookie is entirely missing", async () => {
    readDuplicateOverrideCookieMock.mockReturnValueOnce({ kind: "missing" });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "duplicate_authority_unavailable" });
    expect(claimWithOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects when the repository reports the authority itself was never valid for this claim", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "duplicate_authority_unavailable",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "duplicate_authority_unavailable" });
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - expired override", () => {
  it("rejects with duplicate_authority_expired (410) and clears the stale cookie", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "duplicate_authority_expired",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ code: "duplicate_authority_expired" });
    expect(
      response.cookies.get("t2t_homepage_demo_duplicate_override_dev")?.value
    ).toBe("");
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - override bound to wrong claim/context", () => {
  it("still reports duplicate_detected if the repository re-validates and finds a genuine duplicate anyway", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "duplicate_detected",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "duplicate_detected" });
  });

  it("rejects as claim_unavailable when the override doesn't match the current claim (invalid_claim)", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "invalid_claim",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "claim_unavailable" });
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - unauthenticated request", () => {
  it("rejects with 401 before ever inspecting the override cookie's validity", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ code: "unauthorized" });
    expect(claimWithOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects with claim_unavailable before checking auth if no primary claim cookie exists", async () => {
    readClaimCookieMock.mockReturnValueOnce(null);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "claim_unavailable" });
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - repeated successful request", () => {
  it("does not create a duplicate project on a second identical request (idempotent already_claimed)", async () => {
    claimWithOverrideMock
      .mockResolvedValueOnce({ outcome: "saved", created: true })
      .mockResolvedValueOnce({ outcome: "already_claimed", created: false });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect((await first.json()).created).toBe(true);
    expect((await second.json()).created).toBe(false);
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - RPC/import failure", () => {
  it("never returns a false success on a repository failure", async () => {
    claimWithOverrideMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("repository_unavailable")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });

  it("never throws on a completely unexpected error, falling back to a safe 503", async () => {
    claimWithOverrideMock.mockRejectedValueOnce(new Error("unexpected"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });

  it("returns temporarily_unavailable without ever calling the RPC when import validation fails", async () => {
    validateProjectImportGroupsMock.mockReturnValueOnce([{ reason: "bad" }]);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
    expect(claimWithOverrideMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - demo_claim_saved (Phase 1C)", () => {
  it("a valid duplicate override + successful save emits demo_claim_saved", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "demo_claim_saved" })
    );
  });

  it("uses the trusted authenticated user_id, not any client-supplied value", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: VALID_USER_ID })
    );
  });

  it("uses t2t_anon_id where available", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest({ t2t_anon_id: "anon-save-anyway-1" }));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousId: "anon-save-anyway-1" })
    );
  });

  it("uses the SAME canonical claim idempotency namespace as the normal save route for the same claim", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: DEMO_CLAIM_SAVED_IDEMPOTENCY_KEY,
      })
    );
  });

  it("metadata marks duplicate_override:true, and contains no other fields", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duplicate_override: true, owner_flagged: false },
      })
    );
  });

  it("an invalid override never emits demo_claim_saved", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "duplicate_authority_unavailable",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an expired override never emits demo_claim_saved", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "duplicate_authority_expired",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("a wrong-context override (invalid_claim) never emits demo_claim_saved", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "invalid_claim",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an unauthenticated request never emits demo_claim_saved", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an RPC/import failure never emits demo_claim_saved", async () => {
    claimWithOverrideMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("repository_unavailable")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("a repeated save-anyway request produces the same idempotency key both times (no duplicate milestone)", async () => {
    claimWithOverrideMock
      .mockResolvedValueOnce({ outcome: "saved", created: true })
      .mockResolvedValueOnce({ outcome: "already_claimed", created: false });

    await POST(buildRequest());
    await flushScheduledAnalytics();
    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(2);
    const firstKey = logAnalyticsEventSafeMock.mock.calls[0][0].idempotencyKey;
    const secondKey = logAnalyticsEventSafeMock.mock.calls[1][0].idempotencyKey;

    expect(firstKey).toBe(DEMO_CLAIM_SAVED_IDEMPOTENCY_KEY);
    expect(secondKey).toBe(DEMO_CLAIM_SAVED_IDEMPOTENCY_KEY);
  });

  it("an analytics failure leaves the successful product response unaffected", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });
    logAnalyticsEventSafeMock.mockRejectedValueOnce(
      new Error("analytics unavailable")
    );

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "saved",
      destination: "/dashboard",
      created: true,
    });
  });

  it("no raw override/claim/public token is present anywhere in the analytics call", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    const [call] = logAnalyticsEventSafeMock.mock.calls;
    const serialized = JSON.stringify(call[0]);

    expect(serialized).not.toContain(CLAIM_TOKEN_HASH);
    expect(serialized).not.toContain(OVERRIDE_TOKEN_HASH);
  });
});

describe("POST /api/homepage-demo/claim/save-anyway - owner_flagged tagging (Phase 1D)", () => {
  it("verified owner cookie present -> owner_flagged: true, save-anyway still succeeds normally", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    const response = await POST(
      buildRequest({ t2t_owner_analytics_excluded: "1" })
    );
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duplicate_override: true, owner_flagged: true },
      })
    );
  });

  it("no owner cookie -> owner_flagged: false", async () => {
    claimWithOverrideMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duplicate_override: true, owner_flagged: false },
      })
    );
  });
});
