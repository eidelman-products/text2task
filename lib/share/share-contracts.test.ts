import { describe, expect, it } from "vitest";
import {
  canonicalizeUuid,
  canonicalSubtaskIdSchema,
  managedShareLinkStateSchema,
  shareLinkApiErrorSchema,
  shareLinkManagementStateDataSchema,
  shareLinkManagementStateQuerySchema,
  shareLinkManagementStateResponseSchema,
  shareLinkStateSchema,
  shareLinkSummaryDataSchema,
  shareLinkSummaryQuerySchema,
  shareLinkSummaryResponseSchema,
} from "./share-contracts";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";
const VALID_PUBLIC_ID = "abcdefgh12345678";
const VALID_TIMESTAMP = "2026-08-05T00:00:00Z";
const VALID_TIMESTAMP_OFFSET = "2026-08-05T00:00:00.123456+02:00";

function uuidLike(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
}

function validManagedLink(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "active",
    expiresAt: null,
    hasPin: false,
    commentsEnabled: true,
    clientFacingSubtitle: null,
    contentDirection: "auto",
    configurationVersion: 1,
    createdAt: VALID_TIMESTAMP,
    activatedAt: null,
    disabledAt: null,
    rotatedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    ...overrides,
  };
}

function noManagedLinkData(overrides: Record<string, unknown> = {}) {
  return {
    link: null,
    mappedTaskIds: [],
    mappedResourceIds: [],
    currentUpdate: null,
    ...overrides,
  };
}

function withManagedLinkData(overrides: Record<string, unknown> = {}) {
  return {
    link: validManagedLink(),
    mappedTaskIds: ["1", "42"],
    mappedResourceIds: [VALID_UUID],
    currentUpdate: null,
    ...overrides,
  };
}

function noSummaryEntry(projectId = VALID_UUID, overrides: Record<string, unknown> = {}) {
  return {
    projectId,
    linkId: null,
    state: null,
    expiresAt: null,
    hasPin: false,
    createdAt: null,
    lastViewedAt: null,
    viewCount: 0,
    taskCount: 0,
    resourceCount: 0,
    unreadCount: null,
    ...overrides,
  };
}

function withSummaryEntry(projectId = VALID_UUID, overrides: Record<string, unknown> = {}) {
  return {
    projectId,
    linkId: VALID_UUID,
    state: "active",
    expiresAt: null,
    hasPin: false,
    createdAt: VALID_TIMESTAMP,
    lastViewedAt: null,
    viewCount: 0,
    taskCount: 0,
    resourceCount: 0,
    unreadCount: null,
    ...overrides,
  };
}

describe("canonicalizeUuid", () => {
  it("lowercases an uppercase uuid", () => {
    expect(canonicalizeUuid(VALID_UUID.toUpperCase())).toBe(VALID_UUID);
  });

  it("is a no-op on an already-lowercase uuid", () => {
    expect(canonicalizeUuid(VALID_UUID)).toBe(VALID_UUID);
  });

  it("lowercases a mixed-case uuid", () => {
    const mixed = "11111111-1111-4111-8111-1111111111Ab";
    expect(canonicalizeUuid(mixed)).toBe("11111111-1111-4111-8111-1111111111ab");
  });
});

describe("managedShareLinkStateSchema", () => {
  it.each(["draft", "active", "disabled", "expired"])("accepts %s", (value) => {
    expect(managedShareLinkStateSchema.safeParse(value).success).toBe(true);
  });

  it("rejects revoked -- these RPCs can never return a revoked link", () => {
    expect(managedShareLinkStateSchema.safeParse("revoked").success).toBe(false);
  });

  it("the full 5-value shareLinkStateSchema still accepts revoked, for later phases", () => {
    expect(shareLinkStateSchema.safeParse("revoked").success).toBe(true);
  });
});

