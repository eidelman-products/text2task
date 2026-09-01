import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Phase 4B -- first test file for this module. logAnalyticsEventSafe's
  idempotency-collision handling (analytics_events_idempotency_key_unique_idx,
  supabase/migrations/202606190001_analytics_events.sql) already existed and
  was already proven in production via signup-attribution.server.ts -- this
  phase is the first time it is actually exercised for page_view events
  (app/api/analytics/event/route.ts now derives and passes an
  idempotencyKey). These tests protect exactly that: a duplicate send of the
  SAME logical page view must collide safely (no thrown error, no noisy
  warning -- it's an expected, benign outcome), while two genuinely
  different page views must both succeed as separate rows.
*/

const insertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => insertMock(table, row),
    }),
  },
}));

const { logAnalyticsEventSafe } = await import("./internal-events.server");

function okInsertResponse() {
  return Promise.resolve({ data: null, error: null });
}

function duplicateIdempotencyKeyErrorResponse() {
  return Promise.resolve({
    data: null,
    error: {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    },
  });
}

function genuineFailureResponse() {
  return Promise.resolve({
    data: null,
    error: { code: "23514", message: "new row violates check constraint" },
  });
}

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockImplementation(okInsertResponse);
});

describe("logAnalyticsEventSafe - page_view idempotency (Phase 4B)", () => {
  it("a fresh page_view with an idempotency key inserts successfully", async () => {
    const result = await logAnalyticsEventSafe({
      eventName: "page_view",
      anonymousId: "anon-123",
      pagePath: "/pricing",
      idempotencyKey: "page_view:anon-123:22222222-2222-4222-8222-222222222222",
    });

    expect(result).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const [table, row] = insertMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(table).toBe("analytics_events");
    expect(row.event_name).toBe("page_view");
    expect(row.idempotency_key).toBe(
      "page_view:anon-123:22222222-2222-4222-8222-222222222222"
    );
  });

  it("a duplicate idempotency key collision (23505) is treated as a safe no-op, not a failure", async () => {
    insertMock.mockImplementation(duplicateIdempotencyKeyErrorResponse);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await logAnalyticsEventSafe({
      eventName: "page_view",
      anonymousId: "anon-123",
      pagePath: "/pricing",
      idempotencyKey: "page_view:anon-123:22222222-2222-4222-8222-222222222222",
    });

    expect(result).toBe(false);
    // The whole point of idempotency: a resend of the same logical event
    // is expected, not an error -- it must not be logged as a warning.
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("a genuine insert failure (not an idempotency collision) is still logged as a warning", async () => {
    insertMock.mockImplementation(genuineFailureResponse);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await logAnalyticsEventSafe({
      eventName: "page_view",
      anonymousId: "anon-123",
      pagePath: "/pricing",
      idempotencyKey: "page_view:anon-123:22222222-2222-4222-8222-222222222222",
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("two different idempotency keys for the same anonymousId both insert as separate rows", async () => {
    await logAnalyticsEventSafe({
      eventName: "page_view",
      anonymousId: "anon-123",
      pagePath: "/pricing",
      idempotencyKey: "page_view:anon-123:22222222-2222-4222-8222-222222222222",
    });
    await logAnalyticsEventSafe({
      eventName: "page_view",
      anonymousId: "anon-123",
      pagePath: "/",
      idempotencyKey: "page_view:anon-123:33333333-3333-4333-8333-333333333333",
    });

    expect(insertMock).toHaveBeenCalledTimes(2);
    const firstRow = insertMock.mock.calls[0][1] as Record<string, unknown>;
    const secondRow = insertMock.mock.calls[1][1] as Record<string, unknown>;
    expect(firstRow.idempotency_key).not.toBe(secondRow.idempotency_key);
  });

  it("a null idempotency key (no pageViewId available) still inserts, exactly like before this phase", async () => {
    const result = await logAnalyticsEventSafe({
      eventName: "page_view",
      anonymousId: "anon-123",
      pagePath: "/",
      idempotencyKey: null,
    });

    expect(result).toBe(true);
    const [, row] = insertMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(row.idempotency_key).toBeNull();
  });
});
