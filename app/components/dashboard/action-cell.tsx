type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
};

type ActionCellProps = {
  item: TopSender;
  deletingSender: string | null;
  archivingSender: string | null;
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
};

export default function ActionCell({
  item,
  deletingSender,
  archivingSender,
  remainingWeeklyCleanup,
  plan,
  onDelete,
  onArchive,
}: ActionCellProps) {
  const isDeleting = deletingSender === item.sender;
  const isArchiving = archivingSender === item.sender;
  const overFreeLimit = plan === "free" && item.count > remainingWeeklyCleanup;

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