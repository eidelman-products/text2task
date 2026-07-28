import { describe, expect, it } from "vitest";
import {
  compareDateOnly,
  dateOnlyToLocalDate,
  formatDateOnlyForA11y,
  formatDateOnlyForDisplay,
  isDateOnly,
  localDateToDateOnly,
  parseDateOnly,
  todayDateOnly,
  type DateOnly,
} from "./date-only";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

describe("parseDateOnly", () => {
  it("returns null for non-string input without throwing", () => {
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(123)).toBeNull();
    expect(parseDateOnly({})).toBeNull();
    expect(parseDateOnly([])).toBeNull();
    expect(parseDateOnly(true)).toBeNull();
  });

  it("returns null for empty/blank strings", () => {
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly("   ")).toBeNull();
  });

  it("accepts a valid YYYY-MM-DD date", () => {
    expect(parseDateOnly("2027-01-20")).toBe("2027-01-20");
  });

  it("rejects wrong shapes", () => {
    expect(parseDateOnly("2027-1-20")).toBeNull();
    expect(parseDateOnly("27-01-20")).toBeNull();
    expect(parseDateOnly("2027/01/20")).toBeNull();
    expect(parseDateOnly("2027-01-20T00:00:00.000Z")).toBeNull();
    expect(parseDateOnly("2027-01-20 ")).toBeNull();
    expect(parseDateOnly(" 2027-01-20")).toBeNull();
    expect(parseDateOnly("not-a-date")).toBeNull();
  });

  it("accepts a leap-year Feb 29 (2028)", () => {
    expect(parseDateOnly("2028-02-29")).toBe("2028-02-29");
  });

  it("rejects a non-leap-year Feb 29 (2027)", () => {
    expect(parseDateOnly("2027-02-29")).toBeNull();
  });

  it("rejects month 13", () => {
    expect(parseDateOnly("2027-13-01")).toBeNull();
  });

  it("rejects day 32", () => {
    expect(parseDateOnly("2027-01-32")).toBeNull();
  });

  it("rejects April 31 (April only has 30 days)", () => {
    expect(parseDateOnly("2027-04-31")).toBeNull();
  });

  it("rejects month 00 and day 00", () => {
    expect(parseDateOnly("2027-00-15")).toBeNull();
    expect(parseDateOnly("2027-05-00")).toBeNull();
  });
});

describe("isDateOnly", () => {
  it("mirrors parseDateOnly's validation as a predicate", () => {
    expect(isDateOnly("2027-01-20")).toBe(true);
    expect(isDateOnly("2027-02-29")).toBe(false);
    expect(isDateOnly(null)).toBe(false);
    expect(isDateOnly(42)).toBe(false);
  });
});

describe("dateOnlyToLocalDate / localDateToDateOnly round trip", () => {
  const fixtures = [
    "2027-01-20",
    "2027-01-01",
    "2027-12-31",
    "2026-02-28",
    "2028-02-29", // leap day
    "2000-01-01",
    "1999-12-31",
    "2099-12-31", // far future
    "2100-01-01",
  ];

  for (const fixture of fixtures) {
    it(`round-trips ${fixture} through dateOnlyToLocalDate -> localDateToDateOnly`, () => {
      const dateOnly = toDateOnly(fixture);
      const localDate = dateOnlyToLocalDate(dateOnly);
      const roundTripped = localDateToDateOnly(localDate);

      expect(roundTripped).toBe(fixture);
    });
  }

  it("dateOnlyToLocalDate builds a Date whose LOCAL components match the input", () => {
    const dateOnly = toDateOnly("2027-01-20");
    const localDate = dateOnlyToLocalDate(dateOnly);

    expect(localDate.getFullYear()).toBe(2027);
    expect(localDate.getMonth()).toBe(0); // January is month index 0
    expect(localDate.getDate()).toBe(20);
    expect(localDate.getHours()).toBe(12); // anchored at local noon
  });

  it("localDateToDateOnly reads local getters, not UTC", () => {
    // Construct a Date purely via local-time setters (no string parsing),
    // matching how a calendar UI would report a selected day.
    const localDate = new Date(2026, 6, 4, 12, 0, 0, 0); // July 4, 2026 local noon
    expect(localDateToDateOnly(localDate)).toBe("2026-07-04");
  });
});

describe("todayDateOnly", () => {
  it("returns a validated YYYY-MM-DD string matching the local calendar day", () => {
    const today = todayDateOnly();

    expect(isDateOnly(today)).toBe(true);

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    expect(today).toBe(expected);
  });
});

describe("compareDateOnly", () => {
  it("orders earlier dates before later dates", () => {
    const a = toDateOnly("2027-01-20");
    const b = toDateOnly("2027-01-21");

    expect(compareDateOnly(a, b)).toBeLessThan(0);
    expect(compareDateOnly(b, a)).toBeGreaterThan(0);
  });

  it("returns 0 for equal dates", () => {
    const a = toDateOnly("2027-01-20");
    const b = toDateOnly("2027-01-20");

    expect(compareDateOnly(a, b)).toBe(0);
  });

  it("orders correctly across a year boundary", () => {
    const a = toDateOnly("2027-12-31");
    const b = toDateOnly("2028-01-01");

    expect(compareDateOnly(a, b)).toBeLessThan(0);
  });

  it("sorts a mixed list into chronological order", () => {
    const values = [
      "2027-06-15",
      "2026-01-01",
      "2027-01-01",
      "2027-01-20",
      "2028-02-29",
    ].map(toDateOnly);

    const sorted = [...values].sort(compareDateOnly);

    expect(sorted).toEqual([
      "2026-01-01",
      "2027-01-01",
      "2027-01-20",
      "2027-06-15",
      "2028-02-29",
    ]);
  });
});

describe("formatDateOnlyForDisplay", () => {
  it("formats known fixture dates as short unambiguous English", () => {
    expect(formatDateOnlyForDisplay(toDateOnly("2027-01-20"))).toBe("Jan 20, 2027");
    expect(formatDateOnlyForDisplay(toDateOnly("2027-12-01"))).toBe("Dec 1, 2027");
    expect(formatDateOnlyForDisplay(toDateOnly("2028-02-29"))).toBe("Feb 29, 2028");
  });
});

describe("formatDateOnlyForA11y", () => {
  it("formats known fixture dates as full unambiguous English", () => {
    expect(formatDateOnlyForA11y(toDateOnly("2027-01-20"))).toBe("January 20, 2027");
    expect(formatDateOnlyForA11y(toDateOnly("2027-12-01"))).toBe("December 1, 2027");
    expect(formatDateOnlyForA11y(toDateOnly("2028-02-29"))).toBe("February 29, 2028");
  });
});
