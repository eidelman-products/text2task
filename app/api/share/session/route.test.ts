import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const assertClientShareEnabledMock = vi.fn();
vi.mock("@/lib/share/share-availability.server", () => ({
  assertClientShareEnabled: () => assertClientShareEnabledMock(),
  isShareAvailabilityError: (error: unknown) =>
    error instanceof Object && (error as { name?: string }).name === "ShareAvailabilityError",
}));

const validateOriginMock = vi.fn();
const readJsonMock = vi.fn();
class FakeSharePublicRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
vi.mock("@/lib/share/share-public-request.server", () => ({
  validateSharePublicRequestOrigin: (input: unknown) => validateOriginMock(input),
  readSharePublicRequestJson: (request: unknown) => readJsonMock(request),
  isSharePublicRequestError: (error: unknown) => error instanceof FakeSharePublicRequestError,
}));

const createNetworkIdentityMock = vi.fn();
const createLinkIdentityMock = vi.fn();
vi.mock("@/lib/share/share-identity.server", () => ({
  createShareNetworkIdentityDigest: () => createNetworkIdentityMock(),
  createShareLinkRateLimitIdentityDigest: (linkId: string) => createLinkIdentityMock(linkId),
  isShareIdentityError: () => false,
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/share/share-rate-limit.server", () => ({
  checkShareRateLimit: (input: unknown) => checkRateLimitMock(input),
}));

const createShareSecretDigestMock = vi.fn();
vi.mock("@/lib/share/share-secret.server", () => ({
  createShareSecretDigest: (secret: string) => createShareSecretDigestMock(secret),
  isValidRawShareSecret: (value: unknown) =>
    typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value),
}));

const verifySharePinMock = vi.fn();
vi.mock("@/lib/share/share-pin.server", () => ({
  isValidSharePin: (value: unknown) => typeof value === "string" && /^[0-9]{4,6}$/.test(value),
  verifySharePin: (pin: string, material: unknown) => verifySharePinMock(pin, material),
}));

vi.mock("@/lib/share/share-public-id.server", () => ({
  isValidSharePublicId: (value: unknown) =>
    typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value),
}));

const resolveShareLinkByPublicIdMock = vi.fn();
const isShareLinkCurrentlyPubliclyActiveMock = vi.fn();
const resolveOrCreateBrowserSessionMock = vi.fn();
const ensureCurrentGrantMock = vi.fn();
vi.mock("@/lib/share/share-session-grant.server", () => ({
  resolveShareLinkByPublicId: (publicId: string) => resolveShareLinkByPublicIdMock(publicId),
  isShareLinkCurrentlyPubliclyActive: (link: unknown) => isShareLinkCurrentlyPubliclyActiveMock(link),
  resolveOrCreateBrowserSession: (cookie: unknown) => resolveOrCreateBrowserSessionMock(cookie),
  ensureCurrentGrant: (input: unknown) => ensureCurrentGrantMock(input),
}));

const COOKIE_NAME = "t2t_client_share_session";
vi.mock("@/lib/share/share-browser-session.server", () => ({
  getShareBrowserSessionCookiePolicy: () => ({
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax",
    path: "/api/share",
    secure: false,
    maxAge: 604800,
  }),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"; // 43 chars
const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/share/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", ...headers },
    body: JSON.stringify(body),
  });
}

function noPinLink(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_LINK_ID,
    projectId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    publicId: VALID_PUBLIC_ID,
    state: "active",
    expiresAt: null,
    secretDigest: "a".repeat(64),
    secretDigestVersion: 1,
    configurationVersion: 1,
    pinMaterial: null,
    ...overrides,
  };
}

function pinLink(overrides: Record<string, unknown> = {}) {
  return noPinLink({
    pinMaterial: {
      pinHash: "b".repeat(43),
      pinSalt: "c".repeat(22),
      pinHashVersion: 1,
      pinScryptN: 16384,
      pinScryptR: 8,
      pinScryptP: 1,
      pinKeyLength: 32,
    },
    ...overrides,
  });
}

function allow(overrides: Record<string, unknown> = {}) {
  return { allowed: true, requestCount: 1, limit: 10, windowSeconds: 300, retryAfterSeconds: 0, ...overrides };
}

