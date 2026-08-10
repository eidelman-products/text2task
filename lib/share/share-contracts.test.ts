import { describe, expect, it } from "vitest";
import {
  activateShareLinkDataSchema,
  activateShareLinkRpcDataSchema,
  canonicalizeUuid,
  canonicalSubtaskIdSchema,
  clearSharePinDataSchema,
  clearShareLinkExpiryDataSchema,
  createShareLinkDraftDataSchema,
  createShareLinkDraftRequestSchema,
  disableShareLinkDataSchema,
  managedShareLinkStateSchema,
  reenableShareLinkDataSchema,
  revealShareLinkSecretDataSchema,
  revealShareLinkSecretRpcDataSchema,
  revokeShareLinkDataSchema,
  rotateShareLinkSecretDataSchema,
  saveShareConfigurationDataSchema,
  saveShareConfigurationRequestSchema,
  saveShareConfigurationResourceItemSchema,
  saveShareConfigurationResourcesSchema,
  saveShareConfigurationSettingsSchema,
  saveShareConfigurationTaskItemSchema,
  saveShareConfigurationTasksSchema,
  setSharePinDataSchema,
  setSharePinRequestSchema,
  setShareLinkExpiryDataSchema,
  setShareLinkExpiryRequestSchema,
  shareLinkApiErrorCodeSchema,
  shareLinkApiErrorSchema,
  shareLinkIdParamSchema,
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
// The exact V1 shape (see lib/share/share-public-id.server.ts's
// generateSharePublicId: randomBytes(18).toString("base64url"), always
// exactly 24 characters) -- used only for the Phase 1B.3 rotate/reveal
// contracts, which are held to this narrower shape than the broader
// 16-64-character sharePublicIdSchema every Phase 1B.1/1B.2 contract
// still uses.
const VALID_PUBLIC_ID_V1 = "abcdefgh12345678ABCDEFGH";
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

describe("shareLinkApiErrorCodeSchema - Phase 1B.2 additions", () => {
  it.each([
    "PROJECT_ARCHIVED",
    "SHARE_LINK_NOT_FOUND",
    "SHARE_LINK_STATE_CONFLICT",
    "SHARE_LINK_ANOTHER_LINK_ACTIVE",
    "INTERNAL_ERROR",
  ])("accepts %s", (code) => {
    expect(shareLinkApiErrorCodeSchema.safeParse(code).success).toBe(true);
  });

  it("still accepts every Phase 1B.1 code", () => {
    for (const code of ["UNAUTHENTICATED", "INVALID_REQUEST", "PROJECT_NOT_FOUND"]) {
      expect(shareLinkApiErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("rejects an unknown code", () => {
    expect(shareLinkApiErrorCodeSchema.safeParse("SOMETHING_ELSE").success).toBe(
      false
    );
  });
});

describe("shareLinkIdParamSchema", () => {
  it("accepts a valid lowercase uuid", () => {
    const result = shareLinkIdParamSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts and canonicalizes an uppercase uuid to lowercase", () => {
    const result = shareLinkIdParamSchema.safeParse({ id: VALID_UUID.toUpperCase() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID);
    }
  });

  it("rejects a non-uuid id", () => {
    expect(shareLinkIdParamSchema.safeParse({ id: "not-a-uuid" }).success).toBe(
      false
    );
  });

  it("rejects an unknown top-level key (closed schema)", () => {
    expect(
      shareLinkIdParamSchema.safeParse({ id: VALID_UUID, extra: "nope" }).success
    ).toBe(false);
  });
});

describe("createShareLinkDraftRequestSchema", () => {
  it("accepts a valid projectId and canonicalizes it", () => {
    const result = createShareLinkDraftRequestSchema.safeParse({
      projectId: VALID_UUID.toUpperCase(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe(VALID_UUID);
    }
  });

  it("rejects a missing or invalid projectId", () => {
    expect(createShareLinkDraftRequestSchema.safeParse({}).success).toBe(false);
    expect(
      createShareLinkDraftRequestSchema.safeParse({ projectId: "nope" }).success
    ).toBe(false);
  });

  it("rejects an unknown top-level key", () => {
    expect(
      createShareLinkDraftRequestSchema.safeParse({
        projectId: VALID_UUID,
        secret: "leak",
      }).success
    ).toBe(false);
  });
});

function validCreateShareLinkDraftData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "draft",
    createdAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe("createShareLinkDraftDataSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createShareLinkDraftDataSchema.safeParse(validCreateShareLinkDraftData())
        .success
    ).toBe(true);
  });

  it("rejects a state other than draft", () => {
    for (const state of ["active", "disabled", "expired", "revoked"]) {
      expect(
        createShareLinkDraftDataSchema.safeParse(
          validCreateShareLinkDraftData({ state })
        ).success
      ).toBe(false);
    }
  });

  it("rejects a secret field -- create data never reveals a secret", () => {
    expect(
      createShareLinkDraftDataSchema.safeParse(
        validCreateShareLinkDraftData({ secret: "x".repeat(43) })
      ).success
    ).toBe(false);
  });

  it("rejects any digest/ciphertext/pin field", () => {
    for (const forbiddenField of ["secretDigest", "ciphertext", "pinHash", "userId"]) {
      expect(
        createShareLinkDraftDataSchema.safeParse(
          validCreateShareLinkDraftData({ [forbiddenField]: "leak" })
        ).success
      ).toBe(false);
    }
  });
});

const VALID_RAW_SECRET = "P9k2QwErTyUiOpAsDfGhJkLzXcVbNm1234567890abc"; // 43 chars

function validActivateShareLinkRpcData(overrides: Record<string, unknown> = {}) {
  return {
    linkId: VALID_UUID,
    publicId: VALID_PUBLIC_ID,
    state: "active",
    configurationVersion: 1,
    activatedAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe("activateShareLinkRpcDataSchema", () => {
  it("accepts the RPC's own row shape, without a secret field", () => {
    const result = activateShareLinkRpcDataSchema.safeParse(
      validActivateShareLinkRpcData()
    );
    expect(result.success).toBe(true);
  });

  it("rejects a secret field on the raw RPC row -- Postgres never returns one", () => {
    expect(
      activateShareLinkRpcDataSchema.safeParse(
        validActivateShareLinkRpcData({ secret: VALID_RAW_SECRET })
      ).success
    ).toBe(false);
  });

  it("rejects a state other than active", () => {
    expect(
      activateShareLinkRpcDataSchema.safeParse(
        validActivateShareLinkRpcData({ state: "draft" })
      ).success
    ).toBe(false);
  });

  it("rejects a non-positive configurationVersion", () => {
    expect(
      activateShareLinkRpcDataSchema.safeParse(
        validActivateShareLinkRpcData({ configurationVersion: 0 })
      ).success
    ).toBe(false);
  });
});

describe("activateShareLinkDataSchema", () => {
  it("accepts the RPC row plus a valid 43-character base64url secret", () => {
    const result = activateShareLinkDataSchema.safeParse({
      ...validActivateShareLinkRpcData(),
      secret: VALID_RAW_SECRET,
    });
    expect(result.success).toBe(true);
  });

  it("requires the secret field", () => {
    expect(
      activateShareLinkDataSchema.safeParse(validActivateShareLinkRpcData())
        .success
    ).toBe(false);
  });

  it.each(["", "a".repeat(42), "a".repeat(44), "not valid chars!!!!!!!!!!!!!!!!!!!!!!!!!!!"])(
    "rejects an invalid secret shape %s",
    (secret) => {
      expect(
        activateShareLinkDataSchema.safeParse({
          ...validActivateShareLinkRpcData(),
          secret,
        }).success
      ).toBe(false);
    }
  );

  it.each(["digest", "secretDigest", "ciphertext", "nonce", "authTag", "encryptionVersion", "userId", "projectId"])(
    "rejects a forbidden field %s",
    (forbiddenField) => {
      expect(
        activateShareLinkDataSchema.safeParse({
          ...validActivateShareLinkRpcData(),
          secret: VALID_RAW_SECRET,
          [forbiddenField]: "leak",
        }).success
      ).toBe(false);
    }
  );
});

describe("disableShareLinkDataSchema", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      state: "disabled",
      configurationVersion: 2,
      disabledAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  it("accepts a valid payload", () => {
    expect(disableShareLinkDataSchema.safeParse(validData()).success).toBe(true);
  });

  it("rejects a state other than disabled", () => {
    expect(
      disableShareLinkDataSchema.safeParse(validData({ state: "active" })).success
    ).toBe(false);
  });

  it("rejects a secret field -- disable data never reveals a secret", () => {
    expect(
      disableShareLinkDataSchema.safeParse(
        validData({ secret: VALID_RAW_SECRET })
      ).success
    ).toBe(false);
  });
});

describe("reenableShareLinkDataSchema", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      state: "active",
      configurationVersion: 3,
      activatedAt: VALID_TIMESTAMP,
      disabledAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  it("accepts a valid payload", () => {
    expect(reenableShareLinkDataSchema.safeParse(validData()).success).toBe(true);
  });

  it("rejects a state other than active", () => {
    expect(
      reenableShareLinkDataSchema.safeParse(validData({ state: "disabled" }))
        .success
    ).toBe(false);
  });

  it("rejects a secret field -- re-enable data never reveals a secret", () => {
    expect(
      reenableShareLinkDataSchema.safeParse(
        validData({ secret: VALID_RAW_SECRET })
      ).success
    ).toBe(false);
  });

  it("requires both activatedAt and disabledAt", () => {
    const { activatedAt: _activatedAt, ...withoutActivatedAt } = validData();
    expect(reenableShareLinkDataSchema.safeParse(withoutActivatedAt).success).toBe(
      false
    );
    const { disabledAt: _disabledAt, ...withoutDisabledAt } = validData();
    expect(reenableShareLinkDataSchema.safeParse(withoutDisabledAt).success).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------
// Phase 1B.3 access-operation contracts
// ---------------------------------------------------------------------

describe("shareLinkApiErrorCodeSchema - Phase 1B.3 additions", () => {
  it("accepts SHARE_LINK_SECRET_UNAVAILABLE", () => {
    expect(
      shareLinkApiErrorCodeSchema.safeParse("SHARE_LINK_SECRET_UNAVAILABLE").success
    ).toBe(true);
  });

  it.each([
    "INVALID_PIN_MATERIAL",
    "INVALID_CIPHERTEXT",
    "INVALID_NONCE",
    "INVALID_AUTH_TAG",
    "INVALID_SECRET_DIGEST",
    "P0001",
  ])("never exposes the internal code %s", (code) => {
    expect(shareLinkApiErrorCodeSchema.safeParse(code).success).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Phase 2A addition: the Client Share availability gate's generic,
// fail-closed response code (never distinguishes "feature disabled" from
// "route does not exist" to a caller).
// ---------------------------------------------------------------------

describe("shareLinkApiErrorCodeSchema - Phase 2A additions", () => {
  it("accepts NOT_FOUND", () => {
    expect(shareLinkApiErrorCodeSchema.safeParse("NOT_FOUND").success).toBe(true);
  });
});

describe("setSharePinRequestSchema", () => {
  it.each(["1234", "12345", "123456"])("accepts a valid %s-digit pin", (pin) => {
    expect(setSharePinRequestSchema.safeParse({ pin }).success).toBe(true);
  });

  it.each(["123", "1234567", "12a4", "", " 1234", "1234 "])(
    "rejects an invalid pin shape %s",
    (pin) => {
      expect(setSharePinRequestSchema.safeParse({ pin }).success).toBe(false);
    }
  );

  it("rejects a numeric pin (no coercion)", () => {
    expect(setSharePinRequestSchema.safeParse({ pin: 1234 }).success).toBe(false);
  });

  it("rejects an unknown top-level key (closed schema)", () => {
    expect(
      setSharePinRequestSchema.safeParse({ pin: "1234", extra: "nope" }).success
    ).toBe(false);
  });

  it("rejects a missing pin", () => {
    expect(setSharePinRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("setSharePinDataSchema / clearSharePinDataSchema", () => {
  function validSetData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      hasPin: true,
      state: "active",
      configurationVersion: 2,
      updatedAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  function validClearData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      hasPin: false,
      state: "active",
      configurationVersion: 2,
      updatedAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  it("setSharePinDataSchema accepts a valid payload", () => {
    expect(setSharePinDataSchema.safeParse(validSetData()).success).toBe(true);
  });

  it("setSharePinDataSchema rejects hasPin=false", () => {
    expect(
      setSharePinDataSchema.safeParse(validSetData({ hasPin: false })).success
    ).toBe(false);
  });

  it("setSharePinDataSchema rejects a revoked state -- PIN operations reject revoked links", () => {
    expect(
      setSharePinDataSchema.safeParse(validSetData({ state: "revoked" })).success
    ).toBe(false);
  });

  it("clearSharePinDataSchema accepts a valid payload", () => {
    expect(clearSharePinDataSchema.safeParse(validClearData()).success).toBe(true);
  });

  it("clearSharePinDataSchema rejects hasPin=true", () => {
    expect(
      clearSharePinDataSchema.safeParse(validClearData({ hasPin: true })).success
    ).toBe(false);
  });

  it.each([
    "pinHash",
    "pinSalt",
    "pinHashVersion",
    "pinScryptN",
    "pinScryptR",
    "pinScryptP",
    "pinKeyLength",
  ])("never exposes the PIN material field %s", (forbiddenField) => {
    expect(
      setSharePinDataSchema.safeParse(validSetData({ [forbiddenField]: "leak" }))
        .success
    ).toBe(false);
    expect(
      clearSharePinDataSchema.safeParse(validClearData({ [forbiddenField]: "leak" }))
        .success
    ).toBe(false);
  });
});

describe("setShareLinkExpiryRequestSchema", () => {
  it("accepts a valid strict ISO timestamp and preserves it exactly, unchanged", () => {
    const result = setShareLinkExpiryRequestSchema.safeParse({
      expiresAt: VALID_TIMESTAMP_OFFSET,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresAt).toBe(VALID_TIMESTAMP_OFFSET);
    }
  });

  it.each(["2026-08-05", "not-a-timestamp", "", 1754352000000, null])(
    "rejects a malformed or non-strict expiresAt %s",
    (expiresAt) => {
      expect(
        setShareLinkExpiryRequestSchema.safeParse({ expiresAt }).success
      ).toBe(false);
    }
  );

  it("rejects an unknown top-level key (closed schema)", () => {
    expect(
      setShareLinkExpiryRequestSchema.safeParse({
        expiresAt: VALID_TIMESTAMP,
        extra: "nope",
      }).success
    ).toBe(false);
  });

  it("rejects a missing expiresAt", () => {
    expect(setShareLinkExpiryRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("setShareLinkExpiryDataSchema / clearShareLinkExpiryDataSchema", () => {
  function validSetData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      state: "active",
      expiresAt: VALID_TIMESTAMP,
      configurationVersion: 2,
      updatedAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  function validClearData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      state: "active",
      expiresAt: null,
      configurationVersion: 2,
      updatedAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  it("setShareLinkExpiryDataSchema accepts a valid payload", () => {
    expect(setShareLinkExpiryDataSchema.safeParse(validSetData()).success).toBe(
      true
    );
  });

  it("setShareLinkExpiryDataSchema rejects a null expiresAt -- set always returns a real timestamp", () => {
    expect(
      setShareLinkExpiryDataSchema.safeParse(validSetData({ expiresAt: null }))
        .success
    ).toBe(false);
  });

  it("setShareLinkExpiryDataSchema rejects a revoked state", () => {
    expect(
      setShareLinkExpiryDataSchema.safeParse(validSetData({ state: "revoked" }))
        .success
    ).toBe(false);
  });

  it("clearShareLinkExpiryDataSchema accepts a valid payload", () => {
    expect(
      clearShareLinkExpiryDataSchema.safeParse(validClearData()).success
    ).toBe(true);
  });

  it("clearShareLinkExpiryDataSchema rejects a non-null expiresAt -- clear always returns null", () => {
    expect(
      clearShareLinkExpiryDataSchema.safeParse(
        validClearData({ expiresAt: VALID_TIMESTAMP })
      ).success
    ).toBe(false);
  });

  it.each(["draft", "active", "disabled"])(
    "clearShareLinkExpiryDataSchema accepts state %s",
    (state) => {
      expect(
        clearShareLinkExpiryDataSchema.safeParse(validClearData({ state })).success
      ).toBe(true);
    }
  );

  it.each(["expired", "revoked"])(
    "clearShareLinkExpiryDataSchema rejects state %s -- clear_share_link_expiry never returns it",
    (state) => {
      expect(
        clearShareLinkExpiryDataSchema.safeParse(validClearData({ state })).success
      ).toBe(false);
    }
  );

  it("setShareLinkExpiryDataSchema still accepts state expired -- SET may return an expired link without changing its state", () => {
    expect(
      setShareLinkExpiryDataSchema.safeParse(validSetData({ state: "expired" }))
        .success
    ).toBe(true);
  });
});

describe("rotateShareLinkSecretDataSchema", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      publicId: VALID_PUBLIC_ID_V1,
      state: "active",
      configurationVersion: 4,
      rotatedAt: VALID_TIMESTAMP,
      secret: VALID_RAW_SECRET,
      ...overrides,
    };
  }

  it("accepts a valid payload with a fresh raw secret", () => {
    expect(rotateShareLinkSecretDataSchema.safeParse(validData()).success).toBe(
      true
    );
  });

  it("requires the secret field", () => {
    const { secret: _secret, ...withoutSecret } = validData();
    expect(
      rotateShareLinkSecretDataSchema.safeParse(withoutSecret).success
    ).toBe(false);
  });

  it.each(["", "a".repeat(42), "a".repeat(44)])(
    "rejects an invalid secret shape %s",
    (secret) => {
      expect(
        rotateShareLinkSecretDataSchema.safeParse(validData({ secret })).success
      ).toBe(false);
    }
  );

  it.each(["active", "disabled"])("accepts state %s", (state) => {
    expect(
      rotateShareLinkSecretDataSchema.safeParse(validData({ state })).success
    ).toBe(true);
  });

  it.each(["draft", "expired", "revoked"])(
    "rejects state %s -- rotate_share_link_secret only ever returns active or disabled",
    (state) => {
      expect(
        rotateShareLinkSecretDataSchema.safeParse(validData({ state })).success
      ).toBe(false);
    }
  );

  it.each(["secretDigest", "ciphertext", "nonce", "authTag", "encryptionVersion"])(
    "rejects a forbidden encrypted-material field %s",
    (forbiddenField) => {
      expect(
        rotateShareLinkSecretDataSchema.safeParse(
          validData({ [forbiddenField]: "leak" })
        ).success
      ).toBe(false);
    }
  );

  it("accepts an exactly-24-character V1 publicId", () => {
    expect(
      rotateShareLinkSecretDataSchema.safeParse(
        validData({ publicId: VALID_PUBLIC_ID_V1 })
      ).success
    ).toBe(true);
  });

  it.each([23, 25])("rejects a publicId of the wrong length (%d)", (length) => {
    expect(
      rotateShareLinkSecretDataSchema.safeParse(
        validData({ publicId: "a".repeat(length) })
      ).success
    ).toBe(false);
  });

  it("rejects a schema-valid-elsewhere 16-character publicId -- Phase 1B.3 holds rotate to the exact V1 shape", () => {
    expect(
      rotateShareLinkSecretDataSchema.safeParse(
        validData({ publicId: VALID_PUBLIC_ID })
      ).success
    ).toBe(false);
  });
});

describe("revokeShareLinkDataSchema", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      state: "revoked",
      configurationVersion: 5,
      revokedAt: VALID_TIMESTAMP,
      ...overrides,
    };
  }

  it("accepts a valid payload", () => {
    expect(revokeShareLinkDataSchema.safeParse(validData()).success).toBe(true);
  });

  it("rejects a state other than revoked", () => {
    for (const state of ["draft", "active", "disabled", "expired"]) {
      expect(
        revokeShareLinkDataSchema.safeParse(validData({ state })).success
      ).toBe(false);
    }
  });

  it("rejects a secret field -- revoke data never reveals a secret", () => {
    expect(
      revokeShareLinkDataSchema.safeParse(validData({ secret: VALID_RAW_SECRET }))
        .success
    ).toBe(false);
  });
});

describe("revealShareLinkSecretDataSchema (safe browser result)", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      publicId: VALID_PUBLIC_ID_V1,
      secret: VALID_RAW_SECRET,
      ...overrides,
    };
  }

  it("accepts a valid payload", () => {
    expect(revealShareLinkSecretDataSchema.safeParse(validData()).success).toBe(
      true
    );
  });

  it("requires the secret field", () => {
    const { secret: _secret, ...withoutSecret } = validData();
    expect(
      revealShareLinkSecretDataSchema.safeParse(withoutSecret).success
    ).toBe(false);
  });

  it.each([
    "ciphertextHex",
    "nonceHex",
    "authTagHex",
    "encryptionVersion",
    "secretDigest",
  ])("rejects a forbidden encrypted-material field %s", (forbiddenField) => {
    expect(
      revealShareLinkSecretDataSchema.safeParse(
        validData({ [forbiddenField]: "leak" })
      ).success
    ).toBe(false);
  });

  it("accepts an exactly-24-character V1 publicId", () => {
    expect(
      revealShareLinkSecretDataSchema.safeParse(
        validData({ publicId: VALID_PUBLIC_ID_V1 })
      ).success
    ).toBe(true);
  });

  it.each([23, 25])("rejects a publicId of the wrong length (%d)", (length) => {
    expect(
      revealShareLinkSecretDataSchema.safeParse(
        validData({ publicId: "a".repeat(length) })
      ).success
    ).toBe(false);
  });

  it("rejects a schema-valid-elsewhere 16-character publicId -- Phase 1B.3 holds reveal to the exact V1 shape", () => {
    expect(
      revealShareLinkSecretDataSchema.safeParse(
        validData({ publicId: VALID_PUBLIC_ID })
      ).success
    ).toBe(false);
  });
});

describe("revealShareLinkSecretRpcDataSchema (repository-only encrypted shape)", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      publicId: VALID_PUBLIC_ID_V1,
      ciphertextHex: "a".repeat(86),
      nonceHex: "b".repeat(24),
      authTagHex: "c".repeat(32),
      encryptionVersion: 1,
      ...overrides,
    };
  }

  it("accepts a valid payload", () => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(validData()).success
    ).toBe(true);
  });

  it("rejects an uppercase-hex ciphertextHex -- must be lowercase", () => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ ciphertextHex: "A".repeat(86) })
      ).success
    ).toBe(false);
  });

  it.each([85, 87])("rejects a ciphertextHex of the wrong length (%d)", (length) => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ ciphertextHex: "a".repeat(length) })
      ).success
    ).toBe(false);
  });

  it.each([23, 25])("rejects a nonceHex of the wrong length (%d)", (length) => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ nonceHex: "b".repeat(length) })
      ).success
    ).toBe(false);
  });

  it.each([31, 33])("rejects an authTagHex of the wrong length (%d)", (length) => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ authTagHex: "c".repeat(length) })
      ).success
    ).toBe(false);
  });

  it("rejects an encryptionVersion other than exactly 1", () => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ encryptionVersion: 2 })
      ).success
    ).toBe(false);
  });

  it("rejects a plaintext secret field -- this schema only ever carries encrypted material", () => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ secret: VALID_RAW_SECRET })
      ).success
    ).toBe(false);
  });

  it("accepts an exactly-24-character V1 publicId", () => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ publicId: VALID_PUBLIC_ID_V1 })
      ).success
    ).toBe(true);
  });

  it.each([23, 25])("rejects a publicId of the wrong length (%d)", (length) => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ publicId: "a".repeat(length) })
      ).success
    ).toBe(false);
  });

  it("rejects a schema-valid-elsewhere 16-character publicId -- Phase 1B.3 holds reveal to the exact V1 shape", () => {
    expect(
      revealShareLinkSecretRpcDataSchema.safeParse(
        validData({ publicId: VALID_PUBLIC_ID })
      ).success
    ).toBe(false);
  });
});

