import "server-only";

import { z, type ZodType } from "zod";

import {
  HomepageDemoRepositoryError,
  type HomepageDemoRepositoryErrorCode,
} from "@/lib/homepage-demo/errors";
import {
  isHomepageDemoJsonObject,
  type HomepageDemoJsonObject,
} from "@/lib/homepage-demo/json-validation";
import { hashHomepageDemoCapacityLeaseToken } from "@/lib/homepage-demo/tokens.server";
import {
  type HomepageDemoProcessingCompletionResult,
  type HomepageDemoProcessingFailureResult,
  type HomepageDemoProcessingStartResult,
} from "@/lib/homepage-demo/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const FAILURE_CODE_PATTERN = /^[a-z0-9_:-]{1,80}$/;

export type StartHomepageDemoProcessingInput = Readonly<{
  attemptId: string;
  capacityLeaseToken: string;
}>;

export type CompleteHomepageDemoProcessingInput = Readonly<{
  attemptId: string;
  capacityLeaseToken: string;
  normalizedResult: HomepageDemoJsonObject;
  schemaVersion: string;
  engineVersion: string;
}>;

export type FailHomepageDemoProcessingInput = Readonly<{
  attemptId: string;
  capacityLeaseToken: string;
  failureCode: string;
}>;

type SupabaseRpcError = Readonly<{
  message?: string | null;
}>;

type RepositoryInputRecord = Readonly<Record<string, unknown>>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;
type RepositoryInputDescriptors = ReadonlyMap<string, DataPropertyDescriptor>;

const TimestampSchema = z
  .string()
  .refine(isValidTimestamp)
  .transform((value) => new Date(value));

const NullableTimestampSchema = z
  .union([z.string().refine(isValidTimestamp), z.null()])
  .transform((value) => (value === null ? null : new Date(value)));

const ProcessingStartRpcRowSchema: ZodType<{
  decision: "processing";
  attempt_id: string;
  trial_id: string;
  attempt_status: "processing";
  trial_status: "processing";
  provider_call_started_at: Date;
  lease_expires_at: Date;
  idempotent: boolean;
}> = z
  .object({
    decision: z.literal("processing"),
    attempt_id: z.string().uuid(),
    trial_id: z.string().uuid(),
    attempt_status: z.literal("processing"),
    trial_status: z.literal("processing"),
    provider_call_started_at: TimestampSchema,
    lease_expires_at: TimestampSchema,
    idempotent: z.boolean(),
  })
  .strict();

const ProcessingCompletionRpcRowSchema: ZodType<{
  decision: "review_ready";
  attempt_id: string;
  trial_id: string;
  draft_id: string;
  attempt_status: "review_ready";
  trial_status: "review_ready";
  draft_status: "ready";
  provider_call_started_at: Date;
  provider_call_completed_at: Date;
  review_ready_at: Date;
  idempotent: boolean;
}> = z
  .object({
    decision: z.literal("review_ready"),
    attempt_id: z.string().uuid(),
    trial_id: z.string().uuid(),
    draft_id: z.string().uuid(),
    attempt_status: z.literal("review_ready"),
    trial_status: z.literal("review_ready"),
    draft_status: z.literal("ready"),
    provider_call_started_at: TimestampSchema,
    provider_call_completed_at: TimestampSchema,
    review_ready_at: TimestampSchema,
    idempotent: z.boolean(),
  })
  .strict();

const ProcessingFailureRpcRowSchema: ZodType<{
  decision: "failed";
  attempt_id: string;
  trial_id: string;
  attempt_status: "failed";
  trial_status: "failed";
  provider_call_started_at: Date | null;
  provider_call_completed_at: Date | null;
  lease_expires_at: Date;
  idempotent: boolean;
}> = z
  .object({
    decision: z.literal("failed"),
    attempt_id: z.string().uuid(),
    trial_id: z.string().uuid(),
    attempt_status: z.literal("failed"),
    trial_status: z.literal("failed"),
    provider_call_started_at: NullableTimestampSchema,
    provider_call_completed_at: NullableTimestampSchema,
    lease_expires_at: TimestampSchema,
    idempotent: z.boolean(),
  })
  .strict();

type ProcessingFailureRpcRow = z.infer<typeof ProcessingFailureRpcRowSchema>;

const PROCESSING_DATABASE_ERROR_CODE_MAP: ReadonlyArray<
  readonly [string, HomepageDemoRepositoryErrorCode]
