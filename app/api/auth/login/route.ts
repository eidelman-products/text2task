
import { after, NextRequest, NextResponse } from "next/server";
import { isOwnerEmail } from "@/lib/auth/owner.server";
import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
import { setOwnerAnalyticsExclusionCookie } from "@/lib/analytics/owner-exclusion.server";
import { readAnonymousIdCookie } from "@/lib/analytics/request-attribution.server";
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

const LOGIN_SUCCESS_EVENT = "login_success";
const LOGIN_SUCCESS_IDEMPOTENCY_BUCKET_SECONDS = 10;

/**
 * Phase 0B -- unlike signup_success (once ever per user), a login can
 * legitimately recur many times over a user's lifetime, so a global
 * "once per user" idempotency key would only ever capture the first
 * login. Instead this buckets to a short (10s) window: a genuine
 * double-submit of the same login form (e.g. a fast double-click before
 * the button disables) collapses into one row, while any two logins
 * more than 10s apart -- the only case that matters for "is this a
 * separate login session" -- still produce separate rows. Analytics
 * failure must never affect the login response, matching every other
 * best-effort event in this codebase (see
 * lib/analytics/signup-attribution.server.ts).
 */
/**
 * Phase 1D -- enriches login_success with the same first-party anonymous
 * identity every other Live Demo funnel event already carries, plus a
 * small closed boolean derived from the already-existing, already-parsed
 * homepage-demo-claim auth intent (see
 * lib/auth/homepage-demo-auth-intent.ts). Neither value is new state:
 * anonymousId is the same t2t_anon_id cookie read the same way as
 * extract/review/claim-save, and demoIntent is computed from a value
 * this route already parses from the login form for redirect purposes.
 * This is the one narrow enrichment identified as necessary for an
 * honest "Auth completed" admin funnel stage -- signup_success already
 * carries anonymous_id via lib/analytics/signup-attribution.server.ts,
 * so only login_success had the gap.
 */
function scheduleLoginSuccessAnalytics(
  userId: string,
  anonymousId: string | null,
  demoIntent: boolean
): void {
  try {
    const idempotencyBucket = Math.floor(
      Date.now() / (LOGIN_SUCCESS_IDEMPOTENCY_BUCKET_SECONDS * 1000)
    );
    const idempotencyKey = `${LOGIN_SUCCESS_EVENT}:${userId}:${idempotencyBucket}`;

    after(async () => {
      try {
        await logAnalyticsEventSafe({
          eventName: LOGIN_SUCCESS_EVENT,
          userId,
          anonymousId,
          metadata: { demo_intent: demoIntent },
          idempotencyKey,
        });
      } catch {
        // Login analytics is best-effort and must never affect auth.
      }
    });
  } catch {
    // Scheduling analytics is best-effort and must never affect auth.
  }
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

    scheduleLoginSuccessAnalytics(
      data.user.id,
      readAnonymousIdCookie(request),
      homepageDemoClaimIntent !== null
    );

    const hasProPurchaseIntent = isProPurchaseIntent(
      request.cookies.get(PRO_PURCHASE_INTENT_COOKIE_NAME)?.value
    );

    const postAuthDestination =
      homepageDemoClaimIntent === null
        ? getDestinationForProPurchaseIntent(hasProPurchaseIntent)
        : HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH;

    const response = NextResponse.redirect(
      new URL(postAuthDestination, request.url),
      { status: 303 }
    );

    if (isOwnerEmail(data.user.email)) {
      setOwnerAnalyticsExclusionCookie(response);
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
