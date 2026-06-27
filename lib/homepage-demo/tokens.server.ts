import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { HomepageDemoTokenPurpose } from "@/lib/homepage-demo/types";

const TOKEN_RANDOM_BYTES = 32;
const TOKEN_HASH_ALGORITHM = "sha256";
const HASH_DOMAIN = "text2task.homepage-demo.token.v1";

export type HomepageDemoTokenPair = Readonly<{
  token: string;
  tokenHash: string;
  purpose: HomepageDemoTokenPurpose;
}>;

export function generateHomepageDemoToken(): string {
  return randomBytes(TOKEN_RANDOM_BYTES).toString("base64url");
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

export function createHomepageDemoIdempotencyToken(): HomepageDemoTokenPair {
  return createHomepageDemoToken("homepage-demo-idempotency");
}
