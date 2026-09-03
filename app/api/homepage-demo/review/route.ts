import { after, NextRequest, NextResponse } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
import { hasOwnerAnalyticsExclusionCookie } from "@/lib/analytics/owner-exclusion.server";
import { readAnonymousIdCookie } from "@/lib/analytics/request-attribution.server";
import {
  isHomepageDemoIdentityError,
  isHomepageDemoPublicRequestError,
  isHomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";
import { getHomepageDemoSessionCookiePolicy } from "@/lib/homepage-demo/identity.server";
import { resolveHomepageDemoPublicReviewIdentity } from "@/lib/homepage-demo/public-review-identity.server";
import { parseHomepageDemoPublicReviewRequest } from "@/lib/homepage-demo/public-review-request.server";
import {
  assertHomepageDemoPublicExtractEnabled,
  readHomepageDemoPublicExtractRequestJson,
  validateHomepageDemoPublicRequestOrigin,
} from "@/lib/homepage-demo/public-extract-request.server";
import {
  getHomepageDemoReviewDraft,
  type HomepageDemoReviewDraft,
} from "@/lib/homepage-demo/review-repository.server";
import {
  createHomepageDemoPublicReviewPayload,
  type HomepageDemoPublicReviewPayload,
} from "@/lib/homepage-demo/review-payload.server";

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

const HOMEPAGE_DEMO_REVIEW_ANALYTICS_ROUTE = "/api/homepage-demo/review";
const DEMO_REVIEW_VIEWED_EVENT = "demo_review_viewed";

/**
 * Phase 1B -- server-authoritative: fires only once this exact function
 * has been reached, i.e. only on a genuine review_ready draft (any
 * pending/expired/unavailable outcome throws before this point and
 * never reaches this call). Idempotency key is keyed on draftId alone
 * -- a stable, internal, server-only UUID (never exposed to the client,
 * distinct from the public/session/claim tokens) that is unique per
 * trial by the database's own schema -- so polling, refreshing, or
 * reopening the review all safely collapse to exactly one row per
 * draft via the existing analytics_events.idempotency_key partial
 * unique index. No new DB object is required.
 */
function scheduleHomepageDemoReviewViewedAnalytics(
  draft: HomepageDemoReviewDraft,
  anonymousId: string | null,
  ownerFlagged: boolean
): void {
  try {
    const idempotencyKey = `${DEMO_REVIEW_VIEWED_EVENT}:${draft.draftId}`;

    after(async () => {
      try {
        await logAnalyticsEventSafe({
          eventName: DEMO_REVIEW_VIEWED_EVENT,
          userId: null,
          anonymousId,
          pagePath: HOMEPAGE_DEMO_REVIEW_ANALYTICS_ROUTE,
          metadata: { owner_flagged: ownerFlagged },
          idempotencyKey,
        });
      } catch {
        // Operational analytics is best-effort and must never affect the review response.
      }
    });
  } catch {
    // Scheduling analytics is best-effort and must never affect the review response.
  }
}

type ReviewSuccessResponse = Readonly<{
  code: "review_ready";
  draft: HomepageDemoPublicReviewPayload;
}>;

type ReviewErrorResponse = Readonly<{
  code:
    | "not_found"
    | "invalid_request_origin"
    | "invalid_request_content_type"
    | "unsupported_request_encoding"
    | "request_body_too_large"
    | "invalid_request_body"
    | "invalid_request"
    | "review_not_ready"
    | "review_unavailable"
    | "review_expired"
    | "temporarily_unavailable";
}>;

type ReviewJsonResponse = ReviewSuccessResponse | ReviewErrorResponse;

export async function POST(
  request: NextRequest
): Promise<NextResponse<ReviewJsonResponse>> {
  // Phase 1B -- read before anything else can throw, matching the
  // Phase 1A convention in app/api/homepage-demo/extract/route.ts: the
  // existing, general-purpose first-party analytics identifier, kept
  // fully separate from this route's own public/session token identity.
  const anonymousId = readAnonymousIdCookie(request);
  // Phase 1D -- see the identical comment in
  // app/api/homepage-demo/extract/route.ts: adds a trusted boolean fact
  // to a row that is stored either way, never suppresses ingestion.
  const ownerFlagged = hasOwnerAnalyticsExclusionCookie(request);

  try {
    assertHomepageDemoPublicExtractEnabled();
    validateHomepageDemoPublicRequestOrigin({
      requestUrl: request.url,
      headers: request.headers,
    });

    const requestJson = await readHomepageDemoPublicExtractRequestJson(request);
    const parsed = parseHomepageDemoPublicReviewRequest(requestJson);

    const sessionPolicy = getHomepageDemoSessionCookiePolicy();
    const sessionCookie =
      request.cookies.get(sessionPolicy.name)?.value ?? null;
    const identity = resolveHomepageDemoPublicReviewIdentity({
      publicToken: parsed.publicToken,
      sessionCookie,
    });
    const repositoryDraft = await getHomepageDemoReviewDraft({
      publicTokenHash: identity.publicTokenHash,
      sessionTokenHash: identity.sessionTokenHash,
    });
    const publicDraft =
      createHomepageDemoPublicReviewPayload(repositoryDraft);

    scheduleHomepageDemoReviewViewedAnalytics(
      repositoryDraft,
      anonymousId,
      ownerFlagged
    );

    return createJsonResponse(
      {
        code: "review_ready",
        draft: publicDraft,
      },
      200
    );
  } catch (error) {
    try {
      return mapReviewError(error);
    } catch {
      return createEmergencyReviewErrorResponse();
    }
  }
}

function mapReviewError(
  error: unknown
): NextResponse<ReviewErrorResponse> {
  if (isHomepageDemoPublicRequestError(error)) {
    switch (error.code) {
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
  }

  if (isHomepageDemoIdentityError(error)) {
    switch (error.code) {
      case "identity_input_invalid":
        return createJsonResponse({ code: "review_unavailable" }, 404);
      case "identity_configuration_invalid":
      case "identity_unavailable":
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }
  }

  if (isHomepageDemoRepositoryError(error)) {
    switch (error.code) {
      case "invalid_repository_input":
        return createJsonResponse({ code: "invalid_request" }, 400);

      case "trial_not_found":
      case "review_access_denied":
        return createJsonResponse({ code: "review_unavailable" }, 404);

      case "trial_expired":
      case "review_expired":
        return createJsonResponse({ code: "review_expired" }, 410);

      case "review_not_ready":
        return createJsonResponse({ code: "review_not_ready" }, 202);

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

function createJsonResponse<TBody extends ReviewJsonResponse>(
  body: TBody,
  status: number
): NextResponse<TBody> {
  const response = NextResponse.json(body, { status });

  applyReviewResponseHeaders(response);

  return response;
}

function applyReviewResponseHeaders(response: NextResponse): void {
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

function createEmergencyReviewErrorResponse(): NextResponse<ReviewErrorResponse> {
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

  return response as NextResponse<ReviewErrorResponse>;
}
