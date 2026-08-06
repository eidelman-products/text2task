import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const listShareLinkSummariesMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  listShareLinkSummaries: (...args: unknown[]) => listShareLinkSummariesMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";

function uuidLike(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
}

function buildRequest(query: string) {
  return new NextRequest(`http://localhost/api/share-links/summary${query}`);
}

function validSummaryEntry(projectId: string) {
  return {
    projectId,
    linkId: null,
    state: null,
    expiresAt: null,
    hasPin: false,
    createdAt: null,
    lastViewedAt: null,
    viewCount: 0,
    taskCount: 0,
    resourceCount: 0,
    unreadCount: null,
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
  listShareLinkSummariesMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("GET /api/share-links/summary - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      error: expect.any(String),
    });
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result (auth expired between getUser and the RPC call) to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    listShareLinkSummariesMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/share-links/summary - validation", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("rejects a missing projectIds param with 400 INVALID_REQUEST", async () => {
    const response = await GET(buildRequest(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("rejects an empty projectIds value with 400 INVALID_REQUEST", async () => {
    const response = await GET(buildRequest("?projectIds="));
    expect(response.status).toBe(400);
  });

  it("rejects a malformed uuid in the list with 400 INVALID_REQUEST", async () => {
    const response = await GET(buildRequest(`?projectIds=${VALID_UUID},not-a-uuid`));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("rejects more than 100 raw project id entries", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => uuidLike(i)).join(",");
    const response = await GET(buildRequest(`?projectIds=${ids}`));
    expect(response.status).toBe(400);
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("rejects 101 repeated copies of one valid uuid -- the raw count is checked before dedup", async () => {
    const ids = Array.from({ length: 101 }, () => VALID_UUID).join(",");
    const response = await GET(buildRequest(`?projectIds=${ids}`));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("accepts exactly 100 raw, distinct project ids", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => uuidLike(i));
    listShareLinkSummariesMock.mockResolvedValue({
      ok: true,
      data: Object.fromEntries(ids.map((id) => [id, validSummaryEntry(id)])),
    });

    const response = await GET(buildRequest(`?projectIds=${ids.join(",")}`));

    expect(response.status).toBe(200);
  });

  it("returns 400 INVALID_REQUEST for an empty segment between two valid uuids (uuid,,uuid) -- empty segments are never silently dropped", async () => {
    const response = await GET(
      buildRequest(`?projectIds=${VALID_UUID},,${VALID_UUID_2}`)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for a leading comma", async () => {
    const response = await GET(buildRequest(`?projectIds=,${VALID_UUID}`));
    expect(response.status).toBe(400);
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for a trailing comma", async () => {
    const response = await GET(buildRequest(`?projectIds=${VALID_UUID},`));
    expect(response.status).toBe(400);
    expect(listShareLinkSummariesMock).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace around valid segments and still succeeds", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: true,
      data: {
        [VALID_UUID]: validSummaryEntry(VALID_UUID),
        [VALID_UUID_2]: validSummaryEntry(VALID_UUID_2),
      },
    });

    await GET(buildRequest(`?projectIds= ${VALID_UUID} , ${VALID_UUID_2} `));

    expect(listShareLinkSummariesMock).toHaveBeenCalledWith(expect.anything(), [
      VALID_UUID,
      VALID_UUID_2,
    ]);
  });

  it("deduplicates repeated project ids while preserving first-occurrence order", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: true,
      data: {
        [VALID_UUID]: validSummaryEntry(VALID_UUID),
        [VALID_UUID_2]: validSummaryEntry(VALID_UUID_2),
      },
    });

    await GET(
      buildRequest(`?projectIds=${VALID_UUID_2},${VALID_UUID},${VALID_UUID_2}`)
    );

    expect(listShareLinkSummariesMock).toHaveBeenCalledWith(expect.anything(), [
      VALID_UUID_2,
      VALID_UUID,
    ]);
  });

  it("canonicalizes an uppercase uuid to lowercase before calling the repository", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });

    await GET(buildRequest(`?projectIds=${VALID_UUID.toUpperCase()}`));

    expect(listShareLinkSummariesMock).toHaveBeenCalledWith(expect.anything(), [
      VALID_UUID,
    ]);
  });

  it("case-only duplicates (same uuid, different letter case) become one repository argument", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });

    await GET(
      buildRequest(`?projectIds=${VALID_UUID.toUpperCase()},${VALID_UUID}`)
    );

    expect(listShareLinkSummariesMock).toHaveBeenCalledWith(expect.anything(), [
      VALID_UUID,
    ]);
  });
});

describe("GET /api/share-links/summary - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 PROJECT_NOT_FOUND when the repository reports PROJECT_NOT_FOUND (no partial results)", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID},${VALID_UUID_2}`));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns 500 INTERNAL_ERROR for an unexpected repository failure", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    listShareLinkSummariesMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
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
    listShareLinkSummariesMock.mockRejectedValue(error);

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
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
      stage: "share_links.list_summaries",
      category: "Error",
    });
  });

  it("logs a fixed UnknownThrownValue category for a non-Error thrown value", async () => {
    listShareLinkSummariesMock.mockRejectedValue("SENSITIVE_STRING_MARKER_ab12");

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));

    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    expect(loggedPayload).toEqual({
      stage: "share_links.list_summaries",
      category: "UnknownThrownValue",
    });
  });

  it("returns the repository's parsed data as {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = { [VALID_UUID]: validSummaryEntry(VALID_UUID) };
    listShareLinkSummariesMock.mockResolvedValue({ ok: true, data });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(body).not.toHaveProperty("success");
    expect(listShareLinkSummariesMock).toHaveBeenCalledTimes(1);
    expect(listShareLinkSummariesMock).toHaveBeenCalledWith(expect.anything(), [
      VALID_UUID,
    ]);
  });

  it("never uses the old {success} field in any response, success or failure", async () => {
    listShareLinkSummariesMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    const body = await response.json();

    expect(body).not.toHaveProperty("success");
    expect(body).toHaveProperty("ok");
  });

  it("never leaks secret/PIN/encrypted fields or raw database error codes in the serialized response", async () => {
    const data = { [VALID_UUID]: validSummaryEntry(VALID_UUID) };
    listShareLinkSummariesMock.mockResolvedValue({ ok: true, data });

    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    const text = await response.text();

    for (const forbidden of [
      "secretDigest",
      "pinHash",
      "pinSalt",
      "createdBy",
      "storagePath",
      "taskTitle",
      "resourceLabel",
      "updateBody",
      "P0001",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("GET /api/share-links/summary - explicit no-store headers on every response branch", () => {
  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("400 INVALID_REQUEST response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const response = await GET(buildRequest(""));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("404 PROJECT_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    listShareLinkSummariesMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    listShareLinkSummariesMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    listShareLinkSummariesMock.mockResolvedValue({
      ok: true,
      data: { [VALID_UUID]: validSummaryEntry(VALID_UUID) },
    });
    const response = await GET(buildRequest(`?projectIds=${VALID_UUID}`));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});
