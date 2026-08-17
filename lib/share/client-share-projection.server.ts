import "server-only";

import {
  isFileResource,
  isLinkResource,
  isNoteResource,
  type TaskResource,
} from "@/app/components/dashboard/resources/resource-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

/*
  Phase 3 refactor -- the shared strict-projection CORE, extracted
  unchanged in behavior from Phase 2D's single implementation. Every
  privacy rule (visibility gating, progress-from-shared-tasks-only,
  Note-Resource exclusion, http/https URL allowlist, fail-closed
  disappearance for an unresolved mapped task/Resource) lives in exactly
  ONE place, used by both callers below:

    authorized owner Preview (buildClientShareProjection)
                    \
                     -> assembleClientProjection -> ClientProjectProjection
                    /
    verified public session/grant (buildPublicClientShareProjection)

  This function performs no I/O -- both callers resolve their own rows
  first (through their own, differently-authorized data sources) and pass
  already-resolved values in. Neither caller's authorization model is
  hardcoded here.
*/

type LinkPublicationFields = {
  titleVisible: boolean;
  statusVisible: boolean;
  targetDateVisible: boolean;
  clientFacingSubtitle: string | null;
  contentDirection: "auto" | "ltr" | "rtl";
  commentsEnabled: boolean;
};

type MappedTaskInput = {
  subtaskId: string;
  publicGroup: ClientProjectTask["publicGroup"];
  waitingForClientFeedback: boolean;
};

type MappedResourceInput = {
  resourceId: string;
  publicLabel: string;
  canDownload: boolean;
};

type CurrentUpdateInput = { body: string; publishedAt: string } | null;

