"use client";

import type { CSSProperties } from "react";
import type { HybridPreviewMeta } from "@/lib/preview/hybrid-preview";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import type { PreviewProjectGroup } from "../editable-preview-list";

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
    <div className="ai-project-review-premium-wrap" style={outerWrapStyle}>
      <style>{responsiveCss}</style>

      <div style={backdropGlowTopStyle} />
      <div style={backdropGlowLeftStyle} />
      <div style={backdropGlowRightStyle} />
      <div style={premiumHaloStyle} />

      <article className="ai-project-review-clean" style={panelStyle}>
        <div style={glassShineStyle} />
        <div style={topAccentLineStyle} />

        <header style={topLineStyle}>
          <div style={clientClusterStyle}>
            <div style={avatarOuterStyle}>
              <div style={avatarStyle}>{getInitials(group.clientName)}</div>
            </div>

            <div style={clientTextStyle}>
              <input
                value={group.clientName}
                onChange={(event) =>
                  updateGroupField("client", event.target.value)
                }
                placeholder="Client or company"
                style={clientInputStyle}
              />
            </div>
          </div>
        </header>

        <div className="ai-review-clean-layout" style={layoutStyle}>
          <section style={projectAreaStyle}>
            <div style={projectSummaryCardStyle}>
              <div style={titleSurfaceStyle}>
                <input
                  value={group.projectTitle}
                  readOnly
                  style={projectTitleStyle}
                />

                {group.projectSummary ? (
                  <p style={summaryStyle}>{group.projectSummary}</p>
                ) : null}
              </div>

              <div style={softDividerStyle} />

              <div style={metricsHeaderStyle}>
                <span style={metricsLabelStyle}>Project details</span>
              </div>

              <div className="ai-review-clean-metrics" style={metricsStyle}>
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
              </div>
            </div>

            <div className="ai-review-client-details" style={contextAreaStyle}>
              <div style={contextHeaderStyle}>
                <span style={labelStyle}>Client details</span>
              </div>

              <div className="ai-review-clean-context" style={contextGridStyle}>
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
              </div>
            </div>
          </section>

          <section style={tasksAreaStyle}>
            <div style={tasksHeaderStyle}>
              <div>
                <h3 style={tasksTitleStyle}>
                  {group.items.length} subtask
                  {group.items.length === 1 ? "" : "s"} ready
                </h3>
              </div>
            </div>

            <div style={taskListStyle}>
              {visibleTasks.map((item) => (
                <div
                  key={item.preview.previewId}
                  className="ai-review-clean-task"
                  style={taskRowStyle}
                >
                  <span style={checkStyle}>✓</span>

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
            </div>

            <div className="ai-review-resources-line" style={resourcesLineStyle}>
              <div style={resourcesIconStyle}>↗</div>

              <div style={resourcesContentStyle}>
                <div style={resourcesTitleStyle}>Resources</div>
                <div style={resourcesTextStyle}>
                  Files, links, and notes will connect to this project after
                  saving.
                </div>
              </div>

              <span
                className="ai-review-resources-badge"
                style={resourcesBadgeStyle}
              >
                Available after save
              </span>
            </div>
          </section>
        </div>
      </article>
    </div>
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

function getInitials(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "AI";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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

const outerWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 980,
  margin: "0 auto 0 0",
  padding: "6px 0 0",
  borderRadius: 24,
  isolation: "isolate",
};

const backdropGlowTopStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  top: -70,
  left: "18%",
  width: 520,
  height: 210,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.025) 44%, transparent 72%)",
  filter: "blur(28px)",
  opacity: 0.58,
  pointerEvents: "none",
  zIndex: 0,
};

const backdropGlowLeftStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  bottom: -58,
  left: "2%",
  width: 420,
  height: 190,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(14,165,233,0.07) 0%, rgba(14,165,233,0.025) 44%, transparent 72%)",
  filter: "blur(30px)",
  opacity: 0.56,
  pointerEvents: "none",
  zIndex: 0,
};

const backdropGlowRightStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  top: "18%",
  right: -72,
  width: 320,
  height: 300,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(37,99,235,0.045) 0%, rgba(37,99,235,0.018) 44%, transparent 72%)",
  filter: "blur(30px)",
  opacity: 0.42,
  pointerEvents: "none",
  zIndex: 0,
};

const premiumHaloStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  inset: 8,
  borderRadius: 28,
  background:
    "linear-gradient(135deg, rgba(37,99,235,0.055), rgba(14,165,233,0.035))",
  filter: "blur(14px)",
  opacity: 0.35,
  pointerEvents: "none",
  zIndex: 0,
};

const panelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.74) 100%)",
  border: "1px solid rgba(191,219,254,0.92)",
  boxShadow:
    "0 18px 44px rgba(15,23,42,0.065), 0 10px 26px rgba(37,99,235,0.055), inset 0 1px 0 rgba(255,255,255,0.98)",
  backdropFilter: "none",
};

const glassShineStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(118deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.10) 28%, transparent 48%)",
  pointerEvents: "none",
  zIndex: 0,
};

const topAccentLineStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 2,
  background:
    "linear-gradient(90deg, rgba(37,99,235,0.92) 0%, rgba(96,165,250,0.72) 52%, rgba(191,219,254,0.0) 100%)",
  opacity: 0.9,
  zIndex: 2,
};

const topLineStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 16,
  padding: "20px 24px 18px",
  background:
    "linear-gradient(180deg, rgba(239,246,255,0.62) 0%, rgba(255,255,255,0.96) 100%)",
  borderBottom: "1px solid rgba(191,219,254,0.68)",
};

const clientClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  minWidth: 0,
};

const avatarOuterStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.96), rgba(255,255,255,0.98))",
  border: "1px solid rgba(191,219,254,0.9)",
  boxShadow: "0 10px 22px rgba(37,99,235,0.08)",
  flexShrink: 0,
};

const avatarStyle: CSSProperties = {
  width: 45,
  height: 45,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.24), 0 8px 18px rgba(37,99,235,0.16)",
};

const clientTextStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

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

const layoutStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 0,
};

const projectAreaStyle: CSSProperties = {
  padding: "22px 24px 18px",
  display: "grid",
  alignContent: "start",
  gap: 14,
  borderRight: "none",
  borderBottom: "1px solid rgba(226,232,240,0.78)",
  background: "rgba(255,255,255,0.48)",
};

const projectSummaryCardStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 12,
  padding: "0 0 2px",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const titleSurfaceStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: "0 0 2px",
  borderRadius: 0,
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const softDividerStyle: CSSProperties = {
  height: 1,
  background:
    "linear-gradient(90deg, transparent 0%, rgba(203,213,225,0.52) 18%, rgba(203,213,225,0.34) 72%, transparent 100%)",
  margin: "0 2px",
};

const metricsHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 12,
  paddingTop: 2,
};

const metricsLabelStyle: CSSProperties = {
  color: "#2563eb",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.01em",
};

const tasksAreaStyle: CSSProperties = {
  padding: "20px 24px 24px",
  display: "grid",
  alignContent: "start",
  gap: 14,
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.58) 0%, rgba(255,255,255,0.72) 100%)",
};

const labelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.115em",
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

const metricsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
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

const contextAreaStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "14px",
  borderRadius: 16,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.58) 100%)",
  border: "1px solid rgba(226,232,240,0.78)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.76)",
};

const contextHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 12,
};

const contextGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 9,
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

const tasksHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const tasksTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: "-0.055em",
};

const taskListStyle: CSSProperties = {
  display: "grid",
  gap: 9,
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

const resourcesLineStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 12,
  marginTop: 4,
  padding: "14px",
  borderRadius: 18,
  border: "1px solid rgba(191,219,254,0.76)",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(239,246,255,0.58) 100%)",
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.035), inset 0 1px 0 rgba(255,255,255,0.78)",
};

const resourcesIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 13,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.96) 0%, rgba(219,234,254,0.82) 100%)",
  border: "1px solid rgba(191,219,254,0.88)",
  color: "#2563eb",
  fontSize: 15,
  fontWeight: 950,
  boxShadow: "0 8px 16px rgba(37,99,235,0.06)",
};

const resourcesContentStyle: CSSProperties = {
  minWidth: 0,
};

const resourcesTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 920,
  letterSpacing: "-0.01em",
};

const resourcesTextStyle: CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 680,
};

const resourcesBadgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: "7px 10px",
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(191,219,254,0.9)",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  boxShadow: "0 8px 16px rgba(37,99,235,0.045)",
};

