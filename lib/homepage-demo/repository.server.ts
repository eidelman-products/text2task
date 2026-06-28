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
export type {
  HomepageDemoJsonObject,
  HomepageDemoJsonValue,
} from "@/lib/homepage-demo/json-validation";
import {
  HOMEPAGE_DEMO_DRAFT_STATUSES,
  HOMEPAGE_DEMO_RISK_STATES,
  HOMEPAGE_DEMO_TRIAL_INPUT_TYPES,
  HOMEPAGE_DEMO_TRIAL_STATUSES,
  type HomepageDemoDraftStatus,
  type HomepageDemoRiskState,
  type HomepageDemoTrialInputType,
  type HomepageDemoTrialStatus,
} from "@/lib/homepage-demo/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SHA_256_HASH_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const FAILURE_CODE_PATTERN = /^[a-z0-9_:-]{1,80}$/;

const PURGE_DEFAULT_LIMIT = 250;
const PURGE_MAX_LIMIT = 1000;

const ADVANCE_RISK_STATES = [
  "not_evaluated",
  "allowed",
  "challenge_required",
] as const;

export type HomepageDemoAdvanceRiskState =
  (typeof ADVANCE_RISK_STATES)[number];

export type HomepageDemoFailureStatus = Extract<
  HomepageDemoTrialStatus,
  "created" | "validating" | "queued" | "processing"
>;

export type HomepageDemoBlockableStatus = Extract<
  HomepageDemoTrialStatus,
  "created" | "validating"
>;

export type CreateHomepageDemoTrialRecordInput = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
  idempotencyKeyHash: string;
  inputType: HomepageDemoTrialInputType;
  expiresAt: Date | string;
}>;

export type AdvanceHomepageDemoTrialInput =
  | Readonly<{
      trialId: string;
      expectedStatus: "created";
      nextStatus: "validating";
      nextRiskState?: HomepageDemoAdvanceRiskState;
    }>
  | Readonly<{
      trialId: string;
      expectedStatus: "validating";
      nextStatus: "queued";
      nextRiskState?: HomepageDemoAdvanceRiskState;
    }>
  | Readonly<{
      trialId: string;
      expectedStatus: "queued";
      nextStatus: "processing";
      nextRiskState?: HomepageDemoAdvanceRiskState;
    }>;

export type CompleteHomepageDemoTrialInput = Readonly<{
  trialId: string;
  normalizedResult: HomepageDemoJsonObject;
  schemaVersion: string;
  engineVersion: string;
}>;

export type FailHomepageDemoTrialInput = Readonly<{
  trialId: string;
  expectedStatus: HomepageDemoFailureStatus;
  failureCode: string;
}>;

export type BlockHomepageDemoTrialInput = Readonly<{
  trialId: string;
  expectedStatus: HomepageDemoBlockableStatus;
  blockCode: string;
}>;

export type PurgeExpiredHomepageDemoTrialsInput = Readonly<{
  limit?: number | null;
}>;

export type HomepageDemoTrialRecordResult = Readonly<{
  trialId: string;
  status: HomepageDemoTrialStatus;
  riskState: HomepageDemoRiskState;
  expiresAt: Date;
}>;

export type CreateHomepageDemoTrialRecordResult =
  HomepageDemoTrialRecordResult &
    Readonly<{
      created: boolean;
    }>;

export type AdvanceHomepageDemoTrialResult = HomepageDemoTrialRecordResult &
  Readonly<{
    changed: boolean;
  }>;

export type CompleteHomepageDemoTrialResult = Readonly<{
  trialId: string;
  draftId: string;
  trialStatus: HomepageDemoTrialStatus;
  draftStatus: HomepageDemoDraftStatus;
  expiresAt: Date;
  created: boolean;
}>;

export type FailHomepageDemoTrialResult = HomepageDemoTrialRecordResult &
  Readonly<{
    changed: boolean;
  }>;

export type BlockHomepageDemoTrialResult = HomepageDemoTrialRecordResult &
  Readonly<{
    changed: boolean;
  }>;

type SupabaseRpcError = Readonly<{
  message?: string | null;
}>;

type RepositoryInputRecord = Readonly<Record<string, unknown>>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;
type RepositoryInputDescriptors = ReadonlyMap<string, DataPropertyDescriptor>;

type ValidatedAdvanceTransition = Readonly<{
  expectedStatus: "created" | "validating" | "queued";
  nextStatus: "validating" | "queued" | "processing";
}>;

