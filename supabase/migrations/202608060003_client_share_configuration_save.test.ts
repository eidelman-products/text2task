import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202608060002_client_share_access_operations.test.ts).
const MIGRATION_PATH = path.join(
  __dirname,
  "202608060003_client_share_configuration_save.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const normalizedSql = sql.toLowerCase();

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const code = stripLineComments(sql);
const normalizedCode = code.toLowerCase();

function stripCommentOnStatements(source: string): string {
  return source.replace(/comment on [\s\S]*?';/g, "");
}

const executable = stripCommentOnStatements(code);
const normalizedExecutable = executable.toLowerCase();

function normalizeWhitespace(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

const FUNCTION_NAME = "save_share_configuration";
const FUNCTION_SIGNATURE = "uuid, jsonb, jsonb, jsonb, jsonb";

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

const body = extractFunctionBody(code, FUNCTION_NAME);
const normalizedBody = normalizeWhitespace(body);
const lowerBody = body.toLowerCase();

function normalizedWhitespaceCodeContains(fragment: string): boolean {
  return normalizeWhitespace(code).includes(normalizeWhitespace(fragment));
}

describe("202608060003 - function existence, security posture and grants", () => {
  it("declares public.save_share_configuration with the exact signature", () => {
    expect(code).toContain(
      "create or replace function public.save_share_configuration(\n  p_link_id uuid,\n  p_settings jsonb,\n  p_tasks jsonb,\n  p_resources jsonb,\n  p_publish_update jsonb\n)"
    );
  });

  it("is plpgsql, SECURITY DEFINER, with an explicit locked search_path", () => {
    expect(body).toContain("returns jsonb");
    expect(body).toContain("language plpgsql");
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = public, pg_temp");
    expect(body).not.toContain("security invoker");
  });

  it("obtains and null-checks auth.uid() internally", () => {
    expect(body).toContain("v_user_id uuid := auth.uid();");
    expect(body).toContain("if v_user_id is null then");
    expect(body).toContain("message = 'UNAUTHORIZED'");
  });

  it("accepts no user_id or project_id parameter, and no generic table/column/value parameter", () => {
    const startMarker = "create or replace function public.save_share_configuration(";
    const startIndex = code.indexOf(startMarker);
    const paramsEnd = code.indexOf(")\nreturns", startIndex);
    const paramList = code.slice(startIndex + startMarker.length, paramsEnd).toLowerCase();
    expect(paramList).not.toMatch(/p_user_id/);
    expect(paramList).not.toMatch(/p_project_id/);
    expect(paramList).not.toMatch(/p_table/);
    expect(paramList).not.toMatch(/p_column/);
  });

  it("contains no dynamic SQL (EXECUTE statement) anywhere in the migration", () => {
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+'/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+format\(/);
    expect(normalizedExecutable).not.toMatch(/\bexecute\s+v_/);
  });

  it("is revoked from public, anon and service_role, and granted execute only to authenticated", () => {
    for (const role of ["public", "anon", "service_role"]) {
      expect(
        normalizedWhitespaceCodeContains(
          `revoke all on function public.${FUNCTION_NAME}(${FUNCTION_SIGNATURE}) from ${role};`
        )
      ).toBe(true);
    }
    expect(
      normalizedWhitespaceCodeContains(
        `grant execute on function public.${FUNCTION_NAME}(${FUNCTION_SIGNATURE}) to authenticated;`
      )
    ).toBe(true);
  });

  it("grants execute to no other role", () => {
    const grants = code.match(/^grant execute on function[^;]*;/gm) ?? [];
    expect(grants).toHaveLength(1);
    const grant = (grants[0] ?? "").toLowerCase();
    expect(grant).not.toMatch(/\bto public\b/);
    expect(grant).not.toMatch(/\bto anon\b/);
    expect(grant).not.toMatch(/\bto service_role\b/);
  });

  it("grants no direct table DML anywhere in the migration", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      const normalized = grant.toLowerCase();
      if (normalized.startsWith("grant execute")) {
        continue;
      }
      expect(normalized).not.toMatch(/\b(insert|update|delete|select)\b/);
    }
  });

  it("does not modify any RLS policy, trigger or constraint anywhere in the migration", () => {
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/alter policy/);
    expect(normalizedCode).not.toMatch(/drop policy/);
    expect(normalizedCode).not.toMatch(/create trigger/);
    expect(normalizedCode).not.toMatch(/drop trigger/);
    expect(normalizedCode).not.toMatch(/alter table[^;]*add constraint/);
    expect(normalizedCode).not.toMatch(/alter table[^;]*drop constraint/);
  });

  it("comments the function", () => {
    expect(code).toContain(`comment on function public.${FUNCTION_NAME}(`);
  });
});

