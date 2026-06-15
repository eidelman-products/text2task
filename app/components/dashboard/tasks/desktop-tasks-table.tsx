import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent, MutableRefObject } from "react";
import TaskRowActions from "../task-row-actions";
import type {
  TaskArchiveView,
  TaskProjectGroup,
  TaskRow,
} from "./task-types";
import { buildTaskProjectGroups } from "./task-utils";
import ClientContactEditor from "./client-contact-editor";
import ProjectMetaEditor from "./project-meta-editor";
import ProjectHeaderEditor from "./project-header-editor";
import ProjectUpdateButton from "./project-updates/project-update-button";
import * as historyStyles from "./project-updates/project-update-history-styles";

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
  pendingProjectAction: {
    projectId: string;
    action: "archive" | "restore" | "delete";
  } | null;
  onArchiveProject: (project: TaskProjectGroup) => void;
  onRestoreProject: (project: TaskProjectGroup) => void;
  onRequestProjectDelete: (project: TaskProjectGroup) => void;
  formatCreatedDate: (value?: string | null) => string;
  projectResourceCounts: Record<string, number>;
  onOpenProjectResources: (project: TaskProjectGroup) => void;
  onOpenProjectUpdate: (project: TaskProjectGroup) => void;
  onOpenProjectHistory: (project: TaskProjectGroup) => void;
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
  pendingProjectAction,
  onArchiveProject,
  onRestoreProject,
  onRequestProjectDelete,
  formatCreatedDate,
  projectResourceCounts,
  onOpenProjectResources,
  onOpenProjectUpdate,
  onOpenProjectHistory,
}: DesktopTasksTableProps) {
  const projectGroups = useMemo(() => buildTaskProjectGroups(tasks), [tasks]);

  const [openProjectKeys, setOpenProjectKeys] = useState<
    Record<string, boolean>
  >({});
  const [hoveredProjectKey, setHoveredProjectKey] = useState<string | null>(
    null
  );
  const [hoveredHistoryProjectKey, setHoveredHistoryProjectKey] =
    useState<string | null>(null);

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

  return (
    <>
      <div className="tasks-desktop-table" style={desktopShellStyle}>
        <style>{desktopTasksCss}</style>

        <div style={workspaceHeaderStyle}>
          <div>
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
            const archivedDate = formatArchivedDate(project.archived_at);

            const visual = getProjectVisualState(project);
            const resolvedProjectId = getResolvedProjectId(project);
            const projectPendingAction =
              pendingProjectAction?.projectId === resolvedProjectId
                ? pendingProjectAction.action
                : null;
            const isProjectBusy = isDeleting || Boolean(projectPendingAction);
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
                className="crm-project-card-v6"
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
                    ? "rgba(37,99,235,0.32)"
                    : isHovered
                      ? "rgba(147,197,253,0.78)"
                      : visual.cardBorder,
                  boxShadow: isHovered ? visual.hoverShadow : visual.cardShadow,
                  opacity: isProjectBusy ? 0.62 : 1,
                  transform: isHovered ? "translateY(-1px)" : "translateY(0)",
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
                      disabled={isProjectBusy}
                      style={cardCheckboxStyle}
                    />
                  </div>

                  <div style={projectIdentityStyle}>
                    <ProjectHeaderEditor
                      project={project}
                      isDeleting={isProjectBusy}
                      createdLabel={formatCreatedDate(project.created_at)}
                      onEnterBlur={onEnterBlur}
                      updateProjectField={updateProjectField}
                    />

                    <div style={projectQuickActionsStyle}>
                      <button
                        type="button"
                        onClick={() => toggleProject(project.key)}
                        className="crm-soft-button-v6"
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
                        onClick={() => onOpenProjectResources(project)}
                        disabled={!canManageResources || isProjectBusy}
                        className="crm-soft-button-v6"
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
                            !canManageResources || isProjectBusy ? 0.55 : 1,
                          cursor:
                            !canManageResources || isProjectBusy
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

                      {actionMode !== "archived" ? (
                        <ProjectUpdateButton
                          project={project}
                          isDeleting={isProjectBusy}
                          onOpenModal={onOpenProjectUpdate}
                        />
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onOpenProjectHistory(project)}
                        disabled={!canManageResources || isProjectBusy}
                        onMouseEnter={() =>
                          setHoveredHistoryProjectKey(project.key)
                        }
                        onMouseLeave={() => setHoveredHistoryProjectKey(null)}
                        className="crm-soft-button-v6"
                        title={
                          canManageResources
                            ? "Review previous client updates for this project"
                            : "History is available for saved projects"
                        }
                        style={
                          !canManageResources || isProjectBusy
                            ? historyStyles.historyButtonDisabledStyle
                            : hoveredHistoryProjectKey === project.key
                              ? historyStyles.historyButtonHoverStyle
                              : historyStyles.historyButtonStyle
                        }
                      >
                        History
                      </button>

                      <TaskRowActions
                        taskId={project.primaryTask.id}
                        isDeleting={isProjectBusy}
                        isCopied={isCopied}
                        actionMode={actionMode}
                        pendingAction={projectPendingAction}
                        onCopy={copyTask}
                        onArchive={() => onArchiveProject(project)}
                        onRestore={() => onRestoreProject(project)}
                        onPermanentDelete={() => onRequestProjectDelete(project)}
                      />

                      {actionMode === "archived" ? (
                        <span style={archivedProjectIndicatorStyle}>
                          Archived project
                          {archivedDate ? ` · Archived ${archivedDate}` : ""}
                        </span>
                      ) : null}

                      {(isSaving || isSaved || isProjectBusy) && (
                        <span
                          style={{
                            ...saveStateStyle,
                            color: isProjectBusy
                              ? "#b42318"
                              : isSaved
                                ? "#067647"
                                : "#667085",
                          }}
                        >
                          {isProjectBusy
                            ? projectPendingAction === "restore"
                              ? "Restoring..."
                              : projectPendingAction === "delete"
                                ? "Deleting..."
                                : "Archiving..."
                            : isSaved
                              ? "Saved"
                              : "Saving..."}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="project-meta-compact-v6"
                    style={projectMetaWrapStyle}
                  >
                    <ProjectMetaEditor
                      project={project}
                      isDeleting={isProjectBusy}
                      readOnlyStatusPriority={actionMode === "archived"}
                      onEnterBlur={onEnterBlur}
                      updateProjectField={updateProjectField}
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
                    <div style={detailsGridStyle}>
                      <ClientContactEditor
                        project={project}
                        isDeleting={isProjectBusy}
                        onEnterBlur={onEnterBlur}
                        updateTaskField={updateTaskField}
                        updateProjectField={updateProjectField}
                      />

                      <section style={workPlanSectionStyle}>
                        <div style={sectionHeaderStyle}>
                          <div style={sectionTitleStyle}>Subtasks</div>

                          <div style={progressBlockStyle}>
                            <span style={progressTextStyle}>
                              {project.completedSubtaskCount}/
                              {project.subtaskCount} done
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
                                className="crm-subtask-row-v6"
                                ref={(node) => {
                                  if (node) {
                                    taskRefs.current[subtask.id] = node;
                                  } else {
                                    delete taskRefs.current[subtask.id];
                                  }
                                }}
                                style={{
                                  ...subtaskRowStyle,
                                  background: isSubtaskHighlighted
                                    ? "rgba(239,246,255,0.46)"
                                    : subtaskDone
                                      ? "rgba(240,253,244,0.24)"
                                      : subtaskRowStyle.background,
                                }}
                              >
                                <span
                                  style={{
                                    ...subtaskIndexStyle,
                                    color: subtaskDone
                                      ? "#067647"
                                      : "#64748b",
                                    background: subtaskDone
                                      ? "rgba(220,252,231,0.68)"
                                      : "rgba(248,250,252,0.64)",
                                    borderColor: subtaskDone
                                      ? "rgba(187,247,208,0.70)"
                                      : "rgba(226,232,240,0.58)",
                                  }}
                                >
                                  {subtaskDone ? "✓" : index + 1}
                                </span>

                                {actionMode === "archived" ? (
                                  <span
                                    style={{
                                      ...subtaskReadOnlyTitleStyle,
                                      textDecoration: subtaskDone
                                        ? "line-through"
                                        : "none",
                                      color: subtaskDone
                                        ? "#64748b"
                                        : "#334155",
                                    }}
                                  >
                                    {subtask.title}
                                  </span>
                                ) : (
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
                                    className="crm-subtask-input-v6"
                                    style={{
                                      ...subtaskInputStyle,
                                      textDecoration: subtaskDone
                                        ? "line-through"
                                        : "none",
                                      color: subtaskDone
                                        ? "#475467"
                                        : "#101828",
                                    }}
                                    disabled={isProjectBusy}
                                  />
                                )}

                                {actionMode === "archived" ? (
                                  <span style={subtaskReadOnlyStatusStyle}>
                                    {subtask.status || "New"}
                                  </span>
                                ) : (
                                  <select
                                    value={subtask.status || "New"}
                                    onChange={(e) =>
                                      updateTaskStatus(
                                        subtask.id,
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={onEnterBlur}
                                    disabled={isProjectBusy}
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
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
      accent:
        "linear-gradient(180deg, rgba(22,163,74,0.58) 0%, rgba(134,239,172,0.42) 100%)",
      cardBackground: "#ffffff",
      surfaceBackground:
        "linear-gradient(180deg, rgba(240,253,244,0.08) 0%, rgba(255,255,255,0) 40%)",
      detailsBackground:
        "linear-gradient(180deg, rgba(248,250,252,0.40), rgba(255,255,255,0.98))",
      cardBorder: "rgba(203,213,225,0.68)",
      cardShadow:
        "0 10px 26px rgba(15,23,42,0.030), inset 0 1px 0 rgba(255,255,255,0.96)",
      hoverShadow:
        "0 16px 34px rgba(15,23,42,0.054), inset 0 1px 0 rgba(255,255,255,0.98)",
    };
  }

  if (deadlineState === "overdue") {
    return {
      accent:
        "linear-gradient(180deg, rgba(185,28,28,0.58) 0%, rgba(248,113,113,0.42) 100%)",
      cardBackground: "#ffffff",
      surfaceBackground:
        "linear-gradient(180deg, rgba(254,242,242,0.08) 0%, rgba(255,255,255,0) 40%)",
      detailsBackground:
        "linear-gradient(180deg, rgba(248,250,252,0.40), rgba(255,255,255,0.98))",
      cardBorder: "rgba(203,213,225,0.68)",
      cardShadow:
        "0 10px 26px rgba(15,23,42,0.030), inset 0 1px 0 rgba(255,255,255,0.96)",
      hoverShadow:
        "0 16px 34px rgba(15,23,42,0.054), inset 0 1px 0 rgba(255,255,255,0.98)",
    };
  }

  if (priority === "high" || status === "urgent") {
    return {
      accent:
        "linear-gradient(180deg, rgba(217,119,6,0.58) 0%, rgba(251,191,36,0.42) 100%)",
      cardBackground: "#ffffff",
      surfaceBackground:
        "linear-gradient(180deg, rgba(255,251,235,0.08) 0%, rgba(255,255,255,0) 40%)",
      detailsBackground:
        "linear-gradient(180deg, rgba(248,250,252,0.40), rgba(255,255,255,0.98))",
      cardBorder: "rgba(203,213,225,0.68)",
      cardShadow:
        "0 10px 26px rgba(15,23,42,0.030), inset 0 1px 0 rgba(255,255,255,0.96)",
      hoverShadow:
        "0 16px 34px rgba(15,23,42,0.054), inset 0 1px 0 rgba(255,255,255,0.98)",
    };
  }

  return {
    accent:
      "linear-gradient(180deg, rgba(37,99,235,0.60) 0%, rgba(147,197,253,0.44) 100%)",
    cardBackground: "#ffffff",
    surfaceBackground:
      "linear-gradient(180deg, rgba(239,246,255,0.10) 0%, rgba(255,255,255,0) 40%)",
    detailsBackground:
      "linear-gradient(180deg, rgba(248,250,252,0.40), rgba(255,255,255,0.98))",
    cardBorder: "rgba(203,213,225,0.68)",
    cardShadow:
      "0 10px 26px rgba(15,23,42,0.030), inset 0 1px 0 rgba(255,255,255,0.96)",
    hoverShadow:
      "0 16px 34px rgba(15,23,42,0.054), inset 0 1px 0 rgba(255,255,255,0.98)",
  };
}

function getSubtaskStatusStyle(statusValue: string) {
  const status = String(statusValue || "").trim().toLowerCase();

  if (status === "done") {
    return {
      color: "#067647",
      background: "rgba(240,253,244,0.70)",
      borderColor: "rgba(187,247,208,0.62)",
    };
  }

  if (status === "urgent") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.70)",
      borderColor: "rgba(254,202,202,0.62)",
    };
  }

  if (status === "review") {
    return {
      color: "#2563eb",
      background: "rgba(239,246,255,0.70)",
      borderColor: "rgba(191,219,254,0.64)",
    };
  }

  if (status === "in progress" || status === "in-progress") {
    return {
      color: "#1d4ed8",
      background: "rgba(239,246,255,0.70)",
      borderColor: "rgba(191,219,254,0.64)",
    };
  }

  return {
    color: "#475467",
    background: "rgba(248,250,252,0.70)",
    borderColor: "rgba(226,232,240,0.64)",
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

function formatArchivedDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(date);
}

const desktopShellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  width: "100%",
  maxWidth: 1230,
  minWidth: 0,
  justifyItems: "stretch",
  margin: "0",
};

const workspaceHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "0 0 6px",
  borderRadius: 0,
  border: "none",
  background: "transparent",
  boxShadow: "none",
};

const summaryTitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 18,
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
  gap: 12,
  width: "100%",
  maxWidth: 1230,
  minWidth: 0,
  margin: "0",
};

const projectCardStyle: CSSProperties = {
  position: "relative",
  borderRadius: 22,
  border: "1px solid rgba(203,213,225,0.68)",
  background: "#ffffff",
  overflow: "hidden",
  transition:
    "border-color 0.20s ease, box-shadow 0.20s ease, opacity 0.20s ease, transform 0.20s ease",
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
  width: 2,
  borderRadius: "0 999px 999px 0",
  zIndex: 2,
  opacity: 0.46,
};

const projectHeroStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns:
    "24px minmax(610px, 1.18fr) minmax(520px, 0.82fr)",
  gap: 14,
  alignItems: "center",
  padding: "14px 14px 13px 18px",
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
  gap: 8,
};

const projectQuickActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  flexWrap: "nowrap",
  minWidth: 0,
};

const archivedProjectIndicatorStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "0 4px",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const projectMetaWrapStyle: CSSProperties = {
  minWidth: 0,
  width: "100%",
  maxWidth: 610,
  justifySelf: "end",
};

const detailsButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 31,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(191,219,254,0.68)",
  background: "rgba(239,246,255,0.70)",
  color: "#1d4ed8",
  fontSize: 11.5,
  fontWeight: 900,
  cursor: "pointer",
  transition:
    "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease",
};

const detailsButtonActiveStyle: CSSProperties = {
  borderColor: "rgba(37,99,235,0.28)",
  background: "rgba(219,234,254,0.74)",
  color: "#1d4ed8",
};

const detailsButtonIconStyle: CSSProperties = {
  width: 17,
  height: 17,
  borderRadius: 999,
  display: "inline-grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.88)",
  color: "#2563eb",
  fontWeight: 950,
};

const detailsCountStyle: CSSProperties = {
  minWidth: 17,
  height: 17,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#475569",
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(226,232,240,0.72)",
  fontWeight: 950,
  fontSize: 10,
};

const resourcesButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 31,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(203,213,225,0.64)",
  background: "rgba(255,255,255,0.72)",
  color: "#1d4ed8",
  fontSize: 11.5,
  fontWeight: 900,
  transition:
    "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease, transform 0.18s ease",
};

