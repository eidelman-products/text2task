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
  subscription?: JsonRecord;
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

function normalizePeriodEnd(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function updateUserToPro(payload: CreemWebhookPayload) {
  const userId = getUserId(payload);
  const email = getCustomerEmail(payload);
  const currentPeriodEnd = normalizePeriodEnd(getCurrentPeriodEnd(payload));

  const updatePayload = {
    plan: "pro",
    subscription_status: "active",
    pro_started_at: new Date().toISOString(),
    pro_current_period_end: currentPeriodEnd,
  };

  if (userId) {
    const { error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", userId);

    if (error) {
      console.error("Creem webhook failed to update user by id:", error);
      throw error;
    }

    return;
  }

  if (email) {
    const { error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("email", email);

    if (error) {
      console.error("Creem webhook failed to update user by email:", error);
      throw error;
    }

    return;
  }

  throw new Error("Creem webhook missing user identifier");
}

async function downgradeUserToFree(
  payload: CreemWebhookPayload,
  status: string
) {
  const userId = getUserId(payload);
  const email = getCustomerEmail(payload);

  const updatePayload = {
    plan: "free",
    subscription_status: status,
  };

  if (userId) {
    const { error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", userId);

    if (error) {
      console.error("Creem webhook failed to downgrade user by id:", error);
      throw error;
    }

    return;
  }

  if (email) {
    const { error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("email", email);

    if (error) {
      console.error("Creem webhook failed to downgrade user by email:", error);
      throw error;
    }

    return;
  }

  throw new Error("Creem webhook missing user identifier");
}

async function markScheduledCancel(payload: CreemWebhookPayload) {
  const userId = getUserId(payload);
  const email = getCustomerEmail(payload);
  const currentPeriodEnd = normalizePeriodEnd(getCurrentPeriodEnd(payload));

  const updatePayload = {
    subscription_status: "scheduled_cancel",
    pro_current_period_end: currentPeriodEnd,
  };

  if (userId) {
    const { error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", userId);

    if (error) {
      console.error("Creem webhook failed to mark scheduled cancel by id:", error);
      throw error;
    }

    return;
  }

  if (email) {
    const { error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("email", email);

    if (error) {
      console.error(
        "Creem webhook failed to mark scheduled cancel by email:",
        error
      );
      throw error;
    }

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
        await updateUserToPro(payload);
        break;
      }

      case "subscription.scheduled_cancel": {
        await markScheduledCancel(payload);
        break;
      }

      case "subscription.canceled":
      case "subscription.expired":
      case "subscription.past_due":
      case "subscription.paused": {
        await downgradeUserToFree(payload, eventType);
        break;
      }

      case "refund.created":
      case "dispute.created": {
        await downgradeUserToFree(payload, eventType);
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