describe("202608060003 - scope boundaries", () => {
  it("creates only save_share_configuration -- no separate task/resource/update/settings RPC", () => {
    const functionDeclarations = code.match(
      /create or replace function public\.\w+\(/g
    ) ?? [];
    expect(functionDeclarations).toHaveLength(1);
    expect(functionDeclarations[0]).toBe(
      "create or replace function public.save_share_configuration("
    );

    for (const forbidden of [
      "replace_share_link_tasks",
      "replace_share_link_resources",
      "publish_share_link_update",
      "update_share_link_settings",
      "save_share_link_settings",
      "save_share_link_tasks",
      "save_share_link_resources",
    ]) {
      expect(normalizedCode).not.toContain(forbidden);
    }
  });

  it("implements no lifecycle, PIN, expiry, secret, session or public-view operation", () => {
    for (const forbidden of [
      "create_share_link_draft",
      "activate_share_link",
      "disable_share_link",
      "reenable_share_link",
      "set_share_link_pin",
      "clear_share_link_pin",
      "set_share_link_expiry",
      "clear_share_link_expiry",
      "rotate_share_link_secret",
      "revoke_share_link",
      "reveal_share_link_secret",
      "get_share_link_management_state",
      "list_share_link_summaries",
    ]) {
      expect(normalizedCode).not.toContain(`create or replace function public.${forbidden}(`);
    }
  });

  it("writes no share_link_events row for this operation", () => {
    expect(lowerBody).not.toContain("share_link_events");
  });

  it("performs no DML against share_browser_sessions or share_session_grants", () => {
    expect(lowerBody).not.toContain("share_browser_sessions");
    expect(lowerBody).not.toContain("share_session_grants");
  });

  it("references no secret/PIN column anywhere in the function body", () => {
    for (const forbidden of [
      "secret_digest",
      "pin_hash",
      "pin_salt",
      "pin_hash_version",
      "pin_scrypt",
      "pin_key_length",
      "ciphertext",
      "auth_tag",
    ]) {
      expect(lowerBody).not.toContain(forbidden);
    }
  });

  it("never sets public_id, activated_at, disabled_at, rotated_at, revoked_at, view_count, last_viewed_at or state on project_share_links", () => {
    const updateStart = body.indexOf("update public.project_share_links");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    for (const forbidden of [
      "public_id =",
      "activated_at =",
      "disabled_at =",
      "rotated_at =",
      "revoked_at =",
      "view_count =",
      "last_viewed_at =",
      "state =",
    ]) {
      expect(updateText).not.toContain(forbidden);
    }
  });

  it("never edits an existing published update's immutable body, version or published_at", () => {
    const updateStart = body.indexOf("update public.share_link_updates");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    expect(updateText).toContain("is_current = false");
    expect(updateText).not.toContain("body =");
    expect(updateText).not.toContain("version =");
    expect(updateText).not.toContain("published_at =");
  });
});

describe("202608060003 - validation", () => {
  it("validates p_settings type, exact keys, and requires at least one recognized key when supplied", () => {
    expect(body).toContain("if jsonb_typeof(p_settings) <> 'object' then");
    expect(body).toContain(
      "(p_settings - 'commentsEnabled' - 'clientFacingSubtitle' - 'contentDirection')\n      <> '{}'::jsonb"
    );
    expect(body).toContain("if p_settings = '{}'::jsonb then");
    expect(body).toContain("message = 'INVALID_SETTINGS'");
  });

  it("validates p_tasks is an array with a finite 500-item cap", () => {
    expect(body).toContain("if jsonb_typeof(p_tasks) <> 'array' then");
    expect(body).toContain("if jsonb_array_length(p_tasks) > 500 then");
    expect(body).toContain("message = 'INVALID_TASKS'");
  });

  it("validates p_resources is an array with a finite 500-item cap", () => {
    expect(body).toContain("if jsonb_typeof(p_resources) <> 'array' then");
    expect(body).toContain("if jsonb_array_length(p_resources) > 500 then");
    expect(body).toContain("message = 'INVALID_RESOURCES'");
  });

  it("requires exact task item keys, rejecting unknown and missing keys", () => {
    expect(body).toContain(
      "v_task_item\n          - 'subtaskId' - 'publicGroup'\n          - 'waitingForClientFeedback' - 'displayOrder'\n      ) <> '{}'::jsonb"
    );
    expect(body).toContain("v_task_item ? 'subtaskId'");
    expect(body).toContain("v_task_item ? 'publicGroup'");
    expect(body).toContain("v_task_item ? 'waitingForClientFeedback'");
    expect(body).toContain("v_task_item ? 'displayOrder'");
  });

  it("requires exact resource item keys, rejecting unknown and missing keys", () => {
    expect(body).toContain(
      "v_resource_item\n          - 'resourceId' - 'publicLabel' - 'canDownload' - 'displayOrder'\n      ) <> '{}'::jsonb"
    );
    expect(body).toContain("v_resource_item ? 'resourceId'");
    expect(body).toContain("v_resource_item ? 'publicLabel'");
    expect(body).toContain("v_resource_item ? 'canDownload'");
    expect(body).toContain("v_resource_item ? 'displayOrder'");
  });

  it("validates the canonical decimal subtaskId string before ever casting to bigint, and turns a cast failure into a stable INVALID_TASKS error", () => {
    const regexIndex = body.indexOf("(v_task_item->>'subtaskId') !~ '^[1-9][0-9]*$'");
    const castIndex = body.indexOf("v_task_id := (v_task_item->>'subtaskId')::bigint;");
    expect(regexIndex).toBeGreaterThan(-1);
    expect(castIndex).toBeGreaterThan(-1);
    expect(regexIndex).toBeLessThan(castIndex);

    const castBlockStart = body.indexOf("begin\n        v_task_id");
    const castBlockEnd = body.indexOf("end;", castBlockStart);
    const castBlock = body.slice(castBlockStart, castBlockEnd);
    expect(castBlock).toContain("exception");
    expect(castBlock).toContain("when others then");
    expect(castBlock).toContain("message = 'INVALID_TASKS'");
  });

  it("rejects a duplicate subtaskId before accumulating it", () => {
    expect(body).toContain("if v_task_id = any(v_task_ids) then");
    const dupIndex = body.indexOf("if v_task_id = any(v_task_ids) then");
    const appendIndex = body.indexOf("v_task_ids := array_append(v_task_ids, v_task_id);");
    expect(dupIndex).toBeGreaterThan(-1);
    expect(appendIndex).toBeGreaterThan(-1);
    expect(dupIndex).toBeLessThan(appendIndex);
  });

  it("rejects a duplicate resourceId before accumulating it", () => {
    expect(body).toContain("if v_resource_id = any(v_resource_ids) then");
    const dupIndex = body.indexOf("if v_resource_id = any(v_resource_ids) then");
    const appendIndex = body.indexOf(
      "v_resource_ids := array_append(v_resource_ids, v_resource_id);"
    );
    expect(dupIndex).toBeGreaterThan(-1);
    expect(appendIndex).toBeGreaterThan(-1);
    expect(dupIndex).toBeLessThan(appendIndex);
  });

  it("validates publicGroup against the closed vocabulary", () => {
    expect(body).toContain(
      "(v_task_item->>'publicGroup') not in (\n          'in_progress', 'waiting_for_feedback', 'completed', 'coming_up'\n        )"
    );
  });

  it("rejects a non-boolean waitingForClientFeedback/canDownload/commentsEnabled", () => {
    expect(body).toContain("jsonb_typeof(v_task_item->'waitingForClientFeedback') <> 'boolean'");
    expect(body).toContain("jsonb_typeof(v_resource_item->'canDownload') <> 'boolean'");
    expect(body).toContain("jsonb_typeof(p_settings->'commentsEnabled') <> 'boolean'");
  });

  it("rejects a negative, fractional or malformed displayOrder via the digits-only regex on the number's own text", () => {
    const taskCheck =
      "jsonb_typeof(v_task_item->'displayOrder') <> 'number'\n        or (v_task_item->>'displayOrder') !~ '^[0-9]+$'";
    const resourceCheck =
      "jsonb_typeof(v_resource_item->'displayOrder') <> 'number'\n        or (v_resource_item->>'displayOrder') !~ '^[0-9]+$'";
    expect(body).toContain(taskCheck);
    expect(body).toContain(resourceCheck);
  });

  it("bounds displayOrder to the delivered integer column's range through an overflow-safe numeric cast, never an unprotected bigint cast", () => {
    expect(body).toContain("(v_task_item->>'displayOrder')::numeric > 2147483647");
    expect(body).toContain("(v_resource_item->>'displayOrder')::numeric > 2147483647");
    // No unprotected `::bigint` cast of displayOrder remains anywhere --
    // only the already-regex-validated subtaskId (wrapped in its own
    // begin/exception block above) ever reaches a bigint cast in this
    // function.
    expect(body).not.toContain("displayOrder')::bigint");
    expect(body).toContain("(v_task_item->>'displayOrder')::integer");
    expect(body).toContain("(v_resource_item->>'displayOrder')::integer");
  });

  it("only casts displayOrder to integer after the numeric bound has been proven, never before", () => {
    const taskBoundIndex = body.indexOf("(v_task_item->>'displayOrder')::numeric > 2147483647");
    const taskCastIndex = body.indexOf("(v_task_item->>'displayOrder')::integer");
    expect(taskBoundIndex).toBeGreaterThan(-1);
    expect(taskCastIndex).toBeGreaterThan(-1);
    expect(taskBoundIndex).toBeLessThan(taskCastIndex);

    const resourceBoundIndex = body.indexOf(
      "(v_resource_item->>'displayOrder')::numeric > 2147483647"
    );
    const resourceCastIndex = body.indexOf("(v_resource_item->>'displayOrder')::integer");
    expect(resourceBoundIndex).toBeGreaterThan(-1);
    expect(resourceCastIndex).toBeGreaterThan(-1);
    expect(resourceBoundIndex).toBeLessThan(resourceCastIndex);
  });

  it("validates the UUID-shaped resourceId with a case-insensitive hex-dash regex before casting", () => {
    expect(body).toContain(
      "(v_resource_item->>'resourceId') !~\n          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'"
    );
    expect(body).toContain("v_resource_id := lower(v_resource_item->>'resourceId')::uuid;");
  });

  it("validates clientFacingSubtitle against the exact table constraint bounds (btrim length 1-200), and preserves the submitted text untrimmed", () => {
    expect(body).toContain("char_length(v_client_facing_subtitle) > 200");
    expect(body).toContain("char_length(btrim(v_client_facing_subtitle)) < 1");
    expect(body).toContain("v_client_facing_subtitle := p_settings->>'clientFacingSubtitle';");
  });

  it("validates publicLabel against the exact table constraint bounds (btrim length 1-120), and preserves the submitted text untrimmed", () => {
    expect(body).toContain("char_length(v_resource_label) > 120");
    expect(body).toContain("char_length(btrim(v_resource_label)) < 1");
    expect(body).toContain("v_resource_label := v_resource_item->>'publicLabel';");
  });

  it("validates publishUpdate.body against the exact table constraint bounds (btrim length 1-5000), and preserves the submitted text untrimmed", () => {
    expect(body).toContain("char_length(v_publish_body) > 5000");
    expect(body).toContain("char_length(btrim(v_publish_body)) < 1");
    expect(body).toContain("v_publish_body := p_publish_update->>'body';");
  });

  it("requires exactly the single body key on p_publish_update", () => {
    expect(body).toContain("(p_publish_update - 'body') <> '{}'::jsonb");
    expect(body).toContain("not (p_publish_update ? 'body')");
  });

  it("rejects an all-null request (no group supplied) with a stable error", () => {
    expect(body).toContain(
      "if p_settings is null\n    and p_tasks is null\n    and p_resources is null\n    and p_publish_update is null\n  then"
    );
    expect(body).toContain("message = 'INVALID_CONFIGURATION'");
  });

  it("performs every shape/type/bounds validation block before the first lock is acquired", () => {
    const lastValidationIndex = body.lastIndexOf("message = 'INVALID_CONFIGURATION'");
    const firstLockIndex = body.indexOf("for update");
    expect(lastValidationIndex).toBeGreaterThan(-1);
    expect(firstLockIndex).toBeGreaterThan(-1);
    expect(lastValidationIndex).toBeLessThan(firstLockIndex);
  });
});

describe("202608060003 - locking, ownership and state", () => {
  it("locks the owning project row before the target link row (project-then-link order)", () => {
    const projectLockIndex = normalizedBody.indexOf(
      "from public.projects as project where project.id = v_project_id for update"
    );
    const linkLockIndex = normalizedBody.indexOf(
      "from public.project_share_links as link where link.id = p_link_id and link.user_id = v_user_id for update"
    );
    expect(projectLockIndex).toBeGreaterThan(-1);
    expect(linkLockIndex).toBeGreaterThan(-1);
    expect(projectLockIndex).toBeLessThan(linkLockIndex);
  });

  it("rejects a deleted project as SHARE_LINK_NOT_FOUND", () => {
    expect(body).toContain("if v_locked_project_id is null or v_project_deleted_at is not null then");
  });

  it("rejects an archived project as PROJECT_ARCHIVED, checked only after the project lock is held", () => {
    const lockIndex = normalizedBody.indexOf(
      "from public.projects as project where project.id = v_project_id for update"
    );
    const archivedCheckIndex = body.indexOf("if v_project_is_archived then");
    expect(archivedCheckIndex).toBeGreaterThan(-1);
    expect(normalizeWhitespace(body.slice(0, archivedCheckIndex)).indexOf(
      normalizeWhitespace("from public.projects as project where project.id = v_project_id for update")
    )).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(-1);
    expect(body).toContain("message = 'PROJECT_ARCHIVED'");
  });

  it("rejects a revoked link", () => {
    expect(body).toContain("if v_link_state = 'revoked' then");
    expect(body).toContain("message = 'SHARE_LINK_REVOKED'");
  });

  it("returns SHARE_LINK_NOT_FOUND for a nonexistent or other-owner link, never revealing existence otherwise", () => {
    const notFoundOccurrences = body.match(/message = 'SHARE_LINK_NOT_FOUND'/g) ?? [];
    expect(notFoundOccurrences.length).toBeGreaterThanOrEqual(3);
    expect(body).toContain("and link.user_id = v_user_id");
  });

  it("never assigns to the state column of project_share_links -- link lifecycle state is not changed", () => {
    const updateStart = body.indexOf("update public.project_share_links");
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd).toLowerCase();
    expect(updateText).not.toMatch(/(?<![a-z_])state\s*=/);
  });
});

