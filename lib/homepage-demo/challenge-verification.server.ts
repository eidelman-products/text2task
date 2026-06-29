import "server-only";

import { isIP } from "node:net";

import { z } from "zod";

import {
  HOMEPAGE_DEMO_CHALLENGE_ACTION,
  HOMEPAGE_DEMO_CHALLENGE_TOKEN_MAX_LENGTH,
  type HomepageDemoChallengeVerificationResult,
} from "@/lib/homepage-demo/challenge";
import { HomepageDemoChallengeError } from "@/lib/homepage-demo/errors";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_SECRET_KEY_ENV = "HOMEPAGE_DEMO_TURNSTILE_SECRET_KEY";
const TURNSTILE_ALLOWED_HOSTNAMES_ENV =
  "HOMEPAGE_DEMO_TURNSTILE_ALLOWED_HOSTNAMES";
const TURNSTILE_SITEVERIFY_TIMEOUT_MS = 8000;
const TURNSTILE_SITEVERIFY_RESPONSE_MAX_BYTES = 16 * 1024;
const REMOTE_IP_MAX_LENGTH = 128;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/u;
const SAFE_HOSTNAME_LABEL_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const TurnstileSiteverifyResponseSchema = z
  .object({
    success: z.boolean(),
    challenge_ts: z.string().min(1).max(128).optional(),
    hostname: z.string().min(1).max(253).optional(),
    action: z.string().min(1).max(128).optional(),
    "error-codes": z.array(z.string().min(1).max(128)).max(32).optional(),
  })
  .strip();

type VerifyHomepageDemoChallengeInput = Readonly<{
  token: unknown;
  remoteIp?: string | null;
}>;

type TurnstileConfiguration = Readonly<{
  secret: string;
  allowedHostnames: ReadonlySet<string>;
}>;

type TurnstileSiteverifyResponse = z.infer<
  typeof TurnstileSiteverifyResponseSchema
>;

type InputRecord = Readonly<Record<string, unknown>>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;
type InputDescriptors = ReadonlyMap<string, DataPropertyDescriptor>;

export async function verifyHomepageDemoChallenge(
  input: VerifyHomepageDemoChallengeInput
): Promise<HomepageDemoChallengeVerificationResult> {
  const inputRecord = validateInputObject(input);
  const token = validateTurnstileToken(readInputProperty(inputRecord, "token"));
  const remoteIp = validateOptionalRemoteIp(
    readInputProperty(inputRecord, "remoteIp")
  );
  const configuration = getTurnstileConfiguration();
  const response = await callTurnstileSiteverify({
    secret: configuration.secret,
    token,
    remoteIp,
  });

  return evaluateTurnstileResponse(response, configuration.allowedHostnames);
}

function validateTurnstileToken(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > HOMEPAGE_DEMO_CHALLENGE_TOKEN_MAX_LENGTH ||
    value.trim() !== value ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new HomepageDemoChallengeError("invalid_challenge_input");
  }

  return value;
}

function validateOptionalRemoteIp(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HomepageDemoChallengeError("invalid_challenge_input");
  }

  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    trimmedValue.length > REMOTE_IP_MAX_LENGTH ||
    trimmedValue.includes(",") ||
    trimmedValue.includes("[") ||
    trimmedValue.includes("]") ||
    CONTROL_CHARACTER_PATTERN.test(trimmedValue) ||
    /\s/u.test(trimmedValue) ||
    isIP(trimmedValue) === 0
  ) {
    throw new HomepageDemoChallengeError("invalid_challenge_input");
  }

  return trimmedValue;
}

function getTurnstileConfiguration(): TurnstileConfiguration {
  const secret = process.env[TURNSTILE_SECRET_KEY_ENV]?.trim();

  if (!secret) {
    throw new HomepageDemoChallengeError("challenge_configuration_error");
  }

  return {
    secret,
    allowedHostnames: getAllowedHostnames(),
  };
}

function getAllowedHostnames(): ReadonlySet<string> {
  const rawValue = process.env[TURNSTILE_ALLOWED_HOSTNAMES_ENV];

  if (typeof rawValue !== "string") {
    throw new HomepageDemoChallengeError("challenge_configuration_error");
  }

  const entries = rawValue.split(",");
  const hostnames = new Set<string>();

  for (const entry of entries) {
    const hostname = normalizeConfiguredHostname(entry);

    hostnames.add(hostname);
  }

  if (hostnames.size === 0) {
    throw new HomepageDemoChallengeError("challenge_configuration_error");
  }

  return hostnames;
}

function normalizeConfiguredHostname(value: string): string {
  const hostname = value.trim().toLowerCase();

  if (!isValidHostname(hostname)) {
    throw new HomepageDemoChallengeError("challenge_configuration_error");
  }

  return hostname;
}

async function callTurnstileSiteverify({
  secret,
  token,
  remoteIp,
}: Readonly<{
  secret: string;
  token: string;
  remoteIp: string | null;
}>): Promise<TurnstileSiteverifyResponse> {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, TURNSTILE_SITEVERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: token,
        idempotency_key: crypto.randomUUID(),
        ...(remoteIp === null ? {} : { remoteip: remoteIp }),
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HomepageDemoChallengeError("challenge_verification_unavailable");
    }

    return await parseTurnstileSiteverifyResponse(response);
  } catch (error) {
    if (error instanceof HomepageDemoChallengeError) {
      throw error;
    }

    if (didTimeout) {
      throw new HomepageDemoChallengeError("challenge_verification_timeout");
    }

    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function parseTurnstileSiteverifyResponse(
  response: Response
): Promise<TurnstileSiteverifyResponse> {
  const responseText = await readBoundedTurnstileResponseText(response);

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(responseText);
  } catch {
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }

  const parsed = TurnstileSiteverifyResponseSchema.safeParse(parsedResponse);

  if (!parsed.success) {
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }

  return parsed.data;
}

