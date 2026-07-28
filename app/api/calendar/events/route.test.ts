import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();

type TableScript = {
  select?: { data: Record<string, unknown> | null; error?: unknown };
  insert?: { data: Record<string, unknown> | null; error?: unknown };
};

let tables: Record<string, TableScript> = {};
const insertedRows: Record<string, unknown>[] = [];

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
      insert(row: Record<string, unknown>) {
        insertedRows.push({ table, row });
        return makeChain(script.insert ?? { data: null });
      },
    };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock }, ...tableClient }),
}));

const { POST } = await import("./route");

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost/api/calendar/events", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID_BODY = {
  title: "Send first draft",
  eventDate: "2027-01-10",
  eventTime: null,
  notes: null,
  projectId: null,
  clientId: null,
};

beforeEach(() => {
  getUserMock.mockReset();
  tables = {};
  insertedRows.length = 0;
});

describe("POST /api/calendar/events - authentication and validation", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildRequest(VALID_BODY));

    expect(response.status).toBe(401);
  });

  it("rejects a request with a blank title", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await POST(buildRequest({ ...VALID_BODY, title: "   " }));

    expect(response.status).toBe(400);
  });

  it("rejects an invalid eventTime", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await POST(buildRequest({ ...VALID_BODY, eventTime: "14:30:00" }));

    expect(response.status).toBe(400);
  });

  it("rejects a non-UUID projectId", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await POST(buildRequest({ ...VALID_BODY, projectId: "not-a-uuid" }));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/calendar/events - success and link validation", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("creates an event with no links", async () => {
    tables = {
      calendar_events: {
        insert: {
          data: {
            id: "e1",
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

    const response = await POST(buildRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.item.id).toBe("event:e1");
  });

  it("rejects a projectId that does not belong to the authenticated user", async () => {
    tables = { projects: { select: { data: null } } };

    const response = await POST(
      buildRequest({
        ...VALID_BODY,
        projectId: "11111111-1111-4111-8111-111111111111",
      })
    );

    expect(response.status).toBe(404);
  });

  it("never writes to the projects table, even on a successful create with a linked project", async () => {
    tables = {
      projects: {
        select: {
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            client_id: null,
            deleted_at: null,
          },
        },
      },
      calendar_events: {
        insert: {
          data: {
            id: "e1",
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: "11111111-1111-4111-8111-111111111111",
            client_id: null,
          },
        },
      },
    };

    await POST(
      buildRequest({
        ...VALID_BODY,
        projectId: "11111111-1111-4111-8111-111111111111",
      })
    );

    expect(insertedRows.some((entry) => entry.table === "projects")).toBe(false);
    expect(insertedRows.some((entry) => entry.table === "calendar_events")).toBe(true);
  });
});
