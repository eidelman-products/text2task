import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const assertClientShareEnabledMock = vi.fn();
vi.mock("@/lib/share/share-availability.server", () => ({
  assertClientShareEnabled: () => assertClientShareEnabledMock(),
  isShareAvailabilityError: (error: unknown) =>
    error instanceof Object && (error as { name?: string }).name === "ShareAvailabilityError",
}));

const COOKIE_NAME = "t2t_client_share_session";
const hashSecretMock = vi.fn();
const isValidRawSecretMock = vi.fn();
vi.mock("@/lib/share/share-browser-session.server", () => ({
  getShareBrowserSessionCookiePolicy: () => ({
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax",
    path: "/api/share",
    secure: false,
    maxAge: 604800,
  }),
  hashShareBrowserSessionSecret: (raw: string) => hashSecretMock(raw),
  isValidRawShareBrowserSessionSecret: (value: unknown) => isValidRawSecretMock(value),
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/share/share-rate-limit.server", () => ({
  checkShareRateLimit: (input: unknown) => checkRateLimitMock(input),
}));

const isValidSharePublicIdMock = vi.fn();
vi.mock("@/lib/share/share-public-id.server", () => ({
  isValidSharePublicId: (value: unknown) => isValidSharePublicIdMock(value),
}));

const verifyAuthorizationMock = vi.fn();
vi.mock("@/lib/share/share-session-grant.server", () => ({
  verifyShareProjectionAuthorization: (input: unknown) => verifyAuthorizationMock(input),
}));

type AdminFakeConfig = {
  mappingRows?: unknown[];
  mappingError?: unknown;
  resourceRow?: unknown | null;
  resourceError?: unknown;
  downloadStream?: ReadableStream<Uint8Array> | null;
  downloadError?: unknown;
};

let adminConfig: AdminFakeConfig = {};
const downloadMock = vi.fn();
const asStreamMock = vi.fn();

function makeMultiRowBuilder(data: unknown[], error: unknown) {
  const builder: Record<string, unknown> = {
    eq: () => builder,
    then: (
      resolve: (value: { data: unknown[] | null; error: unknown }) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return builder;
}

function makeMaybeSingleBuilder(row: unknown | null, error: unknown) {
  const builder: Record<string, unknown> = {
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error }),
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => {
        if (table === "share_link_resources") {
          return makeMultiRowBuilder(adminConfig.mappingRows ?? [], adminConfig.mappingError ?? null);
        }
        if (table === "task_resources") {
          return makeMaybeSingleBuilder(adminConfig.resourceRow ?? null, adminConfig.resourceError ?? null);
        }
        throw new Error(`Unexpected table in file route test: ${table}`);
      },
    }),
    storage: {
      from: () => ({
        download: (path: string) => {
          downloadMock(path);
          return {
            asStream: () => {
              asStreamMock();
              return Promise.resolve({
                data: adminConfig.downloadStream ?? null,
                error: adminConfig.downloadError ?? null,
              });
            },
          };
        },
      }),
    },
  },
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
// PHASE 4C -- the two success-shaped share_file_stage tags
// (mapping_lookup_ok, stream_response_started) are logged via
// console.info, not console.error (right-sized so a healthy request
// doesn't emit an error-level log line); every denial stage stays on
// console.error. Tests that need to see every stage tag regardless of
// level merge both spies via stageTagCalls() below.
const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

process.env.TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1 = Buffer.alloc(32, 11).toString("base64url");

const { GET } = await import("./route");
const { deriveShareFileRef } = await import("@/lib/share/share-file-ref.server");

const VALID_PUBLIC_ID = "abcdefgh12345678ijklmnop";
const VALID_RAW_SESSION_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc";
const SHARE_LINK_ID = "link-1";
const PROJECT_ID = "project-1";
const USER_ID = "user-1";
const RESOURCE_ID = "resource-1";
const OTHER_RESOURCE_ID = "resource-2";

const VALID_FILE_REF = deriveShareFileRef(SHARE_LINK_ID, RESOURCE_ID);

