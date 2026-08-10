import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const reenableShareLinkMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  reenableShareLink: (...args: unknown[]) => reenableShareLinkMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function buildRequest() {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/enable`, {
    method: "POST",
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validReenableData() {
  return {
    linkId: VALID_UUID,
    state: "active",
    configurationVersion: 3,
    activatedAt: "2026-08-05T00:00:00Z",
    disabledAt: "2026-08-05T12:00:00Z",
  };
}

function expectNoStoreHeaders(response: Response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
  expect(cacheControl).toContain("max-age=0");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
}

beforeEach(() => {
  getUserMock.mockReset();
  reenableShareLinkMock.mockReset();
  consoleErrorSpy.mockClear();
  vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/share-links/[id]/enable - feature gate", () => {
  it("returns 404 NOT_FOUND before authenticating when the feature is disabled", async () => {
    vi.stubEnv("TEXT2TASK_CLIENT_SHARE_ENABLED", "false");

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", error: expect.any(String) });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(reenableShareLinkMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/share-links/[id]/enable - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(reenableShareLinkMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    reenableShareLinkMock.mockResolvedValue({ ok: true, data: validReenableData() });

    await POST(buildRequest(), buildContext(VALID_UUID.toUpperCase()));

    expect(reenableShareLinkMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });
});

describe("POST /api/share-links/[id]/enable - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(reenableShareLinkMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/share-links/[id]/enable - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT when the link is not disabled", async () => {
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns 409 SHARE_LINK_ANOTHER_LINK_ACTIVE", async () => {
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_ANOTHER_LINK_ACTIVE" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_ANOTHER_LINK_ACTIVE");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected failure (e.g. missing secret material)", async () => {
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    reenableShareLinkMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("logs only a fixed category, never error.name or error.message, even with sensitive markers", async () => {
    const nameMarker = "SENSITIVE_NAME_MARKER_9f3a";
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    const error = new Error(messageMarker);
    error.name = nameMarker;
    reenableShareLinkMock.mockRejectedValue(error);

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(500);
    const responseText = JSON.stringify(body);
    expect(responseText).not.toContain(nameMarker);
    expect(responseText).not.toContain(messageMarker);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    const loggedText = JSON.stringify(loggedPayload);
    expect(loggedText).not.toContain(nameMarker);
    expect(loggedText).not.toContain(messageMarker);
    expect(loggedPayload).toEqual({
      stage: "share_links.enable",
      category: "Error",
    });
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validReenableData();
    reenableShareLinkMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(reenableShareLinkMock).toHaveBeenCalledTimes(1);
    expect(reenableShareLinkMock).toHaveBeenCalledWith(expect.anything(), VALID_UUID);
  });

  it("never leaks a secret, ciphertext, digest or raw database error code -- re-enable data never contains one", async () => {
    const data = validReenableData();
    reenableShareLinkMock.mockResolvedValue({ ok: true, data });

    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    const text = await response.text();

    for (const forbidden of [
      "secret",
      "ciphertext",
      "secretDigest",
      "nonce",
      "authTag",
      "pinHash",
      "P0001",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("POST /api/share-links/[id]/enable - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST response is no-store", async () => {
    const response = await POST(buildRequest(), buildContext("not-a-uuid"));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("404 SHARE_LINK_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("409 SHARE_LINK_STATE_CONFLICT response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    reenableShareLinkMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    reenableShareLinkMock.mockResolvedValue({ ok: true, data: validReenableData() });
    const response = await POST(buildRequest(), buildContext(VALID_UUID));
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});
