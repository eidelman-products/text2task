import { NextRequest, NextResponse } from "next/server";

import {
  getHomepageDemoDuplicateOverrideCookieClearPolicy,
  readHomepageDemoDuplicateOverrideCookie,
} from "@/lib/homepage-demo/claim-duplicate-override-identity.server";
import {
  claimHomepageDemoProjectWithDuplicateOverride,
  type ClaimHomepageDemoProjectWithDuplicateOverrideResult,
} from "@/lib/homepage-demo/claim-duplicate-override-repository.server";
import {
  getHomepageDemoClaimCookieClearPolicy,
  readHomepageDemoClaimCookie,
} from "@/lib/homepage-demo/claim-identity.server";
import {
  HOMEPAGE_DEMO_CLAIM_IMPORT_PERSISTENCE_OPTIONS,
  loadHomepageDemoClaimSaveSource,
} from "@/lib/homepage-demo/claim-save-repository.server";
import {
  parseHomepageDemoClaimSaveRequest,
  readHomepageDemoClaimSaveRequestJson,
} from "@/lib/homepage-demo/claim-save-request.server";
import {
  isHomepageDemoPublicRequestError,
  isHomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";
import {
  assertHomepageDemoPublicExtractEnabled,
  validateHomepageDemoPublicRequestOrigin,
} from "@/lib/homepage-demo/public-extract-request.server";
import {
  prepareProjectImportPersistenceInput,
  validateProjectImportGroups,
} from "@/lib/projects/import-persistence.server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DASHBOARD_DESTINATION = "/dashboard";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = [
  ["Cache-Control", "no-store, no-cache, max-age=0, must-revalidate"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Robots-Tag", "noindex, nofollow, noarchive"],
] as const;

type ClaimSaveAnywaySuccessResponse = Readonly<
  | {
      code: "saved";
      destination: typeof DASHBOARD_DESTINATION;
      created: true;
    }
  | {
      code: "already_claimed";
      destination: typeof DASHBOARD_DESTINATION;
      created: false;
    }
>;

type ClaimSaveAnywayErrorResponse = Readonly<{
  code:
    | "invalid_request"
    | "unauthorized"
    | "duplicate_detected"
    | "duplicate_authority_unavailable"
    | "duplicate_authority_expired"
    | "expired"
    | "claim_unavailable"
    | "temporarily_unavailable";
}>;

type ClaimSaveAnywayJsonResponse =
  | ClaimSaveAnywaySuccessResponse
  | ClaimSaveAnywayErrorResponse;

export async function POST(
  request: NextRequest
): Promise<NextResponse<ClaimSaveAnywayJsonResponse>> {
  try {
    assertHomepageDemoPublicExtractEnabled();
    validateHomepageDemoPublicRequestOrigin({
      requestUrl: request.url,
      headers: request.headers,
    });

    const requestJson = await readHomepageDemoClaimSaveRequestJson(request);
    parseHomepageDemoClaimSaveRequest(requestJson);

    const claimCookie = readHomepageDemoClaimCookie(request.cookies);

    if (claimCookie === null) {
      return createJsonResponse({ code: "claim_unavailable" }, 404);
    }

    const duplicateOverrideCookie = readHomepageDemoDuplicateOverrideCookie(
      request.cookies
    );
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !isValidUuid(user?.id)) {
      return createJsonResponse({ code: "unauthorized" }, 401);
    }

    if (duplicateOverrideCookie.kind === "missing") {
      return createJsonResponse(
        { code: "duplicate_authority_unavailable" },
        409
      );
    }

    if (duplicateOverrideCookie.kind === "malformed") {
      return createJsonResponseWithDuplicateOverrideClear(
        { code: "duplicate_authority_unavailable" },
        409
      );
    }

    const source = await loadHomepageDemoClaimSaveSource({
      claimTokenHash: claimCookie.tokenHash,
    });

    if (source.kind === "claim_unavailable") {
      return createJsonResponseWithDuplicateOverrideClear(
        { code: "claim_unavailable" },
        404
      );
    }

    const validationFailures = validateProjectImportGroups([
      source.projectGroup,
    ]);

    if (validationFailures.length > 0) {
      return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }

    const prepared = prepareProjectImportPersistenceInput(
      [source.projectGroup],
      HOMEPAGE_DEMO_CLAIM_IMPORT_PERSISTENCE_OPTIONS
    );
    const claimResult = await claimHomepageDemoProjectWithDuplicateOverride({
      claimTokenHash: claimCookie.tokenHash,
      authenticatedUserId: user.id,
      authorityTokenHash: duplicateOverrideCookie.tokenHash,
      requestHash: prepared.requestHash,
      importGroupsJson: prepared.payloadJson,
    });

    return mapClaimSaveAnywayResult(claimResult);
  } catch (error) {
    try {
      return mapClaimSaveAnywayError(error);
    } catch {
      return createEmergencyClaimSaveAnywayErrorResponse();
    }
  }
}

