import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const resolveMostRecentShareLinkMock = vi.fn();
vi.mock("@/lib/share/share-messages-repository.server", () => ({
  resolveMostRecentShareLink: (...args: unknown[]) => resolveMostRecentShareLinkMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_LINK_ID = "22222222-2222-4222-8222-222222222222";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";

function buildRequest(query: string) {
  return new NextRequest(`http://localhost/api/share-links/history-link${query}`);
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
}

beforeEach(() => {
  getUserMock.mockReset();
  resolveMostRecentShareLinkMock.mockReset();
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/share-links/history-link - feature gate", () => {
  it("returns 404 NOT_FOUND before any DB work when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/history-link - authentication", () => {
  it("returns 401 UNAUTHENTICATED when unauthenticated, before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(resolveMostRecentShareLinkMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/history-link - validation", () => {
  it("rejects a missing/invalid projectId with 400 INVALID_REQUEST", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await GET(buildRequest("?projectId=not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(resolveMostRecentShareLinkMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/history-link - resolution", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  });

  it("returns linkId + state when a historical link is found", async () => {
    resolveMostRecentShareLinkMock.mockResolvedValue({
      ok: true,
      data: { linkId: VALID_LINK_ID, state: "revoked" },
    });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { linkId: VALID_LINK_ID, state: "revoked" } });
  });

  it("returns {linkId:null, state:null} when the project has no share link at all", async () => {
    resolveMostRecentShareLinkMock.mockResolvedValue({ ok: true, data: null });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { linkId: null, state: null } });
  });

  it("calls the repository with exactly the authenticated userId and the requested projectId", async () => {
    resolveMostRecentShareLinkMock.mockResolvedValue({ ok: true, data: null });

    await GET(buildRequest(`?projectId=${VALID_UUID}`));

    expect(resolveMostRecentShareLinkMock).toHaveBeenCalledWith(expect.anything(), {
      projectId: VALID_UUID,
      userId: VALID_USER_ID,
    });
  });

  it("maps a repository failure to a generic 500, never leaking details", async () => {
    resolveMostRecentShareLinkMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns a generic 500 when the repository throws, without leaking the raw error", async () => {
    resolveMostRecentShareLinkMock.mockRejectedValue(new Error("raw postgres failure"));

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("raw postgres failure");
  });
});

describe("GET /api/share-links/history-link - no-store headers", () => {
  it("200 response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    resolveMostRecentShareLinkMock.mockResolvedValue({ ok: true, data: null });

    const response = await GET(buildRequest(`?projectId=${VALID_UUID}`));
    expectNoStoreHeaders(response);
  });

  it("400 response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await GET(buildRequest("?projectId=not-a-uuid"));
    expectNoStoreHeaders(response);
  });
});

describe("GET /api/share-links/history-link - read-only guarantee", () => {
  it("this route imports no mutation function (activate/enable/revoke/delete) -- source-level check", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/activateShareLink|reenableShareLink|revokeShareLink|createShareLinkDraft/);
  });
});
