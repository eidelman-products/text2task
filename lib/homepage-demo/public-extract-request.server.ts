import "server-only";

import { z } from "zod";

import { HOMEPAGE_DEMO_CONFIG } from "@/lib/homepage-demo/config.server";
import {
  HomepageDemoPublicRequestError,
  isHomepageDemoPublicRequestError,
} from "@/lib/homepage-demo/errors";

export const HOMEPAGE_DEMO_PUBLIC_EXTRACT_REQUEST_MAX_BYTES = 65_536;

export type HomepageDemoPublicExtractRequest = Readonly<{
  text: unknown;
  challengeToken: string;
  publicToken: string;
  idempotencyToken: string;
}>;

export type HomepageDemoPublicRequestOriginInput = Readonly<{
  requestUrl: string;
  headers: Headers;
}>;

const PUBLIC_EXTRACT_REQUEST_KEYS = [
  "text",
  "challengeToken",
  "publicToken",
  "idempotencyToken",
] as const;

const PublicExtractTokenFieldsSchema = z
  .object({
    challengeToken: z.string(),
    publicToken: z.string(),
    idempotencyToken: z.string(),
  })
  .strict();

type PublicExtractRequestRecord = Record<
  (typeof PUBLIC_EXTRACT_REQUEST_KEYS)[number],
  unknown
>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;

export function assertHomepageDemoPublicExtractEnabled(): void {
  if (!HOMEPAGE_DEMO_CONFIG.enabled) {
    throw new HomepageDemoPublicRequestError("homepage_demo_disabled");
  }
}

export function validateHomepageDemoPublicRequestOrigin({
  requestUrl,
  headers,
}: HomepageDemoPublicRequestOriginInput): void {
  const requestOrigin = parseAbsoluteHttpOrigin(requestUrl);
  const originHeader = readRequiredSingleHeader(
    headers,
    "origin",
    "invalid_request_origin"
  );
  const origin = parseOriginHeader(originHeader);

  if (origin !== requestOrigin) {
    throw new HomepageDemoPublicRequestError("invalid_request_origin");
  }

  validateSecFetchSite(headers);
}

export async function readHomepageDemoPublicExtractRequestJson(
  request: Request
): Promise<unknown> {
  validateRequestContentHeaders(request.headers);
  enforceContentLengthLimit(request.headers);

  if (request.body === null) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  const bodyText = await readBoundedRequestBodyText(request.body);

  // Standard JSON.parse last-key-wins duplicate-key handling is accepted here;
  // strict schema validation below still rejects missing and unknown fields.
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }
}

export function parseHomepageDemoPublicExtractRequest(
  value: unknown
): HomepageDemoPublicExtractRequest {
  const record = validatePublicExtractRequestRecord(value);
  const parsed = PublicExtractTokenFieldsSchema.safeParse({
    challengeToken: record.challengeToken,
    publicToken: record.publicToken,
    idempotencyToken: record.idempotencyToken,
  });

  if (!parsed.success) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  return {
    text: record.text,
    challengeToken: parsed.data.challengeToken,
    publicToken: parsed.data.publicToken,
    idempotencyToken: parsed.data.idempotencyToken,
  };
}

function validateRequestContentHeaders(headers: Headers): void {
  validateContentType(headers);
  validateContentEncoding(headers);
}

function validateContentType(headers: Headers): void {
  const contentType = readRequiredSingleHeader(
    headers,
    "content-type",
    "invalid_request_content_type"
  );
  const parts = contentType.split(";").map((part) => part.trim());

  if (
    parts.length < 1 ||
    parts.some((part) => part.length === 0) ||
    parts[0]?.toLowerCase() !== "application/json"
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_content_type");
  }

  let hasCharset = false;

  for (const parameter of parts.slice(1)) {
    const parameterParts = parameter.split("=");

    if (parameterParts.length !== 2) {
      throw new HomepageDemoPublicRequestError("invalid_request_content_type");
    }

    const [rawName, rawValue] = parameterParts;
    const name = rawName?.trim().toLowerCase() ?? "";
    const value = rawValue?.trim().toLowerCase() ?? "";

    if (name !== "charset" || hasCharset || value !== "utf-8") {
      throw new HomepageDemoPublicRequestError("invalid_request_content_type");
    }

    hasCharset = true;
  }
}

