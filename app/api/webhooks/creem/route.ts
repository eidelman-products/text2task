import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type JsonRecord = Record<string, any>;

type CreemWebhookPayload = {
  type?: string;
  event_type?: string;
  eventType?: string;
  data?: JsonRecord;
  object?: JsonRecord;
  metadata?: JsonRecord;
  customer?: JsonRecord;
  customer_id?: string;
  customerId?: string;
  subscription?: JsonRecord;
  subscription_id?: string;
  subscriptionId?: string;
};

function verifyCreemSignature(payload: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function getEventType(payload: CreemWebhookPayload) {
  return payload.type || payload.event_type || payload.eventType || "";
}

function getPayloadData(payload: CreemWebhookPayload): JsonRecord {
  return payload.data || payload.object || {};
}

function asRecord(value: any): JsonRecord | null {
  if (!value || typeof value !== "object") return null;

  return value;
}

function firstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getObjectId(value: any) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const record = asRecord(value);

  return firstString(record?.id, record?.customer_id, record?.customerId);
}

function parseOptionalBoolean(value: any): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return null;
}

function firstBoolean(...values: any[]) {
  for (const value of values) {
    const parsed = parseOptionalBoolean(value);

    if (parsed !== null) return parsed;
  }

  return null;
}

function getMetadata(payload: CreemWebhookPayload): JsonRecord {
  const data = getPayloadData(payload);

  return (
    payload.metadata ||
    data.metadata ||
    data.checkout?.metadata ||
    data.subscription?.metadata ||
    {}
  );
}

function getUserId(payload: CreemWebhookPayload) {
  const metadata = getMetadata(payload);

  return (
    metadata.userId ||
    metadata.user_id ||
    metadata.supabaseUserId ||
    metadata.supabase_user_id ||
    null
  );
}

function getCustomerEmail(payload: CreemWebhookPayload) {
  const data = getPayloadData(payload);
  const metadata = getMetadata(payload);

  return (
    metadata.email ||
    metadata.userEmail ||
    metadata.user_email ||
    payload.customer?.email ||
    data.customer?.email ||
    data.customer_email ||
    data.email ||
    null
  );
}

function getCurrentPeriodEnd(payload: CreemWebhookPayload) {
  const data = getPayloadData(payload);

  return (
    data.current_period_end ||
    data.currentPeriodEnd ||
    data.subscription?.current_period_end ||
    data.subscription?.currentPeriodEnd ||
    payload.subscription?.current_period_end ||
    payload.subscription?.currentPeriodEnd ||
    null
  );
}

function getCustomerId(payload: CreemWebhookPayload) {
  const data = getPayloadData(payload);
  const object = asRecord(payload.object);

  return firstString(
    getObjectId(data.customer),
    data.customer_id,
    data.customerId,
    getObjectId(data.checkout?.customer),
    getObjectId(data.subscription?.customer),
    getObjectId(payload.customer),
    payload.customer_id,
    payload.customerId,
    getObjectId(object?.customer),
    object?.customer_id,
    object?.customerId
  );
}

function looksLikeSubscriptionObject(value: JsonRecord) {
  return Boolean(
    firstString(value.id) &&
      (value.object === "subscription" ||
        value.type === "subscription" ||
        value.entity === "subscription" ||
        value.status ||
        value.current_period_end ||
        value.currentPeriodEnd ||
        typeof value.cancel_at_period_end === "boolean" ||
        typeof value.cancelAtPeriodEnd === "boolean" ||
        value.customer ||
        value.customer_id ||
        value.customerId)
  );
}

function getSubscriptionId(
  payload: CreemWebhookPayload,
  eventType: string
) {
  const data = getPayloadData(payload);
  const object = asRecord(payload.object);
  const directSubscriptionId =
    eventType.startsWith("subscription.") && looksLikeSubscriptionObject(data)
    ? firstString(data.id)
    : null;

  return firstString(
    getObjectId(data.subscription),
    data.subscription_id,
    data.subscriptionId,
    getObjectId(payload.subscription),
    payload.subscription_id,
    payload.subscriptionId,
    getObjectId(object?.subscription),
    object?.subscription_id,
    object?.subscriptionId,
    directSubscriptionId
  );
}

function getCancelAtPeriodEnd(payload: CreemWebhookPayload) {
  const data = getPayloadData(payload);

  return firstBoolean(
    data.cancel_at_period_end,
    data.cancelAtPeriodEnd,
    data.subscription?.cancel_at_period_end,
    data.subscription?.cancelAtPeriodEnd,
    payload.subscription?.cancel_at_period_end,
    payload.subscription?.cancelAtPeriodEnd
  );
}

function getBillingProviderUpdate(
  payload: CreemWebhookPayload,
  eventType: string,
  fallbackCancelAtPeriodEnd?: boolean
) {
  const updatePayload: JsonRecord = {
    billing_updated_at: new Date().toISOString(),
  };

  const customerId = getCustomerId(payload);
  const subscriptionId = getSubscriptionId(payload, eventType);
  const cancelAtPeriodEnd = getCancelAtPeriodEnd(payload);

  if (customerId) {
    updatePayload.creem_customer_id = customerId;
  }

  if (subscriptionId) {
    updatePayload.creem_subscription_id = subscriptionId;
  }

  if (cancelAtPeriodEnd !== null) {
    updatePayload.cancel_at_period_end = cancelAtPeriodEnd;
  } else if (typeof fallbackCancelAtPeriodEnd === "boolean") {
    updatePayload.cancel_at_period_end = fallbackCancelAtPeriodEnd;
  }

  return updatePayload;
}

