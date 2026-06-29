export const HOMEPAGE_DEMO_CHALLENGE_ACTION =
  "homepage_demo_extract" as const;

export const HOMEPAGE_DEMO_CHALLENGE_TOKEN_MAX_LENGTH = 2048;

export type HomepageDemoChallengeVerificationResult =
  | Readonly<{ verified: true }>
  | Readonly<{
      verified: false;
      reason: "challenge_failed";
    }>;
