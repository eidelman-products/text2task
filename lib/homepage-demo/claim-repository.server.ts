import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { HomepageDemoClaimExpiry } from "@/lib/homepage-demo/claim-identity.server";
import { calculateHomepageDemoClaimExpiry } from "@/lib/homepage-demo/claim-identity.server";
import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";
import { isHomepageDemoJsonObject } from "@/lib/homepage-demo/json-validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SHA_256_HASH_PATTERN = /^[0-9a-f]{64}$/;
const HOMEPAGE_DEMO_TEXT_SCHEMA_VERSION = "homepage-demo-draft-v1";
const HOMEPAGE_DEMO_TEXT_ENGINE_VERSION = "text-extraction-v1";

export type HomepageDemoClaimPreparationCode =
  | "claim_prepared"
  | "claim_in_progress"
  | "already_claimed"
  | "expired"
  | "draft_unavailable"
  | "not_found";

export type PrepareHomepageDemoPendingClaimInput = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
  existingClaimTokenHash: string | null;
  candidateClaimTokenHash: string | null;
}>;

export type PrepareHomepageDemoPendingClaimResult =
  | Readonly<{
      action: "needs_claim_authority";
    }>
  | Readonly<{
      action: "none";
      code: HomepageDemoClaimPreparationCode;
      cookieMaxAgeSeconds: null;
    }>
  | Readonly<{
      action: "set_cookie";
      code: Extract<HomepageDemoClaimPreparationCode, "claim_prepared">;
      cookieMaxAgeSeconds: number;
    }>;

type SupabaseError = Readonly<{
  code?: string | null;
}>;

const RawTimestampSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)))
  .transform((value) => new Date(value));

const TokenHashSchema = z
  .string()
  .regex(SHA_256_HASH_PATTERN);

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
    expires_at: RawTimestampSchema,
    claimed_by_user_id: z.string().uuid().nullable(),
    claimed_at: z.string().nullable(),
  })
  .strict();

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
    claimed_by_user_id: z.string().uuid().nullable(),
    saved_project_id: z.string().uuid().nullable(),
    claimed_at: z.string().nullable(),
  })
  .strict();

type TrialRow = z.infer<typeof TrialRowSchema>;
type DraftRow = z.infer<typeof DraftRowSchema>;
type ClaimRow = z.infer<typeof ClaimRowSchema>;

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
  "expires_at",
  "claimed_by_user_id",
  "claimed_at",
].join(", ");

const CLAIM_SELECT = [
  "id",
  "trial_id",
  "draft_id",
  "claim_token_hash",
  "public_token_hash",
  "session_token_hash",
  "status",
  "expires_at",
  "claimed_by_user_id",
  "saved_project_id",
  "claimed_at",
].join(", ");

export async function prepareHomepageDemoPendingClaim(
  input: PrepareHomepageDemoPendingClaimInput
): Promise<PrepareHomepageDemoPendingClaimResult> {
  const validatedInput = validateInput(input);
  const now = new Date();
  const trial = await loadTrial({
    publicTokenHash: validatedInput.publicTokenHash,
    sessionTokenHash: validatedInput.sessionTokenHash,
  });

  if (trial === null) {
    return noCookie("not_found");
  }

  const draft = await loadDraft(trial.id);

  if (draft === null || draft.trial_id !== trial.id) {
    return noCookie("draft_unavailable");
  }

  const existingClaim =
    (await loadClaimForTrial(trial.id)) ??
    (await loadClaimForBinding({
      publicTokenHash: trial.public_token_hash,
      sessionTokenHash: trial.session_token_hash,
    }));

  if (existingClaim?.status === "claimed") {
    return noCookie("already_claimed");
  }

  if (
    existingClaim !== null &&
    (existingClaim.trial_id !== trial.id || existingClaim.draft_id !== draft.id)
  ) {
    return noCookie("draft_unavailable");
  }

  if (trial.expires_at <= now || draft.expires_at <= now) {
    return noCookie("expired");
  }

  if (!isEligibleReviewDraft({ trial, draft })) {
    return noCookie("draft_unavailable");
  }

  const claimExpiry = calculateHomepageDemoClaimExpiry({
    now,
    trialExpiresAt: trial.expires_at,
    draftExpiresAt: draft.expires_at,
  });

  if (claimExpiry === null) {
    return noCookie("expired");
  }

  if (existingClaim === null) {
    if (validatedInput.candidateClaimTokenHash === null) {
      return needsClaimAuthority();
    }

    return createPendingClaim({
      trial,
      draft,
      candidateClaimTokenHash: validatedInput.candidateClaimTokenHash,
      claimExpiry,
    });
  }

  return prepareFromExistingClaim({
    trial,
    draft,
    existingClaim,
    existingClaimTokenHash: validatedInput.existingClaimTokenHash,
    candidateClaimTokenHash: validatedInput.candidateClaimTokenHash,
    claimExpiry,
    now,
  });
}

