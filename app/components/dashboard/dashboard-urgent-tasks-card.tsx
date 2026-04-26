"use client";

import type {
  DashboardUrgencyTone,
  UrgentPreviewTask,
} from "./dashboard-helpers";
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
    {
      label: "Overdue",
      value: overdueCount,
      tone: "overdue" as const,
    },
    {
      label: "Today",
      value: dueTodayCount,
      tone: "today" as const,
    },
    {
      label: "Tomorrow",
      value: dueTomorrowCount,
      tone: "tomorrow" as const,
    },
    {
      label: "Soon",
      value: dueSoonCount,
      tone: "soon" as const,
    },
  ];

  return (
    <section style={urgentPrimaryCardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                background:
                  "linear-gradient(180deg, rgba(99,102,241,0.14) 0%, rgba(255,255,255,0.92) 100%)",
                border: "1px solid rgba(99,102,241,0.14)",
                boxShadow: "0 10px 22px rgba(99,102,241,0.08)",
              }}
            >
              ⚡
            </span>

            <div
              style={{
                fontSize: 24,
                fontWeight: 950,
                color: "#0f172a",
                letterSpacing: "-0.04em",
              }}
            >
              Urgent tasks
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#5f6f82",
              lineHeight: 1.5,
              paddingLeft: 42,
            }}
          >
            This is the heart of the workspace. Handle urgent work first.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(68px, 1fr))",
            gap: 8,
            width: "100%",
            maxWidth: 372,
          }}
        >
          {buckets.map((bucket) => (
            <div
              key={bucket.label}
              style={{
                borderRadius: 16,
                padding: "10px 10px 9px",
                border: getUrgencyBadgeBorder(bucket.tone),
                background: getUrgencyBadgeBackground(bucket.tone),
                display: "grid",
                gap: 5,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.76)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: getUrgencyBadgeColor(bucket.tone),
                }}
              >
                {bucket.label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 950,
                  lineHeight: 1,
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
        <div style={{ display: "grid", gap: 10 }}>
          {urgentTasks.map((task, index) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task.id)}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-2px)";
                event.currentTarget.style.boxShadow =
                  index === 0
                    ? "0 24px 48px rgba(249,115,22,0.14), 0 10px 24px rgba(99,102,241,0.10)"
                    : "0 18px 36px rgba(15,23,42,0.08)";
                event.currentTarget.style.borderColor =
                  index === 0
                    ? "rgba(249,115,22,0.32)"
                    : "rgba(249,115,22,0.22)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.boxShadow =
                  index === 0
                    ? "0 18px 36px rgba(249,115,22,0.10), 0 10px 24px rgba(99,102,241,0.08)"
                    : "0 12px 24px rgba(15,23,42,0.045)";
                event.currentTarget.style.borderColor =
                  index === 0
                    ? "rgba(249,115,22,0.24)"
                    : "rgba(249,115,22,0.16)";
              }}
              style={{
                width: "100%",
                textAlign: "left",
                borderRadius: 18,
                border:
                  index === 0
                    ? "1px solid rgba(249,115,22,0.24)"
                    : "1px solid rgba(249,115,22,0.16)",
                background:
                  index === 0
                    ? "linear-gradient(180deg, rgba(255,247,237,0.92) 0%, rgba(255,255,255,0.96) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(255,255,255,0.96) 100%)",
                padding: "12px 14px",
                display: "grid",
                gap: 6,
                cursor: "pointer",
                boxShadow:
                  index === 0
                    ? "0 18px 36px rgba(249,115,22,0.10), 0 10px 24px rgba(99,102,241,0.08)"
                    : "0 12px 24px rgba(15,23,42,0.045)",
                position: "relative",
                overflow: "hidden",
                transition:
                  "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 5,
                  borderTopLeftRadius: 18,
                  borderBottomLeftRadius: 18,
                  background: getUrgentTaskAccent(task.tone),
                  boxShadow:
                    task.tone === "today" || task.tone === "overdue"
                      ? "0 0 18px rgba(249,115,22,0.22)"
                      : "0 0 14px rgba(59,130,246,0.16)",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                  paddingLeft: 8,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    fontSize: 15,
                    fontWeight: 900,
                    color: "#0f172a",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {task.task}
                </div>

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

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                  paddingLeft: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    lineHeight: 1.45,
                    fontWeight: 600,
                    opacity: 0.82,
                  }}
                >
                  {task.clientName}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color:
                      task.tone === "today" || task.tone === "overdue"
                        ? "#c2410c"
                        : "#4338ca",
                    letterSpacing: "-0.01em",
                  }}
                >
                  View task
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 18,
            border: "1px dashed rgba(191,219,254,0.96)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(246,248,255,0.78) 100%)",
            padding: "22px 18px",
            display: "grid",
            gap: 10,
            justifyItems: "center",
            textAlign: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.86)",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              background: "rgba(99,102,241,0.10)",
              color: "#6366f1",
              boxShadow: "0 8px 18px rgba(99,102,241,0.06)",
            }}
          >
            ✓
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 850,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              No urgent tasks right now
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                lineHeight: 1.55,
                maxWidth: 420,
              }}
            >
              You’re caught up for now. New urgent work will appear here first.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const urgentPrimaryCardStyle: React.CSSProperties = {
  borderRadius: 30,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.84)",
  background:
    "linear-gradient(180deg, rgba(255,252,247,0.82) 0%, rgba(244,247,255,0.90) 100%)",
  boxShadow:
    "0 24px 50px rgba(99,102,241,0.06), 0 10px 24px rgba(249,115,22,0.05), inset 0 1px 0 rgba(255,255,255,0.94)",
};