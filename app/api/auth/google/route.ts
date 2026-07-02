import { NextRequest, NextResponse } from "next/server";
import {
  getDestinationForProPurchaseIntent,
  getSafeDashboardDestination,
} from "@/lib/auth/post-auth-destination";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";
import {
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import { createClient } from "@/lib/supabase/server";

function buildOAuthCallbackRedirect({
  origin,
  next,
  homepageDemoClaimIntent,
}: {
  origin: string;
  next: string;
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null;
}) {
  const callbackUrl = new URL("/auth/oauth/callback", origin);

  if (homepageDemoClaimIntent === null) {
    callbackUrl.searchParams.set("next", next);
  } else {
    callbackUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  return callbackUrl.toString();
}

function buildLoginErrorRedirect({
  request,
  error,
  homepageDemoClaimIntent,
}: {
  request: NextRequest;
  error: string;
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null;
}) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("error", error);

  if (homepageDemoClaimIntent !== null) {
    redirectUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  let homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null = null;

  try {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
      requestUrl.searchParams.getAll("intent")
    );
    const hasProPurchaseIntent = isProPurchaseIntent(
      request.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value
    );
    const next = hasProPurchaseIntent
      ? getDestinationForProPurchaseIntent(true)
      : getSafeDashboardDestination(requestUrl.searchParams.get("next"));
    const redirectTo = buildOAuthCallbackRedirect({
      origin,
      next,
      homepageDemoClaimIntent,
    });

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email",
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error || !data.url) {
      return NextResponse.redirect(
        buildLoginErrorRedirect({
          request,
          error: "oauth_start_failed",
          homepageDemoClaimIntent,
        })
      );
    }

    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(
      buildLoginErrorRedirect({
        request,
        error: "oauth_start_failed",
        homepageDemoClaimIntent,
      })
    );
  }
}
