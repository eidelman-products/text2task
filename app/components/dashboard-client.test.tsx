// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DashboardWorkspaceView } from "@/lib/dashboard/workspace-navigation";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/analytics/events", () => ({
  trackBeginCheckout: vi.fn(),
}));

vi.mock("./dashboard/dashboard-shell", () => ({
  default: ({
    sidebar,
    children,
  }: {
    sidebar: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <div data-testid="sidebar">{sidebar}</div>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("./dashboard/dashboard-sidebar-profile", () => ({
  default: (props: {
    mode: "workspace";
    onWorkspaceViewChange: (view: DashboardWorkspaceView) => void;
  }) => (
    <nav aria-label="Workspace navigation">
      <button
        type="button"
        onClick={() => props.onWorkspaceViewChange("dashboard")}
      >
        Dashboard
      </button>
      <button
        type="button"
        onClick={() => props.onWorkspaceViewChange("extract")}
      >
        Extract
      </button>
      <button type="button" onClick={() => props.onWorkspaceViewChange("tasks")}>
        Tasks
      </button>
    </nav>
  ),
}));

vi.mock("./dashboard/overview-v3/dashboard-overview-v3", () => ({
  default: ({
    onGoToExtract,
    onGoToTasks,
  }: {
    onGoToExtract: () => void;
    onGoToTasks: () => void;
  }) => (
    <section>
      <h1>Dashboard View</h1>
      <button type="button" onClick={onGoToExtract}>
        Overview to Extract
      </button>
      <button type="button" onClick={onGoToTasks}>
        Overview to Tasks
      </button>
    </section>
  ),
}));

vi.mock("./dashboard/first-run-dashboard", () => ({
  default: ({
    onExtractFirstRequest,
  }: {
    onExtractFirstRequest: () => void;
  }) => (
    <section>
      <h1>First Run Dashboard</h1>
      <button type="button" onClick={onExtractFirstRequest}>
        First Run Extract
      </button>
    </section>
  ),
}));

vi.mock("./dashboard/extract-workspace", () => ({
  default: ({ onGoToTasks }: { onGoToTasks: () => void }) => (
    <section>
      <h1>Extract View</h1>
      <button type="button" onClick={onGoToTasks}>
        Extract to Tasks
      </button>
    </section>
  ),
}));

vi.mock("./dashboard/tasks-view", () => ({
  default: ({ onRefreshTasks }: { onRefreshTasks: () => Promise<unknown> }) => (
    <section>
      <h1>Tasks View</h1>
      <button type="button" onClick={() => void onRefreshTasks()}>
        Refresh Tasks
      </button>
    </section>
  ),
}));

const { default: DashboardClient } = await import("./dashboard-client");

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function emptyTasksSnapshot() {
  return {
    tasks: [],
    activeTasks: [],
    archivedTasks: [],
    statsTasks: [],
    savedWork: {
      projectCount: 1,
      taskCount: 1,
      hasSavedWork: true,
    },
  };
}

function installDashboardFetchMock(productEventStatus = 204) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.resolve(new Response(null, { status: productEventStatus }));
    }

    if (url === "/api/activity/dashboard-visit") {
      return Promise.resolve(new Response(null, { status: 200 }));
    }

    if (url.startsWith("/api/tasks/snapshot")) {
      return Promise.resolve(jsonResponse(emptyTasksSnapshot()));
    }

    if (url.startsWith("/api/tasks")) {
      return Promise.resolve(jsonResponse({ tasks: [] }));
    }

    return Promise.resolve(jsonResponse({}));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installRejectedProductEventFetchMock() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/activity/product-event") {
      return Promise.reject(new TypeError("activity endpoint unavailable"));
    }

    if (url === "/api/activity/dashboard-visit") {
      return Promise.resolve(new Response(null, { status: 200 }));
    }

    if (url.startsWith("/api/tasks/snapshot")) {
      return Promise.resolve(jsonResponse(emptyTasksSnapshot()));
    }

    return Promise.resolve(jsonResponse({ tasks: [] }));
  });

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

function renderDashboard(initialView: DashboardWorkspaceView = "dashboard") {
  return render(
    <DashboardClient
      email="person@example.com"
      userId="user-1"
      initialPlan="free"
      initialView={initialView}
    />
  );
}

function productEventCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === "/api/activity/product-event"
  );
}

function dashboardVisitCalls(fetchMock: FetchMock) {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === "/api/activity/dashboard-visit"
  );
}

function productEventNames(fetchMock: FetchMock) {
  return productEventCalls(fetchMock).map((call) => {
    const init = call[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      event: { eventName: string };
    };
    return body.event.eventName;
  });
}

