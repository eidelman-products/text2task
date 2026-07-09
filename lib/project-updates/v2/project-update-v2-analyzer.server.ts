import {
  createProjectTimelineEvent,
  createProjectUpdateAuditItems,
  createProjectUpdateAuditRecord,
} from "@/lib/project-updates/project-update-audit.server";
import { loadProjectUpdateContext } from "@/lib/project-updates/project-update-context.server";
import type {
  ProjectTimelineEvent,
  ProjectUpdate,
  ProjectUpdateItem,
  ProjectUpdateSourceType,
} from "@/lib/project-updates/project-update-types";
import { extractProjectUpdateFacts } from "@/lib/project-updates/v2/project-update-facts.server";
import type {
  ProjectUpdateV2AnalyzerInput,
  ProjectUpdateV2AnalysisSummary,
} from "@/lib/project-updates/v2/project-update-facts.types";
import { judgeProjectUpdateFacts } from "@/lib/project-updates/v2/project-update-judge.server";
import {
  buildProjectUpdateV2AuditItems,
  buildProjectUpdateV2AuditSummary,
  buildProjectUpdateV2TimelineSummary,
} from "@/lib/project-updates/v2/project-update-result-builder.server";

export type AnalyzeProjectUpdateV2Response =
  | {
      ok: true;
      update: ProjectUpdate;
      items: ProjectUpdateItem[];
      timelineEvent: ProjectTimelineEvent | null;
      analysis: ProjectUpdateV2AnalysisSummary;
    }
  | {
      ok: false;
      error: string;
      details?: unknown;
    };

export type AnalyzeProjectUpdateV2ServiceResult = {
  status: number;
  response: AnalyzeProjectUpdateV2Response;
};

/**
 * Project Update V2 analyzer.
 *
 * V2 architecture:
 * 1. Load existing project context.
 * 2. Extract simple facts from raw input.
 * 3. Judge facts deterministically against project/subtasks.
 * 4. Save the same audit/update records the current frontend/apply flow already understands.
 *
 * Important:
 * - Text and Screenshot both enter this function as raw text.
 * - Screenshot route should pass the visible transcription.
 * - AI extracts facts only.
 * - Code decides apply / already exists / no change.
 */
export async function analyzeProjectUpdateV2(
  input: ProjectUpdateV2AnalyzerInput
): Promise<AnalyzeProjectUpdateV2ServiceResult> {
  const { projectId, rawInput, sourceType } = input;

  const contextResult = await loadProjectUpdateContext(projectId);

  if (!contextResult.ok) {
    return {
      status: contextResult.status,
      response: {
        ok: false,
        error: contextResult.error,
      },
    };
  }

  const factsResult = await extractProjectUpdateFacts({
    rawInput,
    sourceType,
  });

  if (!factsResult.ok) {
    return {
      status: 502,
      response: {
        ok: false,
        error: factsResult.error,
        details: factsResult.details,
      },
    };
  }

  const judgeResult = judgeProjectUpdateFacts({
    facts: factsResult.facts,
    context: contextResult.context,
  });

  const auditSummary = buildProjectUpdateV2AuditSummary({
    summary: judgeResult.summary,
    decisions: judgeResult.decisions,
  });

  const updateResult = await createProjectUpdateAuditRecord({
    projectId: contextResult.context.project.id,
    clientId: contextResult.context.project.client_id,
    rawInput: factsResult.normalizedRawInput,
    sourceType: sourceType as ProjectUpdateSourceType,
    status: "analyzed",
    aiSummary: {
      ...auditSummary,
      extractedFacts: factsResult.facts,
    },
  });

  if (!updateResult.ok) {
    return {
      status: updateResult.status,
      response: {
        ok: false,
        error: updateResult.error,
      },
    };
  }

  const itemResult = await createProjectUpdateAuditItems(
    buildProjectUpdateV2AuditItems({
      decisions: judgeResult.decisions,
      projectUpdateId: updateResult.data.id,
      projectId: contextResult.context.project.id,
    })
  );

  if (!itemResult.ok) {
    return {
      status: itemResult.status,
      response: {
        ok: false,
        error: itemResult.error,
      },
    };
  }

  const timelineSummary = buildProjectUpdateV2TimelineSummary({
    summary: judgeResult.summary,
    decisions: judgeResult.decisions,
  });

  const timelineResult = await createProjectTimelineEvent({
    projectId: contextResult.context.project.id,
    eventType: "ai_update_analyzed",
    eventTitle:
      sourceType === "image"
        ? "Screenshot update analyzed"
        : "Client update analyzed",
    eventSummary: timelineSummary,
    sourceUpdateId: updateResult.data.id,
    metadata: {
      engine: "project-update-v2",
      sourceType,
      suggestedItemCount: itemResult.data.length,
      riskLevel: judgeResult.summary.riskLevel,
      extractedFactCounts: {
        requestedSubtasks: factsResult.facts.requestedSubtasks.length,
        notes: factsResult.facts.notes.length,
      },
    },
  });

  return {
    status: 200,
    response: {
      ok: true,
      update: updateResult.data,
      items: itemResult.data,
      timelineEvent: timelineResult.ok ? timelineResult.data : null,
      analysis: judgeResult.summary,
    },
  };
}