function validateInput(
  input: PrepareHomepageDemoPendingClaimInput
): PrepareHomepageDemoPendingClaimInput {
  if (
    !isTokenHash(input.publicTokenHash) ||
    !isTokenHash(input.sessionTokenHash) ||
    (input.existingClaimTokenHash !== null &&
      !isTokenHash(input.existingClaimTokenHash)) ||
    (input.candidateClaimTokenHash !== null &&
      !isTokenHash(input.candidateClaimTokenHash))
  ) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return input;
}

async function prepareFromExistingClaim({
  trial,
  draft,
  existingClaim,
  existingClaimTokenHash,
  candidateClaimTokenHash,
  claimExpiry,
  now,
}: {
  trial: TrialRow;
  draft: DraftRow;
  existingClaim: ClaimRow;
  existingClaimTokenHash: string | null;
  candidateClaimTokenHash: string | null;
  claimExpiry: HomepageDemoClaimExpiry;
  now: Date;
}): Promise<PrepareHomepageDemoPendingClaimResult> {
  if (existingClaim.status === "pending" && existingClaim.expires_at > now) {
    if (
      existingClaimTokenHash !== null &&
      existingClaim.claim_token_hash === existingClaimTokenHash
    ) {
      return noCookie("claim_prepared");
    }

    return noCookie("claim_in_progress");
  }

  if (existingClaim.status === "pending" && existingClaim.expires_at <= now) {
    if (candidateClaimTokenHash === null) {
      return needsClaimAuthority();
    }

    return resetPendingClaim({
      trial,
      draft,
      existingClaim,
      candidateClaimTokenHash,
      claimExpiry,
      now,
    });
  }

  if (
    existingClaim.status === "expired" ||
    existingClaim.status === "cancelled"
  ) {
    if (candidateClaimTokenHash === null) {
      return needsClaimAuthority();
    }

    return resetTerminalReusableClaim({
      trial,
      draft,
      existingClaim,
      candidateClaimTokenHash,
      claimExpiry,
    });
  }

  return noCookie("claim_in_progress");
}

async function createPendingClaim({
  trial,
  draft,
  candidateClaimTokenHash,
  claimExpiry,
}: {
  trial: TrialRow;
  draft: DraftRow;
  candidateClaimTokenHash: string;
  claimExpiry: HomepageDemoClaimExpiry;
}): Promise<PrepareHomepageDemoPendingClaimResult> {
  const { error } = await supabaseAdmin
    .from("homepage_demo_claims")
    .insert({
      trial_id: trial.id,
      draft_id: draft.id,
      claim_token_hash: candidateClaimTokenHash,
      public_token_hash: trial.public_token_hash,
      session_token_hash: trial.session_token_hash,
      status: "pending",
      expires_at: claimExpiry.expiresAt.toISOString(),
      import_idempotency_key: randomUUID(),
      claimed_by_user_id: null,
      saved_project_id: null,
      claimed_at: null,
    });

  if (!error) {
    return withCookie(claimExpiry);
  }

  if (isUniqueViolation(error)) {
    const currentClaim = await loadClaimForTrial(trial.id);

    if (currentClaim === null) {
      throw new HomepageDemoRepositoryError("token_collision");
    }

    if (currentClaim.status === "claimed") {
      return noCookie("already_claimed");
    }

    return noCookie("claim_in_progress");
  }

  throw new HomepageDemoRepositoryError("repository_unavailable");
}

async function resetPendingClaim({
  trial,
  draft,
  existingClaim,
  candidateClaimTokenHash,
  claimExpiry,
  now,
}: {
  trial: TrialRow;
  draft: DraftRow;
  existingClaim: ClaimRow;
  candidateClaimTokenHash: string;
  claimExpiry: HomepageDemoClaimExpiry;
  now: Date;
}): Promise<PrepareHomepageDemoPendingClaimResult> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_claims")
    .update(
      buildResetClaimUpdate({
        trial,
        draft,
        candidateClaimTokenHash,
        claimExpiry,
      })
    )
    .eq("id", existingClaim.id)
    .eq("trial_id", trial.id)
    .eq("draft_id", draft.id)
    .eq("status", "pending")
    .lte("expires_at", now.toISOString())
    .select(CLAIM_SELECT);

  return finishResetResult({
    data,
    error,
    trialId: trial.id,
    candidateClaimTokenHash,
    claimExpiry,
  });
}

async function resetTerminalReusableClaim({
  trial,
  draft,
  existingClaim,
  candidateClaimTokenHash,
  claimExpiry,
}: {
  trial: TrialRow;
  draft: DraftRow;
  existingClaim: ClaimRow;
  candidateClaimTokenHash: string;
  claimExpiry: HomepageDemoClaimExpiry;
}): Promise<PrepareHomepageDemoPendingClaimResult> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_claims")
    .update(
      buildResetClaimUpdate({
        trial,
        draft,
        candidateClaimTokenHash,
        claimExpiry,
      })
    )
    .eq("id", existingClaim.id)
    .eq("trial_id", trial.id)
    .eq("draft_id", draft.id)
    .in("status", ["expired", "cancelled"])
    .select(CLAIM_SELECT);

  return finishResetResult({
    data,
    error,
    trialId: trial.id,
    candidateClaimTokenHash,
    claimExpiry,
  });
}

