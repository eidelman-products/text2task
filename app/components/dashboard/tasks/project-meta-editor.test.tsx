// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectMetaEditor from "./project-meta-editor";
import type { TaskProjectGroup, TaskRow } from "./task-types";
import { formatDateOnlyForDisplay, localDateToDateOnly } from "@/lib/tasks/date-only";

function offsetFromToday(offsetDays: number) {
  const now = new Date();
  const shifted = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    12,
    0,
    0,
    0
  );
  return localDateToDateOnly(shifted);
}

function buildPrimaryTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 1,
    client: null,
    task: "Edit product video",
    amount: "480 USD",
    deadline: "",
    priority: "Medium",
    status: "New",
    source: "manual",
    ...overrides,
  };
}

function buildProject(
  overrides: Partial<TaskProjectGroup> = {}
): TaskProjectGroup {
  const primaryTask = buildPrimaryTask();

  return {
    key: "project-1",
    project_id: "11111111-1111-4111-8111-111111111111",
    project: null,
    clientName: "Rivon Media",
    projectTitle: "Product video editing package",
    projectSummary: "",
    tasks: [primaryTask],
    subtasks: [],
    primaryTask,
    taskIds: [1],
    amount: "480 USD",
    deadline: "",
    deadline_date: null,
    priority: "Medium",
    status: "New",
    source: "manual",
    hasContactDetails: false,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    ...overrides,
  };
}

describe("ProjectMetaEditor deadline integration", () => {
  it("displays the deadline derived from project.deadline_date in the unambiguous display form", () => {
    const value = offsetFromToday(7);
    const project = buildProject({ deadline_date: value });

    render(
      <ProjectMetaEditor
        project={project}
        isDeleting={false}
        onEnterBlur={vi.fn()}
        updateProjectField={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Deadline")).toHaveTextContent(
      formatDateOnlyForDisplay(value)
    );
  });

  it("commits a newly selected date via updateProjectField(projectId, 'deadline', value)", async () => {
    const user = userEvent.setup();
    const updateProjectField = vi.fn();
    const project = buildProject({ deadline_date: null });

    render(
      <ProjectMetaEditor
        project={project}
        isDeleting={false}
        onEnterBlur={vi.fn()}
        updateProjectField={updateProjectField}
      />
    );

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(updateProjectField).toHaveBeenCalledTimes(1);
    const [projectId, field, value] = updateProjectField.mock.calls[0];
    expect(projectId).toBe(project.project_id);
    expect(field).toBe("deadline");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("clearing an existing deadline commits an empty string", async () => {
    const user = userEvent.setup();
    const updateProjectField = vi.fn();
    const value = offsetFromToday(3);
    const project = buildProject({ deadline_date: value });

    render(
      <ProjectMetaEditor
        project={project}
        isDeleting={false}
        onEnterBlur={vi.fn()}
        updateProjectField={updateProjectField}
      />
    );

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(updateProjectField).toHaveBeenCalledWith(
      project.project_id,
      "deadline",
      ""
    );
  });

  it("does not call updateProjectField when re-selecting the same already-committed date", async () => {
    const user = userEvent.setup();
    const updateProjectField = vi.fn();
    const value = offsetFromToday(0); // today
    const project = buildProject({ deadline_date: value });

    render(
      <ProjectMetaEditor
        project={project}
        isDeleting={false}
        onEnterBlur={vi.fn()}
        updateProjectField={updateProjectField}
      />
    );

    await user.click(screen.getByLabelText("Deadline"));
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(updateProjectField).not.toHaveBeenCalled();
  });

  it("disables the deadline field when the project cannot be edited (isDeleting)", async () => {
    const user = userEvent.setup();
    const project = buildProject({ deadline_date: null });

    render(
      <ProjectMetaEditor
        project={project}
        isDeleting={true}
        onEnterBlur={vi.fn()}
        updateProjectField={vi.fn()}
      />
    );

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the deadline field when there is no project id", async () => {
    const user = userEvent.setup();
    const project = buildProject({ project_id: null, deadline_date: null });

    render(
      <ProjectMetaEditor
        project={project}
        isDeleting={false}
        onEnterBlur={vi.fn()}
        updateProjectField={vi.fn()}
      />
    );

    const trigger = screen.getByLabelText("Deadline");
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
