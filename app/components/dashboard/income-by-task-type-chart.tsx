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
    <div
      style={{
        border: "1px solid rgba(226,232,240,0.95)",
        borderRadius: 12,
        background: "#ffffff",
        padding: 9,
        boxShadow: "0 10px 22px rgba(15,23,42,0.10)",
        display: "grid",
        gap: 3,
        minWidth: 150,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: "#4338ca",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {item.taskType}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.04em",
        }}
      >
        {formatCurrency(item.amount)}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          lineHeight: 1.45,
        }}
      >
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
    <div
      style={{
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            Income by task type
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Revenue by work category.
          </div>
        </div>

        <div
          style={{
            padding: "5px 8px",
            borderRadius: 999,
            border: "1px solid rgba(99,102,241,0.12)",
            background: "rgba(99,102,241,0.07)",
            color: "#4338ca",
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {data.length} types
        </div>
      </div>

      {data.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "128px minmax(220px, 1fr)",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ width: "100%", height: 132 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="taskType"
                  cx="50%"
                  cy="50%"
                  outerRadius={50}
                  innerRadius={30}
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

          <div style={{ display: "grid", gap: 7 }}>
            {data.map((item, index) => (
              <div
                key={`${item.taskType}-${index}`}
                style={{
                  display: "grid",
                  gap: 3,
                  border: "1px solid rgba(226,232,240,0.92)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.72)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        background: getSliceColor(index),
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0f172a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.taskType}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: "#4338ca",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCurrency(item.amount)}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    lineHeight: 1.35,
                  }}
                >
                  {item.taskCount} tracked task
                  {item.taskCount === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed rgba(203,213,225,0.95)",
            borderRadius: 12,
            padding: 12,
            color: "#64748b",
            background: "rgba(255,255,255,0.58)",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          No task-type income data yet.
        </div>
      )}
    </div>
  );
}