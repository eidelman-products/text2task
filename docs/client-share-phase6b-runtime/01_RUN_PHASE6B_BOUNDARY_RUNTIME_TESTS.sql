-- Text2Task Client Share Link -- Phase 6B DB Apply Boundary
-- Runtime Verification Package -- File 01
--
-- Run this in the SAME disposable Supabase project already used for the
-- Phase 6A runtime package (docs/client-share-phase6a-runtime/), AFTER:
--   1. docs/client-share-phase6a-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql
--   2. docs/client-share-phase6a-runtime/02_APPLY_CLIENT_SHARE_THROUGH_PHASE6A.sql
--   3. The exact, unmodified contents of
--      supabase/migrations/202608230001_client_share_apply_boundary.sql,
--      pasted and run verbatim in the SQL Editor (this package does not
--      duplicate that file -- copying it here would create a second,
--      driftable copy of a real migration for zero benefit, since it is
--      already small and self-contained).
--   4. docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql
--      -- REQUIRED. The Phase 6A package (step 2) deliberately excludes
--      every migration that (re)defines apply_project_update_transaction
--      (Phase 6A's own runtime tests never called it), so without this
--      step Section I below fails with a raw
--      "function ... does not exist" error (sqlstate 42883), not a
--      finding about the Phase 6B boundary migration itself. Order
--      relative to step 3 does not matter -- see that file's own header.
--
-- Never run this in the real Text2Task production project.
--
-- SCOPE: this file proves the Phase 6B DB apply boundary (the new
-- enforce_project_update_client_share_apply_boundary trigger) against a
-- real PostgreSQL engine, by issuing real INSERT/UPDATE statements and a
-- real direct RPC call, as the real `authenticated` role a genuine owner
-- session would use -- not by inspecting catalog metadata alone (used
-- only for section K, where the requirement itself is structural).
--
-- Sections:
--   A -> authenticated direct UPDATE attack: analyzed -> applying is
--        rejected (exact error, row/attempt_id unchanged)
--   B -> authenticated direct UPDATE attack: reviewed -> applying is
--        rejected
--   C -> MANDATORY: a fully-valid, correctly-provenanced direct INSERT
--        that fabricates status='applying' from its first moment of
--        existence is rejected -- closes the hole an UPDATE-only guard
--        would miss entirely
--   D -> same direct-INSERT bypass attempt at status='applied'
--   E -> normal client_share states (draft, analyzed) still insert
--        successfully; Phase 6A's own provenance enforcement (a body
--        mismatch) still independently rejects, proving this new trigger
--        did not replace or weaken it
--   F -> text Apply claim (analyzed -> applying) is completely unaffected
--   G -> image Apply claim (analyzed -> applying) is completely
--        unaffected
--   H -> normal text/image applying -> applied remains allowed
--   I -> direct RPC precondition: apply_project_update_transaction
--        against the client_share row (still 'analyzed', because its own
--        applying transition was rejected in Section A) fails with
--        APPLY_ATTEMPT_MISMATCH, with zero task/project/client/timeline
--        mutation
--   J -> explicit summary: no authenticated path (INSERT or UPDATE)
--        established a client_share row in applying/applied anywhere in
--        this run
--   K -> trigger metadata / privileges
--   L -> final PASS/FAIL verdict

-- =========================================================
-- 0. Safety gate
-- =========================================================

do $$
declare
  v_sentinel_kind text;
  v_missing text[];
