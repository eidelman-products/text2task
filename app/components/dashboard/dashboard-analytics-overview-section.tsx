"use client";

import IncomeTimelineChart from "./income-timeline-chart";
import IncomeByClientChart from "./income-by-client-chart";
import IncomeByTaskTypeChart from "./income-by-task-type-chart";
import { getIncomeAnalytics } from "@/lib/tasks/get-income-analytics";

export default function DashboardAnalyticsOverviewSection({
  analytics,
}: {
  analytics: ReturnType<typeof getIncomeAnalytics>;
}) {
  return (
    <section style={analyticsShellStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 950,
              color: "#0f172a",
              letterSpacing: "-0.04em",
            }}
          >
            Analytics overview
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            Key insights at a glance.
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 11px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(255,255,255,0.72)",
            color: "#475569",
            fontSize: 12,
            fontWeight: 800,
            boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#6366f1",
              boxShadow: "0 0 0 5px rgba(99,102,241,0.10)",
            }}
          />
          Live dashboard insights
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.15fr) minmax(0, 1.1fr)",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <div style={miniAnalyticsCardStyle}>
          <IncomeTimelineChart analytics={analytics} />
        </div>

        <div
          style={{
            ...miniAnalyticsCardStyle,
            minHeight: 320,
          }}
        >
          <IncomeByClientChart analytics={analytics} />
        </div>

        <div style={miniAnalyticsCardStyle}>
          <IncomeByTaskTypeChart analytics={analytics} />
        </div>
      </div>
    </section>
  );
}

const analyticsShellStyle: React.CSSProperties = {
  borderRadius: 30,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.82)",
  background:
    "linear-gradient(180deg, rgba(244,247,255,0.62) 0%, rgba(255,255,255,0.76) 100%)",
  boxShadow:
    "0 22px 46px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.88)",
};

const miniAnalyticsCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.82)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(248,250,255,0.86) 100%)",
  boxShadow:
    "0 14px 26px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.92)",
};