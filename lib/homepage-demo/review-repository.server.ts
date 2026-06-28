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
import {
  HOMEPAGE_DEMO_TRIAL_INPUT_TYPES,
  type HomepageDemoDraftStatus,
  type HomepageDemoTrialInputType,
  type HomepageDemoTrialStatus,
} from "@/lib/homepage-demo/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SHA_256_HASH_PATTERN = /^[0-9a-f]{64}$/;
const RAW_POSTGREST_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export type GetHomepageDemoReviewDraftInput = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
}>;

export type UpdateHomepageDemoReviewDraftInput = Readonly<{
  publicTokenHash: string;
  sessionTokenHash: string;
  editedResult: HomepageDemoJsonObject;
  expectedDraftUpdatedAt?: string | null;
}>;

export type HomepageDemoReviewDraft = Readonly<{
  trialId: string;
  draftId: string;
  inputType: HomepageDemoTrialInputType;
  trialStatus: Extract<HomepageDemoTrialStatus, "review_ready">;
  draftStatus: Extract<HomepageDemoDraftStatus, "ready">;
  normalizedResult: HomepageDemoJsonObject;
  editedResult: HomepageDemoJsonObject | null;
  expiresAt: Date;
  draftUpdatedAt: string;
}>;

export type UpdateHomepageDemoReviewDraftResult = Readonly<{
  trialId: string;
  draftId: string;
  draftStatus: Extract<HomepageDemoDraftStatus, "ready">;
  expiresAt: Date;
  draftUpdatedAt: string;
  changed: boolean;
}>;

type SupabaseRpcError = Readonly<{
  message?: string | null;
}>;

type RepositoryInputRecord = Readonly<Record<string, unknown>>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;
type RepositoryInputDescriptors = ReadonlyMap<string, DataPropertyDescriptor>;

const InputTypeSchema: ZodType<HomepageDemoTrialInputType> =
  z.custom<HomepageDemoTrialInputType>((value) =>
    isOneOf(HOMEPAGE_DEMO_TRIAL_INPUT_TYPES, value)
  );

const ReviewTrialStatusSchema: ZodType<
  Extract<HomepageDemoTrialStatus, "review_ready">
> = z.literal("review_ready");

const ReadyDraftStatusSchema: ZodType<
  Extract<HomepageDemoDraftStatus, "ready">
> = z.literal("ready");

const RawTimestampSchema = z
  .string()
  .refine(isValidRawPostgrestTimestamp);

const TimestampSchema = RawTimestampSchema.transform((value) => new Date(value));

const JsonObjectSchema: ZodType<HomepageDemoJsonObject> =
  z.custom<HomepageDemoJsonObject>(isHomepageDemoJsonObject);

const NullableJsonObjectSchema: ZodType<HomepageDemoJsonObject | null> =
  z.union([JsonObjectSchema, z.null()]);

const ReviewDraftRpcRowSchema = z
  .object({
    trial_id: z.string().uuid(),
    draft_id: z.string().uuid(),
    input_type: InputTypeSchema,
    trial_status: ReviewTrialStatusSchema,
    draft_status: ReadyDraftStatusSchema,
    normalized_result: JsonObjectSchema,
    edited_result: NullableJsonObjectSchema,
    expires_at: TimestampSchema,
    draft_updated_at: RawTimestampSchema,
  })
  .strict();

const ReviewDraftUpdateRpcRowSchema = z
  .object({
    trial_id: z.string().uuid(),
    draft_id: z.string().uuid(),
    draft_status: ReadyDraftStatusSchema,
    expires_at: TimestampSchema,
    draft_updated_at: RawTimestampSchema,
    changed: z.boolean(),
  })
  .strict();

const REVIEW_DATABASE_ERROR_CODE_MAP: ReadonlyArray<
  readonly [string, HomepageDemoRepositoryErrorCode]
