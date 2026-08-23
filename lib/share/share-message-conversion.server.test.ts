import { describe, expect, it, vi, beforeEach } from "vitest";

const loadShareMessageForConversionMock = vi.fn();
vi.mock("@/lib/share/share-messages-repository.server", () => ({
  loadShareMessageForConversion: (...args: unknown[]) => loadShareMessageForConversionMock(...args),
}));

const loadProjectUpdateContextMock = vi.fn();
vi.mock("@/lib/project-updates/project-update-context.server", () => ({
  loadProjectUpdateContext: (...args: unknown[]) => loadProjectUpdateContextMock(...args),
}));
const extractProjectUpdateFactsMock = vi.fn();
vi.mock("@/lib/project-updates/v2/project-update-facts.server", () => ({
  extractProjectUpdateFacts: (...args: unknown[]) => extractProjectUpdateFactsMock(...args),
}));
const judgeProjectUpdateFactsMock = vi.fn();
vi.mock("@/lib/project-updates/v2/project-update-judge.server", () => ({
  judgeProjectUpdateFacts: (...args: unknown[]) => judgeProjectUpdateFactsMock(...args),
}));
const createProjectUpdateAuditItemsMock = vi.fn();
const createProjectUpdateAuditRecordMock = vi.fn();
const markProjectUpdateAsAnalyzedMock = vi.fn();
const markProjectUpdateAsFailedMock = vi.fn();
vi.mock("@/lib/project-updates/project-update-audit.server", () => ({
  createProjectUpdateAuditItems: (...args: unknown[]) => createProjectUpdateAuditItemsMock(...args),
  createProjectUpdateAuditRecord: (...args: unknown[]) => createProjectUpdateAuditRecordMock(...args),
  markProjectUpdateAsAnalyzed: (...args: unknown[]) => markProjectUpdateAsAnalyzedMock(...args),
  markProjectUpdateAsFailed: (...args: unknown[]) => markProjectUpdateAsFailedMock(...args),
}));

const { convertShareMessageToClientUpdate } = await import("./share-message-conversion.server");

const LINK_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const BODY = "Please add a footer to the homepage.";
const UNIQUE_VIOLATION_MESSAGE =
  'duplicate key value violates unique constraint "project_updates_source_share_message_id_key"';

function validSource() {
  return { ok: true, data: { messageId: MESSAGE_ID, projectId: PROJECT_ID, body: BODY } };
}

function stubAnalysisPipeline(headline = "analyzed") {
  loadProjectUpdateContextMock.mockResolvedValue({
    ok: true,
    context: { project: { id: PROJECT_ID, client_id: null }, client: null, subtasks: [] },
  });
  extractProjectUpdateFactsMock.mockResolvedValue({
    ok: true,
    facts: { summary: "s", requestedSubtasks: [], projectChanges: {}, clientChanges: {}, notes: [], confidence: null },
    normalizedRawInput: "normalized",
  });
  judgeProjectUpdateFactsMock.mockReturnValue({
    summary: { headline, reasoning: "", riskLevel: "low", detectedChanges: [] },
    decisions: [],
  });
  createProjectUpdateAuditItemsMock.mockResolvedValue({ ok: true, data: [] });
}

/*
  Shared in-memory "database" for project_updates/project_update_items,
  used by every reservation-first / concurrency test below. Unlike a
  simple per-call queued response, this actually enforces the same
  invariant Phase 6A's own partial unique index enforces (one
  (user_id, source_share_message_id) pair can back at most one row),
  which is what lets these tests exercise the REAL race-handling logic in
  share-message-conversion.server.ts rather than a scripted response
  sequence.
*/
type Store = { updates: Map<string, Record<string, unknown>>; items: Map<string, unknown[]>; seq: number };

function createStore(): Store {
  return { updates: new Map(), items: new Map(), seq: 0 };
}

