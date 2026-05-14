import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import TaskRowActions from "../task-row-actions";
import type {
  TaskArchiveView,
  TaskProjectGroup,
  TaskProjectSubtask,
} from "./task-types";
import { formatCreatedDate } from "./task-utils";

type MobileTaskCardProps = {
  project: TaskProjectGroup;
  isSaving: boolean;
  isSaved: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  isPartiallySelected: boolean;
  archiveView: TaskArchiveView;
  onToggleProjectSelection: (project: TaskProjectGroup) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  copyTask: (taskId: number) => void;
  archiveProject: (project: TaskProjectGroup) => Promise<void> | void;
  restoreProject: (project: TaskProjectGroup) => Promise<void> | void;
  permanentlyDeleteProject: (project: TaskProjectGroup) => Promise<void> | void;
};

export default function MobileTaskCard({
  project,
  isSaving,
  isSaved,
  isDeleting,
  isCopied,
  isSelected,
  isPartiallySelected,
  archiveView,
  onToggleProjectSelection,
  updateTaskField,
  updateTaskStatus,
  copyTask,
  archiveProject,
  restoreProject,
  permanentlyDeleteProject,
}: MobileTaskCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isBusy = isSaving || isDeleting;
  const actionMode =
    archiveView === "archived" || project.is_archived ? "archived" : "active";

  const projectState = getProjectVisualState(project);
  const deadlineStyle = getDeadlineStyle(project);
  const statusStyle = getStatusStyle(project.status);
  const completedPercent =
    project.subtaskCount > 0
      ? Math.round(
          (project.completedSubtaskCount / project.subtaskCount) * 100
        )
      : 0;

  async function updateProjectStatus(status: string) {
    for (const task of project.tasks) {
      await updateTaskStatus(task.id, status);
    }
  }

  function updateProjectPriority(priority: string) {
    for (const task of project.tasks) {
      updateTaskField(task.id, "priority", priority);
    }
  }

  function handleTextareaEnter(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  return (
    <article
      style={{
        ...mobileCardStyle,
        borderColor: projectState.border,
        background: projectState.background,
        boxShadow: projectState.shadow,
        opacity: isDeleting ? 0.62 : 1,
      }}
    >
      <div
        style={{
          ...mobileAccentStyle,
          background: projectState.accent,
        }}
      />

      <div style={mobileCardTopStyle}>
        <label style={mobileCheckboxWrapStyle}>
          <input
            type="checkbox"
            checked={isSelected}
            ref={(node) => {
              if (node) node.indeterminate = isPartiallySelected;
            }}
            onChange={() => onToggleProjectSelection(project)}
            disabled={isBusy}
            style={mobileCheckboxStyle}
          />
        </label>

        <div style={mobileIdentityStyle}>
          <div style={mobileClientRowStyle}>
            <span
              style={{
                ...mobileAvatarStyle,
                background: projectState.avatarBackground,
                color: projectState.avatarText,
                borderColor: projectState.avatarBorder,
              }}
            >
              {getClientInitial(project.clientName)}
            </span>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  ...mobileClientStyle,
                  color: projectState.clientColor,
                }}
              >
                {project.clientName}
              </div>

              {project.contactName || project.contact_name ? (
                <div style={mobileContactInlineStyle}>
                  Contact: {project.contactName || project.contact_name}
                </div>
              ) : null}

              <div style={mobileCreatedStyle}>
                Created {formatCreatedDate(project.created_at)}
              </div>
            </div>
          </div>
        </div>

        {projectState.label ? (
          <span
            style={{
              ...mobileStatePillStyle,
              color: projectState.labelColor,
              background: projectState.labelBackground,
              borderColor: projectState.labelBorder,
            }}
          >
            {projectState.label}
          </span>
        ) : null}
      </div>

      <div style={projectTitleBlockStyle}>
        <div style={projectTitleStyle}>{project.projectTitle}</div>
        <div style={projectSummaryStyle}>{project.projectSummary}</div>
      </div>

      <div style={mobileMetricsGridStyle}>
        <MobileMetric label="Amount" value={project.amount || "—"} />

        <MobileMetric
          label="Deadline"
          value={project.deadline || "—"}
          customValueStyle={deadlineStyle}
        />
      </div>

      <div style={mobileMetricsGridStyle}>
        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Priority</label>
          <select
            value={project.priority || "Medium"}
            onChange={(e) => updateProjectPriority(e.target.value)}
            disabled={isBusy}
            style={{
              ...mobileInputStyle,
              ...getPrioritySelectStyle(project.priority),
            }}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Status</label>
          <select
            value={project.status || "New"}
            onChange={(e) => updateProjectStatus(e.target.value)}
            disabled={isBusy}
            style={{
              ...mobileInputStyle,
              color: statusStyle.color,
              background: statusStyle.background,
              borderColor: statusStyle.borderColor,
            }}
          >
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Review">Review</option>
            <option value="Urgent">Urgent</option>
            <option value="Done">Done</option>
          </select>
        </div>
      </div>

      {projectState.kind === "done" ? (
        <div style={doneProgressWrapStyle}>
          <div style={doneProgressTopStyle}>
            <span>Completed project</span>
            <span>
              {project.completedSubtaskCount}/{project.subtaskCount} done
            </span>
          </div>

          <div style={doneProgressTrackStyle}>
            <div
              style={{
                ...doneProgressFillStyle,
                width: `${completedPercent}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          ...mobileDetailsButtonStyle,
          borderColor: isOpen
            ? "rgba(99,102,241,0.34)"
            : "rgba(203,213,225,0.72)",
          background: isOpen ? "rgba(238,242,255,0.82)" : "rgba(255,255,255,0.76)",
          color: isOpen ? "#4338ca" : "#334155",
        }}
      >
        <span>{isOpen ? "Hide details" : "Open details"}</span>
        <span style={mobileDetailsCountStyle}>
          {project.subtaskCount} {project.subtaskCount === 1 ? "task" : "tasks"}
        </span>
      </button>

      {isOpen && (
        <div style={mobileDetailsPanelStyle}>
          <div style={mobileDetailSectionStyle}>
            <div style={mobileDetailHeaderStyle}>
              <div>
                <div style={mobileDetailTitleStyle}>Subtasks</div>
                <div style={mobileDetailSubtitleStyle}>
                  {project.completedSubtaskCount} of {project.subtaskCount}{" "}
                  completed
                </div>
              </div>

              <span style={mobileMiniPillStyle}>
                {project.subtaskCount}{" "}
                {project.subtaskCount === 1 ? "item" : "items"}
              </span>
            </div>

            <div style={mobileSubtaskListStyle}>
              {project.subtasks.map((subtask, index) => (
                <MobileSubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  index={index}
                  isBusy={isBusy}
                  onTextareaEnter={handleTextareaEnter}
                  updateTaskField={updateTaskField}
                  updateTaskStatus={updateTaskStatus}
                />
              ))}
            </div>
          </div>

          <div style={mobileDetailSectionStyle}>
            <div style={mobileDetailHeaderStyle}>
              <div>
                <div style={mobileDetailTitleStyle}>Client details</div>
                <div style={mobileDetailSubtitleStyle}>
                  Contact and project notes
                </div>
              </div>
            </div>

            <div style={mobileMetaGridStyle}>
              <MetaLine
                label="Contact person"
                value={project.contactName || project.contact_name}
              />
              <MetaLine label="Phone" value={project.client_phone} />
              <MetaLine label="Email" value={project.client_email} />
              <MetaLine label="Notes" value={project.client_notes} />

              {!project.hasContactDetails && (
                <div style={mobileEmptyDetailsStyle}>
                  No contact details saved for this project.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={mobileActionsRowStyle}>
        <TaskRowActions
          taskId={project.primaryTask.id}
          isDeleting={isBusy}
          isCopied={isCopied}
          actionMode={actionMode}
          onCopy={copyTask}
          onArchive={() => archiveProject(project)}
          onRestore={() => restoreProject(project)}
          onPermanentDelete={() => permanentlyDeleteProject(project)}
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

function MobileSubtaskRow({
  subtask,
  index,
  isBusy,
  onTextareaEnter,
  updateTaskField,
  updateTaskStatus,
}: {
  subtask: TaskProjectSubtask;
  index: number;
  isBusy: boolean;
  onTextareaEnter: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
}) {
  const isDone =
    String(subtask.status || "").trim().toLowerCase() === "done" ||
    Boolean(subtask.completed_at);

  return (
    <div
      style={{
        ...mobileSubtaskRowStyle,
        background: isDone ? "rgba(240,253,244,0.64)" : "rgba(255,255,255,0.8)",
        borderColor: isDone
          ? "rgba(187,247,208,0.72)"
          : "rgba(226,232,240,0.72)",
      }}
    >
      <div style={mobileSubtaskTopLineStyle}>
        <span
          style={{
            ...mobileSubtaskIndexStyle,
            color: isDone ? "#067647" : "#64748b",
            background: isDone
              ? "rgba(220,252,231,0.72)"
              : "rgba(248,250,252,0.88)",
            borderColor: isDone
              ? "rgba(187,247,208,0.72)"
              : "rgba(226,232,240,0.8)",
          }}
        >
          {isDone ? "✓" : index + 1}
        </span>

        <textarea
          defaultValue={subtask.title}
          rows={2}
          onBlur={(e) => {
            const next = e.currentTarget.value.trim();

            if (next && next !== subtask.title) {
              updateTaskField(subtask.id, "task", next);
            }
          }}
          onKeyDown={onTextareaEnter}
          disabled={isBusy}
          style={{
            ...mobileSubtaskTextareaStyle,
            color: isDone ? "#475467" : "#0f172a",
            background: isDone ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.86)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        />
      </div>

      <div style={mobileSubtaskStatusRowStyle}>
        <span style={mobileSubtaskStatusLabelStyle}>Status</span>

        <select
          value={subtask.status || "New"}
          onChange={(e) => updateTaskStatus(subtask.id, e.target.value)}
          disabled={isBusy}
          style={{
            ...mobileSubtaskStatusStyle,
            ...getSubtaskStatusStyle(subtask.status),
          }}
        >
          <option value="New">New</option>
          <option value="In Progress">In Progress</option>
          <option value="Review">Review</option>
          <option value="Urgent">Urgent</option>
          <option value="Done">Done</option>
        </select>
      </div>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  customValueStyle,
}: {
  label: string;
  value: string;
  customValueStyle?: CSSProperties;
}) {
  return (
    <div style={mobileFieldStackStyle}>
      <label style={mobileFieldLabelStyle}>{label}</label>
      <div
        style={{
          ...mobileMetricValueStyle,
          ...(customValueStyle || {}),
        }}
      >
        {value}
      </div>
    </div>
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

function getClientInitial(clientName: string) {
  return (clientName || "U").trim().charAt(0).toUpperCase();
}

function getProjectVisualState(project: TaskProjectGroup) {
  const status = String(project.status || "").trim().toLowerCase();
  const priority = String(project.priority || "").trim().toLowerCase();
  const deadlineState = getDeadlineState(project);

  if (status === "done") {
    return {
      kind: "done",
      accent: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
      background:
        "linear-gradient(180deg, rgba(240,253,244,0.9) 0%, rgba(255,255,255,0.88) 72%)",
      border: "rgba(187,247,208,0.76)",
      shadow:
        "0 18px 42px rgba(22,163,74,0.08), 0 8px 20px rgba(15,23,42,0.035)",
      avatarBackground: "rgba(220,252,231,0.74)",
      avatarText: "#067647",
      avatarBorder: "rgba(187,247,208,0.72)",
      clientColor: "#067647",
      label: "Done",
      labelColor: "#067647",
      labelBackground: "rgba(240,253,244,0.84)",
      labelBorder: "rgba(187,247,208,0.76)",
    };
  }

  if (deadlineState === "overdue") {
    return {
      kind: "overdue",
      accent: "linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)",
      background:
        "linear-gradient(180deg, rgba(255,241,242,0.82) 0%, rgba(255,255,255,0.9) 78%)",
      border: "rgba(253,164,175,0.74)",
      shadow:
        "0 18px 42px rgba(225,29,72,0.075), 0 8px 20px rgba(15,23,42,0.035)",
      avatarBackground: "rgba(255,228,230,0.74)",
      avatarText: "#be123c",
      avatarBorder: "rgba(253,164,175,0.72)",
      clientColor: "#be123c",
      label: "Overdue",
      labelColor: "#be123c",
      labelBackground: "rgba(255,241,242,0.86)",
      labelBorder: "rgba(253,164,175,0.76)",
    };
  }

  if (priority === "high" || status === "urgent") {
    return {
      kind: "high",
      accent: "linear-gradient(180deg, #fb7185 0%, #f43f5e 100%)",
      background:
        "linear-gradient(180deg, rgba(255,241,242,0.62) 0%, rgba(255,255,255,0.9) 82%)",
      border: "rgba(253,164,175,0.64)",
      shadow:
        "0 16px 38px rgba(225,29,72,0.055), 0 8px 20px rgba(15,23,42,0.03)",
      avatarBackground: "rgba(255,228,230,0.72)",
      avatarText: "#be123c",
      avatarBorder: "rgba(253,164,175,0.66)",
      clientColor: "#be123c",
      label: "High",
      labelColor: "#be123c",
      labelBackground: "rgba(255,241,242,0.82)",
      labelBorder: "rgba(253,164,175,0.7)",
    };
  }

  return {
    kind: "default",
    accent: "linear-gradient(180deg, #6366f1 0%, #a5b4fc 100%)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.88) 100%)",
    border: "rgba(226,232,240,0.78)",
    shadow:
      "0 16px 38px rgba(15,23,42,0.045), 0 4px 12px rgba(15,23,42,0.025)",
    avatarBackground: "rgba(238,242,255,0.72)",
    avatarText: "#4338ca",
    avatarBorder: "rgba(199,210,254,0.68)",
    clientColor: "#334155",
    label: "",
    labelColor: "#475467",
    labelBackground: "rgba(248,250,252,0.82)",
    labelBorder: "rgba(226,232,240,0.74)",
  };
}

function getDeadlineStyle(project: TaskProjectGroup): CSSProperties {
  const status = String(project.status || "").trim().toLowerCase();
  const state = getDeadlineState(project);

  if (status === "done") {
    return {
      color: "#067647",
      background: "rgba(255,255,255,0.62)",
      borderColor: "rgba(187,247,208,0.56)",
    };
  }

  if (state === "overdue") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.78)",
      borderColor: "rgba(253,164,175,0.66)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(226,232,240,0.62)",
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

function getStatusStyle(statusValue: string) {
  const status = String(statusValue || "").trim().toLowerCase();

  if (status === "done") {
    return {
      color: "#067647",
      background: "rgba(240,253,244,0.78)",
      borderColor: "rgba(187,247,208,0.72)",
    };
  }

  if (status === "urgent") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.78)",
      borderColor: "rgba(253,164,175,0.72)",
    };
  }

  if (status === "review") {
    return {
      color: "#6d28d9",
      background: "rgba(245,243,255,0.78)",
      borderColor: "rgba(221,214,254,0.72)",
    };
  }

  if (status === "in progress" || status === "in-progress") {
    return {
      color: "#1d4ed8",
      background: "rgba(239,246,255,0.78)",
      borderColor: "rgba(191,219,254,0.72)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(226,232,240,0.62)",
  };
}

function getPrioritySelectStyle(priorityValue: string) {
  const priority = String(priorityValue || "").trim().toLowerCase();

  if (priority === "high") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.76)",
      borderColor: "rgba(253,164,175,0.68)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(226,232,240,0.62)",
  };
}

function getSubtaskStatusStyle(statusValue: string) {
  const status = String(statusValue || "").trim().toLowerCase();

  if (status === "done") {
    return {
      color: "#067647",
      background: "rgba(240,253,244,0.78)",
      borderColor: "rgba(187,247,208,0.72)",
    };
  }

  if (status === "urgent") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.78)",
      borderColor: "rgba(253,164,175,0.72)",
    };
  }

  if (status === "review") {
    return {
      color: "#6d28d9",
      background: "rgba(245,243,255,0.78)",
      borderColor: "rgba(221,214,254,0.72)",
    };
  }

  if (status === "in progress" || status === "in-progress") {
    return {
      color: "#1d4ed8",
      background: "rgba(239,246,255,0.78)",
      borderColor: "rgba(191,219,254,0.72)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(255,255,255,0.62)",
    borderColor: "rgba(226,232,240,0.62)",
  };
}

const mobileCardStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 24,
  border: "1px solid rgba(226,232,240,0.78)",
  padding: 16,
  display: "grid",
  gap: 14,
  transition:
    "border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
};

const mobileAccentStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 18,
  bottom: 18,
  width: 3,
  borderRadius: "0 999px 999px 0",
};

const mobileCardTopStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0,1fr) auto",
  alignItems: "flex-start",
  gap: 10,
  minWidth: 0,
};

const mobileCheckboxWrapStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(203,213,225,0.82)",
  background: "rgba(255,255,255,0.72)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const mobileCheckboxStyle: CSSProperties = {
  width: 17,
  height: 17,
  cursor: "pointer",
};

const mobileIdentityStyle: CSSProperties = {
  minWidth: 0,
};

const mobileClientRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  minWidth: 0,
};

const mobileAvatarStyle: CSSProperties = {
  width: 29,
  height: 29,
  borderRadius: 11,
  border: "1px solid rgba(199,210,254,0.68)",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 950,
  flexShrink: 0,
};

const mobileClientStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 950,
  lineHeight: 1.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mobileContactInlineStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  fontWeight: 760,
  color: "#667085",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mobileCreatedStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 10,
  fontWeight: 820,
  color: "#98a2b3",
};

const mobileStatePillStyle: CSSProperties = {
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.78)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const projectTitleBlockStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const projectTitleStyle: CSSProperties = {
  fontSize: 19,
  lineHeight: 1.18,
  fontWeight: 950,
  color: "#101828",
  letterSpacing: "-0.035em",
};

const projectSummaryStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 720,
  color: "#667085",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const mobileMetricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const mobileFieldStackStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const mobileFieldLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#667085",
};

const mobileMetricValueStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.62)",
  background: "rgba(255,255,255,0.62)",
  color: "#344054",
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  fontSize: 15,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const mobileInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.62)",
  background: "rgba(255,255,255,0.62)",
  color: "#344054",
  padding: "0 12px",
  fontSize: 14,
  fontWeight: 900,
  outline: "none",
};

const doneProgressWrapStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: "9px 10px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.54)",
  border: "1px solid rgba(187,247,208,0.52)",
};

const doneProgressTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#15803d",
  fontSize: 11,
  fontWeight: 900,
};

const doneProgressTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: "rgba(187,247,208,0.46)",
  overflow: "hidden",
};

const doneProgressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #22c55e, #16a34a)",
};

const mobileDetailsButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 15,
  border: "1px solid rgba(203,213,225,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 13px",
  fontSize: 13,
  fontWeight: 920,
  cursor: "pointer",
};

const mobileDetailsCountStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const mobileDetailsPanelStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const mobileDetailSectionStyle: CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(226,232,240,0.58)",
  background: "rgba(255,255,255,0.58)",
  padding: 12,
  display: "grid",
  gap: 11,
};

const mobileDetailHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const mobileDetailTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 950,
  color: "#344054",
};

const mobileDetailSubtitleStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  fontWeight: 760,
  color: "#98a2b3",
};

const mobileMiniPillStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(248,250,252,0.76)",
  color: "#667085",
  fontSize: 10,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const mobileSubtaskListStyle: CSSProperties = {
  display: "grid",
  gap: 9,
};

const mobileSubtaskRowStyle: CSSProperties = {
  borderRadius: 17,
  border: "1px solid rgba(226,232,240,0.72)",
  padding: 10,
  display: "grid",
  gap: 10,
};

const mobileSubtaskTopLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px minmax(0,1fr)",
  gap: 9,
  alignItems: "flex-start",
};

const mobileSubtaskIndexStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 9,
  border: "1px solid rgba(226,232,240,0.8)",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 950,
};

const mobileSubtaskTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  resize: "vertical",
  borderRadius: 12,
  border: "1px solid rgba(226,232,240,0.62)",
  padding: "8px 10px",
  outline: "none",
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 820,
};

const mobileSubtaskStatusRowStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const mobileSubtaskStatusLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#98a2b3",
};

const mobileSubtaskStatusStyle: CSSProperties = {
  width: "100%",
  minHeight: 38,
  borderRadius: 13,
  border: "1px solid rgba(226,232,240,0.62)",
  padding: "0 10px",
  outline: "none",
  fontSize: 13,
  fontWeight: 900,
};

const mobileMetaGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const mobileMetaLineStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "10px 11px",
  borderRadius: 14,
  background: "rgba(248,250,252,0.66)",
  border: "1px solid rgba(226,232,240,0.42)",
};

const mobileMetaLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#98a2b3",
};

const mobileMetaValueStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 780,
  color: "#344054",
  wordBreak: "break-word",
};

const mobileEmptyDetailsStyle: CSSProperties = {
  padding: 11,
  borderRadius: 14,
  background: "rgba(248,250,252,0.66)",
  color: "#667085",
  fontSize: 13,
  fontWeight: 760,
};

const mobileActionsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};