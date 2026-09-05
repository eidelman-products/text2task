import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";

/*
  Phase 0A -- first test coverage for this route, the single most
  production-critical, previously-untested path in the Live Demo ->
  claim system (it performs a real, authenticated project import).
  Mocks every @/lib/homepage-demo/*, @/lib/projects/import-persistence.server,
  and @/lib/supabase/server import wholesale, matching this repo's
  established route-test convention -- these tests protect this route's
  own auth/claim/duplicate-detection/response-mapping logic, not the
  internals of the RPC/importer helpers themselves.

  Phase 1C -- adds demo_claim_saved coverage. Mocks
  @/lib/analytics/internal-events.server and next/server's after() the
  same way review/route.test.ts does. Deliberately does NOT mock
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
const claimHomepageDemoProjectMock = vi.fn();
const prepareDuplicateOverrideMock = vi.fn();
const createDuplicateOverrideAuthorityMock = vi.fn();
const findProjectDuplicateStrictMock = vi.fn();
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
  createHomepageDemoDuplicateOverrideAuthority: (...args: unknown[]) =>
    createDuplicateOverrideAuthorityMock(...args),
  getHomepageDemoDuplicateOverrideCookiePolicy: (expiresAt: Date) => ({
    name: "t2t_homepage_demo_duplicate_override_dev",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    ),
  }),
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
  prepareHomepageDemoDuplicateOverride: (...args: unknown[]) =>
    prepareDuplicateOverrideMock(...args),
}));

vi.mock("@/lib/homepage-demo/claim-save-repository.server", () => ({
  HOMEPAGE_DEMO_CLAIM_IMPORT_PERSISTENCE_OPTIONS: {
    inheritProjectFieldsToSubtasks: false,
    priorityProvenanceMode: "metadata",
  },
  loadHomepageDemoClaimSaveSource: (...args: unknown[]) =>
    loadClaimSaveSourceMock(...args),
  claimHomepageDemoProject: (...args: unknown[]) =>
    claimHomepageDemoProjectMock(...args),
}));

vi.mock("@/lib/projects/import-persistence.server", () => ({
  findProjectDuplicateStrict: (...args: unknown[]) =>
    findProjectDuplicateStrictMock(...args),
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
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_TOKEN_HASH = "a".repeat(64);
const CONTINUATION_TOKEN_HASH = "d".repeat(64);
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

  return new NextRequest("http://localhost/api/homepage-demo/claim/save", {
    method: "POST",
    body: JSON.stringify({}),
    headers,
  });
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
  readDuplicateOverrideCookieMock.mockReset().mockReturnValue({ kind: "missing" });
  loadClaimSaveSourceMock.mockReset().mockResolvedValue({
    kind: "pending",
    claimId: CLAIM_ID,
    projectGroup: PROJECT_GROUP,
  });
  claimHomepageDemoProjectMock.mockReset();
  logAnalyticsEventSafeMock.mockReset().mockResolvedValue(true);
  prepareDuplicateOverrideMock.mockReset();
  createDuplicateOverrideAuthorityMock.mockReset().mockReturnValue({
    rawToken: "raw-override-token",
    tokenHash: "b".repeat(64),
  });
  findProjectDuplicateStrictMock.mockReset().mockResolvedValue(null);
  validateProjectImportGroupsMock.mockReset().mockReturnValue([]);
  prepareProjectImportPersistenceInputMock
    .mockReset()
    .mockReturnValue(PREPARED_INPUT);
  getUserMock
    .mockReset()
    .mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
});

describe("POST /api/homepage-demo/claim/save - unauthenticated request", () => {
  it("rejects with 401, never loads the claim source, and never touches the RPC", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ code: "unauthorized" });
    expect(loadClaimSaveSourceMock).not.toHaveBeenCalled();
    expect(claimHomepageDemoProjectMock).not.toHaveBeenCalled();
  });

  it("rejects when getUser returns an error, even if a user object is somehow present", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: VALID_USER_ID } },
      error: { message: "session invalid" },
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ code: "unauthorized" });
  });

  it("rejects with claim_unavailable before even checking auth if no claim authority cookie is present", async () => {
    readClaimCookieMock.mockReturnValueOnce(null);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "claim_unavailable" });
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/homepage-demo/claim/save - authenticated valid claim", () => {
  it("imports the project, clears both cookies, and returns the expected saved contract", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
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
    expect(claimHomepageDemoProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        claimTokenHash: CLAIM_TOKEN_HASH,
        continuationTokenHash: null,
        authenticatedUserId: VALID_USER_ID,
        requestHash: "hash-1",
        importGroups: [PROJECT_GROUP],
        duplicateCheckPassed: true,
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

  it("saves with a valid continuation cookie after the short claim cookie is gone", async () => {
    readClaimCookieMock.mockReturnValueOnce(null);
    readContinuationCookieMock.mockReturnValueOnce({
      kind: "valid",
      tokenHash: CONTINUATION_TOKEN_HASH,
    });
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
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
    expect(claimHomepageDemoProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        claimTokenHash: null,
        continuationTokenHash: CONTINUATION_TOKEN_HASH,
        authenticatedUserId: VALID_USER_ID,
      })
    );
  });

  it("checks for duplicates only when the source is pending (fresh claim)", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());

    expect(findProjectDuplicateStrictMock).toHaveBeenCalledTimes(1);
    expect(findProjectDuplicateStrictMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_USER_ID,
      PROJECT_GROUP
    );
  });
});

describe("POST /api/homepage-demo/claim/save - already claimed", () => {
  it("is idempotent: returns already_claimed with created:false, no duplicate project", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "already_claimed",
      destination: "/dashboard",
      created: false,
    });
  });

  it("does not re-check for duplicates when the source is already an rpc_replay", async () => {
    loadClaimSaveSourceMock.mockResolvedValueOnce({
      kind: "rpc_replay",
      claimId: CLAIM_ID,
      projectGroup: PROJECT_GROUP,
    });
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      created: false,
    });

    await POST(buildRequest());

    expect(findProjectDuplicateStrictMock).not.toHaveBeenCalled();
    expect(claimHomepageDemoProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ duplicateCheckPassed: false })
    );
  });
});

describe("POST /api/homepage-demo/claim/save - duplicate project detected", () => {
  it("returns duplicate_detected (409), does NOT import the project, and issues an override-authority cookie", async () => {
    findProjectDuplicateStrictMock.mockResolvedValueOnce({ id: "existing-project" });
    prepareDuplicateOverrideMock.mockResolvedValueOnce({
      outcome: "authority_prepared",
      setCookie: true,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "duplicate_detected" });
    expect(claimHomepageDemoProjectMock).not.toHaveBeenCalled();
    expect(
      response.cookies.get("t2t_homepage_demo_duplicate_override_dev")?.value
    ).toBe("raw-override-token");
  });

  it("does not attempt the duplicate-override path if the claim was already saved by the time of the re-check (rpc_replay)", async () => {
    findProjectDuplicateStrictMock.mockResolvedValueOnce({ id: "existing-project" });
    loadClaimSaveSourceMock
      .mockResolvedValueOnce({
        kind: "pending",
        claimId: CLAIM_ID,
        projectGroup: PROJECT_GROUP,
      })
      .mockResolvedValueOnce({
        kind: "rpc_replay",
        claimId: CLAIM_ID,
        projectGroup: PROJECT_GROUP,
      });
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "already_claimed",
      destination: "/dashboard",
      created: false,
    });
    expect(prepareDuplicateOverrideMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/homepage-demo/claim/save - invalid/expired claim", () => {
  it("returns claim_unavailable when the claim source cannot be loaded, no partial writes", async () => {
    loadClaimSaveSourceMock.mockResolvedValueOnce({ kind: "claim_unavailable" });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "claim_unavailable" });
    expect(claimHomepageDemoProjectMock).not.toHaveBeenCalled();
  });

  it("returns expired when the underlying trial/draft has expired", async () => {
    loadClaimSaveSourceMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_expired")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ code: "expired" });
  });
});

describe("POST /api/homepage-demo/claim/save - RPC/database failure", () => {
  it("returns temporarily_unavailable (not a false success) when the claim RPC's repository layer fails", async () => {
    claimHomepageDemoProjectMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("repository_unavailable")
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });

  it("returns temporarily_unavailable when project import validation itself fails, without importing", async () => {
    validateProjectImportGroupsMock.mockReturnValueOnce([
      { reason: "invalid_group" },
    ]);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
    expect(claimHomepageDemoProjectMock).not.toHaveBeenCalled();
  });

  it("never throws even on a completely unexpected error, falling back to a safe 503", async () => {
    claimHomepageDemoProjectMock.mockRejectedValueOnce(new Error("unexpected"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "temporarily_unavailable" });
  });
});

describe("POST /api/homepage-demo/claim/save - repeated/replayed save request", () => {
  it("a second identical save request after success is still idempotent (already_claimed, no new project)", async () => {
    claimHomepageDemoProjectMock
      .mockResolvedValueOnce({ outcome: "saved", created: true })
      .mockResolvedValueOnce({ outcome: "already_claimed", created: false });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect((await first.json()).created).toBe(true);
    expect((await second.json()).created).toBe(false);
    expect(claimHomepageDemoProjectMock).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/homepage-demo/claim/save - authorization invariant", () => {
  it("always derives authenticatedUserId from the server-verified session, never from client input", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    // The route reads no user id from the request body at all -- parseRequestMock
    // returns an empty object and readJsonMock returns {} -- so this test proves
    // the RPC call's authenticatedUserId can only have come from getUserMock.
    await POST(buildRequest());

    expect(claimHomepageDemoProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ authenticatedUserId: VALID_USER_ID })
    );
  });

  it("a claim bound to a different trial/session than the authenticated user's browser is rejected by the repository layer, not silently accepted", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "invalid_claim",
      created: false,
    });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ code: "claim_unavailable" });
  });
});

describe("POST /api/homepage-demo/claim/save - demo_claim_saved (Phase 1C)", () => {
  it("a genuine successful save emits exactly one demo_claim_saved event", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
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

  it("the event's userId equals the trusted authenticated user, not any client-supplied value", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });
    readJsonMock.mockResolvedValueOnce({ user_id: OTHER_USER_ID });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: VALID_USER_ID })
    );
  });

  it("no client-submitted user_id can override the trusted authenticated user (authorization invariant)", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });
    parseRequestMock.mockReturnValueOnce({ user_id: OTHER_USER_ID });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    const [call] = logAnalyticsEventSafeMock.mock.calls;

    expect(call[0].userId).toBe(VALID_USER_ID);
    expect(call[0].userId).not.toBe(OTHER_USER_ID);
  });

  it("when t2t_anon_id is present, the same value is used as anonymousId", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest({ t2t_anon_id: "anon-claim-save-1" }));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousId: "anon-claim-save-1" })
    );
  });

  it("when t2t_anon_id is absent, anonymousId is null and the claim still succeeds", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    const response = await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousId: null })
    );
  });

  it("the idempotency key is deterministic and derived from the claim's internal id, not any token", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
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

  it("a repeated identical successful/replay request produces the same idempotency key both times (cannot create two milestone rows)", async () => {
    claimHomepageDemoProjectMock
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

  it("an unauthenticated request never emits demo_claim_saved", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an invalid claim never emits demo_claim_saved", async () => {
    loadClaimSaveSourceMock.mockResolvedValueOnce({ kind: "claim_unavailable" });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an expired claim never emits demo_claim_saved", async () => {
    loadClaimSaveSourceMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("trial_expired")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("a claim/authorization context mismatch (invalid_claim outcome) never emits demo_claim_saved", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "invalid_claim",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("a duplicate-detected 409 never emits demo_claim_saved", async () => {
    findProjectDuplicateStrictMock.mockResolvedValueOnce({ id: "existing-project" });
    prepareDuplicateOverrideMock.mockResolvedValueOnce({
      outcome: "authority_prepared",
      setCookie: true,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const response = await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(response.status).toBe(409);
    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an RPC/import failure never emits demo_claim_saved", async () => {
    claimHomepageDemoProjectMock.mockRejectedValueOnce(
      new HomepageDemoRepositoryError("repository_unavailable")
    );

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an analytics failure after a successful claim leaves the successful claim response unchanged", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
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

  it("no raw claim token or token hash is present anywhere in the analytics call", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    const [call] = logAnalyticsEventSafeMock.mock.calls;

    expect(JSON.stringify(call[0])).not.toContain(CLAIM_TOKEN_HASH);
  });

  it("no demo content (project/task fields) is present in the analytics metadata", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    const [call] = logAnalyticsEventSafeMock.mock.calls;

    expect(call[0].metadata).toEqual({
      duplicate_override: false,
      owner_flagged: false,
    });
    expect(JSON.stringify(call[0])).not.toContain("Demo project");
  });
});

describe("POST /api/homepage-demo/claim/save - demo_claim_saved already-claimed replay (Phase 1C)", () => {
  it("an already-claimed idempotent replay (rpc_replay source) schedules the same canonical milestone", async () => {
    loadClaimSaveSourceMock.mockResolvedValueOnce({
      kind: "rpc_replay",
      claimId: CLAIM_ID,
      projectGroup: PROJECT_GROUP,
    });
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledTimes(1);
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "demo_claim_saved" })
    );
  });

  it("the already-claimed replay uses the SAME idempotency key as a normal successful save for the same claim", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();
    const firstKey = logAnalyticsEventSafeMock.mock.calls[0][0].idempotencyKey;

    logAnalyticsEventSafeMock.mockClear();
    loadClaimSaveSourceMock.mockResolvedValueOnce({
      kind: "rpc_replay",
      claimId: CLAIM_ID,
      projectGroup: PROJECT_GROUP,
    });
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();
    const secondKey = logAnalyticsEventSafeMock.mock.calls[0][0].idempotencyKey;

    expect(firstKey).toBe(secondKey);
  });

  it("ownership eligibility is trusted from the repository outcome: an already_claimed outcome for a mismatched context is never produced by this route (verified as invalid_claim upstream), so no event fires for that case", async () => {
    // This route never receives an "already_claimed" outcome for a claim
    // owned by a different authenticated user -- the RPC (see
    // supabase/migrations/202607020002_homepage_demo_claim_save_rpc.sql)
    // only reports already_claimed when v_claim.claimed_by_user_id
    // matches the current p_authenticated_user_id; any other case is
    // reported as invalid_claim, which this route already proves does
    // not emit an event (see the "context mismatch" test above).
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "invalid_claim",
      created: false,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).not.toHaveBeenCalled();
  });

  it("an analytics failure on an already-claimed replay leaves the already_claimed response unchanged", async () => {
    loadClaimSaveSourceMock.mockResolvedValueOnce({
      kind: "rpc_replay",
      claimId: CLAIM_ID,
      projectGroup: PROJECT_GROUP,
    });
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      created: false,
    });
    logAnalyticsEventSafeMock.mockRejectedValueOnce(
      new Error("analytics unavailable")
    );

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "already_claimed",
      destination: "/dashboard",
      created: false,
    });
  });

  it("an already_claimed outcome surfaced via the duplicate-override prepare path also emits demo_claim_saved with the same claim's idempotency key", async () => {
    findProjectDuplicateStrictMock.mockResolvedValueOnce({ id: "existing-project" });
    prepareDuplicateOverrideMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      setCookie: false,
      expiresAt: null,
    });

    const response = await POST(buildRequest());
    const body = await response.json();
    await flushScheduledAnalytics();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: "already_claimed",
      destination: "/dashboard",
      created: false,
    });
    expect(claimHomepageDemoProjectMock).not.toHaveBeenCalled();
    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "demo_claim_saved",
        idempotencyKey: DEMO_CLAIM_SAVED_IDEMPOTENCY_KEY,
      })
    );
  });
});

describe("POST /api/homepage-demo/claim/save - owner_flagged tagging (Phase 1D)", () => {
  it("verified owner cookie present -> owner_flagged: true, claim still stored/saved normally", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
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
        metadata: { duplicate_override: false, owner_flagged: true },
      })
    );
  });

  it("no owner cookie -> owner_flagged: false", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duplicate_override: false, owner_flagged: false },
      })
    );
  });

  it("owner_flagged is also set true on the already_claimed-via-duplicate-override-prepare success path", async () => {
    findProjectDuplicateStrictMock.mockResolvedValueOnce({ id: "existing-project" });
    prepareDuplicateOverrideMock.mockResolvedValueOnce({
      outcome: "already_claimed",
      setCookie: false,
      expiresAt: null,
    });

    await POST(buildRequest({ t2t_owner_analytics_excluded: "1" }));
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duplicate_override: false, owner_flagged: true },
      })
    );
  });

  it("a client cannot forge owner_flagged via the request body -- it is always server-derived from the cookie only", async () => {
    claimHomepageDemoProjectMock.mockResolvedValueOnce({
      outcome: "saved",
      created: true,
    });
    parseRequestMock.mockReturnValueOnce({ owner_flagged: true });

    await POST(buildRequest());
    await flushScheduledAnalytics();

    expect(logAnalyticsEventSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { duplicate_override: false, owner_flagged: false },
      })
    );
  });
});
