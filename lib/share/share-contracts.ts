import { z } from "zod";

// Phase 1B.1 framework-free contracts for the two read-only owner
// share-link RPCs (public.get_share_link_management_state,
// public.list_share_link_summaries). These schemas are the single source
// of truth for both route input validation and repository output
// parsing -- no route or repository module may accept a generic/unknown
// record as a successful response, and no schema here may pass through a
// field this phase does not explicitly allow.

/** Plain, output-side UUID validation. RPC output is already Postgres's
 * canonical lowercase `uuid::text` form, so no case transform is applied
 * here -- only accepted *input* goes through canonicalization below. */
const uuidSchema = z.string().uuid();

/**
 * PostgreSQL's `uuid::text` output is always canonical lowercase, but a
 * syntactically valid UUID *input* may contain uppercase hex characters.
 * Two spellings that differ only by letter case are the same UUID and
 * must be treated as such everywhere an owner-supplied UUID is accepted
 * (query params, and defensively inside the repository itself).
 */
export function canonicalizeUuid(value: string): string {
  return value.toLowerCase();
}

/** Validates a single input UUID and canonicalizes it to lowercase. */
const canonicalUuidSchema = z.string().uuid().transform(canonicalizeUuid);

/**
 * Canonical decimal-string subtask id, matching how
 * get_share_link_management_state casts `subtask_id::text` in SQL.
 * Deliberately a string, never a number/bigint: a bigint round-tripped
 * through JSON as a number can silently lose precision.
 */
export const canonicalSubtaskIdSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "Must be a canonical positive decimal string.");

/** The full database state vocabulary. Kept available for later phases
 * (e.g. a mutation RPC that must accept 'revoked' as a transition
 * target) -- NOT used for these RPCs' own output, which can never
 * return a revoked link (both RPCs filter `where state <> 'revoked'`). */
export const shareLinkStateSchema = z.enum([
  "draft",
  "active",
  "disabled",
  "expired",
  "revoked",
]);

/** The subset of states get_share_link_management_state and
 * list_share_link_summaries can actually return for an existing managed
 * link. Revoked links are excluded by the RPCs themselves at the SQL
 * level, so accepting "revoked" here would let a future regression in
 * either RPC pass silently through this contract. */
export const managedShareLinkStateSchema = z.enum([
  "draft",
  "active",
  "disabled",
  "expired",
]);

// ---------------------------------------------------------------------
// Strict ISO 8601 timestamp, matching the existing repository precedent
// in lib/homepage-demo/review-repository.server.ts (RawTimestampSchema /
// isValidRawPostgrestTimestamp). Reused rather than reinvented: this is
// exactly the shape Postgres's to_jsonb(timestamptz) produces, which is
// what every timestamptz column in these RPCs' jsonb_build_object output
// goes through -- a full calendar-aware check (real month lengths, leap
// years, valid hour/minute/second and a real UTC offset), not just a
// loose regex.
// ---------------------------------------------------------------------

const STRICT_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

