"use client";

import { useEffect, useId, useState, type CSSProperties, type RefObject } from "react";

import { DashboardBadge } from "../../ui/badge";
import { DashboardButton } from "../../ui/button";
import { ResponsiveDialog } from "../../ui/responsive-dialog";
import { row, stack } from "../../ui/styles";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../ui/tokens";
import type { SaveShareConfigurationRequest } from "@/lib/share/share-contracts";
import { ShareLinkAccessControls } from "./share-link-access-controls";
import { ShareLinkChannels } from "./share-link-channels";
import { ConfirmableActionButton } from "./share-link-confirmable-button";
import { ShareLinkConfigurationEditor } from "./share-link-configuration-editor";
import type { ShareLinkActionKind, ShareLinkPanelState } from "./use-share-link";

/*
  Phase 2A management shell (no-link/draft/active/disabled/expired states,
  create draft, activate, disable, re-enable, revoke), joined by the
  Phase 2B content-configuration editor (rendered below the lifecycle
  controls whenever a managed link exists, in any state -- saving is only
  ever rejected server-side for a revoked link, and this panel already
  can't reach that combination since a revoked link reads back as `link:
  null`), and now Phase 2C's owner access controls (PIN, expiry) and
  share channels (Copy, Native Share, WhatsApp, Rotate). Still excludes
  Preview and anything public -- those remain later Phase 2 slices.
*/

export type ShareLinkPanelProps = {
  state: ShareLinkPanelState;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRetry: () => void;
  onRetryResources: () => void;
  onCreateDraft: () => void;
  onActivate: () => void;
  onDisable: () => void;
  onReenable: () => void;
  onRevoke: () => void;
  onCopyLink: () => void;
  onSaveConfiguration: (request: SaveShareConfigurationRequest) => void;
  onSetPin: (pin: string) => void;
  onClearPin: () => void;
  onSetExpiry: (expiresAtIso: string) => void;
  onClearExpiry: () => void;
  onRotate: () => void;
  onNativeShare: () => void;
  onWhatsApp: (popup: Window | null) => void;
};

const STATE_LABELS: Record<string, { label: string; variant: "neutral" | "blue" | "green" | "amber" }> = {
  draft: { label: "Draft", variant: "neutral" },
  active: { label: "Active", variant: "green" },
  disabled: { label: "Disabled", variant: "amber" },
  expired: { label: "Expired", variant: "amber" },
};

