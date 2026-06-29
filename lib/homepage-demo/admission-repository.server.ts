import "server-only";

import { z, type ZodType } from "zod";

import {
  HomepageDemoRepositoryError,
  type HomepageDemoRepositoryErrorCode,
} from "@/lib/homepage-demo/errors";
import { hashHomepageDemoCapacityLeaseToken } from "@/lib/homepage-demo/tokens.server";
import {
  HOMEPAGE_DEMO_ADMISSION_DECISIONS,
  HOMEPAGE_DEMO_CHALLENGE_FAILURE_DECISIONS,
  HOMEPAGE_DEMO_TRIAL_INPUT_TYPES,
  HOMEPAGE_DEMO_TRIAL_STATUSES,
  type HomepageDemoAdmissionDecision,
  type HomepageDemoAdmissionResult,
  type HomepageDemoChallengeFailureDecision,
  type HomepageDemoChallengeFailureResult,
  type HomepageDemoTrialInputType,
  type HomepageDemoTrialStatus,
} from "@/lib/homepage-demo/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SHA_256_HASH_PATTERN = /^[0-9a-f]{64}$/;
const IP_IDENTITY_DIGEST_PATTERN = /^v[1-9][0-9]*:[0-9a-f]{64}$/;
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AdmitHomepageDemoTrialInput = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
  deviceTokenHash: string;
  ipIdentityDigest: string;
  idempotencyKeyHash: string;
  capacityLeaseToken: string;
  inputType: HomepageDemoTrialInputType;
}>;

export type RecordHomepageDemoChallengeFailureInput = Readonly<{
  ipIdentityDigest: string;
}>;

type SupabaseRpcError = Readonly<{
  message?: string | null;
}>;

type RepositoryInputRecord = Readonly<Record<string, unknown>>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;
type RepositoryInputDescriptors = ReadonlyMap<string, DataPropertyDescriptor>;

const AdmissionDecisionSchema: ZodType<HomepageDemoAdmissionDecision> =
  z.custom<HomepageDemoAdmissionDecision>((value) =>
    isOneOf(HOMEPAGE_DEMO_ADMISSION_DECISIONS, value)
  );

const ChallengeFailureDecisionSchema: ZodType<HomepageDemoChallengeFailureDecision> =
  z.custom<HomepageDemoChallengeFailureDecision>((value) =>
    isOneOf(HOMEPAGE_DEMO_CHALLENGE_FAILURE_DECISIONS, value)
  );

const TrialStatusSchema: ZodType<HomepageDemoTrialStatus> =
  z.custom<HomepageDemoTrialStatus>((value) =>
    isOneOf(HOMEPAGE_DEMO_TRIAL_STATUSES, value)
  );

const NullableTimestampSchema = z
  .union([z.string().refine(isValidTimestamp), z.null()])
  .transform((value) => (value === null ? null : new Date(value)));

const AdmissionRpcRowSchema = z
  .object({
    decision: AdmissionDecisionSchema,
    attempt_id: z.string().uuid().nullable(),
    trial_id: z.string().uuid().nullable(),
    trial_status: TrialStatusSchema.nullable(),
    trial_expires_at: NullableTimestampSchema,
    lease_expires_at: NullableTimestampSchema,
    idempotent: z.boolean(),
  })
  .strict();

type AdmissionRpcRow = z.infer<typeof AdmissionRpcRowSchema>;

const ChallengeFailureRpcRowSchema = z
  .object({
    decision: ChallengeFailureDecisionSchema,
    blocked: z.boolean(),
  })
  .strict();

const ADMISSION_DATABASE_ERROR_CODE_MAP: ReadonlyArray<
  readonly [string, HomepageDemoRepositoryErrorCode]
> = [
  ["HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT", "invalid_repository_input"],
  ["HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING", "admission_config_missing"],
  ["HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT", "idempotency_conflict"],
  ["HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION", "token_collision"],
  ["HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT", "admission_state_conflict"],
  ["HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE", "repository_unavailable"],
];

export async function admitHomepageDemoTrial(
  input: AdmitHomepageDemoTrialInput
): Promise<HomepageDemoAdmissionResult> {
  const {
    publicTokenHash,
    sessionTokenHash,
    deviceTokenHash,
    ipIdentityDigest,
    idempotencyKeyHash,
    capacityLeaseToken,
    inputType,
  } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      publicTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "publicTokenHash")
      ),
      sessionTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "sessionTokenHash")
      ),
      deviceTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "deviceTokenHash")
      ),
      ipIdentityDigest: validateIpIdentityDigest(
        readRepositoryInputProperty(inputRecord, "ipIdentityDigest")
      ),
      idempotencyKeyHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "idempotencyKeyHash")
      ),
      capacityLeaseToken: validateRawToken(
        readRepositoryInputProperty(inputRecord, "capacityLeaseToken")
      ),
      inputType: validateInputType(
        readRepositoryInputProperty(inputRecord, "inputType")
      ),
    };
  });

  const data = await callHomepageDemoAdmissionRpc("admit_homepage_demo_trial", {
    p_public_token_hash: publicTokenHash,
    p_session_token_hash: sessionTokenHash,
    p_device_token_hash: deviceTokenHash,
    p_ip_identity_digest: ipIdentityDigest,
    p_idempotency_key_hash: idempotencyKeyHash,
    p_capacity_lease_token_hash:
      hashHomepageDemoCapacityLeaseToken(capacityLeaseToken),
    p_input_type: inputType,
  });

  const row = parseAdmissionRpcRow(data);

  return {
    decision: row.decision,
    attemptId: row.attempt_id,
    trialId: row.trial_id,
    trialStatus: row.trial_status,
    trialExpiresAt: row.trial_expires_at,
    leaseExpiresAt: row.lease_expires_at,
    idempotent: row.idempotent,
  };
}

