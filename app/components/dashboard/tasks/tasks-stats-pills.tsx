import type { CSSProperties } from "react";

type TasksStatsPillsProps = {
  activeProjectsCount: number;
  totalTasksCount: number;
  completedProjectsCount: number;
  archivedProjectsCount: number;
  highPriorityTasksCount: number;
};

type StatTone = "purple" | "blue" | "green" | "orange" | "gray";

export default function TasksStatsPills({
  activeProjectsCount,
  totalTasksCount,
  completedProjectsCount,
  archivedProjectsCount,
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
        label="Active Tasks"
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
        value={archivedProjectsCount}
        label="Archived Projects"
        compactLabel="Archived"
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
          boxShadow: "none",
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
      background: "transparent",
      border: "rgba(226,232,240,0.46)",
      color: "#334155",
      dot: "#2563eb",
      shadow: "none",
    },
    blue: {
      background: "transparent",
      border: "rgba(226,232,240,0.46)",
      color: "#334155",
      dot: "#2563eb",
      shadow: "none",
    },
    green: {
      background: "transparent",
      border: "rgba(226,232,240,0.46)",
      color: "#334155",
      dot: "#16a34a",
      shadow: "none",
    },
    orange: {
      background: "transparent",
      border: "rgba(226,232,240,0.46)",
      color: "#475569",
      dot: "#f59e0b",
      shadow: "none",
    },
    gray: {
      background: "transparent",
      border: "rgba(226,232,240,0.46)",
      color: "#475569",
      dot: "#64748b",
      shadow: "none",
    },
  }[tone];

  return palette;
}

const topStatsWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 5,
  flexWrap: "nowrap",
  minWidth: 0,
};

const topStatPillStyle: CSSProperties = {
  minHeight: 28,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 7px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 11.5,
  fontWeight: 850,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
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
    transform: none;
  }

  @media (max-width: 1080px) {
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
