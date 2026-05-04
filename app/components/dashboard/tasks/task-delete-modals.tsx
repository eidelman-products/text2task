import type { CSSProperties } from "react";
import type { TaskRow } from "./task-types";

type TaskDeleteModalsProps = {
  singleDeleteTask: TaskRow | null;
  selectedCount: number;
  showBulkDeleteConfirm: boolean;
  isSingleDeleting: boolean;
  isBulkDeleting: boolean;
  onCloseSingleDeleteConfirm: () => void;
  onConfirmSinglePermanentDelete: () => Promise<void> | void;
  onCloseBulkDeleteConfirm: () => void;
  onConfirmBulkPermanentDelete: () => Promise<void> | void;
};

export default function TaskDeleteModals({
  singleDeleteTask,
  selectedCount,
  showBulkDeleteConfirm,
  isSingleDeleting,
  isBulkDeleting,
  onCloseSingleDeleteConfirm,
  onConfirmSinglePermanentDelete,
  onCloseBulkDeleteConfirm,
  onConfirmBulkPermanentDelete,
}: TaskDeleteModalsProps) {
  return (
    <>
      {singleDeleteTask && (
        <div style={modalOverlayStyle} onClick={onCloseSingleDeleteConfirm}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete task permanently confirmation"
          >
            <div style={modalIconDangerStyle}>!</div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={modalTitleStyle}>Delete permanently?</div>
              <div style={modalTextStyle}>
                <strong>{singleDeleteTask.task || "This task"}</strong> will be
                permanently deleted from your Archive. This cannot be undone.
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={onCloseSingleDeleteConfirm}
                style={modalSecondaryButtonStyle}
                disabled={isSingleDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onConfirmSinglePermanentDelete}
                style={modalDeleteButtonStyle}
                disabled={isSingleDeleting}
              >
                {isSingleDeleting ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div style={modalOverlayStyle} onClick={onCloseBulkDeleteConfirm}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete selected tasks confirmation"
          >
            <div style={modalIconDangerStyle}>!</div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={modalTitleStyle}>Delete selected tasks forever?</div>
              <div style={modalTextStyle}>
                You are about to permanently delete{" "}
                <strong>{selectedCount} selected task(s)</strong> from Archive.
                This cannot be undone.
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={onCloseBulkDeleteConfirm}
                style={modalSecondaryButtonStyle}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onConfirmBulkPermanentDelete}
                style={modalDeleteButtonStyle}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1200,
  backdropFilter: "blur(5px)",
};

const modalCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  borderRadius: 22,
  border: "1px solid rgba(226,232,240,0.96)",
  background: "#ffffff",
  boxShadow: "0 28px 60px rgba(15,23,42,0.20)",
  padding: 22,
  display: "grid",
  gap: 18,
};

const modalIconDangerStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(254,242,242,1)",
  border: "1px solid rgba(239,68,68,0.18)",
  color: "#dc2626",
  fontSize: 22,
  fontWeight: 950,
};

const modalTitleStyle: CSSProperties = {
  fontSize: 21,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.04em",
};

const modalTextStyle: CSSProperties = {
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.65,
};

const modalActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const modalSecondaryButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid rgba(203,213,225,0.96)",
  background: "#ffffff",
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const modalDeleteButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.20)",
  background: "rgba(239,68,68,0.94)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};