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

function createTrialCountQueryBuilder(
  count: number | null,
  error: { message: string } | null = null
) {
  const query = {
    select: vi.fn(() => query),
    gte: vi.fn(async () => ({ count, error })),
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
  liveDemoRows = [],
  liveDemoFunnelRows = [],
  authenticatedRows = [],
  authenticatedError = null,
  authUsersError = null,
  uniqueDemoTrialCount = 0,
  uniqueDemoTrialCountError = null,
}: {
  trafficRows?: unknown[];
  liveDemoRows?: unknown[];
  liveDemoFunnelRows?: unknown[];
  authenticatedRows?: unknown[];
  authenticatedError?: { message: string } | null;
  authUsersError?: { message: string } | null;
  uniqueDemoTrialCount?: number | null;
  uniqueDemoTrialCountError?: { message: string } | null;
} = {}) {
  const trafficQuery = createQueryBuilder({
    data: trafficRows,
    error: null,
  });
  const liveDemoQuery = createQueryBuilder({
    data: liveDemoRows,
    error: null,
  });
  const liveDemoFunnelQuery = createQueryBuilder({
    data: liveDemoFunnelRows,
    error: null,
  });
  const authenticatedQuery = createQueryBuilder({
    data: authenticatedRows,
    error: authenticatedError,
  });
  const trialCountQuery = createTrialCountQueryBuilder(
    uniqueDemoTrialCount,
    uniqueDemoTrialCountError
  );
  const analyticsQueries = [trafficQuery, liveDemoQuery, liveDemoFunnelQuery];

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

    if (table === "homepage_demo_trials") {
      return trialCountQuery;
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
    liveDemoFunnelQuery,
    authenticatedQuery,
    trialCountQuery,
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

function getConversionSectionElement() {
  const heading = screen.getByRole("heading", { name: "Live Demo Conversion" });
  const section = heading.closest("section");

  if (!section) {
    throw new Error("Missing Live Demo Conversion section");
  }

  return section;
}

function getConversionCard(label: string) {
  const card = Array.from(
    getConversionSectionElement().querySelectorAll("article")
  ).find((article) => article.querySelector("p")?.textContent === label);

  if (!card) {
    throw new Error(`Missing conversion card for ${label}`);
  }

  return within(card);
}

function extractEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_name: "homepage_demo_extract_succeeded",
    occurred_at: "2026-08-03T09:00:00.000Z",
    anonymous_id: "anon-a",
    metadata: { owner_flagged: false },
    ...overrides,
  };
}

function funnelEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_name: "demo_review_viewed",
    occurred_at: "2026-08-03T09:00:00.000Z",
    anonymous_id: "anon-a",
    user_id: null,
    metadata: { owner_flagged: false },
    ...overrides,
  };
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

