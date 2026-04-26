import type { CSSProperties } from "react";
import type {
  AlertBucketItem,
  DashboardAlertsResult,
} from "@/lib/tasks/get-dashboard-alerts";

type AlertsOverviewProps = {
  alerts: DashboardAlertsResult;
  onOpenTask?: (taskId: number) => void;
};

type AlertTone = "overdue" | "today" | "tomorrow" | "soon";

type AlertCardConfig = {
  key: keyof DashboardAlertsResult["counts"];
  title: string;
  tone: AlertTone;
  items: AlertBucketItem[];
};

function getToneStyles(tone: AlertTone) {
  if (tone === "overdue") {
    return {
      borderColor: "rgba(239,68,68,0.16)",
      background:
        "linear-gradient(180deg, rgba(254,242,242,0.96) 0%, rgba(255,255,255,0.98) 100%)",
      titleColor: "#b91c1c",
      badgeBackground: "rgba(239,68,68,0.08)",
      badgeBorder: "rgba(239,68,68,0.16)",
      badgeColor: "#b91c1c",
      dotColor: "#ef4444",
    };
  }

  if (tone === "today") {
    return {
      borderColor: "rgba(245,158,11,0.16)",
      background:
        "linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(255,255,255,0.98) 100%)",
      titleColor: "#b45309",
      badgeBackground: "rgba(245,158,11,0.08)",
      badgeBorder: "rgba(245,158,11,0.16)",
      badgeColor: "#b45309",
      dotColor: "#f59e0b",
    };
  }

  if (tone === "tomorrow") {
    return {
      borderColor: "rgba(249,115,22,0.16)",
      background:
        "linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(255,255,255,0.98) 100%)",
      titleColor: "#c2410c",
      badgeBackground: "rgba(249,115,22,0.08)",
      badgeBorder: "rgba(249,115,22,0.16)",
      badgeColor: "#c2410c",
      dotColor: "#f97316",
    };
  }

  return {
    borderColor: "rgba(59,130,246,0.14)",
    background:
      "linear-gradient(180deg, rgba(239,246,255,0.94) 0%, rgba(255,255,255,0.98) 100%)",
    titleColor: "#1d4ed8",
    badgeBackground: "rgba(59,130,246,0.07)",
    badgeBorder: "rgba(59,130,246,0.14)",
    badgeColor: "#2563eb",
    dotColor: "#3b82f6",
  };
}

function MiniPill({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(203,213,225,0.9)",
        background: "#ffffff",
        color: "#475569",
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

function AlertMiniRow({
  item,
  tone,
  onOpenTask,
}: {
  item: AlertBucketItem;
  tone: AlertTone;
  onOpenTask?: (taskId: number) => void;
}) {
  const palette = getToneStyles(tone);

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "10px 11px",
        borderRadius: 14,
        border: `1px solid ${palette.borderColor}`,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 850,
              color: "#0f172a",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={item.taskTitle}
          >
            {item.taskTitle}
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={item.clientName}
          >
            {item.clientName}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "4px 7px",
            borderRadius: 999,
            border: `1px solid ${palette.badgeBorder}`,
            background: palette.badgeBackground,
            color: palette.badgeColor,
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {item.deadlineLabel}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <MiniPill label={item.amount || "—"} />
          <MiniPill label={item.priority || "Medium"} />
        </div>

        {onOpenTask ? (
          <button onClick={() => onOpenTask(item.id)} style={openButtonStyle}>
            View
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AlertCard({
  title,
  count,
  tone,
  items,
  onOpenTask,
}: {
  title: string;
  count: number;
  tone: AlertTone;
  items: AlertBucketItem[];
  onOpenTask?: (taskId: number) => void;
}) {
  const palette = getToneStyles(tone);

  return (
    <div
      style={{
        border: `1px solid ${palette.borderColor}`,
        borderRadius: 20,
        background: palette.background,
        padding: 14,
        display: "grid",
        gap: 10,
        boxShadow: "0 8px 18px rgba(15,23,42,0.025)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: palette.dotColor,
              boxShadow: `0 0 0 5px ${palette.badgeBackground}`,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: palette.titleColor,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            minWidth: 34,
            textAlign: "center",
            padding: "5px 8px",
            borderRadius: 999,
            border: `1px solid ${palette.badgeBorder}`,
            background: palette.badgeBackground,
            color: palette.badgeColor,
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {count}
        </div>
      </div>

      {items.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {items.slice(0, 2).map((item) => (
            <AlertMiniRow
              key={item.id}
              item={item}
              tone={tone}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed rgba(203,213,225,0.9)",
            borderRadius: 14,
            padding: 12,
            color: "#64748b",
            background: "rgba(255,255,255,0.72)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          No tasks here right now.
        </div>
      )}
    </div>
  );
}

export default function AlertsOverview({
  alerts,
  onOpenTask,
}: AlertsOverviewProps) {
  const cards: AlertCardConfig[] = [
    {
      key: "overdue",
      title: "Overdue",
      tone: "overdue",
      items: alerts.overdue,
    },
    {
      key: "dueToday",
      title: "Due Today",
      tone: "today",
      items: alerts.dueToday,
    },
    {
      key: "dueTomorrow",
      title: "Due Tomorrow",
      tone: "tomorrow",
      items: alerts.dueTomorrow,
    },
    {
      key: "dueSoon",
      title: "Due Soon",
      tone: "soon",
      items: alerts.dueSoon,
    },
  ];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            Attention Center
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            Overdue, today, tomorrow, and soon.
          </div>
        </div>

        <div
          style={{
            padding: "7px 11px",
            borderRadius: 999,
            border: "1px solid rgba(59,130,246,0.12)",
            background: "rgba(59,130,246,0.07)",
            color: "#2563eb",
            fontSize: 12,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {alerts.counts.totalAttention} need attention
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {cards.map((card) => (
          <AlertCard
            key={card.key}
            title={card.title}
            count={alerts.counts[card.key]}
            tone={card.tone}
            items={card.items}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  );
}

const openButtonStyle: CSSProperties = {
  border: "1px solid rgba(99,102,241,0.16)",
  background: "linear-gradient(180deg, #ffffff 0%, #eef2ff 100%)",
  color: "#4338ca",
  borderRadius: 10,
  padding: "6px 9px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};