const responsiveCss = `
  .ai-project-review-clean input:focus,
  .ai-project-review-clean select:focus,
  .ai-project-review-clean textarea:focus {
    box-shadow: none !important;
  }

  .ai-project-review-clean input::selection,
  .ai-project-review-clean textarea::selection {
    background: rgba(37,99,235,0.14);
  }

  .ai-review-clean-task {
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .ai-review-clean-task:hover {
    transform: translateY(-1px);
    border-color: rgba(191,219,254,0.95) !important;
    background: rgba(255,255,255,0.92) !important;
    box-shadow:
      0 12px 24px rgba(15,23,42,0.045),
      inset 0 1px 0 rgba(255,255,255,0.86) !important;
  }

  .ai-review-clean-metrics label:hover {
    transform: translateY(-1px);
    border-color: rgba(191,219,254,0.86) !important;
    box-shadow:
      0 10px 20px rgba(15,23,42,0.035),
      inset 0 1px 0 rgba(255,255,255,0.9) !important;
  }

  @media (max-width: 1180px) {
    .ai-review-clean-layout {
      grid-template-columns: 1fr !important;
    }

    .ai-review-clean-layout > section:first-child {
      border-right: none !important;
      border-bottom: 1px solid rgba(226,232,240,0.78);
    }
  }

  @media (max-width: 780px) {
    .ai-project-review-premium-wrap {
      padding: 8px !important;
      border-radius: 30px !important;
    }

    .ai-project-review-clean > header {
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    .ai-review-clean-metrics,
    .ai-review-clean-context {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 620px) {
    .ai-project-review-clean {
      border-radius: 24px !important;
    }

    .ai-project-review-clean > header,
    .ai-review-clean-layout > section {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }
  }

  @media (max-width: 520px) {
    .ai-project-review-premium-wrap {
      padding: 2px !important;
      border-radius: 24px !important;
    }

    .ai-project-review-clean {
      border-radius: 22px !important;
    }

    .ai-project-review-clean > header {
      padding: 15px !important;
    }

    .ai-review-clean-layout > section {
      padding: 14px !important;
    }

    .ai-project-review-clean h3 {
      font-size: 21px !important;
    }

    .ai-review-clean-metrics {
      gap: 8px !important;
    }

    .ai-review-clean-metrics label {
      padding: 9px 11px !important;
      border-radius: 15px !important;
    }

    .ai-review-client-details {
      padding: 11px 12px 12px !important;
      border-radius: 18px !important;
      gap: 8px !important;
    }

    .ai-review-clean-context {
      gap: 8px !important;
    }

    .ai-review-clean-context label {
      padding: 7px 9px 8px !important;
      border-radius: 13px !important;
    }

    .ai-review-clean-task {
      gap: 7px !important;
      padding: 8px 10px !important;
      min-height: auto !important;
      align-items: start !important;
    }

    .ai-review-clean-task textarea {
      min-height: 34px !important;
      line-height: 1.38 !important;
    }

    .ai-review-client-notes textarea {
      min-height: 72px !important;
      max-height: 144px !important;
      line-height: 1.45 !important;
      padding-bottom: 3px !important;
    }

    .ai-review-resources-line {
      grid-template-columns: 34px minmax(0, 1fr) !important;
      align-items: start !important;
      gap: 10px !important;
      padding: 13px !important;
    }

    .ai-review-resources-badge {
      grid-column: 2 / -1 !important;
      width: fit-content !important;
      margin-top: 2px !important;
    }
  }

  @media (max-width: 480px) {
    .ai-review-clean-layout {
      min-width: 0 !important;
    }

    .ai-project-review-clean input,
    .ai-project-review-clean select,
    .ai-project-review-clean textarea {
      font-size: 16px !important;
    }

    .ai-project-review-clean {
      overflow: hidden !important;
    }

    .ai-review-clean-task {
      grid-template-columns: 22px minmax(0, 1fr) !important;
      align-items: start !important;
    }

    .ai-review-clean-task-remove {
      grid-column: 2;
      justify-self: end;
      margin-top: 0;
      padding: 5px 8px !important;
    }

    .ai-project-review-premium-wrap {
      overflow: visible !important;
    }
  }

  @media (max-width: 430px) {
    .ai-project-review-clean-context {
      grid-template-columns: 1fr !important;
    }
  }
`;
