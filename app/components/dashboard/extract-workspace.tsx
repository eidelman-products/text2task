"use client";

import { useRef, useState } from "react";
import SectionCard from "./section-card";
import EditablePreviewList from "./editable-preview-list";
import ExtractInputPanels from "./extract-input-panels";
import UpgradeModal from "../upgrade-modal";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import { parseAmount } from "@/lib/tasks/parse-amount";
import {
  buildHybridPreviewItems,
  type ExtractedPreview,
  type HybridAppliedChange,
  type HybridPreviewMeta,
} from "@/lib/preview/hybrid-preview";
import type { TaskRow } from "./tasks-view";

type DuplicateWarning = {
  existingTaskId: number;
  existingTask: string;
  existingClient: string;
  existingDeadline: string;
  existingCreatedAt: string;
  reason: string;
};

type PreviewItem = ExtractedPreview & {
  client_phone?: string;
  client_email?: string;
  client_notes?: string;
  raw_input?: string;
};

type PreviewFieldName = keyof Omit<PreviewItem, "previewId">;

type ExtractWorkspaceProps = {
  plan: "free" | "pro";
  existingTasks: TaskRow[];
  fetchTasksFromServer: () => Promise<TaskRow[]>;
  onTasksSaved: (rows: TaskRow[]) => void;
  onGoToTasks: () => void;
};

type SelectedImageItem = {
  file: File;
  previewUrl: string;
};

function getClientDisplayName(task: TaskRow) {
  const directClientName =
    typeof (task as any).client_name === "string"
      ? (task as any).client_name.trim()
      : "";

  return task.client?.name?.trim() || directClientName || "Unassigned";
}