begin
  if to_regclass('public.text2task_client_share_phase6a_runtime_sentinel') is null then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The Phase 6A runtime test sentinel was not found. Run the Phase 6A runtime package (docs/client-share-phase6a-runtime/01 and 02) in this same disposable project first.';
  end if;

  select project_kind into v_sentinel_kind
    from public.text2task_client_share_phase6a_runtime_sentinel;

  if v_sentinel_kind is distinct from 'DISPOSABLE_PHASE_6A_RUNTIME_TEST_PROJECT' then
    raise exception using errcode = 'P0001', message =
      'REFUSING TO RUN. The sentinel row does not identify this project as a disposable Phase 6A/6B runtime test project.';
  end if;

  select array_agg(t.name) into v_missing
    from (values
      ('table:project_updates'),
      ('table:share_messages'),
      ('function:enforce_project_update_source_provenance()'),
      ('function:enforce_project_update_client_share_apply_boundary()'),
      ('function:apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)')
    ) as t(name)
    where (
      split_part(t.name, ':', 1) = 'table'
      and to_regclass('public.' || split_part(t.name, ':', 2)) is null
    ) or (
      split_part(t.name, ':', 1) = 'function'
      and to_regprocedure('public.' || split_part(t.name, ':', 2)) is null
    );

  -- The real apply_project_update_transaction (six-argument signature)
  -- is checked explicitly here, not just presence of the Phase 6B
  -- trigger, because the Phase 6A package deliberately excludes every
  -- migration that (re)defines this RPC (Phase 6A's own runtime tests
  -- never called it) -- run
  -- 00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql first if
  -- this is missing. Failing here with a clear message avoids a
  -- confusing 42883 "function does not exist" deep inside Section I.
  if v_missing is not null then
    raise exception using errcode = 'P0001', message = format(
      'REFUSING TO RUN. Missing expected object(s): %s. If apply_project_update_transaction(...) is listed, run docs/client-share-phase6b-runtime/00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql first. If the trigger functions are listed, apply supabase/migrations/202608230001_client_share_apply_boundary.sql first (after the Phase 6A package). Then re-run this file.',
      array_to_string(v_missing, ', ')
    );
  end if;
end;
$$;

begin;

-- Always rolled back at the end of this file (see the trailing
-- `rollback;`), so no fixture row or test-only object this file creates
-- ever survives a run -- safe to re-run against the same disposable
-- project as many times as needed. This is a NEW session/paste, so
-- pg_temp objects from the Phase 6A runtime file (a different session)
-- do not exist here -- everything below is self-contained.

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
  p_section text,
  p_name text,
  p_passed boolean,
  p_detail text default null
) returns void
language plpgsql
as $$
begin
  insert into test_results (section, name, status, detail)
  values (p_section, p_name, case when p_passed then 'PASS' else 'FAIL' end, p_detail);
end;
$$;

-- Switches the current session to p_role (anon / authenticated /
-- service_role / postgres), simulating auth.uid() = p_user_id via the
-- same request.jwt.claims GUC Supabase's own auth.uid() reads. Matches
-- the Phase 6A runtime package's own act_as() exactly.
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

-- =========================================================
-- Shared fixture: reuses Owner A's deterministic identity from the
-- Phase 6A fixture (auth.users already contains this row). One project,
-- one active share link, one client-authored share_messages row (used
-- for every valid client_share INSERT below -- Phase 6A's own partial
-- unique index means only ONE project_updates row may ever reference it,
-- so each section that needs its OWN unclaimed message creates its own).
-- =========================================================

do $$
declare
  v_owner_a constant uuid := '11111111-1111-4111-8111-111111111111';
  v_project_a1 uuid;
  v_link_a1 uuid;
begin
  insert into public.projects (user_id) values (v_owner_a) returning id into v_project_a1;

  insert into public.project_share_links (
    user_id, project_id, public_id, state, comments_enabled,
    secret_digest, secret_digest_version, configuration_version, activated_at
  ) values (
    v_owner_a, v_project_a1, 'phase6bBoundaryLinkA1', 'active', true,
    repeat('b6', 32), 1, 1, now()
  ) returning id into v_link_a1;

  insert into fixture_ids (key, value) values
    ('owner_a', v_owner_a), ('project_a1', v_project_a1), ('link_a1', v_link_a1);
end;
$$;