> = [
  ["HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT", "invalid_repository_input"],
  ["HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND", "processing_attempt_not_found"],
  ["HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID", "processing_lease_invalid"],
  ["HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED", "processing_lease_expired"],
  ["HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT", "processing_state_conflict"],
  [
    "HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT",
    "processing_completion_conflict",
  ],
  [
    "HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE",
    "repository_unavailable",
  ],
];

export async function startHomepageDemoProcessing(
  input: StartHomepageDemoProcessingInput
): Promise<HomepageDemoProcessingStartResult> {
  const { attemptId, capacityLeaseToken } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      attemptId: validateUuid(
        readRepositoryInputProperty(inputRecord, "attemptId")
      ),
      capacityLeaseToken: validateRawToken(
        readRepositoryInputProperty(inputRecord, "capacityLeaseToken")
      ),
    };
  });

  const data = await callHomepageDemoProcessingRpc(
    "start_homepage_demo_processing",
    {
      p_attempt_id: attemptId,
      p_capacity_lease_token_hash:
        hashHomepageDemoCapacityLeaseToken(capacityLeaseToken),
    }
  );

  const row = parseSingleRpcRow(data, ProcessingStartRpcRowSchema);

  return {
    decision: row.decision,
    attemptId: row.attempt_id,
    trialId: row.trial_id,
    attemptStatus: row.attempt_status,
    trialStatus: row.trial_status,
    providerCallStartedAt: row.provider_call_started_at,
    leaseExpiresAt: row.lease_expires_at,
    idempotent: row.idempotent,
  };
}

export async function completeHomepageDemoProcessing(
  input: CompleteHomepageDemoProcessingInput
): Promise<HomepageDemoProcessingCompletionResult> {
  const {
    attemptId,
    capacityLeaseToken,
    normalizedResult,
    schemaVersion,
    engineVersion,
  } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      attemptId: validateUuid(
        readRepositoryInputProperty(inputRecord, "attemptId")
      ),
      capacityLeaseToken: validateRawToken(
        readRepositoryInputProperty(inputRecord, "capacityLeaseToken")
      ),
      normalizedResult: validateJsonObject(
        readRepositoryInputProperty(inputRecord, "normalizedResult")
      ),
      schemaVersion: validateSafeIdentifier(
        readRepositoryInputProperty(inputRecord, "schemaVersion")
      ),
      engineVersion: validateSafeIdentifier(
        readRepositoryInputProperty(inputRecord, "engineVersion")
      ),
    };
  });

  const data = await callHomepageDemoProcessingRpc(
    "complete_homepage_demo_processing",
    {
      p_attempt_id: attemptId,
      p_capacity_lease_token_hash:
        hashHomepageDemoCapacityLeaseToken(capacityLeaseToken),
      p_normalized_result: normalizedResult,
      p_schema_version: schemaVersion,
      p_engine_version: engineVersion,
    }
  );

  const row = parseSingleRpcRow(data, ProcessingCompletionRpcRowSchema);

  return {
    decision: row.decision,
    attemptId: row.attempt_id,
    trialId: row.trial_id,
    draftId: row.draft_id,
    attemptStatus: row.attempt_status,
    trialStatus: row.trial_status,
    draftStatus: row.draft_status,
    providerCallStartedAt: row.provider_call_started_at,
    providerCallCompletedAt: row.provider_call_completed_at,
    reviewReadyAt: row.review_ready_at,
    idempotent: row.idempotent,
  };
}

export async function failHomepageDemoProcessing(
  input: FailHomepageDemoProcessingInput
): Promise<HomepageDemoProcessingFailureResult> {
  const { attemptId, capacityLeaseToken, failureCode } = validateLocalInput(
    () => {
      const inputRecord = validateRepositoryInputObject(input);

      return {
        attemptId: validateUuid(
          readRepositoryInputProperty(inputRecord, "attemptId")
        ),
        capacityLeaseToken: validateRawToken(
          readRepositoryInputProperty(inputRecord, "capacityLeaseToken")
        ),
        failureCode: validateFailureCode(
          readRepositoryInputProperty(inputRecord, "failureCode")
        ),
      };
    }
  );

  const data = await callHomepageDemoProcessingRpc(
    "fail_homepage_demo_processing",
    {
      p_attempt_id: attemptId,
      p_capacity_lease_token_hash:
        hashHomepageDemoCapacityLeaseToken(capacityLeaseToken),
      p_failure_code: failureCode,
    }
  );

  const row = parseProcessingFailureRpcRow(data);

  return {
    decision: row.decision,
    attemptId: row.attempt_id,
    trialId: row.trial_id,
    attemptStatus: row.attempt_status,
    trialStatus: row.trial_status,
    providerCallStartedAt: row.provider_call_started_at,
    providerCallCompletedAt: row.provider_call_completed_at,
    leaseExpiresAt: row.lease_expires_at,
    idempotent: row.idempotent,
  };
}

