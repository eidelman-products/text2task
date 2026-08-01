// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkCalendarClient } from "./work-calendar-client";
import {
  EVENT_UUID_A,
  eventItemResponse,
  jsonResponse,
  manualEvent,
  openDay,
  readyBody,
  routedFetchMock,
  TODAY,
  waitForReady,
} from "./work-calendar-client.test-helpers";

/*
  Calendar-data-version race-guard coverage (a stale in-flight GET must
  never overwrite a newer mutation's own reconciled state) for
  WorkCalendarClient, split out of the original single
  work-calendar-client.test.tsx (see
  docs/TEXT2TASK_WORK_CALENDAR_UI_REDESIGN_IMPLEMENTATION_REPORT.md's
  test-isolation section for why). Every test below is a verbatim
  extraction -- no behavior/assertion change.
*/

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorkCalendarClient — calendar data version guard", () => {
  // A stale-GET race is only reachable while the GET for the CURRENTLY
  // relevant key is still in flight -- for Edit/Delete this is structurally
  // impossible to construct against an ALREADY-VISIBLE item: opening Edit
  // requires that item's own day cell/popup to already show it, which
  // itself requires loadState to already be "ready" (a prior GET already
  // resolved and settled requestId/requestKey). By the time Edit/Delete can
  // even be invoked, there is no longer an in-flight GET left to race
  // against for that same key -- the only window where a GET can genuinely
  // still be pending while a mutation completes is the very first (initial)
  // load, which is exactly what Create's own trigger (the Add button,
  // always available regardless of load state) can exercise. The three
  // guards (requestId, requestKey, data version) are read identically
  // regardless of which mutation caused the reconciliation, so this one
  // scenario exercises the same discard logic Edit/Delete would also rely on.
  it("a GET already in flight during the initial load cannot overwrite a Create that resolves before it does", async () => {
    const user = userEvent.setup({ delay: null });
    const newItem = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Created item" });
    let resolveInitialRange: (value: Response) => void = () => {};
    let rangeCallCount = 0;
    const fetchMock = routedFetchMock({
      range: () => {
        rangeCallCount += 1;
        // Only the very first (initial) GET is deferred; the fallback GET
        // the mutation itself triggers (since no current success exists
        // yet) resolves normally, reflecting the just-created item.
        if (rangeCallCount === 1) {
          return new Promise((resolve) => {
            resolveInitialRange = resolve;
          });
        }
        return jsonResponse(readyBody([newItem]));
      },
      events: () => eventItemResponse(newItem),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);

    // The initial range GET is still pending -- Add event remains available
    // (loadState.status === "loading"), so Create takes the "no current
    // success" fallback: data version increments, and a fresh GET is issued
    // for the current range (a new requestId) -- all while the ORIGINAL
    // initial GET is still unsettled.
    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "Created item");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Event: Created item")).toBeInTheDocument());

    // The ORIGINAL, still-pending initial GET now resolves late, carrying
    // pre-mutation (empty) data under a now-stale requestId -- it must not
    // clobber the just-created item.
    resolveInitialRange(jsonResponse(readyBody([])));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByText("Event: Created item")).toBeInTheDocument();
  }, 30000);

  it("a failed mutation does not increment the data version -- a retried, successful mutation still reconciles correctly", async () => {
    const user = userEvent.setup({ delay: null });
    let shouldFail = true;
    const newItem = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Second attempt" });
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([])),
        events: () => {
          if (shouldFail) {
            shouldFail = false;
            return jsonResponse({ error: "Linked project not found." }, { ok: false, status: 404 });
          }
          return eventItemResponse(newItem);
        },
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.type(screen.getByLabelText("Title"), "First attempt");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Linked project not found.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Event: Second attempt")).toBeInTheDocument());
  }, 30000);

  it("a no-change edit does not increment the data version -- a subsequent real edit still reconciles correctly", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Untouched event" });
    const updated = { ...item, title: "Now changed" };
    vi.stubGlobal(
      "fetch",
      routedFetchMock({
        range: () => jsonResponse(readyBody([item])),
        events: () => eventItemResponse(updated),
      })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Untouched event" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Event: Untouched event")).toBeInTheDocument();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Untouched event" }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Now changed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Event: Now changed")).toBeInTheDocument());
  }, 30000);
});
