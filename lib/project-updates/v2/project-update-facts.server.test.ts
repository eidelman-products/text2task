import { describe, expect, it, vi, beforeEach } from "vitest";

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

type ModelSubtask = {
  title: string;
  description?: string | null;
  deadlineText?: string | null;
  amount?: string | null;
  status?: string | null;
  priority?: string | null;
  completedEvidence?: unknown;
  incompleteEvidence?: unknown;
  completionScope?: string | null;
};

function mockModelResponse(body: {
  summary?: string;
  requestedSubtasks?: ModelSubtask[];
  projectChanges?: Record<string, unknown>;
  clientChanges?: Record<string, unknown>;
  notes?: unknown[];
  confidence?: number | null;
}) {
  const payload = {
    summary: body.summary ?? "test summary",
    requestedSubtasks: (body.requestedSubtasks ?? []).map((subtask) => ({
      title: subtask.title,
      description: subtask.description ?? null,
      deadlineText: subtask.deadlineText ?? null,
      amount: subtask.amount ?? null,
      status: subtask.status ?? null,
      priority: subtask.priority ?? null,
      completedEvidence: subtask.completedEvidence ?? [],
      incompleteEvidence: subtask.incompleteEvidence ?? [],
      completionScope: subtask.completionScope ?? null,
    })),
    projectChanges: {
      deadlineText: null,
      amount: null,
      priority: null,
      status: null,
      ...body.projectChanges,
    },
    clientChanges: {
      clientName: null,
      contactName: null,
      phone: null,
      email: null,
      notes: null,
      ...body.clientChanges,
    },
    notes: body.notes ?? [],
    confidence: body.confidence ?? 0.9,
  };

  createMock.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  });
}

beforeEach(() => {
  createMock.mockReset();
});

