
import { NextRequest, NextResponse } from "next/server";
import { getDestinationForProPurchaseIntent } from "@/lib/auth/post-auth-destination";
import {
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isEmailNotConfirmedError(error: {
  code?: string;
  message?: string;
}) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  return (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("not confirmed")
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");

    const email =
      typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    const password =
      typeof passwordValue === "string" ? passwordValue : "";

    if (!email || !password || !isValidEmail(email)) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_credentials", request.url),
        { status: 303 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      if (error && isEmailNotConfirmedError(error)) {
        const redirectUrl = new URL("/login", request.url);
        redirectUrl.searchParams.set("error", "email_not_confirmed");
        redirectUrl.searchParams.set("email", email);

        return NextResponse.redirect(redirectUrl, { status: 303 });
      }

      return NextResponse.redirect(
        new URL("/login?error=invalid_credentials", request.url),
        { status: 303 }
      );
    }

    await ensureUser({
      id: data.user.id,
      email: data.user.email ?? email,
    });

    const hasProPurchaseIntent = isProPurchaseIntent(
      request.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value
    );

    const postAuthDestination =
      getDestinationForProPurchaseIntent(hasProPurchaseIntent);

    return NextResponse.redirect(
      new URL(postAuthDestination, request.url),
      { status: 303 }
    );
  } catch (error) {
    console.error("login route error:", error);

    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
