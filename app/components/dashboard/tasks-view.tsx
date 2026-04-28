import EmptyState from "./empty-state";
import SectionCard from "./section-card";
import TaskRowComponent from "./task-row";
import TaskRowActions from "./task-row-actions";
import TasksToolbar from "./tasks-toolbar";
import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  TaskPriorityFilter,
  TaskSortOption,
  TaskStatusFilter,
} from "./task-filters";
import { formatDeadline } from "@/lib/tasks/format-deadline";

export type ClientEntity = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type TaskRow = {
  id: number;
  client: ClientEntity | null;
  task: string;
  amount: string;
  deadline: string;
  priority: string;
  status: string;
  source: string;
  raw_input?: string;
  deadline_date?: string | null;
  deadline_original_text?: string | null;
  created_at?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_notes?: string | null;
};

export type TaskGroup = {
  key: string;
  clientName: string;
  tasks: TaskRow[];
};

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
  searchTerm: string;
  statusFilter: TaskStatusFilter;
  priorityFilter: TaskPriorityFilter;
  sortOption: TaskSortOption;
  visibleTasksCount: number;
  highlightedTaskId?: number | null;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: TaskStatusFilter) => void;
  onPriorityFilterChange: (value: TaskPriorityFilter) => void;
  onSortOptionChange: (value: TaskSortOption) => void;
  onExportCsv: () => void;
  toggleClientGroup: (groupKey: string) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  copyTask: (taskId: number) => void;
  deleteTask: (taskId: number) => Promise<void> | void;
};

function normalizeTask(task: TaskRow): TaskRow {
  const preciseDeadline = task.deadline_date?.trim() || "";
  const fallbackDeadline = task.deadline?.trim() || "";
  const originalDeadlineText = task.deadline_original_text?.trim() || "";

  const resolvedDeadline = preciseDeadline || fallbackDeadline;
  const formattedDeadline = resolvedDeadline
    ? formatDeadline(resolvedDeadline)
    : "";

  return {
    ...task,
    deadline:
      formattedDeadline || originalDeadlineText || fallbackDeadline || "",
    client_phone: task.client?.phone ?? task.client_phone ?? null,
    client_email: task.client?.email ?? task.client_email ?? null,
    client_notes: task.client?.notes ?? task.client_notes ?? null,
  };
}

function formatCreatedDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getDeadlineSortValue(task: TaskRow) {
  if (task.deadline_date) {
    const precise = new Date(task.deadline_date).getTime();
    if (!Number.isNaN(precise)) return precise;
  }

  const fallback = new Date(task.deadline).getTime();
  if (!Number.isNaN(fallback)) return fallback;

  return Number.MAX_SAFE_INTEGER;
}

function getClientName(task: TaskRow) {
  return task.client?.name?.trim() || "";
}

function getClientDisplayName(task: TaskRow) {
  return task.client?.name?.trim() || "Unassigned";
}

function getEditableDeadlineValue(task: TaskRow) {
  return task.deadline_original_text?.trim() || task.deadline || "";
}

