"use client";

import type React from "react";
import type {
  DashboardStatItem,
  DashboardTrendTone,
} from "./dashboard-overview-types";

function getTrendStyle(tone?: DashboardTrendTone): React.CSSProperties {
  if (tone === "up") {
    return {
      color: "#15803d",
      background: "rgba(34,197,94,0.09)",
      border: "1px solid rgba(34,197,94,0.15)",
    };
  }

  if (tone === "down") {
    return {
      color: "#dc2626",
      background: "rgba(239,68,68,0.09)",
      border: "1px solid rgba(239,68,68,0.14)",
    };
  }

  return {
    color: "#64748b",
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.12)",
  };
}

function getIconSymbol(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("open")) return "☰";
  if (normalized.includes("focus")) return "•";
  if (normalized.includes("completed")) return "✓";
  if (normalized.includes("growth")) return "↑";

  return "•";
}

export default function DashboardStatCard({ item }: { item: DashboardStatItem }) {
  const trendStyle = getTrendStyle(item.trendTone);
  const hasTrend = Boolean(item.trendLabel);

  return (
    <button type="button" className="dashboard-stat-card" style={cardStyle}>
      <style>{responsiveCss}</style>

      <div style={iconWrapStyle}>
        <div style={iconStyle}>{getIconSymbol(item.label)}</div>
      </div>

      <div style={contentStyle}>
        <div style={topRowStyle}>
          <div style={labelStyle}>{item.label}</div>

          {hasTrend ? (
            <div style={{ ...trendStyle, ...trendPillStyle }}>
              {item.trendLabel}
            </div>
          ) : null}
        </div>

        <div style={valueStyle}>{item.value}</div>
        <div style={helperStyle}>{item.helper}</div>
      </div>
    </button>
  );
}

const responsiveCss = `
  .dashboard-stat-card {
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .dashboard-stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 36px rgba(15,23,42,0.08) !important;
    border-color: rgba(99,102,241,0.16) !important;
  }
`;

const cardStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 92,
  border: "1px solid rgba(226,232,240,0.84)",
  borderRadius: 20,
  padding: "14px 15px",
  cursor: "default",
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "left",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,252,0.94) 100%)",
  boxShadow:
    "0 16px 32px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.96)",
};

const iconWrapStyle: React.CSSProperties = {
  flexShrink: 0,
};

const iconStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  color: "#111827",
  fontSize: 16,
  fontWeight: 950,
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.92) 100%)",
  border: "1px solid rgba(226,232,240,0.9)",
  boxShadow:
    "0 8px 16px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.95)",
};

const contentStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  minWidth: 0,
  flex: 1,
};

const topRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#111827",
  fontWeight: 850,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const valueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-0.05em",
};

const helperStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.3,
  fontWeight: 650,
};

const trendPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  whiteSpace: "nowrap",
};