function getRegexMatchPart(match: RegExpExecArray, index: number): string {
  return match[index] ?? "";
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidTimezoneOffset(value: string): boolean {
  if (value === "Z") {
    return true;
  }

  const offsetMatch = /^([+-])(\d{2}):(\d{2})$/.exec(value);

  if (offsetMatch === null) {
    return false;
  }

  const offsetHour = Number(getRegexMatchPart(offsetMatch, 2));
  const offsetMinute = Number(getRegexMatchPart(offsetMatch, 3));

  return (
    Number.isInteger(offsetHour) &&
    Number.isInteger(offsetMinute) &&
    offsetHour >= 0 &&
    offsetHour <= 23 &&
    offsetMinute >= 0 &&
    offsetMinute <= 59
  );
}

function isStrictTimestamp(value: string): boolean {
  const match = STRICT_TIMESTAMP_PATTERN.exec(value);

  if (match === null) {
    return false;
  }

  const year = Number(getRegexMatchPart(match, 1));
  const month = Number(getRegexMatchPart(match, 2));
  const day = Number(getRegexMatchPart(match, 3));
  const hour = Number(getRegexMatchPart(match, 4));
  const minute = Number(getRegexMatchPart(match, 5));
  const second = Number(getRegexMatchPart(match, 6));
  const timezone = getRegexMatchPart(match, 7);

  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > getDaysInMonth(year, month) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    !isValidTimezoneOffset(timezone)
  ) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

const strictTimestampSchema = z
  .string()
  .refine(isStrictTimestamp, "Must be a strict ISO 8601 timestamp.");

// ---------------------------------------------------------------------
// Owner-authored text: validated, never transformed. Zod parsing returns
// whatever a `.transform()` produces, so a `.trim()` step would silently
// hand callers different bytes than the owner actually stored. These
// schemas validate length/non-blankness with `.refine()` only, so the
// parsed output is always byte-for-byte identical to the input.
// ---------------------------------------------------------------------

function isNotBlank(value: string): boolean {
  return value.trim().length > 0;
}

const clientFacingSubtitleSchema = z
  .string()
  .max(200, "Must be at most 200 characters.")
  .refine(isNotBlank, "Must not be empty or whitespace-only.");

const shareLinkUpdateBodySchema = z
  .string()
  .max(5000, "Must be at most 5000 characters.")
  .refine(isNotBlank, "Must not be empty or whitespace-only.");

// ---------------------------------------------------------------------
// Shared task/Resource mapping vocabulary. A single source of truth for
// the public_group vocabulary, the display_order bound and the
// public_label shape, matching the exact database check constraints
// delivered in 202608030003 (share_link_tasks_public_group_check,
// share_link_tasks_display_order_check,
// share_link_resources_public_label_check,
// share_link_resources_display_order_check). Used by BOTH the read-side
// mapped task/Resource contract (management-state, Phase 2B corrective
// migration 202608110002) and the write-side save_share_configuration
// task/Resource item contract below -- moved up here specifically so
// neither direction has to re-declare this vocabulary.
// ---------------------------------------------------------------------

const MAX_CONFIGURATION_ITEMS = 500;

/**
 * share_link_tasks.display_order / share_link_resources.display_order
 * are both PostgreSQL `integer` (int4), whose accepted non-negative
 * range ends at 2147483647 -- narrower than JavaScript's own
 * safe-integer range. A value Zod alone would accept but the database's
 * own type could never store must never reach the RPC in the first
 * place, so this bound is enforced here, not left for a SQL cast to
 * discover.
 */
const POSTGRES_INTEGER_MAX = 2147483647;

const displayOrderSchema = z
  .number()
  .int()
  .min(0, "Must be at least 0.")
  .max(POSTGRES_INTEGER_MAX, `Must be at most ${POSTGRES_INTEGER_MAX}.`);

const publicLabelSchema = z
  .string()
  .max(120, "Must be at most 120 characters.")
  .refine(isNotBlank, "Must not be empty or whitespace-only.");

/** Closed client-facing task-visibility vocabulary, matching
 * share_link_tasks_public_group_check exactly: in_progress,
 * waiting_for_feedback, completed, coming_up. Deliberately NOT the
 * internal status vocabulary (New/In Progress/Review/Urgent/Done) --
 * 'Urgent' must never be surfaced publicly, and the internal vocabulary
 * must be free to change without changing what a client sees. */
export const sharePublicGroupSchema = z.enum([
  "in_progress",
  "waiting_for_feedback",
  "completed",
  "coming_up",
]);

function hasDuplicateStrings(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * One shared shape for a task's share-mapping metadata. subtaskId has no
 * read/write case-transform asymmetry (it is a canonicalSubtaskIdSchema
 * decimal-string regex, not a uuid), so this exact schema safely serves
 * both the read-side mapped-task contract and the write-side
 * save_share_configuration task item -- see
 * saveShareConfigurationTaskItemSchema below, which is this same schema,
 * not a re-declared duplicate.
 */
const shareLinkTaskMappingItemSchema = z
  .object({
    subtaskId: canonicalSubtaskIdSchema,
    publicGroup: sharePublicGroupSchema,
    waitingForClientFeedback: z.boolean(),
    displayOrder: displayOrderSchema,
  })
  .strict();

// ---------------------------------------------------------------------
// Query input contracts
// ---------------------------------------------------------------------

export const shareLinkManagementStateQuerySchema = z
  .object({
    projectId: canonicalUuidSchema,
  })
  .strict();
export type ShareLinkManagementStateQuery = z.infer<
  typeof shareLinkManagementStateQuerySchema
>;

const MAX_SUMMARY_PROJECT_IDS = 100;

/**
 * Parses the raw, un-split `projectIds` query value end to end:
 * split -> trim -> reject (missing/empty/over-limit/invalid uuid) ->
 * canonicalize -> dedupe (first-occurrence order preserved). Rejection
 * happens on the *raw* segments, before dedup, so e.g. "uuid,,uuid" or
 * 101 raw copies of one uuid are both rejected outright rather than
 * silently collapsed into something that happens to validate.
 */
const summaryProjectIdsParamSchema = z
  .string()
  .transform((raw, ctx) => {
    const rawSegments = raw.split(",");

    if (rawSegments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "projectIds must not be empty.",
      });
      return z.NEVER;
    }

    if (rawSegments.length > MAX_SUMMARY_PROJECT_IDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `projectIds must contain at most ${MAX_SUMMARY_PROJECT_IDS} comma-separated values.`,
      });
      return z.NEVER;
    }

    const canonicalIds: string[] = [];

    for (const rawSegment of rawSegments) {
      const trimmed = rawSegment.trim();

      if (trimmed.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "projectIds must not contain an empty segment.",
        });
        return z.NEVER;
      }

      const parsedSegment = canonicalUuidSchema.safeParse(trimmed);

      if (!parsedSegment.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Every projectIds segment must be a valid uuid.",
        });
        return z.NEVER;
      }

      canonicalIds.push(parsedSegment.data);
    }

    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const id of canonicalIds) {
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }

    return deduped;
  });

export const shareLinkSummaryQuerySchema = z
  .object({
    projectIds: summaryProjectIdsParamSchema,
  })
  .strict();
export type ShareLinkSummaryQuery = z.infer<typeof shareLinkSummaryQuerySchema>;

// ---------------------------------------------------------------------
// Management-state success data contract
// ---------------------------------------------------------------------

const managedShareLinkSchema = z
  .object({
    id: uuidSchema,
    publicId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
    state: managedShareLinkStateSchema,
    expiresAt: strictTimestampSchema.nullable(),
    hasPin: z.boolean(),
    commentsEnabled: z.boolean(),
    clientFacingSubtitle: clientFacingSubtitleSchema.nullable(),
    contentDirection: z.enum(["auto", "ltr", "rtl"]),
    // Phase 1C: durable owner publication intent for three project-level
    // fields. These are never a copy of the project's title/status/target
    // date -- public.projects remains authoritative for the values
    // themselves; project_share_links stores only whether the owner has
    // explicitly authorized each safe projection to be included in a
    // future public page. Required (not optional) here: the read RPC
    // always returns all three as real booleans, defaulting to false,
    // never omitting them.
    titleVisible: z.boolean(),
    statusVisible: z.boolean(),
    targetDateVisible: z.boolean(),
    configurationVersion: z.number().int().positive(),
    createdAt: strictTimestampSchema,
    activatedAt: strictTimestampSchema.nullable(),
    disabledAt: strictTimestampSchema.nullable(),
    rotatedAt: strictTimestampSchema.nullable(),
    lastViewedAt: strictTimestampSchema.nullable(),
    viewCount: z.number().int().nonnegative(),
  })
  .strict();

