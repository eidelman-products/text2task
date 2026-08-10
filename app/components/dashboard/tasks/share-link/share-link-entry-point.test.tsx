// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DesktopTasksTable from "../desktop-tasks-table";
import MobileTaskCard from "../mobile-task-card";
import type { TaskProjectGroup, TaskRow } from "../task-types";

/*
  Phase 2A UI-visibility + regression coverage for the "Share with client"
  entry point added to both project-card implementations. Confirms: (1)
  the button is absent when the feature is disabled (onOpenShareLink
  undefined -- the exact shape tasks-view.tsx passes down when
  clientShareEnabled is false), (2) it renders and fires the callback when
  present, and (3) adding it did not remove or rename the pre-existing
  Resources/Add update/History actions in the same row.
*/

vi.mock("../../resources/resource-api", () => ({
  fetchTaskResources: vi.fn().mockResolvedValue([]),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function noop() {}

function taskRow(): TaskRow {
  return {
    id: 1,
    client: { id: "client-1", name: "Acme" },
    project: { id: PROJECT_ID, title: "Website launch", client_name: "Acme" },
    task: "Design hero",
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    project_id: PROJECT_ID,
    created_at: "2026-08-03T10:00:00.000Z",
  };
}

function projectGroup(): TaskProjectGroup {
  const task = taskRow();
  return {
    key: `project::${PROJECT_ID}`,
    project_id: PROJECT_ID,
    project: task.project,
    clientName: "Acme",
    projectTitle: "Website launch",
    projectSummary: "",
    tasks: [task],
    subtasks: [
      {
        id: task.id,
        project_id: PROJECT_ID,
        title: task.task,
        status: task.status,
        priority: task.priority,
        amount: task.amount,
        deadline: task.deadline,
      },
    ],
    primaryTask: task,
    taskIds: [task.id],
    amount: "",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    hasContactDetails: false,
    subtaskCount: 1,
    completedSubtaskCount: 0,
  };
}

function renderDesktop(onOpenShareLink?: (project: TaskProjectGroup) => void) {
  return render(
    <DesktopTasksTable
      tasks={[taskRow()]}
      allVisibleSelected={false}
      hasMatchingTasks
      savingTaskIds={{}}
      savedTaskIds={{}}
      deletingTaskIds={{}}
      copiedTaskIds={{}}
      selectedTaskIds={[]}
      archiveView="active"
      flashTaskId={null}
      taskRefs={{ current: {} }}
      onToggleSelectAllVisible={noop}
      onEnterBlur={noop}
      toggleSelect={noop}
      updateTaskField={noop}
      updateTaskStatus={noop}
      updateProjectField={noop}
      copyTask={noop}
      pendingProjectAction={null}
      onArchiveProject={noop}
      onRestoreProject={noop}
      onRequestProjectDelete={noop}
      formatCreatedDate={() => "Created Aug 3"}
      projectResourceCounts={{}}
      onOpenProjectResources={noop}
      onOpenProjectUpdate={noop}
      onOpenProjectHistory={noop}
      onOpenShareLink={onOpenShareLink}
    />
  );
}

function renderMobile(onOpenShareLink?: (project: TaskProjectGroup) => void) {
  return render(
    <MobileTaskCard
      project={projectGroup()}
      projectId={PROJECT_ID}
      isSaving={false}
      isSaved={false}
      isDeleting={false}
      isCopied={false}
      isSelected={false}
      isPartiallySelected={false}
      archiveView="active"
      onToggleProjectSelection={noop}
      updateTaskField={noop}
      updateTaskStatus={noop}
      updateProjectField={noop}
      copyTask={noop}
      onOpenProjectResources={noop}
      onOpenProjectUpdate={noop}
      onOpenProjectHistory={noop}
      onOpenShareLink={onOpenShareLink}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Share with client entry point - desktop", () => {
  it("is absent when the feature is disabled (onOpenShareLink undefined)", async () => {
    renderDesktop(undefined);
    await userEvent.click(screen.getByRole("button", { name: /Open details/i }));

    expect(screen.queryByRole("button", { name: /share with client/i })).not.toBeInTheDocument();
    // Regression: the pre-existing actions remain in the same row.
    expect(screen.getByRole("button", { name: /^resources$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^history$/i })).toBeInTheDocument();
  });

  it("renders and fires the callback with the project when enabled", async () => {
    const onOpenShareLink = vi.fn();
    renderDesktop(onOpenShareLink);
    await userEvent.click(screen.getByRole("button", { name: /Open details/i }));

    const button = screen.getByRole("button", { name: /share with client/i });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    expect(onOpenShareLink).toHaveBeenCalledTimes(1);
    expect(onOpenShareLink.mock.calls[0][0]).toMatchObject({ project_id: PROJECT_ID });
  });
});

describe("Share with client entry point - mobile", () => {
  it("is absent when the feature is disabled (onOpenShareLink undefined)", async () => {
    renderMobile(undefined);
    await userEvent.click(screen.getByRole("button", { name: /Open details/i }));

    expect(screen.queryByRole("button", { name: /share with client/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^resources$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^history$/i })).toBeInTheDocument();
  });

  it("renders and fires the callback with the project when enabled", async () => {
    const onOpenShareLink = vi.fn();
    renderMobile(onOpenShareLink);
    await userEvent.click(screen.getByRole("button", { name: /Open details/i }));

    const button = screen.getByRole("button", { name: /share with client/i });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    expect(onOpenShareLink).toHaveBeenCalledTimes(1);
    expect(onOpenShareLink.mock.calls[0][0]).toMatchObject({ project_id: PROJECT_ID });
  });
});
