// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkCalendarClient } from "./work-calendar-client";
import {
  captureUnhandledRejections,
  CLIENT_ID,
  EVENT_UUID_A,
  EVENT_UUID_B,
  jsonResponse,
  manualEvent,
  openDay,
  optionsSuccessBody,
  OTHER_CLIENT_ID,
  OTHER_PROJECT_ID,
  PROJECT_ID,
  readyBody,
  routedFetchMock,
  TODAY,
  waitForReady,
} from "./work-calendar-client.test-helpers";

/*
  Calendar options (GET /api/calendar/options) lazy-load, cache, and abort
  coverage for WorkCalendarClient, split out of the original single
  work-calendar-client.test.tsx (see
  docs/TEXT2TASK_WORK_CALENDAR_UI_REDESIGN_IMPLEMENTATION_REPORT.md's
  test-isolation section for why). Every test below is a verbatim
  extraction -- no behavior/assertion change.
*/

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorkCalendarClient — Calendar options loading", () => {
  it("makes no options request during initial Calendar page load", async () => {
    const fetchMock = routedFetchMock({});
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    expect(
      fetchMock.mock.calls.some(([url]: unknown[]) => String(url).startsWith("/api/calendar/options"))
    ).toBe(false);
  }, 30000);

  it("an Add open requests no include parameters", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchMock = routedFetchMock({});
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));

    await waitFor(() => {
      const optionsCall = fetchMock.mock.calls.find(([url]: unknown[]) =>
        String(url).startsWith("/api/calendar/options")
      );
      expect(optionsCall).toBeDefined();
      expect(String(optionsCall![0])).toBe("/api/calendar/options");
    });
  }, 30000);

  it("an Edit open includes the event's current linked project/client ids", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({
      id: `event:${EVENT_UUID_A}`,
      date: TODAY,
      title: "Kickoff call",
      projectId: PROJECT_ID,
      clientId: CLIENT_ID,
    });
    const fetchMock = routedFetchMock({ range: () => jsonResponse(readyBody([item])) });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff call" }));

    await waitFor(() => {
      const optionsCall = fetchMock.mock.calls.find(([url]: unknown[]) =>
        String(url).startsWith("/api/calendar/options")
      );
      expect(optionsCall).toBeDefined();
      const url = new URL(String(optionsCall![0]), "http://localhost");
      expect(url.searchParams.get("includeProjectId")).toBe(PROJECT_ID);
      expect(url.searchParams.get("includeClientId")).toBe(CLIENT_ID);
    });
  }, 30000);

  it("omits null linked values from the options request", async () => {
    const user = userEvent.setup({ delay: null });
    const item = manualEvent({ id: `event:${EVENT_UUID_A}`, date: TODAY, title: "Kickoff call" });
    const fetchMock = routedFetchMock({ range: () => jsonResponse(readyBody([item])) });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff call" }));

    await waitFor(() => {
      const optionsCall = fetchMock.mock.calls.find(([url]: unknown[]) =>
        String(url).startsWith("/api/calendar/options")
      );
      expect(String(optionsCall![0])).toBe("/api/calendar/options");
    });
  }, 30000);

  it("reaches the dialog as a loading state while options are pending", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal(
      "fetch",
      routedFetchMock({ options: () => new Promise(() => {}) })
    );
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));

    expect(screen.getByLabelText("Project")).toBeDisabled();
    expect(screen.getByLabelText("Client")).toBeDisabled();
  }, 30000);

  it("reaches the dialog as a failure without closing it, and Retry performs a fresh request that enables the fields", async () => {
    const user = userEvent.setup({ delay: null });
    let optionsCallCount = 0;
    const fetchMock = routedFetchMock({
      options: () => {
        optionsCallCount += 1;
        return optionsCallCount === 1
          ? jsonResponse({ error: "boom" }, { ok: false, status: 500 })
          : jsonResponse(optionsSuccessBody());
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));

    await waitFor(() =>
      expect(screen.getByText("Could not load project and client options.")).toBeInTheDocument()
    );
    expect(screen.getByRole("dialog", { name: "Add event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByLabelText("Project")).not.toBeDisabled());
    expect(optionsCallCount).toBe(2);
  }, 30000);

  it("reuses a cached result for the exact same key and never sends a second request", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchMock = routedFetchMock({});
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(() => expect(screen.getByLabelText("Project")).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(() => expect(screen.getByLabelText("Project")).not.toBeDisabled());

    const optionsCalls = fetchMock.mock.calls.filter(([url]: unknown[]) =>
      String(url).startsWith("/api/calendar/options")
    );
    expect(optionsCalls).toHaveLength(1);
  }, 30000);

  it("performs a new request for a different include key", async () => {
    const user = userEvent.setup({ delay: null });
    const itemA = manualEvent({
      id: `event:${EVENT_UUID_A}`,
      date: TODAY,
      title: "Event A",
      projectId: PROJECT_ID,
      clientId: CLIENT_ID,
    });
    const itemB = manualEvent({
      id: `event:${EVENT_UUID_B}`,
      date: TODAY,
      title: "Event B",
      projectId: OTHER_PROJECT_ID,
      clientId: OTHER_CLIENT_ID,
    });
    const fetchMock = routedFetchMock({ range: () => jsonResponse(readyBody([itemA, itemB])) });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Event A" }));
    await waitFor(() => expect(screen.getByLabelText("Project")).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Event B" }));
    await waitFor(() => expect(screen.getByLabelText("Project")).not.toBeDisabled());

    const optionsCalls = fetchMock.mock.calls.filter(([url]: unknown[]) =>
      String(url).startsWith("/api/calendar/options")
    );
    expect(optionsCalls).toHaveLength(2);
  }, 30000);

  it("a stale options request cannot overwrite a newer dialog's key", async () => {
    const user = userEvent.setup({ delay: null });
    const itemA = manualEvent({
      id: `event:${EVENT_UUID_A}`,
      date: TODAY,
      title: "Event A",
      projectId: PROJECT_ID,
      clientId: CLIENT_ID,
    });
    const itemB = manualEvent({
      id: `event:${EVENT_UUID_B}`,
      date: TODAY,
      title: "Event B",
      projectId: OTHER_PROJECT_ID,
      clientId: OTHER_CLIENT_ID,
    });

    let resolveFirst: (value: Response) => void = () => {};
    let callCount = 0;
    const fetchMock = routedFetchMock({
      range: () => jsonResponse(readyBody([itemA, itemB])),
      options: () => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return jsonResponse(optionsSuccessBody({ clients: [{ id: OTHER_CLIENT_ID, name: "Second" }] }));
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WorkCalendarClient />);
    await waitForReady();

    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Event A" })); // key K1, deferred
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await openDay(user, TODAY);
    await user.click(screen.getByRole("button", { name: "Edit Event B" })); // key K2, resolves fast

    await waitFor(() => expect(screen.getByLabelText("Project")).not.toBeDisabled());

    // K1's request now resolves late; it must not clobber K2's state.
    resolveFirst(jsonResponse(optionsSuccessBody({ clients: [{ id: CLIENT_ID, name: "First (stale)" }] })));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByLabelText("Project")).not.toBeDisabled();
    expect(screen.queryByText("First (stale)")).not.toBeInTheDocument();
  }, 45000);

  it("aborts safely on dialog close, with no lingering error/overlay state", async () => {
    const user = userEvent.setup({ delay: null });
    const observer = captureUnhandledRejections();

    vi.stubGlobal("fetch", routedFetchMock({ options: () => new Promise(() => {}) }));
    render(<WorkCalendarClient />);
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Add event" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    observer.stop();

    expect(observer.rejections).toHaveLength(0);
    expect(screen.queryByText("Could not load project and client options.")).not.toBeInTheDocument();
  }, 30000);
});
