import { describe, expect, it } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { loadCalendarRange } from "./load-calendar-range.server";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

type RecordedCall = { table: string; method: string; args: unknown[] };
type TableScript = { data: Record<string, unknown>[] | null; error?: unknown };

/**
 * Fake Supabase client keyed by table name, recording every filter call.
 * Mirrors the recording-fake pattern established in
 * lib/tasks/load-dashboard-tasks.server.test.ts, extended to route two
 * different tables (projects, calendar_events) to independently-scripted
 * responses within one loader call.
 */
function buildFakeClient(tables: Record<string, TableScript>) {
  const calls: RecordedCall[] = [];

  const client = {
    from(table: string) {
      const script = tables[table] ?? { data: [] };

      return {
        select(columns: string) {
          calls.push({ table, method: "select", args: [columns] });

          const chain = {
            eq(...args: unknown[]) {
              calls.push({ table, method: "eq", args });
              return chain;
            },
            is(...args: unknown[]) {
              calls.push({ table, method: "is", args });
              return chain;
            },
            or(...args: unknown[]) {
              calls.push({ table, method: "or", args });
              return chain;
            },
            gte(...args: unknown[]) {
              calls.push({ table, method: "gte", args });
              return chain;
            },
            lte(...args: unknown[]) {
              calls.push({ table, method: "lte", args });
              return Promise.resolve({
                data: script.data,
                error: script.error ?? null,
              });
            },
          };

          return chain;
        },
      };
    },
  };

  return { client, calls };
}

const RANGE = { start: toDateOnly("2027-01-01"), end: toDateOnly("2027-01-31") };
const USER_ID = "user-1";

describe("loadCalendarRange - query scoping", () => {
  it("scopes both the projects and calendar_events queries to the requested user and date range", async () => {
    const { client, calls } = buildFakeClient({
      projects: { data: [] },
      calendar_events: { data: [] },
    });

    await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(calls).toContainEqual({ table: "projects", method: "eq", args: ["user_id", USER_ID] });
    expect(calls).toContainEqual({ table: "projects", method: "is", args: ["deleted_at", null] });
    expect(calls).toContainEqual({
      table: "projects",
      method: "or",
      args: ["is_archived.eq.false,is_archived.is.null"],
    });
    expect(calls).toContainEqual({
      table: "projects",
      method: "gte",
      args: ["deadline_date", RANGE.start],
    });
    expect(calls).toContainEqual({
      table: "projects",
      method: "lte",
      args: ["deadline_date", RANGE.end],
    });

    expect(calls).toContainEqual({
      table: "calendar_events",
      method: "eq",
      args: ["user_id", USER_ID],
    });
    expect(calls).toContainEqual({
      table: "calendar_events",
      method: "is",
      args: ["deleted_at", null],
    });
    expect(calls).toContainEqual({
      table: "calendar_events",
      method: "gte",
      args: ["event_date", RANGE.start],
    });
    expect(calls).toContainEqual({
      table: "calendar_events",
      method: "lte",
      args: ["event_date", RANGE.end],
    });
  });

  it("never applies the archived/is_archived filter to calendar_events (manual events have no archive concept)", async () => {
    const { client, calls } = buildFakeClient({
      projects: { data: [] },
      calendar_events: { data: [] },
    });

    await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(
      calls.some((call) => call.table === "calendar_events" && call.method === "or")
    ).toBe(false);
  });
});

describe("loadCalendarRange - merged item shape", () => {
  it("normalizes a project deadline row into a project_deadline item", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: [
          {
            id: "p1",
            title: "Website redesign",
            status: "In Progress",
            priority: "High",
            deadline_text: "Jan 15",
            deadline_date: "2027-01-15",
            client_name: "Acme Co",
          },
        ],
      },
      calendar_events: { data: [] },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        kind: "project_deadline",
        id: "project:p1",
        date: "2027-01-15",
        projectId: "p1",
        title: "Website redesign",
        clientName: "Acme Co",
        status: "In Progress",
        priority: "High",
      });
      expect(typeof (result.items[0] as { isOverdue: boolean }).isOverdue).toBe("boolean");
    }
  });

  it("still includes a Done project's deadline (de-emphasis is a future UI concern, not a data-layer exclusion)", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: [
          {
            id: "p1",
            title: "Finished project",
            status: "Done",
            priority: "Low",
            deadline_text: "Jan 15",
            deadline_date: "2027-01-15",
            client_name: null,
          },
        ],
      },
      calendar_events: { data: [] },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0].kind).toBe("project_deadline");
    }
  });

  it("merges project deadlines and manual events into one array", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: [
          {
            id: "p1",
            title: "Website redesign",
            status: "New",
            priority: "Medium",
            deadline_text: "Jan 15",
            deadline_date: "2027-01-15",
            client_name: null,
          },
        ],
      },
      calendar_events: {
        data: [
          {
            id: "e1",
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            client_id: null,
          },
        ],
      },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.kind).sort()).toEqual([
        "manual_event",
        "project_deadline",
      ]);
    }
  });

  it("returns items unsorted -- sorting is a separate, pure concern (calendar-item-sort.ts), not duplicated here", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: [
          {
            id: "p1",
            title: "Z project",
            status: null,
            priority: null,
            deadline_text: null,
            deadline_date: "2027-01-20",
            client_name: null,
          },
        ],
      },
      calendar_events: {
        data: [
          {
            id: "e1",
            title: "A event",
            event_date: "2027-01-05",
            event_time: null,
            notes: null,
            project_id: null,
            client_id: null,
          },
        ],
      },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Project items are appended after event items regardless of date --
      // proves no sort pass runs inside the loader itself.
      expect(result.items[0].kind).toBe("project_deadline");
      expect(result.items[1].kind).toBe("manual_event");
    }
  });
});

describe("loadCalendarRange - error handling", () => {
  it("returns a 500 result when the projects query fails", async () => {
    const { client } = buildFakeClient({
      projects: { data: null, error: { message: "db down" } },
      calendar_events: { data: [] },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });

  it("returns a 500 result when the calendar_events query fails", async () => {
    const { client } = buildFakeClient({
      projects: { data: [] },
      calendar_events: { data: null, error: { message: "db down" } },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });

  it("skips a malformed project row (unparseable deadline_date) rather than crashing", async () => {
    const { client } = buildFakeClient({
      projects: {
        data: [
          {
            id: "p1",
            title: "Broken",
            status: null,
            priority: null,
            deadline_text: null,
            deadline_date: "not-a-date",
            client_name: null,
          },
        ],
      },
      calendar_events: { data: [] },
    });

    const result = await loadCalendarRange({ supabase: client, userId: USER_ID, range: RANGE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(0);
    }
  });
});
