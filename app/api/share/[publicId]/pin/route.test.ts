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
const resolveBrowserSessionFromCookieMock = vi.fn();
const findAnyGrantForSessionMock = vi.fn();
const ensureCurrentGrantMock = vi.fn();
vi.mock("@/lib/share/share-session-grant.server", () => ({
  resolveShareLinkByPublicId: (publicId: string) => resolveShareLinkByPublicIdMock(publicId),
  isShareLinkCurrentlyPubliclyActive: (link: unknown) => isShareLinkCurrentlyPubliclyActiveMock(link),
  resolveBrowserSessionFromCookie: (cookie: unknown) => resolveBrowserSessionFromCookieMock(cookie),
  findAnyGrantForSession: (sessionId: string, linkId: string) =>
    findAnyGrantForSessionMock(sessionId, linkId),
  ensureCurrentGrant: (input: unknown) => ensureCurrentGrantMock(input),
}));

const COOKIE_NAME = "t2t_client_share_session";
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
  isValidRawShareBrowserSessionSecret: (value: unknown) => isValidRawSecretMock(value),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";
const VALID_SESSION_ID = "44444444-4444-4444-8444-444444444444";
const VALID_RAW_SESSION_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc";

function buildRequest(body: unknown, options: { cookieValue?: string | null } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: "http://localhost" };
  if (options.cookieValue !== undefined && options.cookieValue !== null) {
    headers.cookie = `${COOKIE_NAME}=${options.cookieValue}`;
  }
  return new NextRequest(`http://localhost/api/share/${VALID_PUBLIC_ID}/pin`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function buildContext(publicId: string = VALID_PUBLIC_ID) {
  return { params: Promise.resolve({ publicId }) };
}

function pinLink(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_LINK_ID,
    projectId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    publicId: VALID_PUBLIC_ID,
    configurationVersion: 1,
    accessEpoch: 1,
    pinEpoch: 1,
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
  };
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
  readJsonMock.mockReset().mockResolvedValue({ pin: "1234" });
  createNetworkIdentityMock.mockReset().mockReturnValue({ digest: "d".repeat(64), version: 1 });
  createLinkIdentityMock.mockReset().mockReturnValue({ digest: "e".repeat(64), version: 1 });
  checkRateLimitMock.mockReset().mockResolvedValue(allow());
  verifySharePinMock.mockReset().mockResolvedValue(true);
  resolveShareLinkByPublicIdMock.mockReset().mockResolvedValue(pinLink());
  isShareLinkCurrentlyPubliclyActiveMock.mockReset().mockResolvedValue(true);
  resolveBrowserSessionFromCookieMock.mockReset().mockResolvedValue({
    id: VALID_SESSION_ID,
    expiresAt: new Date(Date.now() + 604800_000).toISOString(),
  });
  findAnyGrantForSessionMock.mockReset().mockResolvedValue({ grantedAccessEpoch: 1 });
  ensureCurrentGrantMock.mockReset().mockResolvedValue(true);
  isValidRawSecretMock.mockReset().mockReturnValue(true);
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/share/[publicId]/pin - feature gate", () => {
  it("returns 404 before any Client Share DB work when the feature is disabled", async () => {
    assertClientShareEnabledMock.mockImplementation(() => {
      const error = new Error("disabled") as Error & { name: string };
      error.name = "ShareAvailabilityError";
      throw error;
    });

    const response = await POST(buildRequest({ pin: "1234" }), buildContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(resolveShareLinkByPublicIdMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/pin - rate limit and origin ordering", () => {
  it("consumes the network_identity pin_verification bucket before origin validation", async () => {
    validateOriginMock.mockImplementation(() => {
      throw new FakeSharePublicRequestError("invalid_request_origin");
    });

    const response = await POST(buildRequest({ pin: "1234" }), buildContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("INVALID_ORIGIN");
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pin_verification", scope: "network_identity" })
    );
    expect(resolveShareLinkByPublicIdMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the network-identity bucket is exhausted, before any DB work", async () => {
    checkRateLimitMock.mockResolvedValueOnce(deny(17));

    const response = await POST(buildRequest({ pin: "1234" }), buildContext());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(validateOriginMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/pin - request validation", () => {
  it("rejects an invalid publicId", async () => {
    const response = await POST(buildRequest({ pin: "1234" }), buildContext("short"));
    expect(response.status).toBe(404);
  });

  it("rejects a malformed body", async () => {
    readJsonMock.mockResolvedValue({ notPin: true });
    const response = await POST(buildRequest({}), buildContext());
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("rejects a syntactically invalid PIN shape", async () => {
    readJsonMock.mockResolvedValue({ pin: "abc" });
    const response = await POST(buildRequest({}), buildContext());
    expect(response.status).toBe(400);
  });

  it("rejects when no session cookie is present", async () => {
    const response = await POST(buildRequest({ pin: "1234" }, { cookieValue: null }), buildContext());
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
    expect(resolveBrowserSessionFromCookieMock).not.toHaveBeenCalled();
  });

  it("rejects when the cookie value is malformed", async () => {
    isValidRawSecretMock.mockReturnValue(false);
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: "not-valid" }),
      buildContext()
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/share/[publicId]/pin - session and link resolution", () => {
  it("generic unavailable when the session cannot be resolved", async () => {
    resolveBrowserSessionFromCookieMock.mockResolvedValue(null);
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("generic unavailable when the link cannot be resolved", async () => {
    resolveShareLinkByPublicIdMock.mockResolvedValue(null);
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("generic unavailable when the link is not currently publicly active (disabled/expired/revoked)", async () => {
    isShareLinkCurrentlyPubliclyActiveMock.mockResolvedValue(false);
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
    expect(findAnyGrantForSessionMock).not.toHaveBeenCalled();
  });

  it("generic unavailable when the link requires no PIN at all -- nothing for this route to recover", async () => {
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink({ pinMaterial: null }));
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
    expect(findAnyGrantForSessionMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/pin - proof of prior access and rotation guard (SECURITY)", () => {
  it("generic unavailable when this browser session has never held any grant for this link (no bare-cookie bootstrap)", async () => {
    findAnyGrantForSessionMock.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
    expect(verifySharePinMock).not.toHaveBeenCalled();
    expect(ensureCurrentGrantMock).not.toHaveBeenCalled();
  });

  it("SECURITY: generic unavailable when the prior grant's accessEpoch no longer matches the link's live accessEpoch (secret was rotated since) -- no PIN, however correct, may recover a rotated link", async () => {
    findAnyGrantForSessionMock.mockResolvedValue({ grantedAccessEpoch: 1 });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink({ accessEpoch: 2 }));

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
    expect(verifySharePinMock).not.toHaveBeenCalled();
    expect(ensureCurrentGrantMock).not.toHaveBeenCalled();
  });

  it("proceeds to PIN verification when the prior grant's accessEpoch still matches the link's live accessEpoch, regardless of pinEpoch drift", async () => {
    findAnyGrantForSessionMock.mockResolvedValue({ grantedAccessEpoch: 3 });
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink({ accessEpoch: 3, pinEpoch: 9 }));

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );

    expect(response.status).toBe(200);
    expect(verifySharePinMock).toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/pin - share_link-scoped rate limit", () => {
  it("consumes the pin_verification/share_link bucket keyed by this link's own id before verifying the PIN", async () => {
    await POST(buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }), buildContext());

    expect(createLinkIdentityMock).toHaveBeenCalledWith(VALID_LINK_ID);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pin_verification", scope: "share_link", shareLinkId: VALID_LINK_ID })
    );
  });

  it("returns 429 when the per-link pin_verification bucket is exhausted, never reaching PIN comparison", async () => {
    checkRateLimitMock.mockImplementation((input: { action: string; scope: string }) =>
      Promise.resolve(
        input.action === "pin_verification" && input.scope === "share_link" ? deny(30) : allow()
      )
    );

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(verifySharePinMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/pin - PIN verification outcomes", () => {
  it("wrong PIN -> 401 PIN_INCORRECT, no grant created", async () => {
    verifySharePinMock.mockResolvedValue(false);

    const response = await POST(
      buildRequest({ pin: "9999" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("PIN_INCORRECT");
    expect(ensureCurrentGrantMock).not.toHaveBeenCalled();
  });

  it("verifySharePin throwing is treated as an incorrect PIN, not a 500", async () => {
    verifySharePinMock.mockRejectedValue(new Error("scrypt boom"));

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );

    expect(response.status).toBe(401);
  });

  it("correct PIN -> ensureCurrentGrant called with pinVerifiedNow true and the link's CURRENT accessEpoch/pinEpoch (both), then 200 authorized", async () => {
    resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink({ accessEpoch: 3, pinEpoch: 3 }));
    findAnyGrantForSessionMock.mockResolvedValue({ grantedAccessEpoch: 3 });

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "authorized" });
    expect(ensureCurrentGrantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        browserSessionId: VALID_SESSION_ID,
        shareLinkId: VALID_LINK_ID,
        linkAccessEpoch: 3,
        linkPinEpoch: 3,
        pinVerifiedNow: true,
      })
    );
  });

  it("generic unavailable when ensureCurrentGrant itself fails", async () => {
    ensureCurrentGrantMock.mockResolvedValue(false);

    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("UNAVAILABLE");
  });
});

describe("POST /api/share/[publicId]/pin - no enumeration oracle / secrecy", () => {
  it("never echoes the PIN anywhere in the response body", async () => {
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    const text = await response.text();
    expect(text).not.toContain("1234");
  });

  it("never logs the PIN, cookie, or raw session secret", async () => {
    verifySharePinMock.mockResolvedValue(false);
    await POST(buildRequest({ pin: "9999" }, { cookieValue: VALID_RAW_SESSION_SECRET }), buildContext());

    const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
    for (const forbidden of ["9999", VALID_RAW_SESSION_SECRET]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("unknown link, non-active link, no-PIN link, no-prior-grant, and rotated-epoch all produce the IDENTICAL generic 404 UNAVAILABLE shape", async () => {
    const scenarios: Array<() => void> = [
      () => resolveShareLinkByPublicIdMock.mockResolvedValue(null),
      () => isShareLinkCurrentlyPubliclyActiveMock.mockResolvedValue(false),
      () => resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink({ pinMaterial: null })),
      () => findAnyGrantForSessionMock.mockResolvedValue(null),
      () => {
        findAnyGrantForSessionMock.mockResolvedValue({ grantedAccessEpoch: 1 });
        resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink({ accessEpoch: 2 }));
      },
    ];

    const bodies: unknown[] = [];
    for (const setup of scenarios) {
      vi.clearAllMocks();
      readJsonMock.mockResolvedValue({ pin: "1234" });
      checkRateLimitMock.mockResolvedValue(allow());
      resolveShareLinkByPublicIdMock.mockResolvedValue(pinLink());
      isShareLinkCurrentlyPubliclyActiveMock.mockResolvedValue(true);
      resolveBrowserSessionFromCookieMock.mockResolvedValue({
        id: VALID_SESSION_ID,
        expiresAt: new Date(Date.now() + 604800_000).toISOString(),
      });
      findAnyGrantForSessionMock.mockResolvedValue({ grantedAccessEpoch: 1 });
      isValidRawSecretMock.mockReturnValue(true);
      setup();

      const response = await POST(
        buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
        buildContext()
      );
      bodies.push({ status: response.status, body: await response.json() });
    }

    for (const entry of bodies) {
      expect(entry).toEqual({ status: 404, body: { ok: false, code: "UNAVAILABLE", error: "This shared link is not available." } });
    }
  });
});

describe("POST /api/share/[publicId]/pin - no-store and hardening headers", () => {
  it("success response is private, no-store, with hardening headers", async () => {
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it("error response is private, no-store, with hardening headers", async () => {
    resolveShareLinkByPublicIdMock.mockResolvedValue(null);
    const response = await POST(
      buildRequest({ pin: "1234" }, { cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext()
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });
});