> = [
  ["INVALID_HOMEPAGE_DEMO_ACCESS_HASH", "invalid_repository_input"],
  ["INVALID_HOMEPAGE_DEMO_EDITED_RESULT", "invalid_repository_input"],
  ["HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED", "review_access_denied"],
  ["HOMEPAGE_DEMO_REVIEW_EXPIRED", "review_expired"],
  ["HOMEPAGE_DEMO_REVIEW_NOT_READY", "review_not_ready"],
  ["HOMEPAGE_DEMO_REVIEW_EDIT_CONFLICT", "review_edit_conflict"],
];

export async function getHomepageDemoReviewDraft(
  input: GetHomepageDemoReviewDraftInput
): Promise<HomepageDemoReviewDraft> {
  const { publicTokenHash, sessionTokenHash } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      publicTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "publicTokenHash")
      ),
      sessionTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "sessionTokenHash")
      ),
    };
  });

  const data = await callHomepageDemoReviewRpc(
    "get_homepage_demo_review_draft",
    {
      p_public_token_hash: publicTokenHash,
      p_session_token_hash: sessionTokenHash,
    }
  );

  const row = parseSingleRpcRow(data, ReviewDraftRpcRowSchema);

  return {
    trialId: row.trial_id,
    draftId: row.draft_id,
    inputType: row.input_type,
    trialStatus: row.trial_status,
    draftStatus: row.draft_status,
    normalizedResult: row.normalized_result,
    editedResult: row.edited_result,
    expiresAt: row.expires_at,
    draftUpdatedAt: row.draft_updated_at,
  };
}

export async function updateHomepageDemoReviewDraft(
  input: UpdateHomepageDemoReviewDraftInput
): Promise<UpdateHomepageDemoReviewDraftResult> {
  const {
    publicTokenHash,
    sessionTokenHash,
    editedResult,
    expectedDraftUpdatedAt,
  } = validateLocalInput(() => {
    const inputRecord = validateRepositoryInputObject(input);

    return {
      publicTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "publicTokenHash")
      ),
      sessionTokenHash: validateTokenHash(
        readRepositoryInputProperty(inputRecord, "sessionTokenHash")
      ),
      editedResult: validateJsonObject(
        readRepositoryInputProperty(inputRecord, "editedResult")
      ),
      expectedDraftUpdatedAt: validateNullableRawTimestamp(
        readRepositoryInputProperty(inputRecord, "expectedDraftUpdatedAt")
      ),
    };
  });

  const data = await callHomepageDemoReviewRpc(
    "update_homepage_demo_review_draft",
    {
      p_public_token_hash: publicTokenHash,
      p_session_token_hash: sessionTokenHash,
      p_edited_result: editedResult,
      p_expected_updated_at: expectedDraftUpdatedAt,
    }
  );

  const row = parseSingleRpcRow(data, ReviewDraftUpdateRpcRowSchema);

  return {
    trialId: row.trial_id,
    draftId: row.draft_id,
    draftStatus: row.draft_status,
    expiresAt: row.expires_at,
    draftUpdatedAt: row.draft_updated_at,
    changed: row.changed,
  };
}

async function callHomepageDemoReviewRpc(
  functionName:
    | "get_homepage_demo_review_draft"
    | "update_homepage_demo_review_draft",
  params: Record<string, unknown>
): Promise<unknown> {
  try {
    const { data, error } = await supabaseAdmin.rpc(functionName, params);

    if (error) {
      throw mapReviewDatabaseError(error);
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

function mapReviewDatabaseError(
  error: SupabaseRpcError
): HomepageDemoRepositoryError {
  const message = typeof error.message === "string" ? error.message : "";
  const matchedError = REVIEW_DATABASE_ERROR_CODE_MAP.find(
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

function validateJsonObject(value: unknown): HomepageDemoJsonObject {
  if (!isHomepageDemoJsonObject(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function validateNullableRawTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !isValidRawPostgrestTimestamp(value)) {
    throw new HomepageDemoRepositoryError("invalid_repository_input");
  }

  return value;
}

function isValidRawPostgrestTimestamp(value: string): boolean {
  const match = RAW_POSTGREST_TIMESTAMP_PATTERN.exec(value);

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