const TrialStatusSchema: ZodType<HomepageDemoTrialStatus> =
  z.custom<HomepageDemoTrialStatus>((value) =>
    isOneOf(HOMEPAGE_DEMO_TRIAL_STATUSES, value)
  );

const RiskStateSchema: ZodType<HomepageDemoRiskState> =
  z.custom<HomepageDemoRiskState>((value) =>
    isOneOf(HOMEPAGE_DEMO_RISK_STATES, value)
  );

const DraftStatusSchema: ZodType<HomepageDemoDraftStatus> =
  z.custom<HomepageDemoDraftStatus>((value) =>
    isOneOf(HOMEPAGE_DEMO_DRAFT_STATUSES, value)
  );

const TimestampSchema = z
  .string()
  .refine(isValidTimestamp)
  .transform((value) => new Date(value));

const TrialRecordRpcRowSchema = z
  .object({
    trial_id: z.string().uuid(),
    status: TrialStatusSchema,
    risk_state: RiskStateSchema,
    expires_at: TimestampSchema,
    created: z.boolean(),
  })
  .strict();

const TrialTransitionRpcRowSchema = z
  .object({
    trial_id: z.string().uuid(),
    status: TrialStatusSchema,
    risk_state: RiskStateSchema,
    expires_at: TimestampSchema,
    changed: z.boolean(),
  })
  .strict();

const TrialCompletionRpcRowSchema = z
  .object({
    trial_id: z.string().uuid(),
    draft_id: z.string().uuid(),
    trial_status: TrialStatusSchema,
    draft_status: DraftStatusSchema,
    expires_at: TimestampSchema,
    created: z.boolean(),
  })
  .strict();

const PurgeCountRpcResponseSchema = z.number().int().min(0);

const DATABASE_ERROR_CODE_MAP: ReadonlyArray<
  readonly [string, HomepageDemoRepositoryErrorCode]
> = [
  ["INVALID_HOMEPAGE_DEMO_TOKEN_HASH", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_INPUT_TYPE", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_EXPIRY", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_TRIAL_ID", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_TRANSITION", "invalid_transition"],
  ["INVALID_HOMEPAGE_DEMO_RISK_STATE", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_RESULT", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_VERSION", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS", "invalid_transition"],
  ["INVALID_HOMEPAGE_DEMO_FAILURE_CODE", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_BLOCK_CODE", "invalid_repository_input"],
  ["HOMEPAGE_DEMO_TRIAL_NOT_FOUND", "trial_not_found"],
  ["HOMEPAGE_DEMO_TRIAL_EXPIRED", "trial_expired"],
  ["HOMEPAGE_DEMO_TRANSITION_CONFLICT", "invalid_transition"],
  ["HOMEPAGE_DEMO_TERMINAL_STATE", "invalid_transition"],
  ["HOMEPAGE_DEMO_RISK_BLOCKED", "risk_not_allowed"],
  ["HOMEPAGE_DEMO_RISK_NOT_ALLOWED", "risk_not_allowed"],
  ["HOMEPAGE_DEMO_IDEMPOTENCY_CONFLICT", "idempotency_conflict"],
  ["HOMEPAGE_DEMO_TOKEN_HASH_COLLISION", "token_collision"],
  ["HOMEPAGE_DEMO_COMPLETION_CONFLICT", "completion_conflict"],
  ["HOMEPAGE_DEMO_COMPLETION_INVALID_STATE", "invalid_transition"],
  ["HOMEPAGE_DEMO_DRAFT_CONFLICT", "draft_conflict"],
  ["HOMEPAGE_DEMO_FAILURE_CONFLICT", "failure_conflict"],
  ["HOMEPAGE_DEMO_BLOCK_CONFLICT", "block_conflict"],
];

export async function createHomepageDemoTrialRecord(
  input: CreateHomepageDemoTrialRecordInput
): Promise<CreateHomepageDemoTrialRecordResult> {
  const {
    publicTokenHash,
    sessionTokenHash,
    idempotencyKeyHash,
    inputType,
    expiresAt,
  } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      publicTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "publicTokenHash")
      ),
      sessionTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "sessionTokenHash")
      ),
      idempotencyKeyHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "idempotencyKeyHash")
      ),
      inputType: validateInputType(
        readRepositoryInputProperty(inputRecord, "inputType")
      ),
      expiresAt: validateFutureTimestamp(
        readRepositoryInputProperty(inputRecord, "expiresAt")
      ),
    };
  });

  const data = await callHomepageDemoRpc("create_homepage_demo_trial", {
    p_public_token_hash: publicTokenHash,
    p_session_token_hash: sessionTokenHash,
    p_idempotency_key_hash: idempotencyKeyHash,
    p_input_type: inputType,
    p_expires_at: expiresAt.toISOString(),
  });

  const row = parseSingleRpcRow(data, TrialRecordRpcRowSchema);

  return {
    trialId: row.trial_id,
    status: row.status,
    riskState: row.risk_state,
    expiresAt: row.expires_at,
    created: row.created,
  };
}

