import { describe, expect, it } from "vitest";

import {
  getQueryErrorMessage,
  loadDashboardTasksForUser,
} from "./load-dashboard-tasks.server";

type RecordedCall = { method: string; args: unknown[] };

/**
 * Fake Supabase client that records every filter-chain call it receives,
 * so the view -> query-filter contract (which columns/conditions each
 * TasksView applies) is directly verifiable without a live database.
 */
function buildRecordingFakeClient(rows: unknown[], error: unknown = null) {
  const calls: RecordedCall[] = [];

  const builder = {
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return builder;
    },
    is(...args: unknown[]) {
      calls.push({ method: "is", args });
      return builder;
    },
    or(...args: unknown[]) {
      calls.push({ method: "or", args });
      return builder;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args });
      return Promise.resolve(
        error ? { data: null, error } : { data: rows, error: null }
      );
    },
  };

  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });

      return {
        select(columns: string) {
          calls.push({ method: "select", args: [columns] });
          return builder;
        },
      };
    },
  };

  return { client, calls };
}

function methodNames(calls: RecordedCall[]) {
  return calls.map((call) => call.method);
}

describe("loadDashboardTasksForUser - view filter contract", () => {
  it("active view excludes deleted and archived tasks", async () => {
    const { client, calls } = buildRecordingFakeClient([]);

    await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "active",
    });

    expect(calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });
    expect(calls).toContainEqual({
      method: "or",
      args: ["is_archived.eq.false,is_archived.is.null"],
    });
    expect(calls).not.toContainEqual(
      expect.objectContaining({ method: "eq", args: ["is_archived", true] })
    );
  });

  it("archived view filters to archived tasks and still excludes deleted", async () => {
    const { client, calls } = buildRecordingFakeClient([]);

    await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "archived",
    });

    expect(calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["is_archived", true],
    });
    expect(methodNames(calls)).not.toContain("or");
  });

  it("all view excludes deleted tasks but does not filter by archive state", async () => {
    const { client, calls } = buildRecordingFakeClient([]);

    await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "all",
    });

    expect(calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });
    expect(methodNames(calls)).not.toContain("or");
    expect(calls).not.toContainEqual(
      expect.objectContaining({ method: "eq", args: ["is_archived", true] })
    );
  });

  it("stats view does not exclude deleted tasks", async () => {
    const { client, calls } = buildRecordingFakeClient([]);

    await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "stats",
    });

    expect(calls).not.toContainEqual(
      expect.objectContaining({ method: "is", args: ["deleted_at", null] })
    );
  });

  it("applies an additional project_id filter only when projectId is provided", async () => {
    const { client, calls } = buildRecordingFakeClient([]);

    await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "active",
      projectId: "project-1",
    });

    expect(calls).toContainEqual({
      method: "eq",
      args: ["project_id", "project-1"],
    });
  });

  it("does not filter by project_id when projectId is omitted", async () => {
    const { client, calls } = buildRecordingFakeClient([]);

    await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "active",
    });

    expect(calls).not.toContainEqual(
      expect.objectContaining({ method: "eq", args: ["project_id"] })
    );
  });
});

describe("loadDashboardTasksForUser - row shape and error handling", () => {
  it("normalizes an embedded single-element clients/projects array into client/project fields", async () => {
    const { client } = buildRecordingFakeClient([
      {
        id: 1,
        task_title: "Task A",
        clients: [{ id: "c1", name: "Acme" }],
        projects: [{ id: "p1", title: "Project A" }],
      },
    ]);

    const tasks = await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "active",
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].client).toEqual({ id: "c1", name: "Acme" });
    expect(tasks[0].project).toEqual({ id: "p1", title: "Project A" });
    expect(tasks[0]).not.toHaveProperty("clients");
    expect(tasks[0]).not.toHaveProperty("projects");
  });

  it("resolves client/project to null when the embed is an empty array", async () => {
    const { client } = buildRecordingFakeClient([
      { id: 1, task_title: "Task A", clients: [], projects: null },
    ]);

    const tasks = await loadDashboardTasksForUser({
      supabase: client,
      userId: "user-1",
      view: "active",
    });

    expect(tasks[0].client).toBeNull();
    expect(tasks[0].project).toBeNull();
  });

  it("throws with the query error's message when the query fails", async () => {
    const { client } = buildRecordingFakeClient([], { message: "db down" });

    await expect(
      loadDashboardTasksForUser({
        supabase: client,
        userId: "user-1",
        view: "active",
      })
    ).rejects.toThrow("db down");
  });

  it("throws with a fallback message when the query error has no message", async () => {
    const { client } = buildRecordingFakeClient([], {});

    await expect(
      loadDashboardTasksForUser({
        supabase: client,
        userId: "user-1",
        view: "active",
      })
    ).rejects.toThrow("Failed to load dashboard tasks.");
  });
});

describe("getQueryErrorMessage", () => {
  it("extracts the message from a genuine Postgrest-style error object", () => {
    expect(getQueryErrorMessage({ message: "boom" }, "fallback")).toBe(
      "boom"
    );
  });

  it("falls back for a non-object error", () => {
    expect(getQueryErrorMessage("just a string", "fallback")).toBe(
      "fallback"
    );
  });

  it("falls back for null", () => {
    expect(getQueryErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("falls back when message is present but not a string", () => {
    expect(getQueryErrorMessage({ message: 42 }, "fallback")).toBe(
      "fallback"
    );
  });

  it("falls back when message is an empty string", () => {
    expect(getQueryErrorMessage({ message: "" }, "fallback")).toBe(
      "fallback"
    );
  });
});