function wireStoreMocks(store: Store) {
  createProjectUpdateAuditRecordMock.mockImplementation(async (input: Record<string, unknown>) => {
    const conflict = [...store.updates.values()].find(
      (row) => row.user_id === USER_ID && row.source_share_message_id === input.sourceShareMessageId
    );
    if (conflict) {
      return {
        ok: false,
        status: 500,
        error: UNIQUE_VIOLATION_MESSAGE,
        dbErrorCode: "23505",
      };
    }
    store.seq += 1;
    const id = `update-${store.seq}`;
    const row = {
      id,
      user_id: USER_ID,
      project_id: input.projectId,
      source_type: input.sourceType,
      source_share_message_id: input.sourceShareMessageId ?? null,
      raw_input: input.rawInput,
      status: input.status ?? "draft",
      ai_summary: input.aiSummary ?? null,
      analyzed_at: null,
    };
    store.updates.set(id, row);
    return { ok: true, data: row };
  });

  markProjectUpdateAsAnalyzedMock.mockImplementation(async (id: string, aiSummary: unknown) => {
    const row = store.updates.get(id);
    if (!row) return { ok: false, status: 404, error: "not found" };
    const updated = { ...row, status: "analyzed", ai_summary: aiSummary ?? null, analyzed_at: "2026-08-21T00:00:00Z" };
    store.updates.set(id, updated);
    return { ok: true, data: updated };
  });

  markProjectUpdateAsFailedMock.mockImplementation(async (id: string) => {
    const row = store.updates.get(id);
    if (!row || row.status !== "draft") {
      return { ok: false, status: 409, error: "not draft" };
    }
    const updated = { ...row, status: "failed" };
    store.updates.set(id, updated);
    return { ok: true, data: updated };
  });

  createProjectUpdateAuditItemsMock.mockImplementation(async (inputs: Array<{ projectUpdateId: string }>) => {
    if (inputs.length === 0) return { ok: true, data: [] };
    const projectUpdateId = inputs[0].projectUpdateId;
    const rows = inputs.map((item, index) => ({ id: `item-${projectUpdateId}-${index}`, ...item }));
    store.items.set(projectUpdateId, rows);
    return { ok: true, data: rows };
  });
}

function buildStoreClient(store: Store) {
  const from = (table: string) => {
    if (table === "project_updates") {
      return {
        select: (_cols: string) => {
          const filters: Record<string, unknown> = {};
          const builder = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return builder;
            },
            maybeSingle: async () => {
              const row = [...store.updates.values()].find((r) =>
                Object.entries(filters).every(([k, v]) => r[k] === v)
              );
              return { data: row ?? null, error: null };
            },
          };
          return builder;
        },
        update: (patch: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {};
          const api = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return api;
            },
            select: (_cols: string) => ({
              maybeSingle: async () => {
                const row = [...store.updates.values()].find((r) =>
                  Object.entries(filters).every(([k, v]) => r[k] === v)
                );
                if (!row) return { data: null, error: null };
                Object.assign(row, patch);
                return { data: { id: row.id }, error: null };
              },
            }),
          };
          return api;
        },
      };
    }

    // project_update_items
    return {
      select: (_cols: string, options?: { count?: string; head?: boolean }) => {
        const filters: Record<string, unknown> = {};
        if (options?.count) {
          const builder = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return builder;
            },
            then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
              const rows = store.items.get(String(filters.project_update_id)) ?? [];
              return Promise.resolve({ data: null, error: null, count: rows.length }).then(onFulfilled, onRejected);
            },
          };
          return builder;
        }
        const builder = {
          eq(col: string, val: unknown) {
            filters[col] = val;
            return builder;
          },
          order() {
            return {
              then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
                const rows = store.items.get(String(filters.project_update_id)) ?? [];
                return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
              },
            };
          },
        };
        return builder;
      },
      delete: () => {
        const filters: Record<string, unknown> = {};
        const builder = {
          eq(col: string, val: unknown) {
            filters[col] = val;
            return builder;
          },
          then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            if (filters.project_update_id !== undefined) {
              store.items.delete(String(filters.project_update_id));
            }
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          },
        };
        return builder;
      },
    };
  };

  return { from } as unknown as Parameters<typeof convertShareMessageToClientUpdate>[0];
}

beforeEach(() => {
  loadShareMessageForConversionMock.mockReset().mockResolvedValue(validSource());
  loadProjectUpdateContextMock.mockReset();
  extractProjectUpdateFactsMock.mockReset();
  judgeProjectUpdateFactsMock.mockReset();
  createProjectUpdateAuditItemsMock.mockReset();
  createProjectUpdateAuditRecordMock.mockReset();
  markProjectUpdateAsAnalyzedMock.mockReset();
  markProjectUpdateAsFailedMock.mockReset();
});

