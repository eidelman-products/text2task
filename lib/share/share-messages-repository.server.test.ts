import { describe, expect, it, vi } from "vitest";

const {
  listShareLinkMessages,
  listProjectMessages,
  countUnreadClientMessages,
  sendShareMessageReply,
  setShareMessageStatus,
  SHARE_MESSAGE_PHASE5_STATUSES,
} = await import("./share-messages-repository.server");

const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";
const VALID_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";
const VALID_PARENT_ID = "55555555-5555-4555-8555-555555555555";
const VALID_TIMESTAMP = "2026-08-19T00:00:00Z";

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_MESSAGE_ID,
    share_link_id: VALID_LINK_ID,
    project_id: VALID_PROJECT_ID,
    author_type: "client",
    author_display_name: null,
    body: "Hello, is this on track?",
    parent_id: null,
    is_visible_to_client: true,
    status: "new",
    reviewed_at: null,
    resolved_at: null,
    created_at: VALID_TIMESTAMP,
    updated_at: VALID_TIMESTAMP,
    ...overrides,
  };
}

/** A minimal chainable query-builder stand-in, matching the exact shape
 * client-share-projection.server.test.ts's own makeQueryBuilder uses:
 * `.eq()`/`.order()` are no-op passthroughs, and the builder is itself
 * a thenable resolving to the configured result. */
