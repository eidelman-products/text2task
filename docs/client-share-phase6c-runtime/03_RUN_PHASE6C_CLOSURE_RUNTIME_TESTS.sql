-- Text2Task Client Share Link -- Phase 6C Atomic Apply + Conversion Closure
-- Runtime Verification Package -- File 03
--
-- RENAMED from File 02 (02_RUN_PHASE6C_CLOSURE_RUNTIME_TESTS.sql) after a
-- second, final read-only implementation-acceptance audit required three
-- runtime-harness corrections: a real dedicated COMMIT-scope test for the
-- capability GUC (now its own file, 02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql,
-- run BEFORE this one), a genuine forced-failure test at the actual
-- share_messages converted-UPDATE step (this file's new
-- ATOMIC_FAILURE_MESSAGE_UPDATE section), and a real executed
-- reconcile_project_completion regression (this file's new
-- COMPLETION_RECONCILIATION section). The file was renumbered so the
-- required run order (schema prep -> migration -> real COMMIT-scope test
-- -> this always-ROLLBACK suite) reads as ascending file numbers with no
-- reordering note required. See docs/client-share-phase6c-runtime/00_READ_ME_FIRST.md
-- for the full, current sequence.
--
-- Run this in the SAME disposable Supabase project already used for the
-- Phase 6A/6B packages, AFTER, in this exact order:
--   1. docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql
--   2. docs/client-share-phase6a-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql
--   3. The exact, unmodified contents of
--      supabase/migrations/202608230001_client_share_apply_boundary.sql,
--      pasted and run verbatim (not duplicated into any package, per this
--      whole family's own established convention for small, self-
--      contained migrations).
--   4. docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql
--      -- installs the REAL, current apply_project_update_transaction /
--      reconcile_project_completion / apply_task_bulk_status_transaction
--      from 202607270001 (the Phase 6A bundle deliberately excludes it).
--   5. The exact, unmodified contents of
--      supabase/migrations/202608230002_client_share_apply_conversion_closure.sql,
--      pasted and run verbatim -- installs finalize_share_message_conversion,
--      and narrows/extends the three functions installed by steps 3/4/1.
--   6. docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql
--      -- REQUIRED. Without it, every SUCCESS-path test below fails with
--      an ordinary "column does not exist" error the moment
--      apply_project_update_transaction tries to read/write a
--      projects/tasks/clients column the Phase 6A fixture's minimal
--      stand-ins never carried (Phase 6B's own runtime tests never
--      reached that code -- see that file's own header for the full
--      trace).
--   7. docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql
--      -- REQUIRED before this file, not merely recommended. This file's
--      own CAP-G section no longer asserts anything about real-COMMIT
--      behavior (that claim was hardcoded/undocumented in the prior
--      version of this file and has been removed) -- 02's own dedicated,
--      real-COMMIT test is now the ONLY evidence for that property, and
--      it is recorded separately, not folded into this file's own
--      total_tests/passed_tests/failed_tests count.
--
-- Never run this in the real Text2Task production project.
--
-- IMPORTANT TEST-HARNESS-PRIVILEGE NOTE, read before Sections CAP/PROV:
-- a handful of tests below (marked explicitly) use pg_temp.force_capability()
-- to set the transaction-local capability GUC directly, AS THE SCRIPT
-- AUTHOR running raw SQL in this disposable project -- a privilege a real
-- PostgREST-restricted `authenticated` client never has (PostgREST does
-- not expose the built-in set_config function as a callable RPC at all;
-- see the Accepted Plan / Phase 6C plan document's own Audit 4 finding).
-- Those specific tests exist to validate finalize_share_message_conversion's
-- OWN independent checks in isolation (ownership, project match, author
-- type, not-already-converted) -- they do NOT claim a real attacker could
-- ever reach that state; the tests that DO model the real attacker
-- threat model (Sections CAP-A/B/C and D's own fabrication step) use
-- exactly the same privileged-setup technique ONLY to fabricate the
-- pre-condition (an apparently-applied row with no capability held for
-- it), never to bypass what is being tested.
--
-- Sections:
--   SUCCESS                    -> a real, full, successful client_share
--                                Apply: accepted work mutation + timeline
--                                + item/update status + row-bound
--                                capability + conversion closure, all in
--                                one transaction
--   REJECT_ONLY                 -> a legitimate reject-only Apply
--                                (accepted=[]) still converts, with zero
--                                work mutation and zero timeline
--   ATOMIC_FAILURE               -> a forced conversion-INSERT failure
--                                rolls back the entire transaction,
--                                including the already-executed accepted
--                                work mutation
--   ATOMIC_FAILURE_MESSAGE_UPDATE -> NEW. a forced failure at the actual
--                                share_messages status='converted' UPDATE
--                                step (not the conversion INSERT) rolls
--                                back the entire transaction, including
--                                the already-committed conversion INSERT
--                                and the accepted work mutation
--   CAP (A-H)                    -> the forged-'applied' standalone-
--                                invocation attack is closed, in every
--                                variant the Phase 6C security audit
--                                modeled. CAP-G is now an INFORMATIONAL
--                                POINTER ONLY to 02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql
--                                -- see that section's own comment
--   APPLYING (I-J)                -> 'applying' is no longer blocked; the
--                                real RPC only ever succeeds through its
--                                own full validation
--   APPLIED_EXISTING (K)          -> an already-applied row's ordinary
--                                non-status update does not require the
--                                capability
--   TERMINALITY                  -> converted -> new/reviewed/resolved/
--                                dismissed all rejected via
--                                set_share_message_status
--   IDEMPOTENCY                  -> replay/stale apply_attempt_id
--                                rejected; duplicate conversion rejected
--   PROVENANCE                   -> wrong owner / wrong project /
--                                non-client source all rejected
--   HISTORY                      -> a retained message on a revoked link
--                                can still be Applied successfully
--   COMPLETION_RECONCILIATION     -> NEW. a real Apply that finishes a
--                                project's last active task exercises
--                                the unmodified, 202607270001-authoritative
--                                reconcile_project_completion in the SAME
--                                transaction as a real client_share
--                                conversion
--   REGRESSION                   -> text Apply is completely unaffected
--
-- SCOPE NOTE: every accepted-item test EXCEPT the new
-- COMPLETION_RECONCILIATION section deliberately uses the SAME item
-- type, 'priority_change' -- it produces a real project-field mutation,
-- a real timeline event, and real priority-provenance behavior, which is
-- sufficient to exercise every NEW Phase 6C code path (the capability
-- set_config, the closure block, finalize_share_message_conversion), all
-- of which are item-type-agnostic. It deliberately does NOT re-exercise
-- new_subtask/client_detail_change's own item-specific mutation logic --
-- that logic is unchanged, byte-for-byte, from before this migration
-- (proven by this migration's own static reconstruction/hash tests, not
-- by this runtime file), and was never Phase 6C's own new surface.
-- COMPLETION_RECONCILIATION uses 'update_subtask' specifically because
-- that is the real, evidenced path capable of finishing a task (see that
-- section's own comment).

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing text[];
  v_missing_grants text[];
begin
  if to_regclass('public.text2task_client_share_phase6a_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6A runtime test sentinel was not found. Run the Phase 6A runtime package first.';
  end if;

  if to_regclass('public.text2task_client_share_phase6c_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6C base-table extension sentinel was not found. Run docs/client-share-phase6c-runtime/01_EXTEND_BASE_TABLES_FOR_FULL_APPLY.sql first.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase6a_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_6A_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 6A/6B/6C runtime test project.';
  end if;

  -- 01B has no sentinel row of its own -- its readiness is checked here
  -- durably, the same way its own final verification block checks
  -- itself: by probing the live grant state directly, not by trusting a
  -- marker row.
  select array_agg(g.description order by g.description) into v_missing_grants
    from (values
      ('projects.INSERT', 'projects', 'INSERT'), ('projects.UPDATE', 'projects', 'UPDATE'),
      ('projects.DELETE', 'projects', 'DELETE'),
      ('tasks.INSERT', 'tasks', 'INSERT'), ('tasks.UPDATE', 'tasks', 'UPDATE'),
      ('tasks.DELETE', 'tasks', 'DELETE'),
      ('clients.INSERT', 'clients', 'INSERT'), ('clients.UPDATE', 'clients', 'UPDATE')
    ) as g(description, table_name, privilege)
    where not has_table_privilege('authenticated', 'public.' || g.table_name, g.privilege);

  if v_missing_grants is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected authenticated grant(s): %s. Run docs/client-share-phase6c-runtime/01B_GRANT_MUTATION_PRIVILEGES_FOR_FULL_APPLY.sql first.',
      array_to_string(v_missing_grants, ', ')
    );
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'is_archived'
  ) then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. public.tasks.is_archived was not found. Run docs/client-share-phase6c-runtime/01C_EXTEND_RECONCILIATION_COLUMNS_FOR_FULL_APPLY.sql first.';
  end if;

  select array_agg(t.name) into v_missing
    from (values
      ('function:apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)'),
      ('function:finalize_share_message_conversion(uuid,uuid)'),
      ('function:set_share_message_status(uuid,text)'),
      ('function:enforce_project_update_client_share_apply_boundary()'),
      ('function:reconcile_project_completion(uuid,uuid,timestamptz)'),
      -- Required by PROVENANCE/P3's owner-authored fixture message (real
      -- owner path, never a raw authenticated INSERT into share_messages
      -- -- see that section's own comment). Already installed by stage A
      -- step 2 (the Phase 6A bundle applies
      -- 202608190001_client_share_message_owner_rpcs.sql verbatim) --
      -- checked here too, defense-in-depth, so a missing/misordered
      -- prerequisite fails loudly here rather than deep inside PROVENANCE.
      ('function:send_share_message_reply(uuid,uuid,text)'),
      -- Required by HISTORY's revocation step (real owner path, never a
      -- privileged direct UPDATE of the link row -- see that section's
      -- own comment). Already installed by stage A step 2's Phase 6A
      -- bundle (202608060002_client_share_access_operations.sql) --
      -- checked here too for the same defense-in-depth reason as above.
      ('function:revoke_share_link(uuid)')
    ) as t(name)
    where to_regprocedure('public.' || split_part(t.name, ':', 2)) is null;

  if v_missing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected object(s): %s. If send_share_message_reply or revoke_share_link is listed, it should already be installed by the Phase 6A bundle (stage A step 2) -- confirm that ran successfully before this file. Otherwise apply supabase/migrations/202608230002_client_share_apply_conversion_closure.sql (steps 1-5 above) first.',
      array_to_string(v_missing, ', ')
    );
  end if;
end;
$$;

begin;

-- Always rolled back at the end of this file -- no fixture row or
-- test-only object survives a run. Safe to re-run repeatedly. This file
-- issues NO COMMIT anywhere -- the real-COMMIT property is proven only
-- by 02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql, run separately, before this
-- file, per this whole family's own established "always rollback" safety
-- discipline for the main suite.

create table test_results (
  seq integer generated always as identity,
  section text not null,
  name text not null,
  status text not null,
  detail text null
);

create table fixture_ids (
  key text primary key,
  value uuid not null
);

grant select, insert on test_results, fixture_ids to anon, authenticated, service_role;
grant usage, select on sequence test_results_seq_seq to anon, authenticated, service_role;

create or replace function pg_temp.record_result(
  p_section text, p_name text, p_passed boolean, p_detail text default null
) returns void language plpgsql as $$
begin
  insert into test_results (section, name, status, detail)
  values (p_section, p_name, case when p_passed then 'PASS' else 'FAIL' end, p_detail);
end;
$$;

-- Matches the Phase 6A/6B runtime packages' own act_as() exactly.
create or replace function pg_temp.act_as(p_role text, p_user_id uuid default null)
returns void language plpgsql as $f$
begin
  reset role;
  if p_user_id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', p_role)::text, true);
  else
    perform set_config('request.jwt.claims', '{}', true);
  end if;
  if p_role <> 'postgres' then
    execute format('set local role %I', p_role);
  end if;
end;
$f$;

-- TEST-HARNESS-PRIVILEGE ONLY -- see this file's own header note. Sets
-- (or clears, when p_update_id is null) the transaction-local capability
-- directly, bypassing the real Apply RPC entirely. Used only to fabricate
-- test preconditions or to guarantee a clean "no capability held" state
-- before a rejection test -- never to make a test itself pass.
create or replace function pg_temp.force_capability(p_update_id uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'text2task.client_share_apply_update_id',
    coalesce(p_update_id::text, ''),
    true
  );
end;
$$;

-- =========================================================
-- Shared fixture
-- =========================================================

do $$
declare
  v_owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  v_owner_b constant uuid := '22222222-2222-4222-8222-222222222222';
  v_project_a uuid;
  v_client_a uuid;
  v_link_active uuid;
  v_link_revoked uuid;
  v_project_b uuid;
begin
  insert into public.clients (user_id, name) values (v_owner_a, 'Acme Co') returning id into v_client_a;

  insert into public.projects (user_id, client_id, title, status, priority, priority_source)
    values (v_owner_a, v_client_a, 'Homepage refresh', 'In Progress', 'Medium', 'ai')
    returning id into v_project_a;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at
  ) values (
    v_owner_a, v_project_a, 'phase6cClosureLinkActive', 'active', true,
    repeat('c6', 32), 1, 1, now()
  ) returning id into v_link_active;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at, revoked_at
  ) values (
    v_owner_a, v_project_a, 'phase6cClosureLinkRevoked', 'revoked', true,
    repeat('c7', 32), 1, 1, now(), now()
  ) returning id into v_link_revoked;

  insert into public.projects (user_id, title, status, priority, priority_source)
    values (v_owner_b, 'Owner B project', 'In Progress', 'Medium', 'ai')
    returning id into v_project_b;

  insert into fixture_ids (key, value) values
    ('owner_a', v_owner_a), ('owner_b', v_owner_b),
    ('project_a', v_project_a), ('project_b', v_project_b),
    ('client_a', v_client_a),
    ('link_active', v_link_active), ('link_revoked', v_link_revoked);
