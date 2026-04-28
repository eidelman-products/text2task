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
      <style>{responsiveCss}</style>

      <div className="summary-strip-grid" style={summaryGridStyle}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              ...summaryItemStyle,
              background: item.important
                ? "rgba(255,255,255,0.16)"
                : "transparent",
            }}
          >
            <div
              style={{
                ...summaryValueStyle,
                color: getStatusToneColor(item.tone),
                background: getStatusToneBg(item.tone),
              }}
            >
              {item.value}
            </div>

            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div style={summaryLabelStyle}>{item.label}</div>
              <div style={summaryHelperStyle}>{item.helper}</div>
            </div>
          </div>
        ))}

        <div className="summary-growth-item" style={growthItemStyle}>
          <div style={growthLeftStyle}>
            <div
              style={{
                ...growthValueStyle,
                color: getStatusToneColor(progress.tone),
                background: getStatusToneBg(progress.tone),
              }}
            >
              {progress.arrowSymbol} {progress.displayValue}
            </div>

            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div style={summaryLabelStyle}>Growth</div>
              <div style={summaryHelperStyle}>Monthly comparison</div>
            </div>
          </div>

          <div className="growth-sparkline">
            <DashboardGrowthSparkline progress={progress} />
          </div>
        </div>
      </div>
    </section>
  );
}

const responsiveCss = `
  @media (max-width: 700px) {
    .summary-strip-grid {
      grid-template-columns: 1fr 1fr !important;
    }

    .summary-strip-grid > div {
      border-right: none !important;
      border-bottom: 1px solid rgba(226,232,240,0.76) !important;
    }

    .summary-growth-item {
      grid-column: 1 / -1 !important;
    }
  }

  @media (max-width: 430px) {
    .summary-strip-grid {
      grid-template-columns: 1fr !important;
    }

    .growth-sparkline {
      display: none !important;
    }
  }
`;

const statusStripStyle: React.CSSProperties = {
  borderRadius: 22,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.84)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(247,249,255,0.86) 100%)",
  boxShadow:
    "0 14px 28px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.92)",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 0,
};

const summaryItemStyle: React.CSSProperties = {
  padding: "13px 14px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRight: "1px solid rgba(226,232,240,0.86)",
  minWidth: 0,
};

const summaryValueStyle: React.CSSProperties = {
  minWidth: 40,
  height: 40,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 17,
  fontWeight: 900,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
  whiteSpace: "nowrap",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.15,
};

const summaryHelperStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.25,
};

const growthItemStyle: React.CSSProperties = {
  padding: "13px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  background: "rgba(255,255,255,0.16)",
  minWidth: 0,
};

const growthLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const growthValueStyle: React.CSSProperties = {
  minWidth: 66,
  height: 40,
  padding: "0 10px",
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.84)",
  whiteSpace: "nowrap",
};