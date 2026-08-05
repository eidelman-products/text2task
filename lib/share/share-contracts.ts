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
 * Closed union: either there is no managed link (every dependent field
 * pinned to its empty/null value) or a managed link exists (its
 * dependent fields carry real data). This makes impossible combinations
 * -- e.g. a mapped task id with no link -- unrepresentable rather than
 * merely undocumented.
 */
const noManagedShareLinkDataSchema = z
  .object({
    link: z.null(),
    mappedTaskIds: z.array(canonicalSubtaskIdSchema).max(0),
    mappedResourceIds: z.array(uuidSchema).max(0),
    currentUpdate: z.null(),
  })
  .strict();

const withManagedShareLinkDataSchema = z
  .object({
    link: managedShareLinkSchema,
    mappedTaskIds: z.array(canonicalSubtaskIdSchema),
    mappedResourceIds: z.array(uuidSchema),
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
  "UNAUTHENTICATED",
  "INVALID_REQUEST",
  "PROJECT_NOT_FOUND",
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
