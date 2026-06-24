import { NextResponse } from "next/server";
import { getPublicCustomerStories } from "@/lib/customer-stories/public-customer-stories.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stories = await getPublicCustomerStories(6);

    return NextResponse.json({
      stories,
    });
  } catch (error) {
    console.error("customer stories public fetch error:", error);

    return NextResponse.json(
      {
        error: "Failed to load customer stories",
      },
      { status: 500 }
    );
  }
}
