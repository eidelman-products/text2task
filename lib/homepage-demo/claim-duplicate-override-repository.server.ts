import "server-only";

import { z } from "zod";

import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";
import type { ProjectImportJsonRecord } from "@/lib/projects/import-persistence.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SHA_256_HASH_PATTERN = /^[0-9a-f]{64}$/;

export type PrepareHomepageDemoDuplicateOverrideInput = Readonly<{
  claimTokenHash: string;
  authenticatedUserId: string;
  existingAuthorityTokenHash: string | null;
  candidateAuthorityTokenHash: string;
  requestHash: string;
  importGroupsJson: ProjectImportJsonRecord[];
}>;

export type PrepareHomepageDemoDuplicateOverrideResult =
  | Readonly<{
      outcome: "authority_prepared";
      setCookie: true;
      expiresAt: Date;
    }>
  | Readonly<{
      outcome: "authority_reused";
      setCookie: false;
      expiresAt: Date;
    }>
  | Readonly<{
      outcome:
        | "authority_in_progress"
        | "already_claimed"
        | "expired"
        | "invalid_claim";
      setCookie: false;
      expiresAt: null;
    }>;

export type ClaimHomepageDemoProjectWithDuplicateOverrideInput = Readonly<{
  claimTokenHash: string;
  authenticatedUserId: string;
  authorityTokenHash: string;
  requestHash: string;
  importGroupsJson: ProjectImportJsonRecord[];
}>;

export type ClaimHomepageDemoProjectWithDuplicateOverrideResult = Readonly<{
  outcome:
    | "saved"
    | "already_claimed"
    | "expired"
    | "invalid_claim"
    | "draft_unavailable"
    | "duplicate_authority_unavailable"
    | "duplicate_authority_expired"
    | "duplicate_detected";
  created: boolean;
}>;

const PrepareDuplicateOverrideOutcomeSchema = z.enum([
  "authority_prepared",
  "authority_reused",
  "authority_in_progress",
  "already_claimed",
  "expired",
  "invalid_claim",
]);

const ClaimWithDuplicateOverrideOutcomeSchema = z.enum([
  "saved",
  "already_claimed",
  "expired",
  "invalid_claim",
  "draft_unavailable",
  "duplicate_authority_unavailable",
  "duplicate_authority_expired",
  "duplicate_detected",
]);

const PrepareDuplicateOverrideRpcRowSchema = z
  .object({
    outcome: PrepareDuplicateOverrideOutcomeSchema,
    set_cookie: z.boolean(),
    expires_at: z.string().nullable(),
  })
  .strict();

const ClaimWithDuplicateOverrideRpcRowSchema = z
  .object({
    outcome: ClaimWithDuplicateOverrideOutcomeSchema,
    saved_project_id: z.string().uuid().nullable(),
    created: z.boolean(),
  })
  .strict();

type PrepareDuplicateOverrideRpcRow = z.infer<
  typeof PrepareDuplicateOverrideRpcRowSchema
>;
type ClaimWithDuplicateOverrideRpcRow = z.infer<
  typeof ClaimWithDuplicateOverrideRpcRowSchema
>;

export async function prepareHomepageDemoDuplicateOverride(
  input: PrepareHomepageDemoDuplicateOverrideInput
): Promise<PrepareHomepageDemoDuplicateOverrideResult> {
  const claimTokenHash = validateTokenHash(input.claimTokenHash);
  const authenticatedUserId = validateUuid(input.authenticatedUserId);
  const existingAuthorityTokenHash =
    input.existingAuthorityTokenHash === null
      ? null
      : validateTokenHash(input.existingAuthorityTokenHash);
  const candidateAuthorityTokenHash = validateTokenHash(
    input.candidateAuthorityTokenHash
  );
  const requestHash = validateTokenHash(input.requestHash);
  const importGroupsJson = validateSingleImportGroup(input.importGroupsJson);

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "prepare_homepage_demo_duplicate_override",
      {
        p_claim_token_hash: claimTokenHash,
        p_authenticated_user_id: authenticatedUserId,
        p_existing_authority_token_hash: existingAuthorityTokenHash,
        p_candidate_authority_token_hash: candidateAuthorityTokenHash,
        p_request_hash: requestHash,
        p_import_groups: importGroupsJson,
      }
    );

    if (error) {
      throw new HomepageDemoRepositoryError("repository_unavailable");
    }

    return parsePrepareDuplicateOverrideResult(
      parseSingleRpcRow(data, PrepareDuplicateOverrideRpcRowSchema)
    );
  } catch (error) {
    if (error instanceof HomepageDemoRepositoryError) {
      throw error;
    }

    throw new HomepageDemoRepositoryError("repository_unavailable");
  }
}

