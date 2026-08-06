import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const revokeShareLinkMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  revokeShareLink: (...args: unknown[]) => revokeShareLinkMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function buildRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/revoke`, {
    method: "POST",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validRevokeData() {
  return {
    linkId: VALID_UUID,
    state: "revoked",
    configurationVersion: 5,
    revokedAt: "2026-08-06T00:00:00Z",
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
  revokeShareLinkMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("POST /api/share-links/[id]/revoke - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(revokeShareLinkMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revokeShareLinkMock.mockResolvedValue({ ok: true, data: validRevokeData() });

    await POST(buildRequest(), buildContext(VALID_UUID.toUpperCase()));

    expect(revokeShareLinkMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });
});

describe("POST /api/share-links/[id]/revoke - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(revokeShareLinkMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/share-links/[id]/revoke - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT for an already-revoked link", async () => {
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected failure", async () => {
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    revokeShareLinkMock.mockRejectedValue(
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

  it("logs only a fixed category, never error.name or error.message", async () => {
    const nameMarker = "SENSITIVE_NAME_MARKER_9f3a";
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    const error = new Error(messageMarker);
    error.name = nameMarker;
    revokeShareLinkMock.mockRejectedValue(error);

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    const responseText = JSON.stringify(body);
    expect(responseText).not.toContain(nameMarker);
    expect(responseText).not.toContain(messageMarker);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    const loggedText = JSON.stringify(loggedPayload);
    expect(loggedText).not.toContain(nameMarker);
    expect(loggedText).not.toContain(messageMarker);
    expect(loggedPayload).toEqual({
      stage: "share_links.revoke",
      category: "Error",
    });
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validRevokeData();
    revokeShareLinkMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(revokeShareLinkMock).toHaveBeenCalledTimes(1);
    expect(revokeShareLinkMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });

  it("never returns a secret -- revoke data never reveals one", async () => {
    const data = validRevokeData();
    revokeShareLinkMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const text = await response.text();

    for (const forbidden of [
      "secret",
      "ciphertext",
      "secretDigest",
      "nonce",
      "authTag",
      "pinHash",
      "P0001",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("POST /api/share-links/[id]/revoke - explicit no-store headers on every response branch", () => {
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
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("409 SHARE_LINK_STATE_CONFLICT response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revokeShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    revokeShareLinkMock.mockResolvedValue({ ok: true, data: validRevokeData() });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});
