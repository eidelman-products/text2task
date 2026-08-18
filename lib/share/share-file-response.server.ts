import "server-only";

/**
 * PHASE 4 SPIKE (not yet wired into any route). Response-safety helpers
 * for the eventual Client Share file-delivery endpoint: a safe
 * Content-Disposition filename built only from the owner-set, already
 * public-safe `public_label` (never the internal `file_name`), and a
 * classification of the existing upload MIME allowlist into
 * inline-safe vs. forced-download.
 */

const FALLBACK_FILENAME = "attachment";
const MAX_FILENAME_LENGTH = 100;
const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,8}$/i;

/**
 * Matches every C0 control character (0-31) plus DEL (127), built from
 * character codes rather than regex escape-sequence literals so the
 * source contains no literal control bytes of its own.
 */
const CONTROL_CHARACTER_PATTERN = new RegExp(
  "[" +
    Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join("") +
    String.fromCharCode(127) +
    "]",
  "g"
);

/**
 * Strips everything that could break out of a quoted HTTP header value or
 * inject a second header (CR/LF), plus characters that are meaningless or
 * actively misleading in a filename (path separators, quotes). Control
 * characters (including CR/LF) are removed outright rather than replaced,
 * so no combination of input can ever reintroduce a newline into the
 * final header value.
 */
function sanitizeFilenameSegment(label: string): string {
  return label
    .replace(CONTROL_CHARACTER_PATTERN, "")
    .replace(/["\\/]/g, "-")
    .trim();
}

const PRINTABLE_ASCII_MIN = 32;
const PRINTABLE_ASCII_MAX = 126;

/** ASCII-only projection for the legacy `filename=` parameter -- browsers
 * that don't honor `filename*=UTF-8''...` still get a safe, readable
 * fallback instead of mangled bytes. */
function toAsciiFallback(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code >= PRINTABLE_ASCII_MIN && code <= PRINTABLE_ASCII_MAX ? char : "_";
  }
  return result;
}

function safeExtension(extension: string | null): string {
  if (!extension) return "";
  return SAFE_EXTENSION_PATTERN.test(extension) ? `.${extension.toLowerCase()}` : "";
}

/**
 * Builds a complete, injection-safe `Content-Disposition` header value.
 * `canDownload: false` returns `"inline"` (no filename needed). `true`
 * returns an `attachment` value carrying both the RFC 6266 ASCII
 * `filename=` fallback and the RFC 5987 `filename*=UTF-8''...` form,
 * built only from `publicLabel` (owner-set, already public-safe) plus a
 * validated extension -- the internal `file_name` is never referenced by
 * this function and therefore cannot leak through it.
 */
export function buildContentDisposition(input: {
  publicLabel: string;
  canDownload: boolean;
  extension: string | null;
}): string {
  if (!input.canDownload) {
    return "inline";
  }

  const sanitized = sanitizeFilenameSegment(input.publicLabel);
  const base = (sanitized || FALLBACK_FILENAME).slice(0, MAX_FILENAME_LENGTH);
  const ext = safeExtension(input.extension);
  const fullName = `${base}${ext}`;

  const asciiName = toAsciiFallback(base) || FALLBACK_FILENAME;
  const asciiFull = `${asciiName}${ext}`;
  const encoded = encodeURIComponent(fullName);

  return `attachment; filename="${asciiFull}"; filename*=UTF-8''${encoded}`;
}

/**
 * Classification of the exact MIME allowlist enforced today by
 * app/api/task-resources/upload-and-create/route.ts. No type in the
 * current allowlist is active content (no HTML/SVG/XML/script/executable
 * is or has ever been accepted), so every entry is at worst "browser
 * won't render it inline anyway" -- there is no "C: must never be
 * shareable" type in the current product surface.
 */
export type InlineDeliveryClassification = "inline-safe" | "forced-attachment";

const INLINE_SAFE_MIME_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
]);

