"use client";

import { useMemo, useState } from "react";
import SectionCard from "./section-card";
import SenderTable from "./sender-table";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type SenderBucket =
  | "1000+ messages"
  | "500–999 messages"
  | "100–499 messages"
  | "10–99 messages";

type TopSendersViewProps = {
  groupedTopSenders: Record<SenderBucket, TopSender[]>;
  weeklyCleanupUsed: number;
  freeWeeklyLimit: number;
  remainingWeeklyCleanup: number;
  deletingSender: string | null;
  archivingSender: string | null;
  plan: "free" | "pro";
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
};

type FilterOption = "all" | "unsubscribe" | "100plus" | "10to99";
type SortOption = "highest" | "lowest" | "az";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function parseSender(sender: string) {
  const match = sender.match(/^(.*)<(.+)>$/);

  if (!match) {
    return {
      name: sender.trim(),
      email: sender.includes("@") ? sender.trim() : "",
    };
  }

  return {
    name: match[1]?.trim() || "Unknown Sender",
    email: match[2]?.trim() || "",
  };
}

function getBucketLabel(count: number): SenderBucket | null {
  if (count >= 1000) return "1000+ messages";
  if (count >= 500) return "500–999 messages";
  if (count >= 100) return "100–499 messages";
  if (count >= 10) return "10–99 messages";
  return null;
}

function getSortLabel(sortBy: SortOption) {
  if (sortBy === "highest") return "Most emails first";
  if (sortBy === "lowest") return "Least emails first";
  return "A → Z";
}

function getFilterLabel(filterBy: FilterOption) {
  if (filterBy === "all") return "All senders";
  if (filterBy === "unsubscribe") return "Unsubscribe available";
  if (filterBy === "100plus") return "100+ emails";
  return "10–99 emails";
}

