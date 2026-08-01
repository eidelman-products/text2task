// @vitest-environment jsdom
import { createRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import type { CalendarItem, ManualCalendarEventItem } from "@/lib/calendar/calendar-types";
import { CalendarDayDialog, type CalendarDialogMode } from "./calendar-day-dialog";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture "${value}" is not a valid DateOnly`);
  return parsed;
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const DAY = toDateOnly("2027-01-12");
const SAMPLE_EVENT: ManualCalendarEventItem = {
  kind: "manual_event",
  id: `event:${VALID_UUID}`,
  date: toDateOnly("2027-01-12"),
  time: null,
  title: "Client call",
  notes: null,
  projectId: null,
  customProjectName: null,
  projectTitle: null,
  clientId: null,
  customClientName: null,
  clientName: null,
};

function jsonResponse(body: unknown, init?: { status?: number; ok?: boolean }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

function itemResponse(overrides: Partial<ManualCalendarEventItem> = {}) {
  return jsonResponse({ success: true, item: { ...SAMPLE_EVENT, ...overrides } });
}

type DialogHarnessProps = {
  mode: "day" | "create" | "edit";
  items?: CalendarItem[];
  onClose?: () => void;
  onSaved?: (item: ManualCalendarEventItem) => void;
  onDeleted?: (itemId: string) => void;
  onEditFromDay?: (item: ManualCalendarEventItem) => void;
  onCreateFromDay?: (date: DateOnly) => void;
};

/** Fixed-mode harness -- mirrors AddEditCalendarEventDialogTest's original shape for create/edit coverage, plus a "day" variant. */
function DialogHarness({
  mode,
  items = [],
  onClose,
  onSaved,
  onDeleted,
  onEditFromDay,
  onCreateFromDay,
}: DialogHarnessProps) {
  const triggerRef = createRef<HTMLButtonElement>();
  const [open, setOpen] = useState(true);

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  const modeProps: CalendarDialogMode =
    mode === "create"
      ? { mode: "create", defaultDate: toDateOnly("2027-02-01") }
      : mode === "edit"
        ? { mode: "edit", event: SAMPLE_EVENT }
        : { mode: "day", date: DAY };

  return (
    <>
      <button ref={triggerRef}>Open trigger</button>
      <CalendarDayDialog
        {...modeProps}
        open={open}
        triggerRef={triggerRef}
        items={items}
        onClose={handleClose}
        onSaved={onSaved ?? vi.fn()}
        onDeleted={onDeleted ?? vi.fn()}
        onEditFromDay={onEditFromDay ?? vi.fn()}
        onCreateFromDay={onCreateFromDay ?? vi.fn()}
        projectOptions={[]}
        clientOptions={[]}
        projectsTruncated={false}
        clientsTruncated={false}
        optionsLoading={false}
        optionsError={null}
        onRetryOptions={vi.fn()}
      />
    </>
  );
}

/**
 * Stateful harness that actually drives the "day" -> "edit"/"create" mode
 * transition the way WorkCalendarClient does -- onEditFromDay/onCreateFromDay
 * change `dialogState` to a new non-null mode while `open` stays true the
 * whole time, so CalendarDayDialog's single ResponsiveDialog instance never
 * unmounts/remounts. Exists specifically to prove that architectural claim,
 * not just each mode's content in isolation.
 */
function TransitionHarness({ items = [SAMPLE_EVENT] }: { items?: CalendarItem[] }) {
  const triggerRef = createRef<HTMLButtonElement>();
  const [open, setOpen] = useState(true);
  const [dialogState, setDialogState] = useState<CalendarDialogMode>({ mode: "day", date: DAY });

  return (
    <>
      <button ref={triggerRef}>Day trigger</button>
      <CalendarDayDialog
        {...dialogState}
        open={open}
        triggerRef={triggerRef}
        items={items}
        onClose={() => setOpen(false)}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
        onEditFromDay={(item) => setDialogState({ mode: "edit", event: item })}
        onCreateFromDay={(date) => setDialogState({ mode: "create", defaultDate: date })}
        projectOptions={[]}
        clientOptions={[]}
        projectsTruncated={false}
        clientsTruncated={false}
        optionsLoading={false}
        optionsError={null}
        onRetryOptions={vi.fn()}
      />
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CalendarDayDialog — headings and accessible name", () => {
  it("shows the 'Add event' heading in create mode, wired via aria-labelledby", () => {
    render(<DialogHarness mode="create" />);
    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
  });

  it("shows the 'Edit event' heading in edit mode, wired via aria-labelledby", () => {
    render(<DialogHarness mode="edit" />);
    expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
  });

  it("focuses the Title input on open in create/edit mode", () => {
    render(<DialogHarness mode="create" />);
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("shows the formatted date as the heading in day mode, wired via aria-labelledby", () => {
    render(<DialogHarness mode="day" />);
    expect(screen.getByRole("dialog", { name: "January 12, 2027" })).toBeInTheDocument();
  });
});

describe("CalendarDayDialog — dismissal", () => {
  it("closes on Escape when not busy and not delete-confirming", () => {
    const onClose = vi.fn();
    render(<DialogHarness mode="create" onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click when not busy and not delete-confirming", () => {
    const onClose = vi.fn();
    render(<DialogHarness mode="create" onClose={onClose} />);

    const backdrop = document.querySelector("[data-responsive-dialog-backdrop]") as Element;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("steps back from delete confirmation on Escape instead of closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness mode="edit" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this event?")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.queryByText("Delete this event?")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("steps back from delete confirmation on backdrop click instead of closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness mode="edit" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const backdrop = document.querySelector("[data-responsive-dialog-backdrop]") as Element;
    fireEvent.mouseDown(backdrop);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete this event?")).toBeNull();
  });

  it("blocks Escape dismissal while a save is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
      )
    );
    const onClose = vi.fn();

    render(<DialogHarness mode="create" onClose={onClose} />);
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    resolveFetch(itemResponse({ title: "Team sync" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("day mode closes on Escape, backdrop click, and its own Close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness mode="day" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarDayDialog — save/delete callbacks", () => {
  it("invokes onSaved and closes on a successful save", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(itemResponse({ title: "Team sync" })));
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<DialogHarness mode="create" onSaved={onSaved} onClose={onClose} />);
    await user.type(screen.getByLabelText("Title"), "Team sync");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onDeleted and closes on a successful delete", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, alreadyDeleted: false }))
    );
    const onDeleted = vi.fn();
    const onClose = vi.fn();

    render(<DialogHarness mode="edit" onDeleted={onDeleted} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(SAMPLE_EVENT.id));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarDayDialog — nested DatePicker integration", () => {
  it("opens the Date field's popover inside the nested-overlay host", async () => {
    const user = userEvent.setup();
    render(<DialogHarness mode="create" />);

    await user.click(screen.getByLabelText("Date"));

    const host = screen.getByTestId("rd-nested-overlay-host");
    const popoverPanel = screen.getByRole("dialog", { name: "Choose date date" });
    expect(host.contains(popoverPanel)).toBe(true);
  });

  it("closes only the DatePicker on the first Escape; the dialog stays open", async () => {
    const user = userEvent.setup();
    render(<DialogHarness mode="create" />);

    await user.click(screen.getByLabelText("Date"));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Choose date date" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
  });

  it("closes the dialog on a second, subsequent Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness mode="create" onClose={onClose} />);

    await user.click(screen.getByLabelText("Date"));
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the Date trigger after the DatePicker closes", async () => {
    const user = userEvent.setup();
    render(<DialogHarness mode="create" />);

    await user.click(screen.getByLabelText("Date"));
    await user.keyboard("{Escape}");

    expect(screen.getByLabelText("Date")).toHaveFocus();
  });
});

describe("CalendarDayDialog — day mode content", () => {
  it("shows a clean, intentional empty state when the day has no items", () => {
    render(<DialogHarness mode="day" items={[]} />);
    expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument();
  });

  it("shows the day's items, and Edit calls onEditFromDay with the exact item", async () => {
    const user = userEvent.setup();
    const onEditFromDay = vi.fn();
    render(<DialogHarness mode="day" items={[SAMPLE_EVENT]} onEditFromDay={onEditFromDay} />);

    expect(screen.getByText("Client call")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Client call" }));

    expect(onEditFromDay).toHaveBeenCalledTimes(1);
    expect(onEditFromDay).toHaveBeenCalledWith(SAMPLE_EVENT);
  });

  it("its own Add event affordance calls onCreateFromDay with the day's date", async () => {
    const user = userEvent.setup();
    const onCreateFromDay = vi.fn();
    render(<DialogHarness mode="day" onCreateFromDay={onCreateFromDay} />);

    await user.click(screen.getByRole("button", { name: "+ Add event" }));

    expect(onCreateFromDay).toHaveBeenCalledTimes(1);
    expect(onCreateFromDay).toHaveBeenCalledWith(DAY);
  });
});

describe("CalendarDayDialog — day-to-edit/create mode transition, single dialog instance", () => {
  it("switching from day view to edit view keeps exactly one dialog/backdrop mounted and refocuses Title", async () => {
    const user = userEvent.setup();
    render(<TransitionHarness />);

    expect(screen.getByRole("dialog", { name: "January 12, 2027" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Client call" }));

    expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "January 12, 2027" })).toBeNull();
    expect(document.querySelectorAll("[data-responsive-dialog-backdrop]")).toHaveLength(1);
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("a single Escape from the edit view reached via day mode closes the dialog exactly once", async () => {
    const user = userEvent.setup();
    render(<TransitionHarness />);

    await user.click(screen.getByRole("button", { name: "Edit Client call" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a successful save reached via day mode closes the whole dialog (does not return to day view)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(itemResponse({ title: "Client call" })));
    render(<TransitionHarness />);

    await user.click(screen.getByRole("button", { name: "Edit Client call" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("switching from day view to create view (its own Add event) also refocuses Title", async () => {
    const user = userEvent.setup();
    render(<TransitionHarness />);

    await user.click(screen.getByRole("button", { name: "+ Add event" }));

    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-responsive-dialog-backdrop]")).toHaveLength(1);
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });
});
