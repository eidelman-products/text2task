import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => insertMock(table, row),
    }),
  },
}));

const { logProductEventSafe, computeProductEventIdempotencyKey } =
  await import("./log-product-event.server");

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const VALID_NAVIGATION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_NAVIGATION_ID = "33333333-3333-4333-8333-333333333333";
const VALID_PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const VALID_CALENDAR_EVENT_ID = "55555555-5555-4555-8555-555555555555";
const VALID_CALENDAR_DAY = "2027-03-15";

function okInsertResponse() {
  return Promise.resolve({ data: null, error: null });
}

function duplicateInsertResponse() {
  return Promise.resolve({
    data: null,
    error: { code: "23505", message: "duplicate key value violates unique constraint" },
  });
}

function genuineFailureInsertResponse() {
  return Promise.resolve({
    data: null,
    error: { code: "23514", message: "new row violates check constraint" },
  });
}

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockImplementation(okInsertResponse);
});

describe("logProductEventSafe - happy path", () => {
  it("produces the exact insert payload for a valid authenticated bare event", async () => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "recorded" });
    expect(insertMock).toHaveBeenCalledTimes(1);

    const [table, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(table).toBe("authenticated_product_events");
    expect(row).toMatchObject({
      user_id: VALID_USER_ID,
      event_name: "dashboard_viewed",
      route: "/dashboard",
      entity_type: null,
      entity_id: null,
    });
    expect(typeof row.idempotency_key).toBe("string");
    expect((row.idempotency_key as string).length).toBeGreaterThan(0);
  });

  it("inserts exactly the six expected columns and nothing else", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    const [, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(row).sort()).toEqual(
      [
        "entity_id",
        "entity_type",
        "event_name",
        "idempotency_key",
        "route",
        "user_id",
      ].sort()
    );
  });

  it("normalizes the route through the Phase 1 validator (strips query string)", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "extract_viewed", route: "/dashboard?view=extract&x=1" },
    });

    const [, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.route).toBe("/dashboard");
  });

  it("inserts the correct project entity", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: {
        eventName: "project_details_expanded",
        route: "/dashboard",
        entityType: "project",
        entityId: VALID_PROJECT_ID,
      },
    });

    const [, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.entity_type).toBe("project");
    expect(row.entity_id).toBe(VALID_PROJECT_ID);
  });

  it("inserts the correct calendar-event entity", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: {
        eventName: "calendar_event_viewed",
        route: "/dashboard/calendar",
        entityType: "calendar_event",
        entityId: VALID_CALENDAR_EVENT_ID,
      },
    });

    const [, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.entity_type).toBe("calendar_event");
    expect(row.entity_id).toBe(VALID_CALENDAR_EVENT_ID);
  });

  it("inserts the correct calendar-day entity", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: {
        eventName: "calendar_day_viewed",
        route: "/dashboard/calendar",
        entityType: "calendar_day",
        entityId: VALID_CALENDAR_DAY,
      },
    });

    const [, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.entity_type).toBe("calendar_day");
    expect(row.entity_id).toBe(VALID_CALENDAR_DAY);
  });

  it("inserts null entity fields for a top-level page view", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "tasks_viewed", route: "/dashboard" },
    });

    const [, row] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.entity_type).toBeNull();
    expect(row.entity_id).toBeNull();
  });
});