describe("202608060003 - settings behavior", () => {
  it("supports partial settings -- only supplied fields change via a CASE/self-reference on the current value", () => {
    const updateStart = body.indexOf(
      "update public.project_share_links\n      set\n        comments_enabled = case"
    );
    expect(updateStart).toBeGreaterThan(-1);
    const updateEnd = body.indexOf(";", updateStart);
    const updateText = body.slice(updateStart, updateEnd);
    expect(updateText).toContain("when v_has_comments_enabled then v_comments_enabled\n          else comments_enabled");
    expect(updateText).toContain(
      "when v_has_client_facing_subtitle then v_client_facing_subtitle\n          else client_facing_subtitle"
    );
    expect(updateText).toContain(
      "when v_has_content_direction then v_content_direction\n          else content_direction"
    );
  });

  it("determines a genuine settings change with IS DISTINCT FROM", () => {
    expect(body).toContain("v_comments_enabled is distinct from v_old_comments_enabled");
    expect(body).toContain(
      "v_client_facing_subtitle is distinct from v_old_client_facing_subtitle"
    );
    expect(body).toContain("v_content_direction is distinct from v_old_content_direction");
  });

  it("increases configuration_version exactly once, and only inside the v_settings_changed branch", () => {
    const versionAssignments = body.match(/v_new_configuration_version := v_link_configuration_version \+ 1;/g) ?? [];
    expect(versionAssignments).toHaveLength(1);
    const branchStart = body.indexOf("if v_settings_changed then");
    const branchEnd = body.indexOf("end if;", branchStart);
    const branch = body.slice(branchStart, branchEnd);
    expect(branch).toContain("v_new_configuration_version := v_link_configuration_version + 1;");
  });

  it("does not run the settings UPDATE at all when settings are omitted or unchanged (no-op leaves updated_at untouched)", () => {
    const updateCount = (
      body.match(/update public\.project_share_links/g) ?? []
    ).length;
    expect(updateCount).toBe(1);
    const updateIndex = body.indexOf("update public.project_share_links");
    const guardIndex = body.lastIndexOf("if v_settings_changed then", updateIndex);
    expect(guardIndex).toBeGreaterThan(-1);
  });

  it("never bumps configuration_version for a task-only, resource-only or update-only call", () => {
    // The only assignment that increases configuration_version above the
    // link's existing value lives inside the v_settings_changed branch
    // (asserted above); tasks/resources/publishUpdate sections never
    // reference v_new_configuration_version at all.
    const taskMutationStart = body.indexOf("if p_tasks is not null then\n    if cardinality(v_task_ids)");
    const taskMutationEnd = body.indexOf("end if;", body.indexOf("TASK_SET_VERIFICATION_FAILED"));
    const taskMutationBlock = body.slice(taskMutationStart, taskMutationEnd);
    expect(taskMutationBlock).not.toContain("v_new_configuration_version");

    const resourceMutationStart = body.indexOf(
      "if p_resources is not null then\n    if cardinality(v_resource_ids)"
    );
    const resourceMutationEnd = body.indexOf(
      "end if;",
      body.indexOf("RESOURCE_SET_VERIFICATION_FAILED")
    );
    const resourceMutationBlock = body.slice(resourceMutationStart, resourceMutationEnd);
    expect(resourceMutationBlock).not.toContain("v_new_configuration_version");

    const publishStart = body.indexOf("if p_publish_update is not null then\n    update public.share_link_updates");
    const publishEnd = body.indexOf("end if;", body.indexOf("PUBLISH_UPDATE_INSERT_FAILED"));
    const publishBlock = body.slice(publishStart, publishEnd);
    expect(publishBlock).not.toContain("v_new_configuration_version");
  });
});

