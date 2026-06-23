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
import { ensureUser } from "@/lib/supabase/ensureUser";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);

    if (normalizedPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const requestUrl = new URL(req.url);
    const origin = requestUrl.origin;
    const hasProPurchaseIntent = isProPurchaseIntent(
      req.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value
    );
    const postAuthDestination =
      getDestinationForProPurchaseIntent(hasProPurchaseIntent);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        emailRedirectTo: buildEmailConfirmationRedirect(
          origin,
          postAuthDestination
        ),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const needsEmailConfirmation = !data.session;

    if (!needsEmailConfirmation && data.user?.email) {
      await ensureUser({
        id: data.user.id,
        email: data.user.email,
      });
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      needsEmailConfirmation,
      ...(needsEmailConfirmation ? {} : { destination: postAuthDestination }),
    });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
