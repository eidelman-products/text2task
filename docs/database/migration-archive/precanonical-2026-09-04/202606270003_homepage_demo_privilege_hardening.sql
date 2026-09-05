-- Text2Task Homepage Demo Privilege Hardening
-- Migration: 202606270003_homepage_demo_privilege_hardening.sql
-- Created: 2026-06-27
--
-- Reconcile effective Supabase table privileges with the intended
-- service-role-only least-privilege model for homepage demo infrastructure.

revoke all privileges
on table public.homepage_demo_trials
from service_role;

revoke all privileges
on table public.homepage_demo_drafts
from service_role;

grant select, insert, update, delete
on table public.homepage_demo_trials
to service_role;

grant select, insert, update, delete
on table public.homepage_demo_drafts
to service_role;

revoke all privileges
on table public.homepage_demo_trials
from public, anon, authenticated;

revoke all privileges
on table public.homepage_demo_drafts
from public, anon, authenticated;
