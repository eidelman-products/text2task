import { NextRequest, NextResponse } from "next/server";

import {
  HomepageDemoPublicRequestError,
  isHomepageDemoIdentityError,
  isHomepageDemoPublicRequestError,
  isHomepageDemoRepositoryError,
} from "@/lib/homepage-demo/errors";
import {
  getHomepageDemoDeviceCookiePolicy,
  getHomepageDemoSessionCookiePolicy,
} from "@/lib/homepage-demo/identity.server";
import { createHomepageDemoPublicExtractBootstrap } from "@/lib/homepage-demo/public-extract-identity.server";
import {
  assertHomepageDemoPublicExtractEnabled,
  readHomepageDemoPublicExtractRequestJson,
  validateHomepageDemoPublicRequestOrigin,
} from "@/lib/homepage-demo/public-extract-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = [
  ["Cache-Control", "no-store, no-cache, max-age=0, must-revalidate"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
] as const;

type BootstrapSuccessResponse = Readonly<{
  code: "bootstrap_ready";
  publicToken: string;
  idempotencyToken: string;
}>;

type BootstrapErrorResponse = Readonly<{
  code:
    | "not_found"
    | "invalid_request_origin"
    | "invalid_request_content_type"
    | "unsupported_request_encoding"
    | "request_body_too_large"
    | "invalid_request_body"
    | "invalid_request"
    | "temporarily_unavailable";
}>;

type BootstrapJsonResponse = BootstrapSuccessResponse | BootstrapErrorResponse;

export async function POST(request: NextRequest) {
  try {
    assertHomepageDemoPublicExtractEnabled();
    validateHomepageDemoPublicRequestOrigin({
      requestUrl: request.url,
      headers: request.headers,
    });

    const body = await readHomepageDemoPublicExtractRequestJson(request);
    validateExactEmptyBootstrapBody(body);

    const sessionPolicy = getHomepageDemoSessionCookiePolicy();
    const devicePolicy = getHomepageDemoDeviceCookiePolicy();
    const existingSessionCookie =
      request.cookies.get(sessionPolicy.name)?.value ?? null;
    const existingDeviceCookie =
      request.cookies.get(devicePolicy.name)?.value ?? null;
    const bootstrap = createHomepageDemoPublicExtractBootstrap({
      existingSessionCookie,
      existingDeviceCookie,
    });

    const response = NextResponse.json(
      {
        code: "bootstrap_ready",
        publicToken: bootstrap.publicToken,
        idempotencyToken: bootstrap.idempotencyToken,
      } satisfies BootstrapSuccessResponse,
      { status: 200 }
    );

    applyBootstrapResponseHeaders(response);

    for (const cookie of bootstrap.cookiesToSet) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch (error) {
    return mapBootstrapError(error);
  }
}

function validateExactEmptyBootstrapBody(value: unknown): void {
  if (!isNonArrayObject(value)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;

  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  if (prototype !== Object.prototype && prototype !== null) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  if (Reflect.ownKeys(descriptors).length !== 0) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }
}

function isNonArrayObject(value: unknown): value is object {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapBootstrapError(error: unknown): NextResponse<BootstrapErrorResponse> {
  if (isHomepageDemoPublicRequestError(error)) {
    switch (error.code) {
      case "homepage_demo_disabled":
        return createJsonResponse({ code: "not_found" }, 404);
      case "invalid_request_origin":
        return createJsonResponse({ code: "invalid_request_origin" }, 403);
      case "invalid_request_content_type":
        return createJsonResponse(
          { code: "invalid_request_content_type" },
          415
        );
      case "unsupported_request_encoding":
        return createJsonResponse(
          { code: "unsupported_request_encoding" },
          415
        );
      case "request_body_too_large":
        return createJsonResponse({ code: "request_body_too_large" }, 413);
      case "invalid_request_body":
        return createJsonResponse({ code: "invalid_request_body" }, 400);
    }
  }

  if (isHomepageDemoIdentityError(error)) {
    switch (error.code) {
      case "identity_input_invalid":
        return createJsonResponse({ code: "invalid_request" }, 400);
      case "identity_configuration_invalid":
      case "identity_unavailable":
        return createJsonResponse({ code: "temporarily_unavailable" }, 503);
    }
  }

  if (
    isHomepageDemoRepositoryError(error) &&
    error.code === "token_collision"
  ) {
    return createJsonResponse({ code: "temporarily_unavailable" }, 503);
  }

  return createJsonResponse({ code: "temporarily_unavailable" }, 503);
}

function createJsonResponse(
  body: BootstrapJsonResponse,
  status: number
): NextResponse<BootstrapErrorResponse> {
  const response = NextResponse.json(body, { status });

  applyBootstrapResponseHeaders(response);

  return response as NextResponse<BootstrapErrorResponse>;
}

function applyBootstrapResponseHeaders(response: NextResponse): void {
  for (const [name, value] of SECURITY_HEADERS) {
    response.headers.set(name, value);
  }

  response.headers.set("Content-Type", "application/json; charset=utf-8");
  mergeVaryHeader(response, ["Origin", "Cookie"]);
}

function mergeVaryHeader(response: NextResponse, requiredValues: string[]): void {
  const existingValues =
    response.headers
      .get("Vary")
      ?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];
  const lowerExistingValues = new Set(
    existingValues.map((value) => value.toLowerCase())
  );
  const mergedValues = [...existingValues];

  for (const value of requiredValues) {
    if (!lowerExistingValues.has(value.toLowerCase())) {
      mergedValues.push(value);
    }
  }

  response.headers.set("Vary", mergedValues.join(", "));
}
