import { describe, expect, it } from "vitest";

import {
  isCanonicalTaskComplete,
  normalizeCanonicalTaskStatus,
} from "./canonical-task-status";

describe("normalizeCanonicalTaskStatus", () => {
  it.each([
    ["Not Started", "not_started"],
    ["New", "not_started"],
    ["In Progress", "in_progress"],
    ["in-progress", "in_progress"],
    ["Review", "review"],
    ["In Review", "review"],
    ["Urgent", "urgent"],
    ["Done", "done"],
    ["Completed", "done"],
    ["Complete", "done"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeCanonicalTaskStatus(input)).toBe(expected);
  });

  it("treats null, blank, and unknown values as unknown", () => {
    expect(normalizeCanonicalTaskStatus(null)).toBe("unknown");
    expect(normalizeCanonicalTaskStatus("   ")).toBe("unknown");
    expect(normalizeCanonicalTaskStatus("Blocked")).toBe("unknown");
  });
});

describe("isCanonicalTaskComplete", () => {
  it("is complete when status is any semantic done alias", () => {
    expect(isCanonicalTaskComplete({ status: "Done", completedAt: null })).toBe(true);
    expect(isCanonicalTaskComplete({ status: "Completed", completedAt: null })).toBe(true);
    expect(isCanonicalTaskComplete({ status: "Complete", completedAt: null })).toBe(true);
  });

  it("is complete when completed_at is present, even after a status reopen", () => {
    expect(
      isCanonicalTaskComplete({ status: "In Progress", completedAt: "2026-09-08T00:00:00Z" })
    ).toBe(true);
  });

  it("is incomplete when neither done status nor completed_at is present", () => {
    expect(isCanonicalTaskComplete({ status: "Review", completedAt: null })).toBe(false);
    expect(isCanonicalTaskComplete({ status: "Unknown", completedAt: null })).toBe(false);
  });
});
