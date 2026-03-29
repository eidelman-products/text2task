"use client";

import { useMemo, useState } from "react";
import SectionCard from "./section-card";
import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";
import SenderTable from "./sender-table";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type PromotionsViewProps = {
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
  remainingWeeklyCleanup: number;
  cleaningPromotions: boolean;
  cleaningPromotionsStep: "idle" | "checking" | "cleaning" | "refreshing";
  promotionRows: TopSender[];
  deletingSender: string | null;
  archivingSender: string | null;
  plan: "free" | "pro";
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
  onCleanPromotionsBulk: (selectedRows?: TopSender[]) => void;
  onUpgradeClick: () => void;
};

type PromotionCategory =
  | "Shopping"
  | "Travel"
  | "Finance"
  | "SaaS / Tools"
  | "Other";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function getCategory(sender: TopSender): PromotionCategory {
  const text = [
    sender.sender,
    sender.unsubscribeTarget,
    sender.unsubscribeMethod,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    text.includes("aliexpress") ||
    text.includes("amazon") ||
    text.includes("alibaba") ||
    text.includes("banggood") ||
    text.includes("ebay")
  ) {
    return "Shopping";
  }

  if (
    text.includes("agoda") ||
    text.includes("booking") ||
    text.includes("travel") ||
    text.includes("trip")
  ) {
    return "Travel";
  }

  if (
    text.includes("binance") ||
    text.includes("crypto") ||
    text.includes("coin") ||
    text.includes("finance")
  ) {
    return "Finance";
  }

  if (
    text.includes("vidiq") ||
    text.includes("freepik") ||
    text.includes("runway") ||
    text.includes("kling") ||
    text.includes("elevenlabs") ||
    text.includes("tubespanner")
  ) {
    return "SaaS / Tools";
  }

  return "Other";
}

function getSenderSubtitle(row: TopSender) {
  if (row.unsubscribeTarget) return row.unsubscribeTarget;
  return row.sender;
}

function categoryColor(category: PromotionCategory) {
  if (category === "Shopping") return "#f97316";
  if (category === "Travel") return "#14b8a6";
  if (category === "Finance") return "#8b5cf6";
  if (category === "SaaS / Tools") return "#3b82f6";
  return "#cbd5e1";
}

