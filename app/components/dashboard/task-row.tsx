import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { TaskArchiveView, TaskRow as TaskRowType } from "./tasks-view";
import TaskRowActions from "./task-row-actions";
import { getDeadlineUi } from "@/lib/tasks/get-deadline-ui";
import {
  taskTableGridColumns,
  taskTableMinWidth,
} from "./tasks/task-table-layout";

type TaskRowProps = {
  rowIndex: number;
  task: TaskRowType;
  createdLabel: string;
  isSaving: boolean;
  isSaved: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  archiveView: TaskArchiveView;
  toggleSelect: (taskId: number) => void;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  archiveTask: (taskId: number) => Promise<void> | void;
  restoreTask: (taskId: number) => Promise<void> | void;
  permanentlyDeleteTask: (taskId: number) => Promise<void> | void;
};

type VisualTone = {
  accent: string;
  accent2: string;
  text: string;
  soft: string;
  border: string;
  priorityBg: string;
  priorityBorder: string;
  priorityText: string;
};

function getClientDisplayName(task: TaskRowType) {
  return task.client?.name?.trim() || "Unassigned";
}

function getEditableDeadlineValue(task: TaskRowType) {
  return task.deadline_original_text?.trim() || task.deadline || "";
}

function getPriorityValue(priority: string | null | undefined) {
  return String(priority || "").trim().toLowerCase();
}

function getStatusValue(status: string | null | undefined) {
  return String(status || "").trim().toLowerCase();
}

function isDoneStatus(status: string | null | undefined) {
  return getStatusValue(status) === "done";
}

function getVisualTone(task: TaskRowType): VisualTone {
  const priority = getPriorityValue(task.priority);
  const status = getStatusValue(task.status);

  if (task.is_archived) {
    return {
      accent: "#64748b",
      accent2: "#94a3b8",
      text: "#334155",
      soft: "rgba(248,250,252,0.96)",
      border: "rgba(203,213,225,0.96)",
      priorityBg: "rgba(248,250,252,0.98)",
      priorityBorder: "rgba(203,213,225,0.95)",
      priorityText: "#475569",
    };
  }

  if (status === "done") {
    return {
      accent: "#16a34a",
      accent2: "#22c55e",
      text: "#166534",
      soft: "rgba(240,253,244,0.96)",
      border: "rgba(34,197,94,0.22)",
      priorityBg: "rgba(240,253,244,0.98)",
      priorityBorder: "rgba(34,197,94,0.24)",
      priorityText: "#15803d",
    };
  }

  if (priority === "high") {
    return {
      accent: "#e11d48",
      accent2: "#f97316",
      text: "#9f1239",
      soft: "rgba(255,241,242,0.96)",
      border: "rgba(225,29,72,0.18)",
      priorityBg: "rgba(255,241,242,0.98)",
      priorityBorder: "rgba(225,29,72,0.24)",
      priorityText: "#be123c",
    };
  }

  if (priority === "low") {
    return {
      accent: "#2563eb",
      accent2: "#06b6d4",
      text: "#1d4ed8",
      soft: "rgba(239,246,255,0.96)",
      border: "rgba(37,99,235,0.18)",
      priorityBg: "rgba(239,246,255,0.98)",
      priorityBorder: "rgba(37,99,235,0.22)",
      priorityText: "#1d4ed8",
    };
  }

  return {
    accent: "#7c3aed",
    accent2: "#f59e0b",
    text: "#6d28d9",
    soft: "rgba(245,243,255,0.96)",
    border: "rgba(124,58,237,0.16)",
    priorityBg: "rgba(255,251,235,0.98)",
    priorityBorder: "rgba(245,158,11,0.24)",
    priorityText: "#b45309",
  };
}

function getStatusSelectTone(status: string | null | undefined) {
  const value = getStatusValue(status);

  if (value === "done") {
    return {
      bg: "rgba(240,253,244,0.98)",
      border: "rgba(34,197,94,0.24)",
      text: "#15803d",
    };
  }

  if (value === "in progress") {
    return {
      bg: "rgba(238,242,255,0.98)",
      border: "rgba(99,102,241,0.24)",
      text: "#4338ca",
    };
  }

  return {
    bg: "rgba(248,250,252,0.98)",
    border: "rgba(148,163,184,0.24)",
    text: "#334155",
  };
}

