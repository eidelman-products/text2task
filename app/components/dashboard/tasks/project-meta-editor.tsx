import type { CSSProperties, KeyboardEvent } from "react";
import type { TaskProjectGroup } from "./task-types";

type ProjectMetaEditorProps = {
  project: TaskProjectGroup;
  isDeleting: boolean;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  updateProjectField: (
    projectId: string,
    field: string,
    value: any
  ) => Promise<void> | void;
};

export default function ProjectMetaEditor({
  project,
  isDeleting,
  onEnterBlur,
  updateProjectField,
}: ProjectMetaEditorProps) {
  const projectId = project.project_id || project.project?.id || "";
  const canEditProject = Boolean(projectId) && !isDeleting;

  const amount = project.amount || "";
  const deadline = formatDeadlineDisplay(
    project.deadline_date,
    project.deadline,
    project.deadline_original_text
  );

  function commitProjectField(
    field: "amount" | "deadline",
    currentValue: string,
    nextValue: string
  ) {
    if (!projectId) return;

    const cleanCurrent = String(currentValue || "").trim();
    const cleanNext = String(nextValue || "").trim();

    if (cleanCurrent === cleanNext) return;

    updateProjectField(projectId, field, cleanNext);
  }

  function updateProjectPriority(priority: string) {
    if (!projectId) return;
    updateProjectField(projectId, "priority", priority);
  }

  function updateProjectStatus(status: string) {
    if (!projectId) return;
    updateProjectField(projectId, "status", status);
  }

  return (
    <div style={metaGridStyle}>
      <EditableMetaTextField
        label="Amount"
        placeholder="480 USD"
        defaultValue={amount}
        disabled={!canEditProject}
        onEnterBlur={onEnterBlur}
        onCommit={(nextValue) => commitProjectField("amount", amount, nextValue)}
      />

      <EditableMetaTextField
        label="Deadline"
        placeholder="May 15, 2026"
        defaultValue={deadline}
        variant="deadline"
        disabled={!canEditProject}
        onEnterBlur={onEnterBlur}
        onCommit={(nextValue) =>
          commitProjectField("deadline", deadline, nextValue)
        }
      />

      <label style={metaFieldStyle}>
        <span style={metaLabelStyle}>Priority</span>
        <select
          value={project.priority || "Medium"}
          onChange={(e) => updateProjectPriority(e.target.value)}
          onKeyDown={onEnterBlur}
          disabled={!canEditProject}
          style={{
            ...selectStyle,
            ...getPrioritySelectStyle(project.priority),
          }}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </label>

      <label style={metaFieldStyle}>
        <span style={metaLabelStyle}>Status</span>
        <select
          value={project.status || "New"}
          onChange={(e) => updateProjectStatus(e.target.value)}
          onKeyDown={onEnterBlur}
          disabled={!canEditProject}
          style={{
            ...selectStyle,
            ...getStatusSelectStyle(project.status),
          }}
        >
          <option value="New">New</option>
          <option value="In Progress">In Progress</option>
          <option value="Review">Review</option>
          <option value="Urgent">Urgent</option>
          <option value="Done">Done</option>
        </select>
      </label>
    </div>
  );
}

function formatDeadlineDisplay(
  deadlineDate?: string | null,
  formattedDeadline?: string | null,
  originalText?: string | null
) {
  if (deadlineDate) {
    const parsed = new Date(deadlineDate);

    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }
  }

  return formattedDeadline || originalText || "";
}

function EditableMetaTextField({
  label,
  placeholder,
  defaultValue,
  variant,
  disabled,
  onEnterBlur,
  onCommit,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  variant?: "deadline";
  disabled: boolean;
  onEnterBlur: (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onCommit: (value: string) => void;
}) {
  const isDeadline = variant === "deadline";

  return (
    <label
      style={{
        ...metaFieldStyle,
        ...(isDeadline ? deadlineFieldStyle : {}),
      }}
    >
      <span style={metaLabelStyle}>{label}</span>

      <input
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={onEnterBlur}
        className="project-meta-editor-input"
        style={{
          ...inputStyle,
          ...(isDeadline ? deadlineInputStyle : {}),
        }}
      />
    </label>
  );
}

function getPrioritySelectStyle(priorityValue: string) {
  const priority = String(priorityValue || "").trim().toLowerCase();

  if (priority === "high") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.64)",
      borderColor: "rgba(253,164,175,0.52)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(226,232,240,0.62)",
  };
}

function getStatusSelectStyle(statusValue: string) {
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
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(226,232,240,0.62)",
  };
}

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(104px, 1fr))",
  gap: 0,
  minWidth: 0,
  borderRadius: 18,
  background: "rgba(255,255,255,0.28)",
  overflow: "hidden",
};

const metaFieldStyle: CSSProperties = {
  minHeight: 58,
  display: "grid",
  alignContent: "center",
  gap: 5,
  padding: "9px 10px",
  minWidth: 0,
  borderRight: "1px solid rgba(226,232,240,0.28)",
};

const deadlineFieldStyle: CSSProperties = {
  minWidth: 116,
};

const metaLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  color: "#98a2b3",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.56)",
  background: "rgba(255,255,255,0.58)",
  color: "#344054",
  fontSize: 12,
  fontWeight: 900,
  padding: "0 9px",
  outline: "none",
  boxShadow: "none",
};

const deadlineInputStyle: CSSProperties = {
  minWidth: 100,
};

const selectStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.56)",
  background: "rgba(255,255,255,0.58)",
  color: "#344054",
  fontSize: 12,
  fontWeight: 900,
  padding: "0 9px",
  outline: "none",
};
