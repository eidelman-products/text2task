import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const response = await fetch("https://test-api.creem.io/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CREEM_API_KEY!,
      },
      body: JSON.stringify({
        product_id: "prod_xHbuWozvwlJMhEZD1AEn3",
        customer: {
          email: user.email,
        },
        metadata: {
          user_id: user.id,
          email: user.email,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Creem checkout API error:", data);
      return NextResponse.json(
        { error: "Failed to create checkout", details: data },
        { status: response.status }
      );
    }

    const url =
      data.checkout_url ||
      data.url ||
      data.hosted_checkout_url ||
      data.hosted_url ||
      (data.product && data.id
        ? `https://creem.io/test/checkout/${data.product}/${data.id}`
        : null);

    if (!url) {
      console.error("Creem checkout URL missing:", data);
      return NextResponse.json(
        { error: "Checkout URL missing", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Creem checkout route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}