-- Text2Task Client Share Link -- Phase 3 Browser Acceptance Fixture
-- Package
-- File 02: Seed disposable owner content
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this THIRD, after File 01 of this package, and ONLY after a
-- disposable Supabase Auth user has been created for the deterministic
-- email below. Never run this in the real Text2Task production project.
--
-- WHY THE OWNER MUST ALREADY EXIST IN auth.users BEFORE THIS FILE RUNS:
-- public.users.id has a foreign key to auth.users(id) (File 01). This
-- file resolves the owner by email rather than asking anyone to paste a
-- UUID, but it can only resolve a row that already exists.
--
-- HOW TO CREATE THE DISPOSABLE OWNER (do this before running this file):
--   Use the disposable Supabase project's own Authentication -> Users ->
--   "Add user" dashboard action (NOT the app's self-service /login signup
--   flow -- see 00_READ_ME_FIRST.md for exactly why), with:
--     Email:            phase3-browser-owner@example.invalid
--     Auto Confirm User: enabled (checked)
--   Using the dashboard's own "Add user" action creates the row directly
--   and marks it confirmed without Supabase ever attempting to actually
--   deliver mail to the address -- so the RFC 2606 `.invalid` TLD (chosen
--   specifically because it can never resolve to a real mailbox, so this
--   deterministic address can never collide with, or accidentally
--   deliver to, a real person) never becomes a deliverability problem.
--   Do not use this email with the self-service signup form, which does
--   attempt to send a confirmation email.
--
-- WHAT THIS FILE DOES NOT CREATE (by explicit design -- see
-- 00_READ_ME_FIRST.md and the Phase 3 browser-acceptance task's own
-- instruction): no project_share_links row, no
-- project_share_secret_material, no share_session_grants, no
-- share_browser_sessions, no PIN, no share_link_tasks/share_link_resources
-- mapping, no share_link_updates. Every one of those must be created
-- through the real authenticated owner Client Share RPC/UI once signed
-- in through the Preview -- that is the entire point of this package:
-- closing the coverage gap the SQL runtime package's own File 03 could
-- not test (auth.uid()-gated RPCs cannot be called from a raw
-- service-role SQL session).
--
-- Deterministic identity namespace for this package (distinct from the
-- runtime package's own '11111111-...' owner, which is a synthetic
-- id inserted directly into auth.users by that package and is NOT a
-- real, sign-in-capable account):
--   Disposable owner email:  phase3-browser-owner@example.invalid
--   Fixture client id:       22222222-2222-4222-8222-222222222222
--   Fixture project id:      33333333-3333-4333-8333-333333333333
--   Fixture resource id:     44444444-4444-4444-8444-444444444444
--   (the fixture task has no fixed id -- tasks.id is a bigint identity
--   column; it is resolved idempotently by task_title instead, see below)

do $$
declare
  v_sentinel_kind text;
  v_owner_count integer;
  v_owner_id uuid;
  v_owner_email text;
  v_client_id constant uuid := '22222222-2222-4222-8222-222222222222';
  v_project_id constant uuid := '33333333-3333-4333-8333-333333333333';
  v_resource_id constant uuid := '44444444-4444-4444-8444-444444444444';
  v_task_id bigint;
  v_deterministic_email constant text := 'phase3-browser-owner@example.invalid';