end;
$$;

-- Helper: inserts one client-authored share_messages row and returns its id.
create or replace function pg_temp.new_client_message(p_link_id uuid, p_owner_id uuid, p_project_id uuid, p_body text)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform pg_temp.act_as('service_role');
  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
    values (p_owner_id, p_link_id, p_project_id, 'client', p_body, true)
    returning id into v_id;
  perform pg_temp.act_as('postgres');
  return v_id;
end;
$$;

-- Helper: reserves a client_share project_updates row at status='analyzed'
-- with one 'suggested' priority_change item, mirroring what a real Analyze
-- would have produced. Returns (update_id, item_id) via OUT parameters.
create or replace function pg_temp.new_analyzed_priority_change(
  p_owner_id uuid, p_project_id uuid, p_message_id uuid, p_body text,
  out o_update_id uuid, out o_item_id uuid
) language plpgsql as $$
begin
  perform pg_temp.act_as('authenticated', p_owner_id);

  insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
    values (p_owner_id, p_project_id, 'client_share', p_message_id, p_body, 'analyzed')
    returning id into o_update_id;

  insert into public.project_update_items (
    project_update_id, user_id, project_id, type, title, new_value, confidence, status
  ) values (
    o_update_id, p_owner_id, p_project_id, 'priority_change', 'Raise priority to High',
    jsonb_build_object('priority', 'High'), 0.9, 'suggested'
  ) returning id into o_item_id;

  perform pg_temp.act_as('postgres');
end;
$$;

-- Helper: claims (analyzed -> applying) and then calls the real Apply RPC
-- with the one priority_change item accepted, exactly mirroring the shape
-- app/api/project-updates/apply/route.ts itself builds. Returns the RPC's
-- own jsonb result.
create or replace function pg_temp.run_full_apply(
  p_owner_id uuid, p_update_id uuid, p_item_id uuid, out o_attempt_id uuid, out o_result jsonb
) language plpgsql as $$
begin
  perform pg_temp.act_as('authenticated', p_owner_id);

  o_attempt_id := gen_random_uuid();

  update public.project_updates
    set status = 'applying', apply_attempt_id = o_attempt_id, apply_started_at = now()
    where id = p_update_id;

  o_result := public.apply_project_update_transaction(
    p_update_id,
    o_attempt_id,
    array[p_item_id]::uuid[],
    array[]::uuid[],
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'itemId', p_item_id,
        'itemType', 'priority_change',
        'newValue', jsonb_build_object('priority', 'High'),
        'mutation', jsonb_build_object('kind', 'project_field', 'updates', jsonb_build_object('priority', 'High')),
        'event', jsonb_build_object('eventType', 'priority_updated', 'title', 'Priority updated to High')
      )
    )
  );

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- SUCCESS: a real, full, successful client_share Apply
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid;
  v_msg uuid; v_update_id uuid; v_item_id uuid; v_attempt_id uuid; v_result jsonb;
  v_conversion record;
  v_message record;
  v_project_priority text;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'Please bump this to high priority.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'Please bump this to high priority.');

  select o_attempt_id, o_result into v_attempt_id, v_result
    from pg_temp.run_full_apply(v_owner_a, v_update_id, v_item_id);

  perform pg_temp.record_result('SUCCESS', 'S1: the RPC returns a non-null result', v_result is not null);

  perform pg_temp.record_result(
    'SUCCESS', 'S2: project_updates.status = applied',
    (select status from public.project_updates where id = v_update_id) = 'applied'
  );

  perform pg_temp.record_result(
    'SUCCESS', 'S3: the accepted item is status=applied',
    (select status from public.project_update_items where id = v_item_id) = 'applied'
  );

  select priority into v_project_priority from public.projects where id = v_project_a;
  perform pg_temp.record_result('SUCCESS', 'S4: the real project mutation committed (priority=High)', v_project_priority = 'High');

  perform pg_temp.record_result(
    'SUCCESS', 'S5: priority provenance was recorded (priority_source=user)',
    (select priority_source from public.projects where id = v_project_a) = 'user'
  );

  perform pg_temp.record_result(
    'SUCCESS', 'S6: exactly one project_timeline_events row was committed for this item',
    (select count(*) from public.project_timeline_events where source_item_id = v_item_id) = 1
  );

  select * into v_conversion from public.share_message_conversions where message_id = v_msg;
  perform pg_temp.record_result('SUCCESS', 'S7: exactly one share_message_conversions row exists for this message', v_conversion.id is not null);
  perform pg_temp.record_result('SUCCESS', 'S8: the conversion row references the correct project_update_id', v_conversion.project_update_id = v_update_id);
  perform pg_temp.record_result('SUCCESS', 'S9: the conversion row''s converted_by is the owner', v_conversion.converted_by = v_owner_a);
  perform pg_temp.record_result('SUCCESS', 'S10: target_task_id is null (Phase 6C never links a specific task)', v_conversion.target_task_id is null);

  select * into v_message from public.share_messages where id = v_msg;
  perform pg_temp.record_result('SUCCESS', 'S11: share_messages.status = converted', v_message.status = 'converted');
  perform pg_temp.record_result('SUCCESS', 'S12: reviewed_at was set (coalesced to conversion time)', v_message.reviewed_at is not null);
  perform pg_temp.record_result('SUCCESS', 'S13: resolved_at was never touched (still null)', v_message.resolved_at is null);
  perform pg_temp.record_result('SUCCESS', 'S14: conversion.converted_at and message.reviewed_at agree', v_conversion.converted_at = v_message.reviewed_at);

  insert into fixture_ids (key, value) values ('success_update_id', v_update_id), ('success_msg_id', v_msg);
