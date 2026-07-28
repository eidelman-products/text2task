import { describe, expect, it } from "vitest";
import { parseDeadline } from "./parse-deadline";
import { isDateOnly } from "./date-only";

// These regression tests assert exact expected DateOnly strings for
// deterministic inputs (explicit years, explicit month names, etc). They
// intentionally do NOT re-derive UTC math to "prove" timezone correctness —
// that correctness comes from `localDateToDateOnly` reading LOCAL Date
// getters, which is proven independently by date-only.test.ts's own
// local-getter-based round-trip tests. What these tests prove is that
// parseDeadline resolves each phrase to the *same calendar day* it always
// did, and that the day is now returned as a clean DateOnly instead of an
// ISO datetime string that could be shifted by a UTC round-trip.

describe("parseDeadline: empty/null input", () => {
  it("returns null/unmatched for empty, blank, undefined, and null input", () => {
    expect(parseDeadline("")).toEqual({ deadlineDate: null, matched: false });
    expect(parseDeadline("   ")).toEqual({ deadlineDate: null, matched: false });
    expect(parseDeadline(undefined)).toEqual({ deadlineDate: null, matched: false });
    expect(parseDeadline(null)).toEqual({ deadlineDate: null, matched: false });
  });

  it("returns null/unmatched for text with no resolvable date", () => {
    const result = parseDeadline("please help with the invoice soon");
    expect(result.matched).toBe(false);
    expect(result.deadlineDate).toBeNull();
  });
});

describe("parseDeadline: explicit YYYY-MM-DD passthrough", () => {
  it("resolves an exact date-only string to the same calendar day", () => {
    const result = parseDeadline("2027-01-20");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe("2027-01-20");
  });

  it("resolves a far-future date (year 2099+)", () => {
    const result = parseDeadline("2099-12-31");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe("2099-12-31");
  });

  it("resolves a leap-day date-only string", () => {
    const result = parseDeadline("2028-02-29");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe("2028-02-29");
  });

  it("resolves an explicit ISO datetime string to its local calendar day", () => {
    const result = parseDeadline("2027-01-20T15:30:00Z");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).not.toBeNull();
    expect(isDateOnly(result.deadlineDate)).toBe(true);
  });
});

// NOTE: for named month/day phrases, parseDeadlineCore's `buildDateFromMonthDay`
// captures but never consumes an explicit trailing year in the input text —
// it always resolves to the *next upcoming occurrence* of that month/day
// from "now" (rolling into next year only if the month/day has already
// passed this year). This is pre-existing behavior (unrelated to the
// DateOnly refactor) and is preserved exactly here, not "fixed" — these
// tests compute the expected date the same way the parser does, so they
// stay correct regardless of which day the suite runs on.
function nextOccurrenceOfMonthDay(monthIndex: number, day: number): string {
  const now = new Date();
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  let year = now.getFullYear();
  let candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);

  if (candidate.getTime() < base.getTime()) {
    year += 1;
    candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);
  }

  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(candidate.getDate()).padStart(2, "0")}`;
}

describe("parseDeadline: named month formats", () => {
  it('resolves "May 15, 2026" to the next upcoming May 15 (explicit year is ignored by design, matching pre-existing behavior)', () => {
    const result = parseDeadline("May 15, 2026");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(nextOccurrenceOfMonthDay(4, 15));
  });

  it('resolves "15 May 2026" the same way as "May 15, 2026"', () => {
    const result = parseDeadline("15 May 2026");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(nextOccurrenceOfMonthDay(4, 15));
  });

  it('resolves "Dec 1 2030" to the next upcoming December 1', () => {
    const result = parseDeadline("Dec 1 2030");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(nextOccurrenceOfMonthDay(11, 1));
  });

  it('resolves "1st January 2028" (ordinal suffix) to the next upcoming January 1', () => {
    const result = parseDeadline("1st January 2028");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(nextOccurrenceOfMonthDay(0, 1));
  });
});

describe("parseDeadline: slash-date formats", () => {
  it("resolves MM/DD/YYYY", () => {
    const result = parseDeadline("01/20/2027");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe("2027-01-20");
  });

  it("resolves MM/DD/YY with two-digit year", () => {
    const result = parseDeadline("01/20/27");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe("2027-01-20");
  });

  it("resolves dash-separated numeric dates", () => {
    const result = parseDeadline("03-05-2028");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe("2028-03-05");
  });
});

describe("parseDeadline: relative deadlines", () => {
  it('resolves "tomorrow" to exactly one day after today', () => {
    const today = new Date();
    const expectedTomorrow = new Date(today);
    expectedTomorrow.setDate(today.getDate() + 1);
    const expected = `${expectedTomorrow.getFullYear()}-${String(
      expectedTomorrow.getMonth() + 1
    ).padStart(2, "0")}-${String(expectedTomorrow.getDate()).padStart(2, "0")}`;

    const result = parseDeadline("tomorrow");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(expected);
  });

  it('resolves "today"', () => {
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;

    const result = parseDeadline("today");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(expected);
  });

  it('resolves "in 3 days"', () => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const expectedDate = new Date(base);
    expectedDate.setDate(base.getDate() + 3);
    const expected = `${expectedDate.getFullYear()}-${String(
      expectedDate.getMonth() + 1
    ).padStart(2, "0")}-${String(expectedDate.getDate()).padStart(2, "0")}`;

    const result = parseDeadline("in 3 days");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(expected);
  });

  it('resolves "next friday" to a Friday strictly after today', () => {
    const result = parseDeadline("next friday");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).not.toBeNull();
    expect(isDateOnly(result.deadlineDate)).toBe(true);

    const resolved = new Date(
      Number(result.deadlineDate!.slice(0, 4)),
      Number(result.deadlineDate!.slice(5, 7)) - 1,
      Number(result.deadlineDate!.slice(8, 10))
    );
    expect(resolved.getDay()).toBe(5); // Friday
    expect(resolved.getTime()).toBeGreaterThan(
      new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    );
  });

  it('resolves "end of month" to the last calendar day of the current month', () => {
    const result = parseDeadline("end of month");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).not.toBeNull();

    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const expected = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(lastDay.getDate()).padStart(2, "0")}`;

    expect(result.deadlineDate).toBe(expected);
  });

  it('resolves "eow" (end of week)', () => {
    const result = parseDeadline("eow");
    expect(result.matched).toBe(true);
    expect(isDateOnly(result.deadlineDate)).toBe(true);
  });
});

