import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Legacy scan endpoint is disabled. Use /api/scans/start with scanType='sample'.",
    },
    { status: 410 }
  );
}