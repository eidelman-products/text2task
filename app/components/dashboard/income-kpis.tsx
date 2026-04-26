import type { IncomeAnalyticsResult } from "@/lib/tasks/get-income-analytics";

type IncomeKpisProps = {
  analytics: IncomeAnalyticsResult;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(226,232,240,0.96)",
        borderRadius: 18,
        background: "#ffffff",
        padding: 14,
        display: "grid",
        gap: 6,
        boxShadow: "0 8px 18px rgba(15,23,42,0.03)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "#64748b",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          color: "#0f172a",
        }}
      >
        {formatCurrency(value)}
      </div>
    </div>
  );
}

export default function IncomeKpis({ analytics }: IncomeKpisProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      <KpiCard label="Previous Month" value={analytics.summary.previousMonth} />
      <KpiCard label="This Month" value={analytics.summary.thisMonth} />
      <KpiCard label="Next Month" value={analytics.summary.nextMonth} />
      <KpiCard label="Total Tracked" value={analytics.summary.totalTracked} />
    </div>
  );
}