export async function advanceHomepageDemoTrial(
  input: AdvanceHomepageDemoTrialInput
): Promise<AdvanceHomepageDemoTrialResult> {
  const { trialId, expectedStatus, nextStatus, nextRiskState } =
    validateLocalInput(() => {
      const inputRecord = validateRepositoryInputObject(input);
      const transition = validateAdvanceTransition(
        readRepositoryInputProperty(inputRecord, "expectedStatus"),
        readRepositoryInputProperty(inputRecord, "nextStatus")
      );
      const rawNextRiskState = readRepositoryInputProperty(
        inputRecord,
        "nextRiskState"
      );

      return {
        trialId: validateUuid(
          readRepositoryInputProperty(inputRecord, "trialId")
        ),
        expectedStatus: transition.expectedStatus,
        nextStatus: transition.nextStatus,
        nextRiskState:
          rawNextRiskState === undefined
            ? null
            : validateAdvanceRiskState(rawNextRiskState),
      };
    });

  const data = await callHomepageDemoRpc("advance_homepage_demo_trial", {
    p_trial_id: trialId,
    p_expected_status: expectedStatus,
    p_next_status: nextStatus,
    p_next_risk_state: nextRiskState,
  });

  const row = parseSingleRpcRow(data, TrialTransitionRpcRowSchema);

  return {
    trialId: row.trial_id,
    status: row.status,
    riskState: row.risk_state,
    expiresAt: row.expires_at,
    changed: row.changed,
  };
}

export async function completeHomepageDemoTrial(
  input: CompleteHomepageDemoTrialInput
): Promise<CompleteHomepageDemoTrialResult> {
  const { trialId, normalizedResult, schemaVersion, engineVersion } =
    validateLocalInput(() => {
      const inputRecord = validateRepositoryInputObject(input);

      return {
        trialId: validateUuid(
          readRepositoryInputProperty(inputRecord, "trialId")
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

  const data = await callHomepageDemoRpc("complete_homepage_demo_trial", {
    p_trial_id: trialId,
    p_normalized_result: normalizedResult,
    p_schema_version: schemaVersion,
    p_engine_version: engineVersion,
  });

  const row = parseSingleRpcRow(data, TrialCompletionRpcRowSchema);

  return {
    trialId: row.trial_id,
    draftId: row.draft_id,
    trialStatus: row.trial_status,
    draftStatus: row.draft_status,
    expiresAt: row.expires_at,
    created: row.created,
  };
}

export async function failHomepageDemoTrial(
  input: FailHomepageDemoTrialInput
): Promise<FailHomepageDemoTrialResult> {
  const { trialId, expectedStatus, failureCode } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      trialId: validateUuid(readRepositoryInputProperty(inputRecord, "trialId")),
      expectedStatus: validateFailureStatus(
        readRepositoryInputProperty(inputRecord, "expectedStatus")
      ),
      failureCode: validateFailureCode(
        readRepositoryInputProperty(inputRecord, "failureCode")
      ),
    };
  });

  const data = await callHomepageDemoRpc("fail_homepage_demo_trial", {
    p_trial_id: trialId,
    p_expected_status: expectedStatus,
    p_failure_code: failureCode,
  });

  const row = parseSingleRpcRow(data, TrialTransitionRpcRowSchema);

  return {
    trialId: row.trial_id,
    status: row.status,
    riskState: row.risk_state,
    expiresAt: row.expires_at,
    changed: row.changed,
  };
}

export async function blockHomepageDemoTrial(
  input: BlockHomepageDemoTrialInput
): Promise<BlockHomepageDemoTrialResult> {
  const { trialId, expectedStatus, blockCode } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      trialId: validateUuid(readRepositoryInputProperty(inputRecord, "trialId")),
      expectedStatus: validateBlockableStatus(
        readRepositoryInputProperty(inputRecord, "expectedStatus")
      ),
      blockCode: validateFailureCode(
        readRepositoryInputProperty(inputRecord, "blockCode")
      ),
    };
  });

  const data = await callHomepageDemoRpc("block_homepage_demo_trial", {
    p_trial_id: trialId,
    p_expected_status: expectedStatus,
    p_block_code: blockCode,
  });

  const row = parseSingleRpcRow(data, TrialTransitionRpcRowSchema);

  return {
    trialId: row.trial_id,
    status: row.status,
    riskState: row.risk_state,
    expiresAt: row.expires_at,
    changed: row.changed,
  };
}

