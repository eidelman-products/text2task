import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  analyzeProjectUpdateV2,
  type AnalyzeProjectUpdateV2Response,
} from "@/lib/project-updates/v2/project-update-v2-analyzer.server";

const ProjectUpdateSourceTypeSchema = z.enum(["text", "image", "email", "manual"]);

const AnalyzeProjectUpdateRequestSchema = z.object({
  projectId: z.string().min(1, "Project id is required."),
  rawInput: z.string().min(1, "Client update message is required.").max(20000),
  sourceType: ProjectUpdateSourceTypeSchema.optional().default("text"),
});

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<AnalyzeProjectUpdateV2Response>(
      {
        ok: false,
        error: "Invalid JSON request body.",
      },
      { status: 400 }
    );
  }

  const parsedBody = AnalyzeProjectUpdateRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json<AnalyzeProjectUpdateV2Response>(
      {
        ok: false,
        error: "Invalid project update analysis request.",
        details: parsedBody.error.flatten(),
      },
      { status: 400 }
    );
  }

  const result = await analyzeProjectUpdateV2({
    projectId: parsedBody.data.projectId,
    rawInput: parsedBody.data.rawInput,
    sourceType:
      parsedBody.data.sourceType === "image" ? "image" : "text",
  });

  return NextResponse.json<AnalyzeProjectUpdateV2Response>(result.response, {
    status: result.status,
  });
}
