import { NextRequest, NextResponse } from "next/server";
import {
  getSafeEmailConfirmationDestination,
  isPasswordResetDestination,
} from "@/lib/auth/post-auth-destination";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";
import { scheduleSignupAttribution } from "@/lib/analytics/signup-attribution.server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

function createConfirmationFailureRedirect(
  request: NextRequest,
  path: "/check-email" | "/login",
  error: string,
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null
) {
  const redirectUrl = new URL(path, request.url);
  redirectUrl.searchParams.set("error", error);

  if (homepageDemoClaimIntent !== null) {
    redirectUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
    requestUrl.searchParams.getAll("intent")
  );
  const next = getSafeEmailConfirmationDestination(
    requestUrl.searchParams.get("next")
  );
  const isPasswordReset =
    homepageDemoClaimIntent === null && isPasswordResetDestination(next);

  if (!code) {
    if (!isPasswordReset) {
      return NextResponse.redirect(
        createConfirmationFailureRedirect(
          request,
          "/check-email",
          "invalid_link",
          homepageDemoClaimIntent
        )
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
    if (!isPasswordReset) {
      return NextResponse.redirect(
        createConfirmationFailureRedirect(
          request,
          "/check-email",
          "confirmation_failed",
          homepageDemoClaimIntent
        )
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
    return NextResponse.redirect(
      createConfirmationFailureRedirect(
        request,
        "/login",
        "confirmation_failed",
        homepageDemoClaimIntent
      )
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
  } catch {
    return NextResponse.redirect(
      createConfirmationFailureRedirect(
        request,
        "/login",
        "confirmation_failed",
        homepageDemoClaimIntent
      )
    );
  }

  const destination =
    homepageDemoClaimIntent === null
      ? next
      : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;

  return NextResponse.redirect(new URL(destination, request.url));
}
