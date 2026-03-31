import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CreemEvent = {
  id?: string;
  eventType?: string;
  type?: string;
  created_at?: string;
  createdAt?: string;
  object?: Record<string, any>;
};

function verifyCreemSignature(
  payload: string,
  signature: string,
  secret: string
) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const normalizedSignature = signature.trim();

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(normalizedSignature, "hex")
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
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed.length >= 10) {
      const ms = numeric > 9999999999 ? numeric : numeric * 1000;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function getEventType(event: CreemEvent): string {
  return String(event.eventType || event.type || "unknown").trim();
}

function getObjectStatus(object: Record<string, any>) {
  return (
    object.status ||
    object.subscription_status ||
    object.subscriptionStatus ||
    object.order_status ||
    object.order?.status ||
    object.payment_status ||
    object.paymentStatus ||
    object.last_transaction?.status ||
    null
  );
}

function normalizeStatus(eventType: string, objectStatus?: string | null) {
  if (objectStatus && String(objectStatus).trim()) {
    return String(objectStatus).trim().toLowerCase();
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

    case "subscription.scheduled_cancel":
      return "scheduled_cancel";

    case "subscription.past_due":
      return "past_due";

    case "subscription.update":
      return "updated";

    default:
      return "unknown";
  }
}

function shouldGrantProFromCheckout(object: Record<string, any>) {
  const paymentLikeStatuses = [
    object.order?.status,
    object.payment_status,
    object.paymentStatus,
    object.status,
    object.last_transaction?.status,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  if (paymentLikeStatuses.length === 0) {
    return true;
  }

  return paymentLikeStatuses.some((status) =>
    ["paid", "completed", "succeeded", "success", "active", "trialing"].includes(
      status
    )
  );
}

function planFromEvent(eventType: string, object: Record<string, any>) {
  if (
    eventType === "subscription.active" ||
    eventType === "subscription.paid" ||
    eventType === "subscription.trialing"
  ) {
    return "pro";
  }

  if (eventType === "checkout.completed") {
    return shouldGrantProFromCheckout(object) ? "pro" : null;
  }

  if (
    eventType === "subscription.canceled" ||
    eventType === "subscription.expired" ||
    eventType === "subscription.paused"
  ) {
    return "free";
  }

  if (
    eventType === "subscription.scheduled_cancel" ||
    eventType === "subscription.past_due" ||
    eventType === "subscription.update"
  ) {
    return null;
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
    console.error("[CREEM WEBHOOK] Failed to resolve user by email:", error);
    return null;
  }

  return userRow?.id ?? null;
}

function extractMetadata(object: Record<string, any>) {
  return (
    object.metadata ||
    object.subscription?.metadata ||
    object.order?.metadata ||
    object.checkout?.metadata ||
    {}
  );
}

function extractCustomer(object: Record<string, any>) {
  return (
    object.customer ||
    object.subscription?.customer ||
    object.order?.customer ||
    object.checkout?.customer ||
    {}
  );
}

function extractEmail(
  object: Record<string, any>,
  metadata: Record<string, any>,
  customer: Record<string, any>
): string | null {
  const email =
    customer.email ||
    object.customer_email ||
    object.customerEmail ||
    object.email ||
    object.subscription?.customer_email ||
    object.order?.customer_email ||
    metadata.email ||
    null;

  if (!email || typeof email !== "string") {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

function extractProviderSubscriptionId(object: Record<string, any>) {
  return (
    object.subscription_id ||
    object.subscriptionId ||
    object.subscription?.id ||
    object.id ||
    null
  );
}

function extractProviderCustomerId(
  object: Record<string, any>,
  customer: Record<string, any>
) {
  return (
    customer.id ||
    object.customer_id ||
    object.customerId ||
    object.customer?.id ||
    object.subscription?.customer_id ||
    object.order?.customer_id ||
    null
  );
}

function extractCustomerPortalUrl(object: Record<string, any>) {
  return (
    object.customer_portal_url ||
    object.customerPortalUrl ||
    object.portal_url ||
    object.portalUrl ||
    object.subscription?.customer_portal_url ||
    null
  );
}

function extractCurrentPeriodStart(object: Record<string, any>) {
  return toIsoOrNull(
    object.current_period_start_date ||
      object.current_period_start ||
      object.currentPeriodStart ||
      object.period_start ||
      object.subscription?.current_period_start_date ||
      object.subscription?.current_period_start ||
      object.last_transaction?.period_start
  );
}

function extractCurrentPeriodEnd(object: Record<string, any>) {
  return toIsoOrNull(
    object.current_period_end_date ||
      object.current_period_end ||
      object.currentPeriodEnd ||
      object.period_end ||
      object.subscription?.current_period_end_date ||
      object.subscription?.current_period_end ||
      object.last_transaction?.period_end
  );
}

function extractCanceledAt(object: Record<string, any>) {
  return toIsoOrNull(
    object.canceled_at ||
      object.cancelled_at ||
      object.canceledAt ||
      object.subscription?.canceled_at ||
      object.subscription?.cancelled_at
  );
}

function extractCancelAtPeriodEnd(object: Record<string, any>) {
  return Boolean(
    object.cancel_at_period_end ??
      object.cancelAtPeriodEnd ??
      object.subscription?.cancel_at_period_end ??
      object.subscription?.cancelAtPeriodEnd ??
      false
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("creem-signature");
    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.error("[CREEM WEBHOOK] Missing signature header or webhook secret");
      return NextResponse.json(
        { error: "Missing webhook signature or secret" },
        { status: 401 }
      );
    }

    const isValid = verifyCreemSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error("[CREEM WEBHOOK] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: CreemEvent;

    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[CREEM WEBHOOK] Invalid JSON payload:", parseError);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventId = event.id || null;
    const eventType = getEventType(event);
    const object = event.object || {};
    const metadata = extractMetadata(object);
    const customer = extractCustomer(object);

    const metadataUserId =
      metadata.user_id ||
      metadata.userId ||
      metadata.referenceId ||
      metadata.reference_id ||
      null;

    const email = extractEmail(object, metadata, customer);
    const resolvedUserId = await resolveUserId({
      metadataUserId,
      email,
    });

    const objectStatus = getObjectStatus(object);
    const normalizedStatus = normalizeStatus(
      eventType,
      objectStatus ? String(objectStatus) : null
    );

    const targetPlan = planFromEvent(eventType, object);
    const provider = "creem";

    const providerSubscriptionId = extractProviderSubscriptionId(object);
    const providerCustomerId = extractProviderCustomerId(object, customer);
    const customerPortalUrl = extractCustomerPortalUrl(object);
    const currentPeriodStart = extractCurrentPeriodStart(object);
    const currentPeriodEnd = extractCurrentPeriodEnd(object);
    const canceledAt = extractCanceledAt(object);
    const cancelAtPeriodEnd = extractCancelAtPeriodEnd(object);

    console.log("[CREEM WEBHOOK] Received event", {
      eventId,
      eventType,
      email,
      metadataUserId,
      resolvedUserId,
      objectStatus,
      normalizedStatus,
      targetPlan,
      providerSubscriptionId,
      providerCustomerId,
    });

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
          "[CREEM WEBHOOK] Failed to upsert billing_subscriptions:",
          subscriptionError
        );
        return NextResponse.json(
          { error: "Failed to persist subscription" },
          { status: 500 }
        );
      }

      console.log("[CREEM WEBHOOK] billing_subscriptions upserted", {
        userId: resolvedUserId,
        status: normalizedStatus,
        plan: targetPlan ?? "free",
      });
    } else {
      console.warn(
        "[CREEM WEBHOOK] No matching user could be resolved",
        {
          eventId,
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
          console.error("[CREEM WEBHOOK] Failed to update users.plan by id:", planError);
          return NextResponse.json(
            { error: "Failed to update user plan" },
            { status: 500 }
          );
        }

        console.log("[CREEM WEBHOOK] users.plan updated by id", {
          userId: resolvedUserId,
          plan: targetPlan,
        });
      } else if (email) {
        const { error: planError } = await supabaseAdmin
          .from("users")
          .update({ plan: targetPlan })
          .eq("email", email);

        if (planError) {
          console.error(
            "[CREEM WEBHOOK] Failed to update users.plan by email:",
            planError
          );
          return NextResponse.json(
            { error: "Failed to update user plan" },
            { status: 500 }
          );
        }

        console.log("[CREEM WEBHOOK] users.plan updated by email", {
          email,
          plan: targetPlan,
        });
      } else {
        console.warn("[CREEM WEBHOOK] targetPlan exists but no user/email found", {
          eventId,
          eventType,
          targetPlan,
        });
      }
    } else {
      console.log("[CREEM WEBHOOK] No plan change required", {
        eventId,
        eventType,
        normalizedStatus,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[CREEM WEBHOOK] Handler failed:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}