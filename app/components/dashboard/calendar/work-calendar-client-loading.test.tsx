// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { todayDateOnly } from "@/lib/tasks/date-only";
import { getCalendarGridRange } from "@/lib/calendar/calendar-grid";
import { WorkCalendarClient } from "./work-calendar-client";
import {
  captureUnhandledRejections,
  createAbortAwareFetchMock,
  defer,
  jsonResponse,
  readyBody,
  waitForReady,
} from "./work-calendar-client.test-helpers";

/*
  Range-load lifecycle and abort-safety coverage for WorkCalendarClient,
  split out of the original single work-calendar-client.test.tsx (see
  docs/TEXT2TASK_WORK_CALENDAR_UI_REDESIGN_IMPLEMENTATION_REPORT.md's
  test-isolation section for why: the single ~1500-line file's cumulative
  per-test cost grew within one long-lived Vitest environment, not because
  of any leak -- splitting by concern gives Vitest's own per-file isolation
  a chance to reset that environment more often). Every test below is a
  verbatim extraction -- no behavior/assertion change.
*/

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorkCalendarClient", () => {
  it("fetches the exact visible grid range for the initial month, anchored on today", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(readyBody()));
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkCalendarClient />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const range = getCalendarGridRange(todayDateOnly());
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`/api/calendar?start=${range.start}&end=${range.end}`);
  });

  it("shows a calm loading state before the fetch resolves, then renders the calendar", async () => {
    const deferred = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(deferred.promise));

    render(<WorkCalendarClient />);

    expect(screen.getByText(/Loading your calendar/i)).toBeInTheDocument();

    deferred.resolve(jsonResponse(readyBody()));

    await waitFor(() =>
      expect(screen.queryByText(/Loading your calendar/i)).not.toBeInTheDocument()
    );
    await waitForReady();
  });

  it("shows an inline error with a Retry control on failure, and Retry re-fetches successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Server unavailable" }, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse(readyBody()));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<WorkCalendarClient />);

    await waitFor(() => expect(screen.getByText("Server unavailable")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitForReady();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves the currently viewed month while an error is shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Server unavailable" }, { ok: false, status: 500 }))
    );

    render(<WorkCalendarClient />);

    await waitFor(() => expect(screen.getByText("Server unavailable")).toBeInTheDocument());

    // The toolbar (and its visible month+year label) remains mounted rather
    // than being replaced by the error panel, so the user never loses track
    // of which month they were viewing.
    expect(screen.getByRole("button", { name: /Go to today/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous month/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next month/i })).toBeInTheDocument();
  });

  it("clicking Previous issues a fetch for the adjacent month's range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(readyBody()));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Previous month/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstRange = getCalendarGridRange(todayDateOnly());
    const [secondUrl] = fetchMock.mock.calls[1];
    expect(String(secondUrl)).not.toBe(`/api/calendar?start=${firstRange.start}&end=${firstRange.end}`);
  });

  it("clicking Today while already in the current month does not trigger an extra fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(readyBody()));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Go to today" }));

    // Give any accidental async refetch a chance to fire before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts the in-flight request when navigating to a new month before it resolves", async () => {
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!firstSignal) {
        firstSignal = init?.signal ?? undefined;
        return new Promise(() => {}); // never resolves
      }
      return Promise.resolve(jsonResponse(readyBody()));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Next month/ }));

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
  });

  it("a stale response for a superseded month never overwrites the newer month's data", async () => {
    const firstMonthDeferred = defer<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstMonthDeferred.promise)
      .mockResolvedValueOnce(jsonResponse(readyBody()));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Next month/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The first (now-superseded) request resolves late, after navigation.
    firstMonthDeferred.resolve(jsonResponse({ error: "stale error, should be ignored" }));

    await waitForReady();
    expect(screen.queryByText("stale error, should be ignored")).not.toBeInTheDocument();
  });

  it("does not update state after unmount", async () => {
    const deferred = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(deferred.promise));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(<WorkCalendarClient />);
    unmount();

    deferred.resolve(jsonResponse(readyBody()));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const reactStateWarnings = consoleErrorSpy.mock.calls.filter(([message]) =>
      String(message).includes("state update") || String(message).includes("unmounted")
    );
    expect(reactStateWarnings).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
});

