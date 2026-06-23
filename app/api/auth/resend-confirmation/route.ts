import { NextRequest, NextResponse } from "next/server";
import {
  buildEmailConfirmationRedirect,
  getDestinationForProPurchaseIntent,
} from "@/lib/auth/post-auth-destination";
import {
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import { createClient } from "@/lib/supabase/server";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    body && typeof body === "object" && "email" in body
      ? (body as { email?: unknown }).email
      : null;
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

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

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: buildEmailConfirmationRedirect(
        origin,
        postAuthDestination
      ),
    },
  });

  if (error) {
    console.error("resend confirmation route error:", error);
  }

  return NextResponse.json({
    success: true,
    message: "If this email still needs confirmation, we sent a new link.",
  });
}
