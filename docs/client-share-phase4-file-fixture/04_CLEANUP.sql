-- Text2Task Client Share Link -- Phase 4 Disposable File Fixture
-- File 04: Clean up the disposable FILE resource (DB side only)
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- Run this AFTER the manual browser proof (00_READ_ME_FIRST.md, step 7)
-- has been captured. Deletes only the one row this package inserted --
-- never touches the reused Phase 3 owner/project/task or its existing
-- LINK resource.
--
-- IMPORTANT: this does NOT delete the Storage object. `DELETE FROM
-- task_resources` has no trigger wired to Supabase Storage in this
-- disposable project (that cleanup only happens in the real app via
-- app/api/task-resources/route.ts's own explicit
-- `supabase.storage.from(...).remove([storage_path])` call, which this
-- SQL-only fixture never went through). After running this file,
-- separately delete the uploaded object by hand: Dashboard -> Storage ->
-- task-resources -> navigate to
-- <owner_id>/33333333-3333-4333-8333-333333333333/project/ -> select
-- 77777777-7777-4777-8777-777777777777.txt -> Delete.
--
-- If the fixture file was ever selected into a share link's Attachments
-- during the manual proof, also unshare/deselect it through the real
-- owner UI (Share with client -> Attachments) BEFORE running this
-- delete -- share_link_resources.resource_id has `on delete cascade`
-- from task_resources, so the mapping row would be removed automatically
-- either way, but unsharing through the UI first is the cleaner, more
-- realistic teardown path and matches how an owner would actually do it.

do $$
declare
  v_sentinel_kind text;
  v_resource_id constant uuid := '66666666-6666-4666-8666-666666666666';
  v_deleted_count integer;
begin
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

  delete from public.task_resources where id = v_resource_id;
  get diagnostics v_deleted_count = row_count;

  raise notice 'file_fixture_cleanup_status = PHASE4_FILE_RESOURCE_DELETED (resource_id=%, rows_deleted=%)',
    v_resource_id, v_deleted_count;
end;
$$;

select 'PHASE4_FILE_RESOURCE_DELETED'::text as file_fixture_cleanup_status;

-- Reminder: this file alone does not finish cleanup. Still required:
--   1. Delete the Storage object by hand (see header comment above).
--   2. If a share link was created/modified during the proof, either
--      leave it (it is disposable-project-only and harmless) or clean
--      it up through the real owner UI, matching how any other Phase 3
--      browser-acceptance share link in this same disposable project is
--      already handled.
