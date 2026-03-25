import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      user_email?: string;
      status?: string;
    };
  };
};

function verifySignature(rawBody: string, signature: string, secret: string) {
  const hmac = createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");

  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(digestBuffer, signatureBuffer);
}

function isActiveEvent(eventName: string) {
  return [
    "subscription_created",
    "subscription_updated",
    "subscription_resumed",
    "subscription_unpaused",
    "subscription_payment_success",
    "subscription_payment_recovered",
  ].includes(eventName);
}

function isInactiveEvent(eventName: string) {
  return [
    "subscription_cancelled",
    "subscription_expired",
    "subscription_paused",
    "subscription_payment_failed",
  ].includes(eventName);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing webhook configuration" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("x-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing X-Signature header" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LemonWebhookPayload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const userId = payload.meta?.custom_data?.user_id;
  const subscriptionId = payload.data?.id ?? null;
  const userEmail = payload.data?.attributes?.user_email ?? null;
  const subscriptionStatus = payload.data?.attributes?.status ?? null;

  if (!eventName) {
    return NextResponse.json({ error: "Missing event_name" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Missing custom_data.user_id" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    if (isActiveEvent(eventName)) {
      const { error: userUpdateError } = await supabaseAdmin
        .from("users")
        .update({ plan: "pro" })
        .eq("id", userId);

      if (userUpdateError) {
        console.error("Failed to update user to pro", userUpdateError);
        return NextResponse.json(
          { error: "Failed updating user plan to pro" },
          { status: 500 }
        );
      }

      const { error: billingUpsertError } = await supabaseAdmin
        .from("billing_subscriptions")
        .upsert(
          {
            user_id: userId,
            lemon_subscription_id: subscriptionId,
            lemon_customer_email: userEmail,
            status: subscriptionStatus || "active",
            plan: "pro",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (billingUpsertError) {
        console.error("Failed to upsert billing row", billingUpsertError);
        return NextResponse.json(
          { error: "Failed saving billing subscription" },
          { status: 500 }
        );
      }
    }

    if (isInactiveEvent(eventName)) {
      const { error: userUpdateError } = await supabaseAdmin
        .from("users")
        .update({ plan: "free" })
        .eq("id", userId);

      if (userUpdateError) {
        console.error("Failed to update user to free", userUpdateError);
        return NextResponse.json(
          { error: "Failed updating user plan to free" },
          { status: 500 }
        );
      }

      const { error: billingUpsertError } = await supabaseAdmin
        .from("billing_subscriptions")
        .upsert(
          {
            user_id: userId,
            lemon_subscription_id: subscriptionId,
            lemon_customer_email: userEmail,
            status: subscriptionStatus || "inactive",
            plan: "free",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (billingUpsertError) {
        console.error("Failed to upsert billing row", billingUpsertError);
        return NextResponse.json(
          { error: "Failed saving billing subscription" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook processing failed", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}