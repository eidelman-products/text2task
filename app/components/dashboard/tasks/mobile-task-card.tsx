import { useEffect, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import TaskRowActions from "../task-row-actions";
import type { TaskArchiveView, TaskRow } from "./task-types";
import {
  getClientDisplayName,
  getEditableDeadlineValue,
} from "./task-utils";

type MobileTaskCardProps = {
  task: TaskRow;
  createdLabel: string;
  isSaving: boolean;
  isSaved: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  archiveView: TaskArchiveView;
  toggleSelect: (taskId: number) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
};

export default function MobileTaskCard({
  task,
  createdLabel,
  isSaving,
  isSaved,
  isDeleting,
  isCopied,
  isSelected,
  archiveView,
  toggleSelect,
  updateTaskField,
  updateTaskStatus,
  copyTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
}: MobileTaskCardProps) {
  const isDone = (task.status || "").trim().toLowerCase() === "done";
  const isBusy = isSaving || isDeleting;
  const clientName = getClientDisplayName(task);
  const actionMode =
    archiveView === "archived" || task.is_archived ? "archived" : "active";

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

    if (next !== current) {
      updateTaskField(task.id, "task", next);
    }
  }

  function saveAmountIfChanged() {
    const next = amountDraft.trim();
    const current = (task.amount || "").trim();

    if (next !== current) {
      updateTaskField(task.id, "amount", next || null);
    }
  }

  function saveDeadlineIfChanged() {
    const next = deadlineDraft.trim();
    const current = getEditableDeadlineValue(task).trim();

    if (next !== current) {
      updateTaskField(task.id, "deadline", next);
    }
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
            : task.is_archived
              ? "4px solid #94a3b8"
              : "4px solid #f59e0b",
        background: isDone
          ? "linear-gradient(180deg, rgba(240,253,244,0.96) 0%, #ffffff 100%)"
          : task.is_archived
            ? "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, #ffffff 100%)"
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
            color: isDone ? "#15803d" : task.is_archived ? "#475569" : "#2563eb",
            background: isDone
              ? "rgba(34,197,94,0.10)"
              : task.is_archived
                ? "rgba(148,163,184,0.12)"
                : "rgba(59,130,246,0.10)",
            border: isDone
              ? "1px solid rgba(34,197,94,0.18)"
              : task.is_archived
                ? "1px solid rgba(148,163,184,0.18)"
                : "1px solid rgba(59,130,246,0.18)",
          }}
        >
          {task.is_archived ? "Archived" : task.status || "New"}
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
            onChange={(e) =>
              updateTaskField(task.id, "priority", e.target.value)
            }
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
          actionMode={actionMode}
          onCopy={copyTask}
          onArchive={archiveTask}
          onRestore={restoreTask}
          onPermanentDelete={permanentlyDeleteTask}
        />

        {(isSaving || isSaved || isDeleting) && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: isDeleting ? "#b91c1c" : isSaved ? "#15803d" : "#64748b",
            }}
          >
            {isDeleting
              ? actionMode === "archived"
                ? "Deleting..."
                : "Archiving..."
              : isSaved
                ? "Saved"
                : "Saving..."}
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