function StatChip({
  children,
  highlight = false,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "7px 11px",
        borderRadius: 999,
        border: highlight ? "1px solid #dbe7ff" : "1px solid #e2e8f0",
        background: highlight ? "#eef4ff" : "#f8fafc",
        color: highlight ? "#2563eb" : "#334155",
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function ActionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: "#ffedd5",
        border: "1px solid #fdba74",
        color: "#c2410c",
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function BulkCleanModal({
  open,
  onClose,
  onConfirm,
  rows,
  remainingWeeklyCleanup,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: TopSender[]) => void;
  rows: TopSender[];
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
}) {
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => b.count - a.count);
  }, [rows]);

  const preview = useMemo(() => {
    if (plan === "pro") {
      return {
        selected: sortedRows,
        skipped: [] as TopSender[],
        selectedCount: sortedRows.reduce((sum, row) => sum + row.count, 0),
      };
    }

    let remaining = remainingWeeklyCleanup;
    const selected: TopSender[] = [];
    const skipped: TopSender[] = [];

    for (const row of sortedRows) {
      if (remaining <= 0) {
        skipped.push(row);
        continue;
      }

      if (row.count <= remaining) {
        selected.push(row);
        remaining -= row.count;
      } else {
        skipped.push(row);
      }
    }

    return {
      selected,
      skipped,
      selectedCount: selected.reduce((sum, row) => sum + row.count, 0),
    };
  }, [sortedRows, remainingWeeklyCleanup, plan]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          maxHeight: "82vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 22,
          border: "1px solid #dbe7ff",
          boxShadow: "0 24px 80px rgba(15,23,42,0.22)",
          padding: 22,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: "#0f172a",
              marginBottom: 6,
            }}
          >
            Clean Promotions
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.7,
              fontWeight: 600,
            }}
          >
            {plan === "pro"
              ? `You're about to clean ${formatNumber(
                  preview.selectedCount
                )} emails from ${preview.selected.length} sender groups.`
              : `You can clean ${formatNumber(
                  preview.selectedCount
                )} emails on the Free plan this week. We selected the biggest senders first.`}
          </div>
        </div>

        {plan === "free" && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              padding: 12,
              borderRadius: 14,
              marginBottom: 14,
              fontSize: 13,
              fontWeight: 700,
              color: "#9a3412",
              lineHeight: 1.7,
            }}
          >
            Free plan limit: {formatNumber(remainingWeeklyCleanup)} emails this
            week. Upgrade to Pro to clean everything with no limit.
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "#64748b",
            letterSpacing: "0.06em",
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          Included now
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {preview.selected.map((row) => (
            <div
              key={`selected-${row.sender}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a" }}>
                {row.sender}
              </div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {formatNumber(row.count)}
              </div>
            </div>
          ))}
        </div>

        {preview.skipped.length > 0 && (
          <>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "#94a3b8",
                letterSpacing: "0.06em",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              Not included this week
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {preview.skipped.map((row) => (
                <div
                  key={`skipped-${row.sender}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    opacity: 0.72,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#475569" }}>
                    {row.sender}
                  </div>
                  <div style={{ fontWeight: 800, color: "#475569" }}>
                    {formatNumber(row.count)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              fontWeight: 700,
            }}
          >
            {plan === "free" && preview.skipped.length > 0
              ? `Upgrade to Pro to clean all ${formatNumber(
                  sortedRows.reduce((sum, row) => sum + row.count, 0)
                )} emails.`
              : `Ready to clean ${formatNumber(preview.selectedCount)} emails.`}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                height: 46,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 800,
                padding: "0 18px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={() => onConfirm(preview.selected)}
              style={{
                height: 46,
                borderRadius: 12,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 900,
                padding: "0 18px",
                cursor: "pointer",
              }}
            >
              Clean {formatNumber(preview.selectedCount)} Emails
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromotionsView({
  promotionsFoundInSampleScan,
  fullInboxPromotionsCount,
  remainingWeeklyCleanup,
  cleaningPromotions,
  cleaningPromotionsStep,
  promotionRows,
  deletingSender,
  archivingSender,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
  onCleanPromotionsBulk,
  onUpgradeClick,
}: PromotionsViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unsubscribe" | "no-unsubscribe" | "50plus" | "10plus"
  >("all");
  const [sort, setSort] = useState<"desc" | "asc" | "az" | "za">("desc");
  const [showBulkModal, setShowBulkModal] = useState(false);

  const totalPromotions =
    fullInboxPromotionsCount !== null
      ? fullInboxPromotionsCount
      : promotionsFoundInSampleScan;

  const cleanNowCount =
    plan === "pro"
      ? totalPromotions
      : Math.min(totalPromotions, remainingWeeklyCleanup);

  const categoryData = useMemo(() => {
    const totals: Record<PromotionCategory, number> = {
      Shopping: 0,
      Travel: 0,
      Finance: 0,
      "SaaS / Tools": 0,
      Other: 0,
    };

    for (const row of promotionRows) {
      totals[getCategory(row)] += row.count;
    }

    return ([
      { label: "Shopping" as PromotionCategory, value: totals["Shopping"] },
      { label: "Travel" as PromotionCategory, value: totals["Travel"] },
      { label: "Finance" as PromotionCategory, value: totals["Finance"] },
      {
        label: "SaaS / Tools" as PromotionCategory,
        value: totals["SaaS / Tools"],
      },
      { label: "Other" as PromotionCategory, value: totals["Other"] },
    ] as const)
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [promotionRows]);

  const dominantCategory = categoryData[0];

  const filteredRows = useMemo(() => {
    let rows = [...promotionRows];

    if (search.trim()) {
      const value = search.toLowerCase().trim();
      rows = rows.filter((row) => {
        const subtitle = getSenderSubtitle(row).toLowerCase();
        return (
          row.sender.toLowerCase().includes(value) ||
          subtitle.includes(value)
        );
      });
    }

    if (filter === "unsubscribe") {
      rows = rows.filter(
        (row) => row.unsubscribeAvailable && !unsubscribedSenders[row.sender]
      );
    }

    if (filter === "no-unsubscribe") {
      rows = rows.filter(
        (row) =>
          !row.unsubscribeAvailable || Boolean(unsubscribedSenders[row.sender])
      );
    }

    if (filter === "50plus") {
      rows = rows.filter((row) => row.count >= 50);
    }

    if (filter === "10plus") {
      rows = rows.filter((row) => row.count >= 10);
    }

    if (sort === "desc") {
      rows.sort((a, b) => b.count - a.count);
    }

    if (sort === "asc") {
      rows.sort((a, b) => a.count - b.count);
    }

    if (sort === "az") {
      rows.sort((a, b) => a.sender.localeCompare(b.sender));
    }

    if (sort === "za") {
      rows.sort((a, b) => b.sender.localeCompare(a.sender));
    }

    return rows;
  }, [promotionRows, search, filter, sort, unsubscribedSenders]);

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setSort("desc");
  }

  return (
    <>
      <SectionCard
        title="Clean Promotions"
        subtitle="Review senders and remove marketing emails fast."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 14,
            alignItems: "start",
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "#64748b",
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              You stay in control. Nothing is deleted without your confirmation.
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  transform: "scale(1.03)",
                  transformOrigin: "left center",
                  boxShadow: "0 8px 20px rgba(37,99,235,0.25)",
                  borderRadius: 14,
                }}
              >
                <PrimaryButton
                  onClick={() => setShowBulkModal(true)}
                  disabled={cleaningPromotions || cleanNowCount <= 0}
                >
                  {cleaningPromotions
                    ? "Cleaning Promotions..."
                    : `Clean ${formatNumber(cleanNowCount)} Promotions`}
                </PrimaryButton>
              </div>

              <ActionBadge>Recommended</ActionBadge>

              {plan === "free" && (
  <SecondaryButton onClick={onUpgradeClick}>
    Upgrade to Pro
  </SecondaryButton>
)}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <StatChip>{formatNumber(totalPromotions)} found</StatChip>
              <StatChip>
                {formatNumber(remainingWeeklyCleanup)} left this week
              </StatChip>
              <StatChip highlight>
                Plan: {plan === "pro" ? "Pro" : "Free"}
              </StatChip>
              <StatChip>Sample results</StatChip>
            </div>

            {plan === "free" && totalPromotions > remainingWeeklyCleanup ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  color: "#9a3412",
                  fontSize: 13,
                  fontWeight: 800,
                  lineHeight: 1.45,
                }}
              >
                <span>⚡</span>
                <span>
                  Free plan can clean{" "}
                  <b>{formatNumber(remainingWeeklyCleanup)}</b> emails this
                  week. Upgrade to Pro to clean all{" "}
                  <b>{formatNumber(totalPromotions)}</b> promotions at once.
                </span>
              </div>
            ) : null}
          </div>

          <div
            style={{
              padding: 4,
              alignSelf: "stretch",
              borderRadius: 18,
              background: "#fcfdff",
              border: "1px solid #edf2ff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
                marginBottom: 8,
                padding: "8px 8px 0 8px",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Promotion breakdown
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "6px 10px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                1,000-email sample
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                lineHeight: 1.45,
                color: "#64748b",
                fontWeight: 600,
                marginBottom: 10,
                padding: "0 8px",
              }}
            >
              Dominated by{" "}
              <b style={{ color: "#0f172a" }}>
                {dominantCategory?.label || "Other"}
              </b>
              {dominantCategory && totalPromotions > 0
                ? ` (${Math.round(
                    (dominantCategory.value / totalPromotions) * 100
                  )}%)`
                : ""}
              .
            </div>

            <div style={{ display: "grid", gap: 8, padding: "0 8px 8px 8px" }}>
              {categoryData.map((item) => {
                const percent =
                  totalPromotions > 0
                    ? Math.round((item.value / totalPromotions) * 100)
                    : 0;

                return (
                  <div key={item.label}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto auto",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: categoryColor(item.label),
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.label}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontWeight: 700,
                          minWidth: 34,
                          textAlign: "right",
                        }}
                      >
                        {percent}%
                      </span>

                      <span
                        style={{
                          fontSize: 13,
                          color: "#0f172a",
                          fontWeight: 800,
                          minWidth: 26,
                          textAlign: "right",
                        }}
                      >
                        {formatNumber(item.value)}
                      </span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: 5,
                        borderRadius: 999,
                        background: "#e8eef8",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: categoryColor(item.label),
                          opacity: 0.92,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {cleaningPromotions ? (
          <div
            style={{
              background: "#f8fbff",
              border: "1px solid #dbe7ff",
              borderRadius: 16,
              padding: 12,
              marginBottom: 10,
              color: "#1e3a8a",
              fontWeight: 700,
              lineHeight: 1.7,
              fontSize: 13,
            }}
          >
            <div>Cleaning promotions...</div>
            <div
              style={{
                opacity: cleaningPromotionsStep === "checking" ? 1 : 0.55,
              }}
            >
              1/3 Checking cleanup quota
            </div>
            <div
              style={{
                opacity: cleaningPromotionsStep === "cleaning" ? 1 : 0.55,
              }}
            >
              2/3 Cleaning emails in Gmail
            </div>
            <div
              style={{
                opacity: cleaningPromotionsStep === "refreshing" ? 1 : 0.55,
              }}
            >
              3/3 Refreshing dashboard results
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            padding: 14,
            border: "1px solid #dbe7ff",
            borderRadius: 20,
            background: "#fbfcff",
            marginBottom: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 18,
                color: "#64748b",
              }}
            >
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by sender (AliExpress, Binance...)"
              style={{
                width: "100%",
                height: 50,
                borderRadius: 16,
                border: "1px solid #cdd7eb",
                background: "#ffffff",
                paddingLeft: 46,
                paddingRight: 14,
                fontSize: 15,
                fontWeight: 600,
                color: "#0f172a",
                outline: "none",
              }}
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{
              height: 50,
              minWidth: 198,
              borderRadius: 16,
              border: "1px solid #cdd7eb",
              background: "#ffffff",
              padding: "0 16px",
              fontSize: 15,
              fontWeight: 700,
              color: "#1d4ed8",
              outline: "none",
            }}
          >
            <option value="all">All promotions</option>
            <option value="unsubscribe">Has unsubscribe</option>
            <option value="no-unsubscribe">No unsubscribe</option>
            <option value="50plus">50+ emails</option>
            <option value="10plus">10+ emails</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            style={{
              height: 50,
              minWidth: 198,
              borderRadius: 16,
              border: "1px solid #cdd7eb",
              background: "#ffffff",
              padding: "0 16px",
              fontSize: 15,
              fontWeight: 700,
              color: "#1d4ed8",
              outline: "none",
            }}
          >
            <option value="desc">🔥 Most emails first</option>
            <option value="asc">Least emails first</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </select>

          <div
            style={{
              height: 50,
              padding: "0 16px",
              borderRadius: 16,
              border: "1px solid #dbe7ff",
              background: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              color: "#64748b",
              fontWeight: 700,
            }}
          >
            {filteredRows.length} of {promotionRows.length} senders
          </div>
        </div>

        {promotionRows.length === 0 ? (
          <div
            style={{
              border: "1px dashed #dbe7ff",
              borderRadius: 24,
              padding: 28,
              color: "#64748b",
              textAlign: "center",
              background: "#fbfcff",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 10,
              }}
            >
              No promotions found
            </div>
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.8,
                fontWeight: 600,
              }}
            >
              Your latest sample scan did not find promotion sender groups to
              review here yet.
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            style={{
              border: "1px dashed #dbe7ff",
              borderRadius: 24,
              padding: 28,
              color: "#64748b",
              textAlign: "center",
              background: "#fbfcff",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 10,
              }}
            >
              No matching promotions found
            </div>
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.8,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              Try a different search or clear the current filters to restore the
              full sender list.
            </div>
            <button
              onClick={clearFilters}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid #bfd0fb",
                background: "#ffffff",
                color: "#2563eb",
                fontWeight: 800,
                padding: "0 18px",
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <SenderTable
            rows={filteredRows}
            deletingSender={deletingSender}
            archivingSender={archivingSender}
            remainingWeeklyCleanup={remainingWeeklyCleanup}
            plan={plan}
            unsubscribedSenders={unsubscribedSenders}
            onDelete={onDelete}
            onArchive={onArchive}
            onUnsubscribe={onUnsubscribe}
          />
        )}

        {promotionRows.length > 0 ? (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <div>Based on your latest 1,000-email sample scan.</div>
            <div>
              Cleanup left this week:{" "}
              <b style={{ color: "#0f172a" }}>
                {formatNumber(remainingWeeklyCleanup)}
              </b>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <BulkCleanModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onConfirm={(selected) => {
          setShowBulkModal(false);
          onCleanPromotionsBulk(selected);
        }}
        rows={promotionRows}
        remainingWeeklyCleanup={remainingWeeklyCleanup}
        plan={plan}
      />
    </>
  );
}