do $$
declare
  v_owner_a uuid; v_link_a1 uuid; v_project_a1 uuid;
  v_msg_a uuid; v_msg_b uuid; v_msg_c uuid; v_msg_d uuid; v_msg_e uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_link_a1 from fixture_ids where key = 'link_a1';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';

  -- Client-authored messages: enforce_share_message_integrity requires
  -- current_role = 'service_role' for author_type = 'client', matching
  -- the real public message-submission path (same convention as the
  -- Phase 6A runtime package's own fixture).
  perform pg_temp.act_as('service_role');

  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
    values (v_owner_a, v_link_a1, v_project_a1, 'client', 'Phase 6B boundary fixture message A (UPDATE attack, analyzed)', true)
    returning id into v_msg_a;

  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
    values (v_owner_a, v_link_a1, v_project_a1, 'client', 'Phase 6B boundary fixture message B (UPDATE attack, reviewed)', true)
    returning id into v_msg_b;

  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
    values (v_owner_a, v_link_a1, v_project_a1, 'client', 'Phase 6B boundary fixture message C (INSERT bypass, applying)', true)
    returning id into v_msg_c;

  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
    values (v_owner_a, v_link_a1, v_project_a1, 'client', 'Phase 6B boundary fixture message D (INSERT bypass, applied)', true)
    returning id into v_msg_d;

  insert into public.share_messages (user_id, share_link_id, project_id, author_type, body, is_visible_to_client)
    values (v_owner_a, v_link_a1, v_project_a1, 'client', 'Phase 6B boundary fixture message E (normal draft/analyzed)', true)
    returning id into v_msg_e;

  perform pg_temp.act_as('postgres');

  insert into fixture_ids (key, value) values
    ('msg_a', v_msg_a), ('msg_b', v_msg_b), ('msg_c', v_msg_c), ('msg_d', v_msg_d), ('msg_e', v_msg_e);
end;
$$;

-- =========================================================
-- Section A: authenticated direct UPDATE attack -- analyzed -> applying
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_msg_a uuid; v_id uuid;
  v_original_attempt_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';
  select value into v_msg_a from fixture_ids where key = 'msg_a';

  perform pg_temp.act_as('authenticated', v_owner_a);

  -- A valid client_share row, at the only status Phase 6A's own
  -- coupling/content-integrity trigger and this migration both agree is
  -- legitimate to create directly: 'analyzed' (a resumable end-state
  -- from the app's own reservation-first algorithm).
  insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
    values (v_owner_a, v_project_a1, 'client_share', v_msg_a, 'Phase 6B boundary fixture message A (UPDATE attack, analyzed)', 'analyzed')
    returning id into v_id;

  select apply_attempt_id into v_original_attempt_id from public.project_updates where id = v_id;

  begin
    update public.project_updates
      set status = 'applying', apply_attempt_id = gen_random_uuid()
      where id = v_id;
    perform pg_temp.record_result('A', 'A1: authenticated owner UPDATE analyzed -> applying (self-chosen apply_attempt_id) is rejected', false, 'update unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'A', 'A1: authenticated owner UPDATE analyzed -> applying (self-chosen apply_attempt_id) is rejected',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.record_result(
    'A', 'A2: the row remains status=analyzed after the rejected attempt',
    (select status from public.project_updates where id = v_id) = 'analyzed'
  );

  perform pg_temp.record_result(
    'A', 'A3: apply_attempt_id is unchanged (still NULL) after the rejected attempt',
    (select apply_attempt_id from public.project_updates where id = v_id) is not distinct from v_original_attempt_id
    and (select apply_attempt_id from public.project_updates where id = v_id) is null
  );

  perform pg_temp.act_as('postgres');

  insert into fixture_ids (key, value) values ('update_a_analyzed', v_id);
end;
$$;

-- =========================================================
-- Section B: authenticated direct UPDATE attack -- reviewed -> applying
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_msg_b uuid; v_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';
  select value into v_msg_b from fixture_ids where key = 'msg_b';

  perform pg_temp.act_as('authenticated', v_owner_a);

  insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
    values (v_owner_a, v_project_a1, 'client_share', v_msg_b, 'Phase 6B boundary fixture message B (UPDATE attack, reviewed)', 'reviewed')
    returning id into v_id;

  begin
    update public.project_updates
      set status = 'applying', apply_attempt_id = gen_random_uuid()
      where id = v_id;
    perform pg_temp.record_result('B', 'B1: authenticated owner UPDATE reviewed -> applying is rejected', false, 'update unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'B', 'B1: authenticated owner UPDATE reviewed -> applying is rejected',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.record_result(
    'B', 'B2: the row remains status=reviewed after the rejected attempt',
    (select status from public.project_updates where id = v_id) = 'reviewed'
  );

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- Section C (MANDATORY): direct INSERT applying bypass
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_msg_c uuid; v_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';
  select value into v_msg_c from fixture_ids where key = 'msg_c';

  perform pg_temp.act_as('authenticated', v_owner_a);

  -- A COMPLETELY VALID client_share row by every OTHER measure: real,
  -- unclaimed, client-authored, same-owner, same-project source message;
  -- raw_input exactly equal to that message's body (satisfies Phase 6A's
  -- content-integrity trigger). The ONLY thing wrong with this INSERT is
  -- that it tries to be born already at status='applying', with a
  -- self-chosen apply_attempt_id -- exactly the hole a transition-only
  -- (UPDATE-only) guard would miss entirely, since there is no OLD row
  -- for an INSERT to compare against.
  begin
    insert into public.project_updates (
      user_id, project_id, source_type, source_share_message_id, raw_input, status, apply_attempt_id
    ) values (
      v_owner_a, v_project_a1, 'client_share', v_msg_c,
      'Phase 6B boundary fixture message C (INSERT bypass, applying)',
      'applying', gen_random_uuid()
    ) returning id into v_id;
    perform pg_temp.record_result('C', 'C1: direct INSERT of a fully-valid client_share row at status=applying is rejected', false, 'insert unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'C', 'C1: direct INSERT of a fully-valid client_share row at status=applying is rejected',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.record_result(
    'C', 'C2: no row was persisted for message C (the source message remains completely unclaimed)',
    not exists (select 1 from public.project_updates where source_share_message_id = v_msg_c)
  );

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- Section D: direct INSERT applied bypass
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_msg_d uuid; v_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';
  select value into v_msg_d from fixture_ids where key = 'msg_d';

  perform pg_temp.act_as('authenticated', v_owner_a);

  begin
    insert into public.project_updates (
      user_id, project_id, source_type, source_share_message_id, raw_input, status, apply_attempt_id
    ) values (
      v_owner_a, v_project_a1, 'client_share', v_msg_d,
      'Phase 6B boundary fixture message D (INSERT bypass, applied)',
      'applied', gen_random_uuid()
    ) returning id into v_id;
    perform pg_temp.record_result('D', 'D1: direct INSERT of a fully-valid client_share row at status=applied is rejected', false, 'insert unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'D', 'D1: direct INSERT of a fully-valid client_share row at status=applied is rejected',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.record_result(
    'D', 'D2: no row was persisted for message D (the source message remains completely unclaimed)',
    not exists (select 1 from public.project_updates where source_share_message_id = v_msg_d)
  );

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- Section E: normal client_share states still work; Phase 6A provenance
-- enforcement still independently active
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_msg_e uuid; v_id_draft uuid; v_id_analyzed uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';
  select value into v_msg_e from fixture_ids where key = 'msg_e';

  perform pg_temp.act_as('authenticated', v_owner_a);

  insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
    values (v_owner_a, v_project_a1, 'client_share', v_msg_e, 'Phase 6B boundary fixture message E (normal draft/analyzed)', 'draft')
    returning id into v_id_draft;
  perform pg_temp.record_result('E', 'E1: a valid client_share INSERT at status=draft succeeds', v_id_draft is not null);

  update public.project_updates set status = 'analyzed' where id = v_id_draft;
  perform pg_temp.record_result(
    'E', 'E2: the SAME row transitions draft -> analyzed successfully (the new guard has no effect on any status outside applying/applied)',
    (select status from public.project_updates where id = v_id_draft) = 'analyzed'
  );

  -- Phase 6A's own content-integrity trigger must still independently
  -- reject a body mismatch -- proving this new migration did not
  -- replace, weaken, or shadow enforce_project_update_source_provenance().
  begin
    insert into public.project_updates (user_id, project_id, source_type, source_share_message_id, raw_input, status)
      values (v_owner_a, v_project_a1, 'client_share', v_msg_e, 'this is NOT message E''s real body', 'draft');
    perform pg_temp.record_result('E', 'E3: Phase 6A content-integrity trigger still independently rejects a body mismatch', false, 'insert unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'E', 'E3: Phase 6A content-integrity trigger still independently rejects a body mismatch',
      sqlstate = 'P0001' and sqlerrm = 'PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- Section F: text Apply claim unaffected
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';

  perform pg_temp.act_as('authenticated', v_owner_a);

  insert into public.project_updates (user_id, project_id, source_type, raw_input, status)
    values (v_owner_a, v_project_a1, 'text', 'Phase 6B boundary fixture text update', 'analyzed')
    returning id into v_id;

  update public.project_updates
    set status = 'applying', apply_attempt_id = gen_random_uuid()
    where id = v_id;

  perform pg_temp.record_result(
    'F', 'F1: text project_update analyzed -> applying succeeds, completely unaffected by the new guard',
    (select status from public.project_updates where id = v_id) = 'applying'
  );

  perform pg_temp.act_as('postgres');

  insert into fixture_ids (key, value) values ('update_text', v_id);
end;
$$;

-- =========================================================
-- Section G: image Apply claim unaffected
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_id uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';

  perform pg_temp.act_as('authenticated', v_owner_a);

  insert into public.project_updates (user_id, project_id, source_type, raw_input, status)
    values (v_owner_a, v_project_a1, 'image', 'Phase 6B boundary fixture image transcription', 'analyzed')
    returning id into v_id;

  update public.project_updates
    set status = 'applying', apply_attempt_id = gen_random_uuid()
    where id = v_id;

  perform pg_temp.record_result(
    'G', 'G1: image project_update analyzed -> applying succeeds, completely unaffected by the new guard',
    (select status from public.project_updates where id = v_id) = 'applying'
  );

  perform pg_temp.act_as('postgres');

  insert into fixture_ids (key, value) values ('update_image', v_id);
end;
$$;

-- =========================================================
-- Section H: normal text/image applying -> applied remains allowed
-- =========================================================

do $$
declare
  v_owner_a uuid; v_update_text uuid; v_update_image uuid;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_update_text from fixture_ids where key = 'update_text';
  select value into v_update_image from fixture_ids where key = 'update_image';

  perform pg_temp.act_as('authenticated', v_owner_a);

  update public.project_updates set status = 'applied' where id = v_update_text;
  perform pg_temp.record_result(
    'H', 'H1: text project_update applying -> applied succeeds',
    (select status from public.project_updates where id = v_update_text) = 'applied'
  );

  update public.project_updates set status = 'applied' where id = v_update_image;
  perform pg_temp.record_result(
    'H', 'H2: image project_update applying -> applied succeeds',
    (select status from public.project_updates where id = v_update_image) = 'applied'
  );

  perform pg_temp.act_as('postgres');
end;
$$;

-- =========================================================
-- Section I: direct RPC precondition against the still-analyzed
-- client_share row
-- =========================================================

do $$
declare
  v_owner_a uuid; v_project_a1 uuid; v_update_a uuid;
  v_timeline_count_before integer;
  v_timeline_count_after integer;
  v_task_count_before integer;
  v_task_count_after integer;
  v_client_count_before integer;
  v_client_count_after integer;
  v_project_row_before public.projects%rowtype;
  v_project_row_after public.projects%rowtype;
begin
  select value into v_owner_a from fixture_ids where key = 'owner_a';
  select value into v_project_a1 from fixture_ids where key = 'project_a1';
  select value into v_update_a from fixture_ids where key = 'update_a_analyzed';

  select count(*) into v_timeline_count_before from public.project_timeline_events where project_id = v_project_a1;
  select count(*) into v_task_count_before from public.tasks where project_id = v_project_a1;
  select count(*) into v_client_count_before from public.clients;
  select * into v_project_row_before from public.projects where id = v_project_a1;

  perform pg_temp.act_as('authenticated', v_owner_a);

  begin
    perform public.apply_project_update_transaction(
      v_update_a,
      gen_random_uuid(),
      array[gen_random_uuid()]::uuid[],
      array[]::uuid[],
      '[]'::jsonb,
      '[]'::jsonb
    );
    perform pg_temp.record_result('I', 'I1: direct apply_project_update_transaction against the (still analyzed) client_share row fails', false, 'RPC unexpectedly succeeded');
  exception when others then
    perform pg_temp.record_result(
      'I', 'I1: direct apply_project_update_transaction against the (still analyzed) client_share row fails with APPLY_ATTEMPT_MISMATCH',
      sqlstate = 'P0001' and sqlerrm = 'APPLY_ATTEMPT_MISMATCH',
      format('sqlstate=%s sqlerrm=%s', sqlstate, sqlerrm)
    );
  end;

  perform pg_temp.act_as('postgres');

  select count(*) into v_timeline_count_after from public.project_timeline_events where project_id = v_project_a1;
  select count(*) into v_task_count_after from public.tasks where project_id = v_project_a1;
  select count(*) into v_client_count_after from public.clients;
  select * into v_project_row_after from public.projects where id = v_project_a1;

  perform pg_temp.record_result(
    'I', 'I2: zero project_timeline_events rows were created by the failed RPC attempt',
    v_timeline_count_after = v_timeline_count_before
  );

  perform pg_temp.record_result(
    'I', 'I3: zero tasks rows were created or mutated by the failed RPC attempt',
    v_task_count_after = v_task_count_before
  );

  perform pg_temp.record_result(
    'I', 'I5: the project row itself was not mutated by the failed RPC attempt (compared field-by-field via row equality)',
    v_project_row_after = v_project_row_before
  );

  perform pg_temp.record_result(
    'I', 'I6: zero clients rows were created by the failed RPC attempt',
    v_client_count_after = v_client_count_before
  );

  perform pg_temp.record_result(
    'I', 'I4: the client_share row is still status=analyzed after the failed RPC attempt',
    (select status from public.project_updates where id = v_update_a) = 'analyzed'
  );
end;
$$;

-- =========================================================
-- Section J: explicit insert-bypass proof summary
-- =========================================================

do $$
begin
  perform pg_temp.record_result(
    'J', 'J1: across this entire run, no client_share project_updates row anywhere in this database is currently status IN (applying, applied) -- INSERT bypass (Sections C/D) and UPDATE bypass (Sections A/B) were both attempted and both rejected',
    not exists (
      select 1 from public.project_updates
      where source_type = 'client_share' and status in ('applying', 'applied')
    )
  );
end;
$$;

-- =========================================================
-- Section K: trigger metadata / privileges
-- =========================================================

do $$
begin
  perform pg_temp.record_result(
    'K', 'K1: the new trigger is installed as a row-level BEFORE INSERT OR UPDATE trigger on project_updates',
    exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where c.relname = 'project_updates'
        and t.tgname = 'project_updates_enforce_client_share_apply_boundary'
        and not t.tgisinternal
        and pg_get_triggerdef(t.oid) ilike '%before insert or update%on public.project_updates%for each row%'
    )
  );

  perform pg_temp.record_result(
    'K', 'K2: the new trigger function is SECURITY INVOKER',
    (
      select not p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'enforce_project_update_client_share_apply_boundary'
    )
  );

  perform pg_temp.record_result(
    'K', 'K3: the new trigger function has search_path = public, pg_temp set explicitly',
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) as cfg(setting)
      where n.nspname = 'public' and p.proname = 'enforce_project_update_client_share_apply_boundary'
        and cfg.setting ilike 'search_path=public,%pg_temp%'
    )
  );

  perform pg_temp.record_result(
    'K', 'K4: the new trigger function has no EXECUTE grant to public, anon, authenticated or service_role',
    not exists (
      select 1 from information_schema.role_routine_grants
      where routine_schema = 'public' and routine_name = 'enforce_project_update_client_share_apply_boundary'
        and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
    )
  );

  -- Signature-exact, not name-only: has_function_privilege() resolves
  -- the ::regprocedure cast against the EXACT six-argument overload the
  -- application actually calls, so this cannot be satisfied by some
  -- other same-named function/overload that happens to also grant
  -- authenticated EXECUTE. Requires the Phase 6B RPC prerequisite
  -- package (00_APPLY_CURRENT_PROJECT_UPDATE_APPLY_PREREQUISITES.sql)
  -- to have been applied first -- to_regprocedure returns NULL (and the
  -- cast raises) if the function does not exist at all, so this check
  -- itself proves the real RPC is actually installed, not merely
  -- assumed.
  perform pg_temp.record_result(
    'K', 'K5: apply_project_update_transaction (exact 6-argument signature) still has its own unchanged EXECUTE grant to authenticated (this migration did not touch it)',
    to_regprocedure('public.apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)') is not null
    and has_function_privilege(
      'authenticated',
      'public.apply_project_update_transaction(uuid,uuid,uuid[],uuid[],jsonb,jsonb)'::regprocedure,
      'EXECUTE'
    )
  );

  perform pg_temp.record_result(
    'K', 'K6: enforce_project_update_source_provenance (Phase 6A) is untouched -- still installed, still has no EXECUTE grant to any role',
    exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where c.relname = 'project_updates'
        and t.tgname = 'project_updates_enforce_source_provenance'
        and not t.tgisinternal
    )
    and not exists (
      select 1 from information_schema.role_routine_grants
      where routine_schema = 'public' and routine_name = 'enforce_project_update_source_provenance'
        and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
    )
  );
