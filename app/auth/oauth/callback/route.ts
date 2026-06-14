import { NextRequest, NextResponse } from "next/server";
import { ensureUser } from "@/lib/supabase/ensureUser";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(next: string | null) {
  if (!next) {
    return "/dashboard";
  }

  if (next === "/dashboard" || next.startsWith("/dashboard?")) {
    return next;
  }

  return "/dashboard";
}

function loginRedirect(request: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (oauthError) {
    console.error("Google OAuth provider returned error:", oauthError);
    return loginRedirect(request, "oauth_cancelled");
  }

  if (!code) {
    return loginRedirect(request, "oauth_callback_failed");
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Google OAuth exchangeCodeForSession error:", exchangeError);
    return loginRedirect(request, "oauth_callback_failed");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Google OAuth getUser error:", userError);
    return loginRedirect(request, "oauth_callback_failed");
  }

  if (!user.email) {
    console.error("Google OAuth user has no email:", user.id);
    return loginRedirect(request, "oauth_missing_email");
  }

  try {
    await ensureUser({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error("Google OAuth ensureUser error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message.includes("already linked to another auth identity")) {
      return loginRedirect(request, "account_link_conflict");
    }

    return loginRedirect(request, "oauth_callback_failed");
  }

  return NextResponse.redirect(new URL(next, request.url));
}