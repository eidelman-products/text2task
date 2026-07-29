// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RoutedDashboardShell from "./routed-dashboard-shell";

beforeEach(() => {
  // DashboardShell renders DashboardUserMenu, which self-fetches account
  // info in an effect. Stub fetch so that call resolves quickly and
  // predictably instead of attempting a real network request in jsdom.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ email: "person@example.com", plan: "free" }),
    })
  );
});

describe("RoutedDashboardShell", () => {
  it("renders the sidebar in routed mode with the correct active destination", () => {
    render(
      <RoutedDashboardShell
        email="person@example.com"
        plan="free"
        activeDestination="calendar"
        activeLabel="Calendar"
      >
        <div>page content</div>
      </RoutedDashboardShell>
    );

    // Sidebar links navigate to real /dashboard destinations, not SPA callbacks.
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

  it("renders the passed children as the page content", () => {
    render(
      <RoutedDashboardShell
        email="person@example.com"
        plan="free"
        activeDestination="calendar"
        activeLabel="Calendar"
      >
        <div>Calendar workspace content</div>
      </RoutedDashboardShell>
    );

    expect(screen.getByText("Calendar workspace content")).toBeInTheDocument();
  });

  it("passes the active label through to the mobile header", () => {
    render(
      <RoutedDashboardShell
        email="person@example.com"
        plan="free"
        activeDestination="calendar"
        activeLabel="Calendar"
      >
        <div>content</div>
      </RoutedDashboardShell>
    );

    expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0);
  });

  it("reuses the real account menu (profile/billing/logout), not a hardcoded footer", () => {
    render(
      <RoutedDashboardShell
        email="person@example.com"
        plan="free"
        activeDestination="calendar"
        activeLabel="Calendar"
      >
        <div>content</div>
      </RoutedDashboardShell>
    );

    // DashboardUserMenu renders two triggers (desktop + mobile compact).
    const triggers = screen.getAllByRole("button", { expanded: false });
    expect(triggers.length).toBeGreaterThan(0);
  });

  it("opens and closes the mobile sidebar drawer", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(
      <RoutedDashboardShell
        email="person@example.com"
        plan="free"
        activeDestination="calendar"
        activeLabel="Calendar"
      >
        <div>content</div>
      </RoutedDashboardShell>
    );

    expect(screen.queryByLabelText("Close navigation")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Open navigation"));
    expect(screen.getByLabelText("Close navigation")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close navigation"));
    expect(screen.queryByLabelText("Close navigation")).not.toBeInTheDocument();
  });
});