function makeSelectResult(result: { data: unknown; error: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {
    eq: () => builder,
    order: () => builder,
    then: (
      resolve: (value: typeof result) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function buildFakeClient(config: {
  selectResult?: { data: unknown; error: unknown; count?: number | null };
  rpcData?: unknown;
  rpcError?: unknown;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: config.rpcData ?? null, error: config.rpcError ?? null });
  const from = vi.fn((_table: string) => ({
    select: (_columns: string, _options?: unknown) =>
      makeSelectResult(config.selectResult ?? { data: [], error: null }),
  }));
  return { rpc, from };
}

describe("listShareLinkMessages", () => {
  it("returns the mapped, chronological message list", async () => {
    const client = buildFakeClient({ selectResult: { data: [validRow()], error: null } });

    const result = await listShareLinkMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        {
          id: VALID_MESSAGE_ID,
          shareLinkId: VALID_LINK_ID,
          projectId: VALID_PROJECT_ID,
          authorType: "client",
          authorDisplayName: null,
          body: "Hello, is this on track?",
          parentId: null,
          isVisibleToClient: true,
          status: "new",
          reviewedAt: null,
          resolvedAt: null,
          createdAt: VALID_TIMESTAMP,
          updatedAt: VALID_TIMESTAMP,
        },
      ]);
    }
  });

  it("scopes the read by share_link_id AND user_id explicitly (defense-in-depth beyond RLS)", async () => {
    const client = buildFakeClient({ selectResult: { data: [], error: null } });
    const eqSpy = vi.fn().mockReturnThis();

    const scopedBuilder: Record<string, unknown> = {
      eq: eqSpy,
      order: () => scopedBuilder,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    client.from = vi.fn(() => ({ select: () => scopedBuilder }));

    await listShareLinkMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(eqSpy).toHaveBeenCalledWith("share_link_id", VALID_LINK_ID);
    expect(eqSpy).toHaveBeenCalledWith("user_id", VALID_USER_ID);
  });

  it("returns a Note-shaped or malformed row as UNEXPECTED rather than throwing", async () => {
    const client = buildFakeClient({ selectResult: { data: [{ garbage: true }], error: null } });
    const result = await listShareLinkMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("returns UNEXPECTED on a query error, never throwing", async () => {
    const client = buildFakeClient({ selectResult: { data: null, error: { message: "boom" } } });
    const result = await listShareLinkMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("preserves a 'converted' status on read (Phase 6 may have set it) without rejecting the row", async () => {
    const client = buildFakeClient({
      selectResult: { data: [validRow({ status: "converted", reviewed_at: VALID_TIMESTAMP })], error: null },
    });
    const result = await listShareLinkMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0].status).toBe("converted");
  });
});

describe("listProjectMessages", () => {
  it("returns the mapped, newest-first message list", async () => {
    const client = buildFakeClient({ selectResult: { data: [validRow()], error: null } });
    const result = await listProjectMessages(client, { projectId: VALID_PROJECT_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });
});

describe("countUnreadClientMessages", () => {
  it("returns the exact count, using the head+count query shape (no row bodies)", async () => {
    const client = buildFakeClient({ selectResult: { data: null, error: null, count: 3 } });
    const result = await countUnreadClientMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result).toEqual({ ok: true, data: 3 });
  });

  it("returns 0 correctly (not falsy-treated as an error)", async () => {
    const client = buildFakeClient({ selectResult: { data: null, error: null, count: 0 } });
    const result = await countUnreadClientMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result).toEqual({ ok: true, data: 0 });
  });

  it("fails closed (UNEXPECTED) when count is missing/null", async () => {
    const client = buildFakeClient({ selectResult: { data: null, error: null, count: null } });
    const result = await countUnreadClientMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("scopes by author_type='client' and status='new' explicitly", async () => {
    const eqCalls: unknown[][] = [];
    const client = buildFakeClient({});
    const scopedBuilder: Record<string, unknown> = {
      eq: (...args: unknown[]) => {
        eqCalls.push(args);
        return scopedBuilder;
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, count: 0 }).then(resolve),
    };
    client.from = vi.fn(() => ({ select: () => scopedBuilder }));

    await countUnreadClientMessages(client, { shareLinkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(eqCalls).toContainEqual(["author_type", "client"]);
    expect(eqCalls).toContainEqual(["status", "new"]);
  });
});

describe("sendShareMessageReply", () => {
  it("calls send_share_message_reply with the exact canonical parameters", async () => {
    const client = buildFakeClient({
      rpcData: {
        messageId: VALID_MESSAGE_ID,
        shareLinkId: VALID_LINK_ID,
        parentId: VALID_PARENT_ID,
        authorType: "owner",
        createdAt: VALID_TIMESTAMP,
      },
    });

    const result = await sendShareMessageReply(client, {
      shareLinkId: VALID_LINK_ID,
      parentMessageId: VALID_PARENT_ID,
      body: "Thanks, on track for Friday.",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        messageId: VALID_MESSAGE_ID,
        shareLinkId: VALID_LINK_ID,
        parentId: VALID_PARENT_ID,
        authorType: "owner",
        createdAt: VALID_TIMESTAMP,
      },
    });
    expect(client.rpc).toHaveBeenCalledWith("send_share_message_reply", {
      p_share_link_id: VALID_LINK_ID,
      p_parent_message_id: VALID_PARENT_ID,
      p_body: "Thanks, on track for Friday.",
    });
  });

  it.each([
    ["UNAUTHORIZED", "UNAUTHORIZED"],
    ["SHARE_LINK_NOT_FOUND", "SHARE_LINK_NOT_FOUND"],
    ["SHARE_MESSAGE_PARENT_NOT_FOUND", "SHARE_MESSAGE_PARENT_NOT_FOUND"],
    ["SHARE_MESSAGE_PARENT_LINK_MISMATCH", "SHARE_MESSAGE_PARENT_LINK_MISMATCH"],
    ["SHARE_MESSAGE_BODY_EMPTY", "INVALID_REQUEST"],
    ["SHARE_MESSAGE_BODY_TOO_LONG", "INVALID_REQUEST"],
    ["SOMETHING_UNMAPPED", "UNEXPECTED"],
  ])("maps RPC error message %s to repository code %s", async (rpcMessage, expectedCode) => {
    const client = buildFakeClient({ rpcError: { code: "P0001", message: rpcMessage } });
    const result = await sendShareMessageReply(client, {
      shareLinkId: VALID_LINK_ID,
      parentMessageId: VALID_PARENT_ID,
      body: "x",
    });
    expect(result).toEqual({ ok: false, error: { code: expectedCode } });
  });

  it("returns UNEXPECTED when the RPC result does not match the expected shape", async () => {
    const client = buildFakeClient({ rpcData: { garbage: true } });
    const result = await sendShareMessageReply(client, {
      shareLinkId: VALID_LINK_ID,
      parentMessageId: VALID_PARENT_ID,
      body: "x",
    });
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("setShareMessageStatus", () => {
  it("only accepts the four Phase 5 statuses at the type level", () => {
    expect(SHARE_MESSAGE_PHASE5_STATUSES).toEqual(["new", "reviewed", "resolved", "dismissed"]);
    expect(SHARE_MESSAGE_PHASE5_STATUSES).not.toContain("converted");
  });

  it.each(SHARE_MESSAGE_PHASE5_STATUSES)("calls set_share_message_status with status=%s", async (status) => {
    const client = buildFakeClient({
      rpcData: { messageId: VALID_MESSAGE_ID, status, reviewedAt: null, resolvedAt: null },
    });

    const result = await setShareMessageStatus(client, { messageId: VALID_MESSAGE_ID, status });

    expect(result.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("set_share_message_status", {
      p_message_id: VALID_MESSAGE_ID,
      p_status: status,
    });
  });

  it.each([
    ["UNAUTHORIZED", "UNAUTHORIZED"],
    ["SHARE_MESSAGE_NOT_FOUND", "SHARE_MESSAGE_NOT_FOUND"],
    ["SHARE_MESSAGE_STATUS_INVALID", "INVALID_REQUEST"],
    ["SOMETHING_UNMAPPED", "UNEXPECTED"],
  ])("maps RPC error message %s to repository code %s", async (rpcMessage, expectedCode) => {
    const client = buildFakeClient({ rpcError: { code: "P0001", message: rpcMessage } });
    const result = await setShareMessageStatus(client, { messageId: VALID_MESSAGE_ID, status: "reviewed" });
    expect(result).toEqual({ ok: false, error: { code: expectedCode } });
  });

  it("returns UNEXPECTED when the RPC result does not match the expected shape", async () => {
    const client = buildFakeClient({ rpcData: { garbage: true } });
    const result = await setShareMessageStatus(client, { messageId: VALID_MESSAGE_ID, status: "reviewed" });
    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

/** Strips /* *\/ block comments and // line comments so a Phase-6-boundary
 * check reads only executable code -- this file's own header/doc
 * comments correctly NAME share_message_conversions/project_updates
 * while explaining they are never touched, which must not itself fail
 * the check (the same distinction the SQL migration tests draw between
 * `code` and `normalizedExecutable`). */
function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("Phase 6 boundary -- this repository file", () => {
  it("never references share_message_conversions, project_updates, or project_timeline_events outside comments", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./share-messages-repository.server.ts", import.meta.url), "utf8")
    );
    const executable = stripJsComments(source);
    for (const forbidden of ["share_message_conversions", "project_updates", "project_timeline_events"]) {
      expect(executable).not.toContain(forbidden);
    }
  });

  it("never performs a direct insert/update against share_messages -- writes go through the RPCs only", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./share-messages-repository.server.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/\.from\(["']share_messages["']\)\s*\.\s*insert/);
    expect(source).not.toMatch(/\.from\(["']share_messages["']\)\s*\.\s*update/);
  });

  it("never sends status: 'converted' as an RPC write parameter", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./share-messages-repository.server.ts", import.meta.url), "utf8")
    );
    // The only occurrences of the literal 'converted' allowed in this
    // file are inside the READ-side schema (accepting a value Phase 6
    // may have already written) -- never as a value passed to `.rpc(`.
    const rpcCallBlocks = source.match(/client\.rpc\([\s\S]*?\);/g) ?? [];
    for (const block of rpcCallBlocks) {
      expect(block).not.toContain("converted");
    }
  });
});
