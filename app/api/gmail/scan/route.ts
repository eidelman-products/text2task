import { NextResponse } from "next/server";
import { getSenders } from "@/lib/getSenders";

export async function GET() {
  try {
    const result = await getSenders();

    if (!result.scanned) {
      return NextResponse.json(
        { error: "Not authenticated or no messages found" },
        { status: 401 }
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/gmail/scan failed:", error);

    return NextResponse.json(
      { error: "Failed to scan Gmail" },
      { status: 500 }
    );
  }
}