end;
$$;

-- =========================================================
-- REJECT_ONLY: a legitimate reject-only Apply still converts
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid;
  v_msg uuid; v_update_id uuid; v_item_id uuid; v_attempt_id uuid; v_result jsonb;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'Never mind, ignore my last message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'Never mind, ignore my last message.');

  perform pg_temp.act_as('authenticated', v_owner_a);
  v_attempt_id := gen_random_uuid();
  update public.project_updates set status = 'applying', apply_attempt_id = v_attempt_id where id = v_update_id;

  v_result := public.apply_project_update_transaction(
    v_update_id, v_attempt_id, array[]::uuid[], array[v_item_id]::uuid[], '[]'::jsonb, '[]'::jsonb
  );
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'REJECT_ONLY', 'R1: a reject-only Apply (accepted=[]) still reaches status=applied',
    (select status from public.project_updates where id = v_update_id) = 'applied'
  );

  perform pg_temp.record_result(
    'REJECT_ONLY', 'R2: the rejected item is status=rejected, not applied',
    (select status from public.project_update_items where id = v_item_id) = 'rejected'
  );

  perform pg_temp.record_result(
    'REJECT_ONLY', 'R3: zero project_timeline_events rows exist for this item (no accepted work)',
    (select count(*) from public.project_timeline_events where source_item_id = v_item_id) = 0
  );

  perform pg_temp.record_result(
    'REJECT_ONLY', 'R4: the message still converted despite zero accepted items -- proves conversion never required accepted work as proof',
    (select status from public.share_messages where id = v_msg) = 'converted'
  );

  perform pg_temp.record_result(
    'REJECT_ONLY', 'R5: exactly one share_message_conversions row exists',
    (select count(*) from public.share_message_conversions where message_id = v_msg) = 1
  );
end;
$$;

-- =========================================================
-- ATOMIC_FAILURE: a forced conversion-INSERT failure rolls back the
-- entire transaction, including the already-executed accepted work.
-- =========================================================

do $$
declare
  v_owner_a uuid; v_link_active uuid;
  v_af_project uuid; v_af_link uuid;
  v_msg uuid; v_update_id uuid; v_item_id uuid; v_attempt_id uuid;
  v_priority_before text;
  v_priority_source_before text;
  v_failed boolean := false;
  v_errcode text; v_errmsg text; v_constraint_name text;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  -- Dedicated project + link, with a deterministic baseline
  -- (priority='Medium', priority_source='ai'), NOT the shared project_a.
  -- project_a's own priority/priority_source were already mutated to
  -- High/user by the earlier SUCCESS section -- reusing it here would
  -- make the attempted mutation a no-op (High -> High), so "still equals
  -- v_priority_before" would prove nothing about rollback, and
  -- priority_source being already 'user' from that unrelated earlier
  -- test would make an "is not user" assertion fail even when THIS
  -- test's own rollback is working perfectly. A fresh project makes the
  -- attempted mutation observably different from its own baseline, and
  -- the post-failure assertion an exact, meaningful restoration proof.
  insert into public.projects (user_id, title, status, priority, priority_source)
    values (v_owner_a, 'ATOMIC_FAILURE baseline project', 'In Progress', 'Medium', 'ai')
    returning id into v_af_project;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at
  ) values (
    v_owner_a, v_af_project, 'phase6cAtomicFailureLink', 'active', true,
    repeat('c9', 32), 1, 1, now()
  ) returning id into v_af_link;

  v_msg := pg_temp.new_client_message(v_af_link, v_owner_a, v_af_project, 'Please bump this too.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_af_project, v_msg, 'Please bump this too.');

  select priority, priority_source into v_priority_before, v_priority_source_before
    from public.projects where id = v_af_project;

  -- Force the conversion INSERT to fail on
  -- share_message_conversions_message_id_unique by pre-inserting a
  -- conversion row for this SAME message_id, before Apply ever runs -- a
  -- deliberate, controlled fault injection, not a claim this is how the
  -- constraint would normally be hit in practice. This pre-insert is
  -- privileged TEST SETUP, not an attacker action: pg_temp.act_as
  -- ('postgres', v_owner_a) stays on role=postgres (needed since
  -- `authenticated` has no direct INSERT grant on this table -- writes
  -- normally only ever happen inside the SECURITY DEFINER helper) while
  -- setting auth.uid() = v_owner_a via the request.jwt.claims GUC, so
  -- the REAL, unmodified, still-fully-enabled
  -- enforce_share_message_conversion_integrity() trigger's own
  -- `auth.uid() = new.converted_by` check is genuinely SATISFIED, not
  -- bypassed, disabled, or weakened.
  perform pg_temp.act_as('postgres', v_owner_a);
  insert into public.share_message_conversions (user_id, message_id, converted_by)
    values (v_owner_a, v_msg, v_owner_a);
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', v_owner_a);
  v_attempt_id := gen_random_uuid();
  update public.project_updates set status = 'applying', apply_attempt_id = v_attempt_id where id = v_update_id;

  begin
    perform public.apply_project_update_transaction(
      v_update_id, v_attempt_id, array[v_item_id]::uuid[], array[]::uuid[], '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'itemId', v_item_id, 'itemType', 'priority_change',
          'newValue', jsonb_build_object('priority', 'High'),
          'mutation', jsonb_build_object('kind', 'project_field', 'updates', jsonb_build_object('priority', 'High')),
          'event', jsonb_build_object('eventType', 'priority_updated', 'title', 'Priority updated to High')
        )
      )
    );
  exception when unique_violation then
    v_failed := true;
    get stacked diagnostics
      v_errcode = returned_sqlstate,
      v_errmsg = message_text,
      v_constraint_name = constraint_name;
  end;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF0: the baseline is genuinely Medium/ai, so the attempted High/user mutation is observably different from it',
    v_priority_before = 'Medium' and v_priority_source_before = 'ai'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF1: the forced failure is the real unique_violation (SQLSTATE 23505) on the exact share_message_conversions_message_id_unique constraint',
    v_failed and v_errcode = '23505' and v_constraint_name = 'share_message_conversions_message_id_unique'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF2: the attempted priority mutation (Medium -> High) was fully rolled back -- priority is exactly its captured pre-Apply baseline',
    (select priority from public.projects where id = v_af_project) is not distinct from v_priority_before
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF3: priority_source is exactly its captured pre-Apply baseline (ai -> user was rolled back)',
    (select priority_source from public.projects where id = v_af_project) is not distinct from v_priority_source_before
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF4: no project_timeline_events row survived for this item',
    not exists (select 1 from public.project_timeline_events where source_item_id = v_item_id)
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF5: the item is still status=suggested, not applied (its own status write rolled back too)',
    (select status from public.project_update_items where id = v_item_id) = 'suggested'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF6: project_updates never reached status=applied',
    (select status from public.project_updates where id = v_update_id) is distinct from 'applied'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE', 'AF7: exactly one share_message_conversions row exists for this message (the pre-inserted one, not a duplicate)',
    (select count(*) from public.share_message_conversions where message_id = v_msg) = 1
  );
end;
$$;

-- =========================================================
-- ATOMIC_FAILURE_MESSAGE_UPDATE: NEW -- a forced failure at the actual
-- share_messages status='converted' UPDATE step (not the earlier
-- conversion INSERT) rolls back the entire transaction, including the
-- already-committed conversion INSERT and the accepted work mutation.
--
-- A pre-converted message (as used by ATOMIC_FAILURE above) would fail
-- earlier, at the helper's own status<>'converted' precondition check,
-- and would NOT prove anything about the later UPDATE step -- so this
-- section deliberately does NOT reuse that technique. Instead it installs
-- a TEST-ONLY BEFORE UPDATE trigger on public.share_messages, created and
-- dropped entirely inside this already-open, always-rolled-back
-- transaction -- it is never part of any migration, and the trigger
-- itself (like every other object this section creates) cannot survive
-- this file's own trailing ROLLBACK even if this section's own explicit
-- DROP TRIGGER below were somehow skipped.
-- =========================================================