const resourcesButtonActiveStyle: CSSProperties = {
  background: "rgba(239,246,255,0.72)",
  color: "#1d4ed8",
  borderColor: "rgba(37,99,235,0.24)",
};

const resourcesCountPillStyle: CSSProperties = {
  minWidth: 17,
  height: 17,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(239,246,255,0.80)",
  color: "#1d4ed8",
  border: "1px solid rgba(191,219,254,0.64)",
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

const detailsPanelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  borderTop: "1px solid rgba(226,232,240,0.38)",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.40), rgba(255,255,255,0.98))",
  padding: "14px 20px 17px",
};

const progressBlockStyle: CSSProperties = {
  width: 142,
  display: "grid",
  gap: 4,
};

const progressTextStyle: CSSProperties = {
  textAlign: "right",
  fontSize: 11,
  fontWeight: 850,
  color: "#64748b",
};

const progressTrackStyle: CSSProperties = {
  height: 4,
  borderRadius: 999,
  background: "rgba(226,232,240,0.66)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  opacity: 0.76,
  transition: "width 0.24s ease",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 11,
  width: "100%",
  maxWidth: 1090,
  margin: "0 auto 0 0",
};

const workPlanSectionStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
  paddingTop: 5,
  borderTop: "1px solid rgba(226,232,240,0.32)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 950,
  color: "#101828",
};

const subtaskListStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  paddingTop: 4,
  paddingBottom: 14,
};

const subtaskRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr) 118px",
  alignItems: "center",
  gap: 10,
  minHeight: 38,
  padding: "5px 0",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  boxShadow: "none",
  outline: "none",
  transition: "background 0.16s ease",
};

const subtaskIndexStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.46)",
  display: "grid",
  placeItems: "center",
  fontSize: 9.5,
  fontWeight: 900,
  flexShrink: 0,
};

const subtaskInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 8,
  border: "1px solid transparent",
  fontSize: 13.2,
  fontWeight: 780,
  padding: "0 2px",
  outline: "none",
  background: "transparent",
  boxShadow: "none",
};

const subtaskReadOnlyTitleStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  display: "flex",
  alignItems: "center",
  padding: "0 2px",
  fontSize: 13.2,
  fontWeight: 780,
  lineHeight: 1.35,
  cursor: "default",
};

const subtaskStatusSelectStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.46)",
  background: "rgba(255,255,255,0.72)",
  color: "#334155",
  fontSize: 10.8,
  fontWeight: 840,
  padding: "0 8px",
  outline: "none",
  cursor: "pointer",
};

const subtaskReadOnlyStatusStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.46)",
  background: "rgba(248,250,252,0.62)",
  color: "#64748b",
  fontSize: 10.8,
  fontWeight: 840,
  padding: "0 8px",
  display: "flex",
  alignItems: "center",
  boxSizing: "border-box",
  cursor: "default",
};