export async function recordHomepageDemoChallengeFailure(
  input: RecordHomepageDemoChallengeFailureInput
): Promise<HomepageDemoChallengeFailureResult> {
  const { ipIdentityDigest } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      ipIdentityDigest: validateIpIdentityDigest(
        readRepositoryInputProperty(inputRecord, "ipIdentityDigest")
      ),
    };
  });

  const data = await callHomepageDemoAdmissionRpc(
    "record_homepage_demo_challenge_failure",
    {
      p_ip_identity_digest: ipIdentityDigest,
    }
  );

  const row = parseSingleRpcRow(data, ChallengeFailureRpcRowSchema);

  if (
    (row.decision === "rate_limited" && row.blocked !== true) ||
    (row.decision !== "rate_limited" && row.blocked !== false)
  ) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return {
    decision: row.decision,
    blocked: row.blocked,
  };
}

async function callHomepageDemoAdmissionRpc(
  functionName:
    | "admit_homepage_demo_trial"
    | "record_homepage_demo_challenge_failure",
  params: Record<string, unknown>
): Promise<unknown> {
  try {
    const { data, error } = await supabaseAdmin.rpc(functionName, params);

    if (error) {
      throw mapAdmissionDatabaseError(error);
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

function parseAdmissionRpcRow(data: unknown): AdmissionRpcRow {
  const row = parseSingleRpcRow(data, AdmissionRpcRowSchema);

  if (!isValidAdmissionDecisionShape(row)) {
    throw new HomepageDemoRepositoryError("repository_unavailable");
  }

  return row;
}

function isValidAdmissionDecisionShape(row: AdmissionRpcRow): boolean {
  switch (row.decision) {
    case "demo_disabled":
    case "workload_disabled":
      return (
        row.attempt_id === null &&
        hasNoTrialFields(row) &&
        row.lease_expires_at === null &&
        row.idempotent === false
      );

    case "admitted":
      return (
        row.attempt_id !== null &&
        row.lease_expires_at !== null &&
        ((row.idempotent === false &&
          hasTrialFields(row, ["queued"])) ||
          (row.idempotent === true &&
            hasTrialFields(row, ["queued", "processing"])))
      );

    case "review_ready":
      return (
        row.attempt_id !== null &&
        hasTrialFields(row, ["review_ready"]) &&
        row.lease_expires_at === null &&
        row.idempotent === true
      );

    case "rate_limited":
    case "trial_already_used":
    case "capacity_unavailable":
    case "budget_unavailable":
      return (
        row.attempt_id !== null &&
        hasNoTrialFields(row) &&
        row.lease_expires_at === null
      );

    case "processing_failed":
      return (
        row.attempt_id !== null &&
        hasTrialFields(row, ["failed"]) &&
        row.lease_expires_at === null &&
        row.idempotent === true
      );

    case "trial_unavailable":
      return (
        row.attempt_id !== null &&
        hasTrialFields(row, ["blocked"]) &&
        row.lease_expires_at === null &&
        row.idempotent === true
      );

    case "expired":
      return (
        row.attempt_id !== null &&
        (hasNoTrialFields(row) || hasTrialFields(row, ["expired"])) &&
        row.lease_expires_at === null &&
        row.idempotent === true
      );
  }
}

function hasNoTrialFields(row: AdmissionRpcRow): boolean {
  return (
    row.trial_id === null &&
    row.trial_status === null &&
    row.trial_expires_at === null
  );
}

function hasTrialFields(
  row: AdmissionRpcRow,
  allowedStatuses: readonly HomepageDemoTrialStatus[]
): boolean {
  return (
    row.trial_id !== null &&
    row.trial_status !== null &&
    allowedStatuses.some((status) => status === row.trial_status) &&
    row.trial_expires_at !== null
  );
}

function mapAdmissionDatabaseError(
  error: SupabaseRpcError
): HomepageDemoRepositoryError {
  const message = typeof error.message === "string" ? error.message : "";
  const matchedError = ADMISSION_DATABASE_ERROR_CODE_MAP.find(
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

function validateTokenHash(value: unknown): string {
  if (typeof value !== "string" || !SHA_256_HASH_PATTERN.test(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateIpIdentityDigest(value: unknown): string {
  if (typeof value !== "string" || !IP_IDENTITY_DIGEST_PATTERN.test(value)) {
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

function validateInputType(value: unknown): HomepageDemoTrialInputType {
  if (!isOneOf(HOMEPAGE_DEMO_TRIAL_INPUT_TYPES, value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
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

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === "string" &&
    values.some((allowedValue) => allowedValue === value)
  );
}