describe("WorkCalendarClient - AbortError corrective-pass regression", () => {
  it("1. navigating away (unmounting) during an active request aborts it without an unhandled rejection", async () => {
    const observer = captureUnhandledRejections();
    vi.stubGlobal("fetch", createAbortAwareFetchMock());

    const { unmount } = render(<WorkCalendarClient />);
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();

    expect(observer.rejections).toHaveLength(0);
  });

  it("2. an aborted request never displays the Calendar error state", async () => {
    const observer = captureUnhandledRejections();
    vi.stubGlobal("fetch", createAbortAwareFetchMock());
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    // Navigate before the initial request resolves, aborting it, then let
    // the second (superseding) request resolve normally.
    await user.click(screen.getByRole("button", { name: /Next month/ }));

    await waitForReady();
    expect(screen.queryByText("Could not load your calendar")).not.toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();
    expect(observer.rejections).toHaveLength(0);
  });

  it("3. an aborted request never calls console.error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", createAbortAwareFetchMock());

    const { unmount } = render(<WorkCalendarClient />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("4. month navigation aborts the older (real, signal-aware) request safely, with no unhandled rejection", async () => {
    const observer = captureUnhandledRejections();
    const fetchMock = createAbortAwareFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ delay: null });

    render(<WorkCalendarClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Previous month/ }));
    await user.click(screen.getByRole("button", { name: /Next month/ }));
    await user.click(screen.getByRole("button", { name: /Next month/ }));

    await waitForReady();

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();
    expect(observer.rejections).toHaveLength(0);
  }, 15000);

  it("5. a stale (aborted) older response still cannot overwrite the newer month's data", async () => {
    // Covered functionally by the requestKey-guard test above; this test
    // adds the real signal-aware fetch + rejection-observer angle on top.
    const observer = captureUnhandledRejections();
    const seenSignals: AbortSignal[] = [];
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal) seenSignals.push(signal);
      return new Promise<Response>((resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("signal is aborted without reason", "AbortError"));
        });
        if (seenSignals.length === 1) return; // first request never resolves on its own, only via abort
        resolve(jsonResponse(readyBody()));
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Next month/ }));
    await waitFor(() => expect(seenSignals[0]?.aborted).toBe(true));

    await waitForReady();
    expect(screen.queryByText("Could not load your calendar")).not.toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();
    expect(observer.rejections).toHaveLength(0);
  });

  it("6. a genuine (non-abort) network error still displays the Error + Retry state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<WorkCalendarClient />);

    await waitFor(() =>
      expect(screen.getByText("Could not load your calendar")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("7. re-entering/remounting Calendar after an aborted request loads normally", async () => {
    const observer = captureUnhandledRejections();
    vi.stubGlobal("fetch", createAbortAwareFetchMock());

    const { unmount } = render(<WorkCalendarClient />);
    unmount();

    // Remount, simulating navigating back to /dashboard/calendar. This
    // fetch resolves normally (no abort this time).
    render(<WorkCalendarClient />);

    await waitForReady();

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();
    expect(observer.rejections).toHaveLength(0);
  });

  it("8. simulated React Strict Mode double-invoke (mount -> cleanup -> mount) produces no unhandled rejection", async () => {
    const observer = captureUnhandledRejections();
    vi.stubGlobal("fetch", createAbortAwareFetchMock());

    // Mirrors React 18/19 dev Strict Mode's synchronous
    // effect -> cleanup -> effect double-invocation on initial mount.
    const { unmount } = render(<WorkCalendarClient />);
    unmount();
    render(<WorkCalendarClient />);

    await waitForReady();

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();
    expect(observer.rejections).toHaveLength(0);
  });
});

describe("WorkCalendarClient - mobile clipping/duplicate-control corrective pass", () => {
  it("3. CalendarToolbar is the only visible month navigation/title -- no duplicate Previous/Next or month/year caption from either grid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(readyBody())));

    render(<WorkCalendarClient />);
    await waitForReady();

    // Exactly one Previous and one Next control exist across the whole
    // render tree (CalendarToolbar's) -- neither the desktop grid nor the
    // mobile compact selector contribute their own DayPicker nav buttons.
    expect(screen.getAllByRole("button", { name: /Previous month/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Next month/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Go to today" })).toHaveLength(1);

    // No leftover DayPicker month/year <select> dropdowns anywhere (the
    // mobile compact selector now suppresses its own caption too).
    expect(document.querySelectorAll("select")).toHaveLength(0);
  });
});
