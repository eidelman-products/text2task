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

    const eventType = event.eventType;
    const object = event.object || {};
    const metadata = object.metadata || {};
    const customer = object.customer || {};

    const userId =
      metadata.user_id ||
      metadata.userId ||
      metadata.referenceId ||
      null;

    const email = customer.email || metadata.email || null;

    if (
      eventType === "checkout.completed" ||
      eventType === "subscription.active" ||
      eventType === "subscription.paid" ||
      eventType === "subscription.trialing"
    ) {
      if (userId) {
        await supabaseAdmin.from("users").update({ plan: "pro" }).eq("id", userId);
      } else if (email) {
        await supabaseAdmin.from("users").update({ plan: "pro" }).eq("email", email);
      }

      return NextResponse.json({ received: true });
    }

    if (
      eventType === "subscription.canceled" ||
      eventType === "subscription.expired" ||
      eventType === "subscription.paused"
    ) {
      if (userId) {
        await supabaseAdmin.from("users").update({ plan: "free" }).eq("id", userId);
      } else if (email) {
        await supabaseAdmin.from("users").update({ plan: "free" }).eq("email", email);
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: true });
  } catch (error) {
    console.error("Creem webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}