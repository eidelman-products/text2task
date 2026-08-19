import "server-only";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Phase 5B -- the public, anonymous client-message-submission contract
 * and its trusted server-side insert. This is a deliberately separate
 * module from `lib/share/share-messages-repository.server.ts` (which is
 * the OWNER-authenticated, RLS-bound, RPC-only write path from Phase
 * 5A): a public client has no `auth.uid()` at all, so its one and only
 * write path is the narrow, column-scoped `service_role` INSERT grant
 * 202608030005 already deliberately carved out on `public.share_messages`
 * (`user_id, share_link_id, project_id, author_type, author_display_name,
 * body, parent_id, is_visible_to_client` -- notably NOT `status`,
 * `reviewed_at`, or `resolved_at`, which service_role has no grant to
 * touch at all and which therefore always take their column DEFAULTs on
 * a client-authored insert, matching `share_messages_status_check`'s own
 * client-safe default of `'new'`).
 *
 * The DB's own `enforce_share_message_integrity` trigger
 * (202608030005) independently re-verifies, at insert time, that the
 * link is active/comments_enabled/unexpired and the project alive -- the
 * checks in this module are fail-fast/defense-in-depth on top of that,
 * exactly like every other Client Share write path in this feature, not
 * a replacement for it.
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

function validateBody(
  rawBody: string
): string | "SHARE_MESSAGE_BODY_EMPTY" | "SHARE_MESSAGE_BODY_TOO_LONG" {
  const sanitized = sanitizeMessageText(rawBody);

  if (countCodepoints(sanitized.trim()) < 1) {
    return "SHARE_MESSAGE_BODY_EMPTY";
  }

  if (countCodepoints(sanitized) > SHARE_MESSAGE_BODY_MAX_CODEPOINTS) {
    return "SHARE_MESSAGE_BODY_TOO_LONG";
  }

  return sanitized;
}

function validateAuthorDisplayName(
  rawName: string | undefined
): string | null | "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG" {
  if (rawName === undefined) {
    return null;
  }

  const trimmed = sanitizeMessageText(rawName).trim();

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
  const body = validateBody(request.body);

  if (body === "SHARE_MESSAGE_BODY_EMPTY" || body === "SHARE_MESSAGE_BODY_TOO_LONG") {
    return { ok: false, code: body };
  }

  const authorDisplayName = validateAuthorDisplayName(request.authorDisplayName);

  if (authorDisplayName === "SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG") {
    return { ok: false, code: authorDisplayName };
  }

  return { ok: true, data: { body, authorDisplayName } };
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