function normalizePeriodEnd(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function updateBillingUser({
  updatePayload,
  identifier,
  identifierValue,
  eventType,
  action,
}: {
  updatePayload: JsonRecord;
  identifier: "id" | "email";
  identifierValue: string;
  eventType: string;
  action: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updatePayload)
    .eq(identifier, identifierValue)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`Creem webhook failed to ${action}:`, {
      eventType,
      identifier,
      error,
    });
    throw error;
  }

  if (!data?.id) {
    console.error("Creem webhook did not match a Text2Task user:", {
      eventType,
      identifier,
      action,
    });
    throw new Error("Creem webhook did not match a Text2Task user");
  }

  return data.id as string;
}

async function updateUserToPro(
  payload: CreemWebhookPayload,
  eventType: string
) {
  const userId = getUserId(payload);
  const email = getCustomerEmail(payload);
  const currentPeriodEnd = normalizePeriodEnd(getCurrentPeriodEnd(payload));

  const updatePayload: JsonRecord = {
    plan: "pro",
    subscription_status: "active",
    pro_started_at: new Date().toISOString(),
    pro_current_period_end: currentPeriodEnd,
    ...getBillingProviderUpdate(payload, eventType, false),
  };

  if (userId) {
    await updateBillingUser({
      updatePayload,
      identifier: "id",
      identifierValue: userId,
      eventType,
      action: "update user to Pro by id",
    });
    return;
  }

  if (email) {
    await updateBillingUser({
      updatePayload,
      identifier: "email",
      identifierValue: email,
      eventType,
      action: "update user to Pro by email",
    });
    return;
  }

  throw new Error("Creem webhook missing user identifier");
}

async function downgradeUserToFree(
  payload: CreemWebhookPayload,
  eventType: string,
  status: string
) {
  const userId = getUserId(payload);
  const email = getCustomerEmail(payload);

  const updatePayload: JsonRecord = {
    plan: "free",
    subscription_status: status,
    ...getBillingProviderUpdate(payload, eventType, false),
  };

  if (userId) {
    await updateBillingUser({
      updatePayload,
      identifier: "id",
      identifierValue: userId,
      eventType,
      action: "downgrade user by id",
    });
    return;
  }

  if (email) {
    await updateBillingUser({
      updatePayload,
      identifier: "email",
      identifierValue: email,
      eventType,
      action: "downgrade user by email",
    });
    return;
  }

  throw new Error("Creem webhook missing user identifier");
}

async function markScheduledCancel(
  payload: CreemWebhookPayload,
  eventType: string
) {
  const userId = getUserId(payload);
  const email = getCustomerEmail(payload);
  const currentPeriodEnd = normalizePeriodEnd(getCurrentPeriodEnd(payload));

  const updatePayload: JsonRecord = {
    subscription_status: "scheduled_cancel",
    pro_current_period_end: currentPeriodEnd,
    ...getBillingProviderUpdate(payload, eventType, true),
  };

  if (userId) {
    await updateBillingUser({
      updatePayload,
      identifier: "id",
      identifierValue: userId,
      eventType,
      action: "mark scheduled cancel by id",
    });
    return;
  }

  if (email) {
    await updateBillingUser({
      updatePayload,
      identifier: "email",
      identifierValue: email,
      eventType,
      action: "mark scheduled cancel by email",
    });
    return;
  }

  throw new Error("Creem webhook missing user identifier");
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Missing CREEM_WEBHOOK_SECRET");
      return NextResponse.json(
        { error: "Webhook secret is not configured" },
        { status: 500 }
      );
    }

    const signature = req.headers.get("creem-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Creem signature" },
        { status: 401 }
      );
    }

    const rawBody = await req.text();

    const isValidSignature = verifyCreemSignature(
      rawBody,
      signature,
      webhookSecret
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid Creem signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody) as CreemWebhookPayload;
    const eventType = getEventType(payload);

    console.log("Received Creem webhook:", eventType);

    switch (eventType) {
      case "checkout.completed":
      case "subscription.active":
      case "subscription.paid":
      case "subscription.trialing": {
        await updateUserToPro(payload, eventType);
        break;
      }

      case "subscription.scheduled_cancel": {
        await markScheduledCancel(payload, eventType);
        break;
      }

      case "subscription.canceled":
      case "subscription.expired":
      case "subscription.past_due":
      case "subscription.paused": {
        await downgradeUserToFree(payload, eventType, eventType);
        break;
      }

      case "refund.created":
      case "dispute.created": {
        await downgradeUserToFree(payload, eventType, eventType);
        break;
      }

      default: {
        console.log("Unhandled Creem webhook event:", eventType);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Creem webhook error:", error);

    return NextResponse.json(
      { error: "Failed to process Creem webhook" },
      { status: 500 }
    );
  }
}
