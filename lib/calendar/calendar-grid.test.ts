import { describe, expect, it } from "vitest";
import { compareDateOnly, parseDateOnly, todayDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { getCalendarGridDays, getCalendarGridRange } from "./calendar-grid";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

describe("getCalendarGridRange / getCalendarGridDays -- weekday-start coverage", () => {
  // One fixture per possible first-of-month weekday, computed independently
  // against a real Gregorian calendar (not derived from this module).
  const fixtures: Array<{
    label: string;
    anyDayInMonth: string;
    start: string;
    end: string;
    rows: number;
  }> = [
    // Nov 2026: 1st is a Sunday.
    { label: "Sunday-start month", anyDayInMonth: "2026-11-15", start: "2026-11-01", end: "2026-12-05", rows: 5 },
    // Feb 2027: 1st is a Monday.
    { label: "Monday-start month", anyDayInMonth: "2027-02-10", start: "2027-01-31", end: "2027-03-06", rows: 5 },
    // Sep 2026: 1st is a Tuesday.
    { label: "Tuesday-start month", anyDayInMonth: "2026-09-01", start: "2026-08-30", end: "2026-10-03", rows: 5 },
    // Apr 2026: 1st is a Wednesday.
    { label: "Wednesday-start month", anyDayInMonth: "2026-04-30", start: "2026-03-29", end: "2026-05-02", rows: 5 },
    // Jan 2026: 1st is a Thursday.
    { label: "Thursday-start month", anyDayInMonth: "2026-01-01", start: "2025-12-28", end: "2026-01-31", rows: 5 },
    // May 2026: 1st is a Friday (6-row month).
    { label: "Friday-start month", anyDayInMonth: "2026-05-20", start: "2026-04-26", end: "2026-06-06", rows: 6 },
    // Aug 2026: 1st is a Saturday (6-row month).
    { label: "Saturday-start month", anyDayInMonth: "2026-08-01", start: "2026-07-26", end: "2026-09-05", rows: 6 },
  ];

  for (const fixture of fixtures) {
    it(`${fixture.label} (any day within month: ${fixture.anyDayInMonth})`, () => {
      const range = getCalendarGridRange(toDateOnly(fixture.anyDayInMonth));
      expect(range.start).toBe(fixture.start);
      expect(range.end).toBe(fixture.end);

      const days = getCalendarGridDays(toDateOnly(fixture.anyDayInMonth));
      expect(days.length).toBe(fixture.rows * 7);
      expect(days[0]).toBe(fixture.start);
      expect(days[days.length - 1]).toBe(fixture.end);
    });
  }
});

describe("getCalendarGridRange / getCalendarGridDays -- row-count edge cases", () => {
  it("computes a genuine 5-row grid (not hardcoded 6) -- Jul 2026", () => {
    const range = getCalendarGridRange(toDateOnly("2026-07-15"));
    const days = getCalendarGridDays(toDateOnly("2026-07-15"));

    expect(range).toEqual({ start: "2026-06-28", end: "2026-08-01" });
    expect(days.length).toBe(35);
  });

  it("computes a genuine 6-row grid -- May 2026", () => {
    const range = getCalendarGridRange(toDateOnly("2026-05-01"));
    const days = getCalendarGridDays(toDateOnly("2026-05-01"));

    expect(range).toEqual({ start: "2026-04-26", end: "2026-06-06" });
    expect(days.length).toBe(42);
  });

  it("computes a 4-row grid when the month starts on Sunday and has exactly 4 weeks -- Feb 2026", () => {
    const range = getCalendarGridRange(toDateOnly("2026-02-14"));
    const days = getCalendarGridDays(toDateOnly("2026-02-14"));

    expect(range).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(days.length).toBe(28);
  });
});

describe("getCalendarGridRange / getCalendarGridDays -- leap vs. non-leap February", () => {
  it("handles leap-year February (2028) correctly, including Feb 29", () => {
    const range = getCalendarGridRange(toDateOnly("2028-02-01"));
    const days = getCalendarGridDays(toDateOnly("2028-02-01"));

    expect(range).toEqual({ start: "2028-01-30", end: "2028-03-04" });
    expect(days).toContain("2028-02-29");
    expect(days.length).toBe(35);
  });

  it("handles non-leap-year February (2027) correctly, with no Feb 29", () => {
    const range = getCalendarGridRange(toDateOnly("2027-02-01"));
    const days = getCalendarGridDays(toDateOnly("2027-02-01"));

    expect(range).toEqual({ start: "2027-01-31", end: "2027-03-06" });
    expect(days).not.toContain("2027-02-29");
    expect(days.length).toBe(35);
  });
});

describe("getCalendarGridRange / getCalendarGridDays -- year boundary", () => {
  it("rolls a December grid forward into January of the next year", () => {
    const range = getCalendarGridRange(toDateOnly("2026-12-25"));
    const days = getCalendarGridDays(toDateOnly("2026-12-25"));

    expect(range).toEqual({ start: "2026-11-29", end: "2027-01-02" });
    expect(days).toContain("2026-12-31");
    expect(days).toContain("2027-01-01");
    expect(days).toContain("2027-01-02");
  });

  it("rolls a January grid backward into December of the previous year", () => {
    const range = getCalendarGridRange(toDateOnly("2026-01-15"));

    expect(range).toEqual({ start: "2025-12-28", end: "2026-01-31" });
  });
});

describe("getCalendarGridRange / getCalendarGridDays -- month navigation", () => {
  it("produces the correct adjacent grids when navigating to the previous and next month from Jul 2026", () => {
    const current = getCalendarGridRange(toDateOnly("2026-07-15"));
    const previous = getCalendarGridRange(toDateOnly("2026-06-15"));
    const next = getCalendarGridRange(toDateOnly("2026-08-15"));

    expect(current).toEqual({ start: "2026-06-28", end: "2026-08-01" });
    expect(previous).toEqual({ start: "2026-05-31", end: "2026-07-04" });
    expect(next).toEqual({ start: "2026-07-26", end: "2026-09-05" });

    // Sanity check: each month's grid genuinely moves forward in time.
    expect(compareDateOnly(previous.start, current.start)).toBeLessThan(0);
    expect(compareDateOnly(current.start, next.start)).toBeLessThan(0);
  });

  it("is insensitive to which day within the month is passed in", () => {
    const first = getCalendarGridRange(toDateOnly("2026-07-01"));
    const middle = getCalendarGridRange(toDateOnly("2026-07-15"));
    const last = getCalendarGridRange(toDateOnly("2026-07-31"));

    expect(first).toEqual(middle);
    expect(middle).toEqual(last);
  });
});

describe("getCalendarGridRange / getCalendarGridDays -- today", () => {
  it("produces a valid grid containing today, bounded by full weeks", () => {
    const today = todayDateOnly();
    const range = getCalendarGridRange(today);
    const days = getCalendarGridDays(today);

    expect(days.length % 7).toBe(0);
    expect([28, 35, 42]).toContain(days.length);
    expect(days).toContain(today);
    expect(compareDateOnly(range.start, today)).toBeLessThanOrEqual(0);
    expect(compareDateOnly(today, range.end)).toBeLessThanOrEqual(0);

    // Grid start must be a Sunday and grid end a Saturday under this
    // module's documented Sunday-start convention.
    const startDate = new Date(
      Number(range.start.slice(0, 4)),
      Number(range.start.slice(5, 7)) - 1,
      Number(range.start.slice(8, 10)),
      12
    );
    const endDate = new Date(
      Number(range.end.slice(0, 4)),
      Number(range.end.slice(5, 7)) - 1,
      Number(range.end.slice(8, 10)),
      12
    );
    expect(startDate.getDay()).toBe(0);
    expect(endDate.getDay()).toBe(6);
  });
});

describe("getCalendarGridDays -- chronological ordering", () => {
  it("returns days in strictly ascending chronological order with no gaps", () => {
    const days = getCalendarGridDays(toDateOnly("2026-05-01"));

    for (let i = 1; i < days.length; i++) {
      expect(compareDateOnly(days[i - 1], days[i])).toBeLessThan(0);
    }
  });
});
