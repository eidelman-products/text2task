import "server-only";

import {
  isFileResource,
  isLinkResource,
  isNoteResource,
  type TaskResource,
} from "@/app/components/dashboard/resources/resource-api";
import { canonicalizeUuid } from "./share-contracts";
import {
  clientProjectProjectionSchema,
  type ClientProjectProjection,
  type ClientProjectResource,
  type ClientProjectStatus,
  type ClientProjectTask,
} from "./client-share-projection-contracts";
import { getShareLinkManagementState } from "./share-links-repository.server";

/*
  Phase 2D -- the ONE server-built client-facing projection builder,
  reused unchanged by Phase 2D's owner Preview and (later) Phase 3's
  public route. Accepts a share-LINK id (trusted, already-authenticated
  context) -- never a raw browser-controlled project id -- exactly like
  every sibling Phase 2C route under /api/share-links/[id]/**.

  Data sources, and why each one is used the way it is:

  1. public.get_share_link_management_state (existing RPC, reused
     unmodified via the existing repository function) -- this already
     returns exactly the safe, durable, owner-curated data this
     projection needs: the three Phase 1C publication-intent flags,
     commentsEnabled/clientFacingSubtitle/contentDirection, the complete
     structured mappedTasks/mappedResources (Phase 2B's corrective
     migration), and the latest published update body. It is keyed by
     project_id, not link_id, so this function first resolves project_id
     from the link via one small, explicitly bounded, owner-scoped
     select against project_share_links -- the same table every Phase
     1B.3 RPC already verifies ownership against (`id = link_id and
     user_id = the caller`), just expressed here as a direct read
     through the RLS-bound client rather than a new RPC, since no new
     Client Share security-sensitive table is being touched. A revoked
     link is excluded by this same lookup's `state <> 'revoked'` filter,
     matching get_share_link_management_state's own structural exclusion
     of revoked links.

  2. public.projects / public.tasks / public.task_resources -- read via
     ordinary bounded `.select()` calls through the SAME RLS-bound
     client every other non-Client-Share dashboard read already uses for
     these tables (see lib/tasks/load-dashboard-tasks.server.ts,
     app/api/task-resources/route.ts) -- never `select("*")`, always an
     explicit column list, always additionally scoped by project_id and
     user_id as defense in depth alongside RLS. These three tables are
     NOT Client-Share-specific security-sensitive tables (unlike
     project_share_links and its siblings, which this feature's RPCs
     alone are permitted to touch per AGENTS.md rule 12), so no new RPC
     or migration is required or appropriate here.

  This function returns the SAME strict ClientProjectProjection shape
  regardless of caller -- Phase 2D's owner Preview route calls it after
  its own ownership verification; a future Phase 3 public route would
  call it after its own session-grant verification, passing the
  session-verified linkId. Neither caller's authorization model is
  hardcoded inside this function beyond the one owner-scoped project_id
  lookup in step 1, which itself is spelled out, not hidden.
*/

export type ClientSharePreviewErrorCode =
  | "UNAUTHORIZED"
  | "SHARE_LINK_NOT_FOUND"
  | "UNEXPECTED";

export type ClientSharePreviewResult =
  | { ok: true; data: ClientProjectProjection }
  | { ok: false; error: { code: ClientSharePreviewErrorCode } };

type SimpleQueryResult<T> = PromiseLike<{ data: T | null; error: unknown }>;

type EqChain<T> = {
  eq: (column: string, value: unknown) => EqChain<T>;
  neq: (column: string, value: unknown) => EqChain<T>;
  is: (column: string, value: null) => EqChain<T>;
  in: (column: string, values: readonly (string | number)[]) => EqChain<T>;
  maybeSingle: () => SimpleQueryResult<T>;
} & SimpleQueryResult<T[]>;

type ProjectionSupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => EqChain<Record<string, unknown>>;
  };
};

type LinkProjectRow = { project_id: string };
type ProjectRow = {
  title: string | null;
  status: string | null;
  deadline_date: string | null;
};
type TaskRow = { id: number; task_title: string | null };
type ResourceRow = {
  id: string;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  resource_type: string | null;
};

/**
 * Small, closed, explicit mapping from the internal task/project status
 * vocabulary to the safe public vocabulary. Anything not listed here
 * (including any future internal status this map has not been updated
 * for) fails closed to `null` (omitted) rather than leaking a raw,
 * unmapped internal value -- "Urgent" is a *priority* value, never a
 * status value, and priority is never read by this module at all, so it
 * cannot reach this map regardless.
 */