function normalizeExactValue(value: string) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function extractDateKey(value: string) {
  const clean = (value || "").trim();
  if (!clean) return "";

  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const shortUsMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (shortUsMatch) {
    const month = shortUsMatch[1].padStart(2, "0");
    const day = shortUsMatch[2].padStart(2, "0");
    const rawYear = shortUsMatch[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  const parsed = parseDeadline(clean);

  if (parsed.deadlineDate) {
    return parsed.deadlineDate.split("T")[0];
  }

  return "";
}

function normalizeDeadlineComparable(value: string) {
  const dateKey = extractDateKey(value);

  if (dateKey) {
    return `date:${dateKey}`;
  }

  return `text:${normalizeExactValue(value)}`;
}

function normalizeAmountComparable(value: string) {
  const parsed = parseAmount(value);

  if (parsed.amountValue !== null) {
    const numberPart = String(parsed.amountValue);
    const currencyPart = parsed.currencyCode || "NONE";
    return `amount:${numberPart}:${currencyPart}`;
  }

  return `text:${normalizeExactValue(value)}`;
}

function getTaskCanonicalDeadline(task: TaskRow) {
  if (task.deadline_original_text?.trim()) {
    return task.deadline_original_text.trim();
  }

  if (task.deadline_date?.trim()) {
    return task.deadline_date.trim();
  }

  return task.deadline?.trim() || "";
}

function normalizePriority(value: unknown): "Low" | "Medium" | "High" {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "high") return "High";
  if (clean === "low") return "Low";
  return "Medium";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPreviewClientPhone(preview: PreviewItem) {
  return normalizeOptionalText(preview.client_phone);
}

function getPreviewClientEmail(preview: PreviewItem) {
  return normalizeOptionalText(preview.client_email).toLowerCase();
}

function getPreviewClientNotes(preview: PreviewItem) {
  return normalizeOptionalText(preview.client_notes);
}

function getTaskClientPhone(task: TaskRow) {
  return normalizeOptionalText(task.client?.phone ?? (task as any).client_phone);
}

function getTaskClientEmail(task: TaskRow) {
  return normalizeOptionalText(
    task.client?.email ?? (task as any).client_email
  ).toLowerCase();
}

function getTaskClientNotes(task: TaskRow) {
  return normalizeOptionalText(task.client?.notes ?? (task as any).client_notes);
}

function buildDuplicateCoreFromPreview(preview: PreviewItem) {
  return [
    normalizeExactValue(preview.client),
    normalizeExactValue(preview.task),
    normalizeDeadlineComparable(buildSaveDeadlineValue(preview)),
  ].join("||");
}

function buildDuplicateCoreFromTask(task: TaskRow) {
  return [
    normalizeExactValue(getClientDisplayName(task)),
    normalizeExactValue(task.task),
    normalizeDeadlineComparable(getTaskCanonicalDeadline(task)),
  ].join("||");
}

function buildDuplicateStrictFromPreview(preview: PreviewItem) {
  return [
    buildDuplicateCoreFromPreview(preview),
    normalizeAmountComparable(preview.amount),
  ].join("||");
}

function buildDuplicateStrictFromTask(task: TaskRow) {
  return [
    buildDuplicateCoreFromTask(task),
    normalizeAmountComparable(task.amount),
  ].join("||");
}

function buildSaveDeadlineValue(preview: PreviewItem) {
  if (preview.deadline_original_text?.trim()) {
    return preview.deadline_original_text.trim();
  }

  return preview.deadline.trim();
}

export default function ExtractWorkspace({
  plan,
  existingTasks,
  fetchTasksFromServer,
  onTasksSaved,
  onGoToTasks,
}: ExtractWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewAiMeta, setPreviewAiMeta] = useState<
    Record<string, HybridPreviewMeta>
  >({});
  const [hasTriedExtract, setHasTriedExtract] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [selectedImage, setSelectedImage] = useState<SelectedImageItem | null>(
    null
  );
  const [imageProgress, setImageProgress] = useState(0);

  const [duplicateWarnings, setDuplicateWarnings] = useState<
    Record<string, DuplicateWarning>
  >({});
  const [savingPreviewIds, setSavingPreviewIds] = useState<
    Record<string, boolean>
  >({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const previewIdRef = useRef(0);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function createPreviewId() {
    previewIdRef.current += 1;
    return `preview-${previewIdRef.current}`;
  }

  function clearSelectedImage() {
    setSelectedImage((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
    setImageProgress(0);
  }

  function clearTextInput() {
    setInputText("");
  }

  function resetPreviewState() {
    setPreviewItems([]);
    setPreviewAiMeta({});
    setDuplicateWarnings({});
    setHasTriedExtract(false);
    setInputText("");
    clearSelectedImage();
  }

  function mapSavedTaskToRow(saved: any): TaskRow {
    const rawDeadlineText =
      typeof saved.deadline_text === "string" ? saved.deadline_text : "";
    const rawDeadlineDate =
      typeof saved.deadline_date === "string" ? saved.deadline_date : null;

    const displayDeadline =
      formatDeadline(rawDeadlineText, rawDeadlineDate) ||
      rawDeadlineText ||
      (rawDeadlineDate ? formatDeadline(rawDeadlineDate) : "") ||
      "";

    return {
      id: saved.id,
      client: saved.client
        ? {
            id: saved.client.id,
            name: saved.client.name,
            phone: saved.client.phone ?? null,
            email: saved.client.email ?? null,
            notes: saved.client.notes ?? null,
          }
        : null,
      task: saved.task_title || "",
      amount:
        saved.amount !== null && saved.amount !== undefined
          ? String(saved.amount)
          : "",
      deadline: displayDeadline,
      deadline_date: rawDeadlineDate,
      deadline_original_text: rawDeadlineText || null,
      priority: saved.priority || "Medium",
      status: saved.status || "New",
      source: saved.source || "Pasted text",
      raw_input: saved.raw_input || "",
      created_at: saved.created_at || null,
    };
  }

  function mapTaskToPreview(task: any, source: string): PreviewItem {
    const originalDeadlineText = task.deadline_text || "";
    const parsedDeadline = parseDeadline(originalDeadlineText);

    const displayDeadline =
      formatDeadline(originalDeadlineText, parsedDeadline.deadlineDate) ||
      originalDeadlineText;

    return {
      previewId: createPreviewId(),
      client: task.client_name || "",
      client_phone: task.client_phone || task.phone || "",
      client_email: task.client_email || task.email || "",
      client_notes: task.client_notes || task.notes || "",
      task: task.task_title || "",
      amount: task.amount || "",
      deadline: displayDeadline,
      deadline_date: parsedDeadline.deadlineDate,
      deadline_original_text: originalDeadlineText || null,
      priority: normalizePriority(task.priority),
      status: "Not Started",
      source,
      raw_input: task.raw_input || "",
    } as PreviewItem;
  }

  function removeDeadlineChanges(
    mappedPreviews: PreviewItem[],
    aiMetaByPreviewId: Record<string, HybridPreviewMeta>
  ) {
    const previewMap = new Map(
      mappedPreviews.map((preview) => [preview.previewId, preview])
    );

    const cleanedPreviewItems = mappedPreviews.map((preview) => {
      const original = previewMap.get(preview.previewId);
      return {
        ...preview,
        client_phone: original?.client_phone || preview.client_phone || "",
        client_email: original?.client_email || preview.client_email || "",
        client_notes: original?.client_notes || preview.client_notes || "",
        raw_input: original?.raw_input || preview.raw_input || "",
        deadline: original?.deadline || preview.deadline,
        deadline_date: original?.deadline_date || preview.deadline_date,
        deadline_original_text:
          original?.deadline_original_text || preview.deadline_original_text,
      };
    });

    const cleanedAiMeta: Record<string, HybridPreviewMeta> = {};

    for (const [previewId, meta] of Object.entries(aiMetaByPreviewId)) {
      const remainingChanges = meta.changes.filter(
        (change) => change.field !== "deadline"
      );

      cleanedAiMeta[previewId] = {
        aiApplied: remainingChanges.length > 0,
        changes: remainingChanges,
      };
    }

    return {
      cleanedPreviewItems,
      cleanedAiMeta,
    };
  }

  async function buildHybridPreviewsFromTasks(
    extractedTasks: any[],
    source: string
  ): Promise<{
    previewItems: PreviewItem[];
    aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
  }> {
    const mappedPreviews = extractedTasks.map((task: any) =>
      mapTaskToPreview(task, source)
    );

    const hybridResult = await buildHybridPreviewItems(
      mappedPreviews as ExtractedPreview[]
    );

    const hybridPreviewItems = hybridResult.previewItems.map((preview) => {
      const original = mappedPreviews.find(
        (item) => item.previewId === preview.previewId
      );

      return {
        ...(preview as PreviewItem),
        client_phone: original?.client_phone || "",
        client_email: original?.client_email || "",
        client_notes: original?.client_notes || "",
        raw_input: original?.raw_input || "",
        deadline: original?.deadline || preview.deadline,
        deadline_date: original?.deadline_date || preview.deadline_date,
        deadline_original_text:
          original?.deadline_original_text || preview.deadline_original_text,
      };
    });

    const { cleanedPreviewItems, cleanedAiMeta } = removeDeadlineChanges(
      hybridPreviewItems,
      hybridResult.aiMetaByPreviewId
    );

    return {
      previewItems: cleanedPreviewItems,
      aiMetaByPreviewId: cleanedAiMeta,
    };
  }

  function handleImageSelected(file: File) {
    const previewUrl = URL.createObjectURL(file);

    setSelectedImage((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }

      return {
        file,
        previewUrl,
      };
    });

    setImageProgress(0);
  }

  function clearDuplicateWarning(previewId: string) {
    setDuplicateWarnings((prev) => {
      const next = { ...prev };
      delete next[previewId];
      return next;
    });
  }

  function removePreviewById(previewId: string) {
    setPreviewItems((prev) =>
      prev.filter((item) => item.previewId !== previewId)
    );

    setPreviewAiMeta((prev) => {
      const next = { ...prev };
      delete next[previewId];
      return next;
    });

    clearDuplicateWarning(previewId);

    setSavingPreviewIds((prev) => {
      const next = { ...prev };
      delete next[previewId];
      return next;
    });
  }

  function findPossibleDuplicate(
    preview: PreviewItem,
    rowsToCheck: TaskRow[]
  ): DuplicateWarning | null {
    const previewStrictKey = buildDuplicateStrictFromPreview(preview);
    const previewCoreKey = buildDuplicateCoreFromPreview(preview);

    const strictDuplicate = rowsToCheck.find((task) => {
      return buildDuplicateStrictFromTask(task) === previewStrictKey;
    });

    if (strictDuplicate) {
      return {
        existingTaskId: strictDuplicate.id,
        existingTask: strictDuplicate.task,
        existingClient: getClientDisplayName(strictDuplicate),
        existingDeadline: strictDuplicate.deadline,
        existingCreatedAt: strictDuplicate.created_at || "",
        reason: "Same client, task, amount, and deadline.",
      };
    }

    const coreDuplicate = rowsToCheck.find((task) => {
      return buildDuplicateCoreFromTask(task) === previewCoreKey;
    });

    if (coreDuplicate) {
      return {
        existingTaskId: coreDuplicate.id,
        existingTask: coreDuplicate.task,
        existingClient: getClientDisplayName(coreDuplicate),
        existingDeadline: coreDuplicate.deadline,
        existingCreatedAt: coreDuplicate.created_at || "",
        reason:
          "Same client, task, and deadline. Amount may be different, but this is probably the same work request.",
      };
    }

    return null;
  }

  function handleExtractError(data: any, fallbackMessage: string) {
    if (data?.upgrade_required || data?.error === "FREE_EXTRACT_LIMIT_REACHED") {
      setShowUpgrade(true);
      return true;
    }

    throw new Error(data?.message || data?.error || fallbackMessage);
  }

  async function extractWithAI() {
    try {
      setIsExtracting(true);
      setHasTriedExtract(true);
      setPreviewItems([]);
      setPreviewAiMeta({});
      setDuplicateWarnings({});
      setSaveSuccess(false);

      const text = inputText.trim();
      if (!text) return;

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        const handled = handleExtractError(data, "Extraction failed");
        if (handled) return;
      }

      const extractedTasks = Array.isArray(data.tasks) ? data.tasks : [];
      const hybridResult = await buildHybridPreviewsFromTasks(
        extractedTasks,
        "AI extraction"
      );

      setPreviewItems(hybridResult.previewItems);
      setPreviewAiMeta(hybridResult.aiMetaByPreviewId);
      clearSelectedImage();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  }

  async function extractFromSelectedImage() {
    if (!selectedImage?.file) {
      alert("Please upload an image first.");
      return;
    }

    try {
      setIsExtracting(true);
      setHasTriedExtract(true);
      setPreviewItems([]);
      setPreviewAiMeta({});
      setDuplicateWarnings({});
      setSaveSuccess(false);
      setImageProgress(10);

      const formData = new FormData();
      formData.append("image", selectedImage.file);

      setImageProgress(35);

      const res = await fetch("/api/extract-image", {
        method: "POST",
        body: formData,
      });

      setImageProgress(75);

      const data = await res.json();

      if (!res.ok) {
        const handled = handleExtractError(data, "Image extraction failed");
        if (handled) {
          setImageProgress(0);
          return;
        }
      }

      const extractedTasks = Array.isArray(data.tasks) ? data.tasks : [];
      const hybridResult = await buildHybridPreviewsFromTasks(
        extractedTasks,
        "Image extraction"
      );

      setPreviewItems(hybridResult.previewItems);
      setPreviewAiMeta(hybridResult.aiMetaByPreviewId);
      setInputText("");
      setImageProgress(100);

      setTimeout(() => {
        setImageProgress(0);
      }, 700);
    } catch (error: any) {
      console.error(error);
      setImageProgress(0);
      alert(error.message || "Image extraction failed");
    } finally {
      setIsExtracting(false);
    }
  }

  function updatePreviewItem(
    index: number,
    field: PreviewFieldName,
    value: string
  ) {
    setPreviewItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        clearDuplicateWarning(item.previewId);

        if (field === "deadline") {
          const trimmed = value.trim();
          const parsed = parseDeadline(trimmed);
          const displayDeadline =
            formatDeadline(trimmed, parsed.deadlineDate) || trimmed;

          return {
            ...item,
            deadline_original_text: trimmed || null,
            deadline_date: parsed.deadlineDate,
            deadline: displayDeadline,
          };
        }

        return { ...item, [field]: value };
      })
    );

    setPreviewAiMeta((prev) => {
      const target = previewItems[index];
      if (!target) return prev;

      return {
        ...prev,
        [target.previewId]: {
          aiApplied: false,
          changes: [],
        },
      };
    });
  }

  function handleUndoChange(previewId: string, change: HybridAppliedChange) {
    setPreviewItems((prev) =>
      prev.map((item) => {
        if (item.previewId !== previewId) return item;

        if (change.field === "amount") {
          return { ...item, amount: change.before };
        }

        if (change.field === "priority") {
          return {
            ...item,
            priority: change.before as "Low" | "Medium" | "High",
          };
        }

        return item;
      })
    );

    setPreviewAiMeta((prev) => {
      const currentMeta = prev[previewId];
      if (!currentMeta) return prev;

      const remainingChanges = currentMeta.changes.filter(
        (item) =>
          !(
            item.field === change.field &&
            item.before === change.before &&
            item.after === change.after
          )
      );

      return {
        ...prev,
        [previewId]: {
          aiApplied: remainingChanges.length > 0,
          changes: remainingChanges,
        },
      };
    });
  }

  async function saveSinglePreview(preview: PreviewItem) {
    const sourceRawInput =
      preview.raw_input?.trim() ||
      (preview.source === "Image extraction"
        ? "Extracted from uploaded image"
        : inputText);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: preview.client,
        client_phone: getPreviewClientPhone(preview),
        client_email: getPreviewClientEmail(preview),
        client_notes: getPreviewClientNotes(preview),
        task_title: preview.task,
        amount: preview.amount,
        deadline_text: buildSaveDeadlineValue(preview),
        priority: preview.priority,
        status: "New",
        source: preview.source,
        raw_input: sourceRawInput,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to save task");
    }

    return mapSavedTaskToRow(data.task);
  }

  function finishSuccessfulSaveFlow() {
    setSaveSuccess(true);

    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }

    saveSuccessTimerRef.current = setTimeout(() => {
      resetPreviewState();
      onGoToTasks();
    }, 500);
  }

  async function savePreviewToTasks() {
    if (!previewItems.length || isSavingAll) return;

    try {
      setIsSavingAll(true);
      setSaveSuccess(false);

      const latestTasks = await fetchTasksFromServer();
      const tasksForDuplicateCheck = [...existingTasks, ...latestTasks];
      const uniqueTasksForDuplicateCheck = Array.from(
        new Map(tasksForDuplicateCheck.map((task) => [task.id, task])).values()
      );

      const nextWarnings: Record<string, DuplicateWarning> = {};
      const previewsToKeep: PreviewItem[] = [];
      const nextAiMeta: Record<string, HybridPreviewMeta> = {};
      const newlySavedRows: TaskRow[] = [];

      const rowsToCheck = [...uniqueTasksForDuplicateCheck];

      for (const preview of previewItems) {
        const duplicateWarning = findPossibleDuplicate(preview, rowsToCheck);

        if (duplicateWarning) {
          nextWarnings[preview.previewId] = duplicateWarning;

          previewsToKeep.push(preview);
          nextAiMeta[preview.previewId] = previewAiMeta[preview.previewId] || {
            aiApplied: false,
            changes: [],
          };
          continue;
        }

        const savedRow = await saveSinglePreview(preview);
        newlySavedRows.push(savedRow);
        rowsToCheck.push(savedRow);
      }

      if (newlySavedRows.length > 0) {
        onTasksSaved(newlySavedRows);
      }

      setDuplicateWarnings(nextWarnings);
      setPreviewItems(previewsToKeep);
      setPreviewAiMeta(nextAiMeta);

      if (previewsToKeep.length === 0) {
        finishSuccessfulSaveFlow();
      }
    } catch (error: any) {
      alert(error.message || "Failed to save tasks");
    } finally {
      setIsSavingAll(false);
    }
  }

  async function handleSaveDuplicateAnyway(previewId: string) {
    const preview = previewItems.find((item) => item.previewId === previewId);
    if (!preview) return;

    try {
      setSavingPreviewIds((prev) => ({
        ...prev,
        [previewId]: true,
      }));

      const savedRow = await saveSinglePreview(preview);
      onTasksSaved([savedRow]);
      removePreviewById(preview.previewId);

      if (previewItems.length === 1) {
        finishSuccessfulSaveFlow();
      }
    } catch (error: any) {
      alert(error.message || "Failed to save duplicate task");
    } finally {
      setSavingPreviewIds((prev) => {
        const next = { ...prev };
        delete next[previewId];
        return next;
      });
    }
  }

  function handleSkipDuplicate(previewId: string) {
    const nextLength = previewItems.length - 1;
    removePreviewById(previewId);

    if (nextLength <= 0) {
      resetPreviewState();
    }
  }

  const duplicateCount = Object.keys(duplicateWarnings).length;

  return (
    <>
      <div style={{ display: "grid", gap: 22 }}>
        <SectionCard
          title="Extract Tasks"
          description="Turn text messages and screenshots into structured task items with a clean review flow before saving."
          rightSlot={
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: plan === "pro" ? "#ecfdf5" : "#eef2ff",
                border:
                  plan === "pro"
                    ? "1px solid #a7f3d0"
                    : "1px solid #c7d2fe",
                color: plan === "pro" ? "#065f46" : "#4338ca",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Current plan: {plan.toUpperCase()}
            </div>
          }
        >
          <ExtractInputPanels
            text={inputText}
            onTextChange={setInputText}
            onExtractText={extractWithAI}
            onClearText={clearTextInput}
            onImageSelected={handleImageSelected}
            onExtractImage={extractFromSelectedImage}
            onRemoveImage={clearSelectedImage}
            selectedImagePreviewUrl={selectedImage?.previewUrl || null}
            selectedImageName={selectedImage?.file?.name || ""}
            isBusy={isExtracting}
            imageProgress={imageProgress}
          />
        </SectionCard>

        {previewItems.length > 0 ? (
          <SectionCard
            title="Extraction Preview"
            description={`Review and edit the extracted tasks before saving them into your CRM. ${previewItems.length} task${
              previewItems.length > 1 ? "s" : ""
            } detected.`}
            rightSlot={
              <button
                onClick={savePreviewToTasks}
                disabled={isSavingAll}
                style={{
                  border: "none",
                  borderRadius: 16,
                  padding: "12px 18px",
                  background: isSavingAll
                    ? "#94a3b8"
                    : saveSuccess
                    ? "#16a34a"
                    : "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: isSavingAll ? "not-allowed" : "pointer",
                  opacity: isSavingAll ? 0.9 : 1,
                  minWidth: 160,
                  boxShadow:
                    isSavingAll || saveSuccess
                      ? "none"
                      : "0 10px 24px rgba(79,70,229,0.22)",
                }}
              >
                {isSavingAll
                  ? "Saving..."
                  : saveSuccess
                  ? "Saved ✓"
                  : "Save All to Tasks"}
              </button>
            }
          >
            <div style={{ display: "grid", gap: 14 }}>
              {duplicateCount > 0 ? (
                <div
                  style={{
                    border: "1px solid #fde68a",
                    background:
                      "linear-gradient(180deg, rgba(255,251,235,1) 0%, rgba(255,255,255,0.98) 100%)",
                    borderRadius: 18,
                    padding: 14,
                    color: "#92400e",
                    display: "grid",
                    gap: 6,
                    boxShadow: "0 8px 20px rgba(245,158,11,0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Possible duplicates found
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: "#78350f",
                    }}
                  >
                    We found {duplicateCount} task
                    {duplicateCount > 1 ? "s" : ""} that may already exist in
                    your CRM. Review the comparison block below and choose
                    whether to save or skip them.
                  </div>
                </div>
              ) : null}

              <EditablePreviewList
                previewItems={previewItems}
                aiMetaByPreviewId={previewAiMeta}
                duplicateWarnings={duplicateWarnings}
                savingPreviewIds={savingPreviewIds}
                onSaveDuplicateAnyway={handleSaveDuplicateAnyway}
                onSkipDuplicate={handleSkipDuplicate}
                onChange={updatePreviewItem}
                onUndoChange={handleUndoChange}
              />
            </div>
          </SectionCard>
        ) : hasTriedExtract ? (
          <SectionCard
            title="Extraction Result"
            description="The system checked your input, but did not find any clear actionable tasks."
          >
            <div
              style={{
                border: "1px solid #e2e8f0",
                background:
                  "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,0.96) 100%)",
                borderRadius: 20,
                padding: 24,
                textAlign: "center",
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.03em",
                }}
              >
                No clear tasks detected
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#64748b",
                  lineHeight: 1.7,
                  maxWidth: 620,
                  margin: "0 auto",
                }}
              >
                This looks more like notes or ideas than actionable work. Try
                adding deliverables, budget, deadline, or urgency.
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
}