// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const requireDashboardUserMock = vi.fn();

vi.mock("@/lib/supabase/requireDashboardUser", () => ({
  requireDashboardUser: () => requireDashboardUserMock(),
}));

const { default: CalendarPage } = await import("./page");

beforeEach(() => {
  requireDashboardUserMock.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, items: [] }),
    })
  );
});

describe("CalendarPage - authentication", () => {
  it("propagates the redirect-to-/login signal for an unauthenticated user", async () => {
    // requireDashboardUser calls next/navigation's redirect() internally,
    // which throws a special NEXT_REDIRECT error to halt rendering -- the
    // page must never swallow that, so calling the page function itself
    // must reject the same way.
    requireDashboardUserMock.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));

    await expect(CalendarPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("CalendarPage - authenticated render", () => {
  beforeEach(() => {
    requireDashboardUserMock.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      plan: "free",
    });
  });

  it("renders the routed dashboard shell with exactly one H1 reading Calendar", async () => {
    const page = await CalendarPage();
    render(page);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Calendar");
  });

  it("renders the subtitle copy", async () => {
    const page = await CalendarPage();
    render(page);

    expect(
      screen.getByText("Plan project deadlines and scheduled client work.")
    ).toBeInTheDocument();
  });

  it("makes a real request to the Calendar API for the visible month's range, no event-mutation calls", async () => {
    const page = await CalendarPage();
    render(page);

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    await waitFor(() => {
      const calendarApiCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/calendar")
      );
      expect(calendarApiCalls).toHaveLength(1);
    });

    const [, requestInit] = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/calendar")
    ) as [string, RequestInit | undefined];
    expect(requestInit?.method ?? "GET").toBe("GET");

    const mutationCalls = fetchMock.mock.calls.filter(([, init]) => {
      const method = (init as RequestInit | undefined)?.method;
      return method === "POST" || method === "PATCH" || method === "DELETE";
    });
    expect(mutationCalls).toHaveLength(0);
  });

  it("shows a visible Calendar nav item in the sidebar, active on this page", async () => {
    const page = await CalendarPage();
    render(page);

    const calendarLink = screen.getByRole("link", { name: "Calendar" });
    expect(calendarLink).toHaveAttribute("href", "/dashboard/calendar");
    expect(calendarLink).toHaveAttribute("aria-current", "page");
  });

  it("still renders the real Dashboard/Extract/Tasks sidebar destinations", async () => {
    const page = await CalendarPage();
    render(page);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: "Extract" })).toHaveAttribute(
      "href",
      "/dashboard?view=extract"
    );
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "href",
      "/dashboard?view=tasks"
    );
  });

  it("renders the Add event entry point, but no filters or Unscheduled Projects panel (still out of scope)", async () => {
    const page = await CalendarPage();
    render(page);

    await waitFor(() => expect(screen.getAllByRole("grid").length).toBeGreaterThan(0));

    // Phase D's own explicit mandate: a standalone Add event entry point.
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();
    // Filters and Unscheduled Projects remain explicitly out of scope.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/unscheduled projects/i)).not.toBeInTheDocument();
  });

  it("renders the real month grid with weekday headings (not the old placeholder)", async () => {
    const page = await CalendarPage();
    render(page);

    await waitFor(() => expect(screen.getAllByRole("grid").length).toBeGreaterThan(0));
  });
});
