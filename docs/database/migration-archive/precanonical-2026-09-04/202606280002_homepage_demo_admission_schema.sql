-- Homepage Live Demo admission-control foundation.
--
-- This migration adds server-only schema used to decide whether an anonymous
-- homepage demo request may proceed. It intentionally exposes no browser RLS
-- policy and grants only CRUD table access to service_role.

create table if not exists public.homepage_demo_admission_config (
  id smallint primary key default 1,
  admission_enabled boolean not null default false,
  text_enabled boolean not null default false,
  image_enabled boolean not null default false,
  challenge_required boolean not null default true,
  global_concurrency_limit integer not null default 2,
  text_concurrency_limit integer not null default 2,
  image_concurrency_limit integer not null default 0,
  text_cost_units integer not null default 1,
  image_cost_units integer not null default 5,
  hourly_budget_units integer not null default 20,
  daily_budget_units integer not null default 100,
  processing_lease_seconds integer not null default 180,
  trial_ttl_seconds integer not null default 900,
  session_attempt_limit integer not null default 3,
  device_attempt_limit integer not null default 5,
  ip_hour_attempt_limit integer not null default 20,
  ip_day_attempt_limit integer not null default 50,
  challenge_failure_limit integer not null default 5,
  session_entitlement_seconds integer not null default 3600,
  device_entitlement_seconds integer not null default 2592000,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_admission_config_singleton_check
    check (id = 1),
  constraint homepage_demo_admission_config_concurrency_check
    check (
      global_concurrency_limit between 1 and 20
      and text_concurrency_limit between 0 and global_concurrency_limit
      and image_concurrency_limit between 0 and global_concurrency_limit
    ),
  constraint homepage_demo_admission_config_cost_units_check
    check (
      text_cost_units between 1 and 100
      and image_cost_units between 1 and 100
    ),
  constraint homepage_demo_admission_config_budget_check
    check (
      hourly_budget_units between 1 and 100000
      and daily_budget_units between hourly_budget_units and 1000000
    ),
  constraint homepage_demo_admission_config_timing_check
    check (
      processing_lease_seconds between 30 and 900
      and trial_ttl_seconds between 300 and 3600
      and session_entitlement_seconds between 300 and 86400
      and device_entitlement_seconds between session_entitlement_seconds and 2592000
    ),
  constraint homepage_demo_admission_config_limits_check
    check (
      session_attempt_limit between 1 and 10000
      and device_attempt_limit between 1 and 10000
      and ip_hour_attempt_limit between 1 and 10000
      and ip_day_attempt_limit between ip_hour_attempt_limit and 10000
      and challenge_failure_limit between 1 and 10000
    )
);

insert into public.homepage_demo_admission_config (
  id,
  admission_enabled,
  text_enabled,
  image_enabled,
  challenge_required,
  global_concurrency_limit,
  text_concurrency_limit,
  image_concurrency_limit,
  text_cost_units,
  image_cost_units,
  hourly_budget_units,
  daily_budget_units,
  processing_lease_seconds,
  trial_ttl_seconds,
  session_attempt_limit,
  device_attempt_limit,
  ip_hour_attempt_limit,
  ip_day_attempt_limit,
  challenge_failure_limit,
  session_entitlement_seconds,
  device_entitlement_seconds
) values (
  1,
  false,
  false,
  false,
  true,
  2,
  2,
  0,
  1,
  5,
  20,
  100,
  180,
  900,
  3,
  5,
  20,
  50,
  5,
  3600,
  2592000
) on conflict (id) do nothing;

