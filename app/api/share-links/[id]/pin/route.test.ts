import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const setShareLinkPinMock = vi.fn();
const clearShareLinkPinMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  setShareLinkPin: (...args: unknown[]) => setShareLinkPinMock(...args),
  clearShareLinkPin: (...args: unknown[]) => clearShareLinkPinMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { PUT, DELETE } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function buildPutRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/pin`, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function buildDeleteRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/pin`, {
    method: "DELETE",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validSetPinData() {
  return {
    linkId: VALID_UUID,
    hasPin: true,
    state: "active",
    configurationVersion: 2,
    updatedAt: "2026-08-06T00:00:00Z",
  };
}

function validClearPinData() {
  return {
    linkId: VALID_UUID,
    hasPin: false,
    state: "active",
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
  setShareLinkPinMock.mockReset();
  clearShareLinkPinMock.mockReset();
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PUT/DELETE /api/share-links/[id]/pin - feature gate", () => {
  it("PUT returns 404 NOT_FOUND before authenticating when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(setShareLinkPinMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("DELETE returns 404 NOT_FOUND before authenticating when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(clearShareLinkPinMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe("PUT /api/share-links/[id]/pin - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(setShareLinkPinMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkPinMock.mockResolvedValue({ ok: true, data: validSetPinData() });

    await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID.toUpperCase()));

    expect(setShareLinkPinMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      "1234"
    );
  });

  it("returns 400 INVALID_REQUEST for a non-JSON body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const request = new NextRequest(
      `http://localhost/api/share-links/${VALID_UUID}/pin`,
      { method: "PUT", body: "not-json" }
    );

    const response = await PUT(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(setShareLinkPinMock).not.toHaveBeenCalled();
  });

  it.each(["123", "1234567", "12a4", "", 1234, null, undefined])(
    "returns 400 INVALID_REQUEST for an invalid pin shape %s",
    async (pin) => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

      const response = await PUT(buildPutRequest({ pin }), buildContext(VALID_UUID));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_REQUEST");
      expect(setShareLinkPinMock).not.toHaveBeenCalled();
    }
  );

  it("returns 400 INVALID_REQUEST for an unknown top-level body key", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PUT(
      buildPutRequest({ pin: "1234", extra: "nope" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(setShareLinkPinMock).not.toHaveBeenCalled();
  });
});

describe("PUT /api/share-links/[id]/pin - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(setShareLinkPinMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkPinMock.mockResolvedValue({ ok: false, error: { code: "UNAUTHORIZED" } });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("PUT /api/share-links/[id]/pin - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    setShareLinkPinMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT for a revoked link", async () => {
    setShareLinkPinMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected failure", async () => {
    setShareLinkPinMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    setShareLinkPinMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("logs only a fixed category, never the pin, error.name or error.message", async () => {
    const pinMarker = "9999";
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    const error = new Error(messageMarker);
    setShareLinkPinMock.mockRejectedValue(error);

    const response = await PUT(buildPutRequest({ pin: pinMarker }), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    const responseText = JSON.stringify(body);
    expect(responseText).not.toContain(messageMarker);
    expect(responseText).not.toContain(pinMarker);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    const loggedText = JSON.stringify(loggedPayload);
    expect(loggedText).not.toContain(messageMarker);
    expect(loggedText).not.toContain(pinMarker);
    expect(loggedPayload).toEqual({
      stage: "share_links.pin.set",
      category: "Error",
    });
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validSetPinData();
    setShareLinkPinMock.mockResolvedValue({ ok: true, data });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(setShareLinkPinMock).toHaveBeenCalledTimes(1);
    expect(setShareLinkPinMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      "1234"
    );
  });

  it("never leaks the pin, pinHash, pinSalt or any secret/database detail in the success response", async () => {
    const data = validSetPinData();
    setShareLinkPinMock.mockResolvedValue({ ok: true, data });

    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    const text = await response.text();

    for (const forbidden of [
      "\"pin\"",
      "pinHash",
      "pinSalt",
      "secret",
      "ciphertext",
      "P0001",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("PUT /api/share-links/[id]/pin - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext("not-a-uuid"));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("404 SHARE_LINK_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkPinMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("409 SHARE_LINK_STATE_CONFLICT response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkPinMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkPinMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    setShareLinkPinMock.mockResolvedValue({ ok: true, data: validSetPinData() });
    const response = await PUT(buildPutRequest({ pin: "1234" }), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});

describe("DELETE /api/share-links/[id]/pin - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await DELETE(buildDeleteRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(clearShareLinkPinMock).not.toHaveBeenCalled();
  });

  it("does not parse or require a request body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    clearShareLinkPinMock.mockResolvedValue({ ok: true, data: validClearPinData() });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    clearShareLinkPinMock.mockResolvedValue({ ok: true, data: validClearPinData() });

    await DELETE(buildDeleteRequest(), buildContext(VALID_UUID.toUpperCase()));

    expect(clearShareLinkPinMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });
});

describe("DELETE /api/share-links/[id]/pin - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(clearShareLinkPinMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/share-links/[id]/pin - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    clearShareLinkPinMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT for a revoked link", async () => {
    clearShareLinkPinMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    clearShareLinkPinMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validClearPinData();
    clearShareLinkPinMock.mockResolvedValue({ ok: true, data });

    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(clearShareLinkPinMock).toHaveBeenCalledTimes(1);
  });
});

describe("DELETE /api/share-links/[id]/pin - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await DELETE(buildDeleteRequest(), buildContext("not-a-uuid"));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    clearShareLinkPinMock.mockResolvedValue({ ok: true, data: validClearPinData() });
    const response = await DELETE(buildDeleteRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});
