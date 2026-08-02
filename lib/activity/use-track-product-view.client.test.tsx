// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import {
  sendProductViewEvent,
  useTrackProductView,
} from "@/lib/activity/use-track-product-view.client";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FetchMock = ReturnType<typeof vi.fn>;
type TrackableView =
  | { eventName: "dashboard_viewed"; route: "/dashboard" }
  | { eventName: "extract_viewed"; route: "/dashboard" }
  | { eventName: "tasks_viewed"; route: "/dashboard" }
  | { eventName: "calendar_viewed"; route: "/dashboard/calendar" }
  | {
      eventName:
        | "project_details_expanded"
        | "project_resources_viewed"
        | "project_history_viewed"
        | "client_update_opened";
      route: "/dashboard";
      entityType: "project";
      entityId: string;
    }
  | {
      eventName: "calendar_day_viewed";
      route: "/dashboard/calendar";
      entityType: "calendar_day";
      entityId: string;
    }
  | {
      eventName: "calendar_event_viewed";
      route: "/dashboard/calendar";
      entityType: "calendar_event";
      entityId: string;
    };

function installFetchMock(responseStatus = 204) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: responseStatus }));
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

function parseOnlyBody(fetchMock: FetchMock): Record<string, unknown> {
  const firstCall = fetchMock.mock.calls[0];
  expect(firstCall).toBeDefined();
  const init = firstCall[1] as RequestInit;
  expect(typeof init.body).toBe("string");
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

function getEventBody(body: Record<string, unknown>): Record<string, unknown> {
  const event = body.event;
  expect(event).toBeDefined();
  expect(typeof event).toBe("object");
  expect(event).not.toBeNull();
  return event as Record<string, unknown>;
}

function TrackingProbe(props: TrackableView & { active?: boolean }) {
  useTrackProductView(props);
  return <div>tracked</div>;
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

describe("sendProductViewEvent", () => {
  it("sends the exact strict Phase 2 envelope and transport options", () => {
    const fetchMock = installFetchMock();

    sendProductViewEvent({
      eventName: "dashboard_viewed",
      route: "/dashboard",
      navigationId: UUID_A,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/activity/product-event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        event: {
          eventName: "dashboard_viewed",
          route: "/dashboard",
          entityType: null,
          entityId: null,
        },
        navigationId: UUID_A,
      }),
      credentials: "same-origin",
      keepalive: true,
    });
  });

  it("does not send identity, timestamps, idempotency, metadata, or arbitrary content", () => {
    const fetchMock = installFetchMock();

    sendProductViewEvent({
      eventName: "tasks_viewed",
      route: "/dashboard",
      navigationId: UUID_A,
    });

    const body = parseOnlyBody(fetchMock);
    const event = getEventBody(body);

    expect(Object.keys(body).sort()).toEqual(["event", "navigationId"]);
    expect(Object.keys(event).sort()).toEqual([
      "entityId",
      "entityType",
      "eventName",
      "route",
    ]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("user_id");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("createdAt");
    expect(serialized).not.toContain("idempotencyKey");
    expect(serialized).not.toContain("metadata");
    expect(serialized).not.toContain("clientMessage");
    expect(serialized).not.toContain("taskText");
    expect(serialized).not.toContain("projectSummary");
  });

  it("always sends null entity fields for Phase 3 product-view events", () => {
    const fetchMock = installFetchMock();

    const events: TrackableView[] = [
      { eventName: "dashboard_viewed", route: "/dashboard" },
      { eventName: "extract_viewed", route: "/dashboard" },
      { eventName: "tasks_viewed", route: "/dashboard" },
      { eventName: "calendar_viewed", route: "/dashboard/calendar" },
    ];

    for (const event of events) {
      sendProductViewEvent({ ...event, navigationId: UUID_A });
    }

    expect(fetchMock).toHaveBeenCalledTimes(events.length);
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit;
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const event = getEventBody(body);
      expect(event.entityType).toBeNull();
      expect(event.entityId).toBeNull();
    }
  });

  it("sends project entity events with only the approved entity fields", () => {
    const fetchMock = installFetchMock();

    sendProductViewEvent({
      eventName: "project_resources_viewed",
      route: "/dashboard",
      entityType: "project",
      entityId: UUID_A,
      navigationId: UUID_B,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = parseOnlyBody(fetchMock);
    expect(body).toEqual({
      event: {
        eventName: "project_resources_viewed",
        route: "/dashboard",
        entityType: "project",
        entityId: UUID_A,
      },
      navigationId: UUID_B,
    });
  });

  it("sends calendar day and calendar event entities with their strict ids", () => {
    const fetchMock = installFetchMock();

    sendProductViewEvent({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: "2026-08-03",
      navigationId: UUID_A,
    });
    sendProductViewEvent({
      eventName: "calendar_event_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_event",
      entityId: UUID_B,
      navigationId: UUID_A,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body))
    );
    expect(bodies[0].event.entityType).toBe("calendar_day");
    expect(bodies[0].event.entityId).toBe("2026-08-03");
    expect(bodies[1].event.entityType).toBe("calendar_event");
    expect(bodies[1].event.entityId).toBe(UUID_B);
  });

  it("does not send malformed entity ids", () => {
    const fetchMock = installFetchMock();

    sendProductViewEvent({
      eventName: "project_details_expanded",
      route: "/dashboard",
      entityType: "project",
      entityId: "not-a-project-uuid",
      navigationId: UUID_A,
    });
    sendProductViewEvent({
      eventName: "calendar_day_viewed",
      route: "/dashboard/calendar",
      entityType: "calendar_day",
      entityId: "2026-02-30",
      navigationId: UUID_A,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401, 413, 415, 503])(
    "does not throw or retry when the endpoint responds %i",
    async (status) => {
      const fetchMock = installFetchMock(status);

      expect(() =>
        sendProductViewEvent({
          eventName: "extract_viewed",
          route: "/dashboard",
          navigationId: UUID_A,
        })
      ).not.toThrow();

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    }
  );

  it("swallows fetch rejection locally and does not retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      sendProductViewEvent({
        eventName: "calendar_viewed",
        route: "/dashboard/calendar",
        navigationId: UUID_A,
      })
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useTrackProductView", () => {
  it("generates a valid navigationId for a visible product view", async () => {
    const fetchMock = installFetchMock();

    render(<TrackingProbe eventName="dashboard_viewed" route="/dashboard" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = parseOnlyBody(fetchMock);
    expect(String(body.navigationId)).toMatch(UUID_PATTERN);
  });

  it("does not duplicate a rerender of the same logical view", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);

    const { rerender } = render(
      <TrackingProbe eventName="dashboard_viewed" route="/dashboard" />
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<TrackingProbe eventName="dashboard_viewed" route="/dashboard" />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the same logical navigationId across Strict Mode effect replay", async () => {
    const fetchMock = installFetchMock();
    const randomUUID = installRandomUuidMock(UUID_A, UUID_B);

    render(
      <StrictMode>
        <TrackingProbe eventName="tasks_viewed" route="/dashboard" />
      </StrictMode>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(parseOnlyBody(fetchMock).navigationId).toBe(UUID_A);
  });

  it("uses a new navigationId for a later legitimate view", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);

    const { rerender } = render(
      <TrackingProbe eventName="dashboard_viewed" route="/dashboard" />
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<TrackingProbe eventName="extract_viewed" route="/dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstBody = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body)
    ) as Record<string, unknown>;
    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body)
    ) as Record<string, unknown>;

    expect(firstBody.navigationId).toBe(UUID_A);
    expect(secondBody.navigationId).toBe(UUID_B);
  });

  it("defers a hidden-tab mount until the document becomes visible", async () => {
    setVisibilityState("hidden");
    const fetchMock = installFetchMock();
    installRandomUuidMock(UUID_A);

    render(<TrackingProbe eventName="calendar_viewed" route="/dashboard/calendar" />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(parseOnlyBody(fetchMock).navigationId).toBe(UUID_A);
  });

  it("cancels a hidden pending view when the logical view changes", async () => {
    setVisibilityState("hidden");
    const fetchMock = installFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);

    const { rerender } = render(
      <TrackingProbe eventName="dashboard_viewed" route="/dashboard" />
    );
    rerender(<TrackingProbe eventName="extract_viewed" route="/dashboard" />);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = parseOnlyBody(fetchMock);
    expect(getEventBody(body).eventName).toBe("extract_viewed");
    expect(body.navigationId).toBe(UUID_B);
  });

  it("cancels a hidden pending entity view when it closes before visibility returns", async () => {
    setVisibilityState("hidden");
    const fetchMock = installFetchMock();
    installRandomUuidMock(UUID_A);

    const { rerender } = render(
      <TrackingProbe
        eventName="project_details_expanded"
        route="/dashboard"
        entityType="project"
        entityId={UUID_A}
        active
      />
    );
    rerender(
      <TrackingProbe
        eventName="project_details_expanded"
        route="/dashboard"
        entityType="project"
        entityId={UUID_A}
        active={false}
      />
    );

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tracks a reopened entity view with a new navigationId", async () => {
    const fetchMock = installFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);

    const { rerender } = render(
      <TrackingProbe
        eventName="project_history_viewed"
        route="/dashboard"
        entityType="project"
        entityId={UUID_A}
        active
      />
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(
      <TrackingProbe
        eventName="project_history_viewed"
        route="/dashboard"
        entityType="project"
        entityId={UUID_A}
        active={false}
      />
    );
    rerender(
      <TrackingProbe
        eventName="project_history_viewed"
        route="/dashboard"
        entityType="project"
        entityId={UUID_A}
        active
      />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const navigationIds = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String((call[1] as RequestInit).body));
      return body.navigationId;
    });
    expect(navigationIds).toEqual([UUID_A, UUID_B]);
  });
});

