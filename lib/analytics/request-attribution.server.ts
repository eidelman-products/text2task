import "server-only";

import type { NextRequest } from "next/server";

export const ANALYTICS_CONSENT_COOKIE = "t2t_analytics_consent";
export const ANALYTICS_ACCEPTED_CONSENT_VALUE = "accepted";
export const ATTRIBUTION_COOKIE = "t2t_attribution";
export const ANONYMOUS_COOKIE = "t2t_anon_id";

const MAX_ATTRIBUTION_COOKIE_CHARS = 4096;

type UnknownRecord = Record<string, unknown>;

export type RequestAttributionSnapshot = Readonly<{
  anonymousId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  landingPage: string | null;
  pagePath: string | null;
  countryCode: string | null;
}>;

export type AnalyticsAttributionPayload = {
  anonymous_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
  page_path?: string | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function clampAnalyticsText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

export function getAnalyticsStringField(
  record: UnknownRecord,
  maxLength: number,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = clampAnalyticsText(record[key], maxLength);

    if (value) {
      return value;
    }
  }

  return null;
}

function decodeCookieValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function readCookie(request: NextRequest, name: string) {
  return decodeCookieValue(request.cookies.get(name)?.value);
}

function readAnalyticsConsent(request: NextRequest) {
  return readCookie(request, ANALYTICS_CONSENT_COOKIE);
}

export function hasAcceptedAnalyticsConsent(request: NextRequest) {
  return readAnalyticsConsent(request) === ANALYTICS_ACCEPTED_CONSENT_VALUE;
}

export function sanitizeAttributionFields(
  value: unknown
): RequestAttributionSnapshot {
  if (!isRecord(value)) {
    return Object.freeze({
      anonymousId: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      referrer: null,
      landingPage: null,
      pagePath: null,
      countryCode: null,
    });
  }

  return Object.freeze({
    anonymousId: getAnalyticsStringField(
      value,
      120,
      "anonymous_id",
      "anonymousId"
    ),
    utmSource: getAnalyticsStringField(value, 120, "utm_source", "utmSource"),
    utmMedium: getAnalyticsStringField(value, 120, "utm_medium", "utmMedium"),
    utmCampaign: getAnalyticsStringField(
      value,
      160,
      "utm_campaign",
      "utmCampaign"
    ),
    utmContent: getAnalyticsStringField(
      value,
      160,
      "utm_content",
      "utmContent"
    ),
    referrer: getAnalyticsStringField(value, 500, "referrer"),
    landingPage: getAnalyticsStringField(
      value,
      500,
      "landing_page",
      "landingPage"
    ),
    pagePath: getAnalyticsStringField(value, 500, "page_path", "pagePath"),
    countryCode: null,
  });
}

function getAttributionCookieCandidate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > MAX_ATTRIBUTION_COOKIE_CHARS) {
    return null;
  }

  return trimmed;
}

function parseJsonCandidate(candidate: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(candidate);

    return parsed;
  } catch {
    return null;
  }
}

function parseAttributionCookie(rawValue: string | undefined) {
  const rawCandidate = getAttributionCookieCandidate(rawValue);

  if (!rawCandidate) {
    return null;
  }

  const rawParsed = parseJsonCandidate(rawCandidate);

  if (rawParsed !== null) {
    return rawParsed;
  }

  try {
    const decodedCandidate = getAttributionCookieCandidate(
      decodeURIComponent(rawCandidate)
    );

    if (!decodedCandidate || decodedCandidate === rawCandidate) {
      return null;
    }

    return parseJsonCandidate(decodedCandidate);
  } catch {
    return null;
  }
}

export function readAttributionCookie(request: NextRequest) {
  return sanitizeAttributionFields(
    parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE)?.value)
  );
}

export function readAnonymousIdCookie(request: NextRequest) {
  return clampAnalyticsText(readCookie(request, ANONYMOUS_COOKIE), 120);
}

export function getRequestCountryCode(request: NextRequest) {
  const countryCode =
    clampAnalyticsText(request.headers.get("x-vercel-ip-country"), 12) ??
    clampAnalyticsText(request.headers.get("cf-ipcountry"), 12);

  if (!countryCode) {
    return null;
  }

  const normalized = countryCode.toUpperCase();

  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : null;
}

function hasAnyAttributionValue(snapshot: RequestAttributionSnapshot) {
  return Boolean(
    snapshot.anonymousId ||
      snapshot.utmSource ||
      snapshot.utmMedium ||
      snapshot.utmCampaign ||
      snapshot.utmContent ||
      snapshot.referrer ||
      snapshot.landingPage ||
      snapshot.pagePath
  );
}

export function readRequestAttribution(
  request: NextRequest
): RequestAttributionSnapshot | null {
  try {
    if (!hasAcceptedAnalyticsConsent(request)) {
      return null;
    }

    const cookieAttribution = readAttributionCookie(request);
    const snapshot = Object.freeze({
      ...cookieAttribution,
      anonymousId:
        cookieAttribution.anonymousId ?? readAnonymousIdCookie(request),
      countryCode: getRequestCountryCode(request),
    });

    return hasAnyAttributionValue(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

export function toAnalyticsAttributionPayload(
  snapshot: RequestAttributionSnapshot
): AnalyticsAttributionPayload {
  return {
    anonymous_id: snapshot.anonymousId,
    utm_source: snapshot.utmSource,
    utm_medium: snapshot.utmMedium,
    utm_campaign: snapshot.utmCampaign,
    utm_content: snapshot.utmContent,
    referrer: snapshot.referrer,
    landing_page: snapshot.landingPage,
    page_path: snapshot.pagePath,
  };
}
