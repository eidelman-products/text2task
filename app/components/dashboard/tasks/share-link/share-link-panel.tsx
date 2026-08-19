"use client";

import { useId, useState, type CSSProperties, type RefObject } from "react";

import { DashboardButton } from "../../ui/button";
import { ResponsiveDialog } from "../../ui/responsive-dialog";
import { stack } from "../../ui/styles";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../ui/tokens";
import type { ClientProjectProjection } from "@/lib/share/client-share-projection-contracts";
import { ClientCommunicationHistoryModal } from "./client-communication-history-modal";
import { ClientProjectView } from "./client-project-view";
import { ShareLinkChannels } from "./share-link-channels";
import { ShareLinkQuickShare, type ShareUpdateSubmission } from "./share-link-quick-share";
import { useOwnerShareMessages } from "./use-owner-share-messages";
import type { ShareLinkActionKind, ShareLinkPanelState } from "./use-share-link";

/*
  Final owner-UX simplification (real browser defect #3 turn): this
  panel now has exactly two states -- the short "Share project update"
  quick-share view (ShareLinkQuickShare: draft creation, safe default
  configuration, automatic task grouping, optional PIN/attachments/
  update, save and activation all orchestrated by one call,
  onShareUpdate, behind one primary button) and the post-share "Project
  shared" result view (Copy/Native Share/WhatsApp/Email/Preview via
  ShareLinkChannels, showRotate=false). There is no other entry point
  inside this panel -- no "Edit what client sees", no "Manage link", no
  advanced/settings/kebab-menu escape hatch of any kind. Sharing a
  project update is meant to feel like sending a message, not
  configuring a system.

  This does NOT delete any backend capability: activate/disable/
  re-enable/revoke/rotate/PIN/expiry/manual task-and-Resource mapping
  all remain fully implemented in useShareLink and in
  share-link-configuration-editor.tsx/share-link-access-controls.tsx --
  they are simply not wired into this panel's props anymore, since
  nothing here calls them. Opening the panel itself still never calls
  any mutating endpoint (only the read-only management-state/resources
  loads it always performed).
*/

export type ShareLinkPanelProps = {
  state: ShareLinkPanelState;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRetry: () => void;
  onCopyLink: () => void;
  onNativeShare: () => void;
  onWhatsApp: (popup: Window | null) => void;
  onEmail: () => void;
  onShareUpdate: (submission: ShareUpdateSubmission) => void;
  onOpenPreview: () => void;
  onClosePreview: () => void;
};

type PanelView = "quick" | "result";

