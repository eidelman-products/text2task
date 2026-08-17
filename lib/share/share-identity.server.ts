import "server-only";

import { createHash, createHmac } from "node:crypto";

import {
  getHomepageDemoTrustedClientIpIdentity,
  type HomepageDemoHeadersLike,
} from "@/lib/homepage-demo/client-ip.server";

/**
 * Phase 3 -- network-identity and share-link-scoped rate-limit identity
 * digests for the anonymous Client Share surface. Mirrors
 * lib/homepage-demo/identity.server.ts's createHomepageDemoIpIdentityDigest
 * HMAC construction exactly (algorithm, `.update(domain).update("\0")
 * .update(payload)` domain-separation shape, base64url env-var key with a
 * minimum-length, fail-closed load) -- this is the SAME architecture
 * public.share_rate_limit_buckets.identity_digest's own column comment
 * already calls for ("Lowercase hex keyed HMAC digest ... mirroring
 * lib/homepage-demo/identity.server.ts"), so this module is not a new
 * security design, only this feature's own instance of an already-
 * accepted repository pattern.
 *
 * Deliberately returns { digest: <bare 64-hex>, version: <smallint> }
 * rather than homepage-demo's own "v1:<hex>" prefixed string -- the
 * Client Share schema's CHECK constraints
 * (share_rate_limit_buckets_identity_digest_check,
 * share_link_events_identity_digest_consistency_check) require a BARE
 * ^[0-9a-f]{64}$ value with the version stored in its own separate
 * smallint column, not embedded in the string.
 *
 * IP extraction is reused directly from
 * lib/homepage-demo/client-ip.server.ts's getHomepageDemoTrustedClientIpIdentity
 * -- that function is generic Vercel-proxy-trust/IP-normalization
 * infrastructure (production: x-vercel-forwarded-for; dev: a fixed dev
 * header), not homepage-demo product data, and re-implementing its
 * careful IPv4/IPv6 validation and range checks a second time would only
 * risk a subtly different bug in a security-relevant code path.
 *
 * Uses its OWN dedicated HMAC key, deliberately separate from every other
 * key in this repository (TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1,
 * TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1,
 * TEXT2TASK_HOMEPAGE_DEMO_IDENTITY_HMAC_SECRET_V1) -- reusing a key
 * across unrelated purposes would let a compromise of one purpose's key
 * compromise the other's data too, matching every existing key-loading
 * module's own stated rationale.
 */

const NETWORK_IDENTITY_HMAC_KEY_ENV = "TEXT2TASK_SHARE_NETWORK_IDENTITY_HMAC_KEY_V1";
const NETWORK_IDENTITY_HMAC_ALGORITHM = "sha256";
const NETWORK_IDENTITY_HMAC_DOMAIN = "text2task.share.network-identity.v1";
const NETWORK_IDENTITY_SECRET_MIN_BYTES = 32;

const LINK_IDENTITY_HASH_DOMAIN = "text2task.share.link-rate-limit-identity.v1";

export const SHARE_IDENTITY_DIGEST_VERSION = 1 as const;

export type ShareIdentityErrorCode =
  | "identity_unavailable"
  | "identity_input_invalid"
  | "identity_configuration_invalid";

const ERROR_MESSAGES: Record<ShareIdentityErrorCode, string> = {
  identity_unavailable: "Client Share network identity is unavailable.",
  identity_input_invalid: "Client Share network identity input is invalid.",
  identity_configuration_invalid:
    "Client Share network identity HMAC key is not configured correctly.",
};

export class ShareIdentityError extends Error {
  readonly code: ShareIdentityErrorCode;

  constructor(code: ShareIdentityErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ShareIdentityError";
    this.code = code;
  }
}

export function isShareIdentityError(error: unknown): error is ShareIdentityError {
  return error instanceof ShareIdentityError;
}

export type ShareIdentityDigest = Readonly<{
  digest: string;
  version: typeof SHARE_IDENTITY_DIGEST_VERSION;
}>;

function getNetworkIdentityHmacKey(): Buffer {
  const rawKey = process.env[NETWORK_IDENTITY_HMAC_KEY_ENV];

  if (!rawKey) {
    throw new ShareIdentityError("identity_configuration_invalid");
  }

  if (rawKey.trim() !== rawKey || !/^[A-Za-z0-9_-]+$/.test(rawKey)) {
    throw new ShareIdentityError("identity_configuration_invalid");
  }

  let key: Buffer;
  try {
    key = Buffer.from(rawKey, "base64url");
  } catch {
    throw new ShareIdentityError("identity_configuration_invalid");
  }

  if (key.toString("base64url") !== rawKey) {
    throw new ShareIdentityError("identity_configuration_invalid");
  }

  if (key.length < NETWORK_IDENTITY_SECRET_MIN_BYTES) {
    throw new ShareIdentityError("identity_configuration_invalid");
  }

  return key;
}

/**
 * Keyed HMAC-SHA256 digest of the caller's trusted, normalized network
 * identity (IP-derived). Used for the `network_identity` rate-limit scope
 * (session_exchange, invalid_link_access) and for
 * share_link_events.identity_digest. Throws ShareIdentityError (never
 * silently falls back) when the trusted IP cannot be determined -- a
 * missing/invalid identity must fail the caller's request closed, never
 * be treated as "unlimited".
 */
export function createShareNetworkIdentityDigest(
  headers: HomepageDemoHeadersLike
): ShareIdentityDigest {
  let normalizedIdentity: string;
  try {
    normalizedIdentity = getHomepageDemoTrustedClientIpIdentity(headers).normalizedIdentity;
  } catch {
    throw new ShareIdentityError("identity_unavailable");
  }

  const key = getNetworkIdentityHmacKey();
  const digest = createHmac(NETWORK_IDENTITY_HMAC_ALGORITHM, key)
    .update(NETWORK_IDENTITY_HMAC_DOMAIN)
    .update("\0")
    .update(normalizedIdentity)
    .digest("hex");

  return { digest, version: SHARE_IDENTITY_DIGEST_VERSION };
}

/**
 * Deterministic, per-link rate-limit identity for the `share_link` scope
 * (pin_verification) -- protects one specific link's PIN attempts
 * regardless of which network/device is attempting them, so an attacker
 * rotating IP addresses or devices against a single link's PIN is still
 * caught by the same bucket. Not a security secret itself (the link id is
 * already known to any caller who resolved a valid publicId), so this is
 * a plain domain-separated SHA-256 hash -- unkeyed, matching
 * lib/homepage-demo/tokens.server.ts's own precedent for hashing a
 * value where the point is a deterministic, collision-resistant bucket
 * key rather than a secrecy boundary.
 */
export function createShareLinkRateLimitIdentityDigest(
  shareLinkId: string
): ShareIdentityDigest {
  const digest = createHash("sha256")
    .update(LINK_IDENTITY_HASH_DOMAIN)
    .update("\0")
    .update(shareLinkId)
    .digest("hex");

  return { digest, version: SHARE_IDENTITY_DIGEST_VERSION };
}
