import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: rpcMock,
  },
}));

const {
  isOwnerAuthenticatedActivityUuid,
  loadOwnerAuthenticatedActivitySummary,
  loadOwnerUserActivityTimeline,
} = await import("./owner-authenticated-activity.server");

function userId(index: number) {
  return `00000000-0000-4000-8000-${index
    .toString(16)
    .padStart(12, "0")
    .slice(-12)}`;
}

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: [], error: null });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("owner authenticated activity UUID validation", () => {
  it("accepts only real UUIDs for owner cross-user reads", () => {
    expect(isOwnerAuthenticatedActivityUuid(userId(1))).toBe(true);
    expect(isOwnerAuthenticatedActivityUuid("not-a-uuid")).toBe(false);
    expect(isOwnerAuthenticatedActivityUuid("../dashboard")).toBe(false);
  });
});

describe("loadOwnerAuthenticatedActivitySummary", () => {
  it("loads the summary through the owner RPC once with deduped valid ids", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          user_id: userId(1),
          last_seen_at: "2026-08-03T10:00:00.000Z",
          last_viewed_route: "/dashboard/calendar",
          last_event_name: "calendar_viewed",
          total_authenticated_views: 4,
          distinct_active_days: 2,
          is_returning: true,
        },
      ],
      error: null,
    });

    const result = await loadOwnerAuthenticatedActivitySummary([
      userId(1),
      "not-a-uuid",
      userId(1),
      userId(2),
    ]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "get_owner_authenticated_activity_summary",
      { p_user_ids: [userId(1), userId(2)] }
    );
    expect(result).toEqual({
      status: "ready",
      rows: [
        {
          userId: userId(1),
          lastSeenAt: "2026-08-03T10:00:00.000Z",
          lastViewedRoute: "/dashboard/calendar",
          lastEventName: "calendar_viewed",
          totalAuthenticatedViews: 4,
          distinctActiveDays: 2,
          isReturning: true,
        },
      ],
    });
  });

  it("caps the summary request at 2,000 users", async () => {
    const ids = Array.from({ length: 2005 }, (_value, index) =>
      userId(index + 1)
    );

    await loadOwnerAuthenticatedActivitySummary(ids);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0]?.[1]).toEqual({
      p_user_ids: ids.slice(0, 2000),
    });
  });

  it("returns ready empty rows without an RPC when no valid ids are present", async () => {
    const result = await loadOwnerAuthenticatedActivitySummary(["bad"]);

    expect(result).toEqual({ status: "ready", rows: [] });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("skips malformed summary rows without failing valid rows", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          user_id: userId(1),
          last_seen_at: "2026-08-03T10:00:00.000Z",
          last_viewed_route: "/dashboard",
          last_event_name: "dashboard_viewed",
          total_authenticated_views: 1,
          distinct_active_days: 1,
          is_returning: false,
        },
        {
          user_id: userId(2),
          last_seen_at: "not-a-date",
          last_viewed_route: "/dashboard",
          last_event_name: "dashboard_viewed",
          total_authenticated_views: 1,
          distinct_active_days: 1,
          is_returning: false,
        },
      ],
      error: null,
    });

    const result = await loadOwnerAuthenticatedActivitySummary([userId(1)]);

    expect(result).toEqual({
      status: "ready",
      rows: [
        {
          userId: userId(1),
          lastSeenAt: "2026-08-03T10:00:00.000Z",
          lastViewedRoute: "/dashboard",
          lastEventName: "dashboard_viewed",
          totalAuthenticatedViews: 1,
          distinctActiveDays: 1,
          isReturning: false,
        },
      ],
    });
  });

  it("isolates summary RPC failures as unavailable", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    await expect(
      loadOwnerAuthenticatedActivitySummary([userId(1)])
    ).resolves.toEqual({ status: "unavailable", rows: [] });
  });
});

describe("loadOwnerUserActivityTimeline", () => {
  it("loads only the requested user timeline through the owner RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          created_at: "2026-08-03T10:00:00.000Z",
          event_name: "project_details_expanded",
          route: "/dashboard",
          entity_type: "project",
          entity_id: userId(9),
        },
      ],
      error: null,
    });

    const result = await loadOwnerUserActivityTimeline(userId(1));

    expect(rpcMock).toHaveBeenCalledWith("get_owner_user_activity_timeline", {
      p_user_id: userId(1),
      p_limit: 200,
    });
    expect(result).toEqual({
      status: "ready",
      rows: [
        {
          createdAt: "2026-08-03T10:00:00.000Z",
          eventName: "project_details_expanded",
          route: "/dashboard",
          entityType: "project",
          entityId: userId(9),
        },
      ],
    });
  });

  it("clamps the timeline limit to the RPC maximum", async () => {
    await loadOwnerUserActivityTimeline(userId(1), 999);

    expect(rpcMock.mock.calls[0]?.[1]).toEqual({
      p_user_id: userId(1),
      p_limit: 500,
    });
  });

  it("skips timeline rows with invalid event/entity combinations", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          created_at: "2026-08-03T10:00:00.000Z",
          event_name: "calendar_day_viewed",
          route: "/dashboard/calendar",
          entity_type: "calendar_day",
          entity_id: "2026-08-03",
        },
        {
          created_at: "2026-08-03T10:01:00.000Z",
          event_name: "dashboard_viewed",
          route: "/dashboard",
          entity_type: "project",
          entity_id: userId(9),
        },
      ],
      error: null,
    });

    const result = await loadOwnerUserActivityTimeline(userId(1));

    expect(result).toEqual({
      status: "ready",
      rows: [
        {
          createdAt: "2026-08-03T10:00:00.000Z",
          eventName: "calendar_day_viewed",
          route: "/dashboard/calendar",
          entityType: "calendar_day",
          entityId: "2026-08-03",
        },
      ],
    });
  });

  it("does not query when the timeline user id is invalid", async () => {
    await expect(loadOwnerUserActivityTimeline("bad-id")).resolves.toEqual({
      status: "unavailable",
      rows: [],
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("owner authenticated activity read layer architecture", () => {
  it("is server-only and reads only through the two owner RPCs", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/activity/owner-authenticated-activity.server.ts"),
      "utf8"
    );

    expect(source).toContain('import "server-only"');
    expect(source).toContain("get_owner_authenticated_activity_summary");
    expect(source).toContain("get_owner_user_activity_timeline");
    expect(source).not.toContain(".from(");
    expect(source).not.toContain("analytics_events");
    expect(source).not.toContain("authenticated_product_events");
  });
});
