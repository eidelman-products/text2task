"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  isFileResource,
  isLinkResource,
  isNoteResource,
  type TaskResource,
} from "../../resources/resource-api";
import { DashboardButton } from "../../ui/button";
import { fieldLabel, inputBase, row, stack } from "../../ui/styles";
import { dashboardColors, dashboardRadii, dashboardTypography } from "../../ui/tokens";
import type {
  MappedShareLinkResource,
  MappedShareLinkTask,
  SaveShareConfigurationRequest,
  SaveShareConfigurationResourceItem,
  SaveShareConfigurationTaskItem,
  ShareLinkManagementStateData,
} from "@/lib/share/share-contracts";
import type { TaskProjectGroup, TaskProjectSubtask } from "../task-types";

// Kept as an inline shape rather than importing a new export from
// share-contracts.ts -- no exported type currently isolates just the
// "current update" object (only the outer state union is exported), and
// adding one would be a contract change this phase does not need.
type CurrentUpdate = { body: string; version: number; publishedAt: string } | null;

/*
  Phase 2B: the owner content-configuration editor, rendered by
  ShareLinkPanel whenever a managed link exists (any non-revoked state --
  save_share_configuration itself is the only place state is restricted,
  and it already only rejects a revoked link, which this contract can
  never even return). Everything here is local, unsaved draft state until
  the owner clicks Save -- opening or editing this form never calls any
  API, matching the mapping's "opening or editing the form must not
  publish anything" requirement.

  PHASE 2B CORRECTIVE FOUNDATION -- lossless reopen/edit/resave:
  get_share_link_management_state (corrected by migration
  202608110002_client_share_management_mapping_metadata.sql) now returns
  the COMPLETE persisted per-item mapping metadata for every already-
  mapped task (publicGroup, waitingForClientFeedback, displayOrder) and
  Resource (publicLabel, canDownload, displayOrder) via `mappedTasks`/
  `mappedResources` -- never bare id arrays. buildInitialTaskDrafts/
  buildInitialResourceDrafts below initialize an already-mapped item's
  draft directly from that persisted metadata, NEVER from a guess (e.g.
  never from suggestPublicGroup or a hardcoded default) -- guesses are
  reserved exclusively for a genuinely unmapped item becoming a brand-new
  selection.

  `tasksTouched`/`resourcesTouched` still track whether the owner
  interacted with that section THIS session, and the save payload still
  omits a group entirely unless it was touched (relying on
  save_share_configuration's own "a null group leaves the existing
  mapping untouched" semantics) -- but now, when a touched group IS
  submitted, every retained-but-unedited sibling item carries its real
  persisted publicGroup/waitingForClientFeedback/publicLabel/canDownload/
  displayOrder forward unchanged, because that is what its draft was
  initialized from. Editing one item's field only changes that field on
  that item; it can no longer silently overwrite a sibling's persisted
  metadata with a guess.

  displayOrder specifically: there is no reorder interaction in this
  Phase 2B UI, so a previously-mapped item's displayOrder is carried
  forward exactly as persisted (see the "8 stays 8" contract in the
  migration). Only a brand-new selection (a task/Resource with no prior
  mapping) receives a freshly assigned displayOrder, computed in
  buildSaveRequest as one past the highest retained displayOrder in that
  save -- never colliding with, and never renumbering, any retained
  item.
*/

type ManagedShareLink = NonNullable<ShareLinkManagementStateData["link"]>;

export type ShareLinkConfigurationEditorProps = {
  link: ManagedShareLink;
  mappedTasks: MappedShareLinkTask[];
  mappedResources: MappedShareLinkResource[];
  currentUpdate: CurrentUpdate;
  project: TaskProjectGroup;
  resources: TaskResource[];
  resourcesLoading: boolean;
  resourcesError: string | null;
  onRetryResources: () => void;
  pending: boolean;
  disabled: boolean;
  onSave: (request: SaveShareConfigurationRequest) => void;
};

type TaskDraft = {
  selected: boolean;
  publicGroup: SaveShareConfigurationTaskItem["publicGroup"];
  waitingForClientFeedback: boolean;
  // The item's real persisted display_order, or null for an item that
  // has never been mapped (a brand-new selection has no persisted order
  // yet -- one is assigned only at save time, in buildSaveRequest).
  displayOrder: number | null;
};

type ResourceDraft = {
  selected: boolean;
  publicLabel: string;
  canDownload: boolean;
  displayOrder: number | null;
};

