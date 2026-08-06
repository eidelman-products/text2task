import "server-only";

import { randomBytes } from "node:crypto";

/**
 * public_id generation, per the Phase 1B mapping report section 5.1:
 * generated in TypeScript (Phase 1A deliberately does not install
 * pgcrypto), 18 random bytes -> 24 base64url characters, 144 bits of
 * entropy. This is an opaque identifier, not the access secret -- it
 * travels in the plain HTTP request path by design -- so its entropy
 * requirement is about collision avoidance, not secrecy, and it is never
 * derived from project id, user id, a timestamp or a counter.
 */

const PUBLIC_ID_RANDOM_BYTES = 18;
const PUBLIC_ID_LENGTH = 24;

/** Must stay compatible with the existing database constraint
 * project_share_links_public_id_format_check. */
export const SHARE_PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function generateSharePublicId(): string {
  return randomBytes(PUBLIC_ID_RANDOM_BYTES).toString("base64url");
}

export function isValidSharePublicId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === PUBLIC_ID_LENGTH &&
    SHARE_PUBLIC_ID_PATTERN.test(value)
  );
}
