/**
 * Local UI types for Project Update feature.
 * Distinct from backend types in lib/project-updates/project-update-types.ts
 */

import type { TaskProjectGroup } from "../task-types";

export type InputMethod = "text" | "image" | "email" | "manual";

export type ProjectUpdateSourceType = "text" | "image" | "email" | "manual";

export type ProjectUpdateItemType =
  | "new_subtask"
  | "update_subtask"
  | "deadline_change"
  | "budget_change"
  | "priority_change"
  | "status_change"
  | "client_detail_change"
  | "project_note"
  | "client_note"
  | "duplicate_warning"
  | "no_action"
  | "needs_review";

export type JsonRecord = Record<string, unknown>;

export type ProjectUpdateRecord = {
  id: string;
  project_id: string;
  client_id: string | null;
  source_type: ProjectUpdateSourceType;
  raw_input: string;
  ai_summary: JsonRecord | null;
  status: string;
  created_at: string;
  analyzed_at: string | null;
};

export type SuggestedProjectUpdateItem = {
  id: string;
  project_update_id: string;
  project_id: string;
  target_task_id: number | null;
  type: ProjectUpdateItemType;
  title: string;
  description: string | null;
  target_field: string | null;
  old_value: JsonRecord | null;
  new_value: JsonRecord | null;
  confidence: number | null;
  status: string;
  ai_reason: string | null;
  created_at: string;
};

export type ProjectTimelineEventRecord = {
  id: string;
  project_id: string;
  event_type: string;
  event_title: string;
  event_summary: string | null;
  source_update_id: string | null;
  created_at: string;
  metadata: JsonRecord | null;
};

export type ProjectUpdateAnalysisSummary = {
  headline: string;
  reasoning?: string | null;
  riskLevel?: "low" | "medium" | "high";
  detectedChanges?: string[];
};

export type AnalyzeProjectUpdateResult = {
  update: ProjectUpdateRecord;
  items: SuggestedProjectUpdateItem[];
  timelineEvent: ProjectTimelineEventRecord | null;
  analysis: ProjectUpdateAnalysisSummary;
};

export type ApplyProjectUpdateResult = {
  update: ProjectUpdateRecord;
  appliedItems: SuggestedProjectUpdateItem[];
  rejectedItems: SuggestedProjectUpdateItem[];
  timelineEvents: ProjectTimelineEventRecord[];
};

export type ProjectUpdateModalState = {
  isOpen: boolean;
  project: TaskProjectGroup | null;
};

export type ProjectUpdateFormState = {
  rawInput: string;
  inputMethod: InputMethod;
  selectedImage: {
    file: File;
    previewUrl: string;
  } | null;
  imageError: string | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  analysisError: string | null;
  applyError: string | null;
  applyDuplicate: {
    existingTitle: string;
    proposedTitle: string;
  } | null;
  applySuccessMessage: string | null;
  analysisResult: AnalyzeProjectUpdateResult | null;
  selectedItemIds: string[];
  editedItemValues: Record<string, JsonRecord>;
  applyPlaceholderMessage: string | null;
};

export type ProjectUpdateUIState = {
  modal: ProjectUpdateModalState;
  form: ProjectUpdateFormState;
};
