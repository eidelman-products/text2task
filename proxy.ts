import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH,
  parseHomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";

const HOMEPAGE_DEMO_REVIEW_PAGE_HEADERS = [
  ["Cache-Control", "no-store, no-cache, max-age=0, must-revalidate"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Robots-Tag", "noindex, nofollow, noarchive"],
] as const;

/**
 * Phase 3 -- the public, no-login Client Share page's own security
 * baseline. Mirrors the /homepage-demo/review precedent above exactly
 * (page routes get proxy-level headers here; the sibling public API
 * routes under /api/share/** set their own no-store/Referrer-Policy/
 * nosniff/X-Robots-Tag/Permissions-Policy headers directly in each route
 * handler instead, matching how /api/homepage-demo/review passes through
 * untouched below). The CSP is
 * deliberately minimal -- only frame-ancestors/object-src/base-uri -- and
 * does not lock down script-src/style-src, which would require a
 * nonce-based rewrite of Next.js's own script injection; that is
 * explicitly the later, already-planned full hardening phase's work, not
 * this one's.
 */
export const SHARE_PUBLIC_PAGE_HEADERS = [
  ["Cache-Control", "private, no-store"],
  ["Pragma", "no-cache"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Robots-Tag", "noindex, nofollow, noarchive"],
  [
    "Content-Security-Policy",
    "frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
  ],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()",
  ],
] as const;

function cleanPathname(pathname: string) {
  return pathname
    .replace(/%5C/gi, "")
    .replace(/\\/g, "")
    .replace(/\/{2,}/g, "/");
}

/**
 * Phase 7D proxy.ts test-closure -- pure, framework-free predicate
 * extracted from the inline branch condition below (no behavior change,
 * confirmed by keeping this the SAME condition the branch already used).
 * Exported so proxy.test.ts can assert path-matching directly, without
 * constructing a NextRequest or touching Supabase -- matches this task's
 * own "prove a representative non-share route does NOT receive Client
 * Share-specific policy" requirement for paths that never reach the
 * Supabase-dependent tail of `proxy()` below.
 */
export function isClientSharePagePath(pathname: string): boolean {
  return pathname === "/share" || pathname.startsWith("/share/");
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/homepage-demo/review") {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/homepage-demo/review") {
    const response = NextResponse.next();

    for (const [name, value] of HOMEPAGE_DEMO_REVIEW_PAGE_HEADERS) {
      response.headers.set(name, value);
    }

    return response;
  }

  if (isClientSharePagePath(request.nextUrl.pathname)) {
    const response = NextResponse.next();

    for (const [name, value] of SHARE_PUBLIC_PAGE_HEADERS) {
      response.headers.set(name, value);
    }

    return response;
  }

  const originalPathname = request.nextUrl.pathname;
  const cleanedPathname = cleanPathname(originalPathname);

  // Clean weird backslash URLs:
  // /signup%5C -> /signup
  // /about%5C%5C%5C -> /about
  if (cleanedPathname !== originalPathname) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.pathname = cleanedPathname || "/";
    return NextResponse.redirect(cleanUrl, 308);
  }

  // Optional cleanup for bot/crawler noise:
  // /image -> /
  if (originalPathname === "/image") {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.pathname = "/";
    return NextResponse.redirect(cleanUrl, 308);
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  // לא מחובר → חסום dashboard
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // מחובר → אל תיתן להיכנס ל-login/signup
  if (user && isAuthPage) {
    const homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
      request.nextUrl.searchParams.getAll("intent")
    );
    const destination =
      homepageDemoClaimIntent === null
        ? "/dashboard"
        : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;

    return NextResponse.redirect(new URL(destination, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
