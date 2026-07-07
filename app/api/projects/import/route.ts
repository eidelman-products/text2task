import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  claimProjectImportAttempt,
  createProjectGroup,
  executeClaimedProjectImport,
  failProjectImportAttempt,
  findProjectDuplicate,
  prepareProjectImportAttemptForDuplicateReview,
  PROJECT_IMPORT_MAX_PROJECTS,
  rollbackCreatedProjects,
  toClaimedImportAttempt,
  validateProjectImportGroups,
  type ClaimedImportAttempt,
  type ProjectImportDuplicateResult,
  type ProjectImportJsonRecord,
  type ProjectImportPersistenceOptions,
  type TransactionalImportFailureCategory,
} from "@/lib/projects/import-persistence.server";
import { createClient } from "@/lib/supabase/server";

const MAX_PROJECTS = PROJECT_IMPORT_MAX_PROJECTS;
const PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA =
  "text_extraction_project_metadata";
const TEXT_EXTRACTION_PROJECT_METADATA_PERSISTENCE_OPTIONS: ProjectImportPersistenceOptions =
  {
    /*
      Keep display/extraction priority neutral in the Preview, but let the
      persistence boundary apply the current DB-safe project priority default
      until project priority can be made nullable by an explicit migration.
    */
    inheritProjectFieldsToSubtasks: false,
  };

const ProjectImportSchema = z
  .object({
    projects: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(MAX_PROJECTS),
    duplicateOverrideGroupIndexes: z
      .array(z.number().int().nonnegative().safe())
      .max(MAX_PROJECTS)
      .default([]),
    idempotencyKey: z.string().uuid().optional(),
    importMode: z
      .literal(PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA)
      .optional(),
  })
  .strict();

type JsonRecord = ProjectImportJsonRecord;

function errorResponse(
  code: string,
  error: string,
  status: number,
  extra: JsonRecord = {}
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error,
      ...extra,
    },
    { status }
  );
}

function transactionalImportFailureResponse(
  category: TransactionalImportFailureCategory
) {
  switch (category) {
    case "unauthorized":
      return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    case "invalid_payload":
      return errorResponse("INVALID_PAYLOAD", "Invalid import request", 400);
    case "attempt_conflict":
      return errorResponse(
        "IMPORT_ATTEMPT_CONFLICT",
        "This import attempt is no longer ready to be processed.",
        409
      );
    case "import_failed":
      console.error("Transactional project import RPC failed");
      return errorResponse("IMPORT_FAILED", "Failed to import projects", 500, {
        createdProjects: [],
        createdTasks: [],
        duplicates: [],
        failedGroups: [],
      });
  }
}

