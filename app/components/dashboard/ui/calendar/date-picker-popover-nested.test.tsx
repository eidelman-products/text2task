// @vitest-environment jsdom
import { createRef, StrictMode, useState, type RefObject } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResponsiveDialog } from "../responsive-dialog";
import * as documentScrollLock from "../document-scroll-lock";
import { DateField } from "./date-field";

/*
  Dedicated, exclusive home for every nested-overlay-integration test case
  (a ResponsiveDialog with a DatePickerPopover -- via DateField -- opened
  from inside it). date-field.test.tsx itself is never modified for this;
  its own full existing suite is re-run completely unchanged as the
  standalone-regression guard (see the Phase A implementation report).
*/

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

// `outerOpen` is controlled (driven by the test via rerender) only when
// explicitly passed; otherwise the harness manages its own open state, so
// that Escape/backdrop dismissal -- which calls onRequestClose, not a
// direct prop mutation -- actually closes the outer dialog, matching how a
// real caller (e.g. the future CalendarEventForm) would own this state.
function NestedHarness({
  outerOpen,
  outerOnRequestClose,
  outerTriggerRef,
  showDateField = true,
}: {
  outerOpen?: boolean;
  outerOnRequestClose?: () => void;
  outerTriggerRef: RefObject<HTMLButtonElement | null>;
  showDateField?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(true);
  const isControlled = outerOpen !== undefined;
  const open = isControlled ? outerOpen : internalOpen;

  function handleRequestClose() {
    if (!isControlled) {
      setInternalOpen(false);
    }
    outerOnRequestClose?.();
  }

  return (
    <>
      <button ref={outerTriggerRef}>Open Event</button>
      <ResponsiveDialog
        open={open}
        onRequestClose={handleRequestClose}
        triggerRef={outerTriggerRef}
        aria-label="Event dialog"
      >
        <button>Title field</button>
        {showDateField && <DateField value={null} onChange={() => {}} label="Deadline" />}
      </ResponsiveDialog>
    </>
  );
}

function UnmountableNestedHarness({
  outerTriggerRef,
}: {
  outerTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button onClick={() => setMounted(false)}>Unmount everything</button>
      {mounted && <NestedHarness outerTriggerRef={outerTriggerRef} />}
    </>
  );
}

async function openOuterAndNestedDatePicker() {
  const user = userEvent.setup();
  const outerTriggerRef = createRef<HTMLButtonElement>();
  render(<NestedHarness outerTriggerRef={outerTriggerRef} />);

  await user.click(screen.getByLabelText("Deadline"));
  expect(screen.getByRole("dialog", { name: "Choose deadline date" })).toBeInTheDocument();

  return { user, outerTriggerRef };
}

describe("Nested overlay — DOM structure", () => {
  it("the nested-overlay host is a DOM sibling of the outer dialog's panel, never a descendant", async () => {
    await openOuterAndNestedDatePicker();

    const outerPanel = screen.getByRole("dialog", { name: "Event dialog" });
    const host = screen.getByTestId("rd-nested-overlay-host");

    expect(host.parentElement).toBe(outerPanel.parentElement);
    expect(outerPanel.contains(host)).toBe(false);
  });

  it("portals the nested DatePickerPopover into the host once it is available", async () => {
    await openOuterAndNestedDatePicker();

    const host = screen.getByTestId("rd-nested-overlay-host");
    const popoverPanel = screen.getByRole("dialog", { name: "Choose deadline date" });

    expect(host.contains(popoverPanel)).toBe(true);
  });

  it("never renders the nested popover as a direct child of document.body outside the host", async () => {
    await openOuterAndNestedDatePicker();

    const popoverPanel = screen.getByRole("dialog", { name: "Choose deadline date" });
    const popoverOverlay = popoverPanel.parentElement;

    expect(popoverOverlay?.parentElement).toBe(
      screen.getByTestId("rd-nested-overlay-host")
    );
    expect(Array.from(document.body.children)).not.toContain(popoverOverlay);
  });
});

describe("Nested overlay — Escape ownership", () => {
  it("closes only the nested DatePicker on the first Escape; the outer dialog stays open", async () => {
    const { user } = await openOuterAndNestedDatePicker();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Event dialog" })).toBeInTheDocument();
  });

  it("closes the outer dialog on a second, subsequent Escape", async () => {
    const { user } = await openOuterAndNestedDatePicker();

    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Event dialog" })).toBeNull();
  });

  it("does not require duplicate registration cleanup after a parent re-render while the nested popover stays open", async () => {
    const outerTriggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(<NestedHarness outerTriggerRef={outerTriggerRef} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Deadline"));
    expect(screen.getByRole("dialog", { name: "Choose deadline date" })).toBeInTheDocument();

    // Force the outer tree to re-render while the nested popover remains open.
    rerender(<NestedHarness outerTriggerRef={outerTriggerRef} />);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Event dialog" })).toBeInTheDocument();
  });
});

describe("Nested overlay — outside click", () => {
  it("clicking outside the DatePicker but inside the dialog panel closes only the DatePicker", async () => {
    await openOuterAndNestedDatePicker();

    const popoverPanel = screen.getByRole("dialog", { name: "Choose deadline date" });
    const popoverOverlay = popoverPanel.parentElement as Element;
    fireEvent.mouseDown(popoverOverlay);

    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Event dialog" })).toBeInTheDocument();
  });

  it("clicking inside the DatePicker never closes the outer dialog", async () => {
    await openOuterAndNestedDatePicker();

    const popoverPanel = screen.getByRole("dialog", { name: "Choose deadline date" });
    fireEvent.mouseDown(popoverPanel);

    expect(screen.getByRole("dialog", { name: "Choose deadline date" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Event dialog" })).toBeInTheDocument();
  });

  it("clicking the outer backdrop while the DatePicker is open closes only the DatePicker", async () => {
    await openOuterAndNestedDatePicker();

    // In a real browser this click is physically intercepted by the
    // popover's own full-viewport overlay (the topmost element at every
    // screen coordinate while it's open, §10) before it ever reaches the
    // outer backdrop -- simulated here by dispatching directly on that
    // overlay, exactly as the browser's own hit-testing would.
    const popoverPanel = screen.getByRole("dialog", { name: "Choose deadline date" });
    const popoverOverlay = popoverPanel.parentElement as Element;
    fireEvent.mouseDown(popoverOverlay);

    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Event dialog" })).toBeInTheDocument();
  });
});

describe("Nested overlay — focus", () => {
  it("does not let the outer focus trap steal focus from the DatePicker's own day-cell navigation", async () => {
    const { user } = await openOuterAndNestedDatePicker();

    await waitFor(() => {
      expect(document.activeElement?.closest("[data-day]")).toBeTruthy();
    });
    const focusedBeforeNav = document.activeElement;

    await user.keyboard("{ArrowRight}");

    const focusedAfterNav = document.activeElement;
    expect(focusedAfterNav?.closest("[data-day]")).toBeTruthy();
    expect(focusedAfterNav).not.toBe(focusedBeforeNav);
    expect(
      screen.getByRole("dialog", { name: "Choose deadline date" }).contains(focusedAfterNav)
    ).toBe(true);
  });

  it("returns focus to the DateField trigger when the nested DatePicker closes, and the outer trap resumes normal cycling afterward", async () => {
    const { user } = await openOuterAndNestedDatePicker();

    await user.keyboard("{Escape}");

    const dateFieldTrigger = screen.getByLabelText("Deadline");
    expect(dateFieldTrigger).toHaveFocus();

    // Outer panel's only remaining focusables, in DOM order: "Title field",
    // then the DateField trigger (currently focused, i.e. the last one).
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByText("Title field")).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(dateFieldTrigger).toHaveFocus();
  });
});

describe("Nested overlay — registration cleanup", () => {
  it("unregisters on close (via a commit, not just Escape) -- the outer dialog's Escape then closes it directly", async () => {
    const { user } = await openOuterAndNestedDatePicker();

    const todayCell = document.activeElement as HTMLElement;
    await user.click(todayCell);
    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Event dialog" })).toBeNull();
  });

  it("unregisters on unmount (not only on an open->false close) -- the outer dialog's Escape then closes it directly", async () => {
    const outerTriggerRef = createRef<HTMLButtonElement>();
    render(<UnmountableNestedHarness outerTriggerRef={outerTriggerRef} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Deadline"));
    expect(screen.getByRole("dialog", { name: "Choose deadline date" })).toBeInTheDocument();

    await user.click(screen.getByText("Unmount everything"));
    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Event dialog" })).toBeNull();
  });

  it("does not register a nested overlay twice under React Strict Mode's double-invoke", async () => {
    const outerTriggerRef = createRef<HTMLButtonElement>();
    render(
      <StrictMode>
        <NestedHarness outerTriggerRef={outerTriggerRef} />
      </StrictMode>
    );
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Deadline"));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Choose deadline date" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Event dialog" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Event dialog" })).toBeNull();
  });
});

describe("Nested overlay — shared scroll lock", () => {
  it("stays locked once only the nested popover has closed -- the outer dialog still holds its own reference", async () => {
    const { user } = await openOuterAndNestedDatePicker();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("a mobile nested DatePickerPopover acquires its own second reference on the shared scroll-lock utility", async () => {
    mockMatchMedia(true);
    const acquireSpy = vi.spyOn(documentScrollLock, "acquireDocumentScrollLock");

    await openOuterAndNestedDatePicker();

    expect(acquireSpy).toHaveBeenCalledTimes(2);
  });

  it("a programmatic close of the outer dialog while the nested popover is still open does not leave the page stuck", async () => {
    const outerTriggerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(<NestedHarness outerTriggerRef={outerTriggerRef} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Deadline"));
    expect(document.body.style.overflow).toBe("hidden");

    expect(() => {
      rerender(<NestedHarness outerTriggerRef={outerTriggerRef} outerOpen={false} />);
    }).not.toThrow();
    expect(document.body.style.overflow).toBe("");
  });

  it("an outer-dialog unmount (simulating navigation away) while the nested popover is still open does not leave the page stuck", async () => {
    const outerTriggerRef = createRef<HTMLButtonElement>();
    const { unmount } = render(<NestedHarness outerTriggerRef={outerTriggerRef} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Deadline"));
    expect(document.body.style.overflow).toBe("hidden");

    expect(() => unmount()).not.toThrow();
    expect(document.body.style.overflow).toBe("");
  });

  it("converges to the same fully-unlocked end state regardless of which side releases first", async () => {
    // Nested closes first (via Escape), outer closes second.
    const outerTriggerRef1 = createRef<HTMLButtonElement>();
    const { rerender: rerender1 } = render(
      <NestedHarness outerTriggerRef={outerTriggerRef1} />
    );
    const user1 = userEvent.setup();
    await user1.click(screen.getByLabelText("Deadline"));
    await user1.keyboard("{Escape}");
    rerender1(<NestedHarness outerTriggerRef={outerTriggerRef1} outerOpen={false} />);
    expect(document.body.style.overflow).toBe("");

    // Outer closes first (programmatically), taking the still-open nested
    // popover down with it in the same unmount.
    const outerTriggerRef2 = createRef<HTMLButtonElement>();
    const { rerender: rerender2 } = render(
      <NestedHarness outerTriggerRef={outerTriggerRef2} />
    );
    const user2 = userEvent.setup();
    await user2.click(screen.getByLabelText("Deadline"));
    rerender2(<NestedHarness outerTriggerRef={outerTriggerRef2} outerOpen={false} />);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("Nested overlay — standalone DatePickerPopover is unaffected", () => {
  it("a standalone DatePickerPopover (no ResponsiveDialog ancestor) keeps its own local, body-only mobile scroll lock", async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(<DateField value={null} onChange={() => {}} label="Deadline" />);

    await user.click(screen.getByLabelText("Deadline"));

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });
});
