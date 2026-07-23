import { describe, expect, it } from "vitest";

import { classifySaveProjectBatchResponse } from "./save-project-batch-result";

describe("classifySaveProjectBatchResponse", () => {
  it("classifies a successful import as saved", () => {
    const outcome = classifySaveProjectBatchResponse({
      ok: true,
      status: 200,
      data: { createdTasks: [{ id: 1 }, { id: 2 }] },
    });

    expect(outcome.status).toBe("saved");
    if (outcome.status === "saved") {
      expect(outcome.createdTasks).toHaveLength(2);
    }
  });

  it("classifies an expected 409 DUPLICATE_PROJECT_DETECTED response as duplicate, not error", () => {
    const duplicate = {
      project_id: "project-1",
      existing_task_id: 42,
      client_name: "Acme",
      contact_name: null,
      amount: null,
      deadline_text: null,
      deadline_date: null,
      created_at: null,
      task_count: 1,
      matched_task_count: 1,
      score: 0.9,
      confidence: "high" as const,
      reason: "Same client and title",
      existing_tasks: [{ id: 42, task_title: "Existing task" }],
    };

    const outcome = classifySaveProjectBatchResponse({
      ok: false,
      status: 409,
      data: {
        ok: false,
        code: "DUPLICATE_PROJECT_DETECTED",
        error: "One or more projects may already exist",
        duplicates: [{ groupIndex: 0, duplicate }],
      },
    });

    expect(outcome.status).toBe("duplicate");
  });

  it("carries the duplicate match and group index through in the duplicate result", () => {
    const duplicate = {
      project_id: "project-2",
      existing_task_id: 99,
      client_name: "Beta Co",
      contact_name: null,
      amount: null,
      deadline_text: null,
      deadline_date: null,
      created_at: null,
      task_count: 3,
      matched_task_count: 3,
      score: 1,
      confidence: "high" as const,
      reason: "Identical project",
      existing_tasks: [],
    };

    const outcome = classifySaveProjectBatchResponse({
      ok: false,
      status: 409,
      data: {
        code: "DUPLICATE_PROJECT_DETECTED",
        duplicates: [{ groupIndex: 2, duplicate }],
      },
    });

    expect(outcome.status).toBe("duplicate");
    if (outcome.status === "duplicate") {
      expect(outcome.groupIndex).toBe(2);
      expect(outcome.duplicate).toEqual(duplicate);
    }
  });

  it("classifies an unrelated 409 payload (missing the expected duplicate shape) as a genuine error", () => {
    const outcome = classifySaveProjectBatchResponse({
      ok: false,
      status: 409,
      data: { code: "SOME_OTHER_CONFLICT", error: "Conflict" },
    });

    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.message).toBe("Conflict");
    }
  });

  it("classifies a 409 with the right code but a malformed duplicates array as a genuine error", () => {
    const outcome = classifySaveProjectBatchResponse({
      ok: false,
      status: 409,
      data: { code: "DUPLICATE_PROJECT_DETECTED", duplicates: [] },
    });

    expect(outcome.status).toBe("error");
  });

  it("classifies a 500 response as a genuine error", () => {
    const outcome = classifySaveProjectBatchResponse({
      ok: false,
      status: 500,
      data: { error: "Internal server error" },
    });

    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.message).toBe("Internal server error");
    }
  });

  it("remains fail-closed (a genuine error, not saved/duplicate) for a malformed or empty response body", () => {
    const outcomeNull = classifySaveProjectBatchResponse({
      ok: false,
      status: 502,
      data: null,
    });
    const outcomeString = classifySaveProjectBatchResponse({
      ok: false,
      status: 502,
      data: "not json",
    });

    expect(outcomeNull.status).toBe("error");
    expect(outcomeString.status).toBe("error");
  });

  it("does not misclassify a successful response as a duplicate even if it happens to include a duplicates array", () => {
    const outcome = classifySaveProjectBatchResponse({
      ok: true,
      status: 200,
      data: { createdTasks: [{ id: 1 }], duplicates: [] },
    });

    expect(outcome.status).toBe("saved");
  });

  it("a save-anyway (override) request that succeeds is classified as saved, distinguishable from the normal duplicate branch", () => {
    // Represents the response to the second call made by
    // saveDuplicateProjectAnyway once the caller passes the previously
    // reported groupIndex in duplicateOverrideGroupIndexes -- the server
    // bypasses duplicate detection for that group and the batch saves.
    const outcome = classifySaveProjectBatchResponse({
      ok: true,
      status: 200,
      data: { createdTasks: [{ id: 7 }] },
    });

    expect(outcome.status).toBe("saved");
    expect(outcome.status).not.toBe("duplicate");
  });

  it("a save-anyway request that hits a different duplicate is still classified as duplicate, not silently dropped", () => {
    const duplicate = {
      project_id: "project-3",
      existing_task_id: 55,
      client_name: "Gamma LLC",
      contact_name: null,
      amount: null,
      deadline_text: null,
      deadline_date: null,
      created_at: null,
      task_count: 2,
      matched_task_count: 2,
      score: 0.95,
      confidence: "high" as const,
      reason: "Second project in the batch already exists",
      existing_tasks: [],
    };

    const outcome = classifySaveProjectBatchResponse({
      ok: false,
      status: 409,
      data: {
        code: "DUPLICATE_PROJECT_DETECTED",
        duplicates: [{ groupIndex: 1, duplicate }],
      },
    });

    expect(outcome.status).toBe("duplicate");
    if (outcome.status === "duplicate") {
      expect(outcome.groupIndex).toBe(1);
    }
  });
});
