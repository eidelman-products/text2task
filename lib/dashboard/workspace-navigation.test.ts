import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_WORKSPACE_VIEW,
  getDashboardRoutedHref,
  getDashboardWorkspaceHref,
  getDashboardWorkspaceViewLabel,
  isRoutedDestinationActive,
  isWorkspaceViewActive,
  parseDashboardWorkspaceView,
  type DashboardActiveNavItem,
} from "./workspace-navigation";

describe("parseDashboardWorkspaceView", () => {
  it("parses each valid workspace view", () => {
    expect(parseDashboardWorkspaceView("dashboard")).toBe("dashboard");
    expect(parseDashboardWorkspaceView("extract")).toBe("extract");
    expect(parseDashboardWorkspaceView("tasks")).toBe("tasks");
  });

  it("rejects invalid values and falls back to the default view", () => {
    expect(parseDashboardWorkspaceView("calendar")).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView("EXTRACT")).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView("not-a-view")).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView("")).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
  });

  it("rejects non-string input without throwing", () => {
    expect(parseDashboardWorkspaceView(undefined)).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView(null)).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView(42)).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView(["extract"])).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
    expect(parseDashboardWorkspaceView({})).toBe(DEFAULT_DASHBOARD_WORKSPACE_VIEW);
  });

  it("default view is dashboard", () => {
    expect(DEFAULT_DASHBOARD_WORKSPACE_VIEW).toBe("dashboard");
  });
});

describe("getDashboardWorkspaceHref", () => {
  it("the default view omits the query parameter", () => {
    expect(getDashboardWorkspaceHref("dashboard")).toBe("/dashboard");
  });

  it("non-default views include a validated query parameter", () => {
    expect(getDashboardWorkspaceHref("extract")).toBe("/dashboard?view=extract");
    expect(getDashboardWorkspaceHref("tasks")).toBe("/dashboard?view=tasks");
  });
});

describe("getDashboardRoutedHref", () => {
  it("resolves the calendar destination to its real route", () => {
    expect(getDashboardRoutedHref("calendar")).toBe("/dashboard/calendar");
  });
});

describe("getDashboardWorkspaceViewLabel", () => {
  it("returns a human label for each view", () => {
    expect(getDashboardWorkspaceViewLabel("dashboard")).toBe("Dashboard");
    expect(getDashboardWorkspaceViewLabel("extract")).toBe("Extract");
    expect(getDashboardWorkspaceViewLabel("tasks")).toBe("Tasks");
  });
});

describe("isWorkspaceViewActive / isRoutedDestinationActive", () => {
  it("a workspace active item matches only its own view", () => {
    const active: DashboardActiveNavItem = { kind: "workspace", view: "extract" };

    expect(isWorkspaceViewActive(active, "extract")).toBe(true);
    expect(isWorkspaceViewActive(active, "dashboard")).toBe(false);
    expect(isWorkspaceViewActive(active, "tasks")).toBe(false);
  });

  it("a routed active item never matches any workspace view", () => {
    const active: DashboardActiveNavItem = { kind: "routed", destination: "calendar" };

    expect(isWorkspaceViewActive(active, "dashboard")).toBe(false);
    expect(isWorkspaceViewActive(active, "extract")).toBe(false);
    expect(isWorkspaceViewActive(active, "tasks")).toBe(false);
  });

  it("a routed active item matches only its own destination", () => {
    const active: DashboardActiveNavItem = { kind: "routed", destination: "calendar" };

    expect(isRoutedDestinationActive(active, "calendar")).toBe(true);
  });

  it("a workspace active item never matches any routed destination", () => {
    const active: DashboardActiveNavItem = { kind: "workspace", view: "dashboard" };

    expect(isRoutedDestinationActive(active, "calendar")).toBe(false);
  });
});
