"use client";

import type { CSSProperties } from "react";
import type { HybridPreviewMeta } from "@/lib/preview/hybrid-preview";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import type { PreviewProjectGroup } from "../editable-preview-list";
import ProjectPreviewPresentation, {
  ProjectPreviewClientHeader,
  ProjectPreviewResourcesLine,
} from "./project-preview-presentation";

type PreviewFieldName =
  | "client"
  | "contact_name"
  | "contactName"
  | "contact_person"
  | "contactPerson"
  | "client_phone"
  | "client_email"
  | "client_notes"
  | "task"
  | "amount"
  | "deadline"
  | "priority"
  | "status"
  | "source"
  | "raw_input"
  | "deadline_date"
  | "deadline_original_text";

type AiProjectReviewPanelProps = {
  groupIndex: number;
  group: PreviewProjectGroup;
  aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
  onChange: (index: number, field: PreviewFieldName, value: string) => void;
  onRemovePreviewItem: (previewId: string) => void;
};

export default function AiProjectReviewPanel({
  group,
  onChange,
  onRemovePreviewItem,
}: AiProjectReviewPanelProps) {
  const visibleTasks = group.items.slice(0, 7);
  const hiddenTasks = Math.max(group.items.length - visibleTasks.length, 0);
  const normalizedDeadlineDisplay = group.deadlineDate
    ? formatDeadline(undefined, group.deadlineDate)
    : "";

  function updateGroupField(field: PreviewFieldName, value: string) {
    group.items.forEach((item) => {
      onChange(item.originalIndex, field, value);
    });
  }

  function updateTask(originalIndex: number, value: string) {
    onChange(originalIndex, "task", value);
  }

  return (
    <ProjectPreviewPresentation
      header={
        <ProjectPreviewClientHeader avatarLabel={group.clientName}>
          <input
            value={group.clientName}
            onChange={(event) => updateGroupField("client", event.target.value)}
            placeholder="Client or company"
            style={clientInputStyle}
          />
        </ProjectPreviewClientHeader>
      }
      projectTitle={
        <input value={group.projectTitle} readOnly style={projectTitleStyle} />
      }
      projectSummary={
        group.projectSummary ? (
          <p style={summaryStyle}>{group.projectSummary}</p>
        ) : null
      }
      projectDetails={
        <>
          <MetricInput
            label="Budget"
            value={group.amount}
            placeholder="Budget"
            accent="#047857"
            tone="green"
            onChange={(value) => updateGroupField("amount", value)}
          />

          <MetricInput
            label="Deadline"
            value={group.deadline}
            placeholder="Deadline"
            accent="#2563eb"
            tone="blue"
            helperText={
              normalizedDeadlineDisplay
                ? `Date: ${normalizedDeadlineDisplay}`
                : undefined
            }
            onChange={(value) => updateGroupField("deadline", value)}
          />

          <label style={metricBoxStyle("orange")}>
            <span style={metricLabelStyle}>Priority</span>

            <select
              value={group.priority || "Medium"}
              onChange={(event) =>
                updateGroupField("priority", event.target.value)
              }
              style={prioritySelectStyle}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
        </>
      }
      clientDetails={
        <>
          <MiniInput
            label="Contact"
            value={group.contactName}
            placeholder="Contact"
            onChange={(value) => updateGroupField("contact_name", value)}
          />

          <MiniInput
            label="Phone"
            value={group.client_phone}
            placeholder="Phone"
            onChange={(value) => updateGroupField("client_phone", value)}
          />

          <MiniInput
            label="Email"
            value={group.client_email}
            placeholder="Email"
            onChange={(value) => updateGroupField("client_email", value)}
          />

          <MiniTextarea
            label="Notes"
            value={group.client_notes}
            placeholder="Notes"
            onChange={(value) => updateGroupField("client_notes", value)}
          />
        </>
      }
      tasksHeading={
        <h3 style={tasksTitleStyle}>
          {group.items.length} subtask
          {group.items.length === 1 ? "" : "s"} ready
        </h3>
      }
      tasks={
        <>
          {visibleTasks.map((item) => (
            <div
              key={item.preview.previewId}
              className="ai-review-clean-task"
              style={taskRowStyle}
            >
              <span style={checkStyle}>{"\u2713"}</span>

              <textarea
                value={item.preview.task}
                onChange={(event) =>
                  updateTask(item.originalIndex, event.target.value)
                }
                placeholder="Subtask title"
                rows={getTaskTextareaRows(item.preview.task)}
                style={taskTextareaStyle}
              />

              <button
                type="button"
                className="ai-review-clean-task-remove"
                aria-label="Remove subtask from preview"
                onClick={() => onRemovePreviewItem(item.preview.previewId)}
                style={removeTaskButtonStyle}
              >
                Remove
              </button>
            </div>
          ))}

          {hiddenTasks > 0 ? (
            <div style={moreTasksStyle}>
              + {hiddenTasks} more item{hiddenTasks === 1 ? "" : "s"}
            </div>
          ) : null}
        </>
      }
      resources={<ProjectPreviewResourcesLine />}
    />
  );
}

