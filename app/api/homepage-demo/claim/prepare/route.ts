import { NextRequest, NextResponse } from "next/server";

import { createHomepageDemoClaimAuthority } from "@/lib/homepage-demo/claim-identity.server";
import {
  getHomepageDemoClaimCookiePolicy,
  readHomepageDemoClaimCookie,
} from "@/lib/homepage-demo/claim-identity.server";
import {
  parseHomepageDemoClaimPrepareRequest,
  readHomepageDemoClaimPrepareRequestJson,
} from "@/lib/homepage-demo/claim-request.server";
import {
  prepareHomepageDemoPendingClaim,
  type HomepageDemoClaimPreparationCode,
} from "@/lib/homepage-demo/claim-repository.server";
import {
  isHomepageDemoIdentityError,
  isHomepageDemoPublicRequestError,
  isHomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";
import { getHomepageDemoSessionCookiePolicy } from "@/lib/homepage-demo/identity.server";
import { resolveHomepageDemoPublicReviewIdentity } from "@/lib/homepage-demo/public-review-identity.server";
import {
  assertHomepageDemoPublicExtractEnabled,
  validateHomepageDemoPublicRequestOrigin,
} from "@/lib/homepage-demo/public-extract-request.server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = [
  ["Cache-Control", "no-store, no-cache, max-age=0, must-revalidate"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Robots-Tag", "noindex, nofollow, noarchive"],
] as const;

type ClaimPrepareSuccessResponse = Readonly<{
  code: HomepageDemoClaimPreparationCode;
  authenticated: boolean;
}>;

type ClaimPrepareErrorResponse = Readonly<{
  code: "invalid_request" | "not_found" | "draft_unavailable" | "expired";
}>;

type ClaimPrepareJsonResponse =
  | ClaimPrepareSuccessResponse
  | ClaimPrepareErrorResponse;

export async function POST(
  request: NextRequest
): Promise<NextResponse<ClaimPrepareJsonResponse>> {
  try {
    assertHomepageDemoPublicExtractEnabled();
    validateHomepageDemoPublicRequestOrigin({
      requestUrl: request.url,
      headers: request.headers,
    });

    const requestJson = await readHomepageDemoClaimPrepareRequestJson(request);
    const parsed = parseHomepageDemoClaimPrepareRequest(requestJson);
    const sessionPolicy = getHomepageDemoSessionCookiePolicy();
    const sessionCookie =
      request.cookies.get(sessionPolicy.name)?.value ?? null;
    const identity = resolveHomepageDemoPublicReviewIdentity({
      publicToken: parsed.publicToken,
      sessionCookie,
    });
    const existingClaimCookie = readHomepageDemoClaimCookie(request.cookies);
    let generatedClaimAuthority: ReturnType<
      typeof createHomepageDemoClaimAuthority
    > | null = null;
    let preparation = await prepareHomepageDemoPendingClaim({
      publicTokenHash: identity.publicTokenHash,
      sessionTokenHash: identity.sessionTokenHash,
      existingClaimTokenHash: existingClaimCookie?.tokenHash ?? null,
      candidateClaimTokenHash: null,
    });

    if (preparation.action === "needs_claim_authority") {
      generatedClaimAuthority = createHomepageDemoClaimAuthority();
      preparation = await prepareHomepageDemoPendingClaim({
        publicTokenHash: identity.publicTokenHash,
        sessionTokenHash: identity.sessionTokenHash,
        existingClaimTokenHash: existingClaimCookie?.tokenHash ?? null,
        candidateClaimTokenHash: generatedClaimAuthority.tokenHash,
      });
    }

    if (preparation.action === "needs_claim_authority") {
      return createJsonResponse({ code: "draft_unavailable" }, 503);
    }

    const authenticated = await readAuthenticatedStatus();
    const response = createJsonResponse(
      {
        code: preparation.code,
        authenticated,
      },
      getStatusForClaimPreparationCode(preparation.code)
    );

    if (
      preparation.action === "set_cookie" &&
      generatedClaimAuthority !== null
    ) {
      const cookiePolicy = getHomepageDemoClaimCookiePolicy(
        preparation.cookieMaxAgeSeconds
      );

      response.cookies.set(
        cookiePolicy.name,
        generatedClaimAuthority.rawToken,
        cookiePolicy
      );
    }

    return response;
  } catch (error) {
    try {
      return mapClaimPrepareError(error);
    } catch {
      return createEmergencyClaimPrepareErrorResponse();
    }
  }
}

async function readAuthenticatedStatus(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user?.id);
  } catch {
    return false;
  }
}

