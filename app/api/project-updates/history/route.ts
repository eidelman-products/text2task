import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import type {
  ProjectTimelineEvent,
  ProjectUpdate,
  ProjectUpdateItem,
} from "@/lib/project-updates/project-update-types";

type ProjectUpdateHistoryEntry = {
  update: ProjectUpdate;
  items: ProjectUpdateItem[];
  timelineEvents: ProjectTimelineEvent[];
};

type ProjectUpdateHistoryResponse =
  | {
      ok: true;
      updates: ProjectUpdateHistoryEntry[];
      events: ProjectTimelineEvent[];
    }
  | {
      ok: false;
      error: string;
    };

function getProjectIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId || !projectId.trim()) {
    return null;
  }

  return projectId.trim();
}

export async function GET(request: Request) {
  const projectId = getProjectIdFromRequest(request);

  if (!projectId) {
    return NextResponse.json<ProjectUpdateHistoryResponse>(
      {
        ok: false,
        error: "Missing project id.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json<ProjectUpdateHistoryResponse>(
      {
        ok: false,
        error: "You must be signed in to view project update history.",
      },
      { status: 401 }
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) {
    return NextResponse.json<ProjectUpdateHistoryResponse>(
      {
        ok: false,
        error: "Project not found or you do not have access to it.",
      },
      { status: 404 }
    );
  }

  const { data: updates, error: updatesError } = await supabase
    .from("project_updates")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (updatesError) {
    return NextResponse.json<ProjectUpdateHistoryResponse>(
      {
        ok: false,
        error: updatesError.message || "Could not load project update history.",
      },
      { status: 500 }
    );
  }

  const updateRows = (updates ?? []) as ProjectUpdate[];
  const updateIds = updateRows.map((update) => update.id);

  const { data: items, error: itemsError } = updateIds.length
    ? await supabase
        .from("project_update_items")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .in("project_update_id", updateIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (itemsError) {
    return NextResponse.json<ProjectUpdateHistoryResponse>(
      {
        ok: false,
        error: itemsError.message || "Could not load project update items.",
      },
      { status: 500 }
    );
  }

  const { data: events, error: eventsError } = await supabase
    .from("project_timeline_events")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (eventsError) {
    return NextResponse.json<ProjectUpdateHistoryResponse>(
      {
        ok: false,
        error: eventsError.message || "Could not load project update history.",
      },
      { status: 500 }
    );
  }

  const itemRows = (items ?? []) as ProjectUpdateItem[];
  const eventRows = (events ?? []) as ProjectTimelineEvent[];
  const itemsByUpdateId = new Map<string, ProjectUpdateItem[]>();
  const eventsByUpdateId = new Map<string, ProjectTimelineEvent[]>();

  itemRows.forEach((item) => {
    const current = itemsByUpdateId.get(item.project_update_id) ?? [];
    current.push(item);
    itemsByUpdateId.set(item.project_update_id, current);
  });

  eventRows.forEach((event) => {
    if (!event.source_update_id) return;

    const current = eventsByUpdateId.get(event.source_update_id) ?? [];
    current.push(event);
    eventsByUpdateId.set(event.source_update_id, current);
  });

  return NextResponse.json<ProjectUpdateHistoryResponse>({
    ok: true,
    updates: updateRows.map((update) => ({
      update,
      items: itemsByUpdateId.get(update.id) ?? [],
      timelineEvents: eventsByUpdateId.get(update.id) ?? [],
    })),
    events: eventRows,
  });
}
