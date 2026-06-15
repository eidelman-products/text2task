import { useState, useCallback } from "react";
import type {
  ClientEntity,
  ProjectEntity,
  TaskProjectGroup,
} from "../task-types";
import type {
  AnalyzeProjectUpdateResult,
  ApplyProjectUpdateResult,
  ProjectUpdateUIState,
  InputMethod,
  JsonRecord,
} from "./project-update-types";

type AnalyzeProjectUpdateApiResponse =
  | ({
      ok: true;
    } & AnalyzeProjectUpdateResult)
  | {
      ok: false;
      error: string;
      details?: unknown;
    };

type ApplyProjectUpdateApiResponse =
  | ({
      ok: true;
    } & ApplyProjectUpdateResult & {
      project?: AppliedProjectEntity | null;
      projectTasks?: unknown[];
      dashboardTasks?: unknown[];
    })
  | {
      ok: false;
      code?: string;
      error: string;
      message?: string;
      duplicate?: {
        existingTaskId: number;
        existingTitle: string;
        proposedTitle: string;
        score: number;
        reason: string;
      };
      details?: unknown;
    };

type ProjectUpdateApplyCallbackResult = {
  focusTaskId?: number | null;
  projectId?: string | null;
  project?: AppliedProjectEntity | null;
  projectTasks?: unknown[];
  dashboardTasks?: unknown[];
};

type AppliedProjectEntity = ProjectEntity & {
  client?: ClientEntity | null;
};

const MAX_PROJECT_UPDATE_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROJECT_UPDATE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function getProjectId(project: TaskProjectGroup | null) {
  if (!project) return null;

  const directProjectId =
    project.project_id ||
    project.primaryTask?.project_id ||
    project.tasks.find((task) => task.project_id)?.project_id ||
    "";

  if (directProjectId) return directProjectId;

  const cleaned = String(project.key || "").trim();

  if (cleaned.startsWith("project::")) {
    return cleaned.replace("project::", "").trim() || null;
  }

  if (cleaned.startsWith("project:")) {
    return cleaned.replace("project:", "").trim() || null;
  }

  return null;
}

function getAnalyzeErrorMessage(status: number, fallback?: string) {
  if (status === 413) {
    return fallback || "This image is too large. Upload a screenshot up to 10MB.";
  }

  if (status === 502) {
    return "Text2Task could not structure this update. Try rephrasing the message or making the requested changes clearer.";
  }

  if (status === 401) {
    return "You need to be signed in to analyze a client update.";
  }

  if (status === 404) {
    return "Text2Task could not find this project. Refresh the dashboard and try again.";
  }

  if (status === 400) {
    return fallback || "Add a clear client update message before analyzing.";
  }

  return fallback || "Text2Task could not analyze this update. Please try again.";
}

function getApplyErrorMessage(status: number, fallback?: string) {
  if (status === 401) {
    return "You need to be signed in to apply this update.";
  }

  if (status === 404) {
    return "Text2Task could not find one of these update items. Refresh and try again.";
  }

  if (status === 400) {
    return fallback || "Text2Task could not apply these changes because the review data is invalid.";
  }

  return fallback || "Text2Task could not apply these changes. Please try again.";
}

function getApplyPayloadErrorMessage(
  status: number,
  payload: ApplyProjectUpdateApiResponse | null
) {
  if (payload && !payload.ok) {
    if (payload.code === "duplicate_subtask") {
      const existingTitle = payload.duplicate?.existingTitle;

      return existingTitle
        ? `This looks similar to an existing subtask: ${existingTitle}. Edit the title or unselect this change before applying.`
        : "This suggested subtask looks similar to an existing subtask. Edit the title or unselect this change before applying.";
    }

    if (payload.code === "project_update_already_applied") {
      return "This project update was already applied. Refresh the workspace to see the latest changes.";
    }

    if (payload.code === "project_update_apply_in_progress") {
      return "This project update is already being applied. Wait for it to finish, then refresh the workspace. If it remains in progress, contact support before trying again.";
    }

    if (payload.code === "project_update_apply_failed") {
      return payload.error || payload.message || "This project update could not be applied.";
    }

    if (payload.code === "project_update_invalid_state") {
      return payload.message || payload.error;
    }
  }

  const fallback = payload && !payload.ok ? payload.message || payload.error : undefined;

  return getApplyErrorMessage(status, fallback);
}

