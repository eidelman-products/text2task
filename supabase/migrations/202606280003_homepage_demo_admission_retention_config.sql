-- Text2Task Homepage Demo Admission Retention Config
-- Migration: 202606280003_homepage_demo_admission_retention_config.sql
-- Created: 2026-06-28
--
-- Adds configurable retention policy durations to the existing disabled
-- singleton admission configuration. This migration does not enable the demo
-- and does not add any operational RPC or public access.

alter table public.homepage_demo_admission_config
  add column admission_attempt_retention_seconds integer not null default 172800,
  add column rate_bucket_retention_seconds integer not null default 172800,
  add column capacity_reservation_retention_seconds integer not null default 172800,
  add column cost_accounting_retention_seconds integer not null default 604800;

alter table public.homepage_demo_admission_config
  add constraint homepage_demo_adm_config_attempt_retention_check
    check (admission_attempt_retention_seconds between 3600 and 604800),
  add constraint homepage_demo_adm_config_rate_retention_check
    check (rate_bucket_retention_seconds between 3600 and 604800),
  add constraint homepage_demo_adm_config_capacity_retention_check
    check (capacity_reservation_retention_seconds between 3600 and 604800),
  add constraint homepage_demo_adm_config_cost_retention_check
    check (cost_accounting_retention_seconds between 86400 and 2592000),
  add constraint homepage_demo_adm_config_retention_policy_check
    check (
      capacity_reservation_retention_seconds >= processing_lease_seconds
      and capacity_reservation_retention_seconds <= admission_attempt_retention_seconds
      and cost_accounting_retention_seconds >= admission_attempt_retention_seconds
    );