async function callHomepageDemoProcessingRpc(
  functionName:
    | "start_homepage_demo_processing"
    | "complete_homepage_demo_processing"
    | "fail_homepage_demo_processing",
  params: Record<string, unknown>
): Promise<unknown> {
  try {
    const { data, error } = await supabaseAdmin.rpc(functionName, params);

    if (error) {
      throw mapProcessingDatabaseError(error);
    }

    return data;
  } catch (error) {
    if (error instanceof HomepageDemoRepositoryError) {
      throw error;
    }

    throw new HomepageDemoRepositoryError("repository_unavailable");
  }
}

function parseSingleRpcRow<T>(data: unknown, schema: ZodType<T>): T {
  if (!Array.isArray(data) || data.length !== 1) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  const parsed = schema.safeParse(data[0]);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return parsed.data;
}

function parseProcessingFailureRpcRow(data: unknown): ProcessingFailureRpcRow {
  const row = parseSingleRpcRow(data, ProcessingFailureRpcRowSchema);

  if (!hasValidFailureProviderTimestampShape(row)) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return row;
}

function hasValidFailureProviderTimestampShape(
  row: ProcessingFailureRpcRow
): boolean {
  return (
    (row.provider_call_started_at === null &&
      row.provider_call_completed_at === null) ||
    (row.provider_call_started_at !== null &&
      row.provider_call_completed_at !== null)
  );
}

function mapProcessingDatabaseError(
  error: SupabaseRpcError
): HomepageDemoRepositoryError {
  const message = typeof error.message === "string" ? error.message : "";
  const matchedError = PROCESSING_DATABASE_ERROR_CODE_MAP.find(
    ([databaseMessage]) => message.includes(databaseMessage)
  );

  return new HomepageDemoRepositoryError(
    matchedError?.[1] ?? "repository_unavailable"
  );
}

function validateLocalInput<T>(validator: () => T): T {
  try {
    return validator();
  } catch (error) {
    if (error instanceof HomepageDemoRepositoryError) {
      throw error;
    }

    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }
}

function validateRepositoryInputObject(
  value: unknown
): RepositoryInputDescriptors {
  if (!isPlainObject(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  const descriptors = getOwnPropertyDescriptors(value);

  if (descriptors === null) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  const capturedDescriptors = new Map<string, DataPropertyDescriptor>();

  for (const propertyKey of Reflect.ownKeys(descriptors)) {
    if (typeof propertyKey !== "string") {
      throw new HomepageDemoRepositoryError("invalid_repository_input");
    }

    const descriptor = descriptors[propertyKey];

    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new HomepageDemoRepositoryError("invalid_repository_input");
    }

    capturedDescriptors.set(propertyKey, descriptor);
  }

  return capturedDescriptors;
}

function readRepositoryInputProperty(
  input: RepositoryInputDescriptors,
  propertyName: string
): unknown {
  const descriptor = input.get(propertyName);

  if (descriptor === undefined) {
    return undefined;
  }

  return descriptor.value;
}

function validateUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateRawToken(value: unknown): string {
  if (typeof value !== "string" || !RAW_TOKEN_PATTERN.test(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateJsonObject(value: unknown): HomepageDemoJsonObject {
  if (!isHomepageDemoJsonObject(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateSafeIdentifier(value: unknown): string {
  if (typeof value !== "string") {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  const trimmedValue = value.trim();

  if (
    trimmedValue.length < 1 ||
    trimmedValue.length > 80 ||
    !SAFE_IDENTIFIER_PATTERN.test(trimmedValue)
  ) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return trimmedValue;
}

function validateFailureCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  const trimmedValue = value.trim();

  if (!FAILURE_CODE_PATTERN.test(trimmedValue)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return trimmedValue;
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function isPlainObject(value: unknown): value is RepositoryInputRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function getOwnPropertyDescriptors(
  value: object
): PropertyDescriptorMap | null {
  try {
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined
): descriptor is DataPropertyDescriptor {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor &&
    descriptor.get === undefined &&
    descriptor.set === undefined
  );
}
