// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = {
  data: unknown[] | Record<string, unknown> | null;
  error: { message: string } | null;
};

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const requireOwnerMock = vi.fn();
const isOwnerEmailMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();
const listUsersMock = vi.fn();

vi.mock("@/lib/auth/owner.server", () => ({
  requireOwner: () => requireOwnerMock(),
  isOwnerEmail: (email: string | null | undefined) => isOwnerEmailMock(email),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => fromMock(table),
    rpc: rpcMock,
    auth: {
      admin: {
        listUsers: listUsersMock,
      },
    },
  },
}));

const Page = (await import("./page")).default;

const NOW_MS = Date.parse("2026-08-03T10:30:00.000Z");
const THIRTY_DAYS_AGO_ISO = "2026-07-04T10:30:00.000Z";
const USER_ONE = "00000000-0000-4000-8000-000000000001";
const USER_TWO = "00000000-0000-4000-8000-000000000002";
const USER_THREE = "00000000-0000-4000-8000-000000000003";
const USER_FOUR = "00000000-0000-4000-8000-000000000004";
const OWNER_USER = "00000000-0000-4000-8000-000000000099";

function createQueryBuilder(result: QueryResult): QueryBuilder {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    gte: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => result),
  };

  return query;
}

function trafficEvent(overrides: Record<string, unknown>) {
  return {
    event_name: "page_view",
    occurred_at: "2026-08-03T09:00:00.000Z",
    anonymous_id: "browser-a",
    utm_source: null,
    utm_campaign: null,
    country_code: null,
    page_path: "/",
    ...overrides,
  };
}

function authenticatedEvent(userId: string, createdAt: string) {
  return {
    user_id: userId,
    created_at: createdAt,
  };
}

function authUser(id: string, email: string | null) {
  return {
    id,
    email,
  };
}

function setupSupabase({
  trafficRows = [],
  authenticatedRows = [],
  authenticatedError = null,
  authUsersError = null,
}: {
  trafficRows?: unknown[];
  authenticatedRows?: unknown[];
  authenticatedError?: { message: string } | null;
  authUsersError?: { message: string } | null;
} = {}) {
  const trafficQuery = createQueryBuilder({
    data: trafficRows,
    error: null,
  });
  const liveDemoQuery = createQueryBuilder({
    data: [],
    error: null,
  });
  const authenticatedQuery = createQueryBuilder({
    data: authenticatedRows,
    error: authenticatedError,
  });
  const analyticsQueries = [trafficQuery, liveDemoQuery];

  fromMock.mockImplementation((table: string) => {
    if (table === "analytics_events") {
      const query = analyticsQueries.shift();

      if (!query) {
        throw new Error("Unexpected analytics_events query");
      }

      return query;
    }

    if (table === "authenticated_product_events") {
      return authenticatedQuery;
    }

    throw new Error(`Unexpected table query: ${table}`);
  });
  rpcMock.mockResolvedValue({
    data: {
      summary: {
        total_users: 0,
        total_projects: 0,
        activated_users: 0,
        not_activated_users: 0,
      },
      recent_users: [],
    },
    error: null,
  });
  listUsersMock.mockResolvedValue({
    data: {
      users: [
        authUser(USER_ONE, "person-one@example.com"),
        authUser(USER_TWO, "person-two@example.com"),
        authUser(USER_THREE, "person-three@example.com"),
        authUser(USER_FOUR, "no-activity@example.com"),
        authUser(OWNER_USER, "owner@example.com"),
      ],
    },
    error: authUsersError,
  });

  return {
    trafficQuery,
    liveDemoQuery,
    authenticatedQuery,
  };
}

function getTrafficSectionElement() {
  const heading = screen.getByRole("heading", { name: "Tracked traffic" });
  const section = heading.closest("section");

  if (!section) {
    throw new Error("Missing tracked traffic section");
  }

  return section;
}

function getTrafficCard(label: string) {
  const card = Array.from(
    getTrafficSectionElement().querySelectorAll("article")
  ).find((article) => article.querySelector("p")?.textContent === label);

  if (!card) {
    throw new Error(`Missing traffic card for ${label}`);
  }

  return within(card);
}