describe("Phase 1B.1/1B.2 broad public-id contracts remain unchanged", () => {
  it("createShareLinkDraftDataSchema still accepts the broad 16-64-character sharePublicIdSchema shape", () => {
    expect(
      createShareLinkDraftDataSchema.safeParse(
        validCreateShareLinkDraftData({ publicId: VALID_PUBLIC_ID })
      ).success
    ).toBe(true);
  });

  it("activateShareLinkRpcDataSchema still accepts the broad 16-64-character sharePublicIdSchema shape", () => {
    expect(
      activateShareLinkRpcDataSchema.safeParse(
        validActivateShareLinkRpcData({ publicId: VALID_PUBLIC_ID })
      ).success
    ).toBe(true);
  });

  it("shareLinkManagementStateDataSchema's managed link still accepts the broad 16-64-character sharePublicIdSchema shape", () => {
    const data = withManagedLinkData({
      link: validManagedLink({ publicId: VALID_PUBLIC_ID }),
    });
    expect(shareLinkManagementStateDataSchema.safeParse(data).success).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase 1B.4 configuration-save contracts
// ---------------------------------------------------------------------

const VALID_SUBTASK_ID = "42";
const VALID_SUBTASK_ID_2 = "43";
const VALID_RESOURCE_ID = VALID_UUID;
const VALID_RESOURCE_ID_2 = VALID_UUID_2;

function validTaskItem(overrides: Record<string, unknown> = {}) {
  return {
    subtaskId: VALID_SUBTASK_ID,
    publicGroup: "in_progress",
    waitingForClientFeedback: false,
    displayOrder: 0,
    ...overrides,
  };
}

function validResourceItem(overrides: Record<string, unknown> = {}) {
  return {
    resourceId: VALID_RESOURCE_ID,
    publicLabel: "Contract PDF",
    canDownload: true,
    displayOrder: 0,
    ...overrides,
  };
}

describe("saveShareConfigurationSettingsSchema", () => {
  it("accepts a single supplied field", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({ commentsEnabled: true }).success
    ).toBe(true);
  });

  it("accepts all three fields together", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({
        commentsEnabled: true,
        clientFacingSubtitle: "Hello",
        contentDirection: "ltr",
      }).success
    ).toBe(true);
  });

  it("accepts an explicit clientFacingSubtitle: null to clear it", () => {
    const result = saveShareConfigurationSettingsSchema.safeParse({
      clientFacingSubtitle: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientFacingSubtitle).toBeNull();
    }
  });

  it("rejects an empty object -- at least one recognized key is required when settings is supplied", () => {
    expect(saveShareConfigurationSettingsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown key", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({
        commentsEnabled: true,
        extra: "nope",
      }).success
    ).toBe(false);
  });

  it("rejects a whitespace-only clientFacingSubtitle", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({
        clientFacingSubtitle: "   ",
      }).success
    ).toBe(false);
  });

  it("rejects a clientFacingSubtitle whose original length exceeds 200", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({
        clientFacingSubtitle: "a".repeat(199) + "  ",
      }).success
    ).toBe(false);
  });

  it("preserves clientFacingSubtitle exactly, without trimming", () => {
    const original = "  Hello\nworld  ";
    const result = saveShareConfigurationSettingsSchema.safeParse({
      clientFacingSubtitle: original,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientFacingSubtitle).toBe(original);
    }
  });

  it("rejects an invalid contentDirection", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({ contentDirection: "rtl-ish" })
        .success
    ).toBe(false);
  });

  it("rejects a non-boolean commentsEnabled", () => {
    expect(
      saveShareConfigurationSettingsSchema.safeParse({ commentsEnabled: "true" })
        .success
    ).toBe(false);
  });
});

