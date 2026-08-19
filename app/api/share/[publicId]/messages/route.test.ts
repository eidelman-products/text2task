import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const assertClientShareEnabledMock = vi.fn();
vi.mock("@/lib/share/share-availability.server", () => ({
  assertClientShareEnabled: () => assertClientShareEnabledMock(),
  isShareAvailabilityError: (error: unknown) =>
    error instanceof Object && (error as { name?: string }).name === "ShareAvailabilityError",
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
  readSharePublicRequestJson: (request: unknown, maxBytes: unknown) => readJsonMock(request, maxBytes),
  isSharePublicRequestError: (error: unknown) => error instanceof FakeSharePublicRequestError,
  SHARE_PUBLIC_MESSAGE_REQUEST_MAX_BYTES: 20_000,
}));

const isRejectableCrossSiteRequestMock = vi.fn();
vi.mock("@/lib/share/share-request-security.server", () => ({
  isRejectableCrossSiteRequest: (headers: unknown) => isRejectableCrossSiteRequestMock(headers),
}));

const verifyAuthorizationMock = vi.fn();
const resolveCommentsEnabledMock = vi.fn();
vi.mock("@/lib/share/share-session-grant.server", () => ({
  verifyShareProjectionAuthorization: (input: unknown) => verifyAuthorizationMock(input),
  resolveShareLinkCommentsEnabled: (shareLinkId: unknown, userId: unknown) =>
    resolveCommentsEnabledMock(shareLinkId, userId),
}));

// share-public-message.server.ts is partially real (see vi.importActual
// below, which keeps the real zod schema/validation and overrides only
// the trusted insert) -- its module-level `import { supabaseAdmin }`
// still runs at import time, so supabaseAdmin itself must be stubbed
// here too, even though this test never calls it directly.
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));

const insertMock = vi.fn();
const listMessagesMock = vi.fn();
vi.mock("@/lib/share/share-public-message.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/share/share-public-message.server")>(
    "@/lib/share/share-public-message.server"
  );
  return {
    ...actual,
    insertPublicShareMessage: (input: unknown) => insertMock(input),
    listPublicShareMessages: (input: unknown) => listMessagesMock(input),
  };
});

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST, GET } = await import("./route");

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_RAW_SESSION_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc";
const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";
const VALID_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const SENSITIVE_LINK_ID = "SENSITIVE_LINK_ID";
const SENSITIVE_PROJECT_ID = "SENSITIVE_PROJECT_ID";
const SENSITIVE_USER_ID = "SENSITIVE_USER_ID";

function buildRequest(
  options: {
    cookieValue?: string | null;
    origin?: string;
    body?: unknown;
  } = {}
) {
  const headers: Record<string, string> = { origin: options.origin ?? "http://localhost" };
  if (options.cookieValue !== undefined && options.cookieValue !== null) {
    headers.cookie = `${COOKIE_NAME}=${options.cookieValue}`;
  }
  return new NextRequest(`http://localhost/api/share/${VALID_PUBLIC_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(options.body ?? { body: "hello" }),
  });
}

function buildGetRequest(
  options: {
    cookieValue?: string | null;
    secFetchSite?: string;
    secFetchMode?: string;
  } = {}
) {
  const headers: Record<string, string> = {};
  if (options.cookieValue !== undefined && options.cookieValue !== null) {
    headers.cookie = `${COOKIE_NAME}=${options.cookieValue}`;
  }
  if (options.secFetchSite) {
    headers["sec-fetch-site"] = options.secFetchSite;
  }
  if (options.secFetchMode) {
    headers["sec-fetch-mode"] = options.secFetchMode;
  }
  return new NextRequest(`http://localhost/api/share/${VALID_PUBLIC_ID}/messages`, {
    method: "GET",
    headers,
  });
}

function buildContext(publicId: string) {
  return { params: Promise.resolve({ publicId }) };
}

function allow(overrides: Record<string, unknown> = {}) {
  return { allowed: true, requestCount: 1, limit: 10, windowSeconds: 300, retryAfterSeconds: 0, ...overrides };
}

