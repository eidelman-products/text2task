import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Standalone resource uploads are no longer supported. Use /api/task-resources/upload-and-create instead.",
      code: "UPLOAD_ENDPOINT_DEPRECATED",
    },
    { status: 410 }
  );
}
