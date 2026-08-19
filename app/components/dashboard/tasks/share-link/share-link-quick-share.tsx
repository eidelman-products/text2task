"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { DashboardButton } from "../../ui/button";
import { fieldLabel, inputBase, row, stack } from "../../ui/styles";
import { dashboardColors, dashboardTypography } from "../../ui/tokens";
import {
  setSharePinRequestSchema,
  type MappedShareLinkResource,
  type MappedShareLinkTask,
  type ShareLinkManagementStateData,
} from "@/lib/share/share-contracts";
import type { TaskProjectGroup } from "../task-types";
import type { TaskResource } from "../../resources/resource-api";
import {
  buildQuickShareTaskProgress,
  percentComplete,
  quickShareAttachmentCandidates,
} from "./quick-share-defaults";

/*
  Objective B -- the owner's entire normal "Share with client" panel
  content. Replaces the old draft/save-configuration/activate flow as the
  owner's normal entry point. This component is presentation + local
  draft state only; every actual write happens through useShareLink's
  shareUpdate action (one orchestrated call), never through calls made
  directly from here.

  Final simplification (real browser defect #3 turn): no other entry
  point exists inside this panel at all -- no "Edit what client sees",
  no "Manage link", no "Advanced"/settings/kebab-menu escape hatch of any
  kind. Draft terminology, the three project-visibility checkboxes,
  comments/text-direction controls, per-task group/waiting-for-feedback
  controls, technical Resource publicLabel editing, expiry, and every
  destructive lifecycle action (disable/re-enable/revoke/rotate) are
  simply not reachable from here -- sharing a project update is meant to
  feel like sending a message, not configuring a system. None of the
  underlying backend capabilities were removed (see
  share-link-configuration-editor.tsx/share-link-access-controls.tsx/
  share-link-panel.tsx's own LinkStateView, all still fully implemented
  and tested) -- they are simply not wired into this panel's normal flow
  any more.
*/

type ManagedShareLink = NonNullable<ShareLinkManagementStateData["link"]>;

export type ShareUpdateSubmission = {
  updateBody: string;
  // A freshly-typed PIN to SET (never used to clear an existing one), or
  // null when no new PIN is being set this submission.
  pin: string | null;
  // True only when the owner unchecked "Protect with a PIN" for a link
  // that already had one -- tells shareUpdate to call the existing
  // clear-PIN path. Mutually exclusive with `pin` by construction (see
  // handleShare below): a submission is never both setting and clearing.
  clearPin: boolean;
  attachmentResourceIds: string[];
  // Phase 5A -- the checkbox's current value, always sent (never
  // conditionally omitted): save_share_configuration's own
  // IS DISTINCT FROM comparison already no-ops (no configuration_version
  // bump, no row write) when this matches the link's current persisted
  // value, so always including it here needs no "did it actually
  // change" logic on this side. Reuses the existing commentsEnabled
  // column/RPC field -- not a second comments flag.
  commentsEnabled: boolean;
};

export type ShareLinkQuickShareProps = {
  link: ManagedShareLink | null;
  mappedTasks: MappedShareLinkTask[];
  mappedResources: MappedShareLinkResource[];
  project: TaskProjectGroup;
  resources: TaskResource[];
  resourcesLoading: boolean;
  pending: boolean;
  disabled: boolean;
  onShare: (submission: ShareUpdateSubmission) => void;
};

