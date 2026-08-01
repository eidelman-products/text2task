// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  Mutation-reconciliation (create/edit/delete splicing into the currently-
  held Calendar range) coverage for WorkCalendarClient, split out of the
  original single work-calendar-client.test.tsx (see
  docs/TEXT2TASK_WORK_CALENDAR_UI_REDESIGN_IMPLEMENTATION_REPORT.md's
  test-isolation section for why). Every test below is a verbatim
  extraction -- no behavior/assertion change. This file in particular
  contains the two tests ("4. edit moving to another day..." and
  "8. deleting the last selected-day item...") that were intermittently
  timing out when they ran deep inside the original monolithic file; both
  are unchanged here, at their original (non-inflated) timeout values,
  since the fix was isolation, not a longer timeout.
*/

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorkCalendarClient — mutation reconciliation", () => {
  it("1. create inside the current range appears immediately (as a grid preview chip), without a full refetch", async () => {
    const user = userEvent.setup({ delay: null });
    const newItem = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "New event" });
    const fetchMock = routedFetchMock({
      range: () => jsonResponse(readyBody([])),
      events: () => eventItemResponse(newItem),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "New event");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Event: New event")).toBeInTheDocument());

    // A normal successful mutation does not trigger a full refetch --
    // exactly one range GET for the whole session.
    const rangeCalls = fetchMock.mock.calls.filter(([url]: unknown[]) => String(url).startsWith("/api/calendar?"));
    expect(rangeCalls).toHaveLength(1);
  }, 30000);

  it("2. create outside the current range is not inserted", async () => {
    const newItem = manualEvent({ id: `event:${EVENT_UUID_A}`, date: FAR_OUTSIDE_RANGE_DATE, title: "Far event" });
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([])),
        events: () => eventItemResponse(newItem),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    const user2 = userEvent.setup({ delay: null });
    await user2.click(screen.getByRole("button", { name: "Add event" }));
    await user2.type(screen.getByLabelText("Title"), "Far event");
    await user2.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText(/Far event/)).not.toBeInTheDocument();
  }, 30000);

  it("3. edit replaces the complete existing item (title and notes)", async () => {
    const user = userEvent.setup({ delay: null });
    const original = manualEvent({
      id: `event:${EVENT_UUID_A}`,
      date: TODAY,
      title: "Original title",
      notes: "orig notes",
    });
    const updated = { ...original, title: "Updated title", notes: "new notes" };
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([original])),
        events: () => eventItemResponse(updated),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Original title" }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Event: Updated title")).toBeInTheDocument());
    expect(screen.queryByText(/Original title/)).not.toBeInTheDocument();

    await openDay(user, TODAY);
    expect(screen.getByText("Updated title")).toBeInTheDocument();
    expect(screen.getByText("new notes")).toBeInTheDocument();
  }, 30000);

  it("4. edit moving to another day inside the range moves correctly", async () => {
    const user = userEvent.setup({ delay: null });
    const targetDay = anotherDayInCurrentMonth();
    const original = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Movable event" });
    const moved = { ...original, date: targetDay };
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([original])),
        events: () => eventItemResponse(moved),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Movable event" }));
    // Any touch triggers a real PATCH; the mocked response supplies the
    // moved date, independent of whatever the Date field itself displays.
    await user.type(screen.getByLabelText("Title"), " touched");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // TODAY's own day no longer shows the item -- it moved to a different
    // day still inside the range, so it legitimately still renders
    // somewhere in the grid (on targetDay's own cell); the check must be
    // scoped to TODAY's own popup, not the whole document.
    await openDay(user, TODAY);
    await waitFor(() => expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Close" }));

    await openDay(user, targetDay);
    expect(screen.getByRole("button", { name: "Edit Movable event" })).toBeInTheDocument();
  }, 30000);

  it("5. edit moving outside the range removes it", async () => {
    const user = userEvent.setup({ delay: null });
    const original = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Leaving event" });
    const moved = { ...original, date: FAR_OUTSIDE_RANGE_DATE };
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([original])),
        events: () => eventItemResponse(moved),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Leaving event" }));
    await user.type(screen.getByLabelText("Title"), " touched");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText(/Leaving event/)).not.toBeInTheDocument());

    await openDay(user, TODAY);
    expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument();
  }, 30000);

  it("6/7. delete removes only the Manual Event; Project Deadline items remain unchanged", async () => {
    const user = userEvent.setup({ delay: null });
    const manual = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Deletable event" });
    const deadline: CalendarItem = {
      kind: "project_deadline",
      id: "project:p1",
      date: TODAY,
      projectId: "p1",
      title: "Keep me",
      clientName: null,
      status: null,
      priority: null,
      isOverdue: false,
    };
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([manual, deadline])),
        events: (_url, init) =>
          init?.method === "DELETE"
            ? jsonResponse({ success: true, alreadyDeleted: false })
            : jsonResponse({ success: true }),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Deletable event" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(screen.queryByText(/Deletable event/)).not.toBeInTheDocument());
    expect(screen.getByText("Deadline: Keep me")).toBeInTheDocument();
  }, 30000);

  it("8. deleting the last selected-day item shows the existing empty state", async () => {
    const user = userEvent.setup({ delay: null });
    const manual = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Only event" });
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([manual])),
        events: (_url, init) =>
          init?.method === "DELETE"
            ? jsonResponse({ success: true, alreadyDeleted: false })
            : jsonResponse({ success: true }),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Only event" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await openDay(user, TODAY);
    expect(screen.getByText("Nothing scheduled for this day.")).toBeInTheDocument();
  }, 30000);

  it.each([false, true])(
    "9. delete with alreadyDeleted=%s produces the same UI removal",
    async (alreadyDeleted) => {
      const user = userEvent.setup({ delay: null });
      const manual = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Race-deleted event" });
      vi.stubGlobal(
        "fetch",
        routedFetchMock({
          range: () => jsonResponse(readyBody([manual])),
          events: () => jsonResponse({ success: true, alreadyDeleted }),
        })
      );
      render(<WorkCalendarClient />);
      await waitForReady();

      await openDay(user, TODAY);
      await user.click(screen.getByRole("button", { name: "Edit Race-deleted event" }));
      await user.click(screen.getByRole("button", { name: "Delete" }));
      await user.click(screen.getByRole("button", { name: "Confirm delete" }));

      await waitFor(() => expect(screen.queryByText(/Race-deleted event/)).not.toBeInTheDocument());
    },
    30000
  );

  it("10. reconciliation uses the range current at mutation-success time, not the range when the dialog opened -- exercises the real captured-callback boundary", async () => {
    const user = userEvent.setup({ delay: null });
    // A safely mid-month date (day 1 or 2, this suite's own established
    // convention -- see anotherDayInCurrentMonth's own comment) rather than
    // TODAY: the month grid also renders a few leading/trailing "outside
    // days" from the adjacent month to fill out full weeks, and the
    // reconciliation range intentionally includes that padding (§ mapping),
    // so an item dated TODAY can legitimately still render as an
    // outside-day preview chip on the next month's own grid whenever TODAY
    // falls within that padding window -- a real, date-dependent (not
    // stale-callback-related) case this test must not be confused by.
    const originalMonthDate = anotherDayInCurrentMonth();
    const newItem = manualEvent({ id: `event:${EVENT_UUID_A}`, date: originalMonthDate, title: "Late-arriving event" });
    let resolveSave: (value: Response) => void = () => {};
    const fetchMock = routedFetchMock({
      range: () => jsonResponse(readyBody([])),
      events: () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    // 1/2. Start a REAL create submission through the actual dialog/form --
    // never call any internal handler directly. CalendarEventForm's own
    // in-flight handleSubmit closure captures whichever onSaved
    // WorkCalendarClient passed at this exact moment (this month's range).
    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "Late-arriving event");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // 3. Navigate to next month WHILE the create is still in flight -- this
    // forces WorkCalendarClient to re-render with a genuinely different
    // gridRange/requestKey (and a new handleSaved function identity, under
    // the pre-fix implementation) before the mutation resolves -- the exact
    // callback-capture boundary a naive "props are always current" fix
    // would not actually close.
    await user.click(screen.getByRole("button", { name: /Next month/i }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]: unknown[]) => String(url).startsWith("/api/calendar?")).length
      ).toBe(2)
    );
    // The next month's own range GET has already resolved successfully --
    // this is the CURRENT month's own correct, settled state, before the
    // stale-captured mutation resolves.
    await waitForReady();

    // 4. Resolve the mutation now.
    resolveSave(eventItemResponse(newItem));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // 5/6. The item's date belongs to the ORIGINAL month, not the now-
    // current (next month) range -- it must never appear in the current
    // view, and the ORIGINAL month is never what gets updated.
    expect(screen.queryByText(/Late-arriving event/)).not.toBeInTheDocument();

    // This is the assertion that actually catches a stale-callback
    // regression: if the mutation's own onSaved closure had reconciled
    // using a stale, pre-navigation requestKey, it would overwrite the
    // single completedResult slot with that stale key -- making the
    // CURRENT (next-month) view's own requestKey no longer match it,
    // reverting the already-loaded current view back to a phantom
    // loading state (the grid would unmount, replaced by the loading
    // empty-state). The current view must still show its own settled grid.
    expect(screen.getAllByRole("grid").length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading your calendar...")).not.toBeInTheDocument();

    // 7. No unconditional refetch: the stale-arriving mutation must not
    // trigger a third range GET -- the current range already has a
    // successful result, so reconciliation must reason directly against
    // it; the narrow "no current success" fallback must not fire here.
    const rangeCalls = fetchMock.mock.calls.filter(([url]: unknown[]) => String(url).startsWith("/api/calendar?"));
    expect(rangeCalls).toHaveLength(2);
  }, 30000);

  it("11. mutation success with no current successful range triggers one fresh current-range load", async () => {
    const newItem = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "New event" });
    let rangeCallCount = 0;
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => {
          rangeCallCount += 1;
          return rangeCallCount === 1 ? new Promise(() => {}) : jsonResponse(readyBody([newItem]));
        },
        events: () => eventItemResponse(newItem),
      })
    );
    render(<WorkCalendarClient />);
    // First range GET never resolves -- Add event still available while loading.
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();

    const user2 = userEvent.setup({ delay: null });
    await user2.click(screen.getByRole("button", { name: "Add event" }));
    await user2.type(screen.getByLabelText("Title"), "New event");
    await user2.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Event: New event")).toBeInTheDocument());
    expect(rangeCallCount).toBe(2); // one initial (never resolved) + one fresh fallback load
  }, 30000);
});
