import "server-only";

import { createHmac } from "node:crypto";

import {
  getHomepageDemoTrustedClientIpIdentity,
  type HomepageDemoHeadersLike,
} from "@/lib/homepage-demo/client-ip.server";
import { HomepageDemoIdentityError } from "@/lib/homepage-demo/errors";
import {
  createHomepageDemoDeviceToken,
  createHomepageDemoSessionToken,
  type HomepageDemoTokenPair,
} from "@/lib/homepage-demo/tokens.server";

const IP_IDENTITY_HMAC_SECRET_ENV =
  "TEXT2TASK_HOMEPAGE_DEMO_IDENTITY_HMAC_SECRET_V1";
const IP_IDENTITY_HMAC_ALGORITHM = "sha256";
const IP_IDENTITY_HMAC_DOMAIN = "text2task.homepage-demo.ip-identity.v1";
const IP_IDENTITY_SECRET_MIN_BYTES = 32;

export const HOMEPAGE_DEMO_IDENTITY_DIGEST_VERSION = "v1" as const;
export const HOMEPAGE_DEMO_IDENTITY_DIGEST_ACTIVE_VERSION =
  HOMEPAGE_DEMO_IDENTITY_DIGEST_VERSION;
export const HOMEPAGE_DEMO_IDENTITY_DIGEST_ACCEPTED_VERSIONS = [
  HOMEPAGE_DEMO_IDENTITY_DIGEST_VERSION,
] as const;

export const HOMEPAGE_DEMO_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60;
export const HOMEPAGE_DEMO_DEVICE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type HomepageDemoCookiePolicy = Readonly<{
  name: string;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
}>;

export type HomepageDemoAnonymousIdentityToken = Readonly<{
  rawToken: string;
  tokenHash: string;
}>;

export type HomepageDemoAnonymousIdentityTokens = Readonly<{
  session: HomepageDemoAnonymousIdentityToken;
  device: HomepageDemoAnonymousIdentityToken;
}>;

export type HomepageDemoIpIdentityDigest = Readonly<{
  version: typeof HOMEPAGE_DEMO_IDENTITY_DIGEST_VERSION;
  digest: string;
}>;

export function getHomepageDemoSessionCookiePolicy(): HomepageDemoCookiePolicy {
  return {
    name: getHomepageDemoSessionCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge: HOMEPAGE_DEMO_SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getHomepageDemoDeviceCookiePolicy(): HomepageDemoCookiePolicy {
  return {
    name: getHomepageDemoDeviceCookieName(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProductionRuntime(),
    maxAge: HOMEPAGE_DEMO_DEVICE_COOKIE_MAX_AGE_SECONDS,
  };
}

export function createHomepageDemoAnonymousIdentityTokens(): HomepageDemoAnonymousIdentityTokens {
  return {
    session: toAnonymousIdentityToken(createHomepageDemoSessionToken()),
    device: toAnonymousIdentityToken(createHomepageDemoDeviceToken()),
  };
}

export function createHomepageDemoIpIdentityDigest(
  headers: HomepageDemoHeadersLike
): HomepageDemoIpIdentityDigest {
  const clientIpIdentity = getHomepageDemoTrustedClientIpIdentity(headers);
  const secret = getHomepageDemoIdentityHmacSecret();
  const digest = createHmac(IP_IDENTITY_HMAC_ALGORITHM, secret)
    .update(IP_IDENTITY_HMAC_DOMAIN)
    .update("\0")
    .update(clientIpIdentity.normalizedIdentity)
    .digest("hex");

  return {
    version: HOMEPAGE_DEMO_IDENTITY_DIGEST_VERSION,
    digest: `${HOMEPAGE_DEMO_IDENTITY_DIGEST_VERSION}:${digest}`,
  };
}

function getHomepageDemoSessionCookieName(): string {
  return isProductionRuntime()
    ? "__Host-t2t_homepage_demo_session"
    : "t2t_homepage_demo_session_dev";
}

function getHomepageDemoDeviceCookieName(): string {
  return isProductionRuntime()
    ? "__Host-t2t_homepage_demo_device"
    : "t2t_homepage_demo_device_dev";
}

function toAnonymousIdentityToken(
  tokenPair: HomepageDemoTokenPair
): HomepageDemoAnonymousIdentityToken {
  return {
    rawToken: tokenPair.token,
    tokenHash: tokenPair.tokenHash,
  };
}

function getHomepageDemoIdentityHmacSecret(): Buffer {
  const rawSecret = process.env[IP_IDENTITY_HMAC_SECRET_ENV];

  if (!rawSecret) {
    throw new HomepageDemoIdentityError("identity_configuration_invalid");
  }

  if (rawSecret.trim() !== rawSecret || !/^[A-Za-z0-9_-]+$/.test(rawSecret)) {
    throw new HomepageDemoIdentityError("identity_configuration_invalid");
  }

  try {
    const secret = Buffer.from(rawSecret, "base64url");

    if (
      secret.length < IP_IDENTITY_SECRET_MIN_BYTES ||
      secret.toString("base64url") !== rawSecret
    ) {
      throw new HomepageDemoIdentityError("identity_configuration_invalid");
    }

    return secret;
  } catch {
    throw new HomepageDemoIdentityError("identity_configuration_invalid");
  }
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
