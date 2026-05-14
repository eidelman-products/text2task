import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent, MutableRefObject } from "react";
import TaskRowActions from "../task-row-actions";
import ResourceManagerModal from "../resources/resource-manager-modal";
import {
  fetchTaskResources,
  type TaskResource,
} from "../resources/resource-api";
import type {
  TaskArchiveView,
  TaskProjectGroup,
  TaskRow,
} from "./task-types";
import { buildTaskProjectGroups } from "./task-utils";
import ClientContactEditor from "./client-contact-editor";
import ProjectMetaEditor from "./project-meta-editor";
import ProjectHeaderEditor from "./project-header-editor";

type DesktopTasksTableProps = {
  tasks: TaskRow[];
  allVisibleSelected: boolean;
  hasMatchingTasks: boolean;
  savingTaskIds: Record<number, boolean>;
  savedTaskIds: Record<number, boolean>;
  deletingTaskIds: Record<number, boolean>;
  copiedTaskIds: Record<number, boolean>;
  selectedTaskIds: number[];
  archiveView: TaskArchiveView;
  highlightedTaskId?: number | null;
  flashTaskId: number | null;
  taskRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  onToggleSelectAllVisible: () => void;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  toggleSelect: (taskId: number) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  updateProjectField: (
    projectId: string,
    field: string,
    value: any
  ) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
  formatCreatedDate: (value?: string | null) => string;
};

