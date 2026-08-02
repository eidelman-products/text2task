import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const logProductEventSafeMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/activity/log-product-event.server", () => ({
  logProductEventSafe: (...args: unknown[]) => logProductEventSafeMock(...args),
}));

const routeModule = await import("./route");
const { POST } = routeModule;

const VALID_NAVIGATION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHENTICATED_USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(options: {
  rawBody: string;
  contentType?: string | null;
}) {
  const headers: Record<string, string> = {};
  if (options.contentType !== null) {
    headers["content-type"] = options.contentType ?? "application/json";
  }

  return new NextRequest("http://localhost/api/activity/product-event", {
    method: "POST",
    body: options.rawBody,
    headers,
  });
}

function buildJsonRequest(body: unknown, contentType?: string | null) {
  return buildRequest({ rawBody: JSON.stringify(body), contentType });
}

const VALID_ENVELOPE = {
  event: { eventName: "dashboard_viewed", route: "/dashboard" },
  navigationId: VALID_NAVIGATION_ID,
};

beforeEach(() => {
  getUserMock.mockReset();
  logProductEventSafeMock.mockReset();
  getUserMock.mockResolvedValue({
    data: { user: { id: AUTHENTICATED_USER_ID } },
    error: null,
  });
  logProductEventSafeMock.mockResolvedValue({ status: "recorded" });
});

describe("POST /api/activity/product-event - success", () => {
  it("returns 204 with an empty body for a valid authenticated event", async () => {
    const response = await POST(buildJsonRequest(VALID_ENVELOPE));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(logProductEventSafeMock).toHaveBeenCalledWith({
      userId: AUTHENTICATED_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event: VALID_ENVELOPE.event,
    });
  });

  it("returns 204 for a duplicate event", async () => {
    logProductEventSafeMock.mockResolvedValue({ status: "duplicate" });

    const response = await POST(buildJsonRequest(VALID_ENVELOPE));

    expect(response.status).toBe(204);
  });
});

