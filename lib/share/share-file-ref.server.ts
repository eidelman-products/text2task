import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PHASE 4 SPIKE (not yet wired into any route). Opaque, unpersisted
 * public-file reference derivation for the Client Share file-delivery
 * endpoint. The public projection cannot expose task_resources.id or
 * project_share_links.id directly (AGENTS.md rule 1 / the "no internal
 * ids" contract this whole feature is built on), so a mapped FILE
 * resource is instead identified to the browser by `fileRef`: a keyed
 * HMAC-SHA256 digest of (shareLinkId, resourceId), computed fresh on
 * every projection read and re-derived (never looked up from storage) on
 * every resolution -- there is no table, column, or cache backing it.
 *
 * Deliberately a DEDICATED key/env var, not a reuse of
 * TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1 or TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1.
 * share-secret.server.ts's own comment states the repository's rule
 * explicitly: "Deliberately separate from every other HMAC/encryption key
 * in this repository... reusing a key across unrelated purposes would let
 * a compromise of one purpose's key compromise the other's data too."
 * This module follows that existing rule rather than the (incorrect)
 * key-reuse shortcut considered in an earlier pass of this same plan.
 *
 * The raw key never leaves this module -- callers only ever receive the
 * derived `fileRef` string or a matched resourceId, never the key itself.
 */

const FILE_REF_HMAC_KEY_ENV = "TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1";
const FILE_REF_HMAC_ALGORITHM = "sha256";
const FILE_REF_HMAC_DOMAIN = "text2task.share.file-ref.v1";
const FILE_REF_HMAC_KEY_MIN_BYTES = 32;

/** base64url("sha256 digest") of a 32-byte digest, no padding: exactly 43
 * characters from the base64url alphabet. Any other shape is rejected
 * before a single DB row is ever read. */
const FILE_REF_LENGTH = 43;
const FILE_REF_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ShareFileRefErrorCode =
  | "hmac_key_missing"
  | "hmac_key_malformed"
  | "hmac_key_too_short"
  | "invalid_input";

const SHARE_FILE_REF_ERROR_MESSAGES: Record<ShareFileRefErrorCode, string> = {
  hmac_key_missing: "Share file-ref HMAC key is not configured.",
  hmac_key_malformed: "Share file-ref HMAC key is malformed.",
  hmac_key_too_short: "Share file-ref HMAC key is too short.",
  invalid_input: "shareLinkId/resourceId must be non-empty strings.",
};

export class ShareFileRefError extends Error {
  readonly code: ShareFileRefErrorCode;

  constructor(code: ShareFileRefErrorCode) {
    super(SHARE_FILE_REF_ERROR_MESSAGES[code]);
    this.name = "ShareFileRefError";
    this.code = code;
  }
}

/** Loaded lazily, decoded from base64url, required to be at least 32
 * decoded bytes. Fails closed for every invalid state -- never a fallback
 * key. Never exported: this is the one function in the module allowed to
 * see the raw key material. */
function getShareFileRefHmacKey(): Buffer {
  const rawKey = process.env[FILE_REF_HMAC_KEY_ENV];

  if (!rawKey) {
    throw new ShareFileRefError("hmac_key_missing");
  }

  if (rawKey.trim() !== rawKey || !/^[A-Za-z0-9_-]+$/.test(rawKey)) {
    throw new ShareFileRefError("hmac_key_malformed");
  }

  let key: Buffer;
  try {
    key = Buffer.from(rawKey, "base64url");
  } catch {
    throw new ShareFileRefError("hmac_key_malformed");
  }

  if (key.toString("base64url") !== rawKey) {
    throw new ShareFileRefError("hmac_key_malformed");
  }

  if (key.length < FILE_REF_HMAC_KEY_MIN_BYTES) {
    throw new ShareFileRefError("hmac_key_too_short");
  }

  return key;
}

/**
 * Deterministic, one-way, per-(shareLinkId, resourceId) opaque reference.
 * Same pair always yields the same fileRef while mapped (no storage
 * needed); a different shareLinkId for the same resourceId yields an
 * unrelated fileRef (no cross-link replay); the key material is never
 * recoverable from the output.
 */
export function deriveShareFileRef(shareLinkId: string, resourceId: string): string {
  if (!shareLinkId || !resourceId) {
    throw new ShareFileRefError("invalid_input");
  }

  const key = getShareFileRefHmacKey();

  return createHmac(FILE_REF_HMAC_ALGORITHM, key)
    .update(FILE_REF_HMAC_DOMAIN)
    .update("\0")
    .update(shareLinkId)
    .update("\0")
    .update(resourceId)
    .digest("base64url");
}

/** Cheap syntactic rejection before any DB call -- garbage input never
 * reaches a query. */
export function isPlausibleShareFileRef(value: unknown): value is string {
  return typeof value === "string" && value.length === FILE_REF_LENGTH && FILE_REF_PATTERN.test(value);
}

/**
 * Scans the link's own (already-bounded, already-authorized) mapped
 * resource set and returns the resourceId whose derived fileRef matches
 * the caller-supplied one, or null. Comparison is `timingSafeEqual` on
 * two equal-length buffers -- never `===` on strings -- mirroring
 * share-pin.server.ts's existing comparison convention. Intended set
 * sizes are small (an owner's shared attachments for one link), so a
 * full scan costs microseconds; no index or reverse-lookup table is
 * needed.
 */
export function matchShareFileRef(
  candidateFileRef: string,
  shareLinkId: string,
  mappedResourceIds: readonly string[]
): string | null {
  if (!isPlausibleShareFileRef(candidateFileRef)) {
    return null;
  }

  let candidateBuffer: Buffer;
  try {
    candidateBuffer = Buffer.from(candidateFileRef, "base64url");
  } catch {
    return null;
  }

  for (const resourceId of mappedResourceIds) {
    const expected = deriveShareFileRef(shareLinkId, resourceId);
    const expectedBuffer = Buffer.from(expected, "base64url");

    if (
      expectedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(expectedBuffer, candidateBuffer)
    ) {
      return resourceId;
    }
  }

  return null;
}
