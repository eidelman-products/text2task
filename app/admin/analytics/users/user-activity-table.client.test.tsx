// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import UserActivityTable from "./user-activity-table.client";
import type { OwnerUserActivityRow } from "./owner-user-activity-types";

const USER_ONE = "00000000-0000-4000-8000-000000000001";
const USER_TWO = "00000000-0000-4000-8000-000000000002";

function row(overrides: Partial<OwnerUserActivityRow> = {}): OwnerUserActivityRow {
  return {
    id: USER_ONE,
    email: "person@example.com",
    signupAt: "2026-08-01T08:00:00.000Z",
    emailConfirmedAt: "2026-08-01T08:05:00.000Z",
    provider: "email",
    lastSignInAt: "2026-08-01T09:00:00.000Z",
    hasProfile: true,
    plan: "free",
    subscriptionStatus: null,
    extractCount: 1,
    successfulExtractCount: 1,
    lastExtractAt: "2026-08-01T11:00:00.000Z",
    lastDashboardSeenAt: "2026-08-01T10:00:00.000Z",
    projectCount: 1,
    lastProjectAt: "2026-08-01T12:00:00.000Z",
    authenticatedLastSeenAt: "2026-08-03T10:00:00.000Z",
    authenticatedLastViewedRoute: "/dashboard/calendar",
    authenticatedLastEventName: "calendar_viewed",
    totalAuthenticatedViews: 3,
    authenticatedActiveDays: 2,
    isAuthenticatedReturningUser: true,
    lastActivityAt: "2026-08-03T10:00:00.000Z",
    isOwnerOrTest: false,
    ...overrides,
  };
}

function statValue(label: string) {
  const article = screen.getByText(label).closest("article");

  if (!article) {
    throw new Error(`Missing stat card for ${label}`);
  }

  const value = article.querySelector("strong");

  if (!value) {
    throw new Error(`Missing stat value for ${label}`);
  }

  return value.textContent;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("UserActivityTable authenticated activity", () => {
  it("renders compact authenticated activity labels, usage, route, and timeline links", () => {
    render(<UserActivityTable rows={[row()]} />);

    expect(screen.getByText("Calendar viewed")).toBeInTheDocument();
    expect(screen.queryByText("calendar_viewed")).not.toBeInTheDocument();
    expect(screen.getByText("/dashboard/calendar")).toBeInTheDocument();
    expect(screen.getByText("3 views")).toBeInTheDocument();
    expect(screen.getByText("2 active days")).toBeInTheDocument();
    expect(screen.getAllByText("Returning").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View timeline" })).toHaveAttribute(
      "href",
      `/admin/analytics/users/${USER_ONE}`
    );
  });

  it("adds only the two authenticated summary cards and excludes owner/test by default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));

    render(
      <UserActivityTable
        rows={[
          row(),
          row({
            id: USER_TWO,
            email: "owner@example.com",
            isOwnerOrTest: true,
            totalAuthenticatedViews: 12,
            authenticatedActiveDays: 5,
            isAuthenticatedReturningUser: true,
          }),
        ]}
      />
    );

    expect(statValue("Authenticated active last 7 days")).toBe("1");
    expect(statValue("Returning users")).toBe("1");
    expect(screen.queryByText("owner@example.com")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show owner/test accounts"));

    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(statValue("Authenticated active last 7 days")).toBe("2");
    expect(statValue("Returning users")).toBe("2");
  });

  it("filters by Viewed app and Returning without changing existing filters", () => {
    render(
      <UserActivityTable
        rows={[
          row({ email: "viewer@example.com" }),
          row({
            id: USER_TWO,
            email: "quiet@example.com",
            authenticatedLastSeenAt: null,
            authenticatedLastViewedRoute: null,
            authenticatedLastEventName: null,
            totalAuthenticatedViews: 0,
            authenticatedActiveDays: 0,
            isAuthenticatedReturningUser: false,
            lastActivityAt: "2026-08-01T12:00:00.000Z",
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Viewed app" }));

    expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    expect(screen.queryByText("quiet@example.com")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Returning" }));

    expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    expect(screen.queryByText("quiet@example.com")).not.toBeInTheDocument();
  });

  it("shows the authenticated activity unavailable state without hiding rows", () => {
    render(
      <UserActivityTable
        rows={[row()]}
        authenticatedActivityUnavailable={true}
      />
    );

    expect(
      screen.getByText("Authenticated activity is temporarily unavailable.")
    ).toBeInTheDocument();
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
  });
});
