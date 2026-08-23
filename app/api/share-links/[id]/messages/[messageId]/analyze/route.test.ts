import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const convertShareMessageToClientUpdateMock = vi.fn();
vi.mock("@/lib/share/share-message-conversion.server", () => ({
  convertShareMessageToClientUpdate: (...args: unknown[]) =>
    convertShareMessageToClientUpdateMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_LINK_ID = "11111111-1111-4111-8111-111111111111";
const VALID_USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

function buildRequest(body: unknown = {}) {
  return new NextRequest(
    `http://localhost/api/share-links/${VALID_LINK_ID}/messages/${VALID_MESSAGE_ID}/analyze`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function buildContext(id: string, messageId: string) {
  return { params: Promise.resolve({ id, messageId }) };
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
}

function successResult(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    state: "ready",
    resumed: false,
    update: { id: "update-1", project_id: "project-1", source_type: "client_share" },
    items: [],
    timelineEvent: null,
    analysis: { headline: "Analyzed.", reasoning: "", riskLevel: "low", detectedChanges: [] },
    ...overrides,
  };
}

function inProgressResult(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    state: "in_progress",
    projectUpdateId: "update-1",
    ...overrides,
  };
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null });
  convertShareMessageToClientUpdateMock.mockReset().mockResolvedValue(successResult());
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST .../analyze - feature gate", () => {
  it("returns 404 NOT_FOUND before any DB work when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("POST .../analyze - path validation", () => {
  it("rejects an invalid link id", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid", VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid messageId", async () => {
    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, "not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("POST .../analyze - authentication", () => {
  it("returns 401 UNAUTHENTICATED when unauthenticated, before calling the conversion service", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(convertShareMessageToClientUpdateMock).not.toHaveBeenCalled();
  });
});

describe("POST .../analyze - server-authoritative content (browser cannot supply trusted values)", () => {
  it("calls the conversion service with only the path's own linkId/messageId and the authenticated userId -- never anything from the request body", async () => {
    await POST(
      buildRequest({
        rawInput: "attacker-controlled text",
        sourceType: "client_share",
        sourceShareMessageId: "99999999-9999-4999-8999-999999999999",
        projectId: "88888888-8888-4888-8888-888888888888",
        body: "also attacker-controlled",
      }),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );

    expect(convertShareMessageToClientUpdateMock).toHaveBeenCalledWith(expect.anything(), {
      shareLinkId: VALID_LINK_ID,
      messageId: VALID_MESSAGE_ID,
      userId: VALID_USER_ID,
    });
  });

  it("succeeds identically with an empty request body -- no request field is ever required or trusted", async () => {
    const response = await POST(
      new NextRequest(
        `http://localhost/api/share-links/${VALID_LINK_ID}/messages/${VALID_MESSAGE_ID}/analyze`,
        { method: "POST" }
      ),
      buildContext(VALID_LINK_ID, VALID_MESSAGE_ID)
    );

    expect(response.status).toBe(200);
    expect(convertShareMessageToClientUpdateMock).toHaveBeenCalledWith(expect.anything(), {
      shareLinkId: VALID_LINK_ID,
      messageId: VALID_MESSAGE_ID,
      userId: VALID_USER_ID,
    });
  });

  it("this route's executable source never destructures rawInput/sourceShareMessageId/projectId from a parsed request body", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8")
    );
    // Comment-stripped: this route's own doc comment legitimately NAMES
    // these fields while explaining they are never accepted (matching
    // this repository's established comment-vs-executable convention,
    // e.g. app/api/share-links/[id]/messages/phase6-boundary.test.ts).
    const executable = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(executable).not.toMatch(/rawInput|sourceShareMessageId|body\.projectId/);
    expect(executable).not.toMatch(/req\.json\(\)|request\.json\(\)/);
  });
});

