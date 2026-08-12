// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TaskResource } from "../../resources/resource-api";
import type { TaskProjectGroup, TaskProjectSubtask } from "../task-types";
import { ShareLinkConfigurationEditor } from "./share-link-configuration-editor";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";

function subtask(overrides: Partial<TaskProjectSubtask> = {}): TaskProjectSubtask {
  return {
    id: 1,
    project_id: PROJECT_ID,
    title: "Design hero",
    status: "New",
    priority: "Medium",
    amount: "",
    deadline: "",
    ...overrides,
  };
}

function project(subtasks: TaskProjectSubtask[] = []): TaskProjectGroup {
  return {
    key: `project::${PROJECT_ID}`,
    project_id: PROJECT_ID,
    project: null,
    clientName: "Acme",
    projectTitle: "Website launch",
    projectSummary: "",
    tasks: [],
    subtasks,
    primaryTask: {
      id: 1,
      client: null,
      project: null,
      task: "Design hero",
      amount: "",
      deadline: "",
      priority: "Medium",
      status: "New",
      source: "manual",
      project_id: PROJECT_ID,
      created_at: "2026-08-03T10:00:00.000Z",
    },
    taskIds: subtasks.map((s) => s.id),
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    hasContactDetails: false,
    subtaskCount: subtasks.length,
    completedSubtaskCount: 0,
  };
}

function resource(overrides: Partial<TaskResource> = {}): TaskResource {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "user-1",
    project_id: PROJECT_ID,
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

function mappedTask(overrides: Partial<EditorProps["mappedTasks"][number]> = {}): EditorProps["mappedTasks"][number] {
  return {
    subtaskId: "1",
    publicGroup: "waiting_for_feedback",
    waitingForClientFeedback: true,
    displayOrder: 8,
    ...overrides,
  };
}

function mappedResource(
  overrides: Partial<EditorProps["mappedResources"][number]> = {}
): EditorProps["mappedResources"][number] {
  return {
    resourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    publicLabel: "Final logo",
    canDownload: false,
    displayOrder: 9,
    ...overrides,
  };
}

function link(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK_ID,
    publicId: "abcdefgh12345678ijklmnop",
    state: "active" as const,
    expiresAt: null,
    hasPin: false,
    commentsEnabled: true,
    clientFacingSubtitle: null,
    contentDirection: "auto" as const,
    titleVisible: false,
    statusVisible: false,
    targetDateVisible: false,
    configurationVersion: 1,
    createdAt: "2026-08-10T00:00:00Z",
    activatedAt: "2026-08-10T00:00:00Z",
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    ...overrides,
  };
}

type EditorProps = ComponentProps<typeof ShareLinkConfigurationEditor>;

function renderEditor(overrides: Partial<EditorProps> = {}) {
  const onSave = vi.fn();
  const onRetryResources = vi.fn();
  const defaultProps: EditorProps = {
    link: link(),
    mappedTasks: [],
    mappedResources: [],
    currentUpdate: null,
    project: project(),
    resources: [],
    resourcesLoading: false,
    resourcesError: null,
    onRetryResources,
    pending: false,
    disabled: false,
    onSave,
    ...overrides,
  };
  const view = render(<ShareLinkConfigurationEditor {...defaultProps} />);
  return { onSave, onRetryResources, ...view };
}

describe("ShareLinkConfigurationEditor - publication-intent toggles", () => {
  it("loads the three Phase 1C toggles from the link's current values", () => {
    renderEditor({ link: link({ titleVisible: true, statusVisible: false, targetDateVisible: true }) });

    expect(screen.getByRole("checkbox", { name: /show project title/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /show project status/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /show target date/i })).toBeChecked();
  });

  it("toggling and saving includes the updated values in the settings group", async () => {
    const { onSave } = renderEditor({ link: link({ titleVisible: false }) });

    await userEvent.click(screen.getByRole("checkbox", { name: /show project title/i }));
    await userEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].settings).toMatchObject({
      titleVisible: true,
      statusVisible: false,
      targetDateVisible: false,
    });
  });
});

