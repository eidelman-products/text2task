import { describe, expect, it } from "vitest";
import { validateCalendarEventLinks } from "./calendar-link-validation.server";

type TableConfig = {
  data: Record<string, unknown> | null;
  error?: unknown;
};

type RecordedCall = { table: string; method: string; args: unknown[] };

/**
 * Fake Supabase client keyed by table name, recording every filter call so
 * ownership-scoping (which columns/values each lookup filters by) is
 * directly verifiable without a live database. Mirrors the recording-fake
 * pattern established in lib/tasks/load-dashboard-tasks.server.test.ts.
 */
function buildFakeClient(tables: Record<string, TableConfig>) {
  const calls: RecordedCall[] = [];

  const client = {
    from(table: string) {
      const config = tables[table] ?? { data: null };

      return {
        select(columns: string) {
          calls.push({ table, method: "select", args: [columns] });

          const builder = {
            eq(...args: unknown[]) {
              calls.push({ table, method: "eq", args });
              return builder;
            },
            single() {
              calls.push({ table, method: "single", args: [] });
              return Promise.resolve({
                data: config.data,
                error: config.error ?? null,
              });
            },
          };

          return builder;
        },
      };
    },
  };

  return { client, calls };
}

const OWNED_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OWNED_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";

describe("validateCalendarEventLinks - no links", () => {
  it("returns ok with both null when neither projectId nor clientId is provided", async () => {
    const { client } = buildFakeClient({});

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: null,
      clientId: null,
    });

    expect(result).toEqual({ ok: true, projectId: null, clientId: null });
  });
});

describe("validateCalendarEventLinks - project linking", () => {
  it("accepts an owned, non-deleted project and normalizes clientId to the project's client_id", async () => {
    const { client, calls } = buildFakeClient({
      projects: {
        data: { id: OWNED_PROJECT_ID, client_id: OWNED_CLIENT_ID, deleted_at: null },
      },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: OWNED_PROJECT_ID,
      clientId: "some-other-client-id-that-should-be-ignored",
    });

    expect(result).toEqual({
      ok: true,
      projectId: OWNED_PROJECT_ID,
      clientId: OWNED_CLIENT_ID,
    });
    expect(calls).toContainEqual({
      table: "projects",
      method: "eq",
      args: ["id", OWNED_PROJECT_ID],
    });
    expect(calls).toContainEqual({
      table: "projects",
      method: "eq",
      args: ["user_id", USER_ID],
    });
  });

  it("normalizes clientId to null when the linked project has no client", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: { id: OWNED_PROJECT_ID, client_id: null, deleted_at: null },
      },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: OWNED_PROJECT_ID,
      clientId: OWNED_CLIENT_ID,
    });

    expect(result).toEqual({ ok: true, projectId: OWNED_PROJECT_ID, clientId: null });
  });

  it("rejects a project that does not exist or is not owned by this user (indistinguishable, matching RLS)", async () => {
    const { client } = buildFakeClient({
      projects: { data: null },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: "not-found-or-not-owned",
      clientId: null,
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "Linked project not found.",
    });
  });

  it("rejects a soft-deleted project", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: {
          id: OWNED_PROJECT_ID,
          client_id: null,
          deleted_at: "2027-01-01T00:00:00.000Z",
        },
      },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: OWNED_PROJECT_ID,
      clientId: null,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Linked project has been deleted.",
    });
  });

  it("propagates a query error as not-found rather than throwing", async () => {
    const { client } = buildFakeClient({
      projects: { data: null, error: { message: "connection reset" } },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: OWNED_PROJECT_ID,
      clientId: null,
    });

    expect(result.ok).toBe(false);
  });
});

describe("validateCalendarEventLinks - client-only linking (no project)", () => {
  it("accepts an owned client when no project is linked", async () => {
    const { client, calls } = buildFakeClient({
      clients: { data: { id: OWNED_CLIENT_ID } },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: null,
      clientId: OWNED_CLIENT_ID,
    });

    expect(result).toEqual({ ok: true, projectId: null, clientId: OWNED_CLIENT_ID });
    expect(calls).toContainEqual({
      table: "clients",
      method: "eq",
      args: ["user_id", USER_ID],
    });
  });

  it("rejects a client that does not exist or is not owned by this user", async () => {
    const { client } = buildFakeClient({
      clients: { data: null },
    });

    const result = await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: null,
      clientId: "not-found-or-not-owned",
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "Linked client not found.",
    });
  });

  it("never queries the clients table when a project is also provided (project's client always wins)", async () => {
    const { client, calls } = buildFakeClient({
      projects: {
        data: { id: OWNED_PROJECT_ID, client_id: OWNED_CLIENT_ID, deleted_at: null },
      },
      clients: { data: { id: "should-never-be-queried" } },
    });

    await validateCalendarEventLinks({
      supabase: client,
      userId: USER_ID,
      projectId: OWNED_PROJECT_ID,
      clientId: "irrelevant",
    });

    expect(calls.some((call) => call.table === "clients")).toBe(false);
  });
});
