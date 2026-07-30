"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { useHasMounted } from "../use-has-mounted";
import { acquireDocumentScrollLock } from "./document-scroll-lock";
import { getFocusableElements, matchesFocusableSelector } from "./focus-trap";
import {
  dashboardColors,
  dashboardRadii,
  dashboardShadows,
  dashboardSpacing,
  dashboardZIndex,
} from "./tokens";
import { useIsMobile } from "./use-is-mobile";

/*
  Generic desktop-centered-modal / mobile-bottom-sheet dialog primitive, plus
  a minimal nested-overlay coordination context so a DatePickerPopover (or
  any future similar overlay) can be opened *from inside* one of these and
  have Escape, outside-click, focus, and scroll-lock all resolve correctly
  against the outer dialog. Modeled directly on DatePickerPopover's own
  proven portal/focus-trap/scroll-lock behavior
  (app/components/dashboard/ui/calendar/date-picker-popover.tsx) -- this is
  a generalization of that component's mechanics, not a new design.

  The portal renders three DIRECT siblings (backdrop, panel, nested-overlay
  host) from one createPortal call -- deliberately NOT a backdrop-wraps-panel
  structure. Because panel and backdrop share no ancestor/descendant
  relationship (in the DOM or the React tree), a click on the panel can never
  reach the backdrop's own onMouseDown handler by any propagation path, so
  the panel needs no stopPropagation() of its own and the backdrop's
  target===currentTarget check is trivially safe.
*/

export type ResponsiveDialogAccessibleName =
  | { "aria-labelledby": string; "aria-label"?: never }
  | { "aria-label": string; "aria-labelledby"?: never };

type ResponsiveDialogBaseProps = {
  open: boolean;
  onRequestClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  busy?: boolean;
  lockScroll?: boolean;
  zIndex?: number;
  "aria-describedby"?: string;
  children: ReactNode;
};

export type ResponsiveDialogProps = ResponsiveDialogBaseProps & ResponsiveDialogAccessibleName;

export type NestedOverlayContextValue = {
  /** Real, React-rendered <div> inside this dialog's own portal tree,
   *  captured via a callback ref -- never a manually document.createElement'd
   *  node. Null until that ref callback has actually fired (the first render
   *  or two); a nested overlay must render null and wait during that window,
   *  never fall back to portaling into document.body. */
  hostElement: HTMLElement | null;
  registerNestedOverlay: (id: string) => void;
  unregisterNestedOverlay: (id: string) => void;
};

const NestedOverlayContext = createContext<NestedOverlayContextValue | null>(null);

export function useNestedOverlayHost(): NestedOverlayContextValue | null {
  return useContext(NestedOverlayContext);
}

function isUsableInitialFocusTarget(el: HTMLElement, panel: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (!panel.contains(el)) return false;
  if (!matchesFocusableSelector(el)) return false;
  // aria-disabled is an AT-only signal the DOM's own :disabled pseudo-class
  // (baked into FOCUSABLE_SELECTOR) does not capture -- checked separately.
  if (el.getAttribute("aria-disabled") === "true") return false;
  return true;
}

