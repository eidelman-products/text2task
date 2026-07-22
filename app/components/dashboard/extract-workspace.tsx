"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import EditablePreviewList, {
  buildPreviewProjectGroups,
  getPreviewProjectStats,
  type PreviewProjectGroup,
  type PreviewProjectPriority,
} from "./editable-preview-list";
import ExtractInputPanels from "./extract-input-panels";
import DuplicateProjectModal from "./duplicate-project-modal";
import UpgradeModal from "../upgrade-modal";
import ExtractWorkspaceHero from "./extract/extract-workspace-hero";
import { formatDeadline } from "@/lib/tasks/format-deadline";
import { parseDeadline } from "@/lib/tasks/parse-deadline";
import {
  buildHybridPreviewItems,
  type ExtractedPreview,
  type HybridAppliedChange,
  type HybridPreviewMeta,
} from "@/lib/preview/hybrid-preview";
import {
  TextExtractedProjectMetadataSchema,
  type TextExtractedProjectMetadata,
} from "@/lib/extraction/schemas";
import type { DuplicateProjectMatch } from "@/lib/tasks/project-duplicate-detection";
import type { TaskRow } from "./tasks-view";

type PreviewItem = ExtractedPreview & {
  contact_name?: string;
  contactName?: string;
  contact_person?: string;
  contactPerson?: string;
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

const PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA =
  "text_extraction_project_metadata";

type ProjectImportMode =
  typeof PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA;

type DuplicateSaveState = {
  duplicate: DuplicateProjectMatch;
  projectGroups: PreviewProjectGroup[];
  duplicateGroupIndex: number;
  overrideGroupIndexes: number[];
  importMode: ProjectImportMode | null;
};

type DuplicateProjectSaveError = Error & {
  code: "DUPLICATE_PROJECT_DETECTED";
  duplicate: DuplicateProjectMatch;
  groupIndex: number;
};

function normalizePriority(value: unknown): "Low" | "Medium" | "High" {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "high") return "High";
  if (clean === "low") return "Low";
  return "Medium";
}

function getProjectPriorityIntent(
  group: PreviewProjectGroup,
  usesProjectMetadata: boolean
): "neutral" | "ai" | "user" | null {
  if (!usesProjectMetadata) {
    return null;
  }

  if (group.prioritySource === "ai" || group.prioritySource === "user") {
    return group.prioritySource;
  }

  if (group.prioritySource === "storage_default") {
    return "neutral";
  }

  return "neutral";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getExtractResponseTasks(data: unknown) {
  return isJsonRecord(data) && Array.isArray(data.tasks) ? data.tasks : [];
}

function getExtractResponseProjectMetadata(
  data: unknown
): TextExtractedProjectMetadata | null {
  if (
    !isJsonRecord(data) ||
    data.project === undefined ||
    data.project === null
  ) {
    return null;
  }

  const parsedProject = TextExtractedProjectMetadataSchema.safeParse(
    data.project
  );

  return parsedProject.success ? parsedProject.data : null;
}

function getPreviewContactName(preview: PreviewItem) {
  return normalizeOptionalText(
    preview.contact_name ||
      preview.contactName ||
      preview.contact_person ||
      preview.contactPerson
  );
}

function isGenericContactValue(value: unknown) {
  const normalized = normalizeOptionalText(value).toLowerCase();

  return (
    !normalized ||
    normalized === "contact" ||
    normalized === "client" ||
    normalized === "name" ||
    normalized === "unknown" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "-" ||
    normalized === "none"
  );
}

function getNormalizedExtractedContactName(task: any) {
  const rawContact =
    task.contact_name ||
    task.contactName ||
    task.contact_person ||
    task.contactPerson ||
    "";
  const clientName = normalizeOptionalText(task.client_name);

  if (isGenericContactValue(rawContact)) {
    return clientName || "";
  }

  return normalizeOptionalText(rawContact);
}

function buildSaveDeadlineValue(preview: PreviewItem) {
  if (preview.deadline_original_text?.trim()) {
    return preview.deadline_original_text.trim();
  }

  return preview.deadline.trim();
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildSaveDeadlineDate(deadlineDate?: string | null) {
  const raw = deadlineDate?.trim();

  if (!raw) {
    return null;
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return raw;
    }

    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDateOnly(parsed);
}

function getGroupRawInput(group: PreviewProjectGroup) {
  return (
    group.items
      .map((item) => item.preview.raw_input?.trim())
      .find(Boolean) || ""
  );
}

function getGroupContactName(group: PreviewProjectGroup) {
  return group.contactName || "";
}

function getGroupClientNotes(group: PreviewProjectGroup) {
  return group.client_notes || "";
}

function getGroupClientPhone(group: PreviewProjectGroup) {
  return group.client_phone || "";
}

function getGroupClientEmail(group: PreviewProjectGroup) {
  return group.client_email || "";
}

function getProjectStatusFromGroup(group: PreviewProjectGroup) {
  const statuses = group.items.map((item) =>
    String(item.preview.status || "").trim().toLowerCase()
  );

  if (statuses.every((status) => status === "done")) {
    return "Done";
  }

  if (
    statuses.some(
      (status) =>
        status === "in progress" ||
        status === "in-progress" ||
        status === "working"
    )
  ) {
    return "In Progress";
  }

  return "New";
}

function isDuplicateProjectSaveError(
  error: unknown
): error is DuplicateProjectSaveError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as DuplicateProjectSaveError).code ===
      "DUPLICATE_PROJECT_DETECTED" &&
    Boolean((error as DuplicateProjectSaveError).duplicate)
  );
}

