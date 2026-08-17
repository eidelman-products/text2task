import type {
  MappedShareLinkResource,
  MappedShareLinkTask,
  SaveShareConfigurationResourceItem,
  SaveShareConfigurationTaskItem,
} from "@/lib/share/share-contracts";
import type { TaskProjectSubtask } from "../task-types";
import type { TaskResource } from "../../resources/resource-api";
import { isShareableResource } from "./share-link-configuration-editor";

type SharePublicGroup = SaveShareConfigurationTaskItem["publicGroup"];

/*
  Objective B (owner UX simplification): pure, framework-free helpers
  behind the "Share project update" quick-share flow. Nothing here talks
  to the network -- every function takes already-loaded data and returns
  either a save-request fragment or a display summary. This keeps the
  "automatic defaults, persisted overrides always win" rule testable in
  isolation from the panel/hook wiring that calls it.

  CORE RULE (owner overrides always win): automatic grouping is applied
  ONLY when a link has no persisted task mapping at all yet
  (mappedTasks.length === 0). share_link_tasks has no distinct "owner
  explicitly hid this task" state separate from "never mapped" -- once
  ANY mapping exists (whether it came from an earlier automatic
  application or from the advanced editor), recomputing/resending an
  automatic set on every later quick-share would silently undo a
  deliberate owner hide the next time they click "Share update". So once
  a link has a persisted mapping, quick-share leaves `tasks` alone
  entirely (omitted from the save request) unless the owner explicitly
  edits it under "Edit what client sees" -- it never re-derives or
  resets it. See buildQuickShareTaskProgress/buildAutomaticTaskItems.
*/

/** Deleted or archived subtasks are never eligible for automatic
 * inclusion -- matches the advanced editor's own task list, which never
 * exposes these either. */
export function isEligibleSubtask(subtask: TaskProjectSubtask): boolean {
  return !subtask.deleted_at && !subtask.is_archived;
}

/**
 * Maps the existing internal status vocabulary (New/In Progress/Review/
 * Urgent/Done -- see share-link-configuration-editor.tsx's own
 * suggestPublicGroup) to one of the three automatic public buckets.
 * "Urgent" is read as a normal in-progress task -- the word itself is
 * never surfaced publicly, only ever used here to pick a group.
 * waitingForClientFeedback is never assigned automatically; that stays a
 * manual, explicit-only signal (see the file header).
 */
export function suggestAutomaticPublicGroup(
  internalStatus: string
): Extract<SharePublicGroup, "completed" | "in_progress" | "coming_up"> {
  if (internalStatus === "Done") return "completed";
  if (internalStatus === "New") return "coming_up";
  return "in_progress";
}

export type QuickShareTaskGroupCounts = {
  completed: number;
  inProgress: number;
  comingUp: number;
  waitingForFeedback: number;
  total: number;
};

function emptyCounts(): QuickShareTaskGroupCounts {
  return { completed: 0, inProgress: 0, comingUp: 0, waitingForFeedback: 0, total: 0 };
}

function countByGroup(
  items: Array<{ publicGroup: SharePublicGroup; waitingForClientFeedback: boolean }>
): QuickShareTaskGroupCounts {
  const counts = emptyCounts();
  for (const item of items) {
    counts.total += 1;
    if (item.waitingForClientFeedback) {
      counts.waitingForFeedback += 1;
      continue;
    }
    if (item.publicGroup === "completed") counts.completed += 1;
    else if (item.publicGroup === "coming_up") counts.comingUp += 1;
    else counts.inProgress += 1;
  }
  return counts;
}

/**
 * Builds the full automatic task set for a link with no persisted
 * mapping yet -- one item per eligible subtask, grouped via
 * suggestAutomaticPublicGroup, in project order. displayOrder is
 * assigned sequentially (0, 1, 2, ...) since there is nothing persisted
 * to retain yet.
 */
export function buildAutomaticTaskItems(
  subtasks: TaskProjectSubtask[]
): SaveShareConfigurationTaskItem[] {
  return subtasks.filter(isEligibleSubtask).map((subtask, index) => ({
    subtaskId: String(subtask.id),
    publicGroup: suggestAutomaticPublicGroup(subtask.status),
    waitingForClientFeedback: false,
    displayOrder: index,
  }));
}

export type QuickShareTaskProgress = QuickShareTaskGroupCounts & {
  /** true when these counts reflect the automatic default grouping
   * (no persisted mapping exists yet); false when they reflect the
   * owner's own persisted, possibly-customized mapping. */
  usingAutomaticDefaults: boolean;
};

