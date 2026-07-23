"use client";

import type { CSSProperties } from "react";
import {
  formatDuplicateProjectAmount,
  formatDuplicateProjectDeadline,
} from "./duplicate-project-view";
import type { DuplicateProjectMatch } from "@/lib/tasks/project-duplicate-detection";

type DuplicateProjectModalProps = {
  isOpen: boolean;
  duplicate: DuplicateProjectMatch | null;
  isSavingAnyway: boolean;
  onCancel: () => void;
  onSaveAnyway: () => void;
  onViewExisting?: () => void;
};

export default function DuplicateProjectModal({
  isOpen,
  duplicate,
  isSavingAnyway,
  onCancel,
  onSaveAnyway,
  onViewExisting,
}: DuplicateProjectModalProps) {
  if (!isOpen || !duplicate) return null;

  const confidenceLabel =
    duplicate.confidence === "high" ? "High match" : "Possible match";

  const confidenceText =
    duplicate.confidence === "high"
      ? "This looks very similar to a project already saved in your CRM."
      : "This may be similar to an existing project in your CRM.";

  const amount = formatDuplicateProjectAmount(duplicate);
  const deadline = formatDuplicateProjectDeadline(duplicate);
  const safeScore = Math.min(Number(duplicate.score) || 0, 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-project-modal-title"
      style={overlayStyle}
    >
      <div style={modalStyle}>
        <div style={glowStyle} />

        <div style={topRowStyle}>
          <div style={iconWrapStyle}>
            <span style={iconStyle}>⧉</span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSavingAnyway}
            aria-label="Close duplicate warning"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>

        <div style={contentStyle}>
          <div style={eyebrowStyle}>{confidenceLabel}</div>

          <h2 id="duplicate-project-modal-title" style={titleStyle}>
            Possible duplicate project found
          </h2>

          <p style={descriptionStyle}>
            {confidenceText} Review the details before saving again.
          </p>

          <div style={duplicateCardStyle}>
            <div style={duplicateHeaderStyle}>
              <div>
                <div style={clientNameStyle}>{duplicate.client_name}</div>

                {duplicate.contact_name ? (
                  <div style={contactTextStyle}>
                    Contact: {duplicate.contact_name}
                  </div>
                ) : null}
              </div>

              <div style={scorePillStyle}>{safeScore}% match</div>
            </div>

            <div style={metricsGridStyle}>
              <Metric label="Project value" value={amount} />
              <Metric label="Deadline" value={deadline} />
              <Metric
                label="Tasks"
                value={`${duplicate.task_count} ${
                  duplicate.task_count === 1 ? "task" : "tasks"
                }`}
              />
              <Metric
                label="Matched"
                value={`${duplicate.matched_task_count} ${
                  duplicate.matched_task_count === 1 ? "item" : "items"
                }`}
              />
            </div>

            {duplicate.reason ? (
              <div style={reasonBoxStyle}>
                <span style={reasonLabelStyle}>Why we flagged it</span>
                <span style={reasonTextStyle}>{duplicate.reason}</span>
              </div>
            ) : null}

            {duplicate.existing_tasks.length > 0 ? (
              <div style={tasksBoxStyle}>
                <div style={tasksTitleStyle}>Existing saved subtasks</div>

                <div style={tasksListStyle}>
                  {duplicate.existing_tasks.slice(0, 5).map((task, index) => (
                    <div key={task.id} style={taskRowStyle}>
                      <span style={taskIndexStyle}>{index + 1}</span>
                      <span style={taskTitleStyle}>{task.task_title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={noticeStyle}>
            This is not an error. Text2Task is protecting your CRM from
            accidental duplicate projects. You can still save this project if
            it is intentionally separate.
          </div>
        </div>

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSavingAnyway}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onViewExisting || onCancel}
            disabled={isSavingAnyway}
            style={lightButtonStyle}
          >
            View existing
          </button>

          <button
            type="button"
            onClick={onSaveAnyway}
            disabled={isSavingAnyway}
            style={{
              ...primaryButtonStyle,
              opacity: isSavingAnyway ? 0.78 : 1,
              cursor: isSavingAnyway ? "not-allowed" : "pointer",
            }}
          >
            {isSavingAnyway ? "Saving anyway..." : "Save anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <span style={metricValueStyle}>{value}</span>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "grid",
  placeItems: "center",
  padding: 18,
  background: "rgba(15,23,42,0.38)",
  backdropFilter: "blur(8px)",
};

const modalStyle: CSSProperties = {
  position: "relative",
  width: "min(680px, 100%)",
  maxHeight: "calc(100vh - 36px)",
  overflow: "auto",
  borderRadius: 26,
  border: "1px solid rgba(191,219,254,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.96) 100%)",
  boxShadow:
    "0 24px 70px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.96)",
  padding: 18,
};

const glowStyle: CSSProperties = {
  display: "none",
  position: "absolute",
  top: -110,
  right: -80,
  width: 260,
  height: 260,
  borderRadius: 999,
  background: "rgba(37,99,235,0.06)",
  filter: "blur(24px)",
  pointerEvents: "none",
};

const topRowStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const iconWrapStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 17,
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(255,255,255,0.98))",
  border: "1px solid rgba(191,219,254,0.9)",
  boxShadow:
    "0 10px 22px rgba(37,99,235,0.07), inset 0 1px 0 rgba(255,255,255,0.92)",
};

const iconStyle: CSSProperties = {
  color: "#2563eb",
  fontSize: 20,
  fontWeight: 950,
};

const closeButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.88)",
  background: "rgba(255,255,255,0.94)",
  color: "#64748b",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
};

const contentStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 13,
  paddingTop: 14,
};

