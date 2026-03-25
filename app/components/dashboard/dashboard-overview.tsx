"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";

type DashboardTopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type SmartViews = {
  unread: number;
  social: number;
  jobSearch: number;
  shopping: number;
};

type ScanResult = {
  scanned: number;
  senderGroups: number;
  promotionsFoundInSampleScan: number;
  largestSenderCount: number;
  healthScore: number;
  topSenders: DashboardTopSender[];
  smartViews: SmartViews;
};

type DashboardOverviewProps = {
  scanResult: ScanResult;
  email: string;
  loadingScan: boolean;
  toneStyles: {
    cardBg: string;
    cardBorder: string;
    title: string;
    bar: string;
    chipBg: string;
    chipColor: string;
    chipText: string;
  };
  onRunSampleScan: () => void;
  onRunFullScan: () => void;
  onGoToPromotions: () => void;
  onGoToTopSenders: () => void;
  onGoToUnsubscribe: () => void;
  onUpgradeClick: () => void;
};

type VolumeHistoryPoint = {
  label: string;
  scanned: number;
  promotions: number;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

function extractSenderName(sender: string) {
  if (!sender) return "Unknown Sender";
  const match = sender.match(/^(.*?)\s*<.*>$/);
  if (match?.[1]?.trim()) return match[1].trim();
  if (sender.includes("@")) return sender.split("@")[0];
  return sender.trim();
}

function extractSenderEmail(sender: string) {
  if (!sender) return "";
  const match = sender.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  if (sender.includes("@")) return sender.trim();
  return "";
}

function getBaseDomainFromEmail(email: string) {
  if (!email || !email.includes("@")) return "";
  const domain = email.split("@")[1]?.toLowerCase().trim() || "";
  if (!domain) return "";

  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return domain;

  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];

  if (
    parts.length >= 3 &&
    secondLast.length <= 3 &&
    ["co", "com", "org", "net"].includes(secondLast)
  ) {
    return parts.slice(-3).join(".");
  }

  return `${secondLast}.${last}`;
}

function getSenderInitials(sender: string) {
  const name = extractSenderName(sender);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function getSenderAccent(sender: string) {
  const palette = [
    "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
    "linear-gradient(135deg, #0f766e 0%, #2dd4bf 100%)",
    "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)",
    "linear-gradient(135deg, #be123c 0%, #fb7185 100%)",
    "linear-gradient(135deg, #4338ca 0%, #818cf8 100%)",
  ];

  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
}

function getCategoryData(scanResult: ScanResult) {
  const promotions = scanResult.promotionsFoundInSampleScan || 0;
  const social = scanResult.smartViews?.social || 0;
  const shopping = scanResult.smartViews?.shopping || 0;
  const jobSearch = scanResult.smartViews?.jobSearch || 0;

  const known = promotions + social + shopping + jobSearch;
  const other = Math.max(0, scanResult.scanned - known);

  return [
    { name: "Promotions", value: promotions, color: "#f97316" },
    { name: "Social", value: social, color: "#14b8a6" },
    { name: "Shopping", value: shopping, color: "#8b5cf6" },
    { name: "Job Search", value: jobSearch, color: "#3b82f6" },
    { name: "Other", value: other, color: "#cbd5e1" },
  ].filter((item) => item.value > 0);
}

function getDominantCategory(categoryData: ReturnType<typeof getCategoryData>) {
  if (!categoryData.length) return null;
  return [...categoryData].sort((a, b) => b.value - a.value)[0];
}

function historyStorageKey(email: string) {
  return `inboxshaper-volume-history:${email}`;
}

function normalizeHistory(history: VolumeHistoryPoint[]) {
  return history.slice(-7).map((item, index) => ({
    label: item.label || `Scan ${index + 1}`,
    scanned: Number(item.scanned || 0),
    promotions: Number(item.promotions || 0),
  }));
}

function buildFallbackHistory(scanResult: ScanResult): VolumeHistoryPoint[] {
  return [
    {
      label: "Latest scan",
      scanned: scanResult.scanned,
      promotions: scanResult.promotionsFoundInSampleScan,
    },
  ];
}

function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number } }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;

  return (
    <div
      style={{
        background: "#0f172a",
        color: "#fff",
        borderRadius: "14px",
        padding: "10px 12px",
        fontSize: "13px",
        boxShadow: "0 12px 30px rgba(15,23,42,0.22)",
      }}
    >
      <div style={{ fontWeight: 800 }}>{item.name}</div>
      <div>{formatNumber(item.value)} emails</div>
    </div>
  );
}

function CustomAreaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "#0f172a",
        color: "#fff",
        borderRadius: "14px",
        padding: "12px 14px",
        fontSize: "13px",
        boxShadow: "0 12px 30px rgba(15,23,42,0.22)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "6px" }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ marginTop: "4px" }}>
          {entry.name}: {formatNumber(Number(entry.value || 0))}
        </div>
      ))}
    </div>
  );
}

function SenderLogo({
  sender,
  name,
  email,
  initials,
  accent,
}: {
  sender: string;
  name: string;
  email: string;
  initials: string;
  accent: string;
}) {
  const domain = getBaseDomainFromEmail(email);
  const [imgError, setImgError] = useState(false);

  const logoUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : "";

  const showImage = Boolean(domain) && !imgError;

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "13px",
        background: showImage ? "#ffffff" : accent,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: "12px",
        flexShrink: 0,
        boxShadow: "0 10px 22px rgba(15,23,42,0.10)",
        overflow: "hidden",
        border: showImage ? "1px solid #e5e7eb" : "none",
      }}
      title={sender}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={name}
          width={20}
          height={20}
          style={{ display: "block" }}
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

export default function DashboardOverview({
  scanResult,
  email,
  loadingScan,
  toneStyles,
  onRunSampleScan,
  onRunFullScan,
  onGoToPromotions,
  onGoToTopSenders,
  onGoToUnsubscribe,
  onUpgradeClick,
}: DashboardOverviewProps) {
  const categoryData = useMemo(() => getCategoryData(scanResult), [scanResult]);
  const dominantCategory = useMemo(
    () => getDominantCategory(categoryData),
    [categoryData]
  );

  const topSendersRows = useMemo(() => {
    const total = Math.max(scanResult.scanned, 1);

    return [...(scanResult.topSenders || [])]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((item) => ({
        sender: item.sender,
        name: extractSenderName(item.sender),
        email: extractSenderEmail(item.sender),
        initials: getSenderInitials(item.sender),
        emails: item.count,
        percent: Number(((item.count / total) * 100).toFixed(1)),
        accent: getSenderAccent(item.sender),
      }));
  }, [scanResult]);

  const unsubscribeCount = useMemo(
    () =>
      scanResult.topSenders.filter((item) => item.unsubscribeAvailable).length,
    [scanResult.topSenders]
  );

  const [emailVolumeData, setEmailVolumeData] = useState<VolumeHistoryPoint[]>(
    buildFallbackHistory(scanResult)
  );

  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [hoveredSender, setHoveredSender] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;

    const nextPoint: VolumeHistoryPoint = {
      label: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      scanned: scanResult.scanned,
      promotions: scanResult.promotionsFoundInSampleScan,
    };

    try {
      const key = historyStorageKey(email);
      const raw = localStorage.getItem(key);
      const parsed: VolumeHistoryPoint[] = raw ? JSON.parse(raw) : [];

      const alreadyExists = parsed.some(
        (item) =>
          item.scanned === nextPoint.scanned &&
          item.promotions === nextPoint.promotions
      );

      const nextHistory = alreadyExists
        ? normalizeHistory(parsed)
        : normalizeHistory([...parsed, nextPoint]);

      localStorage.setItem(key, JSON.stringify(nextHistory));
      setEmailVolumeData(nextHistory);
    } catch {
      setEmailVolumeData(buildFallbackHistory(scanResult));
    }
  }, [email, scanResult.scanned, scanResult.promotionsFoundInSampleScan]);

  const inlineStats = [
    {
      label: "Emails analyzed",
      value: formatNumber(scanResult.scanned),
      color: "#059669",
    },
    {
      label: "Sender groups",
      value: formatNumber(scanResult.senderGroups),
      color: "#0f172a",
    },
    {
      label: "Promotions",
      value: formatNumber(scanResult.promotionsFoundInSampleScan),
      color: "#f59e0b",
    },
  ];

  const actionItems = [
    {
      id: "promotions",
      title: "Clean Promotions",
      value: `${formatNumber(scanResult.promotionsFoundInSampleScan)} emails`,
      cta: "Clean Now →",
      accent: "#f97316",
      glow: "rgba(249,115,22,0.18)",
      onClick: onGoToPromotions,
    },
    {
      id: "senders",
      title: "Review Top Senders",
      value: `${formatNumber(scanResult.largestSenderCount)} senders`,
      cta: "Review Senders →",
      accent: "#2563eb",
      glow: "rgba(37,99,235,0.18)",
      onClick: onGoToTopSenders,
    },
    {
      id: "unsubscribe",
      title: "Unsubscribe",
      value: `${formatNumber(unsubscribeCount)} subscriptions`,
      cta: "Review Unsubscribes →",
      accent: "#10b981",
      glow: "rgba(16,185,129,0.18)",
      onClick: onGoToUnsubscribe,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gap: "36px",
        paddingBottom: "40px",
      }}
    >
      <section
        style={{
          padding: "8px 4px 0 4px",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "14px",
            padding: "18px 18px 14px 18px",
            borderRadius: "26px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.42) 100%)",
            border: "1px solid rgba(226,232,240,0.9)",
            boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: 900,
                    lineHeight: 1,
                    color: toneStyles.title,
                    letterSpacing: "-0.04em",
                  }}
                >
                  Inbox health: {scanResult.healthScore}%
                </div>
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: "#475569",
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                {formatNumber(scanResult.promotionsFoundInSampleScan)} emails ready for
                cleanup
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <PrimaryButton onClick={onRunSampleScan} disabled={loadingScan}>
                {loadingScan ? "Scanning..." : "Run New Sample Scan"}
              </PrimaryButton>
              <SecondaryButton onClick={onUpgradeClick}>
                Upgrade to Pro
              </SecondaryButton>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "999px",
              background: "rgba(226,232,240,0.9)",
              overflow: "hidden",
              boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)",
            }}
          >
            <div
              style={{
                width: `${scanResult.healthScore}%`,
                height: "100%",
                borderRadius: "999px",
                background: toneStyles.bar,
                boxShadow: "0 0 18px rgba(59,130,246,0.14)",
                transition: "width 240ms ease",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "18px",
              flexWrap: "wrap",
              alignItems: "center",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 700,
              paddingTop: "2px",
            }}
          >
            {inlineStats.map((item, index) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "17px",
                    fontWeight: 900,
                    color: item.color,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {item.value}
                </span>
                <span>{item.label}</span>
                {index < inlineStats.length - 1 ? (
                  <span
                    style={{
                      marginInlineStart: "8px",
                      color: "#cbd5e1",
                      fontWeight: 900,
                    }}
                  >
                    •
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "30px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            padding: "20px 20px 18px 20px",
            borderRadius: "26px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.64) 100%)",
            border: "1px solid rgba(226,232,240,0.9)",
            boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 900,
              color: "#0f172a",
              marginBottom: "10px",
              letterSpacing: "-0.01em",
            }}
          >
            Email Categories
          </div>

          <div
            style={{
              fontSize: "15px",
              color: "#334155",
              marginBottom: "20px",
              lineHeight: 1.55,
            }}
          >
            {dominantCategory ? (
              <>
                Your inbox is dominated by{" "}
                <span style={{ fontWeight: 900 }}>{dominantCategory.name}</span>{" "}
                (
                {Math.round(
                  (dominantCategory.value / Math.max(scanResult.scanned, 1)) * 100
                )}
                %)
              </>
            ) : (
              <>No category data available yet.</>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: "18px",
              alignItems: "center",
            }}
          >
            <div style={{ width: "100%", height: 210, position: "relative" }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                    cornerRadius={10}
                    stroke="none"
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 900,
                    color: "#0f172a",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                  }}
                >
                  {formatNumber(scanResult.scanned)}
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  Total emails
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {categoryData.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px 1fr auto",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 999,
                      background: item.color,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "15px",
                      color: "#334155",
                      fontWeight: 700,
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontSize: "15px",
                      color: "#0f172a",
                      fontWeight: 900,
                    }}
                  >
                    {formatNumber(item.value)}
                  </span>
                </div>
              ))}

              <div
                style={{
                  marginTop: "8px",
                  paddingTop: "12px",
                  borderTop: "1px solid #e5e7eb",
                  fontSize: "13px",
                  color: "#64748b",
                }}
              >
                Based on the latest real scan for <b>{email}</b>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "20px 20px 18px 20px",
            borderRadius: "26px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.64) 100%)",
            border: "1px solid rgba(226,232,240,0.9)",
            boxShadow: "0 16px 34px rgba(15,23,42,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "10px",
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
              Email Volume
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
              Real scan history
            </div>
          </div>

          <div
            style={{
              fontSize: "15px",
              color: "#334155",
              marginBottom: "16px",
              lineHeight: 1.55,
            }}
          >
            This chart grows over time with real scan data from this inbox.
          </div>

          <div
            style={{
              width: "100%",
              height: 250,
              background:
                "linear-gradient(to top, rgba(59,130,246,0.035), transparent)",
              borderRadius: "20px",
            }}
          >
            <ResponsiveContainer>
              <AreaChart
                data={emailVolumeData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="scannedFillFinal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="promotionsFillFinal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomAreaTooltip />} />
                <Area
                  type="monotone"
                  dataKey="scanned"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="url(#scannedFillFinal)"
                  name="Emails scanned"
                />
                <Area
                  type="monotone"
                  dataKey="promotions"
                  stroke="#14b8a6"
                  strokeWidth={3}
                  fill="url(#promotionsFillFinal)"
                  name="Promotions found"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "20px",
        }}
      >
        {actionItems.map((card) => {
          const isHovered = hoveredAction === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              onMouseEnter={() => setHoveredAction(card.id)}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                textAlign: "left",
                borderTop: isHovered
                  ? `1px solid ${card.accent}22`
                  : "1px solid rgba(226,232,240,0.9)",
                borderRight: isHovered
                  ? `1px solid ${card.accent}22`
                  : "1px solid rgba(226,232,240,0.9)",
                borderBottom: isHovered
                  ? `1px solid ${card.accent}22`
                  : "1px solid rgba(226,232,240,0.9)",
                borderLeft: `3px solid ${card.accent}`,
                borderRadius: "24px",
                padding: "20px 20px 18px 20px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,250,251,0.78) 100%)",
                boxShadow: isHovered
                  ? `0 20px 42px ${card.glow}`
                  : "0 14px 28px rgba(15,23,42,0.05)",
                cursor: "pointer",
                transform: isHovered
                  ? "translateY(-3px) scale(1.012)"
                  : "translateY(0) scale(1)",
                transition:
                  "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: card.accent,
                  marginBottom: "14px",
                  boxShadow: `0 0 0 6px ${card.accent}12`,
                }}
              />
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 900,
                  color: "#0f172a",
                  marginBottom: "8px",
                  letterSpacing: "-0.02em",
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#475569",
                  marginBottom: "14px",
                  lineHeight: 1.45,
                }}
              >
                {card.value}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  color: card.accent,
                  fontWeight: 900,
                  fontSize: "14px",
                }}
              >
                {card.cta}
              </div>
            </button>
          );
        })}
      </section>

      <section
        style={{
          padding: "6px 0 0 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "22px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#0f172a",
                marginBottom: "6px",
                letterSpacing: "-0.03em",
              }}
            >
              Top Senders
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              Real sender breakdown from the latest scan
            </div>
          </div>

          <SecondaryButton onClick={onRunSampleScan}>Start New Scan</SecondaryButton>
        </div>

        <div
          style={{
            display: "grid",
            gap: "8px",
          }}
        >
          {topSendersRows.map((row, index) => {
            const rowId = `${row.sender}-${index}`;
            const isHovered = hoveredSender === rowId;

            return (
              <div
                key={rowId}
                onMouseEnter={() => setHoveredSender(rowId)}
                onMouseLeave={() => setHoveredSender(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(260px, 1.5fr) 120px 120px minmax(160px, 220px)",
                  gap: "18px",
                  alignItems: "center",
                  padding: "16px 14px",
                  borderTop: isHovered
                    ? "1px solid rgba(191,219,254,0.85)"
                    : "1px solid transparent",
                  borderRight: isHovered
                    ? "1px solid rgba(191,219,254,0.85)"
                    : "1px solid transparent",
                  borderLeft: isHovered
                    ? "1px solid rgba(191,219,254,0.85)"
                    : "1px solid transparent",
                  borderBottom: isHovered
                    ? "1px solid rgba(191,219,254,0.85)"
                    : index !== topSendersRows.length - 1
                    ? "1px solid rgba(203,213,225,0.55)"
                    : "1px solid transparent",
                  background: isHovered
                    ? "linear-gradient(180deg, rgba(239,246,255,0.85) 0%, rgba(255,255,255,0.95) 100%)"
                    : "transparent",
                  borderRadius: "18px",
                  boxShadow: isHovered
                    ? "0 14px 30px rgba(37,99,235,0.08)"
                    : "none",
                  transition:
                    "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                  transform: isHovered ? "translateY(-1px)" : "translateY(0)",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    minWidth: 0,
                  }}
                >
                  <SenderLogo
                    sender={row.sender}
                    name={row.name}
                    email={row.email}
                    initials={row.initials}
                    accent={row.accent}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 900,
                        color: "#0f172a",
                        lineHeight: 1.3,
                        marginBottom: "4px",
                      }}
                    >
                      {row.name}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        fontWeight: 600,
                        lineHeight: 1.35,
                        wordBreak: "break-word",
                      }}
                    >
                      {row.email || "No sender email available"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  {formatNumber(row.emails)}
                </div>

                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 900,
                    color: "#f97316",
                  }}
                >
                  {row.percent}%
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "10px",
                    borderRadius: "999px",
                    background: "#ede9fe",
                    overflow: "hidden",
                    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(Number(row.percent), 100)}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background:
                        "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                      transition: "width 180ms ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}