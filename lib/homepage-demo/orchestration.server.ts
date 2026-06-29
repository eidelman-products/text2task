import "server-only";

import {
  admitHomepageDemoTrial,
  recordHomepageDemoChallengeFailure,
} from "@/lib/homepage-demo/admission-repository.server";
import { verifyHomepageDemoChallenge } from "@/lib/homepage-demo/challenge-verification.server";
import {
  HomepageDemoOrchestrationError,
  HomepageDemoRepositoryError,
  isHomepageDemoChallengeError,
  isHomepageDemoExtractionError,
  isHomepageDemoIdentityError,
  isHomepageDemoOrchestrationError,
  isHomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";
import { extractHomepageDemoText } from "@/lib/homepage-demo/extraction-adapter.server";
import { validateHomepageDemoTextInput } from "@/lib/homepage-demo/extraction-validation.server";
import {
  completeHomepageDemoProcessing,
  failHomepageDemoProcessing,
  startHomepageDemoProcessing,
} from "@/lib/homepage-demo/processing-repository.server";
import { createHomepageDemoCapacityLeaseToken } from "@/lib/homepage-demo/tokens.server";
import type {
  HomepageDemoAdmissionDecision,
  HomepageDemoAdmissionResult,
  HomepageDemoProcessingCompletionResult,
} from "@/lib/homepage-demo/types";

const HOMEPAGE_DEMO_TEXT_WORKLOAD = "text" as const;

type HomepageDemoTextTrialNotAdmittedDecision = Exclude<
  HomepageDemoAdmissionDecision,
  "admitted" | "review_ready"
>;

type HomepageDemoTextTrialFailureCode =
  | "orchestration_start_failed"
  | "text_extraction_timeout"
  | "text_extraction_invalid_result"
  | "text_extraction_unavailable"
  | "orchestration_completion_failed"
  | "orchestration_unexpected_failure";

export type HomepageDemoTextTrialIdentity = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
  deviceTokenHash: string;
  ipIdentityDigest: string;
  idempotencyKeyHash: string;
}>;

export type OrchestrateHomepageDemoTextTrialInput = Readonly<{
  text: unknown;
  challengeToken: unknown;
  remoteIp?: string | null;
  identity: HomepageDemoTextTrialIdentity;
}>;

export type HomepageDemoTextTrialNotAdmittedAdmissionResult =
  HomepageDemoAdmissionResult &
    Readonly<{
      decision: HomepageDemoTextTrialNotAdmittedDecision;
    }>;

export type HomepageDemoTextTrialOrchestrationResult =
  | Readonly<{
      outcome: "challenge_failed";
      blocked: boolean;
    }>
  | Readonly<{
      outcome: "not_admitted";
      admission: HomepageDemoTextTrialNotAdmittedAdmissionResult;
    }>
  | Readonly<{
      outcome: "review_ready";
      source: "admission";
      attemptId: string;
      trialId: string;
      trialStatus: "review_ready";
      trialExpiresAt: Date;
      idempotent: true;
    }>
  | Readonly<{
      outcome: "review_ready";
      source: "completion";
      attemptId: string;
      trialId: string;
      draftId: string;
      attemptStatus: "review_ready";
      trialStatus: "review_ready";
      draftStatus: "ready";
      providerCallStartedAt: Date;
      providerCallCompletedAt: Date;
      reviewReadyAt: Date;
      idempotent: boolean;
    }>;

type AdmittedProcessingInput = Readonly<{
  attemptId: string;
  capacityLeaseToken: string;
  validatedText: string;
}>;

type FailureCleanupInput = Readonly<{
  attemptId: string;
  capacityLeaseToken: string;
  failureCode: HomepageDemoTextTrialFailureCode;
}>;

export async function orchestrateHomepageDemoTextTrial(
  input: OrchestrateHomepageDemoTextTrialInput
): Promise<HomepageDemoTextTrialOrchestrationResult> {
  try {
    return await orchestrateHomepageDemoTextTrialInternal(input);
  } catch (error) {
    throw toSanitizedOrchestrationError(error);
  }
}

async function orchestrateHomepageDemoTextTrialInternal(
  input: OrchestrateHomepageDemoTextTrialInput
): Promise<HomepageDemoTextTrialOrchestrationResult> {
  const validatedText = validateHomepageDemoTextInput(input.text);
  const challengeResult = await verifyHomepageDemoChallenge({
    token: input.challengeToken,
    remoteIp: input.remoteIp ?? null,
  });

  if (!challengeResult.verified) {
    const challengeFailure = await recordHomepageDemoChallengeFailure({
      ipIdentityDigest: input.identity.ipIdentityDigest,
    });

    return {
      outcome: "challenge_failed",
      blocked: challengeFailure.blocked,
    };
  }

  const { token: capacityLeaseToken } = createHomepageDemoCapacityLeaseToken();
  const admission = await admitHomepageDemoTrial({
    publicTokenHash: input.identity.publicTokenHash,
    sessionTokenHash: input.identity.sessionTokenHash,
    deviceTokenHash: input.identity.deviceTokenHash,
    ipIdentityDigest: input.identity.ipIdentityDigest,
    idempotencyKeyHash: input.identity.idempotencyKeyHash,
    capacityLeaseToken,
    inputType: HOMEPAGE_DEMO_TEXT_WORKLOAD,
  });

  if (admission.decision === "review_ready") {
    return toAdmissionReviewReadyResult(admission);
  }

  if (admission.decision !== "admitted") {
    return {
      outcome: "not_admitted",
      admission: toNotAdmittedAdmissionResult(admission),
    };
  }

  if (admission.attemptId === null) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return await processAdmittedTextTrial({
    attemptId: admission.attemptId,
    capacityLeaseToken,
    validatedText,
  });
}

