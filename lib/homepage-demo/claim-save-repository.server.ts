import "server-only";

import { z } from "zod";

import {
  TextExtractedTasksResponseSchema,
  type TextExtractedTask,
} from "@/lib/extraction/schemas";
import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";
import type { ProjectImportJsonRecord } from "@/lib/projects/import-persistence.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SHA_256_HASH_PATTERN = /^[0-9a-f]{64}$/;
const HOMEPAGE_DEMO_TEXT_SCHEMA_VERSION = "homepage-demo-draft-v1";
const HOMEPAGE_DEMO_TEXT_ENGINE_VERSION = "text-extraction-v1";

export type HomepageDemoClaimSaveSource =
  | Readonly<{
      kind: "pending";
      projectGroup: ProjectImportJsonRecord;
    }>
  | Readonly<{
      kind: "rpc_replay";
      projectGroup: ProjectImportJsonRecord;
    }>
  | Readonly<{
      kind: "claim_unavailable";
    }>;

export type ClaimHomepageDemoProjectInput = Readonly<{
  claimTokenHash: string;
  authenticatedUserId: string;
  requestHash: string;
  importGroups: ProjectImportJsonRecord[];
  duplicateCheckPassed: boolean;
}>;

export type ClaimHomepageDemoProjectResult = Readonly<{
  outcome:
    | "saved"
    | "already_claimed"
    | "duplicate_detected"
    | "expired"
    | "invalid_claim"
    | "draft_unavailable";
  created: boolean;
}>;

type SupabaseError = Readonly<{
  code?: string | null;
  message?: string | null;
}>;

const RawTimestampSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)))
  .transform((value) => new Date(value));

const TokenHashSchema = z.string().regex(SHA_256_HASH_PATTERN);

const ClaimStatusSchema = z.enum([
  "pending",
  "claimed",
  "expired",
  "cancelled",
]);

const ClaimRowSchema = z
  .object({
    id: z.string().uuid(),
    trial_id: z.string().uuid().nullable(),
    draft_id: z.string().uuid().nullable(),
    claim_token_hash: TokenHashSchema,
    public_token_hash: TokenHashSchema,
    session_token_hash: TokenHashSchema,
    status: ClaimStatusSchema,
    expires_at: RawTimestampSchema,
  })
  .strict();

const TrialRowSchema = z
  .object({
    id: z.string().uuid(),
    public_token_hash: TokenHashSchema,
    session_token_hash: TokenHashSchema,
    input_type: z.string(),
    status: z.string(),
    risk_state: z.string(),
    expires_at: RawTimestampSchema,
    claimed_by_user_id: z.string().uuid().nullable(),
    claimed_at: z.string().nullable(),
  })
  .strict();

const DraftRowSchema = z
  .object({
    id: z.string().uuid(),
    trial_id: z.string().uuid(),
    status: z.string(),
    schema_version: z.string(),
    engine_version: z.string(),
    normalized_result: z.unknown().nullable(),
    edited_result: z.unknown().nullable(),
    expires_at: RawTimestampSchema,
    claimed_by_user_id: z.string().uuid().nullable(),
    claimed_at: z.string().nullable(),
  })
  .strict();

const ClaimSaveRpcOutcomeSchema = z.enum([
  "saved",
  "already_claimed",
  "duplicate_detected",
  "expired",
  "invalid_claim",
  "draft_unavailable",
]);

const ClaimSaveRpcRowSchema = z
  .object({
    outcome: ClaimSaveRpcOutcomeSchema,
    saved_project_id: z.string().uuid().nullable(),
    created: z.boolean(),
  })
  .strict();

type ClaimRow = z.infer<typeof ClaimRowSchema>;
type TrialRow = z.infer<typeof TrialRowSchema>;
type DraftRow = z.infer<typeof DraftRowSchema>;
type ClaimSaveRpcRow = z.infer<typeof ClaimSaveRpcRowSchema>;

const CLAIM_SELECT = [
  "id",
  "trial_id",
  "draft_id",
  "claim_token_hash",
  "public_token_hash",
  "session_token_hash",
  "status",
  "expires_at",
].join(", ");

