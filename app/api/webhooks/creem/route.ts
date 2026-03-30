import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

function verifyCreemSignature(
  payload: string,
  signature: string,
  secret: string
) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "number") {
    const ms = value > 9999999999 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function normalizeStatus(eventType: string, objectStatus?: string | null) {
  if (objectStatus && objectStatus.trim()) {
    return objectStatus.trim().toLowerCase();
  }

  switch (eventType) {
    case "checkout.completed":
      return "completed";
    case "subscription.active":
      return "active";
    case "subscription.paid":
      return "paid";
    case "subscription.trialing":
      return "trialing";
    case "subscription.canceled":
      return "canceled";
    case "subscription.expired":
      return "expired";
    case "subscription.paused":
      return "paused";
    default:
      return "unknown";
  }
}

function planFromEvent(eventType: string) {
  if (
    eventType === "checkout.completed" ||
    eventType === "subscription.active" ||
    eventType === "subscription.paid" ||
    eventType === "subscription.trialing"
  ) {
    return "pro";
  }

  if (
    eventType === "subscription.canceled" ||
    eventType === "subscription.expired" ||
    eventType === "subscription.paused"
  ) {
    return "free";
  }

  return null;
}

async function resolveUserId(params: {
  metadataUserId: string | null;
  email: string | null;
}) {
  if (params.metadataUserId) {
    return params.metadataUserId;
  }

  if (!params.email) {
    return null;
  }

  const { data: userRow, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", params.email)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve user by email:", error);
    return null;
  }

  return userRow?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("creem-signature");

    if (!signature || !process.env.CREEM_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing webhook signature or secret" },
        { status: 401 }
      );
    }

    const isValid = verifyCreemSignature(
      rawBody,
      signature,
      process.env.CREEM_WEBHOOK_SECRET
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    const eventType: string = event.eventType || event.type || "unknown";
    const object = event.object || {};
    const metadata = object.metadata || {};
    const customer = object.customer || {};

    const metadataUserId =
      metadata.user_id ||
      metadata.userId ||
      metadata.referenceId ||
      null;

    const email: string | null =
      customer.email ||
      object.customer_email ||
      metadata.email ||
      null;

    const resolvedUserId = await resolveUserId({
      metadataUserId,
      email,
    });

    const normalizedStatus = normalizeStatus(
      eventType,
      object.status || null
    );

    const targetPlan = planFromEvent(eventType);

    const provider = "creem";
    const providerSubscriptionId =
      object.subscription_id ||
      object.id ||
      object.subscription?.id ||
      null;

    const providerCustomerId =
      customer.id ||
      object.customer_id ||
      object.customer?.id ||
      null;

    const customerPortalUrl =
      object.customer_portal_url ||
      object.portal_url ||
      object.customerPortalUrl ||
      null;

    const currentPeriodStart = toIsoOrNull(
  object.current_period_start_date ||
    object.current_period_start ||
    object.period_start ||
    object.currentPeriodStart ||
    object.last_transaction?.period_start
);

const currentPeriodEnd = toIsoOrNull(
  object.current_period_end_date ||
    object.current_period_end ||
    object.period_end ||
    object.currentPeriodEnd ||
    object.last_transaction?.period_end
);

    const canceledAt = toIsoOrNull(
      object.canceled_at || object.cancelled_at || object.canceledAt
    );

    const cancelAtPeriodEnd = Boolean(
      object.cancel_at_period_end ?? object.cancelAtPeriodEnd ?? false
    );

    if (resolvedUserId) {
      const subscriptionPayload = {
        user_id: resolvedUserId,
        provider,
        provider_subscription_id: providerSubscriptionId,
        provider_customer_id: providerCustomerId,
        customer_email: email,
        status: normalizedStatus,
        plan: targetPlan ?? "free",
        customer_portal_url: customerPortalUrl,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        canceled_at: canceledAt,
        raw_payload: event,
        updated_at: new Date().toISOString(),
      };

      const { error: subscriptionError } = await supabaseAdmin
        .from("billing_subscriptions")
        .upsert(subscriptionPayload, {
          onConflict: "user_id",
        });

      if (subscriptionError) {
        console.error(
          "Failed to upsert billing_subscriptions from Creem webhook:",
          subscriptionError
        );
        return NextResponse.json(
          { error: "Failed to persist subscription" },
          { status: 500 }
        );
      }
    } else {
      console.warn(
        "Creem webhook received but no matching user could be resolved.",
        {
          eventType,
          email,
          metadataUserId,
        }
      );
    }

    if (targetPlan) {
      if (resolvedUserId) {
        const { error: planError } = await supabaseAdmin
          .from("users")
          .update({ plan: targetPlan })
          .eq("id", resolvedUserId);

        if (planError) {
          console.error("Failed to update users.plan by id:", planError);
          return NextResponse.json(
            { error: "Failed to update user plan" },
            { status: 500 }
          );
        }
      } else if (email) {
        const { error: planError } = await supabaseAdmin
          .from("users")
          .update({ plan: targetPlan })
          .eq("email", email);

        if (planError) {
          console.error("Failed to update users.plan by email:", planError);
          return NextResponse.json(
            { error: "Failed to update user plan" },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Creem webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}