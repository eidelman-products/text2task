import { NextRequest, NextResponse } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
import { hasOwnerAnalyticsExclusionCookie } from "@/lib/analytics/owner-exclusion.server";
import {
  getAnalyticsStringField,
  getRequestCountryCode,
  readAnonymousIdCookie,
  readAttributionCookie,
  sanitizeAttributionFields,
  toAnalyticsAttributionPayload,
  type RequestAttributionSnapshot,
} from "@/lib/analytics/request-attribution.server";

const MAX_BODY_CHARS = 8192;
const ALLOWED_BROWSER_EVENTS = new Set(["page_view"]);

/**
 * Phase 4B -- validates the shape of a client-supplied page_view_id before
 * it is ever used. The client's raw value is never trusted for identity or
 * authorization; it is only ever combined with the resolved anonymousId
 * (below) to derive the actual DB idempotency key server-side. A malformed
 * or missing id simply means this event is logged without idempotency
 * protection, exactly as every page_view was before this phase -- it does
 * not reject the event itself.
 */
const PAGE_VIEW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getValidPageViewId(body: UnknownRecord) {
  const raw = getAnalyticsStringField(body, 80, "page_view_id", "pageViewId");

  return raw && PAGE_VIEW_ID_PATTERN.test(raw) ? raw : null;
}

/**
 * One logical page view = one DB row, reusing the exact idempotency
 * infrastructure signup-attribution already relies on (a partial unique
 * index on analytics_events.idempotency_key). The key is server-derived by
 * combining the resolved anonymousId with the client's page-view id, so a
 * retried/duplicated send of the SAME logical view collides safely on
 * INSERT (see logAnalyticsEventSafe's isDuplicateIdempotencyKeyError
 * handling), while two different anonymous visitors can never collide with
 * each other even by coincidence.
 */
function getPageViewIdempotencyKey(
  body: UnknownRecord,
  anonymousId: string | null
) {
  const pageViewId = getValidPageViewId(body);

  if (!pageViewId || !anonymousId) {
    return null;
  }

  return `page_view:${anonymousId}:${pageViewId}`;
}

type UnknownRecord = Record<string, unknown>;

export const dynamic = "force-dynamic";

function emptyResponse() {
  return new NextResponse(null, { status: 204 });
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJsonBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS) {
    return null;
  }

  const text = await request.text();

  if (!text || text.length > MAX_BODY_CHARS) {
    return null;
  }

  const parsed = JSON.parse(text);

  return isRecord(parsed) ? parsed : null;
}

function getEventName(body: UnknownRecord) {
  return getAnalyticsStringField(body, 500, "event_name", "eventName") ?? "";
}

function mergeAttribution(
  cookieAttribution: RequestAttributionSnapshot,
  bodyAttribution: RequestAttributionSnapshot
): RequestAttributionSnapshot {
  return {
    anonymousId: bodyAttribution.anonymousId ?? cookieAttribution.anonymousId,
    utmSource: bodyAttribution.utmSource ?? cookieAttribution.utmSource,
    utmMedium: bodyAttribution.utmMedium ?? cookieAttribution.utmMedium,
    utmCampaign: bodyAttribution.utmCampaign ?? cookieAttribution.utmCampaign,
    utmContent: bodyAttribution.utmContent ?? cookieAttribution.utmContent,
    referrer: bodyAttribution.referrer ?? cookieAttribution.referrer,
    landingPage: bodyAttribution.landingPage ?? cookieAttribution.landingPage,
    pagePath: bodyAttribution.pagePath ?? cookieAttribution.pagePath,
    countryCode: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (hasOwnerAnalyticsExclusionCookie(request)) {
      return emptyResponse();
    }

    const body = await readJsonBody(request);

    if (!body) {
      return emptyResponse();
    }

    const eventName = getEventName(body);

    if (!ALLOWED_BROWSER_EVENTS.has(eventName)) {
      return emptyResponse();
    }

    const cookieAttribution = readAttributionCookie(request);
    const bodyAttribution = sanitizeAttributionFields(body.attribution);
    const mergedAttribution = mergeAttribution(
      cookieAttribution,
      bodyAttribution
    );
    const anonymousId =
      getAnalyticsStringField(body, 120, "anonymous_id", "anonymousId") ??
      mergedAttribution.anonymousId ??
      readAnonymousIdCookie(request);
    const pagePath =
      getAnalyticsStringField(body, 500, "page_path", "pagePath") ??
      mergedAttribution.pagePath;
    const idempotencyKey = getPageViewIdempotencyKey(body, anonymousId);

    await logAnalyticsEventSafe({
      eventName,
      anonymousId,
      attribution: toAnalyticsAttributionPayload({
        ...mergedAttribution,
        anonymousId,
      }),
      pagePath,
      countryCode: getRequestCountryCode(request),
      metadata: {
        source: "browser",
      },
      idempotencyKey,
    });
  } catch {
    return emptyResponse();
  }

  return emptyResponse();
}

export function OPTIONS() {
  return emptyResponse();
}