describe("saveShareConfigurationTaskItemSchema", () => {
  it("accepts a valid item", () => {
    expect(saveShareConfigurationTaskItemSchema.safeParse(validTaskItem()).success).toBe(
      true
    );
  });

  it("rejects an unknown key", () => {
    expect(
      saveShareConfigurationTaskItemSchema.safeParse(validTaskItem({ extra: "nope" }))
        .success
    ).toBe(false);
  });

  it.each(["subtaskId", "publicGroup", "waitingForClientFeedback", "displayOrder"])(
    "rejects a missing required key %s",
    (key) => {
      const item = validTaskItem();
      delete (item as Record<string, unknown>)[key];
      expect(saveShareConfigurationTaskItemSchema.safeParse(item).success).toBe(false);
    }
  );

  it.each(["0", "01", "-1", "1.5", "abc", "", " 1", "1 "])(
    "rejects an invalid decimal subtaskId %s",
    (subtaskId) => {
      expect(
        saveShareConfigurationTaskItemSchema.safeParse(validTaskItem({ subtaskId }))
          .success
      ).toBe(false);
    }
  );

  it("never converts subtaskId to a JavaScript number", () => {
    const result = saveShareConfigurationTaskItemSchema.safeParse(validTaskItem());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.subtaskId).toBe("string");
    }
  });

  it("rejects an unknown publicGroup", () => {
    expect(
      saveShareConfigurationTaskItemSchema.safeParse(
        validTaskItem({ publicGroup: "urgent" })
      ).success
    ).toBe(false);
  });

  it.each(["in_progress", "waiting_for_feedback", "completed", "coming_up"])(
    "accepts the closed publicGroup value %s",
    (publicGroup) => {
      expect(
        saveShareConfigurationTaskItemSchema.safeParse(validTaskItem({ publicGroup }))
          .success
      ).toBe(true);
    }
  );

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "0", null])(
    "rejects an invalid displayOrder %s",
    (displayOrder) => {
      expect(
        saveShareConfigurationTaskItemSchema.safeParse(validTaskItem({ displayOrder }))
          .success
      ).toBe(false);
    }
  );

  it("accepts displayOrder 0", () => {
    expect(
      saveShareConfigurationTaskItemSchema.safeParse(validTaskItem({ displayOrder: 0 }))
        .success
    ).toBe(true);
  });

  it("accepts displayOrder 2147483647 -- the delivered integer column's own maximum", () => {
    expect(
      saveShareConfigurationTaskItemSchema.safeParse(
        validTaskItem({ displayOrder: 2147483647 })
      ).success
    ).toBe(true);
  });

  it("rejects displayOrder 2147483648 -- one past the delivered integer column's maximum", () => {
    expect(
      saveShareConfigurationTaskItemSchema.safeParse(
        validTaskItem({ displayOrder: 2147483648 })
      ).success
    ).toBe(false);
  });

  it("rejects displayOrder Number.MAX_SAFE_INTEGER -- far beyond the integer column's range", () => {
    expect(
      saveShareConfigurationTaskItemSchema.safeParse(
        validTaskItem({ displayOrder: Number.MAX_SAFE_INTEGER })
      ).success
    ).toBe(false);
  });
});