const desktopTasksCss = `
  .crm-project-card-v6 .project-header-edit-shell-summary {
    display: none !important;
  }

  .crm-project-card-v6:hover {
    background: #ffffff !important;
  }

  .crm-project-card-v6:focus-within {
    border-color: rgba(147,197,253,0.78) !important;
    box-shadow:
      0 0 0 3px rgba(37,99,235,0.04),
      0 18px 38px rgba(15,23,42,0.058) !important;
  }

  .crm-soft-button-v6:hover:not(:disabled) {
    background: rgba(239,246,255,0.86) !important;
    border-color: rgba(147,197,253,0.72) !important;
    transform: translateY(-1px);
  }

  .crm-project-card-v6 .task-row-actions {
    gap: 5px !important;
    flex-wrap: nowrap !important;
  }

  .crm-project-card-v6 .task-row-action-button {
    height: 31px !important;
    min-height: 31px !important;
    padding: 0 10px !important;
    border-color: rgba(203,213,225,0.64) !important;
    background: rgba(255,255,255,0.72) !important;
    color: #1d4ed8 !important;
    font-size: 11.5px !important;
    box-shadow: none !important;
  }

  .crm-project-card-v6 .task-row-action-button span {
    background: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important;
  }

  .project-meta-compact-v6 input:focus,
  .project-meta-compact-v6 select:focus {
    border-color: rgba(37,99,235,0.30) !important;
    background: rgba(255,255,255,0.96) !important;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.04) !important;
  }

  .crm-subtask-row-v6 {
    border: none !important;
    border-bottom: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  .crm-subtask-row-v6:hover {
    background: rgba(248,250,252,0.48) !important;
    border: none !important;
    border-bottom: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  .crm-subtask-row-v6:last-child {
    padding-bottom: 10px !important;
    border: none !important;
    border-bottom: none !important;
  }

  .crm-subtask-input-v6 {
    border: 1px solid transparent !important;
    box-shadow: none !important;
    outline: none !important;
  }

  .crm-subtask-input-v6:focus {
    background: rgba(255,255,255,0.96) !important;
    border-color: rgba(37,99,235,0.22) !important;
    box-shadow: 0 0 0 2px rgba(37,99,235,0.035) !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
  }

  @media (max-width: 1420px) {
    .crm-project-card-v6 {
      overflow-x: auto !important;
    }
  }

  @media (max-width: 1180px) {
    .crm-project-card-v6 {
      overflow-x: auto !important;
    }

    .project-meta-compact-v6 {
      min-width: 560px !important;
    }
  }
`;
