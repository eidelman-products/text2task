import "server-only";

import {
  createHomepageDemoIpIdentityDigest,
  getHomepageDemoDeviceCookiePolicy,
  getHomepageDemoSessionCookiePolicy,
  type HomepageDemoCookiePolicy,
} from "@/lib/homepage-demo/identity.server";
import {
  HomepageDemoIdentityError,
  isHomepageDemoIdentityError,
} from "@/lib/homepage-demo/errors";
import {
  createHomepageDemoDeviceToken,
  createHomepageDemoIdempotencyToken,
  createHomepageDemoPublicToken,
  createHomepageDemoSessionToken,
  hashHomepageDemoToken,
  isValidHomepageDemoToken,
  type HomepageDemoTokenPair,
} from "@/lib/homepage-demo/tokens.server";
import type { HomepageDemoTextTrialIdentity } from "@/lib/homepage-demo/orchestration.server";
import type { HomepageDemoTokenPurpose } from "@/lib/homepage-demo/types";

export type HomepageDemoPublicExtractBootstrapInput = Readonly<{
  existingSessionCookie?: string | null;
  existingDeviceCookie?: string | null;
}>;

export type HomepageDemoPublicExtractCookieKind = "session" | "device";

export type HomepageDemoPublicExtractCookieInstruction = Readonly<{
  kind: HomepageDemoPublicExtractCookieKind;
  name: string;
  value: string;
  options: HomepageDemoCookiePolicy;
}>;

export type HomepageDemoPublicExtractBootstrap = Readonly<{
  publicToken: string;
  idempotencyToken: string;
  cookiesToSet: readonly HomepageDemoPublicExtractCookieInstruction[];
}>;

export type HomepageDemoPublicExtractIdentityInput = Readonly<{
  headers: Headers;
  sessionCookie: unknown;
  deviceCookie: unknown;
  publicToken: unknown;
  idempotencyToken: unknown;
}>;

export type HomepageDemoPublicExtractIdentityResult = Readonly<{
  identity: HomepageDemoTextTrialIdentity;
  remoteIp: null;
}>;

type BootstrapCookieTokenInput = Readonly<{
  kind: HomepageDemoPublicExtractCookieKind;
  existingValue: unknown;
  createToken: () => HomepageDemoTokenPair;
  getCookiePolicy: () => HomepageDemoCookiePolicy;
}>;

type BootstrapCookieToken = Readonly<{
  cookieToSet: HomepageDemoPublicExtractCookieInstruction | null;
}>;

export function createHomepageDemoPublicExtractBootstrap(
  input: HomepageDemoPublicExtractBootstrapInput = {}
): HomepageDemoPublicExtractBootstrap {
  try {
    const session = resolveBootstrapCookieToken({
      kind: "session",
      existingValue: input.existingSessionCookie,
      createToken: createHomepageDemoSessionToken,
      getCookiePolicy: getHomepageDemoSessionCookiePolicy,
    });
    const device = resolveBootstrapCookieToken({
      kind: "device",
      existingValue: input.existingDeviceCookie,
      createToken: createHomepageDemoDeviceToken,
      getCookiePolicy: getHomepageDemoDeviceCookiePolicy,
    });
    const publicToken = createHomepageDemoPublicToken().token;
    const idempotencyToken = createHomepageDemoIdempotencyToken().token;
    const cookiesToSet = [session.cookieToSet, device.cookieToSet].filter(
      isCookieInstruction
    );

    return {
      publicToken,
      idempotencyToken,
      cookiesToSet,
    };
  } catch (error) {
    throw toSanitizedIdentityError(error);
  }
}

export function resolveHomepageDemoPublicExtractIdentity({
  headers,
  sessionCookie,
  deviceCookie,
  publicToken,
  idempotencyToken,
}: HomepageDemoPublicExtractIdentityInput): HomepageDemoPublicExtractIdentityResult {
  try {
    const validatedPublicToken = validateIdentityToken(publicToken);
    const validatedSessionCookie = validateIdentityToken(sessionCookie);
    const validatedDeviceCookie = validateIdentityToken(deviceCookie);
    const validatedIdempotencyToken = validateIdentityToken(idempotencyToken);
    const ipIdentityDigest = createHomepageDemoIpIdentityDigest(headers);

    return {
      identity: {
        publicTokenHash: hashTokenForPurpose(
          validatedPublicToken,
          "homepage-demo-public"
        ),
        sessionTokenHash: hashTokenForPurpose(
          validatedSessionCookie,
          "homepage-demo-session"
        ),
        deviceTokenHash: hashTokenForPurpose(
          validatedDeviceCookie,
          "homepage-demo-device"
        ),
        ipIdentityDigest: ipIdentityDigest.digest,
        idempotencyKeyHash: hashTokenForPurpose(
          validatedIdempotencyToken,
          "homepage-demo-idempotency"
        ),
      },
      // Turnstile remoteip is optional. Raw IP forwarding is deferred until a
      // separate exact raw-address contract exists beside the IP digest helper.
      remoteIp: null,
    };
  } catch (error) {
    throw toSanitizedIdentityError(error);
  }
}

function resolveBootstrapCookieToken({
  kind,
  existingValue,
  createToken,
  getCookiePolicy,
}: BootstrapCookieTokenInput): BootstrapCookieToken {
  if (isValidHomepageDemoToken(existingValue)) {
    return {
      cookieToSet: null,
    };
  }

  const token = createToken().token;
  const policy = getCookiePolicy();

  return {
    cookieToSet: {
      kind,
      name: policy.name,
      value: token,
      options: policy,
    },
  };
}

function validateIdentityToken(value: unknown): string {
  if (!isValidHomepageDemoToken(value)) {
    throw new HomepageDemoIdentityError("identity_input_invalid");
  }

  return value;
}

function hashTokenForPurpose(
  token: string,
  purpose: HomepageDemoTokenPurpose
): string {
  return hashHomepageDemoToken({ token, purpose });
}

function isCookieInstruction(
  value: HomepageDemoPublicExtractCookieInstruction | null
): value is HomepageDemoPublicExtractCookieInstruction {
  return value !== null;
}

function toSanitizedIdentityError(error: unknown): HomepageDemoIdentityError {
  if (isHomepageDemoIdentityError(error)) {
    return error;
  }

  return new HomepageDemoIdentityError("identity_unavailable");
}
