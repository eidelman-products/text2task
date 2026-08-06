import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

const saveShareConfigurationMock = vi.fn();
vi.mock("@/lib/share/share-links-repository.server", () => ({
  saveShareConfiguration: (...args: unknown[]) => saveShareConfigurationMock(...args),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const { PATCH } = await import("./route");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";
const VALID_TIMESTAMP = "2026-08-06T00:00:00Z";

function buildRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/share-links/${VALID_UUID}/config`, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    configurationVersion: 3,
    taskIds: ["1", "2"],
    resourceIds: [VALID_UUID_2],
    currentUpdate: { version: 1, publishedAt: VALID_TIMESTAMP },
    ...overrides,
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

// Mirrors the route's own private MAX_CONFIG_REQUEST_BODY_BYTES exactly
// (not exported, so duplicated here by literal value rather than
// weakening the production limit for testing).
const MAX_BODY_BYTES = 512 * 1024;
const textEncoder = new TextEncoder();

/**
 * A syntactically valid, otherwise Zod-passing request body, padded with
 * leading JSON-insignificant whitespace to an exact byte length. Every
 * character used (spaces plus the JSON payload itself) is single-byte
 * ASCII, so `.length` (UTF-16 code units) equals the UTF-8 byte length.
 */
function paddedJsonBody(byteLength: number): string {
  const payload = '{"settings":{"commentsEnabled":true}}';
  const paddingLength = byteLength - payload.length;
  if (paddingLength < 0) {
    throw new Error("payload already exceeds target byte length");
  }
  return " ".repeat(paddingLength) + payload;
}

function buildStreamRequest(options: {
  headers?: Record<string, string>;
  chunks: Uint8Array[];
}): NextRequest {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of options.chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  // `duplex: "half"` is a real, spec-compliant fetch RequestInit field
  // required by Node's undici when a Request body is a ReadableStream --
  // the bundled `next/server` RequestInit type just hasn't caught up
  // with it, so the init object is threaded through `unknown` to reach
  // NextRequest's own constructor parameter type without a structural
  // excess-property mismatch.
  const init = {
    method: "PATCH",
    headers: options.headers,
    body: stream,
    duplex: "half",
  } as unknown as ConstructorParameters<typeof NextRequest>[1];

  return new NextRequest(
    `http://localhost/api/share-links/${VALID_UUID}/config`,
    init
  );
}

beforeEach(() => {
  getUserMock.mockReset();
  saveShareConfigurationMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("PATCH /api/share-links/[id]/config - validation", () => {
  it("rejects an invalid uuid id with 400 INVALID_REQUEST before authenticating", async () => {
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext("not-a-uuid")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("canonicalizes an uppercase id to lowercase before calling the repository", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data: validData() });

    await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID.toUpperCase())
    );

    expect(saveShareConfigurationMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      expect.anything()
    );
  });

  it("returns 400 INVALID_REQUEST for a non-JSON body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const request = new NextRequest(
      `http://localhost/api/share-links/${VALID_UUID}/config`,
      { method: "PATCH", body: "not-json" }
    );

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for an entirely empty body -- no group present", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PATCH(buildRequest({}), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for an unknown top-level key", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true }, extra: "nope" }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for an unknown key inside settings", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true, extra: "nope" } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for a linkId supplied in the body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PATCH(
      buildRequest({ linkId: VALID_UUID, settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_REQUEST for a duplicate subtaskId", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await PATCH(
      buildRequest({
        tasks: [
          {
            subtaskId: "1",
            publicGroup: "in_progress",
            waitingForClientFeedback: false,
            displayOrder: 0,
          },
          {
            subtaskId: "1",
            publicGroup: "completed",
            waitingForClientFeedback: false,
            displayOrder: 1,
          },
        ],
      }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/share-links/[id]/config - authentication", () => {
  it("returns 401 UNAUTHENTICATED when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("maps a repository UNAUTHORIZED result to 401 UNAUTHENTICATED, not 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHENTICATED");
  });
});

