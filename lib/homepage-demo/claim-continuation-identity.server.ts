import "server-only";

import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";
import {
  createHomepageDemoToken,
  hashHomepageDemoToken,
  isValidHomepageDemoToken,
} from "@/lib/homepage-demo/tokens.server";

export type HomepageDemoClaimContinuationAuthority = Readonly<{
  rawToken: string;
  tokenHash: string;
}>;

export type HomepageDemoClaimContinuationCookie =
  | Readonly<{
      kind: "missing";
    }>
  | Readonly<{
      kind: "malformed";
    }>
  | Readonly<{
      kind: "valid";
      tokenHash: string;
    }>;

export type HomepageDemoClaimContinuationCookiePolicy = Readonly<{
  name: string;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
}>;

type HomepageDemoCookieReader = Readonly<{
  get(name: string): { value: string } | undefined;
}>;

export function createHomepageDemoClaimContinuationAuthority(): HomepageDemoClaimContinuationAuthority {
  const token = createHomepageDemoToken("homepage-demo-claim-continuation");

  return {
    rawToken: token.token,
    tokenHash: token.tokenHash,
  };
}

export function readHomepageDemoClaimContinuationCookie(
  cookies: HomepageDemoCookieReader
): HomepageDemoClaimContinuationCookie {
  const value = cookies.get(getHomepageDemoClaimContinuationCookieName())?.value;

  if (value === undefined) {
    return { kind: "missing" };
  }

  if (!isValidHomepageDemoToken(value)) {
    return { kind: "malformed" };
  }

  return {
    kind: "valid",
    tokenHash: hashHomepageDemoClaimContinuationToken(value),
  };
}

export function hashHomepageDemoClaimContinuationToken(token: string): string {
  if (!isValidHomepageDemoToken(token)) {
    throw new Error("Invalid homepage demo claim continuation token");
  }

  return hashHomepageDemoToken({
    token,
    purpose: "homepage-demo-claim-continuation",
  });
}

export function getHomepageDemoClaimContinuationCookiePolicy(
  expiresAt: Date
): HomepageDemoClaimContinuationCookiePolicy {
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  const now = new Date();
  const secondsUntilExpiry = Math.floor(
    (expiresAt.getTime() - now.getTime()) / 1000
  );

  if (!Number.isSafeInteger(secondsUntilExpiry) || secondsUntilExpiry < 1) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return {
    name: getHomepageDemoClaimContinuationCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge: secondsUntilExpiry,
  };
}

export function getHomepageDemoClaimContinuationCookieClearPolicy(): HomepageDemoClaimContinuationCookiePolicy {
  return {
    name: getHomepageDemoClaimContinuationCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge: 0,
  };
}

function getHomepageDemoClaimContinuationCookieName(): string {
  return isProductionRuntime()
    ? "__Host-t2t_homepage_demo_claim_continuation"
    : "t2t_homepage_demo_claim_continuation_dev";
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