export function ResponsiveDialog({
  open,
  onRequestClose,
  triggerRef,
  initialFocusRef,
  busy = false,
  lockScroll = true,
  zIndex = dashboardZIndex.modal,
  "aria-describedby": ariaDescribedBy,
  children,
  ...accessibleNameProps
}: ResponsiveDialogProps) {
  const isMounted = useHasMounted();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null);

  // Entirely internal -- never part of NestedOverlayContextValue. No
  // useReducer/forceUpdate/version counter: nothing rendered depends on this
  // Set's contents, only event handlers reading it at call time, so there is
  // nothing for a re-render to accomplish here.
  const activeNestedOverlayIdsRef = useRef<Set<string>>(new Set());

  const registerNestedOverlay = useCallback((id: string) => {
    activeNestedOverlayIdsRef.current.add(id);
  }, []);
  const unregisterNestedOverlay = useCallback((id: string) => {
    activeNestedOverlayIdsRef.current.delete(id);
  }, []);

  // Captured-trigger-at-open focus-return contract: capture triggerRef.current
  // once, when this open session starts. The SAME effect's cleanup fires
  // identically on open->false or on raw unmount, so a caller that renders
  // this dialog conditionally ({isOpen && <ResponsiveDialog ...>}) gets the
  // same focus-return behavior as one that toggles `open`. Never re-reads a
  // live triggerRef.current at close time.
  const capturedTriggerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    capturedTriggerRef.current = triggerRef.current;
    return () => {
      const capturedTrigger = capturedTriggerRef.current;
      if (capturedTrigger?.isConnected) {
        capturedTrigger.focus();
      }
    };
  }, [open, triggerRef]);

  // Deterministic three-step initial-focus order, executed before paint so
  // there's no visible flash of default/no focus followed by a jump.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const requestedTarget = initialFocusRef?.current;
    if (requestedTarget && isUsableInitialFocusTarget(requestedTarget, panel)) {
      requestedTarget.focus();
      return;
    }

    const focusable = getFocusableElements(panel);
    if (focusable.length > 0) {
      focusable[0].focus();
      return;
    }

    panel.focus();
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open || !lockScroll) return;
    const lock = acquireDocumentScrollLock();
    return () => lock.release();
  }, [open, lockScroll]);

  // Escape and Tab/Shift+Tab share one ordered contract: ignore unrelated
  // keys, respect an already-defaultPrevented event (a nested overlay's own
  // capture-phase handler may have already claimed it), then -- Escape only
  // -- respect `busy`, then read the nested-overlay registry directly off
  // the ref at event time (always current, never a stale closure).
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        if (busy) return;
        if (activeNestedOverlayIdsRef.current.size > 0) return;
        onRequestClose();
        return;
      }

      if (event.key === "Tab") {
        if (event.defaultPrevented) return;
        if (activeNestedOverlayIdsRef.current.size > 0) return;

        const panel = panelRef.current;
        if (!panel) return;

        const focusable = getFocusableElements(panel);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !(active instanceof Node) || !panel.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onRequestClose]);

  if (!isMounted || !open) {
    return null;
  }

  function handleBackdropMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (busy) return;
    // Defense in depth alongside native hit-testing (§10): in a real browser
    // a nested overlay's own full-viewport overlay physically intercepts
    // this click before it ever reaches the backdrop, but jsdom performs no
    // real hit-testing, and a caller could in principle dispatch here
    // directly -- read the registry fresh, at event time, the same way the
    // Escape/Tab handlers above already do.
    if (activeNestedOverlayIdsRef.current.size > 0) return;
    onRequestClose();
  }

  const contextValue: NestedOverlayContextValue = {
    hostElement,
    registerNestedOverlay,
    unregisterNestedOverlay,
  };

  const panelPresentationStyle = isMobile ? mobilePanelStyle : desktopPanelStyle;

  return createPortal(
    <NestedOverlayContext.Provider value={contextValue}>
      <>
        <div
          data-responsive-dialog-backdrop=""
          onMouseDown={handleBackdropMouseDown}
          style={{ ...backdropStyle, zIndex }}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
          {...accessibleNameProps}
          style={{ ...panelPresentationStyle, zIndex }}
        >
          {children}
        </div>
        <div
          ref={setHostElement}
          data-responsive-dialog-nested-host=""
          data-testid="rd-nested-overlay-host"
          style={{ ...nestedHostStyle, zIndex: zIndex + 100 }}
        />
      </>
    </NestedOverlayContext.Provider>,
    document.body
  );
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: dashboardColors.background.overlay,
};

const desktopPanelStyle: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "calc(100vw - 32px)",
  maxWidth: 560,
  maxHeight: "calc(100vh - 64px)",
  overflowY: "auto",
  background: dashboardColors.background.surface,
  border: `1px solid ${dashboardColors.border.subtle}`,
  borderRadius: dashboardRadii.xl,
  boxShadow: dashboardShadows.lg,
  padding: dashboardSpacing[4],
};

const mobilePanelStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
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

// Zero-size on purpose (no inset/width/height) -- there is nothing at any
// screen coordinate for it to intercept, regardless of pointer-events, until
// something is actually portaled inside it. pointer-events stays "auto" so
// whatever IS portaled in remains interactive on its own terms.
const nestedHostStyle: CSSProperties = {
  position: "fixed",
  pointerEvents: "auto",
};