-- Test-only failure-injection function and trigger. CREATE FUNCTION and
-- CREATE TRIGGER are DDL/utility commands -- plpgsql cannot execute them
-- as bare statements inside a DO block's procedural body (only EXECUTE
-- with a dynamic string could do that), so both are declared here as
-- ordinary top-level statements, exactly like this file's own
-- pg_temp.record_result/act_as/force_capability functions above. Both
-- are still fully scoped to this already-open, always-rolled-back
-- transaction -- pg_temp is session-local, and the trigger on
-- public.share_messages (a real, shared table) is removed by explicit
-- DROP statements immediately after this section's own assertions, well
-- before any later section in this file performs a real conversion.
-- Named distinctly (phase6c_runtime_ prefix) so it can never be confused
-- with a production object, and fires ONLY when a row is being set to
-- status='converted' -- every other share_messages UPDATE (Mark
-- reviewed/Resolve/Dismiss, etc.) is completely unaffected.
create function pg_temp.phase6c_runtime_force_message_conversion_update_failure()
returns trigger language plpgsql as $trg$
begin
  if new.status = 'converted' then
    raise exception using
      errcode = 'P0001',
      message = 'PHASE6C_RUNTIME_FORCED_MESSAGE_UPDATE_FAILURE';
  end if;
  return new;
end;
$trg$;

create trigger phase6c_runtime_force_message_update_failure_trg
  before update on public.share_messages
  for each row
  execute function pg_temp.phase6c_runtime_force_message_conversion_update_failure();

do $$
declare
  v_owner_a uuid; v_link_active uuid;
  v_afm_project uuid; v_afm_link uuid;
  v_msg uuid; v_update_id uuid; v_item_id uuid; v_attempt_id uuid;
  v_priority_before text;
  v_priority_source_before text;
  v_failed boolean := false;
  v_errcode text; v_errmsg text;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  -- Dedicated project + link with a deterministic baseline
  -- (priority='Medium', priority_source='ai') -- same reasoning as
  -- ATOMIC_FAILURE above: the shared project_a was already mutated to
  -- High/user by the earlier SUCCESS section, which would make a
  -- same-value "still equals v_priority_before" assertion prove nothing,
  -- and an "is not user" assertion fail even when this test's own
  -- rollback is working perfectly.
  insert into public.projects (user_id, title, status, priority, priority_source)
    values (v_owner_a, 'ATOMIC_FAILURE_MESSAGE_UPDATE baseline project', 'In Progress', 'Medium', 'ai')
    returning id into v_afm_project;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at
  ) values (
    v_owner_a, v_afm_project, 'phase6cAtomicFailureMsgUpdateLink', 'active', true,
    repeat('ca', 32), 1, 1, now()
  ) returning id into v_afm_link;

  v_msg := pg_temp.new_client_message(v_afm_link, v_owner_a, v_afm_project, 'ATOMIC_FAILURE_MESSAGE_UPDATE fixture message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_afm_project, v_msg, 'ATOMIC_FAILURE_MESSAGE_UPDATE fixture message.');

  select priority, priority_source into v_priority_before, v_priority_source_before
    from public.projects where id = v_afm_project;

  perform pg_temp.act_as('authenticated', v_owner_a);
  v_attempt_id := gen_random_uuid();
  update public.project_updates set status = 'applying', apply_attempt_id = v_attempt_id where id = v_update_id;

  begin
    -- This must reach: work mutation -> timeline -> item/update status
    -- writes -> the row-bound capability -> the applied transition ->
    -- priority provenance -> the conversion INSERT -- and only THEN fail,
    -- exactly at the share_messages UPDATE inside
    -- finalize_share_message_conversion.
    perform public.apply_project_update_transaction(
      v_update_id, v_attempt_id, array[v_item_id]::uuid[], array[]::uuid[], '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'itemId', v_item_id, 'itemType', 'priority_change',
          'newValue', jsonb_build_object('priority', 'High'),
          'mutation', jsonb_build_object('kind', 'project_field', 'updates', jsonb_build_object('priority', 'High')),
          'event', jsonb_build_object('eventType', 'priority_updated', 'title', 'Priority updated to High')
        )
      )
    );
  exception when others then
    if sqlstate = 'P0001' and sqlerrm = 'PHASE6C_RUNTIME_FORCED_MESSAGE_UPDATE_FAILURE' then
      v_failed := true;
    end if;
    get stacked diagnostics v_errcode = returned_sqlstate, v_errmsg = message_text;
  end;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM0: the baseline is genuinely Medium/ai, so the attempted High/user mutation is observably different from it',
    v_priority_before = 'Medium' and v_priority_source_before = 'ai'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM1: the forced failure at the share_messages converted-UPDATE step was actually raised (not some other, earlier error)',
    v_failed
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM2: the attempted priority mutation (Medium -> High) was fully rolled back -- priority is exactly its captured pre-Apply baseline, even though it happened BEFORE the point of failure',
    (select priority from public.projects where id = v_afm_project) is not distinct from v_priority_before
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM3: priority_source is exactly its captured pre-Apply baseline (ai -> user was rolled back)',
    (select priority_source from public.projects where id = v_afm_project) is not distinct from v_priority_source_before
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM4: no project_timeline_events row survived for this item, even though the timeline INSERT happened well before the point of failure',
    not exists (select 1 from public.project_timeline_events where source_item_id = v_item_id)
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM5: the item is still status=suggested, not applied',
    (select status from public.project_update_items where id = v_item_id) = 'suggested'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM6: project_updates never remained at status=applied, even though that write happened before the point of failure',
    (select status from public.project_updates where id = v_update_id) is distinct from 'applied'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM7: the conversion INSERT itself was rolled back -- zero share_message_conversions rows exist for this message, even though the INSERT statement succeeded before the later UPDATE failed',
    not exists (select 1 from public.share_message_conversions where message_id = v_msg)
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM8: the share_message itself remains unconverted (still its original status)',
    (select status from public.share_messages where id = v_msg) <> 'converted'
  );

  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM9: reviewed_at/resolved_at on the message are unchanged from their pre-Apply values (both still null for a freshly-created client message)',
    (select reviewed_at from public.share_messages where id = v_msg) is null
    and (select resolved_at from public.share_messages where id = v_msg) is null
  );
end;
$$;

-- Remove the test-only trigger/function immediately -- every later
-- section in this file legitimately sets share_messages.status='converted'
-- and must not be affected by it. The trailing ROLLBACK at the end of
-- this whole file is the actual, unconditional guarantee (these DROPs
-- are defense-in-depth, not the safety mechanism itself). Same reason as
-- the CREATE statements above: DROP TRIGGER/DROP FUNCTION are DDL and
-- must be top-level statements, not embedded inside a DO block's body.
drop trigger phase6c_runtime_force_message_update_failure_trg on public.share_messages;
drop function pg_temp.phase6c_runtime_force_message_conversion_update_failure();

do $$
begin
  perform pg_temp.record_result(
    'ATOMIC_FAILURE_MESSAGE_UPDATE', 'AFM10: the test-only failure-injection trigger no longer exists on public.share_messages',
    not exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where c.relname = 'share_messages'
        and t.tgname = 'phase6c_runtime_force_message_update_failure_trg'
    )
  );
end;
$$;

-- =========================================================
-- CAP: the forged-'applied' standalone-invocation attack is closed
-- =========================================================

-- CAP-A: raw UPDATE analyzed -> applied, no capability held -> rejected
do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid; v_msg uuid; v_update_id uuid; v_item_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-A fixture message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'CAP-A fixture message.');

  perform pg_temp.force_capability(null);
  perform pg_temp.act_as('authenticated', v_owner_a);

  begin
    update public.project_updates set status = 'applied' where id = v_update_id;
    perform pg_temp.record_result('CAP', 'CAP-A: raw UPDATE analyzed -> applied without the capability is rejected', false, 'update unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'CAP', 'CAP-A: raw UPDATE analyzed -> applied without the capability is rejected',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');
end;
$$;

-- CAP-B: raw INSERT already-applied, no capability held -> rejected
do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid; v_msg uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-B fixture message.');

  perform pg_temp.force_capability(null);
  perform pg_temp.act_as('authenticated', v_owner_a);

  begin
    insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
      values (v_owner_a, v_project_a, 'client_share', v_msg, 'CAP-B fixture message.', 'applied');
    perform pg_temp.record_result('CAP', 'CAP-B: direct INSERT already at status=applied without the capability is rejected', false, 'insert unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'CAP', 'CAP-B: direct INSERT already at status=applied without the capability is rejected',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'CAP', 'CAP-B2: no row was persisted for the CAP-B message',
    not exists (select 1 from public.project_updates where source_share_message_id = v_msg)
  );
end;
$$;

