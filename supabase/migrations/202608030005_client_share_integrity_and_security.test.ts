import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static validation only -- this must never require a live database
// connection, matching this repository's established migration-testing
// convention exactly (see 202607290001_calendar_events.test.ts).
//
// IMPORTANT: nothing in this file proves that a trigger actually FIRES, or
// that it actually rejects a cross-tenant row at runtime. It proves only
// that the trigger is declared on the right table, for the right events,
// with the right security posture and the right stable error codes. The
// executable integration-test matrix in
// docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_DATABASE_FOUNDATION_REPORT.md
// is what must prove the behaviour, against an isolated database, before
// Phase 3 public access.
const MIGRATION_PATH = path.join(
  __dirname,
  "202608030005_client_share_integrity_and_security.sql"
);
const OWNER_MIGRATION_PATH = path.join(
  __dirname,
  "202608030003_client_share_owner_foundation.sql"
);
const SESSION_MIGRATION_PATH = path.join(
  __dirname,
  "202608030004_client_share_session_foundation.sql"
);

function readNormalized(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const sql = readNormalized(MIGRATION_PATH);
const normalizedSql = sql.toLowerCase();
const ownerSql = readNormalized(OWNER_MIGRATION_PATH);
const sessionSql = readNormalized(SESSION_MIGRATION_PATH);

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const code = stripLineComments(sql);
const normalizedCode = code.toLowerCase();
const ownerCode = stripLineComments(ownerSql);
const sessionCode = stripLineComments(sessionSql);
const phase1ACode = [ownerCode, sessionCode, code].join("\n");
const normalizedPhase1ACode = phase1ACode.toLowerCase();

function stripCommentOnStatements(source: string): string {
  return source.replace(/comment on [\s\S]*?';/g, "");
}

const executable = stripCommentOnStatements(code);
const normalizedExecutable = executable.toLowerCase();

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

/** function name -> the table its trigger is installed on. */
const INTEGRITY_FUNCTIONS = {
  enforce_project_share_link_integrity: {
    table: "project_share_links",
    trigger: "project_share_links_enforce_integrity",
    timing: "before insert or update",
  },
  enforce_share_link_task_integrity: {
    table: "share_link_tasks",
    trigger: "share_link_tasks_enforce_integrity",
    timing: "before insert or update",
  },
  enforce_share_link_resource_integrity: {
    table: "share_link_resources",
    trigger: "share_link_resources_enforce_integrity",
    timing: "before insert or update",
  },
  enforce_share_link_update_integrity: {
    table: "share_link_updates",
    trigger: "share_link_updates_enforce_integrity",
    timing: "before insert or update",
  },
  enforce_share_message_integrity: {
    table: "share_messages",
    trigger: "share_messages_enforce_integrity",
    timing: "before insert or update",
  },
  enforce_share_message_conversion_integrity: {
    table: "share_message_conversions",
    trigger: "share_message_conversions_enforce_integrity",
    timing: "before insert",
  },
  enforce_share_browser_session_integrity: {
    table: "share_browser_sessions",
    trigger: "share_browser_sessions_enforce_integrity",
    timing: "before insert or update",
  },
  enforce_share_session_grant_integrity: {
    table: "share_session_grants",
    trigger: "share_session_grants_enforce_integrity",
    timing: "before insert or update",
  },
} as const;

const FUNCTION_NAMES = Object.keys(
  INTEGRITY_FUNCTIONS
) as (keyof typeof INTEGRITY_FUNCTIONS)[];

const bodies = Object.fromEntries(
  FUNCTION_NAMES.map((name) => [name, extractFunctionBody(code, name)])
) as Record<(typeof FUNCTION_NAMES)[number], string>;

describe("202608030005 - every integrity function exists with the repository's security posture", () => {
  it.each(FUNCTION_NAMES)("defines public.%s()", (name) => {
    expect(code).toContain(`create or replace function public.${name}()`);
  });

  it.each(FUNCTION_NAMES)(
    "%s is plpgsql, SECURITY INVOKER, with an explicit locked search_path",
    (name) => {
      const body = bodies[name];
      expect(body).toContain("returns trigger");
      expect(body).toContain("language plpgsql");
      expect(body).toContain("security invoker");
      expect(body).toContain("set search_path = public, pg_temp");
    }
  );

  it("uses SECURITY DEFINER nowhere in the migration", () => {
    expect(normalizedCode).not.toContain("security definer");
  });
});

describe("202608030005 - every trigger is installed on the correct table", () => {
  it.each(FUNCTION_NAMES)(
    "%s is wired as the intended row trigger on its own table",
    (name) => {
      const { table, timing, trigger } = INTEGRITY_FUNCTIONS[name];
      expect(code).toContain(
        `create trigger ${trigger}\n${timing} on public.${table}\nfor each row\nexecute function public.${name}();`
      );
      expect(code).toContain(
        `drop trigger if exists ${trigger}\n  on public.${table};`
      );
    }
  );

  it("keeps the conversion traceability trigger INSERT-only so FK SET NULL cleanup is not blocked", () => {
    expect(code).toContain(
      "create trigger share_message_conversions_enforce_integrity\nbefore insert on public.share_message_conversions\nfor each row\nexecute function public.enforce_share_message_conversion_integrity();"
    );
    expect(code).not.toContain(
      "before insert or update on public.share_message_conversions"
    );
  });

  it("creates exactly one trigger per integrity function and no others", () => {
    const triggers = code.match(/create trigger[\s\S]*?;/g) ?? [];
    expect(triggers).toHaveLength(FUNCTION_NAMES.length);
  });

  it("installs no trigger on any existing production table", () => {
    const triggers = code.match(/create trigger[\s\S]*?;/g) ?? [];
    for (const trigger of triggers) {
      expect(trigger).toMatch(
        /on public\.(project_share_links|share_link_tasks|share_link_resources|share_link_updates|share_messages|share_message_conversions|share_browser_sessions|share_session_grants)\n/
      );
    }
  });

  it("drops each trigger by name before recreating it, so re-application is exact", () => {
    const drops = code.match(/drop trigger if exists/g) ?? [];
    const creates = code.match(/create trigger/g) ?? [];
    expect(drops.length).toBe(creates.length);
  });
});

describe("202608030005 - stable P0001 error codes", () => {
  const EXPECTED_CODES = [
    "SHARE_LINK_PROJECT_NOT_FOUND",
    "SHARE_LINK_PROJECT_NOT_OWNED",
    "SHARE_LINK_OWNER_MISMATCH",
    "SHARE_LINK_PROJECT_IMMUTABLE",
    "SHARE_LINK_PUBLIC_ID_IMMUTABLE",
    "SHARE_LINK_CREATED_AT_IMMUTABLE",
    "SHARE_LINK_ACTIVATED_AT_IMMUTABLE",
    "SHARE_LINK_DRAFT_STATE_IRREVERSIBLE",
    "SHARE_LINK_DISABLED_AT_DECREASE",
    "SHARE_LINK_ROTATED_AT_DECREASE",
    "SHARE_LINK_CONFIGURATION_VERSION_DECREASE",
    "SHARE_LINK_VIEW_COUNT_DECREASE",
    "SHARE_LINK_LAST_VIEWED_AT_DECREASE",
    "SHARE_LINK_REVOCATION_IRREVERSIBLE",
    "SHARE_LINK_REVOKED_STATE_TERMINAL",
    "SHARE_LINK_STATE_TRANSITION_INVALID",
    "SHARE_LINK_VERSION_NOT_INCREMENTED",
    "SHARE_LINK_ROTATION_REQUIRES_SECRET_CHANGE",
    "SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED",
    "SHARE_TASK_LINK_NOT_FOUND",
    "SHARE_TASK_OWNER_MISMATCH",
    "SHARE_TASK_NOT_FOUND",
    "SHARE_TASK_NOT_OWNED",
    "SHARE_TASK_DELETED",
    "SHARE_TASK_WITHOUT_PROJECT",
    "SHARE_TASK_PROJECT_MISMATCH",
    "SHARE_RESOURCE_LINK_NOT_FOUND",
    "SHARE_RESOURCE_OWNER_MISMATCH",
    "SHARE_RESOURCE_NOT_FOUND",
    "SHARE_RESOURCE_NOT_OWNED",
    "SHARE_RESOURCE_PROJECT_MISMATCH",
    "SHARE_RESOURCE_TASK_PROJECT_MISMATCH",
    "SHARE_RESOURCE_RELATIONSHIP_INVALID",
    "SHARE_UPDATE_LINK_NOT_FOUND",
    "SHARE_UPDATE_OWNER_MISMATCH",
    "SHARE_UPDATE_CREATED_BY_MISMATCH",
    "SHARE_UPDATE_IMMUTABLE",
    "SHARE_MESSAGE_LINK_NOT_FOUND",
    "SHARE_MESSAGE_OWNER_MISMATCH",
    "SHARE_MESSAGE_PROJECT_MISMATCH",
    "SHARE_MESSAGE_PARENT_NOT_FOUND",
    "SHARE_MESSAGE_PARENT_LINK_MISMATCH",
    "SHARE_MESSAGE_PARENT_OWNER_MISMATCH",
    "SHARE_MESSAGE_OWNER_AUTHOR_NOT_AUTHENTICATED",
    "SHARE_MESSAGE_CLIENT_AUTHOR_REQUIRES_SERVICE_ROLE",
    "SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE",
    "SHARE_MESSAGE_CLIENT_COMMENTS_DISABLED",
    "SHARE_MESSAGE_CLIENT_LINK_EXPIRED",
    "SHARE_MESSAGE_CLIENT_PROJECT_NOT_FOUND",
    "SHARE_MESSAGE_CLIENT_PROJECT_DELETED",
    "SHARE_MESSAGE_CLIENT_STATUS_INVALID",
    "SHARE_MESSAGE_CLIENT_REVIEWED_AT_FORBIDDEN",
    "SHARE_MESSAGE_CLIENT_RESOLVED_AT_FORBIDDEN",
    "SHARE_MESSAGE_CLIENT_VISIBILITY_INVALID",
    "SHARE_MESSAGE_CLIENT_PARENT_NOT_VISIBLE",
    "SHARE_MESSAGE_AUTHOR_TYPE_INVALID",
    "SHARE_MESSAGE_IMMUTABLE",
    "SHARE_CONVERSION_MESSAGE_NOT_FOUND",
    "SHARE_CONVERSION_OWNER_MISMATCH",
    "SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED",
    "SHARE_CONVERSION_ACTOR_MISMATCH",
    "SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED",
    "SHARE_CONVERSION_UPDATE_NOT_FOUND",
    "SHARE_CONVERSION_UPDATE_NOT_OWNED",
    "SHARE_CONVERSION_UPDATE_PROJECT_MISMATCH",
    "SHARE_CONVERSION_TASK_NOT_FOUND",
    "SHARE_CONVERSION_TASK_NOT_OWNED",
    "SHARE_CONVERSION_TASK_PROJECT_MISMATCH",
    "SHARE_SESSION_DIGEST_IMMUTABLE",
    "SHARE_SESSION_DIGEST_VERSION_IMMUTABLE",
    "SHARE_SESSION_CREATED_AT_IMMUTABLE",
    "SHARE_SESSION_EXPIRY_IMMUTABLE",
    "SHARE_SESSION_LAST_SEEN_AT_DECREASE",
    "SHARE_SESSION_REVOCATION_IRREVERSIBLE",
    "SHARE_GRANT_SESSION_NOT_FOUND",
    "SHARE_GRANT_SESSION_REVOKED",
    "SHARE_GRANT_SESSION_EXPIRED",
    "SHARE_GRANT_LINK_NOT_FOUND",
    "SHARE_GRANT_PROJECT_NOT_FOUND",
    "SHARE_GRANT_PROJECT_DELETED",
    "SHARE_GRANT_LINK_NOT_ACTIVE",
    "SHARE_GRANT_LINK_EXPIRED",
    "SHARE_GRANT_CONFIGURATION_VERSION_STALE",
    "SHARE_GRANT_EXPIRY_EXCEEDS_SESSION",
    "SHARE_GRANT_EXPIRY_EXCEEDS_LINK",
    "SHARE_GRANT_PIN_VERIFICATION_REQUIRED",
    "SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED",
    "SHARE_GRANT_SESSION_IMMUTABLE",
    "SHARE_GRANT_LINK_IMMUTABLE",
    "SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE",
    "SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE",
    "SHARE_GRANT_CREATED_AT_IMMUTABLE",
    "SHARE_GRANT_EXPIRY_IMMUTABLE",
    "SHARE_GRANT_REVOCATION_IRREVERSIBLE",
    "SHARE_GRANT_REVOCATION_IMMUTABLE",
  ];

  it.each(EXPECTED_CODES)("raises %s with errcode P0001", (errorCode) => {
    expect(code).toContain(
      `raise exception using errcode = 'P0001', message = '${errorCode}';`
    );
  });

  it("uses P0001 for every raise, and SCREAMING_SNAKE_CASE for every message", () => {
    const raises = code.match(/raise exception[^;]*;/g) ?? [];
    expect(raises.length).toBeGreaterThanOrEqual(EXPECTED_CODES.length);
    for (const raise of raises) {
      expect(raise).toContain("errcode = 'P0001'");
      expect(raise).toMatch(/message = '[A-Z][A-Z_]+';$/);
      const message = /message = '([A-Z_]+)'/.exec(raise)?.[1];
      expect(EXPECTED_CODES).toContain(message);
    }
  });

  it("raises no unexpected error message text across the whole migration", () => {
    const messages = (code.match(/message = '([A-Z_]+)'/g) ?? []).map(
      (match) => {
        const parsed = /message = '([A-Z_]+)'/.exec(match);
        if (!parsed) {
          throw new Error(`Could not parse error code from ${match}`);
        }
        return parsed[1];
      }
    );
    expect(new Set(messages)).toEqual(new Set(EXPECTED_CODES));
  });
});

describe("202608030005 - same-owner and same-project enforcement", () => {
  it("a share link must belong to the owner of its project, and its owner can never be reassigned", () => {
    const body = bodies.enforce_project_share_link_integrity;
    expect(body).toContain("from public.projects as project");
    expect(body).toContain("v_project_user_id <> new.user_id");
    expect(body).toContain("new.user_id is distinct from old.user_id");
  });

  it("a share link cannot be reassigned to another project, public id or creation timestamp", () => {
    const body = bodies.enforce_project_share_link_integrity;
    expect(body).toContain("new.project_id is distinct from old.project_id");
    expect(body).toContain("message = 'SHARE_LINK_PROJECT_IMMUTABLE'");
    expect(body).toContain("new.public_id is distinct from old.public_id");
    expect(body).toContain("message = 'SHARE_LINK_PUBLIC_ID_IMMUTABLE'");
    expect(body).toContain("new.created_at is distinct from old.created_at");
    expect(body).toContain("message = 'SHARE_LINK_CREATED_AT_IMMUTABLE'");
  });

  it("share-link lifecycle values are monotonic and revocation is terminal", () => {
    const body = bodies.enforce_project_share_link_integrity;
    expect(body).toContain("old.activated_at is not null");
    expect(body).toContain("message = 'SHARE_LINK_ACTIVATED_AT_IMMUTABLE'");
    expect(body).toContain("old.disabled_at is not null");
    expect(body).toContain("new.disabled_at < old.disabled_at");
    expect(body).toContain("message = 'SHARE_LINK_DISABLED_AT_DECREASE'");
    expect(body).toContain("old.rotated_at is not null");
    expect(body).toContain("new.rotated_at < old.rotated_at");
    expect(body).toContain("message = 'SHARE_LINK_ROTATED_AT_DECREASE'");
    expect(body).toContain("new.configuration_version < old.configuration_version");
    expect(body).toContain("message = 'SHARE_LINK_CONFIGURATION_VERSION_DECREASE'");
    expect(body).toContain("new.view_count < old.view_count");
    expect(body).toContain("message = 'SHARE_LINK_VIEW_COUNT_DECREASE'");
    expect(body).toContain(
      "new.last_viewed_at is null\n        or new.last_viewed_at < old.last_viewed_at"
    );
    expect(body).toContain("message = 'SHARE_LINK_LAST_VIEWED_AT_DECREASE'");
    expect(body).toContain("old.revoked_at is not null");
    expect(body).toContain("new.revoked_at < old.revoked_at");
    expect(body).toContain("message = 'SHARE_LINK_REVOCATION_IRREVERSIBLE'");
    expect(body).toContain("old.state = 'revoked' and new.state <> 'revoked'");
    expect(body).toContain("message = 'SHARE_LINK_REVOKED_STATE_TERMINAL'");
  });

  it("uses an explicit allowed link-state transition matrix and forbids returning to draft", () => {
    const body = bodies.enforce_project_share_link_integrity;
    expect(body).toContain("old.state <> 'draft' and new.state = 'draft'");
    expect(body).toContain("message = 'SHARE_LINK_DRAFT_STATE_IRREVERSIBLE'");
    expect(body).toContain(
      "(old.state = 'draft' and new.state in ('active', 'revoked'))"
    );
    expect(body).toContain(
      "(old.state = 'active' and new.state in ('disabled', 'expired', 'revoked'))"
    );
    expect(body).toContain(
      "(old.state = 'disabled' and new.state in ('active', 'expired', 'revoked'))"
    );
    expect(body).toContain(
      "(old.state = 'expired' and new.state in ('active', 'revoked'))"
    );
    expect(body).toContain("message = 'SHARE_LINK_STATE_TRANSITION_INVALID'");
    expect(body).toContain(
      "old.state = 'expired'\n        and new.state = 'active'\n        and new.configuration_version <= old.configuration_version"
    );
  });

  it("security-sensitive link changes require configuration_version to increase", () => {
    const body = bodies.enforce_project_share_link_integrity;
    for (const field of [
      "secret_digest",
      "secret_digest_version",
      "state",
      "expires_at",
      "pin_hash",
      "pin_salt",
      "pin_hash_version",
      "pin_scrypt_n",
      "pin_scrypt_r",
      "pin_scrypt_p",
      "pin_key_length",
      "comments_enabled",
      "client_facing_subtitle",
      "content_direction",
    ]) {
      expect(body).toContain(`new.${field} is distinct from old.${field}`);
    }
    expect(body).toContain(
      "if v_access_changed and new.configuration_version <= old.configuration_version then"
    );
    expect(body).toContain("message = 'SHARE_LINK_VERSION_NOT_INCREMENTED'");
  });

  it("rotation requires a changed digest, an advanced rotated_at and a version increment", () => {
    const body = bodies.enforce_project_share_link_integrity;
    expect(body).toContain(
      "v_digest_changed := new.secret_digest is distinct from old.secret_digest;"
    );
    expect(body).toContain(
      "v_rotation_timestamp_changed := new.rotated_at is distinct from old.rotated_at;"
    );
    expect(body).toContain("message = 'SHARE_LINK_ROTATION_REQUIRES_SECRET_CHANGE'");
    expect(body).toContain("message = 'SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED'");
    expect(body).toContain("new.configuration_version <= old.configuration_version");
  });

  it("a task mapping validates link ownership, task ownership, task project presence and project equality", () => {
    const body = bodies.enforce_share_link_task_integrity;
    expect(body).toContain("from public.project_share_links as link");
    expect(body).toContain("from public.tasks as task");
    expect(body).toContain("v_link_user_id <> new.user_id");
    expect(body).toContain("v_task_user_id <> new.user_id");
    expect(body).toContain("v_task_project_id is null");
    expect(body).toContain("v_task_project_id <> v_link_project_id");
  });

  it("a Resource mapping validates ownership, direct-project equality, task-project equality and internal contradiction", () => {
    const body = bodies.enforce_share_link_resource_integrity;
    expect(body).toContain("from public.task_resources as resource");
    expect(body).toContain("from public.tasks as task");
    expect(body).toContain("v_resource_user_id <> new.user_id");
    expect(body).toContain(
      "v_resource_project_id is not null\n    and v_resource_project_id <> v_link_project_id"
    );
    expect(body).toContain(
      "v_task_project_id is null\n      or v_task_project_id <> v_link_project_id"
    );
    expect(body).toContain(
      "v_resource_project_id is not null\n      and v_resource_project_id <> v_task_project_id"
    );
  });

  it("a Resource attributable to no project at all is rejected rather than assumed safe", () => {
    const body = bodies.enforce_share_link_resource_integrity;
    expect(body).toContain(
      "v_resource_project_id is null and v_resource_task_id is null"
    );
  });

  it("a published update validates link ownership and created_by, and is immutable afterwards", () => {
    const body = bodies.enforce_share_link_update_integrity;
    expect(body).toContain("v_link_user_id <> new.user_id");
    expect(body).toContain("new.created_by <> new.user_id");
    expect(body).toContain("new.body is distinct from old.body");
    expect(body).toContain("new.version is distinct from old.version");
    expect(body).toContain("new.published_at is distinct from old.published_at");
  });

  it("a message validates link ownership, project equality, parent link and parent owner", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain("v_link_user_id <> new.user_id");
    expect(body).toContain("new.project_id <> v_link_project_id");
    expect(body).toContain("v_parent_share_link_id <> new.share_link_id");
    expect(body).toContain("v_parent_user_id <> new.user_id");
  });

  it("an owner-authored message must be written by that authenticated owner", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain("if new.author_type = 'owner' then");
    expect(body).toContain("auth.uid() is distinct from new.user_id");
    expect(body).toContain("message = 'SHARE_MESSAGE_OWNER_AUTHOR_NOT_AUTHENTICATED'");
  });

  it("a client-authored message requires service_role, so authenticated owners cannot manufacture client rows", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain("elsif new.author_type = 'client' then");
    expect(body).toContain("current_role <> 'service_role'");
    expect(body).toContain(
      "message = 'SHARE_MESSAGE_CLIENT_AUTHOR_REQUIRES_SERVICE_ROLE'"
    );
    expect(body).toContain("message = 'SHARE_MESSAGE_AUTHOR_TYPE_INVALID'");
  });

  it("a client-authored message requires an active, unexpired, comments-enabled link on a live project", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain("left join public.projects as project");
    expect(body).toContain("v_link_state <> 'active'");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE'");
    expect(body).toContain("not v_link_comments_enabled");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_COMMENTS_DISABLED'");
    expect(body).toContain(
      "v_link_expires_at is not null and v_link_expires_at <= now()"
    );
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_LINK_EXPIRED'");
    expect(body).toContain("v_project_id is null");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_PROJECT_NOT_FOUND'");
    expect(body).toContain("v_project_deleted_at is not null");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_PROJECT_DELETED'");
  });

  it("a service-role client-authored message must start fresh and visible with no owner-review state", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain("new.status <> 'new'");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_STATUS_INVALID'");
    expect(body).toContain("new.reviewed_at is not null");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_REVIEWED_AT_FORBIDDEN'");
    expect(body).toContain("new.resolved_at is not null");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_RESOLVED_AT_FORBIDDEN'");
    expect(body).toContain("new.is_visible_to_client is not true");
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_VISIBILITY_INVALID'");
  });

  it("a client-authored reply may reference only a client-visible parent message", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain(
      "select parent.share_link_id, parent.user_id, parent.is_visible_to_client"
    );
    expect(body).toContain(
      "new.author_type = 'client'\n      and v_parent_is_visible_to_client is not true"
    );
    expect(body).toContain("message = 'SHARE_MESSAGE_CLIENT_PARENT_NOT_VISIBLE'");
  });

  it("a message body and its author identity are immutable after insert", () => {
    const body = bodies.enforce_share_message_integrity;
    expect(body).toContain("new.body is distinct from old.body");
    expect(body).toContain("new.author_type is distinct from old.author_type");
    expect(body).toContain("new.parent_id is distinct from old.parent_id");
  });

  it("a conversion validates the acting owner and the ownership/project of both optional targets", () => {
    const body = bodies.enforce_share_message_conversion_integrity;
    expect(body).toContain("message.author_type");
    expect(body).toContain("v_message_author_type <> 'client'");
    expect(body).toContain("message = 'SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED'");
    expect(body).toContain("new.converted_by <> new.user_id");
    expect(body).toContain("auth.uid() is distinct from new.converted_by");
    expect(body).toContain("from public.project_updates as project_update");
    expect(body).toContain("v_update_user_id <> new.user_id");
    expect(body).toContain("v_update_project_id <> v_message_project_id");
    expect(body).toContain("v_task_user_id <> new.user_id");
    expect(body).toContain(
      "v_task_project_id is null\n      or v_task_project_id <> v_message_project_id"
    );
  });

  it("conversion rows remain append-only while optional FK targets keep ON DELETE SET NULL compatibility", () => {
    expect(ownerCode).toContain(
      "project_update_id uuid null\n    references public.project_updates(id) on delete set null"
    );
    expect(ownerCode).toContain(
      "target_task_id bigint null references public.tasks(id) on delete set null"
    );
    expect(ownerCode).not.toMatch(
      /create policy "[^"]+"\n  on public\.share_message_conversions\n  for update/
    );
    expect(code).toContain(
      "grant select on table public.share_message_conversions\n  to authenticated;"
    );
    expect(code).not.toMatch(
      /grant[^;]*update[^;]*public\.share_message_conversions/
    );
  });

  it("a browser session keeps identity and expiry immutable, last_seen_at monotonic and revocation irreversible", () => {
    const body = bodies.enforce_share_browser_session_integrity;
    expect(body).toContain("new.session_digest is distinct from old.session_digest");
    expect(body).toContain("message = 'SHARE_SESSION_DIGEST_IMMUTABLE'");
    expect(body).toContain("new.digest_version is distinct from old.digest_version");
    expect(body).toContain("message = 'SHARE_SESSION_DIGEST_VERSION_IMMUTABLE'");
    expect(body).toContain("new.created_at is distinct from old.created_at");
    expect(body).toContain("message = 'SHARE_SESSION_CREATED_AT_IMMUTABLE'");
    expect(body).toContain("new.expires_at is distinct from old.expires_at");
    expect(body).toContain("message = 'SHARE_SESSION_EXPIRY_IMMUTABLE'");
    expect(body).toContain("new.last_seen_at < old.last_seen_at");
    expect(body).toContain("message = 'SHARE_SESSION_LAST_SEEN_AT_DECREASE'");
    expect(body).toContain("old.revoked_at is not null");
    expect(body).toContain("new.revoked_at < old.revoked_at");
    expect(body).toContain("message = 'SHARE_SESSION_REVOCATION_IRREVERSIBLE'");
  });

  it("a grant insert requires a live session, active unexpired link, live project and exact link version", () => {
    const body = bodies.enforce_share_session_grant_integrity;
    expect(body).toContain("from public.share_browser_sessions as browser_session");
    expect(body).toContain("v_session_revoked_at is not null");
    expect(body).toContain("message = 'SHARE_GRANT_SESSION_REVOKED'");
    expect(body).toContain("v_session_expires_at <= now()");
    expect(body).toContain("message = 'SHARE_GRANT_SESSION_EXPIRED'");
    expect(body).toContain("left join public.projects as project");
    expect(body).toContain("v_project_deleted_at is not null");
    expect(body).toContain("message = 'SHARE_GRANT_PROJECT_DELETED'");
    expect(body).toContain("v_link_state <> 'active'");
    expect(body).toContain("message = 'SHARE_GRANT_LINK_NOT_ACTIVE'");
    expect(body).toContain("v_link_expires_at is not null and v_link_expires_at <= now()");
    expect(body).toContain("message = 'SHARE_GRANT_LINK_EXPIRED'");
    expect(body).toContain(
      "new.granted_configuration_version <> v_link_configuration_version"
    );
    expect(body).toContain("message = 'SHARE_GRANT_CONFIGURATION_VERSION_STALE'");
  });

  it("a grant may not outlive its session or link, and PIN verification must match the link PIN requirement", () => {
    const body = bodies.enforce_share_session_grant_integrity;
    expect(body).toContain("new.expires_at > v_session_expires_at");
    expect(body).toContain("message = 'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION'");
    expect(body).toContain("new.expires_at > v_link_expires_at");
    expect(body).toContain("message = 'SHARE_GRANT_EXPIRY_EXCEEDS_LINK'");
    expect(body).toContain("v_link_requires_pin and new.pin_verified_at is null");
    expect(body).toContain("message = 'SHARE_GRANT_PIN_VERIFICATION_REQUIRED'");
    expect(body).toContain(
      "not v_link_requires_pin and new.pin_verified_at is not null"
    );
    expect(body).toContain("message = 'SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED'");
  });

  it("a grant update keeps identity, version, PIN verification and expiry immutable and permits only first revocation", () => {
    const body = bodies.enforce_share_session_grant_integrity;
    for (const [field, errorCode] of [
      ["browser_session_id", "SHARE_GRANT_SESSION_IMMUTABLE"],
      ["share_link_id", "SHARE_GRANT_LINK_IMMUTABLE"],
      ["granted_configuration_version", "SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE"],
      ["pin_verified_at", "SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE"],
      ["created_at", "SHARE_GRANT_CREATED_AT_IMMUTABLE"],
      ["expires_at", "SHARE_GRANT_EXPIRY_IMMUTABLE"],
    ] as const) {
      expect(body).toContain(`new.${field} is distinct from old.${field}`);
      expect(body).toContain(`message = '${errorCode}'`);
    }
    expect(body).toContain("old.revoked_at is not null");
    expect(body).toContain("message = 'SHARE_GRANT_REVOCATION_IRREVERSIBLE'");
    expect(body).toContain("message = 'SHARE_GRANT_REVOCATION_IMMUTABLE'");
  });
});

