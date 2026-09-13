import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const USER_ATTRIBUTION_EVENTS = [
  "signup_attribution_captured",
  "signup_success",
] as const;

const ACQUISITION_EVENTS = [
  "signup_attribution_captured",
  "signup_success",
  "page_view",
] as const;

type AnalyticsAttributionRow = {
  event_name: string | null;
  user_id: string | null;
  occurred_at: string | null;
  anonymous_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_page: string | null;
  country_code: string | null;
  page_path: string | null;
};

export type PaidConversionAcquisitionAttribution =
  | {
      status: "known";
      source: string;
      medium: string | null;
      campaign: string | null;
      content: string | null;
      referrer: string | null;
      landingPage: string | null;
      countryCode: string | null;
      evidenceEventName: string;
      evidenceUserId: string | null;
      evidenceAnonymousId: string | null;
    }
  | {
      status: "unknown";
      source: "unknown";
      medium: null;
      campaign: null;
      content: null;
      referrer: null;
      landingPage: null;
      countryCode: null;
      evidenceEventName: null;
      evidenceUserId: null;
      evidenceAnonymousId: null;
    };

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function hasAttributionEvidence(row: AnalyticsAttributionRow) {
  return Boolean(
    cleanText(row.utm_source) ||
      cleanText(row.utm_medium) ||
      cleanText(row.utm_campaign) ||
      cleanText(row.utm_content) ||
      cleanText(row.referrer) ||
      cleanText(row.landing_page) ||
      cleanText(row.country_code)
  );
}

function knownAttributionFromRow(
  row: AnalyticsAttributionRow
): PaidConversionAcquisitionAttribution {
  return {
    status: "known",
    source: cleanText(row.utm_source) ?? "direct / none",
    medium: cleanText(row.utm_medium),
    campaign: cleanText(row.utm_campaign),
    content: cleanText(row.utm_content),
    referrer: cleanText(row.referrer),
    landingPage: cleanText(row.landing_page),
    countryCode: cleanText(row.country_code),
    evidenceEventName: cleanText(row.event_name) ?? "unknown",
    evidenceUserId: cleanText(row.user_id),
    evidenceAnonymousId: cleanText(row.anonymous_id),
  };
}

function unknownAttribution(): PaidConversionAcquisitionAttribution {
  return {
    status: "unknown",
    source: "unknown",
    medium: null,
    campaign: null,
    content: null,
    referrer: null,
    landingPage: null,
    countryCode: null,
    evidenceEventName: null,
    evidenceUserId: null,
    evidenceAnonymousId: null,
  };
}

export async function resolvePaidConversionAcquisitionAttribution(userId: string) {
  const safeUserId = cleanText(userId);

  if (!safeUserId) {
    return unknownAttribution();
  }

  try {
    const { data: userRows, error: userRowsError } = await supabaseAdmin
      .from("analytics_events")
      .select(
        "event_name, user_id, occurred_at, anonymous_id, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page, country_code, page_path"
      )
      .in("event_name", USER_ATTRIBUTION_EVENTS)
      .eq("user_id", safeUserId)
      .order("occurred_at", { ascending: true })
      .limit(50);

    if (userRowsError) {
      console.warn("Paid conversion acquisition attribution query failed:", {
        message: userRowsError.message,
      });

      return unknownAttribution();
    }

    const directRows = ((userRows ?? []) as AnalyticsAttributionRow[]).filter(
      hasAttributionEvidence
    );

    if (directRows[0]) {
      return knownAttributionFromRow(directRows[0]);
    }

    const anonymousIds = Array.from(
      new Set(
        ((userRows ?? []) as AnalyticsAttributionRow[])
          .map((row) => cleanText(row.anonymous_id))
          .filter((value): value is string => Boolean(value))
      )
    );

    if (anonymousIds.length === 0) {
      return unknownAttribution();
    }

    const { data: anonymousRows, error: anonymousRowsError } =
      await supabaseAdmin
        .from("analytics_events")
        .select(
          "event_name, user_id, occurred_at, anonymous_id, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page, country_code, page_path"
        )
        .in("event_name", ACQUISITION_EVENTS)
        .in("anonymous_id", anonymousIds)
        .order("occurred_at", { ascending: true })
        .limit(50);

    if (anonymousRowsError) {
      console.warn("Paid conversion anonymous attribution query failed:", {
        message: anonymousRowsError.message,
      });

      return unknownAttribution();
    }

    const linkedAnonymousRows = ((anonymousRows ?? []) as AnalyticsAttributionRow[])
      .filter((row) => {
        const rowUserId = cleanText(row.user_id);
        return !rowUserId || rowUserId === safeUserId;
      })
      .filter(hasAttributionEvidence);

    return linkedAnonymousRows[0]
      ? knownAttributionFromRow(linkedAnonymousRows[0])
      : unknownAttribution();
  } catch (error) {
    console.warn("Paid conversion acquisition attribution resolution failed:", {
      message:
        error instanceof Error ? error.message : "Unknown analytics error",
    });

    return unknownAttribution();
  }
}