function buildRequest(
  options: {
    cookieValue?: string | null;
    secFetchSite?: string;
    secFetchMode?: string;
  } = {}
) {
  const headers: Record<string, string> = {};
  if (options.cookieValue !== undefined && options.cookieValue !== null) {
    headers.cookie = `${COOKIE_NAME}=${options.cookieValue}`;
  }
  if (options.secFetchSite) {
    headers["sec-fetch-site"] = options.secFetchSite;
  }
  if (options.secFetchMode) {
    headers["sec-fetch-mode"] = options.secFetchMode;
  }
  return new NextRequest(
    `http://localhost/api/share/${VALID_PUBLIC_ID}/resources/${VALID_FILE_REF}`,
    { method: "GET", headers }
  );
}

function buildContext(publicId: string, fileRef: string) {
  return { params: Promise.resolve({ publicId, fileRef }) };
}

function allow() {
  return { allowed: true, requestCount: 1, limit: 120, windowSeconds: 300, retryAfterSeconds: 0 };
}

function deny(retryAfterSeconds = 30) {
  return { allowed: false, requestCount: 200, limit: 120, windowSeconds: 300, retryAfterSeconds };
}

function fakeStream(bytes = "hello world") {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(bytes));
      controller.close();
    },
  });
}

function validMapping(overrides: Record<string, unknown> = {}) {
  return { resource_id: RESOURCE_ID, public_label: "Final logo", can_download: false, ...overrides };
}

function validResourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RESOURCE_ID,
    resource_type: "file",
    url: null,
    storage_path: "u/p/task/abc.png",
    file_name: "abc.png",
    mime_type: "image/png",
    project_id: PROJECT_ID,
    ...overrides,
  };
}

function authorizeSuccessfully() {
  verifyAuthorizationMock.mockResolvedValue({
    shareLinkId: SHARE_LINK_ID,
    projectId: PROJECT_ID,
    userId: USER_ID,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  assertClientShareEnabledMock.mockReset();
  hashSecretMock.mockReset().mockReturnValue("a".repeat(64));
  isValidRawSecretMock.mockReset().mockReturnValue(true);
  checkRateLimitMock.mockReset().mockResolvedValue(allow());
  isValidSharePublicIdMock.mockReset().mockReturnValue(true);
  verifyAuthorizationMock.mockReset();
  consoleErrorSpy.mockClear();
  consoleInfoSpy.mockClear();
  downloadMock.mockClear();
  asStreamMock.mockClear();
  adminConfig = {
    mappingRows: [validMapping()],
    resourceRow: validResourceRow(),
    downloadStream: fakeStream(),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET .../resources/[fileRef] - feature gate", () => {
  it("returns 404 before any DB work when the feature is disabled", async () => {
    assertClientShareEnabledMock.mockImplementation(() => {
      const error = new Error("disabled") as Error & { name: string };
      error.name = "ShareAvailabilityError";
      throw error;
    });

    const response = await GET(buildRequest(), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));
    expect(response.status).toBe(404);
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });
});

describe("GET .../resources/[fileRef] - request security", () => {
  it("rejects a present, cross-site Sec-Fetch-Site", async () => {
    const response = await GET(
      buildRequest({ secFetchSite: "cross-site" }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    expect(response.status).toBe(403);
  });

  it("PHASE 4B DEFECT #1 REGRESSION -- accepts a direct/typed/bookmarked top-level navigation (Sec-Fetch-Site: none, Mode: navigate), confirmed against a real disposable Preview to previously return INVALID_ORIGIN", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({
        cookieValue: VALID_RAW_SESSION_SECRET,
        secFetchSite: "none",
        secFetchMode: "navigate",
      }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).not.toBe(403);
    expect(response.status).toBe(200);
  });

  it("accepts a same-origin target=_blank / new-tab navigation", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({
        cookieValue: VALID_RAW_SESSION_SECRET,
        secFetchSite: "same-origin",
        secFetchMode: "navigate",
      }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(200);
  });

  it("still rejects Sec-Fetch-Site: none paired with a contradictory non-navigate mode", async () => {
    const response = await GET(
      buildRequest({
        cookieValue: VALID_RAW_SESSION_SECRET,
        secFetchSite: "none",
        secFetchMode: "cors",
      }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(403);
  });

  it("full session/grant/fileRef authorization is still independently required even for an accepted-origin request", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildRequest({
        cookieValue: VALID_RAW_SESSION_SECRET,
        secFetchSite: "none",
        secFetchMode: "navigate",
      }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
  });
});

describe("GET .../resources/[fileRef] - publicId / fileRef / cookie preconditions", () => {
  it("generic-unavailable for a malformed publicId, before touching fileRef/cookie", async () => {
    isValidSharePublicIdMock.mockReturnValue(false);

    const response = await GET(buildRequest(), buildContext("not valid", VALID_FILE_REF));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unavailable for a syntactically malformed fileRef, before any DB call", async () => {
    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, "not-a-valid-file-ref")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("generic-unavailable when no session cookie is present", async () => {
    const response = await GET(
      buildRequest({ cookieValue: null }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    expect(response.status).toBe(401);
  });
});

describe("GET .../resources/[fileRef] - rate limit (dedicated file_access bucket, Phase 7B)", () => {
  it("returns 429 before authorization is checked", async () => {
    checkRateLimitMock.mockResolvedValue(deny(9));

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(verifyAuthorizationMock).not.toHaveBeenCalled();
  });

  it("uses the dedicated file_access action/browser_session scope -- no longer shares projection_read's bucket", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "file_access", scope: "browser_session" })
    );
  });
});

describe("GET .../resources/[fileRef] - AUTHORIZED", () => {
  it("streams the file with a 200, correct Content-Type, and inline disposition when canDownload is false", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox; frame-ancestors 'none'");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()"
    );

    const text = await response.text();
    expect(text).toBe("hello world");
  });

  it("sets an attachment Content-Disposition using the public label when canDownload is true", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [validMapping({ can_download: true, public_label: "Final Logo" })];

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(200);
    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("Final Logo.png");
  });

  it("does not set Content-Length (no authoritative byte count is available from .asStream())", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.headers.get("Content-Length")).toBeNull();
  });

  it("falls back to application/octet-stream for a mime_type outside the audited allowlist", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = validResourceRow({ mime_type: "application/x-not-allowed" });

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
  });
});

