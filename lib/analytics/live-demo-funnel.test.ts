import { describe, expect, it } from "vitest";

import {
  buildKnownOwnerAnonymousIds,
  buildLiveDemoConversionCounts,
  buildLiveDemoCtaBreakdown,
  buildLiveDemoDuplicateOverrideBreakdown,
  computeSafeRate,
  excludeKnownOwnerRows,
  isOwnerFlaggedRow,
  isPossiblyTruncated,
  type LiveDemoFunnelEventRow,
} from "./live-demo-funnel";

/*
  Phase 1D -- unit coverage for the pure Live Demo business-funnel
  aggregation used by app/admin/analytics/page.tsx. These tests protect
  the owner-exclusion propagation model, the null/uncorrelated-identity
  treatment, and the CTA-consent-gap safety guard (Part 22 of the Phase
  1D request) independent of any Supabase/React rendering concerns.
*/

function row(
  overrides: Partial<LiveDemoFunnelEventRow>
): LiveDemoFunnelEventRow {
  return {
    event_name: "homepage_demo_extract_succeeded",
    occurred_at: "2026-08-03T09:00:00.000Z",
    anonymous_id: "anon-1",
    user_id: null,
    metadata: {},
    ...overrides,
  };
}

const SINCE_MS = Date.parse("2026-08-01T00:00:00.000Z");

describe("isOwnerFlaggedRow", () => {
  it("is true only when metadata.owner_flagged is exactly boolean true", () => {
    expect(isOwnerFlaggedRow(row({ metadata: { owner_flagged: true } }))).toBe(
      true
    );
    expect(
      isOwnerFlaggedRow(row({ metadata: { owner_flagged: false } }))
    ).toBe(false);
    expect(isOwnerFlaggedRow(row({ metadata: {} }))).toBe(false);
    expect(
      isOwnerFlaggedRow(row({ metadata: { owner_flagged: "true" as never } }))
    ).toBe(false);
  });
});

describe("buildKnownOwnerAnonymousIds / excludeKnownOwnerRows", () => {
  it("excludes a directly owner-flagged row", () => {
    const rows = [
      row({ metadata: { owner_flagged: true } }),
      row({ anonymous_id: "anon-2" }),
    ];
    const owners = buildKnownOwnerAnonymousIds(rows);

    expect(excludeKnownOwnerRows(rows, owners)).toEqual([
      row({ anonymous_id: "anon-2" }),
    ]);
  });

  it("propagates owner exclusion to earlier events sharing the same anonymous_id", () => {
    const rows = [
      row({
        event_name: "homepage_demo_extract_succeeded",
        anonymous_id: "anon-owner",
        occurred_at: "2026-08-01T10:00:00.000Z",
      }),
      row({
        event_name: "demo_review_viewed",
        anonymous_id: "anon-owner",
        occurred_at: "2026-08-01T10:01:00.000Z",
      }),
      row({
        event_name: "demo_claim_saved",
        anonymous_id: "anon-owner",
        occurred_at: "2026-08-01T10:05:00.000Z",
        metadata: { owner_flagged: true },
      }),
    ];
    const owners = buildKnownOwnerAnonymousIds(rows);

    expect(owners.has("anon-owner")).toBe(true);
    expect(excludeKnownOwnerRows(rows, owners)).toEqual([]);
  });

  it("never propagates exclusion based on a null anonymous_id", () => {
    const rows = [
      row({ anonymous_id: null, metadata: { owner_flagged: true } }),
      row({ anonymous_id: null }),
      row({ anonymous_id: "anon-2" }),
    ];
    const owners = buildKnownOwnerAnonymousIds(rows);

    expect(owners.size).toBe(0);
    // The second null-anonymous_id row is untouched (it cannot be
    // correlated to the owner-flagged row at all); only the row that is
    // itself directly flagged is excluded.
    expect(excludeKnownOwnerRows(rows, owners)).toEqual([
      row({ anonymous_id: null }),
      row({ anonymous_id: "anon-2" }),
    ]);
  });

  it("does not exclude an unrelated anonymous_id", () => {
    const rows = [
      row({ anonymous_id: "anon-owner", metadata: { owner_flagged: true } }),
      row({ anonymous_id: "anon-real-visitor" }),
    ];
    const owners = buildKnownOwnerAnonymousIds(rows);

    expect(excludeKnownOwnerRows(rows, owners)).toEqual([
      row({ anonymous_id: "anon-real-visitor" }),
    ]);
  });
});

