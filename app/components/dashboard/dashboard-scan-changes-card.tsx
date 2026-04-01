"use client";

import { useMemo, useState } from "react";

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
  highlight?: boolean;
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
      shadow: "0 16px 32px rgba(22,163,74,0.08)",
      glow: "rgba(22,163,74,0.10)",
    };
  }

  if (tone === "bad") {
    return {
      chipBg: "rgba(239,68,68,0.10)",
      chipColor: "#dc2626",
      border: "rgba(239,68,68,0.18)",
      iconBg: "rgba(239,68,68,0.12)",
      shadow: "0 16px 32px rgba(239,68,68,0.08)",
      glow: "rgba(239,68,68,0.10)",
    };
  }

  return {
    chipBg: "rgba(100,116,139,0.10)",
    chipColor: "#475569",
    border: "rgba(148,163,184,0.22)",
    iconBg: "rgba(148,163,184,0.14)",
    shadow: "0 16px 32px rgba(15,23,42,0.05)",
    glow: "rgba(148,163,184,0.10)",
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
  suffix?: string,
  highlight?: boolean
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
    highlight,
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

function formatScanTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatComparisonRange(
  previousValue: string | null | undefined,
  latestValue: string | null | undefined
) {
  if (!previousValue || !latestValue) {
    return "Comparing recent scans.";
  }

  const previousDate = new Date(previousValue);
  const latestDate = new Date(latestValue);

  if (
    Number.isNaN(previousDate.getTime()) ||
    Number.isNaN(latestDate.getTime())
  ) {
    return "Comparing recent scans.";
  }

  const previousDateLabel = formatScanDate(previousValue);
  const latestDateLabel = formatScanDate(latestValue);

  if (previousDateLabel === latestDateLabel) {
    return `Comparing ${previousDateLabel} • ${formatScanTime(
      previousValue
    )} with ${latestDateLabel} • ${formatScanTime(latestValue)}.`;
  }

  return `Comparing ${previousDateLabel} with ${latestDateLabel}.`;
}

function MetricCard({
  metric,
}: {
  metric: MetricDelta;
}) {
  const tone = getToneStyles(metric.tone);
  const [hovered, setHovered] = useState(false);

  const highlightBorder = metric.highlight
    ? metric.tone === "good"
      ? "rgba(22,163,74,0.32)"
      : metric.tone === "bad"
      ? "rgba(239,68,68,0.30)"
      : "rgba(59,130,246,0.24)"
    : tone.border;

  const highlightGlow = metric.highlight
    ? metric.tone === "good"
      ? "rgba(22,163,74,0.14)"
      : metric.tone === "bad"
      ? "rgba(239,68,68,0.14)"
      : "rgba(59,130,246,0.12)"
    : tone.glow;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "20px",
        border: `1px solid ${highlightBorder}`,
        background: hovered
  ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)"
  : metric.highlight
  ? "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(255,255,255,0.95) 100%)"
  : "rgba(255,255,255,0.78)",
        padding: "15px 15px 13px 15px",
        display: "grid",
        gap: "11px",
        boxShadow: hovered
          ? metric.highlight
            ? `0 22px 40px ${highlightGlow}`
            : "0 18px 34px rgba(15,23,42,0.10)"
          : metric.highlight
          ? `0 14px 28px ${highlightGlow}`
          : "0 10px 22px rgba(15,23,42,0.045)",
        transform: hovered ? "translateY(-3px) scale(1.01)" : "translateY(0) scale(1)",
        transition:
          "transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "auto -20px -30px auto",
          width: 90,
          height: 90,
          borderRadius: "999px",
          background: highlightGlow,
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      {metric.highlight ? (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            background: "rgba(59,130,246,0.10)",
            color: "#2563eb",
            borderRadius: "999px",
            padding: "5px 9px",
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "-0.01em",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          Key metric
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          paddingRight: metric.highlight ? "78px" : 0,
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: "#64748b",
            letterSpacing: "-0.01em",
          }}
        >
          {metric.label}
        </div>

        <div
          style={{
            minWidth: 30,
            height: 30,
            borderRadius: "999px",
            background: tone.iconBg,
            color: tone.chipColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: "14px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          {getTrendIcon(metric.trend)}
        </div>
      </div>

      <div
        style={{
          fontSize: "27px",
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.04em",
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
          gap: "10px",
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
            padding: "7px 11px",
            fontSize: "12px",
            fontWeight: 900,
            whiteSpace: "nowrap",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          {metric.delta > 0 ? "+" : ""}
          {formatNumber(metric.delta)}
          {metric.suffix || ""} • {formatPercent(metric.percent)}
        </div>
      </div>
    </div>
  );
}

export default function DashboardScanChangesCard({
  latestSnapshot,
  previousSnapshot,
}: DashboardScanChangesCardProps) {
  const firstSnapshotMetrics = useMemo(() => {
    if (!latestSnapshot) return [];

    return [
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
    ];
  }, [latestSnapshot]);

  if (!latestSnapshot) {
    return (
      <div
        style={{
          padding: "22px 22px 20px 22px",
          borderRadius: "28px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.70) 100%)",
          border: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 18px 38px rgba(15,23,42,0.055)",
          minHeight: "100%",
          display: "grid",
          alignContent: "start",
          gap: "12px",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontSize: "17px",
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Inbox Changes Since Last Scan
        </div>

        <div
          style={{
            fontSize: "15px",
            color: "#475569",
            lineHeight: 1.65,
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
          padding: "22px 22px 20px 22px",
          borderRadius: "28px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.70) 100%)",
          border: "1px solid rgba(226,232,240,0.9)",
          boxShadow: "0 18px 38px rgba(15,23,42,0.055)",
          minHeight: "100%",
          display: "grid",
          alignContent: "start",
          gap: "15px",
          backdropFilter: "blur(10px)",
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
              fontSize: "17px",
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            Inbox Changes Since Last Scan
          </div>

          <div
            style={{
              background: "#eff6ff",
              color: "#2563eb",
              borderRadius: "999px",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 800,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
            }}
          >
            First snapshot saved
          </div>
        </div>

        <div
          style={{
            fontSize: "15px",
            color: "#334155",
            lineHeight: 1.65,
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
            marginTop: "2px",
          }}
        >
          {firstSnapshotMetrics.map((item) => (
            <div
              key={item.label}
              style={{
                borderRadius: "18px",
                border: "1px solid rgba(226,232,240,0.9)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.82) 100%)",
                padding: "15px 15px 13px 15px",
                boxShadow: "0 10px 22px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#64748b",
                  marginBottom: "9px",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "25px",
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.04em",
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
      "promotions",
      undefined,
      true
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
        padding: "22px 22px 20px 22px",
        borderRadius: "28px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.70) 100%)",
        border: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 18px 38px rgba(15,23,42,0.055)",
        minHeight: "100%",
        display: "grid",
        alignContent: "start",
        gap: "16px",
        backdropFilter: "blur(10px)",
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
            fontSize: "17px",
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Inbox Changes Since Last Scan
        </div>

        <div
          style={{
            background: "#eff6ff",
            color: "#2563eb",
            borderRadius: "999px",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 800,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
          }}
        >
          Snapshot comparison
        </div>
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#475569",
          lineHeight: 1.65,
        }}
      >
        {formatComparisonRange(
          previousSnapshot.created_at,
          latestSnapshot.created_at
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div
        style={{
          borderRadius: "20px",
          border: `1px solid ${insightTone.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.86) 100%)",
          padding: "16px 16px 15px 16px",
          display: "grid",
          gap: "7px",
          boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 900,
            color: insightTone.chipColor,
            letterSpacing: "-0.01em",
          }}
        >
          {insight.title}
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#475569",
            lineHeight: 1.65,
          }}
        >
          {insight.text}
        </div>
      </div>
    </div>
  );
}