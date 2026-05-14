import type { CSSProperties } from "react";

type TasksStatsPillsProps = {
  activeProjectsCount: number;
  totalTasksCount: number;
  completedProjectsCount: number;
  archivedTasksCount: number;
  highPriorityTasksCount: number;
};

type StatTone = "purple" | "blue" | "green" | "orange" | "gray";

export default function TasksStatsPills({
  activeProjectsCount,
  totalTasksCount,
  completedProjectsCount,
  archivedTasksCount,
  highPriorityTasksCount,
}: TasksStatsPillsProps) {
  return (
    <div className="tasks-top-stats" style={topStatsWrapStyle}>
      <style>{statsCss}</style>

      <StatPill
        tone="purple"
        value={activeProjectsCount}
        label="Active Projects"
        compactLabel="Active"
      />

      <StatPill
        tone="blue"
        value={totalTasksCount}
        label="Total Tasks"
        compactLabel="Tasks"
      />

      <StatPill
        tone="green"
        value={completedProjectsCount}
        label="Completed Projects"
        compactLabel="Done"
      />

      <StatPill
        tone="gray"
        value={archivedTasksCount}
        label="Archived Tasks"
        compactLabel="Archive"
      />

      <StatPill
        tone="orange"
        value={highPriorityTasksCount}
        label="High Priority Tasks"
        compactLabel="High"
      />
    </div>
  );
}

function StatPill({
  tone,
  value,
  label,
  compactLabel,
}: {
  tone: StatTone;
  value: number;
  label: string;
  compactLabel: string;
}) {
  const palette = getPalette(tone);

  return (
    <div
      className="tasks-stat-pill"
      style={{
        ...topStatPillStyle,
        background: palette.background,
        borderColor: palette.border,
        color: palette.color,
        boxShadow: palette.shadow,
      }}
    >
      <span
        style={{
          ...dotStyle,
          background: palette.dot,
          boxShadow: `0 0 0 4px ${palette.dot}18`,
        }}
      />

      <span style={valueStyle}>{value}</span>

      <span className="tasks-stat-label-full" style={labelStyle}>
        {label}
      </span>

      <span className="tasks-stat-label-compact" style={labelStyle}>
        {compactLabel}
      </span>
    </div>
  );
}

function getPalette(tone: StatTone) {
  const palette = {
    purple: {
      background:
        "linear-gradient(135deg, rgba(238,242,255,0.98) 0%, rgba(255,255,255,0.92) 100%)",
      border: "rgba(199,210,254,0.95)",
      color: "#4338ca",
      dot: "#6366f1",
      shadow: "0 10px 24px rgba(79,70,229,0.075)",
    },
    blue: {
      background:
        "linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(255,255,255,0.92) 100%)",
      border: "rgba(191,219,254,0.95)",
      color: "#2563eb",
      dot: "#3b82f6",
      shadow: "0 10px 24px rgba(37,99,235,0.065)",
    },
    green: {
      background:
        "linear-gradient(135deg, rgba(240,253,244,0.98) 0%, rgba(255,255,255,0.92) 100%)",
      border: "rgba(187,247,208,0.95)",
      color: "#15803d",
      dot: "#22c55e",
      shadow: "0 10px 24px rgba(22,163,74,0.065)",
    },
    orange: {
      background:
        "linear-gradient(135deg, rgba(255,247,237,0.98) 0%, rgba(255,255,255,0.92) 100%)",
      border: "rgba(254,215,170,0.95)",
      color: "#c2410c",
      dot: "#f97316",
      shadow: "0 10px 24px rgba(234,88,12,0.06)",
    },
    gray: {
      background:
        "linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(255,255,255,0.92) 100%)",
      border: "rgba(226,232,240,0.95)",
      color: "#475569",
      dot: "#64748b",
      shadow: "0 10px 24px rgba(15,23,42,0.045)",
    },
  }[tone];

  return palette;
}

const topStatsWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 9,
  flexWrap: "wrap",
  minWidth: 0,
};

const topStatPillStyle: CSSProperties = {
  minHeight: 34,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};

const valueStyle: CSSProperties = {
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const labelStyle: CSSProperties = {
  fontWeight: 850,
};

const statsCss = `
  .tasks-stat-label-compact {
    display: none;
  }

  .tasks-stat-pill:hover {
    transform: translateY(-1px);
  }

  @media (max-width: 1180px) {
    .tasks-top-stats {
      justify-content: flex-start !important;
    }
  }

  @media (max-width: 720px) {
    .tasks-top-stats {
      gap: 8px !important;
    }

    .tasks-stat-pill {
      padding: 8px 10px !important;
      min-height: 32px !important;
      font-size: 11px !important;
    }

    .tasks-stat-label-full {
      display: none !important;
    }

    .tasks-stat-label-compact {
      display: inline !important;
    }
  }

  @media (max-width: 420px) {
    .tasks-top-stats {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      width: 100% !important;
    }

    .tasks-stat-pill {
      justify-content: flex-start !important;
      width: 100% !important;
    }
  }
`;