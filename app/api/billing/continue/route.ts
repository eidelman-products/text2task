import { NextRequest, NextResponse } from "next/server";
import { SITE_ORIGIN } from "@/app/lib/site-config";
import { getOrCreateProCheckout } from "@/lib/billing/get-or-create-pro-checkout";
import { isHttpsCheckoutUrl } from "@/lib/billing/create-creem-checkout";
import {
  clearProPurchaseIntentCookieOptions,
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import { createClient } from "@/lib/supabase/server";

const PRODUCTION_APP_URL = SITE_ORIGIN;

function getAppUrl(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin.includes("text2task.com")) {
    return origin.replace(/\/$/, "");
  }

  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    PRODUCTION_APP_URL;

  if (envUrl.includes("localhost")) {
    return PRODUCTION_APP_URL;
  }

  return envUrl.replace(/\/$/, "");
}

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");

  return response;
}

function clearIntent(response: NextResponse) {
  response.cookies.set(
    PRO_PURCHASE_INTENT_COOKIE_NAME,
    "",
    clearProPurchaseIntentCookieOptions
  );

  return response;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    return withNoStore(redirectTo(request, "/login"));
  }

  const intent = request.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value;

  if (!isProPurchaseIntent(intent)) {
    return withNoStore(
      clearIntent(
        redirectTo(request, "/dashboard/billing?checkout_error=intent_expired")
      )
    );
  }

  const result = await getOrCreateProCheckout({
    user: {
      id: user.id,
      email: user.email,
    },
    appUrl: getAppUrl(request),
  });

  if (result.status === "checkout_ready") {
    if (!isHttpsCheckoutUrl(result.checkoutUrl)) {
      return withNoStore(
        clearIntent(
          redirectTo(request, "/dashboard/billing?checkout_error=checkout_unavailable")
        )
      );
    }

    return withNoStore(
      clearIntent(NextResponse.redirect(new URL(result.checkoutUrl)))
    );
  }

  if (result.status === "already_pro") {
    return withNoStore(clearIntent(redirectTo(request, "/dashboard/billing")));
  }

  if (result.status === "creation_in_progress") {
    return withNoStore(
      clearIntent(redirectTo(request, "/dashboard/billing?checkout_status=pending"))
    );
  }

  return withNoStore(
    clearIntent(
      redirectTo(request, "/dashboard/billing?checkout_error=checkout_unavailable")
    )
  );
}
