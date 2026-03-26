import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const eventName = body?.meta?.event_name;
    const data = body?.data;
    const attributes = data?.attributes;

    if (!eventName || !attributes) {
      return NextResponse.json({ ok: true });
    }

    // אנחנו מתעניינים רק באירועי מנוי
    if (
      eventName !== "subscription_created" &&
      eventName !== "subscription_updated" &&
      eventName !== "subscription_payment_success"
    ) {
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();

    const subscriptionId = String(data.id);
    const email = attributes.user_email;
    const status = attributes.status;

    const customerPortalUrl = attributes?.urls?.customer_portal || null;
    const updatePaymentUrl = attributes?.urls?.update_payment_method || null;
    const updateSubscriptionUrl =
      attributes?.urls?.customer_portal_update_subscription || null;

console.log("PORTAL URL DEBUG:", {
  customerPortalUrl,
  updatePaymentUrl,
  updateSubscriptionUrl,
  rawUrls: attributes?.urls,
});

    const userId =
      body?.meta?.custom_data?.user_id || null;

    if (!userId) {
      console.error("❌ Missing user_id in webhook");
      return NextResponse.json({ ok: true });
    }

    // עדכון/יצירה בטבלת billing_subscriptions
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

    // עדכון גם בטבלת users
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