"use client";

import DashboardGrowthSparkline from "./dashboard-growth-sparkline";
import type { PaidCompletedProgress } from "./dashboard-helpers";
import { getStatusToneBg, getStatusToneColor } from "./dashboard-helpers";

export default function DashboardTopSummaryStrip({
  openTasks,
  highPriority,
  doneTasks,
  progress,
}: {
  openTasks: number;
  highPriority: number;
  doneTasks: number;
  progress: PaidCompletedProgress;
}) {
  const items = [
    {
      label: "Open tasks",
      value: String(openTasks),
      helper: "Currently active",
      tone: "slate" as const,
      important: false,
    },
    {
      label: "High priority",
      value: String(highPriority),
      helper: "Needs attention",
      tone: "red" as const,
      important: true,
    },
    {
      label: "Done",
      value: String(doneTasks),
      helper: "Completed tasks",
      tone: "green" as const,
      important: false,
    },
  ];

  return (
    <section style={statusStripStyle}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 0,
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              padding: "13px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderRight: "1px solid rgba(226,232,240,0.86)",
              background: item.important
                ? "rgba(255,255,255,0.16)"
                : "transparent",
            }}
          >
            <div
              style={{
                minWidth: 42,
                height: 42,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 900,
                color: getStatusToneColor(item.tone),
                background: getStatusToneBg(item.tone),
                boxShadow: item.important
                  ? "0 10px 22px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.84)"
                  : "inset 0 1px 0 rgba(255,255,255,0.82)",
                whiteSpace: "nowrap",
              }}
            >
              {item.value}
            </div>

            <div style={{ display: "grid", gap: 2 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: item.important ? 900 : 800,
                  color: "#0f172a",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                {item.helper}
              </div>
            </div>
          </div>
        ))}

        <div
          style={{
            padding: "13px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            background: "rgba(255,255,255,0.16)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              minWidth: 0,
            }}
          >
            <div
              style={{
                minWidth: 74,
                height: 42,
                padding: "0 12px",
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                fontSize: 15,
                fontWeight: 900,
                color: getStatusToneColor(progress.tone),
                background: getStatusToneBg(progress.tone),
                boxShadow:
                  "0 10px 22px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.84)",
                whiteSpace: "nowrap",
              }}
            >
              {progress.arrowSymbol} {progress.displayValue}
            </div>

            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                Growth
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Monthly task comparison
              </div>
            </div>
          </div>

          <DashboardGrowthSparkline progress={progress} />
        </div>
      </div>
    </section>
  );
}

const statusStripStyle: React.CSSProperties = {
  borderRadius: 22,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.84)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(247,249,255,0.86) 100%)",
  boxShadow:
    "0 14px 28px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.92)",
};