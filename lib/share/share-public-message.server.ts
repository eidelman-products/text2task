import "server-only";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Phase 5B/5C -- the public, anonymous client-message contract: its
 * trusted server-side insert (5B) and, since 5C, its trusted
 * server-side read. This is a deliberately separate module from
 * `lib/share/share-messages-repository.server.ts` (which is the
 * OWNER-authenticated, RLS-bound, RPC-only path): a public client has
 * no `auth.uid()` at all, so both its write and its read must be
 * mediated by `supabaseAdmin` after the caller's own authorization has
 * already been independently verified by the route (never by anything
 * in this file) -- this module never resolves session/grant/link state
 * itself.
 *
 * Write: the one and only write path is the narrow, column-scoped
 * `service_role` INSERT grant 202608030005 already deliberately carved
 * out on `public.share_messages` (`user_id, share_link_id, project_id,
 * author_type, author_display_name, body, parent_id,
 * is_visible_to_client` -- notably NOT `status`, `reviewed_at`, or
 * `resolved_at`, which service_role has no grant to touch at all and
 * which therefore always take their column DEFAULTs on a
 * client-authored insert, matching `share_messages_status_check`'s own
 * client-safe default of `'new'`). The DB's own
 * `enforce_share_message_integrity` trigger (202608030005) independently
 * re-verifies, at insert time, that the link is
 * active/comments_enabled/unexpired and the project alive -- the checks
 * in this module are fail-fast/defense-in-depth on top of that, not a
 * replacement for it.
 *
 * Read (5C): `service_role` already holds a plain, unrestricted SELECT
 * grant on `public.share_messages` (202608030005) -- no new grant is
 * needed. The read below is scoped by the route's own already-verified
 * `shareLinkId`/`projectId`/`userId` (never anything client-supplied)
 * and additionally filters `is_visible_to_client = true` in the query
 * itself (not merely in the projection step), and returns only the four
 * client-safe fields a public reader may ever see.
 */

// ---------------------------------------------------------------------
// Request contract
// ---------------------------------------------------------------------

export const SHARE_MESSAGE_BODY_MAX_CODEPOINTS = 4000;
export const SHARE_MESSAGE_AUTHOR_NAME_MAX_CODEPOINTS = 80;

export const shareMessageSubmissionRequestSchema = z
  .object({
    body: z.string(),
    authorDisplayName: z.string().optional(),
  })
  .strict();

export type ShareMessageSubmissionRequest = z.infer<
  typeof shareMessageSubmissionRequestSchema
>;

export type ShareMessageValidationErrorCode =
  | "SHARE_MESSAGE_BODY_EMPTY"
  | "SHARE_MESSAGE_BODY_TOO_LONG"
  | "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG";

export type ShareMessageValidationResult =
  | {
      ok: true;
      data: { body: string; authorDisplayName: string | null };
    }
  | { ok: false; code: ShareMessageValidationErrorCode };

/**
 * Every C0 control character (0-31) plus DEL (127), EXCEPT tab (9) and
 * newline (10) -- built from character codes rather than regex
 * escape-sequence literals so the source contains no literal control
 * bytes of its own, mirroring `share-file-response.server.ts`'s own
 * established pattern. Carriage return (13) is deliberately included
 * here (stripped, not preserved) because CRLF/lone-CR line endings are
 * normalized to a plain `\n` first, below, before this pattern ever
 * runs -- by the time it runs, any remaining CR is not a line ending.
 */
const STRIPPED_CONTROL_CHARACTER_PATTERN = new RegExp(
  "[" +
    Array.from({ length: 32 }, (_, i) => String.fromCharCode(i))
      .filter((char) => char !== "\t" && char !== "\n")
      .join("") +
    String.fromCharCode(127) +
    "]",
  "g"
);

/** Counts Unicode codepoints, not UTF-16 code units -- matching
 * Postgres's own `char_length()` exactly. A JS string's `.length`
 * over-counts any character outside the Basic Multilingual Plane (each
 * becomes a 2-unit surrogate pair), which would reject legitimate
 * astral-plane content (most emoji) well before the real 4000/80
 * character limits the database itself enforces. */
function countCodepoints(value: string): number {
  return [...value].length;
}

