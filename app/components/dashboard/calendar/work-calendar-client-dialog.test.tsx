// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatDateOnlyForA11y, formatDateOnlyForDisplay } from "@/lib/tasks/date-only";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { WorkCalendarClient } from "./work-calendar-client";
import {
  anotherDayInCurrentMonth,
  EVENT_UUID_A,
  eventItemResponse,
  FAR_OUTSIDE_RANGE_DATE,
  jsonResponse,
  manualEvent,
  openDay,
  readyBody,
  routedFetchMock,
  TODAY,
  waitForReady,
} from "./work-calendar-client.test-helpers";

/*
  Add/Edit dialog entry points, dismissal, and focus-return coverage for
  WorkCalendarClient, split out of the original single
  work-calendar-client.test.tsx (see
  docs/TEXT2TASK_WORK_CALENDAR_UI_REDESIGN_IMPLEMENTATION_REPORT.md's
  test-isolation section for why). Every test below is a verbatim
  extraction -- no behavior/assertion change.
*/

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorkCalendarClient — Add event entry point", () => {
  it("renders Add event alongside CalendarToolbar in one right-aligned header row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(readyBody())));
    render(<WorkCalendarClient />);
    await waitForReady();

    const addButton = screen.getByRole("button", { name: "Add event" });
    const toolbarButton = screen.getByRole("button", { name: /Previous month/i });
    // Both controls live in the same premium header row, toolbar first.
    expect(
      toolbarButton.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(addButton.closest(".calendar-header-row")).not.toBeNull();
    expect(toolbarButton.closest(".calendar-header-row")).toBe(addButton.closest(".calendar-header-row"));
  }, 30000);

  it("remains available while the Calendar range is loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<WorkCalendarClient />);
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();
  }, 30000);

  it("remains available during a recoverable range-load error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Server unavailable" }, { ok: false, status: 500 }))
    );
    render(<WorkCalendarClient />);
    await waitFor(() => expect(screen.getByText("Could not load your calendar")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();
  }, 30000);

  it("opens create mode with the current selectedDate", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));

    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveTextContent(formatDateOnlyForDisplay(TODAY));
  }, 30000);

  it("selecting a day opens the day-detail popup for that date", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    const target = anotherDayInCurrentMonth();
    await openDay(user, target);

    expect(screen.getByRole("dialog", { name: new RegExp(formatDateOnlyForA11y(target)) })).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument();
  }, 30000);

  it("selecting a day, then using the popup's own Add event uses that selected date", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    const target = anotherDayInCurrentMonth();
    await openDay(user, target);
    await user.click(screen.getByRole("button", { name: "+ Add event" }));

    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveTextContent(formatDateOnlyForDisplay(target));
  }, 30000);
});

describe("WorkCalendarClient — Manual Event Edit entry point", () => {
  it("opens edit mode with the exact item when Edit is clicked inside the day popup", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Kickoff call" });
    vi.stubGlobal("fetch", routedFetchMock({ range: () => jsonResponse(readyBody([item])) }));
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    expect(screen.getByText("Kickoff call")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Kickoff call" }));

    expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Kickoff call");
  }, 30000);

  it("gives a Project Deadline no edit entry point", async () => {
    const user = userEvent.setup({ delay: null });
    const deadline: CalendarItem = {
      kind: "project_deadline",
      id: "project:p1",
      date: TODAY,
      projectId: "p1",
      title: "Redesign",
      clientName: null,
      status: null,
      priority: null,
      isOverdue: false,
    };
    vi.stubGlobal("fetch", routedFetchMock({ range: () => jsonResponse(readyBody([deadline])) }));
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    expect(screen.getByText("Redesign")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  }, 30000);
});

describe("WorkCalendarClient — dialog dismissal", () => {
  it("ordinary Cancel closes the dialog", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  }, 30000);

  it("Escape closes the dialog, delegated to ResponsiveDialog", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  }, 30000);

  it("backdrop click closes the dialog, delegated to ResponsiveDialog", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    const backdrop = document.querySelector("[data-responsive-dialog-backdrop]") as Element;
    fireEvent.mouseDown(backdrop);

    expect(screen.queryByRole("dialog")).toBeNull();
  }, 30000);

  it("the day popup's own Close button closes it", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  }, 30000);
});

describe("WorkCalendarClient — focus return", () => {
  it("returns focus to the Add event button after an ordinary create-dialog close", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Add event" })).toHaveFocus();
  }, 30000);

  it("returns focus to the originating day cell after Cancel from Edit reached via the day popup", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Kickoff call" });
    vi.stubGlobal("fetch", routedFetchMock({ range: () => jsonResponse(readyBody([item])) }));
    render(<WorkCalendarClient />);
    await waitForReady();

    const dayButton = screen.getByRole("button", { name: new RegExp(formatDateOnlyForA11y(TODAY)) });
    await user.click(dayButton);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff call" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dayButton).toHaveFocus();
  }, 30000);

  it("a successful delete (reached via the day popup) closes the dialog and returns focus to the day cell, which survives deletion", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Kickoff call" });
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([item])),
        events: (_url, init) =>
          init?.method === "DELETE"
            ? jsonResponse({ success: true, alreadyDeleted: false })
            : jsonResponse({ success: true }),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    const dayButton = screen.getByRole("button", { name: new RegExp(formatDateOnlyForA11y(TODAY)) });
    await user.click(dayButton);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff call" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The day cell itself is a calendar date, not tied to the deleted item
    // -- its own DOM node stays stable across the mutation (CalendarMonthGrid
    // passes per-day data through Context rather than through its
    // DayButton component's own identity, precisely so a real data change
    // never forces DayPicker to tear down and rebuild day cells), so
    // ResponsiveDialog's own trigger-capture focus-return succeeds
    // directly; WorkCalendarClient's Add-event/heading fallback (still
    // wired for defense-in-depth) is not needed here.
    await waitFor(() => expect(dayButton).toHaveFocus());
  }, 30000);

  it("an edit that moves the event outside the current range still returns focus to the originating day cell", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Kickoff call" });
    const moved = { ...item, title: "Kickoff call moved", date: FAR_OUTSIDE_RANGE_DATE };
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([item])),
        events: () => eventItemResponse(moved),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    const dayButton = screen.getByRole("button", { name: new RegExp(formatDateOnlyForA11y(TODAY)) });
    await user.click(dayButton);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff call" }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Kickoff call moved");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByText(/Kickoff call moved/)).not.toBeInTheDocument());
    await waitFor(() => expect(dayButton).toHaveFocus());
  }, 30000);

  it("wires a visually-hidden, defensive focus-fallback heading (tabIndex=-1), used only if even Add event is unavailable", async () => {
    vi.stubGlobal("fetch", routedFetchMock({}));
    render(<WorkCalendarClient />);
    await waitForReady();

    expect(screen.getByRole("heading", { level: 2, name: "Work Calendar" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
  }, 30000);
});