describe("logProductEventSafe - user_id trust boundary", () => {
  it("always uses the trusted function argument for user_id, never a value from the event payload", async () => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      // Attempting to smuggle a different user id inside the untrusted
      // event payload is rejected outright by validateProductEventInput's
      // own .strict() schema -- there is no code path where it could
      // silently override the trusted argument.
      event: {
        eventName: "dashboard_viewed",
        route: "/dashboard",
        userId: OTHER_USER_ID,
      },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_shape" });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("logProductEventSafe - rejects trusted-only fields inside the event payload", () => {
  it.each([
    ["createdAt", { createdAt: "2020-01-01T00:00:00.000Z" }],
    ["idempotencyKey", { idempotencyKey: "attacker-chosen" }],
    ["metadata", { metadata: { note: "anything" } }],
  ])("rejects a payload containing %s and writes nothing", async (_label, extra) => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard", ...extra },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_shape" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects arbitrary sensitive-sounding free-form content and writes nothing", async () => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: {
        eventName: "dashboard_viewed",
        route: "/dashboard",
        clientMessage: "this must never be stored",
      },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_shape" });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("logProductEventSafe - invalid payload never writes", () => {
  it("rejects an unknown event name and writes nothing", async () => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "made_up_event", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_shape" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed user id and writes nothing", async () => {
    const result = await logProductEventSafe({
      userId: "not-a-uuid",
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_user_id" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed navigationId and writes nothing", async () => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: "not-a-uuid",
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_navigation_id" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a missing/undefined navigationId and writes nothing", async () => {
    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: undefined,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid_navigation_id" });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("logProductEventSafe - idempotency key determinism", () => {
  it("computeProductEventIdempotencyKey is deterministic for identical input", () => {
    const args = {
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      eventName: "dashboard_viewed",
      route: "/dashboard",
      entityType: null,
      entityId: null,
    } as const;

    expect(computeProductEventIdempotencyKey(args)).toBe(
      computeProductEventIdempotencyKey(args)
    );
  });

  it("a retried delivery of the same logical event produces the same idempotency_key", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    const [, firstRow] = insertMock.mock.calls[0] as [string, Record<string, unknown>];
    const [, secondRow] = insertMock.mock.calls[1] as [string, Record<string, unknown>];
    expect(firstRow.idempotency_key).toBe(secondRow.idempotency_key);
  });

  it("a different navigationId produces a different idempotency_key", () => {
    const base = {
      userId: VALID_USER_ID,
      eventName: "dashboard_viewed",
      route: "/dashboard",
      entityType: null,
      entityId: null,
    } as const;

    const first = computeProductEventIdempotencyKey({ ...base, navigationId: VALID_NAVIGATION_ID });
    const second = computeProductEventIdempotencyKey({ ...base, navigationId: OTHER_NAVIGATION_ID });
    expect(first).not.toBe(second);
  });

  it("a different authenticated user produces a different idempotency_key", () => {
    const base = {
      navigationId: VALID_NAVIGATION_ID,
      eventName: "dashboard_viewed",
      route: "/dashboard",
      entityType: null,
      entityId: null,
    } as const;

    const first = computeProductEventIdempotencyKey({ ...base, userId: VALID_USER_ID });
    const second = computeProductEventIdempotencyKey({ ...base, userId: OTHER_USER_ID });
    expect(first).not.toBe(second);
  });

  it("a different event name produces a different idempotency_key", () => {
    const base = {
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      route: "/dashboard",
      entityType: null,
      entityId: null,
    } as const;

    const first = computeProductEventIdempotencyKey({ ...base, eventName: "dashboard_viewed" });
    const second = computeProductEventIdempotencyKey({ ...base, eventName: "tasks_viewed" });
    expect(first).not.toBe(second);
  });

  it("a different route produces a different idempotency_key", () => {
    const base = {
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      eventName: "dashboard_viewed",
      entityType: null,
      entityId: null,
    } as const;

    const first = computeProductEventIdempotencyKey({ ...base, route: "/dashboard" });
    const second = computeProductEventIdempotencyKey({ ...base, route: "/dashboard/calendar" });
    expect(first).not.toBe(second);
  });

  it("a different entity produces a different idempotency_key", () => {
    const base = {
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      eventName: "project_details_expanded",
      route: "/dashboard",
    } as const;

    const first = computeProductEventIdempotencyKey({
      ...base,
      entityType: "project",
      entityId: VALID_PROJECT_ID,
    });
    const second = computeProductEventIdempotencyKey({
      ...base,
      entityType: "project",
      entityId: VALID_CALENDAR_EVENT_ID,
    });
    expect(first).not.toBe(second);
  });
});

describe("logProductEventSafe - duplicate and failure handling", () => {
  it("treats a unique-index conflict (Postgres 23505) as a successful duplicate", async () => {
    insertMock.mockImplementation(duplicateInsertResponse);

    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "duplicate" });
  });

  it("treats a genuine (non-duplicate) database error as failed", async () => {
    insertMock.mockImplementation(genuineFailureInsertResponse);

    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "failed" });
  });

  it("treats a thrown exception from the database client as failed, never throwing", async () => {
    insertMock.mockImplementation(() => {
      throw new Error("network error");
    });

    const result = await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    expect(result).toEqual({ status: "failed" });
  });
});

describe("logProductEventSafe - table isolation", () => {
  it("only ever writes to authenticated_product_events, never analytics_events", async () => {
    await logProductEventSafe({
      userId: VALID_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: { eventName: "dashboard_viewed", route: "/dashboard" },
    });

    for (const call of insertMock.mock.calls) {
      expect(call[0]).toBe("authenticated_product_events");
    }
  });

  it("never queries analytics_events, an owner-report RPC, or a product-domain table (prose mentioning their absence in comments is fine)", () => {
    const source = readFileSync(
      path.join(__dirname, "log-product-event.server.ts"),
      "utf8"
    );

    // Only one real Supabase call exists anywhere in this file: the single
    // .from("authenticated_product_events") used by the insert helper.
    const fromCalls = source.match(/\.from\(\s*["'`][a-z_]+["'`]\s*\)/g) ?? [];
    expect(fromCalls).toEqual(['.from("authenticated_product_events")']);

    // No .rpc(...) call of any kind exists in this file at all.
    expect(source).not.toMatch(/\.rpc\(/);
  });
});
