import { NextResponse } from "next/server";
import { getSenders } from "@/lib/getSenders";

export async function POST() {
  try {
    const result = await getSenders();

    if (!result.scanned) {
      return NextResponse.json(
        { error: "Not authenticated or no messages found" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        scanned: result.scanned,
        topSenders: result.topSenders,
        promotionsSenders: result.promotionsSenders,
        fullInboxPromotionsCount: result.fullInboxPromotionsCount,
        smartViews: result.smartViews,
        smartViewIds: result.smartViewIds,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("POST /api/scan/sample failed:", error);

    return NextResponse.json(
      { error: "Failed to run sample scan" },
      { status: 500 }
    );
  }
}