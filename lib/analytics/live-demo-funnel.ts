/**
 * Phase 1D -- pure, dependency-free aggregation for the Admin "Live Demo
 * Conversion" business funnel (app/admin/analytics/page.tsx). Every
 * function here takes already-loaded rows and an explicit window; none of
 * them read the clock, query Supabase, or otherwise perform I/O, so this
 * module is directly unit-testable and mirrors the existing
 * lib/analytics/owner-analytics-window.ts convention.
 *
 * Owner exclusion model (see docs/Text2Task_Live_Demo_Conversion_Master_
 * Handoff_2026-09-03.md Phase 1D for the full design rationale): a row is
 * "known owner" if either (a) its own metadata.owner_flagged is true, or
 * (b) its anonymous_id matches an anonymous_id that carries
 * owner_flagged:true on ANY row in the same loaded dataset. This is a
 * pure, window-scoped, in-memory propagation -- it never mutates stored
 * rows, never infers from IP/User-Agent/fingerprinting, and only ever
 * acts on the server-derived owner_flagged signal already attached at
 * ingestion time.
 */

export type LiveDemoFunnelEventName =
  | "homepage_demo_extract_attempt"
  | "homepage_demo_extract_succeeded"
  | "demo_review_viewed"
  | "demo_account_cta_clicked"
  | "demo_claim_saved";

export const LIVE_DEMO_FUNNEL_SUPPLEMENT_EVENT_NAMES = [
  "demo_review_viewed",
  "demo_account_cta_clicked",
  "demo_claim_saved",
] as const satisfies readonly LiveDemoFunnelEventName[];

export type LiveDemoFunnelEventRow = {
  event_name: LiveDemoFunnelEventName;
  occurred_at: string;
  anonymous_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
};

export type SafeRate = {
  numerator: number;
  denominator: number;
  /** null means "do not display a percentage" -- zero/undefined denominator. */
  value: number | null;
};

export type LiveDemoConversionCounts = {
  label: string;
  attempts: number;
  successfulDemos: number;
  reviewReached: number;
  observedCtaClicks: number;
  claimsSaved: number;
  correlatedSuccessfulDemos: number;
  uncorrelatedSuccessfulDemos: number;
  correlatedReviewReached: number;
  uncorrelatedReviewReached: number;
  authenticatedUsersWithClaimSaved: number;
  reviewReachedRate: SafeRate;
  claimsSavedRate: SafeRate;
};

export type LiveDemoCtaBreakdown = {
  startFree: number;
  logIn: number;
  other: number;
};

export type LiveDemoDuplicateOverrideBreakdown = {
  normalSave: number;
  saveAnyway: number;
};

