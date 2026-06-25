import { NextRequest, NextResponse } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
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
    });
  } catch {
    return emptyResponse();
  }

  return emptyResponse();
}

export function OPTIONS() {
  return emptyResponse();
}
