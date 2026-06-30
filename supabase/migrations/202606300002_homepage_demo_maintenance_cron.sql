-- Text2Task Homepage Demo Maintenance Cron
-- Migration: 202606300002_homepage_demo_maintenance_cron.sql
-- Created: 2026-06-30
--
-- Runs every 5 minutes to perform bounded Homepage Demo maintenance.
-- Stale processing recovery runs before retention cleanup. This job
-- intentionally continues running even when the public Homepage Demo feature
-- is disabled, and the maintenance RPC returns aggregate counts only.

create extension if not exists pg_cron;

select cron.unschedule(job.jobid)
from cron.job as job
where job.jobname = 'homepage-demo-maintenance-v1';

select cron.schedule(
  'homepage-demo-maintenance-v1',
  '*/5 * * * *',
  $$select * from public.run_homepage_demo_maintenance(1000);$$
);