describe("PATCH /api/share-links/[id]/config - each group individually and combined", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data: validData() });
  });

  it("accepts settings only", async () => {
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
  });

  it("accepts tasks only", async () => {
    const response = await PATCH(
      buildRequest({
        tasks: [
          {
            subtaskId: "1",
            publicGroup: "in_progress",
            waitingForClientFeedback: false,
            displayOrder: 0,
          },
        ],
      }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
  });

  it("accepts resources only", async () => {
    const response = await PATCH(
      buildRequest({
        resources: [
          {
            resourceId: VALID_UUID_2,
            publicLabel: "Contract",
            canDownload: true,
            displayOrder: 0,
          },
        ],
      }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
  });

  it("accepts publishUpdate only", async () => {
    const response = await PATCH(
      buildRequest({ publishUpdate: { body: "Hello client" } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
  });

  it("accepts empty tasks and resources arrays -- clearing both mappings", async () => {
    const response = await PATCH(
      buildRequest({ tasks: [], resources: [] }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
    expect(saveShareConfigurationMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      expect.objectContaining({ tasks: [], resources: [] })
    );
  });

  it("accepts a full combined request with every group present", async () => {
    const request = {
      settings: { commentsEnabled: true, contentDirection: "ltr" },
      tasks: [
        {
          subtaskId: "1",
          publicGroup: "in_progress",
          waitingForClientFeedback: false,
          displayOrder: 0,
        },
      ],
      resources: [
        {
          resourceId: VALID_UUID_2,
          publicLabel: "Contract",
          canDownload: true,
          displayOrder: 0,
        },
      ],
      publishUpdate: { body: "Hello client" },
    };

    const response = await PATCH(buildRequest(request), buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
    expect(saveShareConfigurationMock).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      request
    );
  });
});

describe("PATCH /api/share-links/[id]/config - repository outcomes", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("returns 404 SHARE_LINK_NOT_FOUND", async () => {
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("SHARE_LINK_NOT_FOUND");
  });

  it("returns 409 PROJECT_ARCHIVED", async () => {
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_ARCHIVED" },
    });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("PROJECT_ARCHIVED");
  });

  it("returns 409 SHARE_LINK_STATE_CONFLICT for a revoked link", async () => {
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("SHARE_LINK_STATE_CONFLICT");
  });

  it("returns 400 INVALID_REQUEST when the repository reports invalid configuration content", async () => {
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });

    const response = await PATCH(
      buildRequest({
        tasks: [
          {
            subtaskId: "1",
            publicGroup: "in_progress",
            waitingForClientFeedback: false,
            displayOrder: 0,
          },
        ],
      }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("returns a generic 500 INTERNAL_ERROR for an unexpected failure", async () => {
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the repository call throws, without serializing the raw error", async () => {
    saveShareConfigurationMock.mockRejectedValue(
      Object.assign(new Error("raw postgres failure"), { code: "P0001" })
    );

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    const text = JSON.stringify(body);
    expect(text).not.toContain("P0001");
    expect(text).not.toContain("raw postgres failure");
  });

  it("logs only a fixed category, never error.name, error.message, link id, task ids, resource ids, subtitle, labels or update body", async () => {
    const nameMarker = "SENSITIVE_NAME_MARKER_9f3a";
    const messageMarker = "SENSITIVE_MESSAGE_MARKER_7c1e";
    const subtitleMarker = "SENSITIVE_SUBTITLE_MARKER";
    const error = new Error(messageMarker);
    error.name = nameMarker;
    saveShareConfigurationMock.mockRejectedValue(error);

    const response = await PATCH(
      buildRequest({
        settings: { clientFacingSubtitle: subtitleMarker },
      }),
      buildContext(VALID_UUID)
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    const responseText = JSON.stringify(body);
    expect(responseText).not.toContain(nameMarker);
    expect(responseText).not.toContain(messageMarker);
    expect(responseText).not.toContain(subtitleMarker);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedPayload] = consoleErrorSpy.mock.calls[0];
    const loggedText = JSON.stringify(loggedPayload);
    expect(loggedText).not.toContain(nameMarker);
    expect(loggedText).not.toContain(messageMarker);
    expect(loggedText).not.toContain(subtitleMarker);
    expect(loggedText).not.toContain(VALID_UUID);
    expect(loggedPayload).toEqual({
      stage: "share_links.config.save",
      category: "Error",
    });
  });

  it("returns {ok:true,data} on success, calling exactly one repository function", async () => {
    const data = validData();
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data });
    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
  });

  it("never leaks a secret, ciphertext, digest, PIN material or raw database error code in the success response", async () => {
    const data = validData();
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    const text = await response.text();

    for (const forbidden of [
      "secret",
      "ciphertext",
      "secretDigest",
      "nonce",
      "authTag",
      "pinHash",
      "pinSalt",
      "P0001",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("PATCH /api/share-links/[id]/config - explicit no-store headers on every response branch", () => {
  it("400 INVALID_REQUEST (invalid path) response is no-store", async () => {
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext("not-a-uuid")
    );
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("400 INVALID_REQUEST (malformed JSON) response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const request = new NextRequest(
      `http://localhost/api/share-links/${VALID_UUID}/config`,
      { method: "PATCH", body: "not-json" }
    );
    const response = await PATCH(request, buildContext(VALID_UUID));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("400 INVALID_REQUEST (empty body) response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const response = await PATCH(buildRequest({}), buildContext(VALID_UUID));
    expect(response.status).toBe(400);
    expectNoStoreHeaders(response);
  });

  it("401 UNAUTHENTICATED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(401);
    expectNoStoreHeaders(response);
  });

  it("404 SHARE_LINK_NOT_FOUND response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_NOT_FOUND" },
    });
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(404);
    expectNoStoreHeaders(response);
  });

  it("409 PROJECT_ARCHIVED response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "PROJECT_ARCHIVED" },
    });
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("409 SHARE_LINK_STATE_CONFLICT response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "SHARE_LINK_STATE_CONFLICT" },
    });
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(409);
    expectNoStoreHeaders(response);
  });

  it("500 INTERNAL_ERROR response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({
      ok: false,
      error: { code: "UNEXPECTED" },
    });
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(500);
    expectNoStoreHeaders(response);
  });

  it("200 success response is no-store", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data: validData() });
    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );
    expect(response.status).toBe(200);
    expectNoStoreHeaders(response);
  });
});