export async function purgeExpiredHomepageDemoTrials(
  input: PurgeExpiredHomepageDemoTrialsInput = {}
): Promise<number> {
  const limit = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return normalizePurgeLimit(
      readRepositoryInputProperty(inputRecord, "limit")
    );
  });

  const data = await callHomepageDemoRpc("purge_expired_homepage_demo_trials", {
    p_limit: limit,
  });

  const parsed = PurgeCountRpcResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return parsed.data;
}

async function callHomepageDemoRpc(
  functionName:
    | "create_homepage_demo_trial"
    | "advance_homepage_demo_trial"
    | "complete_homepage_demo_trial"
    | "fail_homepage_demo_trial"
    | "block_homepage_demo_trial"
    | "purge_expired_homepage_demo_trials",
  params: Record<string, unknown>
): Promise<unknown> {
  try {
    const { data, error } = await supabaseAdmin.rpc(functionName, params);

    if (error) {
      throw mapDatabaseError(error);
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
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  const parsed = schema.safeParse(data[0]);

  if (!parsed.success) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return parsed.data;
}

function mapDatabaseError(
  error: SupabaseRpcError
): HomepageDemoRepositoryError {
  const message = typeof error.message === "string" ? error.message : "";
  const matchedError = DATABASE_ERROR_CODE_MAP.find(([databaseMessage]) =>
    message.includes(databaseMessage)
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

function validateUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateInputType(
  value: unknown
): HomepageDemoTrialInputType {
  if (!isOneOf(HOMEPAGE_DEMO_TRIAL_INPUT_TYPES, value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateFutureTimestamp(value: unknown): Date {
  const expiresAt = toDate(value);

  if (expiresAt.getTime() <= Date.now()) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return expiresAt;
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

function validateFailureStatus(
  value: unknown
): HomepageDemoFailureStatus {
  if (!isOneOf(["created", "validating", "queued", "processing"], value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateBlockableStatus(
  value: unknown
): HomepageDemoBlockableStatus {
  if (!isOneOf(["created", "validating"], value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateAdvanceRiskState(
  value: unknown
): HomepageDemoAdvanceRiskState {
  if (!isOneOf(ADVANCE_RISK_STATES, value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateAdvanceTransition(
  expectedStatus: unknown,
  nextStatus: unknown
): ValidatedAdvanceTransition {
  if (expectedStatus === "created" && nextStatus === "validating") {
    return { expectedStatus, nextStatus };
  }

  if (expectedStatus === "validating" && nextStatus === "queued") {
    return { expectedStatus, nextStatus };
  }

  if (expectedStatus === "queued" && nextStatus === "processing") {
    return { expectedStatus, nextStatus };
  }

  throw new HomepageDemoRepositoryError("invalid_repository_input");
}

function validateJsonObject(value: unknown): HomepageDemoJsonObject {
  if (!isHomepageDemoJsonObject(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
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
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor &&
    descriptor.get === undefined &&
    descriptor.set === undefined
  );
}

function normalizePurgeLimit(limit: unknown): number {
  if (limit === undefined) {
    return PURGE_DEFAULT_LIMIT;
  }

  if (typeof limit !== "number" || !Number.isSafeInteger(limit)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  if (limit <= 0) {
    return PURGE_DEFAULT_LIMIT;
  }

  if (limit > PURGE_MAX_LIMIT) {
    return PURGE_MAX_LIMIT;
  }

  return limit;
}

function toDate(value: unknown): Date {
  if (!(value instanceof Date) && typeof value !== "string") {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (!isValidDate(parsedDate)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return parsedDate;
}

function isValidTimestamp(value: string): boolean {
  return isValidDate(new Date(value));
}

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
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