create table if not exists public.homepage_demo_admission_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key_hash text not null,
  trial_id uuid null references public.homepage_demo_trials(id) on delete set null,
  session_token_hash text not null,
  device_token_hash text not null,
  ip_identity_digest text not null,
  input_type text not null,
  status text not null,
  decision_code text null,
  estimated_cost_units integer not null,
  provider_call_started_at timestamp with time zone null,
  provider_call_completed_at timestamp with time zone null,
  review_ready_at timestamp with time zone null,
  retention_expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_attempts_idempotency_hash_check
    check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  constraint homepage_demo_attempts_session_hash_check
    check (session_token_hash ~ '^[0-9a-f]{64}$'),
  constraint homepage_demo_attempts_device_hash_check
    check (device_token_hash ~ '^[0-9a-f]{64}$'),
  constraint homepage_demo_attempts_ip_digest_check
    check (ip_identity_digest ~ '^v[1-9][0-9]*:[0-9a-f]{64}$'),
  constraint homepage_demo_attempts_input_type_check
    check (input_type in ('text', 'image')),
  constraint homepage_demo_attempts_status_check
    check (status in (
      'admitted',
      'processing',
      'review_ready',
      'failed',
      'blocked',
      'rejected',
      'released',
      'expired'
    )),
  constraint homepage_demo_attempts_decision_code_format_check
    check (
      decision_code is null
      or (
        char_length(decision_code) between 1 and 80
        and decision_code ~ '^[a-z0-9_:-]+$'
      )
    ),
  constraint homepage_demo_attempts_decision_state_check
    check (
      (
        status in (
          'failed',
          'blocked',
          'rejected'
        )
        and decision_code is not null
      )
      or (
        status in (
          'admitted',
          'processing',
          'review_ready',
          'released',
          'expired'
        )
        and decision_code is null
      )
    ),
  constraint homepage_demo_attempts_cost_units_check
    check (estimated_cost_units > 0),
  constraint homepage_demo_attempts_provider_times_check
    check (
      (
        provider_call_started_at is null
        or provider_call_started_at >= created_at
      )
      and (
        provider_call_completed_at is null
        or (
          provider_call_started_at is not null
          and provider_call_completed_at >= provider_call_started_at
        )
      )
      and (
        review_ready_at is null
        or (
          provider_call_completed_at is not null
          and review_ready_at >= provider_call_completed_at
        )
      )
    ),
  constraint homepage_demo_attempts_review_ready_at_check
    check (
      (
        status = 'review_ready'
        and provider_call_started_at is not null
        and provider_call_completed_at is not null
        and review_ready_at is not null
      )
      or (
        status <> 'review_ready'
        and review_ready_at is null
      )
    ),
  constraint homepage_demo_attempts_retention_check
    check (retention_expires_at > created_at)
);

alter table public.homepage_demo_admission_attempts
  add constraint homepage_demo_admission_attempts_idempotency_key_unique
  unique (idempotency_key_hash);

alter table public.homepage_demo_admission_attempts
  add constraint homepage_demo_admission_attempts_id_input_type_unique
  unique (id, input_type);

create unique index if not exists homepage_demo_admission_attempts_trial_unique_idx
  on public.homepage_demo_admission_attempts (trial_id)
  where trial_id is not null;

create index if not exists homepage_demo_admission_attempts_status_retention_idx
  on public.homepage_demo_admission_attempts (status, retention_expires_at);

create index if not exists homepage_demo_admission_attempts_session_created_idx
  on public.homepage_demo_admission_attempts (session_token_hash, created_at);

create index if not exists homepage_demo_admission_attempts_device_created_idx
  on public.homepage_demo_admission_attempts (device_token_hash, created_at);

create index if not exists homepage_demo_admission_attempts_ip_created_idx
  on public.homepage_demo_admission_attempts (ip_identity_digest, created_at);

create table if not exists public.homepage_demo_rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  action text not null,
  identity_digest text not null,
  window_start timestamp with time zone not null,
  window_seconds integer not null,
  request_count integer not null default 0,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_rate_buckets_scope_check
    check (scope in ('session', 'device', 'ip')),
  constraint homepage_demo_rate_buckets_action_check
    check (action in ('admission', 'challenge_failure')),
  constraint homepage_demo_rate_buckets_identity_check
    check (
      (
        scope in ('session', 'device')
        and identity_digest ~ '^[0-9a-f]{64}$'
      )
      or (
        scope = 'ip'
        and identity_digest ~ '^v[1-9][0-9]*:[0-9a-f]{64}$'
      )
    ),
  constraint homepage_demo_rate_buckets_window_seconds_check
    check (window_seconds in (3600, 86400)),
  constraint homepage_demo_rate_buckets_count_check
    check (request_count >= 0),
  constraint homepage_demo_rate_buckets_challenge_check
    check (
      action <> 'challenge_failure'
      or (
        scope = 'ip'
        and window_seconds = 3600
      )
    ),
  constraint homepage_demo_rate_buckets_admission_check
    check (
      action <> 'admission'
      or (
        (scope = 'session' and window_seconds = 3600)
        or (scope = 'device' and window_seconds = 86400)
        or (scope = 'ip' and window_seconds in (3600, 86400))
      )
    ),
  constraint homepage_demo_rate_buckets_expiry_check
    check (expires_at >= window_start + (window_seconds * interval '1 second'))
);

