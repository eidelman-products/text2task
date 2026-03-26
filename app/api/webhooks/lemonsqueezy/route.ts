import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const data = body?.data;
    const attributes = data?.attributes;

    if (!data || !attributes) {
      return NextResponse.json({ ok: true });
    }

    const supabase = supabaseAdmin;

    const subscriptionId = String(data.id);
    const email = attributes.user_email;
    const status = attributes.status;

    const customerPortalUrl =
      attributes?.urls?.customer_portal || null;

    const updatePaymentUrl =
      attributes?.urls?.update_payment_method || null;

    const updateSubscriptionUrl =
      attributes?.urls?.customer_portal_update_subscription || null;

    const userId =
      body?.meta?.custom_data?.user_id || null;

    if (!userId) {
      console.error("❌ Missing user_id in webhook");
      return NextResponse.json({ ok: true });
    }

    // 👉 עדכון billing_subscriptions
    const { error: subError } = await supabase
      .from("billing_subscriptions")
      .upsert({
        user_id: userId,
        lemon_subscription_id: subscriptionId,
        lemon_customer_email: email,
        status,
        plan: status === "active" ? "pro" : "free",
        customer_portal_url: customerPortalUrl,
        update_payment_method_url: updatePaymentUrl,
        portal_update_subscription_url: updateSubscriptionUrl,
        updated_at: new Date().toISOString(),
      });

    if (subError) {
      console.error("❌ billing_subscriptions error:", subError);
    }

    // 👉 עדכון users
    const { error: userError } = await supabase
      .from("users")
      .update({
        plan: status === "active" ? "pro" : "free",
      })
      .eq("id", userId);

    if (userError) {
      console.error("❌ users update error:", userError);
    }

    console.log("✅ Webhook processed successfully");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Webhook crash:", err);
    return NextResponse.json({ ok: true });
  }
}