import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  logProductEventSafe,
  type LogProductEventResult,
} from "@/lib/activity/log-product-event.server";
import { createClient } from "@/lib/supabase/server";

/*
  POST /api/activity/product-event -- Phase 2 of the minimal authenticated
  activity layer (docs/TEXT2TASK_MINIMAL_AUTHENTICATED_ACTIVITY_MAPPING.md,
  docs/TEXT2TASK_AUTHENTICATED_ACTIVITY_PHASE2_IMPLEMENTATION_REPORT.md).

  NOT YET CALLED FROM ANY APPLICATION PAGE -- this route is inert in
  production until Phase 3 explicitly instruments a UI surface to call it.
  It exists in the build (Next.js always builds every route under app/api)
  but nothing references it.

  Every check below is ordered cheapest-and-safest-first, so an
  unauthenticated or malformed caller is rejected before any expensive work
  (body read, JSON parse, database call) happens: content type -> declared
  content length -> authentication -> body read/size/parse -> envelope
  shape -> the server logger's own deep event/navigationId validation and
  insert. This route never accepts a user id, email, or any other identity
  claim from the request body -- the authenticated user id always comes
  from the real server-side Supabase session
  (lib/supabase/server.ts::createClient(), the same helper
  lib/supabase/requireDashboardUser.ts and every authenticated API route in
  this repository already uses), matching the established convention in
  e.g. app/api/calendar/events/route.ts.
*/

export const dynamic = "force-dynamic";

/** 4 KB -- generous for this payload's shape (a handful of short fields),
 *  small enough to reject abuse outright. Measured in UTF-16 code units via
 *  `.length`, matching this repository's own established convention
 *  (app/api/analytics/event/route.ts's MAX_BODY_CHARS) rather than a
 *  precise byte count -- for the ASCII-only JSON this endpoint accepts the
 *  two are effectively identical. */
const MAX_BODY_CHARS = 4096;

/*
  Only the OUTER envelope shape is validated here (exactly two required
  keys, no more). `event`'s own deep content (event name, route, entity
  type/id) and `navigationId`'s UUID format are both deliberately
  re-validated inside logProductEventSafe() -- see that module's own
  comment for why: it must stay safe to call from any future trusted
  caller on its own, not just this one route, so it never trusts that an
  HTTP-layer caller already validated its input. Keeping that validation
  in exactly one place (the logger) avoids two schemas drifting apart.
*/
const RequestEnvelopeSchema = z
  .object({
    event: z.record(z.string(), z.unknown()),
    navigationId: z.string(),
  })
  .strict();

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

function hasJsonContentType(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  return mediaType === "application/json";
}

function isOversizedByContentLength(request: NextRequest): boolean {
  const header = request.headers.get("content-length");
  if (!header) {
    return false;
  }

  const contentLength = Number(header);
  return Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS;
}

type ReadBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413 };

async function readJsonRequestBody(
  request: NextRequest
): Promise<ReadBodyResult> {
  const text = await request.text();

  if (text.length > MAX_BODY_CHARS) {
    return { ok: false, status: 413 };
  }

  if (!text) {
    return { ok: false, status: 400 };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}

function assertNeverResultStatus(value: never): NextResponse {
  console.error("Unhandled authenticated product event result status:", {
    status: String(value),
  });
  return errorResponse(503, "Could not record this event.");
}

function respondForLoggerResult(result: LogProductEventResult): NextResponse {
  switch (result.status) {
    case "recorded":
    case "duplicate":
      return noContent();
    case "rejected":
      return errorResponse(400, "Invalid request body.");
    case "failed":
      return errorResponse(503, "Could not record this event.");
    default:
      return assertNeverResultStatus(result);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasJsonContentType(request)) {
      return errorResponse(415, "Unsupported content type.");
    }

    if (isOversizedByContentLength(request)) {
      return errorResponse(413, "Request body too large.");
    }

    // Authentication is resolved before the body is read/parsed, so an
    // unauthenticated caller is rejected as cheaply as possible -- no JSON
    // parsing or validation work is ever done on behalf of a request that
    // will be discarded for lack of a session anyway.
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse(401, "Unauthorized.");
    }

    const bodyResult = await readJsonRequestBody(request);
    if (!bodyResult.ok) {
      return errorResponse(
        bodyResult.status,
        bodyResult.status === 413
          ? "Request body too large."
          : "Invalid request body."
      );
    }

    const envelope = RequestEnvelopeSchema.safeParse(bodyResult.body);
    if (!envelope.success) {
      return errorResponse(400, "Invalid request body.");
    }

    const result = await logProductEventSafe({
      userId: user.id,
      navigationId: envelope.data.navigationId,
      event: envelope.data.event,
    });

    return respondForLoggerResult(result);
  } catch (error) {
    console.error(
      "Authenticated product event route failed unexpectedly:",
      {
        message: error instanceof Error ? error.message : "Unknown error",
      }
    );

    return errorResponse(500, "Could not record this event.");
  }
}