describe("GET .../resources/[fileRef] - DENIED (generic, indistinguishable)", () => {
  async function expectGenericUnavailable() {
    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
  }

  it("full authorization failure (invalid session/no grant/revoked/disabled/expired/stale-version -- all indistinguishable upstream)", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);
    await expectGenericUnavailable();
  });

  it("syntactically valid fileRef that matches nothing mapped to this link", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [validMapping({ resource_id: OTHER_RESOURCE_ID })];
    await expectGenericUnavailable();
  });

  it("cross-link replay: a fileRef correctly computed for a different shareLinkId is rejected here", async () => {
    authorizeSuccessfully();
    const foreignFileRef = deriveShareFileRef("some-other-link", RESOURCE_ID);

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, foreignFileRef)
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("resource unmapped from this link (empty mapping set)", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [];
    await expectGenericUnavailable();
  });

  it("resource removed/deleted after the projection was built (task_resources row no longer resolves)", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = null;
    await expectGenericUnavailable();
  });

  it("resource belongs to a different project than the verified context", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = validResourceRow({ project_id: "some-other-project" });
    await expectGenericUnavailable();
  });

  it("resource is classified as a NOTE, not a FILE", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = validResourceRow({
      resource_type: "note",
      storage_path: null,
      file_name: null,
    });
    await expectGenericUnavailable();
  });

  it("resource is classified as a LINK, not a FILE", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = validResourceRow({
      resource_type: "link",
      storage_path: null,
      file_name: null,
      url: "https://example.com",
    });
    await expectGenericUnavailable();
  });

  it("storage download itself fails/returns nothing", async () => {
    authorizeSuccessfully();
    adminConfig.downloadStream = null;
    adminConfig.downloadError = { message: "not found" };
    await expectGenericUnavailable();
  });

  it("mapping lookup errors", async () => {
    authorizeSuccessfully();
    adminConfig.mappingError = { message: "boom" };
    await expectGenericUnavailable();
  });

  it("resource lookup errors", async () => {
    authorizeSuccessfully();
    adminConfig.resourceError = { message: "boom" };
    await expectGenericUnavailable();
  });
});

describe("GET .../resources/[fileRef] - streaming mechanism", () => {
  it("calls storage.download(storagePath) and then .asStream() -- proving the stream variant is used, never a bare buffered download or createSignedUrl", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(200);
    expect(downloadMock).toHaveBeenCalledWith("u/p/task/abc.png");
    expect(asStreamMock).toHaveBeenCalledTimes(1);
  });
});