describe("202608060003 - task set-replacement behavior", () => {
  it("leaves the mapping unchanged when p_tasks is null", () => {
    const taskMutationGuard = body.indexOf("if p_tasks is not null then\n    if cardinality(v_task_ids)");
    expect(taskMutationGuard).toBeGreaterThan(-1);
  });

  it("deletes rows absent from the submitted set (an empty submitted set clears every row)", () => {
    expect(normalizedBody).toContain(
      "delete from public.share_link_tasks where share_link_id = p_link_id and user_id = v_user_id and not (subtask_id = any(v_task_ids))"
    );
  });

  it("inserts the submitted set and updates only presentation fields on conflict", () => {
    expect(body).toContain("insert into public.share_link_tasks (");
    expect(body).toContain("on conflict (share_link_id, subtask_id) do update");
    const conflictStart = body.indexOf("on conflict (share_link_id, subtask_id) do update");
    const conflictEnd = body.indexOf(";", conflictStart);
    const conflictText = body.slice(conflictStart, conflictEnd);
    expect(conflictText).toContain("public_group = excluded.public_group");
    expect(conflictText).toContain("waiting_for_client_feedback = excluded.waiting_for_client_feedback");
    expect(conflictText).toContain("display_order = excluded.display_order");
    expect(conflictText).not.toContain("subtask_id =");
    expect(conflictText).not.toContain("share_link_id =");
    expect(conflictText).not.toContain("user_id =");
  });

  it("supplies user_id, share_link_id and subtask_id on every inserted row", () => {
    const insertStart = body.indexOf("insert into public.share_link_tasks (");
    const insertEnd = body.indexOf("on conflict", insertStart);
    const insertText = body.slice(insertStart, insertEnd).toLowerCase();
    expect(insertText).toContain("user_id");
    expect(insertText).toContain("share_link_id");
    expect(insertText).toContain("subtask_id");
    expect(insertText).toContain("v_user_id");
    expect(insertText).toContain("p_link_id");
  });

  it("prevalidates every task's owner, project and deletion state before mutating", () => {
    const prevalidationStart = body.indexOf("left join public.tasks as task");
    const deleteIndex = body.indexOf("delete from public.share_link_tasks");
    expect(prevalidationStart).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(prevalidationStart).toBeLessThan(deleteIndex);

    const prevalidationEnd = body.indexOf(";", prevalidationStart);
    const prevalidationBlock = body.slice(prevalidationStart, prevalidationEnd);
    expect(prevalidationBlock).toContain("task.id is null");
    expect(prevalidationBlock).toContain("task.user_id <> v_user_id");
    expect(prevalidationBlock).toContain("task.deleted_at is not null");
    expect(prevalidationBlock).toContain("task.project_id is distinct from v_project_id");
  });

  it("verifies the final mapping count corresponds exactly to the requested set", () => {
    expect(body).toContain("message = 'TASK_SET_VERIFICATION_FAILED'");
    expect(body).toContain("<> cardinality(v_task_ids) then");
  });

  it("never copies task title, status, deadline, amount, priority, raw_input, source or client data", () => {
    for (const forbidden of [
      "task_title",
      "status",
      "deadline",
      "amount",
      "priority",
      "raw_input",
      "source",
    ]) {
      const insertStart = body.indexOf("insert into public.share_link_tasks (");
      const insertEnd = body.indexOf(";", body.indexOf("on conflict", insertStart));
      const insertBlock = body.slice(insertStart, insertEnd).toLowerCase();
      expect(insertBlock).not.toContain(forbidden);
    }
  });
});

