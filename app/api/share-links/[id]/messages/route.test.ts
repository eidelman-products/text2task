import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const getOwnerShareLinkMessagesMock = vi.fn();
vi.mock("@/lib/share/share-messages-repository.server", () => ({
  getOwnerShareLinkMessages: (...args: unknown[]) => getOwnerShareLinkMessagesMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";

function buildRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/messages`, {
    method: "GET",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    shareLinkId: VALID_UUID,
    projectId: "22222222-2222-4222-8222-222222222222",
    authorType: "client",
    authorDisplayName: "Jane",
    body: "Any update?",
    parentId: null,
    isVisibleToClient: true,
    status: "new",
    reviewedAt: null,
    resolvedAt: null,
    createdAt: "2026-08-19T00:00:00Z",
    updatedAt: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
}

beforeEach(() => {
  getUserMock.mockReset();
  getOwnerShareLinkMessagesMock.mockReset();
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/share-links/[id]/messages - feature gate", () => {
  it("returns 404 NOT_FOUND before any DB work when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/[id]/messages - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await GET(buildRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/[id]/messages - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user (unauthenticated denied)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(getOwnerShareLinkMessagesMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/[id]/messages - cross-owner denial", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  });

  it("maps SHARE_LINK_NOT_FOUND (a cross-owner or nonexistent link) to 404, not empty success", async () => {
    getOwnerShareLinkMessagesMock.mockResolvedValue({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });
});

describe("GET /api/share-links/[id]/messages - success", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  });

  it("returns the link-scoped message list with internal ids and workflow fields, plus unreadCount", async () => {
    getOwnerShareLinkMessagesMock.mockResolvedValue({
      ok: true,
      data: { messages: [validMessage()], unreadCount: 4 },
    });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { messages: [validMessage()], unreadCount: 4 } });
  });

  it("calls the repository exactly once with the canonical shareLinkId + authenticated userId", async () => {
    getOwnerShareLinkMessagesMock.mockResolvedValue({ ok: true, data: { messages: [], unreadCount: 0 } });

    await GET(buildRequest(), buildContext(VALID_UUID));

    expect(getOwnerShareLinkMessagesMock).toHaveBeenCalledTimes(1);
    expect(getOwnerShareLinkMessagesMock).toHaveBeenCalledWith(expect.anything(), {
      shareLinkId: VALID_UUID,
      userId: VALID_USER_ID,
    });
  });

  it("unreadCount is returned as provided by the repository (index-backed, not recomputed here)", async () => {
    getOwnerShareLinkMessagesMock.mockResolvedValue({ ok: true, data: { messages: [], unreadCount: 7 } });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(body.data.unreadCount).toBe(7);
  });
});

describe("GET /api/share-links/[id]/messages - unexpected errors never leak details", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  });

  it("returns a generic 500 for an UNEXPECTED repository result", async () => {
    getOwnerShareLinkMessagesMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns a generic 500 when the repository throws, without leaking the raw error", async () => {
    getOwnerShareLinkMessagesMock.mockRejectedValue(new Error("raw postgres failure"));

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("raw postgres failure");
  });
});

describe("GET /api/share-links/[id]/messages - no-store headers on every branch", () => {
  it("400 response is no-store", async () => {
    const response = await GET(buildRequest(), buildContext("not-a-uuid"));
    expectNoStoreHeaders(response);
  });

  it("401 response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    expectNoStoreHeaders(response);
  });

  it("200 response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    getOwnerShareLinkMessagesMock.mockResolvedValue({ ok: true, data: { messages: [], unreadCount: 0 } });
    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    expectNoStoreHeaders(response);
  });
});
