import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const getShareLinkManagementStateMock = vi.fn();
const createShareLinkDraftMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  getShareLinkManagementState: (...args: unknown[]) =>
    getShareLinkManagementStateMock(...args),
  createShareLinkDraft: (...args: unknown[]) => createShareLinkDraftMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { GET, POST } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function buildRequest(query: string) {
  return new NextRequest(`http://localhost/api/share-links${query}`);
}

function buildPostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/share-links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function buildInvalidJsonPostRequest() {
  return new NextRequest("http://localhost/api/share-links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  });
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
  getShareLinkManagementStateMock.mockReset();
  createShareLinkDraftMock.mockReset();
  consoleErrorSpy.mockClear();
  // Every test below exercises behavior past the availability gate; the
  // gate's own disabled-state behavior is covered separately below.
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET/POST /api/share-links - feature gate", () => {
  it("GET returns 404 NOT_FOUND before authenticating when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(getShareLinkManagementStateMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("POST returns 404 NOT_FOUND before authenticating when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("GET succeeds when the feature is explicitly enabled", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: true,
      data: { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null },
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));

    expect(response.status).toBe(200);
  });
});

describe("GET /api/share-links - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      error: expect.any(String),
    });
    expect(getShareLinkManagementStateMock).not.toHaveBeenCalled();
  });

  it("returns 401 UNAUTHENTICATED when auth.getUser() itself errors", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("session expired"),
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));

    expect(response.status).toBe(401);
  });

  it("maps a repository UNAUTHORIZED result (auth expired between getUser and the RPC call) to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/share-links - validation", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("rejects a missing projectId with 400 INVALID_REQUEST", async () => {
    const response = await GET(buildRequest(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getShareLinkManagementStateMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed projectId with 400 INVALID_REQUEST", async () => {
    const response = await GET(buildRequest("?projectId=not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getShareLinkManagementStateMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase projectId to lowercase before calling the repository", async () => {
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: true,
      data: { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null },
    });

    await GET(buildRequest(`?projectId=${VALID_UUID.toUpperCase()}`));

    expect(getShareLinkManagementStateMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID
    );
  });
});

describe("GET /api/share-links - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 PROJECT_NOT_FOUND when the repository reports PROJECT_NOT_FOUND", async () => {
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns 500 INTERNAL_ERROR for an unexpected repository failure", async () => {
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    getShareLinkManagementStateMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    const loggedText = JSON.stringify(loggedPayload);
    expect(loggedText).not.toContain("P0001");
    expect(loggedText).not.toContain("raw postgres failure");
  });

  it("logs only a fixed category, never error.name or error.message, even when both carry unique sensitive markers", async () => {
    const nameMarker = "SENSITIVE_NAME_MARKER_9f3a";
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    const error = new Error(messageMarker);
    error.name = nameMarker;
    getShareLinkManagementStateMock.mockRejectedValue(error);

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
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
      stage: "share_links.get_management_state",
      category: "Error",
    });
  });

  it("logs a fixed UnknownThrownValue category for a non-Error thrown value", async () => {
    getShareLinkManagementStateMock.mockRejectedValue("SENSITIVE_STRING_MARKER_ab12");

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));

    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    expect(loggedPayload).toEqual({
      stage: "share_links.get_management_state",
      category: "UnknownThrownValue",
    });
  });

  it("returns the repository's parsed data as {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = {
      link: null,
      mappedTasks: [],
      mappedResources: [],
      currentUpdate: null,
    };
    getShareLinkManagementStateMock.mockResolvedValue({ ok: true, data });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(body).not.toHaveProperty("success");
    expect(getShareLinkManagementStateMock).toHaveBeenCalledTimes(1);
    expect(getShareLinkManagementStateMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID
    );
  });

  it("never uses the old {success} field in any response, success or failure", async () => {
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(body).not.toHaveProperty("success");
    expect(body).toHaveProperty("ok");
  });

  it("never leaks secret/PIN/encrypted fields or raw database error codes in the serialized response", async () => {
    const data = {
      link: null,
      mappedTasks: [],
      mappedResources: [],
      currentUpdate: null,
    };
    getShareLinkManagementStateMock.mockResolvedValue({ ok: true, data });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const text = await response.text();

    for (const forbidden of [
      "secretDigest",
      "pinHash",
      "pinSalt",
      "userId",
      "projectId",
      "createdBy",
      "storagePath",
      "P0001",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("POST /api/share-links - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      error: expect.any(String),
    });
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/share-links - validation", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("rejects a missing projectId with 400 INVALID_REQUEST", async () => {
    const response = await POST(buildPostRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed projectId with 400 INVALID_REQUEST", async () => {
    const response = await POST(buildPostRequest({ projectId: "not-a-uuid" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400 INVALID_REQUEST", async () => {
    const response = await POST(buildInvalidJsonPostRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(createShareLinkDraftMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase projectId to lowercase before calling the repository", async () => {
    createShareLinkDraftMock.mockResolvedValue({
      ok: true,
      data: {
        linkId: VALID_UUID,
        publicId: "abcdefgh12345678",
        state: "draft",
        createdAt: "2026-08-06T00:00:00Z",
      },
    });

    await POST(buildPostRequest({ projectId: VALID_UUID.toUpperCase() }));

    expect(createShareLinkDraftMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID
    );
  });
});

describe("POST /api/share-links - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 PROJECT_NOT_FOUND when the repository reports PROJECT_NOT_FOUND", async () => {
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns 409 PROJECT_ARCHIVED when the repository reports PROJECT_ARCHIVED", async () => {
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_ARCHIVED" },
    });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PROJECT_ARCHIVED");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected repository failure (including collision exhaustion or crypto failure)", async () => {
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    createShareLinkDraftMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("returns 201 with {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = {
      linkId: VALID_UUID,
      publicId: "abcdefgh12345678",
      state: "draft",
      createdAt: "2026-08-06T00:00:00Z",
    };
    createShareLinkDraftMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(body).not.toHaveProperty("success");
    expect(createShareLinkDraftMock).toHaveBeenCalledTimes(1);
    expect(createShareLinkDraftMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID
    );
  });

  it("never leaks a secret or raw database error code in the serialized response", async () => {
    const data = {
      linkId: VALID_UUID,
      publicId: "abcdefgh12345678",
      state: "draft",
      createdAt: "2026-08-06T00:00:00Z",
    };
    createShareLinkDraftMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    const text = await response.text();

    for (const forbidden of ["secret", "digest", "ciphertext", "pinHash", "P0001"]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("GET/POST /api/share-links - explicit no-store headers on every response branch", () => {
  it("GET: 401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("GET: 400 INVALID_REQUEST response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const response = await GET(buildRequest(""));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("GET: 404 PROJECT_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("GET: 500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("GET: 200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    getShareLinkManagementStateMock.mockResolvedValue({
      ok: true,
      data: { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null },
    });
    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });

  it("POST: 401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("POST: 400 INVALID_REQUEST response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const response = await POST(buildPostRequest({}));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("POST: 404 PROJECT_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("POST: 409 PROJECT_ARCHIVED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_ARCHIVED" },
    });
    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("POST: 500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    createShareLinkDraftMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("POST: 201 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    createShareLinkDraftMock.mockResolvedValue({
      ok: true,
      data: {
        linkId: VALID_UUID,
        publicId: "abcdefgh12345678",
        state: "draft",
        createdAt: "2026-08-06T00:00:00Z",
      },
    });
    const response = await POST(buildPostRequest({ projectId: VALID_UUID }));
    expect(response.status).toBe(201);
    expectNoStoreHeaders(response);
  });
});
