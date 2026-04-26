import EmptyState from "./empty-state";
import SectionCard from "./section-card";
import TaskRowComponent from "./task-row";
import TasksToolbar from "./tasks-toolbar";
import type { KeyboardEvent } from "react";
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
      <SectionCard
        title="Task CRM"
        description="Manage tasks, clients, deadlines, and status in one powerful workspace."
        rightSlot={
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={topStatPill("blue")}>◉ {visibleTasksCount} Tasks</div>
            <div style={topStatPill("green")}>
              ◉ {flatTasks.filter((task) => task.status === "Done").length} Done
            </div>
            <div style={topStatPill("orange")}>
              ◉ {flatTasks.filter((task) => task.priority === "High").length} High Priority
            </div>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
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
            <div
              style={{
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
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  marginRight: 4,
                }}
              >
                {selectedTaskIds.length} selected
              </div>

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

          <div
            style={{
              border: "1px solid rgba(226,232,240,0.96)",
              borderRadius: 18,
              overflow: "hidden",
              background: "#ffffff",
              boxShadow:
                "0 10px 22px rgba(15,23,42,0.035), 0 1px 4px rgba(15,23,42,0.02)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "42px 1.05fr 1.65fr 0.85fr 1.35fr 1fr 1.15fr 1.45fr 0.7fr 0.85fr 0.85fr 1.05fr",
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
              }}
            >
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

            {!hasMatchingTasks ? (
              <div style={emptyTableStateStyle}>
                <div style={emptyIconStyle}>⌕</div>
                <div style={emptyTitleStyle}>No matching tasks</div>
                <div style={emptyDescriptionStyle}>
                  Try changing the search text, status filter, priority filter,
                  or sort option.
                </div>
              </div>
            ) : (
              flatTasks.map((task) => {
                const isSaving = !!savingTaskIds[task.id];
                const isSaved = !!savedTaskIds[task.id];
                const isDeleting = !!deletingTaskIds[task.id];
                const isCopied = !!copiedTaskIds[task.id];
                const isHighlighted = flashTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    ref={(node) => {
                      taskRefs.current[task.id] = node;
                    }}
                    style={{
                      position: "relative",
                      boxShadow: isHighlighted
                        ? "inset 3px 0 0 #f59e0b, 0 0 0 1px rgba(245,158,11,0.10)"
                        : "none",
                      transition: "box-shadow 0.28s ease, transform 0.28s ease",
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
              })
            )}
          </div>
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

function topStatPill(
  tone: "blue" | "green" | "orange"
): React.CSSProperties {
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

const headerCellStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const emptyTableStateStyle: React.CSSProperties = {
  minHeight: 220,
  display: "grid",
  placeItems: "center",
  gap: 8,
  padding: 28,
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.72) 0%, rgba(255,255,255,1) 100%)",
};

const emptyIconStyle: React.CSSProperties = {
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

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const emptyDescriptionStyle: React.CSSProperties = {
  maxWidth: 520,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.65,
};

const bulkActionButtonStyle: React.CSSProperties = {
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

const bulkDeleteButtonStyle: React.CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(239,68,68,0.18)",
  border: "1px solid rgba(239,68,68,0.24)",
};

const bulkSecondaryButtonStyle: React.CSSProperties = {
  ...bulkActionButtonStyle,
  background: "transparent",
};

const modalOverlayStyle: React.CSSProperties = {
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

const modalCardStyle: React.CSSProperties = {
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

const modalTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const modalTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.65,
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const modalSecondaryButtonStyle: React.CSSProperties = {
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

const modalDeleteButtonStyle: React.CSSProperties = {
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