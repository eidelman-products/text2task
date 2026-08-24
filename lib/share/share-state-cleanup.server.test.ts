import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
vi.mock("next/server", () => ({
  after: (callback: () => unknown) => afterMock(callback),
}));

type TableName = "share_rate_limit_buckets" | "share_session_grants" | "share_browser_sessions";

const adminConfig: {
  staleRows: Partial<Record<TableName, Array<{ id: string }>>>;
  selectError: Partial<Record<TableName, unknown>>;
  deleteError: Partial<Record<TableName, unknown>>;
} = {
  staleRows: {},
  selectError: {},
  deleteError: {},
};

const selectCalls: Array<{ table: TableName; lt: [string, string]; limit: number }> = [];
const deleteCalls: Array<{ table: TableName; ids: string[] }> = [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: TableName) => ({
      select: (columns: string) => ({
        lt: (column: string, value: string) => ({
          limit: (n: number) => {
            selectCalls.push({ table, lt: [column, value], limit: n });
            return Promise.resolve({
              data: adminConfig.staleRows[table] ?? [],
              error: adminConfig.selectError[table] ?? null,
            });
          },
        }),
      }),
      delete: () => ({
        in: (column: string, ids: string[]) => {
          deleteCalls.push({ table, ids });
          return Promise.resolve({ error: adminConfig.deleteError[table] ?? null });
        },
      }),
    }),
  },
}));

const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

const { maybeScheduleShareStateCleanup } = await import("./share-state-cleanup.server");

beforeEach(() => {
  afterMock.mockReset();
  adminConfig.staleRows = {};
  adminConfig.selectError = {};
  adminConfig.deleteError = {};
  selectCalls.length = 0;
  deleteCalls.length = 0;
  consoleWarnSpy.mockClear();
});

async function runScheduledCleanup(): Promise<void> {
  expect(afterMock).toHaveBeenCalledTimes(1);
  const scheduledCallback = afterMock.mock.calls[0][0] as () => Promise<void>;
  await scheduledCallback();
}

describe("maybeScheduleShareStateCleanup - probabilistic scheduling", () => {
  it("schedules via next/server's after() when the random draw hits", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0); // always below the trigger probability

    maybeScheduleShareStateCleanup();

    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the random draw misses", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99); // always above the trigger probability

    maybeScheduleShareStateCleanup();

    expect(afterMock).not.toHaveBeenCalled();
  });

  it("never throws even if after() itself throws", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0);
    afterMock.mockImplementationOnce(() => {
      throw new Error("after() unavailable outside request scope");
    });

    expect(() => maybeScheduleShareStateCleanup()).not.toThrow();
  });
});

describe("maybeScheduleShareStateCleanup - the scheduled cleanup pass itself", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0); // always schedule, for these tests
  });

  it("sweeps all three tables, filtering by expires_at only (never revoked_at)", async () => {
    maybeScheduleShareStateCleanup();
    await runScheduledCleanup();

    const tables = selectCalls.map((call) => call.table);
    expect(tables).toEqual([
      "share_rate_limit_buckets",
      "share_session_grants",
      "share_browser_sessions",
    ]);
    for (const call of selectCalls) {
      expect(call.lt[0]).toBe("expires_at");
      expect(call.limit).toBeLessThanOrEqual(200);
    }
  });

  it("uses a cutoff safely in the past (grace period), never the exact current instant", async () => {
    const before = Date.now();
    maybeScheduleShareStateCleanup();
    await runScheduledCleanup();
    const after = Date.now();

    for (const call of selectCalls) {
      const cutoffMs = Date.parse(call.lt[1]);
      // The cutoff must be strictly earlier than "now" by at least an hour
      // -- proves a grace period is actually applied, not merely "now()".
      expect(cutoffMs).toBeLessThan(before - 60 * 60 * 1000);
      expect(cutoffMs).toBeLessThan(after);
    }
  });

  it("deletes exactly the stale rows a table's own select returned, and nothing else", async () => {
    adminConfig.staleRows.share_rate_limit_buckets = [{ id: "bucket-1" }, { id: "bucket-2" }];
    adminConfig.staleRows.share_session_grants = [{ id: "grant-1" }];
    adminConfig.staleRows.share_browser_sessions = [];

    maybeScheduleShareStateCleanup();
    await runScheduledCleanup();

    expect(deleteCalls).toEqual([
      { table: "share_rate_limit_buckets", ids: ["bucket-1", "bucket-2"] },
      { table: "share_session_grants", ids: ["grant-1"] },
      // share_browser_sessions: zero stale rows found -> no delete call at all.
    ]);
  });

  it("never deletes still-valid (non-stale) rows -- an empty select result triggers no delete call", async () => {
    adminConfig.staleRows = {
      share_rate_limit_buckets: [],
      share_session_grants: [],
      share_browser_sessions: [],
    };

    maybeScheduleShareStateCleanup();
    await runScheduledCleanup();

    expect(deleteCalls).toHaveLength(0);
  });

  it("a select failure on one table is logged and does not stop the other tables from being swept", async () => {
    adminConfig.selectError.share_rate_limit_buckets = { message: "boom" };
    adminConfig.staleRows.share_session_grants = [{ id: "grant-1" }];

    maybeScheduleShareStateCleanup();
    await runScheduledCleanup();

    expect(deleteCalls).toEqual([{ table: "share_session_grants", ids: ["grant-1"] }]);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("a delete failure on one table is logged and does not stop the other tables from being swept", async () => {
    adminConfig.staleRows.share_rate_limit_buckets = [{ id: "bucket-1" }];
    adminConfig.deleteError.share_rate_limit_buckets = { message: "delete boom" };
    adminConfig.staleRows.share_session_grants = [{ id: "grant-1" }];

    maybeScheduleShareStateCleanup();
    await runScheduledCleanup();

    expect(deleteCalls).toEqual([
      { table: "share_rate_limit_buckets", ids: ["bucket-1"] },
      { table: "share_session_grants", ids: ["grant-1"] },
    ]);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("never throws out of the scheduled callback even on repeated failures", async () => {
    adminConfig.selectError.share_rate_limit_buckets = { message: "boom 1" };
    adminConfig.selectError.share_session_grants = { message: "boom 2" };
    adminConfig.selectError.share_browser_sessions = { message: "boom 3" };

    maybeScheduleShareStateCleanup();

    await expect(runScheduledCleanup()).resolves.toBeUndefined();
  });
});