describe("GET .../resources/[fileRef] - PRIVACY", () => {
  it("never includes storage_path, a Supabase Storage URL, or internal ids anywhere in a denied response", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    const text = await response.text();

    expect(text).not.toContain("u/p/task/abc.png");
    expect(text).not.toContain("supabase.co");
    expect(text).not.toContain(RESOURCE_ID);
    expect(text).not.toContain(SHARE_LINK_ID);
    expect(text).not.toContain(USER_ID);
  });

  it("never includes the internal file_name in the Content-Disposition header on success", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [validMapping({ can_download: true, public_label: "Final Logo" })];
    adminConfig.resourceRow = validResourceRow({ file_name: "TOXIC_INTERNAL_FILENAME.png" });

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain("TOXIC_INTERNAL_FILENAME");
  });

  it("success response is private, no-store, no-referrer", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("GET .../resources/[fileRef] - Phase 7 hardening headers", () => {
  it("streamed success response carries frame-ancestors, X-Robots-Tag, and Permissions-Policy", async () => {
    authorizeSuccessfully();

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox; frame-ancestors 'none'");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()"
    );
  });

  it("a generic denial (JSON) response also carries X-Robots-Tag and Permissions-Policy", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()"
    );
  });
});

describe("GET .../resources/[fileRef] - PHASE 4B DEFECT #2 stage-tagged diagnostics", () => {
  // PHASE 4C -- merges both spies since mapping_lookup_ok and
  // stream_response_started are now logged via console.info (see the
  // route's own right-sizing comment); every denial stage stays on
  // console.error. Order doesn't matter for the `.some()`/`.find()`
  // usages below, so a simple concatenation is sufficient here (unlike
  // the auth-helper test file's sequence-sensitive assertions).
  function stageTagCalls(): unknown[][] {
    return [...consoleErrorSpy.mock.calls, ...consoleInfoSpy.mock.calls].filter(
      (call) => call[0] === "share_file_stage"
    );
  }

  it("tags authorization_failed when verifyShareProjectionAuthorization returns null", async () => {
    verifyAuthorizationMock.mockResolvedValue(null);
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    const calls = stageTagCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ stage: "authorization_failed" });
  });

  it("tags mapping_lookup_failed on a share_link_resources query error", async () => {
    authorizeSuccessfully();
    adminConfig.mappingError = { message: "boom" };
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "mapping_lookup_failed")).toBe(true);
  });

  it("tags mapping_lookup_ok with a bare count (never the mapped resourceIds themselves) before the fileRef match step", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [validMapping(), validMapping({ resource_id: OTHER_RESOURCE_ID })];
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    const call = stageTagCalls().find((c) => (c[1] as { stage?: string }).stage === "mapping_lookup_ok");
    expect(call).toBeDefined();
    expect((call as unknown[])[1]).toEqual({ stage: "mapping_lookup_ok", mappedCount: 2 });
  });

  it("tags file_ref_no_match when the fileRef matches nothing mapped to this link", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [validMapping({ resource_id: OTHER_RESOURCE_ID })];
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "file_ref_no_match")).toBe(true);
  });

  it("tags resource_not_found when the task_resources row no longer resolves", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = null;
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "resource_not_found")).toBe(true);
  });

  it("tags project_scope_failed when the resource's project_id does not match the verified context", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = validResourceRow({ project_id: "some-other-project" });
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "project_scope_failed")).toBe(true);
  });

  it("tags resource_not_file when the resource classifies as a NOTE", async () => {
    authorizeSuccessfully();
    adminConfig.resourceRow = validResourceRow({ resource_type: "note", storage_path: null, file_name: null });
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "resource_not_file")).toBe(true);
  });

  it("tags storage_stream_open_failed with only Supabase's own generic error message when the download fails", async () => {
    authorizeSuccessfully();
    adminConfig.downloadStream = null;
    adminConfig.downloadError = { message: "Object not found" };
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    const call = stageTagCalls().find((c) => (c[1] as { stage?: string }).stage === "storage_stream_open_failed");
    expect(call).toBeDefined();
    expect((call as unknown[])[1]).toEqual({
      stage: "storage_stream_open_failed",
      storageErrorMessage: "Object not found",
    });
  });

  it("tags stream_response_started on success", async () => {
    authorizeSuccessfully();
    await GET(buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "stream_response_started")).toBe(
      true
    );
  });

  it("tags cross_site_rejected for a genuinely cross-site request", async () => {
    await GET(buildRequest({ secFetchSite: "cross-site" }), buildContext(VALID_PUBLIC_ID, VALID_FILE_REF));

    expect(stageTagCalls().some((call) => (call[1] as { stage?: string }).stage === "cross_site_rejected")).toBe(true);
  });

  it("never logs the fileRef, resourceId, shareLinkId, userId, storage_path, or raw cookie value across every denied branch", async () => {
    const scenarios: Array<() => void> = [
      () => verifyAuthorizationMock.mockResolvedValue(null),
      () => {
        authorizeSuccessfully();
        adminConfig.mappingRows = [];
      },
      () => {
        authorizeSuccessfully();
        adminConfig.resourceRow = null;
      },
      () => {
        authorizeSuccessfully();
        adminConfig.resourceRow = validResourceRow({ project_id: "some-other-project" });
      },
      () => {
        authorizeSuccessfully();
        adminConfig.downloadStream = null;
        adminConfig.downloadError = { message: "Object not found" };
      },
    ];

    for (const setUp of scenarios) {
      consoleErrorSpy.mockClear();
      consoleInfoSpy.mockClear();
      setUp();
      await GET(
        buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
        buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
      );

      const loggedText = JSON.stringify([...consoleErrorSpy.mock.calls, ...consoleInfoSpy.mock.calls]);
      expect(loggedText).not.toContain(VALID_FILE_REF);
      expect(loggedText).not.toContain(RESOURCE_ID);
      expect(loggedText).not.toContain(SHARE_LINK_ID);
      expect(loggedText).not.toContain(USER_ID);
      expect(loggedText).not.toContain(PROJECT_ID);
      expect(loggedText).not.toContain("u/p/task/abc.png");
      expect(loggedText).not.toContain(VALID_RAW_SESSION_SECRET);
    }
  });

  it("the public response body never contains a stage name or any diagnostic detail", async () => {
    authorizeSuccessfully();
    adminConfig.downloadStream = null;
    adminConfig.downloadError = { message: "Object not found" };

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    const body = await response.json();

    expect(body).toEqual({ ok: false, code: "UNAVAILABLE", error: "This file is not available." });
  });
});