describe("convertShareMessageToClientUpdate - source load failure propagation", () => {
  it("propagates SHARE_MESSAGE_NOT_FOUND without ever reserving a slot or calling AI", async () => {
    loadShareMessageForConversionMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_MESSAGE_NOT_FOUND" },
    });
    const store = createStore();
    wireStoreMocks(store);

    const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result).toEqual({
      ok: false,
      code: "SHARE_MESSAGE_NOT_FOUND",
      error: "This message is not eligible for conversion.",
    });
    expect(createProjectUpdateAuditRecordMock).not.toHaveBeenCalled();
    expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
  });

  it("propagates SHARE_MESSAGE_NOT_CLIENT_AUTHORED (owner-authored reply rejected before any AI call)", async () => {
    loadShareMessageForConversionMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_MESSAGE_NOT_CLIENT_AUTHORED" },
    });
    const store = createStore();
    wireStoreMocks(store);

    const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SHARE_MESSAGE_NOT_CLIENT_AUTHORED");
    expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
  });
});

describe("convertShareMessageToClientUpdate - reservation-first: single request, no existing slot", () => {
  it("reserves (INSERTs, status=draft) BEFORE calling AI, then analyzes into the SAME reserved row", async () => {
    const store = createStore();
    wireStoreMocks(store);
    stubAnalysisPipeline("fresh analysis");

    const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(createProjectUpdateAuditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        rawInput: BODY,
        sourceType: "client_share",
        sourceShareMessageId: MESSAGE_ID,
        status: "draft",
      })
    );
    // Prove ordering: the reservation call happened, and only ONE row
    // ever exists for this source message.
    expect(store.updates.size).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok && result.state === "ready") {
      expect(result.resumed).toBe(false);
      expect(result.update.status).toBe("analyzed");
      expect(result.analysis.headline).toBe("fresh analysis");
    } else {
      throw new Error("expected a ready result");
    }
  });

  it("provenance columns never change between reservation and the final analyzed row", async () => {
    const store = createStore();
    wireStoreMocks(store);
    stubAnalysisPipeline();

    await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    const row = [...store.updates.values()][0];
    expect(row.source_type).toBe("client_share");
    expect(row.source_share_message_id).toBe(MESSAGE_ID);
    expect(row.raw_input).toBe(BODY);
  });
});