function mapSavedProject(saved: any) {
  const project = saved.project || saved.projects || null;

  if (!project || typeof project !== "object") {
    return null;
  }

  return {
    id: String(project.id || saved.project_id || ""),
    client_id: project.client_id || null,
    client_name: project.client_name || null,
    contact_name: project.contact_name || null,
    title: project.title || null,
    summary: project.summary || null,
    amount:
      project.amount !== null && project.amount !== undefined
        ? String(project.amount)
        : null,
    amount_value:
      typeof project.amount_value === "number" ? project.amount_value : null,
    currency_code: project.currency_code || null,
    deadline_text: project.deadline_text || null,
    deadline_date: project.deadline_date || null,
    priority: project.priority || null,
    priority_source: project.priority_source || null,
    status: project.status || null,
    source: project.source || null,
    raw_input: project.raw_input || null,
    created_at: project.created_at || null,
    updated_at: project.updated_at || null,
    completed_at: project.completed_at || null,
    is_archived:
      typeof project.is_archived === "boolean" ? project.is_archived : null,
    archived_at: project.archived_at || null,
    deleted_at: project.deleted_at || null,
  };
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

  const project = mapSavedProject(saved);

  return {
    id: saved.id,
    client: saved.client
      ? {
          id: saved.client.id,
          name: saved.client.name,
          contact_name: saved.client.contact_name ?? null,
          phone: saved.client.phone ?? null,
          email: saved.client.email ?? null,
          notes: saved.client.notes ?? null,
        }
      : null,
    project,
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
    source: saved.source || "Project extraction",
    raw_input: saved.raw_input || "",
    created_at: saved.created_at || null,
    updated_at: saved.updated_at || null,
    is_archived: Boolean(saved.is_archived),
    completed_at: saved.completed_at || null,
    archived_at: saved.archived_at || null,
    deleted_at: saved.deleted_at || null,
    project_id: saved.project_id || project?.id || null,
    subtask_order: saved.subtask_order ?? null,
    contact_name: saved.contact_name ?? saved.client?.contact_name ?? null,
    client_phone: saved.client?.phone ?? null,
    client_email: saved.client?.email ?? null,
    client_notes: saved.client?.notes ?? null,
  } as TaskRow;
}