describe("POST /api/activity/product-event - authentication", () => {
  it("returns 401 and writes nothing for an anonymous caller", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildJsonRequest(VALID_ENVELOPE));

    expect(response.status).toBe(401);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 401 and writes nothing for an expired/invalid session", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid session" },
    });

    const response = await POST(buildJsonRequest(VALID_ENVELOPE));

    expect(response.status).toBe(401);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/activity/product-event - malformed request body", () => {
  it("returns 400 for invalid JSON", async () => {
    const response = await POST(buildRequest({ rawBody: "{not valid json" }));

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for valid JSON that is not an object (a bare string)", async () => {
    const response = await POST(buildJsonRequest("just a string"));

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for valid JSON that is not an object (an array)", async () => {
    const response = await POST(buildJsonRequest([VALID_ENVELOPE]));

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown top-level key", async () => {
    const response = await POST(
      buildJsonRequest({ ...VALID_ENVELOPE, extra: "not allowed" })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a top-level userId", async () => {
    const response = await POST(
      buildJsonRequest({ ...VALID_ENVELOPE, userId: AUTHENTICATED_USER_ID })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a top-level email", async () => {
    const response = await POST(
      buildJsonRequest({ ...VALID_ENVELOPE, email: "user@example.com" })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a top-level createdAt", async () => {
    const response = await POST(
      buildJsonRequest({
        ...VALID_ENVELOPE,
        createdAt: "2020-01-01T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a top-level idempotencyKey", async () => {
    const response = await POST(
      buildJsonRequest({ ...VALID_ENVELOPE, idempotencyKey: "attacker-chosen" })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a top-level metadata", async () => {
    const response = await POST(
      buildJsonRequest({ ...VALID_ENVELOPE, metadata: { note: "anything" } })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-string navigationId (rejected by the envelope schema, logger never called)", async () => {
    const response = await POST(
      buildJsonRequest({ ...VALID_ENVELOPE, navigationId: 12345 })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing navigationId", async () => {
    const response = await POST(buildJsonRequest({ event: VALID_ENVELOPE.event }));

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing event", async () => {
    const response = await POST(
      buildJsonRequest({ navigationId: VALID_NAVIGATION_ID })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/activity/product-event - delegated (logger-level) rejections map to 400", () => {
  it.each([
    ["an unknown event name", { eventName: "bogus_event", route: "/dashboard" }, "invalid_shape"],
    ["a malformed route", { eventName: "dashboard_viewed", route: "not-a-route" }, "invalid_route"],
    [
      "an external URL as the route",
      { eventName: "dashboard_viewed", route: "https://evil.example.com" },
      "invalid_route",
    ],
    [
      "a malformed project UUID",
      {
        eventName: "project_details_expanded",
        route: "/dashboard",
        entityType: "project",
        entityId: "not-a-uuid",
      },
      "invalid_entity_id",
    ],
    [
      "a malformed calendar-event UUID",
      {
        eventName: "calendar_event_viewed",
        route: "/dashboard/calendar",
        entityType: "calendar_event",
        entityId: "12345",
      },
      "invalid_entity_id",
    ],
    [
      "an impossible calendar date",
      {
        eventName: "calendar_day_viewed",
        route: "/dashboard/calendar",
        entityType: "calendar_day",
        entityId: "2027-02-30",
      },
      "invalid_entity_id",
    ],
    [
      "a missing entity for an entity-based event",
      { eventName: "project_details_expanded", route: "/dashboard" },
      "missing_entity_id",
    ],
    [
      "a mismatched entity type",
      {
        eventName: "calendar_event_viewed",
        route: "/dashboard/calendar",
        entityType: "project",
        entityId: "44444444-4444-4444-8444-444444444444",
      },
      "entity_type_mismatch",
    ],
  ])("returns 400 for %s", async (_label, event, reason) => {
    logProductEventSafeMock.mockResolvedValue({ status: "rejected", reason });

    const response = await POST(buildJsonRequest({ event, navigationId: VALID_NAVIGATION_ID }));

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).toHaveBeenCalledWith({
      userId: AUTHENTICATED_USER_ID,
      navigationId: VALID_NAVIGATION_ID,
      event,
    });
  });

  it("returns 400 for a malformed (string but not UUID-shaped) navigationId", async () => {
    logProductEventSafeMock.mockResolvedValue({
      status: "rejected",
      reason: "invalid_navigation_id",
    });

    const response = await POST(
      buildJsonRequest({ event: VALID_ENVELOPE.event, navigationId: "not-a-uuid" })
    );

    expect(response.status).toBe(400);
    expect(logProductEventSafeMock).toHaveBeenCalledWith({
      userId: AUTHENTICATED_USER_ID,
      navigationId: "not-a-uuid",
      event: VALID_ENVELOPE.event,
    });
  });
});

describe("POST /api/activity/product-event - content type and size", () => {
  it("returns 415 for an unsupported content type", async () => {
    const response = await POST(
      buildRequest({ rawBody: JSON.stringify(VALID_ENVELOPE), contentType: "text/plain" })
    );

    expect(response.status).toBe(415);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });

  it("accepts a JSON content type with a charset suffix", async () => {
    const response = await POST(
      buildRequest({
        rawBody: JSON.stringify(VALID_ENVELOPE),
        contentType: "application/json; charset=utf-8",
      })
    );

    expect(response.status).toBe(204);
  });

  it("returns 413 for an oversized request body", async () => {
    const oversizedEvent = {
      eventName: "dashboard_viewed",
      route: "/" + "a".repeat(5000),
    };
    const response = await POST(
      buildJsonRequest({ event: oversizedEvent, navigationId: VALID_NAVIGATION_ID })
    );

    expect(response.status).toBe(413);
    expect(logProductEventSafeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/activity/product-event - isolated storage failure", () => {
  it("returns a generic 503 without exposing internal error details", async () => {
    logProductEventSafeMock.mockResolvedValue({ status: "failed" });

    const response = await POST(buildJsonRequest(VALID_ENVELOPE));

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json).toEqual({ error: expect.any(String) });
    const serialized = JSON.stringify(json).toLowerCase();
    expect(serialized).not.toContain("supabase");
    expect(serialized).not.toContain("postgres");
    expect(serialized).not.toContain("service_role");
    expect(serialized).not.toContain("stack");
  });

  it("returns a generic 500 and no stack trace when an unexpected exception is thrown", async () => {
    logProductEventSafeMock.mockRejectedValue(new Error("boom, with a secret table name inside"));

    const response = await POST(buildJsonRequest(VALID_ENVELOPE));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(JSON.stringify(json)).not.toContain("secret table name");
  });
});

describe("POST /api/activity/product-event - method and architectural isolation", () => {
  it("exports only POST -- no GET, PUT, PATCH, or DELETE handler exists", () => {
    const moduleRecord = routeModule as unknown as Record<string, unknown>;
    expect(moduleRecord.GET).toBeUndefined();
    expect(moduleRecord.PUT).toBeUndefined();
    expect(moduleRecord.PATCH).toBeUndefined();
    expect(moduleRecord.DELETE).toBeUndefined();
  });

  it("never references analytics_events, a product-domain table, or the service-role client directly in its own source", () => {
    const source = readFileSync(path.join(__dirname, "route.ts"), "utf8");

    expect(source).not.toMatch(/\banalytics_events\b/);
    expect(source).not.toMatch(/\bsupabaseAdmin\b/);
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).not.toMatch(/\bfrom\(\s*["'`]projects["'`]\s*\)/);
    expect(source).not.toMatch(/\bfrom\(\s*["'`]tasks["'`]\s*\)/);
  });
});

/**
 * Walks every production .ts/.tsx source file under app/ (excluding
 * node_modules, .next, tests, and this feature's own two route files)
 * looking for a pattern. Phase 3 product components must import the
 * client helper rather than direct-calling the endpoint or importing the
 * server logger.
 */
function collectAppSourceFiles(): string[] {
  const appRoot = path.join(__dirname, "..", "..", "..");
  const results: string[] = [];
  const excludedDirNames = new Set(["node_modules", ".next"]);
  const selfFiles = new Set([
    path.join(__dirname, "route.ts"),
    path.join(__dirname, "route.test.ts"),
  ]);

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
        !entry.endsWith(".test.tsx") &&
        !selfFiles.has(fullPath)
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(appRoot);
  return results;
}

describe("POST /api/activity/product-event - repository-wide isolation", () => {
  it("is not direct-called from any production application page or component", () => {
    const offendingFiles = collectAppSourceFiles().filter((filePath) =>
      readFileSync(filePath, "utf8").includes("/api/activity/product-event")
    );

    expect(offendingFiles).toEqual([]);
  });

  it("its server logger is not imported by any production application page or component", () => {
    const offendingFiles = collectAppSourceFiles().filter((filePath) =>
      readFileSync(filePath, "utf8").includes("log-product-event.server")
    );

    expect(offendingFiles).toEqual([]);
  });
});
