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

type IncomeByClientItem = {
  clientName?: string;
  name?: string;
  amount?: number;
  total?: number;
};

type IncomeAnalyticsShape = {
  byClient?: IncomeByClientItem[];
};

type IncomeByClientChartProps = {
  analytics: IncomeAnalyticsShape;
};

type ChartRow = {
  fullName: string;
  shortName: string;
  value: number;
};

function toCurrency(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

export default function IncomeByClientChart({
  analytics,
}: IncomeByClientChartProps) {
  const chartData = useMemo<ChartRow[]>(() => {
    const source = analytics?.byClient || [];

    return source
      .map((item) => {
        const fullName =
          item.clientName?.trim() || item.name?.trim() || "Unknown client";
        const value =
          typeof item.total === "number"
            ? item.total
            : typeof item.amount === "number"
            ? item.amount
            : 0;

        return {
          fullName,
          shortName:
            fullName.length > 18 ? `${fullName.slice(0, 18)}...` : fullName,
          value,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [analytics]);

  return (
    <div style={{ display: "grid", gap: 12, height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            Income by client
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Top revenue clients.
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            color: "#2563eb",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.14)",
          }}
        >
          Top {chartData.length} clients
        </div>
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 10, left: 8, bottom: 4 }}
            barCategoryGap={14}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.22)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortName"
              width={120}
              tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(59,130,246,0.06)" }}
              formatter={(value) => [toCurrency(Number(value ?? 0)), "Income"]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullName || label
              }
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(226,232,240,0.96)",
                background: "#ffffff",
                boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
              }}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 8, 8]}
              fill="#3b82f6"
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}