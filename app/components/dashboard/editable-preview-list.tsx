"use client";

import EditablePreviewCard from "./editable-preview-card";
import type {
  ExtractedPreview,
  HybridAppliedChange,
  HybridPreviewMeta,
} from "@/lib/preview/hybrid-preview";

type DuplicateWarning = {
  existingTaskId: number;
  existingTask: string;
  existingClient: string;
  existingDeadline: string;
  existingCreatedAt: string;
};

type EditablePreviewListProps = {
  previewItems: ExtractedPreview[];
  aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
  duplicateWarnings: Record<string, DuplicateWarning>;
  savingPreviewIds: Record<string, boolean>;
  onSaveDuplicateAnyway: (previewId: string) => void;
  onSkipDuplicate: (previewId: string) => void;
  onChange: (
    index: number,
    field: keyof Omit<ExtractedPreview, "previewId">,
    value: string
  ) => void;
  onUndoChange: (previewId: string, change: HybridAppliedChange) => void;
};

function buildPreviewRenderKey(preview: ExtractedPreview) {
  return preview.previewId;
}

function formatCreatedAtLabel(value: string) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function EditablePreviewList({
  previewItems,
  aiMetaByPreviewId,
  duplicateWarnings,
  savingPreviewIds,
  onSaveDuplicateAnyway,
  onSkipDuplicate,
  onChange,
  onUndoChange,
}: EditablePreviewListProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {previewItems.map((preview, index) => {
        const warning = duplicateWarnings[preview.previewId];
        const isSavingPreview = !!savingPreviewIds[preview.previewId];
        const aiMeta = aiMetaByPreviewId[preview.previewId] || {
          aiApplied: false,
          changes: [],
        };

        return (
          <div
            key={buildPreviewRenderKey(preview)}
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {warning ? (
              <div
                style={{
                  border: "1px solid #fde68a",
                  background:
                    "linear-gradient(180deg, rgba(255,251,235,1) 0%, rgba(255,255,255,0.98) 100%)",
                  borderRadius: 16,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                  boxShadow: "0 6px 14px rgba(245,158,11,0.06)",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: "#92400e",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Exact duplicate detected
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#78350f",
                      lineHeight: 1.55,
                    }}
                  >
                    This task already exists in your CRM. Compare it below or
                    open it directly in Tasks before deciding.
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #fcd34d",
                    borderRadius: 14,
                    padding: 10,
                    background: "rgba(255,255,255,0.84)",
                    display: "grid",
                    gap: 7,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: "#b45309",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Already in CRM
                    </div>

                    <div
                      style={{
                        border: "1px solid #fde68a",
                        background: "#fff7ed",
                        color: "#92400e",
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Created {formatCreatedAtLabel(warning.existingCreatedAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 16,
                      lineHeight: 1.15,
                      fontWeight: 900,
                      letterSpacing: "-0.03em",
                      color: "#0f172a",
                    }}
                  >
                    {warning.existingTask}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <MetaChip
                      label={`Client: ${warning.existingClient || "Unassigned"}`}
                    />
                    <MetaChip
                      label={`Deadline: ${warning.existingDeadline || "No deadline"}`}
                    />
                    <MetaChip label="Status: Existing task" subtle />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => onSaveDuplicateAnyway(preview.previewId)}
                    disabled={isSavingPreview}
                    style={{
                      border: "none",
                      borderRadius: 12,
                      padding: "8px 12px",
                      background:
                        "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: isSavingPreview ? "not-allowed" : "pointer",
                      opacity: isSavingPreview ? 0.7 : 1,
                      boxShadow: "0 6px 14px rgba(79,70,229,0.15)",
                    }}
                  >
                    {isSavingPreview ? "Saving..." : "Save anyway"}
                  </button>

                  <button
                    onClick={() => onSkipDuplicate(preview.previewId)}
                    disabled={isSavingPreview}
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: 12,
                      padding: "8px 12px",
                      background: "#ffffff",
                      color: "#334155",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: isSavingPreview ? "not-allowed" : "pointer",
                      opacity: isSavingPreview ? 0.7 : 1,
                    }}
                  >
                    Skip
                  </button>

                  <button
                    onClick={() =>
                      window.open(
                        `/dashboard?view=tasks&taskId=${warning.existingTaskId}`,
                        "_blank"
                      )
                    }
                    style={{
                      border: "1px solid #c7d2fe",
                      borderRadius: 12,
                      padding: "8px 12px",
                      background: "#eef2ff",
                      color: "#4338ca",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    View task
                  </button>
                </div>
              </div>
            ) : null}

            <EditablePreviewCard
              index={index}
              preview={preview}
              aiMeta={aiMeta}
              onChange={onChange}
              onUndoChange={(change) => onUndoChange(preview.previewId, change)}
              suggestions={[]}
              suggestionsLoading={false}
              suggestionsError=""
            />
          </div>
        );
      })}
    </div>
  );
}

function MetaChip({
  label,
  subtle = false,
}: {
  label: string;
  subtle?: boolean;
}) {
  return (
    <div
      style={{
        border: subtle ? "1px solid #e5e7eb" : "1px solid #fde68a",
        background: subtle ? "#ffffff" : "#fffaf0",
        color: "#334155",
        borderRadius: 999,
        padding: "5px 8px",
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}