function deny(retryAfterSeconds = 30) {
  return { allowed: false, requestCount: 999, limit: 10, windowSeconds: 300, retryAfterSeconds };
}

function validAuthorization(overrides: Record<string, unknown> = {}) {
  return {
    shareLinkId: VALID_LINK_ID,
    projectId: VALID_PROJECT_ID,
    userId: VALID_USER_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertClientShareEnabledMock.mockReset();
  hashSecretMock.mockReset().mockReturnValue("a".repeat(64));
  isValidRawSecretMock.mockReset().mockReturnValue(true);
  checkRateLimitMock.mockReset().mockResolvedValue(allow());
  isValidSharePublicIdMock.mockReset().mockReturnValue(true);
  validateOriginMock.mockReset();
  isRejectableCrossSiteRequestMock.mockReset().mockReturnValue(false);
  readJsonMock.mockReset().mockResolvedValue({ body: "hello" });
  verifyAuthorizationMock.mockReset().mockResolvedValue(validAuthorization());
  resolveCommentsEnabledMock.mockReset().mockResolvedValue(true);
  insertMock.mockReset().mockResolvedValue(true);
  listMessagesMock.mockReset().mockResolvedValue([]);
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/share/[publicId]/messages - feature gate", () => {
  it("returns 404 before any Client Share DB work when the feature is disabled", async () => {
    assertClientShareEnabledMock.mockImplementation(() => {
      const error = new Error("disabled") as Error & { name: string };
      error.name = "ShareAvailabilityError";
      throw error;
    });

    const response = await POST(buildRequest(), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/messages - request security / origin", () => {
  it("rejects a cross-site request (invalid_request_origin)", async () => {
    validateOriginMock.mockImplementation(() => {
      throw new FakeSharePublicRequestError("invalid_request_origin");
    });

    const response = await POST(buildRequest(), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("INVALID_ORIGIN");
    expect(isValidSharePublicIdMock).not.toHaveBeenCalled();
  });

  it("checks origin before reading publicId/cookie/rate-limit at all", async () => {
    validateOriginMock.mockImplementation(() => {
      throw new FakeSharePublicRequestError("invalid_request_origin");
    });

    await POST(buildRequest(), buildContext(VALID_PUBLIC_ID));

    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/messages - publicId / cookie preconditions", () => {
  it("generic-unavailable for a malformed publicId, before touching the cookie", async () => {
    isValidSharePublicIdMock.mockReturnValue(false);

    const response = await POST(buildRequest(), buildContext("not valid"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unavailable when no session cookie is present", async () => {
    const response = await POST(buildRequest({ cookieValue: null }), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unavailable for a malformed cookie value, without hashing it", async () => {
    isValidRawSecretMock.mockReturnValue(false);

    const response = await POST(
      buildRequest({ cookieValue: "not-a-valid-secret" }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(hashSecretMock).not.toHaveBeenCalled();
    expect(body.code).toBe("UNAVAILABLE");
  });
});

describe("POST /api/share/[publicId]/messages - comment_submission rate limit", () => {
  it("returns 429 with Retry-After when exceeded, before authorization is even checked", async () => {
    checkRateLimitMock.mockResolvedValue(deny(9));

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });

  it("is a dedicated comment_submission action, scoped by browser_session", async () => {
    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment_submission", scope: "browser_session" })
    );
  });

  it("uses the session digest as its identity, independent of projection_read's own bucket", async () => {
    hashSecretMock.mockReturnValue("distinct-session-digest");

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ identityDigest: "distinct-session-digest" })
    );
  });
});

describe("POST /api/share/[publicId]/messages - authorization chain (never trusts the cookie alone)", () => {
  it("generic-unavailable when full revalidation fails (forged/expired/revoked/stale-version/unavailable-link -- all indistinguishable)", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(resolveCommentsEnabledMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("checks commentsEnabled using the exact verified shareLinkId/userId, never caller input", async () => {
    verifyAuthorizationMock.mockResolvedValue(validAuthorization());

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(resolveCommentsEnabledMock).toHaveBeenCalledWith(VALID_LINK_ID, VALID_USER_ID);
  });

  it("generic-unavailable when commentsEnabled=false", async () => {
    resolveCommentsEnabledMock.mockResolvedValue(false);

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("proceeds to read/validate the body only when commentsEnabled=true", async () => {
    resolveCommentsEnabledMock.mockResolvedValue(true);

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(readJsonMock).toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/messages - body reading uses the message-specific byte limit", () => {
  it("passes SHARE_PUBLIC_MESSAGE_REQUEST_MAX_BYTES (not the tiny session-exchange limit) to readSharePublicRequestJson", async () => {
    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(readJsonMock).toHaveBeenCalledWith(expect.anything(), 20_000);
  });

  it("maps a body-too-large failure to 413", async () => {
    readJsonMock.mockRejectedValue(new FakeSharePublicRequestError("request_body_too_large"));

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.code).toBe("BODY_TOO_LARGE");
  });

  it("maps a malformed-JSON/body-read failure to 400 INVALID_REQUEST", async () => {
    readJsonMock.mockRejectedValue(new FakeSharePublicRequestError("invalid_request_body"));

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });
});

describe("POST /api/share/[publicId]/messages - request schema", () => {
  it("rejects a missing body field", async () => {
    readJsonMock.mockResolvedValue({});

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("rejects a non-string body field", async () => {
    readJsonMock.mockResolvedValue({ body: 12345 });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    expect(response.status).toBe(400);
  });

  it("rejects unknown extra fields (no client-supplied id/projectId/shareLinkId/authorType/status/parentId)", async () => {
    readJsonMock.mockResolvedValue({
      body: "hello",
      id: "x",
      projectId: "x",
      shareLinkId: "x",
      authorType: "owner",
      status: "resolved",
      parentId: "x",
    });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share/[publicId]/messages - message validation (user-correctable)", () => {
  it("rejects an empty body with SHARE_MESSAGE_BODY_EMPTY", async () => {
    readJsonMock.mockResolvedValue({ body: "" });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_BODY_EMPTY");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only body with SHARE_MESSAGE_BODY_EMPTY", async () => {
    readJsonMock.mockResolvedValue({ body: "   \n\t " });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_BODY_EMPTY");
  });

  it("accepts a 4000-character body", async () => {
    readJsonMock.mockResolvedValue({ body: "a".repeat(4000) });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalled();
  });

  it("rejects a 4001-character body with SHARE_MESSAGE_BODY_TOO_LONG", async () => {
    readJsonMock.mockResolvedValue({ body: "a".repeat(4001) });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_BODY_TOO_LONG");
  });

  it("accepts an 80-character display name", async () => {
    readJsonMock.mockResolvedValue({ body: "hi", authorDisplayName: "a".repeat(80) });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.status).toBe(200);
  });

  it("rejects an 81-character display name with SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG", async () => {
    readJsonMock.mockResolvedValue({ body: "hi", authorDisplayName: "a".repeat(81) });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG");
  });

  it("an omitted display name is accepted and normalizes to absent", async () => {
    readJsonMock.mockResolvedValue({ body: "hi" });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ authorDisplayName: null }));
  });

  it("preserves multiline text through to the insert call", async () => {
    const text = "Line one\nLine two";
    readJsonMock.mockResolvedValue({ body: text });

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ body: text }));
  });

  it("preserves Hebrew text through to the insert call", async () => {
    const text = "שלום, תודה על העדכון!";
    readJsonMock.mockResolvedValue({ body: text });

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ body: text }));
  });

  it("preserves Arabic text through to the insert call", async () => {
    const text = "شكرا على التحديث";
    readJsonMock.mockResolvedValue({ body: text });

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ body: text }));
  });

  it("preserves emoji through to the insert call", async () => {
    const text = "Nice work! 🎉";
    readJsonMock.mockResolvedValue({ body: text });

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ body: text }));
  });

  it("treats HTML-like content as plain text, stored verbatim", async () => {
    const text = "<script>alert(1)</script>";
    readJsonMock.mockResolvedValue({ body: text });

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ body: text }));
  });
});

