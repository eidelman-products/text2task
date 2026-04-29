type TaskActionMode = "active" | "archived";

type TaskRowActionsProps = {
  taskId: number;
  isDeleting: boolean;
  isCopied: boolean;
  actionMode?: TaskActionMode;
  onCopy: (taskId: number) => void;
  onArchive?: (taskId: number) => void | Promise<void>;
  onRestore?: (taskId: number) => void | Promise<void>;
  onPermanentDelete?: (taskId: number) => void | Promise<void>;
  onDelete?: (taskId: number) => void | Promise<void>;
};

export default function TaskRowActions({
  taskId,
  isDeleting,
  isCopied,
  actionMode = "active",
  onCopy,
  onArchive,
  onRestore,
  onPermanentDelete,
  onDelete,
}: TaskRowActionsProps) {
  const isArchivedMode = actionMode === "archived";

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(taskId);
        }}
        disabled={isDeleting}
        style={{
          ...actionButtonStyle,
          color: isCopied ? "#15803d" : "#2563eb",
          borderColor: isCopied
            ? "rgba(34,197,94,0.18)"
            : "rgba(59,130,246,0.18)",
          background: isCopied
            ? "rgba(240,253,244,0.9)"
            : "rgba(239,246,255,0.9)",
        }}
      >
        {isCopied ? "✓" : "Copy"}
      </button>

      {isArchivedMode ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore?.(taskId);
            }}
            disabled={isDeleting}
            style={{
              ...actionButtonStyle,
              color: "#15803d",
              borderColor: "rgba(34,197,94,0.18)",
              background: "rgba(240,253,244,0.92)",
            }}
          >
            Restore
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPermanentDelete?.(taskId);
            }}
            disabled={isDeleting}
            style={{
              ...actionButtonStyle,
              color: "#dc2626",
              borderColor: "rgba(239,68,68,0.22)",
              background: "rgba(254,242,242,0.95)",
            }}
          >
            {isDeleting ? "..." : "Delete forever"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();

            if (onArchive) {
              onArchive(taskId);
              return;
            }

            onDelete?.(taskId);
          }}
          disabled={isDeleting}
          style={{
            ...actionButtonStyle,
            color: "#c2410c",
            borderColor: "rgba(245,158,11,0.22)",
            background: "rgba(255,251,235,0.95)",
          }}
        >
          {isDeleting ? "..." : "Archive"}
        </button>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "flex-start",
  flexWrap: "wrap",
};

const actionButtonStyle: React.CSSProperties = {
  height: 28,
  padding: "0 10px",
  borderRadius: 9,
  border: "1px solid rgba(203,213,225,0.9)",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
};