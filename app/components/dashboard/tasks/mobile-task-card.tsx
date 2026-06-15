import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type {
  TaskArchiveView,
  TaskProjectGroup,
  TaskProjectSubtask,
} from "./task-types";
import { formatCreatedDate } from "./task-utils";

type MobileTaskCardProps = {
  project: TaskProjectGroup;
  projectId: string | null;
  isSaving: boolean;
  isSaved: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  isPartiallySelected: boolean;
  archiveView: TaskArchiveView;
  projectResourceCount?: number;
  onOpenProjectResources?: (project: TaskProjectGroup) => void;
  onOpenProjectUpdate?: (project: TaskProjectGroup) => void;
  onOpenProjectHistory?: (project: TaskProjectGroup) => void;
  onToggleProjectSelection: (project: TaskProjectGroup) => void;
  updateTaskField: (taskId: number, field: string, value: any) => void;
  updateTaskStatus: (taskId: number, status: string) => Promise<void> | void;
  updateProjectField: (
    projectId: string,
    field: string,
    value: any
  ) => Promise<void> | void;
  copyTask: (taskId: number) => void;
};

export default function MobileTaskCard({
  project,
  projectId,
  isSaving,
  isSaved,
  isDeleting,
  isSelected,
  isPartiallySelected,
  archiveView,
  projectResourceCount = 0,
  onOpenProjectResources,
  onOpenProjectUpdate,
  onOpenProjectHistory,
  onToggleProjectSelection,
  updateTaskField,
  updateTaskStatus,
  updateProjectField,
}: MobileTaskCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isBusy = isSaving || isDeleting;
  const actionMode =
    archiveView === "archived" || project.is_archived ? "archived" : "active";
  const archivedDate = formatArchivedDate(project.archived_at);

  const projectState = getProjectVisualState(project);
  const deadlineStyle = getDeadlineStyle(project);
  const statusStyle = getStatusStyle(project.status);
  const completedPercent =
    project.subtaskCount > 0
      ? Math.round(
          (project.completedSubtaskCount / project.subtaskCount) * 100
        )
      : 0;

  function updateProjectStatus(status: string) {
    if (!projectId) return;
    updateProjectField(projectId, "status", status);
  }

  function updateProjectPriority(priority: string) {
    if (!projectId) return;
    updateProjectField(projectId, "priority", priority);
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
                {formatCreatedDate(project.created_at)}
              </div>

              {actionMode === "archived" ? (
                <div style={mobileArchivedIndicatorStyle}>
                  Archived project
                  {archivedDate ? ` · Archived ${archivedDate}` : ""}
                </div>
              ) : null}
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
          {actionMode === "archived" ? (
            <div style={mobileReadOnlyMetaStyle}>
              {project.priority || "Medium"}
            </div>
          ) : (
            <select
              value={project.priority || "Medium"}
              onChange={(e) => updateProjectPriority(e.target.value)}
              disabled={isBusy || !projectId}
              style={{
                ...mobileInputStyle,
                ...getPrioritySelectStyle(project.priority),
              }}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          )}
        </div>

        <div style={mobileFieldStackStyle}>
          <label style={mobileFieldLabelStyle}>Status</label>
          {actionMode === "archived" ? (
            <div style={mobileReadOnlyMetaStyle}>{project.status || "New"}</div>
          ) : (
            <select
              value={project.status || "New"}
              onChange={(e) => updateProjectStatus(e.target.value)}
              disabled={isBusy || !projectId}
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
          )}
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

      {onOpenProjectResources ||
      onOpenProjectHistory ||
      (actionMode !== "archived" && onOpenProjectUpdate && !isDeleting) ? (
        <div style={mobileProjectActionsStyle}>
          {onOpenProjectResources ? (
            <button
              type="button"
              onClick={() => onOpenProjectResources(project)}
              disabled={isDeleting}
              style={mobileSharedActionButtonStyle}
            >
              Resources
              {projectResourceCount > 0 ? (
                <span style={mobileResourceCountStyle}>
                  {projectResourceCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {actionMode !== "archived" &&
          onOpenProjectUpdate &&
          !isDeleting ? (
            <button
              type="button"
              onClick={() => onOpenProjectUpdate(project)}
              style={{
                ...mobileSharedActionButtonStyle,
                ...mobileUpdateActionButtonStyle,
              }}
            >
              Add update
            </button>
          ) : null}

          {onOpenProjectHistory ? (
            <button
              type="button"
              onClick={() => onOpenProjectHistory(project)}
              disabled={isDeleting}
              style={mobileSharedActionButtonStyle}
            >
              History
            </button>
          ) : null}
        </div>
      ) : null}

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
                  readOnly={actionMode === "archived"}
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

      {(isSaving || isSaved || isDeleting) && (
        <div style={mobileActionsRowStyle}>
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
        </div>
      )}
    </article>
  );
}

function MobileSubtaskRow({
  subtask,
  index,
  isBusy,
  readOnly,
  onTextareaEnter,
  updateTaskField,
  updateTaskStatus,
}: {
  subtask: TaskProjectSubtask;
  index: number;
  isBusy: boolean;
  readOnly: boolean;
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
        background: isDone ? "rgba(240,253,244,0.10)" : "transparent",
        borderColor: isDone
          ? "rgba(187,247,208,0.24)"
          : "rgba(226,232,240,0.28)",
      }}
    >
      <div style={mobileSubtaskTopLineStyle}>
        <span
          style={{
            ...mobileSubtaskIndexStyle,
            color: isDone ? "#067647" : "#64748b",
            background: isDone
              ? "rgba(220,252,231,0.22)"
              : "rgba(248,250,252,0.36)",
            borderColor: isDone
              ? "rgba(187,247,208,0.26)"
              : "rgba(226,232,240,0.30)",
          }}
        >
          {isDone ? "✓" : index + 1}
        </span>

        {readOnly ? (
          <div
            style={{
              ...mobileSubtaskReadOnlyTitleStyle,
              color: isDone ? "#64748b" : "#334155",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {subtask.title}
          </div>
        ) : (
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
              background: isDone ? "transparent" : "transparent",
              textDecoration: isDone ? "line-through" : "none",
            }}
          />
        )}
      </div>

      <div style={mobileSubtaskStatusRowStyle}>
        {readOnly ? (
          <span style={mobileSubtaskReadOnlyStatusStyle}>
            {subtask.status || "New"}
          </span>
        ) : (
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
        )}
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

function formatArchivedDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(date);
}

function getProjectVisualState(project: TaskProjectGroup) {
  const status = String(project.status || "").trim().toLowerCase();
  const priority = String(project.priority || "").trim().toLowerCase();
  const deadlineState = getDeadlineState(project);

  if (status === "done") {
    return {
      kind: "done",
      accent:
        "linear-gradient(180deg, rgba(22,163,74,0.76) 0%, rgba(134,239,172,0.58) 100%)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%)",
      border: "rgba(203,213,225,0.64)",
      shadow:
        "0 14px 32px rgba(15,23,42,0.042), 0 4px 12px rgba(15,23,42,0.024)",
      avatarBackground: "rgba(248,250,252,0.72)",
      avatarText: "#475569",
      avatarBorder: "rgba(226,232,240,0.58)",
      clientColor: "#334155",
      label: "Done",
      labelColor: "#067647",
      labelBackground: "rgba(240,253,244,0.84)",
      labelBorder: "rgba(187,247,208,0.76)",
    };
  }

  if (deadlineState === "overdue") {
    return {
      kind: "overdue",
      accent:
        "linear-gradient(180deg, rgba(185,28,28,0.78) 0%, rgba(248,113,113,0.58) 100%)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%)",
      border: "rgba(203,213,225,0.64)",
      shadow:
        "0 14px 32px rgba(15,23,42,0.042), 0 4px 12px rgba(15,23,42,0.024)",
      avatarBackground: "rgba(248,250,252,0.72)",
      avatarText: "#475569",
      avatarBorder: "rgba(226,232,240,0.58)",
      clientColor: "#334155",
      label: "Overdue",
      labelColor: "#be123c",
      labelBackground: "rgba(255,241,242,0.86)",
      labelBorder: "rgba(253,164,175,0.76)",
    };
  }

  if (priority === "high" || status === "urgent") {
    return {
      kind: "high",
      accent:
        "linear-gradient(180deg, rgba(217,119,6,0.76) 0%, rgba(251,191,36,0.58) 100%)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%)",
      border: "rgba(203,213,225,0.64)",
      shadow:
        "0 14px 32px rgba(15,23,42,0.042), 0 4px 12px rgba(15,23,42,0.024)",
      avatarBackground: "rgba(248,250,252,0.72)",
      avatarText: "#475569",
      avatarBorder: "rgba(226,232,240,0.58)",
      clientColor: "#334155",
      label: "",
      labelColor: "#be123c",
      labelBackground: "rgba(255,241,242,0.82)",
      labelBorder: "rgba(253,164,175,0.7)",
    };
  }

  return {
    kind: "default",
    accent:
      "linear-gradient(180deg, rgba(37,99,235,0.76) 0%, rgba(147,197,253,0.58) 100%)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%)",
    border: "rgba(203,213,225,0.64)",
    shadow:
      "0 14px 32px rgba(15,23,42,0.042), 0 4px 12px rgba(15,23,42,0.024)",
    avatarBackground: "rgba(248,250,252,0.72)",
    avatarText: "#1d4ed8",
    avatarBorder: "rgba(219,234,254,0.58)",
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
      background: "rgba(240,253,244,0.34)",
      borderColor: "rgba(187,247,208,0.42)",
    };
  }

  if (status === "urgent") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.34)",
      borderColor: "rgba(254,202,202,0.42)",
    };
  }

  if (status === "review") {
    return {
      color: "#2563eb",
      background: "rgba(239,246,255,0.34)",
      borderColor: "rgba(191,219,254,0.42)",
    };
  }

  if (status === "in progress" || status === "in-progress") {
    return {
      color: "#1d4ed8",
      background: "rgba(239,246,255,0.34)",
      borderColor: "rgba(191,219,254,0.42)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(255,255,255,0.56)",
    borderColor: "rgba(226,232,240,0.56)",
  };
}

function getPrioritySelectStyle(priorityValue: string) {
  const priority = String(priorityValue || "").trim().toLowerCase();

  if (priority === "high") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.34)",
      borderColor: "rgba(254,202,202,0.42)",
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
      background: "rgba(240,253,244,0.24)",
      borderColor: "rgba(187,247,208,0.32)",
    };
  }

  if (status === "urgent") {
    return {
      color: "#be123c",
      background: "rgba(255,241,242,0.24)",
      borderColor: "rgba(254,202,202,0.32)",
    };
  }

  if (status === "review") {
    return {
      color: "#2563eb",
      background: "rgba(239,246,255,0.24)",
      borderColor: "rgba(191,219,254,0.32)",
    };
  }

  if (status === "in progress" || status === "in-progress") {
    return {
      color: "#1d4ed8",
      background: "rgba(239,246,255,0.24)",
      borderColor: "rgba(191,219,254,0.32)",
    };
  }

  return {
    color: "#344054",
    background: "rgba(248,250,252,0.36)",
    borderColor: "rgba(226,232,240,0.46)",
  };
}

const mobileCardStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 18,
  border: "1px solid rgba(226,232,240,0.38)",
  padding: 12,
  display: "grid",
  gap: 9,
  transition:
    "border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
};

const mobileAccentStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 30,
  bottom: 30,
  width: 1,
  borderRadius: "0 999px 999px 0",
  opacity: 0.38,
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
  fontSize: 11,
  fontWeight: 850,
  color: "#475569",
};

const mobileArchivedIndicatorStyle: CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 10.5,
  lineHeight: 1.35,
  fontWeight: 760,
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

const mobileMetricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
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
  minHeight: 39,
  borderRadius: 11,
  border: "1px solid rgba(226,232,240,0.40)",
  background: "rgba(255,255,255,0.42)",
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
  minHeight: 39,
  borderRadius: 11,
  border: "1px solid rgba(226,232,240,0.40)",
  background: "rgba(255,255,255,0.42)",
  color: "#344054",
  padding: "0 12px",
  fontSize: 14,
  fontWeight: 900,
  outline: "none",
};

const doneProgressWrapStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "6px 0",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  borderTop: "1px solid rgba(226,232,240,0.38)",
};

const mobileReadOnlyMetaStyle: CSSProperties = {
  ...mobileInputStyle,
  display: "flex",
  alignItems: "center",
  color: "#475569",
  background: "rgba(248,250,252,0.62)",
  borderColor: "rgba(226,232,240,0.52)",
  cursor: "default",
  boxSizing: "border-box",
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
  height: 4,
  borderRadius: 999,
  background: "rgba(226,232,240,0.42)",
  overflow: "hidden",
};

const doneProgressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#16a34a",
  opacity: 0.66,
};

const mobileDetailsButtonStyle: CSSProperties = {
  minHeight: 39,
  borderRadius: 13,
  border: "1px solid rgba(203,213,225,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 920,
  cursor: "pointer",
};

const mobileDetailsCountStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const mobileProjectActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const mobileSharedActionButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 11px",
  borderRadius: 10,
  border: "1px solid rgba(203,213,225,0.62)",
  background: "rgba(255,255,255,0.68)",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: 11.5,
  fontWeight: 850,
  cursor: "pointer",
  boxShadow: "none",
};

const mobileUpdateActionButtonStyle: CSSProperties = {
  borderColor: "rgba(191,219,254,0.70)",
  background: "rgba(239,246,255,0.70)",
};

const mobileResourceCountStyle: CSSProperties = {
  minWidth: 17,
  height: 17,
  padding: "0 4px",
  borderRadius: 999,
  border: "1px solid rgba(191,219,254,0.62)",
  background: "rgba(255,255,255,0.82)",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 9.5,
  fontWeight: 950,
};

const mobileDetailsPanelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};

const mobileDetailSectionStyle: CSSProperties = {
  borderRadius: 0,
  border: "none",
  borderTop: "1px solid rgba(226,232,240,0.28)",
  background: "transparent",
  padding: "6px 0 0",
  display: "grid",
  gap: 6,
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
  padding: "2px 6px",
  borderRadius: 999,
  background: "rgba(248,250,252,0.52)",
  color: "#667085",
  fontSize: 10,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const mobileSubtaskListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  borderTop: "1px solid rgba(226,232,240,0.28)",
};