describe("buildLiveDemoConversionCounts", () => {
  it("counts attempts / successful demos / review reached / CTA clicks / claims saved", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({ event_name: "homepage_demo_extract_attempt" }),
      row({ event_name: "homepage_demo_extract_attempt" }),
      row({ event_name: "homepage_demo_extract_succeeded" }),
      row({ event_name: "demo_review_viewed" }),
      row({ event_name: "demo_account_cta_clicked" }),
      row({ event_name: "demo_claim_saved", user_id: "user-1" }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    expect(counts.attempts).toBe(2);
    expect(counts.successfulDemos).toBe(1);
    expect(counts.reviewReached).toBe(1);
    expect(counts.observedCtaClicks).toBe(1);
    expect(counts.claimsSaved).toBe(1);
    expect(counts.authenticatedUsersWithClaimSaved).toBe(1);
  });

  it("filters rows before sinceMs out of the period", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({
        event_name: "homepage_demo_extract_succeeded",
        occurred_at: "2026-07-01T00:00:00.000Z",
      }),
      row({
        event_name: "homepage_demo_extract_succeeded",
        occurred_at: "2026-08-05T00:00:00.000Z",
      }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    expect(counts.successfulDemos).toBe(1);
  });

  it("never groups null anonymous_id rows into one correlated browser", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({ event_name: "homepage_demo_extract_succeeded", anonymous_id: null }),
      row({ event_name: "homepage_demo_extract_succeeded", anonymous_id: null }),
      row({
        event_name: "homepage_demo_extract_succeeded",
        anonymous_id: "anon-a",
      }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    expect(counts.successfulDemos).toBe(3);
    expect(counts.correlatedSuccessfulDemos).toBe(1);
    expect(counts.uncorrelatedSuccessfulDemos).toBe(2);
  });

  it("counts multiple distinct legitimate anonymous IDs separately", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({
        event_name: "homepage_demo_extract_succeeded",
        anonymous_id: "anon-a",
      }),
      row({
        event_name: "homepage_demo_extract_succeeded",
        anonymous_id: "anon-b",
      }),
      row({
        event_name: "homepage_demo_extract_succeeded",
        anonymous_id: "anon-a",
        occurred_at: "2026-08-03T09:05:00.000Z",
      }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    expect(counts.successfulDemos).toBe(3);
    expect(counts.correlatedSuccessfulDemos).toBe(2);
  });

  it("never computes a rate using observed CTA clicks as numerator or denominator (consent-gap safety)", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({ event_name: "homepage_demo_extract_succeeded" }),
      row({ event_name: "demo_claim_saved", user_id: "user-1" }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    // 0 observed CTA clicks, 1 claim saved -- if a rate were computed as
    // claimsSaved / observedCtaClicks this would be Infinity/undefined.
    // The type has no such field at all; this test locks that contract.
    expect(counts.observedCtaClicks).toBe(0);
    expect(counts.claimsSaved).toBe(1);
    expect(Object.keys(counts)).not.toContain("ctaToClaimRate");
    expect(Object.keys(counts)).not.toContain("ctaToAuthRate");
  });

  it("returns a zero-denominator rate as null, not NaN/Infinity", () => {
    const counts = buildLiveDemoConversionCounts("Today", [], SINCE_MS);

    expect(counts.reviewReachedRate.value).toBeNull();
    expect(counts.claimsSavedRate.value).toBeNull();
    expect(Number.isNaN(counts.reviewReachedRate.value)).toBe(false);
  });

  it("computes review-reached and claims-saved rates only among authoritative milestones", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({ event_name: "homepage_demo_extract_succeeded" }),
      row({
        event_name: "homepage_demo_extract_succeeded",
        anonymous_id: "anon-b",
      }),
      row({ event_name: "demo_review_viewed" }),
      row({ event_name: "demo_claim_saved" }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    expect(counts.reviewReachedRate).toEqual({
      numerator: 1,
      denominator: 2,
      value: 50,
    });
    expect(counts.claimsSavedRate).toEqual({
      numerator: 1,
      denominator: 2,
      value: 50,
    });
  });

  it("a claim replay/idempotent second attempt does not inflate claimsSaved beyond the stored row count (one row = one milestone)", () => {
    // demo_claim_saved is already idempotent per claim at the point of
    // storage (Phase 1C); this aggregation layer just counts stored
    // rows, so it inherits that guarantee without any extra logic here.
    const rows: LiveDemoFunnelEventRow[] = [
      row({ event_name: "demo_claim_saved", user_id: "user-1" }),
    ];
    const counts = buildLiveDemoConversionCounts("Today", rows, SINCE_MS);

    expect(counts.claimsSaved).toBe(1);
  });
});

