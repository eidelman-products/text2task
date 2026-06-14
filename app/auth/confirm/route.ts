import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

function getSafeNextPath(next: string | null) {
  if (!next) {
    return "/dashboard";
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_confirmation_link", request.url)
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("auth confirm exchangeCodeForSession error:", exchangeError);

    return NextResponse.redirect(
      new URL("/login?error=confirmation_failed", request.url)
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    console.error("auth confirm getUser error:", userError);

    return NextResponse.redirect(
      new URL("/login?error=confirmation_failed", request.url)
    );
  }

  try {
    await ensureUser({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error("auth confirm ensureUser error:", error);

    return NextResponse.redirect(
      new URL("/login?error=confirmation_failed", request.url)
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}