describe("POST /api/share/[publicId]/messages - insert trust boundary", () => {
  it("inserts using exactly the verified authorization's shareLinkId/projectId/userId (the request body carries no identity fields at all -- the schema is .strict() and would reject them outright, see the 'rejects unknown extra fields' test above)", async () => {
    verifyAuthorizationMock.mockResolvedValue(
      validAuthorization({
        shareLinkId: SENSITIVE_LINK_ID,
        projectId: SENSITIVE_PROJECT_ID,
        userId: SENSITIVE_USER_ID,
      })
    );
    readJsonMock.mockResolvedValue({ body: "hello" });

    await POST(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(insertMock).toHaveBeenCalledWith({
      shareLinkId: SENSITIVE_LINK_ID,
      projectId: SENSITIVE_PROJECT_ID,
      userId: SENSITIVE_USER_ID,
      body: "hello",
      authorDisplayName: null,
    });
  });

  it("on insert failure, returns a generic 500 INTERNAL_ERROR (never a raw DB error)", async () => {
    insertMock.mockResolvedValue(false);

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("on success, returns a minimal { ok: true } body -- no raw row, no ids, no status", async () => {
    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});

describe("POST /api/share/[publicId]/messages - response never exposes internal identifiers", () => {
  it("never includes shareLinkId/projectId/userId or the raw session secret in the response body, on success", async () => {
    verifyAuthorizationMock.mockResolvedValue(
      validAuthorization({
        shareLinkId: SENSITIVE_LINK_ID,
        projectId: SENSITIVE_PROJECT_ID,
        userId: SENSITIVE_USER_ID,
      })
    );

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const text = await response.text();

    expect(text).not.toContain(SENSITIVE_LINK_ID);
    expect(text).not.toContain(SENSITIVE_PROJECT_ID);
    expect(text).not.toContain(SENSITIVE_USER_ID);
    expect(text).not.toContain(VALID_RAW_SESSION_SECRET);
  });

  it("never includes those identifiers on an authorization failure either", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const text = await response.text();

    expect(text).not.toContain(VALID_RAW_SESSION_SECRET);
  });
});

describe("POST /api/share/[publicId]/messages - no-store privacy headers on every branch", () => {
  it("success response is private, no-store, no-referrer, nosniff", async () => {
    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("authorization-failure response is private, no-store", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("validation-failure response is private, no-store", async () => {
    readJsonMock.mockResolvedValue({ body: "" });

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("POST /api/share/[publicId]/messages - unexpected errors never leak details", () => {
  it("an unexpected thrown error from verifyShareProjectionAuthorization maps to a generic 500", async () => {
    verifyAuthorizationMock.mockRejectedValue(new Error("relation share_messages does not exist"));

    const response = await POST(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("relation");
    expect(text).not.toContain("share_messages");
  });
});

describe("GET /api/share/[publicId]/messages - feature gate", () => {
  it("returns 404 before any Client Share DB work when the feature is disabled", async () => {
    assertClientShareEnabledMock.mockImplementation(() => {
      const error = new Error("disabled") as Error & { name: string };
      error.name = "ShareAvailabilityError";
      throw error;
    });

    const response = await GET(buildGetRequest(), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share/[publicId]/messages - request security (GET-appropriate, not POST's origin validator)", () => {
  it("rejects a present, cross-site Sec-Fetch-Site", async () => {
    isRejectableCrossSiteRequestMock.mockReturnValue(true);

    const response = await GET(buildGetRequest(), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("INVALID_ORIGIN");
  });

  it("accepts a missing Sec-Fetch-Site", async () => {
    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    expect(response.status).not.toBe(403);
  });

  it("never uses POST's validateSharePublicRequestOrigin for GET", async () => {
    await GET(buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));
    expect(validateOriginMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share/[publicId]/messages - publicId / cookie preconditions", () => {
  it("generic-unavailable for a malformed publicId", async () => {
    isValidSharePublicIdMock.mockReturnValue(false);

    const response = await GET(buildGetRequest(), buildContext("not valid"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unavailable when no session cookie is present", async () => {
    const response = await GET(buildGetRequest({ cookieValue: null }), buildContext(VALID_PUBLIC_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("generic-unavailable for a malformed cookie value, without hashing it", async () => {
    isValidRawSecretMock.mockReturnValue(false);

    const response = await GET(
      buildGetRequest({ cookieValue: "not-a-valid-secret" }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(hashSecretMock).not.toHaveBeenCalled();
    expect(body.code).toBe("UNAVAILABLE");
  });
});

describe("GET /api/share/[publicId]/messages - projection_read rate limit (reused, not a new bucket)", () => {
  it("returns 429 with Retry-After when exceeded, before authorization is even checked", async () => {
    checkRateLimitMock.mockResolvedValue(deny(9));

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });

  it("uses the projection_read action, scoped by browser_session -- not comment_submission", async () => {
    await GET(buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "projection_read", scope: "browser_session" })
    );
  });
});

describe("GET /api/share/[publicId]/messages - authorization + commentsEnabled", () => {
  it("generic-unavailable when full revalidation fails", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(listMessagesMock).not.toHaveBeenCalled();
  });

  it("generic-unavailable when commentsEnabled=false -- history is not readable while comments are disabled, even though the owner still retains it", async () => {
    resolveCommentsEnabledMock.mockResolvedValue(false);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(listMessagesMock).not.toHaveBeenCalled();
  });

  it("reads using exactly the verified authorization's shareLinkId/projectId/userId", async () => {
    verifyAuthorizationMock.mockResolvedValue(
      validAuthorization({
        shareLinkId: SENSITIVE_LINK_ID,
        projectId: SENSITIVE_PROJECT_ID,
        userId: SENSITIVE_USER_ID,
      })
    );

    await GET(buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID));

    expect(listMessagesMock).toHaveBeenCalledWith({
      shareLinkId: SENSITIVE_LINK_ID,
      projectId: SENSITIVE_PROJECT_ID,
      userId: SENSITIVE_USER_ID,
    });
  });
});

describe("GET /api/share/[publicId]/messages - response shape / privacy", () => {
  it("returns the client-safe message list on success", async () => {
    listMessagesMock.mockResolvedValue([
      { authorType: "client", authorDisplayName: "Jane", body: "Any update?", createdAt: "2026-08-19T00:00:00Z" },
      { authorType: "owner", authorDisplayName: null, body: "On track!", createdAt: "2026-08-19T01:00:00Z" },
    ]);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        messages: [
          { authorType: "client", authorDisplayName: "Jane", body: "Any update?", createdAt: "2026-08-19T00:00:00Z" },
          { authorType: "owner", authorDisplayName: null, body: "On track!", createdAt: "2026-08-19T01:00:00Z" },
        ],
      },
    });
  });

  it("returns an empty list, not an error, when there is no history yet", async () => {
    listMessagesMock.mockResolvedValue([]);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { messages: [] } });
  });

  it("maps a null (failed) read to a generic 500, never a raw DB error", async () => {
    listMessagesMock.mockResolvedValue(null);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("never includes an id, status, parentId, isVisibleToClient, shareLinkId, projectId, or userId in the response", async () => {
    listMessagesMock.mockResolvedValue([
      { authorType: "client", authorDisplayName: "Jane", body: "Hi", createdAt: "2026-08-19T00:00:00Z" },
    ]);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );
    const text = await response.text();
    const parsed = JSON.parse(text);
    const message = parsed.data.messages[0];

    expect(Object.keys(message).sort()).toEqual(["authorDisplayName", "authorType", "body", "createdAt"]);
    expect(text).not.toContain(VALID_LINK_ID);
    expect(text).not.toContain(VALID_PROJECT_ID);
    expect(text).not.toContain(VALID_USER_ID);
  });

  it("no-store privacy headers on success", async () => {
    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("no-store privacy headers on an authorization failure", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildGetRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID)
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
