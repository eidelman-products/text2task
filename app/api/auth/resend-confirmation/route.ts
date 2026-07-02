import { NextRequest, NextResponse } from "next/server";
import {
  buildEmailConfirmationRedirect,
  getDestinationForProPurchaseIntent,
} from "@/lib/auth/post-auth-destination";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  parseHomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";
import {
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import { createClient } from "@/lib/supabase/server";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildHomepageDemoClaimEmailConfirmationRedirect(origin: string) {
  const redirectUrl = new URL("/auth/confirm", origin);
  redirectUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);

  return redirectUrl.toString();
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const emailValue =
    isJsonRecord(body) && "email" in body
      ? body.email
      : null;
  const intentValue =
    isJsonRecord(body) && "intent" in body
      ? body.intent
      : null;
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const homepageDemoClaimIntent =
    typeof intentValue === "string"
      ? parseHomepageDemoClaimAuthIntent(intentValue)
      : null;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const origin = request.nextUrl.origin;
  const hasProPurchaseIntent = isProPurchaseIntent(
    request.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value
  );
  const postAuthDestination =
    getDestinationForProPurchaseIntent(hasProPurchaseIntent);
  const emailRedirectTo =
    homepageDemoClaimIntent === null
      ? buildEmailConfirmationRedirect(origin, postAuthDestination)
      : buildHomepageDemoClaimEmailConfirmationRedirect(origin);

  await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo,
    },
  });

  return NextResponse.json({
    success: true,
    message: "If this email still needs confirmation, we sent a new link.",
  });
}