describe("/admin/analytics Live Demo Conversion (Phase 1D)", () => {
  it("renders the Conversion, breakdown, and Health sections with the right period label", async () => {
    setupSupabase();

    render(await Page());

    expect(
      screen.getByRole("heading", { name: "Live Demo Conversion" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Conversion breakdown" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Live Demo Health" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Live Demo usage")).not.toBeInTheDocument();
    expect(
      within(getConversionSectionElement()).getAllByText("Last 30 days").length
    ).toBeGreaterThan(0);
  });

  it("counts successful demos, review reached, observed CTA clicks, and claims saved for a real (non-owner) visitor journey", async () => {
    setupSupabase({
      liveDemoRows: [
        extractEvent({ event_name: "homepage_demo_extract_attempt" }),
        extractEvent({ event_name: "homepage_demo_extract_succeeded" }),
      ],
      liveDemoFunnelRows: [
        funnelEvent({ event_name: "demo_review_viewed" }),
        funnelEvent({
          event_name: "demo_account_cta_clicked",
          metadata: { owner_flagged: false, cta: "start_free" },
        }),
        funnelEvent({
          event_name: "demo_claim_saved",
          user_id: "user-real-1",
          metadata: { owner_flagged: false, duplicate_override: false },
        }),
      ],
    });

    render(await Page());

    const card = getConversionCard("Last 30 days");
    expect(card.getByText("1")).toBeInTheDocument();
    expect(card.getByText("1 attempts")).toBeInTheDocument();
    expect(card.getByText("1 review reached (100%)")).toBeInTheDocument();
    expect(
      card.getByText("1 observed CTA clicks")
    ).toBeInTheDocument();
    expect(card.getByText("1 claims saved (100%)")).toBeInTheDocument();
  });

  it("excludes an owner-flagged claim from business conversion counts but keeps the matching extract success in operational Health", async () => {
    setupSupabase({
      liveDemoRows: [
        extractEvent({
          event_name: "homepage_demo_extract_succeeded",
          anonymous_id: "anon-owner",
          metadata: { owner_flagged: false },
        }),
      ],
      liveDemoFunnelRows: [
        funnelEvent({
          event_name: "demo_claim_saved",
          anonymous_id: "anon-owner",
          user_id: "owner-user-1",
          metadata: { owner_flagged: true, duplicate_override: false },
        }),
      ],
    });

    render(await Page());

    // Business conversion: the owner's claim is excluded, and because
    // the extract success shares the SAME anonymous_id as the flagged
    // claim, it is propagated-excluded too (see
    // lib/analytics/live-demo-funnel.ts).
    const conversionCard = getConversionCard("Last 30 days");
    expect(conversionCard.getByText("0")).toBeInTheDocument();

    // Operational Health: the underlying extract event is still counted
    // (owner traffic must remain visible for system health).
    const healthHeading = screen.getByRole("heading", {
      name: "Live Demo Health",
    });
    const healthSection = healthHeading.closest("section");
    if (!healthSection) throw new Error("Missing Live Demo Health section");
    const healthCard = Array.from(
      healthSection.querySelectorAll("article")
    ).find((article) => article.querySelector("p")?.textContent === "Last 30 days");
    if (!healthCard) throw new Error("Missing health card");
    expect(within(healthCard).getByText("1 succeeded")).toBeInTheDocument();
  });

  it("never groups null anonymous_id rows into one correlated browser (correlated/uncorrelated split)", async () => {
    setupSupabase({
      liveDemoRows: [
        extractEvent({
          event_name: "homepage_demo_extract_succeeded",
          anonymous_id: null,
        }),
        extractEvent({
          event_name: "homepage_demo_extract_succeeded",
          anonymous_id: null,
        }),
        extractEvent({
          event_name: "homepage_demo_extract_succeeded",
          anonymous_id: "anon-real",
        }),
      ],
    });

    render(await Page());

    const card = getConversionCard("Last 30 days");
    expect(card.getByText("3")).toBeInTheDocument();
    expect(
      card.getByText("1 correlated / 2 uncorrelated demos")
    ).toBeInTheDocument();
  });

  it("CTA consent-gap scenario: zero observed CTA clicks and one claim saved never render a nonsensical >100% or Infinity rate", async () => {
    setupSupabase({
      liveDemoRows: [extractEvent({ event_name: "homepage_demo_extract_succeeded" })],
      liveDemoFunnelRows: [
        funnelEvent({
          event_name: "demo_claim_saved",
          user_id: "user-1",
          metadata: { owner_flagged: false, duplicate_override: false },
        }),
      ],
    });

    render(await Page());

    expect(document.body.textContent).not.toMatch(/infinity/i);
    expect(document.body.textContent).not.toMatch(/NaN/);
    const card = getConversionCard("Last 30 days");
    // observed CTA clicks (0) carries no rate at all -- claims saved
    // (1) is rated against successfulDemos (1) => a sane 100%, proving
    // the rate was never computed as claimsSaved / observedCtaClicks
    // (which would have been undefined/Infinity from a 0 denominator).
    expect(card.getByText("0 observed CTA clicks")).toBeInTheDocument();
    expect(card.getByText("1 claims saved (100%)")).toBeInTheDocument();
  });

  it("a zero-denominator rate displays as an em dash, not 0% or NaN", async () => {
    setupSupabase();

    render(await Page());

    const card = getConversionCard("Today");
    expect(card.getByText("0 review reached (—)")).toBeInTheDocument();
  });

  it("shows the CTA start_free/log_in and duplicate-override breakdown", async () => {
    setupSupabase({
      liveDemoFunnelRows: [
        funnelEvent({
          event_name: "demo_account_cta_clicked",
          metadata: { owner_flagged: false, cta: "start_free" },
        }),
        funnelEvent({
          event_name: "demo_account_cta_clicked",
          metadata: { owner_flagged: false, cta: "log_in" },
        }),
        funnelEvent({
          event_name: "demo_claim_saved",
          user_id: "user-1",
          metadata: { owner_flagged: false, duplicate_override: false },
        }),
        funnelEvent({
          event_name: "demo_claim_saved",
          anonymous_id: "anon-b",
          user_id: "user-2",
          metadata: { owner_flagged: false, duplicate_override: true },
        }),
      ],
    });

    render(await Page());

    const breakdownHeading = screen.getByRole("heading", {
      name: "Conversion breakdown",
    });
    const breakdownSection = breakdownHeading.closest("section");
    if (!breakdownSection) throw new Error("Missing breakdown section");
    const breakdown = within(breakdownSection);
    expect(breakdown.getByText("Start free CTA clicks")).toBeInTheDocument();
    expect(breakdown.getByText("Log in CTA clicks")).toBeInTheDocument();
    expect(breakdown.getByText("Normal saves")).toBeInTheDocument();
    expect(
      breakdown.getByText("Save-anyway (duplicate override)")
    ).toBeInTheDocument();
  });

  it("surfaces the unique demo trials count from the exact head-count query", async () => {
    setupSupabase({ uniqueDemoTrialCount: 42 });

    render(await Page());

    const breakdownHeading = screen.getByRole("heading", {
      name: "Conversion breakdown",
    });
    const breakdownSection = breakdownHeading.closest("section");
    if (!breakdownSection) throw new Error("Missing breakdown section");
    expect(within(breakdownSection).getByText("42")).toBeInTheDocument();
  });

  it("shows the unique demo trials count as Unavailable, not a false 0, when the count query fails", async () => {
    setupSupabase({
      uniqueDemoTrialCount: null,
      uniqueDemoTrialCountError: { message: "permission denied" },
    });

    render(await Page());

    const breakdownHeading = screen.getByRole("heading", {
      name: "Conversion breakdown",
    });
    const breakdownSection = breakdownHeading.closest("section");
    if (!breakdownSection) throw new Error("Missing breakdown section");
    expect(within(breakdownSection).getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument();
  });

  it("never uses the wording 'unique people' anywhere on the page", async () => {
    setupSupabase();

    render(await Page());

    expect(screen.queryByText(/unique people/i)).not.toBeInTheDocument();
  });

  it("shows the owner-exclusion and historical-data limitation note", async () => {
    setupSupabase();

    render(await Page());

    expect(
      screen.getByText(/Owner filtering applies to traffic identifiable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Fresh\/incognito owner testing/i)
    ).toBeInTheDocument();
  });

  it("Live Demo Health explicitly documents that it includes owner/admin traffic", async () => {
    setupSupabase();

    render(await Page());

    expect(
      screen.getByText(/including owner\/admin traffic/i)
    ).toBeInTheDocument();
  });

  it("zero-state: no funnel rows renders 0 counts and no crash", async () => {
    setupSupabase();

    render(await Page());

    const card = getConversionCard("Last 30 days");
    expect(card.getByText("0")).toBeInTheDocument();
    expect(card.getByText("0 attempts")).toBeInTheDocument();
    expect(card.getByText("0 observed CTA clicks")).toBeInTheDocument();
  });

  it("shows an Unavailable panel instead of zero/false data when the funnel supplement query fails entirely", async () => {
    const { liveDemoFunnelQuery } = setupSupabase();
    liveDemoFunnelQuery.limit.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    render(await Page());

    expect(
      screen.getByText("Live Demo conversion analytics unavailable.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument();
  });
});
