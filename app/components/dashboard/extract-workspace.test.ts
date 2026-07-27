import { describe, expect, it } from "vitest";

import {
  getExtractResponseProjectMetadata,
  getExtractResponseTasks,
  getNormalizedExtractedContactName,
  mapSavedProject,
  mapSavedTaskToRow,
} from "./extract-workspace";

describe("getExtractResponseTasks - /api/extract and /api/extract-image response narrowing", () => {
  it("returns the tasks array from a well-formed response", () => {
    expect(getExtractResponseTasks({ tasks: [{ task_title: "A" }] })).toEqual([
      { task_title: "A" },
    ]);
  });

  it("returns an empty array for a malformed or missing tasks field", () => {
    expect(getExtractResponseTasks({ tasks: "not an array" })).toEqual([]);
    expect(getExtractResponseTasks({})).toEqual([]);
    expect(getExtractResponseTasks(null)).toEqual([]);
    expect(getExtractResponseTasks(undefined)).toEqual([]);
    expect(getExtractResponseTasks("unexpected string")).toEqual([]);
    expect(getExtractResponseTasks([{ tasks: [] }])).toEqual([]);
  });
});

describe("getExtractResponseProjectMetadata - untrusted project metadata narrowing", () => {
  it("returns null when project is absent, null, or malformed", () => {
    expect(getExtractResponseProjectMetadata({})).toBeNull();
    expect(getExtractResponseProjectMetadata({ project: null })).toBeNull();
    expect(getExtractResponseProjectMetadata(null)).toBeNull();
    expect(
      getExtractResponseProjectMetadata({ project: "not an object" })
    ).toBeNull();
  });
});

describe("getNormalizedExtractedContactName - raw extracted task narrowing", () => {
  it("prefers a real contact name over a generic placeholder", () => {
    expect(
      getNormalizedExtractedContactName({
        contact_name: "Jordan",
        client_name: "Acme Co",
      })
    ).toBe("Jordan");
  });

  it("falls back to the client name when the contact value is generic", () => {
    expect(
      getNormalizedExtractedContactName({
        contact_name: "Unknown",
        client_name: "Acme Co",
      })
    ).toBe("Acme Co");
  });

  it("falls back to an empty string when the task is malformed", () => {
    expect(getNormalizedExtractedContactName(null)).toBe("");
    expect(getNormalizedExtractedContactName("unexpected")).toBe("");
    expect(getNormalizedExtractedContactName(42)).toBe("");
  });
});

describe("mapSavedProject - /api/projects/import createdTasks row narrowing", () => {
  it("maps a well-formed embedded project", () => {
    const project = mapSavedProject({
      project_id: "fallback-id",
      project: {
        id: "project-1",
        title: "Website redesign",
        status: "New",
        amount: 250,
      },
    });

    expect(project).toEqual(
      expect.objectContaining({
        id: "project-1",
        title: "Website redesign",
        status: "New",
        amount: "250",
      })
    );
  });

  it("returns null when there is no embedded project or projects field", () => {
    expect(mapSavedProject({ id: 1 })).toBeNull();
    expect(mapSavedProject(null)).toBeNull();
    expect(mapSavedProject("unexpected")).toBeNull();
    expect(mapSavedProject([{ project: { id: "1" } }])).toBeNull();
  });

  it("falls back to the flat project_id when the embedded project has no id", () => {
    const project = mapSavedProject({
      project_id: "fallback-id",
      project: { title: "No id here" },
    });

    expect(project?.id).toBe("fallback-id");
  });
});

describe("mapSavedTaskToRow - /api/projects/import createdTasks row -> TaskRow", () => {
  it("maps a well-formed saved task row with an embedded client", () => {
    const row = mapSavedTaskToRow({
      id: 7,
      task_title: "Ship homepage",
      status: "New",
      priority: "High",
      amount: 500,
      client: {
        id: "client-1",
        name: "Acme Co",
        contact_name: "Jane",
        phone: "555-1234",
      },
    });

    expect(row.id).toBe(7);
    expect(row.task).toBe("Ship homepage");
    expect(row.amount).toBe("500");
    expect(row.client).toEqual({
      id: "client-1",
      name: "Acme Co",
      contact_name: "Jane",
      phone: "555-1234",
      email: null,
      notes: null,
    });
  });

  it("fails closed for a null or malformed saved row", () => {
    const row = mapSavedTaskToRow(null);

    expect(row.client).toBeNull();
    expect(row.project).toBeNull();
    expect(row.task).toBe("");
    expect(row.status).toBe("New");
    expect(row.priority).toBe("Medium");
    expect(Number.isNaN(row.id)).toBe(true);
  });

  it("has no client when the client field is absent", () => {
    const row = mapSavedTaskToRow({ id: 1, task_title: "Solo task" });

    expect(row.client).toBeNull();
  });

  it("preserves an empty-string contact_name instead of falling through to the client's contact_name", () => {
    const row = mapSavedTaskToRow({
      id: 1,
      contact_name: "",
      client: { id: "c1", name: "Acme", contact_name: "Client Contact" },
    });

    expect(row.contact_name).toBe("");
  });

  it("falls through to the client's contact_name only when the task-level field is genuinely absent", () => {
    const row = mapSavedTaskToRow({
      id: 1,
      client: { id: "c1", name: "Acme", contact_name: "Client Contact" },
    });

    expect(row.contact_name).toBe("Client Contact");
  });

  it("reads subtask_order only when it is genuinely a number", () => {
    const withNumber = mapSavedTaskToRow({ id: 1, subtask_order: 2 });
    expect(withNumber.subtask_order).toBe(2);

    const withString = mapSavedTaskToRow({ id: 1, subtask_order: "2" });
    expect(withString.subtask_order).toBeNull();
  });

  it("preserves an empty deadline_text instead of treating it as missing", () => {
    const row = mapSavedTaskToRow({ id: 1, deadline_text: "" });

    expect(row.deadline_original_text).toBeNull();
  });
});