describe("extractProjectUpdateFacts - partial/mixed completion evidence", () => {
  it("exact reproduction: mixed evidence stays Done as extracted, but scope is partial and both evidence arrays survive", async () => {
    const rawInput =
      "The desktop design is complete, and the mobile layout is still in progress.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Design desktop and mobile landing page layouts",
          description: rawInput,
          status: "Done",
          completedEvidence: ["The desktop design is complete"],
          incompleteEvidence: ["the mobile layout is still in progress"],
          completionScope: "partial",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("Done");
    expect(fact.completedEvidence).toEqual(["The desktop design is complete"]);
    expect(fact.incompleteEvidence).toEqual([
      "the mobile layout is still in progress",
    ]);
    expect(fact.completionScope).toBe("partial");
  });

  it("both components complete: full scope survives with no incomplete evidence", async () => {
    const rawInput = "The desktop and mobile layouts are complete.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Design desktop and mobile landing page layouts",
          status: "Done",
          completedEvidence: ["The desktop and mobile layouts are complete"],
          incompleteEvidence: [],
          completionScope: "full",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("Done");
    expect(fact.completionScope).toBe("full");
    expect(fact.incompleteEvidence).toEqual([]);
  });

  it("only one component complete: forced to partial even if the model mislabels it full", async () => {
    const rawInput = "Only the desktop layout is complete.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Design desktop and mobile landing page layouts",
          status: "Done",
          completedEvidence: ["Only the desktop layout is complete"],
          incompleteEvidence: ["Only the desktop"],
          completionScope: "unclear",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    // Both arrays are grounded and non-empty -> conflict is derivable, so
    // completionScope is forced to "partial" regardless of what the model
    // self-reported ("unclear" above).
    expect(fact.completionScope).toBe("partial");
  });

  it('exception clause ("complete except for mobile responsiveness"): evidence conflict overrides a mislabeled "full" scope', async () => {
    const rawInput = "Design is complete except for mobile responsiveness.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Design",
          status: "Done",
          completedEvidence: ["Design is complete"],
          incompleteEvidence: ["except for mobile responsiveness"],
          completionScope: "full",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.completionScope).toBe("partial");
    expect(fact.incompleteEvidence).toEqual(["except for mobile responsiveness"]);
  });

  it('quantified partial ("most of the task is complete"): respects the model\'s own partial scope when there is no separate remaining-work excerpt', async () => {
    const rawInput = "Most of the task is complete.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "The task",
          status: "Done",
          completedEvidence: ["Most of the task is complete"],
          incompleteEvidence: [],
          completionScope: "partial",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.completionScope).toBe("partial");
  });

  it('negated completion ("not complete — only the first section is finished"): status is not forced to Done', async () => {
    const rawInput = "Not complete — only the first section is finished.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "The report",
          status: "In Progress",
          completedEvidence: [],
          incompleteEvidence: [],
          completionScope: null,
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("In Progress");
    expect(fact.completionScope).toBeNull();
  });

  it('approval pending ("draft is finished, client approval is still pending"): partial scope with both evidence arrays populated', async () => {
    const rawInput = "Draft is finished, client approval is still pending.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Draft",
          status: "Done",
          completedEvidence: ["Draft is finished"],
          incompleteEvidence: ["client approval is still pending"],
          completionScope: "partial",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.completionScope).toBe("partial");
    expect(fact.completedEvidence).toEqual(["Draft is finished"]);
    expect(fact.incompleteEvidence).toEqual(["client approval is still pending"]);
  });

  it('"everything is complete": full scope, valid Done extraction preserved', async () => {
    const rawInput = "Everything on the landing page is complete.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Landing page",
          status: "Done",
          completedEvidence: ["Everything on the landing page is complete"],
          incompleteEvidence: [],
          completionScope: "full",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("Done");
    expect(fact.completionScope).toBe("full");
  });

  it("single atomic task fully complete: full scope with grounded evidence", async () => {
    const rawInput = "The invoice has been sent.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Send invoice",
          status: "Done",
          completedEvidence: ["The invoice has been sent"],
          incompleteEvidence: [],
          completionScope: "full",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("Done");
    expect(fact.completionScope).toBe("full");
  });

  it("missing evidence on a proposed Done: normalizes to unclear rather than fabricating full", async () => {
    const rawInput = "The homepage is done.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Homepage",
          status: "Done",
          completedEvidence: [],
          incompleteEvidence: [],
          completionScope: "full",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("Done");
    expect(fact.completedEvidence).toEqual([]);
    // No grounded completedEvidence to support the claim -> fail safe, even
    // though the model itself said "full".
    expect(fact.completionScope).toBe("unclear");
  });

  it("evidence entries remain source-grounded: a hallucinated excerpt not present in rawInput is dropped", async () => {
    const rawInput = "The homepage is complete.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Homepage",
          status: "Done",
          completedEvidence: [
            "The homepage is complete",
            "client paid the final invoice",
          ],
          incompleteEvidence: [],
          completionScope: "full",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.completedEvidence).toEqual(["The homepage is complete"]);
    expect(fact.completedEvidence).not.toContain("client paid the final invoice");
  });

  it("malformed completionScope value fails the whole extraction safely instead of silently coercing", async () => {
    const rawInput = "The homepage is complete.";

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "test",
              requestedSubtasks: [
                {
                  title: "Homepage",
                  description: null,
                  deadlineText: null,
                  amount: null,
                  status: "Done",
                  priority: null,
                  completedEvidence: ["The homepage is complete"],
                  incompleteEvidence: [],
                  completionScope: "mostly-done",
                },
              ],
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

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Model returned invalid project update facts.");
  });

  it("missing evidence fields entirely (omitted by the model) default to empty arrays without crashing", async () => {
    const rawInput = "The homepage is complete.";

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "test",
              requestedSubtasks: [
                {
                  title: "Homepage",
                  description: null,
                  deadlineText: null,
                  amount: null,
                  status: "Done",
                  priority: null,
                  completionScope: null,
                },
              ],
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

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.completedEvidence).toEqual([]);
    expect(fact.incompleteEvidence).toEqual([]);
    expect(fact.completionScope).toBe("unclear");
  });

  it("existing non-completion statuses remain compatible: In Progress passes through untouched", async () => {
    const rawInput = "Work on the checkout flow is still in progress.";

    mockModelResponse({
      requestedSubtasks: [
        {
          title: "Checkout flow",
          status: "In Progress",
        },
      ],
    });

    const result = await extractProjectUpdateFacts({ rawInput, sourceType: "text" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [fact] = result.facts.requestedSubtasks;
    expect(fact.status).toBe("In Progress");
    expect(fact.completedEvidence).toEqual([]);
    expect(fact.incompleteEvidence).toEqual([]);
    expect(fact.completionScope).toBeNull();
  });

  it("prompt construction: instructs the model on evidence fields without a hardcoded desktop/mobile special case", async () => {
    mockModelResponse({ requestedSubtasks: [] });

    await extractProjectUpdateFacts({
      rawInput: "Anything.",
      sourceType: "text",
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const [callArgs] = createMock.mock.calls[0] as [
      { messages: Array<{ content: string }> },
    ];
    const prompt = callArgs.messages[0].content;

    expect(prompt).toContain("completedEvidence");
    expect(prompt).toContain("incompleteEvidence");
    expect(prompt).toContain("completionScope");
    expect(prompt.toLowerCase()).not.toContain("desktop and mobile");
  });
});