beforeEach(() => {
  requireOwnerMock.mockReset();
  requireOwnerMock.mockResolvedValue(undefined);
  isOwnerEmailMock.mockReset();
  isOwnerEmailMock.mockImplementation(
    (email: string | null | undefined) =>
      email?.trim().toLowerCase() === "owner@example.com"
  );
  fromMock.mockReset();
  rpcMock.mockReset();
  listUsersMock.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/admin/analytics overview visitor metrics", () => {
  it("renames tracked visitors to Tracked browser IDs in the owner analytics UI", async () => {
    setupSupabase();

    render(await Page());

    expect(screen.queryByText(/tracked visitors/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Tracked browser IDs").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Unique authenticated users/).length
    ).toBeGreaterThan(0);
  });

  it("keeps anonymous traffic counts on distinct anonymous_id and adds distinct authenticated user_id counts", async () => {
    const { authenticatedQuery } = setupSupabase({
      trafficRows: [
        trafficEvent({ anonymous_id: "browser-a" }),
        trafficEvent({
          event_name: "signup_success",
          anonymous_id: "browser-a",
          occurred_at: "2026-08-03T09:10:00.000Z",
        }),
        trafficEvent({
          anonymous_id: "browser-b",
          occurred_at: "2026-07-30T10:00:00.000Z",
        }),
        trafficEvent({
          anonymous_id: null,
          occurred_at: "2026-07-10T10:00:00.000Z",
        }),
        trafficEvent({
          anonymous_id: "admin-browser",
          page_path: "/admin/analytics",
        }),
      ],
      authenticatedRows: [
        authenticatedEvent(USER_ONE, "2026-08-03T09:00:00.000Z"),
        authenticatedEvent(USER_ONE, "2026-08-03T09:05:00.000Z"),
        authenticatedEvent(USER_TWO, "2026-07-30T10:00:00.000Z"),
        authenticatedEvent(USER_THREE, "2026-07-10T10:00:00.000Z"),
        authenticatedEvent(OWNER_USER, "2026-08-03T09:00:00.000Z"),
      ],
    });

    render(await Page());

    expect(authenticatedQuery.gte).toHaveBeenCalledWith(
      "created_at",
      THIRTY_DAYS_AGO_ISO
    );
    expect(authenticatedQuery.limit).toHaveBeenCalledWith(10000);

    expect(getTrafficCard("Today").getByText("2")).toBeInTheDocument();
    expect(getTrafficCard("Today").getByText("1 page views")).toBeInTheDocument();
    expect(
      getTrafficCard("Today").getByText("1 Tracked browser IDs")
    ).toBeInTheDocument();
    expect(
      getTrafficCard("Today").getByText("1 Unique authenticated users")
    ).toBeInTheDocument();

    expect(
      getTrafficCard("Last 7 days").getByText("2 Tracked browser IDs")
    ).toBeInTheDocument();
    expect(
      getTrafficCard("Last 7 days").getByText("2 Unique authenticated users")
    ).toBeInTheDocument();

    expect(
      getTrafficCard("Last 30 days").getByText("2 Tracked browser IDs")
    ).toBeInTheDocument();
    expect(
      getTrafficCard("Last 30 days").getByText("3 Unique authenticated users")
    ).toBeInTheDocument();
  });

  it("keeps Overview traffic metrics available when the authenticated metric query fails", async () => {
    setupSupabase({
      trafficRows: [
        trafficEvent({ anonymous_id: "browser-a" }),
        trafficEvent({
          anonymous_id: "browser-b",
          occurred_at: "2026-07-30T10:00:00.000Z",
        }),
      ],
      authenticatedError: { message: "permission denied" },
    });

    render(await Page());

    expect(getTrafficCard("Today").getByText("1")).toBeInTheDocument();
    expect(
      getTrafficCard("Today").getByText("1 Tracked browser IDs")
    ).toBeInTheDocument();
    expect(
      getTrafficCard("Today").getByText("0 Unique authenticated users")
    ).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument();
  });

  it("does not count authenticated users when owner/test classification is unavailable", async () => {
    setupSupabase({
      trafficRows: [trafficEvent({ anonymous_id: "browser-a" })],
      authenticatedRows: [
        authenticatedEvent(USER_ONE, "2026-08-03T09:00:00.000Z"),
      ],
      authUsersError: { message: "auth admin unavailable" },
    });

    render(await Page());

    expect(
      getTrafficCard("Today").getByText("0 Unique authenticated users")
    ).toBeInTheDocument();
    expect(screen.queryByText(/auth admin unavailable/i)).not.toBeInTheDocument();
  });

  it("keeps authenticated user counts independent from anonymous page views and Auth users with no product event", async () => {
    setupSupabase({
      trafficRows: [
        trafficEvent({ anonymous_id: "browser-a" }),
        trafficEvent({
          anonymous_id: "browser-b",
          occurred_at: "2026-07-30T10:00:00.000Z",
        }),
      ],
      authenticatedRows: [],
    });

    render(await Page());

    expect(
      getTrafficCard("Last 30 days").getByText("2 Tracked browser IDs")
    ).toBeInTheDocument();
    expect(
      getTrafficCard("Last 30 days").getByText("0 Unique authenticated users")
    ).toBeInTheDocument();
  });
});

describe("/admin/analytics overview metric architecture", () => {
  it("keeps owner-only server-side access and does not query Supabase from the client table", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "app/admin/analytics/page.tsx"),
      "utf8"
    );
    const clientTableSource = readFileSync(
      path.join(
        process.cwd(),
        "app/admin/analytics/users/user-activity-table.client.tsx"
      ),
      "utf8"
    );

    const requireOwnerIndex = pageSource.indexOf("await requireOwner();");
    const loadViewModelIndex = pageSource.indexOf(
      "} = await loadAdminAnalyticsViewModel();"
    );

    expect(requireOwnerIndex).toBeGreaterThan(-1);
    expect(loadViewModelIndex).toBeGreaterThan(-1);
    expect(requireOwnerIndex).toBeLessThan(loadViewModelIndex);
    expect(pageSource).toContain('.from("authenticated_product_events")');
    expect(pageSource).toContain("row.anonymous_id");
    expect(pageSource).toContain("row.user_id");
    expect(pageSource).not.toContain("Tracked visitors");
    expect(pageSource).not.toContain("tracked visitors");
    expect(clientTableSource).not.toContain("@/lib/supabase");
    expect(clientTableSource).not.toContain("supabaseAdmin");
    expect(clientTableSource).not.toContain(".from(");
  });

  it("does not introduce schema, migration, tracking endpoint, or product instrumentation changes", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/admin/analytics/page.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/\bcreate\s+table\b/i);
    expect(source).not.toMatch(/\balter\s+table\b/i);
    expect(source).not.toMatch(/\bdrop\s+table\b/i);
    expect(source).not.toMatch(/\bcreate\s+policy\b/i);
    expect(source).not.toContain("/api/activity/product-event");
    expect(source).not.toContain("useTrackProductView");
  });
});