const PROJECT_STATUS_MAP: Record<string, ClientProjectStatus> = {
  New: "not_started",
  "In Progress": "in_progress",
  Review: "in_progress",
  Done: "completed",
};

function mapProjectStatusForClient(status: string | null): ClientProjectStatus | null {
  if (status === null) return null;
  return PROJECT_STATUS_MAP[status] ?? null;
}

/**
 * The server-side external-URL security boundary for client-visible link
 * Resources. `task_resources.url` is owner-authored but not itself
 * schema-restricted to safe schemes at write time, and this projection is
 * the confidentiality/security boundary (AGENTS.md rule 1) -- so a
 * historical or otherwise malformed row (e.g. `javascript:`, `data:`,
 * `file:`, `vbscript:`, or a non-absolute string) must still fail closed
 * here, not merely be trusted because it once passed some other layer.
 * Parses with the platform `URL` constructor (never a regex/substring
 * check, which schemes like `\tjavascript:` or mixed-case `JaVaScRiPt:`
 * can trivially evade) and allowlists only `http:`/`https:`. No
 * normalization of an unsafe scheme is attempted -- an unsafe or
 * unparsable value returns `null`, and every caller below treats `null`
 * as "omit this resource entirely", never a fallback/stripped URL.
 */
const SAFE_EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:"]);

function toSafeExternalClientUrl(value: string | null): string | null {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (!SAFE_EXTERNAL_URL_PROTOCOLS.has(parsed.protocol)) return null;
  return value;
}

function classifyResource(row: ResourceRow): "file" | "link" | "note" {
  const asTaskResource = {
    resource_type: row.resource_type,
    url: row.url,
    storage_path: row.storage_path,
    file_name: row.file_name,
  } as unknown as TaskResource;

  if (isNoteResource(asTaskResource)) return "note";
  if (isFileResource(asTaskResource)) return "file";
  if (isLinkResource(asTaskResource)) return "link";
  return "note";
}