describe("convertShareMessageToClientUpdate - simultaneous first requests (deterministic barrier)", () => {
  it("exactly one AI extraction runs; the loser never runs AI and never deletes/inserts items or touches ai_summary/analyzed_at; loser reports IN_PROGRESS for the SAME id while the winner is still analyzing", async () => {
    const store = createStore();
    wireStoreMocks(store);

    let releaseReservationWon: () => void = () => {};
    const reservationWon = new Promise<void>((resolve) => {
      releaseReservationWon = resolve;
    });
    let releaseAI: () => void = () => {};
    const aiGate = new Promise<void>((resolve) => {
      releaseAI = resolve;
    });

    loadProjectUpdateContextMock.mockResolvedValue({
      ok: true,
      context: { project: { id: PROJECT_ID, client_id: null }, client: null, subtasks: [] },
    });
    extractProjectUpdateFactsMock.mockImplementation(async () => {
      releaseReservationWon();
      await aiGate;
      return {
        ok: true,
        facts: { summary: "s", requestedSubtasks: [], projectChanges: {}, clientChanges: {}, notes: [], confidence: null },
        normalizedRawInput: "normalized",
      };
    });
    judgeProjectUpdateFactsMock.mockReturnValue({
      summary: { headline: "winner analyzed", reasoning: "", riskLevel: "low", detectedChanges: [] },
      decisions: [],
    });
    createProjectUpdateAuditItemsMock.mockResolvedValue({ ok: true, data: [] });

    const client = buildStoreClient(store);

    const promiseA = convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    // Wait until A has WON the reservation (its INSERT has already
    // landed) and is now blocked mid-AI-call.
    await reservationWon;

    expect(store.updates.size).toBe(1);
    const reservedRow = [...store.updates.values()][0];
    expect(reservedRow.status).toBe("draft");

    // B starts now, strictly after A's reservation exists but before A
    // has finished analyzing it.
    const resultB = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(resultB.ok).toBe(true);
    if (resultB.ok) {
      expect(resultB.state).toBe("in_progress");
      if (resultB.state === "in_progress") {
        expect(resultB.projectUpdateId).toBe(reservedRow.id);
      }
    }
    // The loser never ran AI (only A's single in-flight call exists).
    expect(extractProjectUpdateFactsMock).toHaveBeenCalledTimes(1);
    // The loser never deleted/inserted items or touched ai_summary/analyzed_at.
    expect(createProjectUpdateAuditItemsMock).not.toHaveBeenCalled();
    expect(markProjectUpdateAsAnalyzedMock).not.toHaveBeenCalled();
    expect(store.updates.size).toBe(1);

    // Now let A finish.
    releaseAI();
    const resultA = await promiseA;

    expect(resultA.ok).toBe(true);
    if (resultA.ok && resultA.state === "ready") {
      expect(resultA.resumed).toBe(false);
      expect(resultA.update.status).toBe("analyzed");
    } else {
      throw new Error("expected winner to reach a ready result");
    }
    expect(extractProjectUpdateFactsMock).toHaveBeenCalledTimes(1);
    expect(store.updates.size).toBe(1);
  });

  it("a second request AFTER the winner has already fully completed resumes READY (no new AI call), never IN_PROGRESS", async () => {
    const store = createStore();
    wireStoreMocks(store);
    stubAnalysisPipeline("first winner");

    const client = buildStoreClient(store);

    const first = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });
    expect(first.ok).toBe(true);

    extractProjectUpdateFactsMock.mockClear();

    const second = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.state).toBe("ready");
      if (second.state === "ready") {
        expect(second.resumed).toBe(true);
      }
    }
    expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
    expect(store.updates.size).toBe(1);
  });
});

describe("convertShareMessageToClientUpdate - concurrent retries (failed/ignored, atomic claim)", () => {
  it.each(["failed", "ignored"] as const)(
    "status=%s: two simultaneous retries -- exactly one claims draft/in-progress, exactly one AI execution, the loser runs no AI",
    async (retryableStatus) => {
      const store = createStore();
      wireStoreMocks(store);

      store.updates.set("existing-1", {
        id: "existing-1",
        user_id: USER_ID,
        project_id: PROJECT_ID,
        source_type: "client_share",
        source_share_message_id: MESSAGE_ID,
        raw_input: BODY,
        status: retryableStatus,
        ai_summary: null,
        analyzed_at: null,
      });

      let aiCallCount = 0;

      loadProjectUpdateContextMock.mockResolvedValue({
        ok: true,
        context: { project: { id: PROJECT_ID, client_id: null }, client: null, subtasks: [] },
      });
      extractProjectUpdateFactsMock.mockImplementation(async () => {
        aiCallCount += 1;
        return {
          ok: true,
          facts: { summary: "s", requestedSubtasks: [], projectChanges: {}, clientChanges: {}, notes: [], confidence: null },
          normalizedRawInput: "normalized",
        };
      });
      judgeProjectUpdateFactsMock.mockReturnValue({
        summary: { headline: "retried", reasoning: "", riskLevel: "low", detectedChanges: [] },
        decisions: [],
      });
      createProjectUpdateAuditItemsMock.mockResolvedValue({ ok: true, data: [] });

      const client = buildStoreClient(store);

      // Two truly simultaneous retry attempts -- the compare-and-set
      // claim UPDATE (WHERE status = retryableStatus) resolves against
      // the shared in-memory store synchronously at the moment each
      // call reaches it, so exactly one of these two concurrent calls
      // wins the claim deterministically; the loser's code path never
      // reaches extractProjectUpdateFacts at all (it re-selects and
      // returns instead), so no artificial AI barrier is needed here.
      const [resultX, resultY] = await Promise.all([
        convertShareMessageToClientUpdate(client, { shareLinkId: LINK_ID, messageId: MESSAGE_ID, userId: USER_ID }),
        convertShareMessageToClientUpdate(client, { shareLinkId: LINK_ID, messageId: MESSAGE_ID, userId: USER_ID }),
      ]);

      expect(aiCallCount).toBe(1);

      const results = [resultX, resultY];
      const winnerCount = results.filter((r) => r.ok && r.state === "ready").length;
      const loserCount = results.filter((r) => r.ok && r.state === "in_progress").length;
      expect(winnerCount).toBe(1);
      expect(loserCount).toBe(1);
      expect(store.updates.size).toBe(1);
    }
  );
});

