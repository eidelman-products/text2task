import { NextRequest, NextResponse } from "next/server";

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

    return mapOrchestrationResult(result);
  } catch (error) {
    return mapExtractError(error);
  }
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
      logTemporaryUnavailableDiagnostic("admission", decision);
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

function mapExtractError(error: unknown): NextResponse<ExtractJsonResponse> {
  if (isHomepageDemoPublicRequestError(error)) {
    const code = error.code;

    switch (code) {
      case "homepage_demo_disabled":
        return createJsonResponse({ code: "not_found" }, 404);
      case "invalid_request_origin":
        return createJsonResponse({ code: "invalid_request_origin" }, 403);
      case "invalid_request_content_type":
        return createJsonResponse(
          { code: "invalid_request_content_type" },
          415
        );
      case "unsupported_request_encoding":
        return createJsonResponse(
          { code: "unsupported_request_encoding" },
          415
        );
      case "request_body_too_large":
        return createJsonResponse({ code: "request_body_too_large" }, 413);
      case "invalid_request_body":
        return createJsonResponse({ code: "invalid_request_body" }, 400);
    }

    return mapUnexpectedRouteState(code);
  }

  if (isHomepageDemoIdentityError(error)) {
    const code = error.code;

    switch (code) {
      case "identity_input_invalid":
        return createJsonResponse({ code: "invalid_request" }, 400);
      case "identity_configuration_invalid":
      case "identity_unavailable":
        logTemporaryUnavailableDiagnostic("identity", code);
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }

    return mapUnexpectedRouteState(code);
  }

  if (isHomepageDemoChallengeError(error)) {
    const code = error.code;

    switch (code) {
      case "invalid_challenge_input":
        return createJsonResponse({ code: "invalid_challenge_input" }, 400);
      case "challenge_configuration_error":
      case "challenge_verification_unavailable":
        logTemporaryUnavailableDiagnostic("challenge", code);
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
      case "challenge_verification_timeout":
        return createJsonResponse({ code: "timeout" }, 504);
    }

    return mapUnexpectedRouteState(code);
  }

  if (isHomepageDemoExtractionError(error)) {
    const code = error.code;

    switch (code) {
      case "invalid_text_input":
        return createJsonResponse({ code: "invalid_text_input" }, 400);
      case "text_input_too_large":
        return createJsonResponse({ code: "request_too_large" }, 413);
      case "text_extraction_timeout":
        return createJsonResponse({ code: "timeout" }, 504);
      case "text_extraction_invalid_result":
        return createJsonResponse({ code: "extraction_failed" }, 502);
      case "text_extraction_unavailable":
        logTemporaryUnavailableDiagnostic("extraction", code);
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }

    return mapUnexpectedRouteState(code);
  }

  if (isHomepageDemoRepositoryError(error)) {
    const code = error.code;

    switch (code) {
      case "invalid_repository_input":
        return createJsonResponse({ code: "invalid_request" }, 400);

      case "idempotency_conflict":
        return createJsonResponse({ code: "request_conflict" }, 409);

      case "trial_not_found":
      case "processing_attempt_not_found":
      case "review_access_denied":
        return createJsonResponse({ code: "not_found" }, 404);

      case "trial_expired":
      case "processing_lease_expired":
      case "review_expired":
        return createJsonResponse({ code: "expired" }, 410);

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
        return createJsonResponse({ code: "processing_conflict" }, 409);

      case "token_collision":
      case "admission_config_missing":
      case "repository_response_invalid":
      case "repository_unavailable":
        logTemporaryUnavailableDiagnostic("repository", code);
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }

    return mapUnexpectedRouteState(code);
  }

  if (isHomepageDemoOrchestrationError(error)) {
    const code = error.code;

    switch (code) {
      case "processing_cleanup_unavailable":
        logTemporaryUnavailableDiagnostic("orchestration", code);
        return createJsonResponse(
          { code: "processing_cleanup_unavailable" },
          503
        );
      case "orchestration_unavailable":
        logTemporaryUnavailableDiagnostic("orchestration", code);
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }

    return mapUnexpectedRouteState(code);
  }

  logTemporaryUnavailableDiagnostic("unexpected", "unexpected");
  return createJsonResponse({ code: "temporarily_unavailable" }, 503);
}

function logTemporaryUnavailableDiagnostic(
  stage: string,
  errorCode: string
): void {
  console.error("[homepage-demo-extract] temporary_unavailable", {
    stage,
    errorCode,
    errorName: errorCode,
  });
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
  logTemporaryUnavailableDiagnostic("unexpected", "unexpected");
  return createJsonResponse({ code: "temporarily_unavailable" }, 503);
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
