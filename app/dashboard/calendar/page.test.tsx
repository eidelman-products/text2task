// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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
      json: () => Promise.resolve({ email: "person@example.com", plan: "free" }),
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

  it("makes no request to any Calendar API endpoint", async () => {
    const page = await CalendarPage();
    render(page);

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const calendarApiCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/calendar")
    );
    expect(calendarApiCalls).toHaveLength(0);
  });

  it("does not show a visible Calendar nav item in the sidebar", async () => {
    const page = await CalendarPage();
    render(page);

    // The only "Calendar" text on the page should be the H1 (a heading, not
    // a nav link/button) and the mobile header's active-section label.
    expect(
      screen.queryByRole("link", { name: "Calendar" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Calendar" })
    ).not.toBeInTheDocument();
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

  it("does not render any interactive Calendar controls (no add-event button, no filters)", async () => {
    const page = await CalendarPage();
    render(page);

    expect(screen.queryByRole("button", { name: /add event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});
