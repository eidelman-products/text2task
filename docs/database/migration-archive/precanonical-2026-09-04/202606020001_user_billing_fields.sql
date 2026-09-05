-- Add provider billing metadata used by Creem customer portal.
-- This migration is additive only and does not modify existing data.

alter table if exists public.users
  add column if not exists creem_customer_id text,
  add column if not exists creem_subscription_id text,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists billing_updated_at timestamptz,
  add column if not exists subscription_status text,
  add column if not exists pro_started_at timestamptz,
  add column if not exists pro_current_period_end timestamptz;
