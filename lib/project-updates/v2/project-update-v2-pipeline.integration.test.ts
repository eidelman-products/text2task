// Integration coverage for the real seam between the two files this fix
// touches: extractProjectUpdateFacts (AI + deterministic repair) feeding its
// actual output into judgeProjectUpdateFacts (deterministic gate), instead
// of each file's own unit tests hand-building the other's expected shape.
// This is what actually runs in production for both text and screenshot
// updates (project-update-image.server.ts transcribes a screenshot into the
// same rawInput text before it reaches this same pipeline).
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { ExistingProjectUpdateContext } from "@/lib/project-updates/project-update-types";

const createMock = vi.fn();

vi.mock("@/lib/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => createMock(...args),
      },
    },
  },
}));

const { extractProjectUpdateFacts } = await import(
  "@/lib/project-updates/v2/project-update-facts.server"
);
const { judgeProjectUpdateFacts } = await import(
  "@/lib/project-updates/v2/project-update-judge.server"
);

type ModelSubtask = {
  title: string;
  description?: string | null;
  status?: string | null;
  completedEvidence?: string[];
  incompleteEvidence?: string[];
  completionScope?: string | null;
};

function mockModelResponse(requestedSubtasks: ModelSubtask[]) {
  createMock.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "test",
            requestedSubtasks: requestedSubtasks.map((subtask) => ({
              title: subtask.title,
              description: subtask.description ?? null,
              deadlineText: null,
              amount: null,
              status: subtask.status ?? null,
              priority: null,
              completedEvidence: subtask.completedEvidence ?? [],
              incompleteEvidence: subtask.incompleteEvidence ?? [],
              completionScope: subtask.completionScope ?? null,
            })),
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
          }),
        },
      },
    ],
  });
}

function buildContext(
  subtasks: ExistingProjectUpdateContext["subtasks"]
): ExistingProjectUpdateContext {
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

function buildSubtask(
  overrides: Partial<ExistingProjectUpdateContext["subtasks"][number]> & {
    id: number;
    task_title: string;
  }
): ExistingProjectUpdateContext["subtasks"][number] {
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

beforeEach(() => {
  createMock.mockReset();
});

describe("v2 pipeline integration: facts extraction -> judge, real seam", () => {
  it("exact reproduction (text source): mixed evidence never reaches an apply/Done decision", async () => {
    const rawInput =
      "The desktop design is complete, and the mobile layout is still in progress.";

    mockModelResponse([
      {
        title: "Design desktop and mobile landing page layouts",
        description: rawInput,
        status: "Done",
        completedEvidence: ["The desktop design is complete"],
        incompleteEvidence: ["the mobile layout is still in progress"],
        completionScope: "partial",
      },
    ]);

    const factsResult = await extractProjectUpdateFacts({
      rawInput,
      sourceType: "text",
    });
    expect(factsResult.ok).toBe(true);
    if (!factsResult.ok) return;

    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Design desktop and mobile landing page layouts",
      }),
    ]);

    const judgeResult = judgeProjectUpdateFacts({
      facts: factsResult.facts,
      context,
    });
    const [decision] = judgeResult.decisions;

    expect(decision.kind).toBe("needs_review");
    expect(decision.kind).not.toBe("apply");
    expect(decision.newValue).toMatchObject({
      completed_evidence: ["The desktop design is complete"],
      incomplete_evidence: ["the mobile layout is still in progress"],
    });
  });

  it("exact reproduction, simulated screenshot path (sourceType: image, same transcribed text): identical protection", async () => {
    const transcribedText =
      "[Image update transcription]\nThe desktop design is complete, and the mobile layout is still in progress.";

    mockModelResponse([
      {
        title: "Design desktop and mobile landing page layouts",
        description:
          "The desktop design is complete, and the mobile layout is still in progress.",
        status: "Done",
        completedEvidence: ["The desktop design is complete"],
        incompleteEvidence: ["the mobile layout is still in progress"],
        completionScope: "partial",
      },
    ]);

    const factsResult = await extractProjectUpdateFacts({
      rawInput: transcribedText,
      sourceType: "image",
    });
    expect(factsResult.ok).toBe(true);
    if (!factsResult.ok) return;

    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Design desktop and mobile landing page layouts",
      }),
    ]);

    const judgeResult = judgeProjectUpdateFacts({
      facts: factsResult.facts,
      context,
    });
    const [decision] = judgeResult.decisions;

    expect(decision.kind).toBe("needs_review");
  });

  it("valid full completion: a clean, fully-evidenced Done auto-applies through the real pipeline", async () => {
    const rawInput = "The desktop and mobile layouts are complete.";

    mockModelResponse([
      {
        title: "Design desktop and mobile landing page layouts",
        status: "Done",
        completedEvidence: ["The desktop and mobile layouts are complete"],
        incompleteEvidence: [],
        completionScope: "full",
      },
    ]);

    const factsResult = await extractProjectUpdateFacts({
      rawInput,
      sourceType: "text",
    });
    expect(factsResult.ok).toBe(true);
    if (!factsResult.ok) return;

    const context = buildContext([
      buildSubtask({
        id: 1,
        task_title: "Design desktop and mobile landing page layouts",
      }),
    ]);

    const judgeResult = judgeProjectUpdateFacts({
      facts: factsResult.facts,
      context,
    });
    const [decision] = judgeResult.decisions;

    expect(decision.kind).toBe("apply");
    expect(decision.itemType).toBe("update_subtask");
    expect(decision.newValue).toEqual({ status: "Done" });
  });

  it("false-match protection: clean full-completion evidence still cannot silently pick a winner between two similarly named tasks", async () => {
    const rawInput = "The hero section is complete.";

    mockModelResponse([
      {
        title: "Hero section",
        status: "Done",
        completedEvidence: ["The hero section is complete"],
        incompleteEvidence: [],
        completionScope: "full",
      },
    ]);

    const factsResult = await extractProjectUpdateFacts({
      rawInput,
      sourceType: "text",
    });
    expect(factsResult.ok).toBe(true);
    if (!factsResult.ok) return;

    const context = buildContext([
      buildSubtask({ id: 1, task_title: "Create hero section for the homepage" }),
      buildSubtask({ id: 2, task_title: "Create hero section for the pricing page" }),
    ]);

    const judgeResult = judgeProjectUpdateFacts({
      facts: factsResult.facts,
      context,
    });
    const [decision] = judgeResult.decisions;

    expect(decision.kind).toBe("needs_review");
    expect(decision.kind).not.toBe("apply");
  });
});