function buildEditedItemValues(result: AnalyzeProjectUpdateResult | null) {
  if (!result) return {};

  return result.items.reduce<Record<string, JsonRecord>>((values, item) => {
    const newValue = item.new_value ? { ...item.new_value } : {};

    if (item.type === "new_subtask" && typeof newValue.task_title !== "string") {
      newValue.task_title = item.title;
    }

    values[item.id] = newValue;
    return values;
  }, {});
}

function getDefaultSelectedItemIds(result: AnalyzeProjectUpdateResult | null) {
  if (!result) return [];

  return result.items
    .filter((item) => item.type !== "duplicate_warning" && item.type !== "no_action")
    .map((item) => item.id);
}

function isApplyableSuggestedItem(item: AnalyzeProjectUpdateResult["items"][number]) {
  return item.type !== "duplicate_warning" && item.type !== "no_action";
}

function getImageValidationError(file: File) {
  if (!file.size) {
    return "Choose an image with content before analyzing.";
  }

  if (!ALLOWED_PROJECT_UPDATE_IMAGE_TYPES.has(file.type)) {
    return "Upload a PNG, JPG, WEBP, or GIF screenshot.";
  }

  if (file.size > MAX_PROJECT_UPDATE_IMAGE_SIZE_BYTES) {
    return "This image is too large. Upload a screenshot up to 10MB.";
  }

  return null;
}

function revokePreviewUrl(previewUrl?: string | null) {
  if (previewUrl && typeof URL !== "undefined") {
    URL.revokeObjectURL(previewUrl);
  }
}

