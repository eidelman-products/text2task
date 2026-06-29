export type HomepageDemoRepositoryErrorCode =
  | "invalid_repository_input"
  | "trial_not_found"
  | "trial_expired"
  | "invalid_transition"
  | "risk_not_allowed"
  | "idempotency_conflict"
  | "token_collision"
  | "completion_conflict"
  | "draft_conflict"
  | "failure_conflict"
  | "block_conflict"
  | "admission_config_missing"
  | "admission_state_conflict"
  | "processing_attempt_not_found"
  | "processing_lease_invalid"
  | "processing_lease_expired"
  | "processing_state_conflict"
  | "processing_completion_conflict"
  | "review_access_denied"
  | "review_expired"
  | "review_not_ready"
  | "review_edit_conflict"
  | "repository_response_invalid"
  | "repository_unavailable";

export type HomepageDemoIdentityErrorCode =
  | "identity_unavailable"
  | "identity_input_invalid"
  | "identity_configuration_invalid";

export type HomepageDemoExtractionErrorCode =
  | "invalid_text_input"
  | "text_input_too_large"
  | "text_extraction_timeout"
  | "text_extraction_invalid_result"
  | "text_extraction_unavailable";

export type HomepageDemoChallengeErrorCode =
  | "invalid_challenge_input"
  | "challenge_configuration_error"
  | "challenge_verification_timeout"
  | "challenge_verification_unavailable";

const HOMEPAGE_DEMO_REPOSITORY_ERROR_MESSAGES: Record<
  HomepageDemoRepositoryErrorCode,
  string
> = {
  invalid_repository_input: "Invalid homepage demo repository input.",
  trial_not_found: "Homepage demo trial was not found.",
  trial_expired: "Homepage demo trial has expired.",
  invalid_transition: "Homepage demo trial transition is invalid.",
  risk_not_allowed: "Homepage demo trial is not allowed to continue.",
  idempotency_conflict: "Homepage demo idempotency conflict.",
  token_collision: "Homepage demo token collision.",
  completion_conflict: "Homepage demo completion conflict.",
  draft_conflict: "Homepage demo draft conflict.",
  failure_conflict: "Homepage demo failure conflict.",
  block_conflict: "Homepage demo block conflict.",
  admission_config_missing: "Homepage demo admission config is missing.",
  admission_state_conflict: "Homepage demo admission state conflict.",
  processing_attempt_not_found:
    "Homepage demo processing attempt was not found.",
  processing_lease_invalid: "Homepage demo processing lease is invalid.",
  processing_lease_expired: "Homepage demo processing lease has expired.",
  processing_state_conflict: "Homepage demo processing state conflict.",
  processing_completion_conflict:
    "Homepage demo processing completion conflict.",
  review_access_denied: "Homepage demo review access was denied.",
  review_expired: "Homepage demo review has expired.",
  review_not_ready: "Homepage demo review is not ready.",
  review_edit_conflict: "Homepage demo review edit conflict.",
  repository_response_invalid: "Homepage demo repository response was invalid.",
  repository_unavailable: "Homepage demo repository is unavailable.",
};

const HOMEPAGE_DEMO_IDENTITY_ERROR_MESSAGES: Record<
  HomepageDemoIdentityErrorCode,
  string
> = {
  identity_unavailable: "Homepage demo identity is unavailable.",
  identity_input_invalid: "Homepage demo identity input is invalid.",
  identity_configuration_invalid:
    "Homepage demo identity configuration is invalid.",
};

const HOMEPAGE_DEMO_EXTRACTION_ERROR_MESSAGES: Record<
  HomepageDemoExtractionErrorCode,
  string
> = {
  invalid_text_input: "Homepage demo text input is invalid.",
  text_input_too_large: "Homepage demo text input is too large.",
  text_extraction_timeout: "Homepage demo text extraction timed out.",
  text_extraction_invalid_result:
    "Homepage demo text extraction result was invalid.",
  text_extraction_unavailable:
    "Homepage demo text extraction is unavailable.",
};

const HOMEPAGE_DEMO_CHALLENGE_ERROR_MESSAGES: Record<
  HomepageDemoChallengeErrorCode,
  string
> = {
  invalid_challenge_input: "Homepage demo challenge input is invalid.",
  challenge_configuration_error:
    "Homepage demo challenge verification is not configured.",
  challenge_verification_timeout:
    "Homepage demo challenge verification timed out.",
  challenge_verification_unavailable:
    "Homepage demo challenge verification is unavailable.",
};

export class HomepageDemoRepositoryError extends Error {
  readonly code: HomepageDemoRepositoryErrorCode;

  constructor(code: HomepageDemoRepositoryErrorCode) {
    super(HOMEPAGE_DEMO_REPOSITORY_ERROR_MESSAGES[code]);
    this.name = "HomepageDemoRepositoryError";
    this.code = code;
  }
}

export function isHomepageDemoRepositoryError(
  error: unknown
): error is HomepageDemoRepositoryError {
  return error instanceof HomepageDemoRepositoryError;
}

export class HomepageDemoIdentityError extends Error {
  readonly code: HomepageDemoIdentityErrorCode;

  constructor(code: HomepageDemoIdentityErrorCode) {
    super(HOMEPAGE_DEMO_IDENTITY_ERROR_MESSAGES[code]);
    this.name = "HomepageDemoIdentityError";
    this.code = code;
  }
}

export function isHomepageDemoIdentityError(
  error: unknown
): error is HomepageDemoIdentityError {
  return error instanceof HomepageDemoIdentityError;
}

export class HomepageDemoExtractionError extends Error {
  readonly code: HomepageDemoExtractionErrorCode;

  constructor(code: HomepageDemoExtractionErrorCode) {
    super(HOMEPAGE_DEMO_EXTRACTION_ERROR_MESSAGES[code]);
    this.name = "HomepageDemoExtractionError";
    this.code = code;
  }
}

export function isHomepageDemoExtractionError(
  error: unknown
): error is HomepageDemoExtractionError {
  return error instanceof HomepageDemoExtractionError;
}

export class HomepageDemoChallengeError extends Error {
  readonly code: HomepageDemoChallengeErrorCode;

  constructor(code: HomepageDemoChallengeErrorCode) {
    super(HOMEPAGE_DEMO_CHALLENGE_ERROR_MESSAGES[code]);
    this.name = "HomepageDemoChallengeError";
    this.code = code;
  }
}

export function isHomepageDemoChallengeError(
  error: unknown
): error is HomepageDemoChallengeError {
  return error instanceof HomepageDemoChallengeError;
}
