import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = await fetch("https://test-api.creem.io/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CREEM_API_KEY!,
      },
      body: JSON.stringify({
        product_id: "prod_xHbuWozvwlJMhEZD1AEn3",
      }),
    });

    const data = await response.json();

    console.log("CREEM RESPONSE:", data);

    return NextResponse.json(data); // 🔥 חשוב
  } catch (error) {
    console.error("Creem checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}