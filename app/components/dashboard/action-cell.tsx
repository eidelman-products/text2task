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
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
  isUnsubscribed?: boolean;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe?: (item: TopSender) => void;
};

export default function ActionCell({
  item,
  deletingSender,
  archivingSender,
  remainingWeeklyCleanup,
  plan,
  isUnsubscribed = false,
  onDelete,
  onArchive,
  onUnsubscribe,
}: ActionCellProps) {
  const isDeleting = deletingSender === item.sender;
  const isArchiving = archivingSender === item.sender;
  const overFreeLimit = plan === "free" && item.count > remainingWeeklyCleanup;

  const actionsDisabled = isDeleting || isArchiving;

  const canUnsubscribe =
    typeof onUnsubscribe === "function" &&
    Boolean(item.unsubscribeAvailable) &&
    Boolean(item.unsubscribeTarget);

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
          }}
        >
          Unsubscribe
        </button>
      ) : null}

      <button
        onClick={() => onDelete(item)}
        disabled={isDeleting || isArchiving || overFreeLimit}
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
            isDeleting || isArchiving || overFreeLimit
              ? "not-allowed"
              : "pointer",
          boxShadow:
            isDeleting || overFreeLimit
              ? "none"
              : "0 10px 20px rgba(220, 38, 38, 0.18)",
          whiteSpace: "nowrap",
        }}
      >
        {isDeleting ? "Moving..." : "Move to Trash"}
      </button>

      <button
        onClick={() => onArchive(item)}
        disabled={isDeleting || isArchiving || overFreeLimit}
        style={{
          background: "#ffffff",
          color:
            isDeleting || isArchiving || overFreeLimit
              ? "#94a3b8"
              : "#2563eb",
          border: "1px solid #bfd3ff",
          padding: "10px 16px",
          borderRadius: "14px",
          fontWeight: 800,
          fontSize: "14px",
          cursor:
            isDeleting || isArchiving || overFreeLimit
              ? "not-allowed"
              : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {isArchiving ? "Archiving..." : "Archive"}
      </button>

      {overFreeLimit ? (
        <span
          style={{
            border: "1px solid #f59e0b",
            color: "#b45309",
            background: "#fffbeb",
            borderRadius: "999px",
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Pro for larger batch
        </span>
      ) : null}
    </div>
  );
}