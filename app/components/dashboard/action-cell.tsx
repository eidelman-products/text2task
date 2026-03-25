"use client";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type ActionCellProps = {
  item: TopSender;
  deletingSender: string | null;
  archivingSender: string | null;
  readingSender?: string | null;
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
  isUnsubscribed?: boolean;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe?: (item: TopSender) => void;
  onMarkRead?: (item: TopSender) => void;
};

export default function ActionCell({
  item,
  deletingSender,
  archivingSender,
  readingSender = null,
  remainingWeeklyCleanup,
  plan,
  isUnsubscribed = false,
  onDelete,
  onArchive,
  onUnsubscribe,
  onMarkRead,
}: ActionCellProps) {
  const isDeleting = deletingSender === item.sender;
  const isArchiving = archivingSender === item.sender;
  const isReading = readingSender === item.sender;

  const overFreeLimit = plan === "free" && item.count > remainingWeeklyCleanup;

  const actionsDisabled = isDeleting || isArchiving || isReading;

  const canUnsubscribe =
    typeof onUnsubscribe === "function" &&
    Boolean(item.unsubscribeAvailable) &&
    Boolean(item.unsubscribeTarget);

  const canMarkRead = typeof onMarkRead === "function";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {isUnsubscribed ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span
            style={{
              border: "1px solid #86efac",
              color: "#166534",
              background: "#f0fdf4",
              borderRadius: "999px",
              padding: "8px 12px",
              fontSize: "13px",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            ✓ Unsubscribed
          </span>

          <span
            style={{
              fontSize: "11px",
              color: "#64748b",
              fontWeight: 600,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            Future emails may stop
          </span>
        </div>
      ) : canUnsubscribe ? (
        <button
          onClick={() => onUnsubscribe?.(item)}
          disabled={actionsDisabled}
          style={{
            background: "#ffffff",
            color: actionsDisabled ? "#94a3b8" : "#0f766e",
            border: "1px solid #99f6e4",
            padding: "10px 16px",
            borderRadius: "14px",
            fontWeight: 800,
            fontSize: "14px",
            cursor: actionsDisabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            boxShadow: actionsDisabled
              ? "none"
              : "0 6px 14px rgba(15,118,110,0.06)",
            transition: "all 160ms ease",
          }}
        >
          Unsubscribe
        </button>
      ) : null}

      {canMarkRead ? (
        <button
          onClick={() => onMarkRead?.(item)}
          disabled={actionsDisabled}
          style={{
            background: "#ffffff",
            color: actionsDisabled ? "#94a3b8" : "#334155",
            border: "1px solid #cbd5e1",
            padding: "10px 16px",
            borderRadius: "14px",
            fontWeight: 800,
            fontSize: "14px",
            cursor: actionsDisabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            boxShadow: actionsDisabled
              ? "none"
              : "0 6px 14px rgba(51,65,85,0.05)",
            transition: "all 160ms ease",
          }}
        >
          {isReading ? "Marking..." : "Mark as Read"}
        </button>
      ) : null}

      <button
        onClick={() => onDelete(item)}
        disabled={isDeleting || isArchiving || isReading || overFreeLimit}
        title={
          overFreeLimit && plan === "free"
            ? "Upgrade to Pro to clean larger sender groups"
            : undefined
        }
        style={{
          background:
            isDeleting || overFreeLimit
              ? "#94a3b8"
              : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          color: "white",
          border: "none",
          padding: "10px 16px",
          borderRadius: "14px",
          fontWeight: 800,
          fontSize: "14px",
          cursor:
            isDeleting || isArchiving || isReading || overFreeLimit
              ? "not-allowed"
              : "pointer",
          boxShadow:
            isDeleting || overFreeLimit
              ? "none"
              : "0 6px 14px rgba(220,38,38,0.12)",
          transition: "all 160ms ease",
          whiteSpace: "nowrap",
          opacity: overFreeLimit ? 0.85 : 1,
        }}
      >
        {isDeleting ? "Moving..." : "Move to Trash"}
      </button>

      <button
        onClick={() => onArchive(item)}
        disabled={isDeleting || isArchiving || isReading || overFreeLimit}
        title={
          overFreeLimit && plan === "free"
            ? "Upgrade to Pro to archive larger sender groups"
            : undefined
        }
        style={{
          background: "#ffffff",
          color:
            isDeleting || isArchiving || isReading || overFreeLimit
              ? "#94a3b8"
              : "#2563eb",
          border: "1px solid #bfd3ff",
          padding: "10px 16px",
          borderRadius: "14px",
          fontWeight: 800,
          fontSize: "14px",
          cursor:
            isDeleting || isArchiving || isReading || overFreeLimit
              ? "not-allowed"
              : "pointer",
          whiteSpace: "nowrap",
          boxShadow:
            isDeleting || isArchiving || isReading || overFreeLimit
              ? "none"
              : "0 6px 14px rgba(37,99,235,0.05)",
          transition: "all 160ms ease",
          opacity: overFreeLimit ? 0.7 : 1,
        }}
      >
        {isArchiving ? "Archiving..." : "Archive"}
      </button>
    </div>
  );
}