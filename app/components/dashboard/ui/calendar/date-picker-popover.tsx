"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";

import { useHasMounted } from "../../use-has-mounted";
import {
  dashboardBreakpoints,
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardZIndex,
} from "../tokens";

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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(triggerRef.current);
  }, [refs, triggerRef, open]);

  // Escape-to-cancel: never calls onChange, only requests close.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onRequestClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onRequestClose]);

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

  // Scroll locking while the mobile bottom sheet is open.
  useEffect(() => {
    if (!open || !isMobile) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open, isMobile]);

  // Lightweight Tab/Shift+Tab focus containment within the panel. No
  // focus-trap utility exists elsewhere in this codebase, so this is built
  // explicitly here rather than assumed/reused from anywhere.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
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

  return createPortal(content, document.body);
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(
      `(max-width: ${dashboardBreakpoints.mobile - 1}px)`
    );

    function handleChange() {
      setIsMobile(query.matches);
    }

    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
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