const currentShareLinkUpdateSchema = z
  .object({
    body: shareLinkUpdateBodySchema,
    version: z.number().int().positive(),
    publishedAt: strictTimestampSchema,
  })
  .strict();

/**
 * Phase 2B corrective foundation: the complete persisted per-item task
 * mapping metadata (never a bare id) -- reuses
 * shareLinkTaskMappingItemSchema, the exact same shape
 * saveShareConfigurationTaskItemSchema (below) validates, since a
 * mapped task's read shape and its save-request item shape are
 * identical. See 202608110002_client_share_management_mapping_metadata.sql.
 */
export const mappedShareLinkTaskSchema = shareLinkTaskMappingItemSchema;
export type MappedShareLinkTask = z.infer<typeof mappedShareLinkTaskSchema>;

/**
 * Complete persisted per-item Resource mapping metadata. resourceId is
 * plain output-side uuidSchema here (RPC output, always canonical
 * lowercase already) rather than canonicalUuidSchema's input-transform
 * variant -- the same read/write uuid-schema split this file already
 * uses everywhere else (e.g. managedShareLinkSchema.id vs
 * createShareLinkDraftRequestSchema.projectId).
 */
export const mappedShareLinkResourceSchema = z
  .object({
    resourceId: uuidSchema,
    publicLabel: publicLabelSchema,
    canDownload: z.boolean(),
    displayOrder: displayOrderSchema,
  })
  .strict();
export type MappedShareLinkResource = z.infer<typeof mappedShareLinkResourceSchema>;

/**
 * Closed union: either there is no managed link (every dependent field
 * pinned to its empty/null value) or a managed link exists (its
 * dependent fields carry real data). This makes impossible combinations
 * -- e.g. a mapped task with no link -- unrepresentable rather than
 * merely undocumented.
 *
 * Phase 2B corrective foundation: mappedTaskIds/mappedResourceIds (bare
 * id arrays) are replaced entirely by mappedTasks/mappedResources
 * (structured per-item mapping metadata) -- not supplemented, per the
 * corrective-foundation instruction not to keep a bare-id array as a
 * second durable source of truth. Ids needed for counts/selection are
 * derived from these structured arrays in application code.
 */
const noManagedShareLinkDataSchema = z
  .object({
    link: z.null(),
    mappedTasks: z.array(mappedShareLinkTaskSchema).max(0),
    mappedResources: z.array(mappedShareLinkResourceSchema).max(0),
    currentUpdate: z.null(),
  })
  .strict();

const withManagedShareLinkDataSchema = z
  .object({
    link: managedShareLinkSchema,
    // Bounded and duplicate-checked defensively: a single link can never
    // have more mapped items than a single save_share_configuration call
    // could have written (MAX_CONFIGURATION_ITEMS), and
    // share_link_tasks_share_link_id_subtask_id_unique /
    // share_link_resources_share_link_id_resource_id_unique guarantee the
    // underlying rows are already distinct -- a duplicate or oversized
    // array here indicates a corrupt or tampered RPC result, which must
    // fail closed rather than reach the owner editor.
    mappedTasks: z
      .array(mappedShareLinkTaskSchema)
      .max(
        MAX_CONFIGURATION_ITEMS,
        `Must contain at most ${MAX_CONFIGURATION_ITEMS} task items.`
      )
      .refine(
        (items) => !hasDuplicateStrings(items.map((item) => item.subtaskId)),
        "mappedTasks must not contain a duplicate subtaskId."
      ),
    mappedResources: z
      .array(mappedShareLinkResourceSchema)
      .max(
        MAX_CONFIGURATION_ITEMS,
        `Must contain at most ${MAX_CONFIGURATION_ITEMS} resource items.`
      )
      .refine(
        (items) => !hasDuplicateStrings(items.map((item) => item.resourceId)),
        "mappedResources must not contain a duplicate resourceId."
      ),
    currentUpdate: currentShareLinkUpdateSchema.nullable(),
  })
  .strict();

export const shareLinkManagementStateDataSchema = z.union([
  noManagedShareLinkDataSchema,
  withManagedShareLinkDataSchema,
]);
export type ShareLinkManagementStateData = z.infer<
  typeof shareLinkManagementStateDataSchema
>;

// ---------------------------------------------------------------------
// Summary success data contract
// ---------------------------------------------------------------------

/** Closed union, mirroring the management-state shape: either there is
 * no link for this project (every dependent field pinned to its
 * empty/null/zero value) or a link exists (its fields carry real data,
 * restricted to the non-revoked state vocabulary these RPCs can return). */
const noShareLinkSummaryEntrySchema = z
  .object({
    projectId: uuidSchema,
    linkId: z.null(),
    state: z.null(),
    expiresAt: z.null(),
    hasPin: z.literal(false),
    createdAt: z.null(),
    lastViewedAt: z.null(),
    viewCount: z.literal(0),
    taskCount: z.literal(0),
    resourceCount: z.literal(0),
    unreadCount: z.null(),
  })
  .strict();

