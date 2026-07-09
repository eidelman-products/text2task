import EmptyState from "./empty-state";
import TasksToolbar from "./tasks-toolbar";
import DesktopTasksTable from "./tasks/desktop-tasks-table";
import MobileTaskCard from "./tasks/mobile-task-card";
import TasksArchiveTabs from "./tasks/tasks-archive-tabs";
import TasksBulkBar from "./tasks/tasks-bulk-bar";
import TaskDeleteModals from "./tasks/task-delete-modals";
import TasksStatsPills from "./tasks/tasks-stats-pills";
import TasksEmptyFilterState from "./tasks/tasks-empty-filter-state";
import ResourceManagerModal from "./resources/resource-manager-modal";
import {
  fetchTaskResources,
  type TaskResource,
} from "./resources/resource-api";
import { useTaskSelection } from "./tasks/use-task-selection";
import { useTaskBulkActions } from "./tasks/use-task-bulk-actions";
import { useTaskSingleDelete } from "./tasks/use-task-single-delete";
import { useTaskDerivedData } from "./tasks/use-task-derived-data";
import { useTaskHighlight } from "./tasks/use-task-highlight";
import ProjectUpdateModal from "./tasks/project-updates/project-update-modal";
import ProjectUpdateHistoryModal from "./tasks/project-updates/project-update-history-modal";
import { useProjectUpdate } from "./tasks/project-updates/use-project-update";
import { useProjectUpdateHistory } from "./tasks/project-updates/use-project-update-history";
import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  TaskPriorityFilter,
  TaskSortOption,
  TaskStatusFilter,
} from "./task-filters";
import type {
  ClientEntity,
  TaskArchiveView,
  TaskGroup,
  ProjectEntity,
  TaskProjectGroup,
  TaskRow,
} from "./tasks/task-types";
import {
  formatCreatedDate,
  getViewDescription,
  getViewTitle,
} from "./tasks/task-utils";
import {
  mainContentStyle,
  mobileListStyle,
  responsiveCss,
} from "./tasks/tasks-view-styles";

export type {
  ClientEntity,
  TaskArchiveView,
  TaskGroup,
  TaskRow,
} from "./tasks/task-types";

type TasksViewProps = {
  isLoadingTasks: boolean;
  tasksError: string;
  tasks: TaskRow[];
  groupedTasks: TaskGroup[];
  expandedClients: Record<string, boolean>;
  savingTaskIds: Record<number, boolean>;
  savedTaskIds: Record<number, boolean>;
  deletingTaskIds: Record<number, boolean>;
  copiedTaskIds: Record<number, boolean>;
  archiveView: TaskArchiveView;
  searchTerm: string;
  statusFilter: TaskStatusFilter;
  priorityFilter: TaskPriorityFilter;
  sortOption: TaskSortOption;
  visibleTasksCount: number;
  statsTasks: TaskRow[];
  highlightedTaskId?: number | null;
  onArchiveViewChange: (value: TaskArchiveView) => void;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: TaskStatusFilter) => void;
  onPriorityFilterChange: (value: TaskPriorityFilter) => void;
  onSortOptionChange: (value: TaskSortOption) => void;
  onExportCsv: () => void;
  toggleClientGroup: (groupKey: string) => void;
  updateTaskStatus: (
    taskId: number,
    status: string,
    options?: {
      suppressErrorToast?: boolean;
      throwOnError?: boolean;
    }
  ) => Promise<void> | void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateProjectField: (
    projectId: string,
    field: string,
    value: any
  ) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void>;
  onRefreshTasks: () => Promise<void> | void;
  onProjectUpdateApplied: (
    result: ProjectUpdateAppliedResult
  ) => Promise<void> | void;
};

type ProjectUpdateAppliedResult = {
  focusTaskId?: number | null;
  projectId?: string | null;
  project?: (ProjectEntity & { client?: ClientEntity | null }) | null;
  projectTasks?: unknown[];
  dashboardTasks?: unknown[];
};

type ProjectAction = "archive" | "restore" | "delete";

type PendingProjectAction = {
  projectId: string;
  action: ProjectAction;
};

type ProjectDeleteTarget = {
  projectId: string;
  title: string;
};

