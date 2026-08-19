import "server-only";

/**
 * Phase 3 -- public request-security boundary for the anonymous Client
 * Share surface (POST /api/share/session). Mirrors
 * lib/homepage-demo/public-extract-request.server.ts's exact structure
 * (Content-Type validation, Content-Length bound, bounded streaming body
 * read, Origin + Sec-Fetch-Site validation) -- this is the repository's
 * already-established public-request-security pattern, reapplied here
 * rather than reinvented, with Client-Share-scoped error codes.
 *
 * GET /api/share/[publicId]/projection is read-only, carries no request
 * body, and is authorized entirely by the HttpOnly session cookie -- it
 * does not need body/content-type validation, only the Origin/Sec-Fetch-
 * Site check, so this module's origin validator is reused by every public
 * route while the body-reading helpers are used only by routes that
 * accept a JSON body (the session-exchange route, and, since Phase 5B,
 * the message-submission route -- the latter passes its own larger
 * `maxBytes` to `readSharePublicRequestJson`, since a client message body
 * is far larger than an exchange request's secret/PIN payload).
 */

export const SHARE_PUBLIC_REQUEST_MAX_BYTES = 4_096;

/** Phase 5B -- a client message body may itself be up to 4000 Unicode
 * codepoints, which in the worst realistic case (every codepoint outside
 * the Basic Multilingual Plane, i.e. 4 UTF-8 bytes each) needs up to
 * ~16,000 raw bytes, plus an 80-codepoint display name (~320 bytes) and a
 * small amount of JSON structure/quoting overhead. 20,000 bytes leaves
 * comfortable headroom over that worst case while remaining a small,
 * bounded limit -- this is deliberately its own constant rather than a
 * widened `SHARE_PUBLIC_REQUEST_MAX_BYTES`, since the session-exchange
 * route's own tiny fixed-shape body (publicId/secret/pin) has no reason
 * to ever accept anything this large. */
export const SHARE_PUBLIC_MESSAGE_REQUEST_MAX_BYTES = 20_000;

export type SharePublicRequestErrorCode =
  | "invalid_request_origin"
  | "invalid_request_content_type"
  | "unsupported_request_encoding"
  | "request_body_too_large"
  | "invalid_request_body";

const ERROR_MESSAGES: Record<SharePublicRequestErrorCode, string> = {
  invalid_request_origin: "Client Share request origin is invalid.",
  invalid_request_content_type: "Client Share request content type is invalid.",
  unsupported_request_encoding: "Client Share request encoding is unsupported.",
  request_body_too_large: "Client Share request body is too large.",
  invalid_request_body: "Client Share request body is invalid.",
};

export class SharePublicRequestError extends Error {
  readonly code: SharePublicRequestErrorCode;

  constructor(code: SharePublicRequestErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "SharePublicRequestError";
    this.code = code;
  }
}

export function isSharePublicRequestError(
  error: unknown
): error is SharePublicRequestError {
  return error instanceof SharePublicRequestError;
}

export type SharePublicRequestOriginInput = Readonly<{
  requestUrl: string;
  headers: Headers;
}>;

/**
 * Requires the request's own Origin header to exactly equal the
 * request's own URL origin (never merely "in an allowlist"), and, when
 * Sec-Fetch-Site is present, requires it to read "same-origin". A
 * missing Sec-Fetch-Site is accepted (not every legitimate browser/
 * webview sends it -- Safari and several in-app webviews on iOS/Android
 * are known to omit it on some request paths), matching
 * validateHomepageDemoPublicRequestOrigin's own documented tolerance
 * exactly.
 */
export function validateSharePublicRequestOrigin({
  requestUrl,
  headers,
}: SharePublicRequestOriginInput): void {
  const requestOrigin = parseAbsoluteHttpOrigin(requestUrl);
  const originHeader = readRequiredSingleHeader(headers, "origin");
  const origin = parseOriginHeader(originHeader);

  if (origin !== requestOrigin) {
    throw new SharePublicRequestError("invalid_request_origin");
  }

  validateSecFetchSite(headers);
}