const TRIAL_SELECT = [
  "id",
  "public_token_hash",
  "session_token_hash",
  "input_type",
  "status",
  "risk_state",
  "expires_at",
  "claimed_by_user_id",
  "claimed_at",
].join(", ");

const DRAFT_SELECT = [
  "id",
  "trial_id",
  "status",
  "schema_version",
  "engine_version",
  "normalized_result",
  "edited_result",
  "expires_at",
  "claimed_by_user_id",
  "claimed_at",
].join(", ");

export async function loadHomepageDemoClaimSaveSource({
  claimTokenHash,
}: {
  claimTokenHash: string;
}): Promise<HomepageDemoClaimSaveSource> {
  const validatedClaimTokenHash = validateTokenHash(claimTokenHash);
  const claim = await loadClaimByHash(validatedClaimTokenHash);

  if (claim === null) {
    return { kind: "claim_unavailable" };
  }

  const now = new Date();

  if (claim.status !== "pending" || claim.expires_at <= now) {
    return {
      kind: "rpc_replay",
      projectGroup: buildRpcReplayProjectGroup(),
    };
  }

  if (claim.trial_id === null || claim.draft_id === null) {
    return { kind: "claim_unavailable" };
  }

  const trial = await loadTrialById(claim.trial_id);
  const draft = await loadDraftById({
    draftId: claim.draft_id,
    trialId: claim.trial_id,
  });

  if (trial === null || draft === null) {
    return { kind: "claim_unavailable" };
  }

  if (trial.expires_at <= now || draft.expires_at <= now) {
    return {
      kind: "rpc_replay",
      projectGroup: buildRpcReplayProjectGroup(),
    };
  }

  if (!isPendingClaimDraftEligible({ claim, trial, draft })) {
    return { kind: "claim_unavailable" };
  }

  const parsedDraft = TextExtractedTasksResponseSchema.safeParse(
    draft.edited_result ?? draft.normalized_result
  );

  if (!parsedDraft.success || parsedDraft.data.tasks.length === 0) {
    return { kind: "claim_unavailable" };
  }

  return {
    kind: "pending",
    projectGroup: buildProjectImportGroup(parsedDraft.data.tasks),
  };
}

export async function claimHomepageDemoProject(
  input: ClaimHomepageDemoProjectInput
): Promise<ClaimHomepageDemoProjectResult> {
  const claimTokenHash = validateTokenHash(input.claimTokenHash);
  const authenticatedUserId = validateUuid(input.authenticatedUserId);
  const requestHash = validateTokenHash(input.requestHash);

  if (!Array.isArray(input.importGroups) || input.importGroups.length !== 1) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "claim_homepage_demo_project",
      {
        p_claim_token_hash: claimTokenHash,
        p_authenticated_user_id: authenticatedUserId,
        p_request_hash: requestHash,
        p_import_groups: input.importGroups,
        p_duplicate_check_passed: input.duplicateCheckPassed,
      }
    );

    if (error) {
      throw mapClaimSaveDatabaseError(error);
    }

    const row = parseSingleRpcRow(data, ClaimSaveRpcRowSchema);

    if (!hasValidClaimSaveRpcShape(row)) {
      throw new HomepageDemoRepositoryError("repository_unavailable");
    }

    return {
      outcome: row.outcome,
      created: row.created,
    };
  } catch (error) {
    if (error instanceof HomepageDemoRepositoryError) {
      throw error;
    }

    throw new HomepageDemoRepositoryError("repository_unavailable");
  }
}

async function loadClaimByHash(claimTokenHash: string): Promise<ClaimRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_claims")
    .select(CLAIM_SELECT)
    .eq("claim_token_hash", claimTokenHash)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, ClaimRowSchema);
}

async function loadTrialById(trialId: string): Promise<TrialRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_trials")
    .select(TRIAL_SELECT)
    .eq("id", trialId)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, TrialRowSchema);
}

async function loadDraftById({
  draftId,
  trialId,
}: {
  draftId: string;
  trialId: string;
}): Promise<DraftRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_drafts")
    .select(DRAFT_SELECT)
    .eq("id", draftId)
    .eq("trial_id", trialId)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, DraftRowSchema);
}

