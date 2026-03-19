import { NextResponse } from "next/server";
import { getFullScan } from "@/lib/getFullScan";

export async function GET() {
  try {
    const result = await getFullScan();

    // 🔥 רק אם אין result בכלל
    if (!result) {
      return NextResponse.json(
        { error: "Full scan returned no result" },
        { status: 500 }
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/gmail/full-scan failed:", error);

    return NextResponse.json(
      { error: "Failed to run full scan" },
      { status: 500 }
    );
  }
}