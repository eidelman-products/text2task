type TaskRowActionsProps = {
  taskId: number;
  isDeleting: boolean;
  isCopied: boolean;
  onCopy: (taskId: number) => void;
  onDelete: (taskId: number) => void;
};

export default function TaskRowActions({
  taskId,
  isDeleting,
  isCopied,
  onCopy,
  onDelete,
}: TaskRowActionsProps) {
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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(taskId);
        }}
        disabled={isDeleting}
        style={{
          ...actionButtonStyle,
          color: "#dc2626",
          borderColor: "rgba(239,68,68,0.18)",
          background: "rgba(254,242,242,0.9)",
        }}
      >
        {isDeleting ? "..." : "Delete"}
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "flex-start",
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