-- CAP-C: standalone helper call against a normal, still-analyzed row, no
-- capability held -> rejected with SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED
do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid; v_msg uuid; v_update_id uuid; v_item_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-C fixture message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'CAP-C fixture message.');

  perform pg_temp.force_capability(null);
  perform pg_temp.act_as('authenticated', v_owner_a);

  begin
    perform public.finalize_share_message_conversion(v_msg, v_update_id);
    perform pg_temp.record_result('CAP', 'CAP-C: standalone helper call against a normal analyzed row is rejected', false, 'call unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'CAP', 'CAP-C: standalone helper call against a normal analyzed row is rejected with the capability-context error',
      sqlstate = 'P0001' and sqlerrm = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');
end;
$$;

-- CAP-D: this is the attack the security audit found. Test-harness-
-- privileged setup fabricates an apparently-applied row WITHOUT ever
-- running the real Apply RPC (the capability is briefly held ONLY to
-- satisfy the trigger for this one fabrication write, exactly documented
-- in this file's own header note), then the capability is cleared before
-- the standalone helper call is attempted -> rejected.
do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid; v_msg uuid; v_update_id uuid; v_item_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-D fixture message (no real work will ever occur).');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'CAP-D fixture message (no real work will ever occur).');

  -- Fabrication step (test-harness-privileged only): satisfy the trigger
  -- for exactly this one write, with ZERO accepted work mutation, ZERO
  -- timeline event, and ZERO item status change -- proving this is NOT
  -- the real Apply RPC's own transaction.
  perform pg_temp.force_capability(v_update_id);
  update public.project_updates set status = 'applied', reviewed_by = v_owner_a, applied_by = v_owner_a, reviewed_at = now(), applied_at = now() where id = v_update_id;
  perform pg_temp.force_capability(null);

  perform pg_temp.record_result(
    'CAP', 'CAP-D0: the fabricated row shows zero real work (proves this was not a real Apply)',
    not exists (select 1 from public.project_timeline_events where source_item_id = v_item_id)
    and (select status from public.project_update_items where id = v_item_id) = 'suggested'
  );

  perform pg_temp.act_as('authenticated', v_owner_a);
  begin
    perform public.finalize_share_message_conversion(v_msg, v_update_id);
    perform pg_temp.record_result('CAP', 'CAP-D: standalone helper call against the fabricated apparently-applied row is rejected -- the originally-found attack is closed', false, 'call unexpectedly succeeded -- ATOMICITY VIOLATION');
  exception when others then
    perform pg_temp.record_result(
      'CAP', 'CAP-D: standalone helper call against the fabricated apparently-applied row is rejected -- the originally-found attack is closed',
      sqlstate = 'P0001' and sqlerrm = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'CAP', 'CAP-D2: no share_message_conversions row was fabricated for this message',
    not exists (select 1 from public.share_message_conversions where message_id = v_msg)
  );
end;
$$;

-- CAP-E: legitimate Apply RPC sets the capability, applied transition
-- succeeds, helper succeeds, conversion commits -- the positive path,
-- already fully proven by the SUCCESS section above; re-asserted here by
-- name so this file's own CAP category is self-contained.
do $$
begin
  perform pg_temp.record_result(
    'CAP', 'CAP-E: the legitimate Apply RPC path succeeds end-to-end (see SUCCESS section for the full assertion set)',
    exists (
      select 1 from public.project_updates u
      join fixture_ids f on f.key = 'success_update_id' and f.value = u.id
      where u.status = 'applied'
    )
  );
end;
$$;

-- CAP-F: a capability minted for update A cannot authorize the helper for
-- update B, even within the same session.
do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid;
  v_msg_a uuid; v_update_a uuid; v_item_a uuid;
  v_msg_b uuid; v_update_b uuid; v_item_b uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg_a := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-F fixture message A.');
  select o_update_id, o_item_id into v_update_a, v_item_a
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg_a, 'CAP-F fixture message A.');

  v_msg_b := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-F fixture message B.');
  select o_update_id, o_item_id into v_update_b, v_item_b
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg_b, 'CAP-F fixture message B.');

  -- Fabricate BOTH rows as apparently-applied (test-harness-privileged),
  -- but only ever hold the capability for A when testing B.
  perform pg_temp.force_capability(v_update_a);
  update public.project_updates set status = 'applied', reviewed_by = v_owner_a, applied_by = v_owner_a, reviewed_at = now(), applied_at = now() where id = v_update_a;
  perform pg_temp.force_capability(v_update_b);
  update public.project_updates set status = 'applied', reviewed_by = v_owner_a, applied_by = v_owner_a, reviewed_at = now(), applied_at = now() where id = v_update_b;

  -- Now hold ONLY A's capability and attempt B's conversion.
  perform pg_temp.force_capability(v_update_a);
  perform pg_temp.act_as('authenticated', v_owner_a);
  begin
    perform public.finalize_share_message_conversion(v_msg_b, v_update_b);
    perform pg_temp.record_result('CAP', 'CAP-F: a capability minted for update A cannot authorize the helper for update B', false, 'call unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'CAP', 'CAP-F: a capability minted for update A cannot authorize the helper for update B',
      sqlstate = 'P0001' and sqlerrm = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');
  perform pg_temp.force_capability(null);
end;
$$;

-- CAP-G: INFORMATIONAL POINTER ONLY -- deliberately NOT recorded via
-- pg_temp.record_result, and therefore NOT counted in this file's own
-- total_tests/passed_tests/failed_tests. The prior version of this file
-- hardcoded a `true` PASS for "capability disappears after a real COMMIT"
-- without ever executing a real COMMIT -- a second, final read-only
-- implementation-acceptance audit correctly flagged this as an
-- undocumented/fake assertion. The ONLY real evidence for this property
-- is docs/client-share-phase6c-runtime/02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql
-- -- a small, dedicated, standalone file that performs a REAL BEGIN/COMMIT
-- (which this main suite deliberately never does, to protect its own
-- "nothing survives a run" safety discipline) and reports its own
-- separate one-row PASS/FAIL result. Do not report a runtime PASS for
-- CAP-G unless that dedicated file was actually run and its own result
-- recorded -- see docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_6C_IMPLEMENTATION_REPORT_2026-08-23.md.

-- CAP-H: after a rollback, no leaked capability -- proven via
-- SAVEPOINT/ROLLBACK TO SAVEPOINT, which reverts a SET LOCAL exactly like
-- a full transaction rollback does (documented Postgres behavior: a
-- transaction-local GUC value is discarded if the (sub)transaction that
-- set it later aborts).
do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid; v_msg uuid; v_update_id uuid; v_item_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'CAP-H fixture message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'CAP-H fixture message.');

  perform pg_temp.force_capability(null);
end;
$$;

savepoint cap_h_savepoint;

do $$
declare
  v_update_id uuid;
begin
  select id into v_update_id from public.project_updates
    where raw_input = 'CAP-H fixture message.' order by created_at desc limit 1;
  perform pg_temp.force_capability(v_update_id);
end;
$$;

rollback to savepoint cap_h_savepoint;

do $$
declare
  v_owner_a uuid; v_update_id uuid; v_msg_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select id, source_share_message_id into v_update_id, v_msg_id from public.project_updates
    where raw_input = 'CAP-H fixture message.' order by created_at desc limit 1;

  perform pg_temp.act_as('authenticated', v_owner_a);
  begin
    perform public.finalize_share_message_conversion(v_msg_id, v_update_id);
    perform pg_temp.record_result('CAP', 'CAP-H: a capability set before a ROLLBACK TO SAVEPOINT does not survive it', false, 'call unexpectedly succeeded -- capability leaked across the rollback');
  exception when others then
    perform pg_temp.record_result(
      'CAP', 'CAP-H: a capability set before a ROLLBACK TO SAVEPOINT does not survive it',
      sqlstate = 'P0001' and sqlerrm = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- APPLYING: 'applying' is no longer blocked; the real RPC only ever
-- succeeds through its own full validation
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a uuid; v_link_active uuid; v_msg uuid; v_update_id uuid; v_item_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'APPLYING fixture message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'APPLYING fixture message.');

  perform pg_temp.force_capability(null);
  perform pg_temp.act_as('authenticated', v_owner_a);
  update public.project_updates set status = 'applying', apply_attempt_id = gen_random_uuid() where id = v_update_id;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'APPLYING', 'I1: a raw authenticated client_share transition analyzed -> applying is no longer rejected',
    (select status from public.project_updates where id = v_update_id) = 'applying'
  );

  declare
    v_attempt_id uuid;
    v_result jsonb;
  begin
    select apply_attempt_id into v_attempt_id from public.project_updates where id = v_update_id;
    perform pg_temp.act_as('authenticated', v_owner_a);
    v_result := public.apply_project_update_transaction(
      v_update_id, v_attempt_id, array[v_item_id]::uuid[], array[]::uuid[], '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'itemId', v_item_id, 'itemType', 'priority_change',
          'newValue', jsonb_build_object('priority', 'High'),
          'mutation', jsonb_build_object('kind', 'project_field', 'updates', jsonb_build_object('priority', 'High')),
          'event', jsonb_build_object('eventType', 'priority_updated', 'title', 'Priority updated to High')
        )
      )
    );
    perform pg_temp.act_as('postgres');

    perform pg_temp.record_result(
      'APPLYING', 'J1: the direct Apply RPC call, from a raw-reached applying state, succeeds only through its own full validation/mutation/closure pipeline (real work + conversion, not a bypass)',
      v_result is not null
      and (select status from public.project_updates where id = v_update_id) = 'applied'
      and (select status from public.share_messages where id = v_msg) = 'converted'
      and exists (select 1 from public.project_timeline_events where source_item_id = v_item_id)
    );
  end;
end;
$$;

-- =========================================================
-- APPLIED_EXISTING: an already-applied row's ordinary non-status update
-- does not require the capability
-- =========================================================

