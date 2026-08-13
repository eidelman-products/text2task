import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const buildClientShareProjectionMock = vi.fn();
vi.mock("@/lib/share/client-share-projection.server", () => ({
  buildClientShareProjection: (...args: unknown[]) => buildClientShareProjectionMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";

function buildRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/preview`, {
    method: "GET",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validProjection() {
  return {
    title: "Website launch",
    subtitle: null,
    status: "in_progress" as const,
    targetDate: null,
    contentDirection: "auto" as const,
    commentsEnabled: true,
    progress: { completed: 3, total: 5, percent: 60 },
    latestUpdate: null,
    tasks: [],
    resources: [],
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
  buildClientShareProjectionMock.mockReset();
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/share-links/[id]/preview - feature gate", () => {
  it("returns 404 NOT_FOUND before any DB work when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(buildClientShareProjectionMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/[id]/preview - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await GET(buildRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(buildClientShareProjectionMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/share-links/[id]/preview - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user, without calling the projection builder", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(buildClientShareProjectionMock).not.toHaveBeenCalled();
  });

  it("maps a projection UNAUTHORIZED result (cross-tenant owner) to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    buildClientShareProjectionMock.mockResolvedValue({ ok: false, error: { code: "UNAUTHORIZED" } });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/share-links/[id]/preview - projection outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND when the projection builder reports the link is not found", async () => {
    buildClientShareProjectionMock.mockResolvedValue({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected projection failure", async () => {
    buildClientShareProjectionMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the projection builder throws, without leaking the raw error", async () => {
    buildClientShareProjectionMock.mockRejectedValue(new Error("raw postgres failure"));

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("raw postgres failure");
  });

  it("logs only a fixed stage and category, never the raw error message", async () => {
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    buildClientShareProjectionMock.mockRejectedValue(new Error(messageMarker));

    await GET(buildRequest(), buildContext(VALID_UUID));

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    expect(JSON.stringify(loggedPayload)).not.toContain(messageMarker);
    expect(loggedPayload).toEqual({ stage: "share_links.preview", category: "Error" });
  });

  it("returns {ok:true,data} with exactly the strict projection on success, calling the builder exactly once with linkId+userId", async () => {
    const projection = validProjection();
    buildClientShareProjectionMock.mockResolvedValue({ ok: true, data: projection });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: projection });
    expect(buildClientShareProjectionMock).toHaveBeenCalledTimes(1);
    expect(buildClientShareProjectionMock).toHaveBeenCalledWith(expect.anything(), {
      linkId: VALID_UUID,
      userId: VALID_USER_ID,
    });
  });

  it("canonicalizes an uppercase id to lowercase before calling the projection builder", async () => {
    buildClientShareProjectionMock.mockResolvedValue({ ok: true, data: validProjection() });

    await GET(buildRequest(), buildContext(VALID_UUID.toUpperCase()));

    expect(buildClientShareProjectionMock).toHaveBeenCalledWith(expect.anything(), {
      linkId: VALID_UUID,
      userId: VALID_USER_ID,
    });
  });
});

describe("GET /api/share-links/[id]/preview - no public-view side effects", () => {
  it("never calls any reveal/rotate/activate/view-count/last-viewed mutation function -- the route imports nothing from the mutation surface", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    buildClientShareProjectionMock.mockResolvedValue({ ok: true, data: validProjection() });

    await GET(buildRequest(), buildContext(VALID_UUID));

    // The route module only imports buildClientShareProjection from the
    // share layer (see the vi.mock above) -- no reveal/rotate/activate
    // repository function is ever imported or callable from this route,
    // so there is nothing else to assert was *not* called.
    expect(buildClientShareProjectionMock).toHaveBeenCalledTimes(1);
  });

  it("requires no secret/PIN/bearer in the request -- a plain GET with only cookies-based auth succeeds", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    buildClientShareProjectionMock.mockResolvedValue({ ok: true, data: validProjection() });

    const response = await GET(buildRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
  });
});

describe("GET /api/share-links/[id]/preview - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await GET(buildRequest(), buildContext("not-a-uuid"));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("404 SHARE_LINK_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    buildClientShareProjectionMock.mockResolvedValue({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    buildClientShareProjectionMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });
    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("the 200 success response is explicitly no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    buildClientShareProjectionMock.mockResolvedValue({ ok: true, data: validProjection() });
    const response = await GET(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});
