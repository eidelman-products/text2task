import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { TaskRow as TaskRowType } from "./tasks-view";
import TaskRowActions from "./task-row-actions";
import { getDeadlineUi } from "@/lib/tasks/get-deadline-ui";

type TaskRowProps = {
  task: TaskRowType;
  createdLabel: string;
  isSaving: boolean;
  isSaved: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  toggleSelect: (taskId: number) => void;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => void;
  copyTask: (taskId: number) => void;
  deleteTask: (taskId: number) => void;
};

function getClientDisplayName(task: TaskRowType) {
  return task.client?.name?.trim() || "Unassigned";
}

function getEditableDeadlineValue(task: TaskRowType) {
  return task.deadline_original_text?.trim() || task.deadline || "";
}

export default function TaskRow({
  task,
  createdLabel,
  isSaving,
  isSaved,
  isDeleting,
  isCopied,
  isSelected,
  toggleSelect,
  onEnterBlur,
  updateTaskField,
  updateTaskStatus,
  copyTask,
  deleteTask,
}: TaskRowProps) {
  const isDone = (task.status || "").trim().toLowerCase() === "done";
  const isBusy = isSaving || isDeleting;
  const clientDisplayName = getClientDisplayName(task);

  const [taskDraft, setTaskDraft] = useState(task.task);
  const [amountDraft, setAmountDraft] = useState(task.amount || "");
  const [deadlineDraft, setDeadlineDraft] = useState(
    getEditableDeadlineValue(task)
  );
  const [phoneDraft, setPhoneDraft] = useState(task.client?.phone || "");
  const [emailDraft, setEmailDraft] = useState(task.client?.email || "");
  const [notesDraft, setNotesDraft] = useState(task.client?.notes || "");
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);

  useEffect(() => {
    setTaskDraft(task.task);
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
    setPhoneDraft(task.client?.phone || "");
  }, [task.client?.phone]);

  useEffect(() => {
    setEmailDraft(task.client?.email || "");
  }, [task.client?.email]);

  useEffect(() => {
    setNotesDraft(task.client?.notes || "");
  }, [task.client?.notes]);

  const deadlineUi = useMemo(
    () =>
      getDeadlineUi(
        getEditableDeadlineValue(task),
        task.deadline_date || null,
        task.status || null
      ),
    [task]
  );

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
    const currentValue = (task.client?.phone || "").trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "phone", nextValue === "" ? null : nextValue);
  }

  function saveEmailIfChanged() {
    if (isBusy) return;

    const nextValue = emailDraft.trim();
    const currentValue = (task.client?.email || "").trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "email", nextValue === "" ? null : nextValue);
  }

  function saveNotesIfChanged() {
    if (isBusy) return;

    const nextValue = notesDraft.trim();
    const currentValue = (task.client?.notes || "").trim();

    if (nextValue === currentValue) return;
    updateTaskField(task.id, "notes", nextValue === "" ? null : nextValue);
  }

  function handleTaskKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      saveTaskIfChanged();
      onEnterBlur(e);
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

  function handleNotesKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      saveNotesIfChanged();
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

  const rowBackground = isSaved
    ? "linear-gradient(90deg, rgba(34,197,94,0.13) 0%, rgba(255,255,255,1) 68%)"
    : isSelected
    ? "rgba(59,130,246,0.05)"
    : isDone
    ? "rgba(34,197,94,0.06)"
    : "#ffffff";

  const rowBorderLeft = isSaved
    ? "3px solid #16a34a"
    : isDone
    ? "3px solid #22c55e"
    : "3px solid transparent";

  const disabledInputStyle = isBusy
    ? {
        ...inputStyle,
        cursor: "not-allowed",
        opacity: 0.7,
        background: "rgba(248,250,252,0.95)",
      }
    : inputStyle;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns:
          "42px 1.05fr 1.65fr 0.85fr 1.35fr 1fr 1.15fr 1.45fr 0.7fr 0.85fr 0.85fr 1.05fr",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(226,232,240,0.82)",
        alignItems: "center",
        gap: 8,
        opacity: isDeleting ? 0.55 : 1,
        background: rowBackground,
        borderLeft: rowBorderLeft,
        boxShadow: isSaved
          ? "inset 0 0 0 1px rgba(34,197,94,0.10), 0 8px 18px rgba(34,197,94,0.06)"
          : "none",
        transform: isSaved ? "translateY(-1px)" : "translateY(0)",
        transition:
          "background 0.28s ease, box-shadow 0.28s ease, transform 0.28s ease, opacity 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
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
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            flexShrink: 0,
            background: isDone
              ? "#22c55e"
              : "linear-gradient(180deg, #f59e0b 0%, #fb7185 100%)",
            boxShadow: isDone
              ? "0 0 0 4px rgba(34,197,94,0.12)"
              : "0 0 0 4px rgba(245,158,11,0.10)",
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={clientDisplayName}
        >
          {clientDisplayName}
        </span>
      </div>

      <input
        value={taskDraft}
        onChange={(e) => setTaskDraft(e.target.value)}
        onKeyDown={handleTaskKeyDown}
        onBlur={saveTaskIfChanged}
        disabled={isBusy}
        style={disabledInputStyle}
      />

      <input
        value={amountDraft}
        onChange={(e) => setAmountDraft(e.target.value)}
        onKeyDown={handleAmountKeyDown}
        onBlur={saveAmountIfChanged}
        disabled={isBusy}
        style={disabledInputStyle}
      />

      <div style={{ display: "grid", gap: 4 }}>
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
              background: deadlineUi.backgroundColor,
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
            style={{
              ...disabledInputStyle,
              border: `1px solid ${deadlineUi.borderColor}`,
              background: isBusy
                ? "rgba(248,250,252,0.95)"
                : deadlineUi.backgroundColor,
              color: isEditingDeadline ? "#0f172a" : deadlineUi.textColor,
            }}
          />
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: deadlineUi.textColor,
            paddingLeft: 26,
            whiteSpace: "nowrap",
            opacity: 0.84,
            lineHeight: 1.2,
          }}
        >
          {deadlineUi.label}
        </div>
      </div>

      <input
        value={phoneDraft}
        onChange={(e) => setPhoneDraft(e.target.value)}
        onKeyDown={handlePhoneKeyDown}
        onBlur={savePhoneIfChanged}
        disabled={isBusy}
        placeholder="Phone"
        style={disabledInputStyle}
      />

      <input
        value={emailDraft}
        onChange={(e) => setEmailDraft(e.target.value)}
        onKeyDown={handleEmailKeyDown}
        onBlur={saveEmailIfChanged}
        disabled={isBusy}
        placeholder="Email"
        style={disabledInputStyle}
      />

      <input
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        onKeyDown={handleNotesKeyDown}
        onBlur={saveNotesIfChanged}
        disabled={isBusy}
        placeholder="Notes"
        style={disabledInputStyle}
      />

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#475569",
          whiteSpace: "nowrap",
        }}
      >
        {createdLabel}
      </div>

      <select
        value={task.priority}
        onKeyDown={onEnterBlur}
        onChange={(e) => handlePriorityChange(e.target.value)}
        disabled={isBusy}
        style={disabledInputStyle}
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
        style={disabledInputStyle}
      >
        <option value="New">New</option>
        <option value="In Progress">In Progress</option>
        <option value="Done">Done</option>
      </select>

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
            position: "absolute",
            top: 6,
            right: 10,
            fontSize: 10,
            fontWeight: 800,
            color: isDeleting ? "#b91c1c" : isSaved ? "#15803d" : "#64748b",
            background: isDeleting
              ? "rgba(254,242,242,0.96)"
              : isSaved
              ? "rgba(240,253,244,0.95)"
              : "rgba(248,250,252,0.95)",
            border: `1px solid ${
              isDeleting
                ? "rgba(239,68,68,0.18)"
                : isSaved
                ? "rgba(34,197,94,0.18)"
                : "rgba(203,213,225,0.9)"
            }`,
            borderRadius: 999,
            padding: "4px 8px",
            pointerEvents: "none",
            boxShadow: isSaved
              ? "0 8px 16px rgba(34,197,94,0.08)"
              : "none",
          }}
        >
          {isDeleting ? "Deleting..." : isSaved ? "Saved" : "Saving..."}
        </div>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid rgba(203,213,225,0.95)",
  borderRadius: 10,
  padding: "7px 10px",
  width: "100%",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 13,
  outline: "none",
  minHeight: 34,
  boxShadow: "0 1px 4px rgba(15,23,42,0.025)",
};