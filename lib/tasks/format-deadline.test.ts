import { describe, expect, it } from "vitest";
import { formatDeadline } from "./format-deadline";

describe("formatDeadline: deadlineDate is a bare YYYY-MM-DD DateOnly", () => {
  it("formats a canonical DateOnly deadlineDate as MM/DD/YY without a day shift", () => {
    // This is the exact forbidden pattern this fix targets: `new
    // Date("2027-01-20")` parses as UTC midnight, and reading local getters
    // on it shifts the displayed day backward by one for any timezone west
    // of UTC. formatDeadline must resolve this via the DateOnly path
    // instead, so the result is stable regardless of machine timezone.
    expect(formatDeadline(null, "2027-01-20")).toBe("01/20/27");
  });

  it("formats a January 1st DateOnly correctly (year-boundary edge case)", () => {
    expect(formatDeadline(null, "2027-01-01")).toBe("01/01/27");
  });

  it("formats a December 31st DateOnly correctly (year-boundary edge case)", () => {
    expect(formatDeadline(null, "2026-12-31")).toBe("12/31/26");
  });

  it("formats a leap-day DateOnly correctly", () => {
    expect(formatDeadline(null, "2028-02-29")).toBe("02/29/28");
  });

  it("ignores deadlineText when a valid deadlineDate is present", () => {
    expect(formatDeadline("some free text", "2027-01-20")).toBe("01/20/27");
  });
});

describe("formatDeadline: deadlineText fallback paths are preserved", () => {
  it("falls back to parsing deadlineText when deadlineDate is absent", () => {
    expect(formatDeadline("2027-01-20", null)).toBe("01/20/27");
  });

  it("falls back to parsing deadlineText when deadlineDate is an empty string", () => {
    expect(formatDeadline("2027-01-20", "")).toBe("01/20/27");
  });

  it("resolves a slash-formatted MM/DD/YYYY deadlineText", () => {
    expect(formatDeadline("01/20/2027", null)).toBe("01/20/27");
  });

  it("resolves a slash-formatted DD/MM/YYYY deadlineText", () => {
    // tryParseSlashDate tries DD/MM/YYYY first for 4-digit years.
    expect(formatDeadline("25/12/2027", null)).toBe("12/25/27");
  });

  it("resolves a natural-language deadlineText via the parseDeadline fallback", () => {
    const result = formatDeadline("2027-06-15", null);
    expect(result).toBe("06/15/27");
  });

  it("falls back to the raw text when nothing can be parsed", () => {
    expect(formatDeadline("no date here at all", null)).toBe("no date here at all");
  });

  it("returns an empty string when both inputs are empty", () => {
    expect(formatDeadline("", null)).toBe("");
    expect(formatDeadline(null, null)).toBe("");
    expect(formatDeadline(undefined, undefined)).toBe("");
  });
});

describe("formatDeadline: legacy full ISO-datetime values still work (non-date-only fallback)", () => {
  it("formats a full ISO datetime deadlineDate (e.g. from a legacy stored value)", () => {
    // Historical rows or other timestamp-shaped inputs must still resolve —
    // only the bare date-only case gets the new, safer code path.
    const result = formatDeadline(null, "2027-01-20T12:00:00.000Z");
    expect(result).toMatch(/^\d{2}\/\d{2}\/27$/);
  });
});

describe("formatDeadline: exact existing MM/DD/YY output format is unchanged", () => {
  it("always zero-pads month/day and uses a two-digit year", () => {
    expect(formatDeadline(null, "2027-03-05")).toBe("03/05/27");
    expect(formatDeadline(null, "2005-03-05")).toBe("03/05/05");
  });
});
