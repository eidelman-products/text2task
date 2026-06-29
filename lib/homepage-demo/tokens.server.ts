import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { HomepageDemoTokenPurpose } from "@/lib/homepage-demo/types";

const TOKEN_RANDOM_BYTES = 32;
const TOKEN_HASH_ALGORITHM = "sha256";
const HASH_DOMAIN = "text2task.homepage-demo.token.v1";
const TOKEN_BASE64URL_LENGTH = 43;
const TOKEN_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/u;

export type HomepageDemoTokenPair = Readonly<{
  token: string;
  tokenHash: string;
  purpose: HomepageDemoTokenPurpose;
}>;

export function generateHomepageDemoToken(): string {
  return randomBytes(TOKEN_RANDOM_BYTES).toString("base64url");
}

export function isValidHomepageDemoToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === TOKEN_BASE64URL_LENGTH &&
    value.trim() === value &&
    !TOKEN_CONTROL_CHARACTER_PATTERN.test(value) &&
    TOKEN_BASE64URL_PATTERN.test(value)
  );
}

export function hashHomepageDemoToken({
  token,
  purpose,
}: {
  token: string;
  purpose: HomepageDemoTokenPurpose;
}): string {
  if (token.length === 0) {
    throw new Error("Invalid homepage demo token");
  }

  return createHash(TOKEN_HASH_ALGORITHM)
    .update(HASH_DOMAIN)
    .update("\0")
    .update(purpose)
    .update("\0")
    .update(token)
    .digest("hex");
}

export function createHomepageDemoToken(
  purpose: HomepageDemoTokenPurpose
): HomepageDemoTokenPair {
  const token = generateHomepageDemoToken();

  return {
    token,
    tokenHash: hashHomepageDemoToken({ token, purpose }),
    purpose,
  };
}

export function createHomepageDemoPublicToken(): HomepageDemoTokenPair {
  return createHomepageDemoToken("homepage-demo-public");
}

export function createHomepageDemoSessionToken(): HomepageDemoTokenPair {
  return createHomepageDemoToken("homepage-demo-session");
}

export function createHomepageDemoDeviceToken(): HomepageDemoTokenPair {
  return createHomepageDemoToken("homepage-demo-device");
}

export function createHomepageDemoIdempotencyToken(): HomepageDemoTokenPair {
  return createHomepageDemoToken("homepage-demo-idempotency");
}

export function hashHomepageDemoCapacityLeaseToken(token: string): string {
  return hashHomepageDemoToken({
    token,
    purpose: "homepage-demo-capacity-lease",
  });
}

export function createHomepageDemoCapacityLeaseToken(): HomepageDemoTokenPair {
  return createHomepageDemoToken("homepage-demo-capacity-lease");
}