describe("202608060003 - resource set-replacement behavior", () => {
  it("leaves the mapping unchanged when p_resources is null", () => {
    const resourceMutationGuard = body.indexOf(
      "if p_resources is not null then\n    if cardinality(v_resource_ids)"
    );
    expect(resourceMutationGuard).toBeGreaterThan(-1);
  });

  it("deletes rows absent from the submitted set (an empty submitted set clears every row)", () => {
    expect(normalizedBody).toContain(
      "delete from public.share_link_resources where share_link_id = p_link_id and user_id = v_user_id and not (resource_id = any(v_resource_ids))"
    );
  });

  it("inserts the submitted set and updates only presentation fields on conflict", () => {
    expect(body).toContain("insert into public.share_link_resources (");
    expect(body).toContain("on conflict (share_link_id, resource_id) do update");
    const conflictStart = body.indexOf("on conflict (share_link_id, resource_id) do update");
    const conflictEnd = body.indexOf(";", conflictStart);
    const conflictText = body.slice(conflictStart, conflictEnd);
    expect(conflictText).toContain("public_label = excluded.public_label");
    expect(conflictText).toContain("can_download = excluded.can_download");
    expect(conflictText).toContain("display_order = excluded.display_order");
    expect(conflictText).not.toContain("resource_id =");
    expect(conflictText).not.toContain("share_link_id =");
    expect(conflictText).not.toContain("user_id =");
  });

  it("prevalidates every resource's owner and project attribution (direct or task-derived) before mutating", () => {
    const prevalidationStart = body.indexOf("left join public.task_resources as resource");
    const deleteIndex = body.indexOf("delete from public.share_link_resources");
    expect(prevalidationStart).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(prevalidationStart).toBeLessThan(deleteIndex);

    const prevalidationEnd = body.indexOf(
      "then\n      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES'",
      prevalidationStart
    );
    const prevalidationBlock = body.slice(prevalidationStart, prevalidationEnd);
    expect(prevalidationBlock).toContain("resource.id is null");
    expect(prevalidationBlock).toContain("resource.user_id <> v_user_id");
    expect(prevalidationBlock).toContain("resource.project_id is null and resource.task_id is null");
    expect(prevalidationBlock).toContain("resource.project_id <> v_project_id");
    expect(prevalidationBlock).toContain("resource_task.project_id is distinct from v_project_id");
  });

  it("verifies the final mapping count corresponds exactly to the requested set", () => {
    expect(body).toContain("message = 'RESOURCE_SET_VERIFICATION_FAILED'");
    expect(body).toContain("<> cardinality(v_resource_ids) then");
  });

  it("never copies or returns storage_path, file_name, mime metadata, size metadata, notes, signed URLs or bucket information", () => {
    for (const forbidden of [
      "storage_path",
      "file_name",
      "mime_type",
      "size_bytes",
      "notes",
      "signed_url",
      "bucket",
    ]) {
      expect(lowerBody).not.toContain(forbidden);
    }
  });
});

