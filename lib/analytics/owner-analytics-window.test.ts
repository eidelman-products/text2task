import { describe, expect, it } from "vitest";

import {
  buildAdminAnalyticsPeriodWindows,
  DAY_MS,
  getStartOfOwnerAnalyticsDay,
  OWNER_ANALYTICS_TIME_ZONE,
} from "./owner-analytics-window";

function getOwnerTimeZoneClockParts(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OWNER_ANALYTICS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));

  return {
    hour: parts.find((part) => part.type === "hour")?.value,
    minute: parts.find((part) => part.type === "minute")?.value,
    second: parts.find((part) => part.type === "second")?.value,
  };
}

describe("getStartOfOwnerAnalyticsDay", () => {
  it("returns a timestamp that is exactly local midnight in the owner time zone (Israeli Daylight Time, July)", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);
    const startOfTodayMs = getStartOfOwnerAnalyticsDay(nowMs);

    expect(getOwnerTimeZoneClockParts(startOfTodayMs)).toEqual({
      hour: "00",
      minute: "00",
      second: "00",
    });
  });

  it("returns a timestamp that is exactly local midnight in the owner time zone (Israel Standard Time, January)", () => {
    const nowMs = Date.UTC(2026, 0, 15, 10, 30, 0);
    const startOfTodayMs = getStartOfOwnerAnalyticsDay(nowMs);

    expect(getOwnerTimeZoneClockParts(startOfTodayMs)).toEqual({
      hour: "00",
      minute: "00",
      second: "00",
    });
  });

  it("never returns a timestamp in the future relative to the input", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);

    expect(getStartOfOwnerAnalyticsDay(nowMs)).toBeLessThanOrEqual(nowMs);
  });

  it("returns a timestamp within the same 24-hour span as the input", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);

    expect(nowMs - getStartOfOwnerAnalyticsDay(nowMs)).toBeLessThan(DAY_MS);
  });

  it("is deterministic for a fixed input (reads no clock of its own)", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);

    expect(getStartOfOwnerAnalyticsDay(nowMs)).toBe(
      getStartOfOwnerAnalyticsDay(nowMs)
    );
  });
});

describe("buildAdminAnalyticsPeriodWindows", () => {
  it("derives sevenDaysAgoMs and thirtyDaysAgoMs directly from the given nowMs", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);
    const windows = buildAdminAnalyticsPeriodWindows(nowMs);

    expect(windows.sevenDaysAgoMs).toBe(nowMs - 7 * DAY_MS);
    expect(windows.thirtyDaysAgoMs).toBe(nowMs - 30 * DAY_MS);
  });

  it("derives startOfTodayMs using the same calculation as getStartOfOwnerAnalyticsDay", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);
    const windows = buildAdminAnalyticsPeriodWindows(nowMs);

    expect(windows.startOfTodayMs).toBe(getStartOfOwnerAnalyticsDay(nowMs));
  });

  it("is deterministic and side-effect free: two calls with the same nowMs produce identical windows", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);

    expect(buildAdminAnalyticsPeriodWindows(nowMs)).toEqual(
      buildAdminAnalyticsPeriodWindows(nowMs)
    );
  });

  it("every query/period boundary in one call shares the exact same captured nowMs (no per-field clock drift)", () => {
    const nowMs = Date.UTC(2026, 6, 15, 10, 30, 0);
    const windows = buildAdminAnalyticsPeriodWindows(nowMs);

    // thirtyDaysAgoMs is used both as the Supabase query lower bound and as
    // the "Last 30 days" in-memory filter boundary -- they must be the
    // exact same value, not two independently-computed timestamps.
    expect(windows.thirtyDaysAgoMs).toBe(nowMs - 30 * DAY_MS);
    expect(windows.sevenDaysAgoMs).toBeGreaterThan(windows.thirtyDaysAgoMs);
    expect(windows.startOfTodayMs).toBeGreaterThanOrEqual(
      windows.sevenDaysAgoMs
    );
  });
});
