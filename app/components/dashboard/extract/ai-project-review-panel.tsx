"use client";

import type { CSSProperties } from "react";
import type { HybridPreviewMeta } from "@/lib/preview/hybrid-preview";
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
};

export default function AiProjectReviewPanel({
  group,
  aiMetaByPreviewId,
  onChange,
}: AiProjectReviewPanelProps) {
  const cleanupCount = group.items.reduce((total, item) => {
    const meta = aiMetaByPreviewId[item.preview.previewId];
    return total + (meta?.changes?.length || 0);
  }, 0);

  const visibleTasks = group.items.slice(0, 7);
  const hiddenTasks = Math.max(group.items.length - visibleTasks.length, 0);

  const hasContext =
    Boolean(group.contactName?.trim()) ||
    Boolean(group.client_phone?.trim()) ||
    Boolean(group.client_email?.trim()) ||
    Boolean(group.client_notes?.trim());

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
              <div style={eyebrowStyle}>Project draft</div>

              <input
                value={group.clientName}
                onChange={(event) =>
                  updateGroupField("client", event.target.value)
                }
                placeholder="Client or company"
                style={clientInputStyle}
              />

              <div style={sourceStyle}>
                <span>{group.source || "AI extraction"}</span>
                <span style={sourceDotStyle}>•</span>
                <span>
                  {cleanupCount > 0
                    ? `${cleanupCount} cleanup changes`
                    : "Ready to review"}
                </span>
              </div>
            </div>
          </div>

          {hasContext ? (
            <span style={detectedPillStyle}>Client details detected</span>
          ) : (
            <span style={optionalPillStyle}>Details optional</span>
          )}
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
                <span style={metricsLabelStyle}>Project metrics</span>
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
                <span style={quietTextStyle}>Edit before saving</span>
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

                <MiniInput
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
                <div style={labelStyle}>Extracted work</div>

                <h3 style={tasksTitleStyle}>
                  {group.items.length} item
                  {group.items.length === 1 ? "" : "s"} ready
                </h3>
              </div>

              <span style={reviewFirstStyle}>Review first</span>
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
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  accent: string;
  tone: "green" | "blue" | "orange";
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
      border: "rgba(220,252,231,0.92)",
      background:
        "linear-gradient(180deg, rgba(250,253,251,0.96) 0%, rgba(255,255,255,0.78) 100%)",
      glow: "rgba(22,163,74,0.035)",
    },
    blue: {
      border: "rgba(219,234,254,0.94)",
      background:
        "linear-gradient(180deg, rgba(250,252,255,0.96) 0%, rgba(255,255,255,0.78) 100%)",
      glow: "rgba(37,99,235,0.035)",
    },
    orange: {
      border: "rgba(255,237,213,0.96)",
      background:
        "linear-gradient(180deg, rgba(255,253,250,0.96) 0%, rgba(255,255,255,0.78) 100%)",
      glow: "rgba(234,88,12,0.03)",
    },
  }[tone];

  return {
    minWidth: 0,
    position: "relative",
    display: "grid",
    gap: 5,
    padding: "10px 12px 9px",
    borderRadius: 17,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    boxShadow: `0 8px 20px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.92)`,
    overflow: "hidden",
    transition:
      "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease",
  };
}

const outerWrapStyle: CSSProperties = {
  position: "relative",
  padding: 18,
  borderRadius: 42,
  isolation: "isolate",
};

const backdropGlowTopStyle: CSSProperties = {
  position: "absolute",
  top: -70,
  left: "18%",
  width: 520,
  height: 210,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.08) 42%, transparent 72%)",
  filter: "blur(24px)",
  opacity: 0.95,
  pointerEvents: "none",
  zIndex: 0,
};

const backdropGlowLeftStyle: CSSProperties = {
  position: "absolute",
  bottom: -58,
  left: "2%",
  width: 420,
  height: 190,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(14,165,233,0.14) 0%, rgba(14,165,233,0.06) 44%, transparent 72%)",
  filter: "blur(28px)",
  opacity: 0.95,
  pointerEvents: "none",
  zIndex: 0,
};

