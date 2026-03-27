import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("billing_subscriptions")
      .select(
        "plan, status, customer_portal_url, update_payment_method_url, portal_update_subscription_url"
      )
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      plan: data.plan,
      status: data.status,
      customerPortalUrl: data.customer_portal_url,
      updatePaymentMethodUrl: data.update_payment_method_url,
      updateSubscriptionUrl: data.portal_update_subscription_url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load subscription portal" },
      { status: 500 }
    );
  }
}