describe("202608030005 - no silent repair, no cross-tenant fallback, no CRM mutation", () => {
  it.each(FUNCTION_NAMES)("%s never assigns to a NEW column", (name) => {
    // The calendar precedent normalises client_id; these functions
    // deliberately never rewrite caller input -- an invalid pair is
    // rejected, never quietly corrected.
    expect(bodies[name]).not.toMatch(/new\.[a-z_]+\s*:=/);
  });

  it.each(FUNCTION_NAMES)("%s writes to no table at all", (name) => {
    const body = bodies[name].toLowerCase();
    expect(body).not.toMatch(/\binsert\s+into\b/);
    expect(body).not.toMatch(/\bupdate\s+public\./);
    expect(body).not.toMatch(/\bdelete\s+from\b/);
    expect(body).not.toMatch(/\bmerge\s+into\b/);
  });

  it("never references public.project_timeline_events from executable SQL", () => {
    expect(normalizedExecutable).not.toContain("project_timeline_events");
  });

  it("never references public.clients, so no trigger here can touch CRM identity", () => {
    expect(normalizedCode).not.toContain("public.clients");
  });

  it("reads public.projects, public.tasks, public.task_resources and public.project_updates only inside SELECTs", () => {
    const reads = code.match(/from public\.[a-z_]+ as [a-z_]+/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(read).toMatch(
        /from public\.(projects|tasks|task_resources|project_updates|project_share_links|share_messages|share_browser_sessions) as /
      );
    }
  });

  it("creates no automatic message-to-Client-Update conversion trigger", () => {
    const triggers = code.match(/create trigger[\s\S]*?;/g) ?? [];
    for (const trigger of triggers) {
      expect(trigger).toContain("execute function public.enforce_");
      expect(trigger.toLowerCase()).not.toMatch(/after insert/);
      expect(trigger.toLowerCase()).not.toMatch(/for each statement/);
    }
  });
});