const backdropGlowRightStyle: CSSProperties = {
  position: "absolute",
  top: "18%",
  right: -72,
  width: 320,
  height: 300,
  borderRadius: 999,
  background:
    "radial-gradient(circle, rgba(168,85,247,0.14) 0%, rgba(168,85,247,0.055) 44%, transparent 72%)",
  filter: "blur(30px)",
  opacity: 0.9,
  pointerEvents: "none",
  zIndex: 0,
};

const premiumHaloStyle: CSSProperties = {
  position: "absolute",
  inset: 8,
  borderRadius: 38,
  background:
    "linear-gradient(135deg, rgba(79,70,229,0.13), rgba(14,165,233,0.08), rgba(168,85,247,0.1))",
  filter: "blur(16px)",
  opacity: 0.7,
  pointerEvents: "none",
  zIndex: 0,
};

const panelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
  borderRadius: 32,
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.86) 46%, rgba(238,242,255,0.78) 100%)",
  border: "1px solid rgba(255,255,255,0.82)",
  boxShadow:
    "0 42px 110px rgba(15,23,42,0.145), 0 22px 54px rgba(79,70,229,0.12), inset 0 1px 0 rgba(255,255,255,0.98)",
  backdropFilter: "blur(20px)",
};

const glassShineStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(118deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.18) 26%, transparent 48%)",
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
    "linear-gradient(90deg, rgba(79,70,229,0.9) 0%, rgba(14,165,233,0.7) 45%, rgba(168,85,247,0.8) 100%)",
  opacity: 0.75,
  zIndex: 2,
};

const topLineStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "19px 22px 15px",
  background:
    "radial-gradient(circle at 14% 0%, rgba(255,255,255,0.9) 0%, transparent 38%), linear-gradient(90deg, rgba(248,250,252,0.84) 0%, rgba(238,242,255,0.76) 100%)",
  borderBottom: "1px solid rgba(226,232,240,0.56)",
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
  borderRadius: 20,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(224,231,255,0.76))",
  border: "1px solid rgba(255,255,255,0.9)",
  boxShadow: "0 18px 36px rgba(79,70,229,0.2)",
  flexShrink: 0,
};

const avatarStyle: CSSProperties = {
  width: 45,
  height: 45,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, #2563eb 0%, #4f46e5 48%, #7c3aed 100%)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.24), 0 12px 24px rgba(79,70,229,0.24)",
};

const clientTextStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const eyebrowStyle: CSSProperties = {
  color: "#4f46e5",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.17em",
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

const sourceStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 740,
};

const sourceDotStyle: CSSProperties = {
  color: "#cbd5e1",
};

const detectedPillStyle: CSSProperties = {
  borderRadius: 999,
  padding: "8px 12px",
  background:
    "linear-gradient(135deg, rgba(236,253,245,0.95) 0%, rgba(220,252,231,0.78) 100%)",
  border: "1px solid rgba(187,247,208,0.98)",
  color: "#047857",
  fontSize: 11,
  fontWeight: 920,
  whiteSpace: "nowrap",
  boxShadow: "0 12px 26px rgba(22,163,74,0.09)",
};

const optionalPillStyle: CSSProperties = {
  ...detectedPillStyle,
  background:
    "linear-gradient(135deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.82) 100%)",
  border: "1px solid rgba(226,232,240,0.92)",
  color: "#64748b",
  boxShadow: "none",
};

const layoutStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.84fr) minmax(390px, 1.16fr)",
};

const projectAreaStyle: CSSProperties = {
  padding: 22,
  display: "grid",
  alignContent: "start",
  gap: 13,
  borderRight: "1px solid rgba(226,232,240,0.52)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 100%)",
};

const projectSummaryCardStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 11,
  padding: "13px 14px 14px",
  borderRadius: 23,
  background:
    "radial-gradient(circle at top left, rgba(238,242,255,0.38) 0%, transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(248,250,252,0.42) 100%)",
  border: "1px solid rgba(226,232,240,0.46)",
  boxShadow:
    "0 14px 34px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.84)",
};

const titleSurfaceStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "9px 10px 10px",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.38) 100%)",
  border: "1px solid rgba(226,232,240,0.42)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78)",
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
  paddingTop: 0,
};

