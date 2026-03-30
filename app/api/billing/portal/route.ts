import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CreemPortalResponse = {
  customer_portal_link?: string;
};

function getCreemApiBaseUrl() {
  return process.env.CREEM_API_BASE_URL || "https://test-api.creem.io";
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let subscription: any = null;

    const { data: byUserId, error: byUserIdError } = await supabaseAdmin
      .from("billing_subscriptions")
      .select(
        `
          user_id,
          plan,
          status,
          provider,
          provider_customer_id,
          customer_email,
          customer_portal_url,
          update_payment_method_url,
          portal_update_subscription_url
        `
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (byUserIdError) {
      return NextResponse.json(
        { error: byUserIdError.message || "Failed to load subscription by user id" },
        { status: 500 }
      );
    }

    subscription = byUserId;

    if (!subscription && user.email) {
      const { data: byEmail, error: byEmailError } = await supabaseAdmin
        .from("billing_subscriptions")
        .select(
          `
            user_id,
            plan,
            status,
            provider,
            provider_customer_id,
            customer_email,
            customer_portal_url,
            update_payment_method_url,
            portal_update_subscription_url
          `
        )
        .eq("customer_email", user.email)
        .maybeSingle();

      if (byEmailError) {
        return NextResponse.json(
          { error: byEmailError.message || "Failed to load subscription by email" },
          { status: 500 }
        );
      }

      subscription = byEmail;
    }

    if (!subscription) {
      return NextResponse.json(
        {
          error: "Subscription not found",
          debug: {
            authUserId: user.id,
            authEmail: user.email || null,
          },
        },
        { status: 404 }
      );
    }

    const plan = subscription.plan === "pro" ? "pro" : "free";
    const status =
      typeof subscription.status === "string" ? subscription.status : null;

    if (plan !== "pro") {
      return NextResponse.json({
        plan,
        status,
        customerPortalUrl: null,
        updatePaymentMethodUrl: null,
        updateSubscriptionUrl: null,
      });
    }

    if (subscription.provider === "creem") {
      if (!process.env.CREEM_API_KEY) {
        return NextResponse.json(
          { error: "Missing CREEM_API_KEY" },
          { status: 500 }
        );
      }

      if (!subscription.provider_customer_id) {
        return NextResponse.json(
          {
            error: "Missing provider_customer_id for Creem subscription",
            debug: {
              authUserId: user.id,
              authEmail: user.email || null,
              subscriptionUserId: subscription.user_id || null,
              provider: subscription.provider || null,
            },
          },
          { status: 500 }
        );
      }

      const creemRes = await fetch(
        `${getCreemApiBaseUrl()}/v1/customers/billing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CREEM_API_KEY,
          },
          body: JSON.stringify({
            customer_id: subscription.provider_customer_id,
          }),
          cache: "no-store",
        }
      );

      const creemData =
        (await creemRes.json().catch(() => null)) as CreemPortalResponse | null;

      if (!creemRes.ok || !creemData?.customer_portal_link) {
        return NextResponse.json(
          {
            error: "Failed to generate Creem customer portal link",
            creemStatus: creemRes.status,
            creemResponse: creemData,
          },
          { status: 502 }
        );
      }

      const portalUrl = creemData.customer_portal_link;

      await supabaseAdmin
        .from("billing_subscriptions")
        .update({
          customer_portal_url: portalUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", subscription.user_id);

      return NextResponse.json({
        plan,
        status,
        customerPortalUrl: portalUrl,
        updatePaymentMethodUrl: portalUrl,
        updateSubscriptionUrl: portalUrl,
      });
    }

    return NextResponse.json({
      plan,
      status,
      customerPortalUrl: subscription.customer_portal_url || null,
      updatePaymentMethodUrl:
        subscription.update_payment_method_url ||
        subscription.customer_portal_url ||
        null,
      updateSubscriptionUrl:
        subscription.portal_update_subscription_url ||
        subscription.customer_portal_url ||
        null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load subscription portal" },
      { status: 500 }
    );
  }
}