const withShareLinkSummaryEntrySchema = z
  .object({
    projectId: uuidSchema,
    linkId: uuidSchema,
    state: managedShareLinkStateSchema,
    expiresAt: strictTimestampSchema.nullable(),
    hasPin: z.boolean(),
    createdAt: strictTimestampSchema,
    lastViewedAt: strictTimestampSchema.nullable(),
    viewCount: z.number().int().nonnegative(),
    taskCount: z.number().int().nonnegative(),
    resourceCount: z.number().int().nonnegative(),
    // Deliberately always null in Phase 1B.1 -- no client-message content
    // is queried or exposed by this summary RPC.
    unreadCount: z.null(),
  })
  .strict();

const shareLinkSummaryEntrySchema = z.union([
  noShareLinkSummaryEntrySchema,
  withShareLinkSummaryEntrySchema,
]);
export type ShareLinkSummaryEntry = z.infer<typeof shareLinkSummaryEntrySchema>;

/**
 * Keyed by project id. Beyond each entry's own shape, every record key
 * must itself be a UUID *and* must equal that entry's own `projectId` --
 * a caller must never be able to have a summary object silently keyed by
 * one project id while describing another.
 */
export const shareLinkSummaryDataSchema = z
  .record(uuidSchema, shareLinkSummaryEntrySchema)
  .superRefine((record, ctx) => {
    for (const [key, entry] of Object.entries(record)) {
      if (entry.projectId !== key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Record key ${key} must equal its entry's projectId (got ${entry.projectId}).`,
          path: [key, "projectId"],
        });
      }
    }
  });
export type ShareLinkSummaryData = z.infer<typeof shareLinkSummaryDataSchema>;

// ---------------------------------------------------------------------
// Shared API envelope
// ---------------------------------------------------------------------

export const shareLinkApiErrorCodeSchema = z.enum([
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "INVALID_REQUEST",
  "PROJECT_NOT_FOUND",
  "PROJECT_ARCHIVED",
  "SHARE_LINK_NOT_FOUND",
  "SHARE_LINK_STATE_CONFLICT",
  "SHARE_LINK_ANOTHER_LINK_ACTIVE",
  "SHARE_LINK_SECRET_UNAVAILABLE",
  // Phase 5C -- owner communication API error codes.
  "SHARE_MESSAGE_NOT_FOUND",
  "SHARE_MESSAGE_PARENT_NOT_FOUND",
  "SHARE_MESSAGE_PARENT_LINK_MISMATCH",
  "SHARE_MESSAGE_STATUS_INVALID",
  "INTERNAL_ERROR",
]);
export type ShareLinkApiErrorCode = z.infer<typeof shareLinkApiErrorCodeSchema>;

export const shareLinkApiErrorSchema = z
  .object({
    ok: z.literal(false),
    code: shareLinkApiErrorCodeSchema,
    error: z.string(),
  })
  .strict();
export type ShareLinkApiError = z.infer<typeof shareLinkApiErrorSchema>;

export const shareLinkManagementStateResponseSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      data: shareLinkManagementStateDataSchema,
    })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type ShareLinkManagementStateResponse = z.infer<
  typeof shareLinkManagementStateResponseSchema
>;

export const shareLinkSummaryResponseSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      data: shareLinkSummaryDataSchema,
    })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type ShareLinkSummaryResponse = z.infer<
  typeof shareLinkSummaryResponseSchema
>;

// ---------------------------------------------------------------------
// Phase 1B.2 lifecycle contracts (create / activate / disable / re-enable)
// ---------------------------------------------------------------------

/** Path parameter for every app/api/share-links/[id]/** route. */
export const shareLinkIdParamSchema = z
  .object({
    id: canonicalUuidSchema,
  })
  .strict();
export type ShareLinkIdParam = z.infer<typeof shareLinkIdParamSchema>;

const sharePublicIdSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/**
 * The raw share secret. Appears only in activateShareLinkDataSchema --
 * never in the create-draft, disable or re-enable data contracts, which
 * have nothing to reveal. Exactly 43 base64url characters, matching
 * lib/share/share-secret.server.ts's generateRawShareSecret output shape.
 *
 * Exported (this file carries no `server-only` import) so the Phase 3
 * public browser fragment handler can validate the #secret's shape using
 * this SAME canonical schema -- never a second, independently
 * hand-rolled regex that could silently drift from the real shape.
 */
export const rawShareSecretSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Must be exactly 43 base64url characters.");

export const createShareLinkDraftRequestSchema = z
  .object({
    projectId: canonicalUuidSchema,
  })
  .strict();
export type CreateShareLinkDraftRequest = z.infer<
  typeof createShareLinkDraftRequestSchema
>;

export const createShareLinkDraftDataSchema = z
  .object({
    linkId: uuidSchema,
    publicId: sharePublicIdSchema,
    state: z.literal("draft"),
    createdAt: strictTimestampSchema,
  })
  .strict();
export type CreateShareLinkDraftData = z.infer<
  typeof createShareLinkDraftDataSchema
>;

