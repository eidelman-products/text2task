"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { DashboardButton } from "../../ui/button";
import { stack } from "../../ui/styles";
import { dashboardColors, dashboardTypography } from "../../ui/tokens";
import { ConfirmableActionButton } from "./share-link-confirmable-button";
import type { ShareLinkActionKind } from "./use-share-link";

/*
  Phase 2C -- Copy / Native Share / WhatsApp / Rotate.

  Copy/Native Share/WhatsApp all resolve through the same authenticated
  reveal path (public.reveal_share_link_secret), which only ever succeeds
  for state = 'active' -- so, matching that real backend capability
  matrix rather than merely hiding a button that would still 409, none of
  these three render at all outside the active state. Rotation is
  restricted to active/disabled by rotate_share_link_secret itself, so it
  only renders for those two states.

  NATIVE SHARE HYDRATION SAFETY: `navigator.share` support is NOT read
  during render. Reading it synchronously in the render body would make
  the very first render (server-rendered HTML, and this component's own
  first client render if it were ever hydrated rather than mounted fresh)
  depend on an environment-specific browser capability -- deterministic
  only by accident. Instead, `nativeShareSupported` starts `false` on
  every render (server and first client render alike) and is updated by
  an effect that only ever runs after mount, on the client -- the
  standard "detect client-only capability after mount" pattern, with no
  new dependency. See share-link-channels.test.tsx's dedicated
  react-dom/server test for the proof.

  WHATSAPP POPUP SAFETY: `window.open` is called SYNCHRONOUSLY inside the
  click handler, still within the click's own user-gesture context,
  BEFORE the async reveal begins -- `whatsapp`'s hook action later
  navigates that already-open window once reveal resolves (or closes it
  on failure), rather than ever calling `window.open` itself after an
  await, which many browsers would block as no longer a trusted gesture.
  Critically, the pre-open call does NOT pass the `noopener` (or
  `noreferrer`) window-feature string: per actual browser behavior
  (Chromium, Firefox, WebKit), `window.open` with `noopener` specified
  ALWAYS returns `null` -- there would be no WindowProxy left to navigate
  later, silently defeating the entire pre-open strategy. Instead, the
  opener relationship is severed by setting `popup.opener = null`
  directly on the returned reference, which does not affect this page's
  own ability to keep and later navigate that reference.

  WHATSAPP REENTRANCY: a rapid second click must not open a second blank
  tab even before React has re-rendered `disabled` -- `useShareLink`'s
  own `actionInFlightRef` guard lives inside the hook's `whatsapp`
  action, which only runs AFTER this component's click handler has
  already synchronously called `window.open`, so it cannot protect
  against a second `window.open` call by itself. `whatsappInFlightRef`
  below is a second, component-local synchronous ref guard -- checked
  and set at the very top of the click handler, exactly mirroring the
  hook's own ref-guard pattern -- specifically to prevent a second popup
  context from ever being created, independent of and in addition to the
  hook's own guard against a second reveal/navigation.
*/

export type ShareLinkChannelsProps = {
  linkState: "draft" | "active" | "disabled" | "expired";
  actionPending: ShareLinkActionKind | null;
  disabled: boolean;
  copyStatus: "idle" | "copied" | "failed";
  confirmingRotate: boolean;
  onCopyLink: () => void;
  onNativeShare: () => void;
  onWhatsApp: (popup: Window | null) => void;
  // Objective B: mailto: only -- see use-share-link.ts's emailLink for
  // why this never opens a popup/gesture-sensitive window the way
  // WhatsApp does (a plain navigation-scheme href, not a new tab).
  onEmail: () => void;
  onRequestRotate: () => void;
  onCancelRotateConfirm: () => void;
  onOpenPreview: () => void;
  // Phase 7C -- closes the owner-lifecycle UI gap the Phase 7 audit
  // found: Disable/Re-enable/Revoke were part of the accepted Phase 2A
  // product contract ("Active -> copy/reveal link, disable or revoke.
  // Disabled -> re-enable or revoke.") but were never wired into this
  // panel after a later UX simplification also (incidentally) switched
  // Rotate off here. Disable/Re-enable are plain, un-confirmed actions
  // (temporary, reversible with a single further click) -- Revoke uses
  // the same ConfirmableActionButton pattern as Rotate, but with
  // distinctly stronger, "permanent/cannot be undone" wording, since
  // unlike Rotate (which keeps the SHARE usable under a new secret) or
  // Disable (trivially reversible), Revoke ends this share link for
  // good.
  onDisable: () => void;
  onReenable: () => void;
  confirmingRevoke: boolean;
  onRequestRevoke: () => void;
  onCancelRevokeConfirm: () => void;
  // Objective B: ShareLinkPanel now renders this component in two
  // different secondary views -- the post-share "result" screen (Copy/
  // Native Share/WhatsApp/Email/Preview; no Rotate, which is a "Manage
  // link" concern) and the "Manage link" view (Preview/Rotate only, no
  // sharing channels -- those belong to the moment right after a share,
  // not general link management). Both default to true so every
  // pre-existing call site (and every test that does not pass these)
  // keeps the original, full-channel-set behavior unchanged.
  showChannelButtons?: boolean;
  showRotate?: boolean;
  // Phase 7C -- defaults to true, matching showRotate's own default, so
  // every pre-existing call site/test keeps its original behavior unless
  // it explicitly opts in or out.
  showLifecycleControls?: boolean;
};

const ROTATE_WARNING =
  "Rotating the link will immediately invalidate the previously shared client link. Anyone using the old link will lose access.";

const REVOKE_WARNING =
  "Revoking this link permanently ends this share and cannot be undone. Anyone using it will immediately lose access. You'll need to create a new link to share with this client again.";

