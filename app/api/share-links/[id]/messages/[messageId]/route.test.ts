import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const setShareMessageStatusMock = vi.fn();
const verifyOwnedShareMessageBelongsToLinkMock = vi.fn();
vi.mock("@/lib/share/share-messages-repository.server", () => ({
  setShareMessageStatus: (...args: unknown[]) => setShareMessageStatusMock(...args),
  verifyOwnedShareMessageBelongsToLink: (...args: unknown[]) =>
    verifyOwnedShareMessageBelongsToLinkMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { PATCH } = await import("./route");

const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

function buildRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/share-links/${VALID_LINK_ID}/messages/${VALID_MESSAGE_ID}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function buildContext(id: string, messageId: string) {
  return { params: Promise.resolve({ id, messageId }) };
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  setShareMessageStatusMock.mockReset();
  verifyOwnedShareMessageBelongsToLinkMock
    .mockReset()
    .mockResolvedValue({ ok: true, data: { id: VALID_MESSAGE_ID } });
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - feature gate", () => {
  it("returns 404 NOT_FOUND before any DB work when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - path validation", () => {
  it("rejects an invalid link id", async () => {
    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext("not-a-uuid", VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid messageId", async () => {
    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, "not-a-uuid")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - status vocabulary", () => {
  it.each(["new", "reviewed", "resolved", "dismissed"])("accepts status=%s", async (status) => {
    setShareMessageStatusMock.mockResolvedValue({
      ok: true,
      data: { messageId: VALID_MESSAGE_ID, status, reviewedAt: null, resolvedAt: null },
    });

    const response = await PATCH(buildRequest({ status }), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));

    expect(response.status).toBe(200);
    expect(setShareMessageStatusMock).toHaveBeenCalledWith(expect.anything(), {
      messageId: VALID_MESSAGE_ID,
      status,
    });
  });

  it("rejects status='converted' before calling the repository -- Phase 6 is never reachable through this route", async () => {
    const response = await PATCH(
      buildRequest({ status: "converted" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_STATUS_INVALID");
    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
    expect(verifyOwnedShareMessageBelongsToLinkMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown status value", async () => {
    const response = await PATCH(
      buildRequest({ status: "archived" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_STATUS_INVALID");
    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
  });

  it("rejects a missing status field", async () => {
    const response = await PATCH(buildRequest({}), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_STATUS_INVALID");
  });

  it("rejects unknown extra fields (e.g. caller-supplied reviewedAt/resolvedAt)", async () => {
    const response = await PATCH(
      buildRequest({ status: "reviewed", reviewedAt: "2020-01-01T00:00:00Z" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );

    expect(response.status).toBe(400);
    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - authentication", () => {
  it("returns 401 UNAUTHENTICATED when unauthenticated, before any ownership check", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(verifyOwnedShareMessageBelongsToLinkMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - cross-owner / cross-link mutation is impossible", () => {
  it("verifies ownership using the path's own linkId, messageId, and the authenticated userId", async () => {
    setShareMessageStatusMock.mockResolvedValue({
      ok: true,
      data: { messageId: VALID_MESSAGE_ID, status: "reviewed", reviewedAt: "2026-08-19T00:00:00Z", resolvedAt: null },
    });

    await PATCH(buildRequest({ status: "reviewed" }), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));

    expect(verifyOwnedShareMessageBelongsToLinkMock).toHaveBeenCalledWith(expect.anything(), {
      messageId: VALID_MESSAGE_ID,
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });
  });

  it("denies (404) a message that does not belong to this link/owner, without ever calling set_share_message_status", async () => {
    verifyOwnedShareMessageBelongsToLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_MESSAGE_NOT_FOUND" },
    });

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_MESSAGE_NOT_FOUND");
    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
  });

  it("denies a same-owner, cross-link mutation attempt (the [id] path segment is not decorative)", async () => {
    // A different link id than the one the messageId actually belongs
    // to -- the repository check is the one that would fail in reality;
    // this test proves the route calls it with exactly the path's own
    // linkId, so a mismatched link genuinely reaches (and is rejected
    // by) that check rather than being silently ignored.
    verifyOwnedShareMessageBelongsToLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_MESSAGE_NOT_FOUND" },
    });

    const otherLinkId = "77777777-7777-4777-8777-777777777777";
    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(otherLinkId, VALID_MESSAGE_ID)
    );

    expect(verifyOwnedShareMessageBelongsToLinkMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ shareLinkId: otherLinkId })
    );
    expect(response.status).toBe(404);
    expect(setShareMessageStatusMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - repository error mapping", () => {
  it("maps UNAUTHORIZED to 401 UNAUTHENTICATED", async () => {
    setShareMessageStatusMock.mockResolvedValue({ ok: false, error: { code: "UNAUTHORIZED" } });

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });

  it("maps SHARE_MESSAGE_NOT_FOUND from the RPC itself to 404", async () => {
    setShareMessageStatusMock.mockResolvedValue({ ok: false, error: { code: "SHARE_MESSAGE_NOT_FOUND" } });

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_MESSAGE_NOT_FOUND");
  });

  it("maps an unexpected repository failure to a generic 500, never leaking details", async () => {
    setShareMessageStatusMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns a generic 500 when the repository throws, without leaking the raw error", async () => {
    setShareMessageStatusMock.mockRejectedValue(new Error("raw postgres failure"));

    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("raw postgres failure");
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - success / immutable fields", () => {
  it("returns exactly the minimal updated workflow state from the RPC (messageId, status, reviewedAt, resolvedAt)", async () => {
    const rpcResult = {
      messageId: VALID_MESSAGE_ID,
      status: "resolved",
      reviewedAt: "2026-08-19T00:00:00Z",
      resolvedAt: "2026-08-19T00:05:00Z",
    };
    setShareMessageStatusMock.mockResolvedValue({ ok: true, data: rpcResult });

    const response = await PATCH(
      buildRequest({ status: "resolved" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: rpcResult });
  });

  it("never recomputes reviewedAt/resolvedAt in the route -- it returns exactly what the repository/RPC returned", async () => {
    const rpcResult = { messageId: VALID_MESSAGE_ID, status: "dismissed", reviewedAt: "X", resolvedAt: null };
    setShareMessageStatusMock.mockResolvedValue({ ok: true, data: rpcResult });

    const response = await PATCH(
      buildRequest({ status: "dismissed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    const body = await response.json();

    expect(body.data.reviewedAt).toBe("X");
    expect(body.data.resolvedAt).toBeNull();
  });
});

describe("PATCH /api/share-links/[id]/messages/[messageId] - no-store headers", () => {
  it("400 response is no-store", async () => {
    const response = await PATCH(
      buildRequest({ status: "converted" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    expectNoStoreHeaders(response);
  });

  it("200 response is no-store", async () => {
    setShareMessageStatusMock.mockResolvedValue({
      ok: true,
      data: { messageId: VALID_MESSAGE_ID, status: "reviewed", reviewedAt: "X", resolvedAt: null },
    });
    const response = await PATCH(
      buildRequest({ status: "reviewed" }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );
    expectNoStoreHeaders(response);
  });
});
