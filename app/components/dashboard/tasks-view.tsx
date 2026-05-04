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
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  getClientName,
  getDeadlineSortValue,
  getViewDescription,
  getViewTitle,
  isActiveCurrentTask,
  isArchivedCurrentTask,
  isCompletedLifetimeTask,
  normalizeTask,
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
  const [flashTaskId, setFlashTaskId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [singleDeleteTask, setSingleDeleteTask] = useState<TaskRow | null>(null);
  const [isSingleDeleting, setIsSingleDeleting] = useState(false);
  const taskRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!highlightedTaskId) return;

    const timer = setTimeout(() => {
      const target = taskRefs.current[highlightedTaskId];
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setFlashTaskId(highlightedTaskId);
      }
    }, 250);

    const clearTimer = setTimeout(() => {
      setFlashTaskId((current) =>
        current === highlightedTaskId ? null : current
      );
    }, 2600);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [highlightedTaskId, groupedTasks]);

  const allNormalizedTasks = useMemo(() => {
    return tasks.map((task) => normalizeTask(task));
  }, [tasks]);

  const normalizedStatsTasks = useMemo(() => {
    return statsTasks.map((task) => normalizeTask(task));
  }, [statsTasks]);

  const flatTasks = useMemo(() => {
    const normalized = groupedTasks.flatMap((group) =>
      group.tasks.map((task) => normalizeTask(task))
    );

    return [...normalized].sort((a, b) => {
      switch (sortOption) {
        case "client-asc":
          return getClientName(a).localeCompare(getClientName(b));

        case "client-desc":
          return getClientName(b).localeCompare(getClientName(a));

        case "task-asc":
          return (a.task || "").localeCompare(b.task || "");

        case "task-desc":
          return (b.task || "").localeCompare(a.task || "");

        case "deadline-asc":
          return getDeadlineSortValue(a) - getDeadlineSortValue(b);

        case "deadline-desc":
          return getDeadlineSortValue(b) - getDeadlineSortValue(a);

        default: {
          const clientCompare = getClientName(a).localeCompare(getClientName(b));
          if (clientCompare !== 0) return clientCompare;

          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;

          return createdB - createdA;
        }
      }
    });
  }, [groupedTasks, sortOption]);

  useEffect(() => {
    const visibleIds = new Set(flatTasks.map((task) => task.id));

    setSelectedTaskIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [flatTasks]);

  useEffect(() => {
    setSelectedTaskIds([]);
    setShowBulkDeleteConfirm(false);
    setSingleDeleteTask(null);
  }, [archiveView]);

  function handleEnterBlur(
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  function toggleSelect(taskId: number) {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = flatTasks.map((task) => task.id);
    const allVisibleSelected = visibleIds.every((id) =>
      selectedTaskIds.includes(id)
    );

    if (allVisibleSelected) {
      setSelectedTaskIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
      return;
    }

    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  async function handleBulkStatus(nextStatus: string) {
    const ids = [...selectedTaskIds];

    try {
      for (const id of ids) {
        await updateTaskStatus(id, nextStatus);
      }

      setSelectedTaskIds([]);
      toast.success(`Updated ${ids.length} task(s) to ${nextStatus}`);
    } catch (error) {
      console.error("Bulk status update failed:", error);
      toast.error("Could not update selected tasks");
    }
  }

  async function handleBulkArchive() {
    const ids = [...selectedTaskIds];

    try {
      for (const id of ids) {
        await archiveTask(id);
      }

      setSelectedTaskIds([]);
      toast.success(`${ids.length} task(s) moved to Archive`);
    } catch (error) {
      console.error("Bulk archive failed:", error);
      toast.error("Could not archive selected tasks");
    }
  }

  async function handleBulkRestore() {
    const ids = [...selectedTaskIds];

    try {
      for (const id of ids) {
        await restoreTask(id);
      }

      setSelectedTaskIds([]);
      toast.success(`${ids.length} task(s) restored`);
    } catch (error) {
      console.error("Bulk restore failed:", error);
      toast.error("Could not restore selected tasks");
    }
  }

  function openBulkDeleteConfirm() {
    if (selectedTaskIds.length === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  function closeBulkDeleteConfirm() {
    if (isBulkDeleting) return;
    setShowBulkDeleteConfirm(false);
  }

  async function confirmBulkPermanentDelete() {
    try {
      setIsBulkDeleting(true);
      const ids = [...selectedTaskIds];

      for (const id of ids) {
        await permanentlyDeleteTask(id);
      }

      setSelectedTaskIds([]);
      setShowBulkDeleteConfirm(false);
      toast.success(`Permanently deleted ${ids.length} selected task(s)`);
    } catch (error) {
      console.error("Bulk permanent delete failed:", error);
      toast.error("Could not permanently delete selected tasks");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function requestSinglePermanentDelete(taskId: number) {
    const task =
      flatTasks.find((item) => item.id === taskId) ||
      allNormalizedTasks.find((item) => item.id === taskId) ||
      normalizedStatsTasks.find((item) => item.id === taskId) ||
      null;

    if (!task) {
      toast.error("Could not find this task");
      return;
    }

    setSingleDeleteTask(task);
  }

  function closeSingleDeleteConfirm() {
    if (isSingleDeleting) return;
    setSingleDeleteTask(null);
  }

  async function confirmSinglePermanentDelete() {
    if (!singleDeleteTask) return;

    try {
      setIsSingleDeleting(true);
      await permanentlyDeleteTask(singleDeleteTask.id);
      toast.success("Task permanently deleted");
      setSingleDeleteTask(null);
    } catch (error) {
      console.error("Permanent delete failed:", error);
      toast.error("Could not permanently delete this task");
    } finally {
      setIsSingleDeleting(false);
    }
  }

  const allVisibleSelected =
    flatTasks.length > 0 &&
    flatTasks.every((task) => selectedTaskIds.includes(task.id));

  const hasSelection = selectedTaskIds.length > 0;
  const hasMatchingTasks = flatTasks.length > 0;

  const activeCount = normalizedStatsTasks.filter(isActiveCurrentTask).length;

  const doneCount = normalizedStatsTasks.filter(isCompletedLifetimeTask).length;

  const archivedCount = normalizedStatsTasks.filter(isArchivedCurrentTask).length;

  const highCount = normalizedStatsTasks.filter(
    (task) =>
      isActiveCurrentTask(task) &&
      String(task.priority || "").trim().toLowerCase() === "high"
  ).length;

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
              onClearSelection={() => setSelectedTaskIds([])}
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