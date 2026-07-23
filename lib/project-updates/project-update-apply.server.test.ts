import { describe, expect, it } from "vitest";

import {
  buildTransactionalApplyPayloadItem,
  findNonApplicableAcceptedItem,
  NON_APPLICABLE_ACCEPTED_ITEM_TYPES,
  type ProjectRow,
  type ProjectUpdateItemRow,
} from "./project-update-apply.server";

function buildItem(
  overrides: Partial<ProjectUpdateItemRow> & { id: string; type: ProjectUpdateItemRow["type"] }
): ProjectUpdateItemRow {
  return {
    project_update_id: "update-1",
    user_id: "user-1",
    project_id: "project-1",
    target_task_id: null,
    title: "Test item",
    description: null,
    target_field: null,
    old_value: null,
    new_value: null,
    confidence: null,
    status: "suggested",
    ai_reason: null,
    user_note: null,
    created_at: new Date().toISOString(),
    accepted_at: null,
    rejected_at: null,
    applied_at: null,
    accepted_by: null,
    rejected_by: null,
    applied_by: null,
    ...overrides,
  };
}

function buildProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "project-1",
    user_id: "user-1",
    client_id: null,
    title: "Test project",
    summary: null,
    client_name: "Acme",
    contact_name: null,
    amount: null,
    amount_value: null,
    currency_code: null,
    deadline_text: null,
    deadline_date: null,
    priority: null,
    priority_source: "unknown",
    status: null,
    ...overrides,
  };
}

describe("findNonApplicableAcceptedItem (fail-closed apply guard)", () => {
  it("flags an accepted needs_review-style item (duplicate_warning) as non-applicable", () => {
    const items = [
      buildItem({ id: "item-1", type: "duplicate_warning" }),
    ];

    const flagged = findNonApplicableAcceptedItem(items);

    expect(flagged).not.toBeNull();
    expect(flagged?.id).toBe("item-1");
  });

  it("flags an accepted no_action item as non-applicable", () => {
    const items = [buildItem({ id: "item-1", type: "no_action" })];

    expect(findNonApplicableAcceptedItem(items)).not.toBeNull();
  });

  it("flags an accepted needs_review item as non-applicable, even with a target_task_id present as review context", () => {
    const items = [
      buildItem({
        id: "item-1",
        type: "needs_review",
        target_task_id: 42,
      }),
    ];

    const flagged = findNonApplicableAcceptedItem(items);

    expect(flagged).not.toBeNull();
    expect(flagged?.id).toBe("item-1");
  });

  it("does not flag a genuinely applicable update_subtask item", () => {
    const items = [
      buildItem({
        id: "item-1",
        type: "update_subtask",
        target_task_id: 42,
        new_value: { status: "Done" },
      }),
    ];

    expect(findNonApplicableAcceptedItem(items)).toBeNull();
  });

  it("does not flag a genuinely applicable new_subtask item", () => {
    const items = [
      buildItem({
        id: "item-1",
        type: "new_subtask",
        new_value: { task_title: "New work" },
      }),
    ];

    expect(findNonApplicableAcceptedItem(items)).toBeNull();
  });

  it("the non-applicable set contains exactly the review-only item types", () => {
    expect(NON_APPLICABLE_ACCEPTED_ITEM_TYPES.has("duplicate_warning")).toBe(true);
    expect(NON_APPLICABLE_ACCEPTED_ITEM_TYPES.has("no_action")).toBe(true);
    expect(NON_APPLICABLE_ACCEPTED_ITEM_TYPES.has("needs_review")).toBe(true);
    expect(NON_APPLICABLE_ACCEPTED_ITEM_TYPES.has("update_subtask")).toBe(false);
    expect(NON_APPLICABLE_ACCEPTED_ITEM_TYPES.has("new_subtask")).toBe(false);
  });

  it("a mixed accepted batch of one needs_review and one new_subtask flags only the needs_review item", () => {
    const items = [
      buildItem({
        id: "item-new",
        type: "new_subtask",
        new_value: { task_title: "New work" },
      }),
      buildItem({
        id: "item-review",
        type: "needs_review",
        target_task_id: 42,
      }),
    ];

    const flagged = findNonApplicableAcceptedItem(items);

    expect(flagged).not.toBeNull();
    expect(flagged?.id).toBe("item-review");
  });
});

describe("buildTransactionalApplyPayloadItem - target id safety", () => {
  it("throws rather than falling back to creation when target_task_id is missing on update_subtask", () => {
    const project = buildProject();
    const item = buildItem({
      id: "item-1",
      type: "update_subtask",
      target_task_id: null,
      new_value: { status: "Done" },
    });

    expect(() =>
      buildTransactionalApplyPayloadItem({ project, item })
    ).toThrow();
  });

  it("throws when update_subtask has a target_task_id but no new value", () => {
    const project = buildProject();
    const item = buildItem({
      id: "item-1",
      type: "update_subtask",
      target_task_id: 42,
      new_value: null,
    });

    expect(() =>
      buildTransactionalApplyPayloadItem({ project, item })
    ).toThrow();
  });

  it("builds an update_subtask mutation carrying the exact validated target id", () => {
    const project = buildProject();
    const item = buildItem({
      id: "item-1",
      type: "update_subtask",
      target_task_id: 42,
      new_value: { status: "Done" },
    });

    const payload = buildTransactionalApplyPayloadItem({ project, item });

    expect(payload.mutation).toEqual({
      kind: "update_subtask",
      taskId: 42,
      updates: { status: "Done" },
    });
    expect(payload.event.targetTaskId).toBe(42);
  });

  it("a new_subtask mutation never carries a target task id", () => {
    const project = buildProject();
    const item = buildItem({
      id: "item-1",
      type: "new_subtask",
      target_task_id: null,
      new_value: { task_title: "Brand new work" },
    });

    const payload = buildTransactionalApplyPayloadItem({ project, item });

    expect(payload.mutation.kind).toBe("new_subtask");
    expect(payload.event.targetTaskId).toBeNull();
  });
});
