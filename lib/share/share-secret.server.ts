import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * Raw share-secret generation and keyed-digest computation, mirroring
 * lib/homepage-demo/tokens.server.ts's random generation and
 * lib/homepage-demo/identity.server.ts's fail-closed keyed-HMAC pattern
 * (createHmac(...).update(domain).update("\0").update(value), a dedicated
 * base64url env-var key, minimum-length validation, no fallback).
 *
 * This module never persists, logs or returns the HMAC key itself, and
 * never logs a raw secret or a computed digest.
 */

const RAW_SECRET_RANDOM_BYTES = 32;
const RAW_SECRET_BASE64URL_LENGTH = 43;
const BASE64URL_43_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The exact persisted representation: project_share_links.secret_digest's
 * own CHECK constraint (project_share_links_secret_digest_format_check,
 * 202608030003) is `^[0-9a-f]{64}$` -- lowercase hex, not base64url. This
 * module computes and validates digests in that exact representation
 * everywhere, so no intermediate base64url-vs-hex encoding mismatch can
 * ever exist between here and the database, or between here and a future
 * Phase 3 verification path.
 */
const DIGEST_HEX_LENGTH = 64;
const DIGEST_HEX_PATTERN = /^[0-9a-f]{64}$/;

const DIGEST_DOMAIN = "text2task.share.secret-digest.v1";

export const SHARE_SECRET_DIGEST_VERSION = 1 as const;

// Deliberately separate from every other HMAC/encryption key in this
// repository (TEXT2TASK_HOMEPAGE_DEMO_IDENTITY_HMAC_SECRET_V1,
// TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1) -- reusing a key across
// unrelated purposes would let a compromise of one purpose's key
// compromise the other's data too.
const SHARE_SECRET_HMAC_KEY_ENV = "TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1";
const SHARE_SECRET_HMAC_KEY_MIN_BYTES = 32;

export type ShareSecretErrorCode =
  | "hmac_key_missing"
  | "hmac_key_malformed"
  | "hmac_key_too_short"
  | "invalid_raw_secret";

const SHARE_SECRET_ERROR_MESSAGES: Record<ShareSecretErrorCode, string> = {
  hmac_key_missing: "Share secret HMAC key is not configured.",
  hmac_key_malformed: "Share secret HMAC key is malformed.",
  hmac_key_too_short: "Share secret HMAC key is too short.",
  invalid_raw_secret: "Raw share secret is not exactly 43 base64url characters.",
};

export class ShareSecretError extends Error {
  readonly code: ShareSecretErrorCode;

  constructor(code: ShareSecretErrorCode) {
    super(SHARE_SECRET_ERROR_MESSAGES[code]);
    this.name = "ShareSecretError";
    this.code = code;
  }
}

export function isShareSecretError(error: unknown): error is ShareSecretError {
  return error instanceof ShareSecretError;
}

/** randomBytes(32).toString("base64url") -- exactly 43 base64url characters. */
export function generateRawShareSecret(): string {
  return randomBytes(RAW_SECRET_RANDOM_BYTES).toString("base64url");
}

export function isValidRawShareSecret(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === RAW_SECRET_BASE64URL_LENGTH &&
    BASE64URL_43_PATTERN.test(value)
  );
}

/** The persisted representation: lowercase hex, exactly 64 characters,
 * matching project_share_links_secret_digest_format_check exactly. */
export function isValidShareSecretDigest(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === DIGEST_HEX_LENGTH &&
    DIGEST_HEX_PATTERN.test(value)
  );
}

/**
 * Loaded lazily (only when a digest is actually computed, never at module
 * import time), decoded from base64url, and required to be at least 32
 * decoded bytes. Fails closed with a typed ShareSecretError for every
 * invalid state -- missing, malformed, or too short -- with no fallback
 * key of any kind.
 */
function getShareSecretHmacKey(): Buffer {
  const rawKey = process.env[SHARE_SECRET_HMAC_KEY_ENV];

  if (!rawKey) {
    throw new ShareSecretError("hmac_key_missing");
  }

  if (rawKey.trim() !== rawKey || !/^[A-Za-z0-9_-]+$/.test(rawKey)) {
    throw new ShareSecretError("hmac_key_malformed");
  }

  let key: Buffer;
  try {
    key = Buffer.from(rawKey, "base64url");
  } catch {
    throw new ShareSecretError("hmac_key_malformed");
  }

  if (key.toString("base64url") !== rawKey) {
    throw new ShareSecretError("hmac_key_malformed");
  }

  if (key.length < SHARE_SECRET_HMAC_KEY_MIN_BYTES) {
    throw new ShareSecretError("hmac_key_too_short");
  }

  return key;
}

/**
 * Keyed HMAC-SHA256 digest of a raw share secret, with a domain-separated
 * input (mirroring identity.server.ts's `.update(domain).update("\0")`
 * shape) so this digest can never collide with a digest computed for a
 * different purpose even if a key were ever reused by mistake. Returns
 * lowercase hex, exactly 64 characters -- the exact persisted
 * representation project_share_links.secret_digest requires, so this
 * value can be passed straight through to the database with no
 * intermediate encoding.
 *
 * This is a server-only security boundary, so it never trusts that its
 * caller already validated `rawSecret`: an arbitrary string is rejected
 * before any HMAC is ever computed over it.
 */
export function createShareSecretDigest(rawSecret: string): string {
  if (!isValidRawShareSecret(rawSecret)) {
    throw new ShareSecretError("invalid_raw_secret");
  }

  const key = getShareSecretHmacKey();

  return createHmac("sha256", key)
    .update(DIGEST_DOMAIN)
    .update("\0")
    .update(rawSecret)
    .digest("hex");
}