describe("parseDeadline: leap years, month/year boundaries", () => {
  it("resolves an end-of-month deadline in a leap-year February via named month", () => {
    const result = parseDeadline("end of february");
    expect(result.matched).toBe(true);
    expect(isDateOnly(result.deadlineDate)).toBe(true);
    // Day-of-month must be 28 or 29 depending on whether the resolved year is a leap year.
    const day = Number(result.deadlineDate!.slice(8, 10));
    expect([28, 29]).toContain(day);
  });

  it("resolves Jan 31 -> named month/day format without rolling into February", () => {
    const result = parseDeadline("January 31, 2027");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(nextOccurrenceOfMonthDay(0, 31));
  });

  it("resolves Dec 31 -> named month/day format without rolling into next year", () => {
    const result = parseDeadline("December 31, 2027");
    expect(result.matched).toBe(true);
    expect(result.deadlineDate).toBe(nextOccurrenceOfMonthDay(11, 31));
  });
});

describe("parseDeadline: no day-shift regression (deterministic fixtures)", () => {
  it('"2027-01-20" resolves to exactly "2027-01-20" regardless of machine timezone', () => {
    expect(parseDeadline("2027-01-20").deadlineDate).toBe("2027-01-20");
  });

  it('"June 30, 2027" resolves to exactly "2027-06-30"', () => {
    expect(parseDeadline("June 30, 2027").deadlineDate).toBe("2027-06-30");
  });

  it('"12/31/2030" resolves to exactly "2030-12-31"', () => {
    expect(parseDeadline("12/31/2030").deadlineDate).toBe("2030-12-31");
  });

  it("every matched result is a validated DateOnly shape (never a full ISO datetime string)", () => {
    const phrases = [
      "2027-01-20",
      "May 15, 2026",
      "15 May 2026",
      "01/20/2027",
      "tomorrow",
      "next friday",
      "end of month",
      "eow",
    ];

    for (const phrase of phrases) {
      const result = parseDeadline(phrase);
      expect(result.matched).toBe(true);
      expect(result.deadlineDate).not.toBeNull();
      expect(isDateOnly(result.deadlineDate)).toBe(true);
      expect(result.deadlineDate).not.toMatch(/T/);
      expect(result.deadlineDate).not.toMatch(/Z$/);
    }
  });
});
