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
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onBulkRestore}
            style={bulkActionButtonStyle}
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
  gap: 10,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.08)",
  background: "#0f172a",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
};

const bulkCountStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  marginRight: 4,
};

const bulkActionButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.10)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const bulkArchiveButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(245,158,11,0.18)",
  border: "1px solid rgba(245,158,11,0.26)",
};

const bulkDeleteButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "rgba(239,68,68,0.18)",
  border: "1px solid rgba(239,68,68,0.24)",
};

const bulkSecondaryButtonStyle: CSSProperties = {
  ...bulkActionButtonStyle,
  background: "transparent",
};