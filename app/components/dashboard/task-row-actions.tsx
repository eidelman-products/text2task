import type { CSSProperties } from "react";

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
  pendingAction?: "archive" | "restore" | "delete" | null;
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
  pendingAction = null,
}: TaskRowActionsProps) {
  const isArchivedMode = actionMode === "archived";

  return (
    <div className="task-row-actions" style={containerStyle}>
      <style>{actionsCss}</style>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(taskId);
        }}
        disabled={isDeleting}
        className="task-row-action-button"
        style={{
          ...baseButtonStyle,
          ...(isCopied ? copiedButtonStyle : copyButtonStyle),
        }}
      >
        <span style={buttonDotStyle(isCopied ? "green" : "blue")} />
        {isCopied ? "Copied" : "Copy"}
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
            className="task-row-action-button"
            style={{
              ...baseButtonStyle,
              ...restoreButtonStyle,
            }}
          >
            <span style={buttonDotStyle("green")} />
            {pendingAction === "restore" ? "Restoring" : "Restore"}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPermanentDelete?.(taskId);
            }}
            disabled={isDeleting}
            className="task-row-action-button"
            style={{
              ...baseButtonStyle,
              ...dangerButtonStyle,
            }}
          >
            <span style={buttonDotStyle("red")} />
            {pendingAction === "delete" || (isDeleting && !pendingAction)
              ? "Deleting"
              : "Delete"}
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
          className="task-row-action-button"
          style={{
            ...baseButtonStyle,
            ...archiveButtonStyle,
          }}
        >
          <span style={buttonDotStyle("orange")} />
          {pendingAction === "archive" || (isDeleting && !pendingAction)
            ? "Archiving"
            : "Archive"}
        </button>
      )}
    </div>
  );
}

function buttonDotStyle(tone: "blue" | "green" | "orange" | "red"): CSSProperties {
  const palette = {
    blue: "#3b82f6",
    green: "#22c55e",
    orange: "#f97316",
    red: "#ef4444",
  }[tone];

  return {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: palette,
    boxShadow: `0 0 0 3px ${palette}1f`,
    flexShrink: 0,
  };
}

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 7,
  flexWrap: "wrap",
};

const baseButtonStyle: CSSProperties = {
  height: 30,
  minWidth: 0,
  padding: "0 11px",
  borderRadius: 999,
  border: "1px solid rgba(226,232,240,0.92)",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  whiteSpace: "nowrap",
  boxShadow:
    "0 1px 2px rgba(15,23,42,0.035), inset 0 1px 0 rgba(255,255,255,0.86)",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease, opacity 160ms ease",
};

const copyButtonStyle: CSSProperties = {
  color: "#2563eb",
  borderColor: "rgba(191,219,254,0.92)",
  background:
    "linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(255,255,255,0.96) 100%)",
};

const copiedButtonStyle: CSSProperties = {
  color: "#15803d",
  borderColor: "rgba(187,247,208,0.96)",
  background:
    "linear-gradient(135deg, rgba(240,253,244,0.98) 0%, rgba(255,255,255,0.96) 100%)",
};

const archiveButtonStyle: CSSProperties = {
  color: "#c2410c",
  borderColor: "rgba(254,215,170,0.94)",
  background:
    "linear-gradient(135deg, rgba(255,247,237,0.98) 0%, rgba(255,255,255,0.96) 100%)",
};

const restoreButtonStyle: CSSProperties = {
  color: "#15803d",
  borderColor: "rgba(187,247,208,0.96)",
  background:
    "linear-gradient(135deg, rgba(240,253,244,0.98) 0%, rgba(255,255,255,0.96) 100%)",
};

const dangerButtonStyle: CSSProperties = {
  color: "#dc2626",
  borderColor: "rgba(254,202,202,0.96)",
  background:
    "linear-gradient(135deg, rgba(254,242,242,0.98) 0%, rgba(255,255,255,0.96) 100%)",
};

const actionsCss = `
  .task-row-action-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow:
      0 10px 22px rgba(15,23,42,0.075),
      inset 0 1px 0 rgba(255,255,255,0.92) !important;
  }

  .task-row-action-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .task-row-action-button:disabled {
    opacity: 0.58;
    cursor: not-allowed;
    transform: none !important;
  }

  @media (max-width: 520px) {
    .task-row-actions {
      width: 100%;
      gap: 8px !important;
    }

    .task-row-action-button {
      min-height: 34px !important;
      flex: 1 1 auto;
    }
  }
`;