function getApplyFocusTaskId(payload: ApplyProjectUpdateResult) {
  const timelineEvents = Array.isArray(payload.timelineEvents)
    ? payload.timelineEvents
    : [];

  for (let index = timelineEvents.length - 1; index >= 0; index -= 1) {
    const event = timelineEvents[index] as Record<string, unknown>;
    const rawTargetTaskId = event.target_task_id ?? event.targetTaskId;

    if (typeof rawTargetTaskId === "number" && Number.isFinite(rawTargetTaskId)) {
      return rawTargetTaskId;
    }

    if (typeof rawTargetTaskId === "string") {
      const parsed = Number(rawTargetTaskId);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function useProjectUpdate() {
  const [uiState, setUIState] = useState<ProjectUpdateUIState>({
    modal: {
      isOpen: false,
      project: null,
    },
    form: {
      rawInput: "",
      inputMethod: "text",
      selectedImage: null,
      imageError: null,
      isAnalyzing: false,
      isApplying: false,
      analysisError: null,
      applyError: null,
      applyDuplicate: null,
      applySuccessMessage: null,
      analysisResult: null,
      selectedItemIds: [],
      editedItemValues: {},
      applyPlaceholderMessage: null,
    },
  });

  const openModal = useCallback((project: TaskProjectGroup) => {
    setUIState((prev) => {
      revokePreviewUrl(prev.form.selectedImage?.previewUrl);

      return {
        ...prev,
        modal: {
          isOpen: true,
          project,
        },
        form: {
          rawInput: "",
          inputMethod: "text",
          selectedImage: null,
          imageError: null,
          isAnalyzing: false,
          isApplying: false,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      };
    });
  }, []);

  const closeModal = useCallback(() => {
    setUIState((prev) => {
      revokePreviewUrl(prev.form.selectedImage?.previewUrl);

      return {
        ...prev,
        modal: {
          isOpen: false,
          project: null,
        },
        form: {
          rawInput: "",
          inputMethod: "text",
          selectedImage: null,
          imageError: null,
          isAnalyzing: false,
          isApplying: false,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      };
    });
  }, []);

  const setRawInput = useCallback((value: string) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        rawInput: value,
        imageError: null,
        analysisError: null,
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
        analysisResult: null,
        selectedItemIds: [],
        editedItemValues: {},
        applyPlaceholderMessage: null,
      },
    }));
  }, []);

  const setInputMethod = useCallback((value: InputMethod) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        inputMethod: value,
        rawInput: "",
        imageError: null,
        analysisError: null,
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
        analysisResult: null,
        selectedItemIds: [],
        editedItemValues: {},
        applyPlaceholderMessage: null,
      },
    }));
  }, []);

  const setIsAnalyzing = useCallback((value: boolean) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        isAnalyzing: value,
      },
    }));
  }, []);

  const setAnalysisError = useCallback((error: string | null) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        analysisError: error,
      },
    }));
  }, []);

  const setAnalysisResult = useCallback((result: AnalyzeProjectUpdateResult | null) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        analysisResult: result,
        selectedItemIds: getDefaultSelectedItemIds(result),
        editedItemValues: buildEditedItemValues(result),
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
        applyPlaceholderMessage: null,
      },
    }));
  }, []);

  const resetForm = useCallback(() => {
    setUIState((prev) => {
      revokePreviewUrl(prev.form.selectedImage?.previewUrl);

      return {
        ...prev,
        form: {
          rawInput: "",
          inputMethod: "text",
          selectedImage: null,
          imageError: null,
          isAnalyzing: false,
          isApplying: false,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      };
    });
  }, []);

  const setSelectedImage = useCallback((file: File) => {
    const validationError = getImageValidationError(file);

    if (validationError) {
      setUIState((prev) => {
        revokePreviewUrl(prev.form.selectedImage?.previewUrl);

        return {
          ...prev,
          form: {
            ...prev.form,
            selectedImage: null,
            imageError: validationError,
            analysisError: null,
            applyError: null,
            applyDuplicate: null,
            applySuccessMessage: null,
            analysisResult: null,
            selectedItemIds: [],
            editedItemValues: {},
            applyPlaceholderMessage: null,
          },
        };
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setUIState((prev) => {
      revokePreviewUrl(prev.form.selectedImage?.previewUrl);

      return {
        ...prev,
        form: {
          ...prev.form,
          selectedImage: {
            file,
            previewUrl,
          },
          imageError: null,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      };
    });
  }, []);

  const removeSelectedImage = useCallback(() => {
    setUIState((prev) => {
      revokePreviewUrl(prev.form.selectedImage?.previewUrl);

      return {
        ...prev,
        form: {
          ...prev.form,
          selectedImage: null,
          imageError: null,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      };
    });
  }, []);

  const setImageError = useCallback((message: string | null) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        imageError: message,
        analysisError: null,
      },
    }));
  }, []);

  const toggleSuggestedItem = useCallback((itemId: string) => {
    setUIState((prev) => {
      const isSelected = prev.form.selectedItemIds.includes(itemId);

      return {
        ...prev,
        form: {
          ...prev.form,
          selectedItemIds: isSelected
            ? prev.form.selectedItemIds.filter((id) => id !== itemId)
            : [...prev.form.selectedItemIds, itemId],
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          applyPlaceholderMessage: null,
        },
      };
    });
  }, []);

  const updateSuggestedItemValue = useCallback((
    itemId: string,
    field: string,
    value: string
  ) => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        editedItemValues: {
          ...prev.form.editedItemValues,
          [itemId]: {
            ...(prev.form.editedItemValues[itemId] || {}),
            [field]: value,
          },
        },
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
        applyPlaceholderMessage: null,
      },
    }));
  }, []);

  const showApplyPlaceholder = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        applyPlaceholderMessage: "Apply will be connected in the next step.",
      },
    }));
  }, []);

  const applySelectedChanges = useCallback(async (
    onApplied?: (result: ProjectUpdateApplyCallbackResult) => Promise<void> | void
  ) => {
    const { form } = uiState;
    const result = form.analysisResult;

    if (!result) {
      return;
    }

    const applyableItemIds = new Set(
      result.items.filter(isApplyableSuggestedItem).map((item) => item.id)
    );
    const acceptedItemIds = form.selectedItemIds.filter((itemId) =>
      applyableItemIds.has(itemId)
    );

    if (acceptedItemIds.length === 0) {
      return;
    }

    const acceptedItemIdSet = new Set(acceptedItemIds);
    const rejectedItemIds = result.items
      .filter((item) => isApplyableSuggestedItem(item) && !acceptedItemIdSet.has(item.id))
      .map((item) => item.id);
    const editedItems = acceptedItemIds
      .map((itemId) => ({
        itemId,
        newValue: form.editedItemValues[itemId],
      }))
      .filter((item): item is { itemId: string; newValue: JsonRecord } =>
        Boolean(item.newValue)
      );

    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        isApplying: true,
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
      },
    }));

    try {
      const response = await fetch("/api/project-updates/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectUpdateId: result.update.id,
          acceptedItemIds,
          rejectedItemIds,
          editedItems,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApplyProjectUpdateApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        const error = new Error(
          getApplyPayloadErrorMessage(response.status, payload)
        ) as Error & {
          duplicate?: { existingTitle: string; proposedTitle: string };
        };

        if (payload && !payload.ok && payload.code === "duplicate_subtask" && payload.duplicate) {
          error.duplicate = {
            existingTitle: payload.duplicate.existingTitle,
            proposedTitle: payload.duplicate.proposedTitle,
          };
        }

        throw error;
      }

      const focusTaskId = getApplyFocusTaskId(payload);
      const projectId =
        payload.project?.id || result.update.project_id || getProjectId(uiState.modal.project);
      const payloadDashboardTasks = Array.isArray(payload.dashboardTasks)
        ? payload.dashboardTasks
        : [];

      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          isApplying: false,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: "Selected changes were applied.",
          analysisResult: {
            ...prev.form.analysisResult!,
            update: payload.update,
            items: [
              ...payload.appliedItems,
              ...payload.rejectedItems,
            ],
          },
        },
      }));

      if (onApplied) {
        try {
          await onApplied({
            focusTaskId,
            projectId,
            project: payload.project ?? null,
            projectTasks: Array.isArray(payload.projectTasks)
              ? payload.projectTasks
              : [],
            dashboardTasks: payloadDashboardTasks,
          });
        } catch (refreshError) {
          console.error(
            "Project update applied, but dashboard synchronization failed:",
            refreshError
          );

          setUIState((prev) => ({
            ...prev,
            form: {
              ...prev.form,
              isApplying: false,
              applyError:
                "Changes were applied, but the dashboard could not refresh. Please refresh the workspace.",
              applyDuplicate: null,
              applySuccessMessage: "Selected changes were applied.",
            },
          }));
        }
      }
    } catch (error) {
      const duplicate =
        error instanceof Error && "duplicate" in error
          ? (error as Error & {
              duplicate?: { existingTitle: string; proposedTitle: string };
            }).duplicate ?? null
          : null;
      const message =
        error instanceof Error
          ? error.message
          : "Text2Task could not apply these changes. Please try again.";

      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          isApplying: false,
          applyError: message,
          applyDuplicate: duplicate,
          applySuccessMessage: null,
        },
      }));
    }
  }, [uiState]);

  const analyzeTextUpdate = useCallback(async () => {
    const { modal, form } = uiState;

    if (form.inputMethod !== "text") {
      setAnalysisError("Only text updates can be analyzed in this phase.");
      return;
    }

    const rawInput = form.rawInput.trim();

    if (!rawInput) {
      setAnalysisError("Paste a client update before analyzing.");
      return;
    }

    const projectId = getProjectId(modal.project);

    if (!projectId) {
      setAnalysisError("This project needs a saved project id before updates can be analyzed.");
      return;
    }

    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        isAnalyzing: true,
        isApplying: false,
        analysisError: null,
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
        analysisResult: null,
        selectedItemIds: [],
        editedItemValues: {},
        applyPlaceholderMessage: null,
      },
    }));

    try {
      const response = await fetch("/api/project-updates/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          rawInput,
          sourceType: "text",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | AnalyzeProjectUpdateApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        const fallback = payload && "error" in payload ? payload.error : undefined;
        throw new Error(getAnalyzeErrorMessage(response.status, fallback));
      }

      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          isAnalyzing: false,
          isApplying: false,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: {
            update: payload.update,
            items: payload.items,
            timelineEvent: payload.timelineEvent,
            analysis: payload.analysis,
          },
          selectedItemIds: getDefaultSelectedItemIds({
            update: payload.update,
            items: payload.items,
            timelineEvent: payload.timelineEvent,
            analysis: payload.analysis,
          }),
          editedItemValues: buildEditedItemValues({
            update: payload.update,
            items: payload.items,
            timelineEvent: payload.timelineEvent,
            analysis: payload.analysis,
          }),
          applyPlaceholderMessage: null,
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Text2Task could not analyze this update. Please try again.";

      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          isAnalyzing: false,
          isApplying: false,
          analysisError: message,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      }));
    }
  }, [uiState, setAnalysisError]);

  const analyzeImageUpdate = useCallback(async () => {
    const { modal, form } = uiState;

    if (form.inputMethod !== "image") {
      setAnalysisError("Choose the Screenshot tab before analyzing an image update.");
      return;
    }

    if (!form.selectedImage) {
      setAnalysisError("Upload or paste a screenshot before analyzing.");
      return;
    }

    const validationError = getImageValidationError(form.selectedImage.file);

    if (validationError) {
      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          imageError: validationError,
          analysisError: null,
        },
      }));
      return;
    }

    const projectId = getProjectId(modal.project);

    if (!projectId) {
      setAnalysisError("This project needs a saved project id before updates can be analyzed.");
      return;
    }

    setUIState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        isAnalyzing: true,
        isApplying: false,
        imageError: null,
        analysisError: null,
        applyError: null,
        applyDuplicate: null,
        applySuccessMessage: null,
        analysisResult: null,
        selectedItemIds: [],
        editedItemValues: {},
        applyPlaceholderMessage: null,
      },
    }));

    try {
      const body = new FormData();
      body.append("projectId", projectId);
      body.append("image", form.selectedImage.file);

      const response = await fetch("/api/project-updates/analyze-image", {
        method: "POST",
        body,
      });

      const payload = (await response.json().catch(() => null)) as
        | AnalyzeProjectUpdateApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        const fallback = payload && "error" in payload ? payload.error : undefined;
        throw new Error(getAnalyzeErrorMessage(response.status, fallback));
      }

      const result = {
        update: payload.update,
        items: payload.items,
        timelineEvent: payload.timelineEvent,
        analysis: payload.analysis,
      };

      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          rawInput: payload.update.raw_input || prev.form.rawInput,
          isAnalyzing: false,
          isApplying: false,
          imageError: null,
          analysisError: null,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: result,
          selectedItemIds: getDefaultSelectedItemIds(result),
          editedItemValues: buildEditedItemValues(result),
          applyPlaceholderMessage: null,
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Text2Task could not analyze this screenshot. Please try again.";

      setUIState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          isAnalyzing: false,
          isApplying: false,
          analysisError: message,
          applyError: null,
          applyDuplicate: null,
          applySuccessMessage: null,
          analysisResult: null,
          selectedItemIds: [],
          editedItemValues: {},
          applyPlaceholderMessage: null,
        },
      }));
    }
  }, [uiState, setAnalysisError]);

  const analyzeCurrentUpdate = useCallback(async () => {
    if (uiState.form.inputMethod === "image") {
      await analyzeImageUpdate();
      return;
    }

    await analyzeTextUpdate();
  }, [uiState.form.inputMethod, analyzeImageUpdate, analyzeTextUpdate]);

  return {
    uiState,
    openModal,
    closeModal,
    setRawInput,
    setInputMethod,
    setIsAnalyzing,
    setAnalysisError,
    setAnalysisResult,
    toggleSuggestedItem,
    updateSuggestedItemValue,
    setSelectedImage,
    removeSelectedImage,
    setImageError,
    showApplyPlaceholder,
    applySelectedChanges,
    analyzeTextUpdate,
    analyzeImageUpdate,
    analyzeCurrentUpdate,
    resetForm,
  };
}
