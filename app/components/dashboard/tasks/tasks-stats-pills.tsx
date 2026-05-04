import type { CSSProperties } from "react";

type TasksStatsPillsProps = {
  activeCount: number;
  doneCount: number;
  archivedCount: number;
  highCount: number;
};

export default function TasksStatsPills({
  activeCount,
  doneCount,
  archivedCount,
  highCount,
}: TasksStatsPillsProps) {
  return (
    <div className="tasks-top-stats" style={topStatsWrapStyle}>
      <div style={topStatPill("blue")}>◉ {activeCount} Tasks</div>
      <div style={topStatPill("green")}>◉ {doneCount} Done</div>
      <div style={topStatPill("gray")}>◉ {archivedCount} Archived</div>
      <div style={topStatPill("orange")}>◉ {highCount} High Priority</div>
    </div>
  );
}

function topStatPill(
  tone: "blue" | "green" | "orange" | "gray"
): CSSProperties {
  const palette = {
    blue: {
      background: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.12)",
      color: "#2563eb",
    },
    green: {
      background: "rgba(34,197,94,0.10)",
      border: "rgba(34,197,94,0.14)",
      color: "#15803d",
    },
    orange: {
      background: "rgba(245,158,11,0.10)",
      border: "rgba(245,158,11,0.14)",
      color: "#c2410c",
    },
    gray: {
      background: "rgba(100,116,139,0.08)",
      border: "rgba(100,116,139,0.14)",
      color: "#475569",
    },
  }[tone];

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    background: palette.background,
    border: `1px solid ${palette.border}`,
    color: palette.color,
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

const topStatsWrapStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};