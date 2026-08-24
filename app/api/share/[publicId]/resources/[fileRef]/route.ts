import { NextRequest, NextResponse } from "next/server";

import {
  isFileResource,
  isNoteResource,
  type TaskResource,
} from "@/app/components/dashboard/resources/resource-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  assertClientShareEnabled,
  isShareAvailabilityError,
} from "@/lib/share/share-availability.server";
import {
  getShareBrowserSessionCookiePolicy,
  hashShareBrowserSessionSecret,
  isValidRawShareBrowserSessionSecret,
} from "@/lib/share/share-browser-session.server";
import {
  extractExtension,
  resolveContentDisposition,
  resolveSafeMimeType,
  buildStreamedFileResponse,
} from "@/lib/share/share-file-response.server";
import {
  isPlausibleShareFileRef,
  matchShareFileRef,
} from "@/lib/share/share-file-ref.server";
import { checkShareRateLimit } from "@/lib/share/share-rate-limit.server";
import { isValidSharePublicId } from "@/lib/share/share-public-id.server";
import { isRejectableCrossSiteRequest } from "@/lib/share/share-request-security.server";
import { verifyShareProjectionAuthorization } from "@/lib/share/share-session-grant.server";

/*
  Phase 4B -- GET /api/share/[publicId]/resources/[fileRef]. The public,
  session-authorized FILE-delivery endpoint. Mirrors
  /api/share/[publicId]/projection/route.ts's exact authorization
  scaffolding (feature flag, same-origin defense, publicId validation,
  cookie read, rate limit, verifyShareProjectionAuthorization) and adds
  the file-specific steps on top: resolve the caller-supplied fileRef to
  an internal resourceId ONLY within this link's own already-authorized
  mapped-resource set, independently re-verify the resolved resource is
  still a live, owner-approved FILE (never trusting the mapping table
  alone), then stream the object bytes directly from the private
  "task-resources" bucket via the service-role client's `.asStream()` --
  never a signed URL, never a redirect to Supabase Storage, never the
  storage_path itself, in the response body, headers, or any error path.

  Every authorization/resource failure returns the exact same generic
  "unavailable" response regardless of cause (AGENTS.md rule 10) -- a
  caller cannot distinguish "wrong fileRef" from "file unshared" from
  "link revoked" from "resource is a Note".
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()",
};

type FileRouteErrorResponse = { ok: false; code: string; error: string };

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

/**
 * PHASE 4B DEFECT #2 DIAGNOSTICS -- every denial path returns the exact
 * same public response (AGENTS.md rule 10: a caller must never be able
 * to distinguish "wrong fileRef" from "file unshared" from "link
 * revoked" from "resource is a Note" from "storage object missing").
 * That deliberate indistinguishability made the real-Preview retest that
 * surfaced Defect #2 unable to tell which of ~13 possible branches
 * actually fired from the public response alone -- exactly the gap this
 * parameter closes. `stage` is a fixed, low-cardinality identifier only
 * (see the STAGE TAG VOCABULARY comment below); it is logged
 * server-side ONLY (Vercel function logs), never echoed to the client in
 * any form. It never carries the fileRef, resourceId, shareLinkId,
 * projectId, userId, storage_path, file_name, the cookie, or any other
 * value that varies per request -- only the fixed stage name itself, so
 * no combination of these log lines can reconstruct which requester hit
 * which resource.
 *
 * STAGE TAG VOCABULARY (every value this parameter is ever called with):
 *   public_id_invalid, file_ref_invalid, cookie_missing_or_invalid,
 *   session_digest_failed, authorization_failed, mapping_lookup_failed,
 *   file_ref_no_match, mapping_row_missing (structurally unreachable),
 *   resource_lookup_failed, resource_not_found, project_scope_failed,
 *   resource_not_file, storage_stream_open_failed.
 */
function genericUnavailable(stage: string): NextResponse {
  console.error("share_file_stage", { stage, result: "unavailable" });

  return jsonResponse(
    { ok: false, code: "UNAVAILABLE", error: "This file is not available." } satisfies FileRouteErrorResponse,
    401
  );
}