export async function POST(req: NextRequest) {
  let claimedAttempt: ClaimedImportAttempt | null = null;

  try {
    const body = await req.json().catch(() => null);
    const parsed = ProjectImportSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("INVALID_PAYLOAD", "Invalid import request", 400);
    }

    const {
      projects,
      duplicateOverrideGroupIndexes,
      idempotencyKey,
      importMode,
    } = parsed.data;
    const overrideIndexes = new Set(duplicateOverrideGroupIndexes);
    const persistenceOptions =
      importMode === PROJECT_IMPORT_MODE_TEXT_EXTRACTION_PROJECT_METADATA
        ? TEXT_EXTRACTION_PROJECT_METADATA_PERSISTENCE_OPTIONS
        : undefined;

    if (importMode && !idempotencyKey) {
      return errorResponse("INVALID_PAYLOAD", "Invalid import request", 400);
    }

    if (
      duplicateOverrideGroupIndexes.some((index) => index >= projects.length)
    ) {
      return errorResponse(
        "INVALID_PAYLOAD",
        "Invalid duplicate override index",
        400
      );
    }

    const validationFailures = validateProjectImportGroups(projects);

    if (validationFailures.length > 0) {
      return errorResponse(
        "VALIDATION_FAILED",
        "One or more project groups are invalid",
        400,
        { failedGroups: validationFailures }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    }

    if (idempotencyKey) {
      const claim = await claimProjectImportAttempt({
        userId: user.id,
        idempotencyKey,
        projects,
        options: persistenceOptions,
      });

      if (claim.kind === "conflict") {
        return errorResponse(
          "IDEMPOTENCY_KEY_CONFLICT",
          "This import attempt was already used for different project data.",
          409
        );
      }

      if (claim.kind === "replay") {
        return NextResponse.json(claim.result);
      }

      if (claim.kind === "in_progress") {
        return errorResponse(
          "IMPORT_IN_PROGRESS",
          "This import is already being processed.",
          409
        );
      }

      if (claim.kind === "failed") {
        return errorResponse(
          "IMPORT_ATTEMPT_FAILED",
          "This import attempt previously failed and cannot be retried automatically.",
          409,
          {
            previousErrorCode: claim.errorCode,
          }
        );
      }

      claimedAttempt = toClaimedImportAttempt({
        userId: user.id,
        attempt: claim.attempt,
        idempotencyKey,
        requestHash: claim.requestHash,
        payloadJson: claim.payloadJson,
      });
    }

    const duplicates: ProjectImportDuplicateResult[] = [];

    for (let groupIndex = 0; groupIndex < projects.length; groupIndex += 1) {
      if (overrideIndexes.has(groupIndex)) continue;

      const duplicate = await findProjectDuplicate(
        supabase,
        user.id,
        projects[groupIndex]
      );

      if (duplicate) {
        duplicates.push({ groupIndex, duplicate });
      }
    }

    if (duplicates.length > 0) {
      if (claimedAttempt) {
        const duplicateReviewAttempt = claimedAttempt;

        try {
          await prepareProjectImportAttemptForDuplicateReview(
            duplicateReviewAttempt
          );
          claimedAttempt = null;
        } catch {
          console.error("Project import duplicate claim preparation failed");
          await failProjectImportAttempt(
            duplicateReviewAttempt,
            "DUPLICATE_PREFLIGHT_PREPARATION_FAILED"
          );
          claimedAttempt = null;

          return errorResponse(
            "IDEMPOTENCY_PREPARATION_FAILED",
            "Could not safely prepare this import for duplicate review.",
            500
          );
        }
      }

      return errorResponse(
        "DUPLICATE_PROJECT_DETECTED",
        "One or more projects may already exist",
        409,
        {
          duplicates,
          createdProjects: [],
          createdTasks: [],
          failedGroups: [],
        }
      );
    }

    if (claimedAttempt) {
      const transactionalAttempt = claimedAttempt;
      const importResult = await executeClaimedProjectImport(
        transactionalAttempt
      );
      claimedAttempt = null;

      if (importResult.kind === "saved" || importResult.kind === "replay") {
        return NextResponse.json(importResult.result);
      }

      if (importResult.kind === "unparsed_success") {
        /*
          The RPC committed the import and stored this response atomically.
          Keep that committed server result authoritative even if its runtime
          shape cannot be narrowed locally.
        */
        console.error("Invalid transactional project import RPC response:", {
          validationError: importResult.validationError,
        });

        return NextResponse.json(importResult.result);
      }

      return transactionalImportFailureResponse(importResult.category);
    }

    /*
      Compatibility fallback for callers that do not provide an idempotency
      key. Remove this sequential path only after the transactional keyed path
      has been verified in production.
    */
    const createdProjectIds: string[] = [];
    const createdProjects: unknown[] = [];
    const createdTasks: unknown[] = [];
    let activeGroupIndex = 0;

    try {
      for (
        activeGroupIndex = 0;
        activeGroupIndex < projects.length;
        activeGroupIndex += 1
      ) {
        const result = await createProjectGroup({
          supabase,
          userId: user.id,
          body: projects[activeGroupIndex],
          onProjectCreated: (projectId) => createdProjectIds.push(projectId),
        });

        createdProjects.push(result.project);
        createdTasks.push(...result.tasks);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import projects";

      await rollbackCreatedProjects(supabase, user.id, createdProjectIds);

      if (claimedAttempt) {
        await failProjectImportAttempt(claimedAttempt, "IMPORT_FAILED");
        claimedAttempt = null;
      }

      return errorResponse("IMPORT_FAILED", message, 500, {
        createdProjects: [],
        createdTasks: [],
        duplicates: [],
        failedGroups: [{ groupIndex: activeGroupIndex, error: message }],
      });
    }

    const successResult = {
      ok: true,
      createdProjects,
      createdTasks,
      duplicates: [],
      failedGroups: [],
    };

    return NextResponse.json(successResult);
  } catch {
    console.error("Project import route failed");

    if (claimedAttempt) {
      await failProjectImportAttempt(claimedAttempt, "INTERNAL_ERROR");
    }

    return errorResponse("INTERNAL_ERROR", "Failed to import projects", 500);
  }
}
