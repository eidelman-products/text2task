import { describe, expect, it } from "vitest";
import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly, type TimeOnly } from "@/lib/calendar/time-only";
import {
  createCalendarEvent,
  normalizeCalendarEventRow,
  softDeleteCalendarEvent,
  updateCalendarEvent,
  type CalendarEventRelationRow,
} from "./calendar-events-repository.server";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid DateOnly`);
  return parsed;
}

function toTimeOnly(value: string): TimeOnly {
  const parsed = parseTimeOnly(value);
  if (!parsed) throw new Error(`fixture value "${value}" is not a valid TimeOnly`);
  return parsed;
}

type RecordedCall = { table: string; method: string; args: unknown[] };

type TableScript = {
  select?: { data: Record<string, unknown> | null; error?: unknown };
  insert?: { data: Record<string, unknown> | null; error?: unknown };
  update?: { data: Record<string, unknown> | null; error?: unknown };
};

/**
 * Fake Supabase client keyed by table name. Each table can script a
 * response for select/insert/update; every filter call is recorded so
 * ownership scoping is directly verifiable. Mirrors the recording-fake
 * pattern established in lib/tasks/load-dashboard-tasks.server.test.ts.
 */
function buildFakeClient(tables: Record<string, TableScript>) {
  const calls: RecordedCall[] = [];

  function makeChain(table: string, response: { data: unknown; error?: unknown }) {
    const chain = {
      eq(...args: unknown[]) {
        calls.push({ table, method: "eq", args });
        return chain;
      },
      select(...args: unknown[]) {
        calls.push({ table, method: "select", args });
        return chain;
      },
      single() {
        calls.push({ table, method: "single", args: [] });
        return Promise.resolve({ data: response.data, error: response.error ?? null });
      },
      then(
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown
      ) {
        return Promise.resolve({
          data: response.data,
          error: response.error ?? null,
        }).then(onFulfilled);
      },
    };

    return chain;
  }

  const client = {
    from(table: string) {
      const script = tables[table] ?? {};

      return {
        select() {
          calls.push({ table, method: "select-root", args: [] });
          return makeChain(table, script.select ?? { data: null });
        },
        insert(row: Record<string, unknown>) {
          calls.push({ table, method: "insert", args: [row] });
          return makeChain(table, script.insert ?? { data: null });
        },
        update(row: Record<string, unknown>) {
          calls.push({ table, method: "update", args: [row] });
          return makeChain(table, script.update ?? { data: null });
        },
      };
    },
  };

  return { client, calls };
}

const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";

describe("normalizeCalendarEventRow", () => {
  it("normalizes a full row, resolving embedded project/client relations", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Send first draft",
      event_date: "2027-01-10",
      event_time: "14:30:00",
      notes: "Bring the invoice.",
      project_id: PROJECT_ID,
      custom_project_name: null,
      client_id: CLIENT_ID,
      custom_client_name: null,
      projects: { id: PROJECT_ID, title: "Website redesign" },
      clients: { id: CLIENT_ID, name: "Acme Co" },
    };

    const item = normalizeCalendarEventRow(row);

    expect(item).toEqual({
      kind: "manual_event",
      id: `event:${EVENT_ID}`,
      date: "2027-01-10",
      time: "14:30",
      title: "Send first draft",
      notes: "Bring the invoice.",
      projectId: PROJECT_ID,
      customProjectName: null,
      projectTitle: "Website redesign",
      clientId: CLIENT_ID,
      customClientName: null,
      clientName: "Acme Co",
    });
  });

  it("treats a null event_time as all-day", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Team check-in",
      event_date: "2027-01-10",
      event_time: null,
      notes: null,
      project_id: null,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
    };

    expect(normalizeCalendarEventRow(row)?.time).toBeNull();
  });

  it("resolves an array-shaped embedded relation (Supabase's alternate to-one shape)", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Team check-in",
      event_date: "2027-01-10",
      event_time: null,
      notes: null,
      project_id: PROJECT_ID,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
      projects: [{ id: PROJECT_ID, title: "Website redesign" }],
    };

    expect(normalizeCalendarEventRow(row)?.projectTitle).toBe("Website redesign");
  });

  it("returns null for an unparseable event_date instead of throwing (fail safe)", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Broken row",
      event_date: "not-a-date",
      event_time: null,
      notes: null,
      project_id: null,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
    };

    expect(normalizeCalendarEventRow(row)).toBeNull();
  });

  it("rejects (omits) the whole row when event_time is malformed, rather than reinterpreting it as all-day", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Broken time",
      event_date: "2027-01-10",
      event_time: "14:30:45", // non-zero seconds -- never produced by our own writes
      notes: null,
      project_id: null,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
    };

    // A malformed event_time must never be silently reinterpreted as
    // "all-day" (time: null) -- that would change what the row means. The
    // whole row is rejected instead, matching the same fail-safe treatment
    // already used for an unparseable event_date.
    expect(normalizeCalendarEventRow(row)).toBeNull();
  });

  it("rejects the whole row for malformed time text (not just a seconds mismatch)", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Broken time",
      event_date: "2027-01-10",
      event_time: "not-a-time",
      notes: null,
      project_id: null,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
    };

    expect(normalizeCalendarEventRow(row)).toBeNull();
  });

  it("accepts a fractional-zero-seconds event_time exactly as it accepts a bare HH:MM:00 value", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Team check-in",
      event_date: "2027-01-10",
      event_time: "14:30:00.000000",
      notes: null,
      project_id: null,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
    };

    expect(normalizeCalendarEventRow(row)?.time).toBe("14:30");
  });
});

describe("createCalendarEvent", () => {
  it("creates an event with no links and returns the normalized item", async () => {
    const { client } = buildFakeClient({
      calendar_events: {
        insert: {
          data: {
            id: EVENT_ID,
            title: "Team check-in",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: null,
            client_id: null,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await createCalendarEvent({
      supabase: client,
      userId: USER_ID,
      input: {
        title: "Team check-in",
        eventDate: toDateOnly("2027-01-10"),
        eventTime: null,
        notes: null,
        projectId: null,
        customProjectName: null,
        clientId: null,
        customClientName: null,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(`event:${EVENT_ID}`);
    }
  });

  it("rejects creation when the linked project is not owned by the user", async () => {
    const { client } = buildFakeClient({
      projects: { select: { data: null } },
    });

    const result = await createCalendarEvent({
      supabase: client,
      userId: USER_ID,
      input: {
        title: "Send first draft",
        eventDate: toDateOnly("2027-01-10"),
        eventTime: null,
        notes: null,
        projectId: PROJECT_ID,
        customProjectName: null,
        clientId: null,
        customClientName: null,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("returns a 500 when the insert fails", async () => {
    const { client } = buildFakeClient({
      calendar_events: { insert: { data: null, error: { message: "db down" } } },
    });

    const result = await createCalendarEvent({
      supabase: client,
      userId: USER_ID,
      input: {
        title: "Team check-in",
        eventDate: toDateOnly("2027-01-10"),
        eventTime: null,
        notes: null,
        projectId: null,
        customProjectName: null,
        clientId: null,
        customClientName: null,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});

describe("updateCalendarEvent", () => {
  it("returns 404 when the event does not exist or is not owned by the user", async () => {
    const { client } = buildFakeClient({
      calendar_events: { select: { data: null } },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { title: "New title" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("returns 404 for an already-soft-deleted event (not editable)", async () => {
    const { client } = buildFakeClient({
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: null,
            custom_project_name: null,
            client_id: null,
            custom_client_name: null,
            deleted_at: "2027-01-01T00:00:00.000Z",
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { title: "New title" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("updates only the fields present in the input (partial update)", async () => {
    const { client } = buildFakeClient({
      calendar_events: {
        select: {
          data: { id: EVENT_ID, project_id: null, custom_project_name: null, client_id: null, custom_client_name: null, deleted_at: null },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Updated title",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: null,
            client_id: null,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { title: "Updated title" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Updated title");
    }
  });

  it("allows explicitly clearing eventTime, notes, projectId, and clientId via null", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: null,
            client_id: null,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { eventTime: null, notes: null, projectId: null, clientId: null },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.time).toBeNull();
      expect(result.data.notes).toBeNull();
      expect(result.data.projectId).toBeNull();
      expect(result.data.clientId).toBeNull();
    }

    const updateCall = calls.find(
      (call) => call.table === "calendar_events" && call.method === "update"
    );
    expect(updateCall?.args[0]).toMatchObject({
      event_time: null,
      notes: null,
      project_id: null,
      custom_project_name: null,
      client_id: null,
      custom_client_name: null,
    });
  });

  it("does not touch project_id/client_id in the write when neither is in the input", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Updated title",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { title: "Updated title" },
    });

    const updateCall = calls.find(
      (call) => call.table === "calendar_events" && call.method === "update"
    );
    const updatedRow = updateCall?.args[0] as Record<string, unknown>;
    expect("project_id" in updatedRow).toBe(false);
    expect("client_id" in updatedRow).toBe(false);
  });

  it("re-validates and normalizes when projectId changes, rejecting an unowned project", async () => {
    const { client } = buildFakeClient({
      calendar_events: {
        select: {
          data: { id: EVENT_ID, project_id: null, custom_project_name: null, client_id: null, custom_client_name: null, deleted_at: null },
        },
      },
      projects: { select: { data: null } },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { projectId: PROJECT_ID },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

describe("softDeleteCalendarEvent", () => {
  it("soft-deletes an owned event", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: { data: { id: EVENT_ID, deleted_at: null } },
        update: { data: {} },
      },
    });

    const result = await softDeleteCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
    });

    expect(result).toEqual({ ok: true, data: { id: EVENT_ID, alreadyDeleted: false } });
    expect(
      calls.some((call) => call.table === "calendar_events" && call.method === "update")
    ).toBe(true);
  });

  it("is idempotent: deleting an already-deleted, owned event succeeds without a second write", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: { id: EVENT_ID, deleted_at: "2027-01-01T00:00:00.000Z" },
        },
      },
    });

    const result = await softDeleteCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
    });

    expect(result).toEqual({ ok: true, data: { id: EVENT_ID, alreadyDeleted: true } });
    expect(
      calls.some((call) => call.table === "calendar_events" && call.method === "update")
    ).toBe(false);
  });

  it("returns 404 for an event that does not exist or is not owned by the user", async () => {
    const { client } = buildFakeClient({
      calendar_events: { select: { data: null } },
    });

    const result = await softDeleteCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("never hard-deletes (only ever calls update, never a delete method)", async () => {
    const { client } = buildFakeClient({
      calendar_events: {
        select: { data: { id: EVENT_ID, deleted_at: null } },
        update: { data: {} },
      },
    });

    expect((client as unknown as Record<string, unknown>).delete).toBeUndefined();

    await softDeleteCalendarEvent({ supabase: client, userId: USER_ID, eventId: EVENT_ID });
  });
});

describe("historical client-link preservation (Correction 1 regression suite)", () => {
  const ORIGINAL_CLIENT_ID = "44444444-4444-4444-8444-444444444444";
  const NEW_PROJECT_CLIENT_ID = "55555555-5555-4555-8555-555555555555";
  const INDEPENDENT_CLIENT_ID = "66666666-6666-4666-8666-666666666666";
  const OTHER_PROJECT_ID = "77777777-7777-4777-8777-777777777777";

  it("1. create with a project derives that project's client", async () => {
    const { client } = buildFakeClient({
      projects: {
        select: {
          data: { id: PROJECT_ID, client_id: ORIGINAL_CLIENT_ID, deleted_at: null },
        },
      },
      calendar_events: {
        insert: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await createCalendarEvent({
      supabase: client,
      userId: USER_ID,
      input: {
        title: "Send first draft",
        eventDate: toDateOnly("2027-01-10"),
        eventTime: null,
        notes: null,
        projectId: PROJECT_ID,
        customProjectName: null,
        clientId: null,
        customClientName: null,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientId).toBe(ORIGINAL_CLIENT_ID);
    }
  });

  it("2. updating title/date/time/notes preserves the original client without touching project_id/client_id in the write", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Updated title",
            event_date: "2027-01-15",
            event_time: "09:00:00",
            notes: "Updated notes",
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: {
        title: "Updated title",
        eventDate: toDateOnly("2027-01-15"),
        eventTime: toTimeOnly("09:00"),
        notes: "Updated notes",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientId).toBe(ORIGINAL_CLIENT_ID);
    }

    const updateCall = calls.find(
      (call) => call.table === "calendar_events" && call.method === "update"
    );
    const writtenRow = updateCall?.args[0] as Record<string, unknown>;
    expect("project_id" in writtenRow).toBe(false);
    expect("client_id" in writtenRow).toBe(false);

    // Proves the relationship was never even looked up for this update.
    expect(calls.some((call) => call.table === "projects")).toBe(false);
    expect(calls.some((call) => call.table === "clients")).toBe(false);
  });

  it("3. soft delete preserves the original client (deleted_at is the only written field)", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: { id: EVENT_ID, deleted_at: null },
        },
        update: { data: {} },
      },
    });

    await softDeleteCalendarEvent({ supabase: client, userId: USER_ID, eventId: EVENT_ID });

    const updateCall = calls.find(
      (call) => call.table === "calendar_events" && call.method === "update"
    );
    const writtenRow = updateCall?.args[0] as Record<string, unknown>;
    expect(Object.keys(writtenRow)).toEqual(["deleted_at"]);
    expect(calls.some((call) => call.table === "projects")).toBe(false);
    expect(calls.some((call) => call.table === "clients")).toBe(false);
  });

  it("4. a project's client changing later does not rewrite an event during an unrelated update (the exact reported bug)", async () => {
    // The event was originally linked with the project's OLD client. The
    // project's client has since changed to NEW_PROJECT_CLIENT_ID in the
    // projects table -- but an update that only touches notes must never
    // consult the projects table at all, so it cannot possibly pick up
    // that change.
    const { client, calls } = buildFakeClient({
      projects: {
        select: {
          data: { id: PROJECT_ID, client_id: NEW_PROJECT_CLIENT_ID, deleted_at: null },
        },
      },
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: "Attach the final invoice.",
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { notes: "Attach the final invoice." },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientId).toBe(ORIGINAL_CLIENT_ID);
      expect(result.data.clientId).not.toBe(NEW_PROJECT_CLIENT_ID);
    }
    expect(calls.some((call) => call.table === "projects")).toBe(false);
  });

  it("5. explicitly changing projectId derives the new project's client", async () => {
    const { client } = buildFakeClient({
      projects: {
        select: {
          data: { id: OTHER_PROJECT_ID, client_id: NEW_PROJECT_CLIENT_ID, deleted_at: null },
        },
      },
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: OTHER_PROJECT_ID,
            custom_project_name: null,
            client_id: NEW_PROJECT_CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { projectId: OTHER_PROJECT_ID },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projectId).toBe(OTHER_PROJECT_ID);
      expect(result.data.clientId).toBe(NEW_PROJECT_CLIENT_ID);
    }
  });

  it("6. explicitly changing clientId while a project remains linked cannot create an inconsistent relationship (project's client still wins)", async () => {
    const { client } = buildFakeClient({
      projects: {
        select: {
          data: { id: PROJECT_ID, client_id: ORIGINAL_CLIENT_ID, deleted_at: null },
        },
      },
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    // The caller tries to set an unrelated, independent client while the
    // project stays linked -- the project's own client must still win.
    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { clientId: INDEPENDENT_CLIENT_ID },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientId).toBe(ORIGINAL_CLIENT_ID);
      expect(result.data.clientId).not.toBe(INDEPENDENT_CLIENT_ID);
    }
  });

  it("7. unlinking the project permits a valid independent client", async () => {
    const { client } = buildFakeClient({
      clients: {
        select: { data: { id: INDEPENDENT_CLIENT_ID } },
      },
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: PROJECT_ID,
            custom_project_name: null,
            client_id: ORIGINAL_CLIENT_ID,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Send first draft",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: null,
            client_id: INDEPENDENT_CLIENT_ID,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { projectId: null, clientId: INDEPENDENT_CLIENT_ID },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projectId).toBeNull();
      expect(result.data.clientId).toBe(INDEPENDENT_CLIENT_ID);
    }
  });
});

describe("custom Project/Client names", () => {
  it("createCalendarEvent passes a custom Project name through to the insert row and the normalized item", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        insert: {
          data: {
            id: EVENT_ID,
            title: "Team check-in",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: "Not yet in Text2Task",
            client_id: null,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await createCalendarEvent({
      supabase: client,
      userId: USER_ID,
      input: {
        title: "Team check-in",
        eventDate: toDateOnly("2027-01-10"),
        eventTime: null,
        notes: null,
        projectId: null,
        customProjectName: "Not yet in Text2Task",
        clientId: null,
        customClientName: null,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.customProjectName).toBe("Not yet in Text2Task");
      expect(result.data.projectTitle).toBe("Not yet in Text2Task");
    }

    const insertCall = calls.find((call) => call.table === "calendar_events" && call.method === "insert");
    const insertedRow = insertCall?.args[0] as Record<string, unknown>;
    expect(insertedRow.custom_project_name).toBe("Not yet in Text2Task");
  });

  it("updateCalendarEvent re-validates and writes all four relationship columns when only customProjectName changes", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: null,
            custom_project_name: null,
            client_id: null,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Team check-in",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: "Now a custom name",
            client_id: null,
            custom_client_name: null,
          },
        },
      },
    });

    const result = await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { customProjectName: "Now a custom name" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.customProjectName).toBe("Now a custom name");
    }

    const updateCall = calls.find((call) => call.table === "calendar_events" && call.method === "update");
    const writtenRow = updateCall?.args[0] as Record<string, unknown>;
    expect(writtenRow.custom_project_name).toBe("Now a custom name");
    expect("project_id" in writtenRow).toBe(true);
    expect("client_id" in writtenRow).toBe(true);
  });

  it("updateCalendarEvent does not touch any of the four relationship columns when none is in the input", async () => {
    const { client, calls } = buildFakeClient({
      calendar_events: {
        select: {
          data: {
            id: EVENT_ID,
            project_id: null,
            custom_project_name: "Existing custom name",
            client_id: null,
            custom_client_name: null,
            deleted_at: null,
          },
        },
        update: {
          data: {
            id: EVENT_ID,
            title: "Updated title",
            event_date: "2027-01-10",
            event_time: null,
            notes: null,
            project_id: null,
            custom_project_name: "Existing custom name",
            client_id: null,
            custom_client_name: null,
          },
        },
      },
    });

    await updateCalendarEvent({
      supabase: client,
      userId: USER_ID,
      eventId: EVENT_ID,
      input: { title: "Updated title" },
    });

    const updateCall = calls.find((call) => call.table === "calendar_events" && call.method === "update");
    const writtenRow = updateCall?.args[0] as Record<string, unknown>;
    expect("project_id" in writtenRow).toBe(false);
    expect("custom_project_name" in writtenRow).toBe(false);
    expect("client_id" in writtenRow).toBe(false);
    expect("custom_client_name" in writtenRow).toBe(false);
  });

  it("normalizeCalendarEventRow resolves projectTitle/clientName from custom names when no relation is linked", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Kickoff call",
      event_date: "2027-01-10",
      event_time: null,
      notes: null,
      project_id: null,
      custom_project_name: "Not yet in Text2Task",
      client_id: null,
      custom_client_name: "Also not yet in Text2Task",
    };

    const item = normalizeCalendarEventRow(row);

    expect(item?.projectTitle).toBe("Not yet in Text2Task");
    expect(item?.clientName).toBe("Also not yet in Text2Task");
    expect(item?.customProjectName).toBe("Not yet in Text2Task");
    expect(item?.customClientName).toBe("Also not yet in Text2Task");
  });

  it("normalizeCalendarEventRow prefers the linked relation's title/name over a stale custom name", () => {
    const row: CalendarEventRelationRow = {
      id: EVENT_ID,
      title: "Kickoff call",
      event_date: "2027-01-10",
      event_time: null,
      notes: null,
      project_id: PROJECT_ID,
      custom_project_name: null,
      client_id: CLIENT_ID,
      custom_client_name: null,
      projects: { id: PROJECT_ID, title: "Website redesign" },
      clients: { id: CLIENT_ID, name: "Acme Co" },
    };

    const item = normalizeCalendarEventRow(row);

    expect(item?.projectTitle).toBe("Website redesign");
    expect(item?.clientName).toBe("Acme Co");
    expect(item?.customProjectName).toBeNull();
    expect(item?.customClientName).toBeNull();
  });
});