function rateLimited(retryAfterSeconds: number): NextResponse {
  return jsonResponse(
    {
      ok: false,
      code: "RATE_LIMITED",
      error: "Too many requests. Please try again shortly.",
    } satisfies FileRouteErrorResponse,
    429,
    { "Retry-After": String(retryAfterSeconds) }
  );
}

/** Safe stage tags only -- never the cookie, PIN, secrets, storage_path,
 * or a fileRef alongside the internal resource it resolved to. */
function logShareFileRouteError(stage: string, error: unknown): void {
  console.error("share_public_file_route_error", {
    stage,
    category: error instanceof Error ? "Error" : "UnknownThrownValue",
  });
}

const STORAGE_BUCKET = "task-resources";

type ShareLinkResourceMappingRow = {
  resource_id: string;
  public_label: string;
  can_download: boolean;
};

type TaskResourceDeliveryRow = {
  id: string;
  resource_type: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  project_id: string | null;
};

type RouteContext = { params: Promise<{ publicId: string; fileRef: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertClientShareEnabled();

    if (isRejectableCrossSiteRequest(request.headers)) {
      console.error("share_file_stage", { stage: "cross_site_rejected", result: "invalid_origin" });
      return jsonResponse(
        { ok: false, code: "INVALID_ORIGIN", error: "Invalid request origin." } satisfies FileRouteErrorResponse,
        403
      );
    }

    const { publicId, fileRef } = await context.params;

    if (!isValidSharePublicId(publicId)) {
      return genericUnavailable("public_id_invalid");
    }

    if (!isPlausibleShareFileRef(fileRef)) {
      return genericUnavailable("file_ref_invalid");
    }

    const cookiePolicy = getShareBrowserSessionCookiePolicy();
    const cookieValue = request.cookies.get(cookiePolicy.name)?.value ?? null;

    if (cookieValue === null || !isValidRawShareBrowserSessionSecret(cookieValue)) {
      return genericUnavailable("cookie_missing_or_invalid");
    }

    let sessionDigest: string;
    try {
      sessionDigest = hashShareBrowserSessionSecret(cookieValue);
    } catch {
      return genericUnavailable("session_digest_failed");
    }

    // Phase 7B -- uses the dedicated `file_access` rate-limit action the
    // schema always reserved (202608030004) but no route wired until now.
    // A file fetch is materially more expensive to serve than a small
    // JSON projection read, so it gets its own, tighter budget rather
    // than sharing `projection_read`'s bucket -- see
    // lib/share/share-rate-limit.server.ts's own policy comment for the
    // full rationale, including the equivalent-control argument against a
    // separate aggregate-byte quota.
    const readLimit = await checkShareRateLimit({
      action: "file_access",
      scope: "browser_session",
      identityDigest: sessionDigest,
      identityDigestVersion: 1,
    });

    if (!readLimit.allowed) {
      console.error("share_file_stage", { stage: "rate_limited", result: "rate_limited" });
      return rateLimited(readLimit.retryAfterSeconds);
    }

    const authorization = await verifyShareProjectionAuthorization({
      cookieValue,
      publicId,
    });

    if (!authorization) {
      return genericUnavailable("authorization_failed");
    }

    const { shareLinkId, projectId, userId } = authorization;

    // Step 9-11: resolve fileRef ONLY within this link's own mapped
    // resource set -- never trusts the fileRef alone, never looks it up
    // globally.
    const { data: mappingRows, error: mappingError } = await supabaseAdmin
      .from("share_link_resources")
      .select("resource_id, public_label, can_download")
      .eq("share_link_id", shareLinkId)
      .eq("user_id", userId);

    if (mappingError) {
      logShareFileRouteError("mapping_lookup", mappingError);
      return genericUnavailable("mapping_lookup_failed");
    }

    const mappings = (mappingRows as ShareLinkResourceMappingRow[] | null) ?? [];
    const mappedResourceIds = mappings.map((row) => row.resource_id);
    // console.info, not console.error: a successful lookup on a healthy
    // request is not an error-level event -- see this route's own
    // diagnostics retain/remove note (Phase 4 audit doc) for why these
    // stage tags were kept at all and right-sized by level.
    console.info("share_file_stage", { stage: "mapping_lookup_ok", mappedCount: mappings.length });

    const resolvedResourceId = matchShareFileRef(fileRef, shareLinkId, mappedResourceIds);
    if (!resolvedResourceId) {
      return genericUnavailable("file_ref_no_match");
    }

    const mapping = mappings.find((row) => row.resource_id === resolvedResourceId);
    if (!mapping) {
      // Structurally unreachable (matchShareFileRef only ever returns an
      // id drawn from `mappedResourceIds`), kept as a hard fail-closed
      // guard rather than assumed.
      return genericUnavailable("mapping_row_missing");
    }

    // Step 12-15: independently re-fetch and re-classify -- never trusts
    // the mapping table alone as proof this is a deliverable file.
    const { data: resourceRow, error: resourceError } = await supabaseAdmin
      .from("task_resources")
      .select("id, resource_type, url, storage_path, file_name, mime_type, project_id")
      .eq("id", resolvedResourceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (resourceError) {
      logShareFileRouteError("resource_lookup", resourceError);
      return genericUnavailable("resource_lookup_failed");
    }

    if (!resourceRow) {
      return genericUnavailable("resource_not_found");
    }

    const row = resourceRow as unknown as TaskResourceDeliveryRow;

    // Defense-in-depth re-check of project attribution, mirroring what
    // enforce_share_link_resource_integrity already guarantees at
    // mapping-write time -- re-verified live rather than trusted from
    // write time alone.
    if (row.project_id !== null && row.project_id !== projectId) {
      return genericUnavailable("project_scope_failed");
    }

    const asTaskResource = {
      resource_type: row.resource_type,
      url: row.url,
      storage_path: row.storage_path,
      file_name: row.file_name,
    } as unknown as TaskResource;

    if (isNoteResource(asTaskResource) || !isFileResource(asTaskResource) || !row.storage_path) {
      return genericUnavailable("resource_not_file");
    }

    // Step 16: obtain the private object ONLY server-side, as a true
    // pass-through stream -- never the buffered `.download()` default,
    // never `.createSignedUrl()`, never a redirect to Supabase Storage.
    const { data: stream, error: downloadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(row.storage_path)
      .asStream();

    if (downloadError || !stream) {
      // Beyond the fixed stage tag, also logs Supabase Storage's own
      // generic error `message` (e.g. "Object not found", "Bucket not
      // found") -- this is Supabase's own coarse, low-cardinality error
      // taxonomy, never the storage_path/resourceId/fileRef that would
      // identify WHICH object was being requested, so it stays within
      // the same safe-diagnostics bound as every other stage tag while
      // directly distinguishing "wrong path/object missing" from "bucket
      // missing" from "permission denied" -- the exact ambiguity a bare
      // stage tag alone could not resolve for this specific failure mode.
      logShareFileRouteError("storage_download", downloadError);
      console.error("share_file_stage", {
        stage: "storage_stream_open_failed",
        storageErrorMessage:
          downloadError && typeof downloadError === "object" && "message" in downloadError
            ? String((downloadError as { message: unknown }).message)
            : null,
      });
      return genericUnavailable("storage_stream_open_failed");
    }

    const safeMimeType = resolveSafeMimeType(row.mime_type);
    const extension = extractExtension(row.file_name);
    const contentDisposition = resolveContentDisposition({
      mimeType: safeMimeType,
      canDownload: mapping.can_download,
      publicLabel: mapping.public_label,
      extension,
    });

    console.info("share_file_stage", { stage: "stream_response_started", result: "ok" });

    // Content-Length is deliberately omitted: `.asStream()` never
    // materializes the object, so no byte count is available here that
    // is provably authoritative for the stream actually being sent --
    // stored `size_bytes` is a separate, independently-writable column,
    // not a guarantee about this exact object today. Streaming
    // correctness matters more than supplying this optional header.
    return buildStreamedFileResponse({
      stream,
      mimeType: safeMimeType,
      contentLength: null,
      contentDisposition,
    });
  } catch (error) {
    if (isShareAvailabilityError(error)) {
      return jsonResponse(
        { ok: false, code: "NOT_FOUND", error: "Not found." } satisfies FileRouteErrorResponse,
        404
      );
    }

    logShareFileRouteError("share.file.read", error);

    return jsonResponse(
      { ok: false, code: "INTERNAL_ERROR", error: "Something went wrong." } satisfies FileRouteErrorResponse,
      500
    );
  }
}