export default function ExtractWorkspace({
  plan,
  onTasksSaved,
  onGoToTasks,
}: ExtractWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewProjectMetadata, setPreviewProjectMetadata] =
    useState<TextExtractedProjectMetadata | null>(null);
  const [projectPriorityOverride, setProjectPriorityOverride] =
    useState<PreviewProjectPriority | null>(null);
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

  const selectedImagePreviewUrl = selectedImage?.previewUrl ?? null;

  useEffect(() => {
    if (!selectedImagePreviewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    };
  }, [selectedImagePreviewUrl]);

  const [duplicateSaveState, setDuplicateSaveState] =
    useState<DuplicateSaveState | null>(null);
  const [isSavingDuplicateAnyway, setIsSavingDuplicateAnyway] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const previewIdRef = useRef(0);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importAttemptIdRef = useRef<string | null>(null);

  const previewStats = getPreviewProjectStats(
    previewItems,
    previewProjectMetadata,
    projectPriorityOverride
  );
  const hasPreview = previewItems.length > 0;
  const showExtractingState = isExtracting && !hasPreview;
  const showEmptyState = hasTriedExtract && !isExtracting && !hasPreview;

  function createPreviewId() {
    previewIdRef.current += 1;
    return `preview-${previewIdRef.current}`;
  }

  function clearSelectedImage() {
    setSelectedImage(null);
    setImageProgress(0);
  }

  function clearTextInput() {
    setInputText("");
  }

  function resetPreviewState() {
    importAttemptIdRef.current = null;
    setPreviewItems([]);
    setPreviewProjectMetadata(null);
    setProjectPriorityOverride(null);
    setPreviewAiMeta({});
    setHasTriedExtract(false);
    setInputText("");
    clearSelectedImage();
  }

  function getOrCreateImportAttemptId() {
    if (!importAttemptIdRef.current) {
      importAttemptIdRef.current = globalThis.crypto.randomUUID();
    }

    return importAttemptIdRef.current;
  }

  function mapTaskToPreview(task: any, source: string): PreviewItem {
    const originalDeadlineText = task.deadline_text || "";
    const parsedDeadline = parseDeadline(originalDeadlineText);
    const contactName = getNormalizedExtractedContactName(task);

    const displayDeadline =
      formatDeadline(originalDeadlineText, parsedDeadline.deadlineDate) ||
      originalDeadlineText;

    return {
      previewId: createPreviewId(),
      client: task.client_name || "",
      contact_name: contactName,
      contactName,
      contact_person: contactName,
      contactPerson: contactName,
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
      const originalContactName = original
        ? getPreviewContactName(original)
        : getPreviewContactName(preview);

      return {
        ...preview,
        contact_name: originalContactName || getPreviewContactName(preview),
        contactName: originalContactName || getPreviewContactName(preview),
        contact_person: originalContactName || getPreviewContactName(preview),
        contactPerson: originalContactName || getPreviewContactName(preview),
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

      const originalContactName = original
        ? getPreviewContactName(original)
        : "";

      return {
        ...(preview as PreviewItem),
        contact_name:
          originalContactName || getPreviewContactName(preview as PreviewItem),
        contactName:
          originalContactName || getPreviewContactName(preview as PreviewItem),
        contact_person:
          originalContactName || getPreviewContactName(preview as PreviewItem),
        contactPerson:
          originalContactName || getPreviewContactName(preview as PreviewItem),
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

    setSelectedImage({
      file,
      previewUrl,
    });

    setImageProgress(0);
  }

  function handleExtractError(data: any, fallbackMessage: string) {
    if (data?.upgrade_required || data?.error === "FREE_EXTRACT_LIMIT_REACHED") {
      setShowUpgrade(true);
      return true;
    }

    throw new Error(data?.message || data?.error || fallbackMessage);
  }

  async function extractWithAI() {
    const text = inputText.trim();

    if (!text || isExtracting) {
      return;
    }

    try {
      setIsExtracting(true);
      setHasTriedExtract(true);
      importAttemptIdRef.current = null;
      setPreviewItems([]);
      setPreviewProjectMetadata(null);
      setProjectPriorityOverride(null);
      setPreviewAiMeta({});
      setDuplicateSaveState(null);
      setSaveSuccess(false);

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: text }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const handled = handleExtractError(data, "Extraction failed");
        if (handled) return;
      }

      const extractedTasks = getExtractResponseTasks(data);
      const projectMetadata = getExtractResponseProjectMetadata(data);
      const hybridResult = await buildHybridPreviewsFromTasks(
        extractedTasks,
        "AI extraction"
      );

      setPreviewProjectMetadata(projectMetadata);
      setPreviewItems(hybridResult.previewItems);
      setPreviewAiMeta(hybridResult.aiMetaByPreviewId);
      clearSelectedImage();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  }

  async function extractFromSelectedImage() {
    if (!selectedImage?.file || isExtracting) {
      return;
    }

    try {
      setIsExtracting(true);
      setHasTriedExtract(true);
      importAttemptIdRef.current = null;
      setPreviewItems([]);
      setPreviewProjectMetadata(null);
      setProjectPriorityOverride(null);
      setPreviewAiMeta({});
      setDuplicateSaveState(null);
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
      toast.error(error.message || "Image extraction failed");
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

        if (
          field === "contact_name" ||
          field === "contactName" ||
          field === "contact_person" ||
          field === "contactPerson"
        ) {
          return {
            ...item,
            contact_name: value,
            contactName: value,
            contact_person: value,
            contactPerson: value,
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

  function removePreviewItem(previewId: string) {
    setPreviewItems((prev) =>
      prev.filter((item) => item.previewId !== previewId)
    );

    setPreviewAiMeta((prev) => {
      if (!prev[previewId]) return prev;

      const next = { ...prev };
      delete next[previewId];
      return next;
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

  function updateProjectPriorityOverride(priority: PreviewProjectPriority) {
    setProjectPriorityOverride(priority);
  }

  function buildProjectPayload(
    group: PreviewProjectGroup,
    importMode: ProjectImportMode | null = null
  ) {
    const usesProjectMetadata =
      importMode === PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA;
    const rawInput = getGroupRawInput(group);
    const contactName = getGroupContactName(group);
    const projectPriorityIntent = getProjectPriorityIntent(
      group,
      usesProjectMetadata
    );

    return {
      create_project: true,
      project: {
        client_name: group.clientName,
        contact_name: contactName,
        contactName,
        contact_person: contactName,
        contactPerson: contactName,
        client_phone: getGroupClientPhone(group),
        client_email: getGroupClientEmail(group),
        client_notes: getGroupClientNotes(group),
        project_title: group.projectTitle || "Client project",
        summary: group.projectSummary || "",
        amount: group.amount || "",
        deadline_text: group.deadline || "",
        deadline_date: buildSaveDeadlineDate(group.deadlineDate),
        priority: usesProjectMetadata
          ? group.priority || ""
          : group.priority || "Medium",
        ...(projectPriorityIntent === null
          ? {}
          : { project_priority_intent: projectPriorityIntent }),
        status: getProjectStatusFromGroup(group),
        source: group.source || "Project extraction",
        raw_input:
          rawInput ||
          (group.source === "Image extraction"
            ? "Extracted from uploaded image"
            : inputText),
        subtasks: group.items.map((item, index) => {
          const preview = item.preview;
          const subtaskContactName =
            getPreviewContactName(preview) || contactName;

          return {
            task_title: preview.task,
            contact_name: subtaskContactName,
            contactName: subtaskContactName,
            contact_person: subtaskContactName,
            contactPerson: subtaskContactName,
            amount: usesProjectMetadata
              ? preview.amount || ""
              : preview.amount || group.amount || "",
            deadline_text:
              buildSaveDeadlineValue(preview) ||
              (usesProjectMetadata ? "" : group.deadline || ""),
            priority: usesProjectMetadata
              ? preview.priority || "Medium"
              : preview.priority || group.priority || "Medium",
            status: preview.status || "New",
            source: preview.source || group.source || "Project extraction",
            raw_input:
              preview.raw_input ||
              rawInput ||
              (group.source === "Image extraction"
                ? "Extracted from uploaded image"
                : inputText),
            subtask_order: index + 1,
            resources: [],
          };
        }),
      },
    };
  }

  async function saveProjectBatch(
    projectGroups: PreviewProjectGroup[],
    idempotencyKey: string,
    duplicateOverrideGroupIndexes: number[] = [],
    importMode: ProjectImportMode | null = null
  ) {
    const res = await fetch("/api/projects/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projects: projectGroups.map((group) =>
          buildProjectPayload(group, importMode)
        ),
        duplicateOverrideGroupIndexes,
        idempotencyKey,
        ...(importMode ? { importMode } : {}),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const firstDuplicate = Array.isArray(data?.duplicates)
        ? data.duplicates[0]
        : null;

      if (
        res.status === 409 &&
        data?.code === "DUPLICATE_PROJECT_DETECTED" &&
        firstDuplicate?.duplicate &&
        Number.isSafeInteger(firstDuplicate.groupIndex)
      ) {
        const duplicateError = new Error(
          "Duplicate project detected"
        ) as DuplicateProjectSaveError;

        duplicateError.code = "DUPLICATE_PROJECT_DETECTED";
        duplicateError.duplicate = firstDuplicate.duplicate;
        duplicateError.groupIndex = firstDuplicate.groupIndex;

        throw duplicateError;
      }

      throw new Error(data.message || data.error || "Failed to save project");
    }

    const savedTasks = Array.isArray(data.createdTasks) ? data.createdTasks : [];

    return savedTasks.map(mapSavedTaskToRow);
  }

  function finishSuccessfulSaveFlow() {
    setSaveSuccess(true);

    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }

    saveSuccessTimerRef.current = setTimeout(() => {
      try {
        onGoToTasks();
        resetPreviewState();
      } catch (error) {
        console.error("Project import navigation error:", error);
        toast.warning(
          "Projects were saved, but Tasks could not open automatically."
        );
      }
    }, 500);
  }

  function synchronizeCommittedImport(savedRows: TaskRow[]) {
    try {
      if (savedRows.length > 0) {
        onTasksSaved(savedRows);
      }

      finishSuccessfulSaveFlow();
    } catch (error) {
      console.error("Project import local synchronization error:", error);
      toast.warning(
        "Projects were saved, but the dashboard could not refresh. Please open Tasks to view them."
      );
    }
  }

  async function savePreviewToTasks() {
    if (!previewItems.length || isSavingAll) return;

    const importMode = previewProjectMetadata
      ? PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA
      : null;
    const projectGroups = buildPreviewProjectGroups(
      previewItems,
      previewProjectMetadata,
      projectPriorityOverride
    );

    try {
      setIsSavingAll(true);
      setSaveSuccess(false);
      setDuplicateSaveState(null);

      const importAttemptId = getOrCreateImportAttemptId();
      const allSavedRows = await saveProjectBatch(
        projectGroups,
        importAttemptId,
        [],
        importMode
      );

      synchronizeCommittedImport(allSavedRows);
    } catch (error: any) {
      console.error(error);

      if (isDuplicateProjectSaveError(error)) {
        setDuplicateSaveState({
          duplicate: error.duplicate,
          projectGroups,
          duplicateGroupIndex: error.groupIndex,
          overrideGroupIndexes: [],
          importMode,
        });
        return;
      }

      toast.error(error.message || "Failed to save project");
    } finally {
      setIsSavingAll(false);
    }
  }

  async function saveDuplicateProjectAnyway() {
    if (!duplicateSaveState || isSavingDuplicateAnyway) return;

    try {
      setIsSavingDuplicateAnyway(true);
      setIsSavingAll(true);
      setSaveSuccess(false);

      const nextOverrideGroupIndexes = Array.from(
        new Set([
          ...duplicateSaveState.overrideGroupIndexes,
          duplicateSaveState.duplicateGroupIndex,
        ])
      );
      const importAttemptId = getOrCreateImportAttemptId();
      const allSavedRows = await saveProjectBatch(
        duplicateSaveState.projectGroups,
        importAttemptId,
        nextOverrideGroupIndexes,
        duplicateSaveState.importMode
      );

      setDuplicateSaveState(null);
      synchronizeCommittedImport(allSavedRows);
    } catch (error: any) {
      console.error(error);

      if (isDuplicateProjectSaveError(error)) {
        setDuplicateSaveState((current) =>
          current
            ? {
                ...current,
                duplicate: error.duplicate,
                duplicateGroupIndex: error.groupIndex,
                overrideGroupIndexes: Array.from(
                  new Set([
                    ...current.overrideGroupIndexes,
                    current.duplicateGroupIndex,
                  ])
                ),
              }
            : current
        );
        return;
      }

      toast.error(error.message || "Failed to save project");
    } finally {
      setIsSavingDuplicateAnyway(false);
      setIsSavingAll(false);
    }
  }

  function cancelDuplicateSave() {
    if (isSavingDuplicateAnyway) return;
    importAttemptIdRef.current = null;
    setDuplicateSaveState(null);
  }

  function viewExistingDuplicateProject() {
    const existingTaskId = duplicateSaveState?.duplicate?.existing_task_id;

    if (existingTaskId) {
      importAttemptIdRef.current = null;
      const path = `/dashboard?view=tasks&taskId=${encodeURIComponent(
        String(existingTaskId)
      )}`;
      const url =
        typeof window !== "undefined"
          ? new URL(path, window.location.origin).toString()
          : path;

      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    importAttemptIdRef.current = null;
    setDuplicateSaveState(null);
    onGoToTasks();
  }

  return (
    <>
      <style>{extractWorkspaceResponsiveCss}</style>

      <div style={extractWorkspaceStyle}>
        <ExtractWorkspaceHero plan={plan} />

        <section className="extract-workspace-shell" style={workspaceShellStyle}>
          <div style={workspaceHeaderStyle}>
            <div>
              <h2 style={workspaceTitleStyle}>Create structured work</h2>

              <p style={workspaceDescriptionStyle}>
                Start with text or a screenshot.
              </p>
            </div>
          </div>

          <ExtractInputPanels
            text={inputText}
            onTextChange={setInputText}
            onExtractText={extractWithAI}
            onClearText={clearTextInput}
            onImageSelected={handleImageSelected}
            onExtractImage={extractFromSelectedImage}
            onRemoveImage={clearSelectedImage}
            selectedImagePreviewUrl={selectedImagePreviewUrl}
            selectedImageName={selectedImage?.file?.name || ""}
            isBusy={isExtracting}
            imageProgress={imageProgress}
          />
        </section>

        {showExtractingState ? (
          <section className="extract-ai-loading-shell" style={loadingShellStyle}>
            <div style={loadingIconStyle}>
              <span style={loadingPulseDotStyle} />
            </div>

            <div>
              <div style={loadingEyebrowStyle}>AI extraction in progress</div>

              <h2 style={loadingTitleStyle}>Building your project preview…</h2>

              <p style={loadingTextStyle}>
                Reading the request, detecting client details, grouping subtasks,
                and preparing a review-first project draft.
              </p>
            </div>
          </section>
        ) : null}

        {hasPreview ? (
          <section className="extract-preview-open-shell" style={previewOpenShellStyle}>
            <header className="extract-preview-open-header" style={previewOpenHeaderStyle}>
              <div>
                <h2 style={previewOpenTitleStyle}>
                  Review the project before saving
                </h2>
              </div>

              <div style={previewOpenActionsStyle}>
                <div style={previewCountStyle}>{previewStats.detectedLabel}</div>

                <button
                  className="extract-preview-save-button"
                  onClick={savePreviewToTasks}
                  disabled={isSavingAll || isSavingDuplicateAnyway}
                  style={{
                    ...saveAllButtonStyle,
                    background:
                      isSavingAll || isSavingDuplicateAnyway
                        ? "#94a3b8"
                        : saveSuccess
                          ? "#16a34a"
                          : "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                    cursor:
                      isSavingAll || isSavingDuplicateAnyway
                        ? "not-allowed"
                        : "pointer",
                    opacity: isSavingAll || isSavingDuplicateAnyway ? 0.9 : 1,
                    boxShadow:
                      isSavingAll || isSavingDuplicateAnyway || saveSuccess
                        ? "none"
                        : "0 18px 36px rgba(79,70,229,0.24)",
                  }}
                >
                  {isSavingAll || isSavingDuplicateAnyway
                    ? "Saving project..."
                    : saveSuccess
                      ? "Saved ✓"
                      : previewStats.saveLabel}
                </button>
              </div>
            </header>

            <EditablePreviewList
              previewItems={previewItems}
              aiMetaByPreviewId={previewAiMeta}
              projectMetadata={previewProjectMetadata}
              projectPriorityOverride={projectPriorityOverride}
              onChange={updatePreviewItem}
              onProjectPriorityChange={
                previewProjectMetadata ? updateProjectPriorityOverride : undefined
              }
              onUndoChange={handleUndoChange}
              onRemovePreviewItem={removePreviewItem}
            />
          </section>
        ) : null}

        {showEmptyState ? (
          <section className="extract-empty-shell" style={emptyShellStyle}>
            <div style={emptyResultStyle}>
              <div style={emptyResultIconStyle}>⌕</div>

              <div>
                <div style={emptyResultTitleStyle}>No clear tasks detected</div>

                <div style={emptyResultTextStyle}>
                  This looks more like notes or ideas than actionable work. Try
                  adding deliverables, budget, deadline, client name, or urgency.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHasTriedExtract(false)}
                style={tryAgainButtonStyle}
              >
                Try another input
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <DuplicateProjectModal
        isOpen={Boolean(duplicateSaveState)}
        duplicate={duplicateSaveState?.duplicate || null}
        isSavingAnyway={isSavingDuplicateAnyway}
        onCancel={cancelDuplicateSave}
        onViewExisting={viewExistingDuplicateProject}
        onSaveAnyway={saveDuplicateProjectAnyway}
      />

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
}

const extractWorkspaceStyle: CSSProperties = {
  display: "grid",
  gap: 22,
};

const workspaceShellStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  padding: "4px 28px 0",
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const workspaceHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
};

const workspaceTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.12,
  fontWeight: 850,
  letterSpacing: "-0.045em",
};

const workspaceDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 620,
  maxWidth: 760,
};

const loadingShellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  borderRadius: 24,
  padding: 20,
  background:
    "linear-gradient(135deg, rgba(238,242,255,0.88) 0%, rgba(255,255,255,0.92) 100%)",
  border: "1px solid rgba(199,210,254,0.7)",
};

const loadingIconStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 17,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)",
  boxShadow: "0 18px 34px rgba(79,70,229,0.22)",
  flexShrink: 0,
};

const loadingPulseDotStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "#ffffff",
  boxShadow: "0 0 0 8px rgba(255,255,255,0.22)",
};

const loadingEyebrowStyle: CSSProperties = {
  color: "#4f46e5",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.13em",
};

const loadingTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 22,
  lineHeight: 1.15,
  fontWeight: 850,
  letterSpacing: "-0.04em",
};

const loadingTextStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 650,
  maxWidth: 780,
};

const previewOpenShellStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: "4px 0 0",
};

const previewOpenHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 18,
  padding: "0 4px",
};

const previewOpenTitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.08,
  fontWeight: 850,
  letterSpacing: "-0.05em",
};

const previewOpenActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const previewCountStyle: CSSProperties = {
  borderRadius: 999,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(199,210,254,0.8)",
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const saveAllButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "13px 17px",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 900,
  minWidth: 190,
};

const emptyShellStyle: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.9) 100%)",
  border: "1px solid rgba(226,232,240,0.86)",
};

const emptyResultStyle: CSSProperties = {
  border: "1px solid rgba(226,232,240,0.82)",
  background:
    "radial-gradient(circle at top left, rgba(238,242,255,0.65) 0%, transparent 34%), linear-gradient(180deg, rgba(248,250,252,0.82) 0%, rgba(255,255,255,0.74) 100%)",
  borderRadius: 22,
  padding: 28,
  textAlign: "center",
  display: "grid",
  justifyItems: "center",
  gap: 10,
};

const emptyResultIconStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(238,242,255,0.92)",
  border: "1px solid rgba(199,210,254,0.95)",
  color: "#4f46e5",
  fontSize: 18,
  fontWeight: 950,
};

const emptyResultTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const emptyResultTextStyle: CSSProperties = {
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.7,
  maxWidth: 620,
  margin: "0 auto",
  fontWeight: 650,
};