function buildDeadlineUi(task: TaskRowType) {
  const isDone = isDoneStatus(task.status);

  if (isDone) {
    return {
      icon: "✓",
      label: "Completed",
      backgroundColor: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.24)",
      textColor: "#15803d",
    };
  }

  const raw = getDeadlineUi(
    getEditableDeadlineValue(task),
    task.deadline_date || null,
    task.status || null
  );

  const cleanLabel = String(raw.label || "").toLowerCase();

  if (
    cleanLabel.includes("on track") ||
    cleanLabel.includes("completed") ||
    raw.textColor === "#15803d"
  ) {
    return {
      icon: "•",
      label: task.deadline_date ? "Scheduled" : raw.label || "Deadline",
      backgroundColor: "rgba(248,250,252,0.96)",
      borderColor: "rgba(203,213,225,0.95)",
      textColor: "#475569",
    };
  }

  return raw;
}

export default function TaskRow({
  rowIndex,
  task,
  createdLabel,
  isSaving,
  isSaved,
  isDeleting,
  isCopied,
  isSelected,
  archiveView,
  toggleSelect,
  onEnterBlur,
  updateTaskField,
  updateTaskStatus,
  copyTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
}: TaskRowProps) {
  const isBusy = isSaving || isDeleting;
  const clientDisplayName = getClientDisplayName(task);
  const actionMode =
    archiveView === "archived" || task.is_archived ? "archived" : "active";

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState(task.task || "");
  const [amountDraft, setAmountDraft] = useState(task.amount || "");
  const [deadlineDraft, setDeadlineDraft] = useState(
    getEditableDeadlineValue(task)
  );
  const [phoneDraft, setPhoneDraft] = useState(
    task.client?.phone || task.client_phone || ""
  );
  const [emailDraft, setEmailDraft] = useState(
    task.client?.email || task.client_email || ""
  );
  const [notesDraft, setNotesDraft] = useState(
    task.client?.notes || task.client_notes || ""
  );
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);

  useEffect(() => {
    setTaskDraft(task.task || "");
  }, [task.task]);

  useEffect(() => {
    setAmountDraft(task.amount || "");
  }, [task.amount]);

  useEffect(() => {
    if (!isEditingDeadline) {
      setDeadlineDraft(getEditableDeadlineValue(task));
    }
  }, [task.deadline, task.deadline_original_text, isEditingDeadline]);

  useEffect(() => {
    setPhoneDraft(task.client?.phone || task.client_phone || "");
  }, [task.client?.phone, task.client_phone]);

  useEffect(() => {
    setEmailDraft(task.client?.email || task.client_email || "");
  }, [task.client?.email, task.client_email]);

  useEffect(() => {
    setNotesDraft(task.client?.notes || task.client_notes || "");
  }, [task.client?.notes, task.client_notes]);

  const visualTone = useMemo(() => getVisualTone(task), [task]);
  const statusTone = useMemo(
    () => getStatusSelectTone(task.status),
    [task.status]
  );
  const deadlineUi = useMemo(() => buildDeadlineUi(task), [task]);

  function saveTaskIfChanged() {
    if (isBusy) return;

    const nextValue = taskDraft.trim();
    const currentValue = (task.task || "").trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "task", nextValue);
  }

  function saveAmountIfChanged() {
    if (isBusy) return;

    const nextValue = amountDraft.trim();
    const currentValue = (task.amount || "").trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "amount", nextValue === "" ? null : nextValue);
  }

  function saveDeadlineIfChanged() {
    if (isBusy) return;

    const nextValue = deadlineDraft.trim();
    const currentValue = getEditableDeadlineValue(task).trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "deadline", nextValue);
  }

  function savePhoneIfChanged() {
    if (isBusy) return;

    const nextValue = phoneDraft.trim();
    const currentValue = (
      task.client?.phone ||
      task.client_phone ||
      ""
    ).trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "phone", nextValue === "" ? null : nextValue);
  }

  function saveEmailIfChanged() {
    if (isBusy) return;

    const nextValue = emailDraft.trim();
    const currentValue = (
      task.client?.email ||
      task.client_email ||
      ""
    ).trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "email", nextValue === "" ? null : nextValue);
  }

  function saveNotesIfChanged() {
    if (isBusy) return;

    const nextValue = notesDraft.trim();
    const currentValue = (
      task.client?.notes ||
      task.client_notes ||
      ""
    ).trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "notes", nextValue === "" ? null : nextValue);
  }

  function handleTaskKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveTaskIfChanged();
      e.currentTarget.blur();
    }
  }

  function handleNotesKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveNotesIfChanged();
      e.currentTarget.blur();
    }
  }

  function handleAmountKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      saveAmountIfChanged();
      onEnterBlur(e);
    }
  }

  function handleDeadlineKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      saveDeadlineIfChanged();
      setIsEditingDeadline(false);
      onEnterBlur(e);
    }
  }

  function handlePhoneKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      savePhoneIfChanged();
      onEnterBlur(e);
    }
  }

  function handleEmailKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      saveEmailIfChanged();
      onEnterBlur(e);
    }
  }

  function handlePriorityChange(value: string) {
    if (isBusy) return;
    updateTaskField(task.id, "priority", value);
  }

  function handleStatusChange(value: string) {
    if (isBusy) return;
    updateTaskStatus(task.id, value);
  }

  function handleSelectChange() {
    if (isBusy) return;
    toggleSelect(task.id);
  }

  const rowShellBackground = isSelected
    ? "linear-gradient(135deg, rgba(239,246,255,1) 0%, rgba(255,255,255,1) 58%, rgba(238,242,255,0.95) 100%)"
    : "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 60%, rgba(248,250,252,0.98) 100%)";

  const disabledInputStyle = isBusy
    ? {
        ...inputStyle,
        cursor: "not-allowed",
        opacity: 0.72,
        background: "rgba(248,250,252,0.95)",
      }
    : inputStyle;

  const disabledTaskTextAreaStyle = isBusy
    ? {
        ...taskTextAreaStyle,
        cursor: "not-allowed",
        opacity: 0.72,
        background: "rgba(248,250,252,0.95)",
      }
    : taskTextAreaStyle;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: taskTableGridColumns,
        minWidth: taskTableMinWidth,
        padding: "16px 16px 14px",
        alignItems: "start",
        gap: 12,
        opacity: isDeleting ? 0.55 : 1,
        background: rowShellBackground,
        border: `1px solid ${visualTone.border}`,
        borderLeft: `7px solid ${visualTone.accent}`,
        borderRadius: 22,
        boxShadow: isSaved
          ? "0 18px 34px rgba(34,197,94,0.12), inset 0 0 0 1px rgba(34,197,94,0.07)"
          : isSelected
            ? "0 16px 30px rgba(59,130,246,0.10)"
            : "0 12px 28px rgba(15,23,42,0.055)",
        transition:
          "background 0.28s ease, box-shadow 0.28s ease, transform 0.28s ease, opacity 0.2s ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: 5,
          background: `linear-gradient(90deg, ${visualTone.accent} 0%, ${visualTone.accent2} 46%, rgba(99,102,241,0.22) 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: "5px auto auto 0",
          width: 130,
          height: 130,
          background: `radial-gradient(circle, ${visualTone.soft} 0%, transparent 68%)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectChange}
          disabled={isBusy}
          style={{
            width: 16,
            height: 16,
            cursor: isBusy ? "not-allowed" : "pointer",
            opacity: isBusy ? 0.45 : 1,
          }}
        />
      </div>

      <div
        style={{
          ...mainTaskCellStyle,
          background:
            "linear-gradient(135deg, rgba(239,246,255,0.94) 0%, rgba(255,255,255,0.98) 55%, rgba(245,243,255,0.90) 100%)",
          border: "1px solid rgba(191,219,254,0.82)",
          borderRadius: 18,
          padding: "12px 12px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.75), 0 5px 14px rgba(37,99,235,0.035)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={clientLineStyle}>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              flexShrink: 0,
              background: visualTone.accent,
              boxShadow: `0 0 0 5px ${visualTone.soft}`,
            }}
          />

          <span style={clientNameStyle} title={clientDisplayName}>
            {clientDisplayName}
          </span>

          <span
            style={{
              ...createdMiniStyle,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)",
              border: "1px solid rgba(203,213,225,0.92)",
              color: "#64748b",
            }}
            title={createdLabel}
          >
            Created {createdLabel}
          </span>
        </div>

        <textarea
          value={taskDraft}
          onChange={(e) => setTaskDraft(e.target.value)}
          onKeyDown={handleTaskKeyDown}
          onBlur={saveTaskIfChanged}
          disabled={isBusy}
          title={taskDraft}
          rows={2}
          style={{
            ...disabledTaskTextAreaStyle,
            background: "rgba(255,255,255,0.98)",
            border: "1px solid rgba(191,219,254,0.92)",
          }}
        />
      </div>

      <input
        value={amountDraft}
        onChange={(e) => setAmountDraft(e.target.value)}
        onKeyDown={handleAmountKeyDown}
        onBlur={saveAmountIfChanged}
        disabled={isBusy}
        title={amountDraft}
        style={{
          ...disabledInputStyle,
          background:
            "linear-gradient(180deg, rgba(236,253,245,0.92) 0%, rgba(255,255,255,0.98) 100%)",
          border: "1px solid rgba(134,239,172,0.36)",
          color: "#166534",
          fontWeight: 950,
          position: "relative",
          zIndex: 1,
        }}
      />

      <div
        style={{
          display: "grid",
          gap: 4,
          background:
            "linear-gradient(180deg, rgba(254,242,242,0.96) 0%, rgba(255,255,255,0.98) 100%)",
          border: `1px solid ${deadlineUi.borderColor}`,
          borderRadius: 16,
          padding: "10px 10px 8px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "22px 1fr",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            title={deadlineUi.label}
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              background: "rgba(255,255,255,0.82)",
              border: `1px solid ${deadlineUi.borderColor}`,
              color: deadlineUi.textColor,
              flexShrink: 0,
            }}
          >
            {deadlineUi.icon}
          </div>

          <input
            value={isEditingDeadline ? deadlineDraft : task.deadline || ""}
            onFocus={() => {
              if (isBusy) return;
              setDeadlineDraft(getEditableDeadlineValue(task));
              setIsEditingDeadline(true);
            }}
            onChange={(e) => setDeadlineDraft(e.target.value)}
            onKeyDown={handleDeadlineKeyDown}
            onBlur={() => {
              saveDeadlineIfChanged();
              setIsEditingDeadline(false);
            }}
            disabled={isBusy}
            title={isEditingDeadline ? deadlineDraft : task.deadline || ""}
            style={{
              ...disabledInputStyle,
              minHeight: 38,
              border: `1px solid ${deadlineUi.borderColor}`,
              background: "rgba(255,255,255,0.70)",
              color: isEditingDeadline ? "#0f172a" : deadlineUi.textColor,
              fontWeight: 950,
            }}
          />
        </div>

        <div
          style={{
            fontSize: 10.5,
            fontWeight: 950,
            color: deadlineUi.textColor,
            paddingLeft: 28,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: 0.95,
            lineHeight: 1.2,
          }}
          title={deadlineUi.label}
        >
          {deadlineUi.label}
        </div>
      </div>

      <select
        value={task.priority}
        onKeyDown={onEnterBlur}
        onChange={(e) => handlePriorityChange(e.target.value)}
        disabled={isBusy}
        style={{
          ...disabledInputStyle,
          background: visualTone.priorityBg,
          border: `1px solid ${visualTone.priorityBorder}`,
          color: visualTone.priorityText,
          fontWeight: 950,
          position: "relative",
          zIndex: 1,
        }}
      >
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>

      <select
        value={task.status}
        onKeyDown={onEnterBlur}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={isBusy}
        style={{
          ...disabledInputStyle,
          background: statusTone.bg,
          border: `1px solid ${statusTone.border}`,
          color: statusTone.text,
          fontWeight: 950,
          position: "relative",
          zIndex: 1,
        }}
      >
        <option value="New">New</option>
        <option value="In Progress">In Progress</option>
        <option value="Done">Done</option>
      </select>

      <div style={actionsCellStyle}>
        <button
          type="button"
          onClick={() => setIsDetailsOpen((current) => !current)}
          disabled={isBusy}
          style={{
            ...detailsToggleButtonStyle,
            color: isDetailsOpen ? "#ffffff" : visualTone.text,
            borderColor: isDetailsOpen
              ? "rgba(79,70,229,0.30)"
              : "rgba(199,210,254,0.82)",
            background: isDetailsOpen
              ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
              : "linear-gradient(180deg, rgba(238,242,255,0.96) 0%, rgba(255,255,255,0.98) 100%)",
            boxShadow: isDetailsOpen
              ? "0 8px 18px rgba(79,70,229,0.16)"
              : "0 3px 8px rgba(79,70,229,0.05)",
          }}
        >
          {isDetailsOpen ? "Hide details" : "Details"}
        </button>

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
      </div>

      {isDetailsOpen && (
        <div
          style={{
            ...detailsRowStyle,
            background:
              "linear-gradient(135deg, rgba(238,242,255,0.88) 0%, rgba(255,255,255,0.98) 48%, rgba(240,249,255,0.92) 100%)",
            border: "1px solid rgba(199,210,254,0.70)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.75), 0 4px 12px rgba(79,70,229,0.025)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={detailFieldStyle}>
            <span style={detailLabelStyle}>Phone</span>
            <input
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              onKeyDown={handlePhoneKeyDown}
              onBlur={savePhoneIfChanged}
              disabled={isBusy}
              placeholder="Phone"
              title={phoneDraft}
              style={detailInputStyle}
            />
          </div>

          <div style={detailFieldStyle}>
            <span style={detailLabelStyle}>Email</span>
            <input
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              onBlur={saveEmailIfChanged}
              disabled={isBusy}
              placeholder="Email"
              title={emailDraft}
              style={detailInputStyle}
            />
          </div>

          <div style={detailFieldWideStyle}>
            <span style={detailLabelStyle}>Notes</span>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onKeyDown={handleNotesKeyDown}
              onBlur={saveNotesIfChanged}
              disabled={isBusy}
              placeholder="Notes"
              title={notesDraft}
              rows={2}
              style={detailTextAreaStyle}
            />
          </div>
        </div>
      )}

      {(isSaving || isSaved || isDeleting) && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 14,
            fontSize: 10,
            fontWeight: 800,
            color: isDeleting ? "#b91c1c" : isSaved ? "#15803d" : "#475569",
            background: isDeleting
              ? "rgba(254,242,242,0.98)"
              : isSaved
                ? "rgba(240,253,244,0.98)"
                : "rgba(248,250,252,0.98)",
            border: `1px solid ${
              isDeleting
                ? "rgba(239,68,68,0.20)"
                : isSaved
                  ? "rgba(34,197,94,0.20)"
                  : "rgba(203,213,225,0.92)"
            }`,
            borderRadius: 999,
            padding: "4px 8px",
            pointerEvents: "none",
            boxShadow: isSaved
              ? "0 8px 16px rgba(34,197,94,0.08)"
              : "none",
            zIndex: 2,
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
  );
}

const mainTaskCellStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const clientLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const clientNameStyle: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 950,
  color: "#0f172a",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 185,
};

const createdMiniStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 10.5,
  fontWeight: 850,
  whiteSpace: "nowrap",
  borderRadius: 999,
  padding: "4px 8px",
};

const actionsCellStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  alignItems: "start",
  minHeight: 42,
  position: "relative",
  zIndex: 1,
};

const detailsToggleButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid rgba(199,210,254,0.82)",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const inputStyle: CSSProperties = {
  border: "1px solid rgba(203,213,225,0.95)",
  borderRadius: 12,
  padding: "8px 10px",
  width: "100%",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 12.5,
  outline: "none",
  minHeight: 40,
  boxShadow: "0 1px 4px rgba(15,23,42,0.025)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};

const taskTextAreaStyle: CSSProperties = {
  border: "1px solid rgba(203,213,225,0.95)",
  borderRadius: 12,
  padding: "9px 10px",
  width: "100%",
  minHeight: 54,
  maxHeight: 64,
  resize: "none",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 850,
  fontSize: 13,
  lineHeight: 1.35,
  outline: "none",
  boxShadow: "0 1px 4px rgba(15,23,42,0.025)",
  boxSizing: "border-box",
  overflow: "hidden",
};

const detailsRowStyle: CSSProperties = {
  gridColumn: "2 / -1",
  display: "grid",
  gridTemplateColumns:
    "minmax(160px, 0.72fr) minmax(240px, 1fr) minmax(360px, 2.25fr)",
  gap: 10,
  padding: "12px 12px",
  minWidth: 0,
  borderRadius: 18,
};

const detailFieldStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "50px 1fr",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const detailFieldWideStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "50px 1fr",
  alignItems: "start",
  gap: 8,
  minWidth: 0,
};

const detailLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  color: "#4338ca",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const detailInputStyle: CSSProperties = {
  border: "1px solid rgba(199,210,254,0.75)",
  borderRadius: 11,
  padding: "7px 9px",
  width: "100%",
  background: "rgba(255,255,255,0.98)",
  color: "#0f172a",
  fontWeight: 750,
  fontSize: 12,
  outline: "none",
  minHeight: 34,
  boxSizing: "border-box",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const detailTextAreaStyle: CSSProperties = {
  border: "1px solid rgba(199,210,254,0.75)",
  borderRadius: 11,
  padding: "8px 9px",
  width: "100%",
  minHeight: 40,
  maxHeight: 52,
  resize: "none",
  background: "rgba(255,255,255,0.98)",
  color: "#0f172a",
  fontWeight: 750,
  fontSize: 12,
  lineHeight: 1.34,
  outline: "none",
  boxSizing: "border-box",
  overflow: "hidden",
};