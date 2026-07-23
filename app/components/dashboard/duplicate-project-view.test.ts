import { describe, expect, it } from "vitest";

import {
  DUPLICATE_PROJECT_AMOUNT_FALLBACK_TEXT,
  DUPLICATE_PROJECT_DEADLINE_FALLBACK_TEXT,
  formatDuplicateProjectAmount,
  formatDuplicateProjectDeadline,
} from "./duplicate-project-view";

describe("formatDuplicateProjectAmount", () => {
  it("formats amount_value + currency_code as a comma-separated amount with currency", () => {
    const result = formatDuplicateProjectAmount({
      amount: "1725",
      amount_value: 1725,
      currency_code: "USD",
    });

    expect(result).toBe("1,725 USD");
  });

  it("falls back to parsing the raw amount text when amount_value is missing", () => {
    const result = formatDuplicateProjectAmount({
      amount: "1725",
      amount_value: null,
      currency_code: "USD",
    });

    expect(result).toBe("1,725 USD");
  });

  it("uses the fallback text when the existing project genuinely has no amount", () => {
    const result = formatDuplicateProjectAmount({
      amount: null,
      amount_value: null,
      currency_code: null,
    });

    expect(result).toBe(DUPLICATE_PROJECT_AMOUNT_FALLBACK_TEXT);
  });

  it("does not fabricate a currency suffix when no currency_code is available", () => {
    const result = formatDuplicateProjectAmount({
      amount: "500",
      amount_value: 500,
      currency_code: null,
    });

    expect(result).toBe("500");
  });
});

describe("formatDuplicateProjectDeadline", () => {
  it("formats an existing deadline_date using the standard project date formatter", () => {
    const result = formatDuplicateProjectDeadline({
      deadline_text: null,
      deadline_date: "2026-10-09",
    });

    expect(result).toBe("10/09/26");
  });

  it("uses the fallback text when the existing project genuinely has no deadline saved", () => {
    const result = formatDuplicateProjectDeadline({
      deadline_text: null,
      deadline_date: null,
    });

    expect(result).toBe(DUPLICATE_PROJECT_DEADLINE_FALLBACK_TEXT);
  });
});

describe("duplicate project view formatters never substitute incoming candidate values", () => {
  it("only accept existing-project-shaped fields, so an incoming candidate's own amount/deadline cannot leak in", () => {
    // formatDuplicateProjectAmount/formatDuplicateProjectDeadline are typed
    // to accept only the existing-project slice of DuplicateProjectMatch
    // (amount/amount_value/currency_code/deadline_text/deadline_date) --
    // there is no parameter through which an incoming candidate's values
    // could be passed in, so a missing existing value can only ever render
    // as the fallback text, never as some other project's data.
    const missingExisting = formatDuplicateProjectAmount({
      amount: null,
      amount_value: null,
      currency_code: null,
    });
    const missingDeadline = formatDuplicateProjectDeadline({
      deadline_text: null,
      deadline_date: null,
    });

    expect(missingExisting).toBe(DUPLICATE_PROJECT_AMOUNT_FALLBACK_TEXT);
    expect(missingDeadline).toBe(DUPLICATE_PROJECT_DEADLINE_FALLBACK_TEXT);
  });
});
