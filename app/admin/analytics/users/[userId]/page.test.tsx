// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOwnerMock = vi.fn();
const isOwnerEmailMock = vi.fn();
const getUserByIdMock = vi.fn();
const loadTimelineMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/auth/owner.server", () => ({
  requireOwner: () => requireOwnerMock(),
  isOwnerEmail: (email: string | null | undefined) => isOwnerEmailMock(email),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: getUserByIdMock,
      },
    },
  },
}));

vi.mock("@/lib/activity/owner-authenticated-activity.server", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/activity/owner-authenticated-activity.server")
  >("@/lib/activity/owner-authenticated-activity.server");

  return {
    ...actual,
    loadOwnerUserActivityTimeline: (
      userId: string,
      limit: number | undefined
    ) => loadTimelineMock(userId, limit),
  };
});

const Page = (await import("./page")).default;

const USER_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-000000000009";
const CALENDAR_EVENT_ID = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  requireOwnerMock.mockReset();
  requireOwnerMock.mockResolvedValue(undefined);
  isOwnerEmailMock.mockReset();
  isOwnerEmailMock.mockReturnValue(false);
  getUserByIdMock.mockReset();
  getUserByIdMock.mockResolvedValue({
    data: {
      user: {
        id: USER_ID,
        email: "person@example.com",
        created_at: "2026-08-01T08:00:00.000Z",
        app_metadata: { provider: "email" },
      },
    },
    error: null,
  });
  loadTimelineMock.mockReset();
  loadTimelineMock.mockResolvedValue({ status: "ready", rows: [] });
  notFoundMock.mockClear();
});

describe("/admin/analytics/users/[userId]", () => {
  it("calls requireOwner before reading the dynamic user id", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/admin/analytics/users/[userId]/page.tsx"),
      "utf8"
    );

    expect(source.indexOf("await requireOwner();")).toBeGreaterThan(-1);
    expect(source.indexOf("await requireOwner();")).toBeLessThan(
      source.indexOf("const { userId } = await params;")
    );
  });

  it("404s invalid UUID params before Auth Admin or timeline reads", async () => {
    await expect(
      Page({ params: Promise.resolve({ userId: "not-a-uuid" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireOwnerMock).toHaveBeenCalledTimes(1);
    expect(getUserByIdMock).not.toHaveBeenCalled();
    expect(loadTimelineMock).not.toHaveBeenCalled();
  });

  it("404s nonexistent Auth Admin users", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      Page({ params: Promise.resolve({ userId: USER_ID }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getUserByIdMock).toHaveBeenCalledWith(USER_ID);
    expect(loadTimelineMock).not.toHaveBeenCalled();
  });

  it("renders the latest authenticated product timeline with safe entity context", async () => {
    loadTimelineMock.mockResolvedValue({
      status: "ready",
      rows: [
        {
          createdAt: "2026-08-03T10:00:00.000Z",
          eventName: "project_details_expanded",
          route: "/dashboard",
          entityType: "project",
          entityId: PROJECT_ID,
        },
        {
          createdAt: "2026-08-03T09:00:00.000Z",
          eventName: "calendar_event_viewed",
          route: "/dashboard/calendar",
          entityType: "calendar_event",
          entityId: CALENDAR_EVENT_ID,
        },
        {
          createdAt: "2026-08-03T08:00:00.000Z",
          eventName: "calendar_day_viewed",
          route: "/dashboard/calendar",
          entityType: "calendar_day",
          entityId: "2026-08-03",
        },
      ],
    });

    render(await Page({ params: Promise.resolve({ userId: USER_ID }) }));

    expect(loadTimelineMock).toHaveBeenCalledWith(USER_ID, 200);
    expect(screen.getByText("Project details opened")).toBeInTheDocument();
    expect(screen.getByText("Project 00000000...0009")).toBeInTheDocument();
    expect(screen.getByText("Calendar event viewed")).toBeInTheDocument();
    expect(
      screen.getByText("Calendar event 00000000...0010")
    ).toBeInTheDocument();
    expect(screen.getByText("Calendar day viewed")).toBeInTheDocument();
    expect(screen.getByText("2026-08-03")).toBeInTheDocument();
    expect(screen.queryByText(PROJECT_ID)).not.toBeInTheDocument();
  });

  it("renders owner/test badge and unavailable fallback without hiding the user", async () => {
    isOwnerEmailMock.mockReturnValue(true);
    loadTimelineMock.mockResolvedValue({ status: "unavailable", rows: [] });

    render(await Page({ params: Promise.resolve({ userId: USER_ID }) }));

    expect(screen.getByText("owner/test")).toBeInTheDocument();
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("Authenticated activity is temporarily unavailable.")
    ).toBeInTheDocument();
  });

  it("renders the empty timeline state", async () => {
    render(await Page({ params: Promise.resolve({ userId: USER_ID }) }));

    expect(
      screen.getByText("No authenticated product views recorded.")
    ).toBeInTheDocument();
  });
});