/**
 * What the quick-share panel shows as the progress preview line ("4
 * completed - 1 in progress - 5 coming up") BEFORE the owner clicks
 * Share update. Reflects exactly what a Share update click would send:
 * the persisted mapping if one already exists (never recomputed), or the
 * automatic default over eligible subtasks otherwise.
 */
export function buildQuickShareTaskProgress(
  subtasks: TaskProjectSubtask[],
  mappedTasks: MappedShareLinkTask[]
): QuickShareTaskProgress {
  if (mappedTasks.length > 0) {
    return { ...countByGroup(mappedTasks), usingAutomaticDefaults: false };
  }
  return { ...countByGroup(buildAutomaticTaskItems(subtasks)), usingAutomaticDefaults: true };
}

/** Percent complete for the simple "X% complete" headline, from whichever
 * counts buildQuickShareTaskProgress produced. Mirrors the public
 * projection's own percent semantics (completed / total), rounded to the
 * nearest whole number, null when there is nothing to show a percentage
 * for. */
export function percentComplete(counts: QuickShareTaskGroupCounts): number | null {
  if (counts.total === 0) return null;
  return Math.round((counts.completed / counts.total) * 100);
}

/**
 * Decides whether a "Share update" click should include a `tasks` group
 * at all. Per the file-header rule: only when there is no persisted
 * mapping yet. Returns undefined (omit from the request) once any
 * mapping already exists, so a persisted owner customization -- including
 * a deliberate hide -- is never silently reset by a later quick-share.
 */
export function buildQuickShareTaskItems(
  subtasks: TaskProjectSubtask[],
  mappedTasks: MappedShareLinkTask[]
): SaveShareConfigurationTaskItem[] | undefined {
  if (mappedTasks.length > 0) return undefined;
  return buildAutomaticTaskItems(subtasks);
}

/** The list of Resources the quick-share "Attachments" picker may offer
 * -- Notes are never shareable, matching the advanced editor's own
 * classification exactly (isShareableResource, imported, not
 * re-declared). */
export function quickShareAttachmentCandidates(resources: TaskResource[]): TaskResource[] {
  return resources.filter(isShareableResource);
}

/**
 * Privacy-safe display label for an attachment the owner has not
 * explicitly renamed: the Resource's own owner-set title if present,
 * otherwise the generic "Project attachment" fallback -- never notes,
 * storage_path, or any other private/internal field. Matches the
 * generic-fallback wording the redesign spec calls for.
 */
export function safeAttachmentLabel(resource: TaskResource): string {
  const title = resource.title?.trim();
  if (title && title.length > 0) return title.slice(0, 120);
  return "Project attachment";
}

/**
 * Builds the `resources` save-request group for the quick-share
 * Attachments picker. Persisted-first, exactly like the advanced
 * editor's own buildInitialResourceDrafts: a Resource the owner has
 * already mapped keeps its real persisted publicLabel/canDownload/
 * displayOrder untouched even if it is re-selected here; only a Resource
 * with no prior mapping receives the safe auto-generated label,
 * canDownload: false, and a freshly assigned displayOrder.
 */
export function buildQuickShareResourceItems(
  selectedResourceIds: readonly string[],
  resources: TaskResource[],
  mappedResources: MappedShareLinkResource[]
): SaveShareConfigurationResourceItem[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const mappedById = new Map(mappedResources.map((resource) => [resource.resourceId, resource]));

  const retainedOrders = selectedResourceIds
    .map((id) => mappedById.get(id)?.displayOrder)
    .filter((order): order is number => typeof order === "number");
  let nextOrder = retainedOrders.length > 0 ? Math.max(...retainedOrders) + 1 : 0;

  const items: SaveShareConfigurationResourceItem[] = [];

  for (const id of selectedResourceIds) {
    const mapped = mappedById.get(id);
    if (mapped) {
      items.push({
        resourceId: id,
        publicLabel: mapped.publicLabel,
        canDownload: mapped.canDownload,
        displayOrder: mapped.displayOrder,
      });
      continue;
    }

    const resource = byId.get(id);
    if (!resource) continue;

    items.push({
      resourceId: id,
      publicLabel: safeAttachmentLabel(resource),
      canDownload: false,
      displayOrder: nextOrder++,
    });
  }

  return items;
}
