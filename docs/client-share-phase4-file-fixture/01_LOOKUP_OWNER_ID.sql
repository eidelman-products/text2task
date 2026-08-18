-- Text2Task Client Share Link -- Phase 4 Disposable File Fixture
-- File 01: Look up the existing disposable owner's id
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- READ-ONLY. Inserts, updates, or deletes nothing. Run this first and
-- copy the printed `owner_id` -- you need it to construct the exact
-- Storage upload path in the next manual step (see 00_READ_ME_FIRST.md).
--
-- Reuses the exact same safety gate and deterministic-email resolution
-- strategy as docs/client-share-phase3-browser-acceptance/
-- 02_SEED_DISPOSABLE_OWNER_CONTENT.sql -- not a new pattern.

do $$
declare
  v_sentinel_kind text;
  v_owner_count integer;
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

  select count(*) into v_owner_count
    from auth.users
    where email = 'phase3-browser-owner@example.invalid';

  if v_owner_count <> 1 then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Expected exactly 1 auth.users row for phase3-browser-owner@example.invalid, found %s. Run docs/client-share-phase3-browser-acceptance/02_SEED_DISPOSABLE_OWNER_CONTENT.sql''s own prerequisites first (see that file''s header comment).',
      v_owner_count
    );
  end if;
end;
$$;

select
  id as owner_id,
  email as owner_email
from auth.users
where email = 'phase3-browser-owner@example.invalid';

-- Expected: exactly one row. Copy the `owner_id` value -- you will paste
-- it into the Supabase Storage dashboard's upload path in the next step
-- (00_READ_ME_FIRST.md, step 4). This script does not need you to paste
-- it anywhere else: 02_INSERT_FILE_RESOURCE.sql re-resolves the same id
-- itself, from the same email, so the two can never drift apart.
