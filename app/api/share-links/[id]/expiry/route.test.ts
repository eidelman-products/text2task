import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const setShareLinkExpiryMock = vi.fn();
const clearShareLinkExpiryMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  setShareLinkExpiry: (...args: unknown[]) => setShareLinkExpiryMock(...args),
  clearShareLinkExpiry: (...args: unknown[]) => clearShareLinkExpiryMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { PUT, DELETE } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_TIMESTAMP = "2027-01-01T00:00:00Z";

function buildPutRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/expiry`, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function buildDeleteRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/expiry`, {
    method: "DELETE",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validSetExpiryData() {
  return {
    linkId: VALID_UUID,
    state: "active",
    expiresAt: VALID_TIMESTAMP,
    configurationVersion: 2,
    updatedAt: "2026-08-06T00:00:00Z",
  };
}

function validClearExpiryData() {
  return {
    linkId: VALID_UUID,
    state: "active",
    expiresAt: null,
    configurationVersion: 2,
    updatedAt: "2026-08-06T00:00:00Z",
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
  setShareLinkExpiryMock.mockReset();
  clearShareLinkExpiryMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("PUT /api/share-links/[id]/expiry - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext("not-a-uuid")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(setShareLinkExpiryMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkExpiryMock.mockResolvedValue({ ok: true, data: validSetExpiryData() });

    await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID.toUpperCase())
    );

    expect(setShareLinkExpiryMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      VALID_TIMESTAMP
    );
  });

  it("forwards expiresAt to the repository byte-for-byte, without reformatting", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkExpiryMock.mockResolvedValue({ ok: true, data: validSetExpiryData() });
    const original = "2027-01-01T00:00:00.123456+02:00";

    await PUT(buildPutRequest({ expiresAt: original }), buildContext(VALID_UUID));

    expect(setShareLinkExpiryMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      original
    );
  });

  it("returns 400 INVALID_REQUEST for a non-JSON body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const request = new NextRequest(
      `http://localhost/api/share-links/${VALID_UUID}/expiry`,
      { method: "PUT", body: "not-json" }
    );

    const response = await PUT(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(setShareLinkExpiryMock).not.toHaveBeenCalled();
  });

  it.each(["2026-08-05", "not-a-timestamp", "", 1754352000000, null, undefined])(
    "returns 400 INVALID_REQUEST for a malformed expiresAt %s",
    async (expiresAt) => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

      const response = await PUT(
        buildPutRequest({ expiresAt }),
        buildContext(VALID_UUID)
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(setShareLinkExpiryMock).not.toHaveBeenCalled();
    }
  );

  it("returns 400 INVALID_REQUEST for an unknown top-level body key", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP, extra: "nope" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(setShareLinkExpiryMock).not.toHaveBeenCalled();
  });
});

describe("PUT /api/share-links/[id]/expiry - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(setShareLinkExpiryMock).not.toHaveBeenCalled();
  });
});

describe("PUT /api/share-links/[id]/expiry - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    setShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT", async () => {
    setShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns 400 INVALID_REQUEST when the repository maps the database's own future-time check (RPC INVALID_EXPIRY) to a typed INVALID_REQUEST result", async () => {
    setShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(body.error).toBe("expiresAt must be a future timestamp.");
  });

  it("never serializes the raw P0001/INVALID_EXPIRY database message in the 400 response", async () => {
    setShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const text = await response.text();

    expect(text).not.toContain("P0001");
    expect(text).not.toContain("INVALID_EXPIRY");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected failure", async () => {
    setShareLinkExpiryMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    setShareLinkExpiryMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("logs only a fixed category, never error.name or error.message", async () => {
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    setShareLinkExpiryMock.mockRejectedValue(new Error(messageMarker));

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(messageMarker);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    expect(JSON.stringify(loggedPayload)).not.toContain(messageMarker);
    expect(loggedPayload).toEqual({
      stage: "share_links.expiry.set",
      category: "Error",
    });
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validSetExpiryData();
    setShareLinkExpiryMock.mockResolvedValue({ ok: true, data });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(setShareLinkExpiryMock).toHaveBeenCalledTimes(1);
  });

  it("never leaks a secret, ciphertext, digest or raw database error code", async () => {
    const data = validSetExpiryData();
    setShareLinkExpiryMock.mockResolvedValue({ ok: true, data });

    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    const text = await response.text();

    for (const forbidden of ["secret", "ciphertext", "secretDigest", "pinHash", "P0001"]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("PUT /api/share-links/[id]/expiry - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext("not-a-uuid")
    );
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("400 INVALID_REQUEST response (repository-mapped INVALID_EXPIRY) is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkExpiryMock.mockResolvedValue({ ok: true, data: validSetExpiryData() });
    const response = await PUT(
      buildPutRequest({ expiresAt: VALID_TIMESTAMP }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});

describe("DELETE /api/share-links/[id]/expiry - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await DELETE(buildDeleteRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(clearShareLinkExpiryMock).not.toHaveBeenCalled();
  });

  it("does not parse or require a request body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    clearShareLinkExpiryMock.mockResolvedValue({ ok: true, data: validClearExpiryData() });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    clearShareLinkExpiryMock.mockResolvedValue({ ok: true, data: validClearExpiryData() });

    await DELETE(buildDeleteRequest(), buildContext(VALID_UUID.toUpperCase()));

    expect(clearShareLinkExpiryMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });
});

describe("DELETE /api/share-links/[id]/expiry - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(clearShareLinkExpiryMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/share-links/[id]/expiry - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    clearShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT (e.g. clearing expiry on an expired link)", async () => {
    clearShareLinkExpiryMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validClearExpiryData();
    clearShareLinkExpiryMock.mockResolvedValue({ ok: true, data });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(clearShareLinkExpiryMock).toHaveBeenCalledTimes(1);
  });
});

describe("DELETE /api/share-links/[id]/expiry - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await DELETE(buildDeleteRequest(), buildContext("not-a-uuid"));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    clearShareLinkExpiryMock.mockResolvedValue({ ok: true, data: validClearExpiryData() });
    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});
