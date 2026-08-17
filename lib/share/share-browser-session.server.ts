import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * Phase 3 -- browser-session raw credential generation, keyed-digest
 * computation, and cookie policy for the anonymous Client Share surface
 * (public.share_browser_sessions). Mirrors lib/share/share-secret.server.ts's
 * exact HMAC construction (domain-separated, dedicated base64url env-var
 * key, minimum-length, fail-closed) -- this is the SAME architecture
 * share_browser_sessions.session_digest's own column comment already
 * calls for ("Lowercase hex keyed digest of the browser's cookie
 * secret... Version of the keyed digest scheme, so the server key can be
 * rotated"), so this module is not a new security design, only this
 * table's own instance of an already-accepted repository pattern.
 *
 * The raw session secret is a fresh 32-byte random value (matching
 * generateRawShareSecret's own shape/entropy) and is NEVER persisted --
 * only its keyed digest is ever written to
 * share_browser_sessions.session_digest, matching that column's own
 * documented invariant exactly. The raw secret's only home is the
 * HttpOnly cookie.
 */

const RAW_SESSION_SECRET_RANDOM_BYTES = 32;
const RAW_SESSION_SECRET_BASE64URL_LENGTH = 43;
const BASE64URL_43_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const SESSION_DIGEST_HEX_PATTERN = /^[0-9a-f]{64}$/;

const SESSION_HMAC_KEY_ENV = "TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1";
const SESSION_HMAC_ALGORITHM = "sha256";
const SESSION_HMAC_DOMAIN = "text2task.share.browser-session-digest.v1";
const SESSION_HMAC_KEY_MIN_BYTES = 32;

export const SHARE_BROWSER_SESSION_DIGEST_VERSION = 1 as const;

/** Locked V1 product decision: a successfully authorized browser may
 * return within this window without reopening the original #secret link.
 * Does not extend a share link's own lifecycle (expiry/disable/revoke/
 * rotation/configuration_version remain independently authoritative) --
 * see share-session-grant.server.ts's own grant-expiry clamp. */
export const SHARE_BROWSER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Cookie is scoped to the narrowest path that still covers both public
 * Client Share API routes (POST /api/share/session,
 * GET /api/share/[publicId]/projection) -- the public PAGE itself never
 * needs to read this cookie. Deliberately not `__Host-`-prefixed: that
 * prefix requires Path=/, which would be broader than necessary here. */
export const SHARE_BROWSER_SESSION_COOKIE_PATH = "/api/share";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function getShareBrowserSessionCookieName(): string {
  return "t2t_client_share_session";
}

export type ShareBrowserSessionCookiePolicy = Readonly<{
  name: string;
  httpOnly: true;
  sameSite: "lax";
  path: typeof SHARE_BROWSER_SESSION_COOKIE_PATH;
  secure: boolean;
  maxAge: number;
}>;

export function getShareBrowserSessionCookiePolicy(): ShareBrowserSessionCookiePolicy {
  return {
    name: getShareBrowserSessionCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: SHARE_BROWSER_SESSION_COOKIE_PATH,
    secure: isProductionRuntime(),
    maxAge: SHARE_BROWSER_SESSION_TTL_SECONDS,
  };
}

/** Clearing a cookie in this repository is always "re-set the same
 * policy with maxAge: 0", never cookies().delete(...) -- matching every
 * existing homepage-demo cookie-clear call site. */
export function getShareBrowserSessionCookieClearPolicy(): ShareBrowserSessionCookiePolicy {
  return { ...getShareBrowserSessionCookiePolicy(), maxAge: 0 };
}

export type ShareBrowserSessionErrorCode =
  | "hmac_key_missing"
  | "hmac_key_malformed"
  | "hmac_key_too_short"
  | "invalid_raw_session_secret";

const ERROR_MESSAGES: Record<ShareBrowserSessionErrorCode, string> = {
  hmac_key_missing: "Client Share browser-session HMAC key is not configured.",
  hmac_key_malformed: "Client Share browser-session HMAC key is malformed.",
  hmac_key_too_short: "Client Share browser-session HMAC key is too short.",
  invalid_raw_session_secret:
    "Raw Client Share browser-session secret is not exactly 43 base64url characters.",
};

export class ShareBrowserSessionError extends Error {
  readonly code: ShareBrowserSessionErrorCode;

  constructor(code: ShareBrowserSessionErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ShareBrowserSessionError";
    this.code = code;
  }
}

export function isShareBrowserSessionError(
  error: unknown
): error is ShareBrowserSessionError {
  return error instanceof ShareBrowserSessionError;
}

/** randomBytes(32).toString("base64url") -- exactly 43 base64url
 * characters, matching generateRawShareSecret's own shape/entropy. */
export function generateShareBrowserSessionSecret(): string {
  return randomBytes(RAW_SESSION_SECRET_RANDOM_BYTES).toString("base64url");
}

export function isValidRawShareBrowserSessionSecret(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === RAW_SESSION_SECRET_BASE64URL_LENGTH &&
    BASE64URL_43_PATTERN.test(value)
  );
}

/** The persisted representation: lowercase hex, exactly 64 characters,
 * matching share_browser_sessions_session_digest_format_check exactly. */
export function isValidShareBrowserSessionDigest(value: unknown): value is string {
  return typeof value === "string" && SESSION_DIGEST_HEX_PATTERN.test(value);
}

function getSessionHmacKey(): Buffer {
  const rawKey = process.env[SESSION_HMAC_KEY_ENV];

  if (!rawKey) {
    throw new ShareBrowserSessionError("hmac_key_missing");
  }

  if (rawKey.trim() !== rawKey || !/^[A-Za-z0-9_-]+$/.test(rawKey)) {
    throw new ShareBrowserSessionError("hmac_key_malformed");
  }

  let key: Buffer;
  try {
    key = Buffer.from(rawKey, "base64url");
  } catch {
    throw new ShareBrowserSessionError("hmac_key_malformed");
  }

  if (key.toString("base64url") !== rawKey) {
    throw new ShareBrowserSessionError("hmac_key_malformed");
  }

  if (key.length < SESSION_HMAC_KEY_MIN_BYTES) {
    throw new ShareBrowserSessionError("hmac_key_too_short");
  }

  return key;
}

/**
 * Keyed HMAC-SHA256 digest of a raw browser-session secret. Returns
 * lowercase hex, exactly 64 characters -- the exact persisted
 * representation share_browser_sessions.session_digest requires. Never
 * trusts that its caller already validated `rawSecret`.
 */
export function hashShareBrowserSessionSecret(rawSecret: string): string {
  if (!isValidRawShareBrowserSessionSecret(rawSecret)) {
    throw new ShareBrowserSessionError("invalid_raw_session_secret");
  }

  const key = getSessionHmacKey();

  return createHmac(SESSION_HMAC_ALGORITHM, key)
    .update(SESSION_HMAC_DOMAIN)
    .update("\0")
    .update(rawSecret)
    .digest("hex");
}
