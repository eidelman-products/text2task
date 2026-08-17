import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const assertClientShareEnabledMock = vi.fn();
vi.mock("@/lib/share/share-availability.server", () => ({
  assertClientShareEnabled: () => assertClientShareEnabledMock(),
  isShareAvailabilityError: (error: unknown) =>
    error instanceof Object && (error as { name?: string }).name === "ShareAvailabilityError",
}));

const buildPublicClientShareProjectionMock = vi.fn();
vi.mock("@/lib/share/client-share-projection.server", () => ({
  buildPublicClientShareProjection: (input: unknown) => buildPublicClientShareProjectionMock(input),
}));

const COOKIE_NAME = "t2t_client_share_session";
const hashSecretMock = vi.fn();
const isValidRawSecretMock = vi.fn();
vi.mock("@/lib/share/share-browser-session.server", () => ({
  getShareBrowserSessionCookiePolicy: () => ({
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax",
    path: "/api/share",
    secure: false,
    maxAge: 604800,
  }),
  hashShareBrowserSessionSecret: (raw: string) => hashSecretMock(raw),
  isValidRawShareBrowserSessionSecret: (value: unknown) => isValidRawSecretMock(value),
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/share/share-rate-limit.server", () => ({
  checkShareRateLimit: (input: unknown) => checkRateLimitMock(input),
}));

const isValidSharePublicIdMock = vi.fn();
vi.mock("@/lib/share/share-public-id.server", () => ({
  isValidSharePublicId: (value: unknown) => isValidSharePublicIdMock(value),
}));

const verifyAuthorizationMock = vi.fn();
vi.mock("@/lib/share/share-session-grant.server", () => ({
  verifyShareProjectionAuthorization: (input: unknown) => verifyAuthorizationMock(input),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("./route");

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_RAW_SESSION_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc";

function buildRequest(options: { cookieValue?: string | null; secFetchSite?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.cookieValue !== undefined && options.cookieValue !== null) {
    headers.cookie = `${COOKIE_NAME}=${options.cookieValue}`;
  }
  if (options.secFetchSite) {
    headers["sec-fetch-site"] = options.secFetchSite;
  }
  return new NextRequest(`http://localhost/api/share/${VALID_PUBLIC_ID}/projection`, {
    method: "GET",
    headers,
  });
}

function buildContext(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function allow() {
  return { allowed: true, requestCount: 1, limit: 120, windowSeconds: 300, retryAfterSeconds: 0 };
}

function deny(retryAfterSeconds = 30) {
  return { allowed: false, requestCount: 200, limit: 120, windowSeconds: 300, retryAfterSeconds };
}

function fakeProjection() {
  return {
    title: null,
    subtitle: null,
    status: null,
    targetDate: null,
    contentDirection: "auto" as const,
    commentsEnabled: false,
    progress: null,
    latestUpdate: null,
    tasks: [],
    resources: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertClientShareEnabledMock.mockReset();
  buildPublicClientShareProjectionMock.mockReset();
  hashSecretMock.mockReset().mockReturnValue("a".repeat(64));
  isValidRawSecretMock.mockReset().mockReturnValue(true);
  checkRateLimitMock.mockReset().mockResolvedValue(allow());
  isValidSharePublicIdMock.mockReset().mockReturnValue(true);
  verifyAuthorizationMock.mockReset();
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/share/[publicId]/projection - feature gate", () => {
  it("returns 404 before any Client Share DB work when the feature is disabled", async () => {
    assertClientShareEnabledMock.mockImplementation(() => {
      const error = new Error("disabled") as Error & { name: string };
      error.name = "ShareAvailabilityError";
      throw error;
    });

    const response = await GET(buildRequest(), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share/[publicId]/projection - request security", () => {
  it("rejects a present, cross-site Sec-Fetch-Site", async () => {
    const response = await GET(
      buildRequest({ secFetchSite: "cross-site" }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("INVALID_ORIGIN");
  });

  it("accepts a missing Sec-Fetch-Site (some legitimate webviews omit it)", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);
    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    expect(response.status).not.toBe(403);
  });
});

describe("GET /api/share/[publicId]/projection - publicId / cookie preconditions", () => {
  it("generic-unauthorized for a malformed publicId, before touching the cookie", async () => {
    isValidSharePublicIdMock.mockReturnValue(false);

    const response = await GET(buildRequest(), buildContext("not valid"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unauthorized when no session cookie is present", async () => {
    const response = await GET(buildRequest({ cookieValue: null }), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unauthorized for a malformed cookie value, without hashing it", async () => {
    isValidRawSecretMock.mockReturnValue(false);

    const response = await GET(
      buildRequest({ cookieValue: "not-a-valid-secret" }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(hashSecretMock).not.toHaveBeenCalled();
    expect(body.code).toBe("UNAVAILABLE");
  });
});

describe("GET /api/share/[publicId]/projection - projection_read rate limit", () => {
  it("returns 429 with Retry-After when exceeded, before authorization is even checked", async () => {
    checkRateLimitMock.mockResolvedValue(deny(9));

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });

  it("scopes the rate-limit check by browser_session, using the session digest", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "projection_read", scope: "browser_session" })
    );
  });
});

describe("GET /api/share/[publicId]/projection - authorization is never trusted from the cookie alone", () => {
  it("generic-unauthorized when full revalidation fails (forged/expired/revoked/stale-version/unavailable-link -- all indistinguishable here)", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(buildPublicClientShareProjectionMock).not.toHaveBeenCalled();
  });

  it("on success, calls buildPublicClientShareProjection with exactly the verified authorization's fields", async () => {
    verifyAuthorizationMock.mockResolvedValue({
      shareLinkId: "link-1",
      projectId: "project-1",
      userId: "user-1",
    });
    buildPublicClientShareProjectionMock.mockResolvedValue({ ok: true, data: fakeProjection() });

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: fakeProjection() });
    expect(buildPublicClientShareProjectionMock).toHaveBeenCalledWith({
      shareLinkId: "link-1",
      projectId: "project-1",
      userId: "user-1",
    });
  });

  it("generic-unauthorized (never a raw internal error) when the projection builder itself fails", async () => {
    verifyAuthorizationMock.mockResolvedValue({
      shareLinkId: "link-1",
      projectId: "project-1",
      userId: "user-1",
    });
    buildPublicClientShareProjectionMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
  });
});

describe("GET /api/share/[publicId]/projection - response contains only the strict projection, never internal identifiers", () => {
  it("never includes shareLinkId/projectId/userId or any raw session identifier in the response body", async () => {
    verifyAuthorizationMock.mockResolvedValue({
      shareLinkId: "SENSITIVE_LINK_ID",
      projectId: "SENSITIVE_PROJECT_ID",
      userId: "SENSITIVE_USER_ID",
    });
    buildPublicClientShareProjectionMock.mockResolvedValue({ ok: true, data: fakeProjection() });

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const text = await response.text();

    expect(text).not.toContain("SENSITIVE_LINK_ID");
    expect(text).not.toContain("SENSITIVE_PROJECT_ID");
    expect(text).not.toContain("SENSITIVE_USER_ID");
    expect(text).not.toContain(VALID_RAW_SESSION_SECRET);
  });
});

describe("GET /api/share/[publicId]/projection - no-store headers on every branch", () => {
  it("success response is private, no-store", async () => {
    verifyAuthorizationMock.mockResolvedValue({
      shareLinkId: "link-1",
      projectId: "project-1",
      userId: "user-1",
    });
    buildPublicClientShareProjectionMock.mockResolvedValue({ ok: true, data: fakeProjection() });

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("error response is private, no-store", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