end;
$$;

-- =========================================================
-- Results
-- =========================================================

-- Kept for interactive use (scroll-back in a client that shows every
-- statement's own result set). Supabase's SQL Editor, however, only
-- surfaces the LAST statement's result -- so these two are NOT the
-- authoritative diagnostic output; the final combined query below is.
select seq, section, name, status, detail from test_results order by seq;

select seq, section, name, status, detail
from test_results
where status = 'FAIL'
order by seq;

-- FINAL, single-row, single-result-set verdict -- deliberately the LAST
-- statement in this file, and deliberately a plain SELECT, not a
-- RAISE EXCEPTION (a FAIL must be loud through this row's own columns,
-- not by aborting the script, so ROLLBACK below always executes on both
-- PASS and FAIL). This row is self-sufficient: when the Supabase SQL
-- Editor (or any client) shows only the final result set, every FAIL's
-- section/name/detail is still fully visible right here, aggregated
-- into failed_test_details -- no need to scroll up or re-run the two
-- queries above just to see what broke.
select
  count(*) as total_tests,
  count(*) filter (where status = 'PASS') as passed_tests,
  count(*) filter (where status = 'FAIL') as failed_tests,
  case
    when count(*) filter (where status = 'FAIL') = 0 then 'PHASE_6B_BOUNDARY_RUNTIME_PASS'
    else 'PHASE_6B_BOUNDARY_RUNTIME_FAIL'
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

-- Always rolls back: no fixture row or test-only object this file created
-- survives a run, regardless of PASS or FAIL. Safe to re-run repeatedly
-- against the same disposable project.
rollback;
