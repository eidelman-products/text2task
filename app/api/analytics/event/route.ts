import { NextRequest, NextResponse } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";

const MAX_BODY_CHARS = 8192;
const ATTRIBUTION_COOKIE = "t2t_attribution";
const ANONYMOUS_COOKIE = "t2t_anon_id";
const ALLOWED_BROWSER_EVENTS = new Set(["page_view"]);

type UnknownRecord = Record<string, unknown>;

export const dynamic = "force-dynamic";

function emptyResponse() {
  return new NextResponse(null, { status: 204 });
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function getStringField(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = clampText(record[key], 500);

    if (value) {
      return value;
    }
  }

  return null;
}

function sanitizeAttribution(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return {
    anonymous_id: getStringField(value, "anonymous_id", "anonymousId"),
    utm_source: getStringField(value, "utm_source", "utmSource"),
    utm_medium: getStringField(value, "utm_medium", "utmMedium"),
    utm_campaign: getStringField(value, "utm_campaign", "utmCampaign"),
    utm_content: getStringField(value, "utm_content", "utmContent"),
    referrer: getStringField(value, "referrer"),
    landing_page: getStringField(value, "landing_page", "landingPage"),
    page_path: getStringField(value, "page_path", "pagePath"),
  };
}

function parseJsonCookie(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded);

    return sanitizeAttribution(parsed);
  } catch {
    return {};
  }
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
  return getStringField(body, "event_name", "eventName") ?? "";
}

function getCountryCode(request: NextRequest) {
  return (
    clampText(request.headers.get("x-vercel-ip-country"), 12) ??
    clampText(request.headers.get("cf-ipcountry"), 12)
  );
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

    const cookieAttribution = parseJsonCookie(
      request.cookies.get(ATTRIBUTION_COOKIE)?.value
    );
    const bodyAttribution = sanitizeAttribution(body.attribution);
    const mergedAttribution = {
      ...cookieAttribution,
      ...bodyAttribution,
    };
    const anonymousId =
      getStringField(body, "anonymous_id", "anonymousId") ??
      mergedAttribution.anonymous_id ??
      clampText(request.cookies.get(ANONYMOUS_COOKIE)?.value, 120);

    await logAnalyticsEventSafe({
      eventName,
      anonymousId,
      attribution: {
        ...mergedAttribution,
        anonymous_id: anonymousId,
      },
      pagePath:
        getStringField(body, "page_path", "pagePath") ??
        mergedAttribution.page_path,
      countryCode: getCountryCode(request),
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
