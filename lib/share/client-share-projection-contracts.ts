import { z } from "zod";

import { shareLinkApiErrorSchema, sharePublicGroupSchema } from "./share-contracts";

/**
 * The strict, purpose-built client-facing projection contract. This is
 * deliberately NOT derived from `Project`, `TaskProjectSubtask`,
 * `TaskResource` or `ManagedShareLink` (no `Pick<...>`, no structural
 * reuse of any internal model) -- every field here is independently
 * declared and independently safe to leave the server, so a future
 * change to an internal model can never silently widen what a client
 * receives. This is the SAME contract Phase 2D's owner Preview and
 * Phase 3's future public route both consume -- one allowlist, reused,
 * never duplicated.
 *
 * AGENTS.md rule 1 ("Client share pages expose only a server-built,
 * allowlisted projection... never spread a database row") governs this
 * entire file.
 */

/**
 * Safe, closed public-status vocabulary -- deliberately small and
 * explicit, never a passthrough of the internal project status column
 * (which also includes non-public-safe values). The presentational
 * component owns the display label for each of these three buckets, so
 * the label text exists in exactly one place.
 */
export const clientProjectStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
]);
export type ClientProjectStatus = z.infer<typeof clientProjectStatusSchema>;

/** Reuses the exact same closed task-visibility vocabulary the owner
 * read/write contracts already use (`sharePublicGroupSchema`,
 * lib/share/share-contracts.ts) -- a single source of truth, not a
 * re-declared duplicate. */
export const clientProjectTaskSchema = z
  .object({
    title: z.string(),
    publicGroup: sharePublicGroupSchema,
    waitingForClientFeedback: z.boolean(),
  })
  .strict();
export type ClientProjectTask = z.infer<typeof clientProjectTaskSchema>;

/**
 * Discriminated union rather than one object with optional fields: a
 * `file` resource can never carry a `url` (its content lives in the
 * private task-resources bucket -- AGENTS.md rule 4 forbids returning
 * storage_path/file_name/mime_type/size_bytes to a client, and no
 * public download route exists in Phase 2D), and a `link` resource can
 * never carry `canDownload` (download intent is meaningless for an
 * owner-approved external URL). Making the impossible combination
 * unrepresentable at the schema level, not merely undocumented.
 */
export const clientProjectFileResourceSchema = z
  .object({
    kind: z.literal("file"),
    label: z.string(),
    canDownload: z.boolean(),
    /** PHASE 4B -- opaque, unpersisted, per-(shareLinkId, resourceId)
     * HMAC reference (lib/share/share-file-ref.server.ts). Lets the
     * browser ask GET /api/share/[publicId]/resources/[fileRef] for this
     * exact file without ever learning task_resources.id or any other
     * internal identifier. Structurally cannot be decoded back into an
     * internal id. */
    fileRef: z.string(),
  })
  .strict();
export type ClientProjectFileResource = z.infer<
  typeof clientProjectFileResourceSchema
>;

export const clientProjectLinkResourceSchema = z
  .object({
    kind: z.literal("link"),
    label: z.string(),
    url: z.string(),
  })
  .strict();
export type ClientProjectLinkResource = z.infer<
  typeof clientProjectLinkResourceSchema
>;

export const clientProjectResourceSchema = z.discriminatedUnion("kind", [
  clientProjectFileResourceSchema,
  clientProjectLinkResourceSchema,
]);
export type ClientProjectResource = z.infer<typeof clientProjectResourceSchema>;

/**
 * Computed ONLY from the mapped/shared task set that actually resolved
 * to a real, non-deleted task -- never from internal project-wide task
 * counts. `null` (never a fabricated 0/0) when zero shared tasks
 * resolved, so the presentational component can hide the progress
 * affordance entirely rather than rendering a misleading "0 of 0".
 */
export const clientProjectProgressSchema = z
  .object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    percent: z.number().int().min(0).max(100),
  })
  .strict();
export type ClientProjectProgress = z.infer<typeof clientProjectProgressSchema>;

/** The latest explicitly published share_link_updates row only -- never
 * project_timeline_events, never Client Update analysis/history. */
export const clientProjectUpdateSchema = z
  .object({
    body: z.string(),
    publishedAt: z.string(),
  })
  .strict();
export type ClientProjectUpdate = z.infer<typeof clientProjectUpdateSchema>;

/**
 * The complete strict projection. Every field is independently
 * allowlisted; `.strict()` on every nested object rejects any
 * unexpected key. No project UUID, no share-link UUID, no subtask UUID,
 * no Resource database ID, no owner user ID, no client contact
 * information, no amount/priority, no raw input, and no secret/PIN/
 * token material appear anywhere in this schema.
 */
export const clientProjectProjectionSchema = z
  .object({
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
    status: clientProjectStatusSchema.nullable(),
    targetDate: z.string().nullable(),
    contentDirection: z.enum(["auto", "ltr", "rtl"]),
    commentsEnabled: z.boolean(),
    progress: clientProjectProgressSchema.nullable(),
    latestUpdate: clientProjectUpdateSchema.nullable(),
    tasks: z.array(clientProjectTaskSchema),
    resources: z.array(clientProjectResourceSchema),
  })
  .strict();
export type ClientProjectProjection = z.infer<
  typeof clientProjectProjectionSchema
>;

// ---------------------------------------------------------------------
// Owner Preview endpoint envelope (GET /api/share-links/[id]/preview).
// Reuses the exact same error vocabulary every other share-link route
// already uses -- no duplicate error-code enum.
// ---------------------------------------------------------------------

export const previewShareLinkResponseSchema = z.union([
  z
    .object({ ok: z.literal(true), data: clientProjectProjectionSchema })
    .strict(),
  shareLinkApiErrorSchema,
]);
export type PreviewShareLinkResponse = z.infer<
  typeof previewShareLinkResponseSchema
>;
