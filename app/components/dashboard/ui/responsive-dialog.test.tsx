// @vitest-environment jsdom
import { createRef, StrictMode, useEffect, type ReactNode, type RefObject } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ResponsiveDialog,
  useNestedOverlayHost,
  type ResponsiveDialogAccessibleName,
} from "./responsive-dialog";

afterEach(() => {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  vi.restoreAllMocks();
});

function mockMatchMedia(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
  );
}

function Harness({
  open = true,
  busy = false,
  lockScroll,
  zIndex,
  initialFocusRef,
  onRequestClose,
  children,
  accessibleName,
  showTrigger = true,
  triggerRef,
}: {
  open?: boolean;
  busy?: boolean;
  lockScroll?: boolean;
  zIndex?: number;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onRequestClose?: () => void;
  children?: ReactNode;
  accessibleName?: ResponsiveDialogAccessibleName;
  showTrigger?: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <>
      {showTrigger && <button ref={triggerRef}>Trigger</button>}
      <ResponsiveDialog
        open={open}
        onRequestClose={onRequestClose ?? (() => {})}
        triggerRef={triggerRef}
        initialFocusRef={initialFocusRef}
        busy={busy}
        lockScroll={lockScroll}
        zIndex={zIndex}
        {...(accessibleName ?? { "aria-label": "Test dialog" })}
      >
        {children ?? (
          <>
            <button>First</button>
            <button>Second</button>
          </>
        )}
      </ResponsiveDialog>
    </>
  );
}

// Test-only nested-overlay stand-in: proves registry-gated behavior through
// the same public registration functions a real nested consumer (e.g.
// DatePickerPopover) uses, never by reaching into ResponsiveDialog's
// internal Set. Registers on mount, unregisters on unmount -- mount/unmount
// this via a parent boolean to drive "nested active" / "nested cleared".
function TestNestedOverlayConsumer({ id }: { id: string }) {
  const nestedOverlay = useNestedOverlayHost();

  useEffect(() => {
    if (!nestedOverlay) return;
    nestedOverlay.registerNestedOverlay(id);
    return () => nestedOverlay.unregisterNestedOverlay(id);
  }, [nestedOverlay, id]);

  return null;
}

describe("ResponsiveDialog — portal and mount lifecycle", () => {
  it("mounts into document.body on open and unmounts (renders null) on close", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(<Harness triggerRef={triggerRef} open />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest("body")).toBe(document.body);

    rerender(<Harness triggerRef={triggerRef} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ResponsiveDialog — accessible name", () => {
  it("exposes the correct accessible dialog name via aria-label", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Harness triggerRef={triggerRef} accessibleName={{ "aria-label": "Pick a date" }} />
    );
    expect(screen.getByRole("dialog", { name: "Pick a date" })).toBeInTheDocument();
  });

  it("exposes the correct accessible dialog name via aria-labelledby", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Harness
        triggerRef={triggerRef}
        accessibleName={{ "aria-labelledby": "heading-id" }}
      >
        <h2 id="heading-id">Pick a date</h2>
        <button>First</button>
      </Harness>
    );
    expect(screen.getByRole("dialog", { name: "Pick a date" })).toBeInTheDocument();
  });
});

