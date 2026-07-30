// @vitest-environment jsdom
import { createRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import type { ManualCalendarEventItem } from "@/lib/calendar/calendar-types";
import { AddEditCalendarEventDialog } from "./add-edit-calendar-event-dialog";

function toDateOnly(value: string): DateOnly {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`fixture "${value}" is not a valid DateOnly`);
  return parsed;
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const SAMPLE_EVENT: ManualCalendarEventItem = {
  kind: "manual_event",
  id: `event:${VALID_UUID}`,
  date: toDateOnly("2027-01-12"),
  time: null,
  title: "Client call",
  notes: null,
  projectId: null,
  projectTitle: null,
  clientId: null,
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
  mode: "create" | "edit";
  onClose?: () => void;
  onSaved?: (item: ManualCalendarEventItem) => void;
  onDeleted?: (itemId: string) => void;
};

function DialogHarness({ mode, onClose, onSaved, onDeleted }: DialogHarnessProps) {
  const triggerRef = createRef<HTMLButtonElement>();
  const [open, setOpen] = useState(true);

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  return (
    <>
      <button ref={triggerRef}>Open trigger</button>
      {mode === "create" ? (
        <AddEditCalendarEventDialog
          mode="create"
          defaultDate={toDateOnly("2027-02-01")}
          open={open}
          triggerRef={triggerRef}
          onClose={handleClose}
          onSaved={onSaved ?? vi.fn()}
          onDeleted={onDeleted ?? vi.fn()}
          projectOptions={[]}
          clientOptions={[]}
          projectsTruncated={false}
          clientsTruncated={false}
          optionsLoading={false}
          optionsError={null}
          onRetryOptions={vi.fn()}
        />
      ) : (
        <AddEditCalendarEventDialog
          mode="edit"
          event={SAMPLE_EVENT}
          open={open}
          triggerRef={triggerRef}
          onClose={handleClose}
          onSaved={onSaved ?? vi.fn()}
          onDeleted={onDeleted ?? vi.fn()}
          projectOptions={[]}
          clientOptions={[]}
          projectsTruncated={false}
          clientsTruncated={false}
          optionsLoading={false}
          optionsError={null}
          onRetryOptions={vi.fn()}
        />
      )}
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddEditCalendarEventDialog — headings and accessible name", () => {
  it("shows the 'Add event' heading in create mode, wired via aria-labelledby", () => {
    render(<DialogHarness mode="create" />);
    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
  });

  it("shows the 'Edit event' heading in edit mode, wired via aria-labelledby", () => {
    render(<DialogHarness mode="edit" />);
    expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
  });

  it("focuses the Title input on open", () => {
    render(<DialogHarness mode="create" />);
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });
});

describe("AddEditCalendarEventDialog — dismissal", () => {
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
});

describe("AddEditCalendarEventDialog — save/delete callbacks", () => {
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

describe("AddEditCalendarEventDialog — nested DatePicker integration", () => {
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