export function ShareLinkQuickShare({
  link,
  mappedTasks,
  mappedResources,
  project,
  resources,
  resourcesLoading,
  pending,
  disabled,
  onShare,
}: ShareLinkQuickShareProps) {
  // Whether the link, as last read from the server, already has a PIN --
  // the checkbox's own starting position, and the dividing line between
  // "enabling a brand-new PIN" (input required) and "already protected,
  // untouched or being disabled" (no input, nothing to type -- the
  // existing PIN value is never fetched or shown, see the file header).
  const initialHasPin = link?.hasPin ?? false;
  // Phase 5A -- a brand-new link (no link yet) has no persisted
  // commentsEnabled value to reflect; false matches the column's own
  // default (comments_enabled boolean not null default false) and the
  // existing isFirstShare settings default in useShareLink's own
  // shareUpdate action.
  const initialCommentsEnabled = link?.commentsEnabled ?? false;

  const [updateBody, setUpdateBody] = useState("");
  const [pinEnabled, setPinEnabled] = useState(initialHasPin);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(
    () => new Set(mappedResources.map((resource) => resource.resourceId))
  );
  const [commentsEnabled, setCommentsEnabled] = useState(initialCommentsEnabled);

  // A fresh authoritative read (open, or the refresh after a successful
  // share) resets every local draft field -- an owner's typed update
  // must never linger past the share it was written for. The PIN
  // checkbox specifically resets to the link's own current hasPin, not
  // unconditionally to false -- an already-protected link must always
  // reopen with the checkbox checked. The "Allow client messages"
  // checkbox follows the exact same rule for commentsEnabled: toggling
  // it alone (without clicking Share update) never persists, so a
  // reopen/refresh must always reflect the link's own last-PERSISTED
  // value, never a discarded local draft.
  useEffect(() => {
    setUpdateBody("");
    setPinEnabled(initialHasPin);
    setPinValue("");
    setPinError(null);
    setSelectedAttachmentIds(new Set(mappedResources.map((resource) => resource.resourceId)));
    setCommentsEnabled(initialCommentsEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id ?? null, link?.configurationVersion ?? null, initialHasPin, initialCommentsEnabled]);

  const progress = buildQuickShareTaskProgress(project.subtasks, mappedTasks);
  const percent = percentComplete(progress);
  const attachmentCandidates = quickShareAttachmentCandidates(resources);

  function toggleAttachment(id: string) {
    setSelectedAttachmentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePinCheckboxChange(checked: boolean) {
    setPinEnabled(checked);
    if (!checked) {
      setPinValue("");
      setPinError(null);
    }
  }

  // The checkbox is the single enable/disable control: checking it on a
  // link with no PIN yet requires typing one now (a brand-new PIN is
  // being set); leaving it checked on an already-protected link needs no
  // input at all (nothing changed, the existing PIN is left exactly as
  // persisted -- its value is never fetched or shown); unchecking it on
  // an already-protected link means "disable PIN" (clearPin), never
  // "set a blank PIN".
  function handleShare() {
    let pin: string | null = null;
    let clearPin = false;

    if (pinEnabled && !initialHasPin) {
      const parsed = setSharePinRequestSchema.safeParse({ pin: pinValue });
      if (!parsed.success) {
        setPinError("PIN must be exactly 4-6 digits.");
        return;
      }
      pin = parsed.data.pin;
    } else if (!pinEnabled && initialHasPin) {
      clearPin = true;
    }

    setPinError(null);
    onShare({
      updateBody,
      pin,
      clearPin,
      attachmentResourceIds: Array.from(selectedAttachmentIds),
      commentsEnabled,
    });
  }

  return (
    <div style={stack(5)}>
      <section style={stack(2)} aria-label="Project progress">
        <span style={sectionLabelStyle}>Project progress</span>
        {progress.total > 0 ? (
          <>
            <span style={percentTextStyle}>{percent}% complete</span>
            <span style={summaryTextStyle}>
              {formatProgressSummary(progress)}
            </span>
          </>
        ) : (
          <span style={summaryTextStyle}>This project has no tasks yet.</span>
        )}
      </section>

      <label style={stack(1)}>
        <span style={fieldLabel}>Client update</span>
        <textarea
          value={updateBody}
          disabled={disabled}
          maxLength={5000}
          rows={3}
          placeholder="Optional message to your client, e.g. &quot;Homepage design is complete. We're now working on the product pages.&quot;"
          onChange={(event) => setUpdateBody(event.target.value)}
          style={{ ...inputBase, resize: "vertical" as const }}
        />
      </label>

      <div style={stack(2)}>
        <span style={fieldLabel}>Attachments</span>
        {attachmentsOpen ? (
          <div style={stack(2)}>
            {resourcesLoading ? (
              <p style={mutedTextStyle}>Loading...</p>
            ) : attachmentCandidates.length === 0 ? (
              <p style={mutedTextStyle}>No files or links available to attach yet.</p>
            ) : (
              attachmentCandidates.map((resource) => (
                <label key={resource.id} style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedAttachmentIds.has(resource.id)}
                    disabled={disabled}
                    onChange={() => toggleAttachment(resource.id)}
                  />
                  <span style={attachmentLabelStyle}>
                    {resource.title?.trim() || "Untitled attachment"}
                  </span>
                </label>
              ))
            )}
          </div>
        ) : (
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => setAttachmentsOpen(true)}
            disabled={disabled}
          >
            {selectedAttachmentIds.size > 0
              ? `${selectedAttachmentIds.size} attachment${selectedAttachmentIds.size === 1 ? "" : "s"} selected`
              : "Add attachment"}
          </DashboardButton>
        )}
      </div>

      <div style={stack(2)}>
        <span style={fieldLabel}>Security</span>
        <div style={stack(2)}>
          <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
            <input
              type="checkbox"
              checked={commentsEnabled}
              disabled={disabled}
              onChange={(event) => setCommentsEnabled(event.target.checked)}
            />
            <span style={toggleLabelStyle}>Allow client messages</span>
          </label>
          <label style={{ ...row(2), cursor: disabled ? "not-allowed" : "pointer" }}>
            <input
              type="checkbox"
              checked={pinEnabled}
              disabled={disabled}
              onChange={(event) => handlePinCheckboxChange(event.target.checked)}
            />
            <span style={toggleLabelStyle}>Protect with a PIN (optional)</span>
          </label>
          {pinEnabled && !initialHasPin ? (
            <div style={stack(1)}>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pinValue}
                disabled={disabled}
                placeholder="4-6 digit PIN"
                onChange={(event) => {
                  setPinValue(event.target.value);
                  setPinError(null);
                }}
                style={inputBase}
                aria-label="PIN"
              />
              {pinError ? <p style={errorTextStyle}>{pinError}</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      <DashboardButton variant="primary" onClick={handleShare} loading={pending} disabled={disabled}>
        Share update
      </DashboardButton>
    </div>
  );
}

function formatProgressSummary(progress: {
  completed: number;
  inProgress: number;
  comingUp: number;
  waitingForFeedback: number;
}): string {
  const parts = [
    `${progress.completed} completed`,
    `${progress.inProgress} in progress`,
    `${progress.comingUp} coming up`,
  ];
  if (progress.waitingForFeedback > 0) {
    parts.push(`${progress.waitingForFeedback} waiting for your feedback`);
  }
  return parts.join(" · ");
}

const sectionLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: dashboardColors.text.muted,
};

const percentTextStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xl,
  fontWeight: dashboardTypography.weight.bold,
  color: dashboardColors.text.primary,
};

const summaryTextStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.secondary,
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};

const toggleLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.secondary,
};

const attachmentLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.primary,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};
