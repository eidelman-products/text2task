import { describe, expect, it } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import {
  addMonthsClamped,
  formatMonthYearForDisplay,
  getNextMonthDate,
  getPreviousMonthDate,
  isSameMonth,
} from "./calendar-month-navigation";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

describe("getPreviousMonthDate / getNextMonthDate", () => {
  it("moves back and forward one month, preserving day-of-month when it exists", () => {
    expect(getPreviousMonthDate(toDateOnly("2027-06-15"))).toBe("2027-05-15");
    expect(getNextMonthDate(toDateOnly("2027-06-15"))).toBe("2027-07-15");
  });

  it("December -> January and January -> December cross the year boundary correctly", () => {
    expect(getNextMonthDate(toDateOnly("2027-12-15"))).toBe("2028-01-15");
    expect(getPreviousMonthDate(toDateOnly("2028-01-15"))).toBe("2027-12-15");
  });

  it("clamps day 31 into a shorter destination month", () => {
    expect(getNextMonthDate(toDateOnly("2027-01-31"))).toBe("2027-02-28");
    expect(getNextMonthDate(toDateOnly("2027-03-31"))).toBe("2027-04-30");
  });

  it("clamps Jan 31 forward into a leap February (29 days)", () => {
    expect(getNextMonthDate(toDateOnly("2028-01-31"))).toBe("2028-02-29");
  });

  it("clamps Jan 31 forward into a non-leap February (28 days)", () => {
    expect(getNextMonthDate(toDateOnly("2027-01-31"))).toBe("2027-02-28");
  });

  it("clamps day 30 backward from March into a non-leap February", () => {
    expect(getPreviousMonthDate(toDateOnly("2027-03-30"))).toBe("2027-02-28");
  });

  it("does not clamp when moving from a leap February into March (day 29 -> 29)", () => {
    expect(getNextMonthDate(toDateOnly("2028-02-29"))).toBe("2028-03-29");
  });

  it("repeated navigation is reversible for a mid-month day (no drift)", () => {
    const start = toDateOnly("2027-06-15");
    expect(getPreviousMonthDate(getNextMonthDate(start))).toBe(start);
    expect(getNextMonthDate(getPreviousMonthDate(start))).toBe(start);
  });
});

describe("addMonthsClamped", () => {
  it("supports a zero delta (no-op)", () => {
    expect(addMonthsClamped(toDateOnly("2027-06-15"), 0)).toBe("2027-06-15");
  });

  it("supports a multi-month delta in both directions", () => {
    expect(addMonthsClamped(toDateOnly("2027-01-15"), 6)).toBe("2027-07-15");
    expect(addMonthsClamped(toDateOnly("2027-07-15"), -6)).toBe("2027-01-15");
  });

  it("supports a delta that crosses multiple years", () => {
    expect(addMonthsClamped(toDateOnly("2027-06-15"), 18)).toBe("2028-12-15");
  });
});

describe("isSameMonth", () => {
  it("true for two different days in the same month", () => {
    expect(isSameMonth(toDateOnly("2027-06-01"), toDateOnly("2027-06-30"))).toBe(true);
  });

  it("false for the same day-of-month in a different month", () => {
    expect(isSameMonth(toDateOnly("2027-06-15"), toDateOnly("2027-07-15"))).toBe(false);
  });

  it("false across a year boundary even for the same month number", () => {
    expect(isSameMonth(toDateOnly("2027-12-01"), toDateOnly("2028-12-01"))).toBe(false);
  });
});

describe("formatMonthYearForDisplay", () => {
  it("formats the full month name and year", () => {
    expect(formatMonthYearForDisplay(toDateOnly("2026-07-16"))).toBe("July 2026");
    expect(formatMonthYearForDisplay(toDateOnly("2027-01-01"))).toBe("January 2027");
    expect(formatMonthYearForDisplay(toDateOnly("2027-12-31"))).toBe("December 2027");
  });
});
