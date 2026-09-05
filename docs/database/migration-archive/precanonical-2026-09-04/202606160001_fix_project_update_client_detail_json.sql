-- Text2Task Project Update client-detail JSON safety
-- Migration: 202606160001_fix_project_update_client_detail_json.sql
-- Created: 2026-06-16
--
-- Keeps the Phase 3A.2 transactional apply RPC intact, but replaces the
-- timeline metadata expression with an explicit JSONB-object guard. This avoids
-- treating scalar client-detail values, such as email strings, as JSON objects
-- while preserving the transactional apply behavior and response contract.

do $$
declare
  v_signature regprocedure :=
    'public.apply_project_update_transaction(uuid, uuid, uuid[], uuid[], jsonb, jsonb)'::regprocedure;
  v_function_sql text;
  v_old_expression text :=
    'nullif(v_event_payload->''metadata'', ''null''::jsonb)';
  v_new_expression text := $replacement$
      case
        when v_event_payload ? 'metadata'
          and jsonb_typeof(v_event_payload->'metadata') = 'object'
        then v_event_payload->'metadata'
        else null
      end$replacement$;
begin
  select pg_get_functiondef(v_signature)
  into v_function_sql;

  if v_function_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_PROJECT_UPDATE_TRANSACTION_NOT_FOUND';
  end if;

  if position(v_old_expression in v_function_sql) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_PROJECT_UPDATE_TRANSACTION_METADATA_PATCH_NOT_FOUND';
  end if;

  execute replace(v_function_sql, v_old_expression, v_new_expression);
end $$;

revoke all on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) from public;

revoke all on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) from anon;

grant execute on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) to authenticated;

comment on function public.apply_project_update_transaction(
  uuid,
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) is
  'Transactionally applies a claimed Project Update review. Patched 2026-06-16 to guard timeline metadata as JSONB object for client-detail changes.';
