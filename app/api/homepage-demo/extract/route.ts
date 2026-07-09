import { after, NextRequest, NextResponse } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
import {
  isHomepageDemoChallengeError,
  isHomepageDemoExtractionError,
  isHomepageDemoIdentityError,
  isHomepageDemoOrchestrationError,
  isHomepageDemoPublicRequestError,
  isHomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";
import {
  getHomepageDemoDeviceCookiePolicy,
  getHomepageDemoSessionCookiePolicy,
} from "@/lib/homepage-demo/identity.server";
import {
  orchestrateHomepageDemoTextTrial,
  type HomepageDemoTextTrialOrchestrationResult,
} from "@/lib/homepage-demo/orchestration.server";
import { resolveHomepageDemoPublicExtractIdentity } from "@/lib/homepage-demo/public-extract-identity.server";
import {
  assertHomepageDemoPublicExtractEnabled,
  parseHomepageDemoPublicExtractRequest,
  readHomepageDemoPublicExtractRequestJson,
  validateHomepageDemoPublicRequestOrigin,
} from "@/lib/homepage-demo/public-extract-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECURITY_HEADERS = [
  ["Cache-Control", "no-store, no-cache, max-age=0, must-revalidate"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
] as const;

const HOMEPAGE_DEMO_EXTRACT_ANALYTICS_ROUTE =
  "/api/homepage-demo/extract";
const HOMEPAGE_DEMO_EXTRACT_ATTEMPT_EVENT =
  "homepage_demo_extract_attempt";
const HOMEPAGE_DEMO_EXTRACT_SUCCEEDED_EVENT =
  "homepage_demo_extract_succeeded";
const HOMEPAGE_DEMO_EXTRACT_FAILED_EVENT =
  "homepage_demo_extract_failed";

type HomepageDemoExtractAnalyticsEventName =
  | typeof HOMEPAGE_DEMO_EXTRACT_ATTEMPT_EVENT
  | typeof HOMEPAGE_DEMO_EXTRACT_SUCCEEDED_EVENT
  | typeof HOMEPAGE_DEMO_EXTRACT_FAILED_EVENT;
type HomepageDemoExtractAnalyticsEnvironment =
  | "production"
  | "preview"
  | "development"
  | "unknown";
type HomepageDemoExtractAnalyticsStatusCategory =
  | "attempt"
  | "succeeded"
  | "failed";
type HomepageDemoExtractAnalyticsStage =
  | "request"
  | "origin"
  | "body"
  | "identity"
  | "challenge"
  | "admission"
  | "extraction"
  | "repository"
  | "orchestration"
  | "unexpected";
type HomepageDemoExtractAnalyticsSource = "admission" | "completion";
type HomepageDemoExtractAnalyticsMetadata = Readonly<{
  statusCategory: HomepageDemoExtractAnalyticsStatusCategory;
  stage?: HomepageDemoExtractAnalyticsStage;
  errorCode?: string;
  httpStatus?: number;
  source?: HomepageDemoExtractAnalyticsSource;
}>;
type HomepageDemoExtractFailureAnalytics = Readonly<{
  stage: HomepageDemoExtractAnalyticsStage;
  errorCode: string;
  httpStatus: number;
}>;
type MappedExtractFailureResponse = Readonly<{
  response: NextResponse<ExtractJsonResponse>;
  failure: HomepageDemoExtractFailureAnalytics;
}>;

type NotAdmittedDecision = Extract<
  HomepageDemoTextTrialOrchestrationResult,
  { outcome: "not_admitted" }
>["admission"]["decision"];

type ExtractResponseCode =
  | "review_ready"
  | "challenge_failed"
  | "rate_limited"
  | "not_found"
  | "trial_already_used"
  | "temporarily_unavailable"
  | "processing_failed"
  | "trial_unavailable"
  | "expired"
  | "invalid_request_origin"
  | "invalid_request_content_type"
  | "unsupported_request_encoding"
  | "request_body_too_large"
  | "invalid_request_body"
  | "invalid_request"
  | "invalid_challenge_input"
  | "timeout"
  | "invalid_text_input"
  | "request_too_large"
  | "extraction_failed"
  | "request_conflict"
  | "processing_conflict"
  | "processing_cleanup_unavailable";

type ExtractJsonResponse = Readonly<{
  code: ExtractResponseCode;
}>;

export async function POST(request: NextRequest) {
  try {
    assertHomepageDemoPublicExtractEnabled();
    validateHomepageDemoPublicRequestOrigin({
      requestUrl: request.url,
      headers: request.headers,
    });

    const requestJson = await readHomepageDemoPublicExtractRequestJson(request);
    const parsed = parseHomepageDemoPublicExtractRequest(requestJson);

    const sessionPolicy = getHomepageDemoSessionCookiePolicy();
    const devicePolicy = getHomepageDemoDeviceCookiePolicy();
    const sessionCookie =
      request.cookies.get(sessionPolicy.name)?.value ?? null;
    const deviceCookie =
      request.cookies.get(devicePolicy.name)?.value ?? null;
    const identityResult = resolveHomepageDemoPublicExtractIdentity({
      headers: request.headers,
      sessionCookie,
      deviceCookie,
      publicToken: parsed.publicToken,
      idempotencyToken: parsed.idempotencyToken,
    });
    const result = await orchestrateHomepageDemoTextTrial({
      text: parsed.text,
      challengeToken: parsed.challengeToken,
      remoteIp: identityResult.remoteIp,
      identity: identityResult.identity,
    });
    const response = mapOrchestrationResult(result);

    scheduleHomepageDemoExtractAttempt(response.status);
    scheduleHomepageDemoExtractOrchestrationOutcome(result, response.status);

    return response;
  } catch (error) {
    const mapped = mapExtractError(error);

    scheduleHomepageDemoExtractAttempt(mapped.response.status);
    scheduleHomepageDemoExtractFailure(mapped.failure);

    return mapped.response;
  }
}

function scheduleHomepageDemoExtractAttempt(httpStatus: number): void {
  scheduleHomepageDemoExtractAnalytics({
    eventName: HOMEPAGE_DEMO_EXTRACT_ATTEMPT_EVENT,
    metadata: {
      statusCategory: "attempt",
      httpStatus,
    },
  });
}

function scheduleHomepageDemoExtractOrchestrationOutcome(
  result: HomepageDemoTextTrialOrchestrationResult,
  httpStatus: number
): void {
  switch (result.outcome) {
    case "review_ready":
      scheduleHomepageDemoExtractAnalytics({
        eventName: HOMEPAGE_DEMO_EXTRACT_SUCCEEDED_EVENT,
        metadata: {
          statusCategory: "succeeded",
          httpStatus,
          source: result.source,
        },
      });
      return;

    case "challenge_failed":
      scheduleHomepageDemoExtractFailure({
        stage: "challenge",
        errorCode: result.blocked
          ? "challenge_rate_limited"
          : "challenge_failed",
        httpStatus,
      });
      return;

    case "not_admitted":
      scheduleHomepageDemoExtractFailure({
        stage: "admission",
        errorCode: result.admission.decision,
        httpStatus,
      });
      return;
  }

  scheduleHomepageDemoExtractFailure({
    stage: "unexpected",
    errorCode: "unexpected",
    httpStatus,
  });
}

function scheduleHomepageDemoExtractFailure(
  failure: HomepageDemoExtractFailureAnalytics
): void {
  scheduleHomepageDemoExtractAnalytics({
    eventName: HOMEPAGE_DEMO_EXTRACT_FAILED_EVENT,
    metadata: {
      statusCategory: "failed",
      stage: failure.stage,
      errorCode: failure.errorCode,
      httpStatus: failure.httpStatus,
    },
  });
}

function scheduleHomepageDemoExtractAnalytics({
  eventName,
  metadata,
}: Readonly<{
  eventName: HomepageDemoExtractAnalyticsEventName;
  metadata: HomepageDemoExtractAnalyticsMetadata;
}>): void {
  try {
    const environment = getHomepageDemoExtractAnalyticsEnvironment();

    after(async () => {
      try {
        await logAnalyticsEventSafe({
          eventName,
          userId: null,
          anonymousId: null,
          pagePath: HOMEPAGE_DEMO_EXTRACT_ANALYTICS_ROUTE,
          metadata: {
            mode: "text",
            anonymous: true,
            environment,
            ...metadata,
          },
        });
      } catch {
        // Operational analytics is best-effort and must never affect extraction.
      }
    });
  } catch {
    // Scheduling analytics is best-effort and must never affect extraction.
  }
}

function getHomepageDemoExtractAnalyticsEnvironment(): HomepageDemoExtractAnalyticsEnvironment {
  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();

  switch (vercelEnvironment) {
    case "production":
    case "preview":
    case "development":
      return vercelEnvironment;
  }

  const nodeEnvironment = process.env.NODE_ENV?.trim().toLowerCase();

  switch (nodeEnvironment) {
    case "production":
      return "production";
    case "development":
      return "development";
  }

  return "unknown";
}

function mapOrchestrationResult(
  result: HomepageDemoTextTrialOrchestrationResult
): NextResponse<ExtractJsonResponse> {
  switch (result.outcome) {
    case "challenge_failed":
      return result.blocked
        ? createJsonResponse({ code: "rate_limited" }, 429)
        : createJsonResponse({ code: "challenge_failed" }, 403);

    case "not_admitted":
      return mapAdmissionDecision(result.admission.decision);

    case "review_ready":
      return createJsonResponse({ code: "review_ready" }, 200);
  }

  return mapUnexpectedRouteState(result);
}

function mapAdmissionDecision(
  decision: NotAdmittedDecision
): NextResponse<ExtractJsonResponse> {
  switch (decision) {
    case "demo_disabled":
    case "workload_disabled":
      return createJsonResponse({ code: "not_found" }, 404);

    case "rate_limited":
      return createJsonResponse({ code: "rate_limited" }, 429);

    case "trial_already_used":
      return createJsonResponse({ code: "trial_already_used" }, 409);

    case "capacity_unavailable":
    case "budget_unavailable":
      return createJsonResponse({ code: "temporarily_unavailable" }, 503);

    case "processing_failed":
      return createJsonResponse({ code: "processing_failed" }, 409);

    case "trial_unavailable":
      return createJsonResponse({ code: "trial_unavailable" }, 409);

    case "expired":
      return createJsonResponse({ code: "expired" }, 410);
  }

  return mapUnexpectedRouteState(decision);
}

function mapExtractError(error: unknown): MappedExtractFailureResponse {
  if (isHomepageDemoPublicRequestError(error)) {
    const code = error.code;

    switch (code) {
      case "homepage_demo_disabled":
        return createFailureResponse("not_found", 404, "request", code);
      case "invalid_request_origin":
        return createFailureResponse(
          "invalid_request_origin",
          403,
          "origin",
          code
        );
      case "invalid_request_content_type":
        return createFailureResponse(
          "invalid_request_content_type",
          415,
          "request",
          code
        );
      case "unsupported_request_encoding":
        return createFailureResponse(
          "unsupported_request_encoding",
          415,
          "request",
          code
        );
      case "request_body_too_large":
        return createFailureResponse(
          "request_body_too_large",
          413,
          "body",
          code
        );
      case "invalid_request_body":
        return createFailureResponse(
          "invalid_request_body",
          400,
          "body",
          code
        );
    }

    return mapUnexpectedErrorState(code);
  }

  if (isHomepageDemoIdentityError(error)) {
    const code = error.code;

    switch (code) {
      case "identity_input_invalid":
        return createFailureResponse(
          "invalid_request",
          400,
          "identity",
          code
        );
      case "identity_configuration_invalid":
      case "identity_unavailable":
        return createFailureResponse(
          "temporarily_unavailable",
          503,
          "identity",
          code
        );
    }

    return mapUnexpectedErrorState(code);
  }

  if (isHomepageDemoChallengeError(error)) {
    const code = error.code;

    switch (code) {
      case "invalid_challenge_input":
        return createFailureResponse(
          "invalid_challenge_input",
          400,
          "challenge",
          code
        );
      case "challenge_configuration_error":
      case "challenge_verification_unavailable":
        return createFailureResponse(
          "temporarily_unavailable",
          503,
          "challenge",
          code
        );
      case "challenge_verification_timeout":
        return createFailureResponse("timeout", 504, "challenge", code);
    }

    return mapUnexpectedErrorState(code);
  }

  if (isHomepageDemoExtractionError(error)) {
    const code = error.code;

    switch (code) {
      case "invalid_text_input":
        return createFailureResponse(
          "invalid_text_input",
          400,
          "request",
          code
        );
      case "text_input_too_large":
        return createFailureResponse(
          "request_too_large",
          413,
          "request",
          code
        );
      case "text_extraction_timeout":
        return createFailureResponse("timeout", 504, "extraction", code);
      case "text_extraction_invalid_result":
        return createFailureResponse(
          "extraction_failed",
          502,
          "extraction",
          code
        );
      case "text_extraction_unavailable":
        return createFailureResponse(
          "temporarily_unavailable",
          503,
          "extraction",
          code
        );
    }

    return mapUnexpectedErrorState(code);
  }

  if (isHomepageDemoRepositoryError(error)) {
    const code = error.code;

    switch (code) {
      case "invalid_repository_input":
        return createFailureResponse(
          "invalid_request",
          400,
          "repository",
          code
        );

      case "idempotency_conflict":
        return createFailureResponse(
          "request_conflict",
          409,
          "repository",
          code
        );

      case "trial_not_found":
      case "processing_attempt_not_found":
      case "review_access_denied":
        return createFailureResponse("not_found", 404, "repository", code);

      case "trial_expired":
      case "processing_lease_expired":
      case "review_expired":
        return createFailureResponse("expired", 410, "repository", code);

      case "invalid_transition":
      case "risk_not_allowed":
      case "completion_conflict":
      case "draft_conflict":
      case "failure_conflict":
      case "block_conflict":
      case "admission_state_conflict":
      case "processing_lease_invalid":
      case "processing_state_conflict":
      case "processing_completion_conflict":
      case "review_not_ready":
      case "review_edit_conflict":
        return createFailureResponse(
          "processing_conflict",
          409,
          "repository",
          code
        );

      case "token_collision":
      case "admission_config_missing":
      case "repository_response_invalid":
      case "repository_unavailable":
        return createFailureResponse(
          "temporarily_unavailable",
          503,
          "repository",
          code
        );
    }

    return mapUnexpectedErrorState(code);
  }

  if (isHomepageDemoOrchestrationError(error)) {
    const code = error.code;

    switch (code) {
      case "processing_cleanup_unavailable":
        return createFailureResponse(
          "processing_cleanup_unavailable",
          503,
          "orchestration",
          code
        );
      case "orchestration_unavailable":
        return createFailureResponse(
          "temporarily_unavailable",
          503,
          "orchestration",
          code
        );
    }

    return mapUnexpectedErrorState(code);
  }

  return createFailureResponse(
    "temporarily_unavailable",
    503,
    "unexpected",
    "unexpected"
  );
}

function createJsonResponse(
  body: ExtractJsonResponse,
  status: number
): NextResponse<ExtractJsonResponse> {
  const response = NextResponse.json(body, { status });

  applyExtractResponseHeaders(response);

  return response;
}

function mapUnexpectedRouteState(
  _value: never
): NextResponse<ExtractJsonResponse> {
  return createJsonResponse({ code: "temporarily_unavailable" }, 503);
}

function mapUnexpectedErrorState(_value: never): MappedExtractFailureResponse {
  return createFailureResponse(
    "temporarily_unavailable",
    503,
    "unexpected",
    "unexpected"
  );
}

function createFailureResponse(
  code: ExtractResponseCode,
  status: number,
  stage: HomepageDemoExtractAnalyticsStage,
  errorCode: string
): MappedExtractFailureResponse {
  return {
    response: createJsonResponse({ code }, status),
    failure: {
      stage,
      errorCode,
      httpStatus: status,
    },
  };
}

function applyExtractResponseHeaders(response: NextResponse): void {
  for (const [name, value] of SECURITY_HEADERS) {
    response.headers.set(name, value);
  }

  response.headers.set("Content-Type", "application/json; charset=utf-8");
  mergeVaryHeader(response, ["Origin", "Cookie"]);
}

function mergeVaryHeader(response: NextResponse, requiredValues: string[]): void {
  const existingValues =
    response.headers
      .get("Vary")
      ?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];
  const lowerExistingValues = new Set(
    existingValues.map((value) => value.toLowerCase())
  );
  const mergedValues = [...existingValues];

  for (const value of requiredValues) {
    if (!lowerExistingValues.has(value.toLowerCase())) {
      mergedValues.push(value);
    }
  }

  response.headers.set("Vary", mergedValues.join(", "));
}
