import "server-only";

import {
  HomepageDemoIdentityError,
  isHomepageDemoIdentityError,
} from "@/lib/homepage-demo/errors";
import {
  hashHomepageDemoToken,
  isValidHomepageDemoToken,
} from "@/lib/homepage-demo/tokens.server";
import type { HomepageDemoTokenPurpose } from "@/lib/homepage-demo/types";

export type HomepageDemoPublicReviewIdentityInput = Readonly<{
  publicToken: string;
  sessionCookie: string | null;
}>;

export type HomepageDemoPublicReviewIdentity = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
}>;

export function resolveHomepageDemoPublicReviewIdentity(
  input: HomepageDemoPublicReviewIdentityInput
): HomepageDemoPublicReviewIdentity {
  try {
    const publicToken = validateIdentityToken(input.publicToken);
    const sessionToken = validateIdentityToken(input.sessionCookie);

    return {
      publicTokenHash: hashTokenForPurpose(
        publicToken,
        "homepage-demo-public"
      ),
      sessionTokenHash: hashTokenForPurpose(
        sessionToken,
        "homepage-demo-session"
      ),
    };
  } catch (error) {
    throw toSanitizedIdentityError(error);
  }
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

function toSanitizedIdentityError(error: unknown): HomepageDemoIdentityError {
  if (isHomepageDemoIdentityError(error)) {
    return error;
  }

  return new HomepageDemoIdentityError("identity_unavailable");
}
