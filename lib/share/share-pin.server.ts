import "server-only";

import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * Share-link PIN hashing and verification. No dependency, node:crypto
 * only, the asynchronous scrypt API (never scryptSync -- a synchronous
 * KDF call blocks the whole Node event loop for the full ~hundreds of
 * milliseconds this profile takes).
 *
 * The V1 profile matches the already-delivered Phase 1A constraints
 * exactly (project_share_links_pin_completeness_check,
 * 202608030003_client_share_owner_foundation.sql):
 * pin_hash_version = 1, N = 16384, r = 8, p = 1, keyLength = 32.
 *
 * This module never logs a PIN, salt or hash on any code path.
 */

/**
 * A minimal, explicitly typed Promise wrapper around node:crypto's native
 * callback-based scrypt -- deliberately not util's own promisify helper,
 * whose inferred type for scrypt collapses its overloads down to the
 * 3-argument (no `ScryptOptions`) signature, which loses the ability to
 * pass N/r/p/maxmem at all. Calling the native 5-argument callback
 * overload directly (password, salt, keyLength, options, callback) keeps
 * that overload's full type information intact, so no unsafe cast is
 * needed anywhere in this module. Both hashSharePin and verifySharePin
 * call this one wrapper -- there is exactly one implementation of the
 * fixed scrypt profile.
 */
function scryptDerive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/** Exactly 4-6 ASCII decimal digits. No whitespace trimming, no Unicode
 * digits (\d in a non-unicode regex matches only ASCII 0-9 here since no
 * `u` flag is set), no coercion from a number. */
const PIN_PATTERN = /^[0-9]{4,6}$/;

export const SHARE_PIN_HASH_VERSION = 1 as const;
const PIN_SCRYPT_N = 16384;
const PIN_SCRYPT_R = 8;
const PIN_SCRYPT_P = 1;
const PIN_KEY_LENGTH = 32;

/**
 * scrypt's own memory requirement is 128 * N * r bytes (~16 MiB for this
 * profile, independent of p) -- doubled here for headroom and set
 * explicitly rather than relying on Node's undocumented-as-fixed 32 MiB
 * default, so a future Node default change can never silently affect
 * this fixed V1 profile. Bounded, never unbounded.
 */
const SCRYPT_MAXMEM = 128 * PIN_SCRYPT_N * PIN_SCRYPT_R * 2;

const SALT_RANDOM_BYTES = 16;
const SALT_BASE64URL_LENGTH = 22;
const HASH_BASE64URL_LENGTH = 43;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type SharePinErrorCode =
  | "invalid_pin"
  | "invalid_stored_material"
  | "unsupported_profile"
  | "hash_failed";

const ERROR_MESSAGES: Record<SharePinErrorCode, string> = {
  invalid_pin: "PIN is not exactly 4-6 ASCII decimal digits.",
  invalid_stored_material: "Stored PIN material is malformed.",
  unsupported_profile: "Stored PIN profile is not the supported V1 profile.",
  hash_failed: "PIN hashing failed.",
};

export class SharePinError extends Error {
  readonly code: SharePinErrorCode;

  constructor(code: SharePinErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "SharePinError";
    this.code = code;
  }
}

export function isSharePinError(error: unknown): error is SharePinError {
  return error instanceof SharePinError;
}

