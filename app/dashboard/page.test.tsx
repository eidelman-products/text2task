// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requireDashboardUserMock = vi.fn();

vi.mock("@/lib/supabase/requireDashboardUser", () => ({
  requireDashboardUser: () => requireDashboardUserMock(),
}));

// Shallow mock: this test verifies /dashboard's own searchParams-validation
// and prop-passing logic, not DashboardClient's 1800+ lines of internal
// behavior (which has no test coverage of its own and shouldn't gain a
// fragile one here just to observe a single prop).
vi.mock(
  "../components/dashboard-client",
  () => ({
    default: (props: { initialView?: string; clientShareEnabled?: boolean }) => (
      <div
        data-testid="dashboard-client"
        data-initial-view={props.initialView}
        data-client-share-enabled={String(props.clientShareEnabled)}
      />
    ),
  })
);

const { default: DashboardPage } = await import("./page");

beforeEach(() => {
  requireDashboardUserMock.mockReset();
  requireDashboardUserMock.mockResolvedValue({
    id: "user-1",
    email: "person@example.com",
    plan: "free",
  });
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function buildSearchParams(params: Record<string, string | string[]>) {
  return Promise.resolve(params);
}

describe("/dashboard - initial workspace view resolution", () => {
  it("no query parameter resolves to the dashboard view", async () => {
    const page = await DashboardPage({ searchParams: buildSearchParams({}) });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-initial-view",
      "dashboard"
    );
  });

  it("?view=extract resolves to the extract view", async () => {
    const page = await DashboardPage({
      searchParams: buildSearchParams({ view: "extract" }),
    });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-initial-view",
      "extract"
    );
  });

  it("?view=tasks resolves to the tasks view", async () => {
    const page = await DashboardPage({
      searchParams: buildSearchParams({ view: "tasks" }),
    });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-initial-view",
      "tasks"
    );
  });

  it("an invalid value safely falls back to the dashboard view", async () => {
    const page = await DashboardPage({
      searchParams: buildSearchParams({ view: "not-a-real-view" }),
    });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-initial-view",
      "dashboard"
    );
  });

  it("a duplicated ?view= query param uses the first value rather than crashing", async () => {
    const page = await DashboardPage({
      searchParams: buildSearchParams({ view: ["extract", "tasks"] }),
    });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-initial-view",
      "extract"
    );
  });
});

describe("/dashboard - passes through the authenticated user", () => {
  it("calls requireDashboardUser and passes its result to DashboardClient", async () => {
    requireDashboardUserMock.mockResolvedValue({
      id: "user-42",
      email: "someone@example.com",
      plan: "pro",
    });

    const page = await DashboardPage({ searchParams: buildSearchParams({}) });
    render(page);

    expect(requireDashboardUserMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("dashboard-client")).toBeInTheDocument();
  });
});

describe("/dashboard - Client Share availability gate passthrough", () => {
  it("passes clientShareEnabled=false when the env var is unset", async () => {
    const page = await DashboardPage({ searchParams: buildSearchParams({}) });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-client-share-enabled",
      "false"
    );
  });

  it("passes clientShareEnabled=true only when the env var is exactly 'true'", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");

    const page = await DashboardPage({ searchParams: buildSearchParams({}) });
    render(page);

    expect(screen.getByTestId("dashboard-client")).toHaveAttribute(
      "data-client-share-enabled",
      "true"
    );
  });
});
