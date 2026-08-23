import { describe, expect, it, vi, beforeEach } from "vitest";

const loadProjectUpdateContextMock = vi.fn();
const extractProjectUpdateFactsMock = vi.fn();
const judgeProjectUpdateFactsMock = vi.fn();
const createProjectUpdateAuditRecordMock = vi.fn();
const createProjectUpdateAuditItemsMock = vi.fn();
const createProjectTimelineEventMock = vi.fn();

vi.mock("@/lib/project-updates/project-update-context.server", () => ({
  loadProjectUpdateContext: (...args: unknown[]) => loadProjectUpdateContextMock(...args),
}));
vi.mock("@/lib/project-updates/v2/project-update-facts.server", () => ({
  extractProjectUpdateFacts: (...args: unknown[]) => extractProjectUpdateFactsMock(...args),
}));
vi.mock("@/lib/project-updates/v2/project-update-judge.server", () => ({
  judgeProjectUpdateFacts: (...args: unknown[]) => judgeProjectUpdateFactsMock(...args),
}));
vi.mock("@/lib/project-updates/project-update-audit.server", () => ({
  createProjectUpdateAuditRecord: (...args: unknown[]) => createProjectUpdateAuditRecordMock(...args),
  createProjectUpdateAuditItems: (...args: unknown[]) => createProjectUpdateAuditItemsMock(...args),
  createProjectTimelineEvent: (...args: unknown[]) => createProjectTimelineEventMock(...args),
}));

const { analyzeProjectUpdateV2 } = await import("./project-update-v2-analyzer.server");

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const UPDATE_ID = "33333333-3333-4333-8333-333333333333";
const MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

function stubHappyPath() {
  loadProjectUpdateContextMock.mockResolvedValue({
    ok: true,
    context: { project: { id: PROJECT_ID, client_id: CLIENT_ID }, client: null, subtasks: [] },
  });
  extractProjectUpdateFactsMock.mockResolvedValue({
    ok: true,
    facts: {
      summary: "s",
      requestedSubtasks: [],
      projectChanges: { deadlineText: null, amount: null, priority: null, status: null },
      clientChanges: { clientName: null, contactName: null, phone: null, email: null, notes: null },
      notes: [],
      confidence: null,
    },
    normalizedRawInput: "NORMALIZED (trimmed/collapsed) version, different from raw",
  });
  judgeProjectUpdateFactsMock.mockReturnValue({
    summary: { headline: "h", reasoning: "r", riskLevel: "low", detectedChanges: [] },
    decisions: [],
  });
  createProjectUpdateAuditRecordMock.mockResolvedValue({
    ok: true,
    data: { id: UPDATE_ID, project_id: PROJECT_ID },
  });
  createProjectUpdateAuditItemsMock.mockResolvedValue({ ok: true, data: [] });
  createProjectTimelineEventMock.mockResolvedValue({
    ok: true,
    data: { id: "timeline-1", event_type: "ai_update_analyzed" },
  });
}

beforeEach(() => {
  loadProjectUpdateContextMock.mockReset();
  extractProjectUpdateFactsMock.mockReset();
  judgeProjectUpdateFactsMock.mockReset();
  createProjectUpdateAuditRecordMock.mockReset();
  createProjectUpdateAuditItemsMock.mockReset();
  createProjectTimelineEventMock.mockReset();
  stubHappyPath();
});

describe("analyzeProjectUpdateV2 - timeline isolation", () => {
  it("a client_share analysis creates NO project_timeline_events row -- createProjectTimelineEvent is never called", async () => {
    const result = await analyzeProjectUpdateV2({
      projectId: PROJECT_ID,
      rawInput: "Exact client message body",
      sourceType: "client_share",
      sourceShareMessageId: MESSAGE_ID,
    });

    expect(result.status).toBe(200);
    expect(result.response.ok).toBe(true);
    if (result.response.ok) {
      expect(result.response.timelineEvent).toBeNull();
    }
    expect(createProjectTimelineEventMock).not.toHaveBeenCalled();
  });

  it("a normal text analysis still creates its existing ai_update_analyzed timeline event, unchanged", async () => {
    const result = await analyzeProjectUpdateV2({
      projectId: PROJECT_ID,
      rawInput: "Some pasted client text",
      sourceType: "text",
    });

    expect(result.response.ok).toBe(true);
    expect(createProjectTimelineEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ai_update_analyzed", eventTitle: "Client update analyzed" })
    );
    if (result.response.ok) {
      expect(result.response.timelineEvent).not.toBeNull();
    }
  });

  it("a normal image analysis still creates its existing timeline event with the screenshot-specific title, unchanged", async () => {
    await analyzeProjectUpdateV2({
      projectId: PROJECT_ID,
      rawInput: "Transcribed screenshot text",
      sourceType: "image",
    });

    expect(createProjectTimelineEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ai_update_analyzed", eventTitle: "Screenshot update analyzed" })
    );
  });
});

describe("analyzeProjectUpdateV2 - client_share persistence wiring", () => {
  it("persists source_type='client_share' and source_share_message_id together with raw_input in the SAME createProjectUpdateAuditRecord call", async () => {
    await analyzeProjectUpdateV2({
      projectId: PROJECT_ID,
      rawInput: "Exact client message body",
      sourceType: "client_share",
      sourceShareMessageId: MESSAGE_ID,
    });

    expect(createProjectUpdateAuditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "client_share",
        sourceShareMessageId: MESSAGE_ID,
        rawInput: "Exact client message body",
      })
    );
  });

  it("persists the EXACT server-supplied rawInput for client_share -- never the AI-normalized value (which the mock deliberately returns as a different string)", async () => {
    await analyzeProjectUpdateV2({
      projectId: PROJECT_ID,
      rawInput: "Exact client message body",
      sourceType: "client_share",
      sourceShareMessageId: MESSAGE_ID,
    });

    const call = createProjectUpdateAuditRecordMock.mock.calls[0]?.[0];
    expect(call.rawInput).toBe("Exact client message body");
    expect(call.rawInput).not.toBe("NORMALIZED (trimmed/collapsed) version, different from raw");
  });

  it("normal text/image analyses continue to persist the AI-normalized rawInput, unchanged", async () => {
    await analyzeProjectUpdateV2({
      projectId: PROJECT_ID,
      rawInput: "  raw text with whitespace  ",
      sourceType: "text",
    });

    const call = createProjectUpdateAuditRecordMock.mock.calls[0]?.[0];
    expect(call.rawInput).toBe("NORMALIZED (trimmed/collapsed) version, different from raw");
    expect(call.sourceShareMessageId).toBeUndefined();
  });
});