describe("POST .../analyze - error mapping", () => {
  it("maps SHARE_MESSAGE_NOT_FOUND to 404", async () => {
    convertShareMessageToClientUpdateMock.mockResolvedValue({
      ok: false,
      code: "SHARE_MESSAGE_NOT_FOUND",
      error: "not found",
    });

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_MESSAGE_NOT_FOUND");
  });

  it("maps SHARE_MESSAGE_NOT_CLIENT_AUTHORED to a 409 (owner-authored reply rejected)", async () => {
    convertShareMessageToClientUpdateMock.mockResolvedValue({
      ok: false,
      code: "SHARE_MESSAGE_NOT_CLIENT_AUTHORED",
      error: "not client authored",
    });

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_MESSAGE_NOT_CLIENT_AUTHORED");
  });

  it("maps SHARE_MESSAGE_PROJECT_NOT_FOUND (deleted/not-owned project) to PROJECT_NOT_FOUND 404", async () => {
    convertShareMessageToClientUpdateMock.mockResolvedValue({
      ok: false,
      code: "SHARE_MESSAGE_PROJECT_NOT_FOUND",
      error: "project not found",
    });

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("PROJECT_NOT_FOUND");
  });

  it("maps an unexpected service failure to a generic 500, never leaking details", async () => {
    convertShareMessageToClientUpdateMock.mockResolvedValue({
      ok: false,
      code: "UNEXPECTED",
      error: "raw internal detail",
    });

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("raw internal detail");
  });

  it("returns a generic 500 when the service throws, without leaking the raw error", async () => {
    convertShareMessageToClientUpdateMock.mockRejectedValue(new Error("raw postgres failure"));

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("raw postgres failure");
  });
});

describe("POST .../analyze - success", () => {
  it("returns ok:true with the update/items/timelineEvent/analysis shape the existing review UI already understands", async () => {
    const result = successResult({ resumed: true });
    convertShareMessageToClientUpdateMock.mockResolvedValue(result);

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      state: "ready",
      resumed: true,
      update: result.update,
      items: result.items,
      timelineEvent: result.timelineEvent,
      analysis: result.analysis,
    });
  });

  it("a valid client-authored message succeeds (link state irrelevant -- the route performs no link-state check of any kind)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/state\s*[=!]==?\s*["'`](active|disabled|expired|revoked)["'`]/);

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    expect(response.status).toBe(200);
  });
});

describe("POST .../analyze - Phase 6B correction: IN_PROGRESS (concurrent reservation)", () => {
  it("returns ok:true, state:in_progress, and the durable projectUpdateId -- never the ready shape -- when the service reports a concurrent reservation still in flight", async () => {
    convertShareMessageToClientUpdateMock.mockResolvedValue(inProgressResult({ projectUpdateId: "update-42" }));

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, state: "in_progress", projectUpdateId: "update-42" });
    expect(body).not.toHaveProperty("update");
    expect(body).not.toHaveProperty("items");
  });

  it("the in_progress response is still no-store", async () => {
    convertShareMessageToClientUpdateMock.mockResolvedValue(inProgressResult());

    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    expectNoStoreHeaders(response);
  });
});

describe("POST .../analyze - no-store headers", () => {
  it("200 response is no-store", async () => {
    const response = await POST(buildRequest(), buildContext(VALID_LINK_ID, VALID_MESSAGE_ID));
    expectNoStoreHeaders(response);
  });

  it("400 response is no-store", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid", VALID_MESSAGE_ID));
    expectNoStoreHeaders(response);
  });
});

describe("POST .../analyze - Phase 6 boundary: no conversion closure work", () => {
  it("this route's source never references share_message_conversions, status='converted', or apply_project_update_transaction", () => {
    return import("node:fs")
      .then((fs) => fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8"))
      .then((source) => {
        expect(source).not.toContain("share_message_conversions");
        expect(source).not.toContain("converted");
        expect(source).not.toContain("apply_project_update_transaction");
      });
  });
});