alter table public.homepage_demo_rate_limit_buckets
  add constraint homepage_demo_rate_limit_buckets_unique
  unique (scope, action, identity_digest, window_start, window_seconds);

create index if not exists homepage_demo_rate_limit_buckets_expires_at_idx
  on public.homepage_demo_rate_limit_buckets (expires_at);

create table if not exists public.homepage_demo_trial_entitlements (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid null references public.homepage_demo_admission_attempts(id) on delete set null,
  trial_id uuid null references public.homepage_demo_trials(id) on delete set null,
  scope text not null,
  identity_digest text not null,
  status text not null,
  reserved_at timestamp with time zone not null default now(),
  consumed_at timestamp with time zone null,
  released_at timestamp with time zone null,
  reservation_expires_at timestamp with time zone not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_trial_entitlements_scope_check
    check (scope in ('session', 'device')),
  constraint homepage_demo_trial_entitlements_identity_check
    check (identity_digest ~ '^[0-9a-f]{64}$'),
  constraint homepage_demo_trial_entitlements_status_check
    check (status in ('reserved', 'consumed', 'released', 'expired')),
  constraint homepage_demo_trial_entitlements_times_check
    check (
      reservation_expires_at > reserved_at
      and expires_at >= reservation_expires_at
      and expires_at > created_at
    ),
  constraint homepage_demo_trial_entitlements_state_check
    check (
      (
        status = 'reserved'
        and attempt_id is not null
        and trial_id is null
        and consumed_at is null
        and released_at is null
      )
      or (
        status = 'consumed'
        and consumed_at is not null
        and consumed_at >= reserved_at
        and released_at is null
      )
      or (
        status = 'released'
        and trial_id is null
        and consumed_at is null
        and released_at is not null
        and released_at >= reserved_at
      )
      or (
        status = 'expired'
        and trial_id is null
        and consumed_at is null
        and released_at is null
      )
    )
);

alter table public.homepage_demo_trial_entitlements
  add constraint homepage_demo_trial_entitlements_attempt_scope_unique
  unique (attempt_id, scope);

create unique index if not exists homepage_demo_trial_entitlements_active_identity_idx
  on public.homepage_demo_trial_entitlements (scope, identity_digest)
  where status in ('reserved', 'consumed');

create index if not exists homepage_demo_trial_entitlements_status_expires_idx
  on public.homepage_demo_trial_entitlements (status, expires_at);

create table if not exists public.homepage_demo_capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  workload_type text not null,
  lease_token_hash text not null,
  reserved_units integer not null default 1,
  status text not null,
  lease_expires_at timestamp with time zone not null,
  released_at timestamp with time zone null,
  expired_at timestamp with time zone null,
  retention_expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_capacity_workload_type_check
    check (workload_type in ('text', 'image')),
  constraint homepage_demo_capacity_lease_hash_check
    check (lease_token_hash ~ '^[0-9a-f]{64}$'),
  constraint homepage_demo_capacity_reserved_units_check
    check (reserved_units > 0),
  constraint homepage_demo_capacity_status_check
    check (status in ('active', 'released', 'expired')),
  constraint homepage_demo_capacity_times_check
    check (
      lease_expires_at > created_at
      and retention_expires_at > created_at
    ),
  constraint homepage_demo_capacity_state_check
    check (
      (
        status = 'active'
        and released_at is null
        and expired_at is null
      )
      or (
        status = 'released'
        and released_at is not null
        and expired_at is null
      )
      or (
        status = 'expired'
        and released_at is null
        and expired_at is not null
      )
    ),
  constraint homepage_demo_capacity_attempt_workload_fk
    foreign key (attempt_id, workload_type)
    references public.homepage_demo_admission_attempts(id, input_type)
    on delete cascade
);

