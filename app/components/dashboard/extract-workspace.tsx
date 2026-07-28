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
import { parseDateOnly } from "@/lib/tasks/date-only";
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
import { classifySaveProjectBatchResponse } from "./save-project-batch-result";
import type { TaskRow } from "./tasks-view";
import type { ProjectEntity } from "./tasks/task-types";

export type PreviewItem = ExtractedPreview & {
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

type SaveProjectBatchResult =
  | { status: "saved"; savedRows: TaskRow[] }
  | { status: "duplicate"; duplicate: DuplicateProjectMatch; groupIndex: number };

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

function asJsonRecordOf(value: unknown): Record<string, unknown> {
  return isJsonRecord(value) ? value : {};
}

function pickString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return "";
}

function pickStringOrNull(...candidates: unknown[]): string | null {
  return pickString(...candidates) || null;
}

/** Preserves an empty-string value rather than treating it as absent. */
function firstTypedString<T>(candidates: unknown[], fallback: T): string | T {
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }
  return fallback;
}

/** Nullish-coalescing pick: only null/undefined fall through, "" is kept. */
function firstDefinedString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    return typeof candidate === "string" ? candidate : null;
  }
  return null;
}

export function getExtractResponseTasks(data: unknown) {
  return isJsonRecord(data) && Array.isArray(data.tasks) ? data.tasks : [];
}

