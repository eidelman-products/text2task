export const HOMEPAGE_DEMO_CLAIM_AUTH_INTENT = "homepage-demo-claim" as const;

export const HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH =
  "/homepage-demo/claim/continue" as const;

export const HOMEPAGE_DEMO_CLAIM_LOGIN_PATH =
  "/login?intent=homepage-demo-claim" as const;

export type HomepageDemoClaimAuthIntent =
  typeof HOMEPAGE_DEMO_CLAIM_AUTH_INTENT;

export function parseHomepageDemoClaimAuthIntent(
  value: unknown
): HomepageDemoClaimAuthIntent | null {
  if (Array.isArray(value)) {
    return value.length === 1
      ? parseHomepageDemoClaimAuthIntent(value[0])
      : null;
  }

  return value === HOMEPAGE_DEMO_CLAIM_AUTH_INTENT
    ? HOMEPAGE_DEMO_CLAIM_AUTH_INTENT
    : null;
}

export function getHomepageDemoClaimAuthDestination(
  intent: unknown
): typeof HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH | null {
  return parseHomepageDemoClaimAuthIntent(intent) === null
    ? null
    : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;
}