function buildResetClaimUpdate({
  trial,
  draft,
  candidateClaimTokenHash,
  claimExpiry,
}: {
  trial: TrialRow;
  draft: DraftRow;
  candidateClaimTokenHash: string;
  claimExpiry: HomepageDemoClaimExpiry;
}) {
  return {
    trial_id: trial.id,
    draft_id: draft.id,
    claim_token_hash: candidateClaimTokenHash,
    public_token_hash: trial.public_token_hash,
    session_token_hash: trial.session_token_hash,
    status: "pending",
    expires_at: claimExpiry.expiresAt.toISOString(),
    claimed_by_user_id: null,
    saved_project_id: null,
    claimed_at: null,
    import_idempotency_key: randomUUID(),
  };
}

async function finishResetResult({
  data,
  error,
  trialId,
  candidateClaimTokenHash,
  claimExpiry,
}: {
  data: unknown;
  error: SupabaseError | null;
  trialId: string;
  candidateClaimTokenHash: string;
  claimExpiry: HomepageDemoClaimExpiry;
}): Promise<PrepareHomepageDemoPendingClaimResult> {
  if (!error) {
    const updatedClaims = parseClaimRows(data);

    if (
      updatedClaims.length === 1 &&
      updatedClaims[0]?.claim_token_hash === candidateClaimTokenHash
    ) {
      return withCookie(claimExpiry);
    }
  }

  if (error && !isUniqueViolation(error)) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  const currentClaim = await loadClaimForTrial(trialId);

  if (currentClaim?.status === "claimed") {
    return noCookie("already_claimed");
  }

  return noCookie("claim_in_progress");
}

async function loadTrial({
  publicTokenHash,
  sessionTokenHash,
}: {
  publicTokenHash: string;
  sessionTokenHash: string;
}): Promise<TrialRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_trials")
    .select(TRIAL_SELECT)
    .eq("public_token_hash", publicTokenHash)
    .eq("session_token_hash", sessionTokenHash)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, TrialRowSchema);
}

async function loadDraft(trialId: string): Promise<DraftRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_drafts")
    .select(DRAFT_SELECT)
    .eq("trial_id", trialId)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, DraftRowSchema);
}

async function loadClaimForTrial(trialId: string): Promise<ClaimRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_claims")
    .select(CLAIM_SELECT)
    .eq("trial_id", trialId)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, ClaimRowSchema);
}

async function loadClaimForBinding({
  publicTokenHash,
  sessionTokenHash,
}: {
  publicTokenHash: string;
  sessionTokenHash: string;
}): Promise<ClaimRow | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_demo_claims")
    .select(CLAIM_SELECT)
    .eq("public_token_hash", publicTokenHash)
    .eq("session_token_hash", sessionTokenHash)
    .limit(1);

  if (error) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parseSingleOptionalRow(data, ClaimRowSchema);
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

function parseClaimRows(value: unknown): ClaimRow[] {
  const parsed = z.array(ClaimRowSchema).safeParse(value);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return parsed.data;
}

function isEligibleReviewDraft({
  trial,
  draft,
}: {
  trial: TrialRow;
  draft: DraftRow;
}): boolean {
  return (
    trial.public_token_hash.length === 64 &&
    trial.session_token_hash.length === 64 &&
    trial.input_type === "text" &&
    trial.status === "review_ready" &&
    trial.risk_state === "allowed" &&
    trial.claimed_by_user_id === null &&
    trial.claimed_at === null &&
    draft.trial_id === trial.id &&
    draft.status === "ready" &&
    draft.schema_version === HOMEPAGE_DEMO_TEXT_SCHEMA_VERSION &&
    draft.engine_version === HOMEPAGE_DEMO_TEXT_ENGINE_VERSION &&
    draft.claimed_by_user_id === null &&
    draft.claimed_at === null &&
    isHomepageDemoJsonObject(draft.normalized_result)
  );
}

function withCookie(
  claimExpiry: HomepageDemoClaimExpiry
): PrepareHomepageDemoPendingClaimResult {
  return {
    action: "set_cookie",
    code: "claim_prepared",
    cookieMaxAgeSeconds: claimExpiry.maxAgeSeconds,
  };
}

function noCookie(
  code: HomepageDemoClaimPreparationCode
): PrepareHomepageDemoPendingClaimResult {
  return {
    action: "none",
    code,
    cookieMaxAgeSeconds: null,
  };
}

function needsClaimAuthority(): PrepareHomepageDemoPendingClaimResult {
  return {
    action: "needs_claim_authority",
  };
}

function isUniqueViolation(error: SupabaseError): boolean {
  return error.code === "23505";
}

function isTokenHash(value: unknown): value is string {
  return typeof value === "string" && SHA_256_HASH_PATTERN.test(value);
}
