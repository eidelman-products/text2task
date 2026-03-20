import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Legacy sample scan endpoint is disabled. Use /api/scans/start with scanType='sample'.",
    },
    { status: 410 }
  );
}