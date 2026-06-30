import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function cleanPathname(pathname: string) {
  return pathname
    .replace(/%5C/gi, "")
    .replace(/\\/g, "")
    .replace(/\/{2,}/g, "/");
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/homepage-demo/review") {
    return NextResponse.next();
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
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