describe("Phase 1A migration set - global production-safety boundaries", () => {
  it("does not create, install or modify database extensions", () => {
    expect(normalizedPhase1ACode).not.toMatch(/create extension/);
    expect(normalizedPhase1ACode).not.toMatch(/alter extension/);
    expect(normalizedPhase1ACode).not.toMatch(/drop extension/);
  });

  it("does not modify existing analytics, timeline, CRM, project, task or storage objects", () => {
    for (const table of [
      "analytics_events",
      "authenticated_product_events",
      "project_timeline_events",
      "clients",
      "projects",
      "tasks",
      "task_resources",
      "project_updates",
      "project_update_items",
    ]) {
      expect(normalizedPhase1ACode).not.toMatch(
        new RegExp(`alter table public\\.${table}\\b`)
      );
      expect(normalizedPhase1ACode).not.toMatch(
        new RegExp(`insert into public\\.${table}\\b`)
      );
      expect(normalizedPhase1ACode).not.toMatch(
        new RegExp(`update public\\.${table}\\b`)
      );
      expect(normalizedPhase1ACode).not.toMatch(
        new RegExp(`delete from public\\.${table}\\b`)
      );
      expect(normalizedPhase1ACode).not.toMatch(
        new RegExp(`truncate table public\\.${table}\\b`)
      );
    }
    expect(normalizedPhase1ACode).not.toMatch(/storage\.[a-z_]+/);
  });
});