function validateContentEncoding(headers: Headers): void {
  const contentEncoding = headers.get("content-encoding");

  if (contentEncoding === null) {
    return;
  }

  if (
    contentEncoding.includes(",") ||
    contentEncoding.trim().toLowerCase() !== "identity"
  ) {
    throw new HomepageDemoPublicRequestError("unsupported_request_encoding");
  }
}

function enforceContentLengthLimit(headers: Headers): void {
  const contentLength = headers.get("content-length");

  if (contentLength === null) {
    return;
  }

  const normalizedContentLength = contentLength.trim();

  if (
    normalizedContentLength !== contentLength ||
    !/^(0|[1-9]\d*)$/.test(normalizedContentLength)
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  const contentLengthBytes = Number(normalizedContentLength);

  if (!Number.isSafeInteger(contentLengthBytes)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  if (contentLengthBytes > HOMEPAGE_DEMO_PUBLIC_EXTRACT_REQUEST_MAX_BYTES) {
    throw new HomepageDemoPublicRequestError("request_body_too_large");
  }
}

async function readBoundedRequestBodyText(
  body: ReadableStream<Uint8Array>
): Promise<string> {
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
        throw new HomepageDemoPublicRequestError("invalid_request_body");
      }

      const nextTotalBytes = totalBytes + value.byteLength;

      if (
        !Number.isSafeInteger(nextTotalBytes) ||
        nextTotalBytes > HOMEPAGE_DEMO_PUBLIC_EXTRACT_REQUEST_MAX_BYTES
      ) {
        await cancelReader(reader);
        throw new HomepageDemoPublicRequestError("request_body_too_large");
      }

      chunks.push(value);
      totalBytes = nextTotalBytes;
    }
  } catch (error) {
    if (isHomepageDemoPublicRequestError(error)) {
      throw error;
    }

    throw new HomepageDemoPublicRequestError("invalid_request_body");
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  return decodeBoundedUtf8Body(chunks, totalBytes);
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Best-effort cleanup only; callers receive a sanitized request error.
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
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }
}

function validatePublicExtractRequestRecord(
  value: unknown
): PublicExtractRequestRecord {
  if (!isPlainObject(value)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  const descriptors = getOwnPropertyDescriptors(value);
  const propertyKeys = Reflect.ownKeys(descriptors);

  if (
    propertyKeys.length !== PUBLIC_EXTRACT_REQUEST_KEYS.length ||
    propertyKeys.some((key) => typeof key !== "string")
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  for (const key of PUBLIC_EXTRACT_REQUEST_KEYS) {
    const descriptor = descriptors[key];

    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new HomepageDemoPublicRequestError("invalid_request_body");
    }
  }

  return {
    text: descriptors.text.value,
    challengeToken: descriptors.challengeToken.value,
    publicToken: descriptors.publicToken.value,
    idempotencyToken: descriptors.idempotencyToken.value,
  };
}

function validateSecFetchSite(headers: Headers): void {
  const secFetchSite = headers.get("sec-fetch-site");

  if (secFetchSite === null) {
    return;
  }

  if (
    secFetchSite.length === 0 ||
    secFetchSite.trim() !== secFetchSite ||
    secFetchSite.includes(",") ||
    /\s/u.test(secFetchSite) ||
    secFetchSite.toLowerCase() !== "same-origin"
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_origin");
  }
}

function readRequiredSingleHeader(
  headers: Headers,
  headerName: string,
  errorCode:
    | "invalid_request_origin"
    | "invalid_request_content_type"
): string {
  const value = headers.get(headerName);

  if (
    value === null ||
    value.length === 0 ||
    value.trim() !== value ||
    value.includes(",")
  ) {
    throw new HomepageDemoPublicRequestError(errorCode);
  }

  return value;
}

function parseAbsoluteHttpOrigin(value: string): string {
  try {
    const url = new URL(value);

    if (
      !isSupportedHttpProtocol(url) ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new HomepageDemoPublicRequestError("invalid_request_origin");
  }
}

function parseOriginHeader(value: string): string {
  if (
    value === "null" ||
    !/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]+$/.test(value)
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_origin");
  }

  try {
    const url = new URL(value);

    if (
      !isSupportedHttpProtocol(url) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new HomepageDemoPublicRequestError("invalid_request_origin");
  }
}

function isSupportedHttpProtocol(url: URL): boolean {
  return url.protocol === "https:" || url.protocol === "http:";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
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

function getOwnPropertyDescriptors(value: object): PropertyDescriptorMap {
  try {
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
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
