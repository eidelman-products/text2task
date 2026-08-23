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
import { useShareLinkHistory } from "./use-share-link-history";
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
  /** PHASE 6B -- explicit, owner-initiated "Analyze as client update"
   * hand-off. Implemented one level up (wherever this panel's own
   * caller already holds the existing Client Update review
   * orchestration -- see that implementation's own doc comment for why
   * it cannot live inside this panel: opening the existing review modal
   * requires a full TaskProjectGroup this panel never receives, only a
   * project id). Called with the link id Client Messages is currently
   * operating against (the same messagesLinkId this panel itself
   * resolves -- active/manageable link when one exists, otherwise the
   * resolved historical one) and the target message id. */
  onAnalyzeMessage: (
    shareLinkId: string,
    messageId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
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
  onAnalyzeMessage,
}: ShareLinkPanelProps) {
  const headingId = useId();
  const [view, setView] = useState<PanelView>("quick");
  const [messagesOpen, setMessagesOpen] = useState(false);

  const link = state.data?.link ?? null;
  const linkId = link?.id ?? null;

  // PHASE 5F REAL PREVIEW DEFECT FIX -- get_share_link_management_state
  // (the RPC behind state.data.link) deliberately excludes revoked links
  // from what it calls "managed" -- correct for its own "what can the
  // owner activate/reconfigure right now" purpose, but that previously
  // left the owner with NO way to reopen Client Communication History
  // once their only link was revoked (linkId above becomes null, so the
  // old "Client messages" entry point, gated on `link`, disappeared
  // entirely even though the link's real message history was still
  // fully retained). This second, isolated hook resolves that fallback
  // ONLY when there is no active/manageable link -- never replacing or
  // duplicating the primary management-state call, never fetched when
  // an active link already exists. See use-share-link-history.ts's own
  // doc comment for the full rationale and resolveMostRecentShareLink's
  // doc comment (share-messages-repository.server.ts) for why the
  // selection is deterministic, not arbitrary.
  // Gated on `state.data !== null` (the management-state call has
  // actually resolved at least once) rather than `!state.isLoading` --
  // a more DIRECT signal of "we have real data to read `link` from",
  // and one fewer accidental dependency on a flag whose only true
  // purpose is the panel's own top-level loading spinner, not this
  // fallback's own trigger condition.
  const historyEnabled = state.isOpen && state.data !== null && linkId === null;
  const linkHistory = useShareLinkHistory(state.projectId, historyEnabled);
  const historicalLinkId =
    linkHistory.state.status === "loaded" ? linkHistory.state.linkId : null;
  const historicalLinkState =
    linkHistory.state.status === "loaded" ? linkHistory.state.state : null;

  // The single link id Client Messages should operate against: the
  // active/manageable link when one exists, otherwise the resolved
  // historical (typically revoked) one. `isRevokedMessagesLink` gates
  // Reply specifically (a reply on a revoked link would be accepted by
  // the RPC -- it has no state check, only ownership -- but could never
  // reach a client, since public access is already denied for a revoked
  // link; see the Phase 5F doc's own "message actions after revoke"
  // section for the full audit). Status changes remain available on a
  // historical link -- they are purely the owner's own workflow
  // bookkeeping and were never client-visible in the first place.
  const messagesLinkId = linkId ?? historicalLinkId;
  const isHistoricalMessagesLink = linkId === null && historicalLinkId !== null;
  const isRevokedMessagesLink = historicalLinkState === "revoked";

  // Phase 5D unread badge -- Option A from the Phase 5D doc's own "unread
  // strategy" section: a single, isolated fetch of the SAME owner
  // messages GET the communication view itself uses, triggered each time
  // the panel opens with a real link (never on an interval, never
  // shared/cached with the communication view's own separate fetch when
  // it later opens -- see use-owner-share-messages.ts's own doc comment
  // for why two independent instances is the deliberate, simpler choice).
  // Phase 5F: now keyed on messagesLinkId (active OR historical) so the
  // badge also reflects a historical link's own unread count.
  const badgeMessages = useOwnerShareMessages(
    messagesLinkId,
    state.isOpen && messagesLinkId !== null
  );
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

        {!state.isLoading && !state.loadError && !state.previewOpen && !messagesOpen && messagesLinkId ? (
          <button
            type="button"
            onClick={() => setMessagesOpen(true)}
            disabled={busy}
            style={messagesEntryButtonStyle}
          >
            <span style={messagesEntryLabelStyle}>
              <span>Client messages</span>
              {isHistoricalMessagesLink ? (
                <span style={historicalCaptionStyle}>From a previous share</span>
              ) : null}
            </span>
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
        ) : messagesOpen && messagesLinkId ? (
          <ClientCommunicationHistoryModal
            shareLinkId={messagesLinkId}
            isHistorical={isHistoricalMessagesLink}
            canReply={!isRevokedMessagesLink}
            onAnalyzeMessage={(messageId) => onAnalyzeMessage(messagesLinkId, messageId)}
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

const messagesEntryLabelStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
};

const historicalCaptionStyle: CSSProperties = {
  fontSize: dashboardTypography.size.xs,
  fontWeight: dashboardTypography.weight.regular,
  color: dashboardColors.text.muted,
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