export function getExtractResponseProjectMetadata(
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

export function getNormalizedExtractedContactName(task: unknown) {
  const record = asJsonRecordOf(task);
  const rawContact =
    record.contact_name ||
    record.contactName ||
    record.contact_person ||
    record.contactPerson ||
    "";
  const clientName = normalizeOptionalText(record.client_name);

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

/*
  Per-subtask deadline_text sent to /api/projects/import. import-persistence.
  server.ts (not owned by this integration) always re-derives each
  *subtask's* own persisted deadline_date by re-parsing this deadline_text
  server-side -- it never trusts a client-supplied per-subtask deadline_date
  the way it does for the project-level payload (see buildProjectPayload's
  `deadline_date: buildSaveDeadlineDate(group.deadlineDate)`, which the
  import RPC/route does respect).

  A DeadlineField picker commit intentionally leaves deadline_original_text/
  deadline (AI provenance) untouched on every item in the group -- only
  deadline_date is updated (see updatePreviewItem's generic field-name
  fallback for "deadline_date"). Without this helper, a subtask's saved
  deadline would silently diverge from the date the user just picked: it
  would stay pinned to whatever free-text was extracted (e.g. "next Friday"),
  re-parsed server-side at save time rather than reflecting the picked date.

  `""` is the explicit-clear sentinel a picker "Clear" commit writes to
  every item's deadline_date (see the same fallback branch) -- distinct from
  `null`/`undefined`, which means "no date was ever resolved for this item."
  Preferring the canonical deadline_date whenever it is set to a real value,
  and short-circuiting to an empty deadline_text when it was explicitly
  cleared, keeps every subtask's saved deadline consistent with what the
  picker shows, without touching the provenance fields themselves.
*/
export function buildSaveSubtaskDeadlineText(
  preview: PreviewItem,
  group: PreviewProjectGroup,
  usesProjectMetadata: boolean
) {
  if (preview.deadline_date === "") {
    return "";
  }

  const canonicalDeadlineDate = parseDateOnly(preview.deadline_date ?? null);

  if (canonicalDeadlineDate) {
    return canonicalDeadlineDate;
  }

  return (
    buildSaveDeadlineValue(preview) ||
    (usesProjectMetadata ? "" : group.deadline || "")
  );
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function buildSaveDeadlineDate(deadlineDate?: string | null) {
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

export function mapSavedProject(saved: unknown) {
  const savedRecord = asJsonRecordOf(saved);
  const rawProjectValue = savedRecord.project ?? savedRecord.projects ?? null;

  if (!isJsonRecord(rawProjectValue)) {
    return null;
  }

  const project = rawProjectValue;

  return {
    id: pickString(project.id, savedRecord.project_id),
    client_id: pickStringOrNull(project.client_id),
    client_name: pickStringOrNull(project.client_name),
    contact_name: pickStringOrNull(project.contact_name),
    title: pickStringOrNull(project.title),
    summary: pickStringOrNull(project.summary),
    amount:
      project.amount !== null && project.amount !== undefined
        ? String(project.amount)
        : null,
    amount_value:
      typeof project.amount_value === "number" ? project.amount_value : null,
    currency_code: pickStringOrNull(project.currency_code),
    deadline_text: pickStringOrNull(project.deadline_text),
    deadline_date: pickStringOrNull(project.deadline_date),
    priority: pickStringOrNull(project.priority),
    priority_source: pickStringOrNull(project.priority_source) as
      | ProjectEntity["priority_source"]
      | null,
    status: pickStringOrNull(project.status),
    source: pickStringOrNull(project.source),
    raw_input: pickStringOrNull(project.raw_input),
    created_at: pickStringOrNull(project.created_at),
    updated_at: pickStringOrNull(project.updated_at),
    completed_at: pickStringOrNull(project.completed_at),
    is_archived:
      typeof project.is_archived === "boolean" ? project.is_archived : null,
    archived_at: pickStringOrNull(project.archived_at),
    deleted_at: pickStringOrNull(project.deleted_at),
  };
}

export function mapSavedTaskToRow(saved: unknown): TaskRow {
  const record = asJsonRecordOf(saved);
  const client = asJsonRecordOf(record.client);
  const hasClient = isJsonRecord(record.client);

  const rawDeadlineText = firstTypedString([record.deadline_text], "");
  const rawDeadlineDate = firstTypedString([record.deadline_date], null);

  const displayDeadline =
    formatDeadline(rawDeadlineText, rawDeadlineDate) ||
    rawDeadlineText ||
    (rawDeadlineDate ? formatDeadline(rawDeadlineDate) : "") ||
    "";

  const project = mapSavedProject(saved);

  return {
    id: typeof record.id === "number" ? record.id : Number(record.id),
    client: hasClient
      ? {
          id: pickString(client.id),
          name: pickString(client.name),
          contact_name: firstDefinedString(client.contact_name),
          phone: firstDefinedString(client.phone),
          email: firstDefinedString(client.email),
          notes: firstDefinedString(client.notes),
        }
      : null,
    project,
    task: pickString(record.task_title),
    amount:
      record.amount !== null && record.amount !== undefined
        ? String(record.amount)
        : "",
    deadline: displayDeadline,
    deadline_date: rawDeadlineDate,
    deadline_original_text: rawDeadlineText || null,
    priority: pickString(record.priority) || "Medium",
    status: pickString(record.status) || "New",
    source: pickString(record.source) || "Project extraction",
    raw_input: pickString(record.raw_input),
    created_at: pickStringOrNull(record.created_at),
    updated_at: pickStringOrNull(record.updated_at),
    is_archived: Boolean(record.is_archived),
    completed_at: pickStringOrNull(record.completed_at),
    archived_at: pickStringOrNull(record.archived_at),
    deleted_at: pickStringOrNull(record.deleted_at),
    project_id: pickStringOrNull(record.project_id) || project?.id || null,
    subtask_order:
      typeof record.subtask_order === "number" ? record.subtask_order : null,
    contact_name: firstDefinedString(record.contact_name, client.contact_name),
    client_phone: firstDefinedString(client.phone),
    client_email: firstDefinedString(client.email),
    client_notes: firstDefinedString(client.notes),
  };
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

  function mapTaskToPreview(task: unknown, source: string): PreviewItem {
    const record = asJsonRecordOf(task);
    const originalDeadlineText = pickString(record.deadline_text);
    const parsedDeadline = parseDeadline(originalDeadlineText);
    const contactName = getNormalizedExtractedContactName(task);

    const displayDeadline =
      formatDeadline(originalDeadlineText, parsedDeadline.deadlineDate) ||
      originalDeadlineText;

    return {
      previewId: createPreviewId(),
      client: pickString(record.client_name),
      contact_name: contactName,
      contactName,
      contact_person: contactName,
      contactPerson: contactName,
      client_phone: pickString(record.client_phone, record.phone),
      client_email: pickString(record.client_email, record.email),
      client_notes: pickString(record.client_notes, record.notes),
      task: pickString(record.task_title),
      amount: pickString(record.amount),
      deadline: displayDeadline,
      deadline_date: parsedDeadline.deadlineDate,
      deadline_original_text: originalDeadlineText || null,
      priority: normalizePriority(record.priority),
      status: "Not Started",
      source,
      raw_input: pickString(record.raw_input),
    };
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
    extractedTasks: unknown[],
    source: string
  ): Promise<{
    previewItems: PreviewItem[];
    aiMetaByPreviewId: Record<string, HybridPreviewMeta>;
  }> {
    const mappedPreviews = extractedTasks.map((task) =>
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

  function handleExtractError(data: unknown, fallbackMessage: string) {
    const record = asJsonRecordOf(data);

    if (
      record.upgrade_required ||
      record.error === "FREE_EXTRACT_LIMIT_REACHED"
    ) {
      setShowUpgrade(true);
      return true;
    }

    throw new Error(pickString(record.message, record.error) || fallbackMessage);
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
    } catch (error) {
      console.error(error);
      toast.error(
        (error instanceof Error && error.message) || "Extraction failed"
      );
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
    } catch (error) {
      console.error(error);
      setImageProgress(0);
      toast.error(
        (error instanceof Error && error.message) || "Image extraction failed"
      );
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
    /*
      import-persistence.server.ts's project-level deadline resolution is
      `suppliedDeadlineDate ?? <re-parsed from deadline_text>` -- since `??`
      treats an explicit `null` as "not supplied," sending
      `deadline_date: null` alone does NOT clear an existing deadline_text;
      it silently falls back to re-parsing whatever deadline_text is still
      present. A picker "Clear" commit deliberately leaves deadline/
      deadline_original_text (AI provenance) untouched and only resets every
      item's deadline_date to "" (see updatePreviewItem's generic
      "deadline_date" fallback), so group.deadline can still hold stale free
      text after a clear. Detect that explicit-clear state here so a cleared
      deadline is actually saved as cleared, not silently resurrected.
    */
    const deadlineExplicitlyCleared = group.items.every(
      (item) => item.preview.deadline_date === ""
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
        deadline_text: deadlineExplicitlyCleared ? "" : group.deadline || "",
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
            deadline_text: buildSaveSubtaskDeadlineText(
              preview,
              group,
              usesProjectMetadata
            ),
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
  ): Promise<SaveProjectBatchResult> {
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
    const outcome = classifySaveProjectBatchResponse({
      ok: res.ok,
      status: res.status,
      data,
    });

    // A duplicate result is an expected business outcome (the user is asked
    // to view the existing project or save anyway), never a thrown error --
    // only a genuine "error" outcome (malformed response, unexpected error
    // code, 5xx, etc.) surfaces as a thrown Error for the existing
    // genuine-failure handling in callers.
    if (outcome.status === "error") {
      throw new Error(outcome.message);
    }

    if (outcome.status === "duplicate") {
      return outcome;
    }

    return {
      status: "saved",
      savedRows: outcome.createdTasks.map(mapSavedTaskToRow),
    };
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
      const result = await saveProjectBatch(
        projectGroups,
        importAttemptId,
        [],
        importMode
      );

      if (result.status === "duplicate") {
        setDuplicateSaveState({
          duplicate: result.duplicate,
          projectGroups,
          duplicateGroupIndex: result.groupIndex,
          overrideGroupIndexes: [],
          importMode,
        });
        return;
      }

      synchronizeCommittedImport(result.savedRows);
    } catch (error) {
      console.error(error);
      toast.error(
        (error instanceof Error && error.message) || "Failed to save project"
      );
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
      const result = await saveProjectBatch(
        duplicateSaveState.projectGroups,
        importAttemptId,
        nextOverrideGroupIndexes,
        duplicateSaveState.importMode
      );

      if (result.status === "duplicate") {
        setDuplicateSaveState((current) =>
          current
            ? {
                ...current,
                duplicate: result.duplicate,
                duplicateGroupIndex: result.groupIndex,
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

      setDuplicateSaveState(null);
      synchronizeCommittedImport(result.savedRows);
    } catch (error) {
      console.error(error);
      toast.error(
        (error instanceof Error && error.message) || "Failed to save project"
      );
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