export default function DesktopTasksTable({
  tasks,
  allVisibleSelected,
  hasMatchingTasks,
  savingTaskIds,
  savedTaskIds,
  deletingTaskIds,
  copiedTaskIds,
  selectedTaskIds,
  archiveView,
  highlightedTaskId,
  flashTaskId,
  taskRefs,
  onToggleSelectAllVisible,
  onEnterBlur,
  toggleSelect,
  updateTaskField,
  updateTaskStatus,
  updateProjectField,
  copyTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
  formatCreatedDate,
}: DesktopTasksTableProps) {
  const projectGroups = useMemo(() => buildTaskProjectGroups(tasks), [tasks]);

  const [openProjectKeys, setOpenProjectKeys] = useState<
    Record<string, boolean>
  >({});
  const [hoveredProjectKey, setHoveredProjectKey] = useState<string | null>(
    null
  );
  const [resourcesProject, setResourcesProject] =
    useState<TaskProjectGroup | null>(null);
  const [projectResourceCounts, setProjectResourceCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    let isMounted = true;

    async function loadResourceCounts() {
      try {
        const allResources = await fetchTaskResources({});

        if (!isMounted) return;

        const nextCounts: Record<string, number> = {};

        allResources.forEach((resource) => {
          const projectKey = resource.project_id
            ? `project:${resource.project_id}`
            : resource.task_id
              ? `task:${resource.task_id}`
              : "";

          if (!projectKey) return;

          nextCounts[projectKey] = (nextCounts[projectKey] || 0) + 1;
        });

        setProjectResourceCounts(nextCounts);
      } catch (error) {
        console.error("Failed to load resource counts:", error);
      }
    }

    void loadResourceCounts();

    return () => {
      isMounted = false;
    };
  }, [tasks]);

  useEffect(() => {
    if (!highlightedTaskId) return;

    const targetProject = projectGroups.find((project) =>
      project.taskIds.includes(highlightedTaskId)
    );

    if (!targetProject) return;

    const timer = setTimeout(() => {
      setOpenProjectKeys((current) => ({
        ...current,
        [targetProject.key]: true,
      }));
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [highlightedTaskId, projectGroups]);

  function toggleProject(projectKey: string) {
    setOpenProjectKeys((current) => ({
      ...current,
      [projectKey]: !current[projectKey],
    }));
  }

  function openProjectResources(project: TaskProjectGroup) {
    const projectId = getResolvedProjectId(project);

    if (!projectId) return;

    setResourcesProject(project);
  }

  function closeProjectResources() {
    setResourcesProject(null);
  }

  function getResolvedProjectId(project: TaskProjectGroup) {
    const directProjectId =
      project.project_id ||
      project.primaryTask?.project_id ||
      project.tasks.find((task) => task.project_id)?.project_id ||
      "";

    if (directProjectId) return directProjectId;

    return getProjectIdFromKey(project.key);
  }

  function getProjectIdFromKey(projectKey?: string | null) {
    if (!projectKey) return null;

    const cleaned = String(projectKey).trim();

    if (cleaned.startsWith("project::")) {
      return cleaned.replace("project::", "").trim() || null;
    }

    if (cleaned.startsWith("project:")) {
      return cleaned.replace("project:", "").trim() || null;
    }

    return null;
  }

  function getProjectResourceKey(project: TaskProjectGroup) {
    const projectId = getResolvedProjectId(project);

    if (projectId) return `project:${projectId}`;

    return "";
  }

  function getProjectResourceCount(project: TaskProjectGroup) {
    const key = getProjectResourceKey(project);

    if (!key) return 0;

    return projectResourceCounts[key] || 0;
  }

  function syncOpenProjectResourceCount(resources: TaskResource[]) {
    if (!resourcesProject) return;

    const key = getProjectResourceKey(resourcesProject);

    if (!key) return;

    setProjectResourceCounts((current) => ({
      ...current,
      [key]: resources.length,
    }));
  }

  function toggleProjectSelection(project: TaskProjectGroup) {
    const allSelected = project.taskIds.every((id) =>
      selectedTaskIds.includes(id)
    );

    project.taskIds.forEach((id) => {
      const isSelected = selectedTaskIds.includes(id);

      if (allSelected && isSelected) toggleSelect(id);

      if (!allSelected && !isSelected) toggleSelect(id);
    });
  }

  async function archiveProject(project: TaskProjectGroup) {
    for (const task of project.tasks) {
      await archiveTask(task.id);
    }
  }

  async function restoreProject(project: TaskProjectGroup) {
    for (const task of project.tasks) {
      await restoreTask(task.id);
    }
  }

  async function permanentlyDeleteProject(project: TaskProjectGroup) {
    for (const task of project.tasks) {
      await permanentlyDeleteTask(task.id);
    }
  }

  return (
    <>
      <div className="tasks-desktop-table" style={desktopShellStyle}>
        <style>{desktopTasksCss}</style>

        <div style={workspaceHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Client workspace</div>
            <div style={summaryTitleStyle}>
              {projectGroups.length}{" "}
              {projectGroups.length === 1 ? "project" : "projects"}
            </div>
          </div>

          <label style={selectAllStyle}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={!hasMatchingTasks}
              onChange={onToggleSelectAllVisible}
              style={nativeCheckboxStyle(hasMatchingTasks)}
            />
            <span>Select visible</span>
          </label>
        </div>

        <div style={projectListStyle}>
          {projectGroups.map((project) => {
            const isOpen = Boolean(openProjectKeys[project.key]);
            const isHovered = hoveredProjectKey === project.key;
            const isSelected = project.taskIds.every((id) =>
              selectedTaskIds.includes(id)
            );
            const isPartiallySelected =
              !isSelected &&
              project.taskIds.some((id) => selectedTaskIds.includes(id));

            const isSaving = project.taskIds.some((id) => savingTaskIds[id]);
            const isSaved = project.taskIds.some((id) => savedTaskIds[id]);
            const isDeleting = project.taskIds.some((id) => deletingTaskIds[id]);
            const isCopied = Boolean(copiedTaskIds[project.primaryTask.id]);
            const isHighlighted = project.taskIds.includes(flashTaskId || -1);
            const actionMode =
              archiveView === "archived" || project.is_archived
                ? "archived"
                : "active";

            const visual = getProjectVisualState(project);
            const resolvedProjectId = getResolvedProjectId(project);
            const canManageResources = Boolean(resolvedProjectId);
            const projectResourceCount = getProjectResourceCount(project);
            const hasProjectResources = projectResourceCount > 0;
            const completedPercent =
              project.subtaskCount > 0
                ? Math.round(
                    (project.completedSubtaskCount / project.subtaskCount) *
                      100
                  )
                : 0;

            return (
              <div
                key={project.key}
                className="crm-project-card-v3"
                ref={(node) => {
                  if (node && !isOpen) {
                    taskRefs.current[project.primaryTask.id] = node;
                  } else {
                    delete taskRefs.current[project.primaryTask.id];
                  }
                }}
                onMouseEnter={() => setHoveredProjectKey(project.key)}
                onMouseLeave={() => setHoveredProjectKey(null)}
                style={{
                  ...projectCardStyle,
                  background: visual.cardBackground,
                  borderColor: isHighlighted
                    ? "rgba(99,102,241,0.36)"
                    : isHovered
                      ? "rgba(129,140,248,0.48)"
                      : visual.cardBorder,
                  boxShadow: isHovered ? visual.hoverShadow : visual.cardShadow,
                  opacity: isDeleting ? 0.62 : 1,
                  transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <div
                  style={{
                    ...projectSurfaceStyle,
                    background: visual.surfaceBackground,
                  }}
                />

                <div
                  style={{
                    ...projectAccentStyle,
                    background: visual.accent,
                  }}
                />

                <div style={projectHeroStyle}>
                  <div style={selectionColumnStyle}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = isPartiallySelected;
                      }}
                      onChange={() => toggleProjectSelection(project)}
                      disabled={isDeleting}
                      style={cardCheckboxStyle}
                    />
                  </div>

                  <div style={projectIdentityStyle}>
                    <ProjectHeaderEditor
                      project={project}
                      visual={visual}
                      isDeleting={isDeleting}
                      createdLabel={formatCreatedDate(project.created_at)}
                      onEnterBlur={onEnterBlur}
                      updateProjectField={updateProjectField}
                    />

                    <div style={projectQuickActionsStyle}>
                      <button
                        type="button"
                        onClick={() => toggleProject(project.key)}
                        className="crm-soft-button-v3"
                        style={{
                          ...detailsButtonStyle,
                          ...(isOpen ? detailsButtonActiveStyle : {}),
                        }}
                      >
                        <span style={detailsButtonIconStyle}>
                          {isOpen ? "−" : "+"}
                        </span>
                        {isOpen ? "Hide details" : "Open details"}
                        <span style={detailsCountStyle}>
                          {project.subtaskCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openProjectResources(project)}
                        disabled={!canManageResources || isDeleting}
                        className="crm-soft-button-v3"
                        title={
                          hasProjectResources
                            ? `${projectResourceCount} resource${
                                projectResourceCount === 1 ? "" : "s"
                              } attached`
                            : canManageResources
                              ? "Add links, files, logos, banners, and notes to this project"
                              : "Resources are available for saved projects"
                        }
                        style={{
                          ...resourcesButtonStyle,
                          ...(hasProjectResources
                            ? resourcesButtonActiveStyle
                            : {}),
                          opacity:
                            !canManageResources || isDeleting ? 0.55 : 1,
                          cursor:
                            !canManageResources || isDeleting
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        Resources
                        {hasProjectResources ? (
                          <span style={resourcesCountPillStyle}>
                            {projectResourceCount}
                          </span>
                        ) : null}
                      </button>

                      {(isSaving || isSaved || isDeleting) && (
                        <span
                          style={{
                            ...saveStateStyle,
                            color: isDeleting
                              ? "#b42318"
                              : isSaved
                                ? "#067647"
                                : "#667085",
                          }}
                        >
                          {isDeleting
                            ? actionMode === "archived"
                              ? "Deleting..."
                              : "Archiving..."
                            : isSaved
                              ? "Saved"
                              : "Saving..."}
                        </span>
                      )}
                    </div>
                  </div>

                  <ProjectMetaEditor
                    project={project}
                    isDeleting={isDeleting}
                    onEnterBlur={onEnterBlur}
                    updateProjectField={updateProjectField}
                  />

                  <div style={projectActionPanelStyle}>
                    <TaskRowActions
                      taskId={project.primaryTask.id}
                      isDeleting={isDeleting}
                      isCopied={isCopied}
                      actionMode={actionMode}
                      onCopy={copyTask}
                      onArchive={() => archiveProject(project)}
                      onRestore={() => restoreProject(project)}
                      onPermanentDelete={() =>
                        permanentlyDeleteProject(project)
                      }
                    />
                  </div>
                </div>

                {isOpen && (
                  <div
                    style={{
                      ...detailsPanelStyle,
                      background: visual.detailsBackground,
                    }}
                  >
                    <div style={detailsTopBarStyle}>
                      <div>
                        <div style={detailsHeroLabelStyle}>
                          Project workspace
                        </div>
                        <div style={detailsHeroTitleStyle}>
                          Structured work plan
                        </div>
                      </div>

                      <div style={progressBlockStyle}>
                        <span style={progressTextStyle}>
                          {project.completedSubtaskCount}/{project.subtaskCount}{" "}
                          done
                        </span>
                        <div style={progressTrackStyle}>
                          <div
                            style={{
                              ...progressFillStyle,
                              width: `${completedPercent}%`,
                              background: visual.accent,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={detailsGridStyle}>
                      <section style={workPlanCardStyle}>
                        <div style={sectionHeaderStyle}>
                          <div>
                            <div style={sectionTitleStyle}>Subtasks</div>
                            <div style={sectionSubtitleStyle}>
                              Editable work list generated from the client
                              request.
                            </div>
                          </div>

                          <span style={miniProgressPillStyle}>
                            {project.subtaskCount}{" "}
                            {project.subtaskCount === 1 ? "item" : "items"}
                          </span>
                        </div>

                        <div style={subtaskListStyle}>
                          {project.subtasks.map((subtask, index) => {
                            const subtaskDone =
                              String(subtask.status || "")
                                .trim()
                                .toLowerCase() === "done" ||
                              Boolean(subtask.completed_at);
                            const isSubtaskHighlighted =
                              flashTaskId === subtask.id;

                            return (
                              <div
                                key={subtask.id}
                                className="crm-subtask-row-v3"
                                ref={(node) => {
                                  if (node) {
                                    taskRefs.current[subtask.id] = node;
                                  } else {
                                    delete taskRefs.current[subtask.id];
                                  }
                                }}
                                style={{
                                  ...subtaskRowStyle,
                                  borderColor: isSubtaskHighlighted
                                    ? "rgba(99,102,241,0.55)"
                                    : subtaskRowStyle.borderColor,
                                  boxShadow: isSubtaskHighlighted
                                    ? "0 0 0 4px rgba(99,102,241,0.10), 0 12px 26px rgba(15,23,42,0.08)"
                                    : subtaskRowStyle.boxShadow,
                                  transform: isSubtaskHighlighted
                                    ? "translateY(-1px)"
                                    : subtaskRowStyle.transform,
                                  background: isSubtaskHighlighted
                                    ? subtaskDone
                                      ? "linear-gradient(135deg, rgba(240,253,244,0.74), rgba(238,242,255,0.62))"
                                      : "rgba(238,242,255,0.72)"
                                    : subtaskDone
                                      ? "rgba(240,253,244,0.62)"
                                      : "rgba(255,255,255,0.72)",
                                }}
                              >
                                <span
                                  style={{
                                    ...subtaskIndexStyle,
                                    color: subtaskDone
                                      ? "#067647"
                                      : "#475467",
                                    background: subtaskDone
                                      ? "rgba(220,252,231,0.85)"
                                      : "rgba(248,250,252,0.95)",
                                  }}
                                >
                                  {subtaskDone ? "✓" : index + 1}
                                </span>

                                <input
                                  defaultValue={subtask.title}
                                  onBlur={(e) => {
                                    const next = e.currentTarget.value.trim();

                                    if (next && next !== subtask.title) {
                                      updateTaskField(
                                        subtask.id,
                                        "task",
                                        next
                                      );
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="crm-subtask-input-v3"
                                  style={{
                                    ...subtaskInputStyle,
                                    textDecoration: subtaskDone
                                      ? "line-through"
                                      : "none",
                                    color: subtaskDone ? "#475467" : "#101828",
                                  }}
                                  disabled={isDeleting}
                                />

                                <select
                                  value={subtask.status || "New"}
                                  onChange={(e) =>
                                    updateTaskStatus(subtask.id, e.target.value)
                                  }
                                  onKeyDown={onEnterBlur}
                                  disabled={isDeleting}
                                  style={{
                                    ...subtaskStatusSelectStyle,
                                    ...getSubtaskStatusStyle(subtask.status),
                                  }}
                                >
                                  <option value="New">New</option>
                                  <option value="In Progress">
                                    In Progress
                                  </option>
                                  <option value="Review">Review</option>
                                  <option value="Urgent">Urgent</option>
                                  <option value="Done">Done</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <ClientContactEditor
                        project={project}
                        isDeleting={isDeleting}
                        onEnterBlur={onEnterBlur}
                        updateTaskField={updateTaskField}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ResourceManagerModal
        isOpen={Boolean(resourcesProject)}
        projectId={
          resourcesProject ? getResolvedProjectId(resourcesProject) : null
        }
        taskId={null}
        title={
          resourcesProject
            ? `${resourcesProject.clientName} resources`
            : "Project resources"
        }
        subtitle={
          resourcesProject
            ? `Attach links, files, logos, banners, documents, and notes to ${resourcesProject.projectTitle}.`
            : "Attach project context in one place."
        }
        onClose={closeProjectResources}
        onResourcesChanged={syncOpenProjectResourceCount}
      />
    </>
  );
}

function nativeCheckboxStyle(enabled: boolean): CSSProperties {
  return {
    width: 15,
    height: 15,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.45,
  };
}

function getProjectVisualState(project: TaskProjectGroup) {
  const status = String(project.status || "").trim().toLowerCase();
  const priority = String(project.priority || "").trim().toLowerCase();
  const deadlineState = getDeadlineState(project);

  if (status === "done") {
    return {
      accent: "linear-gradient(180deg, #16a34a 0%, #22c55e 100%)",
      cardBackground:
        "linear-gradient(180deg, rgba(240,253,244,0.82) 0%, rgba(247,254,231,0.44) 44%, rgba(255,255,255,0.9) 100%)",
      surfaceBackground:
        "linear-gradient(135deg, rgba(240,253,244,0.7) 0%, rgba(255,255,255,0.34) 100%)",
      detailsBackground:
        "linear-gradient(180deg, rgba(240,253,244,0.36) 0%, rgba(248,250,252,0.3) 100%)",
      cardBorder: "rgba(187,247,208,0.84)",
      cardShadow:
        "0 14px 34px rgba(22,163,74,0.06), 0 6px 16px rgba(15,23,42,0.024)",
      hoverShadow:
        "0 22px 48px rgba(22,163,74,0.105), 0 9px 22px rgba(15,23,42,0.032)",
      avatarBackground: "rgba(220,252,231,0.92)",
      avatarText: "#15803d",
      label: "Done",
      labelColor: "#15803d",
      labelBackground: "rgba(240,253,244,0.78)",
      dataTone: "green" as const,
    };
  }

  if (deadlineState === "overdue") {
    return {
      accent: "linear-gradient(180deg, #e11d48 0%, #fb7185 100%)",
      cardBackground:
        "linear-gradient(180deg, rgba(255,241,242,0.54) 0%, rgba(255,255,255,0.92) 84%)",
      surfaceBackground:
        "linear-gradient(135deg, rgba(255,241,242,0.42) 0%, rgba(255,255,255,0.4) 100%)",
      detailsBackground:
        "linear-gradient(180deg, rgba(255,241,242,0.24) 0%, rgba(248,250,252,0.32) 100%)",
      cardBorder: "rgba(253,164,175,0.68)",
      cardShadow:
        "0 14px 32px rgba(225,29,72,0.048), 0 6px 16px rgba(15,23,42,0.026)",
      hoverShadow:
        "0 22px 48px rgba(225,29,72,0.082), 0 9px 22px rgba(15,23,42,0.032)",
      avatarBackground: "rgba(255,241,242,0.9)",
      avatarText: "#be123c",
      label: "Overdue",
      labelColor: "#be123c",
      labelBackground: "rgba(255,241,242,0.72)",
      dataTone: "gray" as const,
    };
  }

  if (priority === "high" || status === "urgent") {
    return {
      accent: "linear-gradient(180deg, #f43f5e 0%, #fda4af 100%)",
      cardBackground:
        "linear-gradient(180deg, rgba(255,241,242,0.34) 0%, rgba(255,255,255,0.94) 86%)",
      surfaceBackground:
        "linear-gradient(135deg, rgba(255,241,242,0.28) 0%, rgba(255,255,255,0.44) 100%)",
      detailsBackground:
        "linear-gradient(180deg, rgba(255,241,242,0.18) 0%, rgba(248,250,252,0.32) 100%)",
      cardBorder: "rgba(253,164,175,0.6)",
      cardShadow:
        "0 14px 32px rgba(225,29,72,0.04), 0 6px 16px rgba(15,23,42,0.024)",
      hoverShadow:
        "0 22px 48px rgba(225,29,72,0.068), 0 9px 22px rgba(15,23,42,0.032)",
      avatarBackground: "rgba(255,241,242,0.78)",
      avatarText: "#be123c",
      label: "High priority",
      labelColor: "#be123c",
      labelBackground: "rgba(255,241,242,0.68)",
      dataTone: "gray" as const,
    };
  }

  return {
    accent: "linear-gradient(180deg, #6366f1 0%, #a5b4fc 100%)",
    cardBackground: "rgba(255,255,255,0.88)",
    surfaceBackground:
      "linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(248,250,252,0.36) 100%)",
    detailsBackground: "rgba(248,250,252,0.38)",
    cardBorder: "rgba(226,232,240,0.72)",
    cardShadow: "0 10px 28px rgba(15,23,42,0.038)",
    hoverShadow: "0 20px 46px rgba(15,23,42,0.07)",
    avatarBackground: "rgba(238,242,255,0.82)",
    avatarText: "#4338ca",
    label: "",
    labelColor: "#475467",
    labelBackground: "rgba(248,250,252,0.86)",
    dataTone: "gray" as const,
  };
}

function getSubtaskStatusStyle(statusValue: string) {
  const status = String(statusValue || "").trim().toLowerCase();

  if (status === "done") {
    return {
      color: "#067647",
      background: "rgba(240,253,244,0.72)",
      borderColor: "rgba(187,247,208,0.7)",
    };
  }

  if (status === "urgent") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.72)",
      borderColor: "rgba(253,164,175,0.68)",
    };
  }

  if (status === "review") {
    return {
      color: "#6d28d9",
      background: "rgba(245,243,255,0.72)",
      borderColor: "rgba(221,214,254,0.68)",
    };
  }

  if (status === "in progress" || status === "in-progress") {
    return {
      color: "#1d4ed8",
      background: "rgba(239,246,255,0.72)",
      borderColor: "rgba(191,219,254,0.68)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(248,250,252,0.72)",
    borderColor: "rgba(226,232,240,0.72)",
  };
}

function getDeadlineState(project: TaskProjectGroup) {
  const status = String(project.status || "").trim().toLowerCase();

  if (status === "done") return "done";

  const rawDate = project.deadline_date || project.deadline;
  if (!rawDate) return "none";

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(parsed);
  deadline.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 3) return "soon";

  return "scheduled";
}

const desktopShellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  width: "100%",
  minWidth: 0,
};

const workspaceHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "12px 15px",
  borderRadius: 20,
  border: "1px solid rgba(226,232,240,0.58)",
  background: "rgba(255,255,255,0.72)",
  boxShadow: "0 8px 22px rgba(15,23,42,0.026)",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  color: "#667085",
};

const summaryTitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 19,
  fontWeight: 950,
  color: "#101828",
  letterSpacing: "-0.045em",
};

const selectAllStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 850,
  color: "#475467",
  cursor: "pointer",
};

const projectListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  width: "100%",
  minWidth: 0,
};

const projectCardStyle: CSSProperties = {
  position: "relative",
  borderRadius: 24,
  border: "1px solid rgba(226,232,240,0.72)",
  background: "rgba(255,255,255,0.88)",
  overflow: "hidden",
  transition:
    "border-color 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease, transform 0.22s ease, background 0.22s ease",
};

const projectSurfaceStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 0,
};

const projectAccentStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 18,
  bottom: 18,
  width: 3,
  borderRadius: "0 999px 999px 0",
  zIndex: 2,
  opacity: 0.92,
};

const projectHeroStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns:
    "28px minmax(320px, 1.65fr) minmax(420px, 1.1fr) minmax(126px, auto)",
  gap: 14,
  alignItems: "center",
  padding: "13px 16px 12px 18px",
};

const selectionColumnStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
};

const cardCheckboxStyle: CSSProperties = {
  width: 15,
  height: 15,
};

const projectIdentityStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 5,
};

const projectQuickActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const detailsButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.68)",
  background: "rgba(255,255,255,0.72)",
  color: "#344054",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  transition:
    "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease",
};

const detailsButtonActiveStyle: CSSProperties = {
  borderColor: "rgba(199,210,254,0.72)",
  background: "rgba(238,242,255,0.58)",
  color: "#4338ca",
};

const detailsButtonIconStyle: CSSProperties = {
  width: 15,
  height: 15,
  borderRadius: 999,
  display: "inline-grid",
  placeItems: "center",
  background: "rgba(248,250,252,0.92)",
  color: "#4f46e5",
  fontWeight: 950,
};

const detailsCountStyle: CSSProperties = {
  minWidth: 17,
  height: 17,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#667085",
  background: "rgba(248,250,252,0.86)",
  fontWeight: 950,
  fontSize: 10,
};

const resourcesButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.68)",
  background: "rgba(255,255,255,0.72)",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 900,
  transition:
    "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease, transform 0.18s ease",
};

const resourcesButtonActiveStyle: CSSProperties = {
  background: "rgba(240,253,244,0.66)",
  color: "#15803d",
  borderColor: "rgba(187,247,208,0.7)",
};

const resourcesCountPillStyle: CSSProperties = {
  minWidth: 17,
  height: 17,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(22,163,74,0.1)",
  color: "#15803d",
  fontSize: 10,
  fontWeight: 950,
};

const saveStateStyle: CSSProperties = {
  minHeight: 24,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 8px",
  borderRadius: 999,
  background: "rgba(248,250,252,0.72)",
  fontSize: 11,
  fontWeight: 900,
};

const projectActionPanelStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 7,
  minWidth: 0,
};

const detailsPanelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  borderTop: "1px solid rgba(226,232,240,0.5)",
  padding: "0 15px 15px 18px",
};

const detailsTopBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "13px 0 11px",
};

const detailsHeroLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#667085",
};

const detailsHeroTitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 16,
  fontWeight: 950,
  color: "#101828",
  letterSpacing: "-0.035em",
};

const progressBlockStyle: CSSProperties = {
  minWidth: 200,
  display: "grid",
  gap: 6,
};

const progressTextStyle: CSSProperties = {
  textAlign: "right",
  fontSize: 11,
  fontWeight: 900,
  color: "#667085",
};

const progressTrackStyle: CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(226,232,240,0.78)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.24s ease",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.32fr) minmax(300px, 0.68fr)",
  gap: 12,
};

const workPlanCardStyle: CSSProperties = {
  borderRadius: 20,
  background: "rgba(255,255,255,0.7)",
  padding: 12,
  minWidth: 0,
  boxShadow: "0 8px 22px rgba(15,23,42,0.024)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  marginBottom: 9,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 950,
  color: "#344054",
};

const sectionSubtitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  fontWeight: 750,
  color: "#98a2b3",
};

const miniProgressPillStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(248,250,252,0.76)",
  color: "#667085",
  fontSize: 10,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const subtaskListStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const subtaskRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr) 120px",
  alignItems: "center",
  gap: 8,
  padding: "6px 7px",
  borderRadius: 15,
  border: "1px solid rgba(226,232,240,0.42)",
  transition:
    "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
};

const subtaskIndexStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 950,
  flexShrink: 0,
};

const subtaskInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 11,
  border: "1px solid transparent",
  fontSize: 12,
  fontWeight: 820,
  padding: "0 8px",
  outline: "none",
  background: "transparent",
  boxShadow: "none",
};

const subtaskStatusSelectStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.64)",
  fontSize: 11,
  fontWeight: 900,
  padding: "0 9px",
  outline: "none",
  cursor: "pointer",
};

const desktopTasksCss = `
  .crm-project-card-v3:hover {
    background: rgba(255,255,255,0.96) !important;
  }

  .crm-project-card-v3:focus-within {
    border-color: rgba(129,140,248,0.58) !important;
    box-shadow:
      0 0 0 4px rgba(99,102,241,0.08),
      0 20px 46px rgba(15,23,42,0.072) !important;
  }

  .crm-soft-button-v3:hover:not(:disabled) {
    background: rgba(248,250,252,0.95) !important;
    transform: translateY(-1px);
  }

  .crm-subtask-row-v3:hover {
    background: rgba(255,255,255,0.94) !important;
    border-color: rgba(199,210,254,0.64) !important;
    box-shadow: 0 7px 16px rgba(15,23,42,0.032);
  }

  .crm-subtask-input-v3:focus {
    background: rgba(255,255,255,0.92) !important;
    border-color: rgba(129,140,248,0.56) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.055) !important;
  }

  @media (max-width: 1420px) {
    .crm-project-card-v3 {
      overflow-x: auto !important;
    }
  }
`;
