import "server-only";

import {
  createHomepageDemoToken,
  hashHomepageDemoToken,
  isValidHomepageDemoToken,
} from "@/lib/homepage-demo/tokens.server";

const CLAIM_COOKIE_MAX_AGE_SECONDS = 20 * 60;

export type HomepageDemoClaimAuthority = Readonly<{
  rawToken: string;
  tokenHash: string;
}>;

export type HomepageDemoClaimCookie = Readonly<{
  tokenHash: string;
}>;

export type HomepageDemoClaimExpiry = Readonly<{
  expiresAt: Date;
  maxAgeSeconds: number;
}>;

export type HomepageDemoClaimCookiePolicy = Readonly<{
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

export function createHomepageDemoClaimAuthority(): HomepageDemoClaimAuthority {
  const token = createHomepageDemoToken("homepage-demo-claim");

  return {
    rawToken: token.token,
    tokenHash: token.tokenHash,
  };
}

export function readHomepageDemoClaimCookie(
  cookies: HomepageDemoCookieReader
): HomepageDemoClaimCookie | null {
  const value = cookies.get(getHomepageDemoClaimCookieName())?.value;

  if (!isValidHomepageDemoToken(value)) {
    return null;
  }

  return {
    tokenHash: hashHomepageDemoClaimToken(value),
  };
}

export function hashHomepageDemoClaimToken(token: string): string {
  if (!isValidHomepageDemoToken(token)) {
    throw new Error("Invalid homepage demo claim token");
  }

  return hashHomepageDemoToken({
    token,
    purpose: "homepage-demo-claim",
  });
}

export function calculateHomepageDemoClaimExpiry({
  now,
  trialExpiresAt,
  draftExpiresAt,
}: {
  now: Date;
  trialExpiresAt: Date;
  draftExpiresAt: Date;
}): HomepageDemoClaimExpiry | null {
  const claimTtlExpiresAt = new Date(
    now.getTime() + CLAIM_COOKIE_MAX_AGE_SECONDS * 1000
  );
  const boundedExpiresAt = minDate([
    claimTtlExpiresAt,
    trialExpiresAt,
    draftExpiresAt,
  ]);
  const maxAgeSeconds = Math.floor(
    (boundedExpiresAt.getTime() - now.getTime()) / 1000
  );

  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    return null;
  }

  return {
    expiresAt: new Date(now.getTime() + maxAgeSeconds * 1000),
    maxAgeSeconds,
  };
}

export function getHomepageDemoClaimCookiePolicy(
  maxAge: number
): HomepageDemoClaimCookiePolicy {
  return {
    name: getHomepageDemoClaimCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge,
  };
}

export function getHomepageDemoClaimCookieClearPolicy(): HomepageDemoClaimCookiePolicy {
  return getHomepageDemoClaimCookiePolicy(0);
}

function getHomepageDemoClaimCookieName(): string {
  return isProductionRuntime()
    ? "__Host-t2t_homepage_demo_claim"
    : "t2t_homepage_demo_claim_dev";
}

function minDate(values: readonly Date[]): Date {
  return values.reduce((minimum, value) =>
    value.getTime() < minimum.getTime() ? value : minimum
  );
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