function deny(retryAfterSeconds = 42) {
  return { allowed: false, requestCount: 999, limit: 10, windowSeconds: 300, retryAfterSeconds };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertClientShareEnabledMock.mockReset();
  validateOriginMock.mockReset();
  readJsonMock.mockReset();
  createNetworkIdentityMock.mockReset().mockReturnValue({ digest: "d".repeat(64), version: 1 });
  createLinkIdentityMock.mockReset().mockReturnValue({ digest: "e".repeat(64), version: 1 });
  checkRateLimitMock.mockReset().mockResolvedValue(allow());
  createShareSecretDigestMock.mockReset().mockReturnValue("a".repeat(64));
  verifySharePinMock.mockReset();
  resolveShareLinkByPublicIdMock.mockReset();
  isShareLinkCurrentlyPubliclyActiveMock.mockReset().mockResolvedValue(true);
  resolveOrCreateBrowserSessionMock.mockReset().mockResolvedValue({
    session: { id: "session-1", expiresAt: new Date(Date.now() + 604800_000).toISOString() },
    rawSecretForCookie: "new-raw-secret-000000000000000000000000000",
  });
  ensureCurrentGrantMock.mockReset().mockResolvedValue(true);
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/share/session - feature gate", () => {
  it("returns 404 before any Client Share DB work when the feature is disabled", async () => {
    assertClientShareEnabledMock.mockImplementation(() => {
      const error = new Error("disabled") as Error & { name: string };
      error.name = "ShareAvailabilityError";
      throw error;
    });

    const response = await POST(buildRequest({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(validateOriginMock).not.toHaveBeenCalled();
    expect(resolveShareLinkByPublicIdMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/session - request security", () => {
  it("rejects an invalid origin before any rate limit / DB work", async () => {
    validateOriginMock.mockImplementation(() => {
      throw new FakeSharePublicRequestError("invalid_request_origin");
    });

    const response = await POST(buildRequest({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("INVALID_ORIGIN");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    readJsonMock.mockResolvedValue({ publicId: 12345 });

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("rejects an invalid publicId/secret shape even if the outer JSON shape parses", async () => {
    readJsonMock.mockResolvedValue({ publicId: "short", secret: VALID_SECRET });

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/share/session - session_exchange rate limit consumed first", () => {
  it("returns 429 with Retry-After when session_exchange is exceeded, before any secret verification", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    checkRateLimitMock.mockResolvedValue(deny(17));

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(createShareSecretDigestMock).not.toHaveBeenCalled();
    expect(resolveShareLinkByPublicIdMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/session - unknown/invalid link is generic and consumes invalid_link_access", () => {
  it("unknown publicId -> generic unavailable, consumes invalid_link_access", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(null);

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.objectContaining({ action: "invalid_link_access" }));
  });

  it("disabled/expired/revoked link (isShareLinkCurrentlyPubliclyActive: false) -> identical generic posture", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(noPinLink());
    isShareLinkCurrentlyPubliclyActiveMock.mockResolvedValue(false);

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("invalid secret -> identical generic posture (no enumeration oracle vs. unknown publicId)", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(noPinLink({ secretDigest: "f".repeat(64) }));
    createShareSecretDigestMock.mockReturnValue("a".repeat(64)); // deliberately mismatched vs stored digest

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("invalid_link_access itself rate-limited -> 429, not the generic unavailable 404", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(null);
    checkRateLimitMock.mockImplementation((input: { action: string }) =>
      Promise.resolve(input.action === "invalid_link_access" ? deny(5) : allow())
    );

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/share/session - Case 1: valid secret, no PIN required", () => {
  it("creates/reuses the session, ensures the grant, sets the cookie, returns authorized", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(noPinLink());

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "authorized" });
    expect(ensureCurrentGrantMock).toHaveBeenCalledWith(
      expect.objectContaining({ pinVerifiedNow: false, shareLinkId: VALID_LINK_ID })
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("never echoes the secret or PIN anywhere in the response body", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(noPinLink());

    const response = await POST(buildRequest({}));
    const text = await response.text();

    expect(text).not.toContain(VALID_SECRET);
  });
});

describe("POST /api/share/session - Case 2: valid secret, PIN required, no PIN supplied", () => {
  it("returns pin_required, creates no session and no grant", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink());

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "pin_required" });
    expect(resolveOrCreateBrowserSessionMock).not.toHaveBeenCalled();
    expect(ensureCurrentGrantMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/share/session - Case 3: valid secret + correct PIN", () => {
  it("consumes pin_verification before verifying, then authorizes with pin_verified_at semantics", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET, pin: "1234" });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink());
    verifySharePinMock.mockResolvedValue(true);

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "authorized" });
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.objectContaining({ action: "pin_verification" }));
    expect(ensureCurrentGrantMock).toHaveBeenCalledWith(expect.objectContaining({ pinVerifiedNow: true }));
  });
});

describe("POST /api/share/session - Case 4: wrong PIN", () => {
  it("returns PIN_INCORRECT, creates no grant, no session mutation", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET, pin: "9999" });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink());
    verifySharePinMock.mockResolvedValue(false);

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("PIN_INCORRECT");
    expect(ensureCurrentGrantMock).not.toHaveBeenCalled();
    expect(resolveOrCreateBrowserSessionMock).not.toHaveBeenCalled();
  });

  it("sixth PIN attempt in the same window is rate-limited (429), not a 401", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET, pin: "9999" });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink());
    checkRateLimitMock.mockImplementation((input: { action: string }) =>
      Promise.resolve(input.action === "pin_verification" ? deny(12) : allow())
    );

    const response = await POST(buildRequest({}));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(verifySharePinMock).not.toHaveBeenCalled();
  });

  it("never logs or echoes the PIN", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET, pin: "9999" });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink());
    verifySharePinMock.mockResolvedValue(false);

    const response = await POST(buildRequest({}));
    const text = await response.text();

    expect(text).not.toContain("9999");
    for (const call of consoleErrorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("9999");
    }
  });
});

describe("POST /api/share/session - no-store headers on every branch", () => {
  it("success response is private, no-store", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(noPinLink());

    const response = await POST(buildRequest({}));
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("error response is private, no-store", async () => {
    readJsonMock.mockResolvedValue({ publicId: VALID_PUBLIC_ID, secret: VALID_SECRET });
    resolveShareLinkByPublicIdMock.mockResolvedValue(null);

    const response = await POST(buildRequest({}));
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