async function readBoundedTurnstileResponseText(
  response: Response
): Promise<string> {
  await enforceContentLengthLimit(response);

  if (response.body === null) {
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!(value instanceof Uint8Array)) {
        throw new HomepageDemoChallengeError(
          "challenge_verification_unavailable"
        );
      }

      const nextTotalBytes = totalBytes + value.byteLength;

      if (nextTotalBytes > TURNSTILE_SITEVERIFY_RESPONSE_MAX_BYTES) {
        await cancelReader(reader);
        throw new HomepageDemoChallengeError(
          "challenge_verification_unavailable"
        );
      }

      chunks.push(value);
      totalBytes = nextTotalBytes;
    }
  } finally {
    reader.releaseLock();
  }

  return decodeBoundedUtf8Body(chunks, totalBytes);
}

async function enforceContentLengthLimit(response: Response): Promise<void> {
  const contentLength = response.headers.get("content-length");

  if (contentLength === null) {
    return;
  }

  if (!/^(0|[1-9]\d*)$/.test(contentLength)) {
    await cancelResponseBody(response);
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }

  const contentLengthBytes = Number(contentLength);

  if (
    !Number.isSafeInteger(contentLengthBytes) ||
    contentLengthBytes > TURNSTILE_SITEVERIFY_RESPONSE_MAX_BYTES
  ) {
    await cancelResponseBody(response);
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best-effort cleanup only; callers receive a sanitized verification error.
  }
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Best-effort cleanup only; callers receive a sanitized verification error.
  }
}

function decodeBoundedUtf8Body(
  chunks: readonly Uint8Array[],
  totalBytes: number
): string {
  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }
}

function evaluateTurnstileResponse(
  response: TurnstileSiteverifyResponse,
  allowedHostnames: ReadonlySet<string>
): HomepageDemoChallengeVerificationResult {
  if (!response.success) {
    return {
      verified: false,
      reason: "challenge_failed",
    };
  }

  if (
    response.hostname === undefined ||
    response.action === undefined ||
    response.challenge_ts === undefined ||
    !isValidIsoTimestamp(response.challenge_ts)
  ) {
    throw new HomepageDemoChallengeError("challenge_verification_unavailable");
  }

  const hostname = normalizeProviderHostname(response.hostname);

  if (
    hostname === null ||
    !allowedHostnames.has(hostname) ||
    response.action !== HOMEPAGE_DEMO_CHALLENGE_ACTION
  ) {
    return {
      verified: false,
      reason: "challenge_failed",
    };
  }

  return { verified: true };
}

function normalizeProviderHostname(value: string): string | null {
  const hostname = value.toLowerCase();

  return isValidHostname(hostname) ? hostname : null;
}

function isValidHostname(value: string): boolean {
  if (
    value.length < 1 ||
    value.length > 253 ||
    value !== value.trim() ||
    value.includes("://") ||
    value.includes("/") ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("@") ||
    value.includes(":") ||
    value.includes("*") ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    /\s/u.test(value)
  ) {
    return false;
  }

  if (value === "localhost") {
    return true;
  }

  const labels = value.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every((label) => SAFE_HOSTNAME_LABEL_PATTERN.test(label));
}

function isValidIsoTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);

  if (match === null) {
    return false;
  }

  const year = Number(readRegexPart(match, 1));
  const month = Number(readRegexPart(match, 2));
  const day = Number(readRegexPart(match, 3));
  const hour = Number(readRegexPart(match, 4));
  const minute = Number(readRegexPart(match, 5));
  const second = Number(readRegexPart(match, 6));
  const offset = readRegexPart(match, 7);

  if (
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > getDaysInMonth(year, month) ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    !Number.isInteger(second) ||
    second < 0 ||
    second > 59 ||
    !isValidTimezoneOffset(offset)
  ) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

function isValidTimezoneOffset(value: string): boolean {
  if (value === "Z") {
    return true;
  }

  const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);

  if (match === null) {
    return false;
  }

  const hour = Number(readRegexPart(match, 2));
  const minute = Number(readRegexPart(match, 3));

  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function readRegexPart(match: RegExpExecArray, index: number): string {
  return match[index] ?? "";
}

function validateInputObject(value: unknown): InputDescriptors {
  if (!isPlainObject(value)) {
    throw new HomepageDemoChallengeError("invalid_challenge_input");
  }

  const descriptors = getOwnPropertyDescriptors(value);

  if (descriptors === null) {
    throw new HomepageDemoChallengeError("invalid_challenge_input");
  }

  const capturedDescriptors = new Map<string, DataPropertyDescriptor>();

  for (const propertyKey of Reflect.ownKeys(descriptors)) {
    if (typeof propertyKey !== "string") {
      throw new HomepageDemoChallengeError("invalid_challenge_input");
    }

    const descriptor = descriptors[propertyKey];

    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new HomepageDemoChallengeError("invalid_challenge_input");
    }

    capturedDescriptors.set(propertyKey, descriptor);
  }

  return capturedDescriptors;
}

function readInputProperty(
  input: InputDescriptors,
  propertyName: string
): unknown {
  const descriptor = input.get(propertyName);

  if (descriptor === undefined) {
    return undefined;
  }

  return descriptor.value;
}

function isPlainObject(value: unknown): value is InputRecord {
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
