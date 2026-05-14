"use client";

import type React from "react";

type InsightTone = "neutral" | "up" | "down";

type InsightItem = {
  label: string;
  value: string | number;
  helper: string;
  icon: string;
  trend?: string;
  trendTone?: InsightTone;
};

type Props = {
  responseTime?: string;
  completionRate?: string | number;
  topClient?: string;
  topClientHelper?: string;
  upcomingDeadlines?: number;
};

function getTrendStyle(tone?: InsightTone): React.CSSProperties {
  if (tone === "up") {
    return {
      color: "#15803d",
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.14)",
    };
  }

  if (tone === "down") {
    return {
      color: "#dc2626",
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.14)",
    };
  }

  return {
    color: "#64748b",
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.12)",
  };
}

function InsightCard({ item }: { item: InsightItem }) {
  const trendStyle = getTrendStyle(item.trendTone);

  return (
    <div style={cardStyle}>
      <div style={iconStyle}>{item.icon}</div>

      <div style={contentStyle}>
        <div style={labelRowStyle}>
          <div style={labelStyle}>{item.label}</div>

          {item.trend ? (
            <div style={{ ...trendStyle, ...trendPillStyle }}>
              {item.trend}
            </div>
          ) : null}
        </div>

        <div style={valueStyle}>{item.value}</div>
        <div style={helperStyle}>{item.helper}</div>
      </div>
    </div>
  );
}

export default function DashboardInsightsRow({
  responseTime = "2.4h",
  completionRate = "92%",
  topClient = "No client yet",
  topClientHelper = "No revenue tracked yet",
  upcomingDeadlines = 0,
}: Props) {
  const items: InsightItem[] = [
    {
      label: "Response time",
      value: responseTime,
      helper: "vs last 30 days",
      icon: "◷",
      trend: "↑ 18%",
      trendTone: "up",
    },
    {
      label: "Completion rate",
      value: completionRate,
      helper: "vs last 30 days",
      icon: "✓",
      trend: "↑ 8%",
      trendTone: "up",
    },
    {
      label: "Top client",
      value: topClient,
      helper: topClientHelper,
      icon: "👥",
    },
    {
      label: "Upcoming deadlines",
      value: upcomingDeadlines,
      helper: "Next 7 days",
      icon: "□",
    },
  ];

  return (
    <section className="dashboard-insights-row" style={shellStyle}>
      <style>{responsiveCss}</style>

      <div style={headerStyle}>
        <div style={sectionKickerStyle}>Insights at a glance</div>
      </div>

      <div className="dashboard-insights-grid" style={gridStyle}>
        {items.map((item) => (
          <InsightCard key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

const responsiveCss = `
  .dashboard-insights-row,
  .dashboard-insights-row * {
    box-sizing: border-box;
  }

  @media (max-width: 1100px) {
    .dashboard-insights-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 640px) {
    .dashboard-insights-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;

const shellStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 24,
  padding: 18,
  border: "1px solid rgba(226,232,240,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,250,255,0.9) 100%)",
  boxShadow:
    "0 20px 44px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.96)",
  display: "grid",
  gap: 12,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

const cardStyle: React.CSSProperties = {
  minWidth: 0,
  borderRadius: 18,
  padding: 14,
  border: "1px solid rgba(226,232,240,0.82)",
  background: "rgba(255,255,255,0.78)",
  boxShadow:
    "0 14px 28px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.96)",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#111827",
  fontSize: 17,
  fontWeight: 950,
  background:
    "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.92) 100%)",
  border: "1px solid rgba(226,232,240,0.9)",
};

const contentStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
};

const labelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const valueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 21,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: "-0.045em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const helperStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trendPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "4px 7px",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  whiteSpace: "nowrap",
};