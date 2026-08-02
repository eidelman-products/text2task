// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkCalendarClient } from "./work-calendar-client";
import {
  anotherDayInCurrentMonth,
  jsonResponse,
  openDay,
  readyBody,
  waitForReady,
} from "./work-calendar-client.test-helpers";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

type FetchMock = ReturnType<typeof vi.fn>;

function installCalendarFetchMock(productEventStatus = 204) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.resolve(new Response(null, { status: productEventStatus }));
    }

    if (url.startsWith("/api/calendar/options")) {
      return Promise.resolve(
        jsonResponse({
          success: true,
          projects: [],
          clients: [],
          projectsTruncated: false,
          clientsTruncated: false,
        })
      );
    }

    if (url.startsWith("/api/calendar/events")) {
      return Promise.resolve(jsonResponse({ success: true }));
    }

    return Promise.resolve(jsonResponse(readyBody()));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installCalendarFetchMockWithRangeRetry() {
  let rangeCalls = 0;
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (url.startsWith("/api/calendar?")) {
      rangeCalls += 1;
      return Promise.resolve(
        rangeCalls === 1
          ? jsonResponse(
              { error: "Server unavailable" },
              { ok: false, status: 500 }
            )
          : jsonResponse(readyBody())
      );
    }

    return Promise.resolve(jsonResponse({ success: true }));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installRejectedProductEventFetchMock() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.reject(new TypeError("activity endpoint unavailable"));
    }

    if (url.startsWith("/api/calendar/options")) {
      return Promise.resolve(
        jsonResponse({
          success: true,
          projects: [],
          clients: [],
          projectsTruncated: false,
          clientsTruncated: false,
        })
      );
    }

    return Promise.resolve(jsonResponse(readyBody()));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installRandomUuidMock(...uuids: string[]) {
  const randomUUID = vi.fn();
  for (const uuid of uuids) {
    randomUUID.mockReturnValueOnce(uuid);
  }
  randomUUID.mockReturnValue(uuids[uuids.length - 1] ?? UUID_A);
  vi.stubGlobal("crypto", { randomUUID });
  return randomUUID;
}

function productEventCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === "/api/activity/product-event"
  );
}

function calendarRangeCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).startsWith("/api/calendar?")
  );
}

function productEventBodies(fetchMock: FetchMock) {
  return productEventCalls(fetchMock).map((call) => {
    const init = call[1] as RequestInit;
    return JSON.parse(String(init.body)) as {
      event: {
        eventName: string;
        route: string;
        entityType: string | null;
        entityId: string | null;
      };
      navigationId: string;
    };
  });
}

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setVisibilityState("visible");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WorkCalendarClient authenticated view instrumentation", () => {
  it("visible Calendar mount sends calendar_viewed once with the calendar route", async () => {
    const fetchMock = installCalendarFetchMock();
    installRandomUuidMock(UUID_A);

    render(<WorkCalendarClient />);

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    const [body] = productEventBodies(fetchMock);
    expect(body).toEqual({
      event: {
        eventName: "calendar_viewed",
        route: "/dashboard/calendar",
        entityType: null,
        entityId: null,
      },
      navigationId: UUID_A,
    });
  });

  it("rerendering does not duplicate calendar_viewed", async () => {
    const fetchMock = installCalendarFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);

    const { rerender } = render(<WorkCalendarClient />);
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    rerender(<WorkCalendarClient />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("month changes do not duplicate calendar_viewed", async () => {
    const fetchMock = installCalendarFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitForReady();
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /Next month/i }));
    await waitFor(() => expect(calendarRangeCalls(fetchMock)).toHaveLength(2));

    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("calendar data refresh after Retry does not duplicate calendar_viewed", async () => {
    const fetchMock = installCalendarFetchMockWithRangeRetry();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup();

    render(<WorkCalendarClient />);
    await waitFor(() =>
      expect(screen.getByText("Could not load your calendar")).toBeInTheDocument()
    );
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitForReady();

    expect(calendarRangeCalls(fetchMock)).toHaveLength(2);
    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("date and dialog interactions do not send Phase 4 calendar events", async () => {
    const fetchMock = installCalendarFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup({ delay: null });

    render(<WorkCalendarClient />);
    await waitForReady();
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await openDay(user, anotherDayInCurrentMonth());
    await user.click(screen.getByRole("button", { name: "+ Add event" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(productEventCalls(fetchMock)).toHaveLength(1);
    expect(productEventBodies(fetchMock).map((body) => body.event.eventName)).toEqual([
      "calendar_viewed",
    ]);
    expect(JSON.stringify(productEventBodies(fetchMock))).not.toContain(
      "calendar_day_viewed"
    );
    expect(JSON.stringify(productEventBodies(fetchMock))).not.toContain(
      "calendar_event_viewed"
    );
  }, 30000);

  it("Strict Mode replay does not create a second logical navigation ID", async () => {
    const fetchMock = installCalendarFetchMock();
    const randomUUID = installRandomUuidMock(UUID_A, UUID_B);

    render(
      <StrictMode>
        <WorkCalendarClient />
      </StrictMode>
    );

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(productEventBodies(fetchMock)[0].navigationId).toBe(UUID_A);
  });

  it("hidden mount sends nothing until the calendar tab becomes visible", async () => {
    setVisibilityState("hidden");
    const fetchMock = installCalendarFetchMock();
    installRandomUuidMock(UUID_A);

    render(<WorkCalendarClient />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(0);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(productEventBodies(fetchMock)[0].event.eventName).toBe(
      "calendar_viewed"
    );
  });

  it("analytics failure does not break calendar rendering or interaction", async () => {
    const fetchMock = installRejectedProductEventFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup({ delay: null });

    render(<WorkCalendarClient />);
    await waitForReady();
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /Next month/i }));
    await waitFor(() => expect(calendarRangeCalls(fetchMock)).toHaveLength(2));

    expect(screen.getByRole("button", { name: /Previous month/i })).toBeInTheDocument();
    expect(productEventCalls(fetchMock)).toHaveLength(1);
  }, 30000);
});