export async function claimHomepageDemoProjectWithDuplicateOverride(
  input: ClaimHomepageDemoProjectWithDuplicateOverrideInput
): Promise<ClaimHomepageDemoProjectWithDuplicateOverrideResult> {
  const claimTokenHash = validateTokenHash(input.claimTokenHash);
  const authenticatedUserId = validateUuid(input.authenticatedUserId);
  const authorityTokenHash = validateTokenHash(input.authorityTokenHash);
  const requestHash = validateTokenHash(input.requestHash);
  const importGroupsJson = validateSingleImportGroup(input.importGroupsJson);

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "claim_homepage_demo_project_with_duplicate_override",
      {
        p_claim_token_hash: claimTokenHash,
        p_authenticated_user_id: authenticatedUserId,
        p_authority_token_hash: authorityTokenHash,
        p_request_hash: requestHash,
        p_import_groups: importGroupsJson,
      }
    );

    if (error) {
      throw new HomepageDemoRepositoryError("repository_unavailable");
    }

    const row = parseSingleRpcRow(
      data,
      ClaimWithDuplicateOverrideRpcRowSchema
    );

    if (!hasValidClaimWithDuplicateOverrideRpcShape(row)) {
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

function parsePrepareDuplicateOverrideResult(
  row: PrepareDuplicateOverrideRpcRow
): PrepareHomepageDemoDuplicateOverrideResult {
  switch (row.outcome) {
    case "authority_prepared": {
      const expiresAt = parseRpcTimestamp(row.expires_at);

      if (!row.set_cookie || expiresAt === null) {
        throw new HomepageDemoRepositoryError("repository_unavailable");
      }

      return {
        outcome: row.outcome,
        setCookie: true,
        expiresAt,
      };
    }
    case "authority_reused": {
      const expiresAt = parseRpcTimestamp(row.expires_at);

      if (row.set_cookie || expiresAt === null) {
        throw new HomepageDemoRepositoryError("repository_unavailable");
      }

      return {
        outcome: row.outcome,
        setCookie: false,
        expiresAt,
      };
    }
    case "authority_in_progress":
    case "already_claimed":
    case "expired":
    case "invalid_claim":
      if (row.set_cookie || row.expires_at !== null) {
        throw new HomepageDemoRepositoryError("repository_unavailable");
      }

      return {
        outcome: row.outcome,
        setCookie: false,
        expiresAt: null,
      };
  }
}

function hasValidClaimWithDuplicateOverrideRpcShape(
  row: ClaimWithDuplicateOverrideRpcRow
): boolean {
  switch (row.outcome) {
    case "saved":
      return row.saved_project_id !== null && row.created === true;
    case "already_claimed":
      return row.saved_project_id !== null && row.created === false;
    case "expired":
    case "invalid_claim":
    case "draft_unavailable":
    case "duplicate_authority_unavailable":
    case "duplicate_authority_expired":
    case "duplicate_detected":
      return row.saved_project_id === null && row.created === false;
  }
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

function parseRpcTimestamp(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const expiresAt = new Date(value);

  if (!Number.isFinite(expiresAt.getTime())) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return expiresAt;
}

function validateSingleImportGroup(
  value: ProjectImportJsonRecord[]
): ProjectImportJsonRecord[] {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
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
