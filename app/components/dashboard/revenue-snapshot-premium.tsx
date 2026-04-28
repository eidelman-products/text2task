"use client";

import type React from "react";

type Props = {
  thisMonth: number;
  nextMonth: number;
  previousMonth: number;
  clients: number;
  taskTypes: number;
  tasks: number;
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function getChange(thisMonth: number, previousMonth: number) {
  if (previousMonth <= 0) return null;

  const raw = ((thisMonth - previousMonth) / previousMonth) * 100;
  return Math.round(raw);
}

export default function RevenueSnapshotPremium({
  thisMonth,
  nextMonth,
  previousMonth,
  clients,
  taskTypes,
  tasks,
}: Props) {
  const change = getChange(thisMonth, previousMonth);

  return (
    <section className="revenue-snapshot-root" style={sectionStyle}>
      <style>{responsiveCss}</style>

      <div style={headerStyle}>
        <div style={titleStyle}>Revenue snapshot</div>
        <div style={subtitleStyle}>Quick view of your business</div>
      </div>

      <div className="revenue-snapshot-primary-grid" style={primaryGridStyle}>
        <PrimaryMetric
          label="This month"
          value={money(thisMonth)}
          tone="green"
          sublabel={
            change === null
              ? "No previous comparison"
              : `${change > 0 ? "+" : ""}${change}% vs previous`
          }
        />

        <PrimaryMetric
          label="Next month"
          value={money(nextMonth)}
          tone="purple"
          align="right"
          sublabel="Upcoming pipeline"
        />
      </div>

      <div style={separatorStyle} />

      <div style={lowerRowStyle}>
        <div style={{ display: "grid", gap: 3 }}>
          <div style={smallLabelStyle}>Previous month</div>
          <div style={previousValueStyle}>{money(previousMonth)}</div>
        </div>

        <div style={changeBadgeStyle(change)}>
          {change === null
            ? "Change unavailable"
            : `${change > 0 ? "+" : ""}${change}%`}
        </div>
      </div>

      <div className="revenue-snapshot-mini-grid" style={miniGridStyle}>
        <MiniStat label="Clients" value={clients} accent="purple" />
        <MiniStat label="Types" value={taskTypes} accent="blue" />
        <MiniStat label="Tasks" value={tasks} accent="green" />
      </div>
    </section>
  );
}

function PrimaryMetric({
  label,
  value,
  tone,
  sublabel,
  align = "left",
}: {
  label: string;
  value: string;
  tone: "green" | "purple";
  sublabel: string;
  align?: "left" | "right";
}) {
  const valueColor = tone === "green" ? "#16a34a" : "#7c3aed";

  return (
    <div
      style={{
        display: "grid",
        gap: 5,
        justifyItems: align === "right" ? "end" : "start",
        minWidth: 0,
      }}
    >
      <div style={smallLabelStyle}>{label}</div>

      <div
        className="revenue-primary-value"
        style={{
          fontSize: 34,
          lineHeight: 0.95,
          fontWeight: 950,
          letterSpacing: "-0.055em",
          color: valueColor,
          textAlign: align,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          lineHeight: 1.35,
          textAlign: align,
        }}
      >
        {sublabel}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "purple" | "blue" | "green";
}) {
  const colorMap = {
    purple: "#8b5cf6",
    blue: "#3b82f6",
    green: "#22c55e",
  } as const;

  const color = colorMap[accent];

  return (
    <div className="revenue-mini-stat" style={miniStatStyle}>
      <div style={miniLabelRowStyle}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
            flexShrink: 0,
          }}
        />

        <span style={miniLabelStyle}>{label}</span>
      </div>

      <div style={miniValueStyle}>{value}</div>
    </div>
  );
}

const responsiveCss = `
  @media (max-width: 900px) {
    .revenue-snapshot-root {
      padding: 22px !important;
      border-radius: 30px !important;
      gap: 20px !important;
      min-height: auto !important;
    }

    .revenue-snapshot-primary-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .revenue-primary-value {
      font-size: 34px !important;
    }

    .revenue-snapshot-mini-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }

    .revenue-mini-stat {
      padding: 12px 10px !important;
    }
  }

  @media (min-width: 901px) {
    .revenue-snapshot-root {
      padding: 18px !important;
      border-radius: 24px !important;
      gap: 14px !important;
      min-height: 0 !important;
      align-self: start !important;
    }

    .revenue-snapshot-primary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 14px !important;
    }

    .revenue-primary-value {
      font-size: 30px !important;
    }

    .revenue-snapshot-mini-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }

    .revenue-mini-stat {
      padding: 10px 10px !important;
      border-radius: 16px !important;
    }
  }
`;

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  borderRadius: 24,
  padding: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,250,255,0.92) 100%)",
  border: "1px solid rgba(255,255,255,0.82)",
  boxShadow:
    "0 18px 34px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.92)",
  backdropFilter: "blur(16px)",
  display: "grid",
  gap: 14,
  boxSizing: "border-box",
  alignSelf: "start",
};

const headerStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 950,
  letterSpacing: "-0.04em",
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};

const primaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  alignItems: "end",
  minWidth: 0,
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background:
    "linear-gradient(90deg, rgba(226,232,240,0) 0%, rgba(226,232,240,0.88) 12%, rgba(226,232,240,0.88) 88%, rgba(226,232,240,0) 100%)",
};

const lowerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 800,
};

const previousValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#0f172a",
};

const changeBadgeStyle = (change: number | null): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 850,
  color: change === null ? "#64748b" : change >= 0 ? "#15803d" : "#dc2626",
  background:
    change === null
      ? "rgba(148,163,184,0.08)"
      : change >= 0
      ? "rgba(34,197,94,0.10)"
      : "rgba(239,68,68,0.10)",
  border:
    change === null
      ? "1px solid rgba(148,163,184,0.12)"
      : change >= 0
      ? "1px solid rgba(34,197,94,0.14)"
      : "1px solid rgba(239,68,68,0.14)",
  whiteSpace: "nowrap",
});

const miniGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  minWidth: 0,
};

const miniStatStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: "10px 10px",
  border: "1px solid rgba(255,255,255,0.85)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,250,255,0.95) 100%)",
  boxShadow:
    "0 10px 18px rgba(15,23,42,0.025), inset 0 1px 0 rgba(255,255,255,0.92)",
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const miniLabelRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const miniLabelStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 11,
  color: "#64748b",
  fontWeight: 850,
};

const miniValueStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.04em",
};