import { createClient } from "@/lib/supabase/server";

import type {
  JsonRecord,
  ProjectTimelineEvent,
  ProjectTimelineEventType,
  ProjectUpdate,
  ProjectUpdateItem,
  ProjectUpdateItemStatus,
  ProjectUpdateItemType,
  ProjectUpdateSourceType,
  ProjectUpdateStatus,
} from "@/lib/project-updates/project-update-types";

type AuthenticatedSupabaseResult =
  | {
      ok: true;
      userId: string;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type CreateProjectUpdateInput = {
  projectId: string;
  clientId?: string | null;
  rawInput: string;
  sourceType?: ProjectUpdateSourceType;
  aiSummary?: JsonRecord | null;
  status?: ProjectUpdateStatus;
};

type CreateProjectUpdateItemInput = {
  projectUpdateId: string;
  projectId: string;
  targetTaskId?: number | null;

  type: ProjectUpdateItemType;
  title: string;
  description?: string | null;

  targetField?: string | null;
  oldValue?: JsonRecord | null;
  newValue?: JsonRecord | null;

  confidence?: number | null;
  status?: ProjectUpdateItemStatus;

  aiReason?: string | null;
  userNote?: string | null;
};

type CreateTimelineEventInput = {
  projectId: string;

  eventType: ProjectTimelineEventType;
  eventTitle: string;
  eventSummary?: string | null;

  sourceUpdateId?: string | null;
  sourceItemId?: string | null;
  targetTaskId?: number | null;

  targetField?: string | null;
  oldValue?: JsonRecord | null;
  newValue?: JsonRecord | null;

  metadata?: JsonRecord | null;
};

type AuditWriteResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

async function getAuthenticatedSupabase(): Promise<AuthenticatedSupabaseResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      error: "You must be signed in to write project update audit records.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    supabase,
  };
}

function cleanConfidence(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export async function createProjectUpdateAuditRecord(
  input: CreateProjectUpdateInput
): Promise<AuditWriteResult<ProjectUpdate>> {
  if (!input.projectId) {
    return {
      ok: false,
      status: 400,
      error: "Missing project id.",
    };
  }

  if (!input.rawInput.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Missing client update message.",
    };
  }

  const auth = await getAuthenticatedSupabase();

  if (!auth.ok) {
    return auth;
  }

  const { data, error } = await auth.supabase
    .from("project_updates")
    .insert({
      user_id: auth.userId,
      project_id: input.projectId,
      client_id: input.clientId ?? null,

      source_type: input.sourceType ?? "text",
      raw_input: input.rawInput.trim(),

      ai_summary: input.aiSummary ?? null,
      status: input.status ?? "draft",

      created_by: auth.userId,
      analyzed_at: input.status === "analyzed" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Could not create project update audit record.",
    };
  }

  return {
    ok: true,
    data: data as ProjectUpdate,
  };
}

export async function createProjectUpdateAuditItems(
  items: CreateProjectUpdateItemInput[]
): Promise<AuditWriteResult<ProjectUpdateItem[]>> {
  if (items.length === 0) {
    return {
      ok: true,
      data: [],
    };
  }

  const auth = await getAuthenticatedSupabase();

  if (!auth.ok) {
    return auth;
  }

  const rows = items.map((item) => ({
    project_update_id: item.projectUpdateId,
    user_id: auth.userId,
    project_id: item.projectId,
    target_task_id: item.targetTaskId ?? null,

    type: item.type,
    title: item.title,
    description: item.description ?? null,

    target_field: item.targetField ?? null,
    old_value: item.oldValue ?? null,
    new_value: item.newValue ?? null,

    confidence: cleanConfidence(item.confidence),
    status: item.status ?? "suggested",

    ai_reason: item.aiReason ?? null,
    user_note: item.userNote ?? null,
  }));

  const { data, error } = await auth.supabase
    .from("project_update_items")
    .insert(rows)
    .select("*");

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Could not create project update audit items.",
    };
  }

  return {
    ok: true,
    data: data as ProjectUpdateItem[],
  };
}

export async function createProjectTimelineEvent(
  input: CreateTimelineEventInput
): Promise<AuditWriteResult<ProjectTimelineEvent>> {
  if (!input.projectId) {
    return {
      ok: false,
      status: 400,
      error: "Missing project id.",
    };
  }

  const auth = await getAuthenticatedSupabase();

  if (!auth.ok) {
    return auth;
  }

  const { data, error } = await auth.supabase
    .from("project_timeline_events")
    .insert({
      user_id: auth.userId,
      project_id: input.projectId,

      event_type: input.eventType,
      event_title: input.eventTitle,
      event_summary: input.eventSummary ?? null,

      source_update_id: input.sourceUpdateId ?? null,
      source_item_id: input.sourceItemId ?? null,
      target_task_id: input.targetTaskId ?? null,

      target_field: input.targetField ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,

      actor_user_id: auth.userId,
      metadata: input.metadata ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Could not create project timeline event.",
    };
  }

  return {
    ok: true,
    data: data as ProjectTimelineEvent,
  };
}

export async function markProjectUpdateAsAnalyzed(
  projectUpdateId: string,
  aiSummary?: JsonRecord | null
): Promise<AuditWriteResult<ProjectUpdate>> {
  if (!projectUpdateId) {
    return {
      ok: false,
      status: 400,
      error: "Missing project update id.",
    };
  }

  const auth = await getAuthenticatedSupabase();

  if (!auth.ok) {
    return auth;
  }

  const { data, error } = await auth.supabase
    .from("project_updates")
    .update({
      status: "analyzed",
      ai_summary: aiSummary ?? null,
      analyzed_at: new Date().toISOString(),
    })
    .eq("id", projectUpdateId)
    .eq("user_id", auth.userId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Could not mark project update as analyzed.",
    };
  }

  return {
    ok: true,
    data: data as ProjectUpdate,
  };
}