export default function TasksView({
  isLoadingTasks,
  tasksError,
  tasks,
  groupedTasks,
  savingTaskIds,
  savedTaskIds,
  deletingTaskIds,
  copiedTaskIds,
  searchTerm,
  statusFilter,
  priorityFilter,
  sortOption,
  visibleTasksCount,
  highlightedTaskId,
  onSearchTermChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSortOptionChange,
  onExportCsv,
  updateTaskStatus,
  updateTaskField,
  copyTask,
  deleteTask,
}: TasksViewProps) {
  const [flashTaskId, setFlashTaskId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
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

  if (!tasks.length) {
    return (
      <EmptyState
        title="No tasks yet"
        description="Paste your first message and extract it into structured work."
      />
    );
  }

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

  function openBulkDeleteConfirm() {
    if (selectedTaskIds.length === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  function closeBulkDeleteConfirm() {
    if (isBulkDeleting) return;
    setShowBulkDeleteConfirm(false);
  }

  async function confirmBulkDelete() {
    try {
      setIsBulkDeleting(true);
      const ids = [...selectedTaskIds];

      for (const id of ids) {
        await deleteTask(id);
      }

      setSelectedTaskIds([]);
      setShowBulkDeleteConfirm(false);
      toast.success(`Deleted ${ids.length} selected task(s)`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast.error("Could not delete selected tasks");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const allVisibleSelected =
    flatTasks.length > 0 &&
    flatTasks.every((task) => selectedTaskIds.includes(task.id));

  const hasSelection = selectedTaskIds.length > 0;
  const hasMatchingTasks = flatTasks.length > 0;

  return (
    <>
      <style>{responsiveCss}</style>

      <SectionCard
        title="Task CRM"
        description="Manage tasks, clients, deadlines, and status in one powerful workspace."
        rightSlot={
          <div className="tasks-top-stats" style={topStatsWrapStyle}>
            <div style={topStatPill("blue")}>◉ {visibleTasksCount} Tasks</div>
            <div style={topStatPill("green")}>
              ◉ {flatTasks.filter((task) => task.status === "Done").length} Done
            </div>
            <div style={topStatPill("orange")}>
              ◉ {flatTasks.filter((task) => task.priority === "High").length}{" "}
              High Priority
            </div>
          </div>
        }
      >
        <div style={mainContentStyle}>
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
            <div className="tasks-bulk-bar" style={bulkBarStyle}>
              <div style={bulkCountStyle}>{selectedTaskIds.length} selected</div>

              <button
                type="button"
                onClick={() => handleBulkStatus("Done")}
                style={bulkActionButtonStyle}
              >
                Mark Done
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatus("In Progress")}
                style={bulkActionButtonStyle}
              >
                Mark In Progress
              </button>

              <button
                type="button"
                onClick={openBulkDeleteConfirm}
                style={bulkDeleteButtonStyle}
              >
                Delete selected
              </button>

              <button
                type="button"
                onClick={() => setSelectedTaskIds([])}
                style={bulkSecondaryButtonStyle}
              >
                Clear
              </button>
            </div>
          )}

          {!hasMatchingTasks ? (
            <div style={emptyTableStateStyle}>
              <div style={emptyIconStyle}>⌕</div>
              <div style={emptyTitleStyle}>No matching tasks</div>
              <div style={emptyDescriptionStyle}>
                Try changing the search text, status filter, priority filter, or
                sort option.
              </div>
            </div>
          ) : (
            <>
              <div className="tasks-mobile-list" style={mobileListStyle}>
                {flatTasks.map((task) => {
                  const isSaving = !!savingTaskIds[task.id];
                  const isSaved = !!savedTaskIds[task.id];
                  const isDeleting = !!deletingTaskIds[task.id];
                  const isCopied = !!copiedTaskIds[task.id];
                  const isHighlighted = flashTaskId === task.id;

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
                        toggleSelect={toggleSelect}
                        updateTaskField={updateTaskField}
                        updateTaskStatus={updateTaskStatus}
                        copyTask={copyTask}
                        deleteTask={deleteTask}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="tasks-desktop-table" style={desktopTableStyle}>
                <div style={desktopHeaderRowStyle}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={!hasMatchingTasks}
                      onChange={toggleSelectAllVisible}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: hasMatchingTasks ? "pointer" : "not-allowed",
                        opacity: hasMatchingTasks ? 1 : 0.45,
                      }}
                    />
                  </div>
                  <div style={headerCellStyle}>👤 Client</div>
                  <div style={headerCellStyle}>☰ Task</div>
                  <div style={headerCellStyle}>💲 Amount</div>
                  <div style={headerCellStyle}>📅 Deadline</div>
                  <div style={headerCellStyle}>📞 Phone</div>
                  <div style={headerCellStyle}>✉️ Email</div>
                  <div style={headerCellStyle}>📝 Notes</div>
                  <div style={headerCellStyle}>🕘 Created</div>
                  <div style={headerCellStyle}>⚑ Priority</div>
                  <div style={headerCellStyle}>↗ Status</div>
                  <div style={headerCellStyle}>⚙ Actions</div>
                </div>

                {flatTasks.map((task) => {
                  const isSaving = !!savingTaskIds[task.id];
                  const isSaved = !!savedTaskIds[task.id];
                  const isDeleting = !!deletingTaskIds[task.id];
                  const isCopied = !!copiedTaskIds[task.id];
                  const isHighlighted = flashTaskId === task.id;

                  return (
                    <div
                      key={`desktop-${task.id}`}
                      ref={(node) => {
                        taskRefs.current[task.id] = node;
                      }}
                      style={{
                        position: "relative",
                        boxShadow: isHighlighted
                          ? "inset 3px 0 0 #f59e0b, 0 0 0 1px rgba(245,158,11,0.10)"
                          : "none",
                        transition:
                          "box-shadow 0.28s ease, transform 0.28s ease",
                        transform: isHighlighted ? "scale(1.0015)" : "scale(1)",
                      }}
                    >
                      <TaskRowComponent
                        task={task}
                        createdLabel={formatCreatedDate(task.created_at)}
                        isSaving={isSaving}
                        isSaved={isSaved}
                        isDeleting={isDeleting}
                        isCopied={isCopied}
                        isSelected={selectedTaskIds.includes(task.id)}
                        toggleSelect={toggleSelect}
                        onEnterBlur={handleEnterBlur}
                        updateTaskField={updateTaskField}
                        updateTaskStatus={updateTaskStatus}
                        copyTask={copyTask}
                        deleteTask={deleteTask}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {showBulkDeleteConfirm && (
        <div style={modalOverlayStyle} onClick={closeBulkDeleteConfirm}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete selected tasks confirmation"
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={modalTitleStyle}>Delete selected tasks?</div>
              <div style={modalTextStyle}>
                You are about to delete{" "}
                <strong>{selectedTaskIds.length} selected task(s)</strong>.
                This action cannot be undone.
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={closeBulkDeleteConfirm}
                style={modalSecondaryButtonStyle}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmBulkDelete}
                style={modalDeleteButtonStyle}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? "Deleting..." : "Delete selected"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileTaskCard({
  task,
  createdLabel,
  isSaving,
  isSaved,
  isDeleting,
  isCopied,
  isSelected,
  toggleSelect,
  updateTaskField,
  updateTaskStatus,
  copyTask,
  deleteTask,
}: {
  task: TaskRow;
  createdLabel: string;
  isSaving: boolean;
  isSaved: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  toggleSelect: (taskId: number) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  deleteTask: (taskId: number) => Promise<void> | void;
}) {
  const isDone = (task.status || "").trim().toLowerCase() === "done";
  const isBusy = isSaving || isDeleting;
  const clientName = getClientDisplayName(task);

  const [taskDraft, setTaskDraft] = useState(task.task || "");
  const [amountDraft, setAmountDraft] = useState(task.amount || "");
  const [deadlineDraft, setDeadlineDraft] = useState(
    getEditableDeadlineValue(task)
  );

  useEffect(() => {
    setTaskDraft(task.task || "");
  }, [task.task]);

  useEffect(() => {
    setAmountDraft(task.amount || "");
  }, [task.amount]);

  useEffect(() => {
    setDeadlineDraft(getEditableDeadlineValue(task));
  }, [task.deadline, task.deadline_original_text]);

  function saveTaskIfChanged() {
    const next = taskDraft.trim();
    const current = (task.task || "").trim();
    if (next !== current) updateTaskField(task.id, "task", next);
  }

  function saveAmountIfChanged() {
    const next = amountDraft.trim();
    const current = (task.amount || "").trim();
    if (next !== current) updateTaskField(task.id, "amount", next || null);
  }

  function saveDeadlineIfChanged() {
    const next = deadlineDraft.trim();
    const current = getEditableDeadlineValue(task).trim();
    if (next !== current) updateTaskField(task.id, "deadline", next);
  }

  function handleInputEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  return (
    <article
      style={{
        ...mobileCardStyle,
        borderLeft: isSaved
          ? "4px solid #16a34a"
          : isDone
          ? "4px solid #22c55e"
          : "4px solid #f59e0b",
        background: isDone
          ? "linear-gradient(180deg, rgba(240,253,244,0.96) 0%, #ffffff 100%)"
          : "#ffffff",
        opacity: isDeleting ? 0.6 : 1,
      }}
    >
      <div style={mobileCardTopStyle}>
        <label style={mobileCheckboxWrapStyle}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(task.id)}
            disabled={isBusy}
            style={{ width: 17, height: 17 }}
          />
        </label>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={mobileClientStyle}>{clientName}</div>
          <div style={mobileCreatedStyle}>Created {createdLabel}</div>
        </div>

        <div
          style={{
            ...mobileStatusPillStyle,
            color: isDone ? "#15803d" : "#2563eb",
            background: isDone
              ? "rgba(34,197,94,0.10)"
              : "rgba(59,130,246,0.10)",
            border: isDone
              ? "1px solid rgba(34,197,94,0.18)"
              : "1px solid rgba(59,130,246,0.18)",
          }}
        >
          {task.status || "New"}
        </div>
      </div>

      <div style={mobileFieldStackStyle}>
        <label style={mobileFieldLabelStyle}>Task</label>
        <input
          value={taskDraft}
          onChange={(e) => setTaskDraft(e.target.value)}
          onKeyDown={handleInputEnter}
          onBlur={saveTaskIfChanged}
          disabled={isBusy}
          style={mobileInputStyle}
        />
      </div>

      <div className="mobile-task-two-grid" style={mobileTwoGridStyle}>
        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Amount</label>
          <input
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            onKeyDown={handleInputEnter}
            onBlur={saveAmountIfChanged}
            disabled={isBusy}
            placeholder="Amount"
            style={mobileInputStyle}
          />
        </div>

        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Deadline</label>
          <input
            value={deadlineDraft}
            onChange={(e) => setDeadlineDraft(e.target.value)}
            onKeyDown={handleInputEnter}
            onBlur={saveDeadlineIfChanged}
            disabled={isBusy}
            placeholder="Deadline"
            style={mobileInputStyle}
          />
        </div>
      </div>

      <div className="mobile-task-two-grid" style={mobileTwoGridStyle}>
        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Priority</label>
          <select
            value={task.priority || "Medium"}
            onChange={(e) => updateTaskField(task.id, "priority", e.target.value)}
            disabled={isBusy}
            style={mobileInputStyle}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Status</label>
          <select
            value={task.status || "New"}
            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
            disabled={isBusy}
            style={mobileInputStyle}
          >
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </div>
      </div>

      <div style={mobileMetaGridStyle}>
        <MetaLine label="Phone" value={task.client_phone || task.client?.phone} />
        <MetaLine label="Email" value={task.client_email || task.client?.email} />
        <MetaLine label="Notes" value={task.client_notes || task.client?.notes} />
      </div>

      <div style={mobileActionsRowStyle}>
        <TaskRowActions
          taskId={task.id}
          isDeleting={isBusy}
          isCopied={isCopied}
          onCopy={copyTask}
          onDelete={deleteTask}
        />

        {(isSaving || isSaved || isDeleting) && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: isDeleting ? "#b91c1c" : isSaved ? "#15803d" : "#64748b",
            }}
          >
            {isDeleting ? "Deleting..." : isSaved ? "Saved" : "Saving..."}
          </div>
        )}
      </div>
    </article>
  );
}

function MetaLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <div style={mobileMetaLineStyle}>
      <span style={mobileMetaLabelStyle}>{label}</span>
      <span style={mobileMetaValueStyle}>{value}</span>
    </div>
  );
}

function topStatPill(
  tone: "blue" | "green" | "orange"
): CSSProperties {
  const palette = {
    blue: {
      background: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.12)",
      color: "#2563eb",
    },
    green: {
      background: "rgba(34,197,94,0.10)",
      border: "rgba(34,197,94,0.14)",
      color: "#15803d",
    },
    orange: {
      background: "rgba(245,158,11,0.10)",
      border: "rgba(245,158,11,0.14)",
      color: "#c2410c",
    },
  }[tone];

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    background: palette.background,
    border: `1px solid ${palette.border}`,
    color: palette.color,
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

const responsiveCss = `
  .tasks-mobile-list {
    display: none;
  }

  .tasks-desktop-table {
    display: block;
  }

  @media (max-width: 900px) {
    .tasks-top-stats {
      justify-content: flex-start !important;
      gap: 8px !important;
    }

    .tasks-top-stats > div {
      font-size: 12px !important;
      padding: 8px 10px !important;
    }

    .tasks-desktop-table {
      display: none !important;
    }

    .tasks-mobile-list {
      display: grid !important;
    }

    .tasks-bulk-bar {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
    }

    .tasks-bulk-bar > div:first-child {
      grid-column: 1 / -1 !important;
    }

    .mobile-task-two-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (min-width: 901px) {
    .tasks-mobile-list {
      display: none !important;
    }

    .tasks-desktop-table {
      display: block !important;
    }
  }
`;

const topStatsWrapStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const mainContentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  minWidth: 0,
  width: "100%",
};

const bulkBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.08)",
  background: "#0f172a",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
};

const bulkCountStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  marginRight: 4,
};

const mobileListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const mobileCardStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  borderRadius: 22,
  padding: 14,
  border: "1px solid rgba(226,232,240,0.96)",
  boxShadow:
    "0 12px 26px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
  display: "grid",
  gap: 12,
};

const mobileCardTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const mobileCheckboxWrapStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  background: "rgba(248,250,252,0.95)",
  border: "1px solid rgba(203,213,225,0.9)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const mobileClientStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 850,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mobileCreatedStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: "#94a3b8",
  fontWeight: 700,
};

const mobileStatusPillStyle: CSSProperties = {
  padding: "7px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const mobileFieldStackStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const mobileFieldLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const mobileInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  minHeight: 42,
  borderRadius: 13,
  border: "1px solid rgba(203,213,225,0.95)",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 750,
  fontSize: 14,
  padding: "0 12px",
  outline: "none",
};

const mobileTwoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  minWidth: 0,
};

const mobileMetaGridStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};

const mobileMetaLineStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "9px 10px",
  borderRadius: 13,
  background: "#f8fafc",
  border: "1px solid rgba(226,232,240,0.9)",
  minWidth: 0,
};

const mobileMetaLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const mobileMetaValueStyle: CSSProperties = {
  fontSize: 13,
  color: "#0f172a",
  fontWeight: 750,
  wordBreak: "break-word",
};

const mobileActionsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  paddingTop: 2,
};

const desktopTableStyle: CSSProperties = {
  border: "1px solid rgba(226,232,240,0.96)",
  borderRadius: 18,
  overflow: "auto",
  background: "#ffffff",
  boxShadow:
    "0 10px 22px rgba(15,23,42,0.035), 0 1px 4px rgba(15,23,42,0.02)",
};

const desktopHeaderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "42px 1.05fr 1.65fr 0.85fr 1.35fr 1fr 1.15fr 1.45fr 0.7fr 0.85fr 0.85fr 1.05fr",
  minWidth: 1180,
  padding: "12px 14px",
  background:
    "linear-gradient(180deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.10) 100%)",
  borderBottom: "1px solid rgba(245,158,11,0.18)",
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.01em",
  alignItems: "center",
  gap: 8,
};

const headerCellStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const emptyTableStateStyle: CSSProperties = {
  minHeight: 220,
  display: "grid",
  placeItems: "center",
  gap: 8,
  padding: 28,
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.72) 0%, rgba(255,255,255,1) 100%)",
};

const emptyIconStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(99,102,241,0.10)",
  border: "1px solid rgba(99,102,241,0.14)",
  color: "#4f46e5",
  fontSize: 24,
  fontWeight: 900,
};

const emptyTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const emptyDescriptionStyle: CSSProperties = {
  maxWidth: 520,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.65,
};

const bulkActionButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.10)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const bulkDeleteButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(239,68,68,0.18)",
  border: "1px solid rgba(239,68,68,0.24)",
};

const bulkSecondaryButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "transparent",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.36)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1200,
  backdropFilter: "blur(3px)",
};

const modalCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  borderRadius: 20,
  border: "1px solid rgba(226,232,240,0.96)",
  background: "#ffffff",
  boxShadow: "0 24px 50px rgba(15,23,42,0.16)",
  padding: 20,
  display: "grid",
  gap: 18,
};

const modalTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const modalTextStyle: CSSProperties = {
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.65,
};

const modalActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const modalSecondaryButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid rgba(203,213,225,0.96)",
  background: "#ffffff",
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const modalDeleteButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.20)",
  background: "rgba(239,68,68,0.94)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};