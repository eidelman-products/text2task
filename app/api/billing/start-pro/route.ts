import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PRO_PURCHASE_INTENT_COOKIE_NAME,
  PRO_PURCHASE_INTENT_VALUE,
  proPurchaseIntentCookieOptions,
} from "@/lib/billing/pro-purchase-intent";

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destination = new URL(
    user?.id ? "/api/billing/continue" : "/signup",
    request.url
  );
  const response = NextResponse.redirect(destination);

  response.cookies.set(
    PRO_PURCHASE_INTENT_COOKIE_NAME,
    PRO_PURCHASE_INTENT_VALUE,
    proPurchaseIntentCookieOptions
  );

  return withNoStore(response);
}
