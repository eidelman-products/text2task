import type { HomepageDemoJsonObject } from "@/lib/homepage-demo/json-validation";

export type {
  HomepageDemoJsonObject,
  HomepageDemoJsonValue,
} from "@/lib/homepage-demo/json-validation";

export const HOMEPAGE_DEMO_TRIAL_INPUT_TYPES = ["text", "image"] as const;

export type HomepageDemoTrialInputType =
  (typeof HOMEPAGE_DEMO_TRIAL_INPUT_TYPES)[number];

export const HOMEPAGE_DEMO_ADMISSION_ATTEMPT_STATUSES = [
  "admitted",
  "processing",
  "review_ready",
  "failed",
  "blocked",
  "rejected",
  "released",
  "expired",
] as const;

export type HomepageDemoAdmissionAttemptStatus =
  (typeof HOMEPAGE_DEMO_ADMISSION_ATTEMPT_STATUSES)[number];

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
  "homepage-demo-device",
  "homepage-demo-idempotency",
  "homepage-demo-capacity-lease",
] as const;

export type HomepageDemoTokenPurpose =
  (typeof HOMEPAGE_DEMO_TOKEN_PURPOSES)[number];

export const HOMEPAGE_DEMO_ADMISSION_DECISIONS = [
  "demo_disabled",
  "workload_disabled",
  "admitted",
  "review_ready",
  "rate_limited",
  "trial_already_used",
  "capacity_unavailable",
  "budget_unavailable",
  "processing_failed",
  "trial_unavailable",
  "expired",
] as const;

export type HomepageDemoAdmissionDecision =
  (typeof HOMEPAGE_DEMO_ADMISSION_DECISIONS)[number];

export const HOMEPAGE_DEMO_CHALLENGE_FAILURE_DECISIONS = [
  "demo_disabled",
  "challenge_not_required",
  "rate_limited",
  "challenge_failed",
] as const;

export type HomepageDemoChallengeFailureDecision =
  (typeof HOMEPAGE_DEMO_CHALLENGE_FAILURE_DECISIONS)[number];

export type HomepageDemoAdmissionResult = Readonly<{
  decision: HomepageDemoAdmissionDecision;
  attemptId: string | null;
  trialId: string | null;
  trialStatus: HomepageDemoTrialStatus | null;
  trialExpiresAt: Date | null;
  leaseExpiresAt: Date | null;
  idempotent: boolean;
}>;

export type HomepageDemoChallengeFailureResult = Readonly<{
  decision: HomepageDemoChallengeFailureDecision;
  blocked: boolean;
}>;

export type HomepageDemoProcessingStartResult = Readonly<{
  decision: "processing";
  attemptId: string;
  trialId: string;
  attemptStatus: Extract<HomepageDemoAdmissionAttemptStatus, "processing">;
  trialStatus: Extract<HomepageDemoTrialStatus, "processing">;
  providerCallStartedAt: Date;
  leaseExpiresAt: Date;
  idempotent: boolean;
}>;

export type HomepageDemoProcessingCompletionResult = Readonly<{
  decision: "review_ready";
  attemptId: string;
  trialId: string;
  draftId: string;
  attemptStatus: Extract<HomepageDemoAdmissionAttemptStatus, "review_ready">;
  trialStatus: Extract<HomepageDemoTrialStatus, "review_ready">;
  draftStatus: Extract<HomepageDemoDraftStatus, "ready">;
  providerCallStartedAt: Date;
  providerCallCompletedAt: Date;
  reviewReadyAt: Date;
  idempotent: boolean;
}>;

export type HomepageDemoProcessingFailureResult = Readonly<{
  decision: "failed";
  attemptId: string;
  trialId: string;
  attemptStatus: Extract<HomepageDemoAdmissionAttemptStatus, "failed">;
  trialStatus: Extract<HomepageDemoTrialStatus, "failed">;
  providerCallStartedAt: Date | null;
  providerCallCompletedAt: Date | null;
  leaseExpiresAt: Date;
  idempotent: boolean;
}>;

export type HomepageDemoTextExtractionArtifact = Readonly<{
  normalizedResult: HomepageDemoJsonObject;
  schemaVersion: string;
  engineVersion: string;
}>;
