"use client";

type Props = {
  open: number;
  highPriority: number;
  done: number;

  thisMonthDone: number;
  previousMonthDone: number;
};

export default function StatusStrip({
  open,
  highPriority,
  done,
  thisMonthDone,
  previousMonthDone,
}: Props) {
  const diff = thisMonthDone - previousMonthDone;

  const percent =
    previousMonthDone === 0
      ? null
      : Math.round((diff / previousMonthDone) * 100);

  const isUp = diff > 0;
  const isDown = diff < 0;

  const color = isUp
    ? "#16a34a"
    : isDown
    ? "#dc2626"
    : "#6b7280";

  const arrow = isUp ? "↑" : isDown ? "↓" : "•";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
      }}
    >
      <Stat label="Open tasks" value={open} />
      <Stat label="High priority" value={highPriority} />
      <Stat label="Done" value={done} tone="green" />

      {/* 🔥 Growth */}
      <div
        style={{
          borderRadius: 18,
          padding: 14,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(0,0,0,0.05)",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Growth
        </div>

        <div style={{ fontSize: 11, color: "#6b7280" }}>
          Monthly task comparison
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 900,
              color,
            }}
          >
            {arrow} {diff >= 0 ? `+${diff}` : diff}
          </span>

          {percent !== null && (
            <span
              style={{
                fontSize: 12,
                color,
                fontWeight: 600,
              }}
            >
              ({percent >= 0 ? `+${percent}%` : `${percent}%`})
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          {thisMonthDone} vs {previousMonthDone}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green";
}) {
  const color =
    tone === "green" ? "#16a34a" : "#111827";

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(0,0,0,0.05)",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}