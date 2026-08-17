"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";

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
import { ClientProjectView } from "./client-project-view";
import { ShareLinkChannels } from "./share-link-channels";
import { ShareLinkQuickShare, type ShareUpdateSubmission } from "./share-link-quick-share";
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

  // A fresh open always starts back at the quick-share view.
  useEffect(() => {
    if (!state.isOpen) {
      setView("quick");
    }
  }, [state.isOpen, state.projectId]);

  // Detects the exact pending("shareUpdate") -> not-pending transition
  // for a successful Share update and shows the result screen. A ref
  // (not state) tracks the previous actionPending value so this only
  // fires once per completed shareUpdate, not on every idle render.
  const previousActionPendingRef = useRef<ShareLinkActionKind | null>(null);
  useEffect(() => {
    const wasSharing = previousActionPendingRef.current === "shareUpdate";
    previousActionPendingRef.current = state.actionPending;
    if (wasSharing && state.actionPending === null && !state.actionError) {
      setView("result");
    }
  }, [state.actionPending, state.actionError]);

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
