import { describe, expect, it } from "vitest";

import type { TaskProjectSubtask } from "../task-types";
import type { TaskResource } from "../../resources/resource-api";
import {
  buildAutomaticTaskItems,
  buildQuickShareResourceItems,
  buildQuickShareTaskItems,
  buildQuickShareTaskProgress,
  isEligibleSubtask,
  percentComplete,
  quickShareAttachmentCandidates,
  safeAttachmentLabel,
  suggestAutomaticPublicGroup,
} from "./quick-share-defaults";

function subtask(overrides: Partial<TaskProjectSubtask> = {}): TaskProjectSubtask {
  return {
    id: 1,
    project_id: "11111111-1111-4111-8111-111111111111",
    title: "Design hero",
    status: "New",
    priority: "Medium",
    amount: "",
    deadline: "",
    ...overrides,
  };
}

function resource(overrides: Partial<TaskResource> = {}): TaskResource {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "user-1",
    project_id: "11111111-1111-4111-8111-111111111111",
    task_id: null,
    resource_type: "link",
    title: "Brand brief",
    url: "https://example.com/brief",
    storage_path: null,
    file_name: null,
    mime_type: null,
    size_bytes: null,
    notes: null,
    created_at: "2026-08-03T10:00:00.000Z",
    updated_at: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

describe("suggestAutomaticPublicGroup", () => {
  it("maps Done to completed", () => {
    expect(suggestAutomaticPublicGroup("Done")).toBe("completed");
  });

  it("maps New to coming_up", () => {
    expect(suggestAutomaticPublicGroup("New")).toBe("coming_up");
  });

  it("maps In Progress, Review, Urgent, and any unknown status to in_progress -- never surfacing 'Urgent' as a group name", () => {
    expect(suggestAutomaticPublicGroup("In Progress")).toBe("in_progress");
    expect(suggestAutomaticPublicGroup("Review")).toBe("in_progress");
    expect(suggestAutomaticPublicGroup("Urgent")).toBe("in_progress");
    expect(suggestAutomaticPublicGroup("Some Future Status")).toBe("in_progress");
  });
});

describe("isEligibleSubtask", () => {
  it("excludes deleted and archived subtasks", () => {
    expect(isEligibleSubtask(subtask({ deleted_at: "2026-08-01T00:00:00Z" }))).toBe(false);
    expect(isEligibleSubtask(subtask({ is_archived: true }))).toBe(false);
    expect(isEligibleSubtask(subtask())).toBe(true);
  });
});

describe("buildAutomaticTaskItems", () => {
  it("builds one item per eligible subtask, in order, with sequential displayOrder starting at 0", () => {
    const items = buildAutomaticTaskItems([
      subtask({ id: 1, status: "New" }),
      subtask({ id: 2, status: "Done" }),
      subtask({ id: 3, status: "In Progress" }),
    ]);

    expect(items).toEqual([
      { subtaskId: "1", publicGroup: "coming_up", waitingForClientFeedback: false, displayOrder: 0 },
      { subtaskId: "2", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 1 },
      { subtaskId: "3", publicGroup: "in_progress", waitingForClientFeedback: false, displayOrder: 2 },
    ]);
  });

  it("never assigns waitingForClientFeedback automatically", () => {
    const items = buildAutomaticTaskItems([subtask({ id: 1 })]);
    expect(items[0].waitingForClientFeedback).toBe(false);
  });

  it("excludes deleted/archived tasks from the automatic set entirely", () => {
    const items = buildAutomaticTaskItems([
      subtask({ id: 1 }),
      subtask({ id: 2, is_archived: true }),
      subtask({ id: 3, deleted_at: "2026-08-01T00:00:00Z" }),
    ]);

    expect(items.map((item) => item.subtaskId)).toEqual(["1"]);
  });
});

describe("buildQuickShareTaskItems -- persisted mapping always wins", () => {
  it("returns the automatic set when nothing is mapped yet", () => {
    const items = buildQuickShareTaskItems([subtask({ id: 1, status: "Done" })], []);
    expect(items).toEqual([
      { subtaskId: "1", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 0 },
    ]);
  });

  it("returns undefined (omit from the save request) once ANY task is already mapped, never recomputing or resending the set", () => {
    const items = buildQuickShareTaskItems(
      [subtask({ id: 1, status: "Done" }), subtask({ id: 2, status: "New" })],
      [{ subtaskId: "1", publicGroup: "in_progress", waitingForClientFeedback: false, displayOrder: 0 }]
    );
    expect(items).toBeUndefined();
  });
});

describe("buildQuickShareTaskProgress -- the pre-share preview", () => {
  it("previews the automatic default grouping when nothing is mapped yet", () => {
    const progress = buildQuickShareTaskProgress(
      [subtask({ id: 1, status: "Done" }), subtask({ id: 2, status: "New" }), subtask({ id: 3, status: "In Progress" })],
      []
    );

    expect(progress).toEqual({
      completed: 1,
      inProgress: 1,
      comingUp: 1,
      waitingForFeedback: 0,
      total: 3,
      usingAutomaticDefaults: true,
    });
  });

  it("reflects the persisted mapping exactly once one exists, never recomputed from current subtask status", () => {
    const progress = buildQuickShareTaskProgress(
      [subtask({ id: 1, status: "New" })],
      [{ subtaskId: "1", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 0 }]
    );

    expect(progress.completed).toBe(1);
    expect(progress.comingUp).toBe(0);
    expect(progress.usingAutomaticDefaults).toBe(false);
  });

  it("counts a waitingForClientFeedback task in its own bucket, not its publicGroup bucket", () => {
    const progress = buildQuickShareTaskProgress(
      [],
      [{ subtaskId: "1", publicGroup: "in_progress", waitingForClientFeedback: true, displayOrder: 0 }]
    );
    expect(progress.waitingForFeedback).toBe(1);
    expect(progress.inProgress).toBe(0);
  });
});

describe("percentComplete", () => {
  it("computes a rounded percentage", () => {
    expect(percentComplete({ completed: 1, inProgress: 1, comingUp: 0, waitingForFeedback: 0, total: 3 })).toBe(33);
  });

  it("returns null when total is 0 (never a fabricated 0%)", () => {
    expect(percentComplete({ completed: 0, inProgress: 0, comingUp: 0, waitingForFeedback: 0, total: 0 })).toBeNull();
  });
});

describe("quickShareAttachmentCandidates -- Notes never selectable", () => {
  it("includes link and file Resources, excludes Notes", () => {
    const candidates = quickShareAttachmentCandidates([
      resource({ id: "r1", resource_type: "link", url: "https://x", storage_path: null, file_name: null }),
      resource({ id: "r2", resource_type: "file", url: null, storage_path: "path/to/file", file_name: "f.pdf" }),
      resource({ id: "r3", resource_type: "note", url: null, storage_path: null, file_name: null }),
    ]);

    expect(candidates.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("safeAttachmentLabel", () => {
  it("uses the Resource's own title when present", () => {
    expect(safeAttachmentLabel(resource({ title: "Brand brief" }))).toBe("Brand brief");
  });

  it("falls back to the generic 'Project attachment' label when no title exists, never leaking notes/storage_path", () => {
    expect(safeAttachmentLabel(resource({ title: null }))).toBe("Project attachment");
    expect(safeAttachmentLabel(resource({ title: "" }))).toBe("Project attachment");
    expect(safeAttachmentLabel(resource({ title: "   " }))).toBe("Project attachment");
  });

  it("truncates an unusually long title to the DB's 120-character bound", () => {
    const longTitle = "x".repeat(200);
    expect(safeAttachmentLabel(resource({ title: longTitle })).length).toBe(120);
  });
});

describe("buildQuickShareResourceItems -- persisted-first, safe-default otherwise", () => {
  it("an already-mapped Resource keeps its persisted publicLabel/canDownload/displayOrder exactly, even though it is re-selected here", () => {
    const items = buildQuickShareResourceItems(
      ["r1"],
      [resource({ id: "r1", title: "internal-filename.pdf" })],
      [{ resourceId: "r1", publicLabel: "Final brief", canDownload: true, displayOrder: 7 }]
    );

    expect(items).toEqual([
      { resourceId: "r1", publicLabel: "Final brief", canDownload: true, displayOrder: 7 },
    ]);
  });

  it("a newly-selected, never-mapped Resource gets the safe auto label, canDownload false, and a freshly assigned displayOrder", () => {
    const items = buildQuickShareResourceItems(["r1"], [resource({ id: "r1", title: "Brand brief" })], []);

    expect(items).toEqual([{ resourceId: "r1", publicLabel: "Brand brief", canDownload: false, displayOrder: 0 }]);
  });

  it("a newly-selected Resource's fresh displayOrder never collides with a retained one", () => {
    const items = buildQuickShareResourceItems(
      ["r1", "r2"],
      [resource({ id: "r1", title: "Existing" }), resource({ id: "r2", title: "New one" })],
      [{ resourceId: "r1", publicLabel: "Existing", canDownload: false, displayOrder: 9 }]
    );

    const newItem = items.find((item) => item.resourceId === "r2");
    expect(newItem?.displayOrder).toBe(10);
  });

  it("silently skips a selected id that no longer resolves to a real Resource", () => {
    const items = buildQuickShareResourceItems(["missing"], [], []);
    expect(items).toEqual([]);
  });
});