function parseEventTimestamp(row: { occurred_at: string }): number {
  const timestamp = new Date(row.occurred_at).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function isOwnerFlaggedRow(row: LiveDemoFunnelEventRow): boolean {
  return row.metadata?.owner_flagged === true;
}

/**
 * The set of anonymous_id values that carry a trusted owner_flagged:true
 * row anywhere in the given dataset. Only non-null anonymous_id values
 * participate -- a null anonymous_id can never be "propagated" since it
 * cannot be correlated to any other row (see excludeKnownOwnerRows).
 */
export function buildKnownOwnerAnonymousIds(
  rows: readonly LiveDemoFunnelEventRow[]
): Set<string> {
  const ownerAnonymousIds = new Set<string>();

  for (const row of rows) {
    if (row.anonymous_id && isOwnerFlaggedRow(row)) {
      ownerAnonymousIds.add(row.anonymous_id);
    }
  }

  return ownerAnonymousIds;
}

function isKnownOwnerRow(
  row: LiveDemoFunnelEventRow,
  ownerAnonymousIds: ReadonlySet<string>
): boolean {
  return (
    isOwnerFlaggedRow(row) ||
    (row.anonymous_id !== null && ownerAnonymousIds.has(row.anonymous_id))
  );
}

/**
 * Excludes every row belonging to a known owner -- either flagged
 * directly, or sharing an anonymous_id with a flagged row elsewhere in
 * the same loaded window. This is the "business conversion" filter;
 * operational health aggregation must NOT use this (it deliberately
 * includes all traffic, owner included).
 */
export function excludeKnownOwnerRows(
  rows: readonly LiveDemoFunnelEventRow[],
  ownerAnonymousIds: ReadonlySet<string>
): LiveDemoFunnelEventRow[] {
  return rows.filter((row) => !isKnownOwnerRow(row, ownerAnonymousIds));
}

function filterSince(
  rows: readonly LiveDemoFunnelEventRow[],
  sinceMs: number
): LiveDemoFunnelEventRow[] {
  return rows.filter((row) => parseEventTimestamp(row) >= sinceMs);
}

function countByEvent(
  rows: readonly LiveDemoFunnelEventRow[],
  eventName: LiveDemoFunnelEventName
): number {
  return rows.filter((row) => row.event_name === eventName).length;
}

function rowsForEvent(
  rows: readonly LiveDemoFunnelEventRow[],
  eventName: LiveDemoFunnelEventName
): LiveDemoFunnelEventRow[] {
  return rows.filter((row) => row.event_name === eventName);
}

function countDistinctAnonymousId(
  rows: readonly LiveDemoFunnelEventRow[]
): number {
  return new Set(
    rows.map((row) => row.anonymous_id).filter((value): value is string => Boolean(value))
  ).size;
}

function countUncorrelated(rows: readonly LiveDemoFunnelEventRow[]): number {
  return rows.filter((row) => !row.anonymous_id).length;
}

function countDistinctUserId(
  rows: readonly LiveDemoFunnelEventRow[],
  eventName: LiveDemoFunnelEventName
): number {
  return new Set(
    rowsForEvent(rows, eventName)
      .map((row) => row.user_id)
      .filter((value): value is string => Boolean(value))
  ).size;
}

/**
 * Never returns a percentage that could be misread as authoritative when
 * the denominator is zero or undefined -- callers must render `null` as
 * "no rate shown", never as 0% or NaN.
 */
export function computeSafeRate(
  numerator: number,
  denominator: number
): SafeRate {
  return {
    numerator,
    denominator,
    value: denominator > 0 ? (numerator / denominator) * 100 : null,
  };
}

/**
 * Builds one period's business-conversion counts from an ALREADY
 * owner-excluded row set (callers must call excludeKnownOwnerRows first
 * over the full loaded window, then pass the per-period slice here).
 *
 * Deliberately does NOT compute any rate using observedCtaClicks as a
 * denominator or numerator against another authoritative milestone --
 * demo_account_cta_clicked is client, best-effort, and consent-gated, so
 * a rate built from it could show a nonsensical >100% figure (e.g. more
 * claims saved than observed CTA clicks). Rates are only ever computed
 * among the three server-authoritative milestones: attempts, successful
 * demos, review reached, and claims saved.
 */
export function buildLiveDemoConversionCounts(
  label: string,
  ownerExcludedRows: readonly LiveDemoFunnelEventRow[],
  sinceMs: number
): LiveDemoConversionCounts {
  const periodRows = filterSince(ownerExcludedRows, sinceMs);
  const successfulDemoRows = rowsForEvent(
    periodRows,
    "homepage_demo_extract_succeeded"
  );
  const reviewReachedRows = rowsForEvent(periodRows, "demo_review_viewed");
  const attempts = countByEvent(periodRows, "homepage_demo_extract_attempt");
  const successfulDemos = successfulDemoRows.length;
  const reviewReached = reviewReachedRows.length;
  const claimsSaved = countByEvent(periodRows, "demo_claim_saved");

  return {
    label,
    attempts,
    successfulDemos,
    reviewReached,
    observedCtaClicks: countByEvent(periodRows, "demo_account_cta_clicked"),
    claimsSaved,
    correlatedSuccessfulDemos: countDistinctAnonymousId(successfulDemoRows),
    uncorrelatedSuccessfulDemos: countUncorrelated(successfulDemoRows),
    correlatedReviewReached: countDistinctAnonymousId(reviewReachedRows),
    uncorrelatedReviewReached: countUncorrelated(reviewReachedRows),
    authenticatedUsersWithClaimSaved: countDistinctUserId(
      periodRows,
      "demo_claim_saved"
    ),
    reviewReachedRate: computeSafeRate(reviewReached, successfulDemos),
    claimsSavedRate: computeSafeRate(claimsSaved, successfulDemos),
  };
}

function getCtaMetadataValue(row: LiveDemoFunnelEventRow): unknown {
  return row.metadata?.cta;
}

export function buildLiveDemoCtaBreakdown(
  ownerExcludedRows: readonly LiveDemoFunnelEventRow[],
  sinceMs: number
): LiveDemoCtaBreakdown {
  const ctaRows = rowsForEvent(
    filterSince(ownerExcludedRows, sinceMs),
    "demo_account_cta_clicked"
  );
  let startFree = 0;
  let logIn = 0;
  let other = 0;

  for (const row of ctaRows) {
    const cta = getCtaMetadataValue(row);

    if (cta === "start_free") {
      startFree += 1;
    } else if (cta === "log_in") {
      logIn += 1;
    } else {
      other += 1;
    }
  }

  return { startFree, logIn, other };
}

function getDuplicateOverrideMetadataValue(
  row: LiveDemoFunnelEventRow
): unknown {
  return row.metadata?.duplicate_override;
}

export function buildLiveDemoDuplicateOverrideBreakdown(
  ownerExcludedRows: readonly LiveDemoFunnelEventRow[],
  sinceMs: number
): LiveDemoDuplicateOverrideBreakdown {
  const claimRows = rowsForEvent(
    filterSince(ownerExcludedRows, sinceMs),
    "demo_claim_saved"
  );
  let normalSave = 0;
  let saveAnyway = 0;

  for (const row of claimRows) {
    if (getDuplicateOverrideMetadataValue(row) === true) {
      saveAnyway += 1;
    } else {
      normalSave += 1;
    }
  }

  return { normalSave, saveAnyway };
}

/**
 * True when the loaded row count reached the query's row limit, meaning
 * the true totals for the window may be higher than what was loaded.
 * Callers should label affected figures as approximate rather than
 * silently presenting a truncated count as exact.
 */
export function isPossiblyTruncated(
  loadedRowCount: number,
  rowLimit: number
): boolean {
  return loadedRowCount >= rowLimit;
}
