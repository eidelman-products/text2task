import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const revealShareLinkSecretMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  revealShareLinkSecret: (...args: unknown[]) => revealShareLinkSecretMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"; // 43 chars

function buildRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/reveal`, {
    method: "POST",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validRevealData() {
  return {
    linkId: VALID_UUID,
    publicId: "abcdefgh12345678",
    secret: VALID_SECRET,
  };
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
  expect(cacheControl).toContain("max-age=0");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
}

beforeEach(() => {
  getUserMock.mockReset();
  revealShareLinkSecretMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("POST /api/share-links/[id]/reveal - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(revealShareLinkSecretMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({ ok: true, data: validRevealData() });

    await POST(buildRequest(), buildContext(VALID_UUID.toUpperCase()));

    expect(revealShareLinkSecretMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });

  it("never puts the secret in the request URL, header or cookie -- POST body/query is never used to send it", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({ ok: true, data: validRevealData() });

    const request = buildRequest();
    await POST(request, buildContext(VALID_UUID));

    expect(request.url).not.toContain(VALID_SECRET);
  });
});

describe("POST /api/share-links/[id]/reveal - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(revealShareLinkSecretMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/share-links/[id]/reveal - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT for a non-active link", async () => {
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns 500 SHARE_LINK_SECRET_UNAVAILABLE with generic text", async () => {
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_SECRET_UNAVAILABLE" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("SHARE_LINK_SECRET_UNAVAILABLE");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected failure", async () => {
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    revealShareLinkSecretMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("logs only a fixed category, never error.name, error.message or the secret", async () => {
    const nameMarker = "SENSITIVE_NAME_MARKER_9f3a";
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    const error = new Error(messageMarker);
    error.name = nameMarker;
    revealShareLinkSecretMock.mockRejectedValue(error);

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    const responseText = JSON.stringify(body);
    expect(responseText).not.toContain(nameMarker);
    expect(responseText).not.toContain(messageMarker);
    expect(responseText).not.toContain(VALID_SECRET);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    const loggedText = JSON.stringify(loggedPayload);
    expect(loggedText).not.toContain(nameMarker);
    expect(loggedText).not.toContain(messageMarker);
    expect(loggedPayload).toEqual({
      stage: "share_links.reveal",
      category: "Error",
    });
  });

  it("returns {ok:true,data} on success, including the currently stored secret, calling exactly one repository function", async () => {
    const data = validRevealData();
    revealShareLinkSecretMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(body.data.secret).toBe(VALID_SECRET);
    expect(revealShareLinkSecretMock).toHaveBeenCalledTimes(1);
    expect(revealShareLinkSecretMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });

  it("never leaks ciphertext, digest, nonce, authTag, encryptionVersion or a raw database error code", async () => {
    const data = validRevealData();
    revealShareLinkSecretMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const text = await response.text();

    for (const forbidden of [
      "ciphertext",
      "secretDigest",
      "nonce",
      "authTag",
      "encryptionVersion",
      "pinHash",
      "userId",
      "P0001",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("POST /api/share-links/[id]/reveal - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid"));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("404 SHARE_LINK_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("409 SHARE_LINK_STATE_CONFLICT response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("the secret-bearing 200 success response is explicitly no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revealShareLinkSecretMock.mockResolvedValue({ ok: true, data: validRevealData() });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    const body = await response.clone().json();
    expect(body.data.secret).toBe(VALID_SECRET);
    expectNoStoreHeaders(response);
  });
});