async function processAdmittedTextTrial({
  attemptId,
  capacityLeaseToken,
  validatedText,
}: AdmittedProcessingInput): Promise<HomepageDemoTextTrialOrchestrationResult> {
  try {
    await retryRepositoryUnavailableOnce(() =>
      startHomepageDemoProcessing({
        attemptId,
        capacityLeaseToken,
      })
    );
  } catch (error) {
    await failAdmittedAttemptOrThrowCleanupError({
      attemptId,
      capacityLeaseToken,
      failureCode: "orchestration_start_failed",
    });
    throw toSanitizedOrchestrationError(error);
  }

  let extractionArtifact: Awaited<ReturnType<typeof extractHomepageDemoText>>;

  try {
    extractionArtifact = await extractHomepageDemoText(validatedText);
  } catch (error) {
    await failAdmittedAttemptOrThrowCleanupError({
      attemptId,
      capacityLeaseToken,
      failureCode: toExtractionFailureCode(error),
    });
    throw toSanitizedOrchestrationError(error);
  }

  try {
    const completion = await retryRepositoryUnavailableOnce(() =>
      completeHomepageDemoProcessing({
        attemptId,
        capacityLeaseToken,
        normalizedResult: extractionArtifact.normalizedResult,
        schemaVersion: extractionArtifact.schemaVersion,
        engineVersion: extractionArtifact.engineVersion,
      })
    );

    return toCompletionReviewReadyResult(completion);
  } catch (error) {
    await failAdmittedAttemptOrThrowCleanupError({
      attemptId,
      capacityLeaseToken,
      failureCode: "orchestration_completion_failed",
    });
    throw toSanitizedOrchestrationError(error);
  }
}

async function retryRepositoryUnavailableOnce<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRepositoryUnavailable(error)) {
      throw error;
    }
  }

  return await operation();
}

async function failAdmittedAttemptOrThrowCleanupError({
  attemptId,
  capacityLeaseToken,
  failureCode,
}: FailureCleanupInput): Promise<void> {
  try {
    await retryRepositoryUnavailableOnce(() =>
      failHomepageDemoProcessing({
        attemptId,
        capacityLeaseToken,
        failureCode,
      })
    );
  } catch {
    throw new HomepageDemoOrchestrationError("processing_cleanup_unavailable");
  }
}

function toAdmissionReviewReadyResult(
  admission: HomepageDemoAdmissionResult
): HomepageDemoTextTrialOrchestrationResult {
  if (
    admission.attemptId === null ||
    admission.trialId === null ||
    admission.trialStatus !== "review_ready" ||
    admission.trialExpiresAt === null ||
    admission.idempotent !== true
  ) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return {
    outcome: "review_ready",
    source: "admission",
    attemptId: admission.attemptId,
    trialId: admission.trialId,
    trialStatus: admission.trialStatus,
    trialExpiresAt: admission.trialExpiresAt,
    idempotent: true,
  };
}

function toCompletionReviewReadyResult(
  completion: HomepageDemoProcessingCompletionResult
): HomepageDemoTextTrialOrchestrationResult {
  return {
    outcome: "review_ready",
    source: "completion",
    attemptId: completion.attemptId,
    trialId: completion.trialId,
    draftId: completion.draftId,
    attemptStatus: completion.attemptStatus,
    trialStatus: completion.trialStatus,
    draftStatus: completion.draftStatus,
    providerCallStartedAt: completion.providerCallStartedAt,
    providerCallCompletedAt: completion.providerCallCompletedAt,
    reviewReadyAt: completion.reviewReadyAt,
    idempotent: completion.idempotent,
  };
}

function toNotAdmittedAdmissionResult(
  admission: HomepageDemoAdmissionResult
): HomepageDemoTextTrialNotAdmittedAdmissionResult {
  if (!isNotAdmittedAdmissionDecision(admission.decision)) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return admission as HomepageDemoTextTrialNotAdmittedAdmissionResult;
}

function isNotAdmittedAdmissionDecision(
  decision: HomepageDemoAdmissionDecision
): decision is HomepageDemoTextTrialNotAdmittedDecision {
  switch (decision) {
    case "demo_disabled":
    case "workload_disabled":
    case "rate_limited":
    case "trial_already_used":
    case "capacity_unavailable":
    case "budget_unavailable":
    case "processing_failed":
    case "trial_unavailable":
    case "expired":
      return true;

    case "admitted":
    case "review_ready":
      return false;
  }
}

function toExtractionFailureCode(
  error: unknown
): HomepageDemoTextTrialFailureCode {
  if (!isHomepageDemoExtractionError(error)) {
    return "orchestration_unexpected_failure";
  }

  switch (error.code) {
    case "text_extraction_timeout":
      return "text_extraction_timeout";

    case "text_extraction_invalid_result":
    case "invalid_text_input":
    case "text_input_too_large":
      return "text_extraction_invalid_result";

    case "text_extraction_unavailable":
      return "text_extraction_unavailable";
  }
}

function isRepositoryUnavailable(error: unknown): boolean {
  return (
    isHomepageDemoRepositoryError(error) &&
    error.code === "repository_unavailable"
  );
}

function toSanitizedOrchestrationError(error: unknown): Error {
  if (
    isHomepageDemoRepositoryError(error) ||
    isHomepageDemoIdentityError(error) ||
    isHomepageDemoExtractionError(error) ||
    isHomepageDemoChallengeError(error) ||
    isHomepageDemoOrchestrationError(error)
  ) {
    return error;
  }

  return new HomepageDemoOrchestrationError("orchestration_unavailable");
}
