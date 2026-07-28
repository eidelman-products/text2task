import { describe, expect, it } from "vitest";

import { getDeadlineUi } from "./get-deadline-ui";
import { localDateToDateOnly, todayDateOnly } from "./date-only";

function addDaysToDateOnly(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateToDateOnly(d);
}

describe("getDeadlineUi - deadline_date is always read via the safe DateOnly path", () => {
  it("classifies today's date-only deadline_date as due today, not shifted by a day", () => {
    const meta = getDeadlineUi(null, todayDateOnly(), null);

    expect(meta.isDueToday).toBe(true);
    expect(meta.isOverdue).toBe(false);
    expect(meta.daysFromNow).toBe(0);
  });

  it("classifies yesterday's date-only deadline_date as overdue, not today", () => {
    const meta = getDeadlineUi(null, addDaysToDateOnly(-1), null);

    expect(meta.isOverdue).toBe(true);
    expect(meta.isDueToday).toBe(false);
  });

  it("classifies tomorrow's date-only deadline_date as due tomorrow", () => {
    const meta = getDeadlineUi(null, addDaysToDateOnly(1), null);

    expect(meta.isDueTomorrow).toBe(true);
    expect(meta.isOverdue).toBe(false);
  });

  it("falls back safely to null/missing for a malformed deadline_date instead of throwing or misparsing", () => {
    const meta = getDeadlineUi(null, "not-a-date", null);

    expect(meta.isParsed).toBe(false);
  });

  it("resolves a deadline from deadlineText via parseDeadline's DateOnly result when deadline_date is absent", () => {
    const meta = getDeadlineUi("today", null, null);

    expect(meta.isDueToday).toBe(true);
  });

  it("treats an empty deadline as missing, not as a parse failure", () => {
    const meta = getDeadlineUi(null, null, null);

    expect(meta.isMissing).toBe(true);
    expect(meta.isParsed).toBe(false);
  });

  it("marks a Done task as done regardless of how overdue the deadline is", () => {
    const meta = getDeadlineUi(null, addDaysToDateOnly(-30), "Done");

    expect(meta.isDone).toBe(true);
    expect(meta.isOverdue).toBe(false);
  });
});