export function isValidSharePin(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

export type SharePinHashResult = Readonly<{
  pinHash: string;
  pinSalt: string;
  pinHashVersion: typeof SHARE_PIN_HASH_VERSION;
  pinScryptN: number;
  pinScryptR: number;
  pinScryptP: number;
  pinKeyLength: number;
}>;

/**
 * Hashes a fresh PIN with a fresh random salt at the fixed V1 profile.
 * Rejects a malformed PIN before scrypt is ever invoked. The result
 * contains only the seven PIN columns project_share_links stores --
 * never the plaintext PIN.
 */
export async function hashSharePin(pin: string): Promise<SharePinHashResult> {
  if (!isValidSharePin(pin)) {
    throw new SharePinError("invalid_pin");
  }

  const salt = randomBytes(SALT_RANDOM_BYTES);

  let derivedKey: Buffer;
  try {
    derivedKey = await scryptDerive(pin, salt, PIN_KEY_LENGTH, {
      N: PIN_SCRYPT_N,
      r: PIN_SCRYPT_R,
      p: PIN_SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    throw new SharePinError("hash_failed");
  }

  return {
    pinHash: derivedKey.toString("base64url"),
    pinSalt: salt.toString("base64url"),
    pinHashVersion: SHARE_PIN_HASH_VERSION,
    pinScryptN: PIN_SCRYPT_N,
    pinScryptR: PIN_SCRYPT_R,
    pinScryptP: PIN_SCRYPT_P,
    pinKeyLength: PIN_KEY_LENGTH,
  };
}

export type StoredSharePinMaterial = Readonly<{
  pinHash: string;
  pinSalt: string;
  pinHashVersion: number;
  pinScryptN: number;
  pinScryptR: number;
  pinScryptP: number;
  pinKeyLength: number;
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Runtime type guard for untrusted stored PIN material -- `verifySharePin`
 * is a server-only security boundary and must never assume its caller
 * already validated a TypeScript-typed object at compile time; this
 * validates every field's actual runtime type before any of them is ever
 * read for a decision. Never accesses a property before confirming the
 * value is a non-null, non-array object.
 */
function isValidStoredMaterialShape(
  material: unknown
): material is StoredSharePinMaterial {
  if (!isPlainObject(material)) {
    return false;
  }

  const {
    pinHash,
    pinSalt,
    pinHashVersion,
    pinScryptN,
    pinScryptR,
    pinScryptP,
    pinKeyLength,
  } = material;

  if (typeof pinHash !== "string" || typeof pinSalt !== "string") {
    return false;
  }

  if (
    typeof pinHashVersion !== "number" ||
    typeof pinScryptN !== "number" ||
    typeof pinScryptR !== "number" ||
    typeof pinScryptP !== "number" ||
    typeof pinKeyLength !== "number"
  ) {
    return false;
  }

  if (pinHash.length !== HASH_BASE64URL_LENGTH || !BASE64URL_PATTERN.test(pinHash)) {
    return false;
  }

  if (pinSalt.length !== SALT_BASE64URL_LENGTH || !BASE64URL_PATTERN.test(pinSalt)) {
    return false;
  }

  return true;
}

/**
 * Strict Base64URL decode-and-round-trip check. Confirms `value` decodes
 * to exactly `expectedByteLength` bytes AND that re-encoding those bytes
 * with the same canonical encoder reproduces `value` exactly --
 * `Buffer.from(value, "base64url")` silently accepts some non-canonical
 * trailing-bit encodings (extra encoded bits that don't correspond to any
 * real byte), so a regex plus a character-count check alone does not
 * prove a string is *the* canonical encoding of the expected byte
 * sequence. `Buffer.from` with this encoding never throws, so this never
 * throws either -- every failure mode returns null so callers can map it
 * to one uniform typed error.
 */
function decodeCanonicalBase64Url(
  value: string,
  expectedByteLength: number
): Buffer | null {
  const decoded = Buffer.from(value, "base64url");

  if (decoded.length !== expectedByteLength) {
    return null;
  }

  if (decoded.toString("base64url") !== value) {
    return null;
  }

  return decoded;
}

function isSupportedProfile(material: StoredSharePinMaterial): boolean {
  return (
    material.pinHashVersion === SHARE_PIN_HASH_VERSION &&
    material.pinScryptN === PIN_SCRYPT_N &&
    material.pinScryptR === PIN_SCRYPT_R &&
    material.pinScryptP === PIN_SCRYPT_P &&
    material.pinKeyLength === PIN_KEY_LENGTH
  );
}

/**
 * Verifies a candidate PIN against previously stored material.
 * `material` is `unknown` -- this is a server-only security boundary and
 * must safely handle untrusted runtime input, not only a compile-time
 * TypeScript object, so no field of it is ever read before its shape and
 * primitive field types are confirmed. Validates the PIN shape, the
 * stored material's shape (rejecting a non-object/array/missing-field/
 * wrong-type value, malformed base64url, or a wrong encoded length,
 * before ever decoding anything) and the stored profile (rejecting
 * anything but the exact supported V1 profile) before deriving anything.
 * `pinHash`/`pinSalt` are decoded through `decodeCanonicalBase64Url`,
 * which additionally rejects a non-canonical encoding whose decoded bytes
 * would re-encode to a different string than what was stored. Comparison
 * uses `timingSafeEqual` on two already-length-verified, equal-length
 * buffers -- never a `===` string comparison, which would leak timing
 * information about how many leading bytes matched.
 */
export async function verifySharePin(
  pin: string,
  material: unknown
): Promise<boolean> {
  if (!isValidSharePin(pin)) {
    throw new SharePinError("invalid_pin");
  }

  if (!isValidStoredMaterialShape(material)) {
    throw new SharePinError("invalid_stored_material");
  }

  if (!isSupportedProfile(material)) {
    throw new SharePinError("unsupported_profile");
  }

  const storedHash = decodeCanonicalBase64Url(material.pinHash, material.pinKeyLength);
  if (storedHash === null) {
    throw new SharePinError("invalid_stored_material");
  }

  const salt = decodeCanonicalBase64Url(material.pinSalt, SALT_RANDOM_BYTES);
  if (salt === null) {
    throw new SharePinError("invalid_stored_material");
  }

  let derivedKey: Buffer;
  try {
    derivedKey = await scryptDerive(pin, salt, material.pinKeyLength, {
      N: material.pinScryptN,
      r: material.pinScryptR,
      p: material.pinScryptP,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    throw new SharePinError("hash_failed");
  }

  if (derivedKey.length !== storedHash.length) {
    // Structurally unreachable given the checks above (both are pinned
    // to material.pinKeyLength), kept as a hard guarantee that
    // timingSafeEqual -- which throws on a length mismatch -- is never
    // called with unequal-length buffers.
    throw new SharePinError("invalid_stored_material");
  }

  return timingSafeEqual(derivedKey, storedHash);
}