function MetricInput({
  label,
  value,
  placeholder,
  accent,
  tone,
  helperText,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  accent: string;
  tone: "green" | "blue" | "orange";
  helperText?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={metricBoxStyle(tone)}>
      <span style={metricLabelStyle}>{label}</span>

      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          ...metricInputStyle,
          color: accent,
        }}
      />

      {helperText ? <span style={metricHelperTextStyle}>{helperText}</span> : null}
    </label>
  );
}

function MiniInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={miniInputShellStyle}>
      <span style={miniLabelStyle}>{label}</span>

      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={miniInputStyle}
      />
    </label>
  );
}

function MiniTextarea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="ai-review-client-notes"
      style={{
        ...miniInputShellStyle,
        gridColumn: "1 / -1",
      }}
    >
      <span style={miniLabelStyle}>{label}</span>

      <textarea
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        style={miniTextareaStyle}
      />
    </label>
  );
}

function getTaskTextareaRows(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return 1;

  const explicitLines = clean.split(/\n/).length;
  const estimatedWrappedLines = Math.ceil(clean.length / 34);

  return Math.min(Math.max(explicitLines, estimatedWrappedLines, 1), 4);
}

function metricBoxStyle(tone: "green" | "blue" | "orange"): CSSProperties {
  const palette = {
    green: {
      border: "rgba(187,247,208,0.72)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,253,244,0.42) 100%)",
      glow: "rgba(22,163,74,0.025)",
    },
    blue: {
      border: "rgba(191,219,254,0.78)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.48) 100%)",
      glow: "rgba(37,99,235,0.025)",
    },
    orange: {
      border: "rgba(254,215,170,0.68)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.42) 100%)",
      glow: "rgba(234,88,12,0.02)",
    },
  }[tone];

  return {
    minWidth: 0,
    position: "relative",
    display: "grid",
    gap: 5,
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    boxShadow: `0 6px 14px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.9)`,
    overflow: "hidden",
    transition:
      "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease",
  };
}

const clientInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: "-0.045em",
};

const projectTitleStyle: CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  fontSize: 24,
  lineHeight: 1.12,
  fontWeight: 920,
  letterSpacing: "-0.048em",
  padding: 0,
};

const summaryStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 660,
};

const metricLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 9,
  fontWeight: 880,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
};

const metricInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 14,
  fontWeight: 880,
  letterSpacing: "-0.025em",
  padding: 0,
};

const metricHelperTextStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 10.5,
  lineHeight: 1.2,
  fontWeight: 760,
};

const prioritySelectStyle: CSSProperties = {
  ...metricInputStyle,
  color: "#c2410c",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, rgba(251,146,60,0.82) 50%), linear-gradient(135deg, rgba(251,146,60,0.82) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 10px) 50%, calc(100% - 5px) 50%",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
  paddingRight: 18,
};

const miniInputShellStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 4,
  padding: "8px 10px 9px",
  borderRadius: 13,
  background: "rgba(255,255,255,0.74)",
  border: "1px solid rgba(226,232,240,0.76)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.76)",
};

const miniLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 9,
  fontWeight: 880,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
};

const miniInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#0f172a",
  padding: 0,
  fontSize: 12,
  lineHeight: 1.3,
  fontWeight: 780,
};

const miniTextareaStyle: CSSProperties = {
  ...miniInputStyle,
  minHeight: 44,
  maxHeight: 110,
  lineHeight: 1.45,
  resize: "vertical",
  overflowY: "auto",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontFamily: "inherit",
};

const tasksTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: "-0.055em",
};

const taskRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr) auto",
  alignItems: "start",
  gap: 10,
  minHeight: 44,
  padding: "9px 11px",
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.62) 100%)",
  boxShadow:
    "0 6px 14px rgba(15,23,42,0.026), inset 0 1px 0 rgba(255,255,255,0.78)",
};

const checkStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 7,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(219,234,254,0.84) 100%)",
  border: "1px solid #bfdbfe",
  color: "#2563eb",
  fontSize: 10,
  fontWeight: 950,
  boxShadow: "0 6px 12px rgba(37,99,235,0.07)",
  marginTop: 2,
};

const taskTextareaStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  color: "#0f172a",
  fontSize: 13,
  lineHeight: 1.38,
  fontWeight: 840,
  padding: 0,
  fontFamily: "inherit",
  minHeight: 20,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const removeTaskButtonStyle: CSSProperties = {
  alignSelf: "start",
  border: "1px solid rgba(203,213,225,0.72)",
  background: "rgba(255,255,255,0.78)",
  color: "#64748b",
  borderRadius: 999,
  padding: "6px 9px",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 850,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78)",
};

const moreTasksStyle: CSSProperties = {
  paddingTop: 10,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 850,
};