describe("buildLiveDemoCtaBreakdown", () => {
  it("splits start_free vs log_in vs other/missing", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({
        event_name: "demo_account_cta_clicked",
        metadata: { cta: "start_free" },
      }),
      row({
        event_name: "demo_account_cta_clicked",
        metadata: { cta: "start_free" },
      }),
      row({
        event_name: "demo_account_cta_clicked",
        metadata: { cta: "log_in" },
      }),
      row({ event_name: "demo_account_cta_clicked", metadata: {} }),
    ];
    const breakdown = buildLiveDemoCtaBreakdown(rows, SINCE_MS);

    expect(breakdown).toEqual({ startFree: 2, logIn: 1, other: 1 });
  });

  it("handles duplicate CTA clicks as raw counts (no distinct-funnel dedup here)", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({
        event_name: "demo_account_cta_clicked",
        anonymous_id: "anon-a",
        metadata: { cta: "start_free" },
      }),
      row({
        event_name: "demo_account_cta_clicked",
        anonymous_id: "anon-a",
        metadata: { cta: "start_free" },
      }),
    ];
    const breakdown = buildLiveDemoCtaBreakdown(rows, SINCE_MS);

    expect(breakdown.startFree).toBe(2);
  });
});

describe("buildLiveDemoDuplicateOverrideBreakdown", () => {
  it("splits normal saves from save-anyway (duplicate override) saves", () => {
    const rows: LiveDemoFunnelEventRow[] = [
      row({
        event_name: "demo_claim_saved",
        metadata: { duplicate_override: false },
      }),
      row({
        event_name: "demo_claim_saved",
        metadata: { duplicate_override: true },
      }),
      row({ event_name: "demo_claim_saved", metadata: {} }),
    ];
    const breakdown = buildLiveDemoDuplicateOverrideBreakdown(rows, SINCE_MS);

    // A historical row with no duplicate_override field at all is treated
    // as a normal save (safe default), not dropped or miscounted.
    expect(breakdown).toEqual({ normalSave: 2, saveAnyway: 1 });
  });
});

describe("computeSafeRate", () => {
  it("returns null for a zero denominator", () => {
    expect(computeSafeRate(5, 0)).toEqual({
      numerator: 5,
      denominator: 0,
      value: null,
    });
  });

  it("computes a normal percentage", () => {
    expect(computeSafeRate(1, 4).value).toBe(25);
  });
});

describe("isPossiblyTruncated", () => {
  it("is true when the loaded row count reached the limit", () => {
    expect(isPossiblyTruncated(5000, 5000)).toBe(true);
    expect(isPossiblyTruncated(4999, 5000)).toBe(false);
    expect(isPossiblyTruncated(0, 5000)).toBe(false);
  });
});