function assembleClientProjection(input: {
  link: LinkPublicationFields;
  project: ProjectRow | null;
  mappedTasks: readonly MappedTaskInput[];
  mappedResources: readonly MappedResourceInput[];
  currentUpdate: CurrentUpdateInput;
  taskTitleById: Map<number, string>;
  resourceRowById: Map<string, ResourceRow>;
}): ClientSharePreviewResult {
  // Only the mapped tasks' titles -- share_link_tasks itself never
  // stores a copy of the title, only the subtask_id plus the
  // owner-curated publicGroup/waitingForClientFeedback. A mapped task
  // that no longer resolves (soft-deleted) is simply left out of
  // taskTitleById by the caller and therefore disappears from the
  // projection here -- fail-closed disappearance, never a placeholder.
  const tasks: ClientProjectTask[] = [];
  for (const mapped of input.mappedTasks) {
    const title = input.taskTitleById.get(Number(mapped.subtaskId));
    if (title === undefined) continue;
    tasks.push({
      title,
      publicGroup: mapped.publicGroup,
      waitingForClientFeedback: mapped.waitingForClientFeedback,
    });
  }

  // Only the mapped Resources' safe display metadata -- share_link_resources
  // already stores the owner-authored publicLabel and canDownload; the
  // resolved task_resources row is used here ONLY to classify file-vs-link
  // (never to return storage_path/file_name/mime_type/size_bytes, per
  // AGENTS.md rule 4) and, for a link resource only, its owner-provided
  // external url, filtered through the http/https allowlist. A Note
  // Resource is excluded outright. A mapped Resource that no longer
  // resolves is simply left out by the caller -- fail-closed disappearance.
  const resources: ClientProjectResource[] = [];
  for (const mapped of input.mappedResources) {
    const row = input.resourceRowById.get(mapped.resourceId);
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

  // Progress computed ONLY from the shared tasks that actually resolved
  // above -- never from any internal project-wide task count.
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
    title: input.link.titleVisible ? input.project?.title ?? null : null,
    subtitle: input.link.clientFacingSubtitle,
    status: input.link.statusVisible
      ? mapProjectStatusForClient(input.project?.status ?? null)
      : null,
    targetDate: input.link.targetDateVisible ? input.project?.deadline_date ?? null : null,
    contentDirection: input.link.contentDirection,
    commentsEnabled: input.link.commentsEnabled,
    progress,
    latestUpdate: input.currentUpdate
      ? { body: input.currentUpdate.body, publishedAt: input.currentUpdate.publishedAt }
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

  const mappedTasks: MappedTaskInput[] =
    "mappedTasks" in managementState.data ? managementState.data.mappedTasks : [];
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

  const mappedResources: MappedResourceInput[] =
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

  return assembleClientProjection({
    link,
    project,
    mappedTasks,
    mappedResources,
    currentUpdate:
      "currentUpdate" in managementState.data && managementState.data.currentUpdate
        ? {
            body: managementState.data.currentUpdate.body,
            publishedAt: managementState.data.currentUpdate.publishedAt,
          }
        : null,
    taskTitleById,
    resourceRowById,
  });
}

/*
  Phase 3 -- the public, service-role-mediated counterpart of
  buildClientShareProjection. MUST be called only after the caller has
  already performed its own full session/grant verification
  (lib/share/share-session-grant.server.ts's verifyShareProjectionAuthorization)
  -- this function trusts shareLinkId/projectId/userId as already-proven
  inputs, exactly like the owner path trusts its own auth-verified linkId.
  It never calls the owner-authenticated get_share_link_management_state
  RPC (that RPC requires auth.uid(), which is null under the service-role
  key) -- instead it reads project_share_links/share_link_tasks/
  share_link_resources/share_link_updates directly via the service-role
  client, using explicit bounded column selects, each scoped by
  share_link_id/project_id/user_id, exactly as the Phase 3 rate-limit
  foundation's sibling migrations already grant
  (`grant select on table public.project_share_links/share_link_tasks/
  share_link_resources/share_link_updates to service_role`) -- no new RPC,
  no new migration, no weakened privilege.
*/

type PublicLinkFieldsRow = {
  title_visible: boolean;
  status_visible: boolean;
  target_date_visible: boolean;
  client_facing_subtitle: string | null;
  content_direction: string;
  comments_enabled: boolean;
};

type TaskMappingRow = {
  subtask_id: string;
  public_group: string;
  waiting_for_client_feedback: boolean;
};

type ResourceMappingRow = {
  resource_id: string;
  public_label: string;
  can_download: boolean;
};

type UpdateRow = { body: string; published_at: string };

export type ClientSharePublicProjectionInput = {
  shareLinkId: string;
  projectId: string;
  userId: string;
};

export async function buildPublicClientShareProjection(
  input: ClientSharePublicProjectionInput
): Promise<ClientSharePreviewResult> {
  const client = supabaseAdmin as unknown as ProjectionSupabaseLikeClient;
  const shareLinkId = canonicalizeUuid(input.shareLinkId);
  const projectId = canonicalizeUuid(input.projectId);

  const { data: linkRow, error: linkError } = await client
    .from("project_share_links")
    .select(
      "title_visible, status_visible, target_date_visible, client_facing_subtitle, content_direction, comments_enabled"
    )
    .eq("id", shareLinkId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (linkError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  if (!linkRow) {
    return { ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } };
  }
  const linkFields = linkRow as unknown as PublicLinkFieldsRow;
  const link: LinkPublicationFields = {
    titleVisible: linkFields.title_visible,
    statusVisible: linkFields.status_visible,
    targetDateVisible: linkFields.target_date_visible,
    clientFacingSubtitle: linkFields.client_facing_subtitle,
    contentDirection: linkFields.content_direction as LinkPublicationFields["contentDirection"],
    commentsEnabled: linkFields.comments_enabled,
  };

  const { data: taskMappingRows, error: taskMappingError } = await client
    .from("share_link_tasks")
    .select("subtask_id, public_group, waiting_for_client_feedback")
    .eq("share_link_id", shareLinkId)
    .eq("user_id", input.userId);

  if (taskMappingError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  const mappedTasks: MappedTaskInput[] = (
    (taskMappingRows as unknown as TaskMappingRow[] | null) ?? []
  ).map((row) => ({
    subtaskId: String(row.subtask_id),
    publicGroup: row.public_group as ClientProjectTask["publicGroup"],
    waitingForClientFeedback: row.waiting_for_client_feedback,
  }));

  const { data: resourceMappingRows, error: resourceMappingError } = await client
    .from("share_link_resources")
    .select("resource_id, public_label, can_download")
    .eq("share_link_id", shareLinkId)
    .eq("user_id", input.userId);

  if (resourceMappingError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  const mappedResources: MappedResourceInput[] = (
    (resourceMappingRows as unknown as ResourceMappingRow[] | null) ?? []
  ).map((row) => ({
    resourceId: row.resource_id,
    publicLabel: row.public_label,
    canDownload: row.can_download,
  }));

  const { data: updateRow, error: updateError } = await client
    .from("share_link_updates")
    .select("body, published_at")
    .eq("share_link_id", shareLinkId)
    .eq("user_id", input.userId)
    .eq("is_current", true)
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
  const currentUpdate: CurrentUpdateInput = updateRow
    ? {
        body: (updateRow as unknown as UpdateRow).body,
        publishedAt: (updateRow as unknown as UpdateRow).published_at,
      }
    : null;

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

  return assembleClientProjection({
    link,
    project,
    mappedTasks,
    mappedResources,
    currentUpdate,
    taskTitleById,
    resourceRowById,
  });
}
