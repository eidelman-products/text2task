"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimelineEntry = {
  name?: string;
  label?: string;
  value?: number;
  amount?: number;
};

type IncomeAnalyticsShape = {
  timeline?: TimelineEntry[];
  summary?: {
    previousMonth?: number;
    thisMonth?: number;
    nextMonth?: number;
  };
};

type IncomeTimelineChartProps = {
  analytics: IncomeAnalyticsShape;
};

type ChartRow = {
  name: string;
  value: number;
};

function toCurrency(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

export default function IncomeTimelineChart({
  analytics,
}: IncomeTimelineChartProps) {
  const chartData = useMemo<ChartRow[]>(() => {
    const source = analytics?.timeline || [];

    if (source.length > 0) {
      return source.map((item, index) => ({
        name:
          item.name?.trim() ||
          item.label?.trim() ||
          ["Previous Month", "This Month", "Next Month"][index] ||
          `Period ${index + 1}`,
        value:
          typeof item.value === "number"
            ? item.value
            : typeof item.amount === "number"
            ? item.amount
            : 0,
      }));
    }

    return [
      {
        name: "Previous Month",
        value: Number(analytics?.summary?.previousMonth ?? 0),
      },
      {
        name: "This Month",
        value: Number(analytics?.summary?.thisMonth ?? 0),
      },
      {
        name: "Next Month",
        value: Number(analytics?.summary?.nextMonth ?? 0),
      },
    ];
  }, [analytics]);

  return (
    <div style={{ display: "grid", gap: 12, height: "100%" }}>
      <div
        style={{
          display: "grid",
          gap: 3,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.03em",
          }}
        >
          Revenue timeline
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.45,
          }}
        >
          Previous, current, next month.
        </div>
      </div>

      <div style={{ width: "100%", height: 250 }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            barCategoryGap={28}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.22)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [toCurrency(Number(value ?? 0)), "Revenue"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(226,232,240,0.96)",
                background: "#ffffff",
                boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
              }}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              fill="#3b82f6"
              maxBarSize={46}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}