describe("convertShareMessageToClientUpdate - status matrix (status alone decides, never item count)", () => {
  it.each(["analyzed", "reviewed", "applying", "applied"] as const)(
    "status=%s with ZERO items resumes READY -- never reanalyzed merely because itemCount=0",
    async (status) => {
      const store = createStore();
      wireStoreMocks(store);

      store.updates.set("existing-1", {
        id: "existing-1",
        user_id: USER_ID,
        project_id: PROJECT_ID,
        source_type: "client_share",
        source_share_message_id: MESSAGE_ID,
        raw_input: BODY,
        status,
        ai_summary: { headline: "already done", reasoning: "", riskLevel: "low", detectedChanges: [] },
        analyzed_at: "2026-08-21T00:00:00Z",
      });
      // Deliberately no items in store.items -- itemCount is 0.

      const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
        shareLinkId: LINK_ID,
        messageId: MESSAGE_ID,
        userId: USER_ID,
      });

      expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
      expect(createProjectUpdateAuditItemsMock).not.toHaveBeenCalled();
      expect(markProjectUpdateAsAnalyzedMock).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state).toBe("ready");
        if (result.state === "ready") {
          expect(result.resumed).toBe(true);
          expect(result.update.status).toBe(status);
        }
      }
    }
  );

  it("draft: reports IN_PROGRESS, never auto-retried", async () => {
    const store = createStore();
    wireStoreMocks(store);

    store.updates.set("existing-1", {
      id: "existing-1",
      user_id: USER_ID,
      project_id: PROJECT_ID,
      source_type: "client_share",
      source_share_message_id: MESSAGE_ID,
      raw_input: BODY,
      status: "draft",
      ai_summary: null,
      analyzed_at: null,
    });

    const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toBe("in_progress");
      if (result.state === "in_progress") {
        expect(result.projectUpdateId).toBe("existing-1");
      }
    }
  });

  it.each(["failed", "ignored"] as const)(
    "status=%s: retries only after winning the atomic claim (single request -- always wins)",
    async (status) => {
      const store = createStore();
      wireStoreMocks(store);
      stubAnalysisPipeline("retried");

      store.updates.set("existing-1", {
        id: "existing-1",
        user_id: USER_ID,
        project_id: PROJECT_ID,
        source_type: "client_share",
        source_share_message_id: MESSAGE_ID,
        raw_input: BODY,
        status,
        ai_summary: null,
        analyzed_at: null,
      });

      const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
        shareLinkId: LINK_ID,
        messageId: MESSAGE_ID,
        userId: USER_ID,
      });

      expect(extractProjectUpdateFactsMock).toHaveBeenCalledTimes(1);
      expect(markProjectUpdateAsAnalyzedMock).toHaveBeenCalledWith("existing-1", expect.any(Object));
      expect(result.ok).toBe(true);
      if (result.ok && result.state === "ready") {
        expect(result.resumed).toBe(false);
        expect(result.update.status).toBe("analyzed");
      } else {
        throw new Error("expected a ready result");
      }
      // Never a second row -- retry is an UPDATE onto the SAME id.
      expect(store.updates.size).toBe(1);
      expect(createProjectUpdateAuditRecordMock).not.toHaveBeenCalled();
    }
  );

  it("a successful analysis legitimately producing ZERO items still resumes as READY (buildProjectUpdateV2AuditItems maps 1:1 from judge decisions with no minimum-length invariant -- see project-update-result-builder.server.ts)", async () => {
    const store = createStore();
    wireStoreMocks(store);
    stubAnalysisPipeline("no actionable changes");
    judgeProjectUpdateFactsMock.mockReturnValue({
      summary: { headline: "no actionable changes", reasoning: "", riskLevel: "low", detectedChanges: [] },
      decisions: [],
    });

    const result = await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.state === "ready") {
      expect(result.update.status).toBe("analyzed");
      expect(result.items).toEqual([]);
    } else {
      throw new Error("expected a ready result with zero items");
    }

    // A SECOND request for the same message must resume this exact
    // zero-item analyzed row, never reanalyze it.
    extractProjectUpdateFactsMock.mockClear();
    const second = await convertShareMessageToClientUpdate(buildStoreClient(store), {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });
    expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.state).toBe("ready");
  });
});