const mobileSubtaskRowStyle: CSSProperties = {
  borderRadius: 0,
  border: "none",
  borderBottom: "1px solid rgba(226,232,240,0.28)",
  padding: "4px 0",
  display: "grid",
  gap: 5,
};

const mobileSubtaskTopLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0,1fr)",
  gap: 7,
  alignItems: "flex-start",
};

const mobileSubtaskIndexStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.46)",
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 900,
};

const mobileSubtaskTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  resize: "vertical",
  borderRadius: 8,
  border: "1px solid transparent",
  padding: "1px 0",
  outline: "none",
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 780,
};

const mobileSubtaskReadOnlyTitleStyle: CSSProperties = {
  width: "100%",
  minHeight: 30,
  padding: "1px 0",
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 780,
  cursor: "default",
};

const mobileSubtaskStatusRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
};

const mobileSubtaskStatusStyle: CSSProperties = {
  width: "auto",
  minWidth: 124,
  minHeight: 30,
  borderRadius: 8,
  border: "1px solid rgba(226,232,240,0.32)",
  padding: "0 8px",
  outline: "none",
  fontSize: 13,
  fontWeight: 820,
};

const mobileSubtaskReadOnlyStatusStyle: CSSProperties = {
  width: "auto",
  minWidth: 124,
  minHeight: 30,
  borderRadius: 8,
  border: "1px solid rgba(226,232,240,0.36)",
  background: "rgba(248,250,252,0.62)",
  color: "#64748b",
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
  boxSizing: "border-box",
  fontSize: 13,
  fontWeight: 820,
  cursor: "default",
};

const mobileMetaGridStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  borderTop: "1px solid rgba(226,232,240,0.26)",
};

const mobileMetaLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "106px minmax(0, 1fr)",
  alignItems: "start",
  gap: 8,
  padding: "6px 0",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(226,232,240,0.24)",
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
  padding: "8px 0 0",
  borderRadius: 0,
  background: "transparent",
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