describe("ResponsiveDialog — initial focus", () => {
  it("focuses a valid initialFocusRef target on open", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const targetRef = createRef<HTMLButtonElement>();
    render(
      <Harness triggerRef={triggerRef} initialFocusRef={targetRef}>
        <button>First</button>
        <button ref={targetRef}>Target</button>
      </Harness>
    );
    expect(document.activeElement).toBe(targetRef.current);
  });

  it("falls through to the first focusable descendant when initialFocusRef.current is detached", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const detached = document.createElement("button");
    const targetRef = { current: detached };
    render(
      <Harness triggerRef={triggerRef} initialFocusRef={targetRef}>
        <button>First</button>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("falls through to the first focusable descendant when initialFocusRef points outside the panel", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Harness triggerRef={triggerRef} initialFocusRef={triggerRef}>
        <button>First</button>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("falls through to the first focusable descendant when initialFocusRef.current is disabled", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const targetRef = createRef<HTMLButtonElement>();
    render(
      <Harness triggerRef={triggerRef} initialFocusRef={targetRef}>
        <button>Fallback</button>
        <button disabled ref={targetRef}>
          Disabled
        </button>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByText("Fallback"));
  });

  it('falls through to the first focusable descendant when initialFocusRef.current has aria-disabled="true"', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const targetRef = createRef<HTMLButtonElement>();
    render(
      <Harness triggerRef={triggerRef} initialFocusRef={targetRef}>
        <button>Fallback</button>
        <button aria-disabled="true" ref={targetRef}>
          AriaDisabled
        </button>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByText("Fallback"));
  });

  it("focuses the first focusable descendant when no initialFocusRef is supplied", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("focuses the panel itself when there are no focusable descendants", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Harness triggerRef={triggerRef}>
        <p>No focusables here</p>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });
});

describe("ResponsiveDialog — Tab / Shift+Tab cycling", () => {
  it("wraps Tab from the last focusable element to the first", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    const first = screen.getByText("First");
    const second = screen.getByText("Second");
    act(() => second.focus());
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first focusable element to the last", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    const first = screen.getByText("First");
    const second = screen.getByText("Second");
    act(() => first.focus());
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it("is not processed by the outer focus trap when defaultPrevented is already true", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    const second = screen.getByText("Second");
    act(() => second.focus());

    function preventFirst(event: KeyboardEvent) {
      event.preventDefault();
    }
    window.addEventListener("keydown", preventFirst, { capture: true });
    fireEvent.keyDown(window, { key: "Tab" });
    window.removeEventListener("keydown", preventFirst, { capture: true });

    expect(document.activeElement).toBe(second);
  });
});

describe("ResponsiveDialog — Escape", () => {
  it("closes on Escape when not busy", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} onRequestClose={onRequestClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing on Escape while busy", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} onRequestClose={onRequestClose} busy />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("does nothing on Escape when defaultPrevented is already true", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} onRequestClose={onRequestClose} />);

    function preventFirst(event: KeyboardEvent) {
      event.preventDefault();
    }
    window.addEventListener("keydown", preventFirst, { capture: true });
    fireEvent.keyDown(window, { key: "Escape" });
    window.removeEventListener("keydown", preventFirst, { capture: true });

    expect(onRequestClose).not.toHaveBeenCalled();
  });
});

describe("ResponsiveDialog — outside click", () => {
  it("closes on backdrop click when not busy", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} onRequestClose={onRequestClose} />);
    const backdrop = document.querySelector("[data-responsive-dialog-backdrop]");
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop as Element);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing on backdrop click while busy", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} onRequestClose={onRequestClose} busy />);
    const backdrop = document.querySelector("[data-responsive-dialog-backdrop]");
    fireEvent.mouseDown(backdrop as Element);
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("never closes on a click inside the panel", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} onRequestClose={onRequestClose} />);
    fireEvent.mouseDown(screen.getByText("First"));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("checks the nested-overlay registry as defense in depth on a direct backdrop mousedown", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <Harness triggerRef={triggerRef} onRequestClose={onRequestClose}>
        <button>First</button>
        <TestNestedOverlayConsumer id="test-nested-overlay" />
      </Harness>
    );

    const backdrop = document.querySelector("[data-responsive-dialog-backdrop]") as Element;

    // Registered: even a direct hit on the backdrop must not close the
    // outer dialog while a nested overlay is active.
    fireEvent.mouseDown(backdrop);
    expect(onRequestClose).not.toHaveBeenCalled();

    // Unregistered (the consumer unmounts, running its cleanup): the very
    // same direct backdrop mousedown now closes the dialog normally.
    rerender(
      <Harness triggerRef={triggerRef} onRequestClose={onRequestClose}>
        <button>First</button>
      </Harness>
    );

    fireEvent.mouseDown(backdrop);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});

