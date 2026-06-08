"use client";

import type React from "react";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../ui/tokens";
import type {
  DashboardStatItem,
  DashboardTrendTone,
} from "./dashboard-overview-types";

function getTrendStyle(tone?: DashboardTrendTone): React.CSSProperties {
  if (tone === "up") {
    return {
      color: dashboardColors.status.green,
      background: "rgba(236, 253, 245, 0.78)",
      border: "1px solid rgba(34, 197, 94, 0.14)",
    };
  }

  if (tone === "down") {
    return {
      color: dashboardColors.status.red,
      background: "rgba(254, 242, 242, 0.78)",
      border: "1px solid rgba(239, 68, 68, 0.14)",
    };
  }

  return {
    color: dashboardColors.text.muted,
    background: "rgba(248, 250, 252, 0.72)",
    border: `1px solid ${dashboardColors.border.subtle}`,
  };
}

export default function DashboardStatCard({ item }: { item: DashboardStatItem }) {
  const trendStyle = getTrendStyle(item.trendTone);
  const hasTrend = Boolean(item.trendLabel);

  return (
    <button type="button" className="dashboard-stat-card" style={cardStyle}>
      <style>{responsiveCss}</style>

      <div style={contentStyle}>
        <div style={labelRowStyle}>
          <span style={labelStyle}>{item.label}</span>

          {hasTrend ? (
            <span style={{ ...trendStyle, ...trendPillStyle }}>
              {item.trendLabel}
            </span>
          ) : null}
        </div>

        <div style={valueRowStyle}>
          <span style={valueStyle}>{item.value}</span>
          <span style={helperStyle}>{item.helper}</span>
        </div>
      </div>
    </button>
  );
}

const responsiveCss = `
  .dashboard-stat-card {
    transition:
      background 170ms ease,
      transform 170ms ease;
  }

  .dashboard-stat-card:hover {
    background: rgba(248, 250, 252, 0.72) !important;
    transform: translateY(-1px);
  }
`;

const cardStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 62,
  border: "none",
  borderRadius: dashboardRadii.lg,
  padding: `0 ${dashboardSpacing[5]}px`,
  cursor: "default",
  display: "flex",
  alignItems: "center",
  textAlign: "left",
  background: "transparent",
  boxShadow: "none",
};

const contentStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
  flex: 1,
};

const labelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[2],
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.035em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const valueRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: dashboardSpacing[2],
  minWidth: 0,
};

const valueStyle: React.CSSProperties = {
  color: dashboardColors.text.primary,
  fontSize: 26,
  lineHeight: 0.95,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "-0.055em",
};

const helperStyle: React.CSSProperties = {
  color: dashboardColors.text.muted,
  fontSize: 11.75,
  lineHeight: dashboardTypography.lineHeight.snug,
  fontWeight: dashboardTypography.weight.medium,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trendPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: dashboardRadii.full,
  minHeight: 20,
  padding: "0 7px",
  fontSize: 9.5,
  lineHeight: 1,
  fontWeight: dashboardTypography.weight.black,
  whiteSpace: "nowrap",
  flexShrink: 0,
};