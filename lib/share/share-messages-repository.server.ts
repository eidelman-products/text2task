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

type ShareMessagesQueryBuilder = {
  select: (columns: string, options?: { count?: "exact"; head?: boolean }) => ShareMessagesQueryBuilder;
  eq: (column: string, value: unknown) => ShareMessagesQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => ShareMessagesQueryBuilder;
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