const PUBLIC_GROUP_OPTIONS: { value: SaveShareConfigurationTaskItem["publicGroup"]; label: string }[] = [
  { value: "coming_up", label: "Coming up" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_feedback", label: "Waiting for client feedback" },
  { value: "completed", label: "Completed" },
];

/** Deterministic, non-arbitrary starting suggestion only -- never a
 * claim about what was actually saved before. The internal status
 * vocabulary (New/In Progress/Review/Urgent/Done) is never surfaced to
 * the client; this only picks a reasonable initial client-facing bucket
 * the owner can change before saving. */
function suggestPublicGroup(internalStatus: string): SaveShareConfigurationTaskItem["publicGroup"] {
  if (internalStatus === "Done") return "completed";
  return "in_progress";
}

function isShareableResource(resource: TaskResource): boolean {
  return !isNoteResource(resource) && (isFileResource(resource) || isLinkResource(resource));
}

/**
 * For an already-mapped task, every field is sourced from the persisted
 * mapping metadata (mappedTasks) -- never guessed. Only a genuinely
 * unmapped subtask falls back to the safe new-selection defaults
 * (suggestPublicGroup, waitingForClientFeedback: false, displayOrder:
 * null), and those defaults are never applied over a real mapping.
 */
function buildInitialTaskDrafts(
  subtasks: TaskProjectSubtask[],
  mappedTasks: MappedShareLinkTask[]
): Record<string, TaskDraft> {
  const mappedById = new Map(mappedTasks.map((task) => [task.subtaskId, task]));
  const drafts: Record<string, TaskDraft> = {};

  for (const subtask of subtasks) {
    const id = String(subtask.id);
    const mapped = mappedById.get(id);

    drafts[id] = mapped
      ? {
          selected: true,
          publicGroup: mapped.publicGroup,
          waitingForClientFeedback: mapped.waitingForClientFeedback,
          displayOrder: mapped.displayOrder,
        }
      : {
          selected: false,
          publicGroup: suggestPublicGroup(subtask.status),
          waitingForClientFeedback: false,
          displayOrder: null,
        };
  }

  return drafts;
}

/**
 * Same persisted-first rule as buildInitialTaskDrafts: an already-mapped
 * Resource's publicLabel/canDownload/displayOrder always come from
 * mappedResources, never from resource.title or a hardcoded default.
 * resource.title is used only as a new-selection default label for a
 * Resource that has never been mapped before.
 */
function buildInitialResourceDrafts(
  resources: TaskResource[],
  mappedResources: MappedShareLinkResource[]
): Record<string, ResourceDraft> {
  const mappedById = new Map(mappedResources.map((resource) => [resource.resourceId, resource]));
  const drafts: Record<string, ResourceDraft> = {};

  for (const resource of resources) {
    const mapped = mappedById.get(resource.id);

    drafts[resource.id] = mapped
      ? {
          selected: true,
          publicLabel: mapped.publicLabel,
          canDownload: mapped.canDownload,
          displayOrder: mapped.displayOrder,
        }
      : {
          selected: false,
          publicLabel: resource.title?.trim() || "Shared resource",
          canDownload: false,
          displayOrder: null,
        };
  }

  return drafts;
}

/** One past the highest retained displayOrder in this save, or 0 if none
 * are retained -- deterministic, and never collides with a retained
 * item's real persisted displayOrder. */
function nextDisplayOrderAfter(retainedOrders: number[]): number {
  return retainedOrders.length > 0 ? Math.max(...retainedOrders) + 1 : 0;
}

export function ShareLinkConfigurationEditor({
  link,
  mappedTasks,
  mappedResources,
  currentUpdate,
  project,
  resources,
  resourcesLoading,
  resourcesError,
  onRetryResources,
  pending,
  disabled,
  onSave,
}: ShareLinkConfigurationEditorProps) {
  const shareableResources = useMemo(
    () => resources.filter(isShareableResource),
    [resources]
  );

  // Re-initialized whenever the authoritative link identity/version
  // changes (a fresh open, or the re-read that follows a successful
  // save) -- never merged with in-flight local edits, so a stale draft
  // can never linger past a real state change.
  const [titleVisible, setTitleVisible] = useState(link.titleVisible);
  const [statusVisible, setStatusVisible] = useState(link.statusVisible);
  const [targetDateVisible, setTargetDateVisible] = useState(link.targetDateVisible);
  const [commentsEnabled, setCommentsEnabled] = useState(link.commentsEnabled);
  const [clientFacingSubtitle, setClientFacingSubtitle] = useState(
    link.clientFacingSubtitle ?? ""
  );
  const [contentDirection, setContentDirection] = useState(link.contentDirection);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>(() =>
    buildInitialTaskDrafts(project.subtasks, mappedTasks)
  );
  const [tasksTouched, setTasksTouched] = useState(false);
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, ResourceDraft>>(() =>
    buildInitialResourceDrafts(shareableResources, mappedResources)
  );
  const [resourcesTouched, setResourcesTouched] = useState(false);
  const [updateDraft, setUpdateDraft] = useState("");

  useEffect(() => {
    setTitleVisible(link.titleVisible);
    setStatusVisible(link.statusVisible);
    setTargetDateVisible(link.targetDateVisible);
    setCommentsEnabled(link.commentsEnabled);
    setClientFacingSubtitle(link.clientFacingSubtitle ?? "");
    setContentDirection(link.contentDirection);
    setTaskDrafts(buildInitialTaskDrafts(project.subtasks, mappedTasks));
    setTasksTouched(false);
    setResourceDrafts(buildInitialResourceDrafts(shareableResources, mappedResources));
    setResourcesTouched(false);
    setUpdateDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.id, link.configurationVersion]);

  function toggleTask(id: string) {
    setTasksTouched(true);
    setTaskDrafts((current) => ({
      ...current,
      [id]: { ...current[id], selected: !current[id]?.selected },
    }));
  }

  function updateTaskField<K extends keyof TaskDraft>(id: string, field: K, value: TaskDraft[K]) {
    setTasksTouched(true);
    setTaskDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  function toggleResource(id: string) {
    setResourcesTouched(true);
    setResourceDrafts((current) => ({
      ...current,
      [id]: { ...current[id], selected: !current[id]?.selected },
    }));
  }

  function updateResourceField<K extends keyof ResourceDraft>(
    id: string,
    field: K,
    value: ResourceDraft[K]
  ) {
    setResourcesTouched(true);
    setResourceDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  function resetChanges() {
    setTitleVisible(link.titleVisible);
    setStatusVisible(link.statusVisible);
    setTargetDateVisible(link.targetDateVisible);
    setCommentsEnabled(link.commentsEnabled);
    setClientFacingSubtitle(link.clientFacingSubtitle ?? "");
    setContentDirection(link.contentDirection);
    setTaskDrafts(buildInitialTaskDrafts(project.subtasks, mappedTasks));
    setTasksTouched(false);
    setResourceDrafts(buildInitialResourceDrafts(shareableResources, mappedResources));
    setResourcesTouched(false);
  }

  function buildSaveRequest(includeUpdate: boolean): SaveShareConfigurationRequest {
    const request: SaveShareConfigurationRequest = {
      settings: {
        commentsEnabled,
        clientFacingSubtitle: clientFacingSubtitle.trim().length > 0 ? clientFacingSubtitle : null,
        contentDirection,
        titleVisible,
        statusVisible,
        targetDateVisible,
      },
    };

    if (tasksTouched) {
      const selected = project.subtasks
        .map((subtask) => ({ id: String(subtask.id), draft: taskDrafts[String(subtask.id)] }))
        .filter((entry): entry is { id: string; draft: TaskDraft } => entry.draft?.selected === true);

      const retainedOrders = selected
        .map((entry) => entry.draft.displayOrder)
        .filter((order): order is number => order !== null);
      let nextNewOrder = nextDisplayOrderAfter(retainedOrders);

      request.tasks = selected.map(({ id, draft }) => ({
        subtaskId: id,
        publicGroup: draft.publicGroup,
        waitingForClientFeedback: draft.waitingForClientFeedback,
        // A retained (previously-mapped) item keeps its real persisted
        // displayOrder; only a brand-new selection (displayOrder === null)
        // receives a freshly assigned one, never colliding with a
        // retained item's value.
        displayOrder: draft.displayOrder !== null ? draft.displayOrder : nextNewOrder++,
      }));
    }

    if (resourcesTouched) {
      const selected = shareableResources
        .map((resource) => ({ resource, draft: resourceDrafts[resource.id] }))
        .filter(
          (entry): entry is { resource: TaskResource; draft: ResourceDraft } =>
            entry.draft?.selected === true
        );

      const retainedOrders = selected
        .map((entry) => entry.draft.displayOrder)
        .filter((order): order is number => order !== null);
      let nextNewOrder = nextDisplayOrderAfter(retainedOrders);

      request.resources = selected.map(({ resource, draft }) => ({
        resourceId: resource.id,
        publicLabel: draft.publicLabel.trim().length > 0 ? draft.publicLabel : "Shared resource",
        canDownload: draft.canDownload,
        displayOrder: draft.displayOrder !== null ? draft.displayOrder : nextNewOrder++,
      }));
    }

    if (includeUpdate) {
      request.publishUpdate = { body: updateDraft };
    }

    return request;
  }

  function handleSaveConfiguration() {
    onSave(buildSaveRequest(false));
  }

  function handlePublishUpdate() {
    if (updateDraft.trim().length === 0) return;
    onSave(buildSaveRequest(true));
  }

  const selectedTaskCount = Object.values(taskDrafts).filter((d) => d.selected).length;
  const selectedResourceCount = Object.values(resourceDrafts).filter((d) => d.selected).length;

  return (
    <div style={stack(6)}>
      <SectionHeading
        title="Project information"
        description="Only these three fields may be shown to your client, and only when explicitly turned on. The project's real title, status and date are never shared automatically."
      />
      <div style={stack(2)}>
        <ToggleRow
          label="Show project title"
          checked={titleVisible}
          disabled={disabled}
          onChange={setTitleVisible}
        />
        <ToggleRow
          label="Show project status"
          checked={statusVisible}
          disabled={disabled}
          onChange={setStatusVisible}
        />
        <ToggleRow
          label="Show target date"
          checked={targetDateVisible}
          disabled={disabled}
          onChange={setTargetDateVisible}
        />
      </div>

      <SectionHeading title="Share settings" />
      <div style={stack(3)}>
        <ToggleRow
          label="Allow client comments"
          checked={commentsEnabled}
          disabled={disabled}
          onChange={setCommentsEnabled}
        />
        <label style={stack(1)}>
          <span style={fieldLabel}>Client-facing subtitle</span>
          <input
            type="text"
            value={clientFacingSubtitle}
            disabled={disabled}
            maxLength={200}
            placeholder="Optional short message shown to your client"
            onChange={(event) => setClientFacingSubtitle(event.target.value)}
            style={inputBase}
          />
        </label>
        <label style={stack(1)}>
          <span style={fieldLabel}>Text direction</span>
          <select
            value={contentDirection}
            disabled={disabled}
            onChange={(event) =>
              setContentDirection(event.target.value as "auto" | "ltr" | "rtl")
            }
            style={inputBase}
          >
            <option value="auto">Auto</option>
            <option value="ltr">Left to right</option>
            <option value="rtl">Right to left</option>
          </select>
        </label>
      </div>

      <SectionHeading
        title="Tasks"
        description={`Select exactly which tasks your client can see. ${selectedTaskCount} of ${project.subtasks.length} selected. Nothing is shared until you save.`}
      />
      <div style={stack(2)}>
        {project.subtasks.length === 0 ? (
          <p style={emptyTextStyle}>This project has no tasks yet.</p>
        ) : (
          project.subtasks.map((subtask) => {
            const id = String(subtask.id);
            const draft = taskDrafts[id];
            return (
              <TaskRow
                key={id}
                title={subtask.title}
                draft={draft}
                disabled={disabled}
                onToggle={() => toggleTask(id)}
                onGroupChange={(value) => updateTaskField(id, "publicGroup", value)}
                onWaitingChange={(value) =>
                  updateTaskField(id, "waitingForClientFeedback", value)
                }
              />
            );
          })
        )}
      </div>

      <SectionHeading
        title="Resources"
        description={`Select which files and links your client can see. ${selectedResourceCount} of ${shareableResources.length} selectable resources selected. Internal notes are never shareable and are not listed here.`}
      />
      {resourcesLoading ? (
        <p style={emptyTextStyle}>Loading resources...</p>
      ) : resourcesError ? (
        <div style={stack(2)}>
          <p style={errorTextStyle}>{resourcesError}</p>
          <DashboardButton variant="secondary" size="sm" onClick={onRetryResources}>
            Try again
          </DashboardButton>
        </div>
      ) : shareableResources.length === 0 ? (
        <p style={emptyTextStyle}>
          No shareable files or links yet. Notes are never shareable.
        </p>
      ) : (
        <div style={stack(2)}>
          {shareableResources.map((resource) => {
            const draft = resourceDrafts[resource.id];
            return (
              <ResourceRow
                key={resource.id}
                resource={resource}
                draft={draft}
                disabled={disabled}
                onToggle={() => toggleResource(resource.id)}
                onLabelChange={(value) => updateResourceField(resource.id, "publicLabel", value)}
                onCanDownloadChange={(value) =>
                  updateResourceField(resource.id, "canDownload", value)
                }
              />
            );
          })}
        </div>
      )}

      <SectionHeading title="Latest update" />
      <div style={stack(2)}>
        {currentUpdate ? (
          <div style={currentUpdateStyle}>
            <span style={fieldLabel}>Currently published (version {currentUpdate.version})</span>
            <p style={currentUpdateBodyStyle}>{currentUpdate.body}</p>
          </div>
        ) : (
          <p style={emptyTextStyle}>No update has been published to this client yet.</p>
        )}
        <label style={stack(1)}>
          <span style={fieldLabel}>Post a new update</span>
          <textarea
            value={updateDraft}
            disabled={disabled}
            maxLength={5000}
            rows={3}
            placeholder="Write a client-facing update. This does not use your internal project timeline or Client Update history."
            onChange={(event) => setUpdateDraft(event.target.value)}
            style={{ ...inputBase, resize: "vertical" as const }}
          />
        </label>
        <div>
          <DashboardButton
            variant="secondary"
            onClick={handlePublishUpdate}
            disabled={disabled || updateDraft.trim().length === 0}
            loading={pending}
          >
            Publish update
          </DashboardButton>
        </div>
      </div>

      <div style={row(2)}>
        <DashboardButton
          variant="primary"
          onClick={handleSaveConfiguration}
          disabled={disabled}
          loading={pending}
        >
          Save configuration
        </DashboardButton>
        <DashboardButton variant="ghost" onClick={resetChanges} disabled={disabled}>
          Reset changes
        </DashboardButton>
      </div>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div style={stack(1)}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      {description ? <p style={sectionDescriptionStyle}>{description}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span style={toggleLabelStyle}>{label}</span>
    </label>
  );
}

function TaskRow({
  title,
  draft,
  disabled,
  onToggle,
  onGroupChange,
  onWaitingChange,
}: {
  title: string;
  draft: TaskDraft | undefined;
  disabled: boolean;
  onToggle: () => void;
  onGroupChange: (value: SaveShareConfigurationTaskItem["publicGroup"]) => void;
  onWaitingChange: (value: boolean) => void;
}) {
  const selected = draft?.selected ?? false;

  return (
    <div style={itemRowStyle}>
      <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
        <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} />
        <span style={itemTitleStyle}>{title}</span>
      </label>
      {selected ? (
        <div style={{ ...stack(2), paddingLeft: 26 }}>
          <select
            value={draft?.publicGroup ?? "in_progress"}
            disabled={disabled}
            onChange={(event) =>
              onGroupChange(event.target.value as SaveShareConfigurationTaskItem["publicGroup"])
            }
            style={inputBase}
          >
            {PUBLIC_GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
            <input
              type="checkbox"
              checked={draft?.waitingForClientFeedback ?? false}
              disabled={disabled}
              onChange={(event) => onWaitingChange(event.target.checked)}
            />
            <span style={toggleLabelStyle}>Waiting for client feedback</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function ResourceRow({
  resource,
  draft,
  disabled,
  onToggle,
  onLabelChange,
  onCanDownloadChange,
}: {
  resource: TaskResource;
  draft: ResourceDraft | undefined;
  disabled: boolean;
  onToggle: () => void;
  onLabelChange: (value: string) => void;
  onCanDownloadChange: (value: boolean) => void;
}) {
  const selected = draft?.selected ?? false;

  return (
    <div style={itemRowStyle}>
      <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
        <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} />
        <span style={itemTitleStyle}>{resource.title?.trim() || "Untitled resource"}</span>
      </label>
      {selected ? (
        <div style={{ ...stack(2), paddingLeft: 26 }}>
          <input
            type="text"
            value={draft?.publicLabel ?? ""}
            disabled={disabled}
            maxLength={120}
            placeholder="Label shown to your client"
            onChange={(event) => onLabelChange(event.target.value)}
            style={inputBase}
          />
          {isFileResource(resource) ? (
            <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
              <input
                type="checkbox"
                checked={draft?.canDownload ?? false}
                disabled={disabled}
                onChange={(event) => onCanDownloadChange(event.target.checked)}
              />
              <span style={toggleLabelStyle}>Allow download</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const sectionDescriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};

const toggleLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
};

const itemRowStyle: CSSProperties = {
  padding: 10,
  borderRadius: dashboardRadii.lg,
  border: `1px solid ${dashboardColors.border.subtle}`,
  display: "grid",
  gap: 8,
};

const itemTitleStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.primary,
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};

const currentUpdateStyle: CSSProperties = {
  padding: 10,
  borderRadius: dashboardRadii.lg,
  background: dashboardColors.background.surfaceMuted,
  display: "grid",
  gap: 4,
};

const currentUpdateBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
  whiteSpace: "pre-wrap",
};
