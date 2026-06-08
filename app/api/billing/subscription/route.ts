import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Safe to ignore when cookies cannot be written.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: appUser } = await supabase
      .from("users")
      .select(
        "id,email,plan,created_at,updated_at,subscription_status,pro_current_period_end,cancel_at_period_end,creem_customer_id"
      )
      .eq("id", user.id)
      .maybeSingle();

    const plan = appUser?.plan === "pro" ? "pro" : "free";
    const subscriptionStatus =
      typeof appUser?.subscription_status === "string"
        ? appUser.subscription_status
        : null;
    const portalEligibleStatuses = new Set([
      "active",
      "trialing",
      "paid",
      "scheduled_cancel",
    ]);
    const hasBillingPortal = Boolean(
      appUser?.creem_customer_id &&
        (plan === "pro" ||
          (subscriptionStatus && portalEligibleStatuses.has(subscriptionStatus)))
    );

    return NextResponse.json({
      id: user.id,
      email: appUser?.email || user.email,
      plan,
      subscription_status: subscriptionStatus,
      pro_current_period_end: appUser?.pro_current_period_end || null,
      cancel_at_period_end: Boolean(appUser?.cancel_at_period_end),
      has_billing_portal: hasBillingPortal,
      created_at: appUser?.created_at || null,
      updated_at: appUser?.updated_at || null,
    });
  } catch (error) {
    console.error("BILLING SUBSCRIPTION ERROR:", error);

    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 500 }
    );
  }
}