export const createShareLinkDraftResponseSchema = z.union([
  z
    .object({ ok: z.literal(true), data: createShareLinkDraftDataSchema })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type CreateShareLinkDraftResponse = z.infer<
  typeof createShareLinkDraftResponseSchema
>;

/**
 * The exact shape public.activate_share_link's own jsonb return value
 * parses through -- Postgres never sees or returns the raw secret, so
 * this RPC-row schema deliberately has no `secret` field. The repository
 * parses the RPC's raw output through this schema, then attaches the
 * `secret` it already generated in TypeScript to produce
 * ActivateShareLinkData below.
 */
export const activateShareLinkRpcDataSchema = z
  .object({
    linkId: uuidSchema,
    publicId: sharePublicIdSchema,
    state: z.literal("active"),
    configurationVersion: z.number().int().positive(),
    activatedAt: strictTimestampSchema,
  })
  .strict();
export type ActivateShareLinkRpcData = z.infer<
  typeof activateShareLinkRpcDataSchema
>;

export const activateShareLinkDataSchema = activateShareLinkRpcDataSchema
  .extend({ secret: rawShareSecretSchema })
  .strict();
export type ActivateShareLinkData = z.infer<typeof activateShareLinkDataSchema>;

export const activateShareLinkResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: activateShareLinkDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type ActivateShareLinkResponse = z.infer<
  typeof activateShareLinkResponseSchema
>;

export const disableShareLinkDataSchema = z
  .object({
    linkId: uuidSchema,
    state: z.literal("disabled"),
    configurationVersion: z.number().int().positive(),
    disabledAt: strictTimestampSchema,
  })
  .strict();
export type DisableShareLinkData = z.infer<typeof disableShareLinkDataSchema>;

export const disableShareLinkResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: disableShareLinkDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type DisableShareLinkResponse = z.infer<
  typeof disableShareLinkResponseSchema
>;

export const reenableShareLinkDataSchema = z
  .object({
    linkId: uuidSchema,
    state: z.literal("active"),
    configurationVersion: z.number().int().positive(),
    activatedAt: strictTimestampSchema,
    disabledAt: strictTimestampSchema,
  })
  .strict();
export type ReenableShareLinkData = z.infer<typeof reenableShareLinkDataSchema>;

export const reenableShareLinkResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: reenableShareLinkDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type ReenableShareLinkResponse = z.infer<
  typeof reenableShareLinkResponseSchema
>;

// ---------------------------------------------------------------------
// Phase 1B.3 access-operation contracts (PIN / expiry / rotate / revoke /
// reveal). Preserves every Phase 1B.1/1B.2 contract above unchanged.
// ---------------------------------------------------------------------

/** Exactly 4-6 ASCII decimal digits -- matches
 * lib/share/share-pin.server.ts's PIN_PATTERN exactly. No whitespace
 * trimming, no coercion. */
const sharePinInputSchema = z
  .string()
  .regex(/^[0-9]{4,6}$/, "Must be exactly 4-6 ASCII decimal digits.");

/**
 * The exact V1 public-id shape (see
 * lib/share/share-public-id.server.ts's generateSharePublicId:
 * randomBytes(18).toString("base64url"), always exactly 24 characters).
 * Deliberately narrower than sharePublicIdSchema's 16-64 range -- that
 * broader schema stays exactly as-is for the Phase 1B.1/1B.2 contracts
 * that intentionally allow the table's future-compatible range, but the
 * Phase 1B.3 rotate/reveal results only ever carry a publicId this
 * repository itself generated, so they are held to the exact shape a V1
 * server actually produces.
 */
const sharePublicIdV1Schema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{24}$/, "Must be exactly 24 base64url characters.");

export const setSharePinRequestSchema = z
  .object({ pin: sharePinInputSchema })
  .strict();
export type SetSharePinRequest = z.infer<typeof setSharePinRequestSchema>;

const sharePinLifecycleDataSchema = z
  .object({
    linkId: uuidSchema,
    state: managedShareLinkStateSchema,
    configurationVersion: z.number().int().positive(),
    updatedAt: strictTimestampSchema,
  })
  .strict();

export const setSharePinDataSchema = sharePinLifecycleDataSchema
  .extend({ hasPin: z.literal(true) })
  .strict();
export type SetSharePinData = z.infer<typeof setSharePinDataSchema>;

export const clearSharePinDataSchema = sharePinLifecycleDataSchema
  .extend({ hasPin: z.literal(false) })
  .strict();
export type ClearSharePinData = z.infer<typeof clearSharePinDataSchema>;

export const setSharePinResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: setSharePinDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type SetSharePinResponse = z.infer<typeof setSharePinResponseSchema>;

export const clearSharePinResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: clearSharePinDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type ClearSharePinResponse = z.infer<typeof clearSharePinResponseSchema>;

/**
 * PUT body for the expiry route. `expiresAt` is validated but never
 * transformed -- strictTimestampSchema has no `.transform()` step, so the
 * owner-supplied timestamp string is preserved byte-for-byte through to
 * the repository/RPC boundary rather than being silently reformatted.
 */
export const setShareLinkExpiryRequestSchema = z
  .object({ expiresAt: strictTimestampSchema })
  .strict();
export type SetShareLinkExpiryRequest = z.infer<
  typeof setShareLinkExpiryRequestSchema
>;

const shareLinkExpiryLifecycleBaseSchema = z.object({
  linkId: uuidSchema,
  state: managedShareLinkStateSchema,
  configurationVersion: z.number().int().positive(),
  updatedAt: strictTimestampSchema,
});

export const setShareLinkExpiryDataSchema = shareLinkExpiryLifecycleBaseSchema
  .extend({ expiresAt: strictTimestampSchema })
  .strict();
export type SetShareLinkExpiryData = z.infer<typeof setShareLinkExpiryDataSchema>;

/**
 * public.clear_share_link_expiry rejects state = expired (the delivered
 * lifecycle CHECK constraint requires an expired link to keep a non-null
 * expires_at) and state = revoked (rejected before any state check even
 * runs), so a successful clear can only ever return draft, active or
 * disabled -- narrower than setShareLinkExpiryDataSchema's state, which
 * intentionally keeps the full managedShareLinkStateSchema range since
 * SET may return an expired link without changing its state.
 */
const clearShareLinkExpiryStateSchema = z.enum(["draft", "active", "disabled"]);

export const clearShareLinkExpiryDataSchema = shareLinkExpiryLifecycleBaseSchema
  .extend({
    expiresAt: z.null(),
    state: clearShareLinkExpiryStateSchema,
  })
  .strict();
export type ClearShareLinkExpiryData = z.infer<
  typeof clearShareLinkExpiryDataSchema
>;

export const setShareLinkExpiryResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: setShareLinkExpiryDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type SetShareLinkExpiryResponse = z.infer<
  typeof setShareLinkExpiryResponseSchema
>;

export const clearShareLinkExpiryResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: clearShareLinkExpiryDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type ClearShareLinkExpiryResponse = z.infer<
  typeof clearShareLinkExpiryResponseSchema
>;

/**
 * The exact shape public.rotate_share_link_secret's own jsonb return
 * value parses through -- Postgres never sees or returns the raw secret,
 * so this RPC-row schema deliberately has no `secret` field, mirroring
 * activateShareLinkRpcDataSchema exactly. The repository parses the RPC's
 * raw output through this schema, then attaches the fresh raw secret it
 * already generated in TypeScript to produce RotateShareLinkSecretData
 * below.
 */
/**
 * public.rotate_share_link_secret is restricted to active/disabled links
 * (draft has no secret to rotate; revoked is terminal; expired is not a
 * supported rotation state) -- narrower than managedShareLinkStateSchema.
 */
const rotateShareLinkSecretStateSchema = z.enum(["active", "disabled"]);

export const rotateShareLinkSecretRpcDataSchema = z
  .object({
    linkId: uuidSchema,
    publicId: sharePublicIdV1Schema,
    state: rotateShareLinkSecretStateSchema,
    configurationVersion: z.number().int().positive(),
    rotatedAt: strictTimestampSchema,
  })
  .strict();
export type RotateShareLinkSecretRpcData = z.infer<
  typeof rotateShareLinkSecretRpcDataSchema
>;

/**
 * Safe rotate result: a freshly generated raw secret (same 43-character
 * base64url shape as activation's), the link's stable publicId, and its
 * new configurationVersion/rotatedAt -- never the digest or any encrypted
 * field.
 */
export const rotateShareLinkSecretDataSchema = rotateShareLinkSecretRpcDataSchema
  .extend({ secret: rawShareSecretSchema })
  .strict();
export type RotateShareLinkSecretData = z.infer<
  typeof rotateShareLinkSecretDataSchema
>;

export const rotateShareLinkSecretResponseSchema = z.union([
  z
    .object({ ok: z.literal(true), data: rotateShareLinkSecretDataSchema })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type RotateShareLinkSecretResponse = z.infer<
  typeof rotateShareLinkSecretResponseSchema
>;

/** State is pinned to "revoked" -- revoke never returns a secret. */
export const revokeShareLinkDataSchema = z
  .object({
    linkId: uuidSchema,
    state: z.literal("revoked"),
    configurationVersion: z.number().int().positive(),
    revokedAt: strictTimestampSchema,
  })
  .strict();
export type RevokeShareLinkData = z.infer<typeof revokeShareLinkDataSchema>;

export const revokeShareLinkResponseSchema = z.union([
  z.object({ ok: z.literal(true), data: revokeShareLinkDataSchema }).strict(),
  shareLinkApiErrorSchema,
]);
export type RevokeShareLinkResponse = z.infer<
  typeof revokeShareLinkResponseSchema
>;

/**
 * Safe browser-facing reveal result: the currently stored raw secret plus
 * enough identity to display it, and nothing else -- no ciphertext,
 * digest, nonce, auth tag or encryption version.
 */
export const revealShareLinkSecretDataSchema = z
  .object({
    linkId: uuidSchema,
    publicId: sharePublicIdV1Schema,
    secret: rawShareSecretSchema,
  })
  .strict();
export type RevealShareLinkSecretData = z.infer<
  typeof revealShareLinkSecretDataSchema
>;

export const revealShareLinkSecretResponseSchema = z.union([
  z
    .object({ ok: z.literal(true), data: revealShareLinkSecretDataSchema })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type RevealShareLinkSecretResponse = z.infer<
  typeof revealShareLinkSecretResponseSchema
>;

/**
 * Repository-only schema for public.reveal_share_link_secret's raw jsonb
 * result -- encrypted material only, exact hex length and case, never
 * parsed or exposed outside lib/share/share-links-repository.server.ts.
 * The repository decrypts through this shape and returns only
 * revealShareLinkSecretDataSchema's safe shape to its caller.
 */
export const revealShareLinkSecretRpcDataSchema = z
  .object({
    linkId: uuidSchema,
    publicId: sharePublicIdV1Schema,
    ciphertextHex: z.string().regex(/^[0-9a-f]{86}$/),
    nonceHex: z.string().regex(/^[0-9a-f]{24}$/),
    authTagHex: z.string().regex(/^[0-9a-f]{32}$/),
    encryptionVersion: z.literal(1),
  })
  .strict();
export type RevealShareLinkSecretRpcData = z.infer<
  typeof revealShareLinkSecretRpcDataSchema
>;

// ---------------------------------------------------------------------
// Phase 1B.4 configuration-save contracts (settings / tasks / resources /
// publishUpdate, combined into one atomic save_share_configuration call).
// Preserves every Phase 1B.1-1B.3 contract above unchanged.
// MAX_CONFIGURATION_ITEMS, displayOrderSchema and publicLabelSchema are
// declared earlier in this file (shared task/Resource mapping
// vocabulary section) and reused here, not redeclared.
// ---------------------------------------------------------------------

/**
 * Partial, strict settings group. Every field is independently optional
 * (omitted means unchanged), but at least one recognized key must be
 * present when the group itself is supplied -- an empty `{}` is
 * indistinguishable from omission and is rejected rather than silently
 * accepted as a no-op. `clientFacingSubtitle` reuses the existing
 * validated-but-never-transformed schema; an explicit `null` clears the
 * subtitle, matching the RPC's own has-key/value distinction.
 */
export const saveShareConfigurationSettingsSchema = z
  .object({
    commentsEnabled: z.boolean().optional(),
    clientFacingSubtitle: clientFacingSubtitleSchema.nullable().optional(),
    contentDirection: z.enum(["auto", "ltr", "rtl"]).optional(),
    // Phase 1C: durable publication-intent flags, following the exact
    // same optional/omitted-means-unchanged convention as the three
    // fields above -- see managedShareLinkSchema's titleVisible/
    // statusVisible/targetDateVisible for the read-side contract.
    titleVisible: z.boolean().optional(),
    statusVisible: z.boolean().optional(),
    targetDateVisible: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "settings must contain at least one recognized key."
  );
export type SaveShareConfigurationSettings = z.infer<
  typeof saveShareConfigurationSettingsSchema
>;

/**
 * Identical shape to mappedShareLinkTaskSchema above (both are
 * shareLinkTaskMappingItemSchema) -- a mapped task's read shape and its
 * save-request item shape are the same thing, so this is an alias, not a
 * redeclared duplicate.
 */
export const saveShareConfigurationTaskItemSchema = shareLinkTaskMappingItemSchema;
export type SaveShareConfigurationTaskItem = z.infer<
  typeof saveShareConfigurationTaskItemSchema
>;

/**
 * An empty array is a meaningful, distinct request (clear every mapping)
 * -- never conflated with omission, which is expressed by leaving the
 * whole `tasks` key out of the request body entirely. Duplicate
 * subtaskIds are rejected outright, never silently deduplicated.
 */
export const saveShareConfigurationTasksSchema = z
  .array(saveShareConfigurationTaskItemSchema)
  .max(
    MAX_CONFIGURATION_ITEMS,
    `Must contain at most ${MAX_CONFIGURATION_ITEMS} task items.`
  )
  .superRefine((tasks, ctx) => {
    const seen = new Set<string>();
    for (const [index, task] of tasks.entries()) {
      if (seen.has(task.subtaskId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate subtaskId ${task.subtaskId}.`,
          path: [index, "subtaskId"],
        });
        continue;
      }
      seen.add(task.subtaskId);
    }
  });
export type SaveShareConfigurationTasks = z.infer<
  typeof saveShareConfigurationTasksSchema
>;

export const saveShareConfigurationResourceItemSchema = z
  .object({
    resourceId: canonicalUuidSchema,
    publicLabel: publicLabelSchema,
    canDownload: z.boolean(),
    displayOrder: displayOrderSchema,
  })
  .strict();
export type SaveShareConfigurationResourceItem = z.infer<
  typeof saveShareConfigurationResourceItemSchema
>;

/**
 * Same empty-means-clear, duplicate-rejecting shape as tasks above.
 * `resourceId` is canonicalized to lowercase on input (matching every
 * other owner-supplied UUID in this file) specifically so two spellings
 * of the same UUID that differ only by letter case cannot bypass
 * duplicate detection.
 */
export const saveShareConfigurationResourcesSchema = z
  .array(saveShareConfigurationResourceItemSchema)
  .max(
    MAX_CONFIGURATION_ITEMS,
    `Must contain at most ${MAX_CONFIGURATION_ITEMS} resource items.`
  )
  .superRefine((resources, ctx) => {
    const seen = new Set<string>();
    for (const [index, resource] of resources.entries()) {
      if (seen.has(resource.resourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate resourceId ${resource.resourceId}.`,
          path: [index, "resourceId"],
        });
        continue;
      }
      seen.add(resource.resourceId);
    }
  });
export type SaveShareConfigurationResources = z.infer<
  typeof saveShareConfigurationResourcesSchema
>;

/** Reuses the existing shareLinkUpdateBodySchema (max 5000, non-blank
 * after btrim, never transformed) -- the exact same bound the delivered
 * share_link_updates_body_check enforces. */
export const saveShareConfigurationPublishUpdateSchema = z
  .object({
    body: shareLinkUpdateBodySchema,
  })
  .strict();
export type SaveShareConfigurationPublishUpdate = z.infer<
  typeof saveShareConfigurationPublishUpdateSchema
>;

/**
 * PATCH /api/share-links/[id]/config request body. `linkId` is supplied
 * only by the path segment (shareLinkIdParamSchema), never duplicated
 * here. Every top-level group is optional, but at least one must be
 * present -- an entirely empty body is rejected rather than treated as a
 * silent no-op.
 */
export const saveShareConfigurationRequestSchema = z
  .object({
    settings: saveShareConfigurationSettingsSchema.optional(),
    tasks: saveShareConfigurationTasksSchema.optional(),
    resources: saveShareConfigurationResourcesSchema.optional(),
    publishUpdate: saveShareConfigurationPublishUpdateSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.settings !== undefined ||
      value.tasks !== undefined ||
      value.resources !== undefined ||
      value.publishUpdate !== undefined,
    "At least one of settings, tasks, resources or publishUpdate must be supplied."
  );
export type SaveShareConfigurationRequest = z.infer<
  typeof saveShareConfigurationRequestSchema
>;

/**
 * A PostgreSQL `integer` (int4) value that the delivered schema also
 * requires to be strictly positive: project_share_links.
 * configuration_version (`project_share_links_configuration_version_check:
 * configuration_version > 0`) and share_link_updates.version
 * (`share_link_updates_version_check: version > 0`) both share this
 * exact shape. Bounded at both ends so a malformed or out-of-range RPC
 * result -- something the delivered `integer` column could never
 * actually store -- fails closed here rather than being passed through.
 */
const postgresPositiveIntegerSchema = z
  .number()
  .int()
  .min(1, "Must be at least 1.")
  .max(POSTGRES_INTEGER_MAX, `Must be at most ${POSTGRES_INTEGER_MAX}.`);

/**
 * The final taskIds set the RPC returns: bounded by the same 500-item
 * cap the request itself enforces (this V1 operation can never produce
 * a larger mapping than a single call's own submitted set), and free of
 * duplicates -- share_link_tasks_share_link_id_subtask_id_unique
 * guarantees the underlying rows are already distinct, so a duplicate
 * in the RPC's own output would indicate a corrupt or tampered result,
 * not a legitimate database state.
 */
const saveShareConfigurationTaskIdsSchema = z
  .array(canonicalSubtaskIdSchema)
  .max(
    MAX_CONFIGURATION_ITEMS,
    `Must contain at most ${MAX_CONFIGURATION_ITEMS} task ids.`
  )
  .refine(
    (ids) => !hasDuplicateStrings(ids),
    "taskIds must not contain duplicates."
  );

/**
 * Canonical lowercase uuid text -- PostgreSQL's own `uuid::text` cast is
 * always canonical lowercase (matching every other output-side uuidSchema
 * in this file), so an uppercase character here indicates a corrupt or
 * tampered result. This schema deliberately performs no `.transform()`:
 * an uppercase value is rejected outright, never silently lowercased,
 * so a caller can never be handed a "canonicalized" id that did not
 * actually come from the database in that form.
 */
const canonicalLowercaseUuidSchema = z
  .string()
  .uuid()
  .refine(
    (value) => value === value.toLowerCase(),
    "Must be a canonical lowercase uuid."
  );

/** Same 500-item cap and duplicate-freedom as taskIds above, matching
 * share_link_resources_share_link_id_resource_id_unique. */
const saveShareConfigurationResourceIdsSchema = z
  .array(canonicalLowercaseUuidSchema)
  .max(
    MAX_CONFIGURATION_ITEMS,
    `Must contain at most ${MAX_CONFIGURATION_ITEMS} resource ids.`
  )
  .refine(
    (ids) => !hasDuplicateStrings(ids),
    "resourceIds must not contain duplicates."
  );

const saveShareConfigurationCurrentUpdateSchema = z
  .object({
    version: postgresPositiveIntegerSchema,
    publishedAt: strictTimestampSchema,
  })
  .strict();

/**
 * The exact shape public.save_share_configuration's own jsonb return
 * value parses through. Unlike activate/rotate, nothing is attached to
 * this after parsing (there is no secret to generate client-side for
 * this operation), so this one schema serves as both the RPC-result
 * parse target and the final safe repository/API result -- a separate
 * "Rpc" variant would be a pointless duplicate. `taskIds`/`resourceIds`
 * reflect the final committed mapping, ordered deterministically by the
 * RPC itself (display_order, then id) -- never merely the submitted
 * group, and this schema deliberately imposes no array-order requirement
 * of its own (the RPC's own ordering is trusted, not re-validated here).
 * `currentUpdate` never carries the update body.
 */
export const saveShareConfigurationDataSchema = z
  .object({
    linkId: uuidSchema,
    configurationVersion: postgresPositiveIntegerSchema,
    taskIds: saveShareConfigurationTaskIdsSchema,
    resourceIds: saveShareConfigurationResourceIdsSchema,
    currentUpdate: saveShareConfigurationCurrentUpdateSchema.nullable(),
  })
  .strict();
export type SaveShareConfigurationData = z.infer<
  typeof saveShareConfigurationDataSchema
>;

export const saveShareConfigurationResponseSchema = z.union([
  z
    .object({ ok: z.literal(true), data: saveShareConfigurationDataSchema })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type SaveShareConfigurationResponse = z.infer<
  typeof saveShareConfigurationResponseSchema
>;

// ---------------------------------------------------------------------
// Phase 5C -- owner communication API contracts
// ---------------------------------------------------------------------

/** Path parameter for app/api/share-links/[id]/messages/[messageId]/**. */
export const shareMessageIdParamSchema = z
  .object({
    messageId: canonicalUuidSchema,
  })
  .strict();
export type ShareMessageIdParam = z.infer<typeof shareMessageIdParamSchema>;

/**
 * POST /api/share-links/[id]/messages/reply's request body. `body` is
 * only shape-checked here (a non-empty-after-whitespace-trim, bounded
 * string) -- the exact same normalization/validation
 * `lib/share/share-public-message.server.ts`'s `validateShareMessageBody`
 * already applies to the public submission path is reused by the route,
 * not reimplemented here, so this schema deliberately stays loose on the
 * body's own content rules.
 */
export const sendShareMessageReplyRequestSchema = z
  .object({
    parentMessageId: canonicalUuidSchema,
    body: z.string(),
  })
  .strict();
export type SendShareMessageReplyRequest = z.infer<
  typeof sendShareMessageReplyRequestSchema
>;

/**
 * PATCH /api/share-links/[id]/messages/[messageId]'s request body.
 * Deliberately lists exactly the 4 Phase 5 workflow statuses --
 * matching `SHARE_MESSAGE_PHASE5_STATUSES`
 * (`lib/share/share-messages-repository.server.ts`) value-for-value,
 * not imported from it (this contracts module is the lower-level file
 * the repository itself already imports from, so the dependency does
 * not run the other way). `'converted'` and any other value are
 * rejected as an ordinary Zod enum-parse failure, with no special-case
 * check required.
 */
export const setShareMessageStatusRequestSchema = z
  .object({
    status: z.enum(["new", "reviewed", "resolved", "dismissed"]),
  })
  .strict();
export type SetShareMessageStatusRequest = z.infer<
  typeof setShareMessageStatusRequestSchema
>;
