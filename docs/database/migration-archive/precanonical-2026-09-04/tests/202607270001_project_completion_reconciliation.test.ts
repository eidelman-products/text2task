import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection (this repo's migrations are not exercised against a real
// Postgres instance in tests; see the sibling
// 202607230001_project_update_needs_review_type.test.ts for the same
// pattern). It asserts the migration file on disk implements one shared,
// idempotent completion rule and wires it into every transactional
// mutation path that can finish a project's last active subtask.
const MIGRATION_PATH = path.join(
  __dirname,
  "202607270001_project_completion_reconciliation.sql"
);

const BULK_STATUS_MIGRATION_PATH = path.join(
  __dirname,
  "202606150003_transactional_bulk_task_status.sql"
);

const PROJECT_UPDATE_MIGRATION_PATH = path.join(
  __dirname,
  "202607020005_project_update_priority_provenance.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const previousBulkStatusSql = readNormalized(BULK_STATUS_MIGRATION_PATH);
const previousProjectUpdateSql = readNormalized(PROJECT_UPDATE_MIGRATION_PATH);

function extractFunctionBody(source: string, functionName: string): string {
  const startMarker = `create or replace function public.${functionName}(`;
  const startIndex = source.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error(`Could not find function ${functionName} in migration`);
  }

  const endMarker = "\n$$;";
  const endIndex = source.indexOf(endMarker, startIndex);

  if (endIndex === -1) {
    throw new Error(`Could not find end of function ${functionName}`);
  }

  return source.slice(startIndex, endIndex + endMarker.length);
}

describe("202607270001_project_completion_reconciliation.sql - shared reconciliation function", () => {
  const reconcileBody = extractFunctionBody(sql, "reconcile_project_completion");

  it("defines one shared reconcile_project_completion function", () => {
    expect(sql).toContain(
      "create or replace function public.reconcile_project_completion("
    );
  });

  it("excludes archived and soft-deleted tasks from the active-task count", () => {
    expect(reconcileBody).toContain(
      "and (task.is_archived = false or task.is_archived is null)"
    );
    expect(reconcileBody).toContain("and task.deleted_at is null");
  });

  it("never completes a project with zero active subtasks", () => {
    expect(reconcileBody).toMatch(/v_active_task_count = 0/);
  });

  it("only completes when every active subtask is Done (partial completion is a no-op)", () => {
    expect(reconcileBody).toMatch(
      /v_active_task_count = 0 or v_active_task_count <> v_done_task_count/
    );
    expect(reconcileBody).toContain("return false;");
  });

  it("is idempotent: a project already Done is never rewritten", () => {
    expect(reconcileBody).toContain("project.status is distinct from 'Done'");
  });

  it("never overwrites an existing completed_at timestamp", () => {
    expect(reconcileBody).toContain(
      "completed_at = coalesce(project.completed_at, p_now)"
    );
  });

  it("scopes every read and write to the owning user and non-deleted project", () => {
    expect(reconcileBody).toContain("and task.user_id = p_user_id");
    expect(reconcileBody).toContain("and project.user_id = p_user_id");
    expect(reconcileBody).toContain("and project.deleted_at is null");
  });

  it("grants execute only to authenticated, matching the existing security posture", () => {
    expect(sql).toContain(
      "revoke all on function public.reconcile_project_completion(uuid, uuid, timestamptz)\n  from public;"
    );
    expect(sql).toContain(
      "revoke all on function public.reconcile_project_completion(uuid, uuid, timestamptz)\n  from anon;"
    );
    expect(sql).toContain(
      "grant execute on function public.reconcile_project_completion(uuid, uuid, timestamptz)\n  to authenticated;"
    );
  });
});

describe("202607270001 - apply_task_bulk_status_transaction now delegates to the shared function", () => {
  const bulkStatusBody = extractFunctionBody(
    sql,
    "apply_task_bulk_status_transaction"
  );

  it("still only attempts completion for Done updates with at least one affected project", () => {
    expect(bulkStatusBody).toContain(
      "if p_status = 'Done' and cardinality(v_project_ids) > 0 then"
    );
  });

  it("calls the shared reconcile_project_completion function per project instead of inlining the check", () => {
    expect(bulkStatusBody).toContain(
      "if public.reconcile_project_completion(v_project_id, v_user_id, v_now) then"
    );
  });

  it("no longer inlines the bool_and completion query (moved into the shared function)", () => {
    expect(bulkStatusBody).not.toContain("bool_and(lower(btrim(coalesce(task.status");
  });

  it("still returns completedProjectIds in its result shape", () => {
    expect(bulkStatusBody).toContain("'completedProjectIds', to_jsonb(v_completed_project_ids)");
  });

  it("still validates and locks tasks/projects exactly as before (unrelated logic untouched)", () => {
    for (const requiredSnippet of [
      "if p_status is null or p_status not in ('Done', 'In Progress') then",
      "if cardinality(p_task_ids) > 500 then",
      "for update of project",
      "for update of task",
      "if v_locked_project_ids is distinct from v_project_ids then",
      "message = 'CONCURRENT_MODIFICATION';",
      "message = 'TASK_UPDATE_FAILED';",
    ]) {
      expect(bulkStatusBody).toContain(requiredSnippet);
    }
  });

  it("still updates task status and completed_at in the same statement as before", () => {
    expect(bulkStatusBody).toContain(
      "when p_status = 'Done' and task.completed_at is null then v_now"
    );
  });

  it("preserves the exact task-mutation SQL from the prior migration verbatim", () => {
    const taskUpdateSnippet = `  with updated_tasks as (
    update public.tasks as task
    set
      status = p_status,
      updated_at = v_now,
      completed_at = case
        when p_status = 'Done' and task.completed_at is null then v_now
        else task.completed_at
      end
    where task.id = any(v_task_ids)
      and task.user_id = v_user_id
      and task.deleted_at is null
    returning task.id
  )`;

    expect(previousBulkStatusSql).toContain(taskUpdateSnippet);
    expect(bulkStatusBody).toContain(taskUpdateSnippet);
  });
});

describe("202607270001 - apply_project_update_transaction now reconciles project completion", () => {
  const projectUpdateBody = extractFunctionBody(
    sql,
    "apply_project_update_transaction"
  );

  it("calls the shared reconcile_project_completion function for the update's project", () => {
    expect(projectUpdateBody).toContain(
      "perform public.reconcile_project_completion(v_project.id, v_user_id, v_now);"
    );
  });

  it("only reconciles when at least one item was actually accepted", () => {
    const callIndex = projectUpdateBody.indexOf(
      "perform public.reconcile_project_completion"
    );
    const guardIndex = projectUpdateBody.lastIndexOf(
      "if cardinality(v_accepted_ids) > 0 then",
      callIndex
    );

    expect(callIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(-1);
    // The guard must be the one immediately wrapping the reconcile call, not
    // an unrelated earlier `if cardinality(v_accepted_ids) > 0` block -- the
    // nearest preceding `end if;` before the call must belong to a
    // different block, i.e. the guard is the closest one above the call.
    const betweenGuardAndCall = projectUpdateBody.slice(guardIndex, callIndex);
    expect(betweenGuardAndCall).not.toContain("end if;");
  });

  it("reconciles after every task/project mutation from applied items has already executed earlier in the same transaction", () => {
    const applyItemsIndex = projectUpdateBody.indexOf(
      "status = 'applied',\n      accepted_at = v_now,"
    );
    const reconcileIndex = projectUpdateBody.indexOf(
      "perform public.reconcile_project_completion"
    );

    expect(applyItemsIndex).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(applyItemsIndex);
  });

  it("does not swallow a reconciliation failure (no local exception handler around the call)", () => {
    const callIndex = projectUpdateBody.indexOf(
      "perform public.reconcile_project_completion"
    );
    const precedingContext = projectUpdateBody.slice(
      Math.max(0, callIndex - 400),
      callIndex
    );

    expect(precedingContext).not.toContain("exception");
    expect(precedingContext).not.toContain("begin");
  });

  it("never creates duplicate subtasks: the new_subtask insert path is unchanged from the prior migration", () => {
    const insertSnippet = `      insert into public.tasks (
        user_id,
        client_name,
        contact_name,
        client_id,
        project_id,
        subtask_order,
        task_title,
        amount,
        amount_value,
        currency_code,
        deadline_text,
        deadline_date,
        priority,
        status,
        source,
        raw_input,
        is_archived,
        archived_at,
        completed_at,
        deleted_at,
        updated_at
      )`;

    expect(previousProjectUpdateSql).toContain(insertSnippet);
    expect(projectUpdateBody).toContain(insertSnippet);

    const insertCount = (projectUpdateBody.match(/insert into public\.tasks/g) || [])
      .length;
    expect(insertCount).toBe(1);
  });

  it("preserves the update_subtask mutation SQL verbatim, including completed_at handling", () => {
    const updateSubtaskSnippet = `        completed_at = case
          when v_updates ? 'status' then
            case
              when lower(btrim(coalesce(v_updates->>'status', ''))) = 'done'
                then v_now
              else null
            end
          else task.completed_at
        end,`;

    expect(previousProjectUpdateSql).toContain(updateSubtaskSnippet);
    expect(projectUpdateBody).toContain(updateSubtaskSnippet);
  });

  it("preserves item claim, validation, and failure-mode error codes from the prior migration", () => {
    for (const requiredSnippet of [
      "message = 'APPLY_ATTEMPT_MISMATCH';",
      "message = 'ITEM_VALIDATION_FAILED';",
      "message = 'APPLY_PAYLOAD_ITEM_MISMATCH';",
      "message = 'TARGET_TASK_VALIDATION_FAILED';",
      "message = 'SUBTASK_UPDATE_FAILED';",
      "message = 'MARK_APPLIED_ITEMS_FAILED';",
      "message = 'MARK_UPDATE_APPLIED_FAILED';",
    ]) {
      expect(previousProjectUpdateSql).toContain(requiredSnippet);
      expect(projectUpdateBody).toContain(requiredSnippet);
    }
  });

  it("still records user priority provenance for accepted priority_change items, unchanged", () => {
    expect(projectUpdateBody).toContain(
      "message = 'PROJECT_PRIORITY_PROVENANCE_UPDATE_FAILED';"
    );
  });
});

describe("202607270001 - one-time historical backfill", () => {
  const backfillStart = sql.indexOf("with eligible_projects as (");
  const backfillEnd = sql.indexOf(
    "and project.status is distinct from 'Done';",
    backfillStart
  );

  if (backfillStart === -1 || backfillEnd === -1) {
    throw new Error("Could not find the historical backfill statement");
  }

  const backfillSql = sql.slice(
    backfillStart,
    backfillEnd + "and project.status is distinct from 'Done';".length
  );

  it("exists as a one-time statement, not wrapped in a function", () => {
    expect(backfillSql).toContain("with eligible_projects as (");
    expect(backfillSql).toContain("update public.projects as project");
  });

  it("requires at least one active task (having count(*) > 0)", () => {
    expect(backfillSql).toContain("having count(*) > 0");
  });

  it("excludes archived and soft-deleted tasks from eligibility", () => {
    expect(backfillSql).toContain(
      "and (task.is_archived = false or task.is_archived is null)"
    );
    expect(backfillSql).toContain("where task.deleted_at is null");
  });

  it("requires every active task to be Done via the same bool_and rule as the prior bulk-status migration", () => {
    expect(backfillSql).toContain(
      "bool_and(lower(btrim(coalesce(task.status::text, ''))) = 'done')"
    );
  });

  it("is idempotent: only selects projects whose status is not already Done, in both the CTE and the final UPDATE", () => {
    const distinctFromDoneCount = (
      backfillSql.match(/status is distinct from 'Done'/g) || []
    ).length;
    expect(distinctFromDoneCount).toBe(2);
  });

  it("never touches an already-Done project", () => {
    expect(backfillSql).toContain(
      "and project.status is distinct from 'Done'\n"
    );
    expect(backfillSql).toContain(
      "  and project.status is distinct from 'Done';"
    );
  });

  it("preserves an existing completed_at value instead of overwriting it", () => {
    expect(backfillSql).toContain(
      "completed_at = coalesce(project.completed_at, now())"
    );
  });

  it("uses exactly the same canonical completion values as reconcile_project_completion", () => {
    expect(backfillSql).toContain("status = 'Done',");
    expect(backfillSql).toContain("priority = 'Low',");
    expect(backfillSql).toContain("updated_at = now(),");
  });

  it("scopes the eligible-project join to matching user_id, guarding against cross-tenant leakage", () => {
    expect(backfillSql).toContain("and project.user_id = task.user_id");
  });

  it("excludes soft-deleted projects", () => {
    expect(backfillSql).toContain("and project.deleted_at is null");
  });

  it("runs after every function definition, so reconcile_project_completion already exists as the canonical reference", () => {
    const lastFunctionIndex = sql.lastIndexOf(
      "create or replace function public."
    );
    expect(backfillStart).toBeGreaterThan(lastFunctionIndex);
  });
});

describe("202607270001 - single transaction, no partial commit on failure", () => {
  it("every mutating statement lives inside one plpgsql function body (implicit single transaction)", () => {
    const functionStarts = (sql.match(/create or replace function public\./g) || [])
      .length;
    expect(functionStarts).toBe(3);
    expect(sql).not.toMatch(/\bcommit\s*;/i);
    expect(sql).not.toMatch(/\bbegin\s+transaction\b/i);
  });

  it("raises on every validation and mutation failure instead of continuing silently", () => {
    const raiseCount = (sql.match(/raise exception using/g) || []).length;
    expect(raiseCount).toBeGreaterThan(15);
  });
});

describe("202607270001 - direct task-update route no longer duplicates the completion rule", () => {
  const routeSql = readNormalized(
    path.join(
      __dirname,
      "..",
      "..",
      "app",
      "api",
      "tasks",
      "update",
      "route.ts"
    )
  );

  it("removed the dead, unreachable JS-level completion helper", () => {
    expect(routeSql).not.toContain("completeProjectIfEveryTaskDone");
  });

  it("still routes every Done/In Progress status update through the shared transactional RPC", () => {
    expect(routeSql).toContain('"apply_task_bulk_status_transaction"');
  });
});
