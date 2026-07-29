import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { dashboardTasksNoStoreHeaders } from "@/lib/tasks/load-dashboard-tasks.server";
import { OPTIONS_LIMIT } from "@/lib/calendar/load-calendar-options.server";

const getUserMock = vi.fn();

type ListScript = { data: Record<string, unknown>[] | null; error?: unknown };
type SingleScript = { data: Record<string, unknown> | null; error?: unknown };
type TableScript = { list?: ListScript; single?: SingleScript };
type CallLogEntry = { table: string; method: string; args: unknown[] };

let tables: Record<string, TableScript> = {};
let callLog: CallLogEntry[] = [];

function makeChain(table: string) {
  const chain = {
    eq(...args: unknown[]) {
      callLog.push({ table, method: "eq", args });
      return chain;
    },
    is(...args: unknown[]) {
      callLog.push({ table, method: "is", args });
      return chain;
    },
    or(...args: unknown[]) {
      callLog.push({ table, method: "or", args });
      return chain;
    },
    order(...args: unknown[]) {
      callLog.push({ table, method: "order", args });
      return chain;
    },
    // Deliberately present (rather than simply absent) so a real call to it
    // is observable in callLog, proving test 21 below is a genuine
    // assertion rather than one that would pass merely because the method
    // doesn't exist on the mock.
    count(...args: unknown[]) {
      callLog.push({ table, method: "count", args });
      return chain;
    },
    limit(...args: unknown[]) {
      callLog.push({ table, method: "limit", args });
      const script = tables[table]?.list ?? { data: [] };
      return Promise.resolve({ data: script.data, error: script.error ?? null });
    },
    single() {
      callLog.push({ table, method: "single", args: [] });
      const script = tables[table]?.single ?? { data: null };
      return Promise.resolve({ data: script.data, error: script.error ?? null });
    },
  };
  return chain;
}

const tableClient = {
  from(table: string) {
    return { select: () => makeChain(table) };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock }, ...tableClient }),
}));

const { GET } = await import("./route");

function buildRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/calendar/options${query}`);
}

function buildProjectRow(index: number, overrides: Record<string, unknown> = {}) {
  const padded = String(index).padStart(4, "0");
  return {
    id: `project-${padded}`,
    title: `Project ${padded}`,
    is_archived: false,
    client_id: null,
    clients: null,
    ...overrides,
  };
}

function buildProjectRows(count: number) {
  return Array.from({ length: count }, (_, i) => buildProjectRow(i));
}

function buildClientRow(index: number, overrides: Record<string, unknown> = {}) {
  const padded = String(index).padStart(4, "0");
  return { id: `client-${padded}`, name: `Client ${padded}`, ...overrides };
}

function buildClientRows(count: number) {
  return Array.from({ length: count }, (_, i) => buildClientRow(i));
}

const AUTHENTICATED_USER = { data: { user: { id: "user-1" } }, error: null };

beforeEach(() => {
  getUserMock.mockReset();
  tables = {};
  callLog = [];
});

describe("GET /api/calendar/options", () => {
  it("1. returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  it("2. returns 400 for a malformed includeProjectId, without querying for it", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);

    const response = await GET(buildRequest("?includeProjectId=not-a-uuid"));

    expect(response.status).toBe(400);
    expect(callLog).toHaveLength(0);
  });

  it("3. returns 400 for a malformed includeClientId, without querying for it", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);

    const response = await GET(buildRequest("?includeClientId=not-a-uuid"));

    expect(response.status).toBe(400);
    expect(callLog).toHaveLength(0);
  });

  it("4. scopes both the project and client queries to the requesting user", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    await GET(buildRequest());

    expect(
      callLog.some((c) => c.table === "projects" && c.method === "eq" && c.args[0] === "user_id" && c.args[1] === "user-1")
    ).toBe(true);
    expect(
      callLog.some((c) => c.table === "clients" && c.method === "eq" && c.args[0] === "user_id" && c.args[1] === "user-1")
    ).toBe(true);
  });

  it("5. excludes deleted projects via an explicit deleted_at filter", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    await GET(buildRequest());

    expect(
      callLog.some((c) => c.table === "projects" && c.method === "is" && c.args[0] === "deleted_at" && c.args[1] === null)
    ).toBe(true);
  });

  it("6. excludes archived projects from the normal result via an explicit is_archived filter", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    await GET(buildRequest());

    expect(
      callLog.some(
        (c) =>
          c.table === "projects" &&
          c.method === "or" &&
          c.args[0] === "is_archived.eq.false,is_archived.is.null"
      )
    ).toBe(true);
  });

  it("7. orders projects by title ascending", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    await GET(buildRequest());

    expect(
      callLog.some(
        (c) => c.table === "projects" && c.method === "order" && c.args[0] === "title" && (c.args[1] as { ascending?: boolean })?.ascending === true
      )
    ).toBe(true);
  });

  it("8. orders clients by name ascending", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    await GET(buildRequest());

    expect(
      callLog.some(
        (c) => c.table === "clients" && c.method === "order" && c.args[0] === "name" && (c.args[1] as { ascending?: boolean })?.ascending === true
      )
    ).toBe(true);
  });

  it("9. project options contain id, title, clientId, clientName, and isArchived", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: {
        list: {
          data: [
            buildProjectRow(0, {
              id: "p1",
              title: "Website redesign",
              client_id: "c1",
              clients: { id: "c1", name: "Acme Co" },
            }),
          ],
        },
      },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.projects).toEqual([
      { id: "p1", title: "Website redesign", clientId: "c1", clientName: "Acme Co", isArchived: false },
    ]);
  });

  it("10. a project with no linked client returns null clientId/clientName", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: {
        list: { data: [buildProjectRow(0, { id: "p1", title: "Solo project" })] },
      },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.projects).toEqual([
      { id: "p1", title: "Solo project", clientId: null, clientName: null, isArchived: false },
    ]);
  });

  it("11. exactly OPTIONS_LIMIT normal projects: all returned, projectsTruncated is false", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: buildProjectRows(OPTIONS_LIMIT) } },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.projects).toHaveLength(OPTIONS_LIMIT);
    expect(body.projectsTruncated).toBe(false);
  });

  it("12. exactly OPTIONS_LIMIT + 1 normal projects: query limit is OPTIONS_LIMIT + 1, 200 returned, projectsTruncated is true", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: buildProjectRows(OPTIONS_LIMIT + 1) } },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(
      callLog.some((c) => c.table === "projects" && c.method === "limit" && c.args[0] === OPTIONS_LIMIT + 1)
    ).toBe(true);
    expect(body.projects).toHaveLength(OPTIONS_LIMIT);
    expect(body.projectsTruncated).toBe(true);
  });

  it("13a. exactly OPTIONS_LIMIT normal clients: all returned, clientsTruncated is false", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: [] } },
      clients: { list: { data: buildClientRows(OPTIONS_LIMIT) } },
    };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.clients).toHaveLength(OPTIONS_LIMIT);
    expect(body.clientsTruncated).toBe(false);
  });

  it("13b. exactly OPTIONS_LIMIT + 1 normal clients: query limit is OPTIONS_LIMIT + 1, 200 returned, clientsTruncated is true", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: [] } },
      clients: { list: { data: buildClientRows(OPTIONS_LIMIT + 1) } },
    };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(
      callLog.some((c) => c.table === "clients" && c.method === "limit" && c.args[0] === OPTIONS_LIMIT + 1)
    ).toBe(true);
    expect(body.clients).toHaveLength(OPTIONS_LIMIT);
    expect(body.clientsTruncated).toBe(true);
  });

  it("14. an owned included project already present in the normal results is not duplicated", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    const row = buildProjectRow(0, { id: "p1", title: "Already listed" });
    tables = {
      projects: { list: { data: [row] }, single: { data: row } },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest("?includeProjectId=11111111-1111-4111-8111-111111111111"));
    const body = await response.json();

    expect(body.projects.filter((p: { id: string }) => p.id === "p1")).toHaveLength(1);
  });

  it("15. an owned, archived included project is appended and marked isArchived: true", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: {
        list: { data: [] },
        single: { data: buildProjectRow(0, { id: "archived-1", title: "Archived project", is_archived: true }) },
      },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest("?includeProjectId=22222222-2222-4222-8222-222222222222"));
    const body = await response.json();

    expect(body.projects).toEqual([
      { id: "archived-1", title: "Archived project", clientId: null, clientName: null, isArchived: true },
    ]);
  });

  it("16. an owned included project outside the first OPTIONS_LIMIT is appended", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    const normalRows = buildProjectRows(OPTIONS_LIMIT + 1);
    const cutOffRow = normalRows[normalRows.length - 1];
    tables = {
      projects: { list: { data: normalRows }, single: { data: cutOffRow } },
      clients: { list: { data: [] } },
    };

    const response = await GET(
      buildRequest(`?includeProjectId=33333333-3333-4333-8333-333333333333`)
    );
    const body = await response.json();

    expect(body.projects).toHaveLength(OPTIONS_LIMIT + 1);
    expect(body.projects.some((p: { id: string }) => p.id === cutOffRow.id)).toBe(true);
  });

  it("17. a foreign/nonexistent includeProjectId is silently omitted, not surfaced as an error", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: [] }, single: { data: null, error: { code: "PGRST116" } } },
      clients: { list: { data: [] } },
    };

    const response = await GET(
      buildRequest("?includeProjectId=44444444-4444-4444-8444-444444444444")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toEqual([]);
  });

  it("18. a foreign/nonexistent includeClientId is silently omitted, not surfaced as an error", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: [] } },
      clients: { list: { data: [] }, single: { data: null, error: { code: "PGRST116" } } },
    };

    const response = await GET(
      buildRequest("?includeClientId=55555555-5555-4555-8555-555555555555")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.clients).toEqual([]);
  });

  it("19. an appended included value never changes the truncation flags", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    const normalRows = buildProjectRows(OPTIONS_LIMIT);
    tables = {
      projects: {
        list: { data: normalRows },
        single: { data: buildProjectRow(9999, { id: "outside-1" }) },
      },
      clients: { list: { data: [] } },
    };

    const response = await GET(
      buildRequest("?includeProjectId=66666666-6666-4666-8666-666666666666")
    );
    const body = await response.json();

    expect(body.projects).toHaveLength(OPTIONS_LIMIT + 1);
    expect(body.projectsTruncated).toBe(false);
  });

  it("20a. a genuine database error on the normal query returns a controlled 500", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: null, error: { message: "connection reset" } } },
      clients: { list: { data: [] } },
    };

    const response = await GET(buildRequest());

    expect(response.status).toBe(500);
  });

  it("20b. a genuine database error on an included-value lookup returns a controlled 500, not a silent omission", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: {
        list: { data: [] },
        single: { data: null, error: { message: "connection reset" } },
      },
      clients: { list: { data: [] } },
    };

    const response = await GET(
      buildRequest("?includeProjectId=77777777-7777-4777-8777-777777777777")
    );

    expect(response.status).toBe(500);
  });

  it("21. never issues an exact-count query", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = {
      projects: { list: { data: buildProjectRows(OPTIONS_LIMIT + 1) } },
      clients: { list: { data: buildClientRows(OPTIONS_LIMIT + 1) } },
    };

    await GET(buildRequest());

    expect(callLog.some((c) => c.method === "count")).toBe(false);
  });

  it("22. the success response carries the current dashboard no-store headers", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    const response = await GET(buildRequest());

    for (const [key, value] of Object.entries(dashboardTasksNoStoreHeaders)) {
      expect(response.headers.get(key)).toBe(value);
    }
  });

  it("returns the full CalendarOptionsResult contract shape on success", async () => {
    getUserMock.mockResolvedValue(AUTHENTICATED_USER);
    tables = { projects: { list: { data: [] } }, clients: { list: { data: [] } } };

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body).toEqual({
      success: true,
      projects: [],
      clients: [],
      projectsTruncated: false,
      clientsTruncated: false,
    });
  });
});