describe("202608060003 - published-update retirement and insertion order", () => {
  it("leaves the current update unchanged when p_publish_update is null", () => {
    const publishGuard = body.indexOf(
      "if p_publish_update is not null then\n    update public.share_link_updates"
    );
    expect(publishGuard).toBeGreaterThan(-1);
  });

  it("retires the existing current row before computing the next version or inserting", () => {
    const retireIndex = normalizedBody.indexOf(
      "update public.share_link_updates set is_current = false where share_link_id = p_link_id and is_current"
    );
    const versionIndex = body.indexOf("coalesce(max(version), 0) + 1");
    const insertIndex = body.indexOf("insert into public.share_link_updates (");
    expect(retireIndex).toBeGreaterThan(-1);
    expect(versionIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(retireIndex).toBeLessThan(normalizedBody.indexOf(normalizeWhitespace("coalesce(max(version), 0) + 1")));
    expect(versionIndex).toBeLessThan(insertIndex);
  });

  it("computes the next version as coalesce(max(version), 0) + 1, scoped to this link", () => {
    expect(body).toContain("select coalesce(max(version), 0) + 1\n      into v_next_version\n      from public.share_link_updates\n      where share_link_id = p_link_id;");
  });

  it("inserts exactly one new current row with the authenticated user as both user_id and created_by", () => {
    const insertStart = body.indexOf("insert into public.share_link_updates (");
    const insertEnd = body.indexOf(";", insertStart);
    const insertText = body.slice(insertStart, insertEnd);
    expect(insertText).toContain("v_user_id,\n      p_link_id,\n      v_publish_body,\n      v_next_version,\n      v_now,\n      v_user_id,\n      true");
  });

  it("verifies exactly one row was inserted via GET DIAGNOSTICS", () => {
    expect(body).toContain("get diagnostics v_publish_inserted_count = row_count;");
    expect(body).toContain("if v_publish_inserted_count <> 1 then");
    expect(body).toContain("message = 'PUBLISH_UPDATE_INSERT_FAILED'");
  });

  it("never returns the update body", () => {
    const returnStart = body.indexOf("return jsonb_build_object(");
    const returnBlock = body.slice(returnStart).toLowerCase();
    expect(returnBlock).not.toContain("'body'");
    expect(returnBlock).not.toContain("v_publish_body");
  });
});

describe("202608060003 - atomicity and result contract", () => {
  it("performs every sub-operation inside the single function body -- no exception swallowing anywhere", () => {
    const exceptionBlocks = body.match(/exception\s+when/g) ?? [];
    // Exactly two narrowly-scoped exception handlers exist (bigint and
    // uuid cast failures), each immediately re-raising a stable typed
    // P0001 error -- never a silent catch.
    expect(exceptionBlocks.length).toBe(2);
    for (const [index] of exceptionBlocks.entries()) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    expect(body).not.toMatch(/when others then\s*(return|null;)/i);
  });

  it("returns only linkId, configurationVersion, taskIds, resourceIds and currentUpdate", () => {
    const returnStart = body.indexOf("return jsonb_build_object(");
    const returnBlock = body.slice(returnStart);
    const keys = [...returnBlock.matchAll(/'([a-zA-Z]+)',/g)].map((m) => m[1]);
    expect(new Set(keys)).toEqual(
      new Set(["linkId", "configurationVersion", "taskIds", "resourceIds", "currentUpdate", "version", "publishedAt"])
    );
  });

  it("orders taskIds deterministically by display_order then subtask_id", () => {
    expect(body).toContain(
      "order by final_task.display_order, final_task.subtask_id"
    );
  });

  it("orders resourceIds deterministically by display_order then resource_id", () => {
    expect(body).toContain(
      "order by final_resource.display_order, final_resource.resource_id"
    );
  });

  it("casts taskIds to canonical decimal-string text and resourceIds to lowercase uuid text", () => {
    expect(body).toContain("final_task.subtask_id::text");
    expect(body).toContain("final_resource.resource_id::text");
  });

  it("returns currentUpdate as null when no current update exists, and only version/publishedAt otherwise", () => {
    expect(body).toContain("v_current_update_version := null;");
    expect(body).toContain("v_current_update_published_at := null;");
    expect(body).toContain(
      "when v_current_update_version is null then null\n      else jsonb_build_object(\n        'version', v_current_update_version,\n        'publishedAt', v_current_update_published_at\n      )"
    );
  });

  it("never returns secret, digest, PIN or encrypted material, or private project/task/resource fields", () => {
    const returnStart = body.indexOf("return jsonb_build_object(");
    const returnBlock = body.slice(returnStart).toLowerCase();
    for (const forbidden of [
      "secret",
      "digest",
      "pinhash",
      "pinsalt",
      "ciphertext",
      "authtag",
      "userid",
      "projectid",
      "storage",
      "clientfacingsubtitle",
      "commentsenabled",
      "contentdirection",
    ]) {
      expect(returnBlock).not.toContain(forbidden);
    }
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });
});
