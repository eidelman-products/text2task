import { NextRequest, NextResponse } from "next/server";
import {
  getSafeEmailConfirmationDestination,
  isPasswordResetDestination,
} from "@/lib/auth/post-auth-destination";
import { scheduleSignupAttribution } from "@/lib/analytics/signup-attribution.server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeEmailConfirmationDestination(
    requestUrl.searchParams.get("next")
  );
  const isPasswordReset = isPasswordResetDestination(next);

  if (!code) {
    if (!isPasswordReset) {
      return NextResponse.redirect(
        new URL("/check-email?error=invalid_link", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/login?error=invalid_confirmation_link", request.url)
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("auth confirm exchangeCodeForSession error:", exchangeError);

    if (!isPasswordReset) {
      return NextResponse.redirect(
        new URL("/check-email?error=confirmation_failed", request.url)
      );
    }

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
    const appUser = await ensureUser({
      id: user.id,
      email: user.email,
    });

    if (!isPasswordReset) {
      scheduleSignupAttribution({
        request,
        userId: appUser.id,
        authFlow: "email_confirmation",
      });
    }
  } catch (error) {
    console.error("auth confirm ensureUser error:", error);

    return NextResponse.redirect(
      new URL("/login?error=confirmation_failed", request.url)
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
