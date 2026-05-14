"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import EditablePreviewList, {
  buildPreviewProjectGroups,
  getPreviewProjectStats,
  type PreviewProjectGroup,
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

type DuplicateSaveState = {
  duplicate: DuplicateProjectMatch;
  group: PreviewProjectGroup;
  remainingGroups: PreviewProjectGroup[];
  savedRowsBeforeDuplicate: TaskRow[];
};

type SaveProjectOptions = {
  skipDuplicateCheck?: boolean;
};

type DuplicateProjectSaveError = Error & {
  code: "DUPLICATE_PROJECT_DETECTED";
  duplicate: DuplicateProjectMatch;
};

function normalizePriority(value: unknown): "Low" | "Medium" | "High" {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "high") return "High";
  if (clean === "low") return "Low";
  return "Medium";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPreviewContactName(preview: PreviewItem) {
  return normalizeOptionalText(
    preview.contact_name ||
      preview.contactName ||
      preview.contact_person ||
      preview.contactPerson
  );
}

function buildSaveDeadlineValue(preview: PreviewItem) {
  if (preview.deadline_original_text?.trim()) {
    return preview.deadline_original_text.trim();
  }

  return preview.deadline.trim();
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

  const [duplicateSaveState, setDuplicateSaveState] =
    useState<DuplicateSaveState | null>(null);
  const [isSavingDuplicateAnyway, setIsSavingDuplicateAnyway] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const previewIdRef = useRef(0);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewStats = getPreviewProjectStats(previewItems);
  const hasPreview = previewItems.length > 0;
  const showExtractingState = isExtracting && !hasPreview;
  const showEmptyState = hasTriedExtract && !isExtracting && !hasPreview;

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
    setHasTriedExtract(false);
    setInputText("");
    clearSelectedImage();
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
      contact_name:
        task.contact_name ||
        task.contactName ||
        task.contact_person ||
        task.contactPerson ||
        "",
      contactName:
        task.contact_name ||
        task.contactName ||
        task.contact_person ||
        task.contactPerson ||
        "",
      contact_person:
        task.contact_name ||
        task.contactName ||
        task.contact_person ||
        task.contactPerson ||
        "",
      contactPerson:
        task.contact_name ||
        task.contactName ||
        task.contact_person ||
        task.contactPerson ||
        "",
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
      setPreviewItems([]);
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
    if (!selectedImage?.file || isExtracting) {
      return;
    }

    try {
      setIsExtracting(true);
      setHasTriedExtract(true);
      setPreviewItems([]);
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

  function buildProjectPayload(
    group: PreviewProjectGroup,
    options: SaveProjectOptions = {}
  ) {
    const rawInput = getGroupRawInput(group);
    const contactName = getGroupContactName(group);

    return {
      create_project: true,
      skip_duplicate_check: Boolean(options.skipDuplicateCheck),
      save_anyway: Boolean(options.skipDuplicateCheck),
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
        priority: group.priority || "Medium",
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
            amount: preview.amount || group.amount || "",
            deadline_text:
              buildSaveDeadlineValue(preview) || group.deadline || "",
            priority: preview.priority || group.priority || "Medium",
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

  async function saveProjectGroup(
    group: PreviewProjectGroup,
    options: SaveProjectOptions = {}
  ) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildProjectPayload(group, options)),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data?.error === "DUPLICATE_PROJECT_DETECTED") {
        const duplicateError = new Error(
          "Duplicate project detected"
        ) as DuplicateProjectSaveError;

        duplicateError.code = "DUPLICATE_PROJECT_DETECTED";
        duplicateError.duplicate = data.duplicate;

        throw duplicateError;
      }

      throw new Error(data.message || data.error || "Failed to save project");
    }

    const savedTasks = Array.isArray(data.tasks) ? data.tasks : [];

    return savedTasks.map(mapSavedTaskToRow);
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
      setDuplicateSaveState(null);

      const projectGroups = buildPreviewProjectGroups(previewItems);
      const allSavedRows: TaskRow[] = [];

      for (let index = 0; index < projectGroups.length; index += 1) {
        const group = projectGroups[index];

        try {
          const savedRows = await saveProjectGroup(group);
          allSavedRows.push(...savedRows);
        } catch (error) {
          if (isDuplicateProjectSaveError(error)) {
            setDuplicateSaveState({
              duplicate: error.duplicate,
              group,
              remainingGroups: projectGroups.slice(index + 1),
              savedRowsBeforeDuplicate: allSavedRows,
            });
            return;
          }

          throw error;
        }
      }

      if (allSavedRows.length > 0) {
        onTasksSaved(allSavedRows);
      }

      finishSuccessfulSaveFlow();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to save project");
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

      const allSavedRows: TaskRow[] = [
        ...duplicateSaveState.savedRowsBeforeDuplicate,
      ];

      const duplicateSavedRows = await saveProjectGroup(
        duplicateSaveState.group,
        {
          skipDuplicateCheck: true,
        }
      );

      allSavedRows.push(...duplicateSavedRows);

      for (const group of duplicateSaveState.remainingGroups) {
        const savedRows = await saveProjectGroup(group);
        allSavedRows.push(...savedRows);
      }

      setDuplicateSaveState(null);

      if (allSavedRows.length > 0) {
        onTasksSaved(allSavedRows);
      }

      finishSuccessfulSaveFlow();
    } catch (error: any) {
      console.error(error);

      if (isDuplicateProjectSaveError(error)) {
        setDuplicateSaveState((current) =>
          current
            ? {
                ...current,
                duplicate: error.duplicate,
              }
            : current
        );
        return;
      }

      alert(error.message || "Failed to save project");
    } finally {
      setIsSavingDuplicateAnyway(false);
      setIsSavingAll(false);
    }
  }

  function cancelDuplicateSave() {
    if (isSavingDuplicateAnyway) return;
    setDuplicateSaveState(null);
  }

  function viewExistingDuplicateProject() {
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
              <div style={workspaceEyebrowStyle}>Client request workspace</div>

              <h2 style={workspaceTitleStyle}>Create structured work</h2>

              <p style={workspaceDescriptionStyle}>
                Paste a client work request or upload a screenshot. Text2Task
                extracts projects, subtasks, deadlines, budget, priority,
                contact details, and context before anything is saved.
              </p>
            </div>

            <div style={workspaceStatusStyle}>
              <span style={workspaceStatusDotStyle} />
              Review-first workflow
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
            selectedImagePreviewUrl={selectedImage?.previewUrl || null}
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
                <div style={previewEyebrowStyle}>AI Project Preview</div>

                <h2 style={previewOpenTitleStyle}>
                  Review the project before saving
                </h2>

                <p style={previewOpenDescriptionStyle}>
                  Edit anything now — nothing is saved until you approve.
                </p>
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
              onChange={updatePreviewItem}
              onUndoChange={handleUndoChange}
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
  borderRadius: 30,
  padding: 22,
  background:
    "radial-gradient(circle at top left, rgba(238,242,255,0.95) 0%, transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.94) 100%)",
  border: "1px solid rgba(226,232,240,0.92)",
  boxShadow:
    "0 28px 70px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
};

const workspaceHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 18,
  marginBottom: 18,
};

const workspaceEyebrowStyle: CSSProperties = {
  color: "#4f46e5",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.13em",
};

const workspaceTitleStyle: CSSProperties = {
  margin: "5px 0 0",
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
  maxWidth: 780,
};

const workspaceStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "9px 12px",
  background: "#ffffff",
  border: "1px solid rgba(199,210,254,0.88)",
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
  boxShadow: "0 10px 24px rgba(15,23,42,0.045)",
};

const workspaceStatusDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#22c55e",
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

const previewEyebrowStyle: CSSProperties = {
  color: "#4f46e5",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.13em",
};

const previewOpenTitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.08,
  fontWeight: 850,
  letterSpacing: "-0.05em",
};

const previewOpenDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 620,
  maxWidth: 760,
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

    .extract-premium-hero > div:nth-child(3) {
      grid-template-columns: 1fr !important;
    }

    .extract-premium-hero > div:nth-child(3) > div:nth-child(2) {
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

    .extract-premium-hero > div:nth-child(3) > div:nth-child(2) {
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