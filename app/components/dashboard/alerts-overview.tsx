"use client";

import type React from "react";

type Props = {
  alerts: any;
  onOpenTask?: (taskId: number) => void;
};

type BucketDefinition = {
  key: string;
  title: string;
  description: string;
  accent: string;
  bg: string;
  border: string;
};

const BUCKETS: BucketDefinition[] = [
  {
    key: "overdue",
    title: "Overdue",
    description: "Tasks that already passed their deadline.",
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.18)",
  },
  {
    key: "dueToday",
    title: "Due today",
    description: "Tasks that need attention today.",
    accent: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.18)",
  },
  {
    key: "dueTomorrow",
    title: "Due tomorrow",
    description: "Tasks coming up next.",
    accent: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.18)",
  },
  {
    key: "dueSoon",
    title: "Due soon",
    description: "Tasks due in the next few days.",
    accent: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.18)",
  },
];

function getBucket(source: any, key: string) {
  if (!source || typeof source !== "object") return null;
  return source[key] ?? null;
}

function getItems(bucket: any): any[] {
  if (!bucket) return [];
  if (Array.isArray(bucket)) return bucket;
  if (Array.isArray(bucket.items)) return bucket.items;
  if (Array.isArray(bucket.tasks)) return bucket.tasks;
  if (Array.isArray(bucket.list)) return bucket.list;
  if (Array.isArray(bucket.rows)) return bucket.rows;
  return [];
}

function getCount(bucket: any) {
  if (!bucket) return 0;
  if (typeof bucket.count === "number") return bucket.count;
  if (typeof bucket.total === "number") return bucket.total;
  if (typeof bucket.size === "number") return bucket.size;
  return getItems(bucket).length;
}

function getTaskId(item: any) {
  const raw = item?.id ?? item?.taskId ?? item?.task_id ?? null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function getTaskTitle(item: any) {
  return (
    item?.task ||
    item?.title ||
    item?.name ||
    item?.task_title ||
    "Untitled task"
  );
}

function getClientName(item: any) {
  return (
    item?.clientName ||
    item?.client_name ||
    item?.client?.name ||
    "Unknown client"
  );
}

function getDeadline(item: any) {
  return (
    item?.deadlineLabel ||
    item?.deadline_label ||
    item?.deadline ||
    item?.dueLabel ||
    item?.due_date ||
    "No deadline"
  );
}

export default function AlertsOverview({ alerts, onOpenTask }: Props) {
  const totalVisible = BUCKETS.reduce((sum, bucket) => {
    return sum + getCount(getBucket(alerts, bucket.key));
  }, 0);

  return (
    <section style={sectionStyle}>
      <style>{responsiveCss}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 950,
              color: "#0f172a",
              letterSpacing: "-0.04em",
            }}
          >
            Alerts overview
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            Priority tasks that need your attention.
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
              background: totalVisible > 0 ? "#f59e0b" : "#22c55e",
              boxShadow:
                totalVisible > 0
                  ? "0 0 0 5px rgba(245,158,11,0.10)"
                  : "0 0 0 5px rgba(34,197,94,0.10)",
            }}
          />
          {totalVisible > 0 ? `${totalVisible} active alerts` : "All clear"}
        </div>
      </div>

      <div className="alerts-grid" style={gridStyle}>
        {BUCKETS.map((bucket) => {
          const rawBucket = getBucket(alerts, bucket.key);
          const items = getItems(rawBucket).slice(0, 4);
          const count = getCount(rawBucket);

          return (
            <div
              key={bucket.key}
              style={{
                ...cardStyle,
                border: `1px solid ${bucket.border}`,
                background: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, ${bucket.bg} 100%)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: bucket.accent,
                        boxShadow: `0 0 0 6px ${bucket.bg}`,
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: "#0f172a",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {bucket.title}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      lineHeight: 1.45,
                    }}
                  >
                    {bucket.description}
                  </div>
                </div>

                <div
                  style={{
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: "#ffffff",
                    border: `1px solid ${bucket.border}`,
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  {count}
                </div>
              </div>

              {items.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((item, index) => {
                    const taskId = getTaskId(item);

                    return (
                      <div
                        key={`${bucket.key}-${taskId ?? index}`}
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(226,232,240,0.9)",
                          background: "rgba(255,255,255,0.88)",
                          padding: "12px 12px",
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color: "#0f172a",
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                          }}
                        >
                          {getTaskTitle(item)}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            lineHeight: 1.5,
                          }}
                        >
                          {getClientName(item)}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#475569",
                            lineHeight: 1.45,
                          }}
                        >
                          {getDeadline(item)}
                        </div>

                        {typeof taskId === "number" && onOpenTask ? (
                          <button
                            type="button"
                            onClick={() => onOpenTask(taskId)}
                            style={{
                              marginTop: 4,
                              justifySelf: "start",
                              border: "none",
                              background: "transparent",
                              color: "#2563eb",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Open task
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 16,
                    border: "1px dashed rgba(203,213,225,0.9)",
                    background: "rgba(255,255,255,0.7)",
                    padding: "16px 14px",
                    color: "#64748b",
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  No items in this bucket right now.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const responsiveCss = `
  @media (max-width: 900px) {
    .alerts-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
  }

  @media (min-width: 901px) {
    .alerts-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 14px !important;
    }
  }
`;

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  borderRadius: 30,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.82)",
  background:
    "linear-gradient(180deg, rgba(244,247,255,0.62) 0%, rgba(255,255,255,0.76) 100%)",
  boxShadow:
    "0 22px 46px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.88)",
  boxSizing: "border-box",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  alignItems: "stretch",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
  borderRadius: 22,
  padding: 14,
  boxSizing: "border-box",
};