export default function TasksView({
  isLoadingTasks,
  tasksError,
  tasks,
  groupedTasks,
  savingTaskIds,
  savedTaskIds,
  deletingTaskIds,
  copiedTaskIds,
  archiveView,
  searchTerm,
  statusFilter,
  priorityFilter,
  sortOption,
  visibleTasksCount,
  statsTasks,
  highlightedTaskId,
  onArchiveViewChange,
  onSearchTermChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSortOptionChange,
  onExportCsv,
  updateTaskStatus,
  updateTaskField,
  updateProjectField,
  copyTask,
  permanentlyDeleteTask,
  onRefreshTasks,
  onProjectUpdateApplied,
}: TasksViewProps) {
  const {
    allNormalizedTasks,
    normalizedStatsTasks,
    flatTasks,
    projectGroups,
    hasMatchingTasks,
    activeProjectsCount,
    totalTasksCount,
    completedProjectsCount,
    archivedProjectsCount,
    highPriorityTasksCount,
  } = useTaskDerivedData({
    tasks,
    statsTasks,
    groupedTasks,
    sortOption,
  });

  const { flashTaskId, taskRefs } = useTaskHighlight({
    highlightedTaskId,
    groupedTasks,
  });

  const {
    selectedTaskIds,
    hasSelection,
    allVisibleSelected,
    toggleSelect,
    toggleSelectAllVisible,
    clearSelection,
  } = useTaskSelection({
    visibleTasks: flatTasks,
    archiveView,
  });

  const {
    pendingBulkAction,
    isBulkDeleting,
    showBulkDeleteConfirm,
    handleBulkStatus,
    handleBulkArchive,
    handleBulkRestore,
    openBulkDeleteConfirm,
    closeBulkDeleteConfirm,
    confirmBulkPermanentDelete,
    resetBulkDeleteConfirm,
  } = useTaskBulkActions({
    selectedTaskIds,
    tasks: flatTasks,
    clearSelection,
    refreshTasks: onRefreshTasks,
  });

  const {
    singleDeleteTask,
    isSingleDeleting,
    closeSingleDeleteConfirm,
    confirmSinglePermanentDelete,
  } = useTaskSingleDelete({
    flatTasks,
    allNormalizedTasks,
    normalizedStatsTasks,
    permanentlyDeleteTask,
  });

  const [resourcesProject, setResourcesProject] =
    useState<TaskProjectGroup | null>(null);
  const [projectResourceCounts, setProjectResourceCounts] = useState<
    Record<string, number>
  >({});
  const [pendingProjectAction, setPendingProjectAction] =
    useState<PendingProjectAction | null>(null);
  const [projectDeleteTarget, setProjectDeleteTarget] =
    useState<ProjectDeleteTarget | null>(null);
  const pendingProjectActionRef = useRef<PendingProjectAction | null>(null);

  const projectUpdateState = useProjectUpdate();
  const projectUpdateHistoryState = useProjectUpdateHistory();

  useEffect(() => {
    if (isLoadingTasks) return;

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
  }, [isLoadingTasks]);

  useEffect(() => {
    resetBulkDeleteConfirm();
    closeSingleDeleteConfirm();
  }, [archiveView, resetBulkDeleteConfirm, closeSingleDeleteConfirm]);

  function handleEnterBlur(
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  function toggleProjectSelection(project: TaskProjectGroup) {
    const allSelected = project.taskIds.every((id) =>
      selectedTaskIds.includes(id)
    );

    project.taskIds.forEach((id) => {
      const isSelected = selectedTaskIds.includes(id);

      if (allSelected && isSelected) {
        toggleSelect(id);
      }

      if (!allSelected && !isSelected) {
        toggleSelect(id);
      }
    });
  }

  async function runProjectAction(
    projectId: string,
    action: ProjectAction
  ) {
    if (pendingProjectActionRef.current) return;

    const pendingAction = { projectId, action };

    pendingProjectActionRef.current = pendingAction;
    setPendingProjectAction(pendingAction);

    try {
      const response = await fetch("/api/projects/bulk-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: action === "delete" ? "soft_delete" : action,
          targets: [{ kind: "project", projectId }],
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Project ${action} failed`);
      }

      if (action === "delete") {
        setProjectDeleteTarget(null);
      }

      toast.success(
        action === "archive"
          ? "Project archived"
          : action === "restore"
            ? "Project restored"
            : "Project deleted"
      );

      try {
        await onRefreshTasks();
      } catch (refreshError) {
        console.error(
          `Project ${action} succeeded, but task refresh failed:`,
          refreshError
        );
        toast.warning(
          "Action completed successfully, but the task list could not refresh. Please refresh the workspace."
        );
      }
    } catch (error) {
      console.error(`Project ${action} failed:`, error);
      toast.error(
        action === "archive"
          ? "Could not archive this project."
          : action === "restore"
            ? "Could not restore this project."
            : "Could not delete this project."
      );
    } finally {
      pendingProjectActionRef.current = null;
      setPendingProjectAction(null);
    }
  }

  function archiveProject(project: TaskProjectGroup) {
    const projectId = getResolvedProjectId(project);

    if (!projectId) {
      toast.error("Could not find this project.");
      return;
    }

    void runProjectAction(projectId, "archive");
  }

  function restoreProject(project: TaskProjectGroup) {
    const projectId = getResolvedProjectId(project);

    if (!projectId) {
      toast.error("Could not find this project.");
      return;
    }

    void runProjectAction(projectId, "restore");
  }

  function requestProjectDelete(project: TaskProjectGroup) {
    if (pendingProjectActionRef.current) return;

    const projectId = getResolvedProjectId(project);

    if (!projectId) {
      toast.error("Could not find this project.");
      return;
    }

    setProjectDeleteTarget({
      projectId,
      title: project.projectTitle || "This project",
    });
  }

  function closeProjectDeleteConfirm() {
    if (pendingProjectActionRef.current?.action === "delete") return;
    setProjectDeleteTarget(null);
  }

  function confirmProjectDelete() {
    if (!projectDeleteTarget) return;
    void runProjectAction(projectDeleteTarget.projectId, "delete");
  }

  function openProjectResources(project: TaskProjectGroup) {
    const projectId = getResolvedProjectId(project);

    if (!projectId) return;

    setResourcesProject({
      ...project,
      project_id: projectId,
    });
  }

  function openProjectHistory(project: TaskProjectGroup) {
    const projectId = getResolvedProjectId(project);

    if (!projectId) return;

    projectUpdateHistoryState.openHistory({
      ...project,
      project_id: projectId,
    });
  }

  function closeProjectResources() {
    setResourcesProject(null);
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

  if (isLoadingTasks) {
    return (
      <EmptyState
        title="Loading tasks..."
        description="We are loading your saved tasks from the workspace."
      />
    );
  }

  if (tasksError) {
    return <EmptyState title="Could not load tasks" description={tasksError} />;
  }

  if (!tasks.length && archiveView === "active") {
    return (
      <>
        <style>{responsiveCss}</style>

        <section className="tasks-open-page" style={openPageStyle}>
          <TaskCrmHeader
            archiveView={archiveView}
            activeProjectsCount={activeProjectsCount}
            totalTasksCount={totalTasksCount}
            completedProjectsCount={completedProjectsCount}
            archivedProjectsCount={archivedProjectsCount}
            highPriorityTasksCount={highPriorityTasksCount}
          />

          <TasksArchiveTabs
            archiveView={archiveView}
            onArchiveViewChange={onArchiveViewChange}
          />

          <EmptyState
            title="No active tasks yet"
            description="Paste your first message and extract it into structured work."
          />
        </section>
      </>
    );
  }

  if (!tasks.length && archiveView === "archived") {
    return (
      <>
        <style>{responsiveCss}</style>

        <section className="tasks-open-page" style={openPageStyle}>
          <TaskCrmHeader
            archiveView={archiveView}
            activeProjectsCount={activeProjectsCount}
            totalTasksCount={totalTasksCount}
            completedProjectsCount={completedProjectsCount}
            archivedProjectsCount={archivedProjectsCount}
            highPriorityTasksCount={highPriorityTasksCount}
          />

          <TasksArchiveTabs
            archiveView={archiveView}
            onArchiveViewChange={onArchiveViewChange}
          />

          <EmptyState
            title="Archive is empty"
            description="When you archive completed or old work, it will appear here."
          />
        </section>
      </>
    );
  }

  return (
    <>
      <style>{responsiveCss}</style>

      <section className="tasks-open-page" style={openPageStyle}>
        <TaskCrmHeader
          archiveView={archiveView}
          activeProjectsCount={activeProjectsCount}
          totalTasksCount={totalTasksCount}
          completedProjectsCount={completedProjectsCount}
          archivedProjectsCount={archivedProjectsCount}
          highPriorityTasksCount={highPriorityTasksCount}
        />

        <div style={{ ...mainContentStyle, ...openMainContentStyle }}>
          <TasksArchiveTabs
            archiveView={archiveView}
            onArchiveViewChange={onArchiveViewChange}
          />

          <TasksToolbar
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            sortOption={sortOption}
            visibleTasksCount={visibleTasksCount}
            visibleProjectsCount={projectGroups.length}
            onSearchTermChange={onSearchTermChange}
            onStatusFilterChange={onStatusFilterChange}
            onPriorityFilterChange={onPriorityFilterChange}
            onSortOptionChange={onSortOptionChange}
            onExportCsv={onExportCsv}
          />

          {hasSelection && (
            <TasksBulkBar
              selectedCount={selectedTaskIds.length}
              archiveView={archiveView}
              pendingBulkAction={pendingBulkAction}
              onBulkStatus={handleBulkStatus}
              onBulkArchive={handleBulkArchive}
              onBulkRestore={handleBulkRestore}
              onOpenBulkDeleteConfirm={openBulkDeleteConfirm}
              onClearSelection={clearSelection}
            />
          )}

          {!hasMatchingTasks ? (
            <TasksEmptyFilterState />
          ) : (
            <>
              <div className="tasks-mobile-list" style={mobileListStyle}>
                {projectGroups.map((project) => {
                  const resolvedProjectId = getResolvedProjectId(project);
                  const isSaving = project.taskIds.some(
                    (id) => savingTaskIds[id]
                  );
                  const isSaved = project.taskIds.some((id) => savedTaskIds[id]);
                  const isDeleting = project.taskIds.some(
                    (id) => deletingTaskIds[id]
                  ) || pendingProjectAction?.projectId === resolvedProjectId;
                  const isCopied = Boolean(
                    copiedTaskIds[project.primaryTask.id]
                  );
                  const isSelected = project.taskIds.every((id) =>
                    selectedTaskIds.includes(id)
                  );
                  const isPartiallySelected =
                    !isSelected &&
                    project.taskIds.some((id) => selectedTaskIds.includes(id));

                  const isHighlighted = project.taskIds.includes(
                    flashTaskId || -1
                  );

                  return (
                    <div
                      key={`mobile-project-${project.key}`}
                      ref={(node) => {
                        project.tasks.forEach((task) => {
                          if (node) {
                            taskRefs.current[task.id] = node;
                          } else {
                            delete taskRefs.current[task.id];
                          }
                        });
                      }}
                      style={{
                        transform: isHighlighted ? "scale(1.01)" : "scale(1)",
                        transition: "transform 0.25s ease",
                      }}
                    >
                      <MobileTaskCard
                        project={project}
                        projectId={resolvedProjectId}
                        isSaving={isSaving}
                        isSaved={isSaved}
                        isDeleting={isDeleting}
                        isCopied={isCopied}
                        isSelected={isSelected}
                        isPartiallySelected={isPartiallySelected}
                        archiveView={archiveView}
                        projectResourceCount={
                          projectResourceCounts[getProjectResourceKey(project)] ||
                          0
                        }
                        onOpenProjectResources={
                          resolvedProjectId ? openProjectResources : undefined
                        }
                        onOpenProjectUpdate={projectUpdateState.openModal}
                        onOpenProjectHistory={
                          resolvedProjectId ? openProjectHistory : undefined
                        }
                        onToggleProjectSelection={toggleProjectSelection}
                        updateTaskField={updateTaskField}
                        updateTaskStatus={updateTaskStatus}
                        updateProjectField={updateProjectField}
                        copyTask={copyTask}
                      />
                    </div>
                  );
                })}
              </div>

              <DesktopTasksTable
                tasks={flatTasks}
                allVisibleSelected={allVisibleSelected}
                hasMatchingTasks={hasMatchingTasks}
                savingTaskIds={savingTaskIds}
                savedTaskIds={savedTaskIds}
                deletingTaskIds={deletingTaskIds}
                copiedTaskIds={copiedTaskIds}
                selectedTaskIds={selectedTaskIds}
                archiveView={archiveView}
                highlightedTaskId={highlightedTaskId}
                flashTaskId={flashTaskId}
                taskRefs={taskRefs}
                onToggleSelectAllVisible={toggleSelectAllVisible}
                onEnterBlur={handleEnterBlur}
                toggleSelect={toggleSelect}
                updateTaskField={updateTaskField}
                updateTaskStatus={updateTaskStatus}
                updateProjectField={updateProjectField}
                copyTask={copyTask}
                pendingProjectAction={pendingProjectAction}
                onArchiveProject={archiveProject}
                onRestoreProject={restoreProject}
                onRequestProjectDelete={requestProjectDelete}
                formatCreatedDate={formatCreatedDate}
                projectResourceCounts={projectResourceCounts}
                onOpenProjectResources={openProjectResources}
                onOpenProjectUpdate={projectUpdateState.openModal}
                onOpenProjectHistory={openProjectHistory}
              />
            </>
          )}
        </div>
      </section>

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

      <ProjectUpdateModal
        uiState={projectUpdateState.uiState}
        onClose={projectUpdateState.closeModal}
        onRawInputChange={projectUpdateState.setRawInput}
        onInputMethodChange={projectUpdateState.setInputMethod}
        onAnalyze={projectUpdateState.analyzeCurrentUpdate}
        onImageSelected={projectUpdateState.setSelectedImage}
        onRemoveImage={projectUpdateState.removeSelectedImage}
        onImageError={projectUpdateState.setImageError}
        onToggleSuggestedItem={projectUpdateState.toggleSuggestedItem}
        onUpdateSuggestedItemValue={projectUpdateState.updateSuggestedItemValue}
        onApply={() =>
          projectUpdateState.applySelectedChanges(onProjectUpdateApplied)
        }
      />

      <ProjectUpdateHistoryModal
        state={projectUpdateHistoryState.state}
        onClose={projectUpdateHistoryState.closeHistory}
        onRefresh={projectUpdateHistoryState.refreshHistory}
      />

      <TaskDeleteModals
        singleDeleteTask={singleDeleteTask}
        projectDeleteTarget={projectDeleteTarget}
        showBulkDeleteConfirm={showBulkDeleteConfirm}
        isSingleDeleting={isSingleDeleting}
        isProjectDeleting={pendingProjectAction?.action === "delete"}
        isBulkDeleting={isBulkDeleting}
        onCloseSingleDeleteConfirm={closeSingleDeleteConfirm}
        onConfirmSinglePermanentDelete={confirmSinglePermanentDelete}
        onCloseProjectDeleteConfirm={closeProjectDeleteConfirm}
        onConfirmProjectDelete={confirmProjectDelete}
        onCloseBulkDeleteConfirm={closeBulkDeleteConfirm}
        onConfirmBulkPermanentDelete={confirmBulkPermanentDelete}
      />
    </>
  );
}

function getResolvedProjectId(project: TaskProjectGroup) {
  const directProjectId =
    project.project_id ||
    project.project?.id ||
    project.primaryTask?.project_id ||
    project.primaryTask?.project?.id ||
    project.tasks.find((task) => task.project_id)?.project_id ||
    project.tasks.find((task) => task.project?.id)?.project?.id ||
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

function TaskCrmHeader({
  archiveView,
  activeProjectsCount,
  totalTasksCount,
  completedProjectsCount,
  archivedProjectsCount,
  highPriorityTasksCount,
}: {
  archiveView: TaskArchiveView;
  activeProjectsCount: number;
  totalTasksCount: number;
  completedProjectsCount: number;
  archivedProjectsCount: number;
  highPriorityTasksCount: number;
}) {
  return (
    <header className="tasks-open-header" style={openHeaderStyle}>
      <div className="tasks-open-header-top" style={openHeaderTopStyle}>
        <div style={openHeaderTextStyle}>
          <h1 style={openTitleStyle}>{getViewTitle(archiveView)}</h1>
          <p style={openDescriptionStyle}>{getViewDescription(archiveView)}</p>
        </div>

        <TasksStatsPills
          activeProjectsCount={activeProjectsCount}
          totalTasksCount={totalTasksCount}
          completedProjectsCount={completedProjectsCount}
          archivedProjectsCount={archivedProjectsCount}
          highPriorityTasksCount={highPriorityTasksCount}
        />
      </div>
    </header>
  );
}

const openPageStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1320,
  margin: "0",
  padding: "12px 26px 36px",
  display: "grid",
  gap: 12,
  minWidth: 0,
};

const openMainContentStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  borderRadius: 0,
  boxShadow: "none",
  padding: 0,
  maxWidth: 1200,
};

const openHeaderStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
  maxWidth: 1200,
};

const openHeaderTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  minWidth: 0,
};

const openHeaderTextStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const openTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: "-0.055em",
};

const openDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 650,
};