describe("use-track-product-view.client architecture", () => {
  it("does not import server-only, service-role, Supabase, or analytics server modules", () => {
    const source = readFileSync(
      path.join(__dirname, "use-track-product-view.client.ts"),
      "utf8"
    );

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toContain("@/lib/supabase");
    expect(source).not.toContain("log-product-event.server");
    expect(source).not.toContain("@/lib/analytics");
  });

  it("does not contain client identity, timestamp, idempotency, metadata, or content fields", () => {
    const source = readFileSync(
      path.join(__dirname, "use-track-product-view.client.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/\buserId\b/);
    expect(source).not.toMatch(/\buser_id\b/);
    expect(source).not.toMatch(/\bemail\b/);
    expect(source).not.toMatch(/\bcreatedAt\b/);
    expect(source).not.toMatch(/\bidempotencyKey\b/);
    expect(source).not.toMatch(/\bmetadata\b/);
    expect(source).not.toMatch(/\blocalStorage\b/);
    expect(source).not.toMatch(/\bcookie\b/i);
  });

  it("keeps the product-event endpoint literal owned by the client helper only", () => {
    const sourceFiles = collectProductionSourceFiles([
      path.join(process.cwd(), "app"),
      path.join(process.cwd(), "lib"),
    ]);
    const filesWithEndpointFetch = sourceFiles
      .filter((filePath) => {
        if (filePath === path.join(process.cwd(), "app/api/activity/product-event/route.ts")) {
          return false;
        }
        return /fetch\(\s*["'`]\/api\/activity\/product-event["'`]/.test(
          readFileSync(filePath, "utf8")
        );
      })
      .map((filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, "/"));

    expect(filesWithEndpointFetch).toEqual([
      "lib/activity/use-track-product-view.client.ts",
    ]);
  });

  it("wires Phase 4 event names only into the approved production client files", () => {
    const productComponentFiles = collectProductionSourceFiles([
      path.join(process.cwd(), "app/components/dashboard"),
    ]);
    const phase4EventPattern =
      /project_details_expanded|project_resources_viewed|project_history_viewed|client_update_opened|calendar_day_viewed|calendar_event_viewed/;
    const offendingFiles = productComponentFiles
      .filter((filePath) => phase4EventPattern.test(readFileSync(filePath, "utf8")))
      .map((filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, "/"));

    expect(offendingFiles.sort()).toEqual([
      "app/components/dashboard/calendar/work-calendar-client.tsx",
      "app/components/dashboard/resources/resource-manager-modal.tsx",
      "app/components/dashboard/tasks/desktop-tasks-table.tsx",
      "app/components/dashboard/tasks/mobile-task-card.tsx",
      "app/components/dashboard/tasks/project-updates/use-project-update-history.ts",
      "app/components/dashboard/tasks/project-updates/use-project-update.ts",
    ]);
  });
});

function collectProductionSourceFiles(roots: string[]): string[] {
  const results: string[] = [];
  const excludedDirNames = new Set(["node_modules", ".next"]);

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (!excludedDirNames.has(entry)) {
          walk(fullPath);
        }
        continue;
      }

      if (
        (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
        !entry.endsWith(".test.ts") &&
        !entry.endsWith(".test.tsx")
      ) {
        results.push(fullPath);
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return results;
}
