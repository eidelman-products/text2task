import { describe, expect, it } from "vitest";

import { normalizeTaskFromApi } from "./dashboard-helpers";

describe("normalizeTaskFromApi - untrusted /api/tasks and /api/tasks/snapshot rows", () => {
  it("normalizes a well-formed row with an embedded client and project", () => {
    const row = normalizeTaskFromApi({
      id: 42,
      client: {
        id: "client-1",
        name: "Acme Co",
        contact_name: "Jane",
        phone: "555-1234",
        email: "jane@acme.test",
        notes: "VIP",
      },
      project: {
        id: "project-1",
        title: "Website redesign",
        status: "In Progress",
      },
      task: "Ship homepage",
      amount: 500,
      status: "New",
      priority: "High",
    });

    expect(row.id).toBe(42);
    expect(row.client).toEqual({
      id: "client-1",
      name: "Acme Co",
      contact_name: "Jane",
      phone: "555-1234",
      email: "jane@acme.test",
      notes: "VIP",
    });
    expect(row.project?.id).toBe("project-1");
    expect(row.project?.title).toBe("Website redesign");
    expect(row.task).toBe("Ship homepage");
    expect(row.amount).toBe("500");
    expect(row.priority).toBe("High");
  });

  it("fails closed for a null, undefined, or non-object body", () => {
    for (const malformed of [null, undefined, "unexpected string", 42, true]) {
      const row = normalizeTaskFromApi(malformed);

      expect(row.client?.name).toBe("Unassigned");
      expect(row.project).toBeNull();
      expect(row.task).toBe("");
      expect(row.status).toBe("New");
      expect(row.priority).toBe("Medium");
    }
  });

  it("fails closed for an array body instead of treating it as a record", () => {
    const row = normalizeTaskFromApi([{ id: 1 }]);

    expect(row.client?.name).toBe("Unassigned");
    expect(row.project).toBeNull();
  });

  it("has no embedded project when project and projects are both absent", () => {
    const row = normalizeTaskFromApi({ id: 1, task: "Solo task" });

    expect(row.project).toBeNull();
  });

  it("falls back through legacy flat client field names when client is absent", () => {
    const row = normalizeTaskFromApi({
      id: 1,
      client_name: "Flat Co",
      client_phone: "555-0000",
      contact_name: "Flat Contact",
    });

    expect(row.client?.name).toBe("Flat Co");
    expect(row.client_phone).toBe("555-0000");
    expect(row.contact_name).toBe("Flat Contact");
  });

  it("defaults the client name to Unassigned when no client name is present anywhere", () => {
    const row = normalizeTaskFromApi({ id: 1 });

    expect(row.client?.name).toBe("Unassigned");
  });

  it("maps legacy Not Started status to New", () => {
    const row = normalizeTaskFromApi({ id: 1, status: "Not Started" });

    expect(row.status).toBe("New");
  });

  it("preserves an empty deadline_text instead of silently falling back to deadline_original_text", () => {
    const row = normalizeTaskFromApi({
      id: 1,
      deadline_text: "",
      deadline_original_text: "next Friday",
    });

    expect(row.deadline_original_text).toBeNull();
  });

  it("skips a non-string field value and falls back safely instead of coercing it", () => {
    const row = normalizeTaskFromApi({
      id: 1,
      client_name: 12345,
      task: { nested: "object" },
    });

    expect(row.client?.name).toBe("Unassigned");
    expect(row.task).toBe("");
  });

  it("treats a numeric amount as a real amount, not a missing one", () => {
    const row = normalizeTaskFromApi({ id: 1, amount: 0 });

    expect(row.amount).toBe("0");
  });

  it("normalizes project_id from either the flat field or the embedded project id", () => {
    const flatOnly = normalizeTaskFromApi({ id: 1, project_id: "proj-flat" });
    expect(flatOnly.project_id).toBe("proj-flat");

    const embeddedOnly = normalizeTaskFromApi({
      id: 1,
      project: { id: "proj-embedded" },
    });
    expect(embeddedOnly.project_id).toBe("proj-embedded");
  });

  it("reads subtask_order only when it is genuinely a number", () => {
    const withNumber = normalizeTaskFromApi({ id: 1, subtask_order: 3 });
    expect(withNumber.subtask_order).toBe(3);

    const withString = normalizeTaskFromApi({ id: 1, subtask_order: "3" });
    expect(withString.subtask_order).toBeNull();
  });
});