export function ShareLinkPanel({
  state,
  triggerRef,
  onClose,
  onRetry,
  onRetryResources,
  onCreateDraft,
  onActivate,
  onDisable,
  onReenable,
  onRevoke,
  onCopyLink,
  onSaveConfiguration,
  onSetPin,
  onClearPin,
  onSetExpiry,
  onClearExpiry,
  onRotate,
  onNativeShare,
  onWhatsApp,
}: ShareLinkPanelProps) {
  const headingId = useId();
  const [confirmingAction, setConfirmingAction] = useState<
    "disable" | "revoke" | "clearPin" | "rotate" | null
  >(null);

  // Reset any pending destructive confirmation whenever the panel opens
  // for a (possibly different) project, or once an action completes.
  useEffect(() => {
    if (!state.isOpen) {
      setConfirmingAction(null);
    }
  }, [state.isOpen, state.projectId]);

  useEffect(() => {
    if (state.actionPending) {
      setConfirmingAction(null);
    }
  }, [state.actionPending]);

  if (!state.isOpen) {
    return null;
  }

  const busy = state.actionPending !== null;
  const link = state.data?.link ?? null;
  const projectTitle = state.project?.projectTitle || "this project";

  function handleRequestClose() {
    if (busy) return;
    setConfirmingAction(null);
    onClose();
  }

  function runWithConfirm(
    action: "disable" | "revoke" | "clearPin" | "rotate",
    run: () => void
  ) {
    if (confirmingAction === action) {
      setConfirmingAction(null);
      run();
      return;
    }
    setConfirmingAction(action);
  }

  return (
    <ResponsiveDialog
      open={state.isOpen}
      onRequestClose={handleRequestClose}
      triggerRef={triggerRef}
      busy={busy}
      aria-labelledby={headingId}
    >
      <div style={panelStyle}>
        <button
          type="button"
          aria-label="Close"
          onClick={handleRequestClose}
          disabled={busy}
          style={closeButtonStyle}
        >
          <span aria-hidden="true">&times;</span>
        </button>

        <div style={stack(1)}>
          <h2 id={headingId} style={headingStyle}>
            Share with client
          </h2>
          <p style={subheadingStyle}>{projectTitle}</p>
        </div>

        {state.isLoading ? (
          <div style={statusRowStyle}>Loading share link status...</div>
        ) : state.loadError ? (
          <div style={stack(3)}>
            <div style={errorTextStyle}>{state.loadError}</div>
            <DashboardButton variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </DashboardButton>
          </div>
        ) : !link ? (
          <NoLinkView
            pending={state.actionPending === "createDraft"}
            busy={busy}
            onCreateDraft={onCreateDraft}
          />
        ) : (
          <>
            <LinkStateView
              state={link.state}
              actionPending={state.actionPending}
              confirmingAction={confirmingAction}
              onActivate={onActivate}
              onDisable={() => runWithConfirm("disable", onDisable)}
              onReenable={onReenable}
              onRevoke={() => runWithConfirm("revoke", onRevoke)}
              onCancelConfirm={() => setConfirmingAction(null)}
            />
            <ShareLinkAccessControls
              link={link}
              disabled={busy}
              actionPending={state.actionPending}
              confirmingClearPin={confirmingAction === "clearPin"}
              onSetPin={onSetPin}
              onRequestClearPin={() => runWithConfirm("clearPin", onClearPin)}
              onCancelClearPinConfirm={() => setConfirmingAction(null)}
              onSetExpiry={onSetExpiry}
              onClearExpiry={onClearExpiry}
            />
            <ShareLinkChannels
              linkState={link.state}
              actionPending={state.actionPending}
              disabled={busy}
              copyStatus={state.copyStatus}
              confirmingRotate={confirmingAction === "rotate"}
              onCopyLink={onCopyLink}
              onNativeShare={onNativeShare}
              onWhatsApp={onWhatsApp}
              onRequestRotate={() => runWithConfirm("rotate", onRotate)}
              onCancelRotateConfirm={() => setConfirmingAction(null)}
            />
            {state.project && state.data ? (
              <ShareLinkConfigurationEditor
                link={link}
                mappedTasks={state.data.mappedTasks}
                mappedResources={state.data.mappedResources}
                currentUpdate={state.data.currentUpdate}
                project={state.project}
                resources={state.resources}
                resourcesLoading={state.resourcesLoading}
                resourcesError={state.resourcesError}
                onRetryResources={onRetryResources}
                pending={state.actionPending === "saveConfiguration"}
                disabled={busy}
                onSave={onSaveConfiguration}
              />
            ) : null}
          </>
        )}

        {state.actionError ? (
          <div style={errorTextStyle} role="alert">
            {state.actionError}
          </div>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

function NoLinkView({
  pending,
  busy,
  onCreateDraft,
}: {
  pending: boolean;
  busy: boolean;
  onCreateDraft: () => void;
}) {
  return (
    <div style={stack(3)}>
      <p style={bodyTextStyle}>
        No client share link exists for this project yet. Creating a draft
        does not publish anything -- nothing is visible to your client until
        you activate the link.
      </p>
      <DashboardButton
        variant="primary"
        onClick={onCreateDraft}
        loading={pending}
        disabled={busy}
      >
        Create draft link
      </DashboardButton>
    </div>
  );
}

function LinkStateView({
  state: linkState,
  actionPending,
  confirmingAction,
  onActivate,
  onDisable,
  onReenable,
  onRevoke,
  onCancelConfirm,
}: {
  state: "draft" | "active" | "disabled" | "expired";
  actionPending: ShareLinkActionKind | null;
  confirmingAction: "disable" | "revoke" | "clearPin" | "rotate" | null;
  onActivate: () => void;
  onDisable: () => void;
  onReenable: () => void;
  onRevoke: () => void;
  onCancelConfirm: () => void;
}) {
  const busy = actionPending !== null;
  const stateInfo = STATE_LABELS[linkState] ?? STATE_LABELS.draft;

  return (
    <div style={stack(4)}>
      <div style={row(2)}>
        <span style={fieldLabelStyle}>Status</span>
        <DashboardBadge variant={stateInfo.variant}>{stateInfo.label}</DashboardBadge>
      </div>

      {linkState === "draft" ? (
        <DashboardButton
          variant="primary"
          onClick={onActivate}
          loading={actionPending === "activate"}
          disabled={busy}
        >
          Activate link
        </DashboardButton>
      ) : null}

      {linkState === "disabled" ? (
        <DashboardButton
          variant="secondary"
          onClick={onReenable}
          loading={actionPending === "reenable"}
          disabled={busy}
        >
          Re-enable link
        </DashboardButton>
      ) : null}

      {linkState === "active" ? (
        <ConfirmableActionButton
          label="Disable link"
          confirmLabel="Confirm disable"
          isConfirming={confirmingAction === "disable"}
          loading={actionPending === "disable"}
          disabled={busy}
          variant="secondary"
          onClick={onDisable}
          onCancel={onCancelConfirm}
        />
      ) : null}

      <ConfirmableActionButton
        label="Revoke link"
        confirmLabel="Confirm revoke"
        isConfirming={confirmingAction === "revoke"}
        loading={actionPending === "revoke"}
        disabled={busy}
        variant="danger"
        onClick={onRevoke}
        onCancel={onCancelConfirm}
      />
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "relative",
  ...stack(5),
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: dashboardSpacing[3],
  right: dashboardSpacing[3],
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 36,
  minHeight: 36,
  borderRadius: dashboardRadii.full,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  cursor: "pointer",
};

const headingStyle: CSSProperties = {
  margin: 0,
  paddingRight: dashboardSpacing[8],
  fontSize: dashboardTypography.size.xl,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const subheadingStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.muted,
};

const bodyTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  lineHeight: 1.5,
  color: dashboardColors.text.secondary,
};

const statusRowStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.muted,
};

const errorTextStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  color: dashboardColors.text.muted,
};
