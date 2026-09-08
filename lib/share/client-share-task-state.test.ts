import { describe, expect, it } from "vitest";

import {
  calculateClientShareProgress,
  deriveClientShareTaskPublicGroup,
  deriveClientShareTaskWorkflowStatus,
} from "./client-share-task-state";

describe("deriveClientShareTaskWorkflowStatus", () => {
  it.each([
    ["Not Started", null, "not_started"],
    ["New", null, "not_started"],
    ["In Progress", null, "in_progress"],
    ["Review", null, "in_review"],
    ["In Review", null, "in_review"],
    ["Urgent", null, "urgent"],
    ["Done", null, "completed"],
    ["Completed", null, "completed"],
    ["Complete", null, "completed"],
    ["In Progress", "2026-09-08T00:00:00Z", "completed"],
    ["Some Future Status", null, "unknown"],
    ["Blocked", "2026-09-08T00:00:00Z", "completed"],
  ] as const)("maps %s/%s to %s", (status, completedAt, expected) => {
    expect(deriveClientShareTaskWorkflowStatus({ status, completedAt })).toBe(expected);
  });
});

describe("deriveClientShareTaskPublicGroup", () => {
  it("derives presentation grouping from canonical state, with completion taking precedence", () => {
    expect(
      deriveClientShareTaskPublicGroup({
        status: "Done",
        completedAt: null,
        waitingForClientFeedback: true,
      })
    ).toBe("completed");
  });

  it("keeps waiting-for-feedback separate from canonical workflow state", () => {
    expect(
      deriveClientShareTaskWorkflowStatus({
        status: "Review",
        completedAt: null,
        waitingForClientFeedback: true,
      })
    ).toBe("in_review");
    expect(
      deriveClientShareTaskPublicGroup({
        status: "Review",
        completedAt: null,
        waitingForClientFeedback: true,
      })
    ).toBe("waiting_for_feedback");
  });
});

describe("calculateClientShareProgress", () => {
  it("counts completion from canonical status/completed_at only", () => {
    expect(
      calculateClientShareProgress([
        { status: "Done", completedAt: null },
        { status: "In Progress", completedAt: "2026-09-08T00:00:00Z" },
        { status: "Review", completedAt: null },
      ])
    ).toEqual({ completed: 2, total: 3, percent: 67 });
  });

  it("returns null for zero eligible projected tasks", () => {
    expect(calculateClientShareProgress([])).toBeNull();
  });
});