const FORCED_ATTACHMENT_MIME_TYPES = new Set<string>([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/** The exact MIME allowlist enforced today by
 * app/api/task-resources/upload-and-create/route.ts, mirrored here
 * rather than imported (that route does not export its constant) so
 * this module has its own explicit, auditable copy of what a
 * `task_resources.mime_type` value is allowed to legitimately be. */
const KNOWN_UPLOAD_MIME_TYPES = new Set<string>([
  ...INLINE_SAFE_MIME_TYPES,
  ...FORCED_ATTACHMENT_MIME_TYPES,
]);

/**
 * application/msword and the OOXML word/excel types have no native
 * browser viewer -- every mainstream browser downloads or hands them to
 * an external app regardless of Content-Disposition, so forcing
 * `attachment` for them removes ambiguity rather than changing user-
 * visible behavior.
 */
export function classifyMimeForInlineDelivery(mimeType: string): InlineDeliveryClassification {
  return INLINE_SAFE_MIME_TYPES.has(mimeType) ? "inline-safe" : "forced-attachment";
}

/**
 * The file-delivery route must never trust an arbitrary stored
 * `mime_type` value outside the audited upload allowlist (a legacy row,
 * a future allowlist change, or a tampered value could otherwise put an
 * unexpected value directly into a response header). Anything not in
 * `KNOWN_UPLOAD_MIME_TYPES` is served as `application/octet-stream`
 * instead of verbatim -- combined with the mandatory `nosniff` header,
 * this means the actual bytes are never reinterpreted by the browser
 * based on an unexpected declared type.
 */
export function resolveSafeMimeType(mimeType: string | null): string {
  if (!mimeType || !KNOWN_UPLOAD_MIME_TYPES.has(mimeType)) {
    return "application/octet-stream";
  }
  return mimeType;
}

/** Extracts a lowercase extension from an internal `file_name` for
 * `Content-Disposition` purposes only -- the extension alone (e.g.
 * "pdf") is not sensitive, unlike the full original filename, which
 * this function never returns. `resolveContentDisposition`'s own
 * `safeExtension` further validates the shape before use, so a
 * malformed/absent extension here safely degrades to no extension. */
export function extractExtension(fileName: string | null): string | null {
  if (!fileName) return null;
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0 || idx === fileName.length - 1) return null;
  return fileName.slice(idx + 1).toLowerCase();
}

/**
 * Resolves the final Content-Disposition for a request, combining the
 * owner's `canDownload` choice with the MIME-driven floor above: a type
 * with no inline browser viewer is always sent as `attachment`
 * regardless of `canDownload`, since "inline" would be meaningless for
 * it; an inline-safe type honors the owner's choice exactly.
 */
export function resolveContentDisposition(input: {
  mimeType: string;
  canDownload: boolean;
  publicLabel: string;
  extension: string | null;
}): string {
  const classification = classifyMimeForInlineDelivery(input.mimeType);
  const effectiveCanDownload =
    classification === "forced-attachment" ? true : input.canDownload;

  return buildContentDisposition({
    publicLabel: input.publicLabel,
    canDownload: effectiveCanDownload,
    extension: input.extension,
  });
}

/** Every response headers set from the file-delivery endpoint must
 * include these, regardless of MIME type -- nosniff prevents a browser
 * from ever re-interpreting a declared-safe type (e.g. text/plain) as
 * something executable (e.g. HTML) based on sniffed content, and the
 * sandbox CSP is free defense-in-depth against any active content a
 * browser's own inline viewer (e.g. a PDF reader) might otherwise be
 * able to reach the parent origin from. */
export const SHARE_FILE_RESPONSE_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox",
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
};

/**
 * PHASE 4 SPIKE ONLY -- proves the response-construction shape a real
 * route handler would use; not wired into any live route. Takes the
 * `ReadableStream` returned by
 * `supabaseAdmin.storage.from(bucket).download(path).asStream()` and
 * passes it straight through as the `Response` body with no intermediate
 * buffering step of any kind on this side -- the same `stream` reference
 * becomes the `Response`'s own body, so this function cannot itself
 * introduce a size ceiling, truncate, or materialize the file in memory.
 */
export function buildStreamedFileResponse(input: {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
  contentLength: number | null;
  contentDisposition: string;
}): Response {
  const headers = new Headers(SHARE_FILE_RESPONSE_SECURITY_HEADERS);
  headers.set("Content-Type", input.mimeType);
  headers.set("Content-Disposition", input.contentDisposition);
  if (input.contentLength !== null) {
    headers.set("Content-Length", String(input.contentLength));
  }

  return new Response(input.stream, { status: 200, headers });
}
