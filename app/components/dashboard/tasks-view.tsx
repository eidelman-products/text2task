import EmptyState from "./empty-state";
import SectionCard from "./section-card";
import TasksToolbar from "./tasks-toolbar";
import DesktopTasksTable from "./tasks/desktop-tasks-table";
import MobileTaskCard from "./tasks/mobile-task-card";
import TasksArchiveTabs from "./tasks/tasks-archive-tabs";
import TasksBulkBar from "./tasks/tasks-bulk-bar";
import TaskDeleteModals from "./tasks/task-delete-modals";
import TasksStatsPills from "./tasks/tasks-stats-pills";
import TasksEmptyFilterState from "./tasks/tasks-empty-filter-state";
import { useTaskSelection } from "./tasks/use-task-selection";
import { useTaskBulkActions } from "./tasks/use-task-bulk-actions";
import { useTaskSingleDelete } from "./tasks/use-task-single-delete";
import { useTaskDerivedData } from "./tasks/use-task-derived-data";
import { useTaskHighlight } from "./tasks/use-task-highlight";
import type { KeyboardEvent } from "react";
import { useEffect } from "react";
import type {
  TaskPriorityFilter,
  TaskSortOption,
  TaskStatusFilter,
} from "./task-filters";
import type {
  TaskArchiveView,
  TaskGroup,
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
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  copyTask: (taskId: number) => void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
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
  copyTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
}: TasksViewProps) {
  const {
    allNormalizedTasks,
    normalizedStatsTasks,
    flatTasks,
    hasMatchingTasks,
    activeCount,
    doneCount,
    archivedCount,
    highCount,
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
    clearSelection,
    updateTaskStatus,
    archiveTask,
    restoreTask,
    permanentlyDeleteTask,
  });

  const {
    singleDeleteTask,
    isSingleDeleting,
    requestSinglePermanentDelete,
    closeSingleDeleteConfirm,
    confirmSinglePermanentDelete,
  } = useTaskSingleDelete({
    flatTasks,
    allNormalizedTasks,
    normalizedStatsTasks,
    permanentlyDeleteTask,
  });

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
      <SectionCard
        title="Task CRM"
        description="Manage tasks, clients, deadlines, and status in one powerful workspace."
      >
        <TasksArchiveTabs
          archiveView={archiveView}
          onArchiveViewChange={onArchiveViewChange}
        />

        <EmptyState
          title="No active tasks yet"
          description="Paste your first message and extract it into structured work."
        />
      </SectionCard>
    );
  }

  if (!tasks.length && archiveView === "archived") {
    return (
      <SectionCard
        title="Archived Tasks"
        description="Archived tasks will appear here when you choose to move them out of your active workspace."
      >
        <TasksArchiveTabs
          archiveView={archiveView}
          onArchiveViewChange={onArchiveViewChange}
        />

        <EmptyState
          title="Archive is empty"
          description="When you archive completed or old work, it will appear here."
        />
      </SectionCard>
    );
  }

  return (
    <>
      <style>{responsiveCss}</style>

      <SectionCard
        title={getViewTitle(archiveView)}
        description={getViewDescription(archiveView)}
        rightSlot={
          <TasksStatsPills
            activeCount={activeCount}
            doneCount={doneCount}
            archivedCount={archivedCount}
            highCount={highCount}
          />
        }
      >
        <div style={mainContentStyle}>
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
                {flatTasks.map((task) => {
                  const isSaving = !!savingTaskIds[task.id];
                  const isSaved = !!savedTaskIds[task.id];
                  const isDeleting = !!deletingTaskIds[task.id];
                  const isCopied = !!copiedTaskIds[task.id];
                  const isHighlighted = flashTaskId === task.id;
                  const rowArchiveView =
                    archiveView === "archived" || task.is_archived
                      ? "archived"
                      : "active";

                  return (
                    <div
                      key={`mobile-${task.id}`}
                      ref={(node) => {
                        taskRefs.current[task.id] = node;
                      }}
                      style={{
                        transform: isHighlighted ? "scale(1.01)" : "scale(1)",
                        transition: "transform 0.25s ease",
                      }}
                    >
                      <MobileTaskCard
                        task={task}
                        createdLabel={formatCreatedDate(task.created_at)}
                        isSaving={isSaving}
                        isSaved={isSaved}
                        isDeleting={isDeleting}
                        isCopied={isCopied}
                        isSelected={selectedTaskIds.includes(task.id)}
                        archiveView={rowArchiveView}
                        toggleSelect={toggleSelect}
                        updateTaskField={updateTaskField}
                        updateTaskStatus={updateTaskStatus}
                        copyTask={copyTask}
                        archiveTask={archiveTask}
                        restoreTask={restoreTask}
                        permanentlyDeleteTask={requestSinglePermanentDelete}
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
                flashTaskId={flashTaskId}
                taskRefs={taskRefs}
                onToggleSelectAllVisible={toggleSelectAllVisible}
                onEnterBlur={handleEnterBlur}
                toggleSelect={toggleSelect}
                updateTaskField={updateTaskField}
                updateTaskStatus={updateTaskStatus}
                copyTask={copyTask}
                archiveTask={archiveTask}
                restoreTask={restoreTask}
                permanentlyDeleteTask={requestSinglePermanentDelete}
                formatCreatedDate={formatCreatedDate}
              />
            </>
          )}
        </div>
      </SectionCard>

      <TaskDeleteModals
        singleDeleteTask={singleDeleteTask}
        selectedCount={selectedTaskIds.length}
        showBulkDeleteConfirm={showBulkDeleteConfirm}
        isSingleDeleting={isSingleDeleting}
        isBulkDeleting={isBulkDeleting}
        onCloseSingleDeleteConfirm={closeSingleDeleteConfirm}
        onConfirmSinglePermanentDelete={confirmSinglePermanentDelete}
        onCloseBulkDeleteConfirm={closeBulkDeleteConfirm}
        onConfirmBulkPermanentDelete={confirmBulkPermanentDelete}
      />
    </>
  );
}