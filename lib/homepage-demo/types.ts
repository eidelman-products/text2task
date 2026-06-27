export const HOMEPAGE_DEMO_TRIAL_INPUT_TYPES = ["text", "image"] as const;

export type HomepageDemoTrialInputType =
  (typeof HOMEPAGE_DEMO_TRIAL_INPUT_TYPES)[number];

export const HOMEPAGE_DEMO_TRIAL_STATUSES = [
  "created",
  "validating",
  "queued",
  "processing",
  "review_ready",
  "failed",
  "blocked",
  "claimed",
  "expired",
] as const;

export type HomepageDemoTrialStatus =
  (typeof HOMEPAGE_DEMO_TRIAL_STATUSES)[number];

export const HOMEPAGE_DEMO_RISK_STATES = [
  "not_evaluated",
  "allowed",
  "challenge_required",
  "blocked",
] as const;

export type HomepageDemoRiskState =
  (typeof HOMEPAGE_DEMO_RISK_STATES)[number];

export const HOMEPAGE_DEMO_DRAFT_STATUSES = [
  "pending",
  "ready",
  "claimed",
  "expired",
] as const;

export type HomepageDemoDraftStatus =
  (typeof HOMEPAGE_DEMO_DRAFT_STATUSES)[number];

export const HOMEPAGE_DEMO_TOKEN_PURPOSES = [
  "homepage-demo-public",
  "homepage-demo-session",
  "homepage-demo-idempotency",
] as const;

export type HomepageDemoTokenPurpose =
  (typeof HOMEPAGE_DEMO_TOKEN_PURPOSES)[number];