alter table public.homepage_demo_capacity_reservations
  add constraint homepage_demo_capacity_reservations_attempt_unique
  unique (attempt_id);

alter table public.homepage_demo_capacity_reservations
  add constraint homepage_demo_capacity_reservations_lease_unique
  unique (lease_token_hash);

create index if not exists homepage_demo_capacity_reservations_active_idx
  on public.homepage_demo_capacity_reservations (status, workload_type, lease_expires_at)
  where status = 'active';

create index if not exists homepage_demo_capacity_reservations_retention_idx
  on public.homepage_demo_capacity_reservations (retention_expires_at);

create table if not exists public.homepage_demo_cost_buckets (
  id uuid primary key default gen_random_uuid(),
  window_kind text not null,
  window_start timestamp with time zone not null,
  window_seconds integer not null,
  reserved_units integer not null default 0,
  spent_units integer not null default 0,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_cost_buckets_window_kind_check
    check (window_kind in ('hour', 'day')),
  constraint homepage_demo_cost_buckets_window_seconds_check
    check (
      (window_kind = 'hour' and window_seconds = 3600)
      or (window_kind = 'day' and window_seconds = 86400)
    ),
  constraint homepage_demo_cost_buckets_units_check
    check (
      reserved_units >= 0
      and spent_units >= 0
    ),
  constraint homepage_demo_cost_buckets_expires_at_check
    check (expires_at >= window_start + (window_seconds * interval '1 second'))
);

alter table public.homepage_demo_cost_buckets
  add constraint homepage_demo_cost_buckets_window_unique
  unique (window_kind, window_start);

alter table public.homepage_demo_cost_buckets
  add constraint homepage_demo_cost_buckets_id_kind_unique
  unique (id, window_kind);

create index if not exists homepage_demo_cost_buckets_expires_at_idx
  on public.homepage_demo_cost_buckets (expires_at);

create table if not exists public.homepage_demo_cost_reservations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid null references public.homepage_demo_admission_attempts(id) on delete set null,
  hour_bucket_id uuid not null,
  hour_bucket_kind text not null default 'hour',
  day_bucket_id uuid not null,
  day_bucket_kind text not null default 'day',
  reserved_units integer not null,
  finalized_units integer null,
  status text not null,
  provider_call_started_at timestamp with time zone null,
  finalized_at timestamp with time zone null,
  released_at timestamp with time zone null,
  expired_at timestamp with time zone null,
  retention_expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint homepage_demo_cost_reservations_units_check
    check (
      reserved_units > 0
      and (
        finalized_units is null
        or finalized_units between 0 and reserved_units
      )
    ),
  constraint homepage_demo_cost_reservations_status_check
    check (status in ('reserved', 'finalized', 'released', 'expired')),
  constraint homepage_demo_cost_reservations_hour_kind_check
    check (hour_bucket_kind = 'hour'),
  constraint homepage_demo_cost_reservations_day_kind_check
    check (day_bucket_kind = 'day'),
  constraint homepage_demo_cost_reservations_state_check
    check (
      (
        status = 'reserved'
        and finalized_units is null
        and finalized_at is null
        and released_at is null
        and expired_at is null
      )
      or (
        status = 'finalized'
        and finalized_units is not null
        and finalized_at is not null
        and released_at is null
        and expired_at is null
      )
      or (
        status = 'released'
        and finalized_units is null
        and finalized_at is null
        and released_at is not null
        and expired_at is null
      )
      or (
        status = 'expired'
        and finalized_units is null
        and finalized_at is null
        and released_at is null
        and expired_at is not null
      )
    ),
  constraint homepage_demo_cost_reservations_retention_check
    check (retention_expires_at > created_at),
  constraint homepage_demo_cost_reservations_hour_bucket_fk
    foreign key (hour_bucket_id, hour_bucket_kind)
    references public.homepage_demo_cost_buckets(id, window_kind)
    on delete restrict,
  constraint homepage_demo_cost_reservations_day_bucket_fk
    foreign key (day_bucket_id, day_bucket_kind)
    references public.homepage_demo_cost_buckets(id, window_kind)
    on delete restrict
);

create unique index if not exists homepage_demo_cost_reservations_attempt_unique_idx
  on public.homepage_demo_cost_reservations (attempt_id)
  where attempt_id is not null;