export function ShareLinkPanel({
  state,
  triggerRef,
  onClose,
  onRetry,
  onCopyLink,
  onNativeShare,
  onWhatsApp,
  onEmail,
  onShareUpdate,
  onOpenPreview,
  onClosePreview,
}: ShareLinkPanelProps) {
  const headingId = useId();
  const [view, setView] = useState<PanelView>("quick");
  const [messagesOpen, setMessagesOpen] = useState(false);

  const linkId = state.data?.link?.id ?? null;

  // Phase 5D unread badge -- Option A from the Phase 5D doc's own "unread
  // strategy" section: a single, isolated fetch of the SAME owner
  // messages GET the communication view itself uses, triggered each time
  // the panel opens with a real link (never on an interval, never
  // shared/cached with the communication view's own separate fetch when
  // it later opens -- see use-owner-share-messages.ts's own doc comment
  // for why two independent instances is the deliberate, simpler choice).
  const badgeMessages = useOwnerShareMessages(linkId, state.isOpen && linkId !== null);
  const unreadCount = badgeMessages.state.status === "loaded" ? badgeMessages.state.unreadCount : null;

  // A fresh open always starts back at the quick-share view. Adjusted
  // during render rather than in an effect -- mirrors
  // project-update-history-modal.tsx's own established "reset on
  // (re)open" pattern exactly (React explicitly supports calling a
  // setState setter while rendering to respond to a prop change,
  // avoiding the extra committed render pass an effect would cause).
  const [resetSnapshot, setResetSnapshot] = useState({
    isOpen: state.isOpen,
    projectId: state.projectId,
  });

  if (resetSnapshot.isOpen !== state.isOpen || resetSnapshot.projectId !== state.projectId) {
    setResetSnapshot({ isOpen: state.isOpen, projectId: state.projectId });

    if (!state.isOpen) {
      setView("quick");
      setMessagesOpen(false);
    }
  }

  // Detects the exact pending("shareUpdate") -> not-pending transition
  // for a successful Share update and shows the result screen. Adjusted
  // during render (see the resetSnapshot block above for the same
  // rationale) rather than in an effect: `previousActionPending` is now
  // state, not a ref, and is only updated -- together with the
  // transition check -- when it actually differs from the latest
  // `state.actionPending`, so this still fires exactly once per
  // completed shareUpdate, never on every idle render.
  const [previousActionPending, setPreviousActionPending] = useState<ShareLinkActionKind | null>(
    state.actionPending
  );

  if (previousActionPending !== state.actionPending) {
    const wasSharing = previousActionPending === "shareUpdate";
    setPreviousActionPending(state.actionPending);
    if (wasSharing && state.actionPending === null && !state.actionError) {
      setView("result");
    }
  }

  if (!state.isOpen) {
    return null;
  }

  const busy = state.actionPending !== null;
  const link = state.data?.link ?? null;
  const projectTitle = state.project?.projectTitle || "this project";

  function handleRequestClose() {
    if (busy) return;
    onClose();
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
            {view === "result" ? "Project shared" : "Share with client"}
          </h2>
          <p style={subheadingStyle}>{projectTitle}</p>
        </div>

        {!state.isLoading && !state.loadError && !state.previewOpen && !messagesOpen && link ? (
          <button
            type="button"
            onClick={() => setMessagesOpen(true)}
            disabled={busy}
            style={messagesEntryButtonStyle}
          >
            <span>Client messages</span>
            {unreadCount !== null && unreadCount > 0 ? (
              <span style={unreadBadgeStyle}>{unreadCount}</span>
            ) : null}
          </button>
        ) : null}

        {state.isLoading ? (
          <div style={statusRowStyle}>Loading share link status...</div>
        ) : state.loadError ? (
          <div style={stack(3)}>
            <div style={errorTextStyle}>{state.loadError}</div>
            <DashboardButton variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </DashboardButton>
          </div>
        ) : state.previewOpen ? (
          <PreviewView
            loading={state.actionPending === "preview"}
            error={
              state.actionPending !== "preview" && !state.previewData ? state.actionError : null
            }
            data={state.previewData}
            onClose={onClosePreview}
          />
        ) : messagesOpen && link ? (
          <ClientCommunicationHistoryModal
            shareLinkId={link.id}
            onClose={() => {
              setMessagesOpen(false);
              // Runtime defect fix: the badge hook and the modal's own
              // hook are two deliberately isolated
              // useOwnerShareMessages instances (see that hook's own
              // doc comment) -- a status mutation made inside the modal
              // updates ITS state, never the badge's. Refetching the
              // badge's server truth here, exactly at the moment the
              // owner leaves the communication view, is what makes the
              // panel's own count current again without requiring a
              // full panel close/reopen. Deliberately unconditional
              // (not gated on "did a mutation actually happen") so it
              // also covers any future owner action inside the modal
              // that could change the unread count -- one extra GET on
              // an explicit user action is not polling.
              void badgeMessages.refetch();
            }}
          />
        ) : view === "result" && link ? (
          <ShareLinkChannels
            linkState={link.state}
            actionPending={state.actionPending}
            disabled={busy}
            copyStatus={state.copyStatus}
            confirmingRotate={false}
            onCopyLink={onCopyLink}
            onNativeShare={onNativeShare}
            onWhatsApp={onWhatsApp}
            onEmail={onEmail}
            onRequestRotate={() => {}}
            onCancelRotateConfirm={() => {}}
            onOpenPreview={onOpenPreview}
            showRotate={false}
          />
        ) : state.project ? (
          <ShareLinkQuickShare
            link={link}
            mappedTasks={state.data?.mappedTasks ?? []}
            mappedResources={state.data?.mappedResources ?? []}
            project={state.project}
            resources={state.resources}
            resourcesLoading={state.resourcesLoading}
            pending={state.actionPending === "shareUpdate"}
            disabled={busy}
            onShare={onShareUpdate}
          />
        ) : null}

        {state.actionError ? (
          <div style={errorTextStyle} role="alert">
            {state.actionError}
          </div>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

function PreviewView({
  loading,
  error,
  data,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  data: ClientProjectProjection | null;
  onClose: () => void;
}) {
  return (
    <div style={stack(3)}>
      <div style={previewFrameStyle}>
        <div style={previewBannerStyle}>
          <div style={stack(1)}>
            <span style={previewBannerTitleStyle}>Client preview</span>
            <span style={previewBannerSubtitleStyle}>
              This is what your client will see. No client link or secret is
              used to generate this preview.
            </span>
          </div>
          <DashboardButton variant="ghost" size="sm" onClick={onClose}>
            Close preview
          </DashboardButton>
        </div>

        {loading ? (
          <div style={statusRowStyle}>Loading preview...</div>
        ) : error ? (
          <div style={errorTextStyle}>{error}</div>
        ) : data ? (
          <div style={previewBodyStyle}>
            <ClientProjectView projection={data} />
          </div>
        ) : null}
      </div>
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

const statusRowStyle: CSSProperties = {
  fontSize: dashboardTypography.size.md,
  color: dashboardColors.text.muted,
};

const errorTextStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};

const previewFrameStyle: CSSProperties = {
  border: `2px solid ${dashboardColors.primary[500]}`,
  borderRadius: dashboardRadii.xl,
  overflow: "hidden",
};

const previewBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: dashboardSpacing[3],
  padding: dashboardSpacing[3],
  background: dashboardColors.primary[50],
  borderBottom: `1px solid ${dashboardColors.primary[100]}`,
};

const previewBannerTitleStyle: CSSProperties = {
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.black,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: dashboardColors.primary[700],
};

const previewBannerSubtitleStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  color: dashboardColors.primary[700],
};

const previewBodyStyle: CSSProperties = {
  maxHeight: "60vh",
  overflowY: "auto",
};

const messagesEntryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: dashboardSpacing[2],
  alignSelf: "start",
  padding: "6px 12px",
  borderRadius: dashboardRadii.lg,
  border: `1px solid ${dashboardColors.border.subtle}`,
  background: dashboardColors.background.surface,
  color: dashboardColors.text.secondary,
  fontSize: dashboardTypography.size.sm,
  fontWeight: dashboardTypography.weight.medium,
  cursor: "pointer",
};

const unreadBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: dashboardRadii.full,
  background: dashboardColors.status.red,
  color: dashboardColors.text.inverse,
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.bold,
};
