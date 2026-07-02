import { NextRequest, NextResponse } from "next/server";
import { getSafePostAuthDestination } from "@/lib/auth/post-auth-destination";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";
import { scheduleSignupAttribution } from "@/lib/analytics/signup-attribution.server";
import { ensureUser } from "@/lib/supabase/ensureUser";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(
  request: NextRequest,
  error: string,
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null
) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("error", error);

  if (homepageDemoClaimIntent !== null) {
    redirectUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
    requestUrl.searchParams.getAll("intent")
  );
  const next =
    homepageDemoClaimIntent === null
      ? getSafePostAuthDestination(requestUrl.searchParams.get("next"))
      : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;

  if (oauthError) {
    return loginRedirect(request, "oauth_cancelled", homepageDemoClaimIntent);
  }

  if (!code) {
    return loginRedirect(
      request,
      "oauth_callback_failed",
      homepageDemoClaimIntent
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return loginRedirect(
      request,
      "oauth_callback_failed",
      homepageDemoClaimIntent
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return loginRedirect(
      request,
      "oauth_callback_failed",
      homepageDemoClaimIntent
    );
  }

  if (!user.email) {
    return loginRedirect(
      request,
      "oauth_missing_email",
      homepageDemoClaimIntent
    );
  }

  try {
    const appUser = await ensureUser({
      id: user.id,
      email: user.email,
    });

    scheduleSignupAttribution({
      request,
      userId: appUser.id,
      authFlow: "google_oauth",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("already linked to another auth identity")) {
      return loginRedirect(
        request,
        "account_link_conflict",
        homepageDemoClaimIntent
      );
    }

    return loginRedirect(
      request,
      "oauth_callback_failed",
      homepageDemoClaimIntent
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