function mapClaimPrepareError(
  error: unknown
): NextResponse<ClaimPrepareErrorResponse> {
  if (isHomepageDemoPublicRequestError(error)) {
    switch (error.code) {
      case "homepage_demo_disabled":
        return createJsonResponse({ code: "not_found" }, 404);
      case "invalid_request_origin":
        return createJsonResponse({ code: "invalid_request" }, 403);
      case "invalid_request_content_type":
      case "unsupported_request_encoding":
        return createJsonResponse({ code: "invalid_request" }, 415);
      case "request_body_too_large":
        return createJsonResponse({ code: "invalid_request" }, 413);
      case "invalid_request_body":
        return createJsonResponse({ code: "invalid_request" }, 400);
    }
  }

  if (isHomepageDemoIdentityError(error)) {
    switch (error.code) {
      case "identity_input_invalid":
        return createJsonResponse({ code: "invalid_request" }, 400);
      case "identity_configuration_invalid":
      case "identity_unavailable":
        return createJsonResponse({ code: "draft_unavailable" }, 503);
    }
  }

  if (isHomepageDemoRepositoryError(error)) {
    switch (error.code) {
      case "invalid_repository_input":
        return createJsonResponse({ code: "invalid_request" }, 400);
      case "trial_not_found":
        return createJsonResponse({ code: "not_found" }, 404);
      case "trial_expired":
      case "review_expired":
        return createJsonResponse({ code: "expired" }, 410);
      case "review_access_denied":
      case "review_not_ready":
        return createJsonResponse({ code: "draft_unavailable" }, 404);
      case "token_collision":
      case "invalid_transition":
      case "risk_not_allowed":
      case "idempotency_conflict":
      case "completion_conflict":
      case "draft_conflict":
      case "failure_conflict":
      case "block_conflict":
      case "admission_config_missing":
      case "admission_state_conflict":
      case "processing_attempt_not_found":
      case "processing_lease_invalid":
      case "processing_lease_expired":
      case "processing_state_conflict":
      case "processing_completion_conflict":
      case "review_edit_conflict":
      case "repository_response_invalid":
      case "repository_unavailable":
        return createJsonResponse({ code: "draft_unavailable" }, 503);
    }
  }

  return createJsonResponse({ code: "draft_unavailable" }, 503);
}

function getStatusForClaimPreparationCode(
  code: HomepageDemoClaimPreparationCode
): number {
  switch (code) {
    case "claim_prepared":
      return 200;
    case "claim_in_progress":
    case "already_claimed":
      return 409;
    case "expired":
      return 410;
    case "draft_unavailable":
    case "not_found":
      return 404;
  }
}

function createJsonResponse<TBody extends ClaimPrepareJsonResponse>(
  body: TBody,
  status: number
): NextResponse<TBody> {
  const response = NextResponse.json(body, { status });

  applyClaimPrepareResponseHeaders(response);

  return response;
}

function applyClaimPrepareResponseHeaders(response: NextResponse): void {
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

function createEmergencyClaimPrepareErrorResponse(): NextResponse<ClaimPrepareErrorResponse> {
  const response = new NextResponse('{"code":"draft_unavailable"}', {
    status: 503,
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
      Expires: "0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      Vary: "Origin, Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });

  return response as NextResponse<ClaimPrepareErrorResponse>;
}
