"use client";

import type { UrgentPreviewTask } from "./dashboard-helpers";
import {
  getUrgencyBadgeBackground,
  getUrgencyBadgeBorder,
  getUrgencyBadgeColor,
  getUrgentDeadlineBadgeStyle,
  getUrgentTaskAccent,
} from "./dashboard-helpers";

export default function DashboardUrgentTasksCard({
  urgentTasks,
  overdueCount,
  dueTodayCount,
  dueTomorrowCount,
  dueSoonCount,
  onOpenTask,
}: {
  urgentTasks: UrgentPreviewTask[];
  overdueCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueSoonCount: number;
  onOpenTask: (taskId: number) => void;
}) {
  const buckets = [
    { label: "Overdue", value: overdueCount, tone: "overdue" as const },
    { label: "Today", value: dueTodayCount, tone: "today" as const },
    { label: "Tomorrow", value: dueTomorrowCount, tone: "tomorrow" as const },
    { label: "Soon", value: dueSoonCount, tone: "soon" as const },
  ];

  return (
    <section style={urgentPrimaryCardStyle}>
      <style>{responsiveCss}</style>

      <div style={topAreaStyle}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={titleRowStyle}>
            <span style={iconStyle}>⚡</span>
            <div style={titleStyle}>Urgent tasks</div>
          </div>

          <div style={subtitleStyle}>
            This is the heart of the workspace. Handle urgent work first.
          </div>
        </div>

        <div className="urgent-buckets-grid" style={bucketsGridStyle}>
          {buckets.map((bucket) => (
            <div
              key={bucket.label}
              style={{
                ...bucketCardStyle,
                border: getUrgencyBadgeBorder(bucket.tone),
                background: getUrgencyBadgeBackground(bucket.tone),
              }}
            >
              <div
                style={{
                  ...bucketLabelStyle,
                  color: getUrgencyBadgeColor(bucket.tone),
                }}
              >
                {bucket.label}
              </div>
              <div
                style={{
                  ...bucketValueStyle,
                  color: getUrgencyBadgeColor(bucket.tone),
                }}
              >
                {bucket.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {urgentTasks.length ? (
        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          {urgentTasks.map((task, index) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task.id)}
              style={{
                ...taskButtonStyle,
                border:
                  index === 0
                    ? "1px solid rgba(249,115,22,0.24)"
                    : "1px solid rgba(249,115,22,0.16)",
                background:
                  index === 0
                    ? "linear-gradient(180deg, rgba(255,247,237,0.92) 0%, rgba(255,255,255,0.96) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(255,255,255,0.96) 100%)",
              }}
            >
              <div
                style={{
                  ...taskAccentStyle,
                  background: getUrgentTaskAccent(task.tone),
                }}
              />

              <div style={taskTopRowStyle}>
                <div style={taskTitleStyle}>{task.task}</div>

                <div style={getUrgentDeadlineBadgeStyle(task.tone)}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background:
                        task.tone === "today" || task.tone === "overdue"
                          ? "#ffffff"
                          : getUrgencyBadgeColor(task.tone),
                    }}
                  />
                  {task.deadlineLabel}
                </div>
              </div>

              <div style={taskBottomRowStyle}>
                <div style={clientNameStyle}>{task.clientName}</div>
                <div style={viewTaskStyle}>View task</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          <div style={emptyIconStyle}>✓</div>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={emptyTitleStyle}>No urgent tasks right now</div>
            <div style={emptyTextStyle}>
              You’re caught up for now. New urgent work will appear here first.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const responsiveCss = `
  @media (max-width: 700px) {
    .urgent-buckets-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      max-width: 100% !important;
    }
  }
`;

const urgentPrimaryCardStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  borderRadius: 30,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.84)",
  background:
    "linear-gradient(180deg, rgba(255,252,247,0.82) 0%, rgba(244,247,255,0.90) 100%)",
  boxShadow:
    "0 24px 50px rgba(99,102,241,0.06), 0 10px 24px rgba(249,115,22,0.05), inset 0 1px 0 rgba(255,255,255,0.94)",
  overflow: "hidden",
};

const topAreaStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  marginBottom: 12,
  minWidth: 0,
};

const titleRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const iconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 16,
  background:
    "linear-gradient(180deg, rgba(99,102,241,0.14) 0%, rgba(255,255,255,0.92) 100%)",
  border: "1px solid rgba(99,102,241,0.14)",
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.04em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#5f6f82",
  lineHeight: 1.5,
  paddingLeft: 42,
};

const bucketsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  width: "100%",
  maxWidth: 372,
};

const bucketCardStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: "10px 10px 9px",
  display: "grid",
  gap: 5,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.76)",
  minWidth: 0,
};

const bucketLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const bucketValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 950,
  lineHeight: 1,
};

const taskButtonStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  borderRadius: 18,
  padding: "12px 14px",
  display: "grid",
  gap: 6,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(15,23,42,0.045)",
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
};

const taskAccentStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: 5,
};

const taskTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  paddingLeft: 8,
  minWidth: 0,
};

const taskTitleStyle: React.CSSProperties = {
  minWidth: 0,
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
  overflowWrap: "anywhere",
};

const taskBottomRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  paddingLeft: 8,
};

const clientNameStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
  fontWeight: 600,
};

const viewTaskStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#4338ca",
};

const emptyStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px dashed rgba(191,219,254,0.96)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(246,248,255,0.78) 100%)",
  padding: "22px 18px",
  display: "grid",
  gap: 10,
  justifyItems: "center",
  textAlign: "center",
};

const emptyIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  background: "rgba(99,102,241,0.10)",
  color: "#6366f1",
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 850,
  color: "#0f172a",
};

const emptyTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.55,
};