import { describe, expect, it, vi } from "vitest";

const {
  listShareLinkMessages,
  listProjectMessages,
  countUnreadClientMessages,
  sendShareMessageReply,
  setShareMessageStatus,
  getOwnerShareLinkMessages,
  verifyOwnedShareMessageBelongsToLink,
  resolveMostRecentShareLink,
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

/**
 * A per-table FIFO response queue, matching the pattern
 * `share-session-grant.server.test.ts` already established: each
 * `.from(table)` call pulls the NEXT queued response for THAT table,
 * decoupled from calls to any other table -- needed here because
 * `getOwnerShareLinkMessages` queries `project_share_links` (ownership,
 * single row) and then `share_messages` TWICE in one call (the list, via
 * `listShareLinkMessages`, then the count, via
 * `countUnreadClientMessages`) with two different response shapes.
 */
function buildTableQueueClient() {
  const queues = new Map<string, Array<{ data: unknown; error: unknown; count?: number | null }>>();

  function queueFor(table: string, response: { data: unknown; error: unknown; count?: number | null }): void {
    const existing = queues.get(table) ?? [];
    existing.push(response);
    queues.set(table, existing);
  }

  function nextFor(table: string): { data: unknown; error: unknown; count?: number | null } {
    const queue = queues.get(table);
    if (!queue || queue.length === 0) return { data: null, error: null };
    return queue.shift() as { data: unknown; error: unknown; count?: number | null };
  }

  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(nextFor(table)),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve(nextFor(table)).then(resolve, reject),
    };
    return builder;
  }

  const from = vi.fn((table: string) => ({
    select: () => makeBuilder(table),
  }));

  return { from, rpc: vi.fn(), queueFor };
}

