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
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import { getRevenueChange, money } from "./dashboard-overview-utils";

type Props = {
  analytics: ReturnType<typeof getIncomeAnalytics>;
};

type ChartPoint = {
  label: string;
  value: number;
};

type TimelineSourceItem = {
  label?: string;
  month?: string;
  value?: number;
  amount?: number;
  total?: number;
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
      .map((item: TimelineSourceItem, index: number) => ({
        label: item.label || item.month || `P${index + 1}`,
        value: Number(item.value || item.amount || item.total || 0),
      }))
      .filter((item: ChartPoint) => Number.isFinite(item.value));
  }

  return base;
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: React.ReactNode;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
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
  const clientCount = analytics.byClient.length;
  const avgRevenue = thisMonth / Math.max(1, clientCount || 1);

  return (
    <section className="business-pulse-root" style={shellStyle}>
      <style>{responsiveCss}</style>

      <div style={headerStyle}>
        <div style={headerTextStyle}>
          <div style={sectionKickerStyle}>Business pulse</div>
          <div style={titleStyle}>Revenue and pipeline</div>
        </div>

        <div style={periodPillStyle}>This month</div>
      </div>

      <div style={metricRowStyle}>
        <div style={mainMetricStyle}>
          <div style={metricLabelStyle}>Tracked revenue</div>
          <div style={revenueValueStyle}>{money(thisMonth)}</div>
        </div>

        {revenueChange !== null ? (
          <div
            style={{
              ...changePillStyle,
              color:
                revenueChange >= 0
                  ? dashboardColors.status.green
                  : dashboardColors.status.red,
              background:
                revenueChange >= 0
                  ? "rgba(236, 253, 245, 0.78)"
                  : "rgba(254, 242, 242, 0.78)",
              border:
                revenueChange >= 0
                  ? "1px solid rgba(34, 197, 94, 0.14)"
                  : "1px solid rgba(239, 68, 68, 0.14)",
            }}
          >
            {revenueChange >= 0 ? "↑" : "↓"} {Math.abs(revenueChange)}% vs last month
          </div>
        ) : (
          <div style={neutralChangePillStyle}>No previous data</div>
        )}
      </div>

      <div style={chartWrapStyle}>
        <ResponsiveContainer width="100%" height={74}>
          <AreaChart
            data={timelineData}
            margin={{ top: 8, right: 2, left: -24, bottom: 0 }}
          >
            <defs>
              <linearGradient id="businessPulseBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.16} />
                <stop offset="62%" stopColor="#2563eb" stopOpacity={0.055} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: dashboardColors.text.muted, fontSize: 10, fontWeight: 700 }}
              dy={7}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              width={36}
              tick={{ fill: dashboardColors.text.muted, fontSize: 10, fontWeight: 700 }}
              tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}K`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="value"
              stroke={dashboardColors.primary[600]}
              strokeWidth={2}
              fill="url(#businessPulseBlue)"
              dot={{
                r: 2.8,
                strokeWidth: 1.8,
                stroke: dashboardColors.primary[600],
                fill: "#ffffff",
              }}
              activeDot={{
                r: 4.4,
                strokeWidth: 2,
                stroke: dashboardColors.primary[600],
                fill: "#ffffff",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="business-mini-grid" style={miniGridStyle}>
        <MiniMetric label="Next" value={money(nextMonth)} />
        <MiniMetric label="Previous" value={money(previousMonth)} />
        <MiniMetric label="Clients" value={String(clientCount)} />
        <MiniMetric label="Avg." value={money(avgRevenue)} />
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniMetricStyle}>
      <span style={miniLabelStyle}>{label}</span>
      <span style={miniValueStyle}>{value}</span>
    </div>
  );
}

const responsiveCss = `
  .business-pulse-root,
  .business-pulse-root * {
    box-sizing: border-box;
  }

  @media (max-width: 760px) {
    .business-pulse-root {
      padding: 12px !important;
    }

    .business-mini-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }
  }
`;

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: dashboardRadii.xl,
  padding: "12px 13px",
  border: "1px solid rgba(226, 232, 240, 0.72)",
  background: "rgba(248, 250, 252, 0.42)",
  boxShadow: "none",
  display: "grid",
  gap: 11,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
};

const headerTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: dashboardColors.primary[600],
  fontWeight: dashboardTypography.weight.black,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.12,
  color: dashboardColors.text.primary,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.04em",
};

const periodPillStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.full,
  padding: "6px 9px",
  border: "1px solid rgba(226, 232, 240, 0.72)",
  background: "rgba(255, 255, 255, 0.68)",
  color: dashboardColors.text.muted,
  fontSize: 11,
  fontWeight: dashboardTypography.weight.bold,
  whiteSpace: "nowrap",
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
  flexWrap: "wrap",
};

const mainMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const metricLabelStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11.5,
  fontWeight: dashboardTypography.weight.bold,
};

const revenueValueStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 28,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.055em",
};

const changePillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: dashboardRadii.full,
  padding: "5px 8px",
  fontSize: 10.5,
  fontWeight: dashboardTypography.weight.medium,
  whiteSpace: "nowrap",
};

const neutralChangePillStyle: React.CSSProperties = {
  ...changePillStyle,
  color: dashboardColors.text.muted,
  background: "rgba(248, 250, 252, 0.74)",
  border: `1px solid ${dashboardColors.border.subtle}`,
};

const chartWrapStyle: React.CSSProperties = {
  width: "100%",
  height: 86,
  minWidth: 0,
  borderRadius: dashboardRadii.lg,
  background: "rgba(255, 255, 255, 0.38)",
  border: "1px solid rgba(226, 232, 240, 0.46)",
  padding: "2px 3px 0",
};

const miniGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const miniMetricStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
  padding: "6px 7px",
  borderRadius: dashboardRadii.md,
  border: "1px solid rgba(226, 232, 240, 0.62)",
  background: "rgba(255, 255, 255, 0.58)",
};

const miniLabelStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 10,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.bold,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const miniValueStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 13,
  lineHeight: 1.1,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.035em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tooltipStyle: React.CSSProperties = {
  borderRadius: dashboardRadii.md,
  padding: "9px 10px",
  background: "rgba(15, 23, 42, 0.92)",
  color: dashboardColors.text.inverse,
  boxShadow: dashboardShadows.lg,
};

const tooltipLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.72)",
  fontWeight: dashboardTypography.weight.bold,
  marginBottom: 3,
};

const tooltipValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: dashboardColors.text.inverse,
  fontWeight: dashboardTypography.weight.black,
};