describe("GET .../resources/[fileRef] - PHASE 4C owner-config lifecycle (unshare / re-share / revoke)", () => {
  it("(20) owner unshares the file (mapping row removed) -> the very next request is denied, no caching of a prior success", async () => {
    authorizeSuccessfully();
    adminConfig.mappingRows = [validMapping()];

    const firstResponse = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    expect(firstResponse.status).toBe(200);

    // Owner unshares: the mapping row is gone on the very next request.
    adminConfig.mappingRows = [];

    const secondResponse = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    const body = await secondResponse.json();
    expect(secondResponse.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
  });

  it("(21) owner re-shares the same resource after unsharing it -> the SAME deterministic fileRef (recomputed by the projection, not cached) resolves and works again", async () => {
    authorizeSuccessfully();

    // Unshared: mapping empty, request denied.
    adminConfig.mappingRows = [];
    const deniedResponse = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    expect(deniedResponse.status).toBe(401);

    // Re-shared: the mapping row returns for the SAME resourceId, so the
    // SAME fileRef the client already has (deterministically derived,
    // never rotated by mapping/unmapping) authorizes again immediately.
    adminConfig.mappingRows = [validMapping()];
    const reAuthorizedResponse = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    expect(reAuthorizedResponse.status).toBe(200);
  });

  it("(23) an old fileRef cannot bypass a revoked/disabled link -- authorization fails before fileRef resolution is ever reached", async () => {
    // Authorization itself denies the request (simulating a revoked
    // link) -- the mapping/fileRef-matching stages must never run.
    verifyAuthorizationMock.mockResolvedValue(null);

    const response = await GET(
      buildRequest({ cookieValue: VALID_RAW_SESSION_SECRET }),
      buildContext(VALID_PUBLIC_ID, VALID_FILE_REF)
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAVAILABLE");
    // The mapping table is never even queried once authorization itself
    // has failed -- the previously-valid fileRef has no path to bypass
    // the now-revoked link.
    expect(downloadMock).not.toHaveBeenCalled();
  });
});
