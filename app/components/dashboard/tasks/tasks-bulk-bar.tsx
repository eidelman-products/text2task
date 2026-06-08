import type { CSSProperties } from "react";
import type { TaskArchiveView } from "./task-types";

type TasksBulkBarProps = {
  selectedCount: number;
  archiveView: TaskArchiveView;
  onBulkStatus: (nextStatus: string) => Promise<void> | void;
  onBulkArchive: () => Promise<void> | void;
  onBulkRestore: () => Promise<void> | void;
  onOpenBulkDeleteConfirm: () => void;
  onClearSelection: () => void;
};

export default function TasksBulkBar({
  selectedCount,
  archiveView,
  onBulkStatus,
  onBulkArchive,
  onBulkRestore,
  onOpenBulkDeleteConfirm,
  onClearSelection,
}: TasksBulkBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="tasks-bulk-bar" style={bulkBarStyle}>
      <div style={bulkCountStyle}>{selectedCount} selected</div>

      {archiveView !== "archived" ? (
        <>
          <button
            type="button"
            onClick={() => onBulkStatus("Done")}
            style={bulkActionButtonStyle}
          >
            Mark Done
          </button>

          <button
            type="button"
            onClick={() => onBulkStatus("In Progress")}
            style={bulkActionButtonStyle}
          >
            Mark In Progress
          </button>

          <button
            type="button"
            onClick={onBulkArchive}
            style={bulkArchiveButtonStyle}
          >
            Move to Archive
          </button>

          <button
            type="button"
            onClick={onOpenBulkDeleteConfirm}
            style={bulkDeleteButtonStyle}
          >
            Delete
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onBulkRestore}
            style={bulkRestoreButtonStyle}
          >
            Restore selected
          </button>

          <button
            type="button"
            onClick={onOpenBulkDeleteConfirm}
            style={bulkDeleteButtonStyle}
          >
            Delete permanently
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onClearSelection}
        style={bulkSecondaryButtonStyle}
      >
        Clear
      </button>
    </div>
  );
}

const bulkBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flexWrap: "wrap",
  padding: "10px 12px",
  borderRadius: 15,
  border: "1px solid rgba(147,197,253,0.64)",
  borderLeft: "3px solid #2563eb",
  background: "rgba(248,251,255,0.96)",
  color: "#0f172a",
  boxShadow: "0 10px 24px rgba(37,99,235,0.055)",
};

const bulkCountStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 950,
  color: "#1d4ed8",
  marginRight: 3,
};

const bulkActionButtonStyle: CSSProperties = {
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(203,213,225,0.78)",
  background: "#ffffff",
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(15,23,42,0.025)",
};

const bulkArchiveButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(255,251,235,0.86)",
  border: "1px solid rgba(253,230,138,0.9)",
  color: "#92400e",
};

const bulkRestoreButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(240,253,244,0.9)",
  border: "1px solid rgba(187,247,208,0.9)",
  color: "#067647",
};

const bulkDeleteButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(254,242,242,0.9)",
  border: "1px solid rgba(254,202,202,0.92)",
  color: "#b91c1c",
};

const bulkSecondaryButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "transparent",
  color: "#64748b",
};