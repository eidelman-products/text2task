"use client";

import type { PaidCompletedProgress } from "./dashboard-helpers";

export default function DashboardGrowthSparkline({
  progress,
}: {
  progress: PaidCompletedProgress;
}) {
  const width = 88;
  const height = 30;
  const padding = 4;

  const maxValue = Math.max(
    progress.thisMonthCount,
    progress.previousMonthCount,
    1
  );
  const minValue = 0;

  const x1 = padding;
  const x2 = width - padding;

  const yFromValue = (value: number) => {
    const usableHeight = height - padding * 2;
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    return height - padding - normalized * usableHeight;
  };

  const y1 = yFromValue(progress.previousMonthCount);
  const y2 = yFromValue(progress.thisMonthCount);

  const stroke =
    progress.tone === "green"
      ? "#16a34a"
      : progress.tone === "red"
      ? "#dc2626"
      : "#64748b";

  const fill =
    progress.tone === "green"
      ? "rgba(34,197,94,0.12)"
      : progress.tone === "red"
      ? "rgba(239,68,68,0.12)"
      : "rgba(148,163,184,0.10)";

  return (
    <div
      style={{
        flexShrink: 0,
        display: "grid",
        gap: 2,
        justifyItems: "end",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
      >
        <path
          d={`M ${x1} ${y1} L ${x2} ${y2}`}
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx={x1}
          cy={y1}
          r="3"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
        <circle
          cx={x2}
          cy={y2}
          r="4"
          fill="#ffffff"
          stroke={stroke}
          strokeWidth="2"
        >
          <animate
            attributeName="r"
            values="4;5;4"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {progress.previousMonthCount} → {progress.thisMonthCount}
      </div>
    </div>
  );
}