const eyebrowStyle: CSSProperties = {
  width: "fit-content",
  borderRadius: 999,
  padding: "6px 9px",
  color: "#1d4ed8",
  background: "rgba(239,246,255,0.72)",
  border: "1px solid rgba(191,219,254,0.82)",
  fontSize: 10.5,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: "-0.055em",
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.6,
  fontWeight: 680,
};

const duplicateCardStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  borderRadius: 20,
  border: "1px solid rgba(226,232,240,0.9)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.72) 100%)",
  padding: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.86)",
};

const duplicateHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
};

const clientNameStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const contactTextStyle: CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 760,
};

const scorePillStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid rgba(191,219,254,0.92)",
  background: "rgba(239,246,255,0.82)",
  color: "#1d4ed8",
  fontSize: 11.5,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const metricStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.78)",
  background: "rgba(255,255,255,0.72)",
  padding: "9px 10px",
};

const metricLabelStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

const metricValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 860,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const reasonBoxStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderRadius: 15,
  border: "1px solid rgba(191,219,254,0.72)",
  background: "rgba(239,246,255,0.56)",
  padding: "10px 11px",
};

const reasonLabelStyle: CSSProperties = {
  color: "#1d4ed8",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const reasonTextStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 700,
};

const tasksBoxStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const tasksTitleStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontWeight: 950,
};

const tasksListStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const taskRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  borderRadius: 12,
  border: "1px solid rgba(226,232,240,0.72)",
  background: "rgba(255,255,255,0.72)",
  padding: 7,
};

const taskIndexStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(191,219,254,0.78)",
  background: "rgba(239,246,255,0.72)",
  color: "#2563eb",
  fontSize: 11,
  fontWeight: 950,
};

const taskTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 820,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const noticeStyle: CSSProperties = {
  borderRadius: 15,
  border: "1px solid rgba(187,247,208,0.72)",
  background: "rgba(240,253,244,0.62)",
  color: "#166534",
  padding: "11px 12px",
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 700,
};

const actionsStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  paddingTop: 16,
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "1px solid rgba(226,232,240,0.9)",
  background: "#ffffff",
  color: "#334155",
  padding: "0 15px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const lightButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "1px solid rgba(191,219,254,0.9)",
  background: "rgba(239,246,255,0.78)",
  color: "#1d4ed8",
  padding: "0 15px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  padding: "0 16px",
  fontSize: 13,
  fontWeight: 950,
  boxShadow: "0 14px 28px rgba(37,99,235,0.18)",
};