const tryAgainButtonStyle: CSSProperties = {
  marginTop: 6,
  border: "1px solid rgba(199,210,254,0.95)",
  background: "#ffffff",
  color: "#4338ca",
  borderRadius: 14,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const extractWorkspaceResponsiveCss = `
  @media (max-width: 1120px) {
    .extract-premium-hero {
      padding: 24px !important;
    }

    .extract-premium-hero-content {
      grid-template-columns: 1fr !important;
    }

    .extract-premium-workflow {
      max-width: 720px !important;
    }
  }

  @media (max-width: 900px) {
    .dashboard-content-card {
      overflow: hidden;
    }

    .extract-workspace-shell {
      padding: 18px !important;
      border-radius: 24px !important;
    }
  }

  @media (max-width: 760px) {
    .extract-premium-hero {
      min-height: auto !important;
      border-radius: 24px !important;
    }

    .extract-premium-hero-content {
      grid-template-columns: minmax(0, 1fr) !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      gap: 24px !important;
    }

    .extract-premium-hero-copy {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }

    .extract-premium-workflow {
      grid-template-columns: minmax(0, 1fr) !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      gap: 14px !important;
    }

    .extract-premium-workflow-step {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }

    .extract-premium-workflow-step > div:last-child {
      min-width: 0 !important;
    }

    .extract-premium-workflow-arrow {
      display: none !important;
    }

    .extract-premium-hero h1 {
      font-size: 34px !important;
      letter-spacing: -0.055em !important;
    }

    .extract-preview-open-header {
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    .extract-preview-open-header > div:last-child {
      width: 100%;
      justify-content: flex-start !important;
    }
  }

  @media (max-width: 700px) {
    .extract-workspace-shell > div:first-child {
      flex-direction: column !important;
      align-items: flex-start !important;
    }
  }

  @media (max-width: 640px) {
    .extract-preview-save-button {
      width: 100% !important;
    }

    .extract-ai-loading-shell {
      align-items: flex-start !important;
    }

    .extract-preview-open-shell {
      gap: 12px !important;
    }
  }

  @media (max-width: 560px) {
    .extract-premium-hero {
      padding: 20px !important;
    }

    .extract-premium-hero h1 {
      font-size: 30px !important;
    }

    .extract-workspace-shell {
      padding: 14px !important;
      border-radius: 22px !important;
    }
  }

  @media (max-width: 480px) {
    form,
    textarea,
    input,
    select,
    button {
      max-width: 100%;
    }
  }
`;