export async function buildClientShareProjection<Client>(
  supabase: Client,
  input: { linkId: string; userId: string }
): Promise<ClientSharePreviewResult> {
  const client = supabase as unknown as ProjectionSupabaseLikeClient;
  const canonicalLinkId = canonicalizeUuid(input.linkId);

  // Step 1: resolve project_id from the link, owner-scoped, revoked
  // links excluded -- mirrors every Phase 1B.3 RPC's own
  // `where link.id = p_link_id and link.user_id = v_user_id` check,
  // expressed as a direct RLS-bound read since no new RPC is warranted
  // for a single-column lookup against an already-owner-readable table.
  const { data: linkRow, error: linkError } = await client
    .from("project_share_links")
    .select("project_id")
    .eq("id", canonicalLinkId)
    .eq("user_id", input.userId)
    .neq("state", "revoked")
    .maybeSingle();

  if (linkError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  if (!linkRow || typeof (linkRow as LinkProjectRow).project_id !== "string") {
    return { ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } };
  }
  const projectId = (linkRow as LinkProjectRow).project_id;

  // Step 2: the existing, unmodified owner-read RPC -- already returns
  // exactly the durable, owner-curated fields this projection needs.
  const managementState = await getShareLinkManagementState(supabase, projectId);
  if (!managementState.ok) {
    return { ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } };
  }
  const link = managementState.data.link;
  if (!link) {
    return { ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } };
  }

  // Step 3: the project's title/status/target-date VALUES themselves --
  // read only now, bounded to exactly these three columns, scoped to
  // the owned non-deleted project. Whether each is actually INCLUDED in
  // the final projection is still gated below by the durable
  // titleVisible/statusVisible/targetDateVisible flags -- reading them
  // here does not by itself expose them.
  const { data: projectRow, error: projectError } = await client
    .from("projects")
    .select("title, status, deadline_date")
    .eq("id", projectId)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  const project = (projectRow as ProjectRow | null) ?? null;

  // Step 4: only the mapped tasks' titles -- share_link_tasks itself
  // never stores a copy of the title, only the subtask_id plus the
  // owner-curated publicGroup/waitingForClientFeedback/displayOrder
  // (already present on managementState.data.mappedTasks). A mapped
  // task that no longer resolves (soft-deleted) is simply left out of
  // the id->title map below and therefore disappears from the
  // projection -- fail-closed disappearance, never a placeholder.
  const mappedTasks = "mappedTasks" in managementState.data ? managementState.data.mappedTasks : [];
  const taskIds = mappedTasks.map((t) => Number(t.subtaskId)).filter((id) => Number.isFinite(id));

  const taskTitleById = new Map<number, string>();
  if (taskIds.length > 0) {
    const { data: taskRows, error: taskError } = await client
      .from("tasks")
      .select("id, task_title")
      .eq("project_id", projectId)
      .eq("user_id", input.userId)
      .is("deleted_at", null)
      .in("id", taskIds);

    if (taskError) {
      return { ok: false, error: { code: "UNEXPECTED" } };
    }
    for (const row of (taskRows as unknown as TaskRow[] | null) ?? []) {
      if (typeof row.task_title === "string" && row.task_title.trim().length > 0) {
        taskTitleById.set(row.id, row.task_title);
      }
    }
  }

  const tasks: ClientProjectTask[] = [];
  for (const mapped of mappedTasks) {
    const title = taskTitleById.get(Number(mapped.subtaskId));
    if (title === undefined) continue;
    tasks.push({
      title,
      publicGroup: mapped.publicGroup,
      waitingForClientFeedback: mapped.waitingForClientFeedback,
    });
  }

  // Step 5: only the mapped Resources' safe display metadata --
  // share_link_resources already stores the owner-authored publicLabel
  // and canDownload; task_resources is read here ONLY to classify
  // file-vs-link (never to return storage_path/file_name/mime_type/
  // size_bytes, per AGENTS.md rule 4) and, for a link resource only, its
  // owner-provided external url. A Note Resource can never reach
  // share_link_resources in the first place (Phase 2B's editor only
  // offers file/link resources for selection), but classifyResource
  // still defensively excludes one if it somehow appeared. A mapped
  // Resource that no longer resolves (task_resources hard-deletes) is
  // simply left out -- fail-closed disappearance.
  const mappedResources =
    "mappedResources" in managementState.data ? managementState.data.mappedResources : [];
  const resourceIds = mappedResources.map((r) => r.resourceId);

  const resourceRowById = new Map<string, ResourceRow>();
  if (resourceIds.length > 0) {
    const { data: resourceRows, error: resourceError } = await client
      .from("task_resources")
      .select("id, url, storage_path, file_name, resource_type")
      .eq("project_id", projectId)
      .eq("user_id", input.userId)
      .in("id", resourceIds);

    if (resourceError) {
      return { ok: false, error: { code: "UNEXPECTED" } };
    }
    for (const row of (resourceRows as unknown as ResourceRow[] | null) ?? []) {
      resourceRowById.set(row.id, row);
    }
  }

  const resources: ClientProjectResource[] = [];
  for (const mapped of mappedResources) {
    const row = resourceRowById.get(mapped.resourceId);
    if (!row) continue;

    const kind = classifyResource(row);
    if (kind === "note") continue;

    if (kind === "file") {
      resources.push({ kind: "file", label: mapped.publicLabel, canDownload: mapped.canDownload });
    } else {
      const safeUrl = toSafeExternalClientUrl(row.url);
      if (safeUrl) {
        resources.push({ kind: "link", label: mapped.publicLabel, url: safeUrl });
      }
      // else: an unsafe scheme (javascript:/data:/file:/vbscript:/etc.) or
      // a malformed/non-absolute value -- fail closed, the resource is
      // omitted entirely, never exposed with a stripped or raw fallback
      // URL.
    }
  }

  // Step 6: progress computed ONLY from the shared tasks that actually
  // resolved above -- never from any internal project-wide task count,
  // which this function never even queries.
  const progress =
    tasks.length === 0
      ? null
      : {
          completed: tasks.filter((t) => t.publicGroup === "completed").length,
          total: tasks.length,
          percent: Math.round(
            (tasks.filter((t) => t.publicGroup === "completed").length / tasks.length) * 100
          ),
        };

  const projection: ClientProjectProjection = {
    title: link.titleVisible ? project?.title ?? null : null,
    subtitle: link.clientFacingSubtitle,
    status: link.statusVisible ? mapProjectStatusForClient(project?.status ?? null) : null,
    targetDate: link.targetDateVisible ? project?.deadline_date ?? null : null,
    contentDirection: link.contentDirection,
    commentsEnabled: link.commentsEnabled,
    progress,
    latestUpdate:
      "currentUpdate" in managementState.data && managementState.data.currentUpdate
        ? {
            body: managementState.data.currentUpdate.body,
            publishedAt: managementState.data.currentUpdate.publishedAt,
          }
        : null,
    tasks,
    resources,
  };

  const parsed = clientProjectProjectionSchema.safeParse(projection);
  if (!parsed.success) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }

  return { ok: true, data: parsed.data };
}
