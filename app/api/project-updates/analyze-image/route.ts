import { NextRequest, NextResponse } from "next/server";

import {
  analyzeProjectUpdateV2,
  type AnalyzeProjectUpdateV2Response,
} from "@/lib/project-updates/v2/project-update-v2-analyzer.server";
import {
  extractProjectUpdateImageInstructions,
  ProjectUpdateImageError,
} from "@/lib/project-updates/project-update-image.server";

function getStringFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json<AnalyzeProjectUpdateV2Response>(
      {
        ok: false,
        error: "Invalid image analysis request.",
      },
      { status: 400 }
    );
  }

  const projectId = getStringFormValue(formData.get("projectId"));
  const image = formData.get("image");

  if (!projectId) {
    return NextResponse.json<AnalyzeProjectUpdateV2Response>(
      {
        ok: false,
        error: "Project id is required.",
      },
      { status: 400 }
    );
  }

  if (!(image instanceof File)) {
    return NextResponse.json<AnalyzeProjectUpdateV2Response>(
      {
        ok: false,
        error: "Image file is required.",
      },
      { status: 400 }
    );
  }

  let imageResult: Awaited<ReturnType<typeof extractProjectUpdateImageInstructions>>;

  try {
    imageResult = await extractProjectUpdateImageInstructions(image);
  } catch (error) {
    if (error instanceof ProjectUpdateImageError) {
      return NextResponse.json<AnalyzeProjectUpdateV2Response>(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown image analysis error.";

    return NextResponse.json<AnalyzeProjectUpdateV2Response>(
      {
        ok: false,
        error: `Could not read project update image: ${message}`,
      },
      { status: 502 }
    );
  }

  const unifiedRawInput =
    imageResult.extraction.rawTranscription.trim() || imageResult.rawInput;

  const result = await analyzeProjectUpdateV2({
    projectId,
    rawInput: unifiedRawInput,
    sourceType: "image",
  });

  return NextResponse.json<AnalyzeProjectUpdateV2Response>(result.response, {
    status: result.status,
  });
}