export default function TopSendersView({
  groupedTopSenders,
  weeklyCleanupUsed,
  freeWeeklyLimit,
  remainingWeeklyCleanup,
  deletingSender,
  archivingSender,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
}: TopSendersViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("highest");

  const orderedSections: SenderBucket[] = [
    "1000+ messages",
    "500–999 messages",
    "100–499 messages",
    "10–99 messages",
  ];

  const allRows = useMemo(() => {
    return orderedSections.flatMap((label) => groupedTopSenders[label] || []);
  }, [groupedTopSenders]);

  const filteredRows = useMemo(() => {
    let nextRows = [...allRows];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (normalizedQuery) {
      nextRows = nextRows.filter((item) => {
        const parsed = parseSender(item.sender);
        return (
          parsed.name.toLowerCase().includes(normalizedQuery) ||
          parsed.email.toLowerCase().includes(normalizedQuery) ||
          item.sender.toLowerCase().includes(normalizedQuery)
        );
      });
    }

    if (filterBy === "unsubscribe") {
      nextRows = nextRows.filter((item) => item.unsubscribeAvailable);
    }

    if (filterBy === "100plus") {
      nextRows = nextRows.filter((item) => item.count >= 100);
    }

    if (filterBy === "10to99") {
      nextRows = nextRows.filter((item) => item.count >= 10 && item.count <= 99);
    }

    if (sortBy === "highest") {
      nextRows.sort((a, b) => b.count - a.count);
    }

    if (sortBy === "lowest") {
      nextRows.sort((a, b) => a.count - b.count);
    }

    if (sortBy === "az") {
      nextRows.sort((a, b) => {
        const aName = parseSender(a.sender).name.toLowerCase();
        const bName = parseSender(b.sender).name.toLowerCase();
        return aName.localeCompare(bName);
      });
    }

    return nextRows;
  }, [allRows, filterBy, searchQuery, sortBy]);

  const isDefaultView =
    searchQuery.trim() === "" && filterBy === "all" && sortBy === "highest";

  const groupedVisibleRows = useMemo(() => {
    const buckets: Record<SenderBucket, TopSender[]> = {
      "1000+ messages": [],
      "500–999 messages": [],
      "100–499 messages": [],
      "10–99 messages": [],
    };

    for (const item of filteredRows) {
      const label = getBucketLabel(item.count);
      if (!label) continue;
      buckets[label].push(item);
    }

    return buckets;
  }, [filteredRows]);

  const visibleCount = filteredRows.length;
  const totalCount = allRows.length;
  const hasAnyRows = visibleCount > 0;

  const activeViewText = useMemo(() => {
    const pieces: string[] = [];

    if (searchQuery.trim()) {
      pieces.push(`Search: "${searchQuery.trim()}"`);
    }

    pieces.push(getFilterLabel(filterBy));
    pieces.push(getSortLabel(sortBy));

    return pieces.join(" • ");
  }, [filterBy, searchQuery, sortBy]);

  return (
    <SectionCard
      title="Top Senders"
      subtitle="Search, sort, and clean high-volume senders from one place."
    >
      <div
        style={{
          display: "grid",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            padding: "16px 18px",
            borderRadius: "20px",
            background:
              "linear-gradient(180deg, rgba(248,251,255,1) 0%, rgba(255,255,255,0.94) 100%)",
            border: "1px solid #bfd3ff",
            boxShadow: "0 14px 30px rgba(37,99,235,0.06)",
          }}
        >
          <div
            style={{
              color: "#1e3a8a",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            Weekly cleanup used: {weeklyCleanupUsed} / {freeWeeklyLimit}
          </div>

          <div
            style={{
              color: "#15803d",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            {remainingWeeklyCleanup} emails left this week
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 1.5fr) 190px 210px auto",
            gap: "12px",
            alignItems: "center",
            padding: "16px",
            borderRadius: "22px",
            background:
              "linear-gradient(180deg, rgba(248,251,255,1) 0%, rgba(255,255,255,0.96) 100%)",
            border: "1px solid #cfe0ff",
            boxShadow: "0 18px 36px rgba(37,99,235,0.06)",
          }}
        >
          <div
            style={{
              position: "relative",
            }}
          >
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search senders or email address"
              style={{
                width: "100%",
                height: "52px",
                borderRadius: "16px",
                border: "1px solid #bfdbfe",
                background: "#ffffff",
                padding: "0 16px 0 46px",
                fontSize: "15px",
                color: "#0f172a",
                outline: "none",
                fontWeight: 600,
                boxShadow: "0 10px 24px rgba(37,99,235,0.04)",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "15px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#2563eb",
                fontSize: "18px",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
          </div>

          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            style={{
              height: "52px",
              borderRadius: "16px",
              border: "1px solid #bfdbfe",
              background: "#ffffff",
              padding: "0 16px",
              fontSize: "14px",
              color: "#1e3a8a",
              fontWeight: 800,
              outline: "none",
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(37,99,235,0.05)",
            }}
          >
            <option value="all">All senders</option>
            <option value="unsubscribe">Unsubscribe available</option>
            <option value="100plus">100+ emails</option>
            <option value="10to99">10–99 emails</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              height: "52px",
              borderRadius: "16px",
              border: "1px solid #93c5fd",
              background:
                "linear-gradient(180deg, rgba(239,246,255,1) 0%, rgba(255,255,255,1) 100%)",
              padding: "0 16px",
              fontSize: "14px",
              color: "#1d4ed8",
              fontWeight: 900,
              outline: "none",
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(37,99,235,0.09)",
            }}
          >
            <option value="highest">🔥 Most emails first</option>
            <option value="lowest">Least emails first</option>
            <option value="az">A → Z</option>
          </select>

          <div
            style={{
              justifySelf: "end",
              fontSize: "14px",
              color: "#64748b",
              fontWeight: 800,
              whiteSpace: "nowrap",
              background: "#ffffff",
              border: "1px solid #dbe7ff",
              borderRadius: "999px",
              padding: "11px 14px",
              boxShadow: "0 8px 18px rgba(15,23,42,0.03)",
            }}
          >
            {formatNumber(visibleCount)} of {formatNumber(totalCount)} senders
          </div>
        </div>

        {!hasAnyRows ? (
          <div
            style={{
              border: "1px solid #dbe7ff",
              borderRadius: "22px",
              padding: "22px",
              color: "#64748b",
              fontWeight: 700,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.92) 100%)",
            }}
          >
            No sender groups match your current search or filters.
          </div>
        ) : isDefaultView ? (
          <div style={{ display: "grid", gap: "22px" }}>
            {orderedSections.map((label) => {
              const rows = groupedVisibleRows[label];
              if (!rows.length) return null;

              return (
                <div key={label}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: 900,
                        color: "#0f172a",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#64748b",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "999px",
                        padding: "7px 12px",
                      }}
                    >
                      {formatNumber(rows.length)} senders
                    </div>
                  </div>

                  <SenderTable
                    rows={rows}
                    deletingSender={deletingSender}
                    archivingSender={archivingSender}
                    remainingWeeklyCleanup={remainingWeeklyCleanup}
                    plan={plan}
                    unsubscribedSenders={unsubscribedSenders}
                    onDelete={onDelete}
                    onArchive={onArchive}
                    onUnsubscribe={onUnsubscribe}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                    marginBottom: "5px",
                  }}
                >
                  Filtered Results
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#2563eb",
                    fontWeight: 800,
                  }}
                >
                  Showing: {activeViewText}
                </div>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#64748b",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "999px",
                  padding: "7px 12px",
                }}
              >
                {formatNumber(filteredRows.length)} senders
              </div>
            </div>

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
          </div>
        )}
      </div>
    </SectionCard>
  );
}