import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const sendShareMessageReplyMock = vi.fn();
vi.mock("@/lib/share/share-messages-repository.server", () => ({
  sendShareMessageReply: (...args: unknown[]) => sendShareMessageReplyMock(...args),
}));

// The route imports the REAL validateShareMessageBody from
// share-public-message.server.ts (reused, not reimplemented -- see the
// route's own doc comment). That module's top-level `import {
// supabaseAdmin }` still runs at import time even though this route
// never calls it, so supabaseAdmin itself must be stubbed here too.
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_PARENT_ID = "55555555-5555-4555-8555-555555555555";

function buildRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/messages/reply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validReplyData() {
  return {
    messageId: "66666666-6666-4666-8666-666666666666",
    shareLinkId: VALID_UUID,
    parentId: VALID_PARENT_ID,
    authorType: "owner" as const,
    createdAt: "2026-08-19T00:00:00Z",
  };
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
}

beforeEach(() => {
  getUserMock.mockReset();
  sendShareMessageReplyMock.mockReset();
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/share-links/[id]/messages/reply - feature gate", () => {
  it("returns 404 NOT_FOUND before any DB work when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share-links/[id]/messages/reply - validation", () => {
  it("rejects an invalid uuid link id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext("not-a-uuid")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("rejects a missing parentMessageId", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await POST(buildRequest({ body: "Thanks!" }), buildContext(VALID_UUID));
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.code).toBe("INVALID_REQUEST");
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("rejects an empty body before calling the repository (application-level, not RPC-only)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "   \n\t " }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(400);
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("accepts a 4000-character body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    sendShareMessageReplyMock.mockResolvedValue({ ok: true, data: validReplyData() });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "a".repeat(4000) }),
      buildContext(VALID_UUID)
    );

    expect(response.status).toBe(200);
    expect(sendShareMessageReplyMock).toHaveBeenCalled();
  });

  it("rejects a 4001-character body without calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "a".repeat(4001) }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("rejects unknown extra fields (e.g. caller-supplied authorType/status)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "hi", authorType: "owner", status: "resolved" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });

  it("preserves Hebrew/Arabic/emoji through to the repository call", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    sendShareMessageReplyMock.mockResolvedValue({ ok: true, data: validReplyData() });
    const text = "שלום شكرا 🎉";

    await POST(buildRequest({ parentMessageId: VALID_PARENT_ID, body: text }), buildContext(VALID_UUID));

    expect(sendShareMessageReplyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: text })
    );
  });
});

describe("POST /api/share-links/[id]/messages/reply - authentication", () => {
  it("returns 401 UNAUTHENTICATED when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(sendShareMessageReplyMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/share-links/[id]/messages/reply - repository error mapping", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  });

  it("maps UNAUTHORIZED (cross-owner link) to 401 UNAUTHENTICATED", async () => {
    sendShareMessageReplyMock.mockResolvedValue({ ok: false, error: { code: "UNAUTHORIZED" } });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });

  it("maps SHARE_LINK_NOT_FOUND to 404", async () => {
    sendShareMessageReplyMock.mockResolvedValue({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("maps SHARE_MESSAGE_PARENT_NOT_FOUND (invalid parent) to 404", async () => {
    sendShareMessageReplyMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_MESSAGE_PARENT_NOT_FOUND" },
    });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_MESSAGE_PARENT_NOT_FOUND");
  });

  it("maps SHARE_MESSAGE_PARENT_LINK_MISMATCH (cross-link parent) to 400", async () => {
    sendShareMessageReplyMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_MESSAGE_PARENT_LINK_MISMATCH" },
    });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SHARE_MESSAGE_PARENT_LINK_MISMATCH");
  });

  it("maps an unexpected repository failure to a generic 500, never leaking details", async () => {
    sendShareMessageReplyMock.mockResolvedValue({ ok: false, error: { code: "UNEXPECTED" } });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns a generic 500 when the repository throws, without leaking the raw error", async () => {
    sendShareMessageReplyMock.mockRejectedValue(new Error("raw postgres failure"));

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("raw postgres failure");
  });
});

describe("POST /api/share-links/[id]/messages/reply - success", () => {
  it("calls the repository with exactly the verified shareLinkId, the parentMessageId, and the validated body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    sendShareMessageReplyMock.mockResolvedValue({ ok: true, data: validReplyData() });

    await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks, on track!" }),
      buildContext(VALID_UUID)
    );

    expect(sendShareMessageReplyMock).toHaveBeenCalledWith(expect.anything(), {
      shareLinkId: VALID_UUID,
      parentMessageId: VALID_PARENT_ID,
      body: "Thanks, on track!",
    });
  });

  it("returns minimal owner-useful reply data only", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    sendShareMessageReplyMock.mockResolvedValue({ ok: true, data: validReplyData() });

    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: validReplyData() });
  });
});

describe("POST /api/share-links/[id]/messages/reply - owner reply does not silently mutate the parent client message", () => {
  it("the route source never imports or calls setShareMessageStatus -- a reply is communication, status change is a separate explicit action", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8")
    );
    expect(source).not.toContain("setShareMessageStatus");
  });

  it("a successful reply's own 'reviewed' status (set by the RPC) belongs to the new reply row -- the route passes only parentMessageId/body to sendShareMessageReply, never a status for the parent", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    sendShareMessageReplyMock.mockResolvedValue({ ok: true, data: validReplyData() });

    await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );

    const [, callInput] = sendShareMessageReplyMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(Object.keys(callInput).sort()).toEqual(["body", "parentMessageId", "shareLinkId"]);
  });
});

describe("POST /api/share-links/[id]/messages/reply - no-store headers", () => {
  it("400 response is no-store", async () => {
    const response = await POST(buildRequest({ body: "x" }), buildContext("not-a-uuid"));
    expectNoStoreHeaders(response);
  });

  it("200 response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
    sendShareMessageReplyMock.mockResolvedValue({ ok: true, data: validReplyData() });
    const response = await POST(
      buildRequest({ parentMessageId: VALID_PARENT_ID, body: "Thanks!" }),
      buildContext(VALID_UUID)
    );
    expectNoStoreHeaders(response);
  });
});
