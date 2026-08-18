-- Text2Task Client Share Link -- Phase 4 Disposable File Fixture
-- File 02: Insert the FILE task_resources row
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this ONLY after:
--   1. 01_LOOKUP_OWNER_ID.sql has been run successfully in this SAME project.
--   2. The task-resources bucket exists (private) -- see 00_READ_ME_FIRST.md.
--   3. phase4-stream-test-9.5mb.txt has been uploaded via the Supabase
--      dashboard's Storage UI to the exact path this file constructs
--      below (owner_id/33333333-3333-4333-8333-333333333333/project/
--      77777777-7777-4777-8777-777777777777.txt). This file does NOT
--      upload the object itself -- SQL has no access to Storage's
--      binary object store, only to the task_resources metadata row
--      that points at it. If the object was not actually uploaded to
--      this exact path first, the eventual GET .../resources/[fileRef]
--      streamed-delivery call will fail at its own storage.download()
--      step even though this row inserts successfully -- the row and
--      the object are two independent systems that must each be correct.
--
-- Deterministic identity namespace for this package (continues the
-- existing Phase 3 browser-acceptance package's single-repeated-digit
-- UUID convention -- 1/2/3/4 are already used there,
-- 5 is already used as a unit-test-only sentinel elsewhere in this repo,
-- 6/7 are the next unused values, chosen specifically to avoid collision
-- with either):
--   Reused fixture owner email:  phase3-browser-owner@example.invalid
--   Reused fixture project id:   33333333-3333-4333-8333-333333333333
--   New fixture resource id:     66666666-6666-4666-8666-666666666666
--   New Storage object filename: 77777777-7777-4777-8777-777777777777.txt

do $$
declare
  v_sentinel_kind text;
  v_owner_id uuid;
  v_owner_count integer;
  v_project_id constant uuid := '33333333-3333-4333-8333-333333333333';
  v_resource_id constant uuid := '66666666-6666-4666-8666-666666666666';
  v_storage_filename constant text := '77777777-7777-4777-8777-777777777777.txt';
  v_storage_path text;
  v_project_exists boolean;
begin
  -- ---------------------------------------------------------
  -- Safety gate: identical to every other file in this package family.
  -- ---------------------------------------------------------
  if to_regclass('public.text2task_client_share_phase3_application_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The Phase 3 application runtime test sentinel was not found in this project.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase3_application_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_3_APPLICATION_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED. The sentinel row does not identify this project as the disposable Phase 3 application runtime test project.';
  end if;

  -- ---------------------------------------------------------
  -- Resolve the SAME owner 01_LOOKUP_OWNER_ID.sql resolved -- never
  -- trusts a UUID pasted by hand into this file, so the object path
  -- computed here always matches what that lookup already reported.
  -- ---------------------------------------------------------
  select count(*) into v_owner_count
    from auth.users
    where email = 'phase3-browser-owner@example.invalid';

  if v_owner_count <> 1 then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Expected exactly 1 auth.users row for phase3-browser-owner@example.invalid, found %s.',
      v_owner_count
    );
  end if;

  select id into v_owner_id
    from auth.users
    where email = 'phase3-browser-owner@example.invalid';

  -- ---------------------------------------------------------
  -- Confirm the reused fixture project actually belongs to this owner
  -- before attaching anything to it -- never assumes File 02 of the
  -- Phase 3 package ran successfully, checks it.
  -- ---------------------------------------------------------
  select exists(
    select 1 from public.projects
    where id = v_project_id and user_id = v_owner_id and deleted_at is null
  ) into v_project_exists;

  if not v_project_exists then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Fixture project %s was not found for owner %s. Run docs/client-share-phase3-browser-acceptance/02_SEED_DISPOSABLE_OWNER_CONTENT.sql first.',
      v_project_id, v_owner_id
    );
  end if;

  -- ---------------------------------------------------------
  -- The exact path createSafeStoragePath() would have produced for this
  -- owner/project/no-task combination:
  --   `${userId}/${projectId}/project/${randomUUID}.${extension}`
  -- ---------------------------------------------------------
  v_storage_path := v_owner_id || '/' || v_project_id || '/project/' || v_storage_filename;

  -- ---------------------------------------------------------
  -- Project-level FILE resource (task_id left null -- see
  -- 00_READ_ME_FIRST.md's "Project-level, not task-level" section for
  -- why). Classifies as FILE under resource-api.ts's own
  -- isFileResource/isLinkResource/isNoteResource: storage_path is
  -- truthy, url is null, resource_type is not 'note'. Idempotent: safe
  -- to re-run (e.g. after re-uploading the Storage object under the
  -- same path).
  -- ---------------------------------------------------------
  insert into public.task_resources (
    id, user_id, project_id, task_id,
    resource_type, title, url, storage_path, file_name, mime_type, size_bytes, notes
  ) values (
    v_resource_id, v_owner_id, v_project_id, null,
    'file', 'Phase 4 Browser Fixture File', null, v_storage_path,
    'phase4-stream-test-9.5mb.txt', 'text/plain', 9961472,
    'Disposable Phase 4 streamed-delivery fixture file. Not real content. ~9.5 MiB, matches the exact byte count already proven to stream correctly in Phase 4A''s local proof (9,961,472 bytes).'
  )
  on conflict (id) do update
    set storage_path = excluded.storage_path,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        title = excluded.title;

  raise notice 'file_fixture_status = PHASE4_FILE_RESOURCE_INSERTED (owner_id=%, project_id=%, resource_id=%, storage_path=%)',
    v_owner_id, v_project_id, v_resource_id, v_storage_path;
end;
$$;

select 'PHASE4_FILE_RESOURCE_INSERTED'::text as file_fixture_status;