describe("202608030005 - function privilege hardening", () => {
  it.each(FUNCTION_NAMES)(
    "revokes execute on %s from public, anon, authenticated and service_role",
    (name) => {
      for (const role of ["public", "anon", "authenticated", "service_role"]) {
        expect(code).toContain(
          `revoke all on function public.${name}()\n  from ${role};`
        );
      }
    }
  );

  it("grants no direct EXECUTE privilege on trigger functions to any role", () => {
    expect(normalizedCode).not.toMatch(/grant\s+execute\s+on\s+function/);
  });

  it("grants nothing whatsoever to anon anywhere in the Phase 1A migration set", () => {
    expect(normalizedPhase1ACode).not.toMatch(/\bgrant\b[^;]*\banon\b/);
  });
});

describe("202608030005 - final table privilege activation", () => {
  const FINAL_GRANTS = [
    "grant select on table public.project_share_links\n  to authenticated;",
    "grant select on table public.share_link_tasks\n  to authenticated;",
    "grant select on table public.share_link_resources\n  to authenticated;",
    "grant select on table public.share_link_updates\n  to authenticated;",
    "grant select on table public.share_messages\n  to authenticated;",
    "grant select on table public.share_message_conversions\n  to authenticated;",
    "grant select on table public.project_share_links\n  to service_role;",
    "grant update (view_count, last_viewed_at)\n  on table public.project_share_links\n  to service_role;",
    "grant select on table public.share_link_tasks\n  to service_role;",
    "grant select on table public.share_link_resources\n  to service_role;",
    "grant select on table public.share_link_updates\n  to service_role;",
    "grant select on table public.share_messages\n  to service_role;",
    "grant insert (\n  user_id,\n  share_link_id,\n  project_id,\n  author_type,\n  author_display_name,\n  body,\n  parent_id,\n  is_visible_to_client\n)\n  on table public.share_messages\n  to service_role;",
    "grant select, insert, update, delete on table public.share_browser_sessions\n  to service_role;",
    "grant select, insert, update, delete on table public.share_session_grants\n  to service_role;",
    "grant select, insert, delete on table public.share_link_events\n  to service_role;",
    "grant select, insert, update, delete on table public.share_rate_limit_buckets\n  to service_role;",
  ];

  it("migration 003 and 004 contain no positive grant before integrity activation", () => {
    expect(ownerCode.match(/^grant[^;]*;/gm) ?? []).toEqual([]);
    expect(sessionCode.match(/^grant[^;]*;/gm) ?? []).toEqual([]);
  });

  it("issues the final least-privilege table grants only after every integrity trigger exists", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    expect(grants).toEqual(FINAL_GRANTS);

    const triggerIndexes = (code.match(/create trigger[\s\S]*?;/g) ?? []).map(
      (trigger) => code.indexOf(trigger)
    );
    expect(triggerIndexes).toHaveLength(FUNCTION_NAMES.length);
    const firstGrantIndex = code.indexOf(FINAL_GRANTS[0]);
    expect(firstGrantIndex).toBeGreaterThan(Math.max(...triggerIndexes));
  });

  it("does not grant public or anon table access, and never grants broad table privileges", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const grant of grants) {
      expect(grant.toLowerCase()).not.toMatch(/\bto\s+public\b/);
      expect(grant.toLowerCase()).not.toMatch(/\bto\s+anon\b/);
      expect(grant.toLowerCase()).not.toMatch(/^grant\s+all\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btruncate\b/);
      expect(grant.toLowerCase()).not.toMatch(/\breferences\b/);
      expect(grant.toLowerCase()).not.toMatch(/\btrigger\b/);
    }
  });

  it("gives authenticated owner-facing tables SELECT only and no direct DML", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const table of [
      "project_share_links",
      "share_link_tasks",
      "share_link_resources",
      "share_link_updates",
      "share_messages",
      "share_message_conversions",
    ]) {
      expect(grants).toContain(
        `grant select on table public.${table}\n  to authenticated;`
      );
      expect(
        grants.some(
          (grant) =>
            grant.includes(`public.${table}`) &&
            grant.includes("authenticated") &&
            /\b(insert|update|delete)\b/.test(grant.toLowerCase())
        )
      ).toBe(false);
    }
  });

  it("keeps mapping and publication changes closed until Phase 1B transactional operations exist", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    for (const table of [
      "project_share_links",
      "share_link_tasks",
      "share_link_resources",
      "share_link_updates",
      "share_messages",
      "share_message_conversions",
    ]) {
      expect(
        grants.some(
          (grant) =>
            grant.includes(`public.${table}`) &&
            grant.includes("authenticated") &&
            !grant.toLowerCase().startsWith("grant select ")
        )
      ).toBe(false);
    }
  });

  it("limits service_role project-share-link updates to public view counters only", () => {
    expect(code).toContain(
      "grant update (view_count, last_viewed_at)\n  on table public.project_share_links\n  to service_role;"
    );
    expect(code).not.toContain(
      "grant select, update on table public.project_share_links\n  to service_role;"
    );
    expect(code).not.toMatch(
      /grant update on table public\.project_share_links\s+to service_role;/
    );
  });

  it("limits service_role client-message insertion to public-comment input columns only", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    const messageInsertGrant = grants.find(
      (grant) =>
        grant.includes("grant insert (") &&
        grant.includes("on table public.share_messages")
    );
    expect(messageInsertGrant).toBe(
      "grant insert (\n  user_id,\n  share_link_id,\n  project_id,\n  author_type,\n  author_display_name,\n  body,\n  parent_id,\n  is_visible_to_client\n)\n  on table public.share_messages\n  to service_role;"
    );
    for (const forbidden of [
      "status",
      "reviewed_at",
      "resolved_at",
      "updated_at",
      "created_at",
    ]) {
      expect(messageInsertGrant).not.toContain(forbidden);
    }
  });

  it("keeps service_role off owner conversion rows and authenticated off service-only tables", () => {
    const grants = code.match(/^grant[^;]*;/gm) ?? [];
    expect(
      grants.some(
        (grant) =>
          grant.includes("public.share_message_conversions") &&
          grant.includes("service_role")
      )
    ).toBe(false);
    for (const table of [
      "share_browser_sessions",
      "share_session_grants",
      "share_link_events",
      "share_rate_limit_buckets",
    ]) {
      expect(
        grants.some(
          (grant) => grant.includes(`public.${table}`) && grant.includes("authenticated")
        )
      ).toBe(false);
    }
  });
});

