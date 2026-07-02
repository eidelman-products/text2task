
import { NextRequest, NextResponse } from "next/server";
import { getDestinationForProPurchaseIntent } from "@/lib/auth/post-auth-destination";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";
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

function getHomepageDemoClaimIntentFromFormData(
  formData: FormData
): HomepageDemoClaimAuthIntent | null {
  const intentValues = formData.getAll("intent");

  if (intentValues.length !== 1 || typeof intentValues[0] !== "string") {
    return null;
  }

  return parseHomepageDemoClaimAuthIntent(intentValues[0]);
}

function createLoginRedirect(
  request: NextRequest,
  error: "invalid_credentials" | "email_not_confirmed",
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null,
  email?: string
) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("error", error);

  if (email) {
    redirectUrl.searchParams.set("email", email);
  }

  if (homepageDemoClaimIntent !== null) {
    redirectUrl.searchParams.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  return redirectUrl;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");
    const homepageDemoClaimIntent =
      getHomepageDemoClaimIntentFromFormData(formData);

    const email =
      typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    const password =
      typeof passwordValue === "string" ? passwordValue : "";

    if (!email || !password || !isValidEmail(email)) {
      return NextResponse.redirect(
        createLoginRedirect(
          request,
          "invalid_credentials",
          homepageDemoClaimIntent
        ),
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
        return NextResponse.redirect(
          createLoginRedirect(
            request,
            "email_not_confirmed",
            homepageDemoClaimIntent,
            email
          ),
          { status: 303 }
        );
      }

      return NextResponse.redirect(
        createLoginRedirect(
          request,
          "invalid_credentials",
          homepageDemoClaimIntent
        ),
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
      homepageDemoClaimIntent === null
        ? getDestinationForProPurchaseIntent(hasProPurchaseIntent)
        : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;

    return NextResponse.redirect(
      new URL(postAuthDestination, request.url),
      { status: 303 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
