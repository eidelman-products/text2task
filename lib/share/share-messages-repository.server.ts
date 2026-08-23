import "server-only";

import { z } from "zod";
import { canonicalizeUuid } from "@/lib/share/share-contracts";

/*
  Phase 5A -- the smallest owner-side communication repository needed for
  upcoming Phase 5 slices (5B/5C/5D). Structurally separate from every
  Project Timeline / Client Update repository in this codebase: this
  file reads/writes ONLY public.share_messages (reads) and the two new
  Phase 5A owner RPCs (writes) -- never project_timeline_events, never
  project_updates, never public.share_message_conversions (Phase
  6-only, untouched).

  Every write goes through send_share_message_reply/
  set_share_message_status (202608190001_client_share_message_owner_rpcs.sql)
  -- this file never performs a direct INSERT/UPDATE against
  share_messages itself, matching this feature's own established
  "owner mutations go through narrow RPCs, not direct table DML" rule
  (see share-links-repository.server.ts for the identical pattern
  applied to every other owned-link mutation).

  Reads use the RLS-bound, cookie-authenticated client passed in by the
  caller (never supabaseAdmin) -- owner reads are already correctly
  scoped by public.share_messages' own RLS policy
  (`auth.uid() = user_id`), and every read below ALSO adds an explicit
  `user_id`/`share_link_id`/`project_id` predicate as defense-in-depth,
  matching every other owner-scoped read in this codebase.

  Public/anonymous messaging (client insert, public read) is
  deliberately NOT implemented here yet -- this is Phase 5B/5C's own
  work, mediated by supabaseAdmin exactly like every other public Client
  Share read/write, never this file.
*/

// ---------------------------------------------------------------------
// Row shape / result types
// ---------------------------------------------------------------------

export const SHARE_MESSAGE_PHASE5_STATUSES = [
  "new",
  "reviewed",
  "resolved",
  "dismissed",
] as const;

/** Phase 5 may only ever WRITE one of these four. 'converted' is a real,
 * legal value of the underlying `status` column
 * (share_messages_status_check, 202608030003) but exists solely for a
 * future Phase 6 write path -- READS may observe it on a row Phase 6
 * has already converted, so the read-side schema below still accepts
 * it; nothing in this file ever sends it as a write parameter. */
export type ShareMessagePhase5Status = (typeof SHARE_MESSAGE_PHASE5_STATUSES)[number];

const shareMessageStatusSchema = z.enum([...SHARE_MESSAGE_PHASE5_STATUSES, "converted"]);
const shareMessageAuthorTypeSchema = z.enum(["client", "owner"]);

