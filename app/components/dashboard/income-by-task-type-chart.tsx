"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { IncomeAnalyticsResult } from "@/lib/tasks/get-income-analytics";

type IncomeByTaskTypeChartProps = {
  analytics: IncomeAnalyticsResult;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSliceColor(index: number) {
  const palette = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#f97316"];
  return palette[index % palette.length];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      taskType: string;
      amount: number;
      taskCount: number;
    };
  }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;

  return (
    <div style={tooltipStyle}>
      <div style={tooltipTitleStyle}>{item.taskType}</div>
      <div style={tooltipValueStyle}>{formatCurrency(item.amount)}</div>
      <div style={tooltipTextStyle}>
        {item.taskCount} tracked task{item.taskCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export default function IncomeByTaskTypeChart({
  analytics,
}: IncomeByTaskTypeChartProps) {
  const data = analytics.byTaskType.map((item) => ({
    taskType: item.taskType || "Other",
    amount: item.amount,
    taskCount: item.taskCount,
  }));

  return (
    <div style={containerStyle}>
      <style>{responsiveCss}</style>

      <div style={headerRowStyle}>
        <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
          <div style={titleStyle}>Income by task type</div>
          <div style={subtitleStyle}>Revenue by work category.</div>
        </div>

        <div style={badgeStyle}>{data.length} types</div>
      </div>

      {data.length ? (
        <div className="task-type-content-grid" style={contentGridStyle}>
          <div style={chartBoxStyle}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="taskType"
                  cx="50%"
                  cy="50%"
                  outerRadius={58}
                  innerRadius={34}
                  paddingAngle={3}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`${entry.taskType}-${index}`}
                      fill={getSliceColor(index)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={listStyle}>
            {data.map((item, index) => (
              <div key={`${item.taskType}-${index}`} style={rowStyle}>
                <div style={rowTopStyle}>
                  <div style={rowNameWrapStyle}>
                    <span
                      style={{
                        ...dotStyle,
                        background: getSliceColor(index),
                      }}
                    />
                    <div style={taskTypeNameStyle}>{item.taskType}</div>
                  </div>

                  <div style={amountStyle}>{formatCurrency(item.amount)}</div>
                </div>

                <div style={taskCountStyle}>
                  {item.taskCount} tracked task
                  {item.taskCount === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={emptyStyle}>No task-type income data yet.</div>
      )}
    </div>
  );
}

const responsiveCss = `
  @media (max-width: 900px) {
    .task-type-content-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 520px) {
    .task-type-content-grid {
      gap: 10px !important;
    }
  }
`;

const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};

const badgeStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid rgba(99,102,241,0.12)",
  background: "rgba(99,102,241,0.07)",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "132px minmax(0, 1fr)",
  gap: 12,
  alignItems: "center",
  minWidth: 0,
};

const chartBoxStyle: React.CSSProperties = {
  width: "100%",
  height: 150,
  minWidth: 0,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  border: "1px solid rgba(226,232,240,0.92)",
  borderRadius: 12,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.72)",
  minWidth: 0,
};

const rowTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minWidth: 0,
};

const rowNameWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const dotStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  flexShrink: 0,
};

const taskTypeNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const amountStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#4338ca",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const taskCountStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  lineHeight: 1.35,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed rgba(203,213,225,0.95)",
  borderRadius: 12,
  padding: 12,
  color: "#64748b",
  background: "rgba(255,255,255,0.58)",
  fontSize: 12,
  lineHeight: 1.55,
};

const tooltipStyle: React.CSSProperties = {
  border: "1px solid rgba(226,232,240,0.95)",
  borderRadius: 12,
  background: "#ffffff",
  padding: 9,
  boxShadow: "0 10px 22px rgba(15,23,42,0.10)",
  display: "grid",
  gap: 3,
  minWidth: 150,
};

const tooltipTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: "#4338ca",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tooltipValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.04em",
};

const tooltipTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  lineHeight: 1.45,
};