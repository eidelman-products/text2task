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

type SmartViewPageProps = {
  title: string;
  count: number;
  viewKey: "unread" | "social" | "jobSearch" | "shopping";
  description: string;
  rows: TopSender[];
  deletingSender: string | null;
  archivingSender: string | null;
  readingSender?: string | null;
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
  onMarkRead?: (item: TopSender) => void;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

function getSenderSubtitle(row: TopSender) {
  if (row.unsubscribeTarget) return row.unsubscribeTarget;
  return row.sender;
}

export default function SmartViewPage({
  title,
  count,
  viewKey,
  description,
  rows,
  deletingSender,
  archivingSender,
  readingSender = null,
  remainingWeeklyCleanup,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
  onMarkRead,
}: SmartViewPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unsubscribe" | "no-unsubscribe" | "20plus" | "5plus"
  >("all");
  const [sort, setSort] = useState<"desc" | "asc" | "az" | "za">("desc");

  const isUnreadView = viewKey === "unread";

  const filteredRows = useMemo(() => {
    let nextRows = [...rows];

    if (search.trim()) {
      const value = search.toLowerCase().trim();
      nextRows = nextRows.filter((row) => {
        const subtitle = getSenderSubtitle(row).toLowerCase();
        return (
          row.sender.toLowerCase().includes(value) ||
          subtitle.includes(value)
        );
      });
    }

    if (filter === "unsubscribe") {
      nextRows = nextRows.filter(
        (row) => row.unsubscribeAvailable && !unsubscribedSenders[row.sender]
      );
    }

    if (filter === "no-unsubscribe") {
      nextRows = nextRows.filter(
        (row) =>
          !row.unsubscribeAvailable || Boolean(unsubscribedSenders[row.sender])
      );
    }

    if (filter === "20plus") {
      nextRows = nextRows.filter((row) => row.count >= 20);
    }

    if (filter === "5plus") {
      nextRows = nextRows.filter((row) => row.count >= 5);
    }

    if (sort === "desc") {
      nextRows.sort((a, b) => b.count - a.count);
    }

    if (sort === "asc") {
      nextRows.sort((a, b) => a.count - b.count);
    }

    if (sort === "az") {
      nextRows.sort((a, b) => a.sender.localeCompare(b.sender));
    }

    if (sort === "za") {
      nextRows.sort((a, b) => b.sender.localeCompare(a.sender));
    }

    return nextRows;
  }, [rows, search, filter, sort, unsubscribedSenders]);

  const bulkUnreadData = useMemo(() => {
    if (!isUnreadView || !onMarkRead || filteredRows.length === 0) return null;

    const allIds = filteredRows.flatMap((row) =>
      Array.isArray(row.ids) ? row.ids : []
    );

    const totalCount = allIds.length;
    const allowedCount =
      plan === "pro" ? totalCount : Math.min(totalCount, remainingWeeklyCleanup);

    const allowedIds = allIds.slice(0, allowedCount);

    return {
      totalCount,
      allowedCount,
      remainingAfterAction: Math.max(0, totalCount - allowedCount),
      item: {
        sender: "All unread senders",
        count: allowedIds.length,
        ids: allowedIds,
        unsubscribeAvailable: false,
        unsubscribeTarget: "",
        unsubscribeMethod: null,
      } satisfies TopSender,
    };
  }, [filteredRows, isUnreadView, onMarkRead, plan, remainingWeeklyCleanup]);

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setSort("desc");
  }

  return (
    <SectionCard title={title} subtitle={description}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "18px",
          padding: "16px 18px",
          borderRadius: "18px",
          background: "#f8fbff",
          border: "1px solid #dbe7ff",
          alignItems: "center",
        }}
      >
        <div
          style={{
            color: "#1e3a8a",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          View: {title}
        </div>

        <div
          style={{
            color: "#0f172a",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          {formatNumber(count)} emails matched
        </div>
      </div>

      {isUnreadView && bulkUnreadData ? (
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
            padding: "14px 16px",
            borderRadius: "18px",
            background: "#f8fbff",
            border: "1px solid #dbe7ff",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              {plan === "pro"
                ? "Mark all unread as read"
                : `Mark ${formatNumber(
                    bulkUnreadData.allowedCount
                  )} unread emails as read`}
            </div>

            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              {plan === "pro" ? (
                <>
                  Clear {formatNumber(bulkUnreadData.totalCount)} unread emails
                  from this current view in one action.
                </>
              ) : bulkUnreadData.allowedCount > 0 ? (
                <>
                  Free plan can mark{" "}
                  <b>{formatNumber(bulkUnreadData.allowedCount)}</b> unread
                  emails as read this week.
                  {bulkUnreadData.remainingAfterAction > 0 ? (
                    <>
                      {" "}
                      <b>{formatNumber(bulkUnreadData.remainingAfterAction)}</b>{" "}
                      emails will remain after this action. Upgrade to Pro to
                      clear all {formatNumber(bulkUnreadData.totalCount)} at
                      once.
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Free plan limit reached. Upgrade to Pro to clear all{" "}
                  {formatNumber(bulkUnreadData.totalCount)} unread emails at
                  once.
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => onMarkRead?.(bulkUnreadData.item)}
            disabled={
              readingSender !== null || bulkUnreadData.allowedCount === 0
            }
            style={{
              height: "48px",
              borderRadius: "14px",
              border:
                readingSender !== null || bulkUnreadData.allowedCount === 0
                  ? "1px solid #cbd5e1"
                  : "none",
              background:
                readingSender !== null || bulkUnreadData.allowedCount === 0
                  ? "#94a3b8"
                  : "#2563eb",
              color: "#ffffff",
              padding: "0 18px",
              fontSize: "14px",
              fontWeight: 900,
              cursor:
                readingSender !== null || bulkUnreadData.allowedCount === 0
                  ? "not-allowed"
                  : "pointer",
              boxShadow:
                readingSender !== null || bulkUnreadData.allowedCount === 0
                  ? "none"
                  : "0 10px 20px rgba(37,99,235,0.25)",
              whiteSpace: "nowrap",
            }}
          >
            {readingSender !== null
              ? "Marking..."
              : plan === "pro"
              ? "Mark all unread as read"
              : `Mark ${formatNumber(bulkUnreadData.allowedCount)} as read`}
          </button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
            padding: "14px",
            border: "1px solid #dbe7ff",
            borderRadius: "20px",
            background: "#fbfcff",
            marginBottom: "10px",
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
            <option value="all">All senders</option>
            <option value="unsubscribe">Has unsubscribe</option>
            <option value="no-unsubscribe">No unsubscribe</option>
            <option value="20plus">20+ emails</option>
            <option value="5plus">5+ emails</option>
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
            {filteredRows.length} of {rows.length} senders
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div
          style={{
            border: "1px solid #dbe7ff",
            borderRadius: "20px",
            padding: "20px",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          No sender groups available in this view.
        </div>
      ) : filteredRows.length === 0 ? (
        <div
          style={{
            border: "1px dashed #dbe7ff",
            borderRadius: "20px",
            padding: "24px",
            color: "#64748b",
            textAlign: "center",
            background: "#fbfcff",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#0f172a",
              marginBottom: "10px",
            }}
          >
            No matching senders found
          </div>

          <div
            style={{
              fontSize: "15px",
              lineHeight: 1.7,
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            Try a different search or clear the current filters to see the full
            list again.
          </div>

          <button
            onClick={clearFilters}
            style={{
              height: 46,
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
          readingSender={readingSender}
          remainingWeeklyCleanup={remainingWeeklyCleanup}
          plan={plan}
          unsubscribedSenders={unsubscribedSenders}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnsubscribe={onUnsubscribe}
          onMarkRead={viewKey === "unread" ? onMarkRead : undefined}
        />
      )}
    </SectionCard>
  );
}