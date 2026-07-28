import { describe, expect, it } from "vitest";
import {
  formatTimeOnlyForDisplay,
  isTimeOnly,
  normalizeDatabaseTimeOnly,
  parseTimeOnly,
  type TimeOnly,
} from "./time-only";

function toTimeOnly(value: string): TimeOnly {
  const parsed = parseTimeOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid TimeOnly`);
  return parsed;
}

describe("parseTimeOnly", () => {
  it("returns null for non-string input without throwing", () => {
    expect(parseTimeOnly(undefined)).toBeNull();
    expect(parseTimeOnly(null)).toBeNull();
    expect(parseTimeOnly(123)).toBeNull();
    expect(parseTimeOnly({})).toBeNull();
    expect(parseTimeOnly([])).toBeNull();
    expect(parseTimeOnly(true)).toBeNull();
  });

  it("returns null for empty/blank strings", () => {
    expect(parseTimeOnly("")).toBeNull();
    expect(parseTimeOnly("   ")).toBeNull();
  });

  it("accepts valid zero-padded HH:MM values across the full day", () => {
    expect(parseTimeOnly("00:00")).toBe("00:00");
    expect(parseTimeOnly("09:05")).toBe("09:05");
    expect(parseTimeOnly("14:30")).toBe("14:30");
    expect(parseTimeOnly("23:59")).toBe("23:59");
  });

  it("rejects missing zero-padding", () => {
    expect(parseTimeOnly("9:05")).toBeNull();
    expect(parseTimeOnly("9:5")).toBeNull();
    expect(parseTimeOnly("09:5")).toBeNull();
  });

  it("rejects seconds in user/API input", () => {
    expect(parseTimeOnly("14:30:00")).toBeNull();
    expect(parseTimeOnly("14:30:45")).toBeNull();
  });

  it("rejects hour 24 and negative/out-of-range components", () => {
    expect(parseTimeOnly("24:00")).toBeNull();
    expect(parseTimeOnly("25:00")).toBeNull();
    expect(parseTimeOnly("-1:00")).toBeNull();
  });

  it("rejects minute 60 and above", () => {
    expect(parseTimeOnly("12:60")).toBeNull();
    expect(parseTimeOnly("12:99")).toBeNull();
  });

  it("rejects 12-hour/AM-PM forms and other wrong shapes", () => {
    expect(parseTimeOnly("2:30 PM")).toBeNull();
    expect(parseTimeOnly("2:30PM")).toBeNull();
    expect(parseTimeOnly("14.30")).toBeNull();
    expect(parseTimeOnly("1430")).toBeNull();
    expect(parseTimeOnly(" 14:30")).toBeNull();
    expect(parseTimeOnly("14:30 ")).toBeNull();
    expect(parseTimeOnly("not-a-time")).toBeNull();
  });
});

describe("isTimeOnly", () => {
  it("mirrors parseTimeOnly's validation as a predicate", () => {
    expect(isTimeOnly("14:30")).toBe(true);
    expect(isTimeOnly("14:30:00")).toBe(false);
    expect(isTimeOnly(null)).toBe(false);
    expect(isTimeOnly(42)).toBe(false);
  });
});

describe("normalizeDatabaseTimeOnly", () => {
  it("accepts the exact Postgres time-without-time-zone shape with zero seconds", () => {
    expect(normalizeDatabaseTimeOnly("14:30:00")).toBe("14:30");
    expect(normalizeDatabaseTimeOnly("00:00:00")).toBe("00:00");
    expect(normalizeDatabaseTimeOnly("23:59:00")).toBe("23:59");
  });

  it("accepts a zero-seconds value with a fractional-seconds suffix", () => {
    expect(normalizeDatabaseTimeOnly("14:30:00.000000")).toBe("14:30");
  });

  it("rejects a non-zero seconds component rather than silently truncating it", () => {
    expect(normalizeDatabaseTimeOnly("14:30:45")).toBeNull();
    expect(normalizeDatabaseTimeOnly("14:30:01")).toBeNull();
  });

  it("rejects a bare HH:MM value (this normalizer is for the DB shape specifically)", () => {
    expect(normalizeDatabaseTimeOnly("14:30")).toBeNull();
  });

  it("returns null for non-string/malformed input without throwing", () => {
    expect(normalizeDatabaseTimeOnly(null)).toBeNull();
    expect(normalizeDatabaseTimeOnly(undefined)).toBeNull();
    expect(normalizeDatabaseTimeOnly(123)).toBeNull();
    expect(normalizeDatabaseTimeOnly("not-a-time")).toBeNull();
  });
});

describe("formatTimeOnlyForDisplay", () => {
  it("formats midnight and noon correctly", () => {
    expect(formatTimeOnlyForDisplay(toTimeOnly("00:00"))).toBe("12:00 AM");
    expect(formatTimeOnlyForDisplay(toTimeOnly("12:00"))).toBe("12:00 PM");
  });

  it("formats morning and afternoon times with correct AM/PM", () => {
    expect(formatTimeOnlyForDisplay(toTimeOnly("09:05"))).toBe("9:05 AM");
    expect(formatTimeOnlyForDisplay(toTimeOnly("14:30"))).toBe("2:30 PM");
    expect(formatTimeOnlyForDisplay(toTimeOnly("23:59"))).toBe("11:59 PM");
  });

  it("throws for a malformed value (should be unreachable given the branded type)", () => {
    expect(() =>
      formatTimeOnlyForDisplay("not-a-time" as unknown as TimeOnly)
    ).toThrow();
  });
});
