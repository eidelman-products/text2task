import { describe, expect, it } from "vitest";
import { loadUnscheduledProjects } from "./load-unscheduled-projects.server";

type RecordedCall = { method: string; args: unknown[] };

function buildFakeClient(data: Record<string, unknown>[] | null, error: unknown = null) {
  const calls: RecordedCall[] = [];

  const chain = {
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return chain;
    },
    is(...args: unknown[]) {
      calls.push({ method: "is", args });
      return chain;
    },
    or(...args: unknown[]) {
      calls.push({ method: "or", args });
      return chain;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args });
      return chain;
    },
    limit(...args: unknown[]) {
      calls.push({ method: "limit", args });
      return Promise.resolve({ data, error });
    },
  };

  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return {
        select(columns: string) {
          calls.push({ method: "select", args: [columns] });
          return chain;
        },
      };
    },
  };

  return { client, calls };
}

const USER_ID = "user-1";

describe("loadUnscheduledProjects - query scoping", () => {
  it("filters to the owning user, non-deleted, non-archived, no-deadline projects", async () => {
    const { client, calls } = buildFakeClient([]);

    await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    expect(calls).toContainEqual({ method: "eq", args: ["user_id", USER_ID] });
    expect(calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
    expect(calls).toContainEqual({
      method: "or",
      args: ["is_archived.eq.false,is_archived.is.null"],
    });
    expect(calls).toContainEqual({ method: "is", args: ["deadline_date", null] });
  });

  it("excludes Done projects without silently excluding null-status projects (OR, not a bare neq)", async () => {
    const { client, calls } = buildFakeClient([]);

    await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    expect(calls).toContainEqual({
      method: "or",
      args: ["status.neq.Done,status.is.null"],
    });
    expect(calls.some((call) => call.method === "neq")).toBe(false);
  });

  it("orders by created_at descending and applies a bounded limit", async () => {
    const { client, calls } = buildFakeClient([]);

    await loadUnscheduledProjects({ supabase: client, userId: USER_ID, limit: 10 });

    expect(calls).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(calls).toContainEqual({ method: "limit", args: [10] });
  });

  it("uses a default bounded limit when none is provided (never loads the user's full project history)", async () => {
    const { client, calls } = buildFakeClient([]);

    await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    const limitCall = calls.find((call) => call.method === "limit");
    expect(limitCall).toBeDefined();
    expect(typeof limitCall?.args[0]).toBe("number");
    expect(limitCall?.args[0] as number).toBeGreaterThan(0);
    expect(limitCall?.args[0] as number).toBeLessThanOrEqual(100);
  });
});

describe("loadUnscheduledProjects - normalized item shape", () => {
  it("normalizes a project row into an UnscheduledProjectCalendarItem", async () => {
    const { client } = buildFakeClient([
      {
        id: "p1",
        title: "New client intake",
        status: "New",
        priority: "Medium",
        client_name: "Acme Co",
        created_at: "2027-01-01T00:00:00.000Z",
      },
    ]);

    const result = await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    expect(result).toEqual({
      ok: true,
      items: [
        {
          id: "p1",
          title: "New client intake",
          clientName: "Acme Co",
          status: "New",
          priority: "Medium",
          createdAt: "2027-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("falls back to a placeholder title for a row with no title", async () => {
    const { client } = buildFakeClient([
      {
        id: "p1",
        title: null,
        status: null,
        priority: null,
        client_name: null,
        created_at: null,
      },
    ]);

    const result = await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0].title).toBe("Untitled project");
    }
  });

  it("returns an empty list when there are no unscheduled projects", async () => {
    const { client } = buildFakeClient([]);

    const result = await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    expect(result).toEqual({ ok: true, items: [] });
  });
});

describe("loadUnscheduledProjects - error handling", () => {
  it("returns a 500 result when the query fails", async () => {
    const { client } = buildFakeClient(null, { message: "db down" });

    const result = await loadUnscheduledProjects({ supabase: client, userId: USER_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });
});
