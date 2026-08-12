import { describe, expect, it } from "vitest";

import {
  formatShareLinkExpiryForDisplay,
  localDateTimeInputFromUtcIso,
  utcIsoFromLocalDateTimeInput,
} from "./share-link-datetime";

/*
  Timezone-safety strategy: these tests never hardcode an expected UTC
  string for a given local wall-clock value -- doing so would only be
  correct in whatever timezone happened to run the suite. Instead, the
  expected value is derived through the exact same `new Date(y, m, d, h,
  min)` local-time constructor the implementation itself uses, so the
  assertion is correct in every timezone the test runner might have,
  including UTC (the common CI default) and any offset timezone a
  developer's machine might use.
*/

describe("utcIsoFromLocalDateTimeInput", () => {
  it("converts a local datetime-local value to the equivalent UTC ISO timestamp", () => {
    const result = utcIsoFromLocalDateTimeInput("2026-08-20T14:30");
    const expected = new Date(2026, 7, 20, 14, 30, 0, 0).toISOString();
    expect(result).toBe(expected);
  });

  it("round-trips midnight correctly", () => {
    const result = utcIsoFromLocalDateTimeInput("2026-01-01T00:00");
    const expected = new Date(2026, 0, 1, 0, 0, 0, 0).toISOString();
    expect(result).toBe(expected);
  });

  it("handles a December 31 / January 1 local boundary without shifting the calendar day", () => {
    const result = utcIsoFromLocalDateTimeInput("2026-12-31T23:45");
    const expected = new Date(2026, 11, 31, 23, 45, 0, 0).toISOString();
    expect(result).toBe(expected);
    // The result must decode back to the exact same local wall-clock
    // fields it was built from -- proving no silent day/hour shift
    // happened in either direction.
    const decoded = new Date(result as string);
    expect(decoded.getFullYear()).toBe(2026);
    expect(decoded.getMonth()).toBe(11);
    expect(decoded.getDate()).toBe(31);
    expect(decoded.getHours()).toBe(23);
    expect(decoded.getMinutes()).toBe(45);
  });

  it("returns null for an empty value", () => {
    expect(utcIsoFromLocalDateTimeInput("")).toBeNull();
  });

  it.each([
    "2026-08-20",
    "2026-08-20 14:30",
    "not-a-date",
    "2026-08-20T14:30:00",
    "2026-13-01T00:00",
    "2026-08-32T00:00",
  ])("returns null for a malformed or calendar-invalid value %s", (value) => {
    expect(utcIsoFromLocalDateTimeInput(value)).toBeNull();
  });
});

describe("localDateTimeInputFromUtcIso", () => {
  it("formats a UTC ISO timestamp back into the equivalent local datetime-local value", () => {
    const iso = new Date(2026, 7, 20, 14, 30, 0, 0).toISOString();
    expect(localDateTimeInputFromUtcIso(iso)).toBe("2026-08-20T14:30");
  });

  it("round-trips through utcIsoFromLocalDateTimeInput exactly", () => {
    const original = "2026-03-05T09:15";
    const iso = utcIsoFromLocalDateTimeInput(original);
    expect(localDateTimeInputFromUtcIso(iso)).toBe(original);
  });

  it("returns an empty string for null", () => {
    expect(localDateTimeInputFromUtcIso(null)).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(localDateTimeInputFromUtcIso("not-a-timestamp")).toBe("");
  });
});

describe("formatShareLinkExpiryForDisplay", () => {
  it("returns a non-empty human-readable string for a valid timestamp", () => {
    const iso = new Date(2026, 7, 20, 14, 30, 0, 0).toISOString();
    const result = formatShareLinkExpiryForDisplay(iso);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe(iso);
  });

  it("returns an empty string for null", () => {
    expect(formatShareLinkExpiryForDisplay(null)).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatShareLinkExpiryForDisplay("not-a-timestamp")).toBe("");
  });
});