const shareMessageRowSchema = z
  .object({
    id: z.string().uuid(),
    share_link_id: z.string().uuid(),
    project_id: z.string().uuid(),
    author_type: shareMessageAuthorTypeSchema,
    author_display_name: z.string().nullable(),
    body: z.string(),
    parent_id: z.string().uuid().nullable(),
    is_visible_to_client: z.boolean(),
    status: shareMessageStatusSchema,
    reviewed_at: z.string().nullable(),
    resolved_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type ShareMessage = {
  id: string;
  shareLinkId: string;
  projectId: string;
  authorType: "client" | "owner";
  authorDisplayName: string | null;
  body: string;
  parentId: string | null;
  isVisibleToClient: boolean;
  status: ShareMessagePhase5Status | "converted";
  reviewedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toShareMessage(row: z.infer<typeof shareMessageRowSchema>): ShareMessage {
  return {
    id: row.id,
    shareLinkId: row.share_link_id,
    projectId: row.project_id,
    authorType: row.author_type,
    authorDisplayName: row.author_display_name,
    body: row.body,
    parentId: row.parent_id,
    isVisibleToClient: row.is_visible_to_client,
    status: row.status,
    reviewedAt: row.reviewed_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ShareMessagesRepositoryErrorCode =
  | "UNAUTHORIZED"
  | "SHARE_LINK_NOT_FOUND"
  | "SHARE_MESSAGE_NOT_FOUND"
  | "SHARE_MESSAGE_PARENT_NOT_FOUND"
  | "SHARE_MESSAGE_PARENT_LINK_MISMATCH"
  // Phase 6B -- owner-initiated Client Update conversion source load.
  | "SHARE_MESSAGE_NOT_CLIENT_AUTHORED"
  | "SHARE_MESSAGE_PROJECT_NOT_FOUND"
  | "INVALID_REQUEST"
  | "UNEXPECTED";

export interface ShareMessagesRepositoryError {
  code: ShareMessagesRepositoryErrorCode;
}

export type ShareMessagesRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ShareMessagesRepositoryError };

// ---------------------------------------------------------------------
// Minimal Supabase-like client surface this repository actually uses.
// Matches share-links-repository.server.ts's own established shape
// (unconstrained generic + one `as` assertion at point of use) for the
// same reason: this repo's real Supabase client has no `Database`
// schema generic, so a directly-declared interface can overflow
// TypeScript's structural-assignability depth limit.
// ---------------------------------------------------------------------

type PostgrestLikeError = { code?: string | null; message: string };

type ShareMessagesQueryResolution = {
  data: unknown[] | null;
  error: PostgrestLikeError | null;
  count?: number | null;
};

type ShareMessagesSingleQueryResolution = {
  data: unknown | null;
  error: PostgrestLikeError | null;
};

type ShareMessagesQueryBuilder = {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => ShareMessagesQueryBuilder;
  eq: (column: string, value: unknown) => ShareMessagesQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => ShareMessagesQueryBuilder;
  limit: (count: number) => ShareMessagesQueryBuilder;
  maybeSingle: () => Promise<ShareMessagesSingleQueryResolution>;
} & PromiseLike<ShareMessagesQueryResolution>;

export type ShareMessagesSupabaseLikeClient = {
  from: (table: string) => { select: ShareMessagesQueryBuilder["select"] };
  rpc: (fn: string, params: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: PostgrestLikeError | null;
  }>;
};

const RPC_ERROR_CODE = "P0001";

function mapReplyRpcError(error: PostgrestLikeError): ShareMessagesRepositoryError {
  if (error.code !== RPC_ERROR_CODE) {
    return { code: "UNEXPECTED" };
  }
  switch (error.message) {
    case "UNAUTHORIZED":
      return { code: "UNAUTHORIZED" };
    case "SHARE_LINK_NOT_FOUND":
      return { code: "SHARE_LINK_NOT_FOUND" };
    case "SHARE_MESSAGE_PARENT_NOT_FOUND":
      return { code: "SHARE_MESSAGE_PARENT_NOT_FOUND" };
    case "SHARE_MESSAGE_PARENT_LINK_MISMATCH":
      return { code: "SHARE_MESSAGE_PARENT_LINK_MISMATCH" };
    case "SHARE_MESSAGE_BODY_EMPTY":
    case "SHARE_MESSAGE_BODY_TOO_LONG":
      return { code: "INVALID_REQUEST" };
    default:
      return { code: "UNEXPECTED" };
  }
}

function mapStatusRpcError(error: PostgrestLikeError): ShareMessagesRepositoryError {
  if (error.code !== RPC_ERROR_CODE) {
    return { code: "UNEXPECTED" };
  }
  switch (error.message) {
    case "UNAUTHORIZED":
      return { code: "UNAUTHORIZED" };
    case "SHARE_MESSAGE_NOT_FOUND":
      return { code: "SHARE_MESSAGE_NOT_FOUND" };
    case "SHARE_MESSAGE_STATUS_INVALID":
      return { code: "INVALID_REQUEST" };
    default:
      return { code: "UNEXPECTED" };
  }
}

// ---------------------------------------------------------------------
// Reads (direct, RLS-bound select -- never an RPC, never supabaseAdmin)
// ---------------------------------------------------------------------

const MESSAGE_COLUMNS =
  "id, share_link_id, project_id, author_type, author_display_name, body, parent_id, is_visible_to_client, status, reviewed_at, resolved_at, created_at, updated_at";

/**
 * Chronological (oldest first) message history for one owned share
 * link -- the primary owner-facing read, using
 * share_messages_share_link_id_created_at_idx directly. Deliberately
 * NOT merged with, or read alongside, any Project Timeline data source.
 */
export async function listShareLinkMessages<Client>(
  supabase: Client,
  input: { shareLinkId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<ShareMessage[]>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalLinkId = canonicalizeUuid(input.shareLinkId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const { data, error } = await client
    .from("share_messages")
    .select(MESSAGE_COLUMNS)
    .eq("share_link_id", canonicalLinkId)
    .eq("user_id", canonicalUserId)
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const parsed = z.array(shareMessageRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data.map(toShareMessage) };
}

/**
 * The owner's per-project communication panel across every share link
 * on that project (newest first), using
 * share_messages_user_id_project_id_created_at_idx directly.
 */
export async function listProjectMessages<Client>(
  supabase: Client,
  input: { projectId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<ShareMessage[]>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalProjectId = canonicalizeUuid(input.projectId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const { data, error } = await client
    .from("share_messages")
    .select(MESSAGE_COLUMNS)
    .eq("project_id", canonicalProjectId)
    .eq("user_id", canonicalUserId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const parsed = z.array(shareMessageRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data.map(toShareMessage) };
}

/**
 * Phase 5's exact unread definition (author_type='client' AND
 * status='new'), via share_messages_unread_client_idx -- an index-only
 * count, not a full row fetch. Uses `{count: "exact", head: true}` so
 * no row bodies are ever transferred just to produce a number.
 */
export async function countUnreadClientMessages<Client>(
  supabase: Client,
  input: { shareLinkId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<number>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalLinkId = canonicalizeUuid(input.shareLinkId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const result = await client
    .from("share_messages")
    .select("id", { count: "exact", head: true })
    .eq("share_link_id", canonicalLinkId)
    .eq("user_id", canonicalUserId)
    .eq("author_type", "client")
    .eq("status", "new");

  if (result.error) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const count = typeof result.count === "number" ? result.count : null;
  if (count === null || count < 0) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: count };
}

/**
 * Phase 5C -- the owner GET endpoint's combined read: proves the link
 * is actually owned by this caller FIRST (a plain `listShareLinkMessages`
 * call alone cannot distinguish "owned link with no messages" from
 * "someone else's link id" -- both would silently return an empty
 * array), then returns its chronological history plus its unread count
 * together, matching the route's own recommended response shape. Fails
 * with `SHARE_LINK_NOT_FOUND` for any id that does not resolve to a link
 * owned by `input.userId`, regardless of the link's own state (revoked/
 * disabled/expired links remain fully owner-readable -- there is no
 * state filter on this lookup at all, unlike public-facing reads).
 */
export async function getOwnerShareLinkMessages<Client>(
  supabase: Client,
  input: { shareLinkId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<{ messages: ShareMessage[]; unreadCount: number }>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalLinkId = canonicalizeUuid(input.shareLinkId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const { data: linkRow, error: linkError } = await client
    .from("project_share_links")
    .select("id")
    .eq("id", canonicalLinkId)
    .eq("user_id", canonicalUserId)
    .maybeSingle();

  if (linkError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  if (!linkRow) {
    return { ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } };
  }

  const messagesResult = await listShareLinkMessages(supabase, {
    shareLinkId: canonicalLinkId,
    userId: canonicalUserId,
  });
  if (!messagesResult.ok) {
    return messagesResult;
  }

  const unreadResult = await countUnreadClientMessages(supabase, {
    shareLinkId: canonicalLinkId,
    userId: canonicalUserId,
  });
  if (!unreadResult.ok) {
    return unreadResult;
  }

  return {
    ok: true,
    data: { messages: messagesResult.data, unreadCount: unreadResult.data },
  };
}

/**
 * Phase 5C -- proves a specific message both belongs to the caller's own
 * link AND is owned by the caller, before the status route calls
 * `set_share_message_status`. This exists because
 * `set_share_message_status`'s own RPC signature
 * (`p_message_id, p_status`) scopes only by `auth.uid()`, not by any
 * link id -- without this check, a PATCH to
 * `/api/share-links/LINK_A/messages/[messageId]` would silently succeed
 * even for a `messageId` that actually belongs to the same owner's
 * LINK_B, making the route's own `[id]` path segment purely decorative.
 * Returns `SHARE_MESSAGE_NOT_FOUND` (never a distinct "wrong link" vs
 * "wrong owner" vs "does not exist" code -- all three are
 * indistinguishable to the caller) when no row matches all three
 * predicates.
 */
export async function verifyOwnedShareMessageBelongsToLink<Client>(
  supabase: Client,
  input: { messageId: string; shareLinkId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<{ id: string }>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalMessageId = canonicalizeUuid(input.messageId);
  const canonicalLinkId = canonicalizeUuid(input.shareLinkId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const { data, error } = await client
    .from("share_messages")
    .select("id")
    .eq("id", canonicalMessageId)
    .eq("share_link_id", canonicalLinkId)
    .eq("user_id", canonicalUserId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  if (!data || typeof (data as { id?: unknown }).id !== "string") {
    return { ok: false, error: { code: "SHARE_MESSAGE_NOT_FOUND" } };
  }

  return { ok: true, data: { id: (data as { id: string }).id } };
}

export type ShareMessageConversionSource = Readonly<{
  messageId: string;
  projectId: string;
  body: string;
}>;

/**
 * Phase 6B -- the sole server-side source-of-truth load for converting
 * one owned, client-authored share message into a Client Update. Proves,
 * in order: the message exists, belongs to the given share link, and is
 * owned by the caller (mirroring verifyOwnedShareMessageBelongsToLink's
 * own triple exactly, so a same-owner cross-link messageId is rejected
 * here too); that it is author_type='client' (an owner-authored reply
 * can never be converted -- also independently enforced at the database
 * layer by enforce_share_message_conversion_integrity, but rejected here
 * first, fail-fast, before any AI call is ever made); and that the
 * message's own project still exists, is owned by the caller, and is
 * not soft-deleted. Deliberately does NOT check the share link's own
 * state (active/disabled/expired/revoked) -- link lifecycle is
 * irrelevant to conversion eligibility, exactly like Phase 5F's own
 * revoked-history read access, since conversion is a message/project-
 * scoped owner action, not a public-facing one. Returns ONLY the three
 * fields the conversion route/service actually needs -- never any other
 * message or project column (no author_display_name, no status, no
 * parent_id, no project title/client data).
 */
export async function loadShareMessageForConversion<Client>(
  supabase: Client,
  input: { messageId: string; shareLinkId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<ShareMessageConversionSource>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalMessageId = canonicalizeUuid(input.messageId);
  const canonicalLinkId = canonicalizeUuid(input.shareLinkId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const { data: messageData, error: messageError } = await client
    .from("share_messages")
    .select("id, project_id, author_type, body")
    .eq("id", canonicalMessageId)
    .eq("share_link_id", canonicalLinkId)
    .eq("user_id", canonicalUserId)
    .maybeSingle();

  if (messageError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  if (!messageData) {
    return { ok: false, error: { code: "SHARE_MESSAGE_NOT_FOUND" } };
  }

  const messageRow = messageData as {
    id?: unknown;
    project_id?: unknown;
    author_type?: unknown;
    body?: unknown;
  };
  if (
    typeof messageRow.id !== "string" ||
    typeof messageRow.project_id !== "string" ||
    typeof messageRow.body !== "string"
  ) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (messageRow.author_type !== "client") {
    return { ok: false, error: { code: "SHARE_MESSAGE_NOT_CLIENT_AUTHORED" } };
  }

  const { data: projectData, error: projectError } = await client
    .from("projects")
    .select("id, deleted_at")
    .eq("id", messageRow.project_id)
    .eq("user_id", canonicalUserId)
    .maybeSingle();

  if (projectError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  const projectRow = projectData as { id?: unknown; deleted_at?: unknown } | null;
  if (!projectRow || typeof projectRow.id !== "string" || projectRow.deleted_at) {
    return { ok: false, error: { code: "SHARE_MESSAGE_PROJECT_NOT_FOUND" } };
  }

  return {
    ok: true,
    data: { messageId: messageRow.id, projectId: messageRow.project_id, body: messageRow.body },
  };
}

export type MostRecentShareLink = Readonly<{
  linkId: string;
  state: string;
}>;

/**
 * PHASE 5F REAL PREVIEW DEFECT FIX -- resolves the single most recent
 * `project_share_links` row for a project, with NO state filter at all
 * (unlike `get_share_link_management_state`/`list_share_link_summaries`,
 * both of which deliberately exclude `state = 'revoked'` -- correct for
 * their own purpose of picking a link to ACTIVATE/RECONFIGURE, but wrong
 * for this one: after a revoke, the owner's Client Communication History
 * must remain reachable even though there is no longer any "manageable"
 * link).
 *
 * This function is deliberately a FALLBACK ONLY -- callers must invoke
 * it only after `get_share_link_management_state` has already returned
 * `link: null` for the same project. At that point the only rows this
 * query can possibly find are `state = 'revoked'` (since every other
 * state already satisfies that RPC's own `state <> 'revoked'` filter and
 * would have been returned by it). This function does not re-implement
 * or duplicate that RPC's own selection logic; it reuses the identical
 * deterministic tie-break order both `get_share_link_management_state`
 * and `list_share_link_summaries` already establish (most recently
 * updated, then most recently created, then highest id), so the choice
 * among multiple historical links is never arbitrary.
 *
 * A direct RLS-bound read (not an RPC) -- `project_share_links`'s own
 * "Users can view own project share links" policy
 * (`auth.uid() = user_id`, 202608030003) has no state restriction at
 * all, so this needs no new grant, policy, or migration. Bounded to
 * exactly `id, state` -- never a broader column select.
 */
export async function resolveMostRecentShareLink<Client>(
  supabase: Client,
  input: { projectId: string; userId: string }
): Promise<ShareMessagesRepositoryResult<MostRecentShareLink | null>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalProjectId = canonicalizeUuid(input.projectId);
  const canonicalUserId = canonicalizeUuid(input.userId);

  const { data, error } = await client
    .from("project_share_links")
    .select("id, state")
    .eq("project_id", canonicalProjectId)
    .eq("user_id", canonicalUserId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  if (!data) {
    return { ok: true, data: null };
  }

  const row = data as { id?: unknown; state?: unknown };
  if (typeof row.id !== "string" || typeof row.state !== "string") {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: { linkId: row.id, state: row.state } };
}

// ---------------------------------------------------------------------
// Writes (RPC-mediated only -- never a direct INSERT/UPDATE)
// ---------------------------------------------------------------------

const SEND_SHARE_MESSAGE_REPLY_RPC = "send_share_message_reply";
const SET_SHARE_MESSAGE_STATUS_RPC = "set_share_message_status";

const sendReplyRpcDataSchema = z
  .object({
    messageId: z.string().uuid(),
    shareLinkId: z.string().uuid(),
    parentId: z.string().uuid(),
    authorType: z.literal("owner"),
    createdAt: z.string(),
  })
  .strict();

/**
 * Sends one owner-authored reply via public.send_share_message_reply.
 * Never inserts into share_messages directly -- the RPC is the sole
 * write path, exactly like every owned-link mutation in
 * share-links-repository.server.ts.
 */
export async function sendShareMessageReply<Client>(
  supabase: Client,
  input: { shareLinkId: string; parentMessageId: string; body: string }
): Promise<ShareMessagesRepositoryResult<{
  messageId: string;
  shareLinkId: string;
  parentId: string;
  authorType: "owner";
  createdAt: string;
}>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalLinkId = canonicalizeUuid(input.shareLinkId);
  const canonicalParentId = canonicalizeUuid(input.parentMessageId);

  const { data, error } = await client.rpc(SEND_SHARE_MESSAGE_REPLY_RPC, {
    p_share_link_id: canonicalLinkId,
    p_parent_message_id: canonicalParentId,
    p_body: input.body,
  });

  if (error) {
    return { ok: false, error: mapReplyRpcError(error) };
  }

  const parsed = sendReplyRpcDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.shareLinkId !== canonicalLinkId || parsed.data.parentId !== canonicalParentId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}

const setStatusRpcDataSchema = z
  .object({
    messageId: z.string().uuid(),
    status: z.enum(SHARE_MESSAGE_PHASE5_STATUSES),
    reviewedAt: z.string().nullable(),
    resolvedAt: z.string().nullable(),
  })
  .strict();

/**
 * Sets one owned message's workflow status via
 * public.set_share_message_status. `status` is typed to the four
 * Phase 5 values ONLY (ShareMessagePhase5Status) -- 'converted' cannot
 * even be passed to this function's own type signature, let alone reach
 * the RPC call.
 */
export async function setShareMessageStatus<Client>(
  supabase: Client,
  input: { messageId: string; status: ShareMessagePhase5Status }
): Promise<ShareMessagesRepositoryResult<{
  messageId: string;
  status: ShareMessagePhase5Status;
  reviewedAt: string | null;
  resolvedAt: string | null;
}>> {
  const client = supabase as ShareMessagesSupabaseLikeClient;
  const canonicalMessageId = canonicalizeUuid(input.messageId);

  const { data, error } = await client.rpc(SET_SHARE_MESSAGE_STATUS_RPC, {
    p_message_id: canonicalMessageId,
    p_status: input.status,
  });

  if (error) {
    return { ok: false, error: mapStatusRpcError(error) };
  }

  const parsed = setStatusRpcDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  if (parsed.data.messageId !== canonicalMessageId) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}