describe("saveShareConfigurationTasksSchema", () => {
  it("accepts an empty array (clears the mapping)", () => {
    const result = saveShareConfigurationTasksSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("accepts a list of distinct items", () => {
    expect(
      saveShareConfigurationTasksSchema.safeParse([
        validTaskItem({ subtaskId: VALID_SUBTASK_ID }),
        validTaskItem({ subtaskId: VALID_SUBTASK_ID_2 }),
      ]).success
    ).toBe(true);
  });

  it("rejects a duplicate subtaskId -- never silently deduplicated", () => {
    const result = saveShareConfigurationTasksSchema.safeParse([
      validTaskItem({ subtaskId: VALID_SUBTASK_ID }),
      validTaskItem({ subtaskId: VALID_SUBTASK_ID }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects more than 500 items", () => {
    const items = Array.from({ length: 501 }, (_, i) =>
      validTaskItem({ subtaskId: String(i + 1) })
    );
    expect(saveShareConfigurationTasksSchema.safeParse(items).success).toBe(false);
  });

  it("accepts exactly 500 items", () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      validTaskItem({ subtaskId: String(i + 1) })
    );
    expect(saveShareConfigurationTasksSchema.safeParse(items).success).toBe(true);
  });
});

describe("saveShareConfigurationResourceItemSchema", () => {
  it("accepts a valid item", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(validResourceItem()).success
    ).toBe(true);
  });

  it("canonicalizes resourceId to lowercase", () => {
    const result = saveShareConfigurationResourceItemSchema.safeParse(
      validResourceItem({ resourceId: VALID_RESOURCE_ID.toUpperCase() })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resourceId).toBe(VALID_RESOURCE_ID);
    }
  });

  it("rejects a non-uuid resourceId", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ resourceId: "not-a-uuid" })
      ).success
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ extra: "nope" })
      ).success
    ).toBe(false);
  });

  it.each(["resourceId", "publicLabel", "canDownload", "displayOrder"])(
    "rejects a missing required key %s",
    (key) => {
      const item = validResourceItem();
      delete (item as Record<string, unknown>)[key];
      expect(saveShareConfigurationResourceItemSchema.safeParse(item).success).toBe(
        false
      );
    }
  );

  it("rejects a whitespace-only publicLabel", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ publicLabel: "   " })
      ).success
    ).toBe(false);
  });

  it("rejects a publicLabel whose original length exceeds 120", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ publicLabel: "a".repeat(119) + "  " })
      ).success
    ).toBe(false);
  });

  it("preserves publicLabel exactly, without trimming", () => {
    const original = "  Contract PDF  ";
    const result = saveShareConfigurationResourceItemSchema.safeParse(
      validResourceItem({ publicLabel: original })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publicLabel).toBe(original);
    }
  });

  it.each([-1, 1.5, "0"])("rejects an invalid displayOrder %s", (displayOrder) => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ displayOrder })
      ).success
    ).toBe(false);
  });

  it("accepts displayOrder 2147483647 -- the delivered integer column's own maximum", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ displayOrder: 2147483647 })
      ).success
    ).toBe(true);
  });

  it("rejects displayOrder 2147483648 -- one past the delivered integer column's maximum", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ displayOrder: 2147483648 })
      ).success
    ).toBe(false);
  });

  it("rejects displayOrder Number.MAX_SAFE_INTEGER -- far beyond the integer column's range", () => {
    expect(
      saveShareConfigurationResourceItemSchema.safeParse(
        validResourceItem({ displayOrder: Number.MAX_SAFE_INTEGER })
      ).success
    ).toBe(false);
  });
});

