"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";

import { useHasMounted } from "../../use-has-mounted";
import { acquireDocumentScrollLock } from "../document-scroll-lock";
import { getFocusableElements } from "../focus-trap";
import { useNestedOverlayHost } from "../responsive-dialog";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardZIndex,
} from "../tokens";
import { useIsMobile } from "../use-is-mobile";

/*
  Anchored popover (desktop) / bottom sheet (mobile) container for a date
  picker. This component owns positioning, open/close lifecycle, Escape,
  click-outside, a lightweight Tab focus containment, scroll locking (sheet
  only), and focus return to the trigger -- it knows nothing about calendars,
  dates, or DateOnly; its `children` is opaque content (see date-field.tsx,
  which supplies the Calendar + Today/Clear footer as children).

  Adapted from this codebase's existing createPortal + useHasMounted +
  manual-Escape-listener modal convention (see
  app/components/dashboard/tasks/project-updates/project-update-shell.tsx),
  but deliberately does NOT dim the whole page on desktop (a popover should
  not behave like a full modal) and does NOT set aria-modal="true".

  Positioning uses @floating-ui/react's `useFloating` with `autoUpdate` +
  `flip` + `shift` middleware for viewport-collision handling and
  repositioning on scroll/resize (verified against the installed
  @floating-ui/react 0.27 API in node_modules).
*/

export type DatePickerPopoverProps = {
  open: boolean;
  onRequestClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  "aria-label": string;
  children: ReactNode;
};

export function DatePickerPopover({
  open,
  onRequestClose,
  triggerRef,
  "aria-label": ariaLabel,
  children,
}: DatePickerPopoverProps) {
  const isMounted = useHasMounted();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const nestedOverlay = useNestedOverlayHost();
  const nestedRegistrationId = useId();

  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(triggerRef.current);
  }, [refs, triggerRef, open]);

  // Escape-to-cancel, standalone only: default bubble phase, unchanged from
  // before nesting existed. When nested, ownership moves to the capture-
  // phase listener below instead (event-phase separation, not effect
  // ordering, is what makes a nested Escape deterministically win).
  useEffect(() => {
    if (!open || nestedOverlay !== null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onRequestClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onRequestClose, nestedOverlay]);

  // Nested-mode only: registration and capture-phase Escape ownership are
  // established together, in a useLayoutEffect (before paint) rather than
  // useEffect, so the outer ResponsiveDialog's own Escape/backdrop/focus-
  // trap suppression is already active by the time this popover is actually
  // visible to the user -- no frame where it's on screen but unregistered.
  useLayoutEffect(() => {
    if (!open || nestedOverlay === null || nestedOverlay.hostElement === null) {
      return;
    }

    nestedOverlay.registerNestedOverlay(nestedRegistrationId);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onRequestClose();
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      nestedOverlay.unregisterNestedOverlay(nestedRegistrationId);
    };
  }, [open, nestedOverlay, nestedRegistrationId, onRequestClose]);

  // Focus return: whenever `open` transitions from true -> false (any close
  // path -- Escape, click-outside, or a commit from the caller), return
  // focus to the exact element that opened the popover.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, triggerRef]);

  // Scroll locking while the mobile bottom sheet is open. Standalone keeps
  // its own local capture/restore, unchanged. Nested uses the shared,
  // reference-counted utility instead: the outer ResponsiveDialog may close
  // (programmatically, or via unmount from navigation) while this popover is
  // still open, and two independent local capture/restore effects aren't
  // safe against that release order -- see document-scroll-lock.ts.
  useEffect(() => {
    if (!open || !isMobile) return;

    if (nestedOverlay !== null) {
      const lock = acquireDocumentScrollLock();
      return () => lock.release();
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open, isMobile, nestedOverlay]);

  // Lightweight Tab/Shift+Tab focus containment within the panel.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (
          active === first ||
          !(active instanceof Node) ||
          !panelRef.current.contains(active)
        ) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!isMounted || !open) {
    return null;
  }

  // Nested but the ResponsiveDialog host <div> hasn't committed yet (a
  // brief window on the first render or two): wait, never fall back to
  // document.body -- that would put this content outside the sibling-host
  // stacking structure the nesting contract depends on.
  let portalTarget: HTMLElement;
  if (nestedOverlay === null) {
    portalTarget = document.body;
  } else if (nestedOverlay.hostElement === null) {
    return null;
  } else {
    portalTarget = nestedOverlay.hostElement;
  }

  function handleOverlayMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      // The overlay itself isn't focusable, so a browser's (and jsdom's)
      // default mousedown behavior is to shift focus to <body>. Left
      // unchecked, that default action wins the race against the focus-
      // return effect below. preventDefault() here blocks only that focus
      // shift (mousedown's other effects, like our own onRequestClose call,
      // are unaffected), so the trigger reliably keeps/regains focus.
      event.preventDefault();
      onRequestClose();
    }
  }

  function setPanelRef(node: HTMLDivElement | null) {
    panelRef.current = node;
    refs.setFloating(node);
  }

  const content = isMobile ? (
    <div
      style={sheetOverlayStyle}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={setPanelRef}
        role="dialog"
        aria-label={ariaLabel}
        style={sheetPanelStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  ) : (
    <div style={desktopOverlayStyle} onMouseDown={handleOverlayMouseDown}>
      <div
        ref={setPanelRef}
        role="dialog"
        aria-label={ariaLabel}
        style={{ ...floatingStyles, ...desktopPanelStyle }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
}

const desktopOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: dashboardZIndex.popover,
  background: "transparent",
};

const desktopPanelStyle: CSSProperties = {
  zIndex: dashboardZIndex.popover,
  background: dashboardColors.background.surface,
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.xl,
  boxShadow: dashboardShadows.lg,
  padding: dashboardSpacing[4],
  minWidth: 300,
};

const sheetOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: dashboardZIndex.popover,
  background: dashboardColors.background.overlay,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

const sheetPanelStyle: CSSProperties = {
  position: "relative",
  zIndex: dashboardZIndex.popover,
  width: "100%",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  background: dashboardColors.background.surface,
  borderTopLeftRadius: dashboardRadii["2xl"],
  borderTopRightRadius: dashboardRadii["2xl"],
  boxShadow: dashboardShadows.lg,
  padding: dashboardSpacing[4],
  paddingBottom: dashboardSpacing[6],
};
