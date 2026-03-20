import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Legacy full scan endpoint is disabled. Use /api/scans/start with scanType='full'.",
    },
    { status: 410 }
  );
}