describe("ShareLinkConfigurationEditor - existing share settings", () => {
  it("loads commentsEnabled/clientFacingSubtitle/contentDirection from the link", () => {
    renderEditor({
      link: link({
        commentsEnabled: false,
        clientFacingSubtitle: "Hello client",
        contentDirection: "rtl",
      }),
    });

    expect(screen.getByRole("checkbox", { name: /allow client comments/i })).not.toBeChecked();
    expect(screen.getByDisplayValue("Hello client")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Right to left")).toBeInTheDocument();
  });

  it("editing and saving sends the updated settings group", async () => {
    const { onSave } = renderEditor({ link: link({ clientFacingSubtitle: null }) });

    const subtitleInput = screen.getByPlaceholderText(/optional short message/i);
    await userEvent.type(subtitleInput, "Welcome!");
    await userEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    expect(onSave.mock.calls[0][0].settings.clientFacingSubtitle).toBe("Welcome!");
  });
});

describe("ShareLinkConfigurationEditor - task selection (no auto-select, new-selection defaults)", () => {
  it("does not auto-select any task by default", () => {
    renderEditor({ project: project([subtask({ id: 1, title: "Task A" }), subtask({ id: 2, title: "Task B" })]) });

    expect(screen.getByRole("checkbox", { name: "Task A" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Task B" })).not.toBeChecked();
  });

  it("reflects previously mapped tasks as selected, initialized from the PERSISTED metadata, never guessed from internal status", () => {
    renderEditor({
      project: project([
        subtask({ id: 1, title: "Task A", status: "New" }),
        subtask({ id: 2, title: "Task B" }),
      ]),
      mappedTasks: [
        mappedTask({ subtaskId: "1", publicGroup: "waiting_for_feedback", waitingForClientFeedback: true, displayOrder: 8 }),
      ],
    });

    expect(screen.getByRole("checkbox", { name: "Task A" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Task B" })).not.toBeChecked();
    // "New" would suggest "in_progress" via the new-selection heuristic --
    // the persisted "waiting_for_feedback" value must win instead.
    expect(screen.getByDisplayValue("Waiting for client feedback")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /waiting for client feedback/i })).toBeChecked();
  });

  it("omits the tasks group from the save payload when the section was never touched", async () => {
    const { onSave } = renderEditor({
      project: project([subtask({ id: 1, title: "Task A" })]),
      mappedTasks: [mappedTask({ subtaskId: "1" })],
    });

    await userEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    expect(onSave.mock.calls[0][0].tasks).toBeUndefined();
  });

  it("a brand-new selection receives the safe new-item defaults, and a displayOrder assigned only at save time", async () => {
    const { onSave } = renderEditor({
      project: project([subtask({ id: 1, title: "Task A", status: "Done" })]),
    });

    // No prior mapping exists, so nothing is pre-checked or pre-filled
    // with a persisted value -- suggestPublicGroup only applies once the
    // owner actually selects the task.
    expect(screen.getByRole("checkbox", { name: "Task A" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: "Task A" }));
    await userEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    const tasks = onSave.mock.calls[0][0].tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      subtaskId: "1",
      publicGroup: "completed",
      waitingForClientFeedback: false,
      displayOrder: 0,
    });
  });
});

describe("ShareLinkConfigurationEditor - EXACT REGRESSION: reopen, edit only one task, save must preserve the untouched sibling exactly", () => {
  it("Task A's persisted publicGroup/waitingForClientFeedback/displayOrder survive a save that only changes Task B", async () => {
    const { onSave } = renderEditor({
      project: project([
        // Internal status deliberately does NOT match Task A's real
        // persisted publicGroup/waitingForClientFeedback -- if the
        // editor ever fell back to inference from internal status, this
        // assertion would catch it.
        subtask({ id: 1, title: "Task A", status: "New" }),
        subtask({ id: 2, title: "Task B", status: "Done" }),
      ]),
      mappedTasks: [
        mappedTask({
          subtaskId: "1",
          publicGroup: "waiting_for_feedback",
          waitingForClientFeedback: true,
          displayOrder: 8,
        }),
        mappedTask({
          subtaskId: "2",
          publicGroup: "completed",
          waitingForClientFeedback: false,
          displayOrder: 4,
        }),
      ],
    });

    // Change ONLY Task B's publicGroup. getAllByRole("combobox") also
    // includes the Share Settings "Text direction" select (index 0), so
    // Task A's select is index 1 and Task B's is index 2.
    const taskBGroupSelect = screen.getAllByRole("combobox")[2];
    await userEvent.selectOptions(taskBGroupSelect, "in_progress");

    await userEvent.click(screen.getByRole("button", { name: /^save configuration$/i }));

    const tasks: Array<{
      subtaskId: string;
      publicGroup: string;
      waitingForClientFeedback: boolean;
      displayOrder: number;
    }> = onSave.mock.calls[0][0].tasks;
    expect(tasks).toHaveLength(2);

    const taskA = tasks.find((t) => t.subtaskId === "1");
    expect(taskA).toEqual({
      subtaskId: "1",
      publicGroup: "waiting_for_feedback",
      waitingForClientFeedback: true,
      displayOrder: 8,
    });

    const taskB = tasks.find((t) => t.subtaskId === "2");
    expect(taskB).toMatchObject({
      subtaskId: "2",
      publicGroup: "in_progress",
      displayOrder: 4,
    });
  });
});

describe("ShareLinkConfigurationEditor - resource selection (no auto-select, Notes excluded, new-selection defaults)", () => {
  it("does not auto-select any resource by default", () => {
    renderEditor({ resources: [resource({ id: "r1", title: "Brief" })] });
    expect(screen.getByRole("checkbox", { name: "Brief" })).not.toBeChecked();
  });

  it("offers file and link resources but excludes notes", () => {
    renderEditor({
      resources: [
        resource({ id: "r1", title: "Link resource", url: "https://x", storage_path: null, file_name: null }),
        resource({
          id: "r2",
          title: "File resource",
          url: null,
          storage_path: "path/to/file",
          file_name: "file.pdf",
        }),
        resource({
          id: "r3",
          title: "Note resource",
          resource_type: "note",
          url: null,
          storage_path: null,
          file_name: null,
        }),
      ],
    });

    expect(screen.getByRole("checkbox", { name: "Link resource" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "File resource" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Note resource" })).not.toBeInTheDocument();
    expect(screen.queryByText("Note resource")).not.toBeInTheDocument();
  });

  it("reflects a previously mapped Resource as selected, initialized from the PERSISTED publicLabel, never resource.title", () => {
    renderEditor({
      resources: [resource({ id: "r1", title: "brief-final-v3.pdf" })],
      mappedResources: [
        mappedResource({ resourceId: "r1", publicLabel: "Final logo", canDownload: false, displayOrder: 9 }),
      ],
    });

    expect(screen.getByRole("checkbox", { name: "brief-final-v3.pdf" })).toBeChecked();
    // The internal filename must never leak into the client-facing label
    // field -- the persisted publicLabel always wins.
    expect(screen.getByDisplayValue("Final logo")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("brief-final-v3.pdf")).not.toBeInTheDocument();
  });

  it("omits the resources group from the save payload when the section was never touched", async () => {
    const { onSave } = renderEditor({
      resources: [resource({ id: "r1", title: "Brief" })],
      mappedResources: [mappedResource({ resourceId: "r1" })],
    });

    await userEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    expect(onSave.mock.calls[0][0].resources).toBeUndefined();
  });

  it("a brand-new Resource selection may receive the Resource's own display title as a default label, only on selection", async () => {
    const { onSave } = renderEditor({
      resources: [resource({ id: "r1", title: "Brief" })],
    });

    expect(screen.getByRole("checkbox", { name: "Brief" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: "Brief" }));
    expect(screen.getByDisplayValue("Brief")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save configuration/i }));

    const resources = onSave.mock.calls[0][0].resources;
    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({ resourceId: "r1", publicLabel: "Brief", displayOrder: 0 });
  });

  it("shows the resources loading and error states with retry", async () => {
    const { onRetryResources, rerender } = renderEditor({ resourcesLoading: true });
    expect(screen.getByText(/loading resources/i)).toBeInTheDocument();

    rerender(
      <ShareLinkConfigurationEditor
        link={link()}
        mappedTasks={[]}
        mappedResources={[]}
        currentUpdate={null}
        project={project()}
        resources={[]}
        resourcesLoading={false}
        resourcesError="Could not load Resources. Please try again."
        onRetryResources={onRetryResources}
        pending={false}
        disabled={false}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("Could not load Resources. Please try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetryResources).toHaveBeenCalledTimes(1);
  });
});

describe("ShareLinkConfigurationEditor - EXACT REGRESSION: reopen, edit only one Resource, save must preserve the untouched sibling exactly", () => {
  it("Resource A's persisted publicLabel/canDownload(false)/displayOrder survive a save that only changes Resource B", async () => {
    const { onSave } = renderEditor({
      resources: [
        resource({ id: "resource-a", title: "logo-internal-filename.png" }),
        resource({ id: "resource-b", title: "Contract" }),
      ],
      mappedResources: [
        mappedResource({ resourceId: "resource-a", publicLabel: "Final logo", canDownload: false, displayOrder: 9 }),
        mappedResource({ resourceId: "resource-b", publicLabel: "Signed contract", canDownload: true, displayOrder: 2 }),
      ],
    });

    // Change ONLY Resource B's label.
    const resourceBLabelInput = screen.getByDisplayValue("Signed contract");
    await userEvent.clear(resourceBLabelInput);
    await userEvent.type(resourceBLabelInput, "Updated contract");

    await userEvent.click(screen.getByRole("button", { name: /^save configuration$/i }));

    const resources: Array<{
      resourceId: string;
      publicLabel: string;
      canDownload: boolean;
      displayOrder: number;
    }> = onSave.mock.calls[0][0].resources;
    expect(resources).toHaveLength(2);

    const resourceA = resources.find((r) => r.resourceId === "resource-a");
    expect(resourceA).toEqual({
      resourceId: "resource-a",
      publicLabel: "Final logo",
      canDownload: false,
      displayOrder: 9,
    });

    const resourceB = resources.find((r) => r.resourceId === "resource-b");
    expect(resourceB).toEqual({
      resourceId: "resource-b",
      publicLabel: "Updated contract",
      canDownload: true,
      displayOrder: 2,
    });
  });

  it("preserves canDownload=true exactly (not just the false direction) when only a sibling is edited", async () => {
    const { onSave } = renderEditor({
      resources: [
        resource({ id: "resource-a", title: "Video" }),
        resource({ id: "resource-b", title: "Deck" }),
      ],
      mappedResources: [
        mappedResource({ resourceId: "resource-a", publicLabel: "Final video", canDownload: true, displayOrder: 1 }),
        mappedResource({ resourceId: "resource-b", publicLabel: "Deck", canDownload: false, displayOrder: 2 }),
      ],
    });

    const resourceBLabelInput = screen.getByDisplayValue("Deck");
    await userEvent.type(resourceBLabelInput, " v2");

    await userEvent.click(screen.getByRole("button", { name: /^save configuration$/i }));

    const resources: Array<{ resourceId: string; canDownload: boolean }> =
      onSave.mock.calls[0][0].resources;
    const resourceA = resources.find((r) => r.resourceId === "resource-a");
    expect(resourceA?.canDownload).toBe(true);
  });
});

describe("ShareLinkConfigurationEditor - latest update", () => {
  it("shows the currently published update when present", () => {
    renderEditor({
      currentUpdate: { body: "We shipped the hero section.", version: 3, publishedAt: "2026-08-10T00:00:00Z" },
    });

    expect(screen.getByText(/we shipped the hero section/i)).toBeInTheDocument();
    expect(screen.getByText(/version 3/i)).toBeInTheDocument();
  });

  it("Publish update is disabled until text is entered, and does not include an untouched tasks/resources group", async () => {
    const { onSave } = renderEditor();

    const publishButton = screen.getByRole("button", { name: /publish update/i });
    expect(publishButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText(/write a client-facing update/i), "New update body");
    expect(publishButton).not.toBeDisabled();

    await userEvent.click(publishButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const request = onSave.mock.calls[0][0];
    expect(request.publishUpdate).toEqual({ body: "New update body" });
    expect(request.tasks).toBeUndefined();
    expect(request.resources).toBeUndefined();
  });

  it("Save configuration never includes publishUpdate", async () => {
    const { onSave } = renderEditor();

    await userEvent.click(screen.getByRole("button", { name: /^save configuration$/i }));

    expect(onSave.mock.calls[0][0].publishUpdate).toBeUndefined();
  });
});

describe("ShareLinkConfigurationEditor - disabled/pending state", () => {
  it("disables all interactive controls when disabled is true", () => {
    renderEditor({ disabled: true, project: project([subtask({ id: 1, title: "Task A" })]) });

    expect(screen.getByRole("checkbox", { name: /show project title/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Task A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save configuration/i })).toBeDisabled();
  });
});
