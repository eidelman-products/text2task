import { NextRequest, NextResponse } from "next/server";
import {
  buildEmailConfirmationRedirect,
  getDestinationForProPurchaseIntent,
} from "@/lib/auth/post-auth-destination";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH,
  parseHomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";
import {
  isProPurchaseIntent,
  PRO_PURCHASE_INTENT_COOKIE_NAME,
} from "@/lib/billing/pro-purchase-intent";
import {
  scheduleEmailSignupAttributionCapture,
  scheduleSignupAttribution,
} from "@/lib/analytics/signup-attribution.server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

type SignupRequestBody = Readonly<{
  email: unknown;
  password: unknown;
  intent?: unknown;
}>;

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSignupRequestBody(value: unknown): SignupRequestBody | null {
  if (!isJsonRecord(value)) {
    return null;
  }

  return {
    email: value.email,
    password: value.password,
    intent: value.intent,
  };
}

function buildHomepageDemoClaimEmailConfirmationRedirect(origin: string) {
  const redirectUrl = new URL("/auth/confirm", origin);
  redirectUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);

  return redirectUrl.toString();
}

export async function POST(req: NextRequest) {
  try {
    let requestBody: SignupRequestBody | null;

    try {
      requestBody = parseSignupRequestBody(await req.json());
    } catch {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    if (!requestBody?.email || !requestBody.password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(requestBody.email).trim().toLowerCase();
    const normalizedPassword = String(requestBody.password);
    const homepageDemoClaimIntent =
      typeof requestBody.intent === "string"
        ? parseHomepageDemoClaimAuthIntent(requestBody.intent)
        : null;

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
      homepageDemoClaimIntent === null
        ? getDestinationForProPurchaseIntent(hasProPurchaseIntent)
        : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;
    const emailRedirectTo =
      homepageDemoClaimIntent === null
        ? buildEmailConfirmationRedirect(origin, postAuthDestination)
        : buildHomepageDemoClaimEmailConfirmationRedirect(origin);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user?.id) {
      scheduleEmailSignupAttributionCapture({
        request: req,
        userId: data.user.id,
        authFlow: "email_signup",
      });
    }

    const needsEmailConfirmation = !data.session;

    if (!needsEmailConfirmation && data.user?.email) {
      const appUser = await ensureUser({
        id: data.user.id,
        email: data.user.email,
      });

      scheduleSignupAttribution({
        request: req,
        userId: appUser.id,
        authFlow: "email_signup",
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