/** Normalizes line endings to a plain `\n` and strips every other C0
 * control character and DEL, preserving tabs, newlines, and all other
 * Unicode content (including RTL scripts) untouched. Leading/trailing
 * whitespace is never trimmed from the stored value -- only used, below,
 * to detect an empty/whitespace-only submission -- matching
 * `send_share_message_reply`'s own established "store as submitted"
 * convention for `share_messages.body` exactly. */
function sanitizeMessageText(raw: string): string {
  return raw.replace(/\r\n|\r/g, "\n").replace(STRIPPED_CONTROL_CHARACTER_PATTERN, "");
}

export type ShareMessageBodyValidationResult =
  | { ok: true; body: string }
  | { ok: false; code: "SHARE_MESSAGE_BODY_EMPTY" | "SHARE_MESSAGE_BODY_TOO_LONG" };

/**
 * The one shared message-body normalizer/validator for this feature --
 * used by the public submission contract below AND, since Phase 5C, by
 * the owner reply route (`POST /api/share-links/[id]/messages/reply`)
 * directly, so an owner-authored reply gets the exact same line-ending
 * normalization, control-character stripping, and 1-4000-codepoint
 * `share_messages_body_check`-matching validation a public client
 * message does, rather than a second, potentially-diverging validator.
 * Exported deliberately for that reuse.
 */
export function validateShareMessageBody(rawBody: string): ShareMessageBodyValidationResult {
  const sanitized = sanitizeMessageText(rawBody);

  if (countCodepoints(sanitized.trim()) < 1) {
    return { ok: false, code: "SHARE_MESSAGE_BODY_EMPTY" };
  }

  if (countCodepoints(sanitized) > SHARE_MESSAGE_BODY_MAX_CODEPOINTS) {
    return { ok: false, code: "SHARE_MESSAGE_BODY_TOO_LONG" };
  }

  return { ok: true, body: sanitized };
}

/**
 * Phase 7C -- Unicode bidi FORMATTING control characters only, never a
 * normal RTL letter. Hebrew/Arabic (and any other RTL script) text is
 * untouched by this pattern -- it targets exactly the nine codepoints
 * that exist solely to override/embed/isolate directional runs
 * (U+202A-U+202E, U+2066-U+2069), which have no legitimate purpose in a
 * short display name and can otherwise be used to visually reorder or
 * disguise it (e.g. an RTL override making a name read backwards, or
 * embedding to make one name masquerade as a different one). Scoped to
 * the name only -- message body semantics are deliberately unchanged.
 */
const BIDI_FORMATTING_CHARACTER_PATTERN = new RegExp(
  "[" +
    String.fromCharCode(0x202a) +
    "-" +
    String.fromCharCode(0x202e) +
    String.fromCharCode(0x2066) +
    "-" +
    String.fromCharCode(0x2069) +
    "]",
  "g"
);

/**
 * Phase 7C -- name-specific hardening on top of the shared
 * sanitizeMessageText: a display name is meant to be a single short
 * visual label, unlike a message body, so embedded newlines/tabs are
 * collapsed to a single space (not merely preserved, as the body
 * intentionally does) rather than allowed to fake a multi-line/
 * multi-message appearance, bidi formatting controls are removed
 * outright, and the result is NFC-normalized so visually-identical
 * strings using different combining-character sequences store
 * identically. Never touches ordinary Unicode letters of any script.
 */
function sanitizeDisplayNameText(raw: string): string {
  return sanitizeMessageText(raw)
    .replace(/[\n\t]/g, " ")
    .replace(BIDI_FORMATTING_CHARACTER_PATTERN, "")
    .replace(/ {2,}/g, " ")
    .normalize("NFC");
}

function validateAuthorDisplayName(
  rawName: string | undefined
): string | null | "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG" {
  if (rawName === undefined) {
    return null;
  }

  const trimmed = sanitizeDisplayNameText(rawName).trim();

  if (countCodepoints(trimmed) < 1) {
    return null;
  }

  if (countCodepoints(trimmed) > SHARE_MESSAGE_AUTHOR_NAME_MAX_CODEPOINTS) {
    return "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG";
  }

  return trimmed;
}

/** Validates and normalizes an already-schema-parsed submission against
 * the exact same semantics as `share_messages_body_check` /
 * `share_messages_author_display_name_check` (202608030003): body's
 * emptiness is judged on the trimmed value but its max length on the
 * sanitized-but-untrimmed value (never truncated), matching
 * `send_share_message_reply`'s own validation exactly; the display name
 * is trimmed for storage (a display convenience field, unlike body), and
 * an empty-after-trim name normalizes to `null` rather than being
 * rejected. */
