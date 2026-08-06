import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encrypt/decrypt for the raw share secret stored (encrypted)
 * in public.project_share_secret_material. No existing repository
 * precedent for AES exists -- this is genuinely new code, not a reuse of
 * an existing helper -- but its fail-closed key-loading shape mirrors
 * lib/homepage-demo/identity.server.ts's getHomepageDemoIdentityHmacSecret
 * exactly: base64url, an exact required decoded length, no fallback.
 *
 * Binary material (ciphertext/nonce/authTag) is represented internally as
 * Buffer. Hex-string conversion happens only at the repository/RPC
 * boundary (lib/share/share-links-repository.server.ts), never here.
 *
 * This module never logs plaintext, the key, ciphertext, nonce or auth
 * tag on any code path.
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENCRYPTION_KEY_BYTES = 32;

// A V1 raw share secret is exactly 43 base64url ASCII characters (see
// lib/share/share-secret.server.ts's generateRawShareSecret). AES-GCM does
// not pad -- it is a stream cipher over the plaintext -- so the ciphertext
// is always exactly as many bytes as the plaintext: 43.
const RAW_SECRET_BASE64URL_LENGTH = 43;
const BASE64URL_43_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CIPHERTEXT_BYTES = RAW_SECRET_BASE64URL_LENGTH;

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const SHARE_SECRET_ENCRYPTION_VERSION = 1 as const;

// Deliberately separate from TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1 and from
// every other key in this repository -- encryption and digesting are
// different security purposes and must never share a key.
const SHARE_SECRET_ENCRYPTION_KEY_ENV =
  "TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1";

export type ShareSecretEncryptionErrorCode =
  | "encryption_key_missing"
  | "encryption_key_malformed"
  | "encryption_key_wrong_length"
  | "unknown_encryption_version"
  | "invalid_share_link_id"
  | "invalid_plaintext"
  | "invalid_ciphertext_length"
  | "invalid_nonce_length"
  | "invalid_auth_tag_length"
  | "invalid_decrypted_plaintext"
  | "decryption_failed";

const ERROR_MESSAGES: Record<ShareSecretEncryptionErrorCode, string> = {
  encryption_key_missing: "Share secret encryption key is not configured.",
  encryption_key_malformed: "Share secret encryption key is malformed.",
  encryption_key_wrong_length:
    "Share secret encryption key must decode to exactly 32 bytes.",
  unknown_encryption_version: "Unknown share secret encryption version.",
  invalid_share_link_id: "shareLinkId is not a syntactically valid uuid.",
  invalid_plaintext: "Plaintext is not exactly 43 base64url characters.",
  invalid_ciphertext_length: "Ciphertext must be exactly 43 bytes.",
  invalid_nonce_length: "Nonce must be exactly 12 bytes.",
  invalid_auth_tag_length: "Auth tag must be exactly 16 bytes.",
  invalid_decrypted_plaintext:
    "Decrypted plaintext is not exactly 43 base64url characters.",
  decryption_failed: "Share secret decryption failed.",
};

export class ShareSecretEncryptionError extends Error {
  readonly code: ShareSecretEncryptionErrorCode;

  constructor(code: ShareSecretEncryptionErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ShareSecretEncryptionError";
    this.code = code;
  }
}

export function isShareSecretEncryptionError(
  error: unknown
): error is ShareSecretEncryptionError {
  return error instanceof ShareSecretEncryptionError;
}

export type EncryptedShareSecretMaterial = Readonly<{
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  encryptionVersion: typeof SHARE_SECRET_ENCRYPTION_VERSION;
}>;

export type DecryptShareSecretInput = Readonly<{
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  encryptionVersion: number;
  shareLinkId: string;
}>;

/**
 * Loaded lazily, decoded from base64url, and required to be exactly 32
 * decoded bytes (AES-256 needs exactly 32, not merely "at least" 32).
 * Fails closed for every invalid state -- missing, malformed, or the
 * wrong length -- with no fallback key of any kind.
 */
function getShareSecretEncryptionKey(): Buffer {
  const rawKey = process.env[SHARE_SECRET_ENCRYPTION_KEY_ENV];

  if (!rawKey) {
    throw new ShareSecretEncryptionError("encryption_key_missing");
  }

  if (rawKey.trim() !== rawKey || !/^[A-Za-z0-9_-]+$/.test(rawKey)) {
    throw new ShareSecretEncryptionError("encryption_key_malformed");
  }

  let key: Buffer;
  try {
    key = Buffer.from(rawKey, "base64url");
  } catch {
    throw new ShareSecretEncryptionError("encryption_key_malformed");
  }

  if (key.toString("base64url") !== rawKey) {
    throw new ShareSecretEncryptionError("encryption_key_malformed");
  }

  if (key.length !== ENCRYPTION_KEY_BYTES) {
    throw new ShareSecretEncryptionError("encryption_key_wrong_length");
  }

  return key;
}

