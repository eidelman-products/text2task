"use client";

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
    <section
      style={{
        borderRadius: 30,
        padding: 22,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(248,250,255,0.90) 100%)",
        border: "1px solid rgba(255,255,255,0.82)",
        boxShadow:
          "0 24px 46px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        display: "grid",
        gap: 20,
      }}
    >
      <div style={{ display: "grid", gap: 5 }}>
        <div
          style={{
            fontSize: 19,
            fontWeight: 950,
            letterSpacing: "-0.03em",
            color: "#0f172a",
          }}
        >
          Revenue snapshot
        </div>

        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Quick view of your business
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "end",
        }}
      >
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

      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, rgba(226,232,240,0) 0%, rgba(226,232,240,0.9) 12%, rgba(226,232,240,0.9) 88%, rgba(226,232,240,0) 100%)",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              fontWeight: 700,
            }}
          >
            Previous month
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#0f172a",
            }}
          >
            {money(previousMonth)}
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            color:
              change === null
                ? "#64748b"
                : change >= 0
                ? "#15803d"
                : "#dc2626",
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
          }}
        >
          {change === null ? "Change unavailable" : `${change > 0 ? "+" : ""}${change}%`}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
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
  const palette =
    tone === "green"
      ? {
          valueColor: "#16a34a",
          glow: "rgba(34,197,94,0.10)",
        }
      : {
          valueColor: "#7c3aed",
          glow: "rgba(124,58,237,0.10)",
        };

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        justifyItems: align === "right" ? "end" : "start",
        textAlign: align,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 46,
          lineHeight: 0.95,
          fontWeight: 950,
          letterSpacing: "-0.06em",
          color: palette.valueColor,
          textShadow: `0 8px 24px ${palette.glow}`,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          lineHeight: 1.45,
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
  const palette = {
    purple: {
      dot: "#8b5cf6",
      bg: "rgba(139,92,246,0.10)",
    },
    blue: {
      dot: "#3b82f6",
      bg: "rgba(59,130,246,0.10)",
    },
    green: {
      dot: "#22c55e",
      bg: "rgba(34,197,94,0.10)",
    },
  }[accent];

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "12px 10px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.72)",
        boxShadow: "0 10px 24px rgba(15,23,42,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: palette.dot,
            boxShadow: `0 0 0 5px ${palette.bg}`,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          fontWeight: 900,
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}