export async function readSharePublicRequestJson(
  request: Request,
  maxBytes: number = SHARE_PUBLIC_REQUEST_MAX_BYTES
): Promise<unknown> {
  validateContentType(request.headers);
  validateContentEncoding(request.headers);
  enforceContentLengthLimit(request.headers, maxBytes);

  if (request.body === null) {
    throw new SharePublicRequestError("invalid_request_body");
  }

  const bodyText = await readBoundedRequestBodyText(request.body, maxBytes);

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new SharePublicRequestError("invalid_request_body");
  }
}

function validateContentType(headers: Headers): void {
  const contentType = readRequiredSingleHeader(headers, "content-type");
  const parts = contentType.split(";").map((part) => part.trim());

  if (
    parts.length < 1 ||
    parts.some((part) => part.length === 0) ||
    parts[0]?.toLowerCase() !== "application/json"
  ) {
    throw new SharePublicRequestError("invalid_request_content_type");
  }

  let hasCharset = false;

  for (const parameter of parts.slice(1)) {
    const parameterParts = parameter.split("=");

    if (parameterParts.length !== 2) {
      throw new SharePublicRequestError("invalid_request_content_type");
    }

    const [rawName, rawValue] = parameterParts;
    const name = rawName?.trim().toLowerCase() ?? "";
    const value = rawValue?.trim().toLowerCase() ?? "";

    if (name !== "charset" || hasCharset || value !== "utf-8") {
      throw new SharePublicRequestError("invalid_request_content_type");
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
    throw new SharePublicRequestError("unsupported_request_encoding");
  }
}

function enforceContentLengthLimit(headers: Headers, maxBytes: number): void {
  const contentLength = headers.get("content-length");

  if (contentLength === null) {
    return;
  }

  const normalizedContentLength = contentLength.trim();

  if (
    normalizedContentLength !== contentLength ||
    !/^(0|[1-9]\d*)$/.test(normalizedContentLength)
  ) {
    throw new SharePublicRequestError("invalid_request_body");
  }

  const contentLengthBytes = Number(normalizedContentLength);

  if (!Number.isSafeInteger(contentLengthBytes)) {
    throw new SharePublicRequestError("invalid_request_body");
  }

  if (contentLengthBytes > maxBytes) {
    throw new SharePublicRequestError("request_body_too_large");
  }
}

async function readBoundedRequestBodyText(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
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
        throw new SharePublicRequestError("invalid_request_body");
      }

      const nextTotalBytes = totalBytes + value.byteLength;

      if (
        !Number.isSafeInteger(nextTotalBytes) ||
        nextTotalBytes > maxBytes
      ) {
        await cancelReader(reader);
        throw new SharePublicRequestError("request_body_too_large");
      }

      chunks.push(value);
      totalBytes = nextTotalBytes;
    }
  } catch (error) {
    if (isSharePublicRequestError(error)) {
      throw error;
    }

    throw new SharePublicRequestError("invalid_request_body");
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new SharePublicRequestError("invalid_request_body");
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
    throw new SharePublicRequestError("invalid_request_body");
  }
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
    throw new SharePublicRequestError("invalid_request_origin");
  }
}

function readRequiredSingleHeader(headers: Headers, headerName: string): string {
  const value = headers.get(headerName);

  if (
    value === null ||
    value.length === 0 ||
    value.trim() !== value ||
    value.includes(",")
  ) {
    throw new SharePublicRequestError(
      headerName === "content-type"
        ? "invalid_request_content_type"
        : "invalid_request_origin"
    );
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
    throw new SharePublicRequestError("invalid_request_origin");
  }
}

function parseOriginHeader(value: string): string {
  if (value === "null" || !/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]+$/.test(value)) {
    throw new SharePublicRequestError("invalid_request_origin");
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
    throw new SharePublicRequestError("invalid_request_origin");
  }
}

function isSupportedHttpProtocol(url: URL): boolean {
  return url.protocol === "https:" || url.protocol === "http:";
}