function isValidBase64UrlSecretShape(value: string): boolean {
  return (
    value.length === RAW_SECRET_BASE64URL_LENGTH &&
    BASE64URL_43_PATTERN.test(value)
  );
}

/**
 * Validates shareLinkId is a syntactically valid uuid and canonicalizes
 * it to lowercase for use as AAD. This module is a server-only security
 * boundary and must not depend on its caller having already validated or
 * canonicalized the id -- an arbitrary non-uuid string is rejected
 * outright rather than merely lowercased and used as-is.
 */
function canonicalizeShareLinkIdForAad(shareLinkId: string): string {
  if (typeof shareLinkId !== "string" || !UUID_PATTERN.test(shareLinkId)) {
    throw new ShareSecretEncryptionError("invalid_share_link_id");
  }

  return shareLinkId.toLowerCase();
}

/**
 * Additional authenticated data binding the ciphertext to exactly one
 * share link, canonicalized to lowercase -- a ciphertext/nonce/authTag
 * triple copied onto a different link's row fails GCM authentication
 * instead of silently decrypting into the wrong link's secret.
 */
function toAdditionalAuthenticatedData(canonicalShareLinkId: string): Buffer {
  return Buffer.from(canonicalShareLinkId, "utf8");
}

/**
 * Encrypts the raw 43-character share secret with a fresh random 12-byte
 * nonce and a 16-byte authentication tag, AAD-bound to shareLinkId.
 * Validates both `plaintext` and `shareLinkId` itself before encrypting
 * anything -- this module never trusts that its caller already supplied
 * well-formed values.
 */
export function encryptShareSecret(
  plaintext: string,
  shareLinkId: string
): EncryptedShareSecretMaterial {
  if (typeof plaintext !== "string" || !isValidBase64UrlSecretShape(plaintext)) {
    throw new ShareSecretEncryptionError("invalid_plaintext");
  }

  const canonicalShareLinkId = canonicalizeShareLinkIdForAad(shareLinkId);
  const key = getShareSecretEncryptionKey();
  const nonce = randomBytes(NONCE_BYTES);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(toAdditionalAuthenticatedData(canonicalShareLinkId));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    nonce,
    authTag,
    encryptionVersion: SHARE_SECRET_ENCRYPTION_VERSION,
  };
}

/**
 * Decrypts previously encrypted share-secret material. Not used by any
 * Phase 1B.2 route (no REVEAL endpoint exists yet), but included and
 * tested now so the encryption round trip and AAD binding are proven.
 *
 * Every input is validated -- shape and length -- before decryption is
 * ever attempted: malformed ciphertext/nonce/authTag lengths, an unknown
 * encryptionVersion, or a malformed shareLinkId all fail closed before
 * any cryptographic operation runs. Fails closed
 * (ShareSecretEncryptionError "decryption_failed") if the ciphertext,
 * auth tag or nonce was tampered with, or if the wrong shareLinkId AAD is
 * supplied. After a successful authenticated decryption, the recovered
 * plaintext is itself validated as exactly 43 base64url characters --
 * GCM authentication proves the bytes were not tampered with, but not
 * that they are a share secret this module ever produced, so a
 * successfully authenticated but non-secret-shaped plaintext still fails
 * closed ("invalid_decrypted_plaintext") rather than being returned.
 */
export function decryptShareSecret(input: DecryptShareSecretInput): string {
  const { ciphertext, nonce, authTag, encryptionVersion, shareLinkId } = input;

  if (encryptionVersion !== SHARE_SECRET_ENCRYPTION_VERSION) {
    throw new ShareSecretEncryptionError("unknown_encryption_version");
  }

  if (!ciphertext || ciphertext.length !== CIPHERTEXT_BYTES) {
    throw new ShareSecretEncryptionError("invalid_ciphertext_length");
  }

  if (!nonce || nonce.length !== NONCE_BYTES) {
    throw new ShareSecretEncryptionError("invalid_nonce_length");
  }

  if (!authTag || authTag.length !== AUTH_TAG_BYTES) {
    throw new ShareSecretEncryptionError("invalid_auth_tag_length");
  }

  const canonicalShareLinkId = canonicalizeShareLinkIdForAad(shareLinkId);
  const key = getShareSecretEncryptionKey();

  let plaintext: string;
  try {
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, nonce, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(toAdditionalAuthenticatedData(canonicalShareLinkId));
    decipher.setAuthTag(authTag);

    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (isShareSecretEncryptionError(error)) {
      throw error;
    }
    throw new ShareSecretEncryptionError("decryption_failed");
  }

  if (!isValidBase64UrlSecretShape(plaintext)) {
    throw new ShareSecretEncryptionError("invalid_decrypted_plaintext");
  }

  return plaintext;
}