function isPendingClaimDraftEligible({
  claim,
  trial,
  draft,
}: {
  claim: ClaimRow;
  trial: TrialRow;
  draft: DraftRow;
}): boolean {
  return (
    claim.trial_id === trial.id &&
    claim.draft_id === draft.id &&
    trial.public_token_hash === claim.public_token_hash &&
    trial.session_token_hash === claim.session_token_hash &&
    draft.trial_id === trial.id &&
    trial.input_type === "text" &&
    trial.status === "review_ready" &&
    trial.risk_state === "allowed" &&
    trial.claimed_by_user_id === null &&
    trial.claimed_at === null &&
    draft.status === "ready" &&
    draft.schema_version === HOMEPAGE_DEMO_TEXT_SCHEMA_VERSION &&
    draft.engine_version === HOMEPAGE_DEMO_TEXT_ENGINE_VERSION &&
    draft.claimed_by_user_id === null &&
    draft.claimed_at === null &&
    draft.normalized_result !== null
  );
}

function buildProjectImportGroup(
  tasks: readonly TextExtractedTask[]
): ProjectImportJsonRecord {
  const firstTask = tasks[0];

  if (firstTask === undefined) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return {
    client_name: firstTask.client_name,
    contact_name: firstTask.contact_name,
    client_phone: firstTask.client_phone,
    client_email: firstTask.client_email,
    client_notes: firstTask.client_notes,
    title: firstTask.task_title,
    amount: firstTask.amount,
    deadline_text: firstTask.deadline_text,
    priority: firstTask.priority,
    source: "Homepage Demo",
    raw_input: firstTask.raw_input,
    tasks: tasks.map((task) => ({
      client_name: task.client_name,
      contact_name: task.contact_name,
      client_phone: task.client_phone,
      client_email: task.client_email,
      client_notes: task.client_notes,
      task_title: task.task_title,
      amount: task.amount,
      deadline_text: task.deadline_text,
      priority: task.priority,
      source: "Homepage Demo",
      raw_input: task.raw_input,
    })),
  };
}

function buildRpcReplayProjectGroup(): ProjectImportJsonRecord {
  return {
    client_name: "Homepage Demo",
    title: "Homepage Demo claim replay",
    source: "Homepage Demo",
    raw_input: "",
    tasks: [
      {
        task_title: "Homepage Demo claim replay",
        source: "Homepage Demo",
        raw_input: "",
      },
    ],
  };
}

function parseSingleOptionalRow<T>(
  value: unknown,
  schema: z.ZodType<T>
): T | null {
  if (!Array.isArray(value)) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  if (value.length === 0) {
    return null;
  }

  if (value.length !== 1) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  const parsed = schema.safeParse(value[0]);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return parsed.data;
}

function parseSingleRpcRow<T>(data: unknown, schema: z.ZodType<T>): T {
  if (!Array.isArray(data) || data.length !== 1) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  const parsed = schema.safeParse(data[0]);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parsed.data;
}

function hasValidClaimSaveRpcShape(row: ClaimSaveRpcRow): boolean {
  switch (row.outcome) {
    case "saved":
      return row.saved_project_id !== null && row.created === true;
    case "already_claimed":
      return row.saved_project_id !== null && row.created === false;
    case "duplicate_detected":
    case "expired":
    case "invalid_claim":
    case "draft_unavailable":
      return row.saved_project_id === null && row.created === false;
  }
}

function mapClaimSaveDatabaseError(
  error: SupabaseError
): HomepageDemoRepositoryError {
  const message = typeof error.message === "string" ? error.message : "";

  if (
    message.includes("HOMEPAGE_DEMO_CLAIM_SAVE_RESULT_INVALID") ||
    message.includes("HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT")
  ) {
    return new HomepageDemoRepositoryError("repository_unavailable");
  }

  return new HomepageDemoRepositoryError("repository_unavailable");
}

function validateTokenHash(value: unknown): string {
  if (typeof value !== "string" || !SHA_256_HASH_PATTERN.test(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateUuid(value: unknown): string {
  const parsed = z.string().uuid().safeParse(value);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return parsed.data;
}