function mapClaimSaveAnywayResult(
  result: ClaimHomepageDemoProjectWithDuplicateOverrideResult
): NextResponse<ClaimSaveAnywayJsonResponse> {
  switch (result.outcome) {
    case "saved":
      return createSuccessfulClaimSaveAnywayResponse({
        code: "saved",
        destination: DASHBOARD_DESTINATION,
        created: true,
      });
    case "already_claimed":
      return createSuccessfulClaimSaveAnywayResponse({
        code: "already_claimed",
        destination: DASHBOARD_DESTINATION,
        created: false,
      });
    case "expired":
      return createJsonResponseWithDuplicateOverrideClear(
        { code: "expired" },
        410
      );
    case "invalid_claim":
    case "draft_unavailable":
      return createJsonResponseWithDuplicateOverrideClear(
        { code: "claim_unavailable" },
        404
      );
    case "duplicate_authority_unavailable":
      return createJsonResponseWithDuplicateOverrideClear(
        { code: "duplicate_authority_unavailable" },
        409
      );
    case "duplicate_authority_expired":
      return createJsonResponseWithDuplicateOverrideClear(
        { code: "duplicate_authority_expired" },
        410
      );
    case "duplicate_detected":
      return createJsonResponse({ code: "duplicate_detected" }, 409);
  }
}

function mapClaimSaveAnywayError(
  error: unknown
): NextResponse<ClaimSaveAnywayErrorResponse> {
  if (isHomepageDemoPublicRequestError(error)) {
    switch (error.code) {
      case "homepage_demo_disabled":
        return createJsonResponse({ code: "claim_unavailable" }, 404);
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

  if (isHomepageDemoRepositoryError(error)) {
    switch (error.code) {
      case "invalid_repository_input":
        return createJsonResponse({ code: "invalid_request" }, 400);
      case "trial_not_found":
      case "review_access_denied":
      case "review_not_ready":
        return createJsonResponse({ code: "claim_unavailable" }, 404);
      case "trial_expired":
      case "review_expired":
        return createJsonResponse({ code: "expired" }, 410);
      case "invalid_transition":
      case "risk_not_allowed":
      case "idempotency_conflict":
      case "token_collision":
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
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }
  }

  return createJsonResponse({ code: "temporarily_unavailable" }, 503);
}

function createSuccessfulClaimSaveAnywayResponse(
  body: ClaimSaveAnywaySuccessResponse
): NextResponse<ClaimSaveAnywayJsonResponse> {
  const response = createJsonResponse<ClaimSaveAnywayJsonResponse>(body, 200);

  clearPrimaryClaimCookie(response);
  clearDuplicateOverrideCookie(response);

  return response;
}

function createJsonResponseWithDuplicateOverrideClear<
  TBody extends ClaimSaveAnywayJsonResponse,
>(body: TBody, status: number): NextResponse<TBody> {
  const response = createJsonResponse(body, status);

  clearDuplicateOverrideCookie(response);

  return response;
}

function createJsonResponse<TBody extends ClaimSaveAnywayJsonResponse>(
  body: TBody,
  status: number
): NextResponse<TBody> {
  const response = NextResponse.json(body, { status });

  applyClaimSaveAnywayResponseHeaders(response);

  return response;
}

function clearPrimaryClaimCookie(response: NextResponse): void {
  const cookiePolicy = getHomepageDemoClaimCookieClearPolicy();

  response.cookies.set(cookiePolicy.name, "", cookiePolicy);
}

function clearDuplicateOverrideCookie(response: NextResponse): void {
  const cookiePolicy = getHomepageDemoDuplicateOverrideCookieClearPolicy();

  response.cookies.set(cookiePolicy.name, "", cookiePolicy);
}

function applyClaimSaveAnywayResponseHeaders(response: NextResponse): void {
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

function createEmergencyClaimSaveAnywayErrorResponse(): NextResponse<ClaimSaveAnywayErrorResponse> {
  const response = new NextResponse('{"code":"temporarily_unavailable"}', {
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

  return response as NextResponse<ClaimSaveAnywayErrorResponse>;
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
