"use client";

type ScanSnapshot = {
  id: string;
  user_id: string;
  scan_job_id: string | null;
  scan_type: "sample" | "full";
  emails_analyzed: number;
  promotions_count: number;
  sender_groups_count: number;
  inbox_health_score: number;
  ready_for_cleanup_count: number;
  top_sender_count: number;
  created_at: string;
};

type DashboardScanChangesCardProps = {
  latestSnapshot: ScanSnapshot | null;
  previousSnapshot: ScanSnapshot | null;
};

type MetricDelta = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
  trend: "up" | "down" | "flat";
  tone: "good" | "bad" | "neutral";
  suffix?: string;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function getTrend(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function getPercentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function getMetricTone(
  key: "emails" | "promotions" | "senders" | "health",
  delta: number
): "good" | "bad" | "neutral" {
  if (delta === 0) return "neutral";

  if (key === "health") {
    return delta > 0 ? "good" : "bad";
  }

  return delta > 0 ? "bad" : "good";
}

function getToneStyles(tone: "good" | "bad" | "neutral") {
  if (tone === "good") {
    return {
      chipBg: "rgba(22,163,74,0.10)",
      chipColor: "#15803d",
      border: "rgba(22,163,74,0.18)",
      iconBg: "rgba(22,163,74,0.12)",
    };
  }

  if (tone === "bad") {
    return {
      chipBg: "rgba(239,68,68,0.10)",
      chipColor: "#dc2626",
      border: "rgba(239,68,68,0.18)",
      iconBg: "rgba(239,68,68,0.12)",
    };
  }

  return {
    chipBg: "rgba(100,116,139,0.10)",
    chipColor: "#475569",
    border: "rgba(148,163,184,0.22)",
    iconBg: "rgba(148,163,184,0.14)",
  };
}

function getTrendIcon(trend: "up" | "down" | "flat") {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "•";
}

function buildMetric(
  label: string,
  current: number,
  previous: number,
  key: "emails" | "promotions" | "senders" | "health",
  suffix?: string
): MetricDelta {
  const delta = current - previous;
  const percent = getPercentChange(current, previous);
  const trend = getTrend(delta);
  const tone = getMetricTone(key, delta);

  return {
    label,
    current,
    previous,
    delta,
    percent,
    trend,
    tone,
    suffix,
  };
}

function getInsight(
  latestSnapshot: ScanSnapshot,
  previousSnapshot: ScanSnapshot
) {
  const promotionsDelta =
    latestSnapshot.promotions_count - previousSnapshot.promotions_count;
  const emailsDelta =
    latestSnapshot.emails_analyzed - previousSnapshot.emails_analyzed;
  const healthDelta =
    latestSnapshot.inbox_health_score - previousSnapshot.inbox_health_score;

  if (healthDelta > 0 && promotionsDelta <= 0) {
    return {
      title: "Good progress",
      text: "Your inbox health improved since the last scan, and promotional pressure did not increase.",
      tone: "good" as const,
    };
  }

  if (promotionsDelta > 0 && emailsDelta > 0) {
    return {
      title: "Your inbox is getting noisier",
      text: "Most of the growth since the last scan comes from new incoming email and more promotional clutter.",
      tone: "bad" as const,
    };
  }

  if (promotionsDelta > 0) {
    return {
      title: "Promotions are increasing",
      text: "Promotional emails grew since the last scan. This is a good time to review Promotions or top senders.",
      tone: "bad" as const,
    };
  }

  if (healthDelta < 0) {
    return {
      title: "Inbox health slipped",
      text: "Your inbox health score dropped since the previous scan. Reviewing sender groups may help restore control.",
      tone: "bad" as const,
    };
  }

  return {
    title: "Stable since last scan",
    text: "Your inbox metrics have not changed much. Run another scan later to track new movement.",
    tone: "neutral" as const,
  };
}

function formatScanDate(value: string | null | undefined) {
  if (!value) return "Recent scan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent scan";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardScanChangesCard({
  latestSnapshot,
  previousSnapshot,
}: DashboardScanChangesCardProps) {
  if (!latestSnapshot) {
    return (
      <div
        style={{
          padding: "20px 20px 18px 20px",
          borderRadius: "26px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.64) 100%)",
          border: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
          minHeight: "100%",
          display: "grid",
          alignContent: "start",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          Inbox Changes Since Last Scan
        </div>

        <div
          style={{
            fontSize: "15px",
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          Run your first scan to start building trend history. This card will compare
          your latest inbox snapshot with the previous one using saved analytics only.
        </div>
      </div>
    );
  }

  if (!previousSnapshot) {
    return (
      <div
        style={{
          padding: "20px 20px 18px 20px",
          borderRadius: "26px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.64) 100%)",
          border: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
          minHeight: "100%",
          display: "grid",
          alignContent: "start",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.01em",
            }}
          >
            Inbox Changes Since Last Scan
          </div>

          <div
            style={{
              background: "#eff6ff",
              color: "#2563eb",
              borderRadius: "999px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            First snapshot saved
          </div>
        </div>

        <div
          style={{
            fontSize: "15px",
            color: "#334155",
            lineHeight: 1.6,
          }}
        >
          Your first comparison-ready snapshot was saved on{" "}
          <b>{formatScanDate(latestSnapshot.created_at)}</b>. Run one more scan and
          this card will start showing growth, percentage changes, and trend insights.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "12px",
            marginTop: "4px",
          }}
        >
          {[
            {
              label: "Emails analyzed",
              value: latestSnapshot.emails_analyzed,
            },
            {
              label: "Promotions",
              value: latestSnapshot.promotions_count,
            },
            {
              label: "Sender groups",
              value: latestSnapshot.sender_groups_count,
            },
            {
              label: "Inbox health",
              value: latestSnapshot.inbox_health_score,
              suffix: "%",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                borderRadius: "18px",
                border: "1px solid rgba(226,232,240,0.9)",
                background: "rgba(255,255,255,0.72)",
                padding: "14px 14px 12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#64748b",
                  marginBottom: "8px",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.03em",
                }}
              >
                {formatNumber(item.value)}
                {item.suffix || ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const metrics: MetricDelta[] = [
    buildMetric(
      "Emails analyzed",
      latestSnapshot.emails_analyzed,
      previousSnapshot.emails_analyzed,
      "emails"
    ),
    buildMetric(
      "Promotions",
      latestSnapshot.promotions_count,
      previousSnapshot.promotions_count,
      "promotions"
    ),
    buildMetric(
      "Sender groups",
      latestSnapshot.sender_groups_count,
      previousSnapshot.sender_groups_count,
      "senders"
    ),
    buildMetric(
      "Inbox health",
      latestSnapshot.inbox_health_score,
      previousSnapshot.inbox_health_score,
      "health",
      "%"
    ),
  ];

  const insight = getInsight(latestSnapshot, previousSnapshot);
  const insightTone = getToneStyles(insight.tone);

  return (
    <div
      style={{
        padding: "20px 20px 18px 20px",
        borderRadius: "26px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.64) 100%)",
        border: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
        minHeight: "100%",
        display: "grid",
        alignContent: "start",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          Inbox Changes Since Last Scan
        </div>

        <div
          style={{
            background: "#eff6ff",
            color: "#2563eb",
            borderRadius: "999px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          Snapshot comparison
        </div>
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#475569",
          lineHeight: 1.6,
        }}
      >
        Comparing <b>{formatScanDate(previousSnapshot.created_at)}</b> with{" "}
        <b>{formatScanDate(latestSnapshot.created_at)}</b>.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        {metrics.map((metric) => {
          const tone = getToneStyles(metric.tone);

          return (
            <div
              key={metric.label}
              style={{
                borderRadius: "18px",
                border: `1px solid ${tone.border}`,
                background: "rgba(255,255,255,0.74)",
                padding: "14px 14px 12px 14px",
                display: "grid",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#64748b",
                  }}
                >
                  {metric.label}
                </div>

                <div
                  style={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: "999px",
                    background: tone.iconBg,
                    color: tone.chipColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "14px",
                  }}
                >
                  {getTrendIcon(metric.trend)}
                </div>
              </div>

              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {formatNumber(metric.current)}
                {metric.suffix || ""}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: 700,
                  }}
                >
                  Previous: {formatNumber(metric.previous)}
                  {metric.suffix || ""}
                </div>

                <div
                  style={{
                    background: tone.chipBg,
                    color: tone.chipColor,
                    borderRadius: "999px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  {metric.delta > 0 ? "+" : ""}
                  {formatNumber(metric.delta)}
                  {metric.suffix || ""} · {formatPercent(metric.percent)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderRadius: "18px",
          border: `1px solid ${insightTone.border}`,
          background: "rgba(255,255,255,0.76)",
          padding: "15px 15px 14px 15px",
          display: "grid",
          gap: "6px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 900,
            color: insightTone.chipColor,
          }}
        >
          {insight.title}
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          {insight.text}
        </div>
      </div>
    </div>
  );
}