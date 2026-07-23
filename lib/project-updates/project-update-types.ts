export type ProjectUpdateSourceType = "text" | "image" | "email" | "manual";

export type ProjectUpdateStatus =
  | "draft"
  | "analyzed"
  | "reviewed"
  | "applying"
  | "applied"
  | "ignored"
  | "failed";

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

export type ProjectUpdateItemStatus =
  | "suggested"
  | "accepted"
  | "rejected"
  | "applied"
  | "skipped"
  | "failed";

export type ProjectTimelineEventType =
  | "client_update_received"
  | "ai_update_analyzed"
  | "update_item_accepted"
  | "update_item_rejected"
  | "update_applied"
  | "subtask_added"
  | "subtask_updated"
  | "deadline_updated"
  | "budget_updated"
  | "priority_updated"
  | "status_updated"
  | "client_details_updated"
  | "note_added"
  | "resource_added"
  | "manual_edit"
  | "archive"
  | "restore";

export type JsonRecord = Record<string, unknown>;

export type ProjectPrioritySource =
  | "ai"
  | "user"
  | "storage_default"
  | "unknown";

export type ProjectUpdate = {
  id: string;

  user_id: string;
  project_id: string;
  client_id: string | null;

  source_type: ProjectUpdateSourceType;
  raw_input: string;

  ai_summary: JsonRecord | null;
  status: ProjectUpdateStatus;

  created_by: string | null;
  reviewed_by: string | null;
  applied_by: string | null;

  created_at: string;
  analyzed_at: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  ignored_at: string | null;
  apply_started_at: string | null;
  apply_attempt_id: string | null;
  apply_failed_at: string | null;
  apply_error_code: string | null;
};

export type ProjectUpdateItem = {
  id: string;

  project_update_id: string;
  user_id: string;
  project_id: string;

  /**
   * Important:
   * public.tasks.id is bigint in this project, so task ids are numbers here.
   */
  target_task_id: number | null;

  type: ProjectUpdateItemType;
  title: string;
  description: string | null;

  target_field: string | null;
  old_value: JsonRecord | null;
  new_value: JsonRecord | null;

  confidence: number | null;
  status: ProjectUpdateItemStatus;

  ai_reason: string | null;
  user_note: string | null;

  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  applied_at: string | null;

  accepted_by: string | null;
  rejected_by: string | null;
  applied_by: string | null;
};

export type ProjectTimelineEvent = {
  id: string;

  user_id: string;
  project_id: string;

  event_type: ProjectTimelineEventType;
  event_title: string;
  event_summary: string | null;

  source_update_id: string | null;
  source_item_id: string | null;

  /**
   * Important:
   * public.tasks.id is bigint in this project, so task ids are numbers here.
   */
  target_task_id: number | null;

  target_field: string | null;
  old_value: JsonRecord | null;
  new_value: JsonRecord | null;

  actor_user_id: string | null;
  created_at: string;

  metadata: JsonRecord | null;
};

export type ExistingProjectUpdateContext = {
  project: {
    id: string;
    user_id: string;
    client_id: string | null;

    title: string | null;
    summary: string | null;

    client_name: string | null;
    contact_name: string | null;

    amount: string | null;
    amount_value: number | null;
    currency_code: string | null;

    deadline_text: string | null;
    deadline_date: string | null;

    priority: string | null;
    priority_source: ProjectPrioritySource;
    status: string | null;

    created_at: string | null;
    updated_at: string | null;
  };

  client: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  } | null;

  subtasks: Array<{
    id: number;
    project_id: string;
    task_title: string | null;
    status: string | null;
    priority: string | null;
    deadline_text: string | null;
    deadline_date: string | null;
    amount: string | null;
    subtask_order: number | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
};

export type AnalyzeProjectUpdateInput = {
  projectId: string;
  rawInput: string;
  sourceType?: ProjectUpdateSourceType;
};

export type AnalyzeProjectUpdateResult = {
  update: ProjectUpdate;
  items: ProjectUpdateItem[];
  timelineEvent: ProjectTimelineEvent | null;
};

export type ApplyProjectUpdateInput = {
  projectUpdateId: string;
  acceptedItemIds: string[];
  rejectedItemIds?: string[];
  editedItems?: Array<{
    itemId: string;
    newValue: JsonRecord;
  }>;
};

export type ApplyProjectUpdateResult = {
  update: ProjectUpdate;
  appliedItems: ProjectUpdateItem[];
  rejectedItems: ProjectUpdateItem[];
  timelineEvents: ProjectTimelineEvent[];
};