export function validateShareMessageSubmission(
  request: ShareMessageSubmissionRequest
): ShareMessageValidationResult {
  const bodyResult = validateShareMessageBody(request.body);

  if (!bodyResult.ok) {
    return { ok: false, code: bodyResult.code };
  }

  const authorDisplayName = validateAuthorDisplayName(request.authorDisplayName);

  if (authorDisplayName === "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG") {
    return { ok: false, code: authorDisplayName };
  }

  return { ok: true, data: { body: bodyResult.body, authorDisplayName } };
}

// ---------------------------------------------------------------------
// Trusted server-side insert (service-role, column-scoped grant only)
// ---------------------------------------------------------------------

export type InsertPublicShareMessageInput = Readonly<{
  shareLinkId: string;
  projectId: string;
  userId: string;
  body: string;
  authorDisplayName: string | null;
}>;

/**
 * Performs the one and only insert a public client may ever cause:
 * exactly the 8 columns `service_role` is granted (never `status`,
 * `reviewed_at`, `resolved_at`, `id`, `created_at`, `updated_at`, all of
 * which are either ungrantable to this insert or left to their table
 * DEFAULTs). `author_type`, `parent_id`, and `is_visible_to_client` are
 * hardcoded here, never derived from caller input -- there is no
 * parameter through which a caller could influence them. Returns `false`
 * (never throws) on any insert failure, including a rejection by the
 * integrity trigger's own defense-in-depth re-check -- callers must
 * treat that identically to any other generic public failure. */
export async function insertPublicShareMessage(
  input: InsertPublicShareMessageInput
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("share_messages").insert({
    user_id: input.userId,
    share_link_id: input.shareLinkId,
    project_id: input.projectId,
    author_type: "client",
    author_display_name: input.authorDisplayName,
    body: input.body,
    parent_id: null,
    is_visible_to_client: true,
  });

  return error === null;
}

// ---------------------------------------------------------------------
// Trusted server-side read (Phase 5C, service-role, already-granted
// plain SELECT -- no new grant needed)
// ---------------------------------------------------------------------

export type PublicShareMessage = Readonly<{
  authorType: "client" | "owner";
  authorDisplayName: string | null;
  body: string;
  createdAt: string;
}>;

const publicShareMessageRowSchema = z
  .object({
    author_type: z.enum(["client", "owner"]),
    author_display_name: z.string().nullable(),
    body: z.string(),
    created_at: z.string(),
  })
  .strict();

function toPublicShareMessage(row: z.infer<typeof publicShareMessageRowSchema>): PublicShareMessage {
  return {
    authorType: row.author_type,
    authorDisplayName: row.author_display_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export type ListPublicShareMessagesInput = Readonly<{
  shareLinkId: string;
  projectId: string;
  userId: string;
}>;

/**
 * Reads the client-visible message history for one already-authorized
 * public reader: `is_visible_to_client = true` only (a hidden
 * owner-authored message never reaches this result), `created_at`
 * ascending (chronological). Scoped by all three of
 * `share_link_id`/`project_id`/`user_id` from the caller's own
 * already-verified authorization -- never a value the request itself
 * supplied. Selects only the four columns a public reader may ever see
 * (never `id`, `parent_id`, `status`, `reviewed_at`, `resolved_at`, or
 * `is_visible_to_client` itself) -- there is no raw-row passthrough for
 * a caller to accidentally widen later. Returns `null` (fail closed,
 * never throws) on any query or shape error; an empty array is a valid,
 * distinct "no messages yet" result. */
export async function listPublicShareMessages(
  input: ListPublicShareMessagesInput
): Promise<PublicShareMessage[] | null> {
  const { data, error } = await supabaseAdmin
    .from("share_messages")
    .select("author_type, author_display_name, body, created_at")
    .eq("share_link_id", input.shareLinkId)
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)
    .eq("is_visible_to_client", true)
    .order("created_at", { ascending: true });

  if (error) {
    return null;
  }

  const parsed = z.array(publicShareMessageRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    return null;
  }

  return parsed.data.map(toPublicShareMessage);
}
