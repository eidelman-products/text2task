const HOMEPAGE_DEMO_OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type HomepageDemoClientResponseErrorCode =
  | "bootstrap_response_invalid"
  | "extract_response_invalid"
  | "invalid_byte_limit"
  | "invalid_content_length"
  | "response_body_empty"
  | "response_body_invalid"
  | "response_body_too_large"
  | "response_json_invalid";

export class HomepageDemoClientResponseError extends Error {
  readonly code: HomepageDemoClientResponseErrorCode;

  constructor(code: HomepageDemoClientResponseErrorCode) {
    super("Homepage Demo response could not be processed.");
    this.name = "HomepageDemoClientResponseError";
    this.code = code;
  }
}

export type HomepageDemoBootstrapClientResponse = Readonly<{
  code: "bootstrap_ready";
  publicToken: string;
  idempotencyToken: string;
}>;

export const HOMEPAGE_DEMO_EXTRACT_PUBLIC_RESPONSE_CODES = [
  "review_ready",
  "challenge_failed",
  "rate_limited",
  "not_found",
  "trial_already_used",
  "temporarily_unavailable",
  "processing_failed",
  "trial_unavailable",
  "expired",
  "invalid_request_origin",
  "invalid_request_content_type",
  "unsupported_request_encoding",
  "request_body_too_large",
  "invalid_request_body",
  "invalid_request",
  "invalid_challenge_input",
  "timeout",
  "invalid_text_input",
  "request_too_large",
  "extraction_failed",
  "request_conflict",
  "processing_conflict",
  "processing_cleanup_unavailable",
] as const;

export type HomepageDemoExtractPublicResponseCode =
  (typeof HOMEPAGE_DEMO_EXTRACT_PUBLIC_RESPONSE_CODES)[number];

export type HomepageDemoExtractClientResponse = Readonly<{
  code: HomepageDemoExtractPublicResponseCode;
}>;

type PlainRecord = Record<string, unknown>;
type DataPropertyDescriptor = PropertyDescriptor & Readonly<{ value: unknown }>;

export async function readHomepageDemoClientJsonResponse(
  response: Response,
  maxEncodedBytes: number
): Promise<unknown> {
  const maxBytes = validateMaxEncodedBytes(maxEncodedBytes);

  enforceContentLengthLimit(response.headers, maxBytes);

  const bytes =
    response.body === null
      ? await readFallbackArrayBuffer(response, maxBytes)
      : await readStreamBytes(response.body, maxBytes);

  if (bytes.byteLength === 0) {
    throw new HomepageDemoClientResponseError("response_body_empty");
  }

  const text = decodeUtf8(bytes);

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HomepageDemoClientResponseError("response_json_invalid");
  }
}

export function isHomepageDemoOpaqueToken(value: unknown): value is string {
  return typeof value === "string" && HOMEPAGE_DEMO_OPAQUE_TOKEN_PATTERN.test(value);
}

export function parseHomepageDemoBootstrapClientResponse(
  value: unknown
): HomepageDemoBootstrapClientResponse {
  const record = readExactPlainRecord(value, [
    "code",
    "publicToken",
    "idempotencyToken",
  ], "bootstrap_response_invalid");
  const code = record.code;
  const publicToken = record.publicToken;
  const idempotencyToken = record.idempotencyToken;

  if (
    code !== "bootstrap_ready" ||
    !isHomepageDemoOpaqueToken(publicToken) ||
    !isHomepageDemoOpaqueToken(idempotencyToken)
  ) {
    throw new HomepageDemoClientResponseError("bootstrap_response_invalid");
  }

  return {
    code,
    publicToken,
    idempotencyToken,
  };
}

export function parseHomepageDemoExtractClientResponse(
  value: unknown
): HomepageDemoExtractClientResponse {
  const record = readExactPlainRecord(value, ["code"], "extract_response_invalid");
  const code = record.code;

  if (!isHomepageDemoExtractPublicResponseCode(code)) {
    throw new HomepageDemoClientResponseError("extract_response_invalid");
  }

  return { code };
}

function validateMaxEncodedBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new HomepageDemoClientResponseError("invalid_byte_limit");
  }

  return value;
}

function enforceContentLengthLimit(headers: Headers, maxBytes: number): void {
  const contentLength = headers.get("content-length");

  if (contentLength === null) {
    return;
  }

  if (!/^(0|[1-9][0-9]*)$/.test(contentLength)) {
    throw new HomepageDemoClientResponseError("invalid_content_length");
  }

  const contentLengthBytes = Number(contentLength);

  if (!Number.isSafeInteger(contentLengthBytes) || contentLengthBytes > maxBytes) {
    throw new HomepageDemoClientResponseError("invalid_content_length");
  }
}

async function readStreamBytes(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!(value instanceof Uint8Array)) {
        await cancelReader(reader);
        throw new HomepageDemoClientResponseError("response_body_invalid");
      }

      const nextTotalBytes = totalBytes + value.byteLength;

      if (!Number.isSafeInteger(nextTotalBytes) || nextTotalBytes > maxBytes) {
        await cancelReader(reader);
        throw new HomepageDemoClientResponseError("response_body_too_large");
      }

      chunks.push(value);
      totalBytes = nextTotalBytes;
    }
  } catch (error) {
    if (error instanceof HomepageDemoClientResponseError) {
      throw error;
    }

    await cancelReader(reader);
    throw new HomepageDemoClientResponseError("response_body_invalid");
  } finally {
    reader.releaseLock();
  }

  return concatenateChunks(chunks, totalBytes);
}

async function readFallbackArrayBuffer(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  let buffer: ArrayBuffer;

  try {
    buffer = await response.arrayBuffer();
  } catch {
    throw new HomepageDemoClientResponseError("response_body_invalid");
  }

  if (buffer.byteLength > maxBytes) {
    throw new HomepageDemoClientResponseError("response_body_too_large");
  }

  return new Uint8Array(buffer);
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Best-effort cleanup only; callers receive a sanitized response error.
  }
}

function concatenateChunks(
  chunks: readonly Uint8Array[],
  totalBytes: number
): Uint8Array {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HomepageDemoClientResponseError("response_body_invalid");
  }
}

function readExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
  errorCode: Extract<
    HomepageDemoClientResponseErrorCode,
    "bootstrap_response_invalid" | "extract_response_invalid"
  >
): PlainRecord {
  if (!isPlainRecord(value)) {
    throw new HomepageDemoClientResponseError(errorCode);
  }

  let descriptors: PropertyDescriptorMap;

  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new HomepageDemoClientResponseError(errorCode);
  }

  const propertyKeys = Reflect.ownKeys(descriptors);

  if (
    propertyKeys.length !== expectedKeys.length ||
    propertyKeys.some((propertyKey) => typeof propertyKey !== "string")
  ) {
    throw new HomepageDemoClientResponseError(errorCode);
  }

  const record: PlainRecord = {};

  for (const key of expectedKeys) {
    const descriptor = descriptors[key];

    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new HomepageDemoClientResponseError(errorCode);
    }

    record[key] = descriptor.value;
  }

  return record;
}

function isPlainRecord(value: unknown): value is PlainRecord {
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

function isHomepageDemoExtractPublicResponseCode(
  value: unknown
): value is HomepageDemoExtractPublicResponseCode {
  return (
    typeof value === "string" &&
    HOMEPAGE_DEMO_EXTRACT_PUBLIC_RESPONSE_CODES.some((code) => code === value)
  );
}
