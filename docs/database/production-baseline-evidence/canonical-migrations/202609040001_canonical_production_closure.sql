-- SESSION

set search_path = public, pg_catalog, extensions;

-- TABLES

create table "public"."analytics_events" (
  "id" uuid default gen_random_uuid() not null,
  "event_name" text not null,
  "occurred_at" timestamp with time zone default now() not null,
  "user_id" uuid,
  "anonymous_id" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "referrer" text,
  "landing_page" text,
  "page_path" text,
  "country_code" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "idempotency_key" text,
  "created_at" timestamp with time zone default now() not null
);

alter table "public"."analytics_events" owner to postgres;

create table "public"."authenticated_product_events" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "event_name" text not null,
  "route" text not null,
  "entity_type" text,
  "entity_id" text,
  "idempotency_key" text,
  "created_at" timestamp with time zone default now() not null
);

alter table "public"."authenticated_product_events" owner to postgres;

create table "public"."billing_checkout_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "intent" text not null,
  "status" text not null,
  "creem_request_id" text not null,
  "checkout_url" text,
  "lease_token" uuid,
  "lease_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "expires_at" timestamp with time zone not null,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "error_code" text
);

alter table "public"."billing_checkout_attempts" owner to postgres;

create table "public"."calendar_events" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "title" text not null,
  "event_date" date not null,
  "event_time" time without time zone,
  "notes" text,
  "project_id" uuid,
  "client_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "deleted_at" timestamp with time zone,
  "custom_project_name" text,
  "custom_client_name" text
);

alter table "public"."calendar_events" owner to postgres;

create table "public"."creem_webhook_events" (
  "id" uuid default gen_random_uuid() not null,
  "provider_event_id" text not null,
  "event_type" text not null,
  "webhook_action" text not null,
  "provider_event_created_at" timestamp with time zone not null,
  "provider_state_updated_at" timestamp with time zone not null,
  "object_id" text,
  "checkout_id" text,
  "creem_request_id" text,
  "subscription_id" text,
  "customer_id" text,
  "product_id" text,
  "environment" text,
  "internal_user_id_candidate" uuid,
  "normalized_subscription_status" text,
  "cancel_at_period_end" boolean,
  "current_period_start_at" timestamp with time zone,
  "current_period_end_at" timestamp with time zone,
  "refund_amount" numeric,
  "amount_paid" numeric,
  "refunded_amount" numeric,
  "refund_currency" text,
  "transaction_currency" text,
  "resolved_user_id" uuid,
  "processing_status" text default 'received'::text not null,
  "reason_code" text not null,
  "attempt_count" integer default 1 not null,
  "received_at" timestamp with time zone default now() not null,
  "last_attempt_at" timestamp with time zone default now() not null,
  "processed_at" timestamp with time zone,
  "review_decision" text,
  "reviewed_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."creem_webhook_events" owner to postgres;

create table "public"."homepage_demo_admission_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "idempotency_key_hash" text not null,
  "trial_id" uuid,
  "session_token_hash" text not null,
  "device_token_hash" text not null,
  "ip_identity_digest" text not null,
  "input_type" text not null,
  "status" text not null,
  "decision_code" text,
  "estimated_cost_units" integer not null,
  "provider_call_started_at" timestamp with time zone,
  "provider_call_completed_at" timestamp with time zone,
  "review_ready_at" timestamp with time zone,
  "retention_expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_admission_attempts" owner to postgres;

create table "public"."homepage_demo_admission_config" (
  "id" smallint default 1 not null,
  "admission_enabled" boolean default false not null,
  "text_enabled" boolean default false not null,
  "image_enabled" boolean default false not null,
  "challenge_required" boolean default true not null,
  "global_concurrency_limit" integer default 2 not null,
  "text_concurrency_limit" integer default 2 not null,
  "image_concurrency_limit" integer default 0 not null,
  "text_cost_units" integer default 1 not null,
  "image_cost_units" integer default 5 not null,
  "hourly_budget_units" integer default 20 not null,
  "daily_budget_units" integer default 100 not null,
  "processing_lease_seconds" integer default 180 not null,
  "trial_ttl_seconds" integer default 900 not null,
  "session_attempt_limit" integer default 3 not null,
  "device_attempt_limit" integer default 5 not null,
  "ip_hour_attempt_limit" integer default 20 not null,
  "ip_day_attempt_limit" integer default 50 not null,
  "challenge_failure_limit" integer default 5 not null,
  "session_entitlement_seconds" integer default 3600 not null,
  "device_entitlement_seconds" integer default 2592000 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "admission_attempt_retention_seconds" integer default 172800 not null,
  "rate_bucket_retention_seconds" integer default 172800 not null,
  "capacity_reservation_retention_seconds" integer default 172800 not null,
  "cost_accounting_retention_seconds" integer default 604800 not null
);

alter table "public"."homepage_demo_admission_config" owner to postgres;

create table "public"."homepage_demo_capacity_reservations" (
  "id" uuid default gen_random_uuid() not null,
  "attempt_id" uuid not null,
  "workload_type" text not null,
  "lease_token_hash" text not null,
  "reserved_units" integer default 1 not null,
  "status" text not null,
  "lease_expires_at" timestamp with time zone not null,
  "released_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  "retention_expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_capacity_reservations" owner to postgres;

create table "public"."homepage_demo_claims" (
  "id" uuid default gen_random_uuid() not null,
  "trial_id" uuid,
  "draft_id" uuid,
  "claim_token_hash" text not null,
  "public_token_hash" text not null,
  "session_token_hash" text not null,
  "status" text default 'pending'::text not null,
  "expires_at" timestamp with time zone not null,
  "claimed_by_user_id" uuid,
  "saved_project_id" uuid,
  "claimed_at" timestamp with time zone,
  "import_idempotency_key" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "auth_continuation_token_hash" text,
  "auth_continuation_started_at" timestamp with time zone,
  "auth_continuation_expires_at" timestamp with time zone,
  "auth_continuation_consumed_at" timestamp with time zone
);

alter table "public"."homepage_demo_claims" owner to postgres;

create table "public"."homepage_demo_cost_buckets" (
  "id" uuid default gen_random_uuid() not null,
  "window_kind" text not null,
  "window_start" timestamp with time zone not null,
  "window_seconds" integer not null,
  "reserved_units" integer default 0 not null,
  "spent_units" integer default 0 not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_cost_buckets" owner to postgres;

create table "public"."homepage_demo_cost_reservations" (
  "id" uuid default gen_random_uuid() not null,
  "attempt_id" uuid,
  "hour_bucket_id" uuid not null,
  "hour_bucket_kind" text default 'hour'::text not null,
  "day_bucket_id" uuid not null,
  "day_bucket_kind" text default 'day'::text not null,
  "reserved_units" integer not null,
  "finalized_units" integer,
  "status" text not null,
  "provider_call_started_at" timestamp with time zone,
  "finalized_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  "retention_expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_cost_reservations" owner to postgres;

create table "public"."homepage_demo_drafts" (
  "id" uuid default gen_random_uuid() not null,
  "trial_id" uuid not null,
  "status" text default 'pending'::text not null,
  "schema_version" text not null,
  "engine_version" text not null,
  "normalized_result" jsonb,
  "edited_result" jsonb,
  "expires_at" timestamp with time zone not null,
  "claimed_by_user_id" uuid,
  "claimed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_drafts" owner to postgres;

create table "public"."homepage_demo_duplicate_override_authorities" (
  "id" uuid default gen_random_uuid() not null,
  "claim_id" uuid not null,
  "authenticated_user_id" uuid not null,
  "authority_token_hash" text not null,
  "request_hash" text not null,
  "import_groups_hash" text not null,
  "status" text default 'pending'::text not null,
  "expires_at" timestamp with time zone not null,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_duplicate_override_authorities" owner to postgres;

create table "public"."homepage_demo_rate_limit_buckets" (
  "id" uuid default gen_random_uuid() not null,
  "scope" text not null,
  "action" text not null,
  "identity_digest" text not null,
  "window_start" timestamp with time zone not null,
  "window_seconds" integer not null,
  "request_count" integer default 0 not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_rate_limit_buckets" owner to postgres;

create table "public"."homepage_demo_trial_entitlements" (
  "id" uuid default gen_random_uuid() not null,
  "attempt_id" uuid,
  "trial_id" uuid,
  "scope" text not null,
  "identity_digest" text not null,
  "status" text not null,
  "reserved_at" timestamp with time zone default now() not null,
  "consumed_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "reservation_expires_at" timestamp with time zone not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_trial_entitlements" owner to postgres;

create table "public"."homepage_demo_trials" (
  "id" uuid default gen_random_uuid() not null,
  "public_token_hash" text not null,
  "session_token_hash" text not null,
  "idempotency_key_hash" text not null,
  "input_type" text not null,
  "status" text default 'created'::text not null,
  "risk_state" text default 'not_evaluated'::text not null,
  "failure_code" text,
  "expires_at" timestamp with time zone not null,
  "claimed_by_user_id" uuid,
  "claimed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."homepage_demo_trials" owner to postgres;

create table "public"."project_import_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "idempotency_key" uuid not null,
  "request_hash" text not null,
  "status" text default 'started'::text not null,
  "result_json" jsonb,
  "created_at" timestamp with time zone default now() not null,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "error_code" text,
  "payload_json" jsonb,
  "last_seen_at" timestamp with time zone default now() not null
);

alter table "public"."project_import_attempts" owner to postgres;

create table "public"."project_share_links" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "project_id" uuid not null,
  "public_id" text not null,
  "secret_digest" text,
  "secret_digest_version" smallint,
  "state" text default 'draft'::text not null,
  "expires_at" timestamp with time zone,
  "comments_enabled" boolean default false not null,
  "client_facing_subtitle" text,
  "content_direction" text default 'auto'::text not null,
  "configuration_version" integer default 1 not null,
  "last_viewed_at" timestamp with time zone,
  "view_count" integer default 0 not null,
  "pin_hash" text,
  "pin_salt" text,
  "pin_hash_version" smallint,
  "pin_scrypt_n" integer,
  "pin_scrypt_r" integer,
  "pin_scrypt_p" integer,
  "pin_key_length" integer,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "activated_at" timestamp with time zone,
  "disabled_at" timestamp with time zone,
  "rotated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "title_visible" boolean default false not null,
  "status_visible" boolean default false not null,
  "target_date_visible" boolean default false not null,
  "access_epoch" integer default 1 not null,
  "pin_epoch" integer default 1 not null
);

alter table "public"."project_share_links" owner to postgres;

create table "public"."project_share_secret_material" (
  "share_link_id" uuid not null,
  "ciphertext" bytea not null,
  "nonce" bytea not null,
  "auth_tag" bytea not null,
  "encryption_version" smallint not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."project_share_secret_material" owner to postgres;

create table "public"."share_browser_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "session_digest" text not null,
  "digest_version" smallint not null,
  "created_at" timestamp with time zone default now() not null,
  "expires_at" timestamp with time zone not null,
  "last_seen_at" timestamp with time zone default now() not null,
  "revoked_at" timestamp with time zone
);

alter table "public"."share_browser_sessions" owner to postgres;

create table "public"."share_link_events" (
  "id" uuid default gen_random_uuid() not null,
  "share_link_id" uuid not null,
  "event_type" text not null,
  "identity_digest" text,
  "identity_digest_version" smallint,
  "created_at" timestamp with time zone default now() not null
);

alter table "public"."share_link_events" owner to postgres;

create table "public"."share_link_resources" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "share_link_id" uuid not null,
  "resource_id" uuid not null,
  "public_label" text not null,
  "can_download" boolean default false not null,
  "display_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."share_link_resources" owner to postgres;

create table "public"."share_link_tasks" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "share_link_id" uuid not null,
  "subtask_id" bigint not null,
  "public_group" text not null,
  "waiting_for_client_feedback" boolean default false not null,
  "display_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."share_link_tasks" owner to postgres;

create table "public"."share_link_updates" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "share_link_id" uuid not null,
  "body" text not null,
  "version" integer not null,
  "published_at" timestamp with time zone default now() not null,
  "created_by" uuid not null,
  "is_current" boolean default false not null,
  "created_at" timestamp with time zone default now() not null
);

alter table "public"."share_link_updates" owner to postgres;

create table "public"."share_message_conversions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "message_id" uuid not null,
  "project_update_id" uuid,
  "target_task_id" bigint,
  "converted_by" uuid not null,
  "converted_at" timestamp with time zone default now() not null
);

alter table "public"."share_message_conversions" owner to postgres;

create table "public"."share_messages" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "share_link_id" uuid not null,
  "project_id" uuid not null,
  "author_type" text not null,
  "author_display_name" text,
  "body" text not null,
  "parent_id" uuid,
  "is_visible_to_client" boolean default true not null,
  "status" text default 'new'::text not null,
  "reviewed_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."share_messages" owner to postgres;

create table "public"."share_rate_limit_buckets" (
  "id" uuid default gen_random_uuid() not null,
  "scope" text not null,
  "action" text not null,
  "identity_digest" text not null,
  "identity_digest_version" smallint not null,
  "share_link_id" uuid,
  "share_link_key" text not null generated always as (coalesce(share_link_id::text, '-')) stored,
  "window_start" timestamp with time zone not null,
  "window_seconds" integer not null,
  "request_count" integer default 0 not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table "public"."share_rate_limit_buckets" owner to postgres;

create table "public"."share_session_grants" (
  "id" uuid default gen_random_uuid() not null,
  "browser_session_id" uuid not null,
  "share_link_id" uuid not null,
  "granted_configuration_version" integer not null,
  "pin_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "expires_at" timestamp with time zone not null,
  "revoked_at" timestamp with time zone,
  "granted_access_epoch" integer default 1 not null,
  "granted_pin_epoch" integer default 1 not null
);

alter table "public"."share_session_grants" owner to postgres;

-- COLUMNS

alter table "public"."project_updates" add column "apply_started_at" timestamp with time zone;

alter table "public"."project_updates" add column "apply_attempt_id" uuid;

alter table "public"."project_updates" add column "apply_failed_at" timestamp with time zone;

alter table "public"."project_updates" add column "apply_error_code" text;

alter table "public"."project_updates" add column "source_share_message_id" uuid;

alter table "public"."projects" add column "priority_source" text default 'unknown'::text not null;

alter table "public"."users" add column "billing_last_state_updated_at" timestamp with time zone;

alter table "public"."users" add column "billing_last_event_created_at" timestamp with time zone;

alter table "public"."users" add column "billing_last_event_id" text;

alter table "public"."users" add column "billing_last_event_type" text;

alter table "public"."users" add column "billing_last_action" text;

alter table "public"."users" add column "successful_extract_count" integer default 0 not null;

alter table "public"."users" add column "last_extract_at" timestamp with time zone;

alter table "public"."users" add column "last_dashboard_seen_at" timestamp with time zone;

-- PRIMARY KEYS

alter table only "public"."analytics_events" add constraint "analytics_events_pkey" PRIMARY KEY (id);

alter table only "public"."authenticated_product_events" add constraint "authenticated_product_events_pkey" PRIMARY KEY (id);

alter table only "public"."billing_checkout_attempts" add constraint "billing_checkout_attempts_pkey" PRIMARY KEY (id);

alter table only "public"."calendar_events" add constraint "calendar_events_pkey" PRIMARY KEY (id);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_admission_attempts_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_reservations_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_limit_buckets_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_pkey" PRIMARY KEY (id);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_pkey" PRIMARY KEY (id);

alter table only "public"."project_import_attempts" add constraint "project_import_attempts_pkey" PRIMARY KEY (id);

alter table only "public"."project_share_links" add constraint "project_share_links_pkey" PRIMARY KEY (id);

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_pkey" PRIMARY KEY (share_link_id);

alter table only "public"."share_browser_sessions" add constraint "share_browser_sessions_pkey" PRIMARY KEY (id);

alter table only "public"."share_link_events" add constraint "share_link_events_pkey" PRIMARY KEY (id);

alter table only "public"."share_link_resources" add constraint "share_link_resources_pkey" PRIMARY KEY (id);

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_pkey" PRIMARY KEY (id);

alter table only "public"."share_link_updates" add constraint "share_link_updates_pkey" PRIMARY KEY (id);

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_pkey" PRIMARY KEY (id);

alter table only "public"."share_messages" add constraint "share_messages_pkey" PRIMARY KEY (id);

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_pkey" PRIMARY KEY (id);

alter table only "public"."share_session_grants" add constraint "share_session_grants_pkey" PRIMARY KEY (id);

-- UNIQUE CONSTRAINTS

alter table only "public"."billing_checkout_attempts" add constraint "billing_checkout_attempts_creem_request_id_unique" UNIQUE (creem_request_id);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_provider_event_id_unique" UNIQUE (provider_event_id);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_admission_attempts_id_input_type_unique" UNIQUE (id, input_type);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_admission_attempts_idempotency_key_unique" UNIQUE (idempotency_key_hash);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_reservations_attempt_unique" UNIQUE (attempt_id);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_reservations_lease_unique" UNIQUE (lease_token_hash);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_claim_token_hash_unique" UNIQUE (claim_token_hash);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_draft_id_unique" UNIQUE (draft_id);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_import_idempotency_key_unique" UNIQUE (import_idempotency_key);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_trial_id_unique" UNIQUE (trial_id);

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_id_kind_unique" UNIQUE (id, window_kind);

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_window_unique" UNIQUE (window_kind, window_start);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_id_trial_id_unique" UNIQUE (id, trial_id);

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_token_hash_unique" UNIQUE (authority_token_hash);

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_limit_buckets_unique" UNIQUE (scope, action, identity_digest, window_start, window_seconds);

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_attempt_scope_unique" UNIQUE (attempt_id, scope);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_id_public_session_unique" UNIQUE (id, public_token_hash, session_token_hash);

alter table only "public"."project_import_attempts" add constraint "project_import_attempts_user_key_unique" UNIQUE (user_id, idempotency_key);

alter table only "public"."project_share_links" add constraint "project_share_links_public_id_unique" UNIQUE (public_id);

alter table only "public"."share_browser_sessions" add constraint "share_browser_sessions_session_digest_unique" UNIQUE (session_digest);

alter table only "public"."share_link_resources" add constraint "share_link_resources_share_link_id_resource_id_unique" UNIQUE (share_link_id, resource_id);

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_share_link_id_subtask_id_unique" UNIQUE (share_link_id, subtask_id);

alter table only "public"."share_link_updates" add constraint "share_link_updates_share_link_id_version_unique" UNIQUE (share_link_id, version);

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_message_id_unique" UNIQUE (message_id);

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_identity_unique" UNIQUE (scope, action, identity_digest, share_link_key, window_start, window_seconds);

-- QUALIFYING UNIQUE INDEXES

CREATE UNIQUE INDEX analytics_events_idempotency_key_unique_idx ON public.analytics_events USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX authenticated_product_events_idempotency_key_unique_idx ON public.authenticated_product_events USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX homepage_demo_admission_attempts_trial_unique_idx ON public.homepage_demo_admission_attempts USING btree (trial_id) WHERE (trial_id IS NOT NULL);

CREATE UNIQUE INDEX homepage_demo_claims_auth_continuation_token_hash_unique_idx ON public.homepage_demo_claims USING btree (auth_continuation_token_hash) WHERE (auth_continuation_token_hash IS NOT NULL);

CREATE UNIQUE INDEX homepage_demo_cost_reservations_attempt_unique_idx ON public.homepage_demo_cost_reservations USING btree (attempt_id) WHERE (attempt_id IS NOT NULL);

CREATE UNIQUE INDEX homepage_demo_drafts_trial_id_unique_idx ON public.homepage_demo_drafts USING btree (trial_id);

CREATE UNIQUE INDEX homepage_demo_duplicate_override_authorities_one_pending_per_cl ON public.homepage_demo_duplicate_override_authorities USING btree (claim_id) WHERE (status = 'pending'::text);

CREATE UNIQUE INDEX homepage_demo_trial_entitlements_active_identity_idx ON public.homepage_demo_trial_entitlements USING btree (scope, identity_digest) WHERE (status = ANY (ARRAY['reserved'::text, 'consumed'::text]));

CREATE UNIQUE INDEX homepage_demo_trials_idempotency_key_hash_unique_idx ON public.homepage_demo_trials USING btree (idempotency_key_hash);

CREATE UNIQUE INDEX homepage_demo_trials_public_token_hash_unique_idx ON public.homepage_demo_trials USING btree (public_token_hash);

CREATE UNIQUE INDEX homepage_demo_trials_session_token_hash_unique_idx ON public.homepage_demo_trials USING btree (session_token_hash);

CREATE UNIQUE INDEX project_updates_source_share_message_id_key ON public.project_updates USING btree (source_share_message_id) WHERE (source_share_message_id IS NOT NULL);

CREATE UNIQUE INDEX share_link_updates_current_version_unique_idx ON public.share_link_updates USING btree (share_link_id) WHERE is_current;

CREATE UNIQUE INDEX share_session_grants_current_unique_idx ON public.share_session_grants USING btree (browser_session_id, share_link_id) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX users_creem_customer_id_unique_idx ON public.users USING btree (btrim(creem_customer_id)) WHERE ((creem_customer_id IS NOT NULL) AND (btrim(creem_customer_id) <> ''::text));

CREATE UNIQUE INDEX users_creem_subscription_id_unique_idx ON public.users USING btree (btrim(creem_subscription_id)) WHERE ((creem_subscription_id IS NOT NULL) AND (btrim(creem_subscription_id) <> ''::text));

-- CHECK CONSTRAINTS

alter table only "public"."analytics_events" add constraint "analytics_events_metadata_object_check" CHECK (jsonb_typeof(metadata) = 'object'::text);

alter table only "public"."authenticated_product_events" add constraint "authenticated_product_events_entity_consistency_check" CHECK (entity_type IS NULL AND entity_id IS NULL OR entity_type = 'calendar_day'::text AND entity_id ~ '^\d{4}-\d{2}-\d{2}$'::text OR (entity_type = ANY (ARRAY['project'::text, 'calendar_event'::text])) AND entity_id IS NOT NULL AND entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text);

alter table only "public"."authenticated_product_events" add constraint "authenticated_product_events_entity_id_length_check" CHECK (entity_id IS NULL OR char_length(entity_id) <= 64);

alter table only "public"."authenticated_product_events" add constraint "authenticated_product_events_entity_type_check" CHECK (entity_type IS NULL OR (entity_type = ANY (ARRAY['project'::text, 'calendar_event'::text, 'calendar_day'::text])));

alter table only "public"."authenticated_product_events" add constraint "authenticated_product_events_route_length_check" CHECK (char_length(route) <= 300);

alter table only "public"."billing_checkout_attempts" add constraint "billing_checkout_attempts_intent_check" CHECK (intent = 'upgrade_pro'::text);

alter table only "public"."billing_checkout_attempts" add constraint "billing_checkout_attempts_status_check" CHECK (status = ANY (ARRAY['creating'::text, 'checkout_created'::text, 'failed'::text, 'expired'::text, 'completed'::text]));

alter table only "public"."calendar_events" add constraint "calendar_events_client_exclusivity_check" CHECK (client_id IS NULL OR custom_client_name IS NULL);

alter table only "public"."calendar_events" add constraint "calendar_events_custom_client_name_check" CHECK (custom_client_name IS NULL OR char_length(TRIM(BOTH FROM custom_client_name)) >= 1 AND char_length(custom_client_name) <= 240);

alter table only "public"."calendar_events" add constraint "calendar_events_custom_project_name_check" CHECK (custom_project_name IS NULL OR char_length(TRIM(BOTH FROM custom_project_name)) >= 1 AND char_length(custom_project_name) <= 240);

alter table only "public"."calendar_events" add constraint "calendar_events_event_time_minute_precision_check" CHECK (event_time IS NULL OR EXTRACT(second FROM event_time) = 0::numeric);

alter table only "public"."calendar_events" add constraint "calendar_events_project_exclusivity_check" CHECK (project_id IS NULL OR custom_project_name IS NULL);

alter table only "public"."calendar_events" add constraint "calendar_events_title_check" CHECK (char_length(TRIM(BOTH FROM title)) >= 1 AND char_length(title) <= 240);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_action_check" CHECK (webhook_action = ANY (ARRAY['ignore'::text, 'sync_checkout'::text, 'sync_subscription'::text, 'grant_pro'::text, 'trial_pro'::text, 'past_due'::text, 'scheduled_cancel'::text, 'downgrade_free'::text, 'refund_downgrade'::text, 'dispute_downgrade'::text, 'pending_review'::text]));

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_amount_paid_check" CHECK (amount_paid IS NULL OR amount_paid >= 0::numeric);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_attempt_count_check" CHECK (attempt_count > 0);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_processing_status_check" CHECK (processing_status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'ignored'::text, 'stale'::text, 'duplicate'::text, 'pending_unmatched'::text, 'pending_conflict'::text, 'pending_review'::text, 'failed_retryable'::text]));

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_refund_amount_check" CHECK (refund_amount IS NULL OR refund_amount >= 0::numeric);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_refunded_amount_check" CHECK (refunded_amount IS NULL OR refunded_amount >= 0::numeric);

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_review_decision_check" CHECK (review_decision IS NULL OR (review_decision = ANY (ARRAY['keep_access'::text, 'revoke_access'::text, 'close_no_action'::text])));

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_cost_units_check" CHECK (estimated_cost_units > 0);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_decision_code_format_check" CHECK (decision_code IS NULL OR char_length(decision_code) >= 1 AND char_length(decision_code) <= 80 AND decision_code ~ '^[a-z0-9_:-]+$'::text);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_decision_state_check" CHECK ((status = ANY (ARRAY['failed'::text, 'blocked'::text, 'rejected'::text])) AND decision_code IS NOT NULL OR (status = ANY (ARRAY['admitted'::text, 'processing'::text, 'review_ready'::text, 'released'::text, 'expired'::text])) AND decision_code IS NULL);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_device_hash_check" CHECK (device_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_idempotency_hash_check" CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_input_type_check" CHECK (input_type = ANY (ARRAY['text'::text, 'image'::text]));

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_ip_digest_check" CHECK (ip_identity_digest ~ '^v[1-9][0-9]*:[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_provider_times_check" CHECK ((provider_call_started_at IS NULL OR provider_call_started_at >= created_at) AND (provider_call_completed_at IS NULL OR provider_call_started_at IS NOT NULL AND provider_call_completed_at >= provider_call_started_at) AND (review_ready_at IS NULL OR provider_call_completed_at IS NOT NULL AND review_ready_at >= provider_call_completed_at));

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_retention_check" CHECK (retention_expires_at > created_at);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_review_ready_at_check" CHECK (status = 'review_ready'::text AND provider_call_started_at IS NOT NULL AND provider_call_completed_at IS NOT NULL AND review_ready_at IS NOT NULL OR status <> 'review_ready'::text AND review_ready_at IS NULL);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_session_hash_check" CHECK (session_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_attempts_status_check" CHECK (status = ANY (ARRAY['admitted'::text, 'processing'::text, 'review_ready'::text, 'failed'::text, 'blocked'::text, 'rejected'::text, 'released'::text, 'expired'::text]));

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_adm_config_attempt_retention_check" CHECK (admission_attempt_retention_seconds >= 3600 AND admission_attempt_retention_seconds <= 604800);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_adm_config_capacity_retention_check" CHECK (capacity_reservation_retention_seconds >= 3600 AND capacity_reservation_retention_seconds <= 604800);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_adm_config_cost_retention_check" CHECK (cost_accounting_retention_seconds >= 86400 AND cost_accounting_retention_seconds <= 2592000);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_adm_config_rate_retention_check" CHECK (rate_bucket_retention_seconds >= 3600 AND rate_bucket_retention_seconds <= 604800);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_adm_config_retention_policy_check" CHECK (capacity_reservation_retention_seconds >= processing_lease_seconds AND capacity_reservation_retention_seconds <= admission_attempt_retention_seconds AND cost_accounting_retention_seconds >= admission_attempt_retention_seconds);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_budget_check" CHECK (hourly_budget_units >= 1 AND hourly_budget_units <= 100000 AND daily_budget_units >= hourly_budget_units AND daily_budget_units <= 1000000);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_concurrency_check" CHECK (global_concurrency_limit >= 1 AND global_concurrency_limit <= 20 AND text_concurrency_limit >= 0 AND text_concurrency_limit <= global_concurrency_limit AND image_concurrency_limit >= 0 AND image_concurrency_limit <= global_concurrency_limit);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_cost_units_check" CHECK (text_cost_units >= 1 AND text_cost_units <= 100 AND image_cost_units >= 1 AND image_cost_units <= 100);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_limits_check" CHECK (session_attempt_limit >= 1 AND session_attempt_limit <= 10000 AND device_attempt_limit >= 1 AND device_attempt_limit <= 10000 AND ip_hour_attempt_limit >= 1 AND ip_hour_attempt_limit <= 10000 AND ip_day_attempt_limit >= ip_hour_attempt_limit AND ip_day_attempt_limit <= 10000 AND challenge_failure_limit >= 1 AND challenge_failure_limit <= 10000);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_singleton_check" CHECK (id = 1);

alter table only "public"."homepage_demo_admission_config" add constraint "homepage_demo_admission_config_timing_check" CHECK (processing_lease_seconds >= 30 AND processing_lease_seconds <= 900 AND trial_ttl_seconds >= 300 AND trial_ttl_seconds <= 3600 AND session_entitlement_seconds >= 300 AND session_entitlement_seconds <= 86400 AND device_entitlement_seconds >= session_entitlement_seconds AND device_entitlement_seconds <= 2592000);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_lease_hash_check" CHECK (lease_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_reserved_units_check" CHECK (reserved_units > 0);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_state_check" CHECK (status = 'active'::text AND released_at IS NULL AND expired_at IS NULL OR status = 'released'::text AND released_at IS NOT NULL AND expired_at IS NULL OR status = 'expired'::text AND released_at IS NULL AND expired_at IS NOT NULL);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_status_check" CHECK (status = ANY (ARRAY['active'::text, 'released'::text, 'expired'::text]));

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_times_check" CHECK (lease_expires_at > created_at AND retention_expires_at > created_at);

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_workload_type_check" CHECK (workload_type = ANY (ARRAY['text'::text, 'image'::text]));

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_auth_continuation_lifecycle_check" CHECK (auth_continuation_token_hash IS NULL AND auth_continuation_started_at IS NULL AND auth_continuation_expires_at IS NULL AND auth_continuation_consumed_at IS NULL OR auth_continuation_token_hash IS NOT NULL AND auth_continuation_started_at IS NOT NULL AND auth_continuation_expires_at IS NOT NULL AND auth_continuation_started_at < expires_at AND auth_continuation_expires_at > auth_continuation_started_at AND (auth_continuation_consumed_at IS NULL OR status = 'claimed'::text AND auth_continuation_consumed_at >= auth_continuation_started_at));

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_auth_continuation_token_hash_check" CHECK (auth_continuation_token_hash IS NULL OR auth_continuation_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_claim_token_hash_format_check" CHECK (claim_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_claimed_at_check" CHECK (claimed_at IS NULL OR claimed_at >= created_at);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_expires_after_created_check" CHECK (expires_at > created_at);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_lifecycle_metadata_check" CHECK (status = 'pending'::text AND claimed_by_user_id IS NULL AND saved_project_id IS NULL AND claimed_at IS NULL OR status = 'claimed'::text AND claimed_at IS NOT NULL OR (status = ANY (ARRAY['expired'::text, 'cancelled'::text])) AND claimed_by_user_id IS NULL AND saved_project_id IS NULL AND claimed_at IS NULL);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_public_token_hash_format_check" CHECK (public_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_session_token_hash_format_check" CHECK (session_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'claimed'::text, 'expired'::text, 'cancelled'::text]));

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_expires_at_check" CHECK (expires_at >= (window_start + window_seconds::double precision * '00:00:01'::interval));

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_units_check" CHECK (reserved_units >= 0 AND spent_units >= 0);

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_window_kind_check" CHECK (window_kind = ANY (ARRAY['hour'::text, 'day'::text]));

alter table only "public"."homepage_demo_cost_buckets" add constraint "homepage_demo_cost_buckets_window_seconds_check" CHECK (window_kind = 'hour'::text AND window_seconds = 3600 OR window_kind = 'day'::text AND window_seconds = 86400);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_day_kind_check" CHECK (day_bucket_kind = 'day'::text);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_hour_kind_check" CHECK (hour_bucket_kind = 'hour'::text);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_retention_check" CHECK (retention_expires_at > created_at);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_state_check" CHECK (status = 'reserved'::text AND finalized_units IS NULL AND finalized_at IS NULL AND released_at IS NULL AND expired_at IS NULL OR status = 'finalized'::text AND finalized_units IS NOT NULL AND finalized_at IS NOT NULL AND released_at IS NULL AND expired_at IS NULL OR status = 'released'::text AND finalized_units IS NULL AND finalized_at IS NULL AND released_at IS NOT NULL AND expired_at IS NULL OR status = 'expired'::text AND finalized_units IS NULL AND finalized_at IS NULL AND released_at IS NULL AND expired_at IS NOT NULL);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_status_check" CHECK (status = ANY (ARRAY['reserved'::text, 'finalized'::text, 'released'::text, 'expired'::text]));

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_units_check" CHECK (reserved_units > 0 AND (finalized_units IS NULL OR finalized_units >= 0 AND finalized_units <= reserved_units));

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_claim_metadata_check" CHECK (status = 'claimed'::text AND claimed_by_user_id IS NOT NULL AND claimed_at IS NOT NULL OR status <> 'claimed'::text AND claimed_by_user_id IS NULL AND claimed_at IS NULL);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_edited_result_object_check" CHECK (edited_result IS NULL OR jsonb_typeof(edited_result) = 'object'::text);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_engine_version_check" CHECK (char_length(btrim(engine_version)) >= 1 AND char_length(btrim(engine_version)) <= 80 AND engine_version ~ '^[A-Za-z0-9_.:-]+$'::text);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_expires_after_created_check" CHECK (expires_at > created_at);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_normalized_result_object_check" CHECK (normalized_result IS NULL OR jsonb_typeof(normalized_result) = 'object'::text);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_ready_result_check" CHECK ((status <> ALL (ARRAY['ready'::text, 'claimed'::text])) OR normalized_result IS NOT NULL);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_schema_version_check" CHECK (char_length(btrim(schema_version)) >= 1 AND char_length(btrim(schema_version)) <= 80 AND schema_version ~ '^[A-Za-z0-9_.:-]+$'::text);

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'ready'::text, 'claimed'::text, 'expired'::text]));

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_consumed_at_check" CHECK (status = 'consumed'::text AND consumed_at IS NOT NULL OR status <> 'consumed'::text AND consumed_at IS NULL);

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_expires_check" CHECK (expires_at > created_at);

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_import_hash_check" CHECK (import_groups_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_request_hash_check" CHECK (request_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'consumed'::text, 'expired'::text, 'cancelled'::text]));

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_token_hash_check" CHECK (authority_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_action_check" CHECK (action = ANY (ARRAY['admission'::text, 'challenge_failure'::text]));

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_admission_check" CHECK (action <> 'admission'::text OR scope = 'session'::text AND window_seconds = 3600 OR scope = 'device'::text AND window_seconds = 86400 OR scope = 'ip'::text AND (window_seconds = ANY (ARRAY[3600, 86400])));

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_challenge_check" CHECK (action <> 'challenge_failure'::text OR scope = 'ip'::text AND window_seconds = 3600);

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_count_check" CHECK (request_count >= 0);

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_expiry_check" CHECK (expires_at >= (window_start + window_seconds::double precision * '00:00:01'::interval));

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_identity_check" CHECK ((scope = ANY (ARRAY['session'::text, 'device'::text])) AND identity_digest ~ '^[0-9a-f]{64}$'::text OR scope = 'ip'::text AND identity_digest ~ '^v[1-9][0-9]*:[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_scope_check" CHECK (scope = ANY (ARRAY['session'::text, 'device'::text, 'ip'::text]));

alter table only "public"."homepage_demo_rate_limit_buckets" add constraint "homepage_demo_rate_buckets_window_seconds_check" CHECK (window_seconds = ANY (ARRAY[3600, 86400]));

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_identity_check" CHECK (identity_digest ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_scope_check" CHECK (scope = ANY (ARRAY['session'::text, 'device'::text]));

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_state_check" CHECK (status = 'reserved'::text AND attempt_id IS NOT NULL AND trial_id IS NULL AND consumed_at IS NULL AND released_at IS NULL OR status = 'consumed'::text AND consumed_at IS NOT NULL AND consumed_at >= reserved_at AND released_at IS NULL OR status = 'released'::text AND trial_id IS NULL AND consumed_at IS NULL AND released_at IS NOT NULL AND released_at >= reserved_at OR status = 'expired'::text AND trial_id IS NULL AND consumed_at IS NULL AND released_at IS NULL);

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_status_check" CHECK (status = ANY (ARRAY['reserved'::text, 'consumed'::text, 'released'::text, 'expired'::text]));

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_times_check" CHECK (reservation_expires_at > reserved_at AND expires_at >= reservation_expires_at AND expires_at > created_at);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_claim_metadata_check" CHECK (status = 'claimed'::text AND claimed_by_user_id IS NOT NULL AND claimed_at IS NOT NULL OR status <> 'claimed'::text AND claimed_by_user_id IS NULL AND claimed_at IS NULL);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_expires_after_created_check" CHECK (expires_at > created_at);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_failure_code_check" CHECK (failure_code IS NULL OR char_length(failure_code) <= 80 AND failure_code ~ '^[a-z0-9_:-]+$'::text AND (status = ANY (ARRAY['failed'::text, 'blocked'::text])));

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_idempotency_key_hash_format_check" CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_input_type_check" CHECK (input_type = ANY (ARRAY['text'::text, 'image'::text]));

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_public_token_hash_format_check" CHECK (public_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_risk_state_check" CHECK (risk_state = ANY (ARRAY['not_evaluated'::text, 'allowed'::text, 'challenge_required'::text, 'blocked'::text]));

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_session_token_hash_format_check" CHECK (session_token_hash ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_status_check" CHECK (status = ANY (ARRAY['created'::text, 'validating'::text, 'queued'::text, 'processing'::text, 'review_ready'::text, 'failed'::text, 'blocked'::text, 'claimed'::text, 'expired'::text]));

alter table only "public"."project_import_attempts" add constraint "project_import_attempts_status_check" CHECK (status = ANY (ARRAY['started'::text, 'committed'::text, 'failed'::text]));

alter table only "public"."project_share_links" add constraint "project_share_links_access_epoch_check" CHECK (access_epoch > 0);

alter table only "public"."project_share_links" add constraint "project_share_links_client_facing_subtitle_check" CHECK (client_facing_subtitle IS NULL OR char_length(btrim(client_facing_subtitle)) >= 1 AND char_length(client_facing_subtitle) <= 200);

alter table only "public"."project_share_links" add constraint "project_share_links_configuration_version_check" CHECK (configuration_version > 0);

alter table only "public"."project_share_links" add constraint "project_share_links_content_direction_check" CHECK (content_direction = ANY (ARRAY['auto'::text, 'ltr'::text, 'rtl'::text]));

alter table only "public"."project_share_links" add constraint "project_share_links_pin_completeness_check" CHECK (pin_hash IS NULL AND pin_salt IS NULL AND pin_hash_version IS NULL AND pin_scrypt_n IS NULL AND pin_scrypt_r IS NULL AND pin_scrypt_p IS NULL AND pin_key_length IS NULL OR pin_hash IS NOT NULL AND pin_salt IS NOT NULL AND pin_hash_version = 1 AND pin_hash ~ '^[A-Za-z0-9_-]+$'::text AND char_length(pin_hash) = 43 AND pin_scrypt_n = 16384 AND pin_scrypt_r = 8 AND pin_scrypt_p = 1 AND pin_key_length = 32);

alter table only "public"."project_share_links" add constraint "project_share_links_pin_encoding_check" CHECK ((pin_hash IS NULL OR char_length(pin_hash) >= 32 AND char_length(pin_hash) <= 512 AND pin_hash ~ '^[A-Za-z0-9_-]+$'::text) AND (pin_salt IS NULL OR char_length(pin_salt) >= 16 AND char_length(pin_salt) <= 128 AND pin_salt ~ '^[A-Za-z0-9_-]+$'::text));

alter table only "public"."project_share_links" add constraint "project_share_links_pin_epoch_check" CHECK (pin_epoch > 0);

alter table only "public"."project_share_links" add constraint "project_share_links_public_id_format_check" CHECK (public_id ~ '^[A-Za-z0-9_-]{16,64}$'::text);

alter table only "public"."project_share_links" add constraint "project_share_links_secret_digest_consistency_check" CHECK (secret_digest IS NULL AND secret_digest_version IS NULL AND (state = 'draft'::text OR state = 'revoked'::text AND activated_at IS NULL) OR secret_digest IS NOT NULL AND secret_digest_version IS NOT NULL AND secret_digest_version > 0);

alter table only "public"."project_share_links" add constraint "project_share_links_secret_digest_format_check" CHECK (secret_digest IS NULL OR secret_digest ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."project_share_links" add constraint "project_share_links_state_check" CHECK (state = ANY (ARRAY['draft'::text, 'active'::text, 'disabled'::text, 'expired'::text, 'revoked'::text]));

alter table only "public"."project_share_links" add constraint "project_share_links_state_lifecycle_check" CHECK (state = 'draft'::text AND activated_at IS NULL AND disabled_at IS NULL AND revoked_at IS NULL OR state = 'active'::text AND activated_at IS NOT NULL AND revoked_at IS NULL OR state = 'disabled'::text AND activated_at IS NOT NULL AND disabled_at IS NOT NULL AND revoked_at IS NULL OR state = 'expired'::text AND activated_at IS NOT NULL AND expires_at IS NOT NULL AND revoked_at IS NULL OR state = 'revoked'::text AND revoked_at IS NOT NULL);

alter table only "public"."project_share_links" add constraint "project_share_links_timestamp_order_check" CHECK ((activated_at IS NULL OR activated_at >= created_at) AND (disabled_at IS NULL OR disabled_at >= created_at) AND (rotated_at IS NULL OR rotated_at >= created_at) AND (revoked_at IS NULL OR revoked_at >= created_at) AND (last_viewed_at IS NULL OR last_viewed_at >= created_at) AND (expires_at IS NULL OR expires_at > created_at));

alter table only "public"."project_share_links" add constraint "project_share_links_view_count_check" CHECK (view_count >= 0);

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_auth_tag_length_check" CHECK (octet_length(auth_tag) = 16);

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_ciphertext_length_check" CHECK (octet_length(ciphertext) = 43);

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_encryption_version_check" CHECK (encryption_version = 1);

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_nonce_length_check" CHECK (octet_length(nonce) = 12);

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_timestamp_order_check" CHECK (updated_at >= created_at);

alter table only "public"."project_update_items" drop constraint "project_update_items_type_check";

alter table only "public"."project_update_items" add constraint "project_update_items_type_check" CHECK (type = ANY (ARRAY['new_subtask'::text, 'update_subtask'::text, 'deadline_change'::text, 'budget_change'::text, 'priority_change'::text, 'status_change'::text, 'client_detail_change'::text, 'project_note'::text, 'client_note'::text, 'duplicate_warning'::text, 'no_action'::text, 'needs_review'::text]));

alter table only "public"."project_updates" add constraint "project_updates_source_provenance_coupling_check" CHECK ((source_type = 'client_share'::text) = (source_share_message_id IS NOT NULL));

alter table only "public"."project_updates" drop constraint "project_updates_source_type_check";

alter table only "public"."project_updates" add constraint "project_updates_source_type_check" CHECK (source_type = ANY (ARRAY['text'::text, 'image'::text, 'email'::text, 'manual'::text, 'client_share'::text]));

alter table only "public"."project_updates" drop constraint "project_updates_status_check";

alter table only "public"."project_updates" add constraint "project_updates_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'analyzed'::text, 'reviewed'::text, 'applying'::text, 'applied'::text, 'ignored'::text, 'failed'::text]));

alter table only "public"."projects" add constraint "projects_priority_source_check" CHECK (priority_source = ANY (ARRAY['ai'::text, 'user'::text, 'storage_default'::text, 'unknown'::text]));

alter table only "public"."share_browser_sessions" add constraint "share_browser_sessions_digest_version_check" CHECK (digest_version > 0);

alter table only "public"."share_browser_sessions" add constraint "share_browser_sessions_lifecycle_check" CHECK (expires_at > created_at AND last_seen_at >= created_at AND (revoked_at IS NULL OR revoked_at >= created_at));

alter table only "public"."share_browser_sessions" add constraint "share_browser_sessions_session_digest_format_check" CHECK (session_digest ~ '^[0-9a-f]{64}$'::text);

alter table only "public"."share_link_events" add constraint "share_link_events_event_type_check" CHECK (event_type = ANY (ARRAY['link_created'::text, 'link_activated'::text, 'link_viewed'::text, 'session_exchanged'::text, 'pin_failed'::text, 'comment_submitted'::text, 'owner_replied'::text, 'link_disabled'::text, 'link_rotated'::text, 'link_expired'::text, 'link_revoked'::text, 'shared_resource_opened'::text, 'rate_limit_triggered'::text]));

alter table only "public"."share_link_events" add constraint "share_link_events_identity_digest_consistency_check" CHECK (identity_digest IS NULL AND identity_digest_version IS NULL OR identity_digest IS NOT NULL AND identity_digest ~ '^[0-9a-f]{64}$'::text AND identity_digest_version IS NOT NULL AND identity_digest_version > 0);

alter table only "public"."share_link_resources" add constraint "share_link_resources_display_order_check" CHECK (display_order >= 0);

alter table only "public"."share_link_resources" add constraint "share_link_resources_public_label_check" CHECK (char_length(btrim(public_label)) >= 1 AND char_length(public_label) <= 120);

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_display_order_check" CHECK (display_order >= 0);

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_public_group_check" CHECK (public_group = ANY (ARRAY['in_progress'::text, 'waiting_for_feedback'::text, 'completed'::text, 'coming_up'::text]));

alter table only "public"."share_link_updates" add constraint "share_link_updates_body_check" CHECK (char_length(btrim(body)) >= 1 AND char_length(body) <= 5000);

alter table only "public"."share_link_updates" add constraint "share_link_updates_published_at_check" CHECK (published_at >= created_at);

alter table only "public"."share_link_updates" add constraint "share_link_updates_version_check" CHECK (version > 0);

alter table only "public"."share_messages" add constraint "share_messages_author_display_name_check" CHECK (author_display_name IS NULL OR char_length(btrim(author_display_name)) >= 1 AND char_length(author_display_name) <= 80);

alter table only "public"."share_messages" add constraint "share_messages_author_type_check" CHECK (author_type = ANY (ARRAY['client'::text, 'owner'::text]));

alter table only "public"."share_messages" add constraint "share_messages_body_check" CHECK (char_length(btrim(body)) >= 1 AND char_length(body) <= 4000);

alter table only "public"."share_messages" add constraint "share_messages_no_self_parent_check" CHECK (parent_id IS NULL OR parent_id <> id);

alter table only "public"."share_messages" add constraint "share_messages_status_check" CHECK (status = ANY (ARRAY['new'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text, 'converted'::text]));

alter table only "public"."share_messages" add constraint "share_messages_status_timestamps_check" CHECK ((reviewed_at IS NULL OR reviewed_at >= created_at) AND (resolved_at IS NULL OR resolved_at >= created_at) AND (status = 'new'::text OR reviewed_at IS NOT NULL) AND (status <> 'resolved'::text OR resolved_at IS NOT NULL));

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_action_check" CHECK (action = ANY (ARRAY['session_exchange'::text, 'pin_verification'::text, 'projection_read'::text, 'comment_submission'::text, 'file_access'::text, 'invalid_link_access'::text]));

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_expiry_check" CHECK (expires_at >= (window_start + window_seconds::double precision * '00:00:01'::interval));

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_identity_digest_check" CHECK (identity_digest ~ '^[0-9a-f]{64}$'::text AND identity_digest_version > 0);

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_invalid_link_action_check" CHECK (action <> 'invalid_link_access'::text OR share_link_id IS NULL);

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_request_count_check" CHECK (request_count >= 0);

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_scope_check" CHECK (scope = ANY (ARRAY['browser_session'::text, 'network_identity'::text, 'share_link'::text]));

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_share_link_scope_check" CHECK (scope <> 'share_link'::text OR share_link_id IS NOT NULL);

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_window_seconds_check" CHECK (window_seconds = ANY (ARRAY[60, 300, 3600, 86400]));

alter table only "public"."share_session_grants" add constraint "share_session_grants_access_epoch_check" CHECK (granted_access_epoch > 0);

alter table only "public"."share_session_grants" add constraint "share_session_grants_configuration_version_check" CHECK (granted_configuration_version > 0);

alter table only "public"."share_session_grants" add constraint "share_session_grants_lifecycle_check" CHECK (expires_at > created_at AND (revoked_at IS NULL OR revoked_at >= created_at) AND (pin_verified_at IS NULL OR pin_verified_at >= created_at));

alter table only "public"."share_session_grants" add constraint "share_session_grants_pin_epoch_check" CHECK (granted_pin_epoch > 0);

-- FOREIGN KEYS

alter table only "public"."analytics_events" add constraint "analytics_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only "public"."authenticated_product_events" add constraint "authenticated_product_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."billing_checkout_attempts" add constraint "billing_checkout_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."calendar_events" add constraint "calendar_events_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table only "public"."calendar_events" add constraint "calendar_events_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table only "public"."calendar_events" add constraint "calendar_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."creem_webhook_events" add constraint "creem_webhook_events_resolved_user_id_fkey" FOREIGN KEY (resolved_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_admission_attempts" add constraint "homepage_demo_admission_attempts_trial_id_fkey" FOREIGN KEY (trial_id) REFERENCES homepage_demo_trials(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_capacity_reservations" add constraint "homepage_demo_capacity_attempt_workload_fk" FOREIGN KEY (attempt_id, workload_type) REFERENCES homepage_demo_admission_attempts(id, input_type) ON DELETE CASCADE;

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_claimed_by_user_id_fkey" FOREIGN KEY (claimed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_draft_trial_fk" FOREIGN KEY (draft_id, trial_id) REFERENCES homepage_demo_drafts(id, trial_id) ON DELETE SET NULL (draft_id);

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_saved_project_id_fkey" FOREIGN KEY (saved_project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_claims" add constraint "homepage_demo_claims_trial_binding_fk" FOREIGN KEY (trial_id, public_token_hash, session_token_hash) REFERENCES homepage_demo_trials(id, public_token_hash, session_token_hash) ON DELETE SET NULL (trial_id);

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES homepage_demo_admission_attempts(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_day_bucket_fk" FOREIGN KEY (day_bucket_id, day_bucket_kind) REFERENCES homepage_demo_cost_buckets(id, window_kind) ON DELETE RESTRICT;

alter table only "public"."homepage_demo_cost_reservations" add constraint "homepage_demo_cost_reservations_hour_bucket_fk" FOREIGN KEY (hour_bucket_id, hour_bucket_kind) REFERENCES homepage_demo_cost_buckets(id, window_kind) ON DELETE RESTRICT;

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_claimed_by_user_id_fkey" FOREIGN KEY (claimed_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."homepage_demo_drafts" add constraint "homepage_demo_drafts_trial_id_fkey" FOREIGN KEY (trial_id) REFERENCES homepage_demo_trials(id) ON DELETE CASCADE;

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_aut_authenticated_user_id_fkey" FOREIGN KEY (authenticated_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."homepage_demo_duplicate_override_authorities" add constraint "homepage_demo_duplicate_override_authorities_claim_id_fkey" FOREIGN KEY (claim_id) REFERENCES homepage_demo_claims(id) ON DELETE CASCADE;

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES homepage_demo_admission_attempts(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_trial_entitlements" add constraint "homepage_demo_trial_entitlements_trial_id_fkey" FOREIGN KEY (trial_id) REFERENCES homepage_demo_trials(id) ON DELETE SET NULL;

alter table only "public"."homepage_demo_trials" add constraint "homepage_demo_trials_claimed_by_user_id_fkey" FOREIGN KEY (claimed_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."project_import_attempts" add constraint "project_import_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."project_share_links" add constraint "project_share_links_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table only "public"."project_share_links" add constraint "project_share_links_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."project_share_secret_material" add constraint "project_share_secret_material_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."project_updates" add constraint "project_updates_source_share_message_id_fkey" FOREIGN KEY (source_share_message_id) REFERENCES share_messages(id) ON DELETE RESTRICT;

alter table only "public"."share_link_events" add constraint "share_link_events_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."share_link_resources" add constraint "share_link_resources_resource_id_fkey" FOREIGN KEY (resource_id) REFERENCES task_resources(id) ON DELETE CASCADE;

alter table only "public"."share_link_resources" add constraint "share_link_resources_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."share_link_resources" add constraint "share_link_resources_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_subtask_id_fkey" FOREIGN KEY (subtask_id) REFERENCES tasks(id) ON DELETE CASCADE;

alter table only "public"."share_link_tasks" add constraint "share_link_tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_link_updates" add constraint "share_link_updates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_link_updates" add constraint "share_link_updates_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."share_link_updates" add constraint "share_link_updates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_converted_by_fkey" FOREIGN KEY (converted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_message_id_fkey" FOREIGN KEY (message_id) REFERENCES share_messages(id) ON DELETE CASCADE;

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_project_update_id_fkey" FOREIGN KEY (project_update_id) REFERENCES project_updates(id) ON DELETE SET NULL;

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_target_task_id_fkey" FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE SET NULL;

alter table only "public"."share_message_conversions" add constraint "share_message_conversions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_messages" add constraint "share_messages_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES share_messages(id) ON DELETE CASCADE;

alter table only "public"."share_messages" add constraint "share_messages_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table only "public"."share_messages" add constraint "share_messages_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."share_messages" add constraint "share_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only "public"."share_rate_limit_buckets" add constraint "share_rate_limit_buckets_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

alter table only "public"."share_session_grants" add constraint "share_session_grants_browser_session_id_fkey" FOREIGN KEY (browser_session_id) REFERENCES share_browser_sessions(id) ON DELETE CASCADE;

alter table only "public"."share_session_grants" add constraint "share_session_grants_share_link_id_fkey" FOREIGN KEY (share_link_id) REFERENCES project_share_links(id) ON DELETE CASCADE;

-- INDEXES

CREATE INDEX analytics_events_anonymous_id_idx ON public.analytics_events USING btree (anonymous_id);

CREATE INDEX analytics_events_country_code_idx ON public.analytics_events USING btree (country_code);

CREATE INDEX analytics_events_event_name_idx ON public.analytics_events USING btree (event_name);

CREATE INDEX analytics_events_occurred_at_idx ON public.analytics_events USING btree (occurred_at DESC);

CREATE INDEX analytics_events_user_id_idx ON public.analytics_events USING btree (user_id);

CREATE INDEX analytics_events_utm_campaign_idx ON public.analytics_events USING btree (utm_campaign);

CREATE INDEX analytics_events_utm_source_idx ON public.analytics_events USING btree (utm_source);

CREATE INDEX authenticated_product_events_event_name_idx ON public.authenticated_product_events USING btree (event_name);

CREATE INDEX authenticated_product_events_user_id_created_at_idx ON public.authenticated_product_events USING btree (user_id, created_at DESC);

CREATE INDEX billing_checkout_attempts_expires_at_idx ON public.billing_checkout_attempts USING btree (expires_at);

CREATE INDEX billing_checkout_attempts_user_intent_status_expires_idx ON public.billing_checkout_attempts USING btree (user_id, intent, status, expires_at DESC);

CREATE INDEX calendar_events_client_id_idx ON public.calendar_events USING btree (client_id) WHERE ((client_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE INDEX calendar_events_project_id_idx ON public.calendar_events USING btree (project_id) WHERE ((project_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE INDEX calendar_events_user_id_event_date_idx ON public.calendar_events USING btree (user_id, event_date) WHERE (deleted_at IS NULL);

CREATE INDEX creem_webhook_events_creem_request_id_idx ON public.creem_webhook_events USING btree (creem_request_id) WHERE (creem_request_id IS NOT NULL);

CREATE INDEX creem_webhook_events_customer_id_idx ON public.creem_webhook_events USING btree (customer_id) WHERE (customer_id IS NOT NULL);

CREATE INDEX creem_webhook_events_status_received_idx ON public.creem_webhook_events USING btree (processing_status, received_at DESC);

CREATE INDEX creem_webhook_events_subscription_id_idx ON public.creem_webhook_events USING btree (subscription_id) WHERE (subscription_id IS NOT NULL);

CREATE INDEX homepage_demo_admission_attempts_device_created_idx ON public.homepage_demo_admission_attempts USING btree (device_token_hash, created_at);

CREATE INDEX homepage_demo_admission_attempts_ip_created_idx ON public.homepage_demo_admission_attempts USING btree (ip_identity_digest, created_at);

CREATE INDEX homepage_demo_admission_attempts_session_created_idx ON public.homepage_demo_admission_attempts USING btree (session_token_hash, created_at);

CREATE INDEX homepage_demo_admission_attempts_status_retention_idx ON public.homepage_demo_admission_attempts USING btree (status, retention_expires_at);

CREATE INDEX homepage_demo_capacity_reservations_active_idx ON public.homepage_demo_capacity_reservations USING btree (status, workload_type, lease_expires_at) WHERE (status = 'active'::text);

CREATE INDEX homepage_demo_capacity_reservations_retention_idx ON public.homepage_demo_capacity_reservations USING btree (retention_expires_at);

CREATE INDEX homepage_demo_claims_claimed_user_idx ON public.homepage_demo_claims USING btree (claimed_by_user_id, claimed_at) WHERE (claimed_by_user_id IS NOT NULL);

CREATE INDEX homepage_demo_claims_pending_auth_continuation_expiry_idx ON public.homepage_demo_claims USING btree (status, auth_continuation_expires_at) WHERE ((auth_continuation_token_hash IS NOT NULL) AND (auth_continuation_consumed_at IS NULL));

CREATE INDEX homepage_demo_claims_saved_project_idx ON public.homepage_demo_claims USING btree (saved_project_id) WHERE (saved_project_id IS NOT NULL);

CREATE INDEX homepage_demo_claims_status_expires_at_idx ON public.homepage_demo_claims USING btree (status, expires_at);

CREATE INDEX homepage_demo_cost_buckets_expires_at_idx ON public.homepage_demo_cost_buckets USING btree (expires_at);

CREATE INDEX homepage_demo_cost_reservations_day_bucket_idx ON public.homepage_demo_cost_reservations USING btree (day_bucket_id, day_bucket_kind);

CREATE INDEX homepage_demo_cost_reservations_hour_bucket_idx ON public.homepage_demo_cost_reservations USING btree (hour_bucket_id, hour_bucket_kind);

CREATE INDEX homepage_demo_cost_reservations_provider_start_idx ON public.homepage_demo_cost_reservations USING btree (provider_call_started_at) WHERE (status = 'reserved'::text);

CREATE INDEX homepage_demo_cost_reservations_status_retention_idx ON public.homepage_demo_cost_reservations USING btree (status, retention_expires_at);

CREATE INDEX homepage_demo_drafts_expires_at_idx ON public.homepage_demo_drafts USING btree (expires_at);

CREATE INDEX homepage_demo_drafts_status_expires_at_idx ON public.homepage_demo_drafts USING btree (status, expires_at);

CREATE INDEX homepage_demo_drafts_status_idx ON public.homepage_demo_drafts USING btree (status);

CREATE INDEX homepage_demo_duplicate_override_authorities_claim_status_expir ON public.homepage_demo_duplicate_override_authorities USING btree (claim_id, status, expires_at);

CREATE INDEX homepage_demo_duplicate_override_authorities_status_expires_at_ ON public.homepage_demo_duplicate_override_authorities USING btree (status, expires_at);

CREATE INDEX homepage_demo_rate_limit_buckets_expires_at_idx ON public.homepage_demo_rate_limit_buckets USING btree (expires_at);

CREATE INDEX homepage_demo_trial_entitlements_status_expires_idx ON public.homepage_demo_trial_entitlements USING btree (status, expires_at);

CREATE INDEX homepage_demo_trials_expires_at_idx ON public.homepage_demo_trials USING btree (expires_at);

CREATE INDEX homepage_demo_trials_status_expires_at_idx ON public.homepage_demo_trials USING btree (status, expires_at);

CREATE INDEX homepage_demo_trials_status_idx ON public.homepage_demo_trials USING btree (status);

CREATE INDEX project_import_attempts_created_at_idx ON public.project_import_attempts USING btree (created_at DESC);

CREATE INDEX project_import_attempts_started_last_seen_idx ON public.project_import_attempts USING btree (last_seen_at) WHERE (status = 'started'::text);

CREATE INDEX project_import_attempts_user_status_idx ON public.project_import_attempts USING btree (user_id, status);

CREATE INDEX project_share_links_expiry_sweep_idx ON public.project_share_links USING btree (expires_at) WHERE ((state = 'active'::text) AND (expires_at IS NOT NULL));

CREATE INDEX project_share_links_user_id_project_id_idx ON public.project_share_links USING btree (user_id, project_id);

CREATE INDEX project_share_links_user_id_state_idx ON public.project_share_links USING btree (user_id, state);

CREATE INDEX projects_user_id_created_at_idx ON public.projects USING btree (user_id, created_at);

CREATE INDEX projects_user_id_deadline_date_idx ON public.projects USING btree (user_id, deadline_date) WHERE (deleted_at IS NULL);

CREATE INDEX share_browser_sessions_expires_at_idx ON public.share_browser_sessions USING btree (expires_at);

CREATE INDEX share_link_events_created_at_idx ON public.share_link_events USING btree (created_at);

CREATE INDEX share_link_events_share_link_id_created_at_idx ON public.share_link_events USING btree (share_link_id, created_at DESC);

CREATE INDEX share_link_resources_resource_id_idx ON public.share_link_resources USING btree (resource_id);

CREATE INDEX share_link_resources_share_link_id_display_order_idx ON public.share_link_resources USING btree (share_link_id, display_order);

CREATE INDEX share_link_tasks_share_link_id_display_order_idx ON public.share_link_tasks USING btree (share_link_id, display_order);

CREATE INDEX share_link_tasks_subtask_id_idx ON public.share_link_tasks USING btree (subtask_id);

CREATE INDEX share_message_conversions_project_update_id_idx ON public.share_message_conversions USING btree (project_update_id) WHERE (project_update_id IS NOT NULL);

CREATE INDEX share_message_conversions_target_task_id_idx ON public.share_message_conversions USING btree (target_task_id) WHERE (target_task_id IS NOT NULL);

CREATE INDEX share_message_conversions_user_id_converted_at_idx ON public.share_message_conversions USING btree (user_id, converted_at DESC);

CREATE INDEX share_messages_parent_id_idx ON public.share_messages USING btree (parent_id) WHERE (parent_id IS NOT NULL);

CREATE INDEX share_messages_share_link_id_created_at_idx ON public.share_messages USING btree (share_link_id, created_at);

CREATE INDEX share_messages_unread_client_idx ON public.share_messages USING btree (user_id, share_link_id) WHERE ((status = 'new'::text) AND (author_type = 'client'::text));

CREATE INDEX share_messages_user_id_project_id_created_at_idx ON public.share_messages USING btree (user_id, project_id, created_at DESC);

CREATE INDEX share_rate_limit_buckets_expires_at_idx ON public.share_rate_limit_buckets USING btree (expires_at);

CREATE INDEX share_rate_limit_buckets_share_link_id_idx ON public.share_rate_limit_buckets USING btree (share_link_id) WHERE (share_link_id IS NOT NULL);

CREATE INDEX share_session_grants_expires_at_idx ON public.share_session_grants USING btree (expires_at);

CREATE INDEX share_session_grants_share_link_id_active_idx ON public.share_session_grants USING btree (share_link_id) WHERE (revoked_at IS NULL);

CREATE INDEX users_created_at_desc_idx ON public.users USING btree (created_at DESC);

CREATE INDEX users_last_dashboard_seen_at_idx ON public.users USING btree (last_dashboard_seen_at DESC NULLS LAST);

CREATE INDEX users_last_extract_at_idx ON public.users USING btree (last_extract_at DESC NULLS LAST);

-- FUNCTIONS

create or replace function public.activate_share_link(
  p_link_id uuid,
  p_secret_digest text,
  p_secret_digest_version smallint,
  p_ciphertext_hex text,
  p_nonce_hex text,
  p_auth_tag_hex text,
  p_encryption_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_link_user_id uuid;
  v_locked_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_public_id text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Input validation before any mutation. No plaintext-secret parameter
  -- exists at all -- only an already-computed digest and already-encrypted
  -- material cross this boundary.
  if p_secret_digest is null or p_secret_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST';
  end if;

  if p_secret_digest_version is null or p_secret_digest_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST_VERSION';
  end if;

  -- A V1 raw share secret is exactly 43 base64url ASCII characters, and
  -- AES-GCM adds no padding, so the ciphertext is always exactly 43
  -- bytes -- 86 lowercase hex characters. This matches
  -- project_share_secret_material_ciphertext_length_check exactly, so a
  -- caller invoking this RPC directly cannot store a shorter, longer, or
  -- differently-encoded ciphertext than the table itself will accept.
  if p_ciphertext_hex is null or p_ciphertext_hex !~ '^[0-9a-f]{86}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CIPHERTEXT';
  end if;

  if p_nonce_hex is null or p_nonce_hex !~ '^[0-9a-f]{24}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_NONCE';
  end if;

  if p_auth_tag_hex is null or p_auth_tag_hex !~ '^[0-9a-f]{32}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_AUTH_TAG';
  end if;

  if p_encryption_version is null or p_encryption_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_ENCRYPTION_VERSION';
  end if;

  -- Race-safe lock order (identical to reenable_share_link below):
  -- 1. Identify the immutable project_id from the owned link (a plain
  --    read; project_id can never change on an existing link, so reading
  --    it before any lock is safe).
  select link.project_id, link.user_id
    into v_project_id, v_link_user_id
    from public.project_share_links as link
    where link.id = p_link_id;

  if v_project_id is null or v_link_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 2. Lock the owning projects row FIRST -- a stable, single lock target
  --    per project, so two concurrent activate/re-enable calls for two
  --    DIFFERENT links of the SAME project serialize here before either
  --    reaches its own link row.
  select project.id, project.deleted_at
    into v_locked_project_id, v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id
    for update;

  if v_locked_project_id is null or v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 3. Only then lock the specific target link row.
  select link.state, link.public_id, link.configuration_version
    into v_link_state, v_link_public_id, v_link_configuration_version
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state <> 'draft' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_DRAFT';
  end if;

  -- 4. With the project lock held, this check is race-safe: no concurrent
  --    activate/re-enable for this project can be mid-flight unobserved.
  if exists (
    select 1
      from public.project_share_links as other_link
      where other_link.project_id = v_project_id
        and other_link.id <> p_link_id
        and other_link.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_ANOTHER_LINK_ACTIVE';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      state = 'active',
      secret_digest = p_secret_digest,
      secret_digest_version = p_secret_digest_version,
      activated_at = v_now,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  insert into public.project_share_secret_material (
    share_link_id,
    ciphertext,
    nonce,
    auth_tag,
    encryption_version
  ) values (
    p_link_id,
    decode(p_ciphertext_hex, 'hex'),
    decode(p_nonce_hex, 'hex'),
    decode(p_auth_tag_hex, 'hex'),
    p_encryption_version
  );

  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_activated');

  return jsonb_build_object(
    'linkId', p_link_id,
    'publicId', v_link_public_id,
    'state', 'active',
    'configurationVersion', v_new_configuration_version,
    'activatedAt', v_now
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.admit_homepage_demo_trial(p_public_token_hash text, p_session_token_hash text, p_device_token_hash text, p_ip_identity_digest text, p_idempotency_key_hash text, p_capacity_lease_token_hash text, p_input_type text)
 RETURNS TABLE(decision text, attempt_id uuid, trial_id uuid, trial_status text, trial_expires_at timestamp with time zone, lease_expires_at timestamp with time zone, idempotent boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_ip_digest_pattern constant text := '^v[1-9][0-9]*:[0-9a-f]{64}$';
  v_now timestamptz := pg_catalog.now();
  v_hour_window timestamptz := pg_catalog.date_trunc('hour', v_now, 'UTC');
  v_day_window timestamptz := pg_catalog.date_trunc('day', v_now, 'UTC');
  v_config public.homepage_demo_admission_config%rowtype;
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_trial_found boolean := false;
  v_existing_lease_expires_at timestamptz;
  v_requested_units integer;
  v_session_count integer;
  v_device_count integer;
  v_ip_hour_count integer;
  v_ip_day_count integer;
  v_rejection_decision text;
  v_rejected_attempt_id uuid;
  v_active_global_units integer;
  v_active_workload_units integer;
  v_hour_bucket_id uuid;
  v_day_bucket_id uuid;
  v_hour_reserved_units integer;
  v_hour_spent_units integer;
  v_day_reserved_units integer;
  v_day_spent_units integer;
  v_trial_id uuid;
  v_trial_status text;
  v_trial_risk_state text;
  v_trial_expires_at timestamptz;
  v_trial_created boolean;
  v_transition_changed boolean;
  v_attempt_id uuid;
  v_lease_expires_at timestamptz;
  v_constraint_name text;
  v_exception_message text;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ v_hash_pattern
    or p_session_token_hash is null
    or p_session_token_hash !~ v_hash_pattern
    or p_device_token_hash is null
    or p_device_token_hash !~ v_hash_pattern
    or p_idempotency_key_hash is null
    or p_idempotency_key_hash !~ v_hash_pattern
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern
    or p_ip_identity_digest is null
    or p_ip_identity_digest !~ v_ip_digest_pattern
    or p_input_type is null
    or p_input_type not in ('text', 'image') then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
  end if;

  select config.*
  into v_config
  from public.homepage_demo_admission_config as config
  where config.id = 1
  for update of config;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING';
  end if;

  if not v_config.admission_enabled then
    return query
      select
        'demo_disabled'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz,
        false;
    return;
  end if;

  if (p_input_type = 'text' and not v_config.text_enabled)
    or (p_input_type = 'image' and not v_config.image_enabled) then
    return query
      select
        'workload_disabled'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz,
        false;
    return;
  end if;

  v_requested_units := case
    when p_input_type = 'text' then v_config.text_cost_units
    else v_config.image_cost_units
  end;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.idempotency_key_hash = p_idempotency_key_hash
  for update of attempt;

  if found then
    if v_attempt.session_token_hash <> p_session_token_hash
      or v_attempt.device_token_hash <> p_device_token_hash
      or v_attempt.ip_identity_digest <> p_ip_identity_digest
      or v_attempt.input_type <> p_input_type then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT';
    end if;

    v_trial_found := false;
    if v_attempt.trial_id is not null then
      select trial.*
      into v_trial
      from public.homepage_demo_trials as trial
      where trial.id = v_attempt.trial_id;

      v_trial_found := found;

      if v_trial_found and v_trial.public_token_hash <> p_public_token_hash then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT';
      end if;
    end if;

    v_existing_lease_expires_at := null;
    select capacity.lease_expires_at
    into v_existing_lease_expires_at
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.attempt_id = v_attempt.id
      and capacity.status = 'active'
    order by capacity.created_at desc
    limit 1;

    if v_attempt.status in ('admitted', 'processing') then
      return query
        select
          'admitted'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          v_existing_lease_expires_at,
          true;
      return;
    end if;

    if v_attempt.status = 'review_ready' then
      return query
        select
          'review_ready'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          null::timestamptz,
          true;
      return;
    end if;

    if v_attempt.status = 'rejected' then
      if v_attempt.decision_code is null
        or v_attempt.decision_code not in (
          'rate_limited',
          'trial_already_used',
          'capacity_unavailable',
          'budget_unavailable'
        ) then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
      end if;

      return query
        select
          v_attempt.decision_code,
          v_attempt.id,
          null::uuid,
          null::text,
          null::timestamptz,
          null::timestamptz,
          true;
      return;
    end if;

    if v_attempt.status = 'failed' then
      return query
        select
          'processing_failed'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          null::timestamptz,
          true;
      return;
    end if;

    if v_attempt.status = 'blocked' then
      return query
        select
          'trial_unavailable'::text,
          v_attempt.id,
          case when v_trial_found then v_trial.id else null::uuid end,
          case when v_trial_found then v_trial.status else null::text end,
          case when v_trial_found then v_trial.expires_at else null::timestamptz end,
          null::timestamptz,
          true;
      return;
    end if;

    return query
      select
        'expired'::text,
        v_attempt.id,
        case when v_trial_found then v_trial.id else null::uuid end,
        case when v_trial_found then v_trial.status else null::text end,
        case when v_trial_found then v_trial.expires_at else null::timestamptz end,
        null::timestamptz,
        true;
    return;
  end if;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'session',
    'admission',
    p_session_token_hash,
    v_hour_window,
    3600,
    1,
    v_hour_window + interval '1 hour' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_session_count;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'device',
    'admission',
    p_device_token_hash,
    v_day_window,
    86400,
    1,
    v_day_window + interval '1 day' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_device_count;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'ip',
    'admission',
    p_ip_identity_digest,
    v_hour_window,
    3600,
    1,
    v_hour_window + interval '1 hour' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_ip_hour_count;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'ip',
    'admission',
    p_ip_identity_digest,
    v_day_window,
    86400,
    1,
    v_day_window + interval '1 day' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_ip_day_count;

  if v_session_count > v_config.session_attempt_limit
    or v_device_count > v_config.device_attempt_limit
    or v_ip_hour_count > v_config.ip_hour_attempt_limit
    or v_ip_day_count > v_config.ip_day_attempt_limit then
    v_rejection_decision := 'rate_limited';
  end if;

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'expired',
    trial_id = null,
    consumed_at = null,
    released_at = null
  where (
      (
        entitlement.scope = 'session'
        and entitlement.identity_digest = p_session_token_hash
      )
      or (
        entitlement.scope = 'device'
        and entitlement.identity_digest = p_device_token_hash
      )
    )
    and entitlement.status = 'reserved'
    and (
      entitlement.reservation_expires_at <= v_now
      or entitlement.expires_at <= v_now
    );

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'expired',
    trial_id = null,
    consumed_at = null,
    released_at = null
  where (
      (
        entitlement.scope = 'session'
        and entitlement.identity_digest = p_session_token_hash
      )
      or (
        entitlement.scope = 'device'
        and entitlement.identity_digest = p_device_token_hash
      )
    )
    and entitlement.status = 'consumed'
    and entitlement.expires_at <= v_now;

  if v_rejection_decision is null then
    perform 1
    from public.homepage_demo_trial_entitlements as entitlement
    where (
        (
          entitlement.scope = 'session'
          and entitlement.identity_digest = p_session_token_hash
        )
        or (
          entitlement.scope = 'device'
          and entitlement.identity_digest = p_device_token_hash
        )
      )
      and entitlement.status in ('reserved', 'consumed')
    order by entitlement.created_at
    limit 1
    for update of entitlement;

    if found then
      v_rejection_decision := 'trial_already_used';
    end if;
  end if;

  if v_rejection_decision is null then
    select coalesce(sum(capacity.reserved_units), 0)::integer
    into v_active_global_units
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.status = 'active'
      and capacity.lease_expires_at > v_now;

    select coalesce(sum(capacity.reserved_units), 0)::integer
    into v_active_workload_units
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.status = 'active'
      and capacity.workload_type = p_input_type
      and capacity.lease_expires_at > v_now;

    if v_active_global_units + 1 > v_config.global_concurrency_limit
      or (
        p_input_type = 'text'
        and v_active_workload_units + 1 > v_config.text_concurrency_limit
      )
      or (
        p_input_type = 'image'
        and v_active_workload_units + 1 > v_config.image_concurrency_limit
      ) then
      v_rejection_decision := 'capacity_unavailable';
    end if;
  end if;

  if v_rejection_decision is null then
    insert into public.homepage_demo_cost_buckets as bucket (
      window_kind,
      window_start,
      window_seconds,
      reserved_units,
      spent_units,
      expires_at
    )
    values (
      'hour',
      v_hour_window,
      3600,
      0,
      0,
      v_hour_window + interval '1 hour' + (v_config.cost_accounting_retention_seconds * interval '1 second')
    )
    on conflict (window_kind, window_start)
    do update set
      expires_at = greatest(bucket.expires_at, excluded.expires_at)
    returning
      bucket.id,
      bucket.reserved_units,
      bucket.spent_units
    into
      v_hour_bucket_id,
      v_hour_reserved_units,
      v_hour_spent_units;

    insert into public.homepage_demo_cost_buckets as bucket (
      window_kind,
      window_start,
      window_seconds,
      reserved_units,
      spent_units,
      expires_at
    )
    values (
      'day',
      v_day_window,
      86400,
      0,
      0,
      v_day_window + interval '1 day' + (v_config.cost_accounting_retention_seconds * interval '1 second')
    )
    on conflict (window_kind, window_start)
    do update set
      expires_at = greatest(bucket.expires_at, excluded.expires_at)
    returning
      bucket.id,
      bucket.reserved_units,
      bucket.spent_units
    into
      v_day_bucket_id,
      v_day_reserved_units,
      v_day_spent_units;

    if v_hour_reserved_units + v_hour_spent_units + v_requested_units > v_config.hourly_budget_units
      or v_day_reserved_units + v_day_spent_units + v_requested_units > v_config.daily_budget_units then
      v_rejection_decision := 'budget_unavailable';
    end if;
  end if;

  if v_rejection_decision is not null then
    insert into public.homepage_demo_admission_attempts (
      idempotency_key_hash,
      trial_id,
      session_token_hash,
      device_token_hash,
      ip_identity_digest,
      input_type,
      status,
      decision_code,
      estimated_cost_units,
      retention_expires_at
    )
    values (
      p_idempotency_key_hash,
      null,
      p_session_token_hash,
      p_device_token_hash,
      p_ip_identity_digest,
      p_input_type,
      'rejected',
      v_rejection_decision,
      v_requested_units,
      v_now + (v_config.admission_attempt_retention_seconds * interval '1 second')
    )
    returning id into v_rejected_attempt_id;

    return query
      select
        v_rejection_decision,
        v_rejected_attempt_id,
        null::uuid,
        null::text,
        null::timestamptz,
        null::timestamptz,
        false;
    return;
  end if;

  v_lease_expires_at := v_now + (v_config.processing_lease_seconds * interval '1 second');

  begin
    select created_trial.trial_id,
      created_trial.status,
      created_trial.risk_state,
      created_trial.expires_at,
      created_trial.created
    into
      v_trial_id,
      v_trial_status,
      v_trial_risk_state,
      v_trial_expires_at,
      v_trial_created
    from public.create_homepage_demo_trial(
      p_public_token_hash,
      p_session_token_hash,
      p_idempotency_key_hash,
      p_input_type,
      v_now + (v_config.trial_ttl_seconds * interval '1 second')
    ) as created_trial;

    if not v_trial_created then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    end if;

    select validating_trial.trial_id,
      validating_trial.status,
      validating_trial.risk_state,
      validating_trial.expires_at,
      validating_trial.changed
    into
      v_trial_id,
      v_trial_status,
      v_trial_risk_state,
      v_trial_expires_at,
      v_transition_changed
    from public.advance_homepage_demo_trial(
      v_trial_id,
      'created',
      'validating',
      'allowed'
    ) as validating_trial;

    if not v_transition_changed then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    end if;

    select queued_trial.trial_id,
      queued_trial.status,
      queued_trial.risk_state,
      queued_trial.expires_at,
      queued_trial.changed
    into
      v_trial_id,
      v_trial_status,
      v_trial_risk_state,
      v_trial_expires_at,
      v_transition_changed
    from public.advance_homepage_demo_trial(
      v_trial_id,
      'validating',
      'queued',
      'allowed'
    ) as queued_trial;

    if not v_transition_changed
      or v_trial_status <> 'queued'
      or v_trial_risk_state <> 'allowed' then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    end if;

    insert into public.homepage_demo_admission_attempts (
      idempotency_key_hash,
      trial_id,
      session_token_hash,
      device_token_hash,
      ip_identity_digest,
      input_type,
      status,
      decision_code,
      estimated_cost_units,
      retention_expires_at
    )
    values (
      p_idempotency_key_hash,
      v_trial_id,
      p_session_token_hash,
      p_device_token_hash,
      p_ip_identity_digest,
      p_input_type,
      'admitted',
      null,
      v_requested_units,
      v_now + (v_config.admission_attempt_retention_seconds * interval '1 second')
    )
    returning id into v_attempt_id;

    insert into public.homepage_demo_trial_entitlements (
      attempt_id,
      trial_id,
      scope,
      identity_digest,
      status,
      reservation_expires_at,
      expires_at
    )
    values
      (
        v_attempt_id,
        null,
        'session',
        p_session_token_hash,
        'reserved',
        v_lease_expires_at,
        v_now + (v_config.session_entitlement_seconds * interval '1 second')
      ),
      (
        v_attempt_id,
        null,
        'device',
        p_device_token_hash,
        'reserved',
        v_lease_expires_at,
        v_now + (v_config.device_entitlement_seconds * interval '1 second')
      );

    insert into public.homepage_demo_capacity_reservations (
      attempt_id,
      workload_type,
      lease_token_hash,
      reserved_units,
      status,
      lease_expires_at,
      retention_expires_at
    )
    values (
      v_attempt_id,
      p_input_type,
      p_capacity_lease_token_hash,
      1,
      'active',
      v_lease_expires_at,
      v_now + (v_config.capacity_reservation_retention_seconds * interval '1 second')
    );

    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units + v_requested_units
    where bucket.id = v_hour_bucket_id
      and bucket.window_kind = 'hour';

    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units + v_requested_units
    where bucket.id = v_day_bucket_id
      and bucket.window_kind = 'day';

    insert into public.homepage_demo_cost_reservations (
      attempt_id,
      hour_bucket_id,
      hour_bucket_kind,
      day_bucket_id,
      day_bucket_kind,
      reserved_units,
      finalized_units,
      status,
      provider_call_started_at,
      finalized_at,
      released_at,
      expired_at,
      retention_expires_at
    )
    values (
      v_attempt_id,
      v_hour_bucket_id,
      'hour',
      v_day_bucket_id,
      'day',
      v_requested_units,
      null,
      'reserved',
      null,
      null,
      null,
      null,
      v_now + (v_config.cost_accounting_retention_seconds * interval '1 second')
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'homepage_demo_capacity_reservations_lease_unique' then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION';
      end if;

      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    when check_violation or foreign_key_violation or not_null_violation then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    when raise_exception then
      get stacked diagnostics v_exception_message = message_text;

      if v_exception_message = 'HOMEPAGE_DEMO_TOKEN_HASH_COLLISION' then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION';
      end if;

      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT';
    when others then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE';
  end;

  return query
    select
      'admitted'::text,
      v_attempt_id,
      v_trial_id,
      v_trial_status,
      v_trial_expires_at,
      v_lease_expires_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING',
      'HOMEPAGE_DEMO_ADMISSION_IDEMPOTENCY_CONFLICT',
      'HOMEPAGE_DEMO_ADMISSION_TOKEN_COLLISION',
      'HOMEPAGE_DEMO_ADMISSION_STATE_CONFLICT',
      'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.advance_homepage_demo_trial(p_trial_id uuid, p_expected_status text, p_next_status text, p_next_risk_state text DEFAULT NULL::text)
 RETURNS TABLE(trial_id uuid, status text, risk_state text, expires_at timestamp with time zone, changed boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_next_risk_state text;
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if not (
    (p_expected_status = 'created' and p_next_status = 'validating')
    or (p_expected_status = 'validating' and p_next_status = 'queued')
    or (p_expected_status = 'queued' and p_next_status = 'processing')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRANSITION';
  end if;

  if p_next_risk_state is not null
    and p_next_risk_state not in (
      'not_evaluated',
      'allowed',
      'challenge_required'
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_RISK_STATE';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRANSITION_CONFLICT';
  end if;

  if v_trial.status not in ('created', 'validating', 'queued') then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TERMINAL_STATE';
  end if;

  if v_trial.risk_state = 'blocked' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_RISK_BLOCKED';
  end if;

  v_next_risk_state := coalesce(p_next_risk_state, v_trial.risk_state);

  if p_next_status = 'processing' and v_next_risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_RISK_NOT_ALLOWED';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = p_next_status,
    risk_state = v_next_risk_state
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_project_bulk_action_transaction(p_action text, p_project_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_project_ids uuid[];
  v_project_id uuid;
  v_owned_project_count integer := 0;
  v_affected_project_ids uuid[] := array[]::uuid[];
  v_affected_task_ids bigint[] := array[]::bigint[];
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_action is null or p_action not in ('archive', 'restore', 'soft_delete') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ACTION';
  end if;

  if p_project_ids is null or cardinality(p_project_ids) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PROJECT_IDS';
  end if;

  if cardinality(p_project_ids) > 100 then
    raise exception using
      errcode = 'P0001',
      message = 'TOO_MANY_PROJECTS';
  end if;

  if exists (
    select 1
    from unnest(p_project_ids) as requested(project_id)
    where requested.project_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PROJECT_IDS';
  end if;

  select array_agg(distinct requested.project_id order by requested.project_id)
  into v_project_ids
  from unnest(p_project_ids) as requested(project_id);

  -- Lock owned project rows in a deterministic order before any mutation.
  for v_project_id in
    select project.id
    from public.projects as project
    where project.id = any(v_project_ids)
      and project.user_id = v_user_id
    order by project.id
    for update of project
  loop
    v_owned_project_count := v_owned_project_count + 1;
  end loop;

  if v_owned_project_count <> cardinality(v_project_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_VALIDATION_FAILED';
  end if;

  with updated_projects as (
    update public.projects as project
    set
      is_archived = case
        when p_action = 'restore' then false
        else true
      end,
      archived_at = case
        when p_action = 'restore' then null
        else v_now
      end,
      deleted_at = case
        when p_action = 'soft_delete' then v_now
        else project.deleted_at
      end
    where project.id = any(v_project_ids)
      and project.user_id = v_user_id
    returning project.id
  )
  select coalesce(
    array_agg(updated_projects.id order by updated_projects.id),
    array[]::uuid[]
  )
  into v_affected_project_ids
  from updated_projects;

  if cardinality(v_affected_project_ids) <> cardinality(v_project_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_FAILED';
  end if;

  with updated_tasks as (
    update public.tasks as task
    set
      is_archived = case
        when p_action = 'restore' then false
        else true
      end,
      archived_at = case
        when p_action = 'restore' then null
        else v_now
      end,
      deleted_at = case
        when p_action = 'soft_delete' then v_now
        else task.deleted_at
      end
    where task.project_id = any(v_project_ids)
      and task.user_id = v_user_id
      and (p_action = 'soft_delete' or task.deleted_at is null)
    returning task.id
  )
  select coalesce(
    array_agg(updated_tasks.id order by updated_tasks.id),
    array[]::bigint[]
  )
  into v_affected_task_ids
  from updated_tasks;

  return jsonb_build_object(
    'action', p_action,
    'affectedProjectIds', to_jsonb(v_affected_project_ids),
    'affectedTaskIds', to_jsonb(v_affected_task_ids)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_project_update_transaction(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_update public.project_updates%rowtype;
  v_final_update public.project_updates%rowtype;
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_item public.project_update_items%rowtype;
  v_event public.project_timeline_events%rowtype;
  v_payload_item jsonb;
  v_edited_item jsonb;
  v_mutation jsonb;
  v_updates jsonb;
  v_project_client_updates jsonb;
  v_client_updates jsonb;
  v_task_client_updates jsonb;
  v_event_payload jsonb;
  v_task_payload jsonb;
  v_accepted_ids uuid[];
  v_rejected_ids uuid[];
  v_all_ids uuid[];
  v_item_id uuid;
  v_task_id bigint;
  v_next_subtask_order integer;
  v_expected_count integer := 0;
  v_affected_count integer := 0;
  v_created_timeline_events jsonb := '[]'::jsonb;
  v_applied_items jsonb := '[]'::jsonb;
  v_rejected_items jsonb := '[]'::jsonb;
  v_has_priority_change boolean := false;
  v_event_new_value jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_update_id is null or p_apply_attempt_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_APPLY_ATTEMPT';
  end if;

  if p_edited_items is null or jsonb_typeof(p_edited_items) <> 'array'
    or p_apply_payload is null or jsonb_typeof(p_apply_payload) <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_APPLY_PAYLOAD';
  end if;

  select coalesce(
    array_agg(distinct requested.item_id order by requested.item_id),
    array[]::uuid[]
  )
  into v_accepted_ids
  from unnest(coalesce(p_accepted_item_ids, array[]::uuid[]))
    as requested(item_id)
  where requested.item_id is not null;

  select coalesce(
    array_agg(distinct requested.item_id order by requested.item_id),
    array[]::uuid[]
  )
  into v_rejected_ids
  from unnest(coalesce(p_rejected_item_ids, array[]::uuid[]))
    as requested(item_id)
  where requested.item_id is not null;

  if cardinality(v_accepted_ids) + cardinality(v_rejected_ids) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEM_SELECTION';
  end if;

  if cardinality(v_accepted_ids) + cardinality(v_rejected_ids) > 500 then
    raise exception using
      errcode = 'P0001',
      message = 'TOO_MANY_UPDATE_ITEMS';
  end if;

  if exists (
    select 1
    from unnest(v_accepted_ids) as accepted(item_id)
    where accepted.item_id = any(v_rejected_ids)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_SELECTION_CONFLICT';
  end if;

  select array_agg(selected.item_id order by selected.item_id)
  into v_all_ids
  from (
    select unnest(v_accepted_ids) as item_id
    union all
    select unnest(v_rejected_ids) as item_id
  ) as selected;

  select update_row.*
  into v_update
  from public.project_updates as update_row
  where update_row.id = p_update_id
    and update_row.user_id = v_user_id
  for update of update_row;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_NOT_FOUND';
  end if;

  if v_update.status <> 'applying'
    or v_update.apply_attempt_id is distinct from p_apply_attempt_id then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_ATTEMPT_MISMATCH';
  end if;

  select project.*
  into v_project
  from public.projects as project
  where project.id = v_update.project_id
    and project.user_id = v_user_id
    and project.deleted_at is null
  for update of project;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project.client_id is not null then
    select client.*
    into v_client
    from public.clients as client
    where client.id = v_project.client_id
      and client.user_id = v_user_id
    for update of client;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'CLIENT_NOT_FOUND';
    end if;
  end if;

  -- Stabilize task targets and subtask ordering before any mutation.
  for v_task_id in
    select task.id
    from public.tasks as task
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null
    order by task.id
    for update of task
  loop
    null;
  end loop;

  v_expected_count := 0;

  for v_item_id in
    select item.id
    from public.project_update_items as item
    where item.id = any(v_all_ids)
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected')
    order by item.id
    for update of item
  loop
    v_expected_count := v_expected_count + 1;
  end loop;

  if v_expected_count <> cardinality(v_all_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_VALIDATION_FAILED';
  end if;

  if jsonb_array_length(p_apply_payload) <> cardinality(v_accepted_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_PAYLOAD_ITEM_MISMATCH';
  end if;

  select count(distinct (payload.value->>'itemId')::uuid)::integer
  into v_expected_count
  from jsonb_array_elements(p_apply_payload) as payload(value)
  where jsonb_typeof(payload.value) = 'object'
    and payload.value ? 'itemId'
    and (payload.value->>'itemId')::uuid = any(v_accepted_ids);

  if v_expected_count <> cardinality(v_accepted_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLY_PAYLOAD_ITEM_MISMATCH';
  end if;

  if jsonb_array_length(p_edited_items) > cardinality(v_accepted_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_EDITED_ITEMS';
  end if;

  if exists (
    select 1
    from public.project_timeline_events as event
    where event.source_update_id = v_update.id
      and event.source_item_id = any(v_accepted_ids)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'TIMELINE_EVENT_ALREADY_EXISTS';
  end if;

  for v_edited_item in
    select edited.value
    from jsonb_array_elements(p_edited_items) as edited(value)
  loop
    if jsonb_typeof(v_edited_item) <> 'object'
      or not (v_edited_item ? 'itemId')
      or not (v_edited_item ? 'newValue')
      or jsonb_typeof(v_edited_item->'newValue') <> 'object' then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_EDITED_ITEMS';
    end if;

    v_item_id := (v_edited_item->>'itemId')::uuid;

    if not (v_item_id = any(v_accepted_ids)) then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_EDITED_ITEMS';
    end if;

    update public.project_update_items as item
    set new_value = v_edited_item->'newValue'
    where item.id = v_item_id
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected');

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'EDITED_ITEM_UPDATE_FAILED';
    end if;
  end loop;

  for v_payload_item in
    select payload.value
    from jsonb_array_elements(p_apply_payload) with ordinality
      as payload(value, item_order)
    order by payload.item_order
  loop
    if jsonb_typeof(v_payload_item) <> 'object'
      or not (v_payload_item ? 'itemId')
      or not (v_payload_item ? 'itemType')
      or jsonb_typeof(v_payload_item->'mutation') <> 'object'
      or jsonb_typeof(v_payload_item->'event') <> 'object' then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_APPLY_PAYLOAD';
    end if;

    v_item_id := (v_payload_item->>'itemId')::uuid;

    select item.*
    into v_item
    from public.project_update_items as item
    where item.id = v_item_id
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected')
    for update of item;

    if not found
      or not (v_item.id = any(v_accepted_ids))
      or v_item.type is distinct from v_payload_item->>'itemType'
      or coalesce(v_item.new_value, 'null'::jsonb)
        is distinct from coalesce(v_payload_item->'newValue', 'null'::jsonb) then
      raise exception using
        errcode = 'P0001',
        message = 'APPLY_PAYLOAD_ITEM_MISMATCH';
    end if;

    if v_item.target_task_id is not null
      and not exists (
        select 1
        from public.tasks as task
        where task.id = v_item.target_task_id
          and task.project_id = v_project.id
          and task.user_id = v_user_id
          and task.deleted_at is null
      ) then
      raise exception using
        errcode = 'P0001',
        message = 'TARGET_TASK_VALIDATION_FAILED';
    end if;

    v_mutation := v_payload_item->'mutation';
    v_event_payload := v_payload_item->'event';
    v_task_id := null;
    v_event_new_value := v_item.new_value;
    v_project_client_updates := '{}'::jsonb;
    v_client_updates := '{}'::jsonb;
    v_task_client_updates := '{}'::jsonb;

    if v_item.type = 'new_subtask' then
      if v_mutation->>'kind' is distinct from 'new_subtask'
        or jsonb_typeof(v_mutation->'task') <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_NEW_SUBTASK_PAYLOAD';
      end if;

      v_task_payload := v_mutation->'task';

      if nullif(btrim(v_task_payload->>'task_title'), '') is null
        or (
          v_task_payload - array[
            'client_name',
            'contact_name',
            'task_title',
            'amount',
            'amount_value',
            'currency_code',
            'deadline_text',
            'deadline_date',
            'priority',
            'status'
          ]
        ) <> '{}'::jsonb then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_NEW_SUBTASK_PAYLOAD';
      end if;

      select coalesce(max(task.subtask_order), 0) + 1
      into v_next_subtask_order
      from public.tasks as task
      where task.project_id = v_project.id
        and task.user_id = v_user_id
        and task.deleted_at is null;

      insert into public.tasks (
        user_id,
        client_name,
        contact_name,
        client_id,
        project_id,
        subtask_order,
        task_title,
        amount,
        amount_value,
        currency_code,
        deadline_text,
        deadline_date,
        priority,
        status,
        source,
        raw_input,
        is_archived,
        archived_at,
        completed_at,
        deleted_at,
        updated_at
      )
      values (
        v_user_id,
        v_task_payload->>'client_name',
        nullif(v_task_payload->>'contact_name', ''),
        v_project.client_id,
        v_project.id,
        v_next_subtask_order,
        v_task_payload->>'task_title',
        nullif(v_task_payload->>'amount', ''),
        nullif(v_task_payload->>'amount_value', '')::numeric,
        nullif(v_task_payload->>'currency_code', ''),
        nullif(v_task_payload->>'deadline_text', ''),
        nullif(v_task_payload->>'deadline_date', '')::date,
        coalesce(nullif(v_task_payload->>'priority', ''), 'Medium'),
        coalesce(nullif(v_task_payload->>'status', ''), 'New'),
        'client_update',
        v_update.raw_input,
        false,
        null,
        case
          when lower(btrim(coalesce(v_task_payload->>'status', ''))) = 'done'
            then v_now
          else null
        end,
        null,
        v_now
      )
      returning id into v_task_id;

      v_event_new_value := jsonb_build_object(
        'task_id', v_task_id,
        'task_title', v_task_payload->>'task_title',
        'subtask_order', v_next_subtask_order
      );
    elsif v_item.type = 'update_subtask' then
      if v_mutation->>'kind' is distinct from 'update_subtask'
        or jsonb_typeof(v_mutation->'updates') <> 'object'
        or (v_mutation->>'taskId')::bigint is distinct from v_item.target_task_id then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_SUBTASK_UPDATE_PAYLOAD';
      end if;

      v_updates := v_mutation->'updates';

      if v_updates = '{}'::jsonb
        or (
          v_updates - array[
            'task_title',
            'amount',
            'amount_value',
            'currency_code',
            'deadline_text',
            'deadline_date',
            'priority',
            'status'
          ]
        ) <> '{}'::jsonb then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_SUBTASK_UPDATE_PAYLOAD';
      end if;

      update public.tasks as task
      set
        task_title = case when v_updates ? 'task_title'
          then v_updates->>'task_title' else task.task_title end,
        amount = case when v_updates ? 'amount'
          then v_updates->>'amount' else task.amount end,
        amount_value = case when v_updates ? 'amount_value'
          then nullif(v_updates->>'amount_value', '')::numeric else task.amount_value end,
        currency_code = case when v_updates ? 'currency_code'
          then v_updates->>'currency_code' else task.currency_code end,
        deadline_text = case when v_updates ? 'deadline_text'
          then v_updates->>'deadline_text' else task.deadline_text end,
        deadline_date = case when v_updates ? 'deadline_date'
          then nullif(v_updates->>'deadline_date', '')::date else task.deadline_date end,
        priority = case when v_updates ? 'priority'
          then v_updates->>'priority' else task.priority end,
        status = case when v_updates ? 'status'
          then v_updates->>'status' else task.status end,
        completed_at = case
          when v_updates ? 'status' then
            case
              when lower(btrim(coalesce(v_updates->>'status', ''))) = 'done'
                then v_now
              else null
            end
          else task.completed_at
        end,
        updated_at = v_now
      where task.id = v_item.target_task_id
        and task.project_id = v_project.id
        and task.user_id = v_user_id
        and task.deleted_at is null
      returning task.id into v_task_id;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'SUBTASK_UPDATE_FAILED';
      end if;
    elsif v_item.type in (
      'deadline_change',
      'budget_change',
      'priority_change',
      'status_change'
    ) then
      if v_mutation->>'kind' is distinct from 'project_field'
        or jsonb_typeof(v_mutation->'updates') <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_PROJECT_UPDATE_PAYLOAD';
      end if;

      v_updates := v_mutation->'updates';

      if v_updates = '{}'::jsonb
        or (
          v_item.type = 'deadline_change'
          and (v_updates - array['deadline_text', 'deadline_date']) <> '{}'::jsonb
        )
        or (
          v_item.type = 'budget_change'
          and (v_updates - array['amount', 'amount_value', 'currency_code']) <> '{}'::jsonb
        )
        or (
          v_item.type = 'priority_change'
          and (
            (v_updates - array['priority']) <> '{}'::jsonb
            or coalesce(v_updates->>'priority', '') not in (
              'Low',
              'Medium',
              'High'
            )
          )
        )
        or (
          v_item.type = 'status_change'
          and (v_updates - array['status']) <> '{}'::jsonb
        ) then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_PROJECT_UPDATE_PAYLOAD';
      end if;

      update public.projects as project
      set
        deadline_text = case when v_updates ? 'deadline_text'
          then v_updates->>'deadline_text' else project.deadline_text end,
        deadline_date = case when v_updates ? 'deadline_date'
          then nullif(v_updates->>'deadline_date', '')::date else project.deadline_date end,
        amount = case when v_updates ? 'amount'
          then v_updates->>'amount' else project.amount end,
        amount_value = case when v_updates ? 'amount_value'
          then nullif(v_updates->>'amount_value', '')::numeric else project.amount_value end,
        currency_code = case when v_updates ? 'currency_code'
          then v_updates->>'currency_code' else project.currency_code end,
        priority = case when v_updates ? 'priority'
          then v_updates->>'priority' else project.priority end,
        status = case when v_updates ? 'status'
          then v_updates->>'status' else project.status end,
        updated_at = v_now
      where project.id = v_project.id
        and project.user_id = v_user_id
        and project.deleted_at is null;

      get diagnostics v_affected_count = row_count;

      if v_affected_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_FAILED';
      end if;

      if v_item.type = 'priority_change' then
        v_has_priority_change := true;
      end if;
    elsif v_item.type = 'client_detail_change' then
      v_project_client_updates := coalesce(v_mutation #> '{projectUpdates}', '{}'::jsonb);
      v_client_updates := coalesce(v_mutation #> '{clientUpdates}', '{}'::jsonb);
      v_task_client_updates := coalesce(v_mutation #> '{taskUpdates}', '{}'::jsonb);

      if v_mutation->>'kind' is distinct from 'client_detail'
        or jsonb_typeof(v_project_client_updates) <> 'object'
        or jsonb_typeof(v_client_updates) <> 'object'
        or jsonb_typeof(v_task_client_updates) <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_CLIENT_UPDATE_PAYLOAD';
      end if;

      if (
          v_project_client_updates - array['client_name', 'contact_name']
        ) <> '{}'::jsonb
        or (
          v_client_updates - array[
            'name',
            'contact_name',
            'phone',
            'email',
            'notes'
          ]
        ) <> '{}'::jsonb
        or (
          v_task_client_updates - array['client_name', 'contact_name']
        ) <> '{}'::jsonb then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_CLIENT_UPDATE_PAYLOAD';
      end if;

      if v_project_client_updates <> '{}'::jsonb then
        v_updates := v_project_client_updates;

        update public.projects as project
        set
          client_name = case when v_updates ? 'client_name'
            then v_updates->>'client_name' else project.client_name end,
          contact_name = case when v_updates ? 'contact_name'
            then v_updates->>'contact_name' else project.contact_name end,
          updated_at = v_now
        where project.id = v_project.id
          and project.user_id = v_user_id
          and project.deleted_at is null;

        get diagnostics v_affected_count = row_count;

        if v_affected_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'PROJECT_CLIENT_UPDATE_FAILED';
        end if;
      end if;

      if v_project.client_id is not null
        and v_client_updates <> '{}'::jsonb then
        v_updates := v_client_updates;

        update public.clients as client
        set
          name = case when v_updates ? 'name'
            then v_updates->>'name' else client.name end,
          contact_name = case when v_updates ? 'contact_name'
            then v_updates->>'contact_name' else client.contact_name end,
          phone = case when v_updates ? 'phone'
            then v_updates->>'phone' else client.phone end,
          email = case when v_updates ? 'email'
            then v_updates->>'email' else client.email end,
          notes = case when v_updates ? 'notes'
            then v_updates->>'notes' else client.notes end
        where client.id = v_project.client_id
          and client.user_id = v_user_id;

        get diagnostics v_affected_count = row_count;

        if v_affected_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'CLIENT_UPDATE_FAILED';
        end if;
      end if;

      if v_task_client_updates <> '{}'::jsonb then
        v_updates := v_task_client_updates;

        select count(*)::integer
        into v_expected_count
        from public.tasks as task
        where task.project_id = v_project.id
          and task.user_id = v_user_id
          and task.deleted_at is null;

        update public.tasks as task
        set
          client_name = case when v_updates ? 'client_name'
            then v_updates->>'client_name' else task.client_name end,
          contact_name = case when v_updates ? 'contact_name'
            then v_updates->>'contact_name' else task.contact_name end,
          updated_at = v_now
        where task.project_id = v_project.id
          and task.user_id = v_user_id
          and task.deleted_at is null;

        get diagnostics v_affected_count = row_count;

        if v_affected_count <> v_expected_count then
          raise exception using
            errcode = 'P0001',
            message = 'TASK_CLIENT_SYNC_FAILED';
        end if;
      end if;
    elsif v_item.type in (
      'project_note',
      'client_note',
      'duplicate_warning',
      'no_action'
    ) then
      if v_mutation->>'kind' is distinct from 'timeline_only' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_TIMELINE_ONLY_PAYLOAD';
      end if;
    else
      raise exception using
        errcode = 'P0001',
        message = 'UNSUPPORTED_UPDATE_ITEM';
    end if;

    insert into public.project_timeline_events (
      user_id,
      project_id,
      event_type,
      event_title,
      event_summary,
      source_update_id,
      source_item_id,
      target_task_id,
      target_field,
      old_value,
      new_value,
      actor_user_id,
      metadata,
      created_at
    )
    values (
      v_user_id,
      v_project.id,
      v_event_payload->>'eventType',
      v_event_payload->>'title',
      nullif(v_event_payload->>'summary', ''),
      v_update.id,
      v_item.id,
      case
        when v_item.type in ('new_subtask', 'update_subtask') then v_task_id
        when v_item.type in (
          'project_note',
          'client_note',
          'duplicate_warning',
          'no_action'
        ) then v_item.target_task_id
        else null
      end,
      nullif(v_event_payload->>'targetField', ''),
      v_item.old_value,
      v_event_new_value,
      v_user_id,
      case
        when v_event_payload ? 'metadata'
          and jsonb_typeof(v_event_payload->'metadata') = 'object'
        then v_event_payload->'metadata'
        else null
      end,
      v_now
    )
    returning * into v_event;

    v_created_timeline_events :=
      v_created_timeline_events || jsonb_build_array(to_jsonb(v_event));
  end loop;

  if cardinality(v_accepted_ids) > 0 then
    update public.project_update_items as item
    set
      status = 'applied',
      accepted_at = v_now,
      applied_at = v_now,
      accepted_by = v_user_id,
      applied_by = v_user_id
    where item.id = any(v_accepted_ids)
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected');

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> cardinality(v_accepted_ids) then
      raise exception using
        errcode = 'P0001',
        message = 'MARK_APPLIED_ITEMS_FAILED';
    end if;
  end if;

  if cardinality(v_rejected_ids) > 0 then
    update public.project_update_items as item
    set
      status = 'rejected',
      rejected_at = v_now,
      rejected_by = v_user_id
    where item.id = any(v_rejected_ids)
      and item.project_update_id = v_update.id
      and item.project_id = v_project.id
      and item.user_id = v_user_id
      and item.status in ('suggested', 'accepted', 'rejected');

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> cardinality(v_rejected_ids) then
      raise exception using
        errcode = 'P0001',
        message = 'MARK_REJECTED_ITEMS_FAILED';
    end if;
  end if;

  if v_update.source_share_message_id is not null then
    perform set_config(
      'text2task.client_share_apply_update_id',
      p_update_id::text,
      true
    );
  end if;

  update public.project_updates as update_row
  set
    status = 'applied',
    reviewed_by = v_user_id,
    applied_by = v_user_id,
    reviewed_at = v_now,
    applied_at = v_now,
    apply_failed_at = null,
    apply_error_code = null
  where update_row.id = v_update.id
    and update_row.user_id = v_user_id
    and update_row.status = 'applying'
    and update_row.apply_attempt_id = p_apply_attempt_id
  returning update_row.* into v_final_update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MARK_UPDATE_APPLIED_FAILED';
  end if;

  if v_has_priority_change then
    update public.projects as project
    set
      priority_source = 'user',
      updated_at = v_now
    where project.id = v_project.id
      and project.user_id = v_user_id
      and project.deleted_at is null;

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'PROJECT_PRIORITY_PROVENANCE_UPDATE_FAILED';
    end if;
  end if;

  -- Reconcile project completion in the same transaction as every task
  -- mutation above: a Project Update that finishes the last remaining
  -- active subtask (via new_subtask or update_subtask items) now completes
  -- the parent project exactly like the direct-edit and bulk-status paths.
  if cardinality(v_accepted_ids) > 0 then
    perform public.reconcile_project_completion(v_project.id, v_user_id, v_now);
  end if;

  if cardinality(v_accepted_ids) > 0 then
    select coalesce(
      jsonb_agg(to_jsonb(item) order by item.created_at, item.id),
      '[]'::jsonb
    )
    into v_applied_items
    from public.project_update_items as item
    where item.id = any(v_accepted_ids)
      and item.project_update_id = v_update.id
      and item.user_id = v_user_id;
  end if;

  if cardinality(v_rejected_ids) > 0 then
    select coalesce(
      jsonb_agg(to_jsonb(item) order by item.created_at, item.id),
      '[]'::jsonb
    )
    into v_rejected_items
    from public.project_update_items as item
    where item.id = any(v_rejected_ids)
      and item.project_update_id = v_update.id
      and item.user_id = v_user_id;
  end if;

  if v_update.source_share_message_id is not null then
    perform public.finalize_share_message_conversion(
      v_update.source_share_message_id,
      p_update_id
    );
  end if;

  return jsonb_build_object(
    'update', to_jsonb(v_final_update),
    'appliedItems', v_applied_items,
    'rejectedItems', v_rejected_items,
    'timelineEvents', v_created_timeline_events
  );
end;
$function$;

create or replace function public.apply_task_bulk_status_transaction(
  p_task_ids bigint[],
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_task_ids bigint[];
  v_task_id bigint;
  v_requested_task_count integer := 0;
  v_locked_task_count integer := 0;
  v_project_ids uuid[] := array[]::uuid[];
  v_locked_project_ids uuid[] := array[]::uuid[];
  v_project_id uuid;
  v_affected_task_ids bigint[] := array[]::bigint[];
  v_completed_project_ids uuid[] := array[]::uuid[];
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_status is null or p_status not in ('Done', 'In Progress') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_STATUS';
  end if;

  if p_task_ids is null or cardinality(p_task_ids) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_TASK_IDS';
  end if;

  if cardinality(p_task_ids) > 500 then
    raise exception using
      errcode = 'P0001',
      message = 'TOO_MANY_TASKS';
  end if;

  if exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    where requested.task_id is null
      or requested.task_id <= 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_TASK_IDS';
  end if;

  select array_agg(distinct requested.task_id order by requested.task_id)
  into v_task_ids
  from unnest(p_task_ids) as requested(task_id);

  -- Prevalidate ownership before taking project locks. The selected task rows
  -- are locked and revalidated again before any mutation.
  select
    count(*)::integer,
    coalesce(
      array_agg(distinct task.project_id order by task.project_id)
        filter (where task.project_id is not null),
      array[]::uuid[]
    )
  into v_requested_task_count, v_project_ids
  from public.tasks as task
  where task.id = any(v_task_ids)
    and task.user_id = v_user_id
    and task.deleted_at is null;

  if v_requested_task_count <> cardinality(v_task_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_VALIDATION_FAILED';
  end if;

  -- Match the project-first lock order used by transactional project actions.
  -- Deleted or otherwise unavailable projects are intentionally skipped,
  -- preserving the existing task-update behavior.
  for v_project_id in
    select project.id
    from public.projects as project
    where project.id = any(v_project_ids)
      and project.user_id = v_user_id
      and project.deleted_at is null
    order by project.id
    for update of project
  loop
    null;
  end loop;

  -- Stabilize active task state for project completion calculation before
  -- locking any remaining selected standalone or archived tasks.
  if cardinality(v_project_ids) > 0 then
    for v_task_id in
      select task.id
      from public.tasks as task
      where task.project_id = any(v_project_ids)
        and task.user_id = v_user_id
        and (task.is_archived = false or task.is_archived is null)
        and task.deleted_at is null
      order by task.id
      for update of task
    loop
      null;
    end loop;
  end if;

  -- Lock every selected task in deterministic order and revalidate that all
  -- requested targets are still owned and available before mutation.
  for v_task_id in
    select task.id
    from public.tasks as task
    where task.id = any(v_task_ids)
      and task.user_id = v_user_id
      and task.deleted_at is null
    order by task.id
    for update of task
  loop
    v_locked_task_count := v_locked_task_count + 1;
  end loop;

  if v_locked_task_count <> cardinality(v_task_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_VALIDATION_FAILED';
  end if;

  select coalesce(
    array_agg(distinct task.project_id order by task.project_id)
      filter (where task.project_id is not null),
    array[]::uuid[]
  )
  into v_locked_project_ids
  from public.tasks as task
  where task.id = any(v_task_ids)
    and task.user_id = v_user_id
    and task.deleted_at is null;

  if v_locked_project_ids is distinct from v_project_ids then
    raise exception using
      errcode = 'P0001',
      message = 'CONCURRENT_MODIFICATION';
  end if;

  with updated_tasks as (
    update public.tasks as task
    set
      status = p_status,
      updated_at = v_now,
      completed_at = case
        when p_status = 'Done' and task.completed_at is null then v_now
        else task.completed_at
      end
    where task.id = any(v_task_ids)
      and task.user_id = v_user_id
      and task.deleted_at is null
    returning task.id
  )
  select coalesce(
    array_agg(updated_tasks.id order by updated_tasks.id),
    array[]::bigint[]
  )
  into v_affected_task_ids
  from updated_tasks;

  if cardinality(v_affected_task_ids) <> cardinality(v_task_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'TASK_UPDATE_FAILED';
  end if;

  if p_status = 'Done' and cardinality(v_project_ids) > 0 then
    foreach v_project_id in array v_project_ids
    loop
      if public.reconcile_project_completion(v_project_id, v_user_id, v_now) then
        v_completed_project_ids := v_completed_project_ids || v_project_id;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'status', p_status,
    'affectedTaskIds', to_jsonb(v_affected_task_ids),
    'affectedProjectIds', to_jsonb(v_project_ids),
    'completedProjectIds', to_jsonb(v_completed_project_ids)
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.block_homepage_demo_trial(p_trial_id uuid, p_expected_status text, p_block_code text)
 RETURNS TABLE(trial_id uuid, status text, risk_state text, expires_at timestamp with time zone, changed boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_block_code text := btrim(coalesce(p_block_code, ''));
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if p_expected_status not in ('created', 'validating') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS';
  end if;

  if char_length(v_block_code) = 0
    or char_length(v_block_code) > 80
    or v_block_code !~ '^[a-z0-9_:-]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_BLOCK_CODE';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.status = 'blocked' then
    if v_trial.risk_state = 'blocked'
      and v_trial.failure_code = v_block_code then
      return query
        select
          v_trial.id,
          v_trial.status,
          v_trial.risk_state,
          v_trial.expires_at,
          false;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_BLOCK_CONFLICT';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_BLOCK_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'blocked',
    risk_state = 'blocked',
    failure_code = v_block_code
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_billing_checkout_attempt(p_user_id uuid, p_intent text, p_ttl_seconds integer DEFAULT 1800, p_lease_seconds integer DEFAULT 120)
 RETURNS TABLE(attempt_id uuid, creem_request_id text, checkout_url text, status text, lease_token uuid, should_create_checkout boolean, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz := now();
  v_attempt public.billing_checkout_attempts%rowtype;
  v_lease_token uuid;
begin
  if p_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_USER_ID';
  end if;

  if p_intent is null or p_intent <> 'upgrade_pro' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_BILLING_INTENT';
  end if;

  if p_ttl_seconds is null
    or p_ttl_seconds < 60
    or p_ttl_seconds > 3600 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_TTL';
  end if;

  if p_lease_seconds is null
    or p_lease_seconds < 15
    or p_lease_seconds > 600
    or p_lease_seconds > p_ttl_seconds then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_LEASE';
  end if;

  -- Serialize checkout-attempt claiming per user and intent so two callback,
  -- refresh, or duplicate-tab requests cannot both receive permission to
  -- create a provider checkout.
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_intent, 0)
  );

  update public.billing_checkout_attempts as attempt
  set
    status = 'expired',
    updated_at = v_now,
    lease_token = null,
    lease_expires_at = null
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status in ('creating', 'checkout_created')
    and attempt.expires_at <= v_now;

  select attempt.*
  into v_attempt
  from public.billing_checkout_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status = 'checkout_created'
    and nullif(btrim(attempt.checkout_url), '') is not null
    and attempt.expires_at > v_now
  order by attempt.created_at desc, attempt.id desc
  limit 1;

  if found then
    return query
      select
        v_attempt.id,
        v_attempt.creem_request_id,
        v_attempt.checkout_url,
        v_attempt.status,
        null::uuid,
        false,
        v_attempt.expires_at;
    return;
  end if;

  select attempt.*
  into v_attempt
  from public.billing_checkout_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status = 'creating'
    and attempt.expires_at > v_now
    and attempt.lease_token is not null
    and attempt.lease_expires_at > v_now
  order by attempt.updated_at desc, attempt.id desc
  limit 1;

  if found then
    return query
      select
        v_attempt.id,
        v_attempt.creem_request_id,
        v_attempt.checkout_url,
        v_attempt.status,
        v_attempt.lease_token,
        false,
        v_attempt.expires_at;
    return;
  end if;

  select attempt.*
  into v_attempt
  from public.billing_checkout_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.intent = p_intent
    and attempt.status = 'creating'
    and attempt.expires_at > v_now
    and (
      attempt.lease_token is null
      or attempt.lease_expires_at is null
      or attempt.lease_expires_at <= v_now
    )
  order by attempt.created_at asc, attempt.id asc
  limit 1
  for update of attempt;

  if found then
    v_lease_token := gen_random_uuid();

    update public.billing_checkout_attempts as attempt
    set
      lease_token = v_lease_token,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
    where attempt.id = v_attempt.id
    returning attempt.* into v_attempt;

    return query
      select
        v_attempt.id,
        v_attempt.creem_request_id,
        v_attempt.checkout_url,
        v_attempt.status,
        v_attempt.lease_token,
        true,
        v_attempt.expires_at;
    return;
  end if;

  v_lease_token := gen_random_uuid();

  insert into public.billing_checkout_attempts (
    user_id,
    intent,
    status,
    creem_request_id,
    lease_token,
    lease_expires_at,
    expires_at
  )
  values (
    p_user_id,
    p_intent,
    'creating',
    'billing-' || gen_random_uuid()::text,
    v_lease_token,
    v_now + make_interval(secs => p_lease_seconds),
    v_now + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_attempt;

  return query
    select
      v_attempt.id,
      v_attempt.creem_request_id,
      v_attempt.checkout_url,
      v_attempt.status,
      v_attempt.lease_token,
      true,
      v_attempt.expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_homepage_demo_project(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean)
 RETURNS TABLE(outcome text, saved_project_id uuid, created boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_attempt public.project_import_attempts%rowtype;
  v_effective_result jsonb;
  v_task jsonb;
  v_import_result jsonb;
  v_saved_project_id_text text;
  v_saved_project_id uuid;
  v_created boolean := false;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_authenticated_user_id is null
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array' then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if jsonb_array_length(p_import_groups) <> 1 then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;

    return query
      select
        'already_claimed'::text,
        v_claim.saved_project_id,
        false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_trial.expires_at <= v_now
    or v_draft.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_trial.public_token_hash is distinct from v_claim.public_token_hash
    or v_trial.session_token_hash is distinct from v_claim.session_token_hash
    or v_draft.trial_id is distinct from v_trial.id
    or v_trial.input_type is distinct from 'text'
    or v_trial.status is distinct from 'review_ready'
    or v_trial.risk_state is distinct from 'allowed'
    or v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null
    or v_draft.status is distinct from 'ready'
    or v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null
    or v_draft.normalized_result is null then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  v_effective_result := coalesce(v_draft.edited_result, v_draft.normalized_result);

  if v_effective_result is null
    or jsonb_typeof(v_effective_result) is distinct from 'object' then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  if jsonb_typeof(v_effective_result->'tasks') is distinct from 'array' then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  if jsonb_array_length(v_effective_result->'tasks') = 0 then
    return query
      select
        'draft_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  for v_task in
    select task_value
    from jsonb_array_elements(v_effective_result->'tasks') as tasks(task_value)
  loop
    if jsonb_typeof(v_task) is distinct from 'object'
      or v_task->>'source' is distinct from 'text'
      or jsonb_typeof(v_task->'client_name') is distinct from 'string'
      or jsonb_typeof(v_task->'contact_name') is distinct from 'string'
      or jsonb_typeof(v_task->'client_phone') is distinct from 'string'
      or jsonb_typeof(v_task->'client_email') is distinct from 'string'
      or jsonb_typeof(v_task->'client_notes') is distinct from 'string'
      or jsonb_typeof(v_task->'task_title') is distinct from 'string'
      or nullif(btrim(v_task->>'task_title'), '') is null
      or jsonb_typeof(v_task->'amount') is distinct from 'string'
      or jsonb_typeof(v_task->'deadline_text') is distinct from 'string'
      or v_task->>'priority' not in ('low', 'medium', 'high')
      or v_task->>'priority' is null
      or jsonb_typeof(v_task->'raw_input') is distinct from 'string' then
      return query
        select
          'draft_unavailable'::text,
          null::uuid,
          false;
      return;
    end if;
  end loop;

  -- The future server route must pass true only after its duplicate preflight
  -- has found no blocker or after an explicit trusted save-anyway decision.
  if p_duplicate_check_passed is distinct from true then
    return query
      select
        'duplicate_detected'::text,
        null::uuid,
        false;
    return;
  end if;

  -- p_request_hash and p_import_groups must be generated by the trusted
  -- server route from the locked Homepage Demo draft, never forwarded from
  -- browser-provided project/client/task payloads.
  insert into public.project_import_attempts (
    user_id,
    idempotency_key,
    request_hash,
    status,
    payload_json,
    last_seen_at
  )
  values (
    p_authenticated_user_id,
    v_claim.import_idempotency_key,
    p_request_hash,
    'started',
    p_import_groups,
    v_now
  )
  on conflict on constraint project_import_attempts_user_key_unique
  do nothing
  returning *
  into v_attempt;

  if v_attempt.id is null then
    select attempt.*
    into v_attempt
    from public.project_import_attempts as attempt
    where attempt.user_id = p_authenticated_user_id
      and attempt.idempotency_key = v_claim.import_idempotency_key
    for update of attempt;

    if not found
      or v_attempt.request_hash is distinct from p_request_hash
      or v_attempt.payload_json is distinct from p_import_groups then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;
  end if;

  if v_attempt.status = 'committed' then
    if v_attempt.result_json is null
      or jsonb_typeof(v_attempt.result_json) <> 'object' then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;

    v_import_result := v_attempt.result_json;
  elsif v_attempt.status = 'started'
    and v_attempt.error_code is null then
    v_import_result := public.import_projects_transaction(
      v_attempt.id,
      v_claim.import_idempotency_key,
      p_request_hash,
      p_import_groups
    );
    v_created := true;
  else
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  v_saved_project_id_text := nullif(
    v_import_result #>> '{createdProjects,0,id}',
    ''
  );

  if v_saved_project_id_text is null
    or v_saved_project_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_RESULT_INVALID';
  end if;

  v_saved_project_id := v_saved_project_id_text::uuid;

  update public.homepage_demo_claims as claim
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    saved_project_id = v_saved_project_id,
    claimed_at = v_now
  where claim.id = v_claim.id
    and claim.status = 'pending'
    and claim.claimed_by_user_id is null
    and claim.saved_project_id is null
    and claim.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    claimed_at = v_now
  where trial.id = v_trial.id
    and trial.status = 'review_ready'
    and trial.risk_state = 'allowed'
    and trial.claimed_by_user_id is null
    and trial.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  update public.homepage_demo_drafts as draft
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    claimed_at = v_now
  where draft.id = v_draft.id
    and draft.trial_id = v_trial.id
    and draft.status = 'ready'
    and draft.claimed_by_user_id is null
    and draft.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  return query
    select
      'saved'::text,
      v_saved_project_id,
      v_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_homepage_demo_project_v2(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean)
 RETURNS TABLE(outcome text, saved_project_id uuid, created boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_attempt public.project_import_attempts%rowtype;
  v_effective_result jsonb;
  v_task jsonb;
  v_import_result jsonb;
  v_saved_project_id_text text;
  v_saved_project_id uuid;
  v_created boolean := false;
  v_has_claim_authority boolean := false;
  v_has_continuation_authority boolean := false;
begin
  if (
      p_claim_token_hash is null
      and p_auth_continuation_token_hash is null
    )
    or (
      p_claim_token_hash is not null
      and p_claim_token_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      p_auth_continuation_token_hash is not null
      and p_auth_continuation_token_hash !~ '^[0-9a-f]{64}$'
    ) then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if p_authenticated_user_id is null
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if p_claim_token_hash is not null then
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.claim_token_hash = p_claim_token_hash
    for update of claim;
  else
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.auth_continuation_token_hash = p_auth_continuation_token_hash
    for update of claim;
  end if;

  if not found then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;

    return query
      select 'already_claimed'::text, v_claim.saved_project_id, false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  v_has_claim_authority :=
    p_claim_token_hash is not null
    and v_claim.claim_token_hash is not distinct from p_claim_token_hash
    and v_claim.expires_at > v_now;

  v_has_continuation_authority :=
    p_auth_continuation_token_hash is not null
    and v_claim.auth_continuation_token_hash
      is not distinct from p_auth_continuation_token_hash
    and v_claim.auth_continuation_started_at is not null
    and v_claim.auth_continuation_started_at < v_claim.expires_at
    and v_claim.auth_continuation_expires_at > v_now
    and v_claim.auth_continuation_consumed_at is null;

  if not v_has_claim_authority and not v_has_continuation_authority then
    if v_claim.expires_at <= v_now then
      update public.homepage_demo_claims as claim
      set status = 'expired'
      where claim.id = v_claim.id
        and claim.status = 'pending';
    end if;

    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  v_now := clock_timestamp();

  if (v_trial.expires_at <= v_now or v_draft.expires_at <= v_now)
    and not v_has_continuation_authority then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_trial.public_token_hash is distinct from v_claim.public_token_hash
    or v_trial.session_token_hash is distinct from v_claim.session_token_hash
    or v_draft.trial_id is distinct from v_trial.id
    or v_trial.input_type is distinct from 'text'
    or v_trial.status is distinct from 'review_ready'
    or v_trial.risk_state is distinct from 'allowed'
    or v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null
    or v_draft.status is distinct from 'ready'
    or v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null
    or v_draft.normalized_result is null then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  v_effective_result := coalesce(v_draft.edited_result, v_draft.normalized_result);

  if v_effective_result is null
    or jsonb_typeof(v_effective_result) is distinct from 'object'
    or jsonb_typeof(v_effective_result->'tasks') is distinct from 'array'
    or jsonb_array_length(v_effective_result->'tasks') = 0 then
    return query select 'draft_unavailable'::text, null::uuid, false;
    return;
  end if;

  for v_task in
    select task_value
    from jsonb_array_elements(v_effective_result->'tasks') as tasks(task_value)
  loop
    if jsonb_typeof(v_task) is distinct from 'object'
      or v_task->>'source' is distinct from 'text'
      or jsonb_typeof(v_task->'client_name') is distinct from 'string'
      or jsonb_typeof(v_task->'contact_name') is distinct from 'string'
      or jsonb_typeof(v_task->'client_phone') is distinct from 'string'
      or jsonb_typeof(v_task->'client_email') is distinct from 'string'
      or jsonb_typeof(v_task->'client_notes') is distinct from 'string'
      or jsonb_typeof(v_task->'task_title') is distinct from 'string'
      or nullif(btrim(v_task->>'task_title'), '') is null
      or jsonb_typeof(v_task->'amount') is distinct from 'string'
      or jsonb_typeof(v_task->'deadline_text') is distinct from 'string'
      or v_task->>'priority' not in ('low', 'medium', 'high')
      or v_task->>'priority' is null
      or jsonb_typeof(v_task->'raw_input') is distinct from 'string' then
      return query select 'draft_unavailable'::text, null::uuid, false;
      return;
    end if;
  end loop;

  if p_duplicate_check_passed is distinct from true then
    return query select 'duplicate_detected'::text, null::uuid, false;
    return;
  end if;

  insert into public.project_import_attempts (
    user_id,
    idempotency_key,
    request_hash,
    status,
    payload_json,
    last_seen_at
  )
  values (
    p_authenticated_user_id,
    v_claim.import_idempotency_key,
    p_request_hash,
    'started',
    p_import_groups,
    v_now
  )
  on conflict on constraint project_import_attempts_user_key_unique
  do nothing
  returning *
  into v_attempt;

  if v_attempt.id is null then
    select attempt.*
    into v_attempt
    from public.project_import_attempts as attempt
    where attempt.user_id = p_authenticated_user_id
      and attempt.idempotency_key = v_claim.import_idempotency_key
    for update of attempt;

    if not found
      or v_attempt.request_hash is distinct from p_request_hash
      or v_attempt.payload_json is distinct from p_import_groups then
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;
  end if;

  if v_attempt.status = 'committed' then
    if v_attempt.result_json is null
      or jsonb_typeof(v_attempt.result_json) <> 'object' then
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;

    v_import_result := v_attempt.result_json;
  elsif v_attempt.status = 'started'
    and v_attempt.error_code is null then
    v_import_result := public.import_projects_transaction(
      v_attempt.id,
      v_claim.import_idempotency_key,
      p_request_hash,
      p_import_groups
    );
    v_created := true;
  else
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  v_saved_project_id_text := nullif(
    v_import_result #>> '{createdProjects,0,id}',
    ''
  );

  if v_saved_project_id_text is null
    or v_saved_project_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_RESULT_INVALID';
  end if;

  v_saved_project_id := v_saved_project_id_text::uuid;

  update public.homepage_demo_claims as claim
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    saved_project_id = v_saved_project_id,
    claimed_at = v_now,
    auth_continuation_consumed_at =
      case
        when claim.auth_continuation_token_hash is null then null
        else v_now
      end
  where claim.id = v_claim.id
    and claim.status = 'pending'
    and claim.claimed_by_user_id is null
    and claim.saved_project_id is null
    and claim.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    claimed_at = v_now
  where trial.id = v_trial.id
    and trial.status = 'review_ready'
    and trial.risk_state = 'allowed'
    and trial.claimed_by_user_id is null
    and trial.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  update public.homepage_demo_drafts as draft
  set
    status = 'claimed',
    claimed_by_user_id = p_authenticated_user_id,
    claimed_at = v_now
  where draft.id = v_draft.id
    and draft.trial_id = v_trial.id
    and draft.status = 'ready'
    and draft.claimed_by_user_id is null
    and draft.claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_CLAIM_SAVE_CONFLICT';
  end if;

  return query select 'saved'::text, v_saved_project_id, v_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_homepage_demo_project_with_duplicate_override(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb)
 RETURNS TABLE(outcome text, saved_project_id uuid, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz;
  v_claim public.homepage_demo_claims%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_save_outcome text;
  v_saved_project_id uuid;
  v_created boolean;
  v_row_count integer;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_authenticated_user_id is null
    or p_authority_token_hash is null
    or p_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  v_now := clock_timestamp();

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query
        select
          'invalid_claim'::text,
          null::uuid,
          false;
      return;
    end if;

    return query
      select
        'already_claimed'::text,
        v_claim.saved_project_id,
        false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.authority_token_hash = p_authority_token_hash
  for update of authority;

  if not found then
    return query
      select
        'duplicate_authority_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  v_now := clock_timestamp();

  if v_claim.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query
      select
        'expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_authority.status = 'pending'
    and v_authority.expires_at <= v_now then
    update public.homepage_demo_duplicate_override_authorities as authority
    set
      status = 'expired',
      updated_at = v_now
    where authority.id = v_authority.id
      and authority.status = 'pending'
      and authority.consumed_at is null;

    return query
      select
        'duplicate_authority_expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_authority.status = 'expired' then
    return query
      select
        'duplicate_authority_expired'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_authority.claim_id is distinct from v_claim.id
    or v_authority.authenticated_user_id is distinct from p_authenticated_user_id
    or v_authority.status is distinct from 'pending'
    or v_authority.consumed_at is not null
    or v_authority.request_hash is distinct from p_request_hash
    or v_authority.import_groups_hash is distinct from v_import_groups_hash then
    return query
      select
        'duplicate_authority_unavailable'::text,
        null::uuid,
        false;
    return;
  end if;

  select save_result.outcome,
         save_result.saved_project_id,
         save_result.created
  into v_save_outcome,
       v_saved_project_id,
       v_created
  from public.claim_homepage_demo_project(
    p_claim_token_hash,
    p_authenticated_user_id,
    p_request_hash,
    p_import_groups,
    true
  ) as save_result;

  if not found then
    return query
      select
        'invalid_claim'::text,
        null::uuid,
        false;
    return;
  end if;

  if v_save_outcome = 'saved' then
    v_now := clock_timestamp();

    update public.homepage_demo_duplicate_override_authorities as authority
    set
      status = 'consumed',
      consumed_at = v_now,
      updated_at = v_now
    where authority.id = v_authority.id
      and authority.authority_token_hash = p_authority_token_hash
      and authority.claim_id = v_claim.id
      and authority.authenticated_user_id = p_authenticated_user_id
      and authority.status = 'pending'
      and authority.consumed_at is null
      and authority.expires_at > v_now
      and authority.request_hash = p_request_hash
      and authority.import_groups_hash = v_import_groups_hash;

    get diagnostics v_row_count = row_count;

    if v_row_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_DUPLICATE_OVERRIDE_CONFLICT';
    end if;
  end if;

  return query
    select
      v_save_outcome,
      v_saved_project_id,
      v_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_homepage_demo_project_with_duplicate_override_v2(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb)
 RETURNS TABLE(outcome text, saved_project_id uuid, created boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_save_outcome text;
  v_saved_project_id uuid;
  v_created boolean;
  v_row_count integer;
begin
  if (
      p_claim_token_hash is null
      and p_auth_continuation_token_hash is null
    )
    or (
      p_claim_token_hash is not null
      and p_claim_token_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      p_auth_continuation_token_hash is not null
      and p_auth_continuation_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_authenticated_user_id is null
    or p_authority_token_hash is null
    or p_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  if p_claim_token_hash is not null then
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.claim_token_hash = p_claim_token_hash
    for update of claim;
  else
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.auth_continuation_token_hash = p_auth_continuation_token_hash
    for update of claim;
  end if;

  if not found then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is distinct from p_authenticated_user_id
      or v_claim.saved_project_id is null
      or v_claim.claimed_at is null then
      return query select 'invalid_claim'::text, null::uuid, false;
      return;
    end if;

    return query
      select 'already_claimed'::text, v_claim.saved_project_id, false;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, null::uuid, false;
    return;
  end if;

  if v_claim.status <> 'pending' then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.authority_token_hash = p_authority_token_hash
  for update of authority;

  if not found then
    return query
      select 'duplicate_authority_unavailable'::text, null::uuid, false;
    return;
  end if;

  v_now := clock_timestamp();

  if v_authority.status = 'pending'
    and v_authority.expires_at <= v_now then
    update public.homepage_demo_duplicate_override_authorities as authority
    set
      status = 'expired',
      updated_at = v_now
    where authority.id = v_authority.id
      and authority.status = 'pending'
      and authority.consumed_at is null;

    return query
      select 'duplicate_authority_expired'::text, null::uuid, false;
    return;
  end if;

  if v_authority.status = 'expired' then
    return query
      select 'duplicate_authority_expired'::text, null::uuid, false;
    return;
  end if;

  if v_authority.claim_id is distinct from v_claim.id
    or v_authority.authenticated_user_id is distinct from p_authenticated_user_id
    or v_authority.status is distinct from 'pending'
    or v_authority.consumed_at is not null
    or v_authority.request_hash is distinct from p_request_hash
    or v_authority.import_groups_hash is distinct from v_import_groups_hash then
    return query
      select 'duplicate_authority_unavailable'::text, null::uuid, false;
    return;
  end if;

  select save_result.outcome,
         save_result.saved_project_id,
         save_result.created
  into v_save_outcome,
       v_saved_project_id,
       v_created
  from public.claim_homepage_demo_project_v2(
    p_claim_token_hash,
    p_auth_continuation_token_hash,
    p_authenticated_user_id,
    p_request_hash,
    p_import_groups,
    true
  ) as save_result;

  if not found then
    return query select 'invalid_claim'::text, null::uuid, false;
    return;
  end if;

  if v_save_outcome = 'saved' then
    v_now := clock_timestamp();

    update public.homepage_demo_duplicate_override_authorities as authority
    set
      status = 'consumed',
      consumed_at = v_now,
      updated_at = v_now
    where authority.id = v_authority.id
      and authority.authority_token_hash = p_authority_token_hash
      and authority.claim_id = v_claim.id
      and authority.authenticated_user_id = p_authenticated_user_id
      and authority.status = 'pending'
      and authority.consumed_at is null
      and authority.expires_at > v_now
      and authority.request_hash = p_request_hash
      and authority.import_groups_hash = v_import_groups_hash;

    get diagnostics v_row_count = row_count;

    if v_row_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_DUPLICATE_OVERRIDE_CONFLICT';
    end if;
  end if;

  return query select v_save_outcome, v_saved_project_id, v_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.clear_share_link_expiry(p_link_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_link_expires_at timestamptz;
  v_link_updated_at timestamptz;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select
      link.state, link.configuration_version, link.project_id,
      link.expires_at, link.updated_at
    into
      v_link_state, v_link_configuration_version, v_project_id,
      v_link_expires_at, v_link_updated_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  -- project_share_links_state_lifecycle_check requires expires_at to
  -- remain non-null while state = 'expired'. Clearing it here would
  -- either violate that constraint outright or require inventing a
  -- state transition this function does not perform, so this is a
  -- stable state conflict and no mutation happens.
  if v_link_state = 'expired' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  if v_link_expires_at is null then
    -- Idempotent no-op: configuration_version must not increase.
    return jsonb_build_object(
      'linkId', p_link_id,
      'state', v_link_state,
      'expiresAt', null,
      'configurationVersion', v_link_configuration_version,
      'updatedAt', v_link_updated_at
    );
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      expires_at = null,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', v_link_state,
    'expiresAt', null,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.clear_share_link_pin(p_link_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_link_has_pin boolean;
  v_link_updated_at timestamptz;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select
      link.state, link.configuration_version, link.project_id,
      link.pin_hash is not null, link.updated_at
    into
      v_link_state, v_link_configuration_version, v_project_id,
      v_link_has_pin, v_link_updated_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  if not v_link_has_pin then
    -- Idempotent no-op: nothing access-sensitive changes, so
    -- configuration_version must not increase.
    return jsonb_build_object(
      'linkId', p_link_id,
      'hasPin', false,
      'state', v_link_state,
      'configurationVersion', v_link_configuration_version,
      'updatedAt', v_link_updated_at
    );
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      pin_hash = null,
      pin_salt = null,
      pin_hash_version = null,
      pin_scrypt_n = null,
      pin_scrypt_r = null,
      pin_scrypt_p = null,
      pin_key_length = null,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'hasPin', false,
    'state', v_link_state,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_billing_checkout_creation(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_checkout_url text := btrim(coalesce(p_checkout_url, ''));
  v_updated_id uuid;
begin
  if p_attempt_id is null or p_lease_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_LEASE';
  end if;

  if v_checkout_url !~* '^https://[^[:space:]]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_URL';
  end if;

  update public.billing_checkout_attempts as attempt
  set
    status = 'checkout_created',
    checkout_url = v_checkout_url,
    updated_at = now(),
    lease_token = null,
    lease_expires_at = null
  where attempt.id = p_attempt_id
    and attempt.status = 'creating'
    and attempt.lease_token = p_lease_token
    and attempt.lease_expires_at > now()
    and attempt.expires_at > now()
  returning attempt.id into v_updated_id;

  return v_updated_id is not null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_homepage_demo_processing(p_attempt_id uuid, p_capacity_lease_token_hash text, p_normalized_result jsonb, p_schema_version text, p_engine_version text)
 RETURNS TABLE(decision text, attempt_id uuid, trial_id uuid, draft_id uuid, attempt_status text, trial_status text, draft_status text, provider_call_started_at timestamp with time zone, provider_call_completed_at timestamp with time zone, review_ready_at timestamp with time zone, idempotent boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_safe_identifier_pattern constant text := '^[A-Za-z0-9_.:-]+$';
  v_now timestamptz := pg_catalog.now();
  v_schema_version text := btrim(coalesce(p_schema_version, ''));
  v_engine_version text := btrim(coalesce(p_engine_version, ''));
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_consumed_entitlement_count integer;
  v_released_entitlement_count integer;
  v_expired_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_completed_trial_id uuid;
  v_completed_draft_id uuid;
  v_completed_trial_status text;
  v_completed_draft_status text;
  v_completed_expires_at timestamptz;
  v_completed_created boolean;
  v_updated_count integer;
  v_exception_message text;
begin
  if p_attempt_id is null
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern
    or p_normalized_result is null
    or jsonb_typeof(p_normalized_result) <> 'object'
    or char_length(v_schema_version) not between 1 and 80
    or v_schema_version !~ v_safe_identifier_pattern
    or char_length(v_engine_version) not between 1 and 80
    or v_engine_version !~ v_safe_identifier_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
  end if;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_attempt.trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select capacity.*
  into v_capacity
  from public.homepage_demo_capacity_reservations as capacity
  where capacity.attempt_id = v_attempt.id
  for update of capacity;

  if not found or v_capacity.lease_token_hash <> p_capacity_lease_token_hash then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID';
  end if;

  if v_attempt.input_type not in ('text', 'image')
    or v_attempt.estimated_cost_units <= 0
    or v_capacity.workload_type <> v_attempt.input_type
    or v_capacity.reserved_units <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select cost.*
  into v_cost
  from public.homepage_demo_cost_reservations as cost
  where cost.attempt_id = v_attempt.id
  for update of cost;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_cost.reserved_units <= 0
    or v_cost.reserved_units <> v_attempt.estimated_cost_units then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_hour_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_day_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select
    count(*)::integer,
    count(*) filter (where locked_entitlements.status = 'reserved')::integer,
    count(*) filter (where locked_entitlements.status = 'consumed')::integer,
    count(*) filter (where locked_entitlements.status = 'released')::integer,
    count(*) filter (where locked_entitlements.status = 'expired')::integer,
    count(*) filter (where locked_entitlements.scope = 'session')::integer,
    count(*) filter (where locked_entitlements.scope = 'device')::integer
  into
    v_entitlement_count,
    v_reserved_entitlement_count,
    v_consumed_entitlement_count,
    v_released_entitlement_count,
    v_expired_entitlement_count,
    v_session_entitlement_count,
    v_device_entitlement_count
  from (
    select entitlement.status, entitlement.scope
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.attempt_id = v_attempt.id
    order by entitlement.scope
    for update of entitlement
  ) as locked_entitlements;

  if v_entitlement_count <> 2
    or v_session_entitlement_count <> 1
    or v_device_entitlement_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.status = 'review_ready' then
    if v_trial.status <> 'review_ready'
      or v_attempt.provider_call_started_at is null
      or v_cost.provider_call_started_at is null
      or v_cost.provider_call_started_at is distinct from v_attempt.provider_call_started_at
      or v_attempt.provider_call_completed_at is null
      or v_attempt.review_ready_at is null
      or v_capacity.status <> 'released'
      or v_capacity.released_at is null
      or v_capacity.expired_at is not null
      or v_cost.status <> 'finalized'
      or v_cost.finalized_units is null
      or v_cost.finalized_units is distinct from v_cost.reserved_units
      or v_cost.finalized_at is null
      or v_cost.released_at is not null
      or v_cost.expired_at is not null
      or v_consumed_entitlement_count <> 2
      or v_reserved_entitlement_count <> 0
      or v_released_entitlement_count <> 0
      or v_expired_entitlement_count <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
    end if;

    select completed.trial_id,
      completed.draft_id,
      completed.trial_status,
      completed.draft_status,
      completed.expires_at,
      completed.created
    into
      v_completed_trial_id,
      v_completed_draft_id,
      v_completed_trial_status,
      v_completed_draft_status,
      v_completed_expires_at,
      v_completed_created
    from public.complete_homepage_demo_trial(
      v_trial.id,
      p_normalized_result,
      v_schema_version,
      v_engine_version
    ) as completed;

    select draft.*
    into v_draft
    from public.homepage_demo_drafts as draft
    where draft.id = v_completed_draft_id
      and draft.trial_id = v_trial.id
    for update of draft;

    if not found
      or v_draft.id is distinct from v_completed_draft_id
      or v_draft.trial_id is distinct from v_trial.id
      or v_draft.status is distinct from 'ready'
      or v_draft.normalized_result is null
      or v_completed_trial_id is distinct from v_trial.id
      or v_completed_draft_id is distinct from v_draft.id
      or v_completed_trial_status is distinct from 'review_ready'
      or v_completed_draft_status is distinct from 'ready'
      or v_completed_created is distinct from false then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
    end if;

    return query
      select
        'review_ready'::text,
        v_attempt.id,
        v_trial.id,
        v_draft.id,
        v_attempt.status,
        v_trial.status,
        v_draft.status,
        v_attempt.provider_call_started_at,
        v_attempt.provider_call_completed_at,
        v_attempt.review_ready_at,
        true;
    return;
  end if;

  if v_capacity.status = 'expired'
    or (
      v_capacity.status = 'active'
      and v_capacity.lease_expires_at <= v_now
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED';
  end if;

  if v_capacity.status <> 'active'
    or v_attempt.status <> 'processing'
    or v_trial.status <> 'processing'
    or v_trial.risk_state <> 'allowed'
    or v_capacity.released_at is not null
    or v_capacity.expired_at is not null
    or v_attempt.provider_call_started_at is null
    or v_attempt.provider_call_completed_at is not null
    or v_attempt.review_ready_at is not null
    or v_cost.status <> 'reserved'
    or v_cost.provider_call_started_at is null
    or v_cost.provider_call_started_at <> v_attempt.provider_call_started_at
    or v_cost.finalized_units is not null
    or v_cost.finalized_at is not null
    or v_cost.released_at is not null
    or v_cost.expired_at is not null
    or v_hour_bucket.reserved_units < v_cost.reserved_units
    or v_day_bucket.reserved_units < v_cost.reserved_units
    or v_reserved_entitlement_count <> 2
    or v_consumed_entitlement_count <> 0
    or v_released_entitlement_count <> 0
    or v_expired_entitlement_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
  end if;

  select completed.trial_id,
    completed.draft_id,
    completed.trial_status,
    completed.draft_status,
    completed.expires_at,
    completed.created
  into
    v_completed_trial_id,
    v_completed_draft_id,
    v_completed_trial_status,
    v_completed_draft_status,
    v_completed_expires_at,
    v_completed_created
  from public.complete_homepage_demo_trial(
    v_trial.id,
    p_normalized_result,
    v_schema_version,
    v_engine_version
  ) as completed;

  if v_completed_trial_id <> v_trial.id
    or v_completed_trial_status <> 'review_ready'
    or v_completed_draft_status <> 'ready'
    or v_completed_created is not true then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_completed_draft_id
    and draft.trial_id = v_trial.id
  for update of draft;

  if not found
    or v_draft.status <> 'ready'
    or v_draft.normalized_result is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
  end if;

  update public.homepage_demo_admission_attempts as attempt
  set
    status = 'review_ready',
    provider_call_completed_at = v_now,
    review_ready_at = v_now
  where attempt.id = v_attempt.id
    and attempt.status = 'processing'
    and attempt.provider_call_started_at is not null
    and attempt.provider_call_completed_at is null
    and attempt.review_ready_at is null
  returning attempt.* into v_attempt;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'consumed',
    trial_id = v_trial.id,
    consumed_at = v_now,
    released_at = null
  where entitlement.attempt_id = v_attempt.id
    and entitlement.status = 'reserved';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_capacity_reservations as capacity
  set
    status = 'released',
    released_at = v_now,
    expired_at = null
  where capacity.id = v_capacity.id
    and capacity.status = 'active'
  returning capacity.* into v_capacity;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_buckets as bucket
  set
    reserved_units = bucket.reserved_units - v_cost.reserved_units,
    spent_units = bucket.spent_units + v_cost.reserved_units
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
    and bucket.reserved_units >= v_cost.reserved_units;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_buckets as bucket
  set
    reserved_units = bucket.reserved_units - v_cost.reserved_units,
    spent_units = bucket.spent_units + v_cost.reserved_units
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
    and bucket.reserved_units >= v_cost.reserved_units;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_reservations as cost
  set
    status = 'finalized',
    finalized_units = cost.reserved_units,
    finalized_at = v_now,
    released_at = null,
    expired_at = null
  where cost.id = v_cost.id
    and cost.status = 'reserved'
    and cost.finalized_units is null
    and cost.finalized_at is null
    and cost.released_at is null
    and cost.expired_at is null
  returning cost.* into v_cost;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  v_trial.status := v_completed_trial_status;

  return query
    select
      'review_ready'::text,
      v_attempt.id,
      v_trial.id,
      v_draft.id,
      v_attempt.status,
      v_trial.status,
      v_draft.status,
      v_attempt.provider_call_started_at,
      v_attempt.provider_call_completed_at,
      v_attempt.review_ready_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED',
      'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    if v_exception_message in (
      'INVALID_HOMEPAGE_DEMO_TRIAL_ID',
      'INVALID_HOMEPAGE_DEMO_RESULT',
      'INVALID_HOMEPAGE_DEMO_VERSION'
    ) then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_DRAFT_CONFLICT'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_TRIAL_NOT_FOUND',
      'HOMEPAGE_DEMO_TRIAL_EXPIRED',
      'HOMEPAGE_DEMO_COMPLETION_INVALID_STATE',
      'HOMEPAGE_DEMO_RISK_NOT_ALLOWED'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_homepage_demo_trial(p_trial_id uuid, p_normalized_result jsonb, p_schema_version text, p_engine_version text)
 RETURNS TABLE(trial_id uuid, draft_id uuid, trial_status text, draft_status text, expires_at timestamp with time zone, created boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_schema_version text := btrim(coalesce(p_schema_version, ''));
  v_engine_version text := btrim(coalesce(p_engine_version, ''));
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if p_normalized_result is null
    or jsonb_typeof(p_normalized_result) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_RESULT';
  end if;

  if char_length(v_schema_version) not between 1 and 80
    or v_schema_version !~ '^[A-Za-z0-9_.:-]+$'
    or char_length(v_engine_version) not between 1 and 80
    or v_engine_version !~ '^[A-Za-z0-9_.:-]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_VERSION';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status = 'review_ready' then
    select draft.*
    into v_draft
    from public.homepage_demo_drafts as draft
    where draft.trial_id = v_trial.id
    for update of draft;

    if found
      and v_draft.status = 'ready'
      and v_draft.schema_version = v_schema_version
      and v_draft.engine_version = v_engine_version
      and v_draft.normalized_result = p_normalized_result
      and v_draft.edited_result is null
      and v_draft.expires_at = v_trial.expires_at then
      return query
        select
          v_trial.id,
          v_draft.id,
          v_trial.status,
          v_draft.status,
          v_trial.expires_at,
          false;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_COMPLETION_CONFLICT';
  end if;

  if v_trial.status <> 'processing' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_COMPLETION_INVALID_STATE';
  end if;

  if v_trial.risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_RISK_NOT_ALLOWED';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_DRAFT_CONFLICT';
  end if;

  insert into public.homepage_demo_drafts (
    trial_id,
    status,
    schema_version,
    engine_version,
    normalized_result,
    edited_result,
    expires_at
  )
  values (
    v_trial.id,
    'ready',
    v_schema_version,
    v_engine_version,
    p_normalized_result,
    null,
    v_trial.expires_at
  )
  returning * into v_draft;

  update public.homepage_demo_trials as trial
  set status = 'review_ready'
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_draft.id,
      v_trial.status,
      v_draft.status,
      v_trial.expires_at,
      true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_homepage_demo_trial(p_public_token_hash text, p_session_token_hash text, p_idempotency_key_hash text, p_input_type text, p_expires_at timestamp with time zone)
 RETURNS TABLE(trial_id uuid, status text, risk_state text, expires_at timestamp with time zone, created boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$'
    or p_idempotency_key_hash is null
    or p_idempotency_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TOKEN_HASH';
  end if;

  if p_input_type is null or p_input_type not in ('text', 'image') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_INPUT_TYPE';
  end if;

  if p_expires_at is null or p_expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EXPIRY';
  end if;

  begin
    insert into public.homepage_demo_trials (
      public_token_hash,
      session_token_hash,
      idempotency_key_hash,
      input_type,
      status,
      risk_state,
      expires_at
    )
    values (
      p_public_token_hash,
      p_session_token_hash,
      p_idempotency_key_hash,
      p_input_type,
      'created',
      'not_evaluated',
      p_expires_at
    )
    on conflict (idempotency_key_hash) do nothing
    returning * into v_trial;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_TOKEN_HASH_COLLISION';
  end;

  if v_trial.id is not null then
    return query
      select
        v_trial.id,
        v_trial.status,
        v_trial.risk_state,
        v_trial.expires_at,
        true;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.idempotency_key_hash = p_idempotency_key_hash
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_IDEMPOTENCY_CONFLICT';
  end if;

  if v_trial.public_token_hash <> p_public_token_hash
    or v_trial.session_token_hash <> p_session_token_hash
    or v_trial.input_type <> p_input_type then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_IDEMPOTENCY_CONFLICT';
  end if;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      false;
end;
$function$;

create or replace function public.create_share_link_draft(
  p_project_id uuid,
  p_public_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_user_id uuid;
  v_project_deleted_at timestamptz;
  v_project_is_archived boolean;
  v_link_id uuid;
  v_public_id text;
  v_state text;
  v_created_at timestamptz;
  v_constraint_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_project_id is null then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  -- The table's own project_share_links_public_id_format_check remains
  -- deliberately future-compatible at 16-64 characters (202608030003).
  -- This RPC's own input validation is intentionally narrower: the V1
  -- server-side generator (lib/share/share-public-id.server.ts) always
  -- produces exactly randomBytes(18).toString("base64url") -- 24
  -- characters -- so this closes the RPC's accepted input to exactly
  -- that shape, preventing a direct caller from bypassing the V1
  -- lifecycle operation's intended candidate shape. This does not make
  -- public_id a secret and does not alter the table's own constraint.
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PUBLIC_ID';
  end if;

  -- Ordinary ownership-verification lock -- multiple simultaneous drafts
  -- for the same project are always allowed (a draft is never active, so
  -- it can never violate the one-active-link rule), so no cross-link lock
  -- is needed here, only ownership verification.
  select project.user_id, project.deleted_at, project.is_archived
    into v_project_user_id, v_project_deleted_at, v_project_is_archived
    from public.projects as project
    where project.id = p_project_id
    for update;

  if v_project_user_id is null
    or v_project_user_id <> v_user_id
    or v_project_deleted_at is not null
  then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project_is_archived then
    raise exception using errcode = 'P0001', message = 'PROJECT_ARCHIVED';
  end if;

  begin
    insert into public.project_share_links (
      user_id,
      project_id,
      public_id
    ) values (
      v_user_id,
      p_project_id,
      p_public_id
    )
    returning id, public_id, state, created_at
      into v_link_id, v_public_id, v_state, v_created_at;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'project_share_links_public_id_unique' then
        raise exception using errcode = 'P0001', message = 'PUBLIC_ID_COLLISION';
      end if;

      raise;
  end;

  -- Content-free audit event only: share_link_id and a closed event_type,
  -- nothing else. identity_digest/identity_digest_version stay null.
  insert into public.share_link_events (share_link_id, event_type)
  values (v_link_id, 'link_created');

  return jsonb_build_object(
    'linkId', v_link_id,
    'publicId', v_public_id,
    'state', v_state,
    'createdAt', v_created_at
  );
end;
$$;

create or replace function public.disable_share_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Single-level lock: disabling can only ever REMOVE the one active link
  -- for a project, never create a second one, so no project-level lock or
  -- one-active-link check is needed here.
  select link.state, link.configuration_version, link.project_id
    into v_link_state, v_link_configuration_version, v_project_id
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_ACTIVE';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      state = 'disabled',
      disabled_at = v_now,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- Secret material is never deleted or changed by disabling -- a
  -- disabled link's owner must still be able to re-enable it later with
  -- the same secret.
  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_disabled');

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', 'disabled',
    'configurationVersion', v_new_configuration_version,
    'disabledAt', v_now
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.enforce_calendar_event_relationship_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_project_user_id uuid;
  v_project_client_id uuid;
  v_project_deleted_at timestamptz;
  v_client_user_id uuid;
  v_relationship_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_relationship_changed := true;
  else
    v_relationship_changed :=
      new.project_id is distinct from old.project_id
      or new.client_id is distinct from old.client_id;
  end if;

  if not v_relationship_changed then
    return new;
  end if;

  if new.project_id is not null then
    select project.user_id, project.client_id, project.deleted_at
      into v_project_user_id, v_project_client_id, v_project_deleted_at
      from public.projects as project
      where project.id = new.project_id;

    if v_project_user_id is null then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_PROJECT_NOT_FOUND';
    end if;

    if v_project_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_PROJECT_NOT_OWNED';
    end if;

    if v_project_deleted_at is not null then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_PROJECT_DELETED';
    end if;

    -- Locked normalization rule: a linked project's client always wins.
    new.client_id := v_project_client_id;
    -- A linked project/client is never paired with a custom name.
    new.custom_project_name := null;
    new.custom_client_name := null;
  end if;

  if new.client_id is not null then
    select client.user_id
      into v_client_user_id
      from public.clients as client
      where client.id = new.client_id;

    if v_client_user_id is null then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_CLIENT_NOT_FOUND';
    end if;

    if v_client_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'CALENDAR_EVENT_CLIENT_NOT_OWNED';
    end if;

    new.custom_client_name := null;
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_project_share_link_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project_user_id uuid;
  v_access_changed boolean;
  v_digest_changed boolean;
  v_secret_changed boolean;
  v_rotation_timestamp_changed boolean;
  v_state_transition_allowed boolean;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_OWNER_MISMATCH';
    end if;

    if new.project_id is distinct from old.project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_PROJECT_IMMUTABLE';
    end if;

    if new.public_id is distinct from old.public_id then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_PUBLIC_ID_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_CREATED_AT_IMMUTABLE';
    end if;

    if old.activated_at is not null
      and new.activated_at is distinct from old.activated_at then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_ACTIVATED_AT_IMMUTABLE';
    end if;

    if old.state <> 'draft' and new.state = 'draft' then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_DRAFT_STATE_IRREVERSIBLE';
    end if;

    if old.disabled_at is not null
      and (
        new.disabled_at is null
        or new.disabled_at < old.disabled_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_DISABLED_AT_DECREASE';
    end if;

    if old.rotated_at is not null
      and (
        new.rotated_at is null
        or new.rotated_at < old.rotated_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATED_AT_DECREASE';
    end if;

    if new.configuration_version < old.configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_CONFIGURATION_VERSION_DECREASE';
    end if;

    if new.view_count < old.view_count then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_VIEW_COUNT_DECREASE';
    end if;

    if old.last_viewed_at is not null
      and (
        new.last_viewed_at is null
        or new.last_viewed_at < old.last_viewed_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_LAST_VIEWED_AT_DECREASE';
    end if;

    if old.revoked_at is not null
      and (
        new.revoked_at is null
        or new.revoked_at < old.revoked_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOCATION_IRREVERSIBLE';
    end if;

    if old.state = 'revoked' and new.state <> 'revoked' then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED_STATE_TERMINAL';
    end if;

    if new.state is distinct from old.state then
      v_state_transition_allowed :=
        (old.state = 'draft' and new.state in ('active', 'revoked'))
        or (old.state = 'active' and new.state in ('disabled', 'expired', 'revoked'))
        or (old.state = 'disabled' and new.state in ('active', 'expired', 'revoked'))
        or (old.state = 'expired' and new.state in ('active', 'revoked'));

      if not v_state_transition_allowed then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_TRANSITION_INVALID';
      end if;

      if old.state = 'expired'
        and new.state = 'active'
        and new.configuration_version <= old.configuration_version then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_VERSION_NOT_INCREMENTED';
      end if;
    end if;

    v_access_changed :=
      new.secret_digest is distinct from old.secret_digest
      or new.secret_digest_version is distinct from old.secret_digest_version
      or new.state is distinct from old.state
      or new.expires_at is distinct from old.expires_at
      or new.pin_hash is distinct from old.pin_hash
      or new.pin_salt is distinct from old.pin_salt
      or new.pin_hash_version is distinct from old.pin_hash_version
      or new.pin_scrypt_n is distinct from old.pin_scrypt_n
      or new.pin_scrypt_r is distinct from old.pin_scrypt_r
      or new.pin_scrypt_p is distinct from old.pin_scrypt_p
      or new.pin_key_length is distinct from old.pin_key_length
      or new.comments_enabled is distinct from old.comments_enabled
      or new.client_facing_subtitle is distinct from old.client_facing_subtitle
      or new.content_direction is distinct from old.content_direction;

    if v_access_changed and new.configuration_version <= old.configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_VERSION_NOT_INCREMENTED';
    end if;

    v_digest_changed := new.secret_digest is distinct from old.secret_digest;
    v_secret_changed :=
      v_digest_changed
      or new.secret_digest_version is distinct from old.secret_digest_version;
    v_rotation_timestamp_changed := new.rotated_at is distinct from old.rotated_at;

    if new.secret_digest_version is distinct from old.secret_digest_version
      and not v_digest_changed then
      raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_REQUIRES_SECRET_CHANGE';
    end if;

    if old.secret_digest is not null and v_secret_changed then
      if new.rotated_at is null
        or new.rotated_at is not distinct from old.rotated_at
        or (
          old.rotated_at is not null
          and new.rotated_at <= old.rotated_at
        ) then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED';
      end if;
    end if;

    if v_rotation_timestamp_changed then
      if new.rotated_at is null
        or (
          old.rotated_at is not null
          and new.rotated_at <= old.rotated_at
        ) then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_TIMESTAMP_REQUIRED';
      end if;

      if not v_digest_changed then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_ROTATION_REQUIRES_SECRET_CHANGE';
      end if;

      if new.configuration_version <= old.configuration_version then
        raise exception using errcode = 'P0001', message = 'SHARE_LINK_VERSION_NOT_INCREMENTED';
      end if;
    end if;
  end if;

  select project.user_id
    into v_project_user_id
    from public.projects as project
    where project.id = new.project_id;

  if v_project_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_PROJECT_NOT_FOUND';
  end if;

  if v_project_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_PROJECT_NOT_OWNED';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_update_client_share_apply_boundary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.source_type = 'client_share'
    and new.status = 'applied' then

    if tg_op = 'INSERT' then
      if current_setting('text2task.client_share_apply_update_id', true)
          is distinct from new.id::text then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
      end if;
    elsif tg_op = 'UPDATE'
        and old.status is distinct from 'applied' then
      if current_setting('text2task.client_share_apply_update_id', true)
          is distinct from new.id::text then
        raise exception using
          errcode = 'P0001',
          message = 'PROJECT_UPDATE_SOURCE_NOT_APPLIABLE';
      end if;
    end if;

  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_project_update_source_provenance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_message_author_type text;
  v_message_body text;
begin
  if TG_OP = 'UPDATE' then
    if new.source_type is distinct from old.source_type
      or new.source_share_message_id is distinct from old.source_share_message_id
      or (
        old.source_share_message_id is not null
        and new.raw_input is distinct from old.raw_input
      ) then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_PROVENANCE_IMMUTABLE';
    end if;
  end if;

  if new.source_share_message_id is not null then
    select message.user_id, message.project_id, message.author_type, message.body
      into v_message_user_id, v_message_project_id, v_message_author_type, v_message_body
      from public.share_messages as message
      where message.id = new.source_share_message_id;

    if v_message_user_id is null then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_NOT_FOUND';
    end if;

    if v_message_author_type <> 'client' then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_NOT_CLIENT_AUTHORED';
    end if;

    if v_message_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_OWNER_MISMATCH';
    end if;

    if v_message_project_id <> new.project_id then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_PROJECT_MISMATCH';
    end if;

    if new.raw_input is distinct from v_message_body then
      raise exception using errcode = 'P0001', message = 'PROJECT_UPDATE_SOURCE_MESSAGE_BODY_MISMATCH';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_share_browser_session_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'UPDATE' then
    if new.session_digest is distinct from old.session_digest then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_DIGEST_IMMUTABLE';
    end if;

    if new.digest_version is distinct from old.digest_version then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_DIGEST_VERSION_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_CREATED_AT_IMMUTABLE';
    end if;

    if new.expires_at is distinct from old.expires_at then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_EXPIRY_IMMUTABLE';
    end if;

    if new.last_seen_at is null
      or new.last_seen_at < old.last_seen_at then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_LAST_SEEN_AT_DECREASE';
    end if;

    if old.revoked_at is not null
      and (
        new.revoked_at is null
        or new.revoked_at < old.revoked_at
      ) then
      raise exception using errcode = 'P0001', message = 'SHARE_SESSION_REVOCATION_IRREVERSIBLE';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_share_link_resource_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_resource_user_id uuid;
  v_resource_project_id uuid;
  v_resource_task_id bigint;
  v_task_user_id uuid;
  v_task_project_id uuid;
  v_relationship_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_relationship_changed := true;
  else
    v_relationship_changed :=
      new.user_id is distinct from old.user_id
      or new.share_link_id is distinct from old.share_link_id
      or new.resource_id is distinct from old.resource_id;
  end if;

  if not v_relationship_changed then
    return new;
  end if;

  select link.user_id, link.project_id
    into v_link_user_id, v_link_project_id
    from public.project_share_links as link
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_OWNER_MISMATCH';
  end if;

  select resource.user_id, resource.project_id, resource.task_id
    into v_resource_user_id, v_resource_project_id, v_resource_task_id
    from public.task_resources as resource
    where resource.id = new.resource_id;

  if v_resource_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_NOT_FOUND';
  end if;

  if v_resource_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_NOT_OWNED';
  end if;

  if v_resource_project_id is null and v_resource_task_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_RELATIONSHIP_INVALID';
  end if;

  if v_resource_project_id is not null
    and v_resource_project_id <> v_link_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_PROJECT_MISMATCH';
  end if;

  if v_resource_task_id is not null then
    select task.user_id, task.project_id
      into v_task_user_id, v_task_project_id
      from public.tasks as task
      where task.id = v_resource_task_id;

    if v_task_user_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_RELATIONSHIP_INVALID';
    end if;

    if v_task_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_NOT_OWNED';
    end if;

    if v_task_project_id is null
      or v_task_project_id <> v_link_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_TASK_PROJECT_MISMATCH';
    end if;

    if v_resource_project_id is not null
      and v_resource_project_id <> v_task_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_RESOURCE_RELATIONSHIP_INVALID';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_share_link_task_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_task_user_id uuid;
  v_task_project_id uuid;
  v_task_deleted_at timestamptz;
  v_relationship_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_relationship_changed := true;
  else
    v_relationship_changed :=
      new.user_id is distinct from old.user_id
      or new.share_link_id is distinct from old.share_link_id
      or new.subtask_id is distinct from old.subtask_id;
  end if;

  if not v_relationship_changed then
    return new;
  end if;

  select link.user_id, link.project_id
    into v_link_user_id, v_link_project_id
    from public.project_share_links as link
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_OWNER_MISMATCH';
  end if;

  select task.user_id, task.project_id, task.deleted_at
    into v_task_user_id, v_task_project_id, v_task_deleted_at
    from public.tasks as task
    where task.id = new.subtask_id;

  if v_task_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_NOT_FOUND';
  end if;

  if v_task_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_NOT_OWNED';
  end if;

  if v_task_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_DELETED';
  end if;

  if v_task_project_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_WITHOUT_PROJECT';
  end if;

  if v_task_project_id <> v_link_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_TASK_PROJECT_MISMATCH';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_share_link_update_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_link_user_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.share_link_id is distinct from old.share_link_id
      or new.user_id is distinct from old.user_id
      or new.body is distinct from old.body
      or new.version is distinct from old.version
      or new.published_at is distinct from old.published_at
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_IMMUTABLE';
    end if;

    return new;
  end if;

  select link.user_id
    into v_link_user_id
    from public.project_share_links as link
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_OWNER_MISMATCH';
  end if;

  if new.created_by <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_UPDATE_CREATED_BY_MISMATCH';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_share_message_conversion_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_message_author_type text;
  v_update_user_id uuid;
  v_update_project_id uuid;
  v_task_user_id uuid;
  v_task_project_id uuid;
begin
  select message.user_id, message.project_id, message.author_type
    into v_message_user_id, v_message_project_id, v_message_author_type
    from public.share_messages as message
    where message.id = new.message_id;

  if v_message_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_FOUND';
  end if;

  if v_message_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_OWNER_MISMATCH';
  end if;

  if v_message_author_type <> 'client' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED';
  end if;

  if new.converted_by <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_ACTOR_MISMATCH';
  end if;

  if auth.uid() is distinct from new.converted_by then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_ACTOR_NOT_AUTHENTICATED';
  end if;

  if new.project_update_id is not null then
    select project_update.user_id, project_update.project_id
      into v_update_user_id, v_update_project_id
      from public.project_updates as project_update
      where project_update.id = new.project_update_id;

    if v_update_user_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_FOUND';
    end if;

    if v_update_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_OWNED';
    end if;

    if v_update_project_id <> v_message_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_PROJECT_MISMATCH';
    end if;
  end if;

  if new.target_task_id is not null then
    select task.user_id, task.project_id
      into v_task_user_id, v_task_project_id
      from public.tasks as task
      where task.id = new.target_task_id;

    if v_task_user_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_TASK_NOT_FOUND';
    end if;

    if v_task_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_TASK_NOT_OWNED';
    end if;

    if v_task_project_id is null
      or v_task_project_id <> v_message_project_id then
      raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_TASK_PROJECT_MISMATCH';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_share_message_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_link_state text;
  v_link_comments_enabled boolean;
  v_link_expires_at timestamptz;
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_parent_share_link_id uuid;
  v_parent_user_id uuid;
  v_parent_is_visible_to_client boolean;
begin
  if tg_op = 'UPDATE' then
    if new.share_link_id is distinct from old.share_link_id
      or new.user_id is distinct from old.user_id
      or new.project_id is distinct from old.project_id
      or new.parent_id is distinct from old.parent_id
      or new.author_type is distinct from old.author_type
      or new.author_display_name is distinct from old.author_display_name
      or new.body is distinct from old.body
      or new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_IMMUTABLE';
    end if;

    return new;
  end if;

  select
      link.user_id,
      link.project_id,
      link.state,
      link.comments_enabled,
      link.expires_at,
      project.id,
      project.deleted_at
    into
      v_link_user_id,
      v_link_project_id,
      v_link_state,
      v_link_comments_enabled,
      v_link_expires_at,
      v_project_id,
      v_project_deleted_at
    from public.project_share_links as link
    left join public.projects as project
      on project.id = link.project_id
    where link.id = new.share_link_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_LINK_NOT_FOUND';
  end if;

  if v_link_user_id <> new.user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_OWNER_MISMATCH';
  end if;

  if new.project_id <> v_link_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PROJECT_MISMATCH';
  end if;

  if new.author_type = 'owner' then
    if auth.uid() is distinct from new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_OWNER_AUTHOR_NOT_AUTHENTICATED';
    end if;
  elsif new.author_type = 'client' then
    if current_role <> 'service_role' then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_AUTHOR_REQUIRES_SERVICE_ROLE';
    end if;

    if v_link_state <> 'active' then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_LINK_NOT_ACTIVE';
    end if;

    if not v_link_comments_enabled then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_COMMENTS_DISABLED';
    end if;

    if v_link_expires_at is not null and v_link_expires_at <= now() then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_LINK_EXPIRED';
    end if;

    if v_project_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_PROJECT_NOT_FOUND';
    end if;

    if v_project_deleted_at is not null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_PROJECT_DELETED';
    end if;

    if new.status <> 'new' then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_STATUS_INVALID';
    end if;

    if new.reviewed_at is not null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_REVIEWED_AT_FORBIDDEN';
    end if;

    if new.resolved_at is not null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_RESOLVED_AT_FORBIDDEN';
    end if;

    if new.is_visible_to_client is not true then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_VISIBILITY_INVALID';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_AUTHOR_TYPE_INVALID';
  end if;

  if new.parent_id is not null then
    select parent.share_link_id, parent.user_id, parent.is_visible_to_client
      into v_parent_share_link_id, v_parent_user_id, v_parent_is_visible_to_client
      from public.share_messages as parent
      where parent.id = new.parent_id;

    if v_parent_share_link_id is null then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_NOT_FOUND';
    end if;

    if v_parent_share_link_id <> new.share_link_id then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_LINK_MISMATCH';
    end if;

    if v_parent_user_id <> new.user_id then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_OWNER_MISMATCH';
    end if;

    if new.author_type = 'client'
      and v_parent_is_visible_to_client is not true then
      raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_CLIENT_PARENT_NOT_VISIBLE';
    end if;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.enforce_share_session_grant_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_session_expires_at timestamptz;
  v_session_revoked_at timestamptz;
  v_link_state text;
  v_link_expires_at timestamptz;
  v_link_configuration_version integer;
  v_link_access_epoch integer;
  v_link_pin_epoch integer;
  v_link_requires_pin boolean;
  v_project_id uuid;
  v_project_deleted_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.browser_session_id is distinct from old.browser_session_id then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_IMMUTABLE';
    end if;

    if new.share_link_id is distinct from old.share_link_id then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_IMMUTABLE';
    end if;

    if new.granted_configuration_version is distinct from old.granted_configuration_version then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CONFIGURATION_VERSION_IMMUTABLE';
    end if;

    if new.granted_access_epoch is distinct from old.granted_access_epoch then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_ACCESS_EPOCH_IMMUTABLE';
    end if;

    if new.granted_pin_epoch is distinct from old.granted_pin_epoch then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_EPOCH_IMMUTABLE';
    end if;

    if new.pin_verified_at is distinct from old.pin_verified_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_IMMUTABLE';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CREATED_AT_IMMUTABLE';
    end if;

    if new.expires_at is distinct from old.expires_at then
      raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_IMMUTABLE';
    end if;

    if old.revoked_at is not null then
      if new.revoked_at is null then
        raise exception using errcode = 'P0001', message = 'SHARE_GRANT_REVOCATION_IRREVERSIBLE';
      end if;

      if new.revoked_at is distinct from old.revoked_at then
        raise exception using errcode = 'P0001', message = 'SHARE_GRANT_REVOCATION_IMMUTABLE';
      end if;
    end if;

    return new;
  end if;

  select browser_session.expires_at, browser_session.revoked_at
    into v_session_expires_at, v_session_revoked_at
    from public.share_browser_sessions as browser_session
    where browser_session.id = new.browser_session_id;

  if v_session_expires_at is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_NOT_FOUND';
  end if;

  if v_session_revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_REVOKED';
  end if;

  if v_session_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_SESSION_EXPIRED';
  end if;

  select
      link.state,
      link.expires_at,
      link.configuration_version,
      link.access_epoch,
      link.pin_epoch,
      link.pin_hash is not null,
      project.id,
      project.deleted_at
    into
      v_link_state,
      v_link_expires_at,
      v_link_configuration_version,
      v_link_access_epoch,
      v_link_pin_epoch,
      v_link_requires_pin,
      v_project_id,
      v_project_deleted_at
    from public.project_share_links as link
    left join public.projects as project
      on project.id = link.project_id
    where link.id = new.share_link_id;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_NOT_FOUND';
  end if;

  if v_project_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PROJECT_NOT_FOUND';
  end if;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PROJECT_DELETED';
  end if;

  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_NOT_ACTIVE';
  end if;

  if v_link_expires_at is not null and v_link_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_LINK_EXPIRED';
  end if;

  if new.granted_configuration_version <> v_link_configuration_version then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_CONFIGURATION_VERSION_STALE';
  end if;

  if new.granted_access_epoch <> v_link_access_epoch then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_ACCESS_EPOCH_STALE';
  end if;

  if new.granted_pin_epoch <> v_link_pin_epoch then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_EPOCH_STALE';
  end if;

  if new.expires_at > v_session_expires_at then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_EXPIRY_EXCEEDS_SESSION';
  end if;

  -- SHARE_GRANT_EXPIRY_EXCEEDS_LINK (comparing new.expires_at against
  -- v_link_expires_at) is deliberately REMOVED here -- see this
  -- migration's own header "EXPIRY STALENESS" section. Grant expiry is
  -- now derived purely from browser-session expiry
  -- (lib/share/share-session-grant.server.ts's computeGrantExpiresAt);
  -- the link's own expiry remains fully, independently enforced by the
  -- SHARE_GRANT_LINK_EXPIRED check above (at grant-creation time) and by
  -- isShareLinkCurrentlyPubliclyActive's live check on every read.

  if v_link_requires_pin and new.pin_verified_at is null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_REQUIRED';
  end if;

  if not v_link_requires_pin and new.pin_verified_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_GRANT_PIN_VERIFICATION_UNEXPECTED';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fail_billing_checkout_creation(p_attempt_id uuid, p_lease_token uuid, p_error_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_error_code text;
  v_updated_id uuid;
begin
  if p_attempt_id is null or p_lease_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CHECKOUT_ATTEMPT_LEASE';
  end if;

  v_error_code := left(
    regexp_replace(
      lower(btrim(coalesce(p_error_code, 'checkout_creation_failed'))),
      '[^a-z0-9_:-]',
      '_',
      'g'
    ),
    80
  );

  if nullif(v_error_code, '') is null then
    v_error_code := 'checkout_creation_failed';
  end if;

  update public.billing_checkout_attempts as attempt
  set
    status = 'failed',
    error_code = v_error_code,
    failed_at = now(),
    updated_at = now(),
    lease_token = null,
    lease_expires_at = null
  where attempt.id = p_attempt_id
    and attempt.status = 'creating'
    and attempt.lease_token = p_lease_token
    and attempt.lease_expires_at > now()
    and attempt.expires_at > now()
  returning attempt.id into v_updated_id;

  return v_updated_id is not null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fail_homepage_demo_processing(p_attempt_id uuid, p_capacity_lease_token_hash text, p_failure_code text)
 RETURNS TABLE(decision text, attempt_id uuid, trial_id uuid, attempt_status text, trial_status text, provider_call_started_at timestamp with time zone, provider_call_completed_at timestamp with time zone, lease_expires_at timestamp with time zone, idempotent boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_failure_code_pattern constant text := '^[a-z0-9_:-]{1,80}$';
  v_now timestamptz := pg_catalog.now();
  v_failure_code text := btrim(coalesce(p_failure_code, ''));
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_consumed_entitlement_count integer;
  v_released_entitlement_count integer;
  v_expired_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_failed_trial_id uuid;
  v_failed_status text;
  v_failed_risk_state text;
  v_failed_expires_at timestamptz;
  v_failed_changed boolean;
  v_provider_started boolean;
  v_expected_trial_status text;
  v_updated_count integer;
  v_exception_message text;
begin
  if p_attempt_id is null
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern
    or v_failure_code !~ v_failure_code_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
  end if;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_attempt.trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select capacity.*
  into v_capacity
  from public.homepage_demo_capacity_reservations as capacity
  where capacity.attempt_id = v_attempt.id
  for update of capacity;

  if not found or v_capacity.lease_token_hash <> p_capacity_lease_token_hash then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID';
  end if;

  if v_attempt.input_type not in ('text', 'image')
    or v_attempt.estimated_cost_units <= 0
    or v_capacity.workload_type <> v_attempt.input_type
    or v_capacity.reserved_units <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select cost.*
  into v_cost
  from public.homepage_demo_cost_reservations as cost
  where cost.attempt_id = v_attempt.id
  for update of cost;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_cost.reserved_units <= 0
    or v_cost.reserved_units <> v_attempt.estimated_cost_units then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_hour_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_day_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select
    count(*)::integer,
    count(*) filter (where locked_entitlements.status = 'reserved')::integer,
    count(*) filter (where locked_entitlements.status = 'consumed')::integer,
    count(*) filter (where locked_entitlements.status = 'released')::integer,
    count(*) filter (where locked_entitlements.status = 'expired')::integer,
    count(*) filter (where locked_entitlements.scope = 'session')::integer,
    count(*) filter (where locked_entitlements.scope = 'device')::integer
  into
    v_entitlement_count,
    v_reserved_entitlement_count,
    v_consumed_entitlement_count,
    v_released_entitlement_count,
    v_expired_entitlement_count,
    v_session_entitlement_count,
    v_device_entitlement_count
  from (
    select entitlement.status, entitlement.scope
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.attempt_id = v_attempt.id
    order by entitlement.scope
    for update of entitlement
  ) as locked_entitlements;

  if v_entitlement_count <> 2
    or v_session_entitlement_count <> 1
    or v_device_entitlement_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.provider_call_started_at is null
    and v_cost.provider_call_started_at is null then
    v_provider_started := false;
  elsif v_attempt.provider_call_started_at is not null
    and v_cost.provider_call_started_at is not null
    and v_attempt.provider_call_started_at = v_cost.provider_call_started_at then
    v_provider_started := true;
  else
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.status = 'failed' then
    if v_trial.status <> 'failed'
      or v_attempt.decision_code is distinct from v_failure_code
      or v_trial.failure_code is distinct from v_failure_code
      or v_capacity.status <> 'released'
      or v_capacity.released_at is null
      or v_capacity.expired_at is not null
      or v_released_entitlement_count <> 2
      or v_reserved_entitlement_count <> 0
      or v_consumed_entitlement_count <> 0
      or v_expired_entitlement_count <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    if v_provider_started then
      if v_attempt.provider_call_completed_at is null
        or v_cost.status <> 'finalized'
        or v_cost.finalized_units is null
        or v_cost.finalized_units is distinct from v_cost.reserved_units
        or v_cost.finalized_at is null
        or v_cost.released_at is not null
        or v_cost.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
      end if;
    else
      if v_attempt.provider_call_completed_at is not null
        or v_cost.status <> 'released'
        or v_cost.finalized_units is not null
        or v_cost.finalized_at is not null
        or v_cost.released_at is null
        or v_cost.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
      end if;
    end if;

    return query
      select
        'failed'::text,
        v_attempt.id,
        v_trial.id,
        v_attempt.status,
        v_trial.status,
        v_attempt.provider_call_started_at,
        v_attempt.provider_call_completed_at,
        v_capacity.lease_expires_at,
        true;
    return;
  end if;

  if v_attempt.status = 'review_ready'
    or v_trial.status = 'review_ready' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_capacity.status <> 'active'
    or v_cost.status <> 'reserved'
    or v_capacity.released_at is not null
    or v_capacity.expired_at is not null
    or v_cost.finalized_units is not null
    or v_cost.finalized_at is not null
    or v_cost.released_at is not null
    or v_cost.expired_at is not null
    or v_hour_bucket.reserved_units < v_cost.reserved_units
    or v_day_bucket.reserved_units < v_cost.reserved_units
    or v_reserved_entitlement_count <> 2
    or v_consumed_entitlement_count <> 0
    or v_released_entitlement_count <> 0
    or v_expired_entitlement_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_provider_started then
    if v_attempt.status <> 'processing'
      or v_trial.status <> 'processing'
      or v_trial.risk_state <> 'allowed'
      or v_cost.provider_call_started_at is null
      or v_attempt.provider_call_completed_at is not null
      or v_attempt.review_ready_at is not null then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    v_expected_trial_status := 'processing';
  else
    if v_attempt.status <> 'admitted'
      or v_trial.status <> 'queued'
      or v_trial.risk_state <> 'allowed'
      or v_cost.provider_call_started_at is not null
      or v_attempt.provider_call_completed_at is not null
      or v_attempt.review_ready_at is not null then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    v_expected_trial_status := 'queued';
  end if;

  select failed.trial_id,
    failed.status,
    failed.risk_state,
    failed.expires_at,
    failed.changed
  into
    v_failed_trial_id,
    v_failed_status,
    v_failed_risk_state,
    v_failed_expires_at,
    v_failed_changed
  from public.fail_homepage_demo_trial(
    v_trial.id,
    v_expected_trial_status,
    v_failure_code
  ) as failed;

  if v_failed_trial_id <> v_trial.id
    or v_failed_status <> 'failed'
    or v_failed_changed is not true then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_provider_started then
    update public.homepage_demo_admission_attempts as attempt
    set
      status = 'failed',
      decision_code = v_failure_code,
      provider_call_completed_at = v_now
    where attempt.id = v_attempt.id
      and attempt.status = 'processing'
      and attempt.provider_call_started_at is not null
      and attempt.provider_call_completed_at is null
      and attempt.review_ready_at is null
    returning attempt.* into v_attempt;
  else
    update public.homepage_demo_admission_attempts as attempt
    set
      status = 'failed',
      decision_code = v_failure_code
    where attempt.id = v_attempt.id
      and attempt.status = 'admitted'
      and attempt.provider_call_started_at is null
      and attempt.provider_call_completed_at is null
      and attempt.review_ready_at is null
    returning attempt.* into v_attempt;
  end if;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_trial_entitlements as entitlement
  set
    status = 'released',
    trial_id = null,
    consumed_at = null,
    released_at = v_now
  where entitlement.attempt_id = v_attempt.id
    and entitlement.status = 'reserved';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_capacity_reservations as capacity
  set
    status = 'released',
    released_at = v_now,
    expired_at = null
  where capacity.id = v_capacity.id
    and capacity.status = 'active'
  returning capacity.* into v_capacity;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_provider_started then
    update public.homepage_demo_cost_buckets as bucket
    set
      reserved_units = bucket.reserved_units - v_cost.reserved_units,
      spent_units = bucket.spent_units + v_cost.reserved_units
    where bucket.id = v_cost.hour_bucket_id
      and bucket.window_kind = 'hour'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_buckets as bucket
    set
      reserved_units = bucket.reserved_units - v_cost.reserved_units,
      spent_units = bucket.spent_units + v_cost.reserved_units
    where bucket.id = v_cost.day_bucket_id
      and bucket.window_kind = 'day'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_reservations as cost
    set
      status = 'finalized',
      finalized_units = cost.reserved_units,
      finalized_at = v_now,
      released_at = null,
      expired_at = null
    where cost.id = v_cost.id
      and cost.status = 'reserved'
      and cost.finalized_units is null
      and cost.finalized_at is null
      and cost.released_at is null
      and cost.expired_at is null
    returning cost.* into v_cost;
  else
    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units - v_cost.reserved_units
    where bucket.id = v_cost.hour_bucket_id
      and bucket.window_kind = 'hour'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_buckets as bucket
    set reserved_units = bucket.reserved_units - v_cost.reserved_units
    where bucket.id = v_cost.day_bucket_id
      and bucket.window_kind = 'day'
      and bucket.reserved_units >= v_cost.reserved_units;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    update public.homepage_demo_cost_reservations as cost
    set
      status = 'released',
      finalized_units = null,
      finalized_at = null,
      released_at = v_now,
      expired_at = null
    where cost.id = v_cost.id
      and cost.status = 'reserved'
      and cost.finalized_units is null
      and cost.finalized_at is null
      and cost.released_at is null
      and cost.expired_at is null
    returning cost.* into v_cost;
  end if;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  v_trial.status := v_failed_status;

  return query
    select
      'failed'::text,
      v_attempt.id,
      v_trial.id,
      v_attempt.status,
      v_trial.status,
      v_attempt.provider_call_started_at,
      v_attempt.provider_call_completed_at,
      v_capacity.lease_expires_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED',
      'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    if v_exception_message in (
      'INVALID_HOMEPAGE_DEMO_TRIAL_ID',
      'INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS',
      'INVALID_HOMEPAGE_DEMO_FAILURE_CODE'
    ) then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_TRIAL_NOT_FOUND',
      'HOMEPAGE_DEMO_TRIAL_EXPIRED',
      'HOMEPAGE_DEMO_FAILURE_CONFLICT'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.fail_homepage_demo_trial(p_trial_id uuid, p_expected_status text, p_failure_code text)
 RETURNS TABLE(trial_id uuid, status text, risk_state text, expires_at timestamp with time zone, changed boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_failure_code text := btrim(coalesce(p_failure_code, ''));
begin
  if p_trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_TRIAL_ID';
  end if;

  if p_expected_status not in (
    'created',
    'validating',
    'queued',
    'processing'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EXPECTED_STATUS';
  end if;

  if char_length(v_failure_code) = 0
    or char_length(v_failure_code) > 80
    or v_failure_code !~ '^[a-z0-9_:-]+$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_FAILURE_CODE';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = p_trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_NOT_FOUND';
  end if;

  if v_trial.status = 'failed' then
    if v_trial.failure_code = v_failure_code then
      return query
        select
          v_trial.id,
          v_trial.status,
          v_trial.risk_state,
          v_trial.expires_at,
          false;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_FAILURE_CONFLICT';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_TRIAL_EXPIRED';
  end if;

  if v_trial.status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_FAILURE_CONFLICT';
  end if;

  update public.homepage_demo_trials as trial
  set
    status = 'failed',
    failure_code = v_failure_code
  where trial.id = v_trial.id
  returning trial.* into v_trial;

  return query
    select
      v_trial.id,
      v_trial.status,
      v_trial.risk_state,
      v_trial.expires_at,
      true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_share_message_conversion(p_message_id uuid, p_project_update_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_update_status text;
  v_update_source_type text;
  v_update_source_share_message_id uuid;
  v_update_project_id uuid;
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_message_author_type text;
  v_message_status text;
  v_converted_at timestamptz := now();
  v_affected_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  -- Phase 6C security correction: this transaction-local, row-bound
  -- capability is the FIRST check, before any other validation. It can
  -- only be 'on' for this exact p_project_update_id inside the one
  -- transaction where apply_project_update_transaction itself set it,
  -- immediately before performing the real, authoritative applied
  -- transition for that row. A standalone call to this function, in its
  -- own separate transaction, never has this capability set -- closing
  -- the forged-applied standalone-invocation attack the Phase 6C security
  -- audit found, independent of whatever project_updates.status reads as.
  if current_setting('text2task.client_share_apply_update_id', true)
      is distinct from p_project_update_id::text then
    raise exception using
      errcode = 'P0001',
      message = 'SHARE_CONVERSION_APPLY_CONTEXT_REQUIRED';
  end if;

  select
    update_row.status,
    update_row.source_type,
    update_row.source_share_message_id,
    update_row.project_id
    into
      v_update_status,
      v_update_source_type,
      v_update_source_share_message_id,
      v_update_project_id
    from public.project_updates as update_row
    where update_row.id = p_project_update_id
      and update_row.user_id = v_user_id
    for update;

  if v_update_status is null then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_FOUND';
  end if;

  if v_update_status <> 'applied' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_APPLIED';
  end if;

  if v_update_source_type <> 'client_share' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_NOT_CLIENT_SHARE';
  end if;

  if v_update_source_share_message_id is distinct from p_message_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_MISMATCH';
  end if;

  select
    message.user_id,
    message.project_id,
    message.author_type,
    message.status
    into
      v_message_user_id,
      v_message_project_id,
      v_message_author_type,
      v_message_status
    from public.share_messages as message
    where message.id = p_message_id
      and message.user_id = v_user_id
    for update;

  if v_message_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_FOUND';
  end if;

  if v_message_project_id is distinct from v_update_project_id then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_UPDATE_PROJECT_MISMATCH';
  end if;

  if v_message_author_type <> 'client' then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_NOT_CLIENT_AUTHORED';
  end if;

  if v_message_status = 'converted' then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_TERMINAL';
  end if;

  insert into public.share_message_conversions (
    user_id,
    message_id,
    project_update_id,
    target_task_id,
    converted_by,
    converted_at
  ) values (
    v_user_id,
    p_message_id,
    p_project_update_id,
    null,
    v_user_id,
    v_converted_at
  );

  update public.share_messages
    set
      status = 'converted',
      reviewed_at = coalesce(reviewed_at, v_converted_at)
    where id = p_message_id
      and user_id = v_user_id;

  get diagnostics v_affected_count = row_count;

  if v_affected_count <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_CONVERSION_MESSAGE_UPDATE_FAILED';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_homepage_demo_review_draft(p_public_token_hash text, p_session_token_hash text)
 RETURNS TABLE(trial_id uuid, draft_id uuid, input_type text, trial_status text, draft_status text, normalized_result jsonb, edited_result jsonb, expires_at timestamp with time zone, draft_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_ACCESS_HASH';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.public_token_hash = p_public_token_hash
    and trial.session_token_hash = p_session_token_hash;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.status <> 'review_ready'
    or v_trial.risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.status <> 'ready' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  return query
    select
      v_trial.id,
      v_draft.id,
      v_trial.input_type,
      v_trial.status,
      v_draft.status,
      v_draft.normalized_result,
      v_draft.edited_result,
      least(v_trial.expires_at, v_draft.expires_at),
      v_draft.updated_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_owner_authenticated_activity_summary(p_user_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with scoped_ids as (
    select distinct scoped_id.value as user_id
    from unnest(p_user_ids[1:2000]) as scoped_id(value)
    where scoped_id.value is not null
  ),
  scoped_events as (
    select
      event_row.id,
      event_row.user_id,
      event_row.event_name,
      event_row.route,
      event_row.created_at,
      (event_row.created_at at time zone 'Asia/Jerusalem')::date as israel_date
    from public.authenticated_product_events as event_row
    where event_row.user_id in (select scoped_id.user_id from scoped_ids as scoped_id)
  ),
  latest_event as (
    select distinct on (scoped_event.user_id)
      scoped_event.user_id,
      scoped_event.created_at as last_seen_at,
      scoped_event.route as last_viewed_route,
      scoped_event.event_name as last_event_name
    from scoped_events as scoped_event
    order by
      scoped_event.user_id,
      scoped_event.created_at desc,
      scoped_event.id desc
  ),
  activity_summary as (
    select
      scoped_event.user_id,
      count(*)::bigint as total_authenticated_views,
      count(distinct scoped_event.israel_date)::bigint as distinct_active_days
    from scoped_events as scoped_event
    group by scoped_event.user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', summary_row.user_id,
        'last_seen_at', latest_row.last_seen_at,
        'last_viewed_route', latest_row.last_viewed_route,
        'last_event_name', latest_row.last_event_name,
        'total_authenticated_views', summary_row.total_authenticated_views,
        'distinct_active_days', summary_row.distinct_active_days,
        'is_returning', summary_row.distinct_active_days > 1
      )
      order by latest_row.last_seen_at desc nulls last, summary_row.user_id desc
    ),
    '[]'::jsonb
  )
  from activity_summary as summary_row
  join latest_event as latest_row on latest_row.user_id = summary_row.user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_owner_product_activation_analytics()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with project_stats as (
    select
      project_row.user_id,
      count(*)::bigint as project_count,
      min(project_row.created_at) as first_project_saved_at
    from public.projects as project_row
    where project_row.user_id is not null
    group by project_row.user_id
  ),
  summary as (
    select
      (select count(*)::bigint from public.users) as total_users,
      (select count(*)::bigint from public.projects) as total_projects,
      (
        select count(*)::bigint
        from public.users as app_user
        where exists (
          select 1
          from project_stats as project_stat
          where project_stat.user_id = app_user.id
        )
      ) as activated_users
  ),
  recent_users as (
    select
      app_user.id as user_id,
      app_user.created_at as signup_at,
      coalesce(project_stat.project_count, 0)::bigint as project_count,
      project_stat.first_project_saved_at
    from public.users as app_user
    left join project_stats as project_stat
      on project_stat.user_id = app_user.id
    order by app_user.created_at desc nulls last, app_user.id desc
    limit 25
  )
  select jsonb_build_object(
    'summary',
    jsonb_build_object(
      'total_users', summary.total_users,
      'total_projects', summary.total_projects,
      'activated_users', summary.activated_users,
      'not_activated_users', greatest(summary.total_users - summary.activated_users, 0)
    ),
    'recent_users',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', recent_user.user_id,
            'signup_at', recent_user.signup_at,
            'project_count', recent_user.project_count,
            'first_project_saved_at', recent_user.first_project_saved_at
          )
          order by recent_user.signup_at desc nulls last, recent_user.user_id desc
        )
        from recent_users as recent_user
      ),
      '[]'::jsonb
    )
  )
  from summary;
$function$;

CREATE OR REPLACE FUNCTION public.get_owner_user_activity_report(p_limit integer DEFAULT 2000)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with project_stats as (
    select
      project_row.user_id,
      count(*)::bigint as project_count,
      min(project_row.created_at) as first_project_at,
      max(project_row.created_at) as last_project_at
    from public.projects as project_row
    where project_row.user_id is not null
    group by project_row.user_id
  ),
  report_rows as (
    select
      app_user.id,
      app_user.plan,
      app_user.subscription_status,
      app_user.extract_count,
      app_user.successful_extract_count,
      app_user.last_extract_at,
      app_user.last_dashboard_seen_at,
      app_user.created_at as profile_created_at,
      coalesce(project_stat.project_count, 0)::bigint as project_count,
      project_stat.first_project_at,
      project_stat.last_project_at
    from public.users as app_user
    left join project_stats as project_stat
      on project_stat.user_id = app_user.id
    order by app_user.created_at desc nulls last, app_user.id desc
    limit least(greatest(p_limit, 0), 2000)
  )
  select jsonb_build_object(
    'total_profiles', (select count(*)::bigint from public.users),
    'rows',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', report_row.id,
            'plan', report_row.plan,
            'subscription_status', report_row.subscription_status,
            'extract_count', report_row.extract_count,
            'successful_extract_count', report_row.successful_extract_count,
            'last_extract_at', report_row.last_extract_at,
            'last_dashboard_seen_at', report_row.last_dashboard_seen_at,
            'profile_created_at', report_row.profile_created_at,
            'project_count', report_row.project_count,
            'first_project_at', report_row.first_project_at,
            'last_project_at', report_row.last_project_at
          )
          order by report_row.profile_created_at desc nulls last, report_row.id desc
        )
        from report_rows as report_row
      ),
      '[]'::jsonb
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_owner_user_activity_timeline(p_user_id uuid, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with timeline_rows as (
    select
      event_row.id,
      event_row.created_at,
      event_row.event_name,
      event_row.route,
      event_row.entity_type,
      event_row.entity_id
    from public.authenticated_product_events as event_row
    where event_row.user_id = p_user_id
    order by event_row.created_at desc, event_row.id desc
    limit least(greatest(p_limit, 0), 500)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'created_at', timeline_row.created_at,
        'event_name', timeline_row.event_name,
        'route', timeline_row.route,
        'entity_type', timeline_row.entity_type,
        'entity_id', timeline_row.entity_id
      )
      order by timeline_row.created_at desc, timeline_row.id desc
    ),
    '[]'::jsonb
  )
  from timeline_rows as timeline_row;
$function$;

CREATE OR REPLACE FUNCTION public.get_share_link_management_state(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_project_owner uuid;
  v_project_deleted_at timestamptz;
  v_link_id uuid;
  v_public_id text;
  v_state text;
  v_expires_at timestamptz;
  v_pin_hash text;
  v_comments_enabled boolean;
  v_client_facing_subtitle text;
  v_content_direction text;
  v_title_visible boolean;
  v_status_visible boolean;
  v_target_date_visible boolean;
  v_configuration_version integer;
  v_created_at timestamptz;
  v_activated_at timestamptz;
  v_disabled_at timestamptz;
  v_rotated_at timestamptz;
  v_last_viewed_at timestamptz;
  v_view_count integer;
  v_mapped_tasks jsonb;
  v_mapped_resources jsonb;
  v_current_update jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_project_id is null then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  select project.user_id, project.deleted_at
    into v_project_owner, v_project_deleted_at
    from public.projects as project
    where project.id = p_project_id;

  if v_project_owner is null
    or v_project_owner <> v_user_id
    or v_project_deleted_at is not null
  then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  -- Deterministic V1 managed-link selection: prefer the active link;
  -- otherwise the most recently updated non-revoked link.
  select
      link.id, link.public_id, link.state, link.expires_at, link.pin_hash,
      link.comments_enabled, link.client_facing_subtitle, link.content_direction,
      link.title_visible, link.status_visible, link.target_date_visible,
      link.configuration_version, link.created_at, link.activated_at,
      link.disabled_at, link.rotated_at, link.last_viewed_at, link.view_count
    into
      v_link_id, v_public_id, v_state, v_expires_at, v_pin_hash,
      v_comments_enabled, v_client_facing_subtitle, v_content_direction,
      v_title_visible, v_status_visible, v_target_date_visible,
      v_configuration_version, v_created_at, v_activated_at,
      v_disabled_at, v_rotated_at, v_last_viewed_at, v_view_count
    from public.project_share_links as link
    where link.project_id = p_project_id
      and link.user_id = v_user_id
      and link.state <> 'revoked'
    order by
      (link.state = 'active') desc,
      link.updated_at desc,
      link.created_at desc,
      link.id desc
    limit 1;

  if v_link_id is null then
    return jsonb_build_object(
      'link', null,
      'mappedTasks', '[]'::jsonb,
      'mappedResources', '[]'::jsonb,
      'currentUpdate', null
    );
  end if;

  -- subtask_id is bigint; cast to text so it is never round-tripped as a
  -- JSON number, which could silently lose precision for large ids.
  -- public_group/waiting_for_client_feedback/display_order are the
  -- owner's own persisted per-item mapping metadata -- never a copy of
  -- the task's internal title, status, deadline, amount or priority.
  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subtaskId', task.subtask_id::text,
          'publicGroup', task.public_group,
          'waitingForClientFeedback', task.waiting_for_client_feedback,
          'displayOrder', task.display_order
        )
        order by task.display_order, task.subtask_id
      ),
      '[]'::jsonb
    )
    into v_mapped_tasks
    from public.share_link_tasks as task
    where task.share_link_id = v_link_id
      and task.user_id = v_user_id;

  -- public_label/can_download/display_order are the owner's own
  -- persisted per-item mapping metadata -- never a copy of the
  -- Resource's storage_path, file_name, url, mime_type, size_bytes or
  -- notes.
  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'resourceId', resource.resource_id,
          'publicLabel', resource.public_label,
          'canDownload', resource.can_download,
          'displayOrder', resource.display_order
        )
        order by resource.display_order, resource.resource_id
      ),
      '[]'::jsonb
    )
    into v_mapped_resources
    from public.share_link_resources as resource
    where resource.share_link_id = v_link_id
      and resource.user_id = v_user_id;

  select jsonb_build_object('body', upd.body, 'version', upd.version, 'publishedAt', upd.published_at)
    into v_current_update
    from public.share_link_updates as upd
    where upd.share_link_id = v_link_id
      and upd.user_id = v_user_id
      and upd.is_current
    limit 1;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'id', v_link_id,
      'publicId', v_public_id,
      'state', v_state,
      'expiresAt', v_expires_at,
      'hasPin', v_pin_hash is not null,
      'commentsEnabled', v_comments_enabled,
      'clientFacingSubtitle', v_client_facing_subtitle,
      'contentDirection', v_content_direction,
      'titleVisible', v_title_visible,
      'statusVisible', v_status_visible,
      'targetDateVisible', v_target_date_visible,
      'configurationVersion', v_configuration_version,
      'createdAt', v_created_at,
      'activatedAt', v_activated_at,
      'disabledAt', v_disabled_at,
      'rotatedAt', v_rotated_at,
      'lastViewedAt', v_last_viewed_at,
      'viewCount', v_view_count
    ),
    'mappedTasks', v_mapped_tasks,
    'mappedResources', v_mapped_resources,
    'currentUpdate', v_current_update
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.import_projects_transaction(p_attempt_id uuid, p_idempotency_key uuid, p_request_hash text, p_groups jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  v_now timestamptz := now();
  v_attempt public.project_import_attempts%rowtype;
  v_group jsonb;
  v_task_payload jsonb;
  v_resource_payload jsonb;
  v_client_input public.clients%rowtype;
  v_client public.clients%rowtype;
  v_project_input public.projects%rowtype;
  v_project public.projects%rowtype;
  v_task_input public.tasks%rowtype;
  v_task public.tasks%rowtype;
  v_resource_input public.task_resources%rowtype;
  v_client_json jsonb;
  v_project_context_json jsonb;
  v_created_projects jsonb := '[]'::jsonb;
  v_created_tasks jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_attempt_id is null
    or p_idempotency_key is null
    or nullif(btrim(p_request_hash), '') is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ATTEMPT';
  end if;

  if p_groups is null
    or jsonb_typeof(p_groups) <> 'array'
    or jsonb_array_length(p_groups) = 0
    or jsonb_array_length(p_groups) > 50 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_GROUPS';
  end if;

  select attempt.*
  into v_attempt
  from public.project_import_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_NOT_FOUND';
  end if;

  v_user_id := v_attempt.user_id;

  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ATTEMPT';
  end if;

  -- Serialize imports for one user so deterministic client matching does not
  -- race another keyed import for the same account.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if v_attempt.idempotency_key <> p_idempotency_key
    or v_attempt.request_hash <> p_request_hash then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_CONFLICT';
  end if;

  if v_attempt.payload_json is null
    or v_attempt.payload_json <> p_groups then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_PAYLOAD_CONFLICT';
  end if;

  if v_attempt.status <> 'started' or v_attempt.error_code is not null then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_NOT_READY';
  end if;

  for v_group in
    select group_value
    from jsonb_array_elements(p_groups) with ordinality
      as requested(group_value, group_order)
    order by group_order
  loop
    if jsonb_typeof(v_group) <> 'object'
      or jsonb_typeof(v_group->'project') <> 'object'
      or jsonb_typeof(v_group->'client') <> 'object'
      or jsonb_typeof(v_group->'tasks') <> 'array'
      or jsonb_array_length(v_group->'tasks') = 0
      or jsonb_array_length(v_group->'tasks') > 200 then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_GROUPS';
    end if;

    v_client_input := jsonb_populate_record(
      null::public.clients,
      v_group->'client'
    );
    v_project_input := jsonb_populate_record(
      null::public.projects,
      v_group->'project'
    );
    v_client := null;

    if nullif(btrim(v_client_input.name), '') is not null then
      select client.*
      into v_client
      from public.clients as client
      where client.user_id = v_user_id
        and client.name ilike v_client_input.name
      order by client.created_at asc nulls last, client.id asc
      limit 1
      for update of client;

      if found then
        if coalesce(v_client_input.contact_name, v_client.contact_name)
            is distinct from v_client.contact_name
          or coalesce(v_client_input.phone, v_client.phone)
            is distinct from v_client.phone
          or coalesce(v_client_input.email, v_client.email)
            is distinct from v_client.email
          or coalesce(v_client_input.notes, v_client.notes)
            is distinct from v_client.notes then
          update public.clients as client
          set
            contact_name = coalesce(
              v_client_input.contact_name,
              client.contact_name
            ),
            phone = coalesce(v_client_input.phone, client.phone),
            email = coalesce(v_client_input.email, client.email),
            notes = coalesce(v_client_input.notes, client.notes)
          where client.id = v_client.id
            and client.user_id = v_user_id
          returning client.* into v_client;

          if not found then
            raise exception using
              errcode = 'P0001',
              message = 'CLIENT_UPDATE_FAILED';
          end if;
        end if;
      else
        insert into public.clients (
          user_id,
          name,
          contact_name,
          phone,
          email,
          notes
        )
        values (
          v_user_id,
          v_client_input.name,
          v_client_input.contact_name,
          v_client_input.phone,
          v_client_input.email,
          v_client_input.notes
        )
        returning * into v_client;
      end if;
    end if;

    if nullif(btrim(v_project_input.title), '') is null then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_PROJECT';
    end if;

    insert into public.projects (
      user_id,
      client_id,
      client_name,
      contact_name,
      title,
      summary,
      amount,
      amount_value,
      currency_code,
      deadline_text,
      deadline_date,
      priority,
      priority_source,
      status,
      source,
      raw_input,
      is_archived,
      archived_at,
      completed_at,
      deleted_at
    )
    values (
      v_user_id,
      v_client.id,
      v_project_input.client_name,
      v_project_input.contact_name,
      v_project_input.title,
      v_project_input.summary,
      v_project_input.amount,
      v_project_input.amount_value,
      v_project_input.currency_code,
      v_project_input.deadline_text,
      v_project_input.deadline_date,
      v_project_input.priority,
      coalesce(v_project_input.priority_source, 'unknown'),
      v_project_input.status,
      v_project_input.source,
      v_project_input.raw_input,
      false,
      null,
      case
        when lower(btrim(coalesce(v_project_input.status::text, ''))) = 'done'
          then v_now
        else null
      end,
      null
    )
    returning * into v_project;

    v_created_projects := v_created_projects || jsonb_build_array(
      to_jsonb(v_project)
    );

    if v_client.id is null then
      v_client_json := 'null'::jsonb;
    else
      v_client_json := jsonb_build_object(
        'id', v_client.id,
        'name', v_client.name,
        'contact_name', v_client.contact_name,
        'phone', v_client.phone,
        'email', v_client.email,
        'notes', v_client.notes,
        'created_at', v_client.created_at
      );
    end if;

    v_project_context_json := jsonb_build_object(
      'id', v_project.id,
      'client_id', v_project.client_id,
      'client_name', v_project.client_name,
      'contact_name', v_project.contact_name,
      'title', v_project.title,
      'summary', v_project.summary,
      'amount', v_project.amount,
      'amount_value', v_project.amount_value,
      'currency_code', v_project.currency_code,
      'deadline_text', v_project.deadline_text,
      'deadline_date', v_project.deadline_date,
      'priority', v_project.priority,
      'priority_source', v_project.priority_source,
      'status', v_project.status,
      'source', v_project.source,
      'raw_input', v_project.raw_input,
      'created_at', v_project.created_at,
      'updated_at', v_project.updated_at,
      'completed_at', v_project.completed_at,
      'is_archived', v_project.is_archived,
      'archived_at', v_project.archived_at,
      'deleted_at', v_project.deleted_at
    );

    for v_task_payload in
      select task_value
      from jsonb_array_elements(v_group->'tasks') with ordinality
        as requested(task_value, task_order)
      order by task_order
    loop
      if jsonb_typeof(v_task_payload) <> 'object'
        or jsonb_typeof(v_task_payload->'resources') <> 'array' then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_TASKS';
      end if;

      v_task_input := jsonb_populate_record(
        null::public.tasks,
        v_task_payload
      );

      if nullif(btrim(v_task_input.task_title), '') is null then
        raise exception using
          errcode = 'P0001',
          message = 'INVALID_TASKS';
      end if;

      insert into public.tasks (
        user_id,
        client_name,
        contact_name,
        client_id,
        project_id,
        subtask_order,
        task_title,
        amount,
        amount_value,
        currency_code,
        deadline_text,
        deadline_date,
        priority,
        status,
        source,
        raw_input,
        is_archived,
        archived_at,
        completed_at,
        deleted_at
      )
      values (
        v_user_id,
        v_task_input.client_name,
        v_task_input.contact_name,
        v_client.id,
        v_project.id,
        v_task_input.subtask_order,
        v_task_input.task_title,
        v_task_input.amount,
        v_task_input.amount_value,
        v_task_input.currency_code,
        v_task_input.deadline_text,
        v_task_input.deadline_date,
        v_task_input.priority,
        v_task_input.status,
        v_task_input.source,
        v_task_input.raw_input,
        false,
        null,
        case
          when lower(btrim(coalesce(v_task_input.status::text, ''))) = 'done'
            then v_now
          else null
        end,
        null
      )
      returning * into v_task;

      v_created_tasks := v_created_tasks || jsonb_build_array(
        to_jsonb(v_task) || jsonb_build_object(
          'client', v_client_json,
          'project', v_project_context_json
        )
      );

      for v_resource_payload in
        select resource_value
        from jsonb_array_elements(v_task_payload->'resources') with ordinality
          as requested(resource_value, resource_order)
        order by resource_order
      loop
        if jsonb_typeof(v_resource_payload) <> 'object' then
          raise exception using
            errcode = 'P0001',
            message = 'INVALID_RESOURCES';
        end if;

        v_resource_input := jsonb_populate_record(
          null::public.task_resources,
          v_resource_payload
        );

        insert into public.task_resources (
          user_id,
          project_id,
          task_id,
          resource_type,
          title,
          url,
          storage_path,
          file_name,
          mime_type,
          size_bytes,
          notes
        )
        values (
          v_user_id,
          v_project.id,
          v_task.id,
          v_resource_input.resource_type,
          v_resource_input.title,
          v_resource_input.url,
          null,
          null,
          null,
          null,
          v_resource_input.notes
        );
      end loop;
    end loop;
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'createdProjects', v_created_projects,
    'createdTasks', v_created_tasks,
    'duplicates', '[]'::jsonb,
    'failedGroups', '[]'::jsonb
  );

  update public.project_import_attempts as attempt
  set
    status = 'committed',
    result_json = v_result,
    completed_at = v_now,
    failed_at = null,
    error_code = null,
    last_seen_at = v_now
  where attempt.id = v_attempt.id
    and attempt.user_id = v_user_id
    and attempt.status = 'started'
    and attempt.error_code is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'ATTEMPT_COMMIT_FAILED';
  end if;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_share_rate_limit_bucket(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_request_count integer;
begin
  -- Every check below mirrors an EXISTING CHECK constraint on
  -- public.share_rate_limit_buckets (202608030004) exactly, so this
  -- function can never accept a value the table itself would reject --
  -- it only ever fails closed earlier, with a stable, callable-specific
  -- message, before any write is attempted.

  if p_scope is null
    or p_scope not in ('browser_session', 'network_identity', 'share_link')
  then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_SCOPE';
  end if;

  if p_action is null
    or p_action not in (
      'session_exchange',
      'pin_verification',
      'projection_read',
      'comment_submission',
      'file_access',
      'invalid_link_access'
    )
  then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_ACTION';
  end if;

  if p_window_seconds is null or p_window_seconds not in (60, 300, 3600, 86400) then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_WINDOW';
  end if;

  if p_identity_digest is null or p_identity_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_IDENTITY_DIGEST';
  end if;

  if p_identity_digest_version is null or p_identity_digest_version <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_RATE_LIMIT_IDENTITY_DIGEST_VERSION';
  end if;

  -- Mirrors share_rate_limit_buckets_share_link_scope_check: a
  -- share_link-scoped bucket must name its link.
  if p_scope = 'share_link' and p_share_link_id is null then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT_SHARE_LINK_SCOPE_REQUIRES_LINK';
  end if;

  -- Mirrors share_rate_limit_buckets_invalid_link_action_check: an
  -- invalid-link attempt must never be attributed to a link -- attributing
  -- it would require knowing a link the caller has not proven it may
  -- reference.
  if p_action = 'invalid_link_access' and p_share_link_id is not null then
    raise exception using errcode = 'P0001', message = 'RATE_LIMIT_INVALID_LINK_ACTION_FORBIDS_LINK';
  end if;

  -- Deterministic fixed-window boundary, computed here only -- never
  -- accepted from the caller. See this migration's header for why now()
  -- (not clock_timestamp()/statement_timestamp()) is the correct choice
  -- for this single-statement function.
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_start + (p_window_seconds * interval '1 second');

  -- The one atomic statement this function exists to provide. Postgres
  -- takes a row lock on the conflicting row before applying the DO
  -- UPDATE branch, so concurrent callers targeting the same bucket
  -- (identical scope/action/identity_digest/share_link_key/window_start/
  -- window_seconds) serialize here and no increment is ever lost. Uses
  -- the table's own existing named unique constraint as the conflict
  -- target, never a re-derived column list, so this statement can never
  -- silently drift from the table's real bucket identity.
  insert into public.share_rate_limit_buckets (
    scope,
    action,
    identity_digest,
    identity_digest_version,
    share_link_id,
    window_start,
    window_seconds,
    request_count,
    expires_at
  ) values (
    p_scope,
    p_action,
    p_identity_digest,
    p_identity_digest_version,
    p_share_link_id,
    v_window_start,
    p_window_seconds,
    1,
    v_expires_at
  )
  on conflict on constraint share_rate_limit_buckets_identity_unique
  do update set
    request_count = public.share_rate_limit_buckets.request_count + 1,
    updated_at = now()
  returning public.share_rate_limit_buckets.request_count
    into v_request_count;

  -- Deliberately small: no identity digest, no share_link_id, no internal
  -- bucket id, and no `allowed` boolean -- no rate-limit threshold has
  -- been decided in this task (see this migration's header). The caller
  -- already has every input it supplied; it only needs the atomically
  -- resolved count and window metadata back.
  return jsonb_build_object(
    'requestCount', v_request_count,
    'windowStart', v_window_start,
    'windowSeconds', p_window_seconds,
    'expiresAt', v_expires_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_share_link_summaries(p_project_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_project_ids uuid[];
  v_owned_project_count integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_project_ids is null or cardinality(p_project_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_PROJECT_IDS';
  end if;

  if cardinality(p_project_ids) > 100 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_PROJECT_IDS';
  end if;

  if exists (
    select 1
      from unnest(p_project_ids) as requested(project_id)
      where requested.project_id is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_PROJECT_IDS';
  end if;

  -- Normalize (dedupe) the requested ids into a stable, deterministic order.
  select array_agg(distinct requested.project_id order by requested.project_id)
    into v_project_ids
    from unnest(p_project_ids) as requested(project_id);

  select count(*)
    into v_owned_project_count
    from public.projects as project
    where project.id = any (v_project_ids)
      and project.user_id = v_user_id
      and project.deleted_at is null;

  -- Reject the whole call rather than silently returning partial
  -- cross-tenant results if any requested project is not owned.
  if v_owned_project_count <> cardinality(v_project_ids) then
    raise exception using errcode = 'P0001', message = 'PROJECT_NOT_FOUND';
  end if;

  -- Set-based summary build: one managed link per requested project
  -- (DISTINCT ON, same active-first / most-recently-updated tiebreak as
  -- get_share_link_management_state), then grouped task/resource counts
  -- for exactly those selected links, then a single aggregate covering
  -- every requested project -- no per-project loop or per-project query.
  with requested_projects as (
    select requested.project_id
      from unnest(v_project_ids) as requested(project_id)
  ),
  managed_links as (
    select distinct on (link.project_id)
        link.project_id,
        link.id as link_id,
        link.state,
        link.expires_at,
        link.pin_hash,
        link.created_at,
        link.last_viewed_at,
        link.view_count
      from public.project_share_links as link
      where link.project_id = any (v_project_ids)
        and link.user_id = v_user_id
        and link.state <> 'revoked'
      order by
        link.project_id,
        (link.state = 'active') desc,
        link.updated_at desc,
        link.created_at desc,
        link.id desc
  ),
  task_counts as (
    select task.share_link_id, count(*) as task_count
      from public.share_link_tasks as task
      where task.share_link_id in (select managed_links.link_id from managed_links)
        and task.user_id = v_user_id
      group by task.share_link_id
  ),
  resource_counts as (
    select resource.share_link_id, count(*) as resource_count
      from public.share_link_resources as resource
      where resource.share_link_id in (select managed_links.link_id from managed_links)
        and resource.user_id = v_user_id
      group by resource.share_link_id
  )
  select jsonb_object_agg(
      requested_projects.project_id::text,
      jsonb_build_object(
        'projectId', requested_projects.project_id,
        'linkId', managed_links.link_id,
        'state', managed_links.state,
        'expiresAt', managed_links.expires_at,
        'hasPin', managed_links.pin_hash is not null,
        'createdAt', managed_links.created_at,
        'lastViewedAt', managed_links.last_viewed_at,
        'viewCount', coalesce(managed_links.view_count, 0),
        'taskCount', coalesce(task_counts.task_count, 0),
        'resourceCount', coalesce(resource_counts.resource_count, 0),
        'unreadCount', null
      )
    )
    into v_result
    from requested_projects
    left join managed_links
      on managed_links.project_id = requested_projects.project_id
    left join task_counts
      on task_counts.share_link_id = managed_links.link_id
    left join resource_counts
      on resource_counts.share_link_id = managed_links.link_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_homepage_demo_claim_auth_continuation(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer)
 RETURNS TABLE(outcome text, set_cookie boolean, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_expires_at timestamptz;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_candidate_continuation_token_hash is null
    or p_candidate_continuation_token_hash !~ '^[0-9a-f]{64}$'
    or (
      p_existing_continuation_token_hash is not null
      and p_existing_continuation_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_continuation_ttl_seconds is null
    or p_continuation_ttl_seconds < 900
    or p_continuation_ttl_seconds > 7200 then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'claimed' then
    return query select 'already_claimed'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'pending'
    or v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.auth_continuation_token_hash is not null then
    if v_claim.auth_continuation_expires_at > v_now
      and v_claim.auth_continuation_consumed_at is null then
      if p_existing_continuation_token_hash is not null
        and v_claim.auth_continuation_token_hash
          is not distinct from p_existing_continuation_token_hash then
        return query
          select
            'continuation_reused'::text,
            false,
            v_claim.auth_continuation_expires_at;
        return;
      end if;

      return query
        select 'continuation_in_progress'::text, false, null::timestamptz;
      return;
    end if;

    if v_claim.expires_at <= v_now then
      update public.homepage_demo_claims as claim
      set status = 'expired'
      where claim.id = v_claim.id
        and claim.status = 'pending'
        and claim.auth_continuation_consumed_at is null;

      return query select 'expired'::text, false, null::timestamptz;
      return;
    end if;

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if v_trial.expires_at <= v_now
    or v_draft.expires_at <= v_now then
    update public.homepage_demo_claims as claim
    set status = 'expired'
    where claim.id = v_claim.id
      and claim.status = 'pending';

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_trial.public_token_hash is distinct from v_claim.public_token_hash
    or v_trial.session_token_hash is distinct from v_claim.session_token_hash
    or v_draft.trial_id is distinct from v_trial.id
    or v_trial.input_type is distinct from 'text'
    or v_trial.status is distinct from 'review_ready'
    or v_trial.risk_state is distinct from 'allowed'
    or v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null
    or v_draft.status is distinct from 'ready'
    or v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null
    or v_draft.normalized_result is null then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_expires_at :=
    v_now + (p_continuation_ttl_seconds * interval '1 second');

  update public.homepage_demo_claims as claim
  set
    auth_continuation_token_hash = p_candidate_continuation_token_hash,
    auth_continuation_started_at = v_now,
    auth_continuation_expires_at = v_expires_at,
    auth_continuation_consumed_at = null
  where claim.id = v_claim.id
    and claim.status = 'pending'
    and claim.claim_token_hash = p_claim_token_hash
    and claim.expires_at > v_now
    and claim.auth_continuation_token_hash is null
    and claim.auth_continuation_started_at is null
    and claim.auth_continuation_expires_at is null
    and claim.auth_continuation_consumed_at is null;

  if not found then
    return query
      select 'continuation_in_progress'::text, false, null::timestamptz;
    return;
  end if;

  return query
    select 'continuation_prepared'::text, true, v_expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_homepage_demo_duplicate_override(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text DEFAULT NULL::text, p_candidate_authority_token_hash text DEFAULT NULL::text, p_request_hash text DEFAULT NULL::text, p_import_groups jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(outcome text, set_cookie boolean, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz;
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_authority_expires_at timestamptz;
begin
  if p_claim_token_hash is null
    or p_claim_token_hash !~ '^[0-9a-f]{64}$'
    or p_authenticated_user_id is null
    or (
      p_existing_authority_token_hash is not null
      and p_existing_authority_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_candidate_authority_token_hash is null
    or p_candidate_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  select claim.*
  into v_claim
  from public.homepage_demo_claims as claim
  where claim.claim_token_hash = p_claim_token_hash
  for update of claim;

  if not found then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is not distinct from p_authenticated_user_id
      and v_claim.saved_project_id is not null
      and v_claim.claimed_at is not null then
      return query
        select
          'already_claimed'::text,
          false,
          null::timestamptz;
      return;
    end if;

    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'pending'
    or v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_claim.expires_at <= v_now then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
    return;
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if v_trial.expires_at <= v_now
    or v_draft.expires_at <= v_now then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
    return;
  end if;

  if v_trial.public_token_hash is distinct from v_claim.public_token_hash
    or v_trial.session_token_hash is distinct from v_claim.session_token_hash
    or v_draft.trial_id is distinct from v_trial.id
    or v_trial.input_type is distinct from 'text'
    or v_trial.status is distinct from 'review_ready'
    or v_trial.risk_state is distinct from 'allowed'
    or v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null
    or v_draft.status is distinct from 'ready'
    or v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null
    or v_draft.normalized_result is null then
    return query
      select
        'invalid_claim'::text,
        false,
        null::timestamptz;
    return;
  end if;

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.claim_id = v_claim.id
    and authority.status = 'pending'
  order by authority.created_at asc, authority.id asc
  limit 1
  for update of authority;

  if found then
    v_now := clock_timestamp();

    if v_claim.expires_at <= v_now then
      return query
        select
          'expired'::text,
          false,
          null::timestamptz;
      return;
    end if;

    if v_authority.expires_at <= v_now then
      update public.homepage_demo_duplicate_override_authorities as authority
      set
        status = 'expired',
        updated_at = v_now
      where authority.id = v_authority.id
        and authority.status = 'pending'
        and authority.consumed_at is null;
    elsif v_authority.authenticated_user_id is not distinct from p_authenticated_user_id
      and v_authority.request_hash is not distinct from p_request_hash
      and v_authority.import_groups_hash is not distinct from v_import_groups_hash
      and p_existing_authority_token_hash is not null
      and v_authority.authority_token_hash is not distinct from p_existing_authority_token_hash then
      return query
        select
          'authority_reused'::text,
          false,
          v_authority.expires_at;
      return;
    else
      return query
        select
          'authority_in_progress'::text,
          false,
          null::timestamptz;
      return;
    end if;
  end if;

  v_now := clock_timestamp();

  v_authority_expires_at :=
    least(v_claim.expires_at, v_now + interval '5 minutes');

  if v_authority_expires_at <= v_now then
    return query
      select
        'expired'::text,
        false,
        null::timestamptz;
    return;
  end if;

  insert into public.homepage_demo_duplicate_override_authorities (
    claim_id,
    authenticated_user_id,
    authority_token_hash,
    request_hash,
    import_groups_hash,
    status,
    expires_at,
    consumed_at,
    created_at,
    updated_at
  )
  values (
    v_claim.id,
    p_authenticated_user_id,
    p_candidate_authority_token_hash,
    p_request_hash,
    v_import_groups_hash,
    'pending',
    v_authority_expires_at,
    null,
    v_now,
    v_now
  );

  return query
    select
      'authority_prepared'::text,
      true,
      v_authority_expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_homepage_demo_duplicate_override_v2(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text DEFAULT NULL::text, p_candidate_authority_token_hash text DEFAULT NULL::text, p_request_hash text DEFAULT NULL::text, p_import_groups jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(outcome text, set_cookie boolean, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_claim public.homepage_demo_claims%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_authority public.homepage_demo_duplicate_override_authorities%rowtype;
  v_import_groups_hash text;
  v_authority_expires_at timestamptz;
  v_effective_claim_expires_at timestamptz;
  v_has_claim_authority boolean := false;
  v_has_continuation_authority boolean := false;
begin
  if (
      p_claim_token_hash is null
      and p_auth_continuation_token_hash is null
    )
    or (
      p_claim_token_hash is not null
      and p_claim_token_hash !~ '^[0-9a-f]{64}$'
    )
    or (
      p_auth_continuation_token_hash is not null
      and p_auth_continuation_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_authenticated_user_id is null
    or (
      p_existing_authority_token_hash is not null
      and p_existing_authority_token_hash !~ '^[0-9a-f]{64}$'
    )
    or p_candidate_authority_token_hash is null
    or p_candidate_authority_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_import_groups is null
    or jsonb_typeof(p_import_groups) is distinct from 'array'
    or jsonb_array_length(p_import_groups) <> 1 then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1
    from auth.users as app_user
    where app_user.id = p_authenticated_user_id
  ) then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_import_groups_hash :=
    encode(sha256(convert_to(p_import_groups::text, 'UTF8')), 'hex');

  if p_claim_token_hash is not null then
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.claim_token_hash = p_claim_token_hash
    for update of claim;
  else
    select claim.*
    into v_claim
    from public.homepage_demo_claims as claim
    where claim.auth_continuation_token_hash = p_auth_continuation_token_hash
    for update of claim;
  end if;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'claimed' then
    if v_claim.claimed_by_user_id is not distinct from p_authenticated_user_id
      and v_claim.saved_project_id is not null
      and v_claim.claimed_at is not null then
      return query select 'already_claimed'::text, false, null::timestamptz;
      return;
    end if;

    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status = 'expired' then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'pending'
    or v_claim.trial_id is null
    or v_claim.draft_id is null then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_has_claim_authority :=
    p_claim_token_hash is not null
    and v_claim.claim_token_hash is not distinct from p_claim_token_hash
    and v_claim.expires_at > v_now;

  v_has_continuation_authority :=
    p_auth_continuation_token_hash is not null
    and v_claim.auth_continuation_token_hash
      is not distinct from p_auth_continuation_token_hash
    and v_claim.auth_continuation_started_at is not null
    and v_claim.auth_continuation_started_at < v_claim.expires_at
    and v_claim.auth_continuation_expires_at > v_now
    and v_claim.auth_continuation_consumed_at is null;

  if not v_has_claim_authority and not v_has_continuation_authority then
    if v_claim.expires_at <= v_now then
      update public.homepage_demo_claims as claim
      set status = 'expired'
      where claim.id = v_claim.id
        and claim.status = 'pending';
    end if;

    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  v_effective_claim_expires_at :=
    case
      when v_has_continuation_authority then v_claim.auth_continuation_expires_at
      else v_claim.expires_at
    end;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_claim.trial_id
  for update of trial;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.id = v_claim.draft_id
    and draft.trial_id = v_claim.trial_id
  for update of draft;

  if not found then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  v_now := clock_timestamp();

  if (v_trial.expires_at <= v_now or v_draft.expires_at <= v_now)
    and not v_has_continuation_authority then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  if v_trial.public_token_hash is distinct from v_claim.public_token_hash
    or v_trial.session_token_hash is distinct from v_claim.session_token_hash
    or v_draft.trial_id is distinct from v_trial.id
    or v_trial.input_type is distinct from 'text'
    or v_trial.status is distinct from 'review_ready'
    or v_trial.risk_state is distinct from 'allowed'
    or v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null
    or v_draft.status is distinct from 'ready'
    or v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null
    or v_draft.normalized_result is null then
    return query select 'invalid_claim'::text, false, null::timestamptz;
    return;
  end if;

  select authority.*
  into v_authority
  from public.homepage_demo_duplicate_override_authorities as authority
  where authority.claim_id = v_claim.id
    and authority.status = 'pending'
  order by authority.created_at asc, authority.id asc
  limit 1
  for update of authority;

  if found then
    if v_authority.expires_at <= v_now then
      update public.homepage_demo_duplicate_override_authorities as authority
      set
        status = 'expired',
        updated_at = v_now
      where authority.id = v_authority.id
        and authority.status = 'pending'
        and authority.consumed_at is null;
    elsif v_authority.authenticated_user_id is not distinct from p_authenticated_user_id
      and v_authority.request_hash is not distinct from p_request_hash
      and v_authority.import_groups_hash is not distinct from v_import_groups_hash
      and p_existing_authority_token_hash is not null
      and v_authority.authority_token_hash
        is not distinct from p_existing_authority_token_hash then
      return query
        select 'authority_reused'::text, false, v_authority.expires_at;
      return;
    else
      return query
        select 'authority_in_progress'::text, false, null::timestamptz;
      return;
    end if;
  end if;

  v_now := clock_timestamp();

  v_authority_expires_at :=
    least(v_effective_claim_expires_at, v_now + interval '5 minutes');

  if v_authority_expires_at <= v_now then
    return query select 'expired'::text, false, null::timestamptz;
    return;
  end if;

  insert into public.homepage_demo_duplicate_override_authorities (
    claim_id,
    authenticated_user_id,
    authority_token_hash,
    request_hash,
    import_groups_hash,
    status,
    expires_at,
    consumed_at,
    created_at,
    updated_at
  )
  values (
    v_claim.id,
    p_authenticated_user_id,
    p_candidate_authority_token_hash,
    p_request_hash,
    v_import_groups_hash,
    'pending',
    v_authority_expires_at,
    null,
    v_now,
    v_now
  );

  return query
    select 'authority_prepared'::text, true, v_authority_expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.process_creem_webhook_event(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text)
 RETURNS TABLE(result_processing_status text, result_reason_code text, result_resolved_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz := now();
  v_event public.creem_webhook_events%rowtype;
  v_previous_event public.creem_webhook_events%rowtype;
  v_user public.users%rowtype;
  v_provider_event_id text := left(nullif(btrim(coalesce(p_provider_event_id, '')), ''), 180);
  v_event_type text := left(nullif(btrim(coalesce(p_event_type, '')), ''), 120);
  v_action text := left(nullif(btrim(coalesce(p_action, '')), ''), 80);
  v_reason_code text := left(
    nullif(btrim(coalesce(p_reason_code, 'creem_webhook_processed')), ''),
    120
  );
  v_object_id text := left(nullif(btrim(coalesce(p_object_id, '')), ''), 240);
  v_checkout_id text := left(nullif(btrim(coalesce(p_checkout_id, '')), ''), 240);
  v_subscription_id text := left(nullif(btrim(coalesce(p_subscription_id, '')), ''), 240);
  v_customer_id text := left(nullif(btrim(coalesce(p_customer_id, '')), ''), 240);
  v_product_id text := left(nullif(btrim(coalesce(p_product_id, '')), ''), 240);
  v_environment text := left(nullif(btrim(coalesce(p_environment, '')), ''), 80);
  v_creem_request_id text := left(nullif(btrim(coalesce(p_creem_request_id, '')), ''), 240);
  v_subscription_status text := left(nullif(btrim(coalesce(p_subscription_status, '')), ''), 120);
  v_refund_currency text := upper(left(nullif(btrim(coalesce(p_refund_currency, '')), ''), 12));
  v_transaction_currency text := upper(left(nullif(btrim(coalesce(p_transaction_currency, '')), ''), 12));
  v_provider_event_created_at timestamptz := p_provider_event_created_at;
  v_provider_state_updated_at timestamptz := coalesce(
    p_provider_state_updated_at,
    p_provider_event_created_at
  );
  v_cancel_at_period_end boolean := p_cancel_at_period_end;
  v_current_period_start timestamptz := p_current_period_start;
  v_current_period_end timestamptz := p_current_period_end;
  v_refund_amount numeric := p_refund_amount;
  v_amount_paid numeric := p_amount_paid;
  v_refunded_amount numeric := p_refunded_amount;
  v_internal_user_id_candidate uuid := p_internal_user_id_candidate;
  v_candidate_user_id uuid;
  v_resolved_user_id uuid;
  v_match_count bigint;
  v_has_conflict boolean := false;
  v_is_state_action boolean := false;
  v_is_terminal_action boolean := false;
  v_subscription_mismatch boolean := false;
  v_customer_mismatch boolean := false;
  v_same_effect boolean := false;
begin
  if v_provider_event_id is null
    or v_event_type is null
    or v_action is null
    or v_reason_code is null
    or v_provider_event_created_at is null
    or v_provider_state_updated_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CREEM_WEBHOOK_EVENT';
  end if;

  if v_action not in (
    'ignore',
    'sync_checkout',
    'sync_subscription',
    'grant_pro',
    'trial_pro',
    'past_due',
    'scheduled_cancel',
    'downgrade_free',
    'refund_downgrade',
    'dispute_downgrade',
    'pending_review'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CREEM_WEBHOOK_ACTION';
  end if;

  if v_refund_amount is not null and v_refund_amount < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_REFUND_AMOUNT';
  end if;

  if v_amount_paid is not null and v_amount_paid < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_AMOUNT_PAID';
  end if;

  if v_refunded_amount is not null and v_refunded_amount < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_REFUNDED_AMOUNT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_provider_event_id, 0));

  select event_row.*
  into v_event
  from public.creem_webhook_events as event_row
  where event_row.provider_event_id = v_provider_event_id
  for update of event_row;

  if found then
    update public.creem_webhook_events as event_row
    set
      attempt_count = event_row.attempt_count + 1,
      last_attempt_at = v_now,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    if v_event.processing_status in (
      'processed',
      'ignored',
      'stale',
      'duplicate'
    ) then
      result_processing_status := 'duplicate';
      result_reason_code := 'creem_webhook_duplicate';
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    -- Once a manual review decision exists, only the dedicated review RPC may
    -- re-evaluate it. Generic provider redelivery/reprocessing cannot erase or
    -- bypass an operator decision.
    if v_event.review_decision is not null then
      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    -- Pending/retryable rows are reprocessed from their original normalized
    -- ledger values. A redelivery cannot replace trusted normalized data.
    v_event_type := v_event.event_type;
    v_action := v_event.webhook_action;
    v_reason_code := v_event.reason_code;
    v_object_id := v_event.object_id;
    v_checkout_id := v_event.checkout_id;
    v_subscription_id := v_event.subscription_id;
    v_customer_id := v_event.customer_id;
    v_product_id := v_event.product_id;
    v_environment := v_event.environment;
    v_creem_request_id := v_event.creem_request_id;
    v_internal_user_id_candidate := v_event.internal_user_id_candidate;
    v_subscription_status := v_event.normalized_subscription_status;
    v_cancel_at_period_end := v_event.cancel_at_period_end;
    v_current_period_start := v_event.current_period_start_at;
    v_current_period_end := v_event.current_period_end_at;
    v_refund_amount := v_event.refund_amount;
    v_amount_paid := v_event.amount_paid;
    v_refunded_amount := v_event.refunded_amount;
    v_refund_currency := v_event.refund_currency;
    v_transaction_currency := v_event.transaction_currency;
    v_provider_event_created_at := v_event.provider_event_created_at;
    v_provider_state_updated_at := v_event.provider_state_updated_at;
  else
    insert into public.creem_webhook_events (
      provider_event_id,
      event_type,
      webhook_action,
      provider_event_created_at,
      provider_state_updated_at,
      object_id,
      checkout_id,
      creem_request_id,
      subscription_id,
      customer_id,
      product_id,
      environment,
      internal_user_id_candidate,
      normalized_subscription_status,
      cancel_at_period_end,
      current_period_start_at,
      current_period_end_at,
      refund_amount,
      amount_paid,
      refunded_amount,
      refund_currency,
      transaction_currency,
      processing_status,
      reason_code,
      received_at,
      last_attempt_at,
      updated_at
    )
    values (
      v_provider_event_id,
      v_event_type,
      v_action,
      v_provider_event_created_at,
      v_provider_state_updated_at,
      v_object_id,
      v_checkout_id,
      v_creem_request_id,
      v_subscription_id,
      v_customer_id,
      v_product_id,
      v_environment,
      v_internal_user_id_candidate,
      v_subscription_status,
      v_cancel_at_period_end,
      v_current_period_start,
      v_current_period_end,
      v_refund_amount,
      v_amount_paid,
      v_refunded_amount,
      v_refund_currency,
      v_transaction_currency,
      'received',
      v_reason_code,
      v_now,
      v_now,
      v_now
    )
    returning * into v_event;
  end if;

  update public.creem_webhook_events as event_row
  set
    processing_status = 'processing',
    last_attempt_at = v_now,
    updated_at = v_now
  where event_row.id = v_event.id
  returning event_row.* into v_event;

  if v_action = 'ignore' then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'ignored',
      reason_code = v_reason_code,
      processed_at = v_now,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'ignored';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  -- Event-specific trusted-user resolution. Every trusted identifier that is
  -- present acts as a consistency check. Any disagreement fails closed.
  if v_action = 'sync_checkout' then
    if v_creem_request_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.billing_checkout_attempts as attempt
        join public.users as user_profile
          on user_profile.id = attempt.user_id
        where attempt.creem_request_id = v_creem_request_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        v_resolved_user_id := v_candidate_user_id;
      end if;
    end if;

    if v_internal_user_id_candidate is not null then
      select user_profile.id
      into v_candidate_user_id
      from public.users as user_profile
      where user_profile.id = v_internal_user_id_candidate;

      if found then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_subscription_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_subscription_id), '') = v_subscription_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_customer_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_customer_id), '') = v_customer_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;
  elsif v_action in (
    'sync_subscription',
    'grant_pro',
    'trial_pro',
    'past_due',
    'scheduled_cancel',
    'downgrade_free'
  ) then
    if v_subscription_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_subscription_id), '') = v_subscription_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        v_resolved_user_id := v_candidate_user_id;
      end if;
    end if;

    if v_internal_user_id_candidate is not null then
      select user_profile.id
      into v_candidate_user_id
      from public.users as user_profile
      where user_profile.id = v_internal_user_id_candidate;

      if found then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_customer_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_customer_id), '') = v_customer_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_creem_request_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.billing_checkout_attempts as attempt
        join public.users as user_profile
          on user_profile.id = attempt.user_id
        where attempt.creem_request_id = v_creem_request_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;
  elsif v_action in (
    'refund_downgrade',
    'dispute_downgrade',
    'pending_review'
  ) then
    if v_subscription_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_subscription_id), '') = v_subscription_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        v_resolved_user_id := v_candidate_user_id;
      end if;
    end if;

    if v_creem_request_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.billing_checkout_attempts as attempt
        join public.users as user_profile
          on user_profile.id = attempt.user_id
        where attempt.creem_request_id = v_creem_request_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_internal_user_id_candidate is not null then
      select user_profile.id
      into v_candidate_user_id
      from public.users as user_profile
      where user_profile.id = v_internal_user_id_candidate;

      if found then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;

    if v_customer_id is not null then
      select count(*), (array_agg(candidate_rows.user_id))[1]
      into v_match_count, v_candidate_user_id
      from (
        select distinct user_profile.id as user_id
        from public.users as user_profile
        where nullif(btrim(user_profile.creem_customer_id), '') = v_customer_id
      ) as candidate_rows;

      if v_match_count > 1 then
        v_has_conflict := true;
      elsif v_match_count = 1 then
        if v_resolved_user_id is null then
          v_resolved_user_id := v_candidate_user_id;
        elsif v_resolved_user_id <> v_candidate_user_id then
          v_has_conflict := true;
        end if;
      end if;
    end if;
  end if;

  if v_has_conflict then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_conflict',
      reason_code = 'creem_webhook_pending_conflict',
      resolved_user_id = null,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_conflict';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  if v_resolved_user_id is null then
    if v_action = 'sync_checkout' then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'ignored',
        reason_code = 'creem_webhook_ignored_unmatched_checkout',
        resolved_user_id = null,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'ignored';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := null;
      return next;
      return;
    end if;

    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_unmatched',
      reason_code = 'creem_webhook_unmatched_user',
      resolved_user_id = null,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_unmatched';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  select user_profile.*
  into v_user
  from public.users as user_profile
  where user_profile.id = v_resolved_user_id
  for update of user_profile;

  if not found then
    if v_action = 'sync_checkout' then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'ignored',
        reason_code = 'creem_webhook_ignored_unmatched_checkout',
        resolved_user_id = null,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'ignored';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := null;
      return next;
      return;
    end if;

    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_unmatched',
      reason_code = 'creem_webhook_unmatched_user',
      resolved_user_id = null,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_unmatched';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := null;
    return next;
    return;
  end if;

  if v_action = 'pending_review' then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_review',
      reason_code = 'creem_webhook_pending_review',
      resolved_user_id = v_resolved_user_id,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_review';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_resolved_user_id;
    return next;
    return;
  end if;

  v_is_state_action := v_action <> 'sync_checkout';
  v_is_terminal_action := v_action in (
    'downgrade_free',
    'refund_downgrade',
    'dispute_downgrade'
  );

  if v_is_state_action
    and v_user.billing_last_state_updated_at is not null
    and v_user.billing_last_event_created_at is not null then
    if v_user.billing_last_state_updated_at > v_provider_state_updated_at
      or (
        v_user.billing_last_state_updated_at = v_provider_state_updated_at
        and v_user.billing_last_event_created_at > v_provider_event_created_at
      ) then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'stale',
        reason_code = 'creem_webhook_stale',
        resolved_user_id = v_resolved_user_id,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'stale';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_resolved_user_id;
      return next;
      return;
    end if;

    if v_user.billing_last_state_updated_at = v_provider_state_updated_at
      and v_user.billing_last_event_created_at = v_provider_event_created_at
      and nullif(btrim(coalesce(v_user.billing_last_event_id, '')), '') is not null
      and v_user.billing_last_event_id <> v_provider_event_id then
      select previous_event.*
      into v_previous_event
      from public.creem_webhook_events as previous_event
      where previous_event.provider_event_id = v_user.billing_last_event_id;

      if found then
        v_same_effect :=
          v_previous_event.webhook_action = v_action
          and v_previous_event.normalized_subscription_status
            is not distinct from v_subscription_status
          and v_previous_event.cancel_at_period_end
            is not distinct from v_cancel_at_period_end
          and v_previous_event.current_period_end_at
            is not distinct from v_current_period_end
          and v_previous_event.subscription_id
            is not distinct from v_subscription_id
          and v_previous_event.customer_id
            is not distinct from v_customer_id;
      else
        v_same_effect := false;
      end if;

      if v_same_effect then
        update public.creem_webhook_events as event_row
        set
          processing_status = 'duplicate',
          reason_code = 'creem_webhook_duplicate',
          resolved_user_id = v_resolved_user_id,
          processed_at = v_now,
          updated_at = v_now
        where event_row.id = v_event.id
        returning event_row.* into v_event;

        result_processing_status := 'duplicate';
        result_reason_code := v_event.reason_code;
        result_resolved_user_id := v_resolved_user_id;
        return next;
        return;
      end if;

      update public.creem_webhook_events as event_row
      set
        processing_status = 'pending_conflict',
        reason_code = 'creem_webhook_equal_timestamp_conflict',
        resolved_user_id = v_resolved_user_id,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := 'pending_conflict';
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_resolved_user_id;
      return next;
      return;
    end if;
  end if;

  v_customer_mismatch :=
    v_customer_id is not null
    and nullif(btrim(coalesce(v_user.creem_customer_id, '')), '') is not null
    and btrim(v_user.creem_customer_id) <> v_customer_id;

  v_subscription_mismatch :=
    v_subscription_id is not null
    and nullif(btrim(coalesce(v_user.creem_subscription_id, '')), '') is not null
    and btrim(v_user.creem_subscription_id) <> v_subscription_id;

  -- Customer identity is never silently replaced. A subscription id may be
  -- replaced only by a strictly ordered, non-terminal subscription lifecycle
  -- event. Unordered checkout and terminal/refund/dispute events fail closed.
  if v_customer_mismatch
    or (
      v_subscription_mismatch
      and (
        v_action = 'sync_checkout'
        or v_is_terminal_action
      )
    ) then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_conflict',
      reason_code = 'creem_webhook_provider_id_conflict',
      resolved_user_id = v_resolved_user_id,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := 'pending_conflict';
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_resolved_user_id;
    return next;
    return;
  end if;

  if v_action = 'sync_checkout' then
    update public.users as user_profile
    set
      creem_customer_id = case
        when nullif(btrim(coalesce(user_profile.creem_customer_id, '')), '') is null
          then coalesce(v_customer_id, user_profile.creem_customer_id)
        else user_profile.creem_customer_id
      end,
      creem_subscription_id = case
        when nullif(btrim(coalesce(user_profile.creem_subscription_id, '')), '') is null
          then coalesce(v_subscription_id, user_profile.creem_subscription_id)
        else user_profile.creem_subscription_id
      end,
      billing_updated_at = v_now
    where user_profile.id = v_resolved_user_id;

    if v_creem_request_id is not null then
      update public.billing_checkout_attempts as attempt
      set
        status = 'completed',
        completed_at = coalesce(attempt.completed_at, v_now),
        updated_at = v_now,
        lease_token = null,
        lease_expires_at = null
      where attempt.creem_request_id = v_creem_request_id
        and attempt.user_id = v_resolved_user_id
        and attempt.status in ('creating', 'checkout_created');
    end if;
  elsif v_action = 'sync_subscription' then
    update public.users as user_profile
    set
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = case
        when user_profile.plan = 'pro' then
          coalesce(v_subscription_status, user_profile.subscription_status)
        when lower(coalesce(v_subscription_status, '')) = 'active' then
          'active_sync_only'
        else
          coalesce(v_subscription_status, user_profile.subscription_status)
      end,
      cancel_at_period_end = case
        when lower(coalesce(v_subscription_status, '')) = 'active' then false
        else coalesce(v_cancel_at_period_end, user_profile.cancel_at_period_end)
      end,
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action in ('grant_pro', 'trial_pro') then
    update public.users as user_profile
    set
      plan = 'pro',
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = coalesce(
        v_subscription_status,
        case when v_action = 'trial_pro' then 'trialing' else 'paid' end
      ),
      cancel_at_period_end = false,
      pro_started_at = coalesce(user_profile.pro_started_at, v_now),
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action = 'past_due' then
    update public.users as user_profile
    set
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = coalesce(v_subscription_status, 'past_due'),
      cancel_at_period_end = coalesce(v_cancel_at_period_end, user_profile.cancel_at_period_end),
      pro_current_period_end = coalesce(user_profile.pro_current_period_end, v_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action = 'scheduled_cancel' then
    update public.users as user_profile
    set
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = 'scheduled_cancel',
      cancel_at_period_end = true,
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  elsif v_action in (
    'downgrade_free',
    'refund_downgrade',
    'dispute_downgrade'
  ) then
    update public.users as user_profile
    set
      plan = 'free',
      creem_customer_id = coalesce(v_customer_id, user_profile.creem_customer_id),
      creem_subscription_id = coalesce(v_subscription_id, user_profile.creem_subscription_id),
      subscription_status = coalesce(
        v_subscription_status,
        case
          when v_action = 'refund_downgrade' then 'refunded'
          when v_action = 'dispute_downgrade' then 'disputed'
          else 'canceled'
        end
      ),
      cancel_at_period_end = false,
      pro_current_period_end = coalesce(v_current_period_end, user_profile.pro_current_period_end),
      billing_updated_at = v_now,
      billing_last_state_updated_at = v_provider_state_updated_at,
      billing_last_event_created_at = v_provider_event_created_at,
      billing_last_event_id = v_provider_event_id,
      billing_last_event_type = v_event_type,
      billing_last_action = v_action
    where user_profile.id = v_resolved_user_id;
  end if;

  update public.creem_webhook_events as event_row
  set
    processing_status = 'processed',
    reason_code = case
      when v_action = 'sync_checkout' then 'creem_webhook_checkout_synced'
      else 'creem_webhook_processed'
    end,
    resolved_user_id = v_resolved_user_id,
    processed_at = v_now,
    updated_at = v_now
  where event_row.id = v_event.id
  returning event_row.* into v_event;

  result_processing_status := 'processed';
  result_reason_code := v_event.reason_code;
  result_resolved_user_id := v_resolved_user_id;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.purge_expired_homepage_demo_trials(p_limit integer DEFAULT 250)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_limit integer := coalesce(p_limit, 250);
  v_deleted_count integer := 0;
begin
  if v_limit <= 0 then
    v_limit := 250;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  with expired_trials as (
    select trial.id
    from public.homepage_demo_trials as trial
    where trial.expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_claims as claim
        where claim.trial_id = trial.id
          and claim.status = 'pending'
          and claim.auth_continuation_token_hash is not null
          and claim.auth_continuation_expires_at > v_now
          and claim.auth_continuation_consumed_at is null
      )
    order by trial.expires_at asc, trial.id asc
    limit v_limit
    for update of trial skip locked
  ),
  deleted_trials as (
    delete from public.homepage_demo_trials as trial
    using expired_trials
    where trial.id = expired_trials.id
    returning trial.id
  )
  select count(*)::integer
  into v_deleted_count
  from deleted_trials;

  return v_deleted_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.purge_homepage_demo_retention(p_limit integer DEFAULT 1000)
 RETURNS TABLE(purged_trials integer, deleted_entitlements integer, deleted_attempts integer, deleted_rate_buckets integer, deleted_capacity_reservations integer, deleted_cost_reservations integer, deleted_cost_buckets integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_limit integer := coalesce(p_limit, 1000);
begin
  if v_limit <= 0 then
    v_limit := 1000;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  purged_trials := 0;
  deleted_entitlements := 0;
  deleted_attempts := 0;
  deleted_rate_buckets := 0;
  deleted_capacity_reservations := 0;
  deleted_cost_reservations := 0;
  deleted_cost_buckets := 0;

  update public.homepage_demo_claims as claim
  set status = 'expired'
  where claim.status = 'pending'
    and claim.expires_at <= v_now
    and (
      claim.auth_continuation_expires_at is null
      or claim.auth_continuation_expires_at <= v_now
      or claim.auth_continuation_consumed_at is not null
    );

  with selected_trials as (
    select trial.id
    from public.homepage_demo_trials as trial
    where trial.expires_at <= v_now
      and trial.status <> 'claimed'
      and trial.claimed_by_user_id is null
      and trial.claimed_at is null
      and not exists (
        select 1
        from public.homepage_demo_claims as claim
        where claim.trial_id = trial.id
          and claim.status = 'pending'
          and claim.auth_continuation_token_hash is not null
          and claim.auth_continuation_expires_at > v_now
          and claim.auth_continuation_consumed_at is null
      )
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.trial_id = trial.id
          and attempt.status in ('admitted', 'processing')
      )
    order by trial.expires_at asc, trial.id asc
    limit v_limit
    for update of trial skip locked
  ),
  deleted_trials as (
    delete from public.homepage_demo_trials as trial
    using selected_trials
    where trial.id = selected_trials.id
    returning trial.id
  )
  select count(*)::integer
  into purged_trials
  from deleted_trials;

  with selected_entitlements as (
    select entitlement.id
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.status in ('released', 'expired')
      and entitlement.expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.id = entitlement.attempt_id
          and attempt.status in ('admitted', 'processing')
      )
      and not exists (
        select 1
        from public.homepage_demo_trials as trial
        where trial.id = entitlement.trial_id
          and (
            trial.expires_at > v_now
            or trial.status = 'claimed'
            or trial.claimed_by_user_id is not null
            or trial.claimed_at is not null
            or exists (
              select 1
              from public.homepage_demo_claims as claim
              where claim.trial_id = trial.id
                and claim.status = 'pending'
                and claim.auth_continuation_token_hash is not null
                and claim.auth_continuation_expires_at > v_now
                and claim.auth_continuation_consumed_at is null
            )
          )
      )
    order by entitlement.expires_at asc, entitlement.id asc
    limit v_limit
    for update of entitlement skip locked
  ),
  deleted_terminal_entitlements as (
    delete from public.homepage_demo_trial_entitlements as entitlement
    using selected_entitlements
    where entitlement.id = selected_entitlements.id
    returning entitlement.id
  )
  select count(*)::integer
  into deleted_entitlements
  from deleted_terminal_entitlements;

  with selected_capacity_reservations as (
    select capacity.id
    from public.homepage_demo_capacity_reservations as capacity
    where capacity.status in ('released', 'expired')
      and capacity.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.id = capacity.attempt_id
          and attempt.status in ('admitted', 'processing')
      )
    order by capacity.retention_expires_at asc, capacity.id asc
    limit v_limit
    for update of capacity skip locked
  ),
  deleted_capacity as (
    delete from public.homepage_demo_capacity_reservations as capacity
    using selected_capacity_reservations
    where capacity.id = selected_capacity_reservations.id
    returning capacity.id
  )
  select count(*)::integer
  into deleted_capacity_reservations
  from deleted_capacity;

  with selected_cost_reservations as (
    select cost.id
    from public.homepage_demo_cost_reservations as cost
    where cost.status in ('released', 'expired')
      and cost.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_admission_attempts as attempt
        where attempt.id = cost.attempt_id
          and attempt.status in ('admitted', 'processing')
      )
    order by cost.retention_expires_at asc, cost.id asc
    limit v_limit
    for update of cost skip locked
  ),
  deleted_cost_reservation_rows as (
    delete from public.homepage_demo_cost_reservations as cost
    using selected_cost_reservations
    where cost.id = selected_cost_reservations.id
    returning cost.id
  )
  select count(*)::integer
  into deleted_cost_reservations
  from deleted_cost_reservation_rows;

  with selected_attempts as (
    select attempt.id
    from public.homepage_demo_admission_attempts as attempt
    where attempt.status in ('failed', 'blocked', 'rejected', 'released', 'expired')
      and attempt.retention_expires_at <= v_now
      and not exists (
        select 1
        from public.homepage_demo_trials as trial
        where trial.id = attempt.trial_id
          and (
            trial.expires_at > v_now
            or trial.status = 'claimed'
            or trial.claimed_by_user_id is not null
            or trial.claimed_at is not null
            or exists (
              select 1
              from public.homepage_demo_claims as claim
              where claim.trial_id = trial.id
                and claim.status = 'pending'
                and claim.auth_continuation_token_hash is not null
                and claim.auth_continuation_expires_at > v_now
                and claim.auth_continuation_consumed_at is null
            )
          )
      )
    order by attempt.retention_expires_at asc, attempt.id asc
    limit v_limit
    for update of attempt skip locked
  ),
  deleted_attempt_rows as (
    delete from public.homepage_demo_admission_attempts as attempt
    using selected_attempts
    where attempt.id = selected_attempts.id
    returning attempt.id
  )
  select count(*)::integer
  into deleted_attempts
  from deleted_attempt_rows;

  with selected_rate_buckets as (
    select bucket.id
    from public.homepage_demo_rate_limit_buckets as bucket
    where bucket.expires_at <= v_now
    order by bucket.expires_at asc, bucket.id asc
    limit v_limit
    for update of bucket skip locked
  ),
  deleted_rate_bucket_rows as (
    delete from public.homepage_demo_rate_limit_buckets as bucket
    using selected_rate_buckets
    where bucket.id = selected_rate_buckets.id
    returning bucket.id
  )
  select count(*)::integer
  into deleted_rate_buckets
  from deleted_rate_bucket_rows;

  with selected_cost_buckets as (
    select bucket.id
    from public.homepage_demo_cost_buckets as bucket
    where bucket.expires_at <= v_now
    order by bucket.expires_at asc, bucket.id asc
    limit v_limit
    for update of bucket skip locked
  ),
  deleted_cost_bucket_rows as (
    delete from public.homepage_demo_cost_buckets as bucket
    using selected_cost_buckets
    where bucket.id = selected_cost_buckets.id
    returning bucket.id
  )
  select count(*)::integer
  into deleted_cost_buckets
  from deleted_cost_bucket_rows;

  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_project_completion(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_active_task_count integer;
  v_done_task_count integer;
  v_updated_count integer := 0;
begin
  if p_project_id is null or p_user_id is null then
    return false;
  end if;

  select
    count(*),
    count(*) filter (
      where lower(btrim(coalesce(task.status::text, ''))) = 'done'
    )
  into v_active_task_count, v_done_task_count
  from public.tasks as task
  where task.project_id = p_project_id
    and task.user_id = p_user_id
    and (task.is_archived = false or task.is_archived is null)
    and task.deleted_at is null;

  -- A project with zero active subtasks is never auto-completed, and a
  -- project whose active subtasks are only partially Done stays unchanged.
  if v_active_task_count = 0 or v_active_task_count <> v_done_task_count then
    return false;
  end if;

  -- `status is distinct from 'Done'` makes repeated calls a true no-op once
  -- the project is already completed: no redundant write, no updated_at
  -- churn, and completed_at (set via coalesce) is never overwritten.
  update public.projects as project
  set
    status = 'Done',
    priority = 'Low',
    updated_at = p_now,
    completed_at = coalesce(project.completed_at, p_now)
  where project.id = p_project_id
    and project.user_id = p_user_id
    and project.deleted_at is null
    and project.status is distinct from 'Done';

  get diagnostics v_updated_count = row_count;

  return v_updated_count = 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_dashboard_visit(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update public.users
  set last_dashboard_seen_at = now()
  where id = p_user_id
    and (
      last_dashboard_seen_at is null
      or last_dashboard_seen_at < now() - interval '4 hours'
    );
$function$;

CREATE OR REPLACE FUNCTION public.record_homepage_demo_challenge_failure(p_ip_identity_digest text)
 RETURNS TABLE(decision text, blocked boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_ip_digest_pattern constant text := '^v[1-9][0-9]*:[0-9a-f]{64}$';
  v_now timestamptz := pg_catalog.now();
  v_hour_window timestamptz := pg_catalog.date_trunc('hour', v_now, 'UTC');
  v_config public.homepage_demo_admission_config%rowtype;
  v_challenge_count integer;
  v_exception_message text;
begin
  if p_ip_identity_digest is null
    or p_ip_identity_digest !~ v_ip_digest_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
  end if;

  select config.*
  into v_config
  from public.homepage_demo_admission_config as config
  where config.id = 1
  for update of config;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING';
  end if;

  if not v_config.admission_enabled then
    return query
      select
        'demo_disabled'::text,
        false;
    return;
  end if;

  if not v_config.challenge_required then
    return query
      select
        'challenge_not_required'::text,
        false;
    return;
  end if;

  insert into public.homepage_demo_rate_limit_buckets as bucket (
    scope,
    action,
    identity_digest,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    'ip',
    'challenge_failure',
    p_ip_identity_digest,
    v_hour_window,
    3600,
    1,
    v_hour_window + interval '1 hour' + (v_config.rate_bucket_retention_seconds * interval '1 second')
  )
  on conflict (scope, action, identity_digest, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    expires_at = greatest(bucket.expires_at, excluded.expires_at)
  returning bucket.request_count into v_challenge_count;

  if v_challenge_count > v_config.challenge_failure_limit then
    return query
      select
        'rate_limited'::text,
        true;
    return;
  end if;

  return query
    select
      'challenge_failed'::text,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_ADMISSION_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_ADMISSION_CONFIG_MISSING',
      'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_ADMISSION_REPOSITORY_UNAVAILABLE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_successful_extraction(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update public.users
  set
    successful_extract_count = successful_extract_count + 1,
    last_extract_at = now()
  where id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.recover_stale_homepage_demo_processing(p_limit integer DEFAULT 1000)
 RETURNS TABLE(recovered_attempts integer, failed_attempts integer, expired_trials integer, failed_trials integer, expired_capacities integer, released_cost_reservations integer, finalized_cost_reservations integer, expired_or_released_entitlements integer, conflicts_skipped integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_limit integer := coalesce(p_limit, 1000);
  v_candidate record;
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_provider_started boolean;
  v_expected_trial_status text;
  v_row_count integer;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_candidate_entitlements integer;
  v_candidate_expired_trial integer;
  v_candidate_failed_trial integer;
  v_candidate_released_cost integer;
  v_candidate_finalized_cost integer;
  v_exception_message text;
begin
  if v_limit <= 0 then
    v_limit := 1000;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  recovered_attempts := 0;
  failed_attempts := 0;
  expired_trials := 0;
  failed_trials := 0;
  expired_capacities := 0;
  released_cost_reservations := 0;
  finalized_cost_reservations := 0;
  expired_or_released_entitlements := 0;
  conflicts_skipped := 0;

  for v_candidate in
    select
      attempt.id as attempt_id,
      capacity.id as capacity_id
    from public.homepage_demo_admission_attempts as attempt
    join public.homepage_demo_capacity_reservations as capacity
      on capacity.attempt_id = attempt.id
    where attempt.status in ('admitted', 'processing')
      and capacity.status = 'active'
      and capacity.lease_expires_at <= v_now
    order by
      capacity.lease_expires_at asc,
      attempt.created_at asc,
      attempt.id asc
    limit v_limit
    for update of attempt, capacity skip locked
  loop
    begin
      v_candidate_entitlements := 0;
      v_candidate_expired_trial := 0;
      v_candidate_failed_trial := 0;
      v_candidate_released_cost := 0;
      v_candidate_finalized_cost := 0;

      select attempt.*
      into v_attempt
      from public.homepage_demo_admission_attempts as attempt
      where attempt.id = v_candidate.attempt_id
      for update of attempt;

      if not found
        or v_attempt.status not in ('admitted', 'processing')
        or v_attempt.trial_id is null
        or v_attempt.decision_code is not null
        or v_attempt.review_ready_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select trial.*
      into v_trial
      from public.homepage_demo_trials as trial
      where trial.id = v_attempt.trial_id
      for update of trial skip locked;

      if not found
        or v_trial.status = 'claimed'
        or v_trial.claimed_by_user_id is not null
        or v_trial.claimed_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select capacity.*
      into v_capacity
      from public.homepage_demo_capacity_reservations as capacity
      where capacity.id = v_candidate.capacity_id
        and capacity.attempt_id = v_attempt.id
      for update of capacity skip locked;

      if not found
        or v_capacity.status <> 'active'
        or v_capacity.lease_expires_at > v_now
        or v_capacity.workload_type <> v_attempt.input_type
        or v_capacity.reserved_units <> 1
        or v_capacity.released_at is not null
        or v_capacity.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select cost.*
      into v_cost
      from public.homepage_demo_cost_reservations as cost
      where cost.attempt_id = v_attempt.id
      for update of cost skip locked;

      if not found
        or v_cost.status <> 'reserved'
        or v_cost.reserved_units <= 0
        or v_cost.reserved_units <> v_attempt.estimated_cost_units
        or v_cost.finalized_units is not null
        or v_cost.finalized_at is not null
        or v_cost.released_at is not null
        or v_cost.expired_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select bucket.*
      into v_hour_bucket
      from public.homepage_demo_cost_buckets as bucket
      where bucket.id = v_cost.hour_bucket_id
        and bucket.window_kind = 'hour'
      for update of bucket skip locked;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select bucket.*
      into v_day_bucket
      from public.homepage_demo_cost_buckets as bucket
      where bucket.id = v_cost.day_bucket_id
        and bucket.window_kind = 'day'
      for update of bucket skip locked;

      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_hour_bucket.reserved_units < v_cost.reserved_units
        or v_day_bucket.reserved_units < v_cost.reserved_units then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      select
        count(*)::integer,
        count(*) filter (where locked_entitlements.status = 'reserved')::integer,
        count(*) filter (where locked_entitlements.scope = 'session')::integer,
        count(*) filter (where locked_entitlements.scope = 'device')::integer
      into
        v_entitlement_count,
        v_reserved_entitlement_count,
        v_session_entitlement_count,
        v_device_entitlement_count
      from (
        select entitlement.status, entitlement.scope
        from public.homepage_demo_trial_entitlements as entitlement
        where entitlement.attempt_id = v_attempt.id
        order by entitlement.scope asc, entitlement.id asc
        for update of entitlement skip locked
      ) as locked_entitlements;

      if v_entitlement_count <> 2
        or v_reserved_entitlement_count <> 2
        or v_session_entitlement_count <> 1
        or v_device_entitlement_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_attempt.provider_call_started_at is null
        and v_cost.provider_call_started_at is null then
        v_provider_started := false;
      elsif v_attempt.provider_call_started_at is not null
        and v_cost.provider_call_started_at is not null
        and v_attempt.provider_call_started_at = v_cost.provider_call_started_at then
        v_provider_started := true;
      else
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if (v_attempt.status = 'admitted' and v_provider_started)
        or (v_attempt.status = 'processing' and not v_provider_started)
        or v_attempt.provider_call_completed_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      v_expected_trial_status :=
        case v_attempt.status
          when 'admitted' then 'queued'
          when 'processing' then 'processing'
        end;

      if v_trial.status <> v_expected_trial_status
        or v_trial.risk_state <> 'allowed' then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_provider_started then
        update public.homepage_demo_cost_buckets as bucket
        set
          reserved_units = bucket.reserved_units - v_cost.reserved_units,
          spent_units = bucket.spent_units + v_cost.reserved_units
        where bucket.id = v_cost.hour_bucket_id
          and bucket.window_kind = 'hour'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        update public.homepage_demo_cost_buckets as bucket
        set
          reserved_units = bucket.reserved_units - v_cost.reserved_units,
          spent_units = bucket.spent_units + v_cost.reserved_units
        where bucket.id = v_cost.day_bucket_id
          and bucket.window_kind = 'day'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        update public.homepage_demo_cost_reservations as cost
        set
          status = 'finalized',
          finalized_units = cost.reserved_units,
          finalized_at = v_now,
          released_at = null,
          expired_at = null
        where cost.id = v_cost.id
          and cost.status = 'reserved'
          and cost.finalized_units is null
          and cost.finalized_at is null
          and cost.released_at is null
          and cost.expired_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_finalized_cost := 1;
      else
        update public.homepage_demo_cost_buckets as bucket
        set reserved_units = bucket.reserved_units - v_cost.reserved_units
        where bucket.id = v_cost.hour_bucket_id
          and bucket.window_kind = 'hour'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        update public.homepage_demo_cost_buckets as bucket
        set reserved_units = bucket.reserved_units - v_cost.reserved_units
        where bucket.id = v_cost.day_bucket_id
          and bucket.window_kind = 'day'
          and bucket.reserved_units >= v_cost.reserved_units;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        update public.homepage_demo_cost_reservations as cost
        set
          status = 'released',
          finalized_units = null,
          finalized_at = null,
          released_at = v_now,
          expired_at = null
        where cost.id = v_cost.id
          and cost.status = 'reserved'
          and cost.finalized_units is null
          and cost.finalized_at is null
          and cost.released_at is null
          and cost.expired_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_released_cost := 1;
      end if;

      update public.homepage_demo_capacity_reservations as capacity
      set
        status = 'expired',
        released_at = null,
        expired_at = v_now
      where capacity.id = v_capacity.id
        and capacity.status = 'active'
        and capacity.lease_expires_at <= v_now
        and capacity.released_at is null
        and capacity.expired_at is null;

      get diagnostics v_row_count = row_count;

      if v_row_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      update public.homepage_demo_trial_entitlements as entitlement
      set
        status = 'expired',
        trial_id = null,
        consumed_at = null,
        released_at = null
      where entitlement.attempt_id = v_attempt.id
        and entitlement.status = 'reserved'
        and entitlement.trial_id is null
        and entitlement.consumed_at is null
        and entitlement.released_at is null;

      get diagnostics v_candidate_entitlements = row_count;

      if v_candidate_entitlements <> 2 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_provider_started then
        update public.homepage_demo_admission_attempts as attempt
        set
          status = 'failed',
          decision_code = 'processing_lease_expired',
          provider_call_completed_at = v_now
        where attempt.id = v_attempt.id
          and attempt.status = 'processing'
          and attempt.decision_code is null
          and attempt.provider_call_started_at is not null
          and attempt.provider_call_completed_at is null
          and attempt.review_ready_at is null;
      else
        update public.homepage_demo_admission_attempts as attempt
        set
          status = 'failed',
          decision_code = 'processing_lease_expired'
        where attempt.id = v_attempt.id
          and attempt.status = 'admitted'
          and attempt.decision_code is null
          and attempt.provider_call_started_at is null
          and attempt.provider_call_completed_at is null
          and attempt.review_ready_at is null;
      end if;

      get diagnostics v_row_count = row_count;

      if v_row_count <> 1 then
        raise exception using
          errcode = 'P0001',
          message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
      end if;

      if v_trial.expires_at <= v_now then
        update public.homepage_demo_trials as trial
        set
          status = 'expired',
          failure_code = null
        where trial.id = v_trial.id
          and trial.status = v_expected_trial_status
          and trial.claimed_by_user_id is null
          and trial.claimed_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_expired_trial := 1;
      else
        update public.homepage_demo_trials as trial
        set
          status = 'failed',
          failure_code = 'processing_lease_expired'
        where trial.id = v_trial.id
          and trial.status = v_expected_trial_status
          and trial.claimed_by_user_id is null
          and trial.claimed_at is null;

        get diagnostics v_row_count = row_count;

        if v_row_count <> 1 then
          raise exception using
            errcode = 'P0001',
            message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT';
        end if;

        v_candidate_failed_trial := 1;
      end if;

      recovered_attempts := recovered_attempts + 1;
      failed_attempts := failed_attempts + 1;
      expired_trials := expired_trials + v_candidate_expired_trial;
      failed_trials := failed_trials + v_candidate_failed_trial;
      expired_capacities := expired_capacities + 1;
      released_cost_reservations :=
        released_cost_reservations + v_candidate_released_cost;
      finalized_cost_reservations :=
        finalized_cost_reservations + v_candidate_finalized_cost;
      expired_or_released_entitlements :=
        expired_or_released_entitlements + v_candidate_entitlements;
    exception
      when raise_exception then
        get stacked diagnostics v_exception_message = message_text;

        if v_exception_message = 'HOMEPAGE_DEMO_MAINTENANCE_CONFLICT' then
          conflicts_skipped := conflicts_skipped + 1;
        else
          raise;
        end if;
    end;
  end loop;

  return next;
end;
$function$;

create or replace function public.reenable_share_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_link_user_id uuid;
  v_locked_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_secret_digest text;
  v_link_configuration_version integer;
  v_link_activated_at timestamptz;
  v_link_disabled_at timestamptz;
  v_secret_material_exists boolean;
  v_new_configuration_version integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Race-safe lock order, identical to activate_share_link above.
  -- 1. Identify the immutable project_id from the owned link.
  select link.project_id, link.user_id
    into v_project_id, v_link_user_id
    from public.project_share_links as link
    where link.id = p_link_id;

  if v_project_id is null or v_link_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 2. Lock the owning projects row first.
  select project.id, project.deleted_at
    into v_locked_project_id, v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id
    for update;

  if v_locked_project_id is null or v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- 3. Only then lock the specific target link row.
  select
      link.state, link.secret_digest, link.configuration_version,
      link.activated_at, link.disabled_at
    into
      v_link_state, v_link_secret_digest, v_link_configuration_version,
      v_link_activated_at, v_link_disabled_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state <> 'disabled' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_DISABLED';
  end if;

  if v_link_secret_digest is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  select exists (
      select 1
        from public.project_share_secret_material as material
        where material.share_link_id = p_link_id
    )
    into v_secret_material_exists;

  if not v_secret_material_exists then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  -- 4. With the project lock held, this check is race-safe.
  if exists (
    select 1
      from public.project_share_links as other_link
      where other_link.project_id = v_project_id
        and other_link.id <> p_link_id
        and other_link.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_ANOTHER_LINK_ACTIVE';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  -- activated_at and disabled_at are deliberately absent from this SET
  -- clause: enforce_project_share_link_integrity makes activated_at
  -- immutable once set, and disabled_at must never be cleared, so both
  -- stay exactly as they already are.
  update public.project_share_links
    set
      state = 'active',
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- No distinct "re-enabled" event code exists in the closed
  -- share_link_events vocabulary (a documented, deferred gap) -- reuse
  -- link_activated, exactly as the Phase 1B mapping report specifies.
  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_activated');

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', 'active',
    'configurationVersion', v_new_configuration_version,
    'activatedAt', v_link_activated_at,
    'disabledAt', v_link_disabled_at
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.reprocess_creem_webhook_event(p_provider_event_id text)
 RETURNS TABLE(result_processing_status text, result_reason_code text, result_resolved_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_provider_event_id text := left(nullif(btrim(coalesce(p_provider_event_id, '')), ''), 180);
  v_event public.creem_webhook_events%rowtype;
begin
  if v_provider_event_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CREEM_WEBHOOK_EVENT_ID';
  end if;

  select event_row.*
  into v_event
  from public.creem_webhook_events as event_row
  where event_row.provider_event_id = v_provider_event_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CREEM_WEBHOOK_EVENT_NOT_FOUND';
  end if;

  return query
    select
      processed.result_processing_status,
      processed.result_reason_code,
      processed.result_resolved_user_id
    from public.process_creem_webhook_event(
      v_event.provider_event_id,
      v_event.event_type,
      v_event.provider_event_created_at,
      v_event.provider_state_updated_at,
      v_event.object_id,
      v_event.checkout_id,
      v_event.subscription_id,
      v_event.customer_id,
      v_event.product_id,
      v_event.environment,
      v_event.creem_request_id,
      v_event.internal_user_id_candidate,
      v_event.webhook_action,
      v_event.normalized_subscription_status,
      v_event.cancel_at_period_end,
      v_event.current_period_start_at,
      v_event.current_period_end_at,
      v_event.refund_amount,
      v_event.amount_paid,
      v_event.refunded_amount,
      v_event.refund_currency,
      v_event.transaction_currency,
      v_event.reason_code
    ) as processed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_creem_webhook_review(p_provider_event_id text, p_decision text)
 RETURNS TABLE(result_processing_status text, result_reason_code text, result_resolved_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz := now();
  v_provider_event_id text := left(nullif(btrim(coalesce(p_provider_event_id, '')), ''), 180);
  v_decision text := left(nullif(btrim(coalesce(p_decision, '')), ''), 40);
  v_event public.creem_webhook_events%rowtype;
  v_user public.users%rowtype;
  v_customer_mismatch boolean := false;
  v_subscription_mismatch boolean := false;
begin
  if v_provider_event_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_WEBHOOK_EVENT_ID';
  end if;

  if v_decision not in ('keep_access', 'revoke_access', 'close_no_action') then
    raise exception using errcode = 'P0001', message = 'INVALID_CREEM_REVIEW_DECISION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_provider_event_id, 0));

  select event_row.*
  into v_event
  from public.creem_webhook_events as event_row
  where event_row.provider_event_id = v_provider_event_id
  for update of event_row;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_EVENT_NOT_FOUND';
  end if;

  if v_event.review_decision is not null then
    if v_event.review_decision <> v_decision then
      raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_ALREADY_RESOLVED';
    end if;

    if v_event.processing_status in ('processed', 'stale') then
      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    if v_event.processing_status <> 'pending_conflict' then
      raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_INVALID_STATE';
    end if;
  elsif v_event.processing_status <> 'pending_review' then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_EVENT_NOT_PENDING_REVIEW';
  end if;

  if v_event.resolved_user_id is null then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_USER_UNRESOLVED';
  end if;

  select user_profile.*
  into v_user
  from public.users as user_profile
  where user_profile.id = v_event.resolved_user_id
  for update of user_profile;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREEM_WEBHOOK_REVIEW_USER_NOT_FOUND';
  end if;

  if v_decision in ('keep_access', 'close_no_action') then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'processed',
      reason_code = case
        when v_decision = 'keep_access' then 'creem_webhook_review_keep_access'
        else 'creem_webhook_review_closed_no_action'
      end,
      review_decision = v_decision,
      reviewed_at = v_now,
      processed_at = coalesce(event_row.processed_at, v_now),
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := v_event.processing_status;
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_event.resolved_user_id;
    return next;
    return;
  end if;

  if v_user.billing_last_state_updated_at is not null
    and v_user.billing_last_event_created_at is not null then
    if v_user.billing_last_state_updated_at > v_event.provider_state_updated_at
      or (
        v_user.billing_last_state_updated_at = v_event.provider_state_updated_at
        and v_user.billing_last_event_created_at > v_event.provider_event_created_at
      ) then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'stale',
        reason_code = 'creem_webhook_review_stale',
        review_decision = v_decision,
        reviewed_at = v_now,
        processed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;

    if v_user.billing_last_state_updated_at = v_event.provider_state_updated_at
      and v_user.billing_last_event_created_at = v_event.provider_event_created_at
      and nullif(btrim(coalesce(v_user.billing_last_event_id, '')), '') is not null
      and v_user.billing_last_event_id <> v_event.provider_event_id then
      update public.creem_webhook_events as event_row
      set
        processing_status = 'pending_conflict',
        reason_code = 'creem_webhook_equal_timestamp_conflict',
        review_decision = v_decision,
        reviewed_at = v_now,
        updated_at = v_now
      where event_row.id = v_event.id
      returning event_row.* into v_event;

      result_processing_status := v_event.processing_status;
      result_reason_code := v_event.reason_code;
      result_resolved_user_id := v_event.resolved_user_id;
      return next;
      return;
    end if;
  end if;

  v_customer_mismatch :=
    v_event.customer_id is not null
    and nullif(btrim(coalesce(v_user.creem_customer_id, '')), '') is not null
    and btrim(v_user.creem_customer_id) <> v_event.customer_id;

  v_subscription_mismatch :=
    v_event.subscription_id is not null
    and nullif(btrim(coalesce(v_user.creem_subscription_id, '')), '') is not null
    and btrim(v_user.creem_subscription_id) <> v_event.subscription_id;

  if v_customer_mismatch or v_subscription_mismatch then
    update public.creem_webhook_events as event_row
    set
      processing_status = 'pending_conflict',
      reason_code = 'creem_webhook_provider_id_conflict',
      review_decision = v_decision,
      reviewed_at = v_now,
      updated_at = v_now
    where event_row.id = v_event.id
    returning event_row.* into v_event;

    result_processing_status := v_event.processing_status;
    result_reason_code := v_event.reason_code;
    result_resolved_user_id := v_event.resolved_user_id;
    return next;
    return;
  end if;

  update public.users as user_profile
  set
    plan = 'free',
    creem_customer_id = coalesce(v_event.customer_id, user_profile.creem_customer_id),
    creem_subscription_id = coalesce(v_event.subscription_id, user_profile.creem_subscription_id),
    subscription_status = 'refunded',
    cancel_at_period_end = false,
    billing_updated_at = v_now,
    billing_last_state_updated_at = v_event.provider_state_updated_at,
    billing_last_event_created_at = v_event.provider_event_created_at,
    billing_last_event_id = v_event.provider_event_id,
    billing_last_event_type = v_event.event_type,
    billing_last_action = 'refund_downgrade'
  where user_profile.id = v_event.resolved_user_id;

  update public.creem_webhook_events as event_row
  set
    processing_status = 'processed',
    reason_code = 'creem_webhook_review_revoke_access',
    webhook_action = 'refund_downgrade',
    normalized_subscription_status = 'refunded',
    review_decision = v_decision,
    reviewed_at = v_now,
    processed_at = v_now,
    updated_at = v_now
  where event_row.id = v_event.id
  returning event_row.* into v_event;

  result_processing_status := v_event.processing_status;
  result_reason_code := v_event.reason_code;
  result_resolved_user_id := v_event.resolved_user_id;
  return next;
end;
$function$;

create or replace function public.reveal_share_link_secret(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_public_id text;
  v_link_secret_digest text;
  v_link_secret_digest_version smallint;
  v_material_ciphertext bytea;
  v_material_nonce bytea;
  v_material_auth_tag bytea;
  v_material_encryption_version smallint;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Pure read: no row lock. The link's state can only move away from
  -- 'active' concurrently (disable/rotate-in-place/revoke), never
  -- toward it as a side effect of another operation racing this one, so
  -- an unlocked read here cannot observe a torn write across the two
  -- tables queried below -- each of those UPDATEs (activate_share_link,
  -- rotate_share_link_secret) commits both of its own table changes in
  -- one transaction already.
  select
      link.state, link.public_id, link.secret_digest,
      link.secret_digest_version, link.project_id
    into
      v_link_state, v_link_public_id, v_link_secret_digest,
      v_link_secret_digest_version, v_project_id
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Draft, disabled, expired and revoked must not reveal the secret.
  if v_link_state <> 'active' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  if v_link_secret_digest is null or v_link_secret_digest_version <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  select material.ciphertext, material.nonce, material.auth_tag, material.encryption_version
    into v_material_ciphertext, v_material_nonce, v_material_auth_tag, v_material_encryption_version
    from public.project_share_secret_material as material
    where material.share_link_id = p_link_id;

  if v_material_ciphertext is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  -- Never decrypts, never returns plaintext -- only already-encrypted
  -- material, lowercase hex, to the authenticated server caller.
  -- Decryption happens only in server-only TypeScript
  -- (lib/share/share-secret-encryption.server.ts). Does not touch
  -- configuration_version, view counters, events, sessions or grants:
  -- disclosing an already-valid secret again is not a new access grant.
  return jsonb_build_object(
    'linkId', p_link_id,
    'publicId', v_link_public_id,
    'ciphertextHex', encode(v_material_ciphertext, 'hex'),
    'nonceHex', encode(v_material_nonce, 'hex'),
    'authTagHex', encode(v_material_auth_tag, 'hex'),
    'encryptionVersion', v_material_encryption_version
  );
end;
$$;

create or replace function public.revoke_share_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select link.state, link.configuration_version, link.project_id
    into v_link_state, v_link_configuration_version, v_project_id
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Revoked is terminal (enforce_project_share_link_integrity already
  -- makes this unconditional); an already-revoked link returns a stable
  -- state conflict rather than silently replaying the mutation.
  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      state = 'revoked',
      revoked_at = v_now,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  -- Encrypted secret material is deliberately left in place, not
  -- deleted -- a revoked link's secret is already unusable
  -- (reveal_share_link_secret only allows state = 'active'), so no
  -- destructive cleanup is invented here.
  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_revoked');

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', 'revoked',
    'configurationVersion', v_new_configuration_version,
    'revokedAt', v_now
  );
end;
$$;

create or replace function public.rotate_share_link_secret(
  p_link_id uuid,
  p_secret_digest text,
  p_secret_digest_version smallint,
  p_ciphertext_hex text,
  p_nonce_hex text,
  p_auth_tag_hex text,
  p_encryption_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_public_id text;
  v_link_configuration_version integer;
  v_link_secret_digest text;
  v_link_rotated_at timestamptz;
  v_new_configuration_version integer;
  v_rotation_timestamp timestamptz;
  v_updated_link_count integer;
  v_updated_material_count integer;
  v_secret_material_exists boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- No plaintext-secret parameter exists at all. Validation matches
  -- activate_share_link (202608060001) exactly.
  if p_secret_digest is null or p_secret_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST';
  end if;

  if p_secret_digest_version is null or p_secret_digest_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_SECRET_DIGEST_VERSION';
  end if;

  if p_ciphertext_hex is null or p_ciphertext_hex !~ '^[0-9a-f]{86}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CIPHERTEXT';
  end if;

  if p_nonce_hex is null or p_nonce_hex !~ '^[0-9a-f]{24}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_NONCE';
  end if;

  if p_auth_tag_hex is null or p_auth_tag_hex !~ '^[0-9a-f]{32}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_AUTH_TAG';
  end if;

  if p_encryption_version is null or p_encryption_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_ENCRYPTION_VERSION';
  end if;

  select
      link.state, link.public_id, link.configuration_version,
      link.secret_digest, link.project_id, link.rotated_at
    into
      v_link_state, v_link_public_id, v_link_configuration_version,
      v_link_secret_digest, v_project_id, v_link_rotated_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- Rotation is supported only for active and disabled links. draft has
  -- no secret to rotate (caught by the secret_digest check below
  -- regardless); revoked is terminal; expired -> rotate is not part of
  -- this phase's supported behavior.
  if v_link_state not in ('active', 'disabled') then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_STATE_CONFLICT';
  end if;

  if v_link_secret_digest is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  select exists (
      select 1
        from public.project_share_secret_material as material
        where material.share_link_id = p_link_id
    )
    into v_secret_material_exists;

  if not v_secret_material_exists then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  -- rotated_at must represent the actual moment of THIS rotation and must
  -- be strictly greater than the row's own previous rotated_at --
  -- enforce_project_share_link_integrity (202608030005) requires exactly
  -- that whenever a secret genuinely changes on a link that already had
  -- one. now()/transaction_timestamp() is fixed for the entire enclosing
  -- transaction and is therefore NOT safe here: two rotations of the same
  -- link inside one transaction (a legitimate sequence -- nothing in this
  -- RPC or its callers forbids it) would otherwise compute the identical
  -- timestamp and the second rotation would fail its own integrity check.
  -- clock_timestamp() is real wall-clock time that advances on every call
  -- regardless of transaction boundaries, but even that is not by itself
  -- guaranteed to differ from the previous rotation at very high call
  -- rates or on platforms with coarse clock resolution, so the result is
  -- additionally floored to strictly exceed the previous rotated_at.
  v_rotation_timestamp := clock_timestamp();
  if v_link_rotated_at is not null and v_rotation_timestamp <= v_link_rotated_at then
    v_rotation_timestamp := v_link_rotated_at + interval '1 microsecond';
  end if;

  -- state, public_id, activated_at, disabled_at and expires_at are
  -- deliberately absent from this SET clause -- rotation replaces only
  -- the secret material, never the link's own lifecycle state or
  -- identity. access_epoch (new, 202608250001) IS bumped here -- this is
  -- the one and only place it is bumped: rotation is the sole operation
  -- that must force every previously-authorized browser to prove fresh
  -- knowledge of the secret again, with no PIN-only or any other recovery
  -- path.
  update public.project_share_links
    set
      secret_digest = p_secret_digest,
      secret_digest_version = p_secret_digest_version,
      rotated_at = v_rotation_timestamp,
      configuration_version = v_new_configuration_version,
      access_epoch = access_epoch + 1
    where id = p_link_id
      and user_id = v_user_id;

  get diagnostics v_updated_link_count = row_count;

  if v_updated_link_count <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  update public.project_share_secret_material
    set
      ciphertext = decode(p_ciphertext_hex, 'hex'),
      nonce = decode(p_nonce_hex, 'hex'),
      auth_tag = decode(p_auth_tag_hex, 'hex'),
      encryption_version = p_encryption_version
    where share_link_id = p_link_id;

  get diagnostics v_updated_material_count = row_count;

  if v_updated_material_count <> 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_SECRET_MATERIAL_MISSING';
  end if;

  insert into public.share_link_events (share_link_id, event_type)
  values (p_link_id, 'link_rotated');

  return jsonb_build_object(
    'linkId', p_link_id,
    'publicId', v_link_public_id,
    'state', v_link_state,
    'configurationVersion', v_new_configuration_version,
    'rotatedAt', v_rotation_timestamp
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.run_homepage_demo_maintenance(p_limit integer DEFAULT 1000)
 RETURNS TABLE(lock_acquired boolean, recovered_attempts integer, failed_attempts integer, expired_trials integer, failed_trials integer, expired_capacities integer, released_cost_reservations integer, finalized_cost_reservations integer, expired_or_released_entitlements integer, conflicts_skipped integer, purged_trials integer, deleted_entitlements integer, deleted_attempts integer, deleted_rate_buckets integer, deleted_capacity_reservations integer, deleted_cost_reservations integer, deleted_cost_buckets integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_limit integer := coalesce(p_limit, 1000);
  v_lock_key bigint := 250630001501;
begin
  if v_limit <= 0 then
    v_limit := 1000;
  end if;

  if v_limit > 1000 then
    v_limit := 1000;
  end if;

  lock_acquired := pg_try_advisory_xact_lock(v_lock_key);

  recovered_attempts := 0;
  failed_attempts := 0;
  expired_trials := 0;
  failed_trials := 0;
  expired_capacities := 0;
  released_cost_reservations := 0;
  finalized_cost_reservations := 0;
  expired_or_released_entitlements := 0;
  conflicts_skipped := 0;
  purged_trials := 0;
  deleted_entitlements := 0;
  deleted_attempts := 0;
  deleted_rate_buckets := 0;
  deleted_capacity_reservations := 0;
  deleted_cost_reservations := 0;
  deleted_cost_buckets := 0;

  if not lock_acquired then
    return next;
    return;
  end if;

  select
    recovery.recovered_attempts,
    recovery.failed_attempts,
    recovery.expired_trials,
    recovery.failed_trials,
    recovery.expired_capacities,
    recovery.released_cost_reservations,
    recovery.finalized_cost_reservations,
    recovery.expired_or_released_entitlements,
    recovery.conflicts_skipped
  into
    recovered_attempts,
    failed_attempts,
    expired_trials,
    failed_trials,
    expired_capacities,
    released_cost_reservations,
    finalized_cost_reservations,
    expired_or_released_entitlements,
    conflicts_skipped
  from public.recover_stale_homepage_demo_processing(v_limit) as recovery;

  select
    retention.purged_trials,
    retention.deleted_entitlements,
    retention.deleted_attempts,
    retention.deleted_rate_buckets,
    retention.deleted_capacity_reservations,
    retention.deleted_cost_reservations,
    retention.deleted_cost_buckets
  into
    purged_trials,
    deleted_entitlements,
    deleted_attempts,
    deleted_rate_buckets,
    deleted_capacity_reservations,
    deleted_cost_reservations,
    deleted_cost_buckets
  from public.purge_homepage_demo_retention(v_limit) as retention;

  return next;
end;
$function$;

create or replace function public.save_share_configuration(
  p_link_id uuid,
  p_settings jsonb,
  p_tasks jsonb,
  p_resources jsonb,
  p_publish_update jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();

  v_project_id uuid;
  v_link_user_id uuid;
  v_locked_project_id uuid;
  v_project_deleted_at timestamptz;
  v_project_is_archived boolean;

  v_link_state text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_old_comments_enabled boolean;
  v_old_client_facing_subtitle text;
  v_old_content_direction text;
  v_old_title_visible boolean;
  v_old_status_visible boolean;
  v_old_target_date_visible boolean;

  v_has_comments_enabled boolean := false;
  v_comments_enabled boolean;
  v_has_client_facing_subtitle boolean := false;
  v_client_facing_subtitle text;
  v_has_content_direction boolean := false;
  v_content_direction text;
  v_has_title_visible boolean := false;
  v_title_visible boolean;
  v_has_status_visible boolean := false;
  v_status_visible boolean;
  v_has_target_date_visible boolean := false;
  v_target_date_visible boolean;
  v_settings_changed boolean := false;

  v_task_item jsonb;
  v_task_id bigint;
  v_task_ids bigint[] := array[]::bigint[];
  v_task_public_groups text[] := array[]::text[];
  v_task_waiting_flags boolean[] := array[]::boolean[];
  v_task_display_orders integer[] := array[]::integer[];
  v_result_task_ids jsonb;

  v_resource_item jsonb;
  v_resource_id uuid;
  v_resource_label text;
  v_resource_ids uuid[] := array[]::uuid[];
  v_resource_labels text[] := array[]::text[];
  v_resource_can_download_flags boolean[] := array[]::boolean[];
  v_resource_display_orders integer[] := array[]::integer[];
  v_result_resource_ids jsonb;

  v_publish_body text;
  v_next_version integer;
  v_publish_inserted_count integer;
  v_current_update_version integer;
  v_current_update_published_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- =======================================================
  -- Shape/type/bounds validation for every supplied group.
  -- Pure JSON parsing, no database dependency, so it happens before any
  -- lock or write -- "validate all supplied groups before applying any
  -- write whenever practical".
  -- =======================================================

  -- ---------------- settings ----------------
  if p_settings is not null then
    if jsonb_typeof(p_settings) <> 'object' then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
    end if;

    if (
      p_settings
        - 'commentsEnabled' - 'clientFacingSubtitle' - 'contentDirection'
        - 'titleVisible' - 'statusVisible' - 'targetDateVisible'
    ) <> '{}'::jsonb then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
    end if;

    if p_settings = '{}'::jsonb then
      raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
    end if;

    v_has_comments_enabled := p_settings ? 'commentsEnabled';
    if v_has_comments_enabled then
      if jsonb_typeof(p_settings->'commentsEnabled') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_comments_enabled := (p_settings->>'commentsEnabled')::boolean;
    end if;

    v_has_client_facing_subtitle := p_settings ? 'clientFacingSubtitle';
    if v_has_client_facing_subtitle then
      if jsonb_typeof(p_settings->'clientFacingSubtitle') = 'null' then
        v_client_facing_subtitle := null;
      elsif jsonb_typeof(p_settings->'clientFacingSubtitle') = 'string' then
        v_client_facing_subtitle := p_settings->>'clientFacingSubtitle';

        -- Matches project_share_links_client_facing_subtitle_check
        -- exactly (202608030003): btrim length >= 1, raw length <= 200.
        -- The value is stored exactly as submitted, never trimmed.
        if char_length(v_client_facing_subtitle) > 200
          or char_length(btrim(v_client_facing_subtitle)) < 1 then
          raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
        end if;
      else
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
    end if;

    v_has_content_direction := p_settings ? 'contentDirection';
    if v_has_content_direction then
      if jsonb_typeof(p_settings->'contentDirection') <> 'string'
        or (p_settings->>'contentDirection') not in ('auto', 'ltr', 'rtl') then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_content_direction := p_settings->>'contentDirection';
    end if;

    -- Phase 1C: durable publication-intent flags. Same has-key/strict-
    -- boolean-type validation pattern as commentsEnabled above -- no
    -- coercion of "true"/"false" strings, 0/1, or any other truthy value.
    v_has_title_visible := p_settings ? 'titleVisible';
    if v_has_title_visible then
      if jsonb_typeof(p_settings->'titleVisible') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_title_visible := (p_settings->>'titleVisible')::boolean;
    end if;

    v_has_status_visible := p_settings ? 'statusVisible';
    if v_has_status_visible then
      if jsonb_typeof(p_settings->'statusVisible') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_status_visible := (p_settings->>'statusVisible')::boolean;
    end if;

    v_has_target_date_visible := p_settings ? 'targetDateVisible';
    if v_has_target_date_visible then
      if jsonb_typeof(p_settings->'targetDateVisible') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_SETTINGS';
      end if;
      v_target_date_visible := (p_settings->>'targetDateVisible')::boolean;
    end if;
  end if;

  -- ---------------- tasks ----------------
  if p_tasks is not null then
    if jsonb_typeof(p_tasks) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
    end if;

    if jsonb_array_length(p_tasks) > 500 then
      raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
    end if;

    for v_task_item in select * from jsonb_array_elements(p_tasks) loop
      if jsonb_typeof(v_task_item) <> 'object' then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if (
        v_task_item
          - 'subtaskId' - 'publicGroup'
          - 'waitingForClientFeedback' - 'displayOrder'
      ) <> '{}'::jsonb then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if not (
        v_task_item ? 'subtaskId'
        and v_task_item ? 'publicGroup'
        and v_task_item ? 'waitingForClientFeedback'
        and v_task_item ? 'displayOrder'
      ) then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      -- Canonical positive decimal string (/^[1-9][0-9]*$/), matching
      -- lib/share/share-contracts.ts's canonicalSubtaskIdSchema exactly.
      -- Cast to bigint only after this regex passes.
      if jsonb_typeof(v_task_item->'subtaskId') <> 'string'
        or (v_task_item->>'subtaskId') !~ '^[1-9][0-9]*$' then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      begin
        v_task_id := (v_task_item->>'subtaskId')::bigint;
      exception
        when others then
          raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end;

      if v_task_id = any(v_task_ids) then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if jsonb_typeof(v_task_item->'publicGroup') <> 'string'
        or (v_task_item->>'publicGroup') not in (
          'in_progress', 'waiting_for_feedback', 'completed', 'coming_up'
        ) then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      if jsonb_typeof(v_task_item->'waitingForClientFeedback') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      -- Non-negative integer only, bounded to the delivered integer
      -- column's own accepted range (2147483647). The regex on the JSON
      -- number's own text representation rejects a fractional value (a
      -- decimal point is not a digit), a negative value (a leading '-'
      -- is not a digit), and exponent notation, all in one check. The
      -- upper-bound comparison casts through `numeric` -- which never
      -- overflows for a pure-digit string, unlike `bigint` -- so an
      -- oversized digit string a direct RPC caller supplies is rejected
      -- with this stable P0001 error rather than raising a native
      -- 22003 numeric-value-out-of-range error that would escape
      -- uncaught. Only after this bound is proven does the value ever
      -- reach an `::integer` cast.
      if jsonb_typeof(v_task_item->'displayOrder') <> 'number'
        or (v_task_item->>'displayOrder') !~ '^[0-9]+$'
        or (v_task_item->>'displayOrder')::numeric > 2147483647 then
        raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
      end if;

      v_task_ids := array_append(v_task_ids, v_task_id);
      v_task_public_groups :=
        array_append(v_task_public_groups, v_task_item->>'publicGroup');
      v_task_waiting_flags := array_append(
        v_task_waiting_flags,
        (v_task_item->>'waitingForClientFeedback')::boolean
      );
      v_task_display_orders := array_append(
        v_task_display_orders,
        (v_task_item->>'displayOrder')::integer
      );
    end loop;
  end if;

  -- ---------------- resources ----------------
  if p_resources is not null then
    if jsonb_typeof(p_resources) <> 'array' then
      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
    end if;

    if jsonb_array_length(p_resources) > 500 then
      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
    end if;

    for v_resource_item in select * from jsonb_array_elements(p_resources) loop
      if jsonb_typeof(v_resource_item) <> 'object' then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if (
        v_resource_item
          - 'resourceId' - 'publicLabel' - 'canDownload' - 'displayOrder'
      ) <> '{}'::jsonb then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if not (
        v_resource_item ? 'resourceId'
        and v_resource_item ? 'publicLabel'
        and v_resource_item ? 'canDownload'
        and v_resource_item ? 'displayOrder'
      ) then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if jsonb_typeof(v_resource_item->'resourceId') <> 'string'
        or (v_resource_item->>'resourceId') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      begin
        v_resource_id := lower(v_resource_item->>'resourceId')::uuid;
      exception
        when others then
          raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end;

      if v_resource_id = any(v_resource_ids) then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if jsonb_typeof(v_resource_item->'publicLabel') <> 'string' then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      v_resource_label := v_resource_item->>'publicLabel';

      -- Matches share_link_resources_public_label_check exactly
      -- (202608030003): btrim length >= 1, raw length <= 120. Stored
      -- exactly as submitted, never trimmed.
      if char_length(v_resource_label) > 120
        or char_length(btrim(v_resource_label)) < 1 then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      if jsonb_typeof(v_resource_item->'canDownload') <> 'boolean' then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      -- Same overflow-safe numeric bound as the task displayOrder check
      -- above -- see its comment for the full reasoning.
      if jsonb_typeof(v_resource_item->'displayOrder') <> 'number'
        or (v_resource_item->>'displayOrder') !~ '^[0-9]+$'
        or (v_resource_item->>'displayOrder')::numeric > 2147483647 then
        raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
      end if;

      v_resource_ids := array_append(v_resource_ids, v_resource_id);
      v_resource_labels := array_append(v_resource_labels, v_resource_label);
      v_resource_can_download_flags := array_append(
        v_resource_can_download_flags,
        (v_resource_item->>'canDownload')::boolean
      );
      v_resource_display_orders := array_append(
        v_resource_display_orders,
        (v_resource_item->>'displayOrder')::integer
      );
    end loop;
  end if;

  -- ---------------- publishUpdate ----------------
  if p_publish_update is not null then
    if jsonb_typeof(p_publish_update) <> 'object' then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    if (p_publish_update - 'body') <> '{}'::jsonb then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    if not (p_publish_update ? 'body') then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    if jsonb_typeof(p_publish_update->'body') <> 'string' then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;

    v_publish_body := p_publish_update->>'body';

    -- Matches share_link_updates_body_check exactly (202608030003):
    -- btrim length >= 1, raw length <= 5000. Stored exactly as
    -- submitted, never trimmed.
    if char_length(v_publish_body) > 5000
      or char_length(btrim(v_publish_body)) < 1 then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISH_UPDATE';
    end if;
  end if;

  -- At least one group must be supplied. Defense in depth: the route's
  -- own Zod schema already enforces this at the HTTP boundary.
  if p_settings is null
    and p_tasks is null
    and p_resources is null
    and p_publish_update is null
  then
    raise exception using errcode = 'P0001', message = 'INVALID_CONFIGURATION';
  end if;

  -- =======================================================
  -- Ownership resolution and locking. Exact project-then-link order
  -- activate_share_link/reenable_share_link (202608060001) established:
  -- 1. Resolve the link's immutable project_id with a plain read.
  -- 2. Lock the owning project row FOR UPDATE first.
  -- 3. Lock the target link row FOR UPDATE.
  -- 4. Re-evaluate state only after both locks are held.
  -- =======================================================

  select link.project_id, link.user_id
    into v_project_id, v_link_user_id
    from public.project_share_links as link
    where link.id = p_link_id;

  if v_project_id is null or v_link_user_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.id, project.deleted_at, project.is_archived
    into v_locked_project_id, v_project_deleted_at, v_project_is_archived
    from public.projects as project
    where project.id = v_project_id
    for update;

  if v_locked_project_id is null or v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_project_is_archived then
    raise exception using errcode = 'P0001', message = 'PROJECT_ARCHIVED';
  end if;

  select
      link.state,
      link.configuration_version,
      link.comments_enabled,
      link.client_facing_subtitle,
      link.content_direction,
      link.title_visible,
      link.status_visible,
      link.target_date_visible
    into
      v_link_state,
      v_link_configuration_version,
      v_old_comments_enabled,
      v_old_client_facing_subtitle,
      v_old_content_direction,
      v_old_title_visible,
      v_old_status_visible,
      v_old_target_date_visible
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  v_new_configuration_version := v_link_configuration_version;

  -- =======================================================
  -- Settings sub-operation. Only supplied fields change; omitted fields
  -- keep their current value via the CASE/self-reference below.
  -- configuration_version increases exactly once, only for a genuine
  -- change (IS DISTINCT FROM) to any of the six settings fields, and
  -- only settings ever bump it.
  -- =======================================================

  v_settings_changed :=
    p_settings is not null
    and (
      (v_has_comments_enabled
        and v_comments_enabled is distinct from v_old_comments_enabled)
      or (v_has_client_facing_subtitle
        and v_client_facing_subtitle is distinct from v_old_client_facing_subtitle)
      or (v_has_content_direction
        and v_content_direction is distinct from v_old_content_direction)
      or (v_has_title_visible
        and v_title_visible is distinct from v_old_title_visible)
      or (v_has_status_visible
        and v_status_visible is distinct from v_old_status_visible)
      or (v_has_target_date_visible
        and v_target_date_visible is distinct from v_old_target_date_visible)
    );

  if v_settings_changed then
    v_new_configuration_version := v_link_configuration_version + 1;

    update public.project_share_links
      set
        comments_enabled = case
          when v_has_comments_enabled then v_comments_enabled
          else comments_enabled
        end,
        client_facing_subtitle = case
          when v_has_client_facing_subtitle then v_client_facing_subtitle
          else client_facing_subtitle
        end,
        content_direction = case
          when v_has_content_direction then v_content_direction
          else content_direction
        end,
        title_visible = case
          when v_has_title_visible then v_title_visible
          else title_visible
        end,
        status_visible = case
          when v_has_status_visible then v_status_visible
          else status_visible
        end,
        target_date_visible = case
          when v_has_target_date_visible then v_target_date_visible
          else target_date_visible
        end,
        configuration_version = v_new_configuration_version
      where id = p_link_id and user_id = v_user_id;
  end if;

  -- =======================================================
  -- Task-mapping sub-operation. Prevalidates every submitted task against
  -- the same owner/project-attribution rule
  -- enforce_share_link_task_integrity independently re-enforces as an
  -- unconditional second line of defense, then performs a deterministic
  -- set replacement: delete rows absent from the submitted set, then
  -- insert-or-update-on-conflict the submitted set. An empty array
  -- clears the mapping (the delete's own predicate is unconditionally
  -- true for every existing row when v_task_ids is empty).
  -- =======================================================

  if p_tasks is not null then
    if cardinality(v_task_ids) > 0 and exists (
      select 1
        from unnest(v_task_ids) as requested_id
        left join public.tasks as task
          on task.id = requested_id
        where task.id is null
          or task.user_id <> v_user_id
          or task.deleted_at is not null
          or task.project_id is distinct from v_project_id
    ) then
      raise exception using errcode = 'P0001', message = 'INVALID_TASKS';
    end if;

    delete from public.share_link_tasks
      where share_link_id = p_link_id
        and user_id = v_user_id
        and not (subtask_id = any(v_task_ids));

    insert into public.share_link_tasks (
      user_id,
      share_link_id,
      subtask_id,
      public_group,
      waiting_for_client_feedback,
      display_order
    )
    select
      v_user_id,
      p_link_id,
      t.subtask_id,
      t.public_group,
      t.waiting_for_client_feedback,
      t.display_order
    from unnest(
      v_task_ids, v_task_public_groups, v_task_waiting_flags, v_task_display_orders
    ) as t(subtask_id, public_group, waiting_for_client_feedback, display_order)
    on conflict (share_link_id, subtask_id) do update
      set
        public_group = excluded.public_group,
        waiting_for_client_feedback = excluded.waiting_for_client_feedback,
        display_order = excluded.display_order;

    if (
      select count(*)
        from public.share_link_tasks
        where share_link_id = p_link_id and user_id = v_user_id
    ) <> cardinality(v_task_ids) then
      raise exception using errcode = 'P0001', message = 'TASK_SET_VERIFICATION_FAILED';
    end if;
  end if;

  -- =======================================================
  -- Resource-mapping sub-operation. Mirrors enforce_share_link_resource_
  -- integrity's own project-attribution rule (direct project_id match,
  -- or task_id-derived project match, with contradiction rejected and
  -- neither present rejected) as an independent prevalidation, then the
  -- same deterministic set-replacement pattern as tasks.
  -- =======================================================

  if p_resources is not null then
    if cardinality(v_resource_ids) > 0 and exists (
      select 1
        from unnest(v_resource_ids) as requested_id
        left join public.task_resources as resource
          on resource.id = requested_id
        left join public.tasks as resource_task
          on resource_task.id = resource.task_id
        where resource.id is null
          or resource.user_id <> v_user_id
          or (resource.project_id is null and resource.task_id is null)
          or (
            resource.project_id is not null
            and resource.project_id <> v_project_id
          )
          or (
            resource.task_id is not null
            and (
              resource_task.id is null
              or resource_task.user_id <> v_user_id
              or resource_task.project_id is distinct from v_project_id
              or (
                resource.project_id is not null
                and resource.project_id <> resource_task.project_id
              )
            )
          )
    ) then
      raise exception using errcode = 'P0001', message = 'INVALID_RESOURCES';
    end if;

    delete from public.share_link_resources
      where share_link_id = p_link_id
        and user_id = v_user_id
        and not (resource_id = any(v_resource_ids));

    insert into public.share_link_resources (
      user_id,
      share_link_id,
      resource_id,
      public_label,
      can_download,
      display_order
    )
    select
      v_user_id,
      p_link_id,
      r.resource_id,
      r.public_label,
      r.can_download,
      r.display_order
    from unnest(
      v_resource_ids,
      v_resource_labels,
      v_resource_can_download_flags,
      v_resource_display_orders
    ) as r(resource_id, public_label, can_download, display_order)
    on conflict (share_link_id, resource_id) do update
      set
        public_label = excluded.public_label,
        can_download = excluded.can_download,
        display_order = excluded.display_order;

    if (
      select count(*)
        from public.share_link_resources
        where share_link_id = p_link_id and user_id = v_user_id
    ) <> cardinality(v_resource_ids) then
      raise exception using errcode = 'P0001', message = 'RESOURCE_SET_VERIFICATION_FAILED';
    end if;
  end if;

  -- =======================================================
  -- Update-publication sub-operation. Mandatory order: retire the
  -- existing current row(s) BEFORE inserting the new one, because
  -- share_link_updates_current_version_unique_idx (a partial unique
  -- index on share_link_id where is_current) rejects two simultaneous
  -- current rows for the same link. Never edits an existing published
  -- row's immutable body/version/published_at -- only is_current changes
  -- on the retired row, matching enforce_share_link_update_integrity's
  -- own allowance exactly.
  -- =======================================================

  if p_publish_update is not null then
    update public.share_link_updates
      set is_current = false
      where share_link_id = p_link_id
        and is_current;

    select coalesce(max(version), 0) + 1
      into v_next_version
      from public.share_link_updates
      where share_link_id = p_link_id;

    insert into public.share_link_updates (
      user_id,
      share_link_id,
      body,
      version,
      published_at,
      created_by,
      is_current
    ) values (
      v_user_id,
      p_link_id,
      v_publish_body,
      v_next_version,
      v_now,
      v_user_id,
      true
    );

    get diagnostics v_publish_inserted_count = row_count;

    if v_publish_inserted_count <> 1 then
      raise exception using errcode = 'P0001', message = 'PUBLISH_UPDATE_INSERT_FAILED';
    end if;
  end if;

  -- =======================================================
  -- Final committed state. currentUpdate always reflects the row that is
  -- current after every sub-operation above, whether or not this call
  -- itself published one.
  -- =======================================================

  v_current_update_version := null;
  v_current_update_published_at := null;

  select update_row.version, update_row.published_at
    into v_current_update_version, v_current_update_published_at
    from public.share_link_updates as update_row
    where update_row.share_link_id = p_link_id
      and update_row.is_current;

  select coalesce(
      jsonb_agg(
        final_task.subtask_id::text
        order by final_task.display_order, final_task.subtask_id
      ),
      '[]'::jsonb
    )
    into v_result_task_ids
    from public.share_link_tasks as final_task
    where final_task.share_link_id = p_link_id
      and final_task.user_id = v_user_id;

  select coalesce(
      jsonb_agg(
        final_resource.resource_id::text
        order by final_resource.display_order, final_resource.resource_id
      ),
      '[]'::jsonb
    )
    into v_result_resource_ids
    from public.share_link_resources as final_resource
    where final_resource.share_link_id = p_link_id
      and final_resource.user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'configurationVersion', v_new_configuration_version,
    'taskIds', v_result_task_ids,
    'resourceIds', v_result_resource_ids,
    'currentUpdate', case
      when v_current_update_version is null then null
      else jsonb_build_object(
        'version', v_current_update_version,
        'publishedAt', v_current_update_published_at
      )
    end
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.send_share_message_reply(p_share_link_id uuid, p_parent_message_id uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_link_user_id uuid;
  v_link_project_id uuid;
  v_project_deleted_at timestamptz;
  v_parent_share_link_id uuid;
  v_parent_user_id uuid;
  v_trimmed_body text;
  v_new_id uuid;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_share_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select link.user_id, link.project_id
    into v_link_user_id, v_link_project_id
    from public.project_share_links as link
    where link.id = p_share_link_id and link.user_id = v_user_id;

  if v_link_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_link_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if p_parent_message_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_NOT_FOUND';
  end if;

  select message.share_link_id, message.user_id
    into v_parent_share_link_id, v_parent_user_id
    from public.share_messages as message
    where message.id = p_parent_message_id
      and message.user_id = v_user_id;

  if v_parent_share_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_NOT_FOUND';
  end if;

  if v_parent_share_link_id <> p_share_link_id then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_PARENT_LINK_MISMATCH';
  end if;

  -- Mirrors share_messages_body_check exactly (btrim length 1-4000) so
  -- an invalid body is rejected here, fail-fast, before the insert ever
  -- reaches that constraint.
  v_trimmed_body := btrim(coalesce(p_body, ''));

  if char_length(v_trimmed_body) < 1 then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_BODY_EMPTY';
  end if;

  if char_length(p_body) > 4000 then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_BODY_TOO_LONG';
  end if;

  -- author_type is always 'owner' and is_visible_to_client is always
  -- true -- neither is a caller-supplied parameter, so an owner reply
  -- can never be inserted any other way through this function.
  -- status='reviewed'/reviewed_at=now(): the owner's own reply does not
  -- need further owner review (they just wrote it), so 'new' would
  -- misrepresent it; share_messages_unread_client_idx only ever counts
  -- author_type='client' rows regardless, so this choice has no effect
  -- on the unread counter either way.
  insert into public.share_messages (
    user_id, share_link_id, project_id,
    author_type, author_display_name, body, parent_id,
    is_visible_to_client, status, reviewed_at
  ) values (
    v_user_id, p_share_link_id, v_link_project_id,
    'owner', null, p_body, p_parent_message_id,
    true, 'reviewed', v_now
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'messageId', v_new_id,
    'shareLinkId', p_share_link_id,
    'parentId', p_parent_message_id,
    'authorType', 'owner',
    'createdAt', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_calendar_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_client_share_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_homepage_demo_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_share_link_expiry(p_link_id uuid, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_link_expires_at timestamptz;
  v_link_updated_at timestamptz;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if p_expires_at is null then
    raise exception using errcode = 'P0001', message = 'INVALID_EXPIRY';
  end if;

  -- Strictly in the future relative to the transaction timestamp. This
  -- also transitively satisfies the delivered
  -- project_share_links_timestamp_order_check
  -- (expires_at is null or expires_at > created_at), since created_at is
  -- always at or before the current transaction's now().
  if p_expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'INVALID_EXPIRY';
  end if;

  select
      link.state, link.configuration_version, link.project_id,
      link.expires_at, link.updated_at
    into
      v_link_state, v_link_configuration_version, v_project_id,
      v_link_expires_at, v_link_updated_at
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  -- Nothing in the delivered schema restricts SETTING expires_at by
  -- state (unlike clearing it while state = 'expired' -- see
  -- clear_share_link_expiry below) -- draft, active, disabled and
  -- expired may all have their expiry set or replaced. No state
  -- transition is invented or performed here.
  if v_link_expires_at is not null and v_link_expires_at = p_expires_at then
    -- Exact no-op: configuration_version must not increase.
    return jsonb_build_object(
      'linkId', p_link_id,
      'state', v_link_state,
      'expiresAt', v_link_expires_at,
      'configurationVersion', v_link_configuration_version,
      'updatedAt', v_link_updated_at
    );
  end if;

  v_new_configuration_version := v_link_configuration_version + 1;

  update public.project_share_links
    set
      expires_at = p_expires_at,
      configuration_version = v_new_configuration_version
    where id = p_link_id
      and user_id = v_user_id;

  return jsonb_build_object(
    'linkId', p_link_id,
    'state', v_link_state,
    'expiresAt', p_expires_at,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_share_link_pin(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_deleted_at timestamptz;
  v_link_state text;
  v_link_configuration_version integer;
  v_new_configuration_version integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_link_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  -- No plaintext PIN parameter exists at all -- only an already-hashed
  -- V1 scrypt profile crosses this boundary. Every field is validated
  -- against the exact V1 profile before any mutation is attempted.
  if p_pin_hash is null or p_pin_hash !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_salt is null or p_pin_salt !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_hash_version is null or p_pin_hash_version <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_scrypt_n is null or p_pin_scrypt_n <> 16384 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_scrypt_r is null or p_pin_scrypt_r <> 8 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_scrypt_p is null or p_pin_scrypt_p <> 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  if p_pin_key_length is null or p_pin_key_length <> 32 then
    raise exception using errcode = 'P0001', message = 'INVALID_PIN_MATERIAL';
  end if;

  select link.state, link.configuration_version, link.project_id
    into v_link_state, v_link_configuration_version, v_project_id
    from public.project_share_links as link
    where link.id = p_link_id and link.user_id = v_user_id
    for update;

  if v_link_state is null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_NOT_FOUND';
  end if;

  if v_link_state = 'revoked' then
    raise exception using errcode = 'P0001', message = 'SHARE_LINK_REVOKED';
  end if;

  -- Every other schema-supported lifecycle state (draft, active,
  -- disabled, expired) may configure a PIN -- nothing in the delivered
  -- schema restricts PIN columns by state.
  v_new_configuration_version := v_link_configuration_version + 1;

  -- pin_epoch (new, 202608250001) is bumped unconditionally here, exactly
  -- like configuration_version -- this single RPC serves both "add a PIN
  -- where none existed" and "change an existing PIN to a new value", and
  -- only the latter case strictly needs the bump (an existing grant's own
  -- pin_verified_at can already be non-null from the OLD PIN, so the
  -- PIN-required check alone would not force revalidation against a NEW
  -- value) -- but since one RPC covers both, bumping unconditionally is
  -- the only safe choice (harmless no-op for the first-add case, where
  -- the existing pin_verified_at-is-null check already denies stale
  -- grants regardless).
  update public.project_share_links
    set
      pin_hash = p_pin_hash,
      pin_salt = p_pin_salt,
      pin_hash_version = p_pin_hash_version,
      pin_scrypt_n = p_pin_scrypt_n,
      pin_scrypt_r = p_pin_scrypt_r,
      pin_scrypt_p = p_pin_scrypt_p,
      pin_key_length = p_pin_key_length,
      configuration_version = v_new_configuration_version,
      pin_epoch = pin_epoch + 1
    where id = p_link_id
      and user_id = v_user_id;

  -- No event: the closed share_link_events vocabulary has no PIN event.
  -- No session/grant write: invalidation is entirely through
  -- configuration_version/pin_epoch (see this migration's header).

  return jsonb_build_object(
    'linkId', p_link_id,
    'hasPin', true,
    'state', v_link_state,
    'configurationVersion', v_new_configuration_version,
    'updatedAt', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_share_message_status(p_message_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_message_user_id uuid;
  v_message_project_id uuid;
  v_project_deleted_at timestamptz;
  v_existing_reviewed_at timestamptz;
  v_existing_status text;
  v_reviewed_at timestamptz;
  v_resolved_at timestamptz;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  -- Phase 5 target statuses only. 'converted' is deliberately absent --
  -- Phase 6 owns that transition, through its own future code, not this
  -- function.
  if p_status is null or p_status not in ('new', 'reviewed', 'resolved', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_INVALID';
  end if;

  if p_message_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  select message.user_id, message.project_id, message.reviewed_at, message.status
    into v_message_user_id, v_message_project_id, v_existing_reviewed_at, v_existing_status
    from public.share_messages as message
    where message.id = p_message_id and message.user_id = v_user_id
    for update;

  if v_message_user_id is null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  select project.deleted_at
    into v_project_deleted_at
    from public.projects as project
    where project.id = v_message_project_id;

  if v_project_deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_NOT_FOUND';
  end if;

  if v_existing_status = 'converted' then
    raise exception using errcode = 'P0001', message = 'SHARE_MESSAGE_STATUS_TERMINAL';
  end if;

  if p_status = 'new' then
    v_reviewed_at := null;
    v_resolved_at := null;
  elsif p_status = 'reviewed' then
    v_reviewed_at := v_now;
    v_resolved_at := null;
  elsif p_status = 'resolved' then
    v_reviewed_at := coalesce(v_existing_reviewed_at, v_now);
    v_resolved_at := v_now;
  else
    -- dismissed
    v_reviewed_at := v_now;
    v_resolved_at := null;
  end if;

  -- Only the review/visibility lifecycle columns are ever touched here
  -- (status, reviewed_at, resolved_at) -- body, author_type,
  -- author_display_name, parent_id, share_link_id, project_id, user_id
  -- and created_at are never referenced on the left-hand side of this
  -- UPDATE at all, matching enforce_share_message_integrity's own
  -- UPDATE-immutability check exactly (that trigger independently
  -- re-verifies this too).
  update public.share_messages
    set
      status = p_status,
      reviewed_at = v_reviewed_at,
      resolved_at = v_resolved_at
    where id = p_message_id and user_id = v_user_id;

  return jsonb_build_object(
    'messageId', p_message_id,
    'status', p_status,
    'reviewedAt', v_reviewed_at,
    'resolvedAt', v_resolved_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_homepage_demo_processing(p_attempt_id uuid, p_capacity_lease_token_hash text)
 RETURNS TABLE(decision text, attempt_id uuid, trial_id uuid, attempt_status text, trial_status text, provider_call_started_at timestamp with time zone, lease_expires_at timestamp with time zone, idempotent boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_hash_pattern constant text := '^[0-9a-f]{64}$';
  v_now timestamptz := pg_catalog.now();
  v_attempt public.homepage_demo_admission_attempts%rowtype;
  v_trial public.homepage_demo_trials%rowtype;
  v_capacity public.homepage_demo_capacity_reservations%rowtype;
  v_cost public.homepage_demo_cost_reservations%rowtype;
  v_hour_bucket public.homepage_demo_cost_buckets%rowtype;
  v_day_bucket public.homepage_demo_cost_buckets%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
  v_entitlement_count integer;
  v_reserved_entitlement_count integer;
  v_consumed_entitlement_count integer;
  v_released_entitlement_count integer;
  v_expired_entitlement_count integer;
  v_session_entitlement_count integer;
  v_device_entitlement_count integer;
  v_transition_trial_id uuid;
  v_transition_status text;
  v_transition_risk_state text;
  v_transition_expires_at timestamptz;
  v_transition_changed boolean;
  v_updated_count integer;
  v_exception_message text;
begin
  if p_attempt_id is null
    or p_capacity_lease_token_hash is null
    or p_capacity_lease_token_hash !~ v_hash_pattern then
    raise exception using
      errcode = '22023',
      message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
  end if;

  select attempt.*
  into v_attempt
  from public.homepage_demo_admission_attempts as attempt
  where attempt.id = p_attempt_id
  for update of attempt;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt.trial_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.id = v_attempt.trial_id
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select capacity.*
  into v_capacity
  from public.homepage_demo_capacity_reservations as capacity
  where capacity.attempt_id = v_attempt.id
  for update of capacity;

  if not found or v_capacity.lease_token_hash <> p_capacity_lease_token_hash then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID';
  end if;

  if v_capacity.status = 'expired'
    or (
      v_capacity.status = 'active'
      and v_capacity.lease_expires_at <= v_now
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED';
  end if;

  if v_capacity.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.input_type not in ('text', 'image')
    or v_attempt.estimated_cost_units <= 0
    or v_capacity.workload_type <> v_attempt.input_type
    or v_capacity.reserved_units <> 1
    or v_capacity.released_at is not null
    or v_capacity.expired_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select cost.*
  into v_cost
  from public.homepage_demo_cost_reservations as cost
  where cost.attempt_id = v_attempt.id
  for update of cost;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_cost.status <> 'reserved'
    or v_cost.reserved_units <= 0
    or v_cost.reserved_units <> v_attempt.estimated_cost_units
    or v_cost.finalized_units is not null
    or v_cost.finalized_at is not null
    or v_cost.released_at is not null
    or v_cost.expired_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_hour_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.hour_bucket_id
    and bucket.window_kind = 'hour'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select bucket.*
  into v_day_bucket
  from public.homepage_demo_cost_buckets as bucket
  where bucket.id = v_cost.day_bucket_id
    and bucket.window_kind = 'day'
  for update of bucket;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_hour_bucket.reserved_units < v_cost.reserved_units
    or v_day_bucket.reserved_units < v_cost.reserved_units then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select
    count(*)::integer,
    count(*) filter (where locked_entitlements.status = 'reserved')::integer,
    count(*) filter (where locked_entitlements.status = 'consumed')::integer,
    count(*) filter (where locked_entitlements.status = 'released')::integer,
    count(*) filter (where locked_entitlements.status = 'expired')::integer,
    count(*) filter (where locked_entitlements.scope = 'session')::integer,
    count(*) filter (where locked_entitlements.scope = 'device')::integer
  into
    v_entitlement_count,
    v_reserved_entitlement_count,
    v_consumed_entitlement_count,
    v_released_entitlement_count,
    v_expired_entitlement_count,
    v_session_entitlement_count,
    v_device_entitlement_count
  from (
    select entitlement.status, entitlement.scope
    from public.homepage_demo_trial_entitlements as entitlement
    where entitlement.attempt_id = v_attempt.id
    order by entitlement.scope
    for update of entitlement
  ) as locked_entitlements;

  if v_entitlement_count <> 2
    or v_reserved_entitlement_count <> 2
    or v_consumed_entitlement_count <> 0
    or v_released_entitlement_count <> 0
    or v_expired_entitlement_count <> 0
    or v_session_entitlement_count <> 1
    or v_device_entitlement_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  if v_attempt.status = 'processing' then
    if v_trial.status <> 'processing'
      or v_trial.risk_state <> 'allowed'
      or v_attempt.provider_call_started_at is null
      or v_attempt.provider_call_completed_at is not null
      or v_attempt.review_ready_at is not null
      or v_cost.status <> 'reserved'
      or v_cost.provider_call_started_at is null
      or v_cost.provider_call_started_at <> v_attempt.provider_call_started_at then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    return query
      select
        'processing'::text,
        v_attempt.id,
        v_trial.id,
        v_attempt.status,
        v_trial.status,
        v_attempt.provider_call_started_at,
        v_capacity.lease_expires_at,
        true;
    return;
  end if;

  if v_attempt.status <> 'admitted'
    or v_attempt.provider_call_started_at is not null
    or v_attempt.provider_call_completed_at is not null
    or v_attempt.review_ready_at is not null
    or v_trial.status <> 'queued'
    or v_trial.risk_state <> 'allowed'
    or v_cost.status <> 'reserved'
    or v_cost.provider_call_started_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  select advanced.trial_id,
    advanced.status,
    advanced.risk_state,
    advanced.expires_at,
    advanced.changed
  into
    v_transition_trial_id,
    v_transition_status,
    v_transition_risk_state,
    v_transition_expires_at,
    v_transition_changed
  from public.advance_homepage_demo_trial(
    v_trial.id,
    'queued',
    'processing',
    'allowed'
  ) as advanced;

  if v_transition_changed is not true
    or v_transition_trial_id <> v_trial.id
    or v_transition_status <> 'processing'
    or v_transition_risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_admission_attempts as attempt
  set
    status = 'processing',
    provider_call_started_at = v_now
  where attempt.id = v_attempt.id
    and attempt.status = 'admitted'
    and attempt.provider_call_started_at is null
  returning attempt.* into v_attempt;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  update public.homepage_demo_cost_reservations as cost
  set provider_call_started_at = v_now
  where cost.id = v_cost.id
    and cost.status = 'reserved'
    and cost.provider_call_started_at is null
  returning cost.* into v_cost;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
  end if;

  v_trial.status := v_transition_status;

  return query
    select
      'processing'::text,
      v_attempt.id,
      v_trial.id,
      v_attempt.status,
      v_trial.status,
      v_attempt.provider_call_started_at,
      v_capacity.lease_expires_at,
      false;
exception
  when others then
    get stacked diagnostics v_exception_message = message_text;

    if v_exception_message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT' then
      raise exception using
        errcode = '22023',
        message = 'HOMEPAGE_DEMO_PROCESSING_INVALID_INPUT';
    end if;

    if v_exception_message in (
      'HOMEPAGE_DEMO_PROCESSING_ATTEMPT_NOT_FOUND',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_INVALID',
      'HOMEPAGE_DEMO_PROCESSING_LEASE_EXPIRED',
      'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_COMPLETION_CONFLICT',
      'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE'
    ) then
      raise exception using
        errcode = 'P0001',
        message = v_exception_message;
    end if;

    if v_exception_message in (
      'INVALID_HOMEPAGE_DEMO_TRIAL_ID',
      'INVALID_HOMEPAGE_DEMO_TRANSITION',
      'INVALID_HOMEPAGE_DEMO_RISK_STATE',
      'HOMEPAGE_DEMO_TRIAL_NOT_FOUND',
      'HOMEPAGE_DEMO_TRIAL_EXPIRED',
      'HOMEPAGE_DEMO_TRANSITION_CONFLICT',
      'HOMEPAGE_DEMO_TERMINAL_STATE',
      'HOMEPAGE_DEMO_RISK_BLOCKED',
      'HOMEPAGE_DEMO_RISK_NOT_ALLOWED'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'HOMEPAGE_DEMO_PROCESSING_STATE_CONFLICT';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_PROCESSING_REPOSITORY_UNAVAILABLE';
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_homepage_demo_review_draft(p_public_token_hash text, p_session_token_hash text, p_edited_result jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS TABLE(trial_id uuid, draft_id uuid, draft_status text, expires_at timestamp with time zone, draft_updated_at timestamp with time zone, changed boolean)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_trial public.homepage_demo_trials%rowtype;
  v_draft public.homepage_demo_drafts%rowtype;
begin
  if p_public_token_hash is null
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_token_hash is null
    or p_session_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_ACCESS_HASH';
  end if;

  if p_edited_result is null
    or jsonb_typeof(p_edited_result) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_HOMEPAGE_DEMO_EDITED_RESULT';
  end if;

  select trial.*
  into v_trial
  from public.homepage_demo_trials as trial
  where trial.public_token_hash = p_public_token_hash
    and trial.session_token_hash = p_session_token_hash
  for update of trial;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_trial.claimed_by_user_id is not null
    or v_trial.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_trial.status <> 'review_ready'
    or v_trial.risk_state <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  select draft.*
  into v_draft
  from public.homepage_demo_drafts as draft
  where draft.trial_id = v_trial.id
  for update of draft;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EXPIRED';
  end if;

  if v_draft.claimed_by_user_id is not null
    or v_draft.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_ACCESS_DENIED';
  end if;

  if v_draft.status <> 'ready' then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_NOT_READY';
  end if;

  if v_draft.edited_result is not distinct from p_edited_result then
    return query
      select
        v_trial.id,
        v_draft.id,
        v_draft.status,
        least(v_trial.expires_at, v_draft.expires_at),
        v_draft.updated_at,
        false;
    return;
  end if;

  if p_expected_updated_at is null
    or p_expected_updated_at is distinct from v_draft.updated_at then
    raise exception using
      errcode = 'P0001',
      message = 'HOMEPAGE_DEMO_REVIEW_EDIT_CONFLICT';
  end if;

  update public.homepage_demo_drafts as draft
  set edited_result = p_edited_result
  where draft.id = v_draft.id
  returning draft.* into v_draft;

  return query
    select
      v_trial.id,
      v_draft.id,
      v_draft.status,
      least(v_trial.expires_at, v_draft.expires_at),
      v_draft.updated_at,
      true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_project_client_identity_transaction(p_project_id uuid, p_field text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_project public.projects%rowtype;
  v_updated_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_client_json jsonb := 'null'::jsonb;
  v_affected_count integer := 0;
  v_expected_task_count integer := 0;
  v_task_id bigint;
  v_value text;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'UNAUTHORIZED';
  end if;

  if p_project_id is null
    or p_field is null
    or p_field not in ('client_name', 'contact_name') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_REQUEST';
  end if;

  v_value := case
    when p_field = 'client_name' then btrim(coalesce(p_value, ''))
    else nullif(btrim(coalesce(p_value, '')), '')
  end;

  if p_field = 'client_name' and v_value = '' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CLIENT_NAME';
  end if;

  select project.*
  into v_project
  from public.projects as project
  where project.id = p_project_id
    and project.user_id = v_user_id
    and project.deleted_at is null
  for update of project;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project.client_id is not null then
    if p_field = 'client_name' then
      update public.clients as client
      set name = v_value
      where client.id = v_project.client_id
        and client.user_id = v_user_id
      returning client.* into v_client;
    else
      update public.clients as client
      set contact_name = v_value
      where client.id = v_project.client_id
        and client.user_id = v_user_id
      returning client.* into v_client;
    end if;

    get diagnostics v_affected_count = row_count;

    if v_affected_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'CLIENT_UPDATE_FAILED';
    end if;

    v_client_json := jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'contact_name', v_client.contact_name,
      'phone', v_client.phone,
      'email', v_client.email,
      'notes', v_client.notes,
      'created_at', v_client.created_at
    );
  end if;

  if p_field = 'client_name' then
    update public.projects as project
    set
      client_name = v_value,
      updated_at = v_now
    where project.id = v_project.id
      and project.user_id = v_user_id
      and project.deleted_at is null
    returning project.* into v_updated_project;
  else
    update public.projects as project
    set
      contact_name = v_value,
      updated_at = v_now
    where project.id = v_project.id
      and project.user_id = v_user_id
      and project.deleted_at is null
    returning project.* into v_updated_project;
  end if;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_UPDATE_FAILED';
  end if;

  for v_task_id in
    select task.id
    from public.tasks as task
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null
    order by task.id
    for update of task
  loop
    v_expected_task_count := v_expected_task_count + 1;
  end loop;

  if p_field = 'client_name' then
    update public.tasks as task
    set
      client_name = v_value,
      updated_at = v_now
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null;
  else
    update public.tasks as task
    set
      contact_name = v_value,
      updated_at = v_now
    where task.project_id = v_project.id
      and task.user_id = v_user_id
      and task.deleted_at is null;
  end if;

  get diagnostics v_affected_count = row_count;

  if v_affected_count <> v_expected_task_count then
    raise exception using
      errcode = 'P0001',
      message = 'TASK_SYNC_FAILED';
  end if;

  return to_jsonb(v_updated_project) || jsonb_build_object(
    'client', v_client_json
  );
end;
$function$;

-- TRIGGERS

CREATE TRIGGER calendar_events_enforce_relationship_integrity BEFORE INSERT OR UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION enforce_calendar_event_relationship_integrity();

CREATE TRIGGER calendar_events_set_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION set_calendar_events_updated_at();

CREATE TRIGGER set_homepage_demo_admission_attempts_updated_at BEFORE UPDATE ON homepage_demo_admission_attempts FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_admission_config_updated_at BEFORE UPDATE ON homepage_demo_admission_config FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_capacity_reservations_updated_at BEFORE UPDATE ON homepage_demo_capacity_reservations FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_claims_updated_at BEFORE UPDATE ON homepage_demo_claims FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_cost_buckets_updated_at BEFORE UPDATE ON homepage_demo_cost_buckets FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_cost_reservations_updated_at BEFORE UPDATE ON homepage_demo_cost_reservations FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER homepage_demo_drafts_set_updated_at BEFORE UPDATE ON homepage_demo_drafts FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_duplicate_override_authorities_updated_at BEFORE UPDATE ON homepage_demo_duplicate_override_authorities FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_rate_limit_buckets_updated_at BEFORE UPDATE ON homepage_demo_rate_limit_buckets FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER set_homepage_demo_trial_entitlements_updated_at BEFORE UPDATE ON homepage_demo_trial_entitlements FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER homepage_demo_trials_set_updated_at BEFORE UPDATE ON homepage_demo_trials FOR EACH ROW EXECUTE FUNCTION set_homepage_demo_updated_at();

CREATE TRIGGER project_share_links_enforce_integrity BEFORE INSERT OR UPDATE ON project_share_links FOR EACH ROW EXECUTE FUNCTION enforce_project_share_link_integrity();

CREATE TRIGGER project_share_links_set_updated_at BEFORE UPDATE ON project_share_links FOR EACH ROW EXECUTE FUNCTION set_client_share_updated_at();

CREATE TRIGGER project_share_secret_material_set_updated_at BEFORE UPDATE ON project_share_secret_material FOR EACH ROW EXECUTE FUNCTION set_client_share_updated_at();

CREATE TRIGGER project_updates_enforce_client_share_apply_boundary BEFORE INSERT OR UPDATE ON project_updates FOR EACH ROW EXECUTE FUNCTION enforce_project_update_client_share_apply_boundary();

CREATE TRIGGER project_updates_enforce_source_provenance BEFORE INSERT OR UPDATE ON project_updates FOR EACH ROW EXECUTE FUNCTION enforce_project_update_source_provenance();

CREATE TRIGGER share_browser_sessions_enforce_integrity BEFORE INSERT OR UPDATE ON share_browser_sessions FOR EACH ROW EXECUTE FUNCTION enforce_share_browser_session_integrity();

CREATE TRIGGER share_link_resources_enforce_integrity BEFORE INSERT OR UPDATE ON share_link_resources FOR EACH ROW EXECUTE FUNCTION enforce_share_link_resource_integrity();

CREATE TRIGGER share_link_resources_set_updated_at BEFORE UPDATE ON share_link_resources FOR EACH ROW EXECUTE FUNCTION set_client_share_updated_at();

CREATE TRIGGER share_link_tasks_enforce_integrity BEFORE INSERT OR UPDATE ON share_link_tasks FOR EACH ROW EXECUTE FUNCTION enforce_share_link_task_integrity();

CREATE TRIGGER share_link_tasks_set_updated_at BEFORE UPDATE ON share_link_tasks FOR EACH ROW EXECUTE FUNCTION set_client_share_updated_at();

CREATE TRIGGER share_link_updates_enforce_integrity BEFORE INSERT OR UPDATE ON share_link_updates FOR EACH ROW EXECUTE FUNCTION enforce_share_link_update_integrity();

CREATE TRIGGER share_message_conversions_enforce_integrity BEFORE INSERT ON share_message_conversions FOR EACH ROW EXECUTE FUNCTION enforce_share_message_conversion_integrity();

CREATE TRIGGER share_messages_enforce_integrity BEFORE INSERT OR UPDATE ON share_messages FOR EACH ROW EXECUTE FUNCTION enforce_share_message_integrity();

CREATE TRIGGER share_messages_set_updated_at BEFORE UPDATE ON share_messages FOR EACH ROW EXECUTE FUNCTION set_client_share_updated_at();

CREATE TRIGGER share_rate_limit_buckets_set_updated_at BEFORE UPDATE ON share_rate_limit_buckets FOR EACH ROW EXECUTE FUNCTION set_client_share_updated_at();

CREATE TRIGGER share_session_grants_enforce_integrity BEFORE INSERT OR UPDATE ON share_session_grants FOR EACH ROW EXECUTE FUNCTION enforce_share_session_grant_integrity();

-- RLS

alter table "public"."analytics_events" enable row level security;

alter table "public"."authenticated_product_events" enable row level security;

alter table "public"."billing_checkout_attempts" enable row level security;

alter table "public"."billing_subscriptions" enable row level security;

alter table "public"."calendar_events" enable row level security;

alter table "public"."clients" enable row level security;

alter table "public"."creem_webhook_events" enable row level security;

alter table "public"."customer_stories" enable row level security;

alter table "public"."gmail_oauth_tokens" enable row level security;

alter table "public"."homepage_demo_admission_attempts" enable row level security;

alter table "public"."homepage_demo_admission_config" enable row level security;

alter table "public"."homepage_demo_capacity_reservations" enable row level security;

alter table "public"."homepage_demo_claims" enable row level security;

alter table "public"."homepage_demo_cost_buckets" enable row level security;

alter table "public"."homepage_demo_cost_reservations" enable row level security;

alter table "public"."homepage_demo_drafts" enable row level security;

alter table "public"."homepage_demo_duplicate_override_authorities" enable row level security;

alter table "public"."homepage_demo_rate_limit_buckets" enable row level security;

alter table "public"."homepage_demo_trial_entitlements" enable row level security;

alter table "public"."homepage_demo_trials" enable row level security;

alter table "public"."project_import_attempts" enable row level security;

alter table "public"."project_share_links" enable row level security;

alter table "public"."project_share_secret_material" enable row level security;

alter table "public"."project_timeline_events" enable row level security;

alter table "public"."project_update_items" enable row level security;

alter table "public"."project_updates" enable row level security;

alter table "public"."projects" enable row level security;

alter table "public"."scan_jobs" enable row level security;

alter table "public"."scan_results" enable row level security;

alter table "public"."scan_snapshots" enable row level security;

alter table "public"."share_browser_sessions" enable row level security;

alter table "public"."share_link_events" enable row level security;

alter table "public"."share_link_resources" enable row level security;

alter table "public"."share_link_tasks" enable row level security;

alter table "public"."share_link_updates" enable row level security;

alter table "public"."share_message_conversions" enable row level security;

alter table "public"."share_messages" enable row level security;

alter table "public"."share_rate_limit_buckets" enable row level security;

alter table "public"."share_session_grants" enable row level security;

alter table "public"."task_resources" enable row level security;

alter table "public"."tasks" enable row level security;

alter table "public"."users" enable row level security;

-- POLICIES

create policy "Users can delete own calendar events" on "public"."calendar_events" as permissive for DELETE using ((auth.uid() = user_id));

create policy "Users can insert own calendar events" on "public"."calendar_events" as permissive for INSERT with check ((auth.uid() = user_id));

create policy "Users can update own calendar events" on "public"."calendar_events" as permissive for UPDATE using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Users can view own calendar events" on "public"."calendar_events" as permissive for SELECT using ((auth.uid() = user_id));

create policy "Users can view own project import attempts" on "public"."project_import_attempts" as permissive for SELECT using ((auth.uid() = user_id));

create policy "Users can view own project share links" on "public"."project_share_links" as permissive for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "Users can view own share link resources" on "public"."share_link_resources" as permissive for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "Users can view own share link tasks" on "public"."share_link_tasks" as permissive for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "Users can view own share link updates" on "public"."share_link_updates" as permissive for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "Users can view own share message conversions" on "public"."share_message_conversions" as permissive for SELECT to "authenticated" using ((auth.uid() = user_id));

create policy "Users can view own share messages" on "public"."share_messages" as permissive for SELECT to "authenticated" using ((auth.uid() = user_id));

-- PRIVILEGE FINALIZATION

revoke all privileges on function "public"."activate_share_link"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from PUBLIC;

revoke all privileges on function "public"."activate_share_link"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from "anon";

revoke all privileges on function "public"."activate_share_link"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from "authenticated";

revoke all privileges on function "public"."activate_share_link"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from "service_role";

revoke all privileges on function "public"."admit_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_device_token_hash text, p_ip_identity_digest text, p_idempotency_key_hash text, p_capacity_lease_token_hash text, p_input_type text) from PUBLIC;

revoke all privileges on function "public"."admit_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_device_token_hash text, p_ip_identity_digest text, p_idempotency_key_hash text, p_capacity_lease_token_hash text, p_input_type text) from "anon";

revoke all privileges on function "public"."admit_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_device_token_hash text, p_ip_identity_digest text, p_idempotency_key_hash text, p_capacity_lease_token_hash text, p_input_type text) from "authenticated";

revoke all privileges on function "public"."admit_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_device_token_hash text, p_ip_identity_digest text, p_idempotency_key_hash text, p_capacity_lease_token_hash text, p_input_type text) from "service_role";

revoke all privileges on function "public"."advance_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_next_status text, p_next_risk_state text) from PUBLIC;

revoke all privileges on function "public"."advance_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_next_status text, p_next_risk_state text) from "anon";

revoke all privileges on function "public"."advance_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_next_status text, p_next_risk_state text) from "authenticated";

revoke all privileges on function "public"."advance_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_next_status text, p_next_risk_state text) from "service_role";

revoke all privileges on function "public"."apply_project_bulk_action_transaction"(p_action text, p_project_ids uuid[]) from PUBLIC;

revoke all privileges on function "public"."apply_project_bulk_action_transaction"(p_action text, p_project_ids uuid[]) from "anon";

revoke all privileges on function "public"."apply_project_bulk_action_transaction"(p_action text, p_project_ids uuid[]) from "authenticated";

revoke all privileges on function "public"."apply_project_bulk_action_transaction"(p_action text, p_project_ids uuid[]) from "service_role";

revoke all privileges on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) from PUBLIC;

revoke all privileges on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) from "anon";

revoke all privileges on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) from "authenticated";

revoke all privileges on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) from "service_role";

revoke all privileges on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) from PUBLIC;

revoke all privileges on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) from "anon";

revoke all privileges on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) from "authenticated";

revoke all privileges on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) from "service_role";

revoke all privileges on function "public"."block_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_block_code text) from PUBLIC;

revoke all privileges on function "public"."block_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_block_code text) from "anon";

revoke all privileges on function "public"."block_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_block_code text) from "authenticated";

revoke all privileges on function "public"."block_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_block_code text) from "service_role";

revoke all privileges on function "public"."claim_billing_checkout_attempt"(p_user_id uuid, p_intent text, p_ttl_seconds integer, p_lease_seconds integer) from PUBLIC;

revoke all privileges on function "public"."claim_billing_checkout_attempt"(p_user_id uuid, p_intent text, p_ttl_seconds integer, p_lease_seconds integer) from "anon";

revoke all privileges on function "public"."claim_billing_checkout_attempt"(p_user_id uuid, p_intent text, p_ttl_seconds integer, p_lease_seconds integer) from "authenticated";

revoke all privileges on function "public"."claim_billing_checkout_attempt"(p_user_id uuid, p_intent text, p_ttl_seconds integer, p_lease_seconds integer) from "service_role";

revoke all privileges on function "public"."claim_homepage_demo_project_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from PUBLIC;

revoke all privileges on function "public"."claim_homepage_demo_project_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from "anon";

revoke all privileges on function "public"."claim_homepage_demo_project_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from "authenticated";

revoke all privileges on function "public"."claim_homepage_demo_project_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from "service_role";

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from PUBLIC;

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "anon";

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "authenticated";

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "service_role";

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from PUBLIC;

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "anon";

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "authenticated";

revoke all privileges on function "public"."claim_homepage_demo_project_with_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "service_role";

revoke all privileges on function "public"."claim_homepage_demo_project"(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from PUBLIC;

revoke all privileges on function "public"."claim_homepage_demo_project"(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from "anon";

revoke all privileges on function "public"."claim_homepage_demo_project"(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from "authenticated";

revoke all privileges on function "public"."claim_homepage_demo_project"(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) from "service_role";

revoke all privileges on function "public"."clear_share_link_expiry"(p_link_id uuid) from PUBLIC;

revoke all privileges on function "public"."clear_share_link_expiry"(p_link_id uuid) from "anon";

revoke all privileges on function "public"."clear_share_link_expiry"(p_link_id uuid) from "authenticated";

revoke all privileges on function "public"."clear_share_link_expiry"(p_link_id uuid) from "service_role";

revoke all privileges on function "public"."clear_share_link_pin"(p_link_id uuid) from PUBLIC;

revoke all privileges on function "public"."clear_share_link_pin"(p_link_id uuid) from "anon";

revoke all privileges on function "public"."clear_share_link_pin"(p_link_id uuid) from "authenticated";

revoke all privileges on function "public"."clear_share_link_pin"(p_link_id uuid) from "service_role";

revoke all privileges on function "public"."complete_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text) from PUBLIC;

revoke all privileges on function "public"."complete_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text) from "anon";

revoke all privileges on function "public"."complete_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text) from "authenticated";

revoke all privileges on function "public"."complete_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text) from "service_role";

revoke all privileges on function "public"."complete_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from PUBLIC;

revoke all privileges on function "public"."complete_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from "anon";

revoke all privileges on function "public"."complete_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from "authenticated";

revoke all privileges on function "public"."complete_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from "service_role";

revoke all privileges on function "public"."complete_homepage_demo_trial"(p_trial_id uuid, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from PUBLIC;

revoke all privileges on function "public"."complete_homepage_demo_trial"(p_trial_id uuid, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from "anon";

revoke all privileges on function "public"."complete_homepage_demo_trial"(p_trial_id uuid, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from "authenticated";

revoke all privileges on function "public"."complete_homepage_demo_trial"(p_trial_id uuid, p_normalized_result jsonb, p_schema_version text, p_engine_version text) from "service_role";

revoke all privileges on function "public"."create_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_idempotency_key_hash text, p_input_type text, p_expires_at timestamp with time zone) from PUBLIC;

revoke all privileges on function "public"."create_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_idempotency_key_hash text, p_input_type text, p_expires_at timestamp with time zone) from "anon";

revoke all privileges on function "public"."create_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_idempotency_key_hash text, p_input_type text, p_expires_at timestamp with time zone) from "authenticated";

revoke all privileges on function "public"."create_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_idempotency_key_hash text, p_input_type text, p_expires_at timestamp with time zone) from "service_role";

revoke all privileges on function "public"."create_share_link_draft"(p_project_id uuid, p_public_id text) from PUBLIC;

revoke all privileges on function "public"."create_share_link_draft"(p_project_id uuid, p_public_id text) from "anon";

revoke all privileges on function "public"."create_share_link_draft"(p_project_id uuid, p_public_id text) from "authenticated";

revoke all privileges on function "public"."create_share_link_draft"(p_project_id uuid, p_public_id text) from "service_role";

revoke all privileges on function "public"."disable_share_link"(p_link_id uuid) from PUBLIC;

revoke all privileges on function "public"."disable_share_link"(p_link_id uuid) from "anon";

revoke all privileges on function "public"."disable_share_link"(p_link_id uuid) from "authenticated";

revoke all privileges on function "public"."disable_share_link"(p_link_id uuid) from "service_role";

revoke all privileges on function "public"."enforce_calendar_event_relationship_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_calendar_event_relationship_integrity"() from "anon";

revoke all privileges on function "public"."enforce_calendar_event_relationship_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_calendar_event_relationship_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_project_share_link_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_project_share_link_integrity"() from "anon";

revoke all privileges on function "public"."enforce_project_share_link_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_project_share_link_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_project_update_client_share_apply_boundary"() from PUBLIC;

revoke all privileges on function "public"."enforce_project_update_client_share_apply_boundary"() from "anon";

revoke all privileges on function "public"."enforce_project_update_client_share_apply_boundary"() from "authenticated";

revoke all privileges on function "public"."enforce_project_update_client_share_apply_boundary"() from "service_role";

revoke all privileges on function "public"."enforce_project_update_source_provenance"() from PUBLIC;

revoke all privileges on function "public"."enforce_project_update_source_provenance"() from "anon";

revoke all privileges on function "public"."enforce_project_update_source_provenance"() from "authenticated";

revoke all privileges on function "public"."enforce_project_update_source_provenance"() from "service_role";

revoke all privileges on function "public"."enforce_share_browser_session_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_browser_session_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_browser_session_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_browser_session_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_share_link_resource_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_link_resource_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_link_resource_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_link_resource_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_share_link_task_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_link_task_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_link_task_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_link_task_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_share_link_update_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_link_update_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_link_update_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_link_update_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_share_message_conversion_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_message_conversion_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_message_conversion_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_message_conversion_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_share_message_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_message_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_message_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_message_integrity"() from "service_role";

revoke all privileges on function "public"."enforce_share_session_grant_integrity"() from PUBLIC;

revoke all privileges on function "public"."enforce_share_session_grant_integrity"() from "anon";

revoke all privileges on function "public"."enforce_share_session_grant_integrity"() from "authenticated";

revoke all privileges on function "public"."enforce_share_session_grant_integrity"() from "service_role";

revoke all privileges on function "public"."fail_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_error_code text) from PUBLIC;

revoke all privileges on function "public"."fail_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_error_code text) from "anon";

revoke all privileges on function "public"."fail_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_error_code text) from "authenticated";

revoke all privileges on function "public"."fail_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_error_code text) from "service_role";

revoke all privileges on function "public"."fail_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_failure_code text) from PUBLIC;

revoke all privileges on function "public"."fail_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_failure_code text) from "anon";

revoke all privileges on function "public"."fail_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_failure_code text) from "authenticated";

revoke all privileges on function "public"."fail_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_failure_code text) from "service_role";

revoke all privileges on function "public"."fail_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_failure_code text) from PUBLIC;

revoke all privileges on function "public"."fail_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_failure_code text) from "anon";

revoke all privileges on function "public"."fail_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_failure_code text) from "authenticated";

revoke all privileges on function "public"."fail_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_failure_code text) from "service_role";

revoke all privileges on function "public"."finalize_share_message_conversion"(p_message_id uuid, p_project_update_id uuid) from PUBLIC;

revoke all privileges on function "public"."finalize_share_message_conversion"(p_message_id uuid, p_project_update_id uuid) from "anon";

revoke all privileges on function "public"."finalize_share_message_conversion"(p_message_id uuid, p_project_update_id uuid) from "authenticated";

revoke all privileges on function "public"."finalize_share_message_conversion"(p_message_id uuid, p_project_update_id uuid) from "service_role";

revoke all privileges on function "public"."get_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text) from PUBLIC;

revoke all privileges on function "public"."get_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text) from "anon";

revoke all privileges on function "public"."get_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text) from "authenticated";

revoke all privileges on function "public"."get_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text) from "service_role";

revoke all privileges on function "public"."get_owner_authenticated_activity_summary"(p_user_ids uuid[]) from PUBLIC;

revoke all privileges on function "public"."get_owner_authenticated_activity_summary"(p_user_ids uuid[]) from "anon";

revoke all privileges on function "public"."get_owner_authenticated_activity_summary"(p_user_ids uuid[]) from "authenticated";

revoke all privileges on function "public"."get_owner_authenticated_activity_summary"(p_user_ids uuid[]) from "service_role";

revoke all privileges on function "public"."get_owner_product_activation_analytics"() from PUBLIC;

revoke all privileges on function "public"."get_owner_product_activation_analytics"() from "anon";

revoke all privileges on function "public"."get_owner_product_activation_analytics"() from "authenticated";

revoke all privileges on function "public"."get_owner_product_activation_analytics"() from "service_role";

revoke all privileges on function "public"."get_owner_user_activity_report"(p_limit integer) from PUBLIC;

revoke all privileges on function "public"."get_owner_user_activity_report"(p_limit integer) from "anon";

revoke all privileges on function "public"."get_owner_user_activity_report"(p_limit integer) from "authenticated";

revoke all privileges on function "public"."get_owner_user_activity_report"(p_limit integer) from "service_role";

revoke all privileges on function "public"."get_owner_user_activity_timeline"(p_user_id uuid, p_limit integer) from PUBLIC;

revoke all privileges on function "public"."get_owner_user_activity_timeline"(p_user_id uuid, p_limit integer) from "anon";

revoke all privileges on function "public"."get_owner_user_activity_timeline"(p_user_id uuid, p_limit integer) from "authenticated";

revoke all privileges on function "public"."get_owner_user_activity_timeline"(p_user_id uuid, p_limit integer) from "service_role";

revoke all privileges on function "public"."get_share_link_management_state"(p_project_id uuid) from PUBLIC;

revoke all privileges on function "public"."get_share_link_management_state"(p_project_id uuid) from "anon";

revoke all privileges on function "public"."get_share_link_management_state"(p_project_id uuid) from "authenticated";

revoke all privileges on function "public"."get_share_link_management_state"(p_project_id uuid) from "service_role";

revoke all privileges on function "public"."import_projects_transaction"(p_attempt_id uuid, p_idempotency_key uuid, p_request_hash text, p_groups jsonb) from PUBLIC;

revoke all privileges on function "public"."import_projects_transaction"(p_attempt_id uuid, p_idempotency_key uuid, p_request_hash text, p_groups jsonb) from "anon";

revoke all privileges on function "public"."import_projects_transaction"(p_attempt_id uuid, p_idempotency_key uuid, p_request_hash text, p_groups jsonb) from "authenticated";

revoke all privileges on function "public"."import_projects_transaction"(p_attempt_id uuid, p_idempotency_key uuid, p_request_hash text, p_groups jsonb) from "service_role";

revoke all privileges on function "public"."increment_share_rate_limit_bucket"(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer) from PUBLIC;

revoke all privileges on function "public"."increment_share_rate_limit_bucket"(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer) from "anon";

revoke all privileges on function "public"."increment_share_rate_limit_bucket"(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer) from "authenticated";

revoke all privileges on function "public"."increment_share_rate_limit_bucket"(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer) from "service_role";

revoke all privileges on function "public"."list_share_link_summaries"(p_project_ids uuid[]) from PUBLIC;

revoke all privileges on function "public"."list_share_link_summaries"(p_project_ids uuid[]) from "anon";

revoke all privileges on function "public"."list_share_link_summaries"(p_project_ids uuid[]) from "authenticated";

revoke all privileges on function "public"."list_share_link_summaries"(p_project_ids uuid[]) from "service_role";

revoke all privileges on function "public"."prepare_homepage_demo_claim_auth_continuation"(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer) from PUBLIC;

revoke all privileges on function "public"."prepare_homepage_demo_claim_auth_continuation"(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer) from "anon";

revoke all privileges on function "public"."prepare_homepage_demo_claim_auth_continuation"(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer) from "authenticated";

revoke all privileges on function "public"."prepare_homepage_demo_claim_auth_continuation"(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer) from "service_role";

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from PUBLIC;

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "anon";

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "authenticated";

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "service_role";

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from PUBLIC;

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "anon";

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "authenticated";

revoke all privileges on function "public"."prepare_homepage_demo_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) from "service_role";

revoke all privileges on function "public"."process_creem_webhook_event"(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text) from PUBLIC;

revoke all privileges on function "public"."process_creem_webhook_event"(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text) from "anon";

revoke all privileges on function "public"."process_creem_webhook_event"(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text) from "authenticated";

revoke all privileges on function "public"."process_creem_webhook_event"(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text) from "service_role";

revoke all privileges on function "public"."purge_expired_homepage_demo_trials"(p_limit integer) from PUBLIC;

revoke all privileges on function "public"."purge_expired_homepage_demo_trials"(p_limit integer) from "anon";

revoke all privileges on function "public"."purge_expired_homepage_demo_trials"(p_limit integer) from "authenticated";

revoke all privileges on function "public"."purge_expired_homepage_demo_trials"(p_limit integer) from "service_role";

revoke all privileges on function "public"."purge_homepage_demo_retention"(p_limit integer) from PUBLIC;

revoke all privileges on function "public"."purge_homepage_demo_retention"(p_limit integer) from "anon";

revoke all privileges on function "public"."purge_homepage_demo_retention"(p_limit integer) from "authenticated";

revoke all privileges on function "public"."purge_homepage_demo_retention"(p_limit integer) from "service_role";

revoke all privileges on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) from PUBLIC;

revoke all privileges on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) from "anon";

revoke all privileges on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) from "authenticated";

revoke all privileges on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) from "service_role";

revoke all privileges on function "public"."record_dashboard_visit"(p_user_id uuid) from PUBLIC;

revoke all privileges on function "public"."record_dashboard_visit"(p_user_id uuid) from "anon";

revoke all privileges on function "public"."record_dashboard_visit"(p_user_id uuid) from "authenticated";

revoke all privileges on function "public"."record_dashboard_visit"(p_user_id uuid) from "service_role";

revoke all privileges on function "public"."record_homepage_demo_challenge_failure"(p_ip_identity_digest text) from PUBLIC;

revoke all privileges on function "public"."record_homepage_demo_challenge_failure"(p_ip_identity_digest text) from "anon";

revoke all privileges on function "public"."record_homepage_demo_challenge_failure"(p_ip_identity_digest text) from "authenticated";

revoke all privileges on function "public"."record_homepage_demo_challenge_failure"(p_ip_identity_digest text) from "service_role";

revoke all privileges on function "public"."record_successful_extraction"(p_user_id uuid) from PUBLIC;

revoke all privileges on function "public"."record_successful_extraction"(p_user_id uuid) from "anon";

revoke all privileges on function "public"."record_successful_extraction"(p_user_id uuid) from "authenticated";

revoke all privileges on function "public"."record_successful_extraction"(p_user_id uuid) from "service_role";

revoke all privileges on function "public"."recover_stale_homepage_demo_processing"(p_limit integer) from PUBLIC;

revoke all privileges on function "public"."recover_stale_homepage_demo_processing"(p_limit integer) from "anon";

revoke all privileges on function "public"."recover_stale_homepage_demo_processing"(p_limit integer) from "authenticated";

revoke all privileges on function "public"."recover_stale_homepage_demo_processing"(p_limit integer) from "service_role";

revoke all privileges on function "public"."reenable_share_link"(p_link_id uuid) from PUBLIC;

revoke all privileges on function "public"."reenable_share_link"(p_link_id uuid) from "anon";

revoke all privileges on function "public"."reenable_share_link"(p_link_id uuid) from "authenticated";

revoke all privileges on function "public"."reenable_share_link"(p_link_id uuid) from "service_role";

revoke all privileges on function "public"."reprocess_creem_webhook_event"(p_provider_event_id text) from PUBLIC;

revoke all privileges on function "public"."reprocess_creem_webhook_event"(p_provider_event_id text) from "anon";

revoke all privileges on function "public"."reprocess_creem_webhook_event"(p_provider_event_id text) from "authenticated";

revoke all privileges on function "public"."reprocess_creem_webhook_event"(p_provider_event_id text) from "service_role";

revoke all privileges on function "public"."resolve_creem_webhook_review"(p_provider_event_id text, p_decision text) from PUBLIC;

revoke all privileges on function "public"."resolve_creem_webhook_review"(p_provider_event_id text, p_decision text) from "anon";

revoke all privileges on function "public"."resolve_creem_webhook_review"(p_provider_event_id text, p_decision text) from "authenticated";

revoke all privileges on function "public"."resolve_creem_webhook_review"(p_provider_event_id text, p_decision text) from "service_role";

revoke all privileges on function "public"."reveal_share_link_secret"(p_link_id uuid) from PUBLIC;

revoke all privileges on function "public"."reveal_share_link_secret"(p_link_id uuid) from "anon";

revoke all privileges on function "public"."reveal_share_link_secret"(p_link_id uuid) from "authenticated";

revoke all privileges on function "public"."reveal_share_link_secret"(p_link_id uuid) from "service_role";

revoke all privileges on function "public"."revoke_share_link"(p_link_id uuid) from PUBLIC;

revoke all privileges on function "public"."revoke_share_link"(p_link_id uuid) from "anon";

revoke all privileges on function "public"."revoke_share_link"(p_link_id uuid) from "authenticated";

revoke all privileges on function "public"."revoke_share_link"(p_link_id uuid) from "service_role";

revoke all privileges on function "public"."rotate_share_link_secret"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from PUBLIC;

revoke all privileges on function "public"."rotate_share_link_secret"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from "anon";

revoke all privileges on function "public"."rotate_share_link_secret"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from "authenticated";

revoke all privileges on function "public"."rotate_share_link_secret"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) from "service_role";

revoke all privileges on function "public"."run_homepage_demo_maintenance"(p_limit integer) from PUBLIC;

revoke all privileges on function "public"."run_homepage_demo_maintenance"(p_limit integer) from "anon";

revoke all privileges on function "public"."run_homepage_demo_maintenance"(p_limit integer) from "authenticated";

revoke all privileges on function "public"."run_homepage_demo_maintenance"(p_limit integer) from "service_role";

revoke all privileges on function "public"."save_share_configuration"(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb) from PUBLIC;

revoke all privileges on function "public"."save_share_configuration"(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb) from "anon";

revoke all privileges on function "public"."save_share_configuration"(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb) from "authenticated";

revoke all privileges on function "public"."save_share_configuration"(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb) from "service_role";

revoke all privileges on function "public"."send_share_message_reply"(p_share_link_id uuid, p_parent_message_id uuid, p_body text) from PUBLIC;

revoke all privileges on function "public"."send_share_message_reply"(p_share_link_id uuid, p_parent_message_id uuid, p_body text) from "anon";

revoke all privileges on function "public"."send_share_message_reply"(p_share_link_id uuid, p_parent_message_id uuid, p_body text) from "authenticated";

revoke all privileges on function "public"."send_share_message_reply"(p_share_link_id uuid, p_parent_message_id uuid, p_body text) from "service_role";

revoke all privileges on function "public"."set_calendar_events_updated_at"() from PUBLIC;

revoke all privileges on function "public"."set_calendar_events_updated_at"() from "anon";

revoke all privileges on function "public"."set_calendar_events_updated_at"() from "authenticated";

revoke all privileges on function "public"."set_calendar_events_updated_at"() from "service_role";

revoke all privileges on function "public"."set_client_share_updated_at"() from PUBLIC;

revoke all privileges on function "public"."set_client_share_updated_at"() from "anon";

revoke all privileges on function "public"."set_client_share_updated_at"() from "authenticated";

revoke all privileges on function "public"."set_client_share_updated_at"() from "service_role";

revoke all privileges on function "public"."set_customer_stories_updated_at"() from PUBLIC;

revoke all privileges on function "public"."set_customer_stories_updated_at"() from "anon";

revoke all privileges on function "public"."set_customer_stories_updated_at"() from "authenticated";

revoke all privileges on function "public"."set_customer_stories_updated_at"() from "service_role";

revoke all privileges on function "public"."set_homepage_demo_updated_at"() from PUBLIC;

revoke all privileges on function "public"."set_homepage_demo_updated_at"() from "anon";

revoke all privileges on function "public"."set_homepage_demo_updated_at"() from "authenticated";

revoke all privileges on function "public"."set_homepage_demo_updated_at"() from "service_role";

revoke all privileges on function "public"."set_share_link_expiry"(p_link_id uuid, p_expires_at timestamp with time zone) from PUBLIC;

revoke all privileges on function "public"."set_share_link_expiry"(p_link_id uuid, p_expires_at timestamp with time zone) from "anon";

revoke all privileges on function "public"."set_share_link_expiry"(p_link_id uuid, p_expires_at timestamp with time zone) from "authenticated";

revoke all privileges on function "public"."set_share_link_expiry"(p_link_id uuid, p_expires_at timestamp with time zone) from "service_role";

revoke all privileges on function "public"."set_share_link_pin"(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer) from PUBLIC;

revoke all privileges on function "public"."set_share_link_pin"(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer) from "anon";

revoke all privileges on function "public"."set_share_link_pin"(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer) from "authenticated";

revoke all privileges on function "public"."set_share_link_pin"(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer) from "service_role";

revoke all privileges on function "public"."set_share_message_status"(p_message_id uuid, p_status text) from PUBLIC;

revoke all privileges on function "public"."set_share_message_status"(p_message_id uuid, p_status text) from "anon";

revoke all privileges on function "public"."set_share_message_status"(p_message_id uuid, p_status text) from "authenticated";

revoke all privileges on function "public"."set_share_message_status"(p_message_id uuid, p_status text) from "service_role";

revoke all privileges on function "public"."set_task_resources_updated_at"() from PUBLIC;

revoke all privileges on function "public"."set_task_resources_updated_at"() from "anon";

revoke all privileges on function "public"."set_task_resources_updated_at"() from "authenticated";

revoke all privileges on function "public"."set_task_resources_updated_at"() from "service_role";

revoke all privileges on function "public"."set_updated_at"() from PUBLIC;

revoke all privileges on function "public"."set_updated_at"() from "anon";

revoke all privileges on function "public"."set_updated_at"() from "authenticated";

revoke all privileges on function "public"."set_updated_at"() from "service_role";

revoke all privileges on function "public"."start_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text) from PUBLIC;

revoke all privileges on function "public"."start_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text) from "anon";

revoke all privileges on function "public"."start_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text) from "authenticated";

revoke all privileges on function "public"."start_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text) from "service_role";

revoke all privileges on function "public"."update_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text, p_edited_result jsonb, p_expected_updated_at timestamp with time zone) from PUBLIC;

revoke all privileges on function "public"."update_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text, p_edited_result jsonb, p_expected_updated_at timestamp with time zone) from "anon";

revoke all privileges on function "public"."update_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text, p_edited_result jsonb, p_expected_updated_at timestamp with time zone) from "authenticated";

revoke all privileges on function "public"."update_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text, p_edited_result jsonb, p_expected_updated_at timestamp with time zone) from "service_role";

revoke all privileges on function "public"."update_project_client_identity_transaction"(p_project_id uuid, p_field text, p_value text) from PUBLIC;

revoke all privileges on function "public"."update_project_client_identity_transaction"(p_project_id uuid, p_field text, p_value text) from "anon";

revoke all privileges on function "public"."update_project_client_identity_transaction"(p_project_id uuid, p_field text, p_value text) from "authenticated";

revoke all privileges on function "public"."update_project_client_identity_transaction"(p_project_id uuid, p_field text, p_value text) from "service_role";

revoke all privileges on sequence "public"."tasks_id_seq" from PUBLIC;

revoke all privileges on sequence "public"."tasks_id_seq" from "anon";

revoke all privileges on sequence "public"."tasks_id_seq" from "authenticated";

revoke all privileges on sequence "public"."tasks_id_seq" from "service_role";

revoke all privileges on table "public"."analytics_events" from PUBLIC;

revoke all privileges on table "public"."analytics_events" from "anon";

revoke all privileges on table "public"."analytics_events" from "authenticated";

revoke all privileges on table "public"."analytics_events" from "service_role";

revoke all privileges on table "public"."authenticated_product_events" from PUBLIC;

revoke all privileges on table "public"."authenticated_product_events" from "anon";

revoke all privileges on table "public"."authenticated_product_events" from "authenticated";

revoke all privileges on table "public"."authenticated_product_events" from "service_role";

revoke all privileges on table "public"."billing_checkout_attempts" from PUBLIC;

revoke all privileges on table "public"."billing_checkout_attempts" from "anon";

revoke all privileges on table "public"."billing_checkout_attempts" from "authenticated";

revoke all privileges on table "public"."billing_checkout_attempts" from "service_role";

revoke all privileges on table "public"."billing_subscriptions" from PUBLIC;

revoke all privileges on table "public"."billing_subscriptions" from "anon";

revoke all privileges on table "public"."billing_subscriptions" from "authenticated";

revoke all privileges on table "public"."billing_subscriptions" from "service_role";

revoke all privileges on table "public"."calendar_events" from PUBLIC;

revoke all privileges on table "public"."calendar_events" from "anon";

revoke all privileges on table "public"."calendar_events" from "authenticated";

revoke all privileges on table "public"."calendar_events" from "service_role";

revoke all privileges on table "public"."clients" from PUBLIC;

revoke all privileges on table "public"."clients" from "anon";

revoke all privileges on table "public"."clients" from "authenticated";

revoke all privileges on table "public"."clients" from "service_role";

revoke all privileges on table "public"."creem_webhook_events" from PUBLIC;

revoke all privileges on table "public"."creem_webhook_events" from "anon";

revoke all privileges on table "public"."creem_webhook_events" from "authenticated";

revoke all privileges on table "public"."creem_webhook_events" from "service_role";

revoke all privileges on table "public"."customer_stories" from PUBLIC;

revoke all privileges on table "public"."customer_stories" from "anon";

revoke all privileges on table "public"."customer_stories" from "authenticated";

revoke all privileges on table "public"."customer_stories" from "service_role";

revoke all privileges on table "public"."gmail_oauth_tokens" from PUBLIC;

revoke all privileges on table "public"."gmail_oauth_tokens" from "anon";

revoke all privileges on table "public"."gmail_oauth_tokens" from "authenticated";

revoke all privileges on table "public"."gmail_oauth_tokens" from "service_role";

revoke all privileges on table "public"."homepage_demo_admission_attempts" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_admission_attempts" from "anon";

revoke all privileges on table "public"."homepage_demo_admission_attempts" from "authenticated";

revoke all privileges on table "public"."homepage_demo_admission_attempts" from "service_role";

revoke all privileges on table "public"."homepage_demo_admission_config" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_admission_config" from "anon";

revoke all privileges on table "public"."homepage_demo_admission_config" from "authenticated";

revoke all privileges on table "public"."homepage_demo_admission_config" from "service_role";

revoke all privileges on table "public"."homepage_demo_capacity_reservations" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_capacity_reservations" from "anon";

revoke all privileges on table "public"."homepage_demo_capacity_reservations" from "authenticated";

revoke all privileges on table "public"."homepage_demo_capacity_reservations" from "service_role";

revoke all privileges on table "public"."homepage_demo_claims" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_claims" from "anon";

revoke all privileges on table "public"."homepage_demo_claims" from "authenticated";

revoke all privileges on table "public"."homepage_demo_claims" from "service_role";

revoke all privileges on table "public"."homepage_demo_cost_buckets" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_cost_buckets" from "anon";

revoke all privileges on table "public"."homepage_demo_cost_buckets" from "authenticated";

revoke all privileges on table "public"."homepage_demo_cost_buckets" from "service_role";

revoke all privileges on table "public"."homepage_demo_cost_reservations" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_cost_reservations" from "anon";

revoke all privileges on table "public"."homepage_demo_cost_reservations" from "authenticated";

revoke all privileges on table "public"."homepage_demo_cost_reservations" from "service_role";

revoke all privileges on table "public"."homepage_demo_drafts" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_drafts" from "anon";

revoke all privileges on table "public"."homepage_demo_drafts" from "authenticated";

revoke all privileges on table "public"."homepage_demo_drafts" from "service_role";

revoke all privileges on table "public"."homepage_demo_duplicate_override_authorities" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_duplicate_override_authorities" from "anon";

revoke all privileges on table "public"."homepage_demo_duplicate_override_authorities" from "authenticated";

revoke all privileges on table "public"."homepage_demo_duplicate_override_authorities" from "service_role";

revoke all privileges on table "public"."homepage_demo_rate_limit_buckets" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_rate_limit_buckets" from "anon";

revoke all privileges on table "public"."homepage_demo_rate_limit_buckets" from "authenticated";

revoke all privileges on table "public"."homepage_demo_rate_limit_buckets" from "service_role";

revoke all privileges on table "public"."homepage_demo_trial_entitlements" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_trial_entitlements" from "anon";

revoke all privileges on table "public"."homepage_demo_trial_entitlements" from "authenticated";

revoke all privileges on table "public"."homepage_demo_trial_entitlements" from "service_role";

revoke all privileges on table "public"."homepage_demo_trials" from PUBLIC;

revoke all privileges on table "public"."homepage_demo_trials" from "anon";

revoke all privileges on table "public"."homepage_demo_trials" from "authenticated";

revoke all privileges on table "public"."homepage_demo_trials" from "service_role";

revoke all privileges on table "public"."project_import_attempts" from PUBLIC;

revoke all privileges on table "public"."project_import_attempts" from "anon";

revoke all privileges on table "public"."project_import_attempts" from "authenticated";

revoke all privileges on table "public"."project_import_attempts" from "service_role";

revoke all privileges on table "public"."project_share_links" from PUBLIC;

revoke all privileges on table "public"."project_share_links" from "anon";

revoke all privileges on table "public"."project_share_links" from "authenticated";

revoke all privileges on table "public"."project_share_links" from "service_role";

revoke all privileges on table "public"."project_share_secret_material" from PUBLIC;

revoke all privileges on table "public"."project_share_secret_material" from "anon";

revoke all privileges on table "public"."project_share_secret_material" from "authenticated";

revoke all privileges on table "public"."project_share_secret_material" from "service_role";

revoke all privileges on table "public"."project_timeline_events" from PUBLIC;

revoke all privileges on table "public"."project_timeline_events" from "anon";

revoke all privileges on table "public"."project_timeline_events" from "authenticated";

revoke all privileges on table "public"."project_timeline_events" from "service_role";

revoke all privileges on table "public"."project_update_items" from PUBLIC;

revoke all privileges on table "public"."project_update_items" from "anon";

revoke all privileges on table "public"."project_update_items" from "authenticated";

revoke all privileges on table "public"."project_update_items" from "service_role";

revoke all privileges on table "public"."project_updates" from PUBLIC;

revoke all privileges on table "public"."project_updates" from "anon";

revoke all privileges on table "public"."project_updates" from "authenticated";

revoke all privileges on table "public"."project_updates" from "service_role";

revoke all privileges on table "public"."projects" from PUBLIC;

revoke all privileges on table "public"."projects" from "anon";

revoke all privileges on table "public"."projects" from "authenticated";

revoke all privileges on table "public"."projects" from "service_role";

revoke all privileges on table "public"."scan_jobs" from PUBLIC;

revoke all privileges on table "public"."scan_jobs" from "anon";

revoke all privileges on table "public"."scan_jobs" from "authenticated";

revoke all privileges on table "public"."scan_jobs" from "service_role";

revoke all privileges on table "public"."scan_results" from PUBLIC;

revoke all privileges on table "public"."scan_results" from "anon";

revoke all privileges on table "public"."scan_results" from "authenticated";

revoke all privileges on table "public"."scan_results" from "service_role";

revoke all privileges on table "public"."scan_snapshots" from PUBLIC;

revoke all privileges on table "public"."scan_snapshots" from "anon";

revoke all privileges on table "public"."scan_snapshots" from "authenticated";

revoke all privileges on table "public"."scan_snapshots" from "service_role";

revoke all privileges on table "public"."share_browser_sessions" from PUBLIC;

revoke all privileges on table "public"."share_browser_sessions" from "anon";

revoke all privileges on table "public"."share_browser_sessions" from "authenticated";

revoke all privileges on table "public"."share_browser_sessions" from "service_role";

revoke all privileges on table "public"."share_link_events" from PUBLIC;

revoke all privileges on table "public"."share_link_events" from "anon";

revoke all privileges on table "public"."share_link_events" from "authenticated";

revoke all privileges on table "public"."share_link_events" from "service_role";

revoke all privileges on table "public"."share_link_resources" from PUBLIC;

revoke all privileges on table "public"."share_link_resources" from "anon";

revoke all privileges on table "public"."share_link_resources" from "authenticated";

revoke all privileges on table "public"."share_link_resources" from "service_role";

revoke all privileges on table "public"."share_link_tasks" from PUBLIC;

revoke all privileges on table "public"."share_link_tasks" from "anon";

revoke all privileges on table "public"."share_link_tasks" from "authenticated";

revoke all privileges on table "public"."share_link_tasks" from "service_role";

revoke all privileges on table "public"."share_link_updates" from PUBLIC;

revoke all privileges on table "public"."share_link_updates" from "anon";

revoke all privileges on table "public"."share_link_updates" from "authenticated";

revoke all privileges on table "public"."share_link_updates" from "service_role";

revoke all privileges on table "public"."share_message_conversions" from PUBLIC;

revoke all privileges on table "public"."share_message_conversions" from "anon";

revoke all privileges on table "public"."share_message_conversions" from "authenticated";

revoke all privileges on table "public"."share_message_conversions" from "service_role";

revoke all privileges on table "public"."share_messages" from PUBLIC;

revoke all privileges on table "public"."share_messages" from "anon";

revoke all privileges on table "public"."share_messages" from "authenticated";

revoke all privileges on table "public"."share_messages" from "service_role";

revoke all privileges on table "public"."share_rate_limit_buckets" from PUBLIC;

revoke all privileges on table "public"."share_rate_limit_buckets" from "anon";

revoke all privileges on table "public"."share_rate_limit_buckets" from "authenticated";

revoke all privileges on table "public"."share_rate_limit_buckets" from "service_role";

revoke all privileges on table "public"."share_session_grants" from PUBLIC;

revoke all privileges on table "public"."share_session_grants" from "anon";

revoke all privileges on table "public"."share_session_grants" from "authenticated";

revoke all privileges on table "public"."share_session_grants" from "service_role";

revoke all privileges on table "public"."task_resources" from PUBLIC;

revoke all privileges on table "public"."task_resources" from "anon";

revoke all privileges on table "public"."task_resources" from "authenticated";

revoke all privileges on table "public"."task_resources" from "service_role";

revoke all privileges on table "public"."tasks" from PUBLIC;

revoke all privileges on table "public"."tasks" from "anon";

revoke all privileges on table "public"."tasks" from "authenticated";

revoke all privileges on table "public"."tasks" from "service_role";

revoke all privileges on table "public"."users" from PUBLIC;

revoke all privileges on table "public"."users" from "anon";

revoke all privileges on table "public"."users" from "authenticated";

revoke all privileges on table "public"."users" from "service_role";

grant execute on function "public"."activate_share_link"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) to "authenticated";

grant execute on function "public"."admit_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_device_token_hash text, p_ip_identity_digest text, p_idempotency_key_hash text, p_capacity_lease_token_hash text, p_input_type text) to "service_role";

grant execute on function "public"."advance_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_next_status text, p_next_risk_state text) to "service_role";

grant execute on function "public"."apply_project_bulk_action_transaction"(p_action text, p_project_ids uuid[]) to "authenticated";

grant execute on function "public"."apply_project_bulk_action_transaction"(p_action text, p_project_ids uuid[]) to "service_role";

grant execute on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) to "authenticated";

grant execute on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) to "service_role";

grant execute on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) to "authenticated";

grant execute on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) to "service_role";

grant execute on function "public"."block_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_block_code text) to "service_role";

grant execute on function "public"."claim_billing_checkout_attempt"(p_user_id uuid, p_intent text, p_ttl_seconds integer, p_lease_seconds integer) to "service_role";

grant execute on function "public"."claim_homepage_demo_project_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) to "service_role";

grant execute on function "public"."claim_homepage_demo_project_with_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) to "service_role";

grant execute on function "public"."claim_homepage_demo_project_with_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) to "service_role";

grant execute on function "public"."claim_homepage_demo_project"(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) to "service_role";

grant execute on function "public"."clear_share_link_expiry"(p_link_id uuid) to "authenticated";

grant execute on function "public"."clear_share_link_pin"(p_link_id uuid) to "authenticated";

grant execute on function "public"."complete_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text) to "service_role";

grant execute on function "public"."complete_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_normalized_result jsonb, p_schema_version text, p_engine_version text) to "service_role";

grant execute on function "public"."complete_homepage_demo_trial"(p_trial_id uuid, p_normalized_result jsonb, p_schema_version text, p_engine_version text) to "service_role";

grant execute on function "public"."create_homepage_demo_trial"(p_public_token_hash text, p_session_token_hash text, p_idempotency_key_hash text, p_input_type text, p_expires_at timestamp with time zone) to "service_role";

grant execute on function "public"."create_share_link_draft"(p_project_id uuid, p_public_id text) to "authenticated";

grant execute on function "public"."disable_share_link"(p_link_id uuid) to "authenticated";

grant execute on function "public"."enforce_calendar_event_relationship_integrity"() to "anon";

grant execute on function "public"."enforce_calendar_event_relationship_integrity"() to "authenticated";

grant execute on function "public"."enforce_calendar_event_relationship_integrity"() to PUBLIC;

grant execute on function "public"."enforce_calendar_event_relationship_integrity"() to "service_role";

grant execute on function "public"."fail_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_error_code text) to "service_role";

grant execute on function "public"."fail_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text, p_failure_code text) to "service_role";

grant execute on function "public"."fail_homepage_demo_trial"(p_trial_id uuid, p_expected_status text, p_failure_code text) to "service_role";

grant execute on function "public"."finalize_share_message_conversion"(p_message_id uuid, p_project_update_id uuid) to "authenticated";

grant execute on function "public"."get_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text) to "service_role";

grant execute on function "public"."get_owner_authenticated_activity_summary"(p_user_ids uuid[]) to "service_role";

grant execute on function "public"."get_owner_product_activation_analytics"() to "service_role";

grant execute on function "public"."get_owner_user_activity_report"(p_limit integer) to "service_role";

grant execute on function "public"."get_owner_user_activity_timeline"(p_user_id uuid, p_limit integer) to "service_role";

grant execute on function "public"."get_share_link_management_state"(p_project_id uuid) to "authenticated";

grant execute on function "public"."import_projects_transaction"(p_attempt_id uuid, p_idempotency_key uuid, p_request_hash text, p_groups jsonb) to "service_role";

grant execute on function "public"."increment_share_rate_limit_bucket"(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer) to "service_role";

grant execute on function "public"."list_share_link_summaries"(p_project_ids uuid[]) to "authenticated";

grant execute on function "public"."list_share_link_summaries"(p_project_ids uuid[]) to "service_role";

grant execute on function "public"."prepare_homepage_demo_claim_auth_continuation"(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer) to "service_role";

grant execute on function "public"."prepare_homepage_demo_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) to "service_role";

grant execute on function "public"."prepare_homepage_demo_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) to "service_role";

grant execute on function "public"."process_creem_webhook_event"(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text) to "service_role";

grant execute on function "public"."purge_expired_homepage_demo_trials"(p_limit integer) to "service_role";

grant execute on function "public"."purge_homepage_demo_retention"(p_limit integer) to "service_role";

grant execute on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) to "authenticated";

grant execute on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) to "service_role";

grant execute on function "public"."record_dashboard_visit"(p_user_id uuid) to "service_role";

grant execute on function "public"."record_homepage_demo_challenge_failure"(p_ip_identity_digest text) to "service_role";

grant execute on function "public"."record_successful_extraction"(p_user_id uuid) to "service_role";

grant execute on function "public"."recover_stale_homepage_demo_processing"(p_limit integer) to "service_role";

grant execute on function "public"."reenable_share_link"(p_link_id uuid) to "authenticated";

grant execute on function "public"."reprocess_creem_webhook_event"(p_provider_event_id text) to "service_role";

grant execute on function "public"."resolve_creem_webhook_review"(p_provider_event_id text, p_decision text) to "service_role";

grant execute on function "public"."reveal_share_link_secret"(p_link_id uuid) to "authenticated";

grant execute on function "public"."revoke_share_link"(p_link_id uuid) to "authenticated";

grant execute on function "public"."rotate_share_link_secret"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) to "authenticated";

grant execute on function "public"."run_homepage_demo_maintenance"(p_limit integer) to "service_role";

grant execute on function "public"."save_share_configuration"(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb) to "authenticated";

grant execute on function "public"."send_share_message_reply"(p_share_link_id uuid, p_parent_message_id uuid, p_body text) to "authenticated";

grant execute on function "public"."set_calendar_events_updated_at"() to "anon";

grant execute on function "public"."set_calendar_events_updated_at"() to "authenticated";

grant execute on function "public"."set_calendar_events_updated_at"() to PUBLIC;

grant execute on function "public"."set_calendar_events_updated_at"() to "service_role";

grant execute on function "public"."set_customer_stories_updated_at"() to "anon";

grant execute on function "public"."set_customer_stories_updated_at"() to "authenticated";

grant execute on function "public"."set_customer_stories_updated_at"() to PUBLIC;

grant execute on function "public"."set_customer_stories_updated_at"() to "service_role";

grant execute on function "public"."set_homepage_demo_updated_at"() to "service_role";

grant execute on function "public"."set_share_link_expiry"(p_link_id uuid, p_expires_at timestamp with time zone) to "authenticated";

grant execute on function "public"."set_share_link_pin"(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer) to "authenticated";

grant execute on function "public"."set_share_message_status"(p_message_id uuid, p_status text) to "authenticated";

grant execute on function "public"."set_task_resources_updated_at"() to "anon";

grant execute on function "public"."set_task_resources_updated_at"() to "authenticated";

grant execute on function "public"."set_task_resources_updated_at"() to PUBLIC;

grant execute on function "public"."set_task_resources_updated_at"() to "service_role";

grant execute on function "public"."set_updated_at"() to "anon";

grant execute on function "public"."set_updated_at"() to "authenticated";

grant execute on function "public"."set_updated_at"() to PUBLIC;

grant execute on function "public"."set_updated_at"() to "service_role";

grant execute on function "public"."start_homepage_demo_processing"(p_attempt_id uuid, p_capacity_lease_token_hash text) to "service_role";

grant execute on function "public"."update_homepage_demo_review_draft"(p_public_token_hash text, p_session_token_hash text, p_edited_result jsonb, p_expected_updated_at timestamp with time zone) to "service_role";

grant execute on function "public"."update_project_client_identity_transaction"(p_project_id uuid, p_field text, p_value text) to "authenticated";

grant execute on function "public"."update_project_client_identity_transaction"(p_project_id uuid, p_field text, p_value text) to "service_role";

grant usage, select, update on sequence "public"."tasks_id_seq" to "anon";

grant usage, select, update on sequence "public"."tasks_id_seq" to "authenticated";

grant usage, select, update on sequence "public"."tasks_id_seq" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."analytics_events" to "service_role";

grant select, insert on table "public"."authenticated_product_events" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."billing_checkout_attempts" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."billing_subscriptions" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."billing_subscriptions" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."billing_subscriptions" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."calendar_events" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."calendar_events" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."calendar_events" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."clients" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."clients" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."clients" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."creem_webhook_events" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."customer_stories" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."customer_stories" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."customer_stories" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."gmail_oauth_tokens" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."gmail_oauth_tokens" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."gmail_oauth_tokens" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_admission_attempts" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_admission_config" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_capacity_reservations" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_claims" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_cost_buckets" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_cost_reservations" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_drafts" to "service_role";

grant select, insert, update on table "public"."homepage_demo_duplicate_override_authorities" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_rate_limit_buckets" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_trial_entitlements" to "service_role";

grant select, insert, update, delete on table "public"."homepage_demo_trials" to "service_role";

grant select, delete, truncate, references, trigger on table "public"."project_import_attempts" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_import_attempts" to "service_role";

grant select on table "public"."project_share_links" to "authenticated";

grant select on table "public"."project_share_links" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_timeline_events" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_timeline_events" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_timeline_events" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_update_items" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_update_items" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_update_items" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_updates" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_updates" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."project_updates" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."projects" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."projects" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."projects" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_jobs" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_jobs" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_jobs" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_results" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_results" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_results" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_snapshots" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_snapshots" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."scan_snapshots" to "service_role";

grant select, insert, update, delete on table "public"."share_browser_sessions" to "service_role";

grant select, insert, delete on table "public"."share_link_events" to "service_role";

grant select on table "public"."share_link_resources" to "authenticated";

grant select on table "public"."share_link_resources" to "service_role";

grant select on table "public"."share_link_tasks" to "authenticated";

grant select on table "public"."share_link_tasks" to "service_role";

grant select on table "public"."share_link_updates" to "authenticated";

grant select on table "public"."share_link_updates" to "service_role";

grant select on table "public"."share_message_conversions" to "authenticated";

grant select on table "public"."share_messages" to "authenticated";

grant select on table "public"."share_messages" to "service_role";

grant select, insert, update, delete on table "public"."share_rate_limit_buckets" to "service_role";

grant select, insert, update, delete on table "public"."share_session_grants" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."task_resources" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."task_resources" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."task_resources" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."tasks" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."tasks" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."tasks" to "service_role";

grant select, insert, update, delete, truncate, references, trigger on table "public"."users" to "anon";

grant select, insert, update, delete, truncate, references, trigger on table "public"."users" to "authenticated";

grant select, insert, update, delete, truncate, references, trigger on table "public"."users" to "service_role";

-- STORAGE CONFIGURATION

insert into storage.buckets (id, name, type, public, file_size_limit, allowed_mime_types, avif_autodetection)
values ('task-resources', 'task-resources', 'STANDARD', false, 10485760, array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[], false)
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  avif_autodetection = excluded.avif_autodetection;

-- STORAGE POLICIES

create policy "Users can delete their own task resource files" on storage."objects" as permissive for DELETE using (((bucket_id = 'task-resources'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can update their own task resource files" on storage."objects" as permissive for UPDATE using (((bucket_id = 'task-resources'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'task-resources'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can upload their own task resource files" on storage."objects" as permissive for INSERT with check (((bucket_id = 'task-resources'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "Users can view their own task resource files" on storage."objects" as permissive for SELECT using (((bucket_id = 'task-resources'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- COMMENTS

comment on function "public"."activate_share_link"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) is 'Phase 1B.2: activates an owned draft share link, atomically setting secret_digest/secret_digest_version/activated_at, inserting the matching project_share_secret_material row, and bumping configuration_version exactly once -- all in one transaction. SECURITY DEFINER; obtains auth.uid() internally; accepts no plaintext secret, only an already-computed digest and already-encrypted material. Uses the project-then-link two-level lock so the V1 one-active-link-per-project rule is race-safe across different links of the same project. Never returns the digest, ciphertext, nonce, auth tag, encryption version, user id or project id.';

comment on table "public"."analytics_events" is 'Private internal analytics events for Text2Task owner-only reporting. Service role only; do not store sensitive customer content.';

comment on column "public"."analytics_events"."metadata" is 'Sanitized operational metadata only. Never store raw messages, screenshots, task text, summaries, resources, passwords, tokens, or private client data.';

comment on function "public"."apply_project_update_transaction"(p_update_id uuid, p_apply_attempt_id uuid, p_accepted_item_ids uuid[], p_rejected_item_ids uuid[], p_edited_items jsonb, p_apply_payload jsonb) is 'Atomically applies one claimed Project Update review, commits item, mutation, timeline, and lifecycle writes, records user priority provenance for accepted project-level priority changes, and reconciles project completion via the shared reconcile_project_completion check. Phase 6C: for client_share rows only (source_share_message_id is not null), also establishes the transaction-local row-bound capability immediately before the applied-status write, and calls finalize_share_message_conversion immediately before the final return -- both a complete no-op for every other source type.';

comment on function "public"."apply_task_bulk_status_transaction"(p_task_ids bigint[], p_status text) is 'Atomically updates selected owned tasks to Done or In Progress and completes qualifying related projects via the shared reconcile_project_completion check.';

comment on table "public"."authenticated_product_events" is 'Owner-analytics only. Append-only log of deliberate authenticated "viewed this product surface" events. Deliberately separate from public.analytics_events -- never shares that table''s traffic queries or dedupe mechanism. Service role only; never store client messages, task text, project titles, client/contact names, email content, budgets, notes, file names, screenshots, or other private/free-form content.';

comment on column "public"."authenticated_product_events"."user_id" is 'Always resolved server-side from the authenticated Supabase session -- never accepted from client input. on delete cascade: this table holds authenticated-only rows, so a deleted account''s view history is deleted with it (unlike analytics_events, which uses on delete set null to preserve anonymous-attributable marketing rows).';

comment on table "public"."billing_checkout_attempts" is 'Private service-role-only coordination records for idempotent Pro checkout creation. Stores operational attempt state only; no prices, product IDs, card data, provider secrets, raw provider responses, or entitlement state.';

comment on column "public"."billing_checkout_attempts"."error_code" is 'Bounded safe internal error code only. Never store provider response bodies, secrets, or raw error payloads.';

comment on column "public"."billing_checkout_attempts"."expires_at" is 'Attempt expiration deadline. Expired attempts are not reused for checkout redirects.';

comment on column "public"."billing_checkout_attempts"."lease_expires_at" is 'Short lease deadline after which another server worker may reclaim the same creating attempt while preserving its Creem request id.';

comment on column "public"."billing_checkout_attempts"."lease_token" is 'Worker lease token that authorizes exactly one in-flight checkout creation finalization or failure update.';

comment on column "public"."billing_checkout_attempts"."status" is 'Operational checkout creation status: creating, checkout_created, failed, expired, or completed.';

comment on column "public"."billing_checkout_attempts"."user_id" is 'Authenticated Supabase user that owns this checkout attempt.';

comment on table "public"."calendar_events" is 'Manual Work Calendar events created directly by a user. Project deadlines are never stored here -- they remain authoritative in projects.deadline_date and are merged in at query time.';

comment on column "public"."calendar_events"."event_time" is 'Nullable. Null means an all-day event. Canonical application value is a strict HH:MM 24-hour string (see lib/calendar/time-only.ts) -- never a Date object, never UTC-converted. calendar_events_event_time_minute_precision_check enforces zero seconds at the database layer.';

comment on function "public"."claim_billing_checkout_attempt"(p_user_id uuid, p_intent text, p_ttl_seconds integer, p_lease_seconds integer) is 'Service-role-only atomic claim for a Pro checkout attempt. Serializes per user and intent, reuses unexpired checkout URLs, respects valid leases, reclaims expired leases with the same Creem request id, or creates one new leased attempt.';

comment on function "public"."claim_homepage_demo_project_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) is 'Service-role-only Homepage Demo claim/save RPC with pending-auth continuation support. Allows save with either the original short claim authority or a valid non-expired continuation token hash.';

comment on function "public"."claim_homepage_demo_project_with_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) is 'Service-role-only save-anyway RPC with pending-auth continuation support. Validates duplicate override authority before atomically reusing claim_homepage_demo_project_v2.';

comment on function "public"."claim_homepage_demo_project_with_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_authority_token_hash text, p_request_hash text, p_import_groups jsonb) is 'Service-role-only atomic Homepage Demo save-anyway RPC. Validates duplicate override authority and reuses claim_homepage_demo_project in one transaction, returning only a safe outcome code, saved project ID, and created/replayed flag.';

comment on function "public"."claim_homepage_demo_project"(p_claim_token_hash text, p_authenticated_user_id uuid, p_request_hash text, p_import_groups jsonb, p_duplicate_check_passed boolean) is 'Service-role-only atomic Homepage Demo claim/save RPC. Reuses import_projects_transaction with the claim reserved idempotency key and returns only a safe outcome code, saved project ID, and created/replayed flag.';

comment on function "public"."clear_share_link_expiry"(p_link_id uuid) is 'Phase 1B.3: clears expires_at on an owned, non-revoked, non-deleted-project share link, for every state except expired (project_share_links_state_lifecycle_check requires an expired link to keep a non-null expires_at, so this returns SHARE_LINK_STATE_CONFLICT and makes no mutation for that state rather than inventing an expired -> active transition). SECURITY DEFINER; obtains auth.uid() internally. Bumps configuration_version exactly once only when expiry was actually present (the Phase 3 grant-invalidation mechanism this migration''s header describes); an already-null expiry is an idempotent no-op. No event, no session/grant write.';

comment on function "public"."clear_share_link_pin"(p_link_id uuid) is 'Phase 1B.3: clears the PIN (all seven columns to null in one UPDATE) on an owned, non-revoked, non-deleted-project share link. SECURITY DEFINER; obtains auth.uid() internally. Bumps configuration_version exactly once only when a PIN genuinely existed (the same Phase 3 grant-invalidation mechanism this migration''s header describes) -- an already-PIN-less link is an idempotent no-op that leaves configuration_version untouched. No event, no session/grant write.';

comment on function "public"."complete_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_checkout_url text) is 'Service-role-only finalization for a leased checkout creation attempt. Only the current valid lease may store a non-empty HTTPS checkout URL.';

comment on function "public"."create_share_link_draft"(p_project_id uuid, p_public_id text) is 'Phase 1B.2: creates a draft share link for one owned, non-deleted, non-archived project. SECURITY DEFINER; obtains auth.uid() internally; never accepts user_id or a secret. Multiple drafts per project are always allowed. On a public_id unique-constraint collision (identified by exact constraint name, never by message substring), raises PUBLIC_ID_COLLISION so the TypeScript caller can retry with a fresh candidate -- this function itself never loops. Writes one link_created event in the same transaction. Returns only linkId, publicId, state, createdAt.';

comment on table "public"."creem_webhook_events" is 'Private service-role-only Creem webhook ledger. Stores bounded normalized fields for idempotency, ordering, retries, reconciliation, and manual refund review; never raw payloads, secrets, signatures, email, card data, or full metadata.';

comment on column "public"."creem_webhook_events"."provider_state_updated_at" is 'State-effective timestamp used for entitlement ordering, preferring object.updated_at for lifecycle events.';

comment on table "public"."customer_stories" is 'Real user-submitted Text2Task customer stories/feedback. Public landing page may show only approved stories with public_permission=true.';

comment on column "public"."customer_stories"."display_name" is 'Public display name chosen by the user, shown only after approval.';

comment on column "public"."customer_stories"."is_approved" is 'Manual owner/admin approval flag. Users cannot approve themselves from the client.';

comment on column "public"."customer_stories"."public_permission" is 'User permission allowing Text2Task to display this feedback publicly after approval.';

comment on column "public"."customer_stories"."role_or_business_type" is 'Optional public context such as Freelancer, Web designer, Agency owner, Virtual assistant.';

comment on column "public"."customer_stories"."user_id" is 'Authenticated Supabase user who submitted the feedback. Never trust client-sent user_id in API routes.';

comment on function "public"."disable_share_link"(p_link_id uuid) is 'Phase 1B.2: disables an owned active share link, setting disabled_at and bumping configuration_version exactly once. SECURITY DEFINER; obtains auth.uid() internally. Never deletes or changes project_share_secret_material. Writes one link_disabled event in the same transaction. Returns only linkId, state, configurationVersion, disabledAt.';

comment on function "public"."enforce_project_share_link_integrity"() is 'Rejects a share link whose project_id is not owned by the link''s own user_id; rejects owner, project, public_id and created_at reassignment; enforces monotonic configuration_version, view_count, last_viewed_at and revoked_at; makes revoked state terminal; and requires security/access changes to increase configuration_version. Never copies or silently repairs caller input.';

comment on function "public"."enforce_project_update_client_share_apply_boundary"() is 'Phase 6C client_share apply boundary (narrowed in place from the Phase 6B version -- never dropped): "applying" is no longer blocked for client_share (the real apply_project_update_transaction always independently re-validates and performs real work regardless of how "applying" was reached -- proven safe by the Phase 6C security audit). An *entering* transition into "applied" for client_share -- a direct INSERT already at "applied", or an UPDATE from any prior status other than "applied" -- is permitted only when the transaction-local capability text2task.client_share_apply_update_id matches the exact row id, a value only apply_project_update_transaction itself ever sets, immediately before its own authoritative applied-status write. An already-applied client_share row receiving an ordinary non-status update (OLD.status=''applied'' AND NEW.status=''applied'') does not require the capability -- this guard protects establishing applied, not every future write to an already-applied row. TG_OP-safe: OLD is referenced only inside a branch that has already established TG_OP=''UPDATE''.';

comment on function "public"."enforce_project_update_source_provenance"() is 'Phase 6A: rejects an insert whose non-null source_share_message_id does not resolve to an existing, client-authored share_messages row owned by the same user and belonging to the same project as the new public.project_updates row, or whose raw_input is not exactly equal to that message''s body (no trim/case-fold/hash/other reinterpretation). Rejects any update that changes source_type or source_share_message_id on an existing row in either direction, and rejects any update that changes raw_input on a row whose source_share_message_id was already non-null. SECURITY INVOKER: under an owner-authenticated caller, RLS on public.share_messages already confines the lookup to that owner''s own rows. Writes to no table: performs no analysis, creates no project update, creates no task, changes no project/task/message status, and never references public.share_message_conversions or public.project_timeline_events.';

comment on function "public"."enforce_share_browser_session_integrity"() is 'Rejects browser-session identity or expiry changes after insert, keeps last_seen_at monotonic, and makes revocation irreversible. A revoked session can never become usable again by clearing or backdating revoked_at.';

comment on function "public"."enforce_share_link_resource_integrity"() is 'Rejects any share-link Resource mapping whose owner does not match the link''s owner, whose Resource is not owned by that same user, whose Resource belongs to a different project than the link, whose task-attached Resource hangs off a task in a different project, whose project_id and task_id contradict each other, or which can be attributed to no project at all. Cross-account and same-owner-cross-project Resource ids are rejected.';

comment on function "public"."enforce_share_link_task_integrity"() is 'Rejects any share-link task mapping whose owner does not match the link''s owner, whose task is not owned by that same user, whose task has no project, whose task belongs to a different project than the link, or whose task is soft-deleted. Cross-account and same-owner-cross-project subtask ids are rejected with distinct stable codes.';

comment on function "public"."enforce_share_link_update_integrity"() is 'Rejects a published client-facing update whose owner does not match the share link''s owner or whose created_by is a different user, and makes a published version immutable afterwards -- only is_current may change, so the current-version pointer can move without ever rewriting published history.';

comment on function "public"."enforce_share_message_conversion_integrity"() is 'Rejects a conversion record whose owner does not match the converted message, whose message was not client-authored, whose converted_by is anyone other than the authenticated owner, or whose referenced Client Update or task belongs to another owner or another project. Performs no conversion itself: nothing here analyses a message, creates a project update, creates a task, changes any message status, or changes any project/task status.';

comment on function "public"."enforce_share_message_integrity"() is 'Rejects a share message whose owner or project does not match its share link, whose parent belongs to a different link or owner, whose author_type = ''owner'' was not written by that authenticated owner, or whose author_type = ''client'' was not written through service_role as a fresh visible client message with no owner-review state on an active, unexpired, comments-enabled link whose project exists and is not soft-deleted. Client replies may reference only client-visible parent messages. Writes to no table: no CRM mutation and no public.project_timeline_events row is ever produced by a client comment or an owner reply.';

comment on function "public"."enforce_share_session_grant_integrity"() is 'On insert, rejects a per-link grant unless the browser session exists, is live and unrevoked; the share link exists, is active and unexpired; the linked project exists and is not deleted; the granted configuration version, access epoch and pin epoch all exactly match the link''s live values; grant expiry fits within the session''s own expiry; and PIN verification presence matches the link PIN requirement. On update, keeps grant identity, configuration version, access epoch, pin epoch, PIN verification, creation and expiry immutable and permits only initial revocation. Corrected 202608250001: added access_epoch/pin_epoch staleness+immutability checks; removed the grant-expiry-vs-link-expiry ceiling (grant expiry is session-TTL-only going forward; link expiry remains independently, live-enforced elsewhere).';

comment on function "public"."fail_billing_checkout_creation"(p_attempt_id uuid, p_lease_token uuid, p_error_code text) is 'Service-role-only failure marker for a leased checkout creation attempt. Stores only a bounded safe internal error code and never provider payloads or secrets.';

comment on function "public"."finalize_share_message_conversion"(p_message_id uuid, p_project_update_id uuid) is 'Phase 6C: atomic conversion-closure helper for client_share Apply. SECURITY DEFINER, callable directly by authenticated (required for the still-SECURITY INVOKER apply_project_update_transaction''s own perform call to succeed) -- therefore a complete, independent authorization boundary. Requires the transaction-local capability text2task.client_share_apply_update_id, bound to the exact p_project_update_id, before any other check or write -- a standalone call in its own transaction never has this set. Also independently re-validates ownership, applied status, client_share provenance, message linkage, author type, and not-already-converted -- a second, independent layer, not a replacement for the capability check. Writes exactly one share_message_conversions row and updates share_messages.status=''converted''; never touches resolved_at; target_task_id is always null in Phase 6C.';

comment on function "public"."get_owner_authenticated_activity_summary"(p_user_ids uuid[]) is 'Owner-analytics only. Per-user authenticated-view summary (last_seen_at, last_viewed_route, last_event_name, total_authenticated_views, distinct_active_days, is_returning) for the given, server-capped (max 2000) set of user ids, read from public.authenticated_product_events. distinct_active_days is bucketed by Asia/Jerusalem calendar date, matching this repository''s existing owner-analytics timezone convention (lib/analytics/owner-analytics-window.ts, and the "Times shown in Israel time" convention already used by /admin/analytics/users). is_returning := distinct_active_days > 1. Returns no client message, task text, project title, client/contact name, email content, or other private/free-form content, because none is stored in the source table. Repository code calls this only from owner-only server UI after deployment.';

comment on function "public"."get_owner_product_activation_analytics"() is 'Owner analytics only. Read-only exact product activation summary and newest-user project aggregates. All historical project rows count toward activation, including archived and soft-deleted projects. Returns no private project, task, client, message, file, resource, email, or token content.';

comment on function "public"."get_owner_user_activity_report"(p_limit integer) is 'Owner analytics only. Read-only per-user activity aggregate (plan, subscription status, extraction/dashboard activity, project counts and timestamps) for the owner-only Users & Activity admin view. Does not read auth.users -- email, signup date, verification status, provider, and last sign-in are merged in application code from supabase.auth.admin.listUsers(). Returns no private project, task, client, message, file, resource, email, or token content.';

comment on function "public"."get_owner_user_activity_timeline"(p_user_id uuid, p_limit integer) is 'Owner-analytics only. Ordered (newest first, deterministic id desc tiebreak) authenticated-view timeline for one user from public.authenticated_product_events -- created_at, event_name, route, entity_type, entity_id only. p_limit defaults to 200 and is clamped server-side to a hard ceiling of 500 regardless of the requested value. Returns no client message, task text, project title, client/contact name, email content, or other private/free-form content, because none is stored in the source table. Repository code calls this only from owner-only server UI after deployment.';

comment on function "public"."get_share_link_management_state"(p_project_id uuid) is 'Phase 1B.1, extended by Phase 1C, corrected by Phase 2B: read-only owner management state for the single V1-managed share link on one owned, non-deleted project. SECURITY INVOKER, relies on existing RLS. mappedTasks/mappedResources now return the complete persisted per-item mapping metadata (publicGroup/waitingForClientFeedback/displayOrder for each task; publicLabel/canDownload/displayOrder for each Resource), ordered by display_order then id exactly as stored -- never renumbered on read. Replaces the prior mappedTaskIds/mappedResourceIds bare-id arrays entirely (not supplemented) since no consumer of this feature-gated-off RPC depended on the prior shape. Never returns secret_digest, pin_hash/pin_salt, PIN scrypt parameters, user_id, project_id, created_by, storage_path, file_name, url, mime_type, size_bytes, task_resources.notes or any internal mapping-table row id. Does not mutate view_count or last_viewed_at.';

comment on table "public"."homepage_demo_claims" is 'Private service-role-only Homepage Demo claim records. Stores one-time claim state, token hashes, linked trial/draft IDs, authenticated user ID, and saved project ID only; never raw tokens, client messages, extracted project content, task content, email addresses, or personal data. Temporary trial/draft links and deleted user/project links may be nulled without making a consumed claim reusable.';

comment on column "public"."homepage_demo_claims"."auth_continuation_consumed_at" is 'Set when the continuation-bearing claim is successfully saved. Consumed continuations cannot claim again or change ownership.';

comment on column "public"."homepage_demo_claims"."auth_continuation_expires_at" is 'Server-computed pending-auth continuation expiry. It may outlive the anonymous claim expiry but only for this selected pending claim.';

comment on column "public"."homepage_demo_claims"."auth_continuation_started_at" is 'Server timestamp when a valid short-lived claim first began a real auth flow. This is the fixed start for the bounded continuation window and is never slid by retries.';

comment on column "public"."homepage_demo_claims"."auth_continuation_token_hash" is 'SHA-256 hash of the bounded pending-auth continuation token. Raw continuation tokens are never stored and never placed in email, OAuth, analytics, or query-string URLs.';

comment on column "public"."homepage_demo_claims"."claim_token_hash" is 'SHA-256 hash of the opaque one-time claim token. Raw claim tokens are never stored.';

comment on column "public"."homepage_demo_claims"."claimed_by_user_id" is 'Authenticated user who successfully claimed the temporary Homepage Demo draft. May be set null by account deletion without making the claim reusable.';

comment on column "public"."homepage_demo_claims"."import_idempotency_key" is 'Server-generated UUID reserved for the authenticated project import transaction so committed claim saves can be replayed safely.';

comment on column "public"."homepage_demo_claims"."public_token_hash" is 'SHA-256 hash copied from the linked anonymous Homepage Demo trial public token hash for server-side claim binding. Raw public tokens are never stored.';

comment on column "public"."homepage_demo_claims"."saved_project_id" is 'Authenticated project created by the future transactional claim/save flow. May be set null by project deletion without making the claim reusable.';

comment on column "public"."homepage_demo_claims"."session_token_hash" is 'SHA-256 hash copied from the linked anonymous Homepage Demo trial session token hash for server-side claim binding. Raw session tokens are never stored.';

comment on column "public"."homepage_demo_claims"."status" is 'Claim lifecycle state: pending, claimed, expired, or cancelled. Only pending claims are eligible for future claim/save processing.';

comment on table "public"."homepage_demo_drafts" is 'Private service-role-only temporary homepage demo review drafts. Draft JSON is server-controlled, expires hard, and is never directly readable or writable by browser database clients.';

comment on column "public"."homepage_demo_drafts"."trial_id" is 'One-to-one service-controlled draft for a homepage demo trial.';

comment on table "public"."homepage_demo_duplicate_override_authorities" is 'Private service-role-only Homepage Demo duplicate override authorities. Stores token hashes and claim/user/request/import-payload binding only; never raw authority tokens, claim tokens, duplicate project IDs, draft JSON, import payloads, or client/project/task content.';

comment on column "public"."homepage_demo_duplicate_override_authorities"."authority_token_hash" is 'SHA-256 hash of the short-lived opaque duplicate override authority token. Raw authority tokens are never stored.';

comment on column "public"."homepage_demo_duplicate_override_authorities"."import_groups_hash" is 'Database-computed SHA-256 hash of the trusted transactional import groups JSONB text representation.';

comment on column "public"."homepage_demo_duplicate_override_authorities"."request_hash" is 'Canonical request hash generated by trusted server code from the stored Homepage Demo draft.';

comment on table "public"."homepage_demo_trials" is 'Private service-role-only anonymous homepage demo trial records. Stores operational metadata and token hashes only; never raw tokens, prompts, raw input, image bytes, OCR text, model output, IPs, user agents, fingerprints, analytics payloads, or customer content.';

comment on column "public"."homepage_demo_trials"."expires_at" is 'Hard expiration deadline for the anonymous trial.';

comment on column "public"."homepage_demo_trials"."idempotency_key_hash" is 'SHA-256 hash of the opaque creation idempotency key with homepage-demo-idempotency purpose separation. Raw key is never stored.';

comment on column "public"."homepage_demo_trials"."public_token_hash" is 'SHA-256 hash of the opaque public review token with homepage-demo-public purpose separation. Raw token is never stored.';

comment on column "public"."homepage_demo_trials"."session_token_hash" is 'SHA-256 hash of the opaque anonymous session token with homepage-demo-session purpose separation. Raw token is never stored.';

comment on column "public"."homepage_demo_trials"."status" is 'Explicit trial lifecycle state: created, validating, queued, processing, review_ready, failed, blocked, claimed, or expired.';

comment on function "public"."increment_share_rate_limit_bucket"(p_scope text, p_action text, p_identity_digest text, p_identity_digest_version smallint, p_share_link_id uuid, p_window_seconds integer) is 'Atomically upserts-and-increments the public.share_rate_limit_buckets row for one (scope, action, identity_digest, share_link_key, window_start, window_seconds) bucket, in a single INSERT ... ON CONFLICT ... DO UPDATE SET request_count = request_count + 1 statement -- Postgres row-locks the conflicting row for the duration, so concurrent callers never lose an increment. SECURITY DEFINER; service_role-only (this is the anonymous/public Client Share surface''s own operation, unlike every other Client Share SECURITY DEFINER RPC, which is authenticated-owner-only). window_start/expires_at are computed here from a deterministic fixed-window floor of now(), never accepted from the caller. Every input is validated against public.share_rate_limit_buckets'' own existing CHECK-constraint vocabularies before any write. Returns only requestCount/windowStart/windowSeconds/expiresAt -- never the identity digest, the share link id, the bucket''s own id, or an `allowed` verdict (no rate-limit threshold has been decided; the caller compares requestCount against its own server-side limit).';

comment on function "public"."list_share_link_summaries"(p_project_ids uuid[]) is 'Phase 1B.1: read-only per-project share-link summaries (1-100 owned, non-deleted projects), keyed by project id. SECURITY INVOKER, relies on existing RLS. Rejects the whole call with PROJECT_NOT_FOUND if any requested project is not owned -- never returns partial cross-tenant results. unreadCount is always null in Phase 1B.1.';

comment on function "public"."prepare_homepage_demo_claim_auth_continuation"(p_claim_token_hash text, p_existing_continuation_token_hash text, p_candidate_continuation_token_hash text, p_continuation_ttl_seconds integer) is 'Service-role-only RPC that starts or reuses a bounded Homepage Demo pending-auth continuation for an already valid pending claim. The first valid start fixes expiry; retries cannot slide the window.';

comment on function "public"."prepare_homepage_demo_duplicate_override_v2"(p_claim_token_hash text, p_auth_continuation_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) is 'Service-role-only duplicate override preparation RPC with pending-auth continuation support. Authority remains claim/user/request/payload-bound and expires in at most five minutes.';

comment on function "public"."prepare_homepage_demo_duplicate_override"(p_claim_token_hash text, p_authenticated_user_id uuid, p_existing_authority_token_hash text, p_candidate_authority_token_hash text, p_request_hash text, p_import_groups jsonb) is 'Service-role-only RPC that prepares or safely reuses a short-lived Homepage Demo duplicate override authority after trusted duplicate preflight. Returns only a safe outcome, cookie instruction, and expiry.';

comment on function "public"."process_creem_webhook_event"(p_provider_event_id text, p_event_type text, p_provider_event_created_at timestamp with time zone, p_provider_state_updated_at timestamp with time zone, p_object_id text, p_checkout_id text, p_subscription_id text, p_customer_id text, p_product_id text, p_environment text, p_creem_request_id text, p_internal_user_id_candidate uuid, p_action text, p_subscription_status text, p_cancel_at_period_end boolean, p_current_period_start timestamp with time zone, p_current_period_end timestamp with time zone, p_refund_amount numeric, p_amount_paid numeric, p_refunded_amount numeric, p_refund_currency text, p_transaction_currency text, p_reason_code text) is 'Service-role-only atomic Creem webhook processor. Resolves users through trusted identifiers, records retryable pending states, prevents stale/equal-time overwrites, and mutates entitlements in the same transaction as ledger processing. Function owner must be a privileged migration owner with access to public.users, auth.users, and private billing tables.';

comment on column "public"."project_import_attempts"."request_hash" is 'SHA-256 hash of canonical normalized project data, excluding duplicate override decisions.';

comment on table "public"."project_share_links" is 'Owner-controlled Client Share links. Multiple links per project are structurally supported by design: there is deliberately no unique constraint on project_id and no partial unique index on state = ''active''. The V1 one-active-link-per-project product rule is enforced transactionally by a future owner RPC / server operation, never by schema. Never stores a raw or reversible share secret, a plaintext or reversible PIN, a client email/phone, internal client notes, a project amount/priority, or raw input.';

comment on column "public"."project_share_links"."access_epoch" is 'Security-credential generation counter, bumped by exactly one Client Share operation: rotate_share_link_secret. Never bumped by disable, re-enable, PIN clear, expiry changes, or ordinary settings changes -- unlike configuration_version (unchanged, presentation-freshness only), a mismatch here can NEVER be recovered without a fresh secret-based exchange. Compared against share_session_grants.granted_access_epoch at public read time by verifyShareProjectionAuthorization (lib/share/share-session-grant.server.ts).';

comment on column "public"."project_share_links"."client_facing_subtitle" is 'Optional owner-authored text shown to the client. Deliberately NOT public.clients.contact_name, .phone, .email or .notes -- no client contact detail is ever copied onto a share link.';

comment on column "public"."project_share_links"."comments_enabled" is 'Defaults to false: client commenting is opt-in per link, so a link created before the owner has considered the question can never silently accept public writes.';

comment on column "public"."project_share_links"."configuration_version" is 'Monotonically increasing version of what this link exposes. A rotation, a disable, comments-enabled changes, or any future curated task/resource/update-set mutation must happen through a transactional owner operation that locks this row and increments this value exactly once before commit. Every share_session_grants row records the version it was granted against, so stale grants are detectable without deleting audit history.';

comment on column "public"."project_share_links"."content_direction" is 'Closed vocabulary: auto, ltr, rtl. Per-link text direction for the future public page, chosen because the repository has no i18n framework and no locale detection; ''auto'' means the renderer applies a first-strong-character heuristic.';

comment on column "public"."project_share_links"."pin_epoch" is 'PIN-credential generation counter, bumped by exactly one Client Share operation: set_share_link_pin (covers both first-add and value-change -- the RPC does not distinguish the two, so every call bumps it; a grant''s own pin_verified_at can already be non-null from an OLD PIN, so the PIN-required check alone cannot force revalidation against a NEW value). Never bumped by clear_share_link_pin (removing a PIN only loosens the requirement; an existing grant remains safely usable). A mismatch here IS recoverable, by design, via POST /api/share/[publicId]/pin (PIN re-verification only, no raw secret) -- but only when access_epoch still matches (see that route''s own doc comment for why this ordering is security-required).';

comment on column "public"."project_share_links"."pin_hash" is 'Unpadded base64url-encoded derived key from Node crypto.scrypt over the human-entered PIN, using pin_salt and the exact reviewed pin_hash_version 1 profile recorded alongside it: N=16384, r=8, p=1, key_length=32. Version 1 stores a 32-byte derived key as exactly 43 base64url characters. Never a plaintext PIN, never a reversible encoding, and never a bare SHA-256 -- a 4-6 digit PIN is trivially brute-forced against an unsalted fast hash. All PIN columns are either entirely absent or complete and internally consistent (project_share_links_pin_completeness_check).';

comment on column "public"."project_share_links"."pin_hash_version" is 'Version identifier for the PIN hashing scheme. Version 1 is the reviewed fixed scrypt profile N=16384, r=8, p=1, key_length=32; a future stronger profile requires a new pin_hash_version introduced by a reviewed migration.';

comment on column "public"."project_share_links"."pin_salt" is 'Base64url-encoded per-row random salt for pin_hash. Never reused across links and never derived from the PIN, the link, the project or the owner.';

comment on column "public"."project_share_links"."public_id" is 'Opaque, URL-safe public identifier used as the /share/<public_id> path segment. Never derived from project, client or user data, and never a database id. Knowing it alone grants nothing -- it only selects which row a supplied share secret is verified against.';

comment on column "public"."project_share_links"."secret_digest" is 'Lowercase hex keyed HMAC-SHA256 digest of the share secret -- remains the one-way, non-reversible verification value: every access decision compares against THIS digest alone, never against any encrypted material. Nullable only in the pre-generation ''draft'' state (project_share_links_secret_digest_consistency_check). Since 202608060001, a separately stored, owner-recoverable copy of the same secret is also kept, AES-256-GCM encrypted, in the fully closed public.project_share_secret_material table, so the owner can repeatedly re-copy an already-active link -- that encrypted material is never used as, and can never substitute for, the public verification value, which remains this digest alone.';

comment on column "public"."project_share_links"."secret_digest_version" is 'Version of the HMAC key/derivation used for secret_digest, so the server secret can be rotated without invalidating every existing link at once. Required whenever secret_digest is present.';

comment on column "public"."project_share_links"."state" is 'Closed vocabulary: draft, active, disabled, expired, revoked. Rotation deliberately does NOT appear here -- a rotated link stays ''active'' under a new secret, and rotation is recorded by rotated_at plus a configuration_version bump that invalidates existing per-link grants. Read-time checks must always re-verify state, expires_at and the project''s own deleted_at; this column is never the only defence.';

comment on column "public"."project_share_links"."status_visible" is 'Explicit owner publication intent: whether a safe, client-facing project status projection may be included in the future public projection. NEVER a copy of the internal status value or vocabulary, and never itself a status value -- purely a visibility flag. Defaults to false.';

comment on column "public"."project_share_links"."target_date_visible" is 'Explicit owner publication intent: whether the project target/deadline date may be included in the future public projection. NEVER a copy of the date value itself. Defaults to false.';

comment on column "public"."project_share_links"."title_visible" is 'Explicit owner publication intent: whether the project title may be included in the future public projection. NEVER a copy of the title itself -- public.projects.title remains the sole authoritative source. Defaults to false (private by default) for every existing and new row; only save_share_configuration can change it, and only when the owner explicitly supplies it.';

comment on column "public"."project_share_links"."view_count" is 'Non-negative count of public views. Incremented only by the future public projection path; an owner preview must never increment it.';

comment on table "public"."project_share_secret_material" is 'Fully closed table storing only AES-256-GCM encrypted share-secret material, one row per share link. This is NOT a public verification source: public.project_share_links.secret_digest remains the sole one-way value every access decision compares against. Plaintext never enters PostgreSQL -- encryption and decryption happen only in server-only TypeScript (lib/share/share-secret-encryption.server.ts). No role -- public, anon, authenticated or service_role -- is granted any privilege on this table; it is reachable only through the narrowly scoped SECURITY DEFINER RPCs in this migration, which read/write it using their owner''s implicit table-owner privileges, never a granted one. RLS is enabled with no policy, as belt-and-suspenders even though no role holds a grant regardless.';

comment on column "public"."project_share_secret_material"."auth_tag" is 'The 16-byte AES-GCM authentication tag, stored separately from ciphertext so a future key-rotation/re-encryption job can act on it independently.';

comment on column "public"."project_share_secret_material"."ciphertext" is 'AES-256-GCM ciphertext of the raw 43-character base64url share secret. AES-GCM adds no padding, so this is always exactly 43 bytes for the V1 secret shape (project_share_secret_material_ciphertext_length_check). Never plaintext, never stored anywhere else.';

comment on column "public"."project_share_secret_material"."encryption_version" is 'Version of the encryption key/scheme used to produce ciphertext/nonce/auth_tag. Exactly 1 for this V1 implementation; a future stronger scheme or key rotation requires a new version introduced by a reviewed migration, matching the repository''s pin_hash_version precedent.';

comment on column "public"."project_share_secret_material"."share_link_id" is 'The share link this encrypted material belongs to, and the AES-GCM additional authenticated data (AAD) bound on every encrypt/decrypt call -- a ciphertext/nonce/auth_tag triple copied onto a different link''s row fails authentication instead of silently decrypting into the wrong link''s secret.';

comment on table "public"."project_timeline_events" is 'Readable project timeline and audit trail events shown inside Project Update History.';

comment on table "public"."project_update_items" is 'Individual AI-suggested update items inside a client update. Stores old/new values, approval state, confidence, and audit timestamps.';

comment on table "public"."project_updates" is 'Client update events connected to existing projects. Stores raw client messages, AI summary, lifecycle status, and review/apply timestamps.';

comment on column "public"."project_updates"."apply_attempt_id" is 'Operational identifier for the latest claimed apply attempt.';

comment on column "public"."project_updates"."apply_failed_at" is 'Timestamp when the latest claimed apply attempt was marked failed.';

comment on column "public"."project_updates"."apply_started_at" is 'Timestamp when the latest apply attempt atomically claimed this update.';

comment on column "public"."project_updates"."source_share_message_id" is 'Phase 6A: nullable durable pointer to the public.share_messages row this Client Update was created from, when source_type = ''client_share''. NULL for every text/image/email/manual update. ON DELETE RESTRICT so a hard delete of the referenced message can never silently corrupt or erase this provenance. Coupled to source_type by project_updates_source_provenance_coupling_check, unique (when not null) by project_updates_source_share_message_id_key so one share message can back at most one project_updates row, and immutable after row creation by enforce_project_update_source_provenance -- see this migration''s own header comment for the full rationale. Phase 6A does not write this column from any code path; it exists so Phase 6B can, once a separately-authorized owner-triggered conversion route exists.';

comment on function "public"."purge_homepage_demo_retention"(p_limit integer) is 'Server-only bounded Homepage Demo claimed-safe retention cleanup. Physical purge excludes active pending-auth continuations while preserving existing aggregate-only service-role behavior.';

comment on function "public"."reconcile_project_completion"(p_project_id uuid, p_user_id uuid, p_now timestamp with time zone) is 'Shared, idempotent project-completion check: marks a project Done when every active (non-archived, non-deleted) subtask is Done. Called from every transactional mutation path that can complete a project''s last subtask.';

comment on function "public"."record_dashboard_visit"(p_user_id uuid) is 'Owner-analytics only. Records a dashboard visit at most once per 4-hour window per user; the WHERE clause makes this self-rate-limiting and safe to call on every dashboard mount. Must never block or affect dashboard rendering -- called fire-and-forget from app/api/activity/dashboard-visit/route.ts, a Route Handler invoked only after the client has already mounted.';

comment on function "public"."record_successful_extraction"(p_user_id uuid) is 'Owner-analytics only. Atomically increments successful_extract_count and sets last_extract_at for the given user, for any plan. Must only be called after an extraction has already succeeded and its response has already been prepared (see the after() callbacks in app/api/extract/route.ts and app/api/extract-image/route.ts) -- never inside the extraction critical path, and never as a substitute for public.users.extract_count, which continues to exclusively drive Free-plan quota enforcement.';

comment on function "public"."recover_stale_homepage_demo_processing"(p_limit integer) is 'Server-only bounded Homepage Demo stale-processing recovery. Returns aggregate counts only, uses service-role execution, and never returns tokens, hashes, identities, client input, draft JSON, provider output, or row identifiers.';

comment on function "public"."reenable_share_link"(p_link_id uuid) is 'Phase 1B.2: re-enables an owned disabled share link back to active (disabled -> active only; expired -> active is Phase 1B.3''s to add), bumping configuration_version exactly once. SECURITY DEFINER; obtains auth.uid() internally. Uses the identical project-then-link two-level lock as activate_share_link so the one-active-link-per-project rule is race-safe. Requires secret_digest and project_share_secret_material to already exist. Never changes activated_at or clears disabled_at, and never replaces the secret or encrypted material. Writes one link_activated event (no distinct re-enable code exists). Returns only linkId, state, configurationVersion, activatedAt, disabledAt.';

comment on function "public"."reprocess_creem_webhook_event"(p_provider_event_id text) is 'Service-role-only reconciliation helper. Replays one stored normalized Creem webhook event through the same trusted resolution, idempotency, ordering, and entitlement path without accepting a caller-supplied user id.';

comment on function "public"."resolve_creem_webhook_review"(p_provider_event_id text, p_decision text) is 'Service-role-only manual resolution for pending Creem refund review. Accepts only a provider event id and a bounded decision, uses the ledger-resolved user, respects ordering and provider-id consistency, and is idempotent for repeated identical decisions.';

comment on function "public"."reveal_share_link_secret"(p_link_id uuid) is 'Phase 1B.3: reads (never decrypts, never returns plaintext) the encrypted secret material for an owned, active, non-deleted-project share link. SECURITY DEFINER; obtains auth.uid() internally. Draft, disabled, expired and revoked links never reveal. Requires secret_digest, secret_digest_version = 1 and exactly one project_share_secret_material row to exist. Returns only linkId, publicId, ciphertextHex, nonceHex, authTagHex, encryptionVersion (lowercase, exact-length hex) to the authenticated server caller -- decryption happens only in server-only TypeScript. Does not mutate configuration_version, view counters, events, sessions or grants: this is a pure, repeatable read of already-valid material, not a new grant of access.';

comment on function "public"."revoke_share_link"(p_link_id uuid) is 'Phase 1B.3: permanently revokes an owned, non-deleted-project share link (terminal; already-revoked returns SHARE_LINK_STATE_CONFLICT rather than replaying the mutation), bumping configuration_version exactly once (the Phase 3 grant-invalidation mechanism this migration''s header describes). SECURITY DEFINER; obtains auth.uid() internally. Never modifies or deletes project/task/resource/update content, never touches session/grant tables, and never deletes encrypted secret material -- a revoked link''s secret becomes unreachable through reveal_share_link_secret (state = active only) without any destructive cleanup. Writes one link_revoked event. Returns only linkId, state, configurationVersion, revokedAt.';

comment on function "public"."rotate_share_link_secret"(p_link_id uuid, p_secret_digest text, p_secret_digest_version smallint, p_ciphertext_hex text, p_nonce_hex text, p_auth_tag_hex text, p_encryption_version smallint) is 'Phase 1B.3: atomically replaces an owned active/disabled share link''s secret_digest and its project_share_secret_material row, bumping configuration_version exactly once -- all in one transaction (the Phase 3 grant-invalidation mechanism this migration''s header describes: rotation is the primary way a leaked link becomes unusable). SECURITY DEFINER; obtains auth.uid() internally; accepts no plaintext secret, only an already-computed digest and already-encrypted material, matching activate_share_link''s validation exactly. Verifies both UPDATE statements affect exactly one row. Preserves state, public_id, activated_at, disabled_at and expires_at. rotated_at is computed from clock_timestamp() (real wall-clock time, not the transaction-fixed now()) and is floored to strictly exceed the row''s own previous rotated_at, so consecutive rotations of the same link -- even within one transaction or one clock tick -- always produce a strictly increasing value, satisfying enforce_project_share_link_integrity''s own requirement. Writes one link_rotated event containing no identity digest, content or secret material. Never returns the digest, ciphertext, nonce, auth tag, encryption version or any owner/project identifier. Corrected 202608250001: also bumps access_epoch exactly once -- the sole, unrecoverable-without-a-fresh-exchange invalidation of every previously-authorized browser session for this link.';

comment on function "public"."run_homepage_demo_maintenance"(p_limit integer) is 'Server-only bounded Homepage Demo maintenance runner. Uses a transaction-level advisory lock, recovers stale processing before claimed-safe retention cleanup, returns aggregate counts only, and permits no browser execution.';

comment on function "public"."save_share_configuration"(p_link_id uuid, p_settings jsonb, p_tasks jsonb, p_resources jsonb, p_publish_update jsonb) is 'Phase 1B.4, extended by Phase 1C: the single atomic owner-side configuration-save operation, combining settings (comments_enabled, client_facing_subtitle, content_direction, title_visible, status_visible, target_date_visible), the share_link_tasks set, the share_link_resources set and an optional new published share_link_updates version -- all inside one PostgreSQL transaction that commits or rolls back completely. SECURITY DEFINER; obtains and null-checks auth.uid() internally; accepts no user_id or project_id. Locks the owning project row FOR UPDATE, then the target link row FOR UPDATE (the same order as activate_share_link/reenable_share_link, 202608060001), and rejects a deleted or archived project and a revoked link. Every supplied JSON group is independently validated against its exact shape before any write. Tasks and Resources are prevalidated against the same owner/project-attribution rules enforce_share_link_task_integrity/enforce_share_link_resource_integrity independently re-enforce as an unconditional second line of defense -- neither trigger is weakened, bypassed or replaced. configuration_version increases exactly once, only when a supplied settings field genuinely changed (IS DISTINCT FROM) -- title_visible, status_visible and target_date_visible join comments_enabled/client_facing_subtitle/content_direction in that same change-detection group; task, Resource and update-publication changes never bump it. A supplied tasks/resources array performs a deterministic set replacement; an empty array clears the mapping; a null group leaves the existing mapping untouched. A supplied publishUpdate retires the existing current update row before inserting exactly one new immutable current version. Never touches public_id, secret_digest, secret material, PIN material, expiry, activated_at, disabled_at, rotated_at, revoked_at, view_count, last_viewed_at, link lifecycle state, share_link_events, share_browser_sessions or share_session_grants, and never stores a copy of the project title, status or target date -- title_visible/status_visible/target_date_visible are visibility flags only. Returns only linkId, configurationVersion, the final taskIds, the final resourceIds, and the final currentUpdate (version and publishedAt only, never the body).';

comment on function "public"."send_share_message_reply"(p_share_link_id uuid, p_parent_message_id uuid, p_body text) is 'Phase 5A: inserts one owner-authored reply to an existing, owned parent message on the owner''s own share link. SECURITY DEFINER; obtains and null-checks auth.uid() internally; owner-scoped on every read; project soft-delete checked. author_type is always ''owner'', is_visible_to_client is always true, status is always ''reviewed'' -- none are caller-supplied. Writes exactly one public.share_messages row and nothing else: no project_updates, no project_timeline_events, no task/project/CRM mutation, no share_message_conversions row (Phase 6-only, untouched). The existing enforce_share_message_integrity trigger independently re-verifies every invariant this function also checks.';

comment on function "public"."set_client_share_updated_at"() is 'Shared updated_at maintenance trigger for Client Share tables with genuinely mutable state. Never applied to append-only tables (share_link_updates, share_message_conversions, share_link_events).';

comment on function "public"."set_share_link_expiry"(p_link_id uuid, p_expires_at timestamp with time zone) is 'Phase 1B.3: sets/replaces expires_at (strictly future) on an owned, non-revoked, non-deleted-project share link. SECURITY DEFINER; obtains auth.uid() internally. Never changes state, never auto-marks a link expired, never auto-reactivates one. Bumps configuration_version exactly once only when the value genuinely changes (the Phase 3 grant-invalidation mechanism this migration''s header describes) -- an exact no-op leaves it untouched. No event, no session/grant write.';

comment on function "public"."set_share_link_pin"(p_link_id uuid, p_pin_hash text, p_pin_salt text, p_pin_hash_version smallint, p_pin_scrypt_n integer, p_pin_scrypt_r integer, p_pin_scrypt_p integer, p_pin_key_length integer) is 'Phase 1B.3: sets/replaces the PIN on an owned, non-revoked, non-deleted-project share link, given an already-hashed V1 scrypt profile (never a plaintext PIN). SECURITY DEFINER; obtains auth.uid() internally. Sets all seven PIN columns in one UPDATE and bumps configuration_version exactly once. No event is written (no PIN event exists in the closed vocabulary) and no session/grant row is touched. Never returns pin_hash, pin_salt, profile values, user id or project id. Corrected 202608250001: also bumps pin_epoch exactly once -- the mechanism that forces an already-authorized browser to re-verify against the NEW PIN value, recoverable via POST /api/share/[publicId]/pin (PIN re-verification only, no raw secret needed) provided the link''s secret was not also rotated since that browser''s grant was issued.';

comment on function "public"."set_share_message_status"(p_message_id uuid, p_status text) is 'Owner-only workflow-state transition (new/reviewed/resolved/dismissed only -- converted is exclusively Phase 6C''s, never accepted as a target here) for one owned message. SECURITY DEFINER; obtains and null-checks auth.uid() internally; owner-scoped; project soft-delete checked; row locked FOR UPDATE. Phase 6C: loads the row''s current status in that same locked read and rejects with SHARE_MESSAGE_STATUS_TERMINAL, before any mutation is computed, if it is already ''converted'' -- the sole existing path capable of moving share_messages.status at all, so this one guard makes converted a true terminal state. Updates only status/reviewed_at/resolved_at -- never body, author_type, author_display_name, parent_id, share_link_id, project_id, user_id or created_at. Writes to no other table.';

comment on table "public"."share_browser_sessions" is 'Opaque server-managed browser session identities for the anonymous Client Share surface. Service-role only: RLS is enabled with no policies at all, and nothing is granted to anon or authenticated. Holds no raw cookie secret, no raw IP, no user agent, and no content of any kind. A session is only an identity -- what it may actually see is decided entirely by its rows in public.share_session_grants.';

comment on column "public"."share_browser_sessions"."revoked_at" is 'Set when a session is deliberately invalidated. Retained rather than deleted so revocation stays auditable; every read path must treat a revoked session as unusable regardless of expires_at.';

comment on column "public"."share_browser_sessions"."session_digest" is 'Lowercase hex keyed digest of the browser''s cookie secret. The raw cookie secret is NEVER stored, so this column cannot be reversed into a working cookie value. Unique, because it is the lookup key for every session resolution.';

comment on table "public"."share_link_events" is 'Content-free operational and security audit events for one share link. Records THAT something happened, to WHICH link, and WHEN -- never a project title, task title, comment body, client name, file name, Resource label, share secret, PIN, public URL, signed URL, storage path, raw IP or user agent string. There is deliberately no metadata/jsonb column, so that discipline is structural rather than conventional. Append-only and service-role only: RLS enabled with no policies, nothing granted to anon or authenticated.';

comment on column "public"."share_link_events"."event_type" is 'Closed vocabulary enforced by share_link_events_event_type_check. Adding a value is a deliberate, reviewable migration -- exactly the property that keeps content-free auditing from drifting into content logging.';

comment on table "public"."share_link_resources" is 'Explicit owner-curated list of Resources visible through one share link. Deliberately stores no storage_path, file_name, url, mime_type, size_bytes or copy of task_resources.notes. The task-resources bucket stays private and is neither exposed nor altered by this feature; public file access resolves a short-lived signed URL server-side per request. Cross-owner and cross-project mappings are rejected by enforce_share_link_resource_integrity (202608030005).';

comment on column "public"."share_link_resources"."can_download" is 'Defaults to false: download is opt-in per shared Resource, so a Resource shared for viewing can never become downloadable by omission.';

comment on column "public"."share_link_resources"."public_label" is 'Owner-authored client-facing label. Deliberately a separate column and never task_resources.notes, which is an internal field.';

comment on column "public"."share_link_resources"."resource_id" is 'on delete cascade: public.task_resources rows are HARD deleted by the existing Resources API, so deleting a Resource automatically and immediately revokes client access to it. Already-issued signed URLs still survive until their own short TTL elapses -- that residual window is inherent to signed URLs and is documented in the Phase 1A report.';

comment on table "public"."share_link_tasks" is 'Explicit owner-curated list of subtasks visible through one share link. Stores only which subtask is visible and how it is presented -- never a copy of task_title, status, deadline, amount, priority, raw_input, source or client information. Cross-owner and cross-project mappings are rejected at the database layer by enforce_share_link_task_integrity (202608030005).';

comment on column "public"."share_link_tasks"."public_group" is 'Closed client-facing vocabulary: in_progress, waiting_for_feedback, completed, coming_up. Deliberately NOT the internal status vocabulary (New/In Progress/Review/Urgent/Done) -- ''Urgent'' must never be surfaced publicly, and the internal vocabulary must be free to change without changing what a client sees.';

comment on column "public"."share_link_tasks"."subtask_id" is 'bigint, matching public.tasks.id (the legacy bigint primary key), not uuid. on delete cascade so a hard-deleted task can never remain publicly mapped; note that this repository soft-deletes tasks, so the public projection must ALSO filter tasks.deleted_at is null and tasks.is_archived at read time -- the cascade is a backstop, never the only defence.';

comment on column "public"."share_link_tasks"."waiting_for_client_feedback" is 'A share-layer presentation flag only. It never reads from, and never writes to, public.tasks.status.';

comment on table "public"."share_link_updates" is 'Versioned, deliberately published client-facing update text for one share link. Never a copy of project_updates.raw_input, project_updates.ai_summary, Client Update facts, internal review data or internal timeline data. Published rows are immutable history -- body, version, published_at and share_link_id cannot be changed after insert (enforce_share_link_update_integrity, 202608030005); publishing a revision inserts a new version and flips is_current.';

comment on column "public"."share_link_updates"."body" is 'Owner-authored client-facing text, immutable once published. Rendered as a text node only -- never as HTML or Markdown with execution semantics.';

comment on column "public"."share_link_updates"."created_by" is 'The authenticated owner who published this client-facing update. NOT NULL and on delete cascade, matching the single-owner architecture: created_by must equal user_id (enforce_share_link_update_integrity, 202608030005), and deleting the owning account already cascades the owning share link and all update rows.';

comment on column "public"."share_link_updates"."is_current" is 'At most one current version per share link, enforced by the partial unique index below. That restriction is about update versions and has nothing to do with how many links may be active for a project.';

comment on table "public"."share_message_conversions" is 'Traceability record written only AFTER an authenticated owner has deliberately converted a client message through the existing Client Updates analyze/review/apply flow. No trigger analyses a message, creates a project update, creates a task, changes a project/task status, or writes to public.project_timeline_events. One conversion per message (share_message_conversions_message_id_unique).';

comment on column "public"."share_message_conversions"."converted_by" is 'The authenticated owner who performed the conversion. Enforced equal to user_id and to auth.uid() by enforce_share_message_conversion_integrity (202608030005), so a conversion can never be attributed to someone who did not perform it.';

comment on column "public"."share_message_conversions"."project_update_id" is 'The existing public.project_updates row the owner produced. Nullable so the record can exist for a conversion that produced no applied update; on delete set null so purging an old Client Update never erases the fact that a client message was acted upon.';

comment on column "public"."share_message_conversions"."target_task_id" is 'bigint, matching public.tasks.id. Optional pointer to the specific subtask the conversion targeted; on delete set null so a removed task never erases the conversion record.';

comment on table "public"."share_messages" is 'Client comments and owner replies for one share link. Structurally separate from public.project_timeline_events by design: no foreign key, no trigger and no other relationship to it exists, and no trigger on this table mutates projects, tasks, clients, Resources, deadlines, statuses or priorities. Feedback enters the professional work system only when an authenticated owner deliberately sends it through the existing Client Updates analyze/review/apply flow. Deliberately stores no client email, no client phone, no HTML body and no Markdown-execution field.';

comment on column "public"."share_messages"."author_type" is 'Closed vocabulary: client, owner. An ''owner'' row is only accepted when it is written by the authenticated owner themselves (policy plus enforce_share_message_integrity), and a ''client'' row is accepted only from the service_role public path (enforce_share_message_integrity), so neither side can impersonate the other in a client-visible thread.';

comment on column "public"."share_messages"."body" is 'Plain text only, immutable after insert. The original communication record must survive conversion into a Client Update unchanged -- conversion sets status = ''converted'' and writes a share_message_conversions row, and never rewrites or moves this text.';

comment on column "public"."share_messages"."parent_id" is 'Self-reference for one threaded conversation. A parent from a different share link, or from a different owner, is rejected by enforce_share_message_integrity. on delete cascade so a removed parent never leaves an orphaned reply addressing nothing.';

comment on column "public"."share_messages"."project_id" is 'Denormalised from the share link, and enforced equal to it by enforce_share_message_integrity (202608030005). Retained deliberately: the owner''s per-project communication panel and unread counter read by (user_id, project_id) across every link on that project, and carrying project_id here keeps those owner queries a single-table read under RLS while giving every read a third defensive predicate.';

comment on column "public"."share_messages"."status" is 'Closed vocabulary: new, reviewed, resolved, dismissed, converted. Owner-side review state only; it never affects what the client can read (is_visible_to_client does that) and never triggers any automatic project, task or CRM change.';

comment on table "public"."share_rate_limit_buckets" is 'Database-atomic rate-limit accounting for the future anonymous Client Share surface. Service-role only: RLS enabled with no policies, nothing granted to anon or authenticated. Stores no raw IP address and no content -- identities appear only as versioned keyed digests.';

comment on column "public"."share_rate_limit_buckets"."scope" is 'Closed vocabulary: browser_session, network_identity, share_link. Combining a link-scoped bucket with an identity-scoped bucket is the intended enforcement shape, so neither alone is sufficient to pass.';

comment on column "public"."share_rate_limit_buckets"."share_link_key" is 'STORED generated bucket-key component: share_link_id::text, or the literal ''-'' when there is no link (an invalid-link attempt). It exists solely so the unique bucket identity below can never be defeated by SQL''s NULL-is-distinct rule, which would otherwise let every invalid-link request mint a fresh bucket and silently disable the limit. Never written directly.';

comment on table "public"."share_session_grants" is 'Per-link access grants belonging to one browser session. One browser session may hold grants for many independent share links simultaneously, so opening a second shared project never invalidates access to the first, and disabling/rotating/revoking one link invalidates only that link''s grants. Historical revoked grants are preserved: share_session_grants_current_unique_idx permits at most one non-revoked grant per browser session/link while allowing a future exchange transaction to revoke a stale current grant and insert its replacement atomically. Service-role only: RLS enabled with no policies; all positive access is withheld until 202608030005 installs the integrity trigger and final grants.';

comment on column "public"."share_session_grants"."expires_at" is 'Must not exceed the owning browser session''s own expires_at -- enforced by enforce_share_session_grant_integrity (202608030005), because a foreign key cannot express a comparison between two rows.';

comment on column "public"."share_session_grants"."granted_access_epoch" is 'Snapshot of project_share_links.access_epoch at the moment this grant was issued/refreshed. Immutable after insert (enforce_share_session_grant_integrity). A mismatch against the link''s live access_epoch means the link''s secret has been rotated since this grant was issued -- unrecoverable without a fresh secret-based exchange.';

comment on column "public"."share_session_grants"."granted_configuration_version" is 'The project_share_links.configuration_version this grant was issued against. A rotation or configuration change bumps that version, which makes every previously issued grant detectably stale WITHOUT deleting it, so the invalidation is auditable. A read path must compare this against the link''s current configuration_version, never assume it still matches.';

comment on column "public"."share_session_grants"."granted_pin_epoch" is 'Snapshot of project_share_links.pin_epoch at the moment this grant was issued/refreshed. Immutable after insert (enforce_share_session_grant_integrity). A mismatch against the link''s live pin_epoch means the link''s PIN has been added/changed since this grant was issued -- recoverable via POST /api/share/[publicId]/pin (PIN re-verification only), provided granted_access_epoch still matches.';

comment on column "public"."share_session_grants"."pin_verified_at" is 'When the PIN for this link was successfully verified in this browser session. Null means "not verified" -- never "no PIN required"; whether a PIN is required is a property of the link, not of the grant.';

comment on column "public"."share_session_grants"."revoked_at" is 'Set when this specific link''s access is withdrawn from this browser session. Retained rather than deleted so revocation stays auditable, and can never be cleared again (enforce_share_session_grant_integrity). A revoked grant must never be treated as active by any read path.';

comment on column "public"."users"."last_dashboard_seen_at" is 'Owner-analytics only. Timestamp of the most recent dashboard visit, rate-limited to at most once per 4-hour window. Written by public.record_dashboard_visit(), called fire-and-forget from app/api/activity/dashboard-visit/route.ts after the client has already mounted.';

comment on column "public"."users"."last_extract_at" is 'Owner-analytics only. Timestamp of the most recent successful extraction (text or image), for any plan. Written via public.record_successful_extraction() after the response has already been sent.';

comment on column "public"."users"."successful_extract_count" is 'Owner-analytics only. Counts successful text+image extractions for ALL plans (Free and Pro). Written via public.record_successful_extraction() after the extraction response has already been sent. Never used for Free-plan quota enforcement -- that remains driven exclusively by public.users.extract_count, which this column does not modify, rename, or replace.';
