import { NextRequest, NextResponse } from "next/server";
import {
  getDestinationForProPurchaseIntent,
  getSafeDashboardDestination,
} from "@/lib/auth/post-auth-destination";
import {
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const hasProPurchaseIntent = isProPurchaseIntent(
      request.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value
    );
    const next = hasProPurchaseIntent
      ? getDestinationForProPurchaseIntent(true)
      : getSafeDashboardDestination(requestUrl.searchParams.get("next"));

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/oauth/callback?next=${encodeURIComponent(
          next
        )}`,
        scopes: "openid email",
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error || !data.url) {
      console.error("Google OAuth start error:", error);

      return NextResponse.redirect(
        new URL("/login?error=oauth_start_failed", request.url)
      );
    }

    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("Google OAuth route error:", error);

    return NextResponse.redirect(
      new URL("/login?error=oauth_start_failed", request.url)
    );
  }
}
