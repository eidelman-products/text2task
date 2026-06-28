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
  | "review_access_denied"
  | "review_expired"
  | "review_not_ready"
  | "review_edit_conflict"
  | "repository_response_invalid"
  | "repository_unavailable";

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
  review_access_denied: "Homepage demo review access was denied.",
  review_expired: "Homepage demo review has expired.",
  review_not_ready: "Homepage demo review is not ready.",
  review_edit_conflict: "Homepage demo review edit conflict.",
  repository_response_invalid: "Homepage demo repository response was invalid.",
  repository_unavailable: "Homepage demo repository is unavailable.",
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