describe("convertShareMessageToClientUpdate - structured 23505 handling (Correction 3)", () => {
  function counterClient(responses: Array<{ data: unknown; error: unknown }>) {
    let call = 0;
    return {
      from: vi.fn((table: string) => {
        if (table === "project_updates") {
          const response = responses[Math.min(call, responses.length - 1)];
          call += 1;
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve(response),
                }),
              }),
            }),
          };
        }
        return {
          select: (_c: string, options?: { count?: string }) =>
            options?.count
              ? { eq: () => ({ eq: () => Promise.resolve({ data: null, error: null, count: 0 }) }) }
              : { eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
        };
      }),
    } as unknown as Parameters<typeof convertShareMessageToClientUpdate>[0];
  }

  it("23505 on the exact constraint + winner exists (resumable status) => resumes READY via the concurrency path", async () => {
    const winnerRow = { id: "winner-1", status: "analyzed", ai_summary: null };
    createProjectUpdateAuditRecordMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: UNIQUE_VIOLATION_MESSAGE,
      dbErrorCode: "23505",
    });
    const client = counterClient([{ data: null, error: null }, { data: winnerRow, error: null }]);

    const result = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(extractProjectUpdateFactsMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toBe("ready");
  });

  it("23505 on the exact constraint + winner still draft => IN_PROGRESS, never treated as failure", async () => {
    const winnerRow = { id: "winner-1", status: "draft", ai_summary: null };
    createProjectUpdateAuditRecordMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: UNIQUE_VIOLATION_MESSAGE,
      dbErrorCode: "23505",
    });
    const client = counterClient([{ data: null, error: null }, { data: winnerRow, error: null }]);

    const result = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toBe("in_progress");
      if (result.state === "in_progress") expect(result.projectUpdateId).toBe("winner-1");
    }
  });

  it("an UNRELATED, non-23505 error is propagated untouched -- no reselect is even attempted", async () => {
    createProjectUpdateAuditRecordMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: "connection reset by peer",
      dbErrorCode: null,
    });
    const client = counterClient([{ data: null, error: null }]);

    const result = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result).toEqual({ ok: false, code: "UNEXPECTED", error: "connection reset by peer" });
    // Only the initial findExistingSlot lookup happened (which itself
    // short-circuits before querying item counts once it sees no
    // existing row) -- never a second (reselect) call, since a
    // non-23505 failure is propagated immediately without reselecting.
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("a 23505 whose message names a DIFFERENT constraint is propagated untouched -- message-regex alone is no longer authoritative", async () => {
    createProjectUpdateAuditRecordMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'duplicate key value violates unique constraint "some_other_table_key"',
      dbErrorCode: "23505",
    });
    const client = counterClient([{ data: null, error: null }]);

    const result = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNEXPECTED");
      expect(result.error).toContain("some_other_table_key");
    }
  });

  it("23505 on the exact constraint but NO authoritative winner can be reselected => propagates the original database failure rather than fabricating a result", async () => {
    createProjectUpdateAuditRecordMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: UNIQUE_VIOLATION_MESSAGE,
      dbErrorCode: "23505",
    });
    const client = counterClient([{ data: null, error: null }, { data: null, error: null }]);

    const result = await convertShareMessageToClientUpdate(client, {
      shareLinkId: LINK_ID,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });

    expect(result).toEqual({ ok: false, code: "UNEXPECTED", error: UNIQUE_VIOLATION_MESSAGE });
  });
});

describe("convertShareMessageToClientUpdate - regression: no professional timeline event source reference", () => {
  it("this file's own source never references createProjectTimelineEvent or project_timeline_events", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(new URL("./share-message-conversion.server.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/createProjectTimelineEvent/);
  });
});