create index if not exists homepage_demo_cost_reservations_status_retention_idx
  on public.homepage_demo_cost_reservations (status, retention_expires_at);

create index if not exists homepage_demo_cost_reservations_provider_start_idx
  on public.homepage_demo_cost_reservations (provider_call_started_at)
  where status = 'reserved';

create index if not exists homepage_demo_cost_reservations_hour_bucket_idx
  on public.homepage_demo_cost_reservations (hour_bucket_id, hour_bucket_kind);

create index if not exists homepage_demo_cost_reservations_day_bucket_idx
  on public.homepage_demo_cost_reservations (day_bucket_id, day_bucket_kind);

drop trigger if exists set_homepage_demo_admission_config_updated_at
  on public.homepage_demo_admission_config;
create trigger set_homepage_demo_admission_config_updated_at
  before update on public.homepage_demo_admission_config
  for each row
  execute function public.set_homepage_demo_updated_at();

drop trigger if exists set_homepage_demo_admission_attempts_updated_at
  on public.homepage_demo_admission_attempts;
create trigger set_homepage_demo_admission_attempts_updated_at
  before update on public.homepage_demo_admission_attempts
  for each row
  execute function public.set_homepage_demo_updated_at();

drop trigger if exists set_homepage_demo_rate_limit_buckets_updated_at
  on public.homepage_demo_rate_limit_buckets;
create trigger set_homepage_demo_rate_limit_buckets_updated_at
  before update on public.homepage_demo_rate_limit_buckets
  for each row
  execute function public.set_homepage_demo_updated_at();

drop trigger if exists set_homepage_demo_trial_entitlements_updated_at
  on public.homepage_demo_trial_entitlements;
create trigger set_homepage_demo_trial_entitlements_updated_at
  before update on public.homepage_demo_trial_entitlements
  for each row
  execute function public.set_homepage_demo_updated_at();

drop trigger if exists set_homepage_demo_capacity_reservations_updated_at
  on public.homepage_demo_capacity_reservations;
create trigger set_homepage_demo_capacity_reservations_updated_at
  before update on public.homepage_demo_capacity_reservations
  for each row
  execute function public.set_homepage_demo_updated_at();

drop trigger if exists set_homepage_demo_cost_buckets_updated_at
  on public.homepage_demo_cost_buckets;
create trigger set_homepage_demo_cost_buckets_updated_at
  before update on public.homepage_demo_cost_buckets
  for each row
  execute function public.set_homepage_demo_updated_at();

drop trigger if exists set_homepage_demo_cost_reservations_updated_at
  on public.homepage_demo_cost_reservations;
create trigger set_homepage_demo_cost_reservations_updated_at
  before update on public.homepage_demo_cost_reservations
  for each row
  execute function public.set_homepage_demo_updated_at();

alter table public.homepage_demo_admission_config enable row level security;
alter table public.homepage_demo_admission_attempts enable row level security;
alter table public.homepage_demo_rate_limit_buckets enable row level security;
alter table public.homepage_demo_trial_entitlements enable row level security;
alter table public.homepage_demo_capacity_reservations enable row level security;
alter table public.homepage_demo_cost_buckets enable row level security;
alter table public.homepage_demo_cost_reservations enable row level security;

revoke all privileges
on table public.homepage_demo_admission_config
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_admission_attempts
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_rate_limit_buckets
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_trial_entitlements
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_capacity_reservations
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_cost_buckets
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_cost_reservations
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_admission_config
from service_role;

revoke all privileges
on table public.homepage_demo_admission_attempts
from service_role;

revoke all privileges
on table public.homepage_demo_rate_limit_buckets
from service_role;

revoke all privileges
on table public.homepage_demo_trial_entitlements
from service_role;

revoke all privileges
on table public.homepage_demo_capacity_reservations
from service_role;

revoke all privileges
on table public.homepage_demo_cost_buckets
from service_role;

revoke all privileges
on table public.homepage_demo_cost_reservations
from service_role;

grant select, insert, update, delete
on table public.homepage_demo_admission_config
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_admission_attempts
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_rate_limit_buckets
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_trial_entitlements
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_capacity_reservations
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_cost_buckets
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_cost_reservations
to service_role;
