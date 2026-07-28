import { describe, expect, it } from "vitest";

import {
  buildSaveDeadlineDate,
  buildSaveSubtaskDeadlineText,
  getExtractResponseProjectMetadata,
  getExtractResponseTasks,
  getNormalizedExtractedContactName,
  mapSavedProject,
  mapSavedTaskToRow,
  type PreviewItem,
} from "./extract-workspace";
import { localDateToDateOnly } from "@/lib/tasks/date-only";
import type { PreviewProjectGroup } from "./editable-preview-list";

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

function buildPreviewItem(overrides: Partial<PreviewItem> = {}): PreviewItem {
  return {
    previewId: "preview-1",
    client: "Acme Co",
    task: "Ship homepage",
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "Not Started",
    source: "Text extraction",
    deadline_date: null,
    deadline_original_text: null,
    ...overrides,
  };
}

function buildGroup(
  items: Array<{ preview: PreviewItem; originalIndex: number }>,
  overrides: Partial<PreviewProjectGroup> = {}
): PreviewProjectGroup {
  return {
    key: "group-1",
    clientName: "Acme Co",
    contactName: "",
    projectTitle: "Homepage project",
    projectSummary: "",
    amount: "",
    deadline: items[0]?.preview.deadline_original_text || "",
    deadlineDate: items[0]?.preview.deadline_date ?? null,
    priority: "Medium",
    prioritySource: "unknown",
    source: "Text extraction",
    client_phone: "",
    client_email: "",
    client_notes: "",
    items,
    ...overrides,
  };
}

describe("buildSaveDeadlineDate - project-level save payload (extract-workspace.tsx)", () => {
  it("returns a valid canonical YYYY-MM-DD value unchanged (no day shift)", () => {
    const fixedDates = [
      "2027-01-20",
      "2026-01-01",
      "2026-12-31",
      "2028-02-29", // leap year
      localDateToDateOnly(new Date(2026, 6, 16, 12, 0, 0, 0)),
    ];

    for (const date of fixedDates) {
      expect(buildSaveDeadlineDate(date)).toBe(date);
    }
  });

  it("rejects a non-existent calendar date (e.g. Feb 29 in a non-leap year)", () => {
    expect(buildSaveDeadlineDate("2026-02-29")).toBeNull();
  });

  it("returns null for empty, null, or undefined input", () => {
    expect(buildSaveDeadlineDate("")).toBeNull();
    expect(buildSaveDeadlineDate(null)).toBeNull();
    expect(buildSaveDeadlineDate(undefined)).toBeNull();
  });
});

describe("buildSaveSubtaskDeadlineText - per-subtask save payload (extract-workspace.tsx)", () => {
  /*
    import-persistence.server.ts always re-derives a subtask's own persisted
    deadline_date by re-parsing this deadline_text server-side -- it never
    trusts a client-supplied per-subtask deadline_date. A DeadlineField
    picker commit intentionally leaves deadline/deadline_original_text (AI
    provenance) untouched on the preview item (see AiProjectReviewPanel's
    commitDeadline / updatePreviewItem's generic "deadline_date" fallback),
    so buildSaveSubtaskDeadlineText must prefer the canonical deadline_date
    over the stale provenance text for the save payload to actually reflect
    what the user picked.
  */
  it("prefers the canonical deadline_date over stale provenance text once a date has been picked", () => {
    const preview = buildPreviewItem({
      deadline_date: "2026-08-15",
      deadline_original_text: "next Friday",
      deadline: "08/14/26",
    });
    const group = buildGroup([{ preview, originalIndex: 0 }]);

    expect(buildSaveSubtaskDeadlineText(preview, group, false)).toBe(
      "2026-08-15"
    );
  });

  it('sends an empty deadline_text when the item was explicitly cleared (deadline_date === "")', () => {
    const preview = buildPreviewItem({
      deadline_date: "",
      deadline_original_text: "next Friday",
      deadline: "next Friday",
    });
    const group = buildGroup([{ preview, originalIndex: 0 }]);

    expect(buildSaveSubtaskDeadlineText(preview, group, false)).toBe("");
    expect(buildSaveSubtaskDeadlineText(preview, group, true)).toBe("");
  });

  it("falls back to the original AI-provided provenance text when no canonical date was ever resolved", () => {
    const preview = buildPreviewItem({
      deadline_date: null,
      deadline_original_text: "sometime next quarter",
      deadline: "sometime next quarter",
    });
    const group = buildGroup([{ preview, originalIndex: 0 }]);

    expect(buildSaveSubtaskDeadlineText(preview, group, false)).toBe(
      "sometime next quarter"
    );
  });

  it("falls back to the group's deadline text (non-metadata mode) when the item has no text of its own", () => {
    const preview = buildPreviewItem({
      deadline_date: null,
      deadline_original_text: null,
      deadline: "",
    });
    const group = buildGroup([{ preview, originalIndex: 0 }], {
      deadline: "group-level fallback text",
    });

    expect(buildSaveSubtaskDeadlineText(preview, group, false)).toBe(
      "group-level fallback text"
    );
    expect(buildSaveSubtaskDeadlineText(preview, group, true)).toBe("");
  });
});