describe("canonicalSubtaskIdSchema", () => {
  it.each(["1", "9", "42", "1000000000000"])(
    "accepts a valid decimal-string subtask id %s",
    (value) => {
      expect(canonicalSubtaskIdSchema.safeParse(value).success).toBe(true);
    }
  );

  it("rejects a JavaScript number", () => {
    expect(canonicalSubtaskIdSchema.safeParse(42).success).toBe(false);
  });

  it("rejects a JavaScript bigint", () => {
    expect(canonicalSubtaskIdSchema.safeParse(BigInt(42)).success).toBe(false);
  });

  it("rejects a leading-zero id", () => {
    expect(canonicalSubtaskIdSchema.safeParse("042").success).toBe(false);
  });

  it("rejects zero", () => {
    expect(canonicalSubtaskIdSchema.safeParse("0").success).toBe(false);
  });

  it("rejects a negative id", () => {
    expect(canonicalSubtaskIdSchema.safeParse("-1").success).toBe(false);
  });

  it.each(["1.5", "1e3", "abc", "", " 1", "1 ", "1,2"])(
    "rejects non-digit or malformed value %s",
    (value) => {
      expect(canonicalSubtaskIdSchema.safeParse(value).success).toBe(false);
    }
  );
});

describe("shareLinkManagementStateQuerySchema", () => {
  it("accepts a valid lowercase uuid projectId", () => {
    const result = shareLinkManagementStateQuerySchema.safeParse({
      projectId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an uppercase uuid and canonicalizes it to lowercase", () => {
    const result = shareLinkManagementStateQuerySchema.safeParse({
      projectId: VALID_UUID.toUpperCase(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe(VALID_UUID);
    }
  });

  it("rejects a non-uuid projectId", () => {
    const result = shareLinkManagementStateQuerySchema.safeParse({
      projectId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown top-level key (closed schema)", () => {
    const result = shareLinkManagementStateQuerySchema.safeParse({
      projectId: VALID_UUID,
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing projectId", () => {
    expect(shareLinkManagementStateQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("shareLinkSummaryQuerySchema - raw list validation order", () => {
  it("accepts a single valid uuid", () => {
    expect(
      shareLinkSummaryQuerySchema.safeParse({ projectIds: VALID_UUID }).success
    ).toBe(true);
  });

  it("accepts exactly 100 raw, distinct entries", () => {
    const ids = Array.from({ length: 100 }, (_, i) => uuidLike(i));
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: ids.join(","),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectIds).toHaveLength(100);
    }
  });

  it("rejects more than 100 raw entries", () => {
    const ids = Array.from({ length: 101 }, (_, i) => uuidLike(i));
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: ids.join(","),
    });
    expect(result.success).toBe(false);
  });

  it("rejects 101 raw copies of one valid uuid -- the raw count is checked before dedup", () => {
    const ids = Array.from({ length: 101 }, () => VALID_UUID);
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: ids.join(","),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty segment between two valid uuids (uuid,,uuid)", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: `${VALID_UUID},,${VALID_UUID_2}`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a leading comma", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: `,${VALID_UUID}`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a trailing comma", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: `${VALID_UUID},`,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing projectIds value", () => {
    expect(
      shareLinkSummaryQuerySchema.safeParse({ projectIds: null }).success
    ).toBe(false);
    expect(shareLinkSummaryQuerySchema.safeParse({}).success).toBe(false);
  });

  it("rejects an all-whitespace projectIds value", () => {
    expect(
      shareLinkSummaryQuerySchema.safeParse({ projectIds: "   " }).success
    ).toBe(false);
  });

  it("rejects a non-uuid segment", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: `${VALID_UUID},not-a-uuid`,
    });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace around each valid segment", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: ` ${VALID_UUID} , ${VALID_UUID_2} `,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectIds).toEqual([VALID_UUID, VALID_UUID_2]);
    }
  });

  it("canonicalizes every accepted uuid to lowercase", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: VALID_UUID.toUpperCase(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectIds).toEqual([VALID_UUID]);
    }
  });

  it("deduplicates a lowercase and uppercase spelling of the same uuid into one entry, preserving first-occurrence order", () => {
    const result = shareLinkSummaryQuerySchema.safeParse({
      projectIds: `${VALID_UUID_2},${VALID_UUID.toUpperCase()},${VALID_UUID}`,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectIds).toEqual([VALID_UUID_2, VALID_UUID]);
    }
  });
});

describe("strict ISO timestamp validation (via managedShareLinkSchema.createdAt)", () => {
  function withCreatedAt(createdAt: unknown) {
    return withManagedLinkData({
      link: validManagedLink({ createdAt }),
    });
  }

  it.each([VALID_TIMESTAMP, VALID_TIMESTAMP_OFFSET, "2026-02-28T23:59:59.999999-05:00"])(
    "accepts a valid strict ISO timestamp %s",
    (value) => {
      expect(
        shareLinkManagementStateDataSchema.safeParse(withCreatedAt(value)).success
      ).toBe(true);
    }
  );

  it("accepts the leap-day 2028-02-29", () => {
    expect(
      shareLinkManagementStateDataSchema.safeParse(
        withCreatedAt("2028-02-29T00:00:00Z")
      ).success
    ).toBe(true);
  });

  it.each([
    "2026-08-05",
    "2026-08-05 00:00:00Z",
    "2026-08-05T00:00:00",
    "2026-13-01T00:00:00Z",
    "2026-08-32T00:00:00Z",
    "2027-02-29T00:00:00Z",
    "2026-08-05T25:00:00Z",
    "not-a-timestamp",
    "",
    1754352000000,
  ])("rejects a malformed or non-strict timestamp %s", (value) => {
    expect(
      shareLinkManagementStateDataSchema.safeParse(withCreatedAt(value)).success
    ).toBe(false);
  });
});

describe("shareLinkManagementStateDataSchema - basic acceptance", () => {
  it("accepts the no-link variant", () => {
    expect(shareLinkManagementStateDataSchema.safeParse(noManagedLinkData()).success).toBe(
      true
    );
  });

  it("accepts the with-link variant", () => {
    expect(
      shareLinkManagementStateDataSchema.safeParse(withManagedLinkData()).success
    ).toBe(true);
  });

  it("accepts a valid currentUpdate on the with-link variant", () => {
    const data = withManagedLinkData({
      currentUpdate: {
        body: "Hello client",
        version: 1,
        publishedAt: VALID_TIMESTAMP,
      },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(true);
  });

  it("does not accept a generic unknown record as a successful payload", () => {
    expect(
      shareLinkManagementStateDataSchema.safeParse({ anything: "goes" }).success
    ).toBe(false);
  });
});

describe("shareLinkManagementStateDataSchema - closed union rejects impossible combinations", () => {
  it("rejects link=null with a non-empty mappedTaskIds", () => {
    const data = noManagedLinkData({ mappedTaskIds: ["1"] });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects link=null with a non-empty mappedResourceIds", () => {
    const data = noManagedLinkData({ mappedResourceIds: [VALID_UUID] });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects link=null with a non-null currentUpdate", () => {
    const data = noManagedLinkData({
      currentUpdate: { body: "hi", version: 1, publishedAt: VALID_TIMESTAMP },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a link with state='revoked'", () => {
    const data = withManagedLinkData({ link: validManagedLink({ state: "revoked" }) });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects link=undefined-shaped payload (must be exactly null or the strict object)", () => {
    const data = withManagedLinkData({ link: undefined });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });
});

describe("shareLinkManagementStateDataSchema - field-level validation on the with-link variant", () => {
  it.each(["ltr", "rtl", "auto", "unknown", "", null])(
    "contentDirection %s",
    (value) => {
      const data = withManagedLinkData({ link: validManagedLink({ contentDirection: value }) });
      const shouldPass = value === "ltr" || value === "rtl" || value === "auto";
      expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(
        shouldPass
      );
    }
  );

  it.each([
    "abcdefgh12345678",
    "AbC-123_XYZ-4567",
    "short",
    "has spaces xxxxxx",
    "has/slash/xxxxxxx",
    "x".repeat(65),
  ])("publicId %s", (value) => {
    const data = withManagedLinkData({ link: validManagedLink({ publicId: value }) });
    const shouldPass = /^[A-Za-z0-9_-]{16,64}$/.test(value);
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(
      shouldPass
    );
  });

  it.each([-1, 0])(
    "rejects a non-positive configurationVersion %d",
    (value) => {
      const data = withManagedLinkData({
        link: validManagedLink({ configurationVersion: value }),
      });
      expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(
        false
      );
    }
  );

  it("rejects a negative viewCount", () => {
    const data = withManagedLinkData({ link: validManagedLink({ viewCount: -1 }) });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it.each([-1, 0])("rejects a non-positive update version %d", (value) => {
    const data = withManagedLinkData({
      currentUpdate: { body: "hello", version: value, publishedAt: VALID_TIMESTAMP },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it.each([
    "secretDigest",
    "secretDigestVersion",
    "pinHash",
    "pinSalt",
    "pinHashVersion",
    "pinScryptN",
    "pinScryptR",
    "pinScryptP",
    "pinKeyLength",
    "userId",
    "projectId",
    "createdBy",
  ])("rejects a forbidden field %s on the link object", (forbiddenField) => {
    const data = withManagedLinkData({
      link: validManagedLink({ [forbiddenField]: "leak" }),
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a currentUpdate with any field beyond body, version, publishedAt", () => {
    const data = withManagedLinkData({
      currentUpdate: {
        body: "hello",
        version: 1,
        publishedAt: VALID_TIMESTAMP,
        createdBy: "leak",
      },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });
});

describe("owner-authored text is validated but never transformed (management state)", () => {
  it("preserves clientFacingSubtitle exactly, including intentional leading/trailing whitespace and newlines", () => {
    const original = "  Hello\nworld  \n";
    const data = withManagedLinkData({
      link: validManagedLink({ clientFacingSubtitle: original }),
    });
    const result = shareLinkManagementStateDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    expect((result as { success: true; data: { link: { clientFacingSubtitle: string } } }).data.link.clientFacingSubtitle).toBe(
      original
    );
  });

  it("accepts a null clientFacingSubtitle", () => {
    const data = withManagedLinkData({
      link: validManagedLink({ clientFacingSubtitle: null }),
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(true);
  });

  it("rejects a whitespace-only clientFacingSubtitle", () => {
    const data = withManagedLinkData({
      link: validManagedLink({ clientFacingSubtitle: "   \n\t  " }),
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a clientFacingSubtitle whose original (untrimmed) length exceeds 200", () => {
    const original = "a".repeat(199) + "  "; // trims to 199 chars (valid), but original length is 201
    const data = withManagedLinkData({
      link: validManagedLink({ clientFacingSubtitle: original }),
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("accepts a clientFacingSubtitle whose original length is exactly 200", () => {
    const original = "a".repeat(200);
    const data = withManagedLinkData({
      link: validManagedLink({ clientFacingSubtitle: original }),
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(true);
  });

  it("preserves currentUpdate.body exactly, including intentional leading/trailing whitespace and newlines", () => {
    const original = "  Line one\n\nLine two  \t";
    const data = withManagedLinkData({
      currentUpdate: { body: original, version: 1, publishedAt: VALID_TIMESTAMP },
    });
    const result = shareLinkManagementStateDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    expect(
      (result as { success: true; data: { currentUpdate: { body: string } } }).data
        .currentUpdate.body
    ).toBe(original);
  });

  it("rejects a whitespace-only currentUpdate.body", () => {
    const data = withManagedLinkData({
      currentUpdate: { body: "  \n  ", version: 1, publishedAt: VALID_TIMESTAMP },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a currentUpdate.body whose original length exceeds 5000", () => {
    const original = "a".repeat(4999) + "  "; // trims to 4999 (valid), original length 5001
    const data = withManagedLinkData({
      currentUpdate: { body: original, version: 1, publishedAt: VALID_TIMESTAMP },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(false);
  });

  it("accepts a currentUpdate.body whose original length is exactly 5000", () => {
    const original = "a".repeat(5000);
    const data = withManagedLinkData({
      currentUpdate: { body: original, version: 1, publishedAt: VALID_TIMESTAMP },
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(true);
  });
});

describe("shareLinkSummaryDataSchema - basic acceptance", () => {
  it("accepts a valid keyed-by-project-id payload mixing both union variants", () => {
    const result = shareLinkSummaryDataSchema.safeParse({
      [VALID_UUID]: noSummaryEntry(VALID_UUID),
      [VALID_UUID_2]: withSummaryEntry(VALID_UUID_2, { linkId: VALID_UUID, taskCount: 3 }),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid record key", () => {
    const result = shareLinkSummaryDataSchema.safeParse({
      "not-a-uuid": noSummaryEntry(VALID_UUID),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a record key that does not equal its entry's projectId", () => {
    const result = shareLinkSummaryDataSchema.safeParse({
      [VALID_UUID]: noSummaryEntry(VALID_UUID_2),
    });
    expect(result.success).toBe(false);
  });

  it("does not accept a generic unknown record as a successful payload", () => {
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: { anything: "goes" } })
        .success
    ).toBe(false);
  });
});

describe("shareLinkSummaryDataSchema - closed union rejects impossible combinations and revoked state", () => {
  it("rejects hasPin=true when there is no link", () => {
    const entry = noSummaryEntry(VALID_UUID, { hasPin: true });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects viewCount>0 when there is no link", () => {
    const entry = noSummaryEntry(VALID_UUID, { viewCount: 1 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects taskCount>0 when there is no link", () => {
    const entry = noSummaryEntry(VALID_UUID, { taskCount: 1 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects resourceCount>0 when there is no link", () => {
    const entry = noSummaryEntry(VALID_UUID, { resourceCount: 1 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a linkId present alongside state=null (mixed variant)", () => {
    const entry = noSummaryEntry(VALID_UUID, { linkId: VALID_UUID_2 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects state='revoked' on a with-link summary entry -- this RPC can never return one", () => {
    const entry = withSummaryEntry(VALID_UUID, { state: "revoked" });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a non-null unreadCount", () => {
    const entry = withSummaryEntry(VALID_UUID, { unreadCount: 0 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a negative viewCount on a with-link entry", () => {
    const entry = withSummaryEntry(VALID_UUID, { viewCount: -1 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a negative taskCount on a with-link entry", () => {
    const entry = withSummaryEntry(VALID_UUID, { taskCount: -1 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a negative resourceCount on a with-link entry", () => {
    const entry = withSummaryEntry(VALID_UUID, { resourceCount: -1 });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a malformed createdAt timestamp on a with-link entry", () => {
    const entry = withSummaryEntry(VALID_UUID, { createdAt: "not-a-timestamp" });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it("rejects a null createdAt on a with-link entry (createdAt is required once a link exists)", () => {
    const entry = withSummaryEntry(VALID_UUID, { createdAt: null });
    expect(
      shareLinkSummaryDataSchema.safeParse({ [VALID_UUID]: entry }).success
    ).toBe(false);
  });

  it.each(["secretDigest", "pinHash", "pinSalt", "userId"])(
    "rejects a forbidden field %s on a summary entry",
    (forbiddenField) => {
      const entry = withSummaryEntry(VALID_UUID, { [forbiddenField]: "leak" });
      const result = shareLinkSummaryDataSchema.safeParse({
        [VALID_UUID]: entry,
      });
      expect(result.success).toBe(false);
    }
  );
});

describe("API response envelope", () => {
  it("shareLinkApiErrorSchema accepts {ok:false, code, error} and nothing else", () => {
    expect(
      shareLinkApiErrorSchema.safeParse({
        ok: false,
        code: "PROJECT_NOT_FOUND",
        error: "Project not found.",
      }).success
    ).toBe(true);

    expect(
      shareLinkApiErrorSchema.safeParse({
        success: false,
        error: "Project not found.",
      }).success
    ).toBe(false);

    expect(
      shareLinkApiErrorSchema.safeParse({
        ok: false,
        code: "SOMETHING_ELSE",
        error: "x",
      }).success
    ).toBe(false);
  });

  it("shareLinkManagementStateResponseSchema accepts {ok:true, data} on success", () => {
    const result = shareLinkManagementStateResponseSchema.safeParse({
      ok: true,
      data: withManagedLinkData(),
    });
    expect(result.success).toBe(true);
  });

  it("shareLinkManagementStateResponseSchema rejects the old {success, ...} shape", () => {
    const result = shareLinkManagementStateResponseSchema.safeParse({
      success: true,
      data: withManagedLinkData(),
    });
    expect(result.success).toBe(false);
  });

  it("shareLinkSummaryResponseSchema accepts {ok:true, data} on success", () => {
    const result = shareLinkSummaryResponseSchema.safeParse({
      ok: true,
      data: { [VALID_UUID]: noSummaryEntry(VALID_UUID) },
    });
    expect(result.success).toBe(true);
  });

  it("shareLinkSummaryResponseSchema rejects the old {success, ...} shape", () => {
    const result = shareLinkSummaryResponseSchema.safeParse({
      success: true,
      data: { [VALID_UUID]: noSummaryEntry(VALID_UUID) },
    });
    expect(result.success).toBe(false);
  });
});