const metricsLabelStyle: CSSProperties = {
  color: "#7c8798",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const tasksAreaStyle: CSSProperties = {
  padding: 22,
  display: "grid",
  alignContent: "start",
  gap: 14,
  background:
    "radial-gradient(circle at top right, rgba(224,231,255,0.48) 0%, transparent 42%), linear-gradient(180deg, rgba(248,250,252,0.5) 0%, rgba(255,255,255,0.3) 100%)",
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
  fontSize: 22,
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
  gridTemplateColumns: "1fr 1fr 1fr",
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
  padding: "13px 14px 14px",
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(248,250,252,0.24) 100%)",
  border: "1px solid rgba(226,232,240,0.42)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.66)",
};

const contextHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const quietTextStyle: CSSProperties = {
  color: "#a1adbd",
  fontSize: 11,
  fontWeight: 820,
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
  borderRadius: 14,
  background: "rgba(255,255,255,0.34)",
  border: "1px solid rgba(226,232,240,0.44)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.66)",
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

const tasksHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const tasksTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: "-0.055em",
};

const reviewFirstStyle: CSSProperties = {
  borderRadius: 999,
  padding: "8px 11px",
  background:
    "linear-gradient(135deg, rgba(236,253,245,0.94) 0%, rgba(220,252,231,0.78) 100%)",
  color: "#047857",
  border: "1px solid rgba(187,247,208,0.98)",
  fontSize: 11,
  fontWeight: 920,
  whiteSpace: "nowrap",
  boxShadow: "0 12px 24px rgba(22,163,74,0.08)",
};

const taskListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const taskRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  alignItems: "start",
  gap: 10,
  minHeight: 44,
  padding: "9px 11px",
  borderRadius: 15,
  border: "1px solid rgba(226,232,240,0.55)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.42) 100%)",
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.78)",
};

const checkStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 7,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(238,242,255,0.98) 0%, rgba(224,231,255,0.84) 100%)",
  border: "1px solid #c7d2fe",
  color: "#4f46e5",
  fontSize: 10,
  fontWeight: 950,
  boxShadow: "0 6px 12px rgba(79,70,229,0.09)",
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
  marginTop: 2,
  padding: "14px",
  borderRadius: 20,
  border: "1px solid rgba(199,210,254,0.7)",
  background:
    "radial-gradient(circle at top right, rgba(224,231,255,0.48) 0%, transparent 38%), linear-gradient(135deg, rgba(255,255,255,0.68) 0%, rgba(238,242,255,0.56) 100%)",
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
  boxShadow:
    "0 14px 28px rgba(79,70,229,0.055), inset 0 1px 0 rgba(255,255,255,0.78)",
};

const resourcesIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 13,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(238,242,255,0.96) 0%, rgba(224,231,255,0.82) 100%)",
  border: "1px solid rgba(199,210,254,0.88)",
  color: "#4f46e5",
  fontSize: 15,
  fontWeight: 950,
  boxShadow: "0 10px 20px rgba(79,70,229,0.08)",
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
  border: "1px solid rgba(199,210,254,0.9)",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  boxShadow: "0 10px 20px rgba(79,70,229,0.06)",
};

const responsiveCss = `
  .ai-project-review-clean input:focus,
  .ai-project-review-clean select:focus,
  .ai-project-review-clean textarea:focus {
    box-shadow: none !important;
  }

  .ai-project-review-clean input::selection,
  .ai-project-review-clean textarea::selection {
    background: rgba(99,102,241,0.16);
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
    border-color: rgba(129,140,248,0.66) !important;
    background: rgba(255,255,255,0.8) !important;
    box-shadow:
      0 16px 30px rgba(15,23,42,0.065),
      inset 0 1px 0 rgba(255,255,255,0.86) !important;
  }

  .ai-review-clean-metrics label:hover {
    transform: translateY(-1px);
    border-color: rgba(129,140,248,0.3) !important;
    box-shadow:
      0 14px 26px rgba(15,23,42,0.045),
      inset 0 1px 0 rgba(255,255,255,0.9) !important;
  }

  @media (max-width: 1180px) {
    .ai-review-clean-layout {
      grid-template-columns: 1fr !important;
    }

    .ai-review-clean-layout > section:first-child {
      border-right: none !important;
      border-bottom: 1px solid rgba(226,232,240,0.52);
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
      padding: 10px 11px !important;
      min-height: auto !important;
      align-items: start !important;
    }

    .ai-review-clean-task textarea {
      min-height: 38px !important;
      line-height: 1.38 !important;
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