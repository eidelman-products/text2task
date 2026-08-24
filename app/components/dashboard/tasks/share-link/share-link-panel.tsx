"use client";

import { useId, useState, type CSSProperties, type RefObject } from "react";

import { DashboardButton } from "../../ui/button";
import { ResponsiveDialog } from "../../ui/responsive-dialog";
import { row, stack } from "../../ui/styles";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../ui/tokens";
import type {
  ClientProjectProjection,
} from "@/lib/share/client-share-projection-contracts";
import type { SaveShareConfigurationRequest } from "@/lib/share/share-contracts";
import { ClientCommunicationHistoryModal } from "./client-communication-history-modal";
import { ClientProjectView } from "./client-project-view";
import { ShareLinkAccessControls } from "./share-link-access-controls";
import { ShareLinkChannels } from "./share-link-channels";
import { ShareLinkConfigurationEditor } from "./share-link-configuration-editor";
import { ShareLinkQuickShare, type ShareUpdateSubmission } from "./share-link-quick-share";
import { useOwnerShareMessages } from "./use-owner-share-messages";
import { useShareLinkHistory } from "./use-share-link-history";
import type { ShareLinkActionKind, ShareLinkPanelState } from "./use-share-link";

/*
  Owner-UX simplification (real browser defect #3 turn), Phase 7C
  lifecycle-closure correction, and Phase 7D owner-configuration closure:
  this panel has two top-level views -- the short "Share project update"
  quick-share view (ShareLinkQuickShare: draft creation, safe default
  configuration, automatic task grouping, optional PIN/attachments/
  update, save and activation all orchestrated by one call,
  onShareUpdate, behind one primary button) and the post-share "Project
  shared" result view. The result view itself now has three sub-views,
  tracked by `manageView`, all still reached from the SAME "Project
  shared" screen (no separate route/modal-within-a-modal):

    - "channels" (default) -- Copy/Native Share/WhatsApp/Email/Preview,
      Rotate/Disable/Re-enable/Revoke lifecycle management (via
      ShareLinkChannels, unchanged from Phase 7C), plus two entry
      buttons into the other two sub-views below.
    - "config" -- ShareLinkConfigurationEditor: title/status/target-date
      visibility, client-facing subtitle, text direction, exact task and
      Resource selection/grouping, and publishing a new update. This
      component was already fully built and tested in Phase 2B but was
      never reachable from any rendered parent -- confirmed by a
      Phase 7D repo-wide grep before wiring it in, not assumed.
    - "access" -- ShareLinkAccessControls: PIN set/change/remove and
      expiry set/change/remove. Also already fully built and tested
      (Phase 2C) but likewise never reachable.

  Phase 7D reconstructed the intended contract from the cached historical
  master handoff before restoring this: "Optional PIN and optional
  expiry are included in V1, not deferred to hardening" (locked product
  decision) and "Project-level publication controls... titleVisible,
  statusVisible and targetDateVisible... Task mappings... Resource
  mappings support publicLabel, canDownload and display order" were
  BOTH marked COMPLETE at the historical Phase 2B/2C checkpoints. Since
  the live repo genuinely lacked any reachable UI for them (the same
  later "no advanced/settings/kebab-menu escape hatch" simplification
  that dropped Rotate/Disable/Revoke in Phase 7C also silently dropped
  these), this is a real, evidenced V1 gap, not a still-open product
  question -- closed here by wiring the EXISTING, already-tested
  components and hook actions in, not by building a second
  configuration subsystem or a new RPC.

  Rotate/Disable/Re-enable/Revoke are reachable here per Phase 7C's own
  reasoning (the accepted Phase 2A contract: "Active -> copy/reveal
  link, disable or revoke. Disabled -> re-enable or revoke.").

  Sharing a project update from the quick-share view is still meant to
  feel like sending a message, not configuring a system -- "config"/
  "access" are reached only by an explicit, secondary action from the
  post-share result view, never from the quick-share view itself, and
  opening the panel still never calls any mutating endpoint on its own.
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
  // Phase 7C -- owner lifecycle closure (Disable/Re-enable/Revoke) and
  // Rotate (previously built and tested but switched off here entirely
  // -- showRotate={false} below -- by the same later UX simplification
  // that also dropped Disable/Revoke; re-enabled together with them,
  // since the Phase 7 audit's own "Rotate vs Disable vs Revoke clarity"
  // requirement presupposes all three exist side by side). Each of these
  // is the bare mutation only -- this panel owns the confirm-step UI
  // state for Rotate/Revoke itself (see confirmingRotate/confirmingRevoke
  // below) and calls these only once the owner has actually confirmed.
  onRotate: () => void;
  onDisable: () => void;
  onReenable: () => void;
  onRevoke: () => void;
  // Phase 7D -- owner-configuration closure. Bare mutations only, exactly
  // like onRotate/onDisable/onReenable/onRevoke above; this panel owns
  // the confirm-step UI state for clearing an existing PIN (see
  // confirmingClearPin below) and calls onClearPin only once the owner
  // has actually confirmed. onSaveConfiguration/onSetExpiry/onClearExpiry
  // need no confirm step of their own (matching
  // ShareLinkAccessControls/ShareLinkConfigurationEditor's own existing,
  // already-tested design -- clearing a PIN is the only one-click
  // destructive action either component exposes).
  onSaveConfiguration: (request: SaveShareConfigurationRequest) => void;
  onSetPin: (pin: string) => void;
  onClearPin: () => void;
  onSetExpiry: (expiresAtIso: string) => void;
  onClearExpiry: () => void;
  onRetryResources: () => void;
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
  onRotate,
  onDisable,
  onReenable,
  onRevoke,
  onSaveConfiguration,
  onSetPin,
  onClearPin,
  onSetExpiry,
  onClearExpiry,
  onRetryResources,
  onAnalyzeMessage,
}: ShareLinkPanelProps) {
  const headingId = useId();
  const [view, setView] = useState<PanelView>("quick");
  const [messagesOpen, setMessagesOpen] = useState(false);
  // Phase 7C -- two-step confirm UI state for Rotate/Revoke, owned here
  // (not in useShareLink) since it is pure presentation state, never
  // durable/authoritative. Reset on any panel (re)open/project-switch
  // below, and after the corresponding action finishes (success or
  // failure) -- see the actionPending-transition block further down.
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  // Phase 7D -- same pattern, for clearing an existing PIN from the
  // "access" sub-view.
  const [confirmingClearPin, setConfirmingClearPin] = useState(false);
  // Phase 7D -- which sub-view of the "Project shared" result screen is
  // showing. Only meaningful while view === "result"; reset to
  // "channels" on close/reopen exactly like confirmingRotate/
  // confirmingRevoke above.
  const [manageView, setManageView] = useState<"channels" | "config" | "access">("channels");

  const link = state.data?.link ?? null;
  const linkId = link?.id ?? null;

  // Phase 7C -- after a successful Revoke, the authoritative re-fetch
  // that useShareLink always performs comes back with `link: null`
  // (revoked rows are structurally excluded from management reads). The
  // body already correctly falls through to the quick-share entry screen
  // once `link` is null (see the `view === "result" && link` render
  // condition below), but `view` itself never reset on its own -- left
  // uncorrected, a LATER successful Share update would then skip the
  // normal shareUpdate-completion transition's own effect (it only fires
  // on a genuine pending->not-pending edge) and could land back on an
  // already-"result" view with no live link driving it. Adjusted during
  // render, same pattern/rationale as the other reset blocks in this
  // component: once management state has genuinely loaded
  // (`state.data !== null`, not merely still-loading) and confirms no
  // link exists while `view` still says "result", fall back to "quick".
  if (view === "result" && link === null && state.data !== null) {
    setView("quick");
  }

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
      setConfirmingRotate(false);
      setConfirmingRevoke(false);
      setConfirmingClearPin(false);
      setManageView("channels");
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
    const wasRotating = previousActionPending === "rotate";
    const wasRevoking = previousActionPending === "revoke";
    const wasClearingPin = previousActionPending === "clearPin";
    setPreviousActionPending(state.actionPending);
    if (wasSharing && state.actionPending === null && !state.actionError) {
      setView("result");
    }
    // Phase 7C -- once the rotate/revoke action itself has actually
    // finished (success or failure), the two-step confirm UI reverts to
    // its plain, un-confirmed state. On success the button's own
    // underlying gate (canRotate/canRevoke, driven by the freshly
    // reloaded link state) already decides whether it renders again at
    // all; on failure the owner sees the panel's existing generic
    // actionError message and can click the plain button to retry.
    if (wasRotating && state.actionPending === null) {
      setConfirmingRotate(false);
    }
    if (wasRevoking && state.actionPending === null) {
      setConfirmingRevoke(false);
    }
    // Phase 7D -- same pattern for clearing an existing PIN from the
    // "access" sub-view.
    if (wasClearingPin && state.actionPending === null) {
      setConfirmingClearPin(false);
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

  // Phase 7C -- ConfirmableActionButton reuses one onClick for both the
  // initial click (reveal the confirm/cancel pair) and the confirm click
  // itself (actually run the action) -- exactly the pattern Rotate's own
  // (previously unwired) design already established. `busy` guards
  // against a confirm-click firing while a different action is already
  // in flight (the button is also visually `disabled` in that case, but
  // this is the same synchronous belt-and-suspenders discipline
  // useShareLink's own actionInFlightRef already applies one layer
  // down).
  function handleRotateClick() {
    if (busy) return;
    if (!confirmingRotate) {
      setConfirmingRotate(true);
      return;
    }
    onRotate();
  }

  function handleRevokeClick() {
    if (busy) return;
    if (!confirmingRevoke) {
      setConfirmingRevoke(true);
      return;
    }
    onRevoke();
  }

  function handleClearPinClick() {
    if (busy) return;
    if (!confirmingClearPin) {
      setConfirmingClearPin(true);
      return;
    }
    onClearPin();
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
            {/* Phase 7C fix: matches the body's own actual render
                condition (view === "result" && link) exactly, not view
                alone -- previously, after Revoke made `link` null, `view`
                itself never reset, so this heading kept saying "Project
                shared" even though the body had already correctly fallen
                back to the quick-share form below. */}
            {view === "result" && link ? "Project shared" : "Share with client"}
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
        ) : view === "result" && link && manageView === "config" && state.project ? (
          <div style={stack(3)}>
            <BackToShareOptionsButton onClick={() => setManageView("channels")} disabled={busy} />
            <ShareLinkConfigurationEditor
              link={link}
              mappedTasks={state.data?.mappedTasks ?? []}
              mappedResources={state.data?.mappedResources ?? []}
              currentUpdate={state.data?.currentUpdate ?? null}
              project={state.project}
              resources={state.resources}
              resourcesLoading={state.resourcesLoading}
              resourcesError={state.resourcesError}
              onRetryResources={onRetryResources}
              pending={state.actionPending === "saveConfiguration"}
              disabled={busy}
              onSave={onSaveConfiguration}
            />
          </div>
        ) : view === "result" && link && manageView === "access" ? (
          <div style={stack(3)}>
            <BackToShareOptionsButton onClick={() => setManageView("channels")} disabled={busy} />
            <ShareLinkAccessControls
              link={link}
              disabled={busy}
              actionPending={state.actionPending}
              confirmingClearPin={confirmingClearPin}
              onSetPin={onSetPin}
              onRequestClearPin={handleClearPinClick}
              onCancelClearPinConfirm={() => setConfirmingClearPin(false)}
              onSetExpiry={onSetExpiry}
              onClearExpiry={onClearExpiry}
            />
          </div>
        ) : view === "result" && link ? (
          <div style={stack(4)}>
            <ShareLinkChannels
              linkState={link.state}
              actionPending={state.actionPending}
              disabled={busy}
              copyStatus={state.copyStatus}
              confirmingRotate={confirmingRotate}
              onCopyLink={onCopyLink}
              onNativeShare={onNativeShare}
              onWhatsApp={onWhatsApp}
              onEmail={onEmail}
              onRequestRotate={handleRotateClick}
              onCancelRotateConfirm={() => setConfirmingRotate(false)}
              onOpenPreview={onOpenPreview}
              onDisable={onDisable}
              onReenable={onReenable}
              confirmingRevoke={confirmingRevoke}
              onRequestRevoke={handleRevokeClick}
              onCancelRevokeConfirm={() => setConfirmingRevoke(false)}
            />
            <div style={row(2)}>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setManageView("config")}
                disabled={busy}
              >
                Edit what client sees
              </DashboardButton>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setManageView("access")}
                disabled={busy}
              >
                Manage access
              </DashboardButton>
            </div>
          </div>
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

// Phase 7D -- the sole navigation affordance out of "config"/"access"
// back to the "Project shared" result screen's default sub-view.
// Disabled while an action is in flight, matching every other control's
// existing `busy` convention.
function BackToShareOptionsButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <DashboardButton variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      Back to share options
    </DashboardButton>
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