describe("ResponsiveDialog — scroll lock", () => {
  it("locks body and documentElement overflow on open", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("restores the pre-open overflow values on close", () => {
    document.body.style.overflow = "auto";
    const triggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(<Harness triggerRef={triggerRef} open />);
    rerender(<Harness triggerRef={triggerRef} open={false} />);
    expect(document.body.style.overflow).toBe("auto");
  });
});

describe("ResponsiveDialog — focus return", () => {
  it("returns focus to the trigger captured at open time when open transitions to false", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(<Harness triggerRef={triggerRef} open />);
    rerender(<Harness triggerRef={triggerRef} open={false} />);
    expect(document.activeElement).toBe(triggerRef.current);
  });

  it("is a safe no-op when the captured trigger is detached before close", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(<Harness triggerRef={triggerRef} open showTrigger />);
    rerender(<Harness triggerRef={triggerRef} open showTrigger={false} />);

    expect(() => {
      rerender(<Harness triggerRef={triggerRef} open={false} showTrigger={false} />);
    }).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it("returns focus to the originally-captured trigger even if triggerRef.current is reassigned while open", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const otherRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <>
        <button ref={otherRef}>Other</button>
        <Harness triggerRef={triggerRef} open />
      </>
    );
    const originalTrigger = triggerRef.current;

    (triggerRef as { current: HTMLButtonElement | null }).current = otherRef.current;

    rerender(
      <>
        <button ref={otherRef}>Other</button>
        <Harness triggerRef={triggerRef} open={false} />
      </>
    );
    expect(document.activeElement).toBe(originalTrigger);
  });

  it("returns focus to the captured trigger when the component is unmounted while still open", () => {
    const triggerRef = createRef<HTMLButtonElement>();

    function UnmountHarness({ showDialog }: { showDialog: boolean }) {
      return (
        <>
          <button ref={triggerRef}>Trigger</button>
          {showDialog && (
            <ResponsiveDialog
              open
              onRequestClose={() => {}}
              triggerRef={triggerRef}
              aria-label="Test dialog"
            >
              <button>First</button>
            </ResponsiveDialog>
          )}
        </>
      );
    }

    const { rerender } = render(<UnmountHarness showDialog />);
    rerender(<UnmountHarness showDialog={false} />);
    expect(document.activeElement).toBe(triggerRef.current);
  });
});

describe("ResponsiveDialog — responsive presentation", () => {
  it("renders the desktop centered-modal container shape", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    const panel = screen.getByRole("dialog");
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.top).toBe("50%");
    expect(panel.style.left).toBe("50%");
    expect(panel.style.transform).toBe("translate(-50%, -50%)");
  });

  it("renders the mobile bottom-sheet container shape", () => {
    mockMatchMedia(true);
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    const panel = screen.getByRole("dialog");
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.bottom).toBe("0px");
    expect(panel.style.top).toBe("");
  });

  it("renders the nested-overlay host with zero explicit size and pointer-events auto", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<Harness triggerRef={triggerRef} />);
    const host = screen.getByTestId("rd-nested-overlay-host");
    expect(host.style.inset).toBe("");
    expect(host.style.width).toBe("");
    expect(host.style.height).toBe("");
    expect(host.style.pointerEvents).toBe("auto");
  });
});

describe("ResponsiveDialog — cleanup", () => {
  it("cleans up scroll lock and keydown listeners on unmount while open", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    const { unmount } = render(
      <Harness triggerRef={triggerRef} onRequestClose={onRequestClose} />
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("does not double-lock or double-listen under React Strict Mode's double-invoke", () => {
    const onRequestClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    const { unmount } = render(
      <StrictMode>
        <Harness triggerRef={triggerRef} onRequestClose={onRequestClose} />
      </StrictMode>
    );

    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