function productNavigationIds(fetchMock: FetchMock) {
  return productEventCalls(fetchMock).map((call) => {
    const init = call[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { navigationId: string };
    return body.navigationId;
  });
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

describe("DashboardClient authenticated view instrumentation", () => {
  it.each([
    ["dashboard", "dashboard_viewed", "Dashboard View"],
    ["extract", "extract_viewed", "Extract View"],
    ["tasks", "tasks_viewed", "Tasks View"],
  ] as const)(
    "initial %s view sends %s once",
    async (initialView, eventName, heading) => {
      const fetchMock = installDashboardFetchMock();
      installRandomUuidMock(UUID_A);

      renderDashboard(initialView);

      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
      expect(productEventNames(fetchMock)).toEqual([eventName]);
    }
  );

  it("Dashboard -> Extract -> Tasks sends one event per real workspace view", async () => {
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A, UUID_B, UUID_C);
    const user = userEvent.setup();

    renderDashboard("dashboard");
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Extract" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(3));

    expect(productEventNames(fetchMock)).toEqual([
      "dashboard_viewed",
      "extract_viewed",
      "tasks_viewed",
    ]);
  });

  it("Tasks -> Dashboard sends a new dashboard_viewed event", async () => {
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup();

    renderDashboard("tasks");
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));

    expect(productEventNames(fetchMock)).toEqual([
      "tasks_viewed",
      "dashboard_viewed",
    ]);
  });

  it("rerendering the same activeNav does not duplicate the view event", async () => {
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);

    const { rerender } = render(
      <DashboardClient
        email="person@example.com"
        userId="user-1"
        initialPlan="free"
        initialView="dashboard"
      />
    );
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    rerender(
      <DashboardClient
        email="person@example.com"
        userId="user-1"
        initialPlan="free"
        initialView="dashboard"
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("task data refreshes do not duplicate the active Tasks view event", async () => {
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup();

    renderDashboard("tasks");
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Refresh Tasks" }));
    await waitFor(() => {
      const snapshotCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith("/api/tasks/snapshot")
      );
      expect(snapshotCalls.length).toBeGreaterThan(1);
    });

    expect(productEventCalls(fetchMock)).toHaveLength(1);
  });

  it("Strict Mode effect replay does not create a second logical navigation ID", async () => {
    const fetchMock = installDashboardFetchMock();
    const randomUUID = installRandomUuidMock(UUID_A, UUID_B);

    render(
      <StrictMode>
        <DashboardClient
          email="person@example.com"
          userId="user-1"
          initialPlan="free"
          initialView="dashboard"
        />
      </StrictMode>
    );

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(productNavigationIds(fetchMock)).toEqual([UUID_A]);
  });

  it("a later legitimate revisit uses a new navigationId", async () => {
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A, UUID_B, UUID_C, UUID_D);
    const user = userEvent.setup();

    renderDashboard("dashboard");
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Extract" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(3));

    expect(productEventNames(fetchMock)).toEqual([
      "dashboard_viewed",
      "extract_viewed",
      "dashboard_viewed",
    ]);
    expect(productNavigationIds(fetchMock)).toEqual([UUID_A, UUID_B, UUID_C]);
  });

  it("hidden initial render sends nothing until visible", async () => {
    setVisibilityState("hidden");
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A);

    renderDashboard("dashboard");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(productEventCalls(fetchMock)).toHaveLength(0);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(productEventNames(fetchMock)).toEqual(["dashboard_viewed"]);
  });

  it("changing view while hidden cancels the old pending view", async () => {
    setVisibilityState("hidden");
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup();

    renderDashboard("dashboard");
    await user.click(screen.getByRole("button", { name: "Extract" }));

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(1));
    expect(productEventNames(fetchMock)).toEqual(["extract_viewed"]);
    expect(productNavigationIds(fetchMock)).toEqual([UUID_B]);
  });

  it("existing dashboard-visit tracking still runs exactly once and separately", async () => {
    const fetchMock = installDashboardFetchMock();
    installRandomUuidMock(UUID_A);

    renderDashboard("dashboard");

    await waitFor(() => expect(dashboardVisitCalls(fetchMock)).toHaveLength(1));
    const visitCall = dashboardVisitCalls(fetchMock)[0];
    expect(visitCall[0]).toBe("/api/activity/dashboard-visit");
    expect(visitCall[1]).toEqual({
      method: "POST",
      keepalive: true,
    });
  });

  it("analytics failure does not break tab switching or rendering", async () => {
    const fetchMock = installRejectedProductEventFetchMock();
    installRandomUuidMock(UUID_A, UUID_B);
    const user = userEvent.setup();

    renderDashboard("dashboard");
    expect(screen.getByRole("heading", { name: "Dashboard View" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Extract" }));

    expect(screen.getByRole("heading", { name: "Extract View" })).toBeInTheDocument();
    await waitFor(() => expect(productEventCalls(fetchMock)).toHaveLength(2));
  });
});
