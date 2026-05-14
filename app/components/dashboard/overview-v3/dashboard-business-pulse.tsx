"use client";

import type React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getIncomeAnalytics } from "@/lib/tasks/get-income-analytics";
import { getRevenueChange, money } from "./dashboard-overview-utils";

type Props = {
  analytics: ReturnType<typeof getIncomeAnalytics>;
};

type ChartPoint = {
  label: string;
  value: number;
};

function buildTimelineData(analytics: ReturnType<typeof getIncomeAnalytics>) {
  const current = analytics.summary.thisMonth || 0;
  const previous = analytics.summary.previousMonth || 0;
  const next = analytics.summary.nextMonth || 0;

  const base = [
    { label: "Previous", value: previous },
    { label: "This month", value: current },
    { label: "Next", value: next },
  ];

  if (analytics.timeline?.length) {
    return analytics.timeline
      .slice(-6)
      .map((item: any, index: number) => ({
        label: item.label || item.month || `P${index + 1}`,
        value: Number(item.value || item.amount || item.total || 0),
      }))
      .filter((item: ChartPoint) => Number.isFinite(item.value));
  }

  return base;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div style={tooltipStyle}>
      <div style={tooltipLabelStyle}>{label}</div>
      <div style={tooltipValueStyle}>{money(Number(payload[0]?.value || 0))}</div>
    </div>
  );
}

export default function DashboardBusinessPulse({ analytics }: Props) {
  const thisMonth = analytics.summary.thisMonth || 0;
  const nextMonth = analytics.summary.nextMonth || 0;
  const previousMonth = analytics.summary.previousMonth || 0;
  const revenueChange = getRevenueChange(thisMonth, previousMonth);
  const timelineData = buildTimelineData(analytics);

  return (
    <section style={shellStyle}>
      <div style={headerStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={sectionKickerStyle}>Business pulse</div>
          <div style={titleStyle}>Revenue and pipeline</div>
        </div>

        <div style={periodPillStyle}>This month</div>
      </div>

      <div style={mainMetricStyle}>
        <div>
          <div style={metricLabelStyle}>Tracked revenue</div>
          <div style={revenueValueStyle}>{money(thisMonth)}</div>
        </div>

        {revenueChange !== null ? (
          <div
            style={{
              ...changePillStyle,
              color: revenueChange >= 0 ? "#15803d" : "#dc2626",
              background:
                revenueChange >= 0
                  ? "rgba(34,197,94,0.08)"
                  : "rgba(239,68,68,0.08)",
              border:
                revenueChange >= 0
                  ? "1px solid rgba(34,197,94,0.14)"
                  : "1px solid rgba(239,68,68,0.14)",
            }}
          >
            {revenueChange >= 0 ? "↑" : "↓"} {Math.abs(revenueChange)}% vs last month
          </div>
        ) : (
          <div style={neutralChangePillStyle}>No previous data</div>
        )}
      </div>

      <div style={miniGridStyle}>
        <MiniMetric label="Next month" value={money(nextMonth)} />
        <MiniMetric label="Previous" value={money(previousMonth)} />
        <MiniMetric label="Clients" value={String(analytics.byClient.length)} />
        <MiniMetric label="Avg. revenue" value={money(thisMonth / Math.max(1, analytics.byClient.length || 1))} />
      </div>

      <div style={chartWrapStyle}>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={timelineData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="businessPulsePurple" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
                <stop offset="58%" stopColor="#7c3aed" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
              dy={8}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
              tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}K`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#7c3aed"
              strokeWidth={2.4}
              fill="url(#businessPulsePurple)"
              dot={{
                r: 3.5,
                strokeWidth: 2,
                stroke: "#7c3aed",
                fill: "#ffffff",
              }}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "#7c3aed",
                fill: "#ffffff",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniMetricStyle}>
      <div style={miniLabelStyle}>{label}</div>
      <div style={miniValueStyle}>{value}</div>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 24,
  padding: 18,
  border: "1px solid rgba(226,232,240,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,250,255,0.92) 100%)",
  boxShadow:
    "0 22px 50px rgba(15,23,42,0.055), inset 0 1px 0 rgba(255,255,255,0.96)",
  display: "grid",
  gap: 16,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#4f46e5",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const titleStyle: React.CSSProperties = {
  fontSize: 19,
  lineHeight: 1.15,
  color: "#0f172a",
  fontWeight: 950,
  letterSpacing: "-0.045em",
};

const periodPillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "8px 11px",
  border: "1px solid rgba(226,232,240,0.9)",
  background: "rgba(255,255,255,0.74)",
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const mainMetricStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const metricLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const revenueValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-0.06em",
};

const changePillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const neutralChangePillStyle: React.CSSProperties = {
  ...changePillStyle,
  color: "#64748b",
  background: "rgba(148,163,184,0.08)",
  border: "1px solid rgba(148,163,184,0.12)",
};

const miniGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const miniMetricStyle: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 14,
  padding: "11px 10px",
  border: "1px solid rgba(226,232,240,0.82)",
  background: "rgba(255,255,255,0.72)",
  display: "grid",
  gap: 4,
};

const miniLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const miniValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: "-0.035em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chartWrapStyle: React.CSSProperties = {
  width: "100%",
  height: 210,
  minWidth: 0,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(248,250,255,0.72) 100%)",
  border: "1px solid rgba(226,232,240,0.56)",
  padding: "10px 8px 4px",
};

const tooltipStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: "9px 10px",
  background: "rgba(15,23,42,0.92)",
  color: "#ffffff",
  boxShadow: "0 16px 32px rgba(15,23,42,0.18)",
};

const tooltipLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.72)",
  fontWeight: 800,
  marginBottom: 3,
};

const tooltipValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#ffffff",
  fontWeight: 950,
};