import { afterEach, describe, expect, it } from "vitest";

import {
  getOwnerActivityUserIds,
  latestOf,
  mergeUserActivity,
} from "./owner-user-activity-merge";
import type {
  AuthUserSummary,
  OwnerActivityReport,
} from "./owner-user-activity-types";

const USER_ONE = "00000000-0000-4000-8000-000000000001";
const USER_TWO = "00000000-0000-4000-8000-000000000002";
const USER_THREE = "00000000-0000-4000-8000-000000000003";

afterEach(() => {
  delete process.env.TEXT2TASK_OWNER_EMAILS;
});

function authUser(overrides: Partial<AuthUserSummary> = {}): AuthUserSummary {
  return {
    id: USER_ONE,
    email: "person@example.com",
    createdAt: "2026-08-01T08:00:00.000Z",
    emailConfirmedAt: "2026-08-01T08:05:00.000Z",
    lastSignInAt: "2026-08-01T09:00:00.000Z",
    provider: "email",
    ...overrides,
  };
}

const activityReport: OwnerActivityReport = {
  totalProfiles: 1,
  rows: [
    {
      id: USER_ONE,
      plan: "pro",
      subscriptionStatus: "active",
      extractCount: 3,
      successfulExtractCount: 2,
      lastExtractAt: "2026-08-01T11:00:00.000Z",
      lastDashboardSeenAt: "2026-08-01T10:00:00.000Z",
      profileCreatedAt: "2026-08-01T08:30:00.000Z",
      projectCount: 4,
      firstProjectAt: "2026-08-01T10:30:00.000Z",
      lastProjectAt: "2026-08-01T12:00:00.000Z",
    },
  ],
};

describe("latestOf", () => {
  it("returns the latest valid timestamp and ignores null or invalid values", () => {
    expect(
      latestOf(
        null,
        "not-a-date",
        "2026-08-01T12:00:00.000Z",
        "2026-08-02T12:00:00.000Z"
      )
    ).toBe("2026-08-02T12:00:00.000Z");
  });
});

describe("getOwnerActivityUserIds", () => {
  it("dedupes auth and profile ids before the authenticated summary RPC", () => {
    expect(
      getOwnerActivityUserIds(
        [authUser({ id: USER_ONE }), authUser({ id: USER_TWO })],
        {
          totalProfiles: 2,
          rows: [
            activityReport.rows[0],
            { ...activityReport.rows[0], id: USER_THREE },
          ],
        }
      )
    ).toEqual([USER_ONE, USER_TWO, USER_THREE]);
  });
});

describe("mergeUserActivity", () => {
  it("merges authenticated activity fields and uses last authenticated view as activity", () => {
    const rows = mergeUserActivity([authUser()], activityReport, [
      {
        userId: USER_ONE,
        lastSeenAt: "2026-08-03T10:00:00.000Z",
        lastViewedRoute: "/dashboard/calendar",
        lastEventName: "calendar_viewed",
        totalAuthenticatedViews: 7,
        distinctActiveDays: 3,
        isReturning: true,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      authenticatedLastSeenAt: "2026-08-03T10:00:00.000Z",
      authenticatedLastViewedRoute: "/dashboard/calendar",
      authenticatedLastEventName: "calendar_viewed",
      totalAuthenticatedViews: 7,
      authenticatedActiveDays: 3,
      isAuthenticatedReturningUser: true,
      lastActivityAt: "2026-08-03T10:00:00.000Z",
    });
  });

  it("defaults authenticated activity fields when the summary has no row", () => {
    const rows = mergeUserActivity([authUser()], activityReport);

    expect(rows[0]).toMatchObject({
      authenticatedLastSeenAt: null,
      authenticatedLastViewedRoute: null,
      authenticatedLastEventName: null,
      totalAuthenticatedViews: 0,
      authenticatedActiveDays: 0,
      isAuthenticatedReturningUser: false,
    });
  });

  it("includes users that only appear in authenticated activity", () => {
    const rows = mergeUserActivity(null, null, [
      {
        userId: USER_TWO,
        lastSeenAt: "2026-08-03T10:00:00.000Z",
        lastViewedRoute: "/dashboard",
        lastEventName: "dashboard_viewed",
        totalAuthenticatedViews: 1,
        distinctActiveDays: 1,
        isReturning: false,
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: USER_TWO,
        email: null,
        hasProfile: false,
        lastActivityAt: "2026-08-03T10:00:00.000Z",
      }),
    ]);
  });

  it("marks owner/test accounts by configured owner email", () => {
    process.env.TEXT2TASK_OWNER_EMAILS = "owner@example.com";

    const rows = mergeUserActivity(
      [authUser({ email: "owner@example.com" })],
      null
    );

    expect(rows[0]?.isOwnerOrTest).toBe(true);
  });
});