describe("saveShareConfigurationResourcesSchema", () => {
  it("accepts an empty array (clears the mapping)", () => {
    const result = saveShareConfigurationResourcesSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("rejects a duplicate resourceId -- never silently deduplicated", () => {
    const result = saveShareConfigurationResourcesSchema.safeParse([
      validResourceItem({ resourceId: VALID_RESOURCE_ID }),
      validResourceItem({ resourceId: VALID_RESOURCE_ID }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate resourceId that differs only by letter case", () => {
    const result = saveShareConfigurationResourcesSchema.safeParse([
      validResourceItem({ resourceId: VALID_RESOURCE_ID }),
      validResourceItem({ resourceId: VALID_RESOURCE_ID.toUpperCase() }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects more than 500 items", () => {
    const items = Array.from({ length: 501 }, (_, i) =>
      validResourceItem({
        resourceId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      })
    );
    expect(saveShareConfigurationResourcesSchema.safeParse(items).success).toBe(false);
  });

  it("accepts exactly 500 items", () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      validResourceItem({
        resourceId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      })
    );
    expect(saveShareConfigurationResourcesSchema.safeParse(items).success).toBe(true);
  });
});

describe("saveShareConfigurationRequestSchema", () => {
  it("accepts a full request with all four groups", () => {
    const result = saveShareConfigurationRequestSchema.safeParse({
      settings: { commentsEnabled: true },
      tasks: [validTaskItem()],
      resources: [validResourceItem()],
      publishUpdate: { body: "Hello client" },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["settings", { settings: { commentsEnabled: true } }],
    ["tasks", { tasks: [validTaskItem()] }],
    ["resources", { resources: [validResourceItem()] }],
    ["publishUpdate", { publishUpdate: { body: "Hello client" } }],
  ])("accepts a request with only %s present", (_label, body) => {
    expect(saveShareConfigurationRequestSchema.safeParse(body).success).toBe(true);
  });

  it("accepts empty tasks/resources arrays to clear both mappings", () => {
    expect(
      saveShareConfigurationRequestSchema.safeParse({ tasks: [], resources: [] })
        .success
    ).toBe(true);
  });

  it("rejects an entirely empty body -- at least one group is required", () => {
    expect(saveShareConfigurationRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown top-level key", () => {
    expect(
      saveShareConfigurationRequestSchema.safeParse({
        settings: { commentsEnabled: true },
        linkId: VALID_UUID,
      }).success
    ).toBe(false);
  });

  it("rejects a linkId in the body -- the path alone supplies it", () => {
    const result = saveShareConfigurationRequestSchema.safeParse({
      linkId: VALID_UUID,
      settings: { commentsEnabled: true },
    });
    expect(result.success).toBe(false);
  });

  it.each(["secretDigest", "pinHash", "pinSalt", "userId", "projectId"])(
    "never accepts the private/secret field %s at the top level",
    (forbiddenField) => {
      const result = saveShareConfigurationRequestSchema.safeParse({
        settings: { commentsEnabled: true },
        [forbiddenField]: "leak",
      });
      expect(result.success).toBe(false);
    }
  );

  it("rejects a null tasks/resources/publishUpdate group -- these are not nullable at the HTTP boundary", () => {
    expect(
      saveShareConfigurationRequestSchema.safeParse({ tasks: null }).success
    ).toBe(false);
    expect(
      saveShareConfigurationRequestSchema.safeParse({ resources: null }).success
    ).toBe(false);
    expect(
      saveShareConfigurationRequestSchema.safeParse({ publishUpdate: null }).success
    ).toBe(false);
  });

  it("rejects a whitespace-only publishUpdate.body", () => {
    expect(
      saveShareConfigurationRequestSchema.safeParse({
        publishUpdate: { body: "   " },
      }).success
    ).toBe(false);
  });

  it("rejects a publishUpdate.body whose original length exceeds 5000", () => {
    expect(
      saveShareConfigurationRequestSchema.safeParse({
        publishUpdate: { body: "a".repeat(4999) + "  " },
      }).success
    ).toBe(false);
  });

  it("preserves publishUpdate.body exactly, without trimming", () => {
    const original = "  Update body  \n";
    const result = saveShareConfigurationRequestSchema.safeParse({
      publishUpdate: { body: original },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publishUpdate?.body).toBe(original);
    }
  });
});

describe("saveShareConfigurationDataSchema", () => {
  function validData(overrides: Record<string, unknown> = {}) {
    return {
      linkId: VALID_UUID,
      configurationVersion: 3,
      taskIds: [VALID_SUBTASK_ID, VALID_SUBTASK_ID_2],
      resourceIds: [VALID_RESOURCE_ID, VALID_RESOURCE_ID_2],
      currentUpdate: { version: 2, publishedAt: VALID_TIMESTAMP },
      ...overrides,
    };
  }

  it("accepts a valid payload with a current update", () => {
    expect(saveShareConfigurationDataSchema.safeParse(validData()).success).toBe(true);
  });

  it("accepts a null currentUpdate", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(validData({ currentUpdate: null }))
        .success
    ).toBe(true);
  });

  it("accepts empty taskIds/resourceIds arrays", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ taskIds: [], resourceIds: [] })
      ).success
    ).toBe(true);
  });

  it("rejects a non-positive configurationVersion", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ configurationVersion: 0 })
      ).success
    ).toBe(false);
  });

  it("rejects a taskId that is not a canonical decimal string", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(validData({ taskIds: ["01"] }))
        .success
    ).toBe(false);
  });

  it("rejects a currentUpdate with a body field -- the body is never returned", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ currentUpdate: { version: 1, publishedAt: VALID_TIMESTAMP, body: "leak" } })
      ).success
    ).toBe(false);
  });

  it.each([
    "secretDigest",
    "pinHash",
    "pinSalt",
    "userId",
    "projectId",
    "settings",
    "commentsEnabled",
    "clientFacingSubtitle",
    "contentDirection",
  ])("rejects a forbidden field %s", (forbiddenField) => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ [forbiddenField]: "leak" })
      ).success
    ).toBe(false);
  });

  it("rejects a duplicate taskId in the result -- the underlying table's own unique constraint means a duplicate indicates a corrupt result", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ taskIds: [VALID_SUBTASK_ID, VALID_SUBTASK_ID] })
      ).success
    ).toBe(false);
  });

  it("rejects a duplicate resourceId in the result", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ resourceIds: [VALID_RESOURCE_ID, VALID_RESOURCE_ID] })
      ).success
    ).toBe(false);
  });

  it("rejects an uppercase resourceId in the result rather than silently lowercasing it", () => {
    // VALID_RESOURCE_ID (VALID_UUID) is digits-only and has no letter
    // case to alter, so this uses a uuid containing real hex letters to
    // actually exercise the canonical-lowercase check.
    const mixedCaseUuid = "aabbccdd-1111-4111-8111-111111111111";
    const result = saveShareConfigurationDataSchema.safeParse(
      validData({ resourceIds: [mixedCaseUuid.toUpperCase()] })
    );
    expect(result.success).toBe(false);
  });

  it("accepts a lowercase resourceId containing real hex letters", () => {
    const mixedCaseUuid = "aabbccdd-1111-4111-8111-111111111111";
    const result = saveShareConfigurationDataSchema.safeParse(
      validData({ resourceIds: [mixedCaseUuid] })
    );
    expect(result.success).toBe(true);
  });

  it("rejects 501 taskIds", () => {
    const taskIds = Array.from({ length: 501 }, (_, i) => String(i + 1));
    expect(
      saveShareConfigurationDataSchema.safeParse(validData({ taskIds })).success
    ).toBe(false);
  });

  it("accepts exactly 500 taskIds", () => {
    const taskIds = Array.from({ length: 500 }, (_, i) => String(i + 1));
    expect(
      saveShareConfigurationDataSchema.safeParse(validData({ taskIds })).success
    ).toBe(true);
  });

  it("rejects 501 resourceIds", () => {
    const resourceIds = Array.from(
      { length: 501 },
      (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`
    );
    expect(
      saveShareConfigurationDataSchema.safeParse(validData({ resourceIds })).success
    ).toBe(false);
  });

  it("accepts exactly 500 resourceIds", () => {
    const resourceIds = Array.from(
      { length: 500 },
      (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`
    );
    expect(
      saveShareConfigurationDataSchema.safeParse(validData({ resourceIds })).success
    ).toBe(true);
  });

  it("accepts configurationVersion at exactly the PostgreSQL integer maximum", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ configurationVersion: 2147483647 })
      ).success
    ).toBe(true);
  });

  it("rejects configurationVersion above the PostgreSQL integer range", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ configurationVersion: 2147483648 })
      ).success
    ).toBe(false);
  });

  it("rejects currentUpdate.version above the PostgreSQL integer range", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({
          currentUpdate: { version: 2147483648, publishedAt: VALID_TIMESTAMP },
        })
      ).success
    ).toBe(false);
  });

  it("accepts currentUpdate.version at exactly the PostgreSQL integer maximum", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({
          currentUpdate: { version: 2147483647, publishedAt: VALID_TIMESTAMP },
        })
      ).success
    ).toBe(true);
  });

  it("rejects a non-positive currentUpdate.version", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ currentUpdate: { version: 0, publishedAt: VALID_TIMESTAMP } })
      ).success
    ).toBe(false);
  });

  it("does not require taskIds/resourceIds to be in any particular order", () => {
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ taskIds: [VALID_SUBTASK_ID_2, VALID_SUBTASK_ID] })
      ).success
    ).toBe(true);
    expect(
      saveShareConfigurationDataSchema.safeParse(
        validData({ resourceIds: [VALID_RESOURCE_ID_2, VALID_RESOURCE_ID] })
      ).success
    ).toBe(true);
  });
});