describe("202608030005 - leaves existing production schema untouched", () => {
  it("creates no table, column, index, policy or view", () => {
    expect(normalizedCode).not.toMatch(/create table/);
    expect(normalizedCode).not.toMatch(/add column/);
    expect(normalizedCode).not.toMatch(/create (unique )?index/);
    expect(normalizedCode).not.toMatch(/create policy/);
    expect(normalizedCode).not.toMatch(/create (or replace )?view/);
  });

  it("alters no existing production table", () => {
    expect(normalizedCode).not.toMatch(/alter table/);
  });

  it("drops nothing except the triggers it immediately recreates", () => {
    expect(normalizedCode).not.toMatch(/drop table\b/);
    expect(normalizedCode).not.toMatch(/drop column\b/);
    expect(normalizedCode).not.toMatch(/drop constraint\b/);
    expect(normalizedCode).not.toMatch(/drop index\b/);
    expect(normalizedCode).not.toMatch(/drop function\b/);
    expect(normalizedCode).not.toMatch(/drop policy\b/);
  });

  it("redefines no function belonging to an existing migration", () => {
    const replaced = code.match(/create or replace function public\.[a-z_]+/g) ?? [];
    expect(replaced).toHaveLength(FUNCTION_NAMES.length);
    for (const definition of replaced) {
      expect(definition).toContain("public.enforce_");
    }
  });

  it("does not touch the known overlapping task_resources resource_type CHECK constraints", () => {
    expect(normalizedCode).not.toContain("resource_type");
  });

  it("does not touch storage buckets, objects or policies", () => {
    expect(normalizedCode).not.toMatch(/storage\.[a-z_]+/);
  });

  it("comments every function it creates", () => {
    for (const name of FUNCTION_NAMES) {
      expect(code).toContain(`comment on function public.${name}() is`);
    }
  });

  it("does not define a down/rollback migration (forward-only, matching repo convention)", () => {
    expect(normalizedSql).not.toMatch(/^-- down/m);
    expect(normalizedCode).not.toMatch(/\brollback\b/);
  });
});
