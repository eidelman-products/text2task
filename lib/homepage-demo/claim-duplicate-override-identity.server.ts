import "server-only";

import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";
import {
  createHomepageDemoToken,
  hashHomepageDemoToken,
  isValidHomepageDemoToken,
} from "@/lib/homepage-demo/tokens.server";

const DUPLICATE_OVERRIDE_COOKIE_MAX_AGE_SECONDS = 5 * 60;

export type HomepageDemoDuplicateOverrideAuthority = Readonly<{
  rawToken: string;
  tokenHash: string;
}>;

export type HomepageDemoDuplicateOverrideCookie =
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

export type HomepageDemoDuplicateOverrideCookiePolicy = Readonly<{
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

export function createHomepageDemoDuplicateOverrideAuthority(): HomepageDemoDuplicateOverrideAuthority {
  const token = createHomepageDemoToken("homepage-demo-duplicate-override");

  return {
    rawToken: token.token,
    tokenHash: token.tokenHash,
  };
}

export function readHomepageDemoDuplicateOverrideCookie(
  cookies: HomepageDemoCookieReader
): HomepageDemoDuplicateOverrideCookie {
  const value = cookies.get(getHomepageDemoDuplicateOverrideCookieName())?.value;

  if (value === undefined) {
    return { kind: "missing" };
  }

  if (!isValidHomepageDemoToken(value)) {
    return { kind: "malformed" };
  }

  return {
    kind: "valid",
    tokenHash: hashHomepageDemoDuplicateOverrideToken(value),
  };
}

export function hashHomepageDemoDuplicateOverrideToken(token: string): string {
  if (!isValidHomepageDemoToken(token)) {
    throw new Error("Invalid homepage demo duplicate override token");
  }

  return hashHomepageDemoToken({
    token,
    purpose: "homepage-demo-duplicate-override",
  });
}

export function getHomepageDemoDuplicateOverrideCookiePolicy(
  expiresAt: Date
): HomepageDemoDuplicateOverrideCookiePolicy {
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  const now = new Date();
  const secondsUntilExpiry = Math.floor(
    (expiresAt.getTime() - now.getTime()) / 1000
  );

  if (
    !Number.isSafeInteger(secondsUntilExpiry) ||
    secondsUntilExpiry < 1
  ) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return {
    name: getHomepageDemoDuplicateOverrideCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge: Math.min(
      secondsUntilExpiry,
      DUPLICATE_OVERRIDE_COOKIE_MAX_AGE_SECONDS
    ),
  };
}

export function getHomepageDemoDuplicateOverrideCookieClearPolicy(): HomepageDemoDuplicateOverrideCookiePolicy {
  return {
    name: getHomepageDemoDuplicateOverrideCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge: 0,
  };
}

function getHomepageDemoDuplicateOverrideCookieName(): string {
  return isProductionRuntime()
    ? "__Host-t2t_homepage_demo_duplicate_override"
    : "t2t_homepage_demo_duplicate_override_dev";
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