begin
  -- ---------------------------------------------------------
  -- Safety gate: identical sentinel check to File 01, plus a check that
  -- File 01 of THIS package has already run.
  -- ---------------------------------------------------------
  if to_regclass('public.text2task_client_share_phase3_application_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The Phase 3 application runtime test sentinel was not found. Run docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql and 02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_APPLICATION.sql, then this package''s own File 01, before running this file.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase3_application_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_3_APPLICATION_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The sentinel row does not identify this project as the disposable Phase 3 application runtime test project.';
  end if;

  if to_regclass('public.users') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.users was not found. Run this package''s own 01_EXTEND_DISPOSABLE_APP_SCHEMA.sql first.';
  end if;

  -- ---------------------------------------------------------
  -- Resolve exactly one auth.users row for the deterministic email.
  -- Fails closed on zero or more than one match -- never guesses.
  -- ---------------------------------------------------------
  select count(*) into v_owner_count
    from auth.users
    where email = v_deterministic_email;

  if v_owner_count = 0 then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. No auth.users row found for %s. Create the disposable owner via the Supabase dashboard''s Authentication -> Users -> "Add user" action first (see this file''s own header comment) -- do not run the app''s self-service signup form for this email.',
      v_deterministic_email
    );
  end if;

  if v_owner_count > 1 then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. %s auth.users rows found for %s -- expected exactly 1. This deterministic-email resolution strategy requires a single unambiguous match; investigate and remove the duplicate before retrying.',
      v_owner_count, v_deterministic_email
    );
  end if;

  select id, email into v_owner_id, v_owner_email
    from auth.users
    where email = v_deterministic_email;

  -- ---------------------------------------------------------
  -- 1. public.users bootstrap row (mirrors lib/supabase/ensureUser.ts's
  --    own insert shape exactly). Idempotent: safe to re-run.
  -- ---------------------------------------------------------
  insert into public.users (id, email, plan, extract_count, subscription_status)
  values (v_owner_id, v_owner_email, 'free', 0, 'free')
  on conflict (id) do update
    set email = excluded.email;

  -- ---------------------------------------------------------
  -- 2. One deterministic disposable client. Idempotent: safe to re-run.
  -- ---------------------------------------------------------
  insert into public.clients (id, user_id, name, contact_name, phone, email, notes)
  values (
    v_client_id, v_owner_id,
    'Phase 3 Browser Fixture Client', 'Runtime Fixture Contact',
    null, null, 'Disposable browser-acceptance fixture client. Not a real client.'
  )
  on conflict (id) do update
    set name = excluded.name;

  -- ---------------------------------------------------------
  -- 3. One deterministic disposable project. Idempotent: safe to re-run.
  --    Every column here is synthetic, safe, and non-private -- this row
  --    is the one later shared through the real owner Client Share flow.
  -- ---------------------------------------------------------
  insert into public.projects (
    id, user_id, client_id, client_name, contact_name,
    title, summary, status, priority, source,
    is_archived, deleted_at
  ) values (
    v_project_id, v_owner_id, v_client_id, 'Phase 3 Browser Fixture Client', 'Runtime Fixture Contact',
    'Phase 3 Browser Acceptance Fixture Project',
    'Disposable browser-acceptance fixture project, created for Phase 3 Client Share manual verification only. Not a real project.',
    'In Progress', 'Medium', 'Runtime fixture',
    false, null
  )
  on conflict (id) do update
    set title = excluded.title;

  -- ---------------------------------------------------------
  -- 4. One task, resolved idempotently by (project_id, task_title)
  --    rather than a fixed literal id -- tasks.id is a bigint identity
  --    column, so forcing a specific value would require
  --    `overriding system value`, an unnecessary risk for a single
  --    fixture row this script can just as safely look up first.
  -- ---------------------------------------------------------
  select id into v_task_id
    from public.tasks
    where project_id = v_project_id
      and task_title = 'Phase 3 browser fixture task'
    limit 1;

  if v_task_id is null then
    insert into public.tasks (
      user_id, client_id, client_name, contact_name, project_id,
      subtask_order, task_title, status, priority, source
    ) values (
      v_owner_id, v_client_id, 'Phase 3 Browser Fixture Client', 'Runtime Fixture Contact', v_project_id,
      1, 'Phase 3 browser fixture task', 'In Progress', 'Medium', 'Runtime fixture'
    )
    returning id into v_task_id;
  end if;

  -- ---------------------------------------------------------
  -- 5. One safe LINK resource. resource_type <> 'note',
  --    storage_path/file_name both null, url set -- classifies as a
  --    LINK resource under resource-api.ts's own
  --    isFileResource/isLinkResource/isNoteResource logic exactly
  --    (isFileResource: storage_path OR file_name truthy; isLinkResource:
  --    url truthy; isNoteResource: resource_type = 'note'). No storage
  --    path, no signed URL, no private note content -- Phase 3 metadata/
  --    link projection only, never Phase 4 file delivery.
  -- ---------------------------------------------------------
  insert into public.task_resources (
    id, user_id, project_id, task_id,
    resource_type, title, url, storage_path, file_name, notes
  ) values (
    v_resource_id, v_owner_id, v_project_id, v_task_id,
    'link', 'Phase 3 Browser Fixture Resource', 'https://example.com/runtime-resource', null, null, null
  )
  on conflict (id) do update
    set title = excluded.title;

  raise notice 'seed_status = DISPOSABLE_OWNER_CONTENT_SEEDED (owner_id=%, project_id=%, task_id=%, resource_id=%)',
    v_owner_id, v_project_id, v_task_id, v_resource_id;
end;
$$;

select 'DISPOSABLE_OWNER_CONTENT_SEEDED'::text as seed_status;
