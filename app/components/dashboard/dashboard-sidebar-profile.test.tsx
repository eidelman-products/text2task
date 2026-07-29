// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardSidebarProfile from "./dashboard-sidebar-profile";

describe("DashboardSidebarProfile - workspace mode (rendered inside DashboardClient)", () => {
  it("calls the workspace-view callback, not a navigation, when a nav item is clicked", async () => {
    const user = userEvent.setup();
    const onWorkspaceViewChange = vi.fn();

    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="workspace"
        activeItem={{ kind: "workspace", view: "dashboard" }}
        onWorkspaceViewChange={onWorkspaceViewChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Extract" }));

    expect(onWorkspaceViewChange).toHaveBeenCalledWith("extract");
    expect(screen.queryByRole("link", { name: "Extract" })).not.toBeInTheDocument();
  });

  it("marks exactly the active workspace view active, never more than one", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="workspace"
        activeItem={{ kind: "workspace", view: "tasks" }}
        onWorkspaceViewChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("button", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("button", { name: "Extract" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("renders exactly the three workspace nav items as buttons, plus Calendar as a real link", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="workspace"
        activeItem={{ kind: "workspace", view: "dashboard" }}
        onWorkspaceViewChange={vi.fn()}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Workspace navigation" });
    expect(nav.querySelectorAll("button")).toHaveLength(3);
    expect(nav.querySelectorAll("a")).toHaveLength(1);
  });

  it("renders Calendar as a real link, never active, in workspace mode", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="workspace"
        activeItem={{ kind: "workspace", view: "dashboard" }}
        onWorkspaceViewChange={vi.fn()}
      />
    );

    const calendarLink = screen.getByRole("link", { name: "Calendar" });
    expect(calendarLink).toHaveAttribute("href", "/dashboard/calendar");
    expect(calendarLink).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("button", { name: "Calendar" })).not.toBeInTheDocument();
  });

  it("renders Calendar after Tasks in workspace mode", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="workspace"
        activeItem={{ kind: "workspace", view: "dashboard" }}
        onWorkspaceViewChange={vi.fn()}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Workspace navigation" });
    const items = Array.from(nav.querySelectorAll("button, a")).map(
      (el) => el.textContent
    );
    expect(items).toEqual(["▦Dashboard", "✦Extract", "✓Tasks", "▤Calendar"]);
  });
});

describe("DashboardSidebarProfile - routed mode (rendered inside a routed shell)", () => {
  it("renders Dashboard/Extract/Tasks as real links to their canonical hrefs", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="routed"
        activeItem={{ kind: "routed", destination: "calendar" }}
      />
    );

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
    expect(screen.queryByRole("button", { name: /Dashboard|Extract|Tasks/ })).not
      .toBeInTheDocument();
  });

  it("supports a routed active destination internally: none of the rendered workspace links show as active", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="routed"
        activeItem={{ kind: "routed", destination: "calendar" }}
      />
    );

    for (const name of ["Dashboard", "Extract", "Tasks"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });

  it("uses the same navigation definition (same labels, same order) as workspace mode, plus Calendar last", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="routed"
        activeItem={{ kind: "routed", destination: "calendar" }}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Workspace navigation" });
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual(["▦Dashboard", "✦Extract", "✓Tasks", "▤Calendar"]);
  });

  it("marks the Calendar link active with aria-current when it is the active routed destination", () => {
    render(
      <DashboardSidebarProfile
        email="person@example.com"
        plan="free"
        mode="routed"
        activeItem={{ kind: "routed", destination: "calendar" }}
      />
    );

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/dashboard/calendar"
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    for (const name of ["Dashboard", "Extract", "Tasks"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });
});

describe("DashboardSidebarProfile - account/workspace card (unchanged by mode)", () => {
  it("shows the real email-derived display name and free-plan label, never hardcoded", () => {
    render(
      <DashboardSidebarProfile
        email="alex.rivera@example.com"
        plan="free"
        mode="workspace"
        activeItem={{ kind: "workspace", view: "dashboard" }}
        onWorkspaceViewChange={vi.fn()}
      />
    );

    expect(screen.getByText("alex rivera")).toBeInTheDocument();
    expect(screen.getByText("Free workspace")).toBeInTheDocument();
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
  });

  it("shows the Pro badge and hides the upgrade button for a pro plan", () => {
    render(
      <DashboardSidebarProfile
        email="alex.rivera@example.com"
        plan="pro"
        mode="routed"
        activeItem={{ kind: "routed", destination: "calendar" }}
      />
    );

    expect(screen.getByText("Pro workspace")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
  });
});