describe("PATCH /api/share-links/[id]/config - bounded request body reading", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("still succeeds for valid ordinary JSON", async () => {
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data: validData() });

    const response = await PATCH(
      buildRequest({ settings: { commentsEnabled: true } }),
      buildContext(VALID_UUID)
    );

    expect(response.status).toBe(200);
    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when the request has no body", async () => {
    const response = await PATCH(buildRequest(undefined), buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("returns 400 for malformed JSON", async () => {
    const request = buildStreamRequest({
      chunks: [textEncoder.encode("not-json")],
    });

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("returns 400 when the declared Content-Length exceeds the limit, without invoking the repository or reading the stream", async () => {
    const request = buildStreamRequest({
      headers: { "content-length": String(MAX_BODY_BYTES + 1) },
      chunks: [textEncoder.encode('{"settings":{"commentsEnabled":true}}')],
    });

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("returns 400 when a false/understated Content-Length header does not match an actually oversized streamed body", async () => {
    const oversized = textEncoder.encode(paddedJsonBody(MAX_BODY_BYTES + 1024));
    const request = buildStreamRequest({
      headers: { "content-length": "10" },
      chunks: [oversized],
    });

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("returns 400 when there is no Content-Length header at all and the actual streamed body exceeds the limit", async () => {
    const oversized = textEncoder.encode(paddedJsonBody(MAX_BODY_BYTES + 1));
    const request = buildStreamRequest({ chunks: [oversized] });

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("accepts a body of exactly the byte limit when the resulting JSON is otherwise valid", async () => {
    saveShareConfigurationMock.mockResolvedValue({ ok: true, data: validData() });
    const exact = textEncoder.encode(paddedJsonBody(MAX_BODY_BYTES));
    // The padded payload is pure single-byte ASCII, so byte length and
    // character length coincide -- confirm the fixture itself is exact
    // before asserting on the route's behavior.
    expect(exact.byteLength).toBe(MAX_BODY_BYTES);

    const request = buildStreamRequest({ chunks: [exact] });
    const response = await PATCH(request, buildContext(VALID_UUID));

    expect(response.status).toBe(200);
    expect(saveShareConfigurationMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a body of exactly limit+1 bytes", async () => {
    const overByOne = textEncoder.encode(paddedJsonBody(MAX_BODY_BYTES + 1));
    expect(overByOne.byteLength).toBe(MAX_BODY_BYTES + 1);

    const request = buildStreamRequest({ chunks: [overByOne] });
    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("rejects a body split across multiple chunks that only exceeds the limit once combined", async () => {
    const half = MAX_BODY_BYTES / 2;
    const chunkA = textEncoder.encode(" ".repeat(half));
    const chunkB = textEncoder.encode(
      " ".repeat(half + 1024) + '{"settings":{"commentsEnabled":true}}'
    );

    const request = buildStreamRequest({ chunks: [chunkA, chunkB] });
    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid UTF-8 bytes in the body", async () => {
    const invalidUtf8 = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]); // "{" + invalid bytes + "}"
    const request = buildStreamRequest({ chunks: [invalidUtf8] });

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(saveShareConfigurationMock).not.toHaveBeenCalled();
    expectNoStoreHeaders(response);
  });

  it("never logs the raw body content on a body-read/parse failure", async () => {
    const bodyMarker = "SENSITIVE_BODY_MARKER_9f3a";
    const request = buildStreamRequest({
      chunks: [textEncoder.encode(`not-json-${bodyMarker}`)],
    });

    const response = await PATCH(request, buildContext(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).not.toContain(bodyMarker);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
