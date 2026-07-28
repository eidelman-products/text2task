import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();

type TableScript = {
  select?: { data: Record<string, unknown> | null; error?: unknown };
  update?: { data: Record<string, unknown> | null; error?: unknown };
};

let tables: Record<string, TableScript> = {};
const updateCalls: Record<string, unknown>[] = [];

function makeChain(response: { data: unknown; error?: unknown }) {
  const chain = {
    eq() {
      return chain;
    },
    select() {
      return chain;
    },
    single() {
      return Promise.resolve({ data: response.data, error: response.error ?? null });
    },
    then(onFulfilled: (value: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve({ data: response.data, error: response.error ?? null }).then(
        onFulfilled
      );
    },
  };
  return chain;
}

const tableClient = {
  from(table: string) {
    const script = tables[table] ?? {};

    return {
      select() {
        return makeChain(script.select ?? { data: null });
      },
      update(row: Record<string, unknown>) {
        updateCalls.push({ table, row });
        return makeChain(script.update ?? { data: null });
      },
    };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock }, ...tableClient }),
}));

const { DELETE, PATCH } = await import("./route");

const EVENT_ID = "33333333-3333-4333-8333-333333333333";

function buildPatchRequest(id: string, body: unknown) {
  return {
    request: new NextRequest(`http://localhost/api/calendar/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

function buildDeleteRequest(id: string) {
  return {
    request: new NextRequest(`http://localhost/api/calendar/events/${id}`, {
      method: "DELETE",
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

beforeEach(() => {
  getUserMock.mockReset();
  tables = {};
  updateCalls.length = 0;
});

describe("PATCH /api/calendar/events/:id", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { request, context } = buildPatchRequest(EVENT_ID, { title: "New title" });

    const response = await PATCH(request, context);

    expect(response.status).toBe(401);
  });

  it("rejects an invalid event id before touching the database", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const { request, context } = buildPatchRequest("not-a-uuid", { title: "New title" });

    const response = await PATCH(request, context);

    expect(response.status).toBe(400);
  });

  it("rejects an empty update body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const { request, context } = buildPatchRequest(EVENT_ID, {});

    const response = await PATCH(request, context);

    expect(response.status).toBe(400);
  });

  it("returns 404 for another user's event (row not visible under this user's scope)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = { calendar_events: { select: { data: null } } };
    const { request, context } = buildPatchRequest(EVENT_ID, { title: "New title" });

    const response = await PATCH(request, context);

    expect(response.status).toBe(404);
  });

  it("allows explicitly clearing eventTime via null", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = {
      calendar_events: {
        select: {
          data: { id: EVENT_ID, project_id: null, client_id: null, deleted_at: null },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            client_id: null,
          },
        },
      },
    };
    const { request, context } = buildPatchRequest(EVENT_ID, { eventTime: null });

    const response = await PATCH(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.item.time).toBeNull();
  });

  it("never writes to the projects table", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = {
      calendar_events: {
        select: {
          data: { id: EVENT_ID, project_id: null, client_id: null, deleted_at: null },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "New title",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            client_id: null,
          },
        },
      },
    };
    const { request, context } = buildPatchRequest(EVENT_ID, { title: "New title" });

    await PATCH(request, context);

    expect(updateCalls.some((entry) => entry.table === "projects")).toBe(false);
  });
});

describe("DELETE /api/calendar/events/:id", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { request, context } = buildDeleteRequest(EVENT_ID);

    const response = await DELETE(request, context);

    expect(response.status).toBe(401);
  });

  it("rejects an invalid event id", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const { request, context } = buildDeleteRequest("not-a-uuid");

    const response = await DELETE(request, context);

    expect(response.status).toBe(400);
  });

  it("soft-deletes an owned event", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = {
      calendar_events: {
        select: { data: { id: EVENT_ID, deleted_at: null } },
        update: { data: {} },
      },
    };
    const { request, context } = buildDeleteRequest(EVENT_ID);

    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, alreadyDeleted: false });
  });

  it("is idempotent for a repeated delete of an already-deleted, owned event", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = {
      calendar_events: {
        select: {
          data: { id: EVENT_ID, deleted_at: "2027-01-01T00:00:00.000Z" },
        },
      },
    };
    const { request, context } = buildDeleteRequest(EVENT_ID);

    const response = await DELETE(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, alreadyDeleted: true });
    expect(updateCalls).toHaveLength(0);
  });

  it("returns 404 for another user's event", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = { calendar_events: { select: { data: null } } };
    const { request, context } = buildDeleteRequest(EVENT_ID);

    const response = await DELETE(request, context);

    expect(response.status).toBe(404);
  });

  it("never hard-deletes (only ever issues an update)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    tables = {
      calendar_events: {
        select: { data: { id: EVENT_ID, deleted_at: null } },
        update: { data: {} },
      },
    };
    const { request, context } = buildDeleteRequest(EVENT_ID);

    await DELETE(request, context);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe("calendar_events");
    expect(Object.keys(updateCalls[0].row as Record<string, unknown>)).toEqual([
      "deleted_at",
    ]);
  });
});
