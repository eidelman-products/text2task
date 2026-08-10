import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  saveShareConfigurationRequestSchema,
  shareLinkIdParamSchema,
  type ShareLinkApiErrorCode,
} from "@/lib/share/share-contracts";
import { saveShareConfiguration } from "@/lib/share/share-links-repository.server";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";

/**
 * Structured, safe error log: a fixed operation/stage plus a fixed
 * category only -- never `error.name`, and never the caught error's
 * message, stack, code, RPC payload, link id, project id, task ids,
 * Resource ids, subtitle, public labels, update body or any secret/PIN
 * material.
 */
function logShareLinksRouteError(stage: string, error: unknown): void {
  console.error("share_links_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

/**
 * Explicit no-store headers on every response branch, matching every
 * other share-link route (see app/api/share-links/[id]/activate/route.ts
 * for the full rationale).
 */
const SHARE_LINKS_NO_STORE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function errorResponse(code: ShareLinkApiErrorCode, error: string, status: number) {
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: SHARE_LINKS_NO_STORE_HEADERS }
  );
}

/**
 * Genuinely bounded request-body reading, matching the established
 * streaming pattern in
 * lib/homepage-demo/public-extract-request.server.ts's
 * readBoundedRequestBodyText (read before writing this). `req.json()`
 * alone would buffer the entire body before Zod ever runs, so a caller
 * could force an unbounded allocation regardless of the 500-item/text
 * limits the request schema enforces afterward -- this reads the body
 * incrementally through its own stream reader and rejects before ever
 * decoding or parsing once the byte budget is exceeded, so no more than
 * MAX_CONFIG_REQUEST_BODY_BYTES is ever buffered in memory.
 *
 * 512 KiB comfortably covers the largest valid Phase 1B.4 request (500
 * task items, 500 Resource items, maximum-length labels/subtitle/update
 * body, plus JSON structural overhead) while remaining a small, fixed
 * bound. A declared Content-Length above the limit is rejected before
 * any read begins, but Content-Length is never trusted as the only
 * check -- the actual streamed byte count is independently tracked and
 * enforced, which is what defeats a missing, false or understated
 * Content-Length header. Never logs, retains or forwards the raw body
 * text after parsing.
 */
const MAX_CONFIG_REQUEST_BODY_BYTES = 512 * 1024;

class BoundedRequestBodyError extends Error {
  constructor() {
    super("Request body could not be read within the configured bounds.");
    this.name = "BoundedRequestBodyError";
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
    throw new BoundedRequestBodyError();
  }

  const contentLengthBytes = Number(normalizedContentLength);

  if (!Number.isSafeInteger(contentLengthBytes)) {
    throw new BoundedRequestBodyError();
  }

  if (contentLengthBytes > MAX_CONFIG_REQUEST_BODY_BYTES) {
    throw new BoundedRequestBodyError();
  }
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Best-effort cleanup only; the caller already has a sanitized error.
  }
}

function decodeBoundedUtf8Body(
  chunks: readonly Uint8Array[],
  totalBytes: number
): string {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BoundedRequestBodyError();
  }
}

/**
 * Reads at most MAX_CONFIG_REQUEST_BODY_BYTES from the stream, tracking
 * the actual received byte count on every chunk (never trusting
 * Content-Length alone), cancelling the reader the instant the budget is
 * exceeded, and decoding only once the full bounded byte sequence has
 * been collected.
 */
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
        throw new BoundedRequestBodyError();
      }

      const nextTotalBytes = totalBytes + value.byteLength;

      if (
        !Number.isSafeInteger(nextTotalBytes) ||
        nextTotalBytes > MAX_CONFIG_REQUEST_BODY_BYTES
      ) {
        await cancelReader(reader);
        throw new BoundedRequestBodyError();
      }

      chunks.push(value);
      totalBytes = nextTotalBytes;
    }
  } catch (error) {
    if (error instanceof BoundedRequestBodyError) {
      throw error;
    }
    throw new BoundedRequestBodyError();
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new BoundedRequestBodyError();
  }

  return decodeBoundedUtf8Body(chunks, totalBytes);
}

async function readBoundedConfigRequestBody(req: NextRequest): Promise<unknown> {
  enforceContentLengthLimit(req.headers);

  if (req.body === null) {
    throw new BoundedRequestBodyError();
  }

  const bodyText = await readBoundedRequestBodyText(req.body);

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new BoundedRequestBodyError();
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    const { id } = await context.params;
    const parsedId = shareLinkIdParamSchema.safeParse({ id });

    if (!parsedId.success) {
      return errorResponse("INVALID_REQUEST", "id must be a valid uuid.", 400);
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
    }

    let body: unknown;
    try {
      body = await readBoundedConfigRequestBody(req);
    } catch {
      return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
    }

    const parsedBody = saveShareConfigurationRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return errorResponse(
        "INVALID_REQUEST",
        "Request body did not match the expected share configuration shape.",
        400
      );
    }

    const result = await saveShareConfiguration(
      supabase,
      parsedId.data.id,
      parsedBody.data
    );

    if (!result.ok) {
      switch (result.error.code) {
        case "UNAUTHORIZED":
          return errorResponse("UNAUTHENTICATED", "Unauthorized.", 401);
        case "SHARE_LINK_NOT_FOUND":
          return errorResponse("SHARE_LINK_NOT_FOUND", "Share link not found.", 404);
        case "PROJECT_ARCHIVED":
          return errorResponse("PROJECT_ARCHIVED", "Project is archived.", 409);
        case "SHARE_LINK_STATE_CONFLICT":
          return errorResponse(
            "SHARE_LINK_STATE_CONFLICT",
            "Share link configuration cannot be changed in its current state.",
            409
          );
        case "INVALID_REQUEST":
          return errorResponse(
            "INVALID_REQUEST",
            "Share configuration is invalid.",
            400
          );
        default:
          return errorResponse(
            "INTERNAL_ERROR",
            "Failed to save the share configuration.",
            500
          );
      }
    }

    return NextResponse.json(
      { ok: true, data: result.data },
      { headers: SHARE_LINKS_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }

    logShareLinksRouteError("share_links.config.save", error);

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to save the share configuration.",
      500
    );
  }
}