do $$
declare
  v_owner_a uuid; v_update_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_update_id from fixture_ids where key = 'success_update_id';

  perform pg_temp.force_capability(null);
  perform pg_temp.act_as('authenticated', v_owner_a);

  begin
    update public.project_updates set client_id = client_id where id = v_update_id;
    perform pg_temp.record_result(
      'APPLIED_EXISTING', 'K1: an ordinary non-status update to an already-applied client_share row succeeds without the capability',
      true
    );
  exception when others then
    perform pg_temp.record_result(
      'APPLIED_EXISTING', 'K1: an ordinary non-status update to an already-applied client_share row succeeds without the capability',
      false, format('unexpectedly rejected: sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'APPLIED_EXISTING', 'K2: the row remains status=applied (unchanged) after that non-status update',
    (select status from public.project_updates where id = v_update_id) = 'applied'
  );
end;
$$;

-- =========================================================
-- TERMINALITY: converted -> new/reviewed/resolved/dismissed all rejected
-- =========================================================

do $$
declare
  v_owner_a uuid; v_msg uuid; v_status text;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_msg from fixture_ids where key = 'success_msg_id';

  foreach v_status in array array['new', 'reviewed', 'resolved', 'dismissed']
  loop
    perform pg_temp.act_as('authenticated', v_owner_a);
    begin
      perform public.set_share_message_status(v_msg, v_status);
      perform pg_temp.record_result('TERMINALITY', format('T-%s: converted -> %s is rejected', v_status, v_status), false, 'call unexpectedly succeeded');
    exception when others then
      perform pg_temp.record_result(
        'TERMINALITY', format('T-%s: converted -> %s is rejected', v_status, v_status),
        sqlstate = 'P0001' and sqlerrm = 'SHARE_MESSAGE_STATUS_TERMINAL',
        format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
      );
    end;
    perform pg_temp.act_as('postgres');
  end loop;

  perform pg_temp.record_result(
    'TERMINALITY', 'T-final: the message is still status=converted after all four rejected attempts',
    (select status from public.share_messages where id = v_msg) = 'converted'
  );
end;
$$;

-- =========================================================
-- IDEMPOTENCY
-- =========================================================

do $$
declare
  v_owner_a uuid; v_update_id uuid; v_item_id uuid; v_stale_attempt uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_update_id from fixture_ids where key = 'success_update_id';

  select id into v_item_id from public.project_update_items where project_update_id = v_update_id limit 1;

  perform pg_temp.act_as('authenticated', v_owner_a);

  -- Replay with a fresh (unrelated) attempt id after success -> mismatch,
  -- since the row is no longer 'applying'.
  begin
    perform public.apply_project_update_transaction(
      v_update_id, gen_random_uuid(), array[v_item_id]::uuid[], array[]::uuid[], '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'itemId', v_item_id, 'itemType', 'priority_change',
        'newValue', jsonb_build_object('priority', 'High'),
        'mutation', jsonb_build_object('kind', 'project_field', 'updates', jsonb_build_object('priority', 'High')),
        'event', jsonb_build_object('eventType', 'priority_updated', 'title', 'Priority updated to High')
      ))
    );
    perform pg_temp.record_result('IDEMPOTENCY', 'ID1: replaying Apply after success is rejected (APPLY_ATTEMPT_MISMATCH)', false, 'call unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'IDEMPOTENCY', 'ID1: replaying Apply after success is rejected (APPLY_ATTEMPT_MISMATCH)',
      sqlstate = 'P0001' and sqlerrm = 'APPLY_ATTEMPT_MISMATCH',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  -- Stale apply_attempt_id (never actually claimed).
  v_stale_attempt := gen_random_uuid();
  begin
    perform public.apply_project_update_transaction(
      v_update_id, v_stale_attempt, array[v_item_id]::uuid[], array[]::uuid[], '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'itemId', v_item_id, 'itemType', 'priority_change',
        'newValue', jsonb_build_object('priority', 'High'),
        'mutation', jsonb_build_object('kind', 'project_field', 'updates', jsonb_build_object('priority', 'High')),
        'event', jsonb_build_object('eventType', 'priority_updated', 'title', 'Priority updated to High')
      ))
    );
    perform pg_temp.record_result('IDEMPOTENCY', 'ID2: a stale/never-claimed apply_attempt_id is rejected', false, 'call unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'IDEMPOTENCY', 'ID2: a stale/never-claimed apply_attempt_id is rejected',
      sqlstate = 'P0001' and sqlerrm = 'APPLY_ATTEMPT_MISMATCH',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.act_as('postgres');
end;
$$;

do $$
declare
  v_owner_a uuid; v_update_id uuid; v_msg uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_update_id from fixture_ids where key = 'success_update_id';
  select value into v_msg from fixture_ids where key = 'success_msg_id';

  -- Duplicate conversion attempt: test-harness-privileged capability
  -- forced open again for this already-applied, already-converted row --
  -- proves the unique constraint / already-converted check is the final
  -- backstop even if the capability check were somehow satisfied twice.
  perform pg_temp.force_capability(v_update_id);
  perform pg_temp.act_as('authenticated', v_owner_a);
  begin
    perform public.finalize_share_message_conversion(v_msg, v_update_id);
    perform pg_temp.record_result('IDEMPOTENCY', 'ID3: a duplicate conversion attempt against an already-converted message is rejected', false, 'call unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'IDEMPOTENCY', 'ID3: a duplicate conversion attempt against an already-converted message is rejected',
      sqlstate = 'P0001' and sqlerrm = 'SHARE_MESSAGE_STATUS_TERMINAL',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;
  perform pg_temp.act_as('postgres');
  perform pg_temp.force_capability(null);

  perform pg_temp.record_result(
    'IDEMPOTENCY', 'ID4: still exactly one share_message_conversions row exists for this message',
    (select count(*) from public.share_message_conversions where message_id = v_msg) = 1
  );
end;
$$;

-- =========================================================
-- PROVENANCE
-- =========================================================

do $$
declare
  v_owner_a uuid; v_owner_b uuid; v_project_a uuid; v_link_active uuid;
  v_msg uuid; v_update_id uuid; v_item_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_owner_b from fixture_ids where key = 'owner_b';
  select value into v_project_a from fixture_ids where key = 'project_a';
  select value into v_link_active from fixture_ids where key = 'link_active';

  v_msg := pg_temp.new_client_message(v_link_active, v_owner_a, v_project_a, 'PROVENANCE fixture message.');
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_project_a, v_msg, 'PROVENANCE fixture message.');

  -- Wrong owner: Owner B attempts to call the RPC against Owner A's row.
  perform pg_temp.act_as('authenticated', v_owner_b);
  begin
    update public.project_updates set status = 'applying', apply_attempt_id = gen_random_uuid() where id = v_update_id;
    perform pg_temp.record_result('PROVENANCE', 'P1: wrong-owner claim UPDATE affects zero rows', (select count(*) from public.project_updates where id = v_update_id and status = 'applying') = 0);
  exception when others then
    perform pg_temp.record_result('PROVENANCE', 'P1: wrong-owner claim UPDATE affects zero rows', true, format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm));
  end;
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result(
    'PROVENANCE', 'P2: the row is still owned by owner A and status=analyzed (unaffected by owner B''s attempt)',
    (select user_id from public.project_updates where id = v_update_id) = v_owner_a
    and (select status from public.project_updates where id = v_update_id) = 'analyzed'
  );

  -- Wrong message/project pairing: fabricate v_update_id (project_a) as
  -- apparently-applied (test-harness-privileged), then call the helper
  -- with a genuine, owner-A-owned message that is NOT this update's own
  -- source_share_message_id (it belongs to a different project entirely).
  -- NOTE: the helper's own source_share_message_id match check fires
  -- before its separate project-match check would ever be reached for
  -- this input shape -- and reaching that deeper project-match check
  -- independently is not possible through any legitimate data path,
  -- because Phase 6A's own provenance trigger (INSERT-time) and
  -- enforce_share_message_integrity (UPDATE-immutability) already
  -- guarantee a project_update's project_id and its source message's
  -- project_id agree for the entire lifetime of both rows -- the
  -- helper's own project-match check is genuine defense-in-depth with no
  -- reachable negative-test path short of bypassing triggers directly.
  -- This test still proves a real, meaningful provenance rejection: an
  -- update cannot be closed against ANY message other than its own,
  -- even one the same owner genuinely owns.
  perform pg_temp.force_capability(v_update_id);
  update public.project_updates set status = 'applied', reviewed_by = v_owner_a, applied_by = v_owner_a, reviewed_at = now(), applied_at = now() where id = v_update_id;

  declare
    v_other_project_a uuid;
    v_other_link_a uuid;
    v_wrong_project_msg uuid;
  begin
    insert into public.projects (user_id, title, status, priority, priority_source)
      values (v_owner_a, 'Owner A''s second project', 'In Progress', 'Medium', 'ai')
      returning id into v_other_project_a;

    insert into public.project_share_links (
      user_id, project_id, public_id, state, comments_enabled,
      secret_digest, secret_digest_version, configuration_version, activated_at
    ) values (
      v_owner_a, v_other_project_a, 'phase6cClosureLinkOwnerASecond', 'active', true,
      repeat('c8', 32), 1, 1, now()
    ) returning id into v_other_link_a;

    v_wrong_project_msg := pg_temp.new_client_message(
      v_other_link_a, v_owner_a, v_other_project_a, 'A message under owner A''s OTHER project.'
    );

    perform pg_temp.act_as('authenticated', v_owner_a);
    begin
      perform public.finalize_share_message_conversion(v_wrong_project_msg, v_update_id);
      perform pg_temp.record_result('PROVENANCE', 'P4: a genuinely owner-A-owned message that is not this update''s own source message (different project) is rejected', false, 'call unexpectedly succeeded');
    exception when others then
      perform pg_temp.record_result(
        'PROVENANCE', 'P4: a genuinely owner-A-owned message that is not this update''s own source message (different project) is rejected',
        sqlstate = 'P0001' and sqlerrm = 'SHARE_CONVERSION_MESSAGE_MISMATCH',
        format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
      );
    end;
    perform pg_temp.act_as('postgres');
  end;

  perform pg_temp.force_capability(null);

  -- Non-client (owner-authored) source message: Phase 6A's own
  -- provenance trigger already rejects this at project_updates INSERT
  -- time (author_type must be 'client') -- direct regression check.
  --
  -- The owner-authored fixture message is created through the REAL,
  -- unmodified owner path -- public.send_share_message_reply
  -- (SECURITY DEFINER, 202608190001_client_share_message_owner_rpcs.sql)
  -- -- never a raw authenticated INSERT. `authenticated` genuinely has
  -- no direct INSERT grant on share_messages (confirmed directly by
  -- runtime attempt #4's own `42501 permission denied for table
  -- share_messages` error) -- that denial is the real share_messages
  -- privilege boundary working exactly as designed, not a gap to patch
  -- around; owner writes are only ever supposed to happen through this
  -- RPC. This mirrors, for the OWNER side, the exact same discipline
  -- pg_temp.new_client_message (above, service_role) already uses for
  -- the CLIENT side.
  declare
    v_owner_msg uuid;
    v_reply_result jsonb;
  begin
    perform pg_temp.act_as('authenticated', v_owner_a);
    select public.send_share_message_reply(
      v_link_active,
      v_msg,
      'An owner-authored note.'
    ) into v_reply_result;
    v_owner_msg := (v_reply_result->>'messageId')::uuid;
    perform pg_temp.act_as('postgres');

    -- Fail-closed fixture-validity check -- this is TEST SETUP for P3,
    -- not itself a counted Phase 6C invariant (see this file's own
    -- test-count documentation), so it RAISEs rather than recording a
    -- test_results row. If the real owner-reply RPC's own contract ever
    -- changes shape, this fails loudly here rather than letting the P3
    -- assertion below silently test against a null or wrong message.
    if v_owner_msg is null then
      raise exception using errcode = 'P0001', message =
        'PHASE6C_RUNTIME_FIXTURE_INVALID: send_share_message_reply did not return a messageId';
    end if;

    if not exists (
      select 1 from public.share_messages
      where id = v_owner_msg
        and user_id = v_owner_a
        and project_id = v_project_a
        and share_link_id = v_link_active
        and author_type = 'owner'
        and body = 'An owner-authored note.'
    ) then
      raise exception using errcode = 'P0001', message =
        'PHASE6C_RUNTIME_FIXTURE_INVALID: owner-authored fixture message does not match the expected shape';
    end if;

    perform pg_temp.act_as('authenticated', v_owner_a);
    begin
      -- raw_input is set to the EXACT owner-reply body (not a
      -- separately-typed literal) so this test isolates the
      -- author-type invariant alone and cannot accidentally fail on an
      -- unrelated body mismatch.
      insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
        values (v_owner_a, v_project_a, 'client_share', v_owner_msg, 'An owner-authored note.', 'draft');
      perform pg_temp.record_result('PROVENANCE', 'P3: an owner-authored (non-client) message cannot become a client_share source (Phase 6A regression)', false, 'insert unexpectedly succeeded');
    exception when others then
      perform pg_temp.record_result(
        'PROVENANCE', 'P3: an owner-authored (non-client) message cannot become a client_share source (Phase 6A regression)',
        sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_MESSAGE_NOT_CLIENT_AUTHORED',
        format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
      );
    end;
    perform pg_temp.act_as('postgres');
  end;
end;
$$;

-- =========================================================
-- HISTORY: a retained message on a revoked link can still be Applied
--
-- CORRECTED (runtime attempt #5's finding): the original version of this
-- section used a link that was already created in state='revoked' from
-- the very start, then tried to INSERT a CLIENT-authored message onto
-- it. enforce_share_message_integrity()'s own author_type='client'
-- branch unconditionally requires the link to be state='active' at
-- INSERT time (raises SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE otherwise,
-- confirmed by direct read of 202608030005_client_share_integrity_and_security.sql)
-- -- so that INSERT could never have succeeded, on any attempt,
-- regardless of anything else in this file.
--
-- The real product invariant this section exists to prove is: a message
-- sent WHILE a link was active remains eligible for conversion/Apply
-- AFTER the link is later revoked -- NOT that a client can send a NEW
-- message to an already-revoked link (that must, and structurally does,
-- remain rejected -- proving that rejection is a different invariant,
-- not this section's own job, and is not asserted here). This section
-- now models the real lifecycle explicitly, on its own dedicated
-- project/link (independent of every other section):
--   1. create an active link
--   2. send the client message while the link is genuinely active
--   3. reserve the client_share project_update while the source is
--      still fully valid (mirrors the real Analyze flow's own
--      reservation-before-anything-else discipline)
--   4. THEN revoke the link -- through the real, unmodified owner RPC
--      public.revoke_share_link (202608060002_client_share_access_operations.sql,
--      already installed by stage A step 2's Phase 6A bundle) -- never a
--      privileged direct UPDATE of the link row, so the real
--      state-machine/integrity trigger on project_share_links remains
--      fully in effect for this transition too
--   5. verify the link is now genuinely revoked
--   6. only then run the real Apply RPC
-- =========================================================

do $$
declare
  v_owner_a uuid;
  v_history_project uuid; v_history_link uuid;
  v_msg uuid; v_update_id uuid; v_item_id uuid; v_attempt_id uuid; v_result jsonb;
  v_revoke_result jsonb;
  v_link_state_after_revoke text;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';

  insert into public.projects (user_id, title, status, priority, priority_source)
    values (v_owner_a, 'HISTORY test project', 'In Progress', 'Medium', 'ai')
    returning id into v_history_project;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at
  ) values (
    v_owner_a, v_history_project, 'phase6cHistoryLink', 'active', true,
    repeat('cb', 32), 1, 1, now()
  ) returning id into v_history_link;

  -- 1-2: client message sent while the link is genuinely active.
  v_msg := pg_temp.new_client_message(v_history_link, v_owner_a, v_history_project, 'HISTORY fixture message, sent while the link was still active.');

  -- 3: the client_share project_update is reserved while the source is
  -- still fully valid.
  select o_update_id, o_item_id into v_update_id, v_item_id
    from pg_temp.new_analyzed_priority_change(v_owner_a, v_history_project, v_msg, 'HISTORY fixture message, sent while the link was still active.');

  -- 4: NOW revoke the link, through the real owner RPC, after the
  -- retained message/update already exist -- exactly the product
  -- invariant this section exists to prove.
  perform pg_temp.act_as('authenticated', v_owner_a);
  select public.revoke_share_link(v_history_link) into v_revoke_result;
  perform pg_temp.act_as('postgres');

  -- 5: verify the link is genuinely revoked before Apply is attempted.
  select state into v_link_state_after_revoke from public.project_share_links where id = v_history_link;
  perform pg_temp.record_result(
    'HISTORY', 'H0: the real owner RPC actually revoked the link before Apply is attempted',
    v_revoke_result is not null and v_link_state_after_revoke = 'revoked'
  );

  -- 6: the retained message/update remain fully eligible for Apply even
  -- though their originating link is now revoked.
  select o_attempt_id, o_result into v_attempt_id, v_result
    from pg_temp.run_full_apply(v_owner_a, v_update_id, v_item_id);

  perform pg_temp.record_result(
    'HISTORY', 'H1: a retained client message, sent while its link was active, can still be Applied successfully after the link is later revoked',
    v_result is not null
    and (select status from public.project_updates where id = v_update_id) = 'applied'
    and (select status from public.share_messages where id = v_msg) = 'converted'
  );

  perform pg_temp.record_result(
    'HISTORY', 'H2: a conversion row exists for this retained-history message',
    exists (select 1 from public.share_message_conversions where message_id = v_msg)
  );
end;
$$;

-- =========================================================
-- COMPLETION_RECONCILIATION: NEW -- a real Apply that finishes a
-- project's last active task exercises the unmodified,
-- 202607270001-authoritative reconcile_project_completion, in the SAME
-- transaction as a real client_share conversion.
--
-- Uses 'update_subtask' rather than 'priority_change' -- this is the
-- real, evidenced, repository-supported item shape capable of changing a
-- task's own status (apply_project_update_transaction's own
-- update_subtask branch: mutation.kind='update_subtask',
-- mutation.taskId=<target task>, mutation.updates.status=<new status>).
-- No test-only behavior is invented -- every field below matches the
-- RPC's own real validation exactly (see that function's own
-- update_subtask branch).
-- =========================================================

do $$
declare
  v_owner_a uuid; v_completion_link uuid;
  v_completion_project uuid;
  v_task_id bigint;
  v_msg uuid; v_update_id uuid; v_item_id uuid; v_attempt_id uuid; v_result jsonb;
  v_status_before text;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';

  insert into public.projects (user_id, title, status, priority, priority_source)
    values (v_owner_a, 'Completion reconciliation test project', 'In Progress', 'Medium', 'ai')
    returning id into v_completion_project;

  -- CORRECTED (found during the runtime attempt #5 audit): this section
  -- originally used the shared 'link_active' fixture (which belongs to
  -- v_project_a) to author a client message whose own project_id is
  -- v_completion_project. enforce_share_message_integrity() requires
  -- new.project_id = link.project_id (SHARE_MESSAGE_PROJECT_MISMATCH
  -- otherwise) -- that mismatch would have failed on its own, on the
  -- very next attempt, independent of the HISTORY bug. This section now
  -- uses its own dedicated link, tied to this same completion project.
  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at
  ) values (
    v_owner_a, v_completion_project, 'phase6cCompletionReconLink', 'active', true,
    repeat('cc', 32), 1, 1, now()
  ) returning id into v_completion_link;

  insert into public.tasks (user_id, project_id, subtask_order, task_title, status, is_archived)
    values (v_owner_a, v_completion_project, 1, 'Finish the last remaining thing', 'In Progress', false)
    returning id into v_task_id;

  select status into v_status_before from public.projects where id = v_completion_project;
  perform pg_temp.record_result('COMPLETION_RECONCILIATION', 'CR0: fixture project starts not Done', v_status_before <> 'Done');

  perform pg_temp.record_result(
    'COMPLETION_RECONCILIATION', 'CR0B: the dedicated completion-reconciliation link belongs to the same project as the message/update it will author',
    (select project_id from public.project_share_links where id = v_completion_link) = v_completion_project
  );

  v_msg := pg_temp.new_client_message(v_completion_link, v_owner_a, v_completion_project, 'Please mark this task done.');

  perform pg_temp.act_as('authenticated', v_owner_a);
  insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
    values (v_owner_a, v_completion_project, 'client_share', v_msg, 'Please mark this task done.', 'analyzed')
    returning id into v_update_id;

  insert into public.project_update_items (
    project_update_id, user_id, project_id, target_task_id, type, title, new_value, confidence, status
  ) values (
    v_update_id, v_owner_a, v_completion_project, v_task_id, 'update_subtask', 'Mark task Done',
    jsonb_build_object('status', 'Done'), 0.95, 'suggested'
  ) returning id into v_item_id;
  perform pg_temp.act_as('postgres');

  perform pg_temp.act_as('authenticated', v_owner_a);
  v_attempt_id := gen_random_uuid();
  update public.project_updates set status = 'applying', apply_attempt_id = v_attempt_id where id = v_update_id;

  v_result := public.apply_project_update_transaction(
    v_update_id, v_attempt_id, array[v_item_id]::uuid[], array[]::uuid[], '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'itemId', v_item_id, 'itemType', 'update_subtask',
        'newValue', jsonb_build_object('status', 'Done'),
        'mutation', jsonb_build_object('kind', 'update_subtask', 'taskId', v_task_id, 'updates', jsonb_build_object('status', 'Done')),
        'event', jsonb_build_object('eventType', 'subtask_updated', 'title', 'Task marked Done')
      )
    )
  );
  perform pg_temp.act_as('postgres');

  perform pg_temp.record_result('COMPLETION_RECONCILIATION', 'CR1: the RPC succeeded', v_result is not null);

  perform pg_temp.record_result(
    'COMPLETION_RECONCILIATION', 'CR2: the task itself is now status=Done',
    (select status from public.tasks where id = v_task_id) = 'Done'
  );

  perform pg_temp.record_result(
    'COMPLETION_RECONCILIATION', 'CR3: reconcile_project_completion (unmodified, 202607270001) completed the project -- status=Done',
    (select status from public.projects where id = v_completion_project) = 'Done'
  );

  perform pg_temp.record_result(
    'COMPLETION_RECONCILIATION', 'CR4: reconcile_project_completion also set priority=Low and completed_at, matching its own unmodified logic',
    (select priority from public.projects where id = v_completion_project) = 'Low'
    and (select completed_at from public.projects where id = v_completion_project) is not null
  );

  perform pg_temp.record_result(
    'COMPLETION_RECONCILIATION', 'CR5: the ordinary Apply/conversion result still succeeded in the SAME transaction as completion reconciliation',
    (select status from public.project_updates where id = v_update_id) = 'applied'
    and (select status from public.share_messages where id = v_msg) = 'converted'
    and exists (select 1 from public.share_message_conversions where message_id = v_msg)
  );
end;
$$;

-- =========================================================
-- REGRESSION: text Apply is completely unaffected
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a uuid;
  v_update_id uuid; v_item_id uuid; v_attempt_id uuid; v_result jsonb;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';

  perform pg_temp.act_as('authenticated', v_owner_a);
  insert into public.project_updates (user_id, project_id, source_type, raw_input, status)
    values (v_owner_a, v_project_a, 'text', 'Please bump the priority for this too.', 'analyzed')
    returning id into v_update_id;

  insert into public.project_update_items (
    project_update_id, user_id, project_id, type, title, new_value, confidence, status
  ) values (
    v_update_id, v_owner_a, v_project_a, 'priority_change', 'Raise priority to High',
    jsonb_build_object('priority', 'High'), 0.9, 'suggested'
  ) returning id into v_item_id;
  perform pg_temp.act_as('postgres');

  select o_attempt_id, o_result into v_attempt_id, v_result
    from pg_temp.run_full_apply(v_owner_a, v_update_id, v_item_id);

  perform pg_temp.record_result(
    'REGRESSION', 'REG1: a plain text Apply succeeds end-to-end, completely unaffected by any client_share-only capability/closure logic',
    v_result is not null
    and (select status from public.project_updates where id = v_update_id) = 'applied'
    and exists (select 1 from public.project_timeline_events where source_item_id = v_item_id)
  );

  perform pg_temp.record_result(
    'REGRESSION', 'REG2: no share_message_conversions row was created for a text update (source_share_message_id is null -- the closure block is a complete no-op)',
    not exists (select 1 from public.share_message_conversions where project_update_id = v_update_id)
  );

  -- NOTE (informational only, not a counted test -- this section is a
  -- light positive check only; the full Phase 6A provenance suite and
  -- the full Phase 6B Analyze/idempotency suite must each be re-run
  -- separately from their own established packages, not duplicated
  -- here). Previously this was a fake record_result(..., true) row that
  -- asserted nothing about runtime behavior -- removed per the runtime
  -- attempt #5 audit's requirement that every counted row prove a real
  -- condition.
end;
$$;

-- =========================================================
-- REGRESSION (image): an image-sourced Apply is equally unaffected by
-- client_share-only capability/closure logic. Uses the exact same,
-- unmodified Apply path as REG1/REG2 above (pg_temp.run_full_apply --
-- itself calling the real public.apply_project_update_transaction),
-- against a project_update whose own source_type is 'image' rather than
-- 'text'. No analyzer call is fabricated -- 'image' Apply, once a
-- project_update/project_update_item already exist in 'analyzed'/
-- 'suggested' state, runs through the identical Apply RPC as every other
-- source_type; only the row's own source_type column differs, which is
-- exactly what this regression needs to prove is irrelevant to Apply/
-- closure behavior.
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a uuid;
  v_update_id uuid; v_item_id uuid; v_attempt_id uuid; v_result jsonb;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a from fixture_ids where key = 'project_a';

  perform pg_temp.act_as('authenticated', v_owner_a);
  insert into public.project_updates (user_id, project_id, source_type, raw_input, status)
    values (v_owner_a, v_project_a, 'image', 'Please bump the priority for this too (image source).', 'analyzed')
    returning id into v_update_id;

  insert into public.project_update_items (
    project_update_id, user_id, project_id, type, title, new_value, confidence, status
  ) values (
    v_update_id, v_owner_a, v_project_a, 'priority_change', 'Raise priority to High',
    jsonb_build_object('priority', 'High'), 0.9, 'suggested'
  ) returning id into v_item_id;
  perform pg_temp.act_as('postgres');

  select o_attempt_id, o_result into v_attempt_id, v_result
    from pg_temp.run_full_apply(v_owner_a, v_update_id, v_item_id);

  perform pg_temp.record_result(
    'REGRESSION', 'REG3: an image-sourced Apply succeeds end-to-end through the identical, unmodified Apply path -- timeline event recorded',
    v_result is not null
    and (select status from public.project_updates where id = v_update_id) = 'applied'
    and exists (select 1 from public.project_timeline_events where source_item_id = v_item_id)
  );

  perform pg_temp.record_result(
    'REGRESSION', 'REG4: no share_message_conversions row was created for an image update (source_share_message_id is null -- the closure block is a complete no-op)',
    not exists (select 1 from public.share_message_conversions where project_update_id = v_update_id)
  );
end;
$$;

-- =========================================================
-- Results
-- =========================================================

select seq, section, name, status, detail from test_results order by seq;

select seq, section, name, status, detail
from test_results
where status = 'FAIL'
order by seq;

-- FINAL, single-row, single-result-set verdict for THIS FILE ONLY.
-- Deliberately does NOT include CAP-G (never inserted into test_results
-- -- see that section's own comment) -- this file's own
-- PHASE_6C_CLOSURE_RUNTIME_PASS therefore proves everything this file
-- itself tests, and explicitly NOT the real-COMMIT capability-scope
-- property, which requires running
-- 02_VERIFY_CAPABILITY_COMMIT_SCOPE.sql separately and recording its own
-- one-row result alongside this one.
select
  count(*) as total_tests,
  count(*) filter (where status = 'PASS') as passed_tests,
  count(*) filter (where status = 'FAIL') as failed_tests,
  case
    when count(*) filter (where status = 'FAIL') = 0 then 'PHASE_6C_CLOSURE_RUNTIME_PASS'
    else 'PHASE_6C_CLOSURE_RUNTIME_FAIL'
  end as status,
  coalesce(
    (
      select string_agg(
        format('[%s] %s -- %s', r.section, r.name, coalesce(r.detail, '(no detail)')),
        E'\n---\n' order by r.seq
      )
      from test_results r
      where r.status = 'FAIL'
    ),
    '(no failures)'
  ) as failed_test_details
from test_results;

rollback;