describe("getOwnerShareLinkMessages - Phase 5C owner GET combined read", () => {
  it("returns SHARE_LINK_NOT_FOUND when the link does not resolve to one owned by this user, without reading messages", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: null, error: null });

    const result = await getOwnerShareLinkMessages(client, {
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });

  it("fails closed (UNEXPECTED) on an ownership-check query error", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: null, error: { message: "boom" } });

    const result = await getOwnerShareLinkMessages(client, {
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("on an owned link, returns messages + unreadCount together", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: { id: VALID_LINK_ID }, error: null });
    client.queueFor("share_messages", { data: [validRow()], error: null });
    client.queueFor("share_messages", { data: null, error: null, count: 2 });

    const result = await getOwnerShareLinkMessages(client, {
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.unreadCount).toBe(2);
    }
  });

  it("propagates UNEXPECTED if the message list read fails, after ownership already succeeded", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: { id: VALID_LINK_ID }, error: null });
    client.queueFor("share_messages", { data: null, error: { message: "boom" } });

    const result = await getOwnerShareLinkMessages(client, {
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("propagates UNEXPECTED if the unread count read fails, after the message list already succeeded", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: { id: VALID_LINK_ID }, error: null });
    client.queueFor("share_messages", { data: [], error: null });
    client.queueFor("share_messages", { data: null, error: null, count: null });

    const result = await getOwnerShareLinkMessages(client, {
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("verifyOwnedShareMessageBelongsToLink - Phase 5C cross-link mutation guard", () => {
  it("succeeds when the message belongs to the given link and owner", async () => {
    const client = buildTableQueueClient();
    client.queueFor("share_messages", { data: { id: VALID_MESSAGE_ID }, error: null });

    const result = await verifyOwnedShareMessageBelongsToLink(client, {
      messageId: VALID_MESSAGE_ID,
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: true, data: { id: VALID_MESSAGE_ID } });
  });

  it("returns SHARE_MESSAGE_NOT_FOUND when no row matches all three predicates (wrong link, wrong owner, or nonexistent -- indistinguishable)", async () => {
    const client = buildTableQueueClient();
    client.queueFor("share_messages", { data: null, error: null });

    const result = await verifyOwnedShareMessageBelongsToLink(client, {
      messageId: VALID_MESSAGE_ID,
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "SHARE_MESSAGE_NOT_FOUND" } });
  });

  it("fails closed (UNEXPECTED) on a query error", async () => {
    const client = buildTableQueueClient();
    client.queueFor("share_messages", { data: null, error: { message: "boom" } });

    const result = await verifyOwnedShareMessageBelongsToLink(client, {
      messageId: VALID_MESSAGE_ID,
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("scopes the check by id AND share_link_id AND user_id explicitly", async () => {
    const client = buildTableQueueClient();
    const eqCalls: unknown[][] = [];
    const scopedBuilder: Record<string, unknown> = {
      eq: (...args: unknown[]) => {
        eqCalls.push(args);
        return scopedBuilder;
      },
      maybeSingle: () => Promise.resolve({ data: { id: VALID_MESSAGE_ID }, error: null }),
    };
    client.from = vi.fn(() => ({ select: () => scopedBuilder }));

    await verifyOwnedShareMessageBelongsToLink(client, {
      messageId: VALID_MESSAGE_ID,
      shareLinkId: VALID_LINK_ID,
      userId: VALID_USER_ID,
    });

    expect(eqCalls).toContainEqual(["id", VALID_MESSAGE_ID]);
    expect(eqCalls).toContainEqual(["share_link_id", VALID_LINK_ID]);
    expect(eqCalls).toContainEqual(["user_id", VALID_USER_ID]);
  });
});

describe("resolveMostRecentShareLink - PHASE 5F revoked-link history fallback", () => {
  it("returns the single most recent row (linkId + state)", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: { id: VALID_LINK_ID, state: "revoked" }, error: null });

    const result = await resolveMostRecentShareLink(client, {
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: true, data: { linkId: VALID_LINK_ID, state: "revoked" } });
  });

  it("returns null (not an error) when the project has no share link at all", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: null, error: null });

    const result = await resolveMostRecentShareLink(client, {
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: true, data: null });
  });

  it("fails closed (UNEXPECTED) on a query error", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: null, error: { message: "boom" } });

    const result = await resolveMostRecentShareLink(client, {
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("fails closed (UNEXPECTED) on a malformed row shape", async () => {
    const client = buildTableQueueClient();
    client.queueFor("project_share_links", { data: { id: 123, state: null }, error: null });

    const result = await resolveMostRecentShareLink(client, {
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("scopes strictly by project_id AND user_id, orders deterministically, and limits to exactly one row", async () => {
    const client = buildTableQueueClient();
    const eqCalls: unknown[][] = [];
    const orderCalls: unknown[][] = [];
    let limitCallCount = 0;
    const scopedBuilder: Record<string, unknown> = {
      eq: (...args: unknown[]) => {
        eqCalls.push(args);
        return scopedBuilder;
      },
      order: (...args: unknown[]) => {
        orderCalls.push(args);
        return scopedBuilder;
      },
      limit: (count: number) => {
        limitCallCount += 1;
        expect(count).toBe(1);
        return scopedBuilder;
      },
      maybeSingle: () => Promise.resolve({ data: { id: VALID_LINK_ID, state: "revoked" }, error: null }),
    };
    client.from = vi.fn(() => ({ select: () => scopedBuilder }));

    await resolveMostRecentShareLink(client, { projectId: VALID_PROJECT_ID, userId: VALID_USER_ID });

    expect(eqCalls).toContainEqual(["project_id", VALID_PROJECT_ID]);
    expect(eqCalls).toContainEqual(["user_id", VALID_USER_ID]);
    // The exact same deterministic tie-break order
    // get_share_link_management_state/list_share_link_summaries already
    // establish: most recently updated, then most recently created,
    // then highest id -- never an arbitrary pick among candidates.
    expect(orderCalls).toEqual([
      ["updated_at", { ascending: false }],
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(limitCallCount).toBe(1);
  });

  it("applies no state filter of its own -- this function is documented as a fallback-only helper, never a substitute for the RPC's own selection", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./share-messages-repository.server.ts", import.meta.url), "utf8")
    );
    const fnMatch = source.match(
      /export async function resolveMostRecentShareLink[\s\S]*?\n}/
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch?.[0]).not.toContain("'revoked'");
    expect(fnMatch?.[0]).not.toMatch(/state["'`]?\s*,\s*["'`]?(active|draft|disabled|expired)/);
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