export function ShareLinkChannels({
  linkState,
  actionPending,
  disabled,
  copyStatus,
  confirmingRotate,
  onCopyLink,
  onNativeShare,
  onWhatsApp,
  onEmail,
  onRequestRotate,
  onCancelRotateConfirm,
  onOpenPreview,
  onDisable,
  onReenable,
  confirmingRevoke,
  onRequestRevoke,
  onCancelRevokeConfirm,
  showChannelButtons = true,
  showRotate = true,
  showLifecycleControls = true,
}: ShareLinkChannelsProps) {
  const canRevealForSharing = linkState === "active" && showChannelButtons;
  const canRotate = (linkState === "active" || linkState === "disabled") && showRotate;
  // Phase 7C -- mirrors canRotate's own state gating exactly (disable_share_link
  // only succeeds from 'active'; reenable_share_link only from 'disabled';
  // revoke_share_link succeeds from 'active' or 'disabled' -- matching the
  // real server contract, not merely hiding a button that would still 409).
  const canDisable = linkState === "active" && showLifecycleControls;
  const canReenable = linkState === "disabled" && showLifecycleControls;
  const canRevoke = (linkState === "active" || linkState === "disabled") && showLifecycleControls;
  // Preview is a configuration-inspection capability, not a public-access
  // one -- it never calls reveal, so it is available for every state this
  // component ever renders for (draft/active/disabled/expired; revoked
  // links are already structurally excluded upstream, reading back as
  // `link: null`), unlike Copy/Native Share/WhatsApp/Rotate above.

  // Deterministic on every server render and every first client render:
  // always false until the post-mount effect below runs. See this file's
  // header comment.
  const [nativeShareSupported, setNativeShareSupported] = useState(false);

  useEffect(() => {
    setNativeShareSupported(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  const whatsappInFlightRef = useRef(false);

  // Once the surrounding action genuinely completes (disabled flips back
  // to false), this component's own local guard is released so a later,
  // legitimate click can open a fresh popup.
  useEffect(() => {
    if (!disabled) {
      whatsappInFlightRef.current = false;
    }
  }, [disabled]);

  function handleWhatsAppClick() {
    if (whatsappInFlightRef.current || disabled) {
      return;
    }
    whatsappInFlightRef.current = true;

    // No `noopener`/`noreferrer` feature here -- see this file's header
    // comment for why that would make `popup` always null.
    const popup = window.open("about:blank", "_blank");
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        // Some environments may disallow this assignment -- non-fatal,
        // the popup reference itself remains fully usable for
        // navigation either way.
      }
    }

    onWhatsApp(popup);
  }

  return (
    <div style={stack(4)}>
      <SectionHeading title="Link" />

      <DashboardButton
        variant="secondary"
        onClick={onOpenPreview}
        loading={actionPending === "preview"}
        disabled={disabled}
      >
        Preview
      </DashboardButton>

      {canRevealForSharing ? (
        <div style={stack(2)}>
          <DashboardButton
            variant="primary"
            onClick={onCopyLink}
            loading={actionPending === "copyLink"}
            disabled={disabled}
          >
            {copyStatus === "copied" ? "Link copied" : "Copy client link"}
          </DashboardButton>
          {copyStatus === "failed" ? (
            <p style={errorTextStyle}>
              Could not copy the link automatically. Please try again.
            </p>
          ) : null}

          {nativeShareSupported ? (
            <DashboardButton
              variant="secondary"
              onClick={onNativeShare}
              loading={actionPending === "nativeShare"}
              disabled={disabled}
            >
              Share...
            </DashboardButton>
          ) : (
            <p style={mutedTextStyle}>
              Native sharing is not available in this browser. Use Copy link instead.
            </p>
          )}

          <DashboardButton
            variant="secondary"
            onClick={handleWhatsAppClick}
            loading={actionPending === "whatsapp"}
            disabled={disabled}
          >
            Share via WhatsApp
          </DashboardButton>

          <DashboardButton
            variant="secondary"
            onClick={onEmail}
            loading={actionPending === "email"}
            disabled={disabled}
          >
            Email
          </DashboardButton>
        </div>
      ) : null}

      {canRotate ? (
        <ConfirmableActionButton
          label="Rotate link"
          confirmLabel="Confirm rotate"
          isConfirming={confirmingRotate}
          loading={actionPending === "rotate"}
          disabled={disabled}
          variant="danger"
          onClick={onRequestRotate}
          onCancel={onCancelRotateConfirm}
          warning={ROTATE_WARNING}
        />
      ) : null}

      {canDisable || canReenable || canRevoke ? (
        <div style={stack(2)}>
          <SectionHeading title="Manage link" />

          {canDisable ? (
            <DashboardButton
              variant="secondary"
              onClick={onDisable}
              loading={actionPending === "disable"}
              disabled={disabled}
            >
              Disable link
            </DashboardButton>
          ) : null}

          {canReenable ? (
            <DashboardButton
              variant="secondary"
              onClick={onReenable}
              loading={actionPending === "reenable"}
              disabled={disabled}
            >
              Re-enable link
            </DashboardButton>
          ) : null}

          {canRevoke ? (
            <ConfirmableActionButton
              label="Revoke link"
              confirmLabel="Confirm revoke"
              isConfirming={confirmingRevoke}
              loading={actionPending === "revoke"}
              disabled={disabled}
              variant="danger"
              onClick={onRequestRevoke}
              onCancel={onCancelRevokeConfirm}
              warning={REVOKE_WARNING}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h3 style={sectionTitleStyle}>{title}</h3>;
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.md,
  fontWeight: dashboardTypography.weight.semibold,
  color: dashboardColors.text.primary,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.status.red,
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  fontSize: dashboardTypography.size.sm,
  color: dashboardColors.text.muted,
};
