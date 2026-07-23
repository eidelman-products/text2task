import { describe, expect, it } from "vitest";

import { judgeProjectUpdateFacts } from "./project-update-judge.server";

import type {
  ExistingProjectUpdateContext,
} from "@/lib/project-updates/project-update-types";
import type {
  ProjectUpdateExtractedFacts,
  ProjectUpdateExtractedSubtaskFact,
} from "@/lib/project-updates/v2/project-update-facts.types";

type Subtask = ExistingProjectUpdateContext["subtasks"][number];

function buildSubtask(overrides: Partial<Subtask> & { id: number; task_title: string }): Subtask {
  return {
    project_id: "project-1",
    status: "New",
    priority: "Medium",
    deadline_text: null,
    deadline_date: null,
    amount: null,
    subtask_order: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function buildContext(subtasks: Subtask[]): ExistingProjectUpdateContext {
  return {
    project: {
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
      created_at: null,
      updated_at: null,
    },
    client: null,
    subtasks,
  };
}

function buildSubtaskFact(
  overrides: Partial<ProjectUpdateExtractedSubtaskFact> & { title: string }
): ProjectUpdateExtractedSubtaskFact {
  return {
    description: null,
    deadlineText: null,
    amount: null,
    status: null,
    priority: null,
    ...overrides,
  };
}

function buildFacts(
  requestedSubtasks: ProjectUpdateExtractedSubtaskFact[]
): ProjectUpdateExtractedFacts {
  return {
    summary: "test",
    requestedSubtasks,
    projectChanges: {
      deadlineText: null,
      amount: null,
      priority: null,
      status: null,
    },
    clientChanges: {
      clientName: null,
      contactName: null,
      phone: null,
      email: null,
      notes: null,
    },
    notes: [],
    confidence: 0.9,
  };
}

describe("judgeProjectUpdateFacts - existing subtask matching", () => {
  it("exact completion: updates the existing subtask to Done", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Design downloadable business planning checklist",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({
        title: "Design downloadable business planning checklist",
        status: "Done",
      }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("apply");
    expect(decision.itemType).toBe("update_subtask");
    expect(decision.targetTaskId).toBe(1);
    expect(decision.newValue).toEqual({ status: "Done" });
  });

  it("short distinctive reference: updates the existing subtask to Done, never creates a new one", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Create hero section for the new landing page",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Hero section", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.itemType).toBe("update_subtask");
    expect(decision.targetTaskId).toBe(1);
    expect(decision.newValue).toEqual({ status: "Done" });
  });

  it("landing page reference: updates the only plausible landing-page task to Done", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Create landing page for the checklist",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Landing page", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.itemType).toBe("update_subtask");
    expect(decision.targetTaskId).toBe(1);
  });

  it("competing hero tasks: needs_review, no mutation target silently selected", () => {
    const context = buildContext([
      buildSubtask({ id: 1, task_title: "Create hero section for the homepage" }),
      buildSubtask({ id: 2, task_title: "Create hero section for the pricing page" }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Hero section", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("needs_review");
    expect(decision.itemType).toBe("needs_review");
  });

  it("bathroom remodeling paraphrase: confident update only when evidence is sufficiently unique", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Create bathroom remodeling services section",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Bathroom remodeling section", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.itemType).toBe("update_subtask");
    expect(decision.targetTaskId).toBe(1);
    expect(decision.newValue).toEqual({ status: "Done" });
  });

  it("clearly unrelated new work: creates a new_subtask", () => {
    const context = buildContext([
      buildSubtask({ id: 1, task_title: "Create hero section for the new landing page" }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Add View Our Recent Projects button" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("apply");
    expect(decision.itemType).toBe("new_subtask");
    expect(decision.targetTaskId).toBeNull();
  });

  it("unmatched completed work: needs_review, never a new_subtask marked Done", () => {
    const context = buildContext([
      buildSubtask({ id: 1, task_title: "Create hero section for the new landing page" }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({
        title: "The onboarding video",
        status: "Done",
      }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("needs_review");
    expect(decision.itemType).not.toBe("new_subtask");
    expect(decision.itemType).toBe("needs_review");
  });

  it("partial completion: needs_review, existing task not marked Done, no new completed task", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Create 8 Instagram posts for the August social media campaign",
        status: "New",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "First 4 Instagram posts", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("needs_review");
    expect(decision.itemType).not.toBe("new_subtask");
    // needs_review is never mutated by the apply route (it is rejected
    // fail-closed before the transactional RPC), so the existing task's
    // status can never be silently flipped to Done by this decision.
    expect(decision.itemType).toBe("needs_review");
  });

  it("mixed update: one confidently completed existing task and one genuinely new task", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Create hero section for the new landing page",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Hero section", status: "Done" }),
      buildSubtaskFact({ title: "Add View Our Recent Projects button" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });

    expect(result.decisions).toHaveLength(2);

    const updateDecision = result.decisions.find(
      (decision) => decision.itemType === "update_subtask"
    );
    const newDecision = result.decisions.find(
      (decision) => decision.itemType === "new_subtask"
    );

    expect(updateDecision?.targetTaskId).toBe(1);
    expect(newDecision?.targetTaskId).toBeNull();
  });

  it("re-analysis / idempotency: an already-Done match becomes no_change, not another task", () => {
    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Design downloadable business planning checklist",
        status: "Done",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({
        title: "Design downloadable business planning checklist",
        status: "Done",
      }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("no_change");
    expect(decision.itemType).toBe("no_action");
    expect(decision.itemType).not.toBe("new_subtask");
  });

  // Runtime regression fixtures recovered from the production database for
  // three real client updates (Cedar Lane Renovations, Summit Growth
  // Consulting, Harbor Fitness Studio), using the exact extracted facts and
  // exact existing subtask titles.

  it("Summit runtime regression: genuinely new work stays explicit new work, never duplicate_warning", () => {
    const context = buildContext([
      buildSubtask({
        id: 571,
        task_title: "Design a downloadable business planning checklist",
      }),
      buildSubtask({
        id: 572,
        task_title: "Create a landing page for the checklist",
      }),
      buildSubtask({
        id: 573,
        task_title: "Write a four-email follow-up sequence",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({
        title: "Add testimonial section to the landing page",
        status: "New",
      }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("apply");
    expect(decision.itemType).toBe("new_subtask");
    expect(decision.itemType).not.toBe("duplicate_warning");
    expect(decision.kind).not.toBe("no_change");
    expect(decision.targetTaskId).toBeNull();
    expect(decision.newValue).toMatchObject({
      task_title: "Add testimonial section to the landing page",
    });
  });

  it("Cedar runtime regression: marks the original hero task Done, never creates a new one", () => {
    const context = buildContext([
      buildSubtask({
        id: 566,
        task_title: "Create homepage hero section with a kitchen renovation image",
      }),
      buildSubtask({
        id: 567,
        task_title: "Create bathroom remodeling services section",
      }),
      buildSubtask({
        id: 568,
        task_title: "Add renovation project gallery with six photos",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "Homepage hero section", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.itemType).toBe("update_subtask");
    expect(decision.itemType).not.toBe("new_subtask");
    expect(decision.targetTaskId).toBe(566);
    expect(decision.newValue).toEqual({ status: "Done" });
  });

  it("Harbor runtime regression: partial completion needs review, never a new completed task", () => {
    const context = buildContext([
      buildSubtask({
        id: 574,
        task_title: "Create 8 Instagram posts for the August campaign",
      }),
      buildSubtask({
        id: 575,
        task_title: "Design 4 Instagram story graphics for the August campaign",
      }),
      buildSubtask({
        id: 576,
        task_title: "Create 2 short promotional videos for the August campaign",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({ title: "First 4 Instagram posts", status: "Done" }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("needs_review");
    expect(decision.itemType).toBe("needs_review");
    expect(decision.itemType).not.toBe("new_subtask");
    expect(decision.itemType).not.toBe("update_subtask");
  });

  it("Harbor runtime regression: unrelated video-color work is applied as new work, never flagged for review", () => {
    const context = buildContext([
      buildSubtask({
        id: 574,
        task_title: "Create 8 Instagram posts for the August campaign",
      }),
      buildSubtask({
        id: 575,
        task_title: "Design 4 Instagram story graphics for the August campaign",
      }),
      buildSubtask({
        id: 576,
        task_title: "Create 2 short promotional videos for the August campaign",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({
        title: "Change background color of promotional video 1 to dark blue",
        status: "New",
      }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("apply");
    expect(decision.itemType).toBe("new_subtask");
    expect(decision.itemType).not.toBe("needs_review");
    expect(decision.targetTaskId).toBeNull();
  });

  it("Cedar runtime regression: unrelated gallery-button work is applied as new work, never flagged for review", () => {
    const context = buildContext([
      buildSubtask({
        id: 566,
        task_title: "Create homepage hero section with a kitchen renovation image",
      }),
      buildSubtask({
        id: 567,
        task_title: "Create bathroom remodeling services section",
      }),
      buildSubtask({
        id: 568,
        task_title: "Add renovation project gallery with six photos",
      }),
    ]);
    const facts = buildFacts([
      buildSubtaskFact({
        title: "Add 'View Recent Projects' button below renovation gallery",
        status: "New",
      }),
    ]);

    const result = judgeProjectUpdateFacts({ facts, context });
    const [decision] = result.decisions;

    expect(decision.kind).toBe("apply");
    expect(decision.itemType).toBe("new_subtask");
    expect(decision.itemType).not.toBe("needs_review");
    expect(decision.targetTaskId).toBeNull();
  });
});
