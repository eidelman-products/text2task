-- Text2Task Client Share Link -- Owner-Facing Database Foundation
-- Migration: 202608030003_client_share_owner_foundation.sql
-- Created: 2026-08-03
--
-- Purpose:
-- Phase 1A database foundation for the Client Share Link feature (see
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_0_MAPPING_2026-08-03.md and
-- docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_1A_DATABASE_FOUNDATION_REPORT.md).
-- This migration creates ONLY the six owner-facing tables -- the link
-- itself and everything an authenticated owner deliberately curates onto
-- that link -- together with their constraints, indexes, updated_at
-- triggers, RLS policies and explicit least-privilege revokes. Positive
-- table grants are deliberately withheld until
-- 202608030005_client_share_integrity_and_security.sql has installed the
-- relationship-integrity triggers.
--
-- Deliberately NOT in this migration (see the two sibling migrations):
--   202608030004_client_share_session_foundation.sql
--     browser sessions, per-link grants, operational/security events and
--     rate-limit buckets -- all service-role-only, none owner-facing.
--   202608030005_client_share_integrity_and_security.sql
--     the cross-table relationship-integrity trigger functions, which span
--     both of the above and therefore cannot be written until both exist.
--
-- Non-goals of this migration, stated explicitly:
--   - It does not create, alter, drop, reindex or re-grant ANY existing
--     production object. public.projects, public.tasks, public.clients,
--     public.users, public.task_resources, public.project_updates,
--     public.project_update_items, public.project_timeline_events and
--     storage.* are referenced (by foreign key only) and never modified.
--   - It does not touch the two overlapping public.task_resources
--     resource_type CHECK constraints. That existing production-schema
--     inconsistency is documented in the Phase 0 addendum and the Phase 1A
--     report and is mandatory work before Phase 4 Shared Resources; it is
--     deliberately NOT bundled into this feature's migration set.
--   - It creates no public/anonymous surface of any kind. Nothing here is
--     granted to anon, and no policy targets the PostgreSQL PUBLIC role.
--   - It stores no raw share secret, no reversible/encrypted secret copy,
--     no plaintext or reversible PIN, no client email/phone, no internal
--     client notes, no project amount/priority and no raw input.
--
-- Schema-drift posture (fail closed):
-- Every table, constraint and index below is created WITHOUT
-- `if not exists`. If a Client Share object already exists unexpectedly,
-- this migration must fail loudly rather than silently adapt to, adopt or
-- overwrite an object whose columns and constraints were never reviewed.
-- `create or replace function`, `drop trigger if exists` and
-- `drop policy if exists` are used only where they replace an object with
-- exactly the intended definition supplied in full in this file, which is
-- the repository's established convention and does not hide drift.
--
-- Transaction posture:
-- This file contains no explicit `begin;`/`commit;`, matching every one of
-- the 24 existing tracked migrations. Both supported application paths for
-- this repository -- `supabase db push` and manual execution of the whole
-- file in the Supabase SQL editor -- already run the file inside a single
-- transaction, so this migration is applied atomically and fails
-- atomically. Adding a nested `begin;` would emit "there is already a
-- transaction in progress" and the matching `commit;` would close the
-- OUTER transaction early, splitting the file from the applier's own
-- migration-history bookkeeping. See the Phase 1A report, section
-- "Conflicts requiring human decision".
--
-- This migration is inert until Client Share application code is written,
-- pushed and deployed. Applying it changes no production row and no
-- existing production behaviour. It also leaves the new tables inaccessible
-- until the integrity triggers and final grants are installed by
-- 202608030005.

-- =========================================================
-- 1. public.project_share_links
--
-- One owner-controlled share link attached to one existing project.
--
-- Multiple links per project are supported STRUCTURALLY from day one:
-- there is deliberately NO unique constraint on project_id and NO partial
-- unique index restricted to state = 'active'. The V1 product rule of
-- "one active link per project" is a product rule, and it will be enforced
-- transactionally by a future locked owner RPC / server operation, never by
-- a schema restriction that a later multi-link product version would have
-- to destructively migrate away from. This is a locked Phase 1A decision
-- and it supersedes the partial-unique-index recommendation in section
-- 17.2 of the Phase 0 mapping.
--
-- The `state` vocabulary is deliberately five values, not six: rotation
-- does not move a link out of 'active'. A rotated link keeps serving the
-- same curated content under a new secret, so rotation is recorded by
-- rotated_at plus a configuration_version bump (which is what invalidates
-- existing per-link grants), not by a distinct state. Making 'rotated' a
-- state would make every read-time "is this link active" predicate wrong
-- immediately after a rotation. This supersedes the six-value vocabulary
-- suggested in section 17.2 of the Phase 0 mapping.
-- =========================================================

create table public.project_share_links (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  public_id text not null,

  secret_digest text null,
  secret_digest_version smallint null,

  state text not null default 'draft',

  expires_at timestamptz null,
  comments_enabled boolean not null default false,
  client_facing_subtitle text null,
  content_direction text not null default 'auto',
  configuration_version integer not null default 1,

  last_viewed_at timestamptz null,
  view_count integer not null default 0,

  pin_hash text null,
  pin_salt text null,
  pin_hash_version smallint null,
  pin_scrypt_n integer null,
  pin_scrypt_r integer null,
  pin_scrypt_p integer null,
  pin_key_length integer null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz null,
  disabled_at timestamptz null,
  rotated_at timestamptz null,
  revoked_at timestamptz null,

  constraint project_share_links_public_id_unique
    unique (public_id),

  -- Opaque, URL-safe, bounded. Never derived from project/client/user data.
  constraint project_share_links_public_id_format_check
    check (public_id ~ '^[A-Za-z0-9_-]{16,64}$'),

  -- Lowercase hex of a keyed HMAC-SHA256 digest. The raw share secret is
  -- never stored in any form, so this column is the ONLY persisted
  -- representation of it and cannot be reversed to recover a lost URL.
  constraint project_share_links_secret_digest_format_check
    check (secret_digest is null or secret_digest ~ '^[0-9a-f]{64}$'),

  -- A secret may be absent ONLY in the pre-generation 'draft' state; every
  -- other state requires a complete, versioned digest. This is what makes
  -- "nullable only if a true draft state exists" true at the database
  -- layer rather than by convention.
  constraint project_share_links_secret_digest_consistency_check
    check (
      (
        secret_digest is null
        and secret_digest_version is null
        and state = 'draft'
      )
      or (
        secret_digest is not null
        and secret_digest_version is not null
        and secret_digest_version > 0
      )
    ),

  constraint project_share_links_state_check
    check (state in ('draft', 'active', 'disabled', 'expired', 'revoked')),

  constraint project_share_links_content_direction_check
    check (content_direction in ('auto', 'ltr', 'rtl')),

  constraint project_share_links_configuration_version_check
    check (configuration_version > 0),

  constraint project_share_links_view_count_check
    check (view_count >= 0),

  constraint project_share_links_client_facing_subtitle_check
    check (
      client_facing_subtitle is null
      or (
        char_length(btrim(client_facing_subtitle)) >= 1
        and char_length(client_facing_subtitle) <= 200
      )
    ),

  -- Lifecycle timestamps can never predate the row, and an expiry can
  -- never be at or before creation.
  constraint project_share_links_timestamp_order_check
    check (
      (activated_at is null or activated_at >= created_at)
      and (disabled_at is null or disabled_at >= created_at)
      and (rotated_at is null or rotated_at >= created_at)
      and (revoked_at is null or revoked_at >= created_at)
      and (last_viewed_at is null or last_viewed_at >= created_at)
      and (expires_at is null or expires_at > created_at)
    ),

  -- Each state carries the lifecycle evidence that state implies. A
  -- previously-disabled link that is re-enabled keeps its disabled_at, so
  -- the 'active' branch deliberately does not forbid a set disabled_at.
  constraint project_share_links_state_lifecycle_check
    check (
      (
        state = 'draft'
        and activated_at is null
        and disabled_at is null
        and revoked_at is null
      )
      or (
        state = 'active'
        and activated_at is not null
        and revoked_at is null
      )
      or (
        state = 'disabled'
        and activated_at is not null
        and disabled_at is not null
        and revoked_at is null
      )
      or (
        state = 'expired'
        and activated_at is not null
        and expires_at is not null
        and revoked_at is null
      )
      or (
        state = 'revoked'
        and revoked_at is not null
      )
    ),

  -- PIN storage is designed for Node crypto.scrypt (Phase 1B+). Explicit
  -- versioned columns rather than an unstructured JSON escape hatch, so
  -- every parameter is individually constrained here and a future cost
  -- increase is a visible schema-level fact, not a silent JSON change.
  -- The fields are either ALL absent or ALL present. Version 1 is a
  -- reviewed fixed profile; a stronger profile must arrive as a new
  -- pin_hash_version in a reviewed migration rather than broad
  -- owner-controlled work-factor ranges.
  constraint project_share_links_pin_completeness_check
    check (
      (
        pin_hash is null
        and pin_salt is null
        and pin_hash_version is null
        and pin_scrypt_n is null
        and pin_scrypt_r is null
        and pin_scrypt_p is null
        and pin_key_length is null
      )
      or (
        pin_hash is not null
        and pin_salt is not null
        and pin_hash_version = 1
        and pin_hash ~ '^[A-Za-z0-9_-]+$'
        and char_length(pin_hash) = 43
        and pin_scrypt_n = 16384
        and pin_scrypt_r = 8
        and pin_scrypt_p = 1
        and pin_key_length = 32
      )
    ),

  -- Both PIN fields are base64url-encoded derived material, never a
  -- plaintext or reversible PIN value, and never a bare SHA-256 of one.
  --
  -- Length is checked with explicit char_length(...) between bounds rather
  -- than a regex repetition count: PostgreSQL's regex engine only supports
  -- repetition bounds up to 255 (SQLSTATE 2201B, "invalid repetition
  -- count(s)", is raised at evaluation time for any bound above that,
  -- including the upper bound of {32,512} this constraint previously
  -- used), so an upper bound of 512 can never be expressed as a regex
  -- bound. The regex itself is retained, anchored and unbounded
  -- (`^[A-Za-z0-9_-]+$`), solely to restrict the character set.
  constraint project_share_links_pin_encoding_check
    check (
      (
        pin_hash is null
        or (
          char_length(pin_hash) between 32 and 512
          and pin_hash ~ '^[A-Za-z0-9_-]+$'
        )
      )
      and (
        pin_salt is null
        or (
          char_length(pin_salt) between 16 and 128
          and pin_salt ~ '^[A-Za-z0-9_-]+$'
        )
      )
    )
);

comment on table public.project_share_links is
  'Owner-controlled Client Share links. Multiple links per project are structurally supported by design: there is deliberately no unique constraint on project_id and no partial unique index on state = ''active''. The V1 one-active-link-per-project product rule is enforced transactionally by a future owner RPC / server operation, never by schema. Never stores a raw or reversible share secret, a plaintext or reversible PIN, a client email/phone, internal client notes, a project amount/priority, or raw input.';

comment on column public.project_share_links.public_id is
  'Opaque, URL-safe public identifier used as the /share/<public_id> path segment. Never derived from project, client or user data, and never a database id. Knowing it alone grants nothing -- it only selects which row a supplied share secret is verified against.';

comment on column public.project_share_links.secret_digest is
  'Lowercase hex keyed HMAC-SHA256 digest of the share secret, computed with a dedicated versioned server secret of at least 32 random bytes. The raw secret is NEVER stored, and no reversible or encrypted copy is stored in V1: a lost share URL is recovered only by rotating the secret and issuing a new URL. Nullable only in the pre-generation ''draft'' state, which project_share_links_secret_digest_consistency_check enforces.';

comment on column public.project_share_links.secret_digest_version is
  'Version of the HMAC key/derivation used for secret_digest, so the server secret can be rotated without invalidating every existing link at once. Required whenever secret_digest is present.';

comment on column public.project_share_links.state is
  'Closed vocabulary: draft, active, disabled, expired, revoked. Rotation deliberately does NOT appear here -- a rotated link stays ''active'' under a new secret, and rotation is recorded by rotated_at plus a configuration_version bump that invalidates existing per-link grants. Read-time checks must always re-verify state, expires_at and the project''s own deleted_at; this column is never the only defence.';

comment on column public.project_share_links.configuration_version is
  'Monotonically increasing version of what this link exposes. A rotation, a disable, comments-enabled changes, or any future curated task/resource/update-set mutation must happen through a transactional owner operation that locks this row and increments this value exactly once before commit. Every share_session_grants row records the version it was granted against, so stale grants are detectable without deleting audit history.';

comment on column public.project_share_links.comments_enabled is
  'Defaults to false: client commenting is opt-in per link, so a link created before the owner has considered the question can never silently accept public writes.';

comment on column public.project_share_links.client_facing_subtitle is
  'Optional owner-authored text shown to the client. Deliberately NOT public.clients.contact_name, .phone, .email or .notes -- no client contact detail is ever copied onto a share link.';

comment on column public.project_share_links.content_direction is
  'Closed vocabulary: auto, ltr, rtl. Per-link text direction for the future public page, chosen because the repository has no i18n framework and no locale detection; ''auto'' means the renderer applies a first-strong-character heuristic.';

comment on column public.project_share_links.pin_hash is
  'Unpadded base64url-encoded derived key from Node crypto.scrypt over the human-entered PIN, using pin_salt and the exact reviewed pin_hash_version 1 profile recorded alongside it: N=16384, r=8, p=1, key_length=32. Version 1 stores a 32-byte derived key as exactly 43 base64url characters. Never a plaintext PIN, never a reversible encoding, and never a bare SHA-256 -- a 4-6 digit PIN is trivially brute-forced against an unsalted fast hash. All PIN columns are either entirely absent or complete and internally consistent (project_share_links_pin_completeness_check).';

comment on column public.project_share_links.pin_salt is
  'Base64url-encoded per-row random salt for pin_hash. Never reused across links and never derived from the PIN, the link, the project or the owner.';

comment on column public.project_share_links.pin_hash_version is
  'Version identifier for the PIN hashing scheme. Version 1 is the reviewed fixed scrypt profile N=16384, r=8, p=1, key_length=32; a future stronger profile requires a new pin_hash_version introduced by a reviewed migration.';

comment on column public.project_share_links.view_count is
  'Non-negative count of public views. Incremented only by the future public projection path; an owner preview must never increment it.';

-- ---------------------------------------------------------
-- Indexes: project_share_links
--
-- Deliberate, one intended query each. No index restricts multiple active
-- links per project, and none duplicates the public_id unique constraint.
--
-- There is deliberately NO index on secret_digest: verification always
-- resolves the row by public_id first and then constant-time compares the
-- digest in server code, so an index on secret_digest would have no query
-- path at all.
-- ---------------------------------------------------------

-- Owner's share-management view for one project ("show me this project's
-- links"), and the ownership pre-check every owner operation performs.
create index project_share_links_user_id_project_id_idx
  on public.project_share_links (user_id, project_id);

-- Owner-wide filtering by lifecycle state ("all my active links"), used by
-- the future management surface and by owner-side counters.
create index project_share_links_user_id_state_idx
  on public.project_share_links (user_id, state);

-- Future expiry sweep that flips still-active but elapsed links to
-- 'expired' and emits a link_expired event. Partial, because a sweep only
-- ever considers active links that actually carry an expiry.
create index project_share_links_expiry_sweep_idx
  on public.project_share_links (expires_at)
  where state = 'active' and expires_at is not null;

-- =========================================================
-- 2. public.share_link_tasks
--
-- The explicit, owner-curated list of subtasks visible through one link.
-- It records only WHICH subtask is visible and HOW it is presented. No
-- task title, status, deadline, amount, priority, raw input, source or
-- client information is copied here -- public.tasks stays the single
-- authoritative source and the public projection reads it at request time.
-- =========================================================

create table public.share_link_tasks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  share_link_id uuid not null
    references public.project_share_links(id) on delete cascade,
  subtask_id bigint not null references public.tasks(id) on delete cascade,

  public_group text not null,
  waiting_for_client_feedback boolean not null default false,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint share_link_tasks_share_link_id_subtask_id_unique
    unique (share_link_id, subtask_id),

  constraint share_link_tasks_public_group_check
    check (
      public_group in (
        'in_progress',
        'waiting_for_feedback',
        'completed',
        'coming_up'
      )
    ),

  constraint share_link_tasks_display_order_check
    check (display_order >= 0)
);

comment on table public.share_link_tasks is
  'Explicit owner-curated list of subtasks visible through one share link. Stores only which subtask is visible and how it is presented -- never a copy of task_title, status, deadline, amount, priority, raw_input, source or client information. Cross-owner and cross-project mappings are rejected at the database layer by enforce_share_link_task_integrity (202608030005).';

comment on column public.share_link_tasks.subtask_id is
  'bigint, matching public.tasks.id (the legacy bigint primary key), not uuid. on delete cascade so a hard-deleted task can never remain publicly mapped; note that this repository soft-deletes tasks, so the public projection must ALSO filter tasks.deleted_at is null and tasks.is_archived at read time -- the cascade is a backstop, never the only defence.';

comment on column public.share_link_tasks.public_group is
  'Closed client-facing vocabulary: in_progress, waiting_for_feedback, completed, coming_up. Deliberately NOT the internal status vocabulary (New/In Progress/Review/Urgent/Done) -- ''Urgent'' must never be surfaced publicly, and the internal vocabulary must be free to change without changing what a client sees.';

comment on column public.share_link_tasks.waiting_for_client_feedback is
  'A share-layer presentation flag only. It never reads from, and never writes to, public.tasks.status.';

-- Primary read: one link's curated task list in the owner-chosen order.
create index share_link_tasks_share_link_id_display_order_idx
  on public.share_link_tasks (share_link_id, display_order);

-- Supports the subtask_id FK's cascade and the future "is this subtask
-- shared anywhere?" owner check; without it both are a sequential scan.
create index share_link_tasks_subtask_id_idx
  on public.share_link_tasks (subtask_id);

-- =========================================================
-- 3. public.share_link_resources
--
-- The explicit, owner-curated list of Resources visible through one link.
-- storage_path, file_name, url, mime_type, size_bytes and the internal
-- notes field are deliberately absent: the private task-resources bucket
-- is never exposed or altered, and a public file request resolves a
-- short-lived signed URL server-side at request time instead.
-- =========================================================

create table public.share_link_resources (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  share_link_id uuid not null
    references public.project_share_links(id) on delete cascade,
  resource_id uuid not null
    references public.task_resources(id) on delete cascade,

  public_label text not null,
  can_download boolean not null default false,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint share_link_resources_share_link_id_resource_id_unique
    unique (share_link_id, resource_id),

  constraint share_link_resources_public_label_check
    check (
      char_length(btrim(public_label)) >= 1
      and char_length(public_label) <= 120
    ),

  constraint share_link_resources_display_order_check
    check (display_order >= 0)
);

comment on table public.share_link_resources is
  'Explicit owner-curated list of Resources visible through one share link. Deliberately stores no storage_path, file_name, url, mime_type, size_bytes or copy of task_resources.notes. The task-resources bucket stays private and is neither exposed nor altered by this feature; public file access resolves a short-lived signed URL server-side per request. Cross-owner and cross-project mappings are rejected by enforce_share_link_resource_integrity (202608030005).';

comment on column public.share_link_resources.public_label is
  'Owner-authored client-facing label. Deliberately a separate column and never task_resources.notes, which is an internal field.';

comment on column public.share_link_resources.resource_id is
  'on delete cascade: public.task_resources rows are HARD deleted by the existing Resources API, so deleting a Resource automatically and immediately revokes client access to it. Already-issued signed URLs still survive until their own short TTL elapses -- that residual window is inherent to signed URLs and is documented in the Phase 1A report.';

comment on column public.share_link_resources.can_download is
  'Defaults to false: download is opt-in per shared Resource, so a Resource shared for viewing can never become downloadable by omission.';

-- Primary read: one link's curated Resource list in the owner-chosen order.
create index share_link_resources_share_link_id_display_order_idx
  on public.share_link_resources (share_link_id, display_order);

-- Supports the resource_id FK's cascade, which fires on every real
-- Resource deletion (Resources are hard deleted in this repository).
create index share_link_resources_resource_id_idx
  on public.share_link_resources (resource_id);

-- =========================================================
-- 4. public.share_link_updates
--
-- Versioned, deliberately published client-facing update text. This is NOT
-- public.project_updates: no raw_input, no ai_summary, no extracted facts,
-- no internal review data and no timeline data ever reaches this table.
-- Published versions are immutable history; publishing writes a NEW row
-- and flips is_current, which is why there is no updated_at column here.
-- =========================================================

create table public.share_link_updates (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  share_link_id uuid not null
    references public.project_share_links(id) on delete cascade,

  body text not null,
  version integer not null,
  published_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  is_current boolean not null default false,

  created_at timestamptz not null default now(),

  constraint share_link_updates_share_link_id_version_unique
    unique (share_link_id, version),

  constraint share_link_updates_version_check
    check (version > 0),

  constraint share_link_updates_body_check
    check (
      char_length(btrim(body)) >= 1
      and char_length(body) <= 5000
    ),

  constraint share_link_updates_published_at_check
    check (published_at >= created_at)
);

comment on table public.share_link_updates is
  'Versioned, deliberately published client-facing update text for one share link. Never a copy of project_updates.raw_input, project_updates.ai_summary, Client Update facts, internal review data or internal timeline data. Published rows are immutable history -- body, version, published_at and share_link_id cannot be changed after insert (enforce_share_link_update_integrity, 202608030005); publishing a revision inserts a new version and flips is_current.';

comment on column public.share_link_updates.body is
  'Owner-authored client-facing text, immutable once published. Rendered as a text node only -- never as HTML or Markdown with execution semantics.';

comment on column public.share_link_updates.is_current is
  'At most one current version per share link, enforced by the partial unique index below. That restriction is about update versions and has nothing to do with how many links may be active for a project.';

comment on column public.share_link_updates.created_by is
  'The authenticated owner who published this client-facing update. NOT NULL and on delete cascade, matching the single-owner architecture: created_by must equal user_id (enforce_share_link_update_integrity, 202608030005), and deleting the owning account already cascades the owning share link and all update rows.';

-- At most one current published version per link. This is a deliberate
-- partial unique index over update versions -- it is NOT, and must never be
-- confused with, a one-active-link-per-project restriction.
create unique index share_link_updates_current_version_unique_idx
  on public.share_link_updates (share_link_id)
  where is_current;

-- No separate (share_link_id, version) index: the unique constraint above
-- already provides one, and a duplicate would be pure write overhead.

-- =========================================================
-- 5. public.share_messages
--
-- Client comments and owner replies, in a communication stream that is
-- completely and permanently separate from public.project_timeline_events.
-- There is deliberately no foreign key, no trigger and no other structural
-- relationship from this table to the professional project timeline, and
-- no trigger anywhere that mutates projects, tasks, clients, Resources or
-- deadlines when a message is written.
-- =========================================================

create table public.share_messages (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  share_link_id uuid not null
    references public.project_share_links(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  author_type text not null,
  author_display_name text null,
  body text not null,
  parent_id uuid null references public.share_messages(id) on delete cascade,

  is_visible_to_client boolean not null default true,
  status text not null default 'new',
  reviewed_at timestamptz null,
  resolved_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint share_messages_author_type_check
    check (author_type in ('client', 'owner')),

  constraint share_messages_author_display_name_check
    check (
      author_display_name is null
      or (
        char_length(btrim(author_display_name)) >= 1
        and char_length(author_display_name) <= 80
      )
    ),

  constraint share_messages_body_check
    check (
      char_length(btrim(body)) >= 1
      and char_length(body) <= 4000
    ),

  constraint share_messages_status_check
    check (
      status in ('new', 'reviewed', 'resolved', 'dismissed', 'converted')
    ),

  constraint share_messages_status_timestamps_check
    check (
      (reviewed_at is null or reviewed_at >= created_at)
      and (resolved_at is null or resolved_at >= created_at)
      and (
        status = 'new'
        or reviewed_at is not null
      )
      and (
        status <> 'resolved'
        or resolved_at is not null
      )
    ),

  constraint share_messages_no_self_parent_check
    check (parent_id is null or parent_id <> id)
);

comment on table public.share_messages is
  'Client comments and owner replies for one share link. Structurally separate from public.project_timeline_events by design: no foreign key, no trigger and no other relationship to it exists, and no trigger on this table mutates projects, tasks, clients, Resources, deadlines, statuses or priorities. Feedback enters the professional work system only when an authenticated owner deliberately sends it through the existing Client Updates analyze/review/apply flow. Deliberately stores no client email, no client phone, no HTML body and no Markdown-execution field.';

comment on column public.share_messages.project_id is
  'Denormalised from the share link, and enforced equal to it by enforce_share_message_integrity (202608030005). Retained deliberately: the owner''s per-project communication panel and unread counter read by (user_id, project_id) across every link on that project, and carrying project_id here keeps those owner queries a single-table read under RLS while giving every read a third defensive predicate.';

comment on column public.share_messages.author_type is
  'Closed vocabulary: client, owner. An ''owner'' row is only accepted when it is written by the authenticated owner themselves (policy plus enforce_share_message_integrity), and a ''client'' row is accepted only from the service_role public path (enforce_share_message_integrity), so neither side can impersonate the other in a client-visible thread.';

comment on column public.share_messages.body is
  'Plain text only, immutable after insert. The original communication record must survive conversion into a Client Update unchanged -- conversion sets status = ''converted'' and writes a share_message_conversions row, and never rewrites or moves this text.';

comment on column public.share_messages.status is
  'Closed vocabulary: new, reviewed, resolved, dismissed, converted. Owner-side review state only; it never affects what the client can read (is_visible_to_client does that) and never triggers any automatic project, task or CRM change.';

comment on column public.share_messages.parent_id is
  'Self-reference for one threaded conversation. A parent from a different share link, or from a different owner, is rejected by enforce_share_message_integrity. on delete cascade so a removed parent never leaves an orphaned reply addressing nothing.';

-- Primary public/owner thread read for one link, oldest first.
create index share_messages_share_link_id_created_at_idx
  on public.share_messages (share_link_id, created_at);

-- Owner's per-project communication panel across every link on a project,
-- newest first.
create index share_messages_user_id_project_id_created_at_idx
  on public.share_messages (user_id, project_id, created_at desc);

-- Unread-client-feedback counter shown on the owner's project surfaces.
-- Partial, because only unreviewed client messages are ever counted.
create index share_messages_unread_client_idx
  on public.share_messages (user_id, share_link_id)
  where status = 'new' and author_type = 'client';

-- Thread expansion for one parent, and support for the self-FK cascade.
create index share_messages_parent_id_idx
  on public.share_messages (parent_id)
  where parent_id is not null;

-- =========================================================
-- 6. public.share_message_conversions
--
-- Traceability AFTER an authenticated owner has deliberately converted a
-- message through the EXISTING Client Updates workflow. Nothing in this
-- migration analyses a message, creates a project update, creates a task,
-- changes a project or task status, or writes a project timeline row --
-- and no trigger that could do any of those is created anywhere in this
-- migration set.
-- =========================================================

create table public.share_message_conversions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null
    references public.share_messages(id) on delete cascade,
  project_update_id uuid null
    references public.project_updates(id) on delete set null,
  target_task_id bigint null references public.tasks(id) on delete set null,
  converted_by uuid not null references auth.users(id) on delete cascade,

  converted_at timestamptz not null default now(),

  -- Idempotency: at most one conversion record per message. A second
  -- conversion attempt fails loudly on this constraint instead of silently
  -- creating a duplicate trail. A composite (message_id,
  -- project_update_id) key was rejected because project_update_id is
  -- nullable, and NULLs compare as distinct by default, so two rows with a
  -- null project_update_id would both be accepted -- exactly the silent
  -- duplicate this constraint exists to prevent.
  constraint share_message_conversions_message_id_unique
    unique (message_id)
);

comment on table public.share_message_conversions is
  'Traceability record written only AFTER an authenticated owner has deliberately converted a client message through the existing Client Updates analyze/review/apply flow. No trigger analyses a message, creates a project update, creates a task, changes a project/task status, or writes to public.project_timeline_events. One conversion per message (share_message_conversions_message_id_unique).';

comment on column public.share_message_conversions.project_update_id is
  'The existing public.project_updates row the owner produced. Nullable so the record can exist for a conversion that produced no applied update; on delete set null so purging an old Client Update never erases the fact that a client message was acted upon.';

comment on column public.share_message_conversions.target_task_id is
  'bigint, matching public.tasks.id. Optional pointer to the specific subtask the conversion targeted; on delete set null so a removed task never erases the conversion record.';

comment on column public.share_message_conversions.converted_by is
  'The authenticated owner who performed the conversion. Enforced equal to user_id and to auth.uid() by enforce_share_message_conversion_integrity (202608030005), so a conversion can never be attributed to someone who did not perform it.';

-- Owner's "what did I convert, and when" audit read.
create index share_message_conversions_user_id_converted_at_idx
  on public.share_message_conversions (user_id, converted_at desc);

-- Supports the project_update_id FK's on delete set null, and the reverse
-- lookup "which client message produced this Client Update?".
create index share_message_conversions_project_update_id_idx
  on public.share_message_conversions (project_update_id)
  where project_update_id is not null;

-- Supports the target_task_id FK's on delete set null.
create index share_message_conversions_target_task_id_idx
  on public.share_message_conversions (target_task_id)
  where target_task_id is not null;

-- =========================================================
-- 7. updated_at trigger
--
-- One feature-scoped helper shared by every Client Share table that has
-- genuinely mutable state, mirroring public.set_homepage_demo_updated_at()
-- (which is shared across nine homepage-demo tables) rather than creating
-- one near-identical function per table. There is no generic
-- public.set_updated_at() in this repository to reuse -- every existing
-- helper is feature-scoped (set_customer_stories_updated_at,
-- set_homepage_demo_updated_at, set_calendar_events_updated_at), and this
-- follows that established convention exactly.
--
-- Deliberately NOT applied to public.share_link_updates or
-- public.share_message_conversions: both are append-only historical
-- records, so an updated_at column on either would be meaningless at best
-- and misleading at worst. Neither table has one.
--
-- Security posture matches set_calendar_events_updated_at (the newest and
-- strictest existing helper): security invoker plus an explicit
-- search_path, never security definer.
-- =========================================================

create or replace function public.set_client_share_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_client_share_updated_at() is
  'Shared updated_at maintenance trigger for Client Share tables with genuinely mutable state. Never applied to append-only tables (share_link_updates, share_message_conversions, share_link_events).';

drop trigger if exists project_share_links_set_updated_at
  on public.project_share_links;

create trigger project_share_links_set_updated_at
before update on public.project_share_links
for each row
execute function public.set_client_share_updated_at();

drop trigger if exists share_link_tasks_set_updated_at
  on public.share_link_tasks;

create trigger share_link_tasks_set_updated_at
before update on public.share_link_tasks
for each row
execute function public.set_client_share_updated_at();

drop trigger if exists share_link_resources_set_updated_at
  on public.share_link_resources;

create trigger share_link_resources_set_updated_at
before update on public.share_link_resources
for each row
execute function public.set_client_share_updated_at();

drop trigger if exists share_messages_set_updated_at
  on public.share_messages;

create trigger share_messages_set_updated_at
before update on public.share_messages
for each row
execute function public.set_client_share_updated_at();

revoke all on function public.set_client_share_updated_at() from public;
revoke all on function public.set_client_share_updated_at() from anon;
revoke all on function public.set_client_share_updated_at() from authenticated;
revoke all on function public.set_client_share_updated_at() from service_role;

-- =========================================================
-- 8. Row Level Security -- owner-facing model
--
-- Every table in this migration is owner-facing, so each gets RLS plus a
-- read policy that EXPLICITLY targets the `authenticated` role.
-- No policy here targets the PostgreSQL PUBLIC role, which is a deliberate
-- tightening over some older tables in this schema whose policies omit the
-- `to` clause and therefore apply to PUBLIC.
--
-- Phase 1A is read-only for authenticated owners at both independent
-- layers: table privileges and RLS policies. Direct owner mutation would
-- bypass the future transactional owner operations that must lock
-- project_share_links, enforce V1 invariants and increment
-- configuration_version exactly once. Phase 1B may add narrow RPC/service
-- operation execution permissions; it must not restore broad direct table
-- DML.
-- =========================================================

alter table public.project_share_links enable row level security;
alter table public.share_link_tasks enable row level security;
alter table public.share_link_resources enable row level security;
alter table public.share_link_updates enable row level security;
alter table public.share_messages enable row level security;
alter table public.share_message_conversions enable row level security;

-- --------------------- project_share_links ---------------------

drop policy if exists "Users can view own project share links"
  on public.project_share_links;

create policy "Users can view own project share links"
  on public.project_share_links
  for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------- share_link_tasks ---------------------

drop policy if exists "Users can view own share link tasks"
  on public.share_link_tasks;

create policy "Users can view own share link tasks"
  on public.share_link_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------- share_link_resources ---------------------

drop policy if exists "Users can view own share link resources"
  on public.share_link_resources;

create policy "Users can view own share link resources"
  on public.share_link_resources
  for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------- share_link_updates ---------------------

drop policy if exists "Users can view own share link updates"
  on public.share_link_updates;

create policy "Users can view own share link updates"
  on public.share_link_updates
  for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------- share_messages ---------------------

drop policy if exists "Users can view own share messages"
  on public.share_messages;

create policy "Users can view own share messages"
  on public.share_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------- share_message_conversions ---------------------

drop policy if exists "Users can view own share message conversions"
  on public.share_message_conversions;

create policy "Users can view own share message conversions"
  on public.share_message_conversions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- =========================================================
-- 9. Grants -- least privilege
--
-- Supabase's default privileges grant broad table access to anon and
-- authenticated for every new table in the public schema, so these
-- explicit revokes are load-bearing, not decorative. Nothing below grants
-- anything to anon anywhere.
--
-- IMPORTANT: this migration intentionally issues NO positive table grant.
-- Migration 003 can commit safely on its own because every new table stays
-- inaccessible after creation. Positive authenticated/service_role grants
-- are issued only by 202608030005, after all relationship-integrity
-- triggers exist, so no committed intermediate state lets an authenticated
-- user insert rows that reference another tenant's project, task or
-- Resource.
-- =========================================================

revoke all on table public.project_share_links from public;
revoke all on table public.project_share_links from anon;
revoke all on table public.project_share_links from authenticated;
revoke all privileges on table public.project_share_links from service_role;

revoke all on table public.share_link_tasks from public;
revoke all on table public.share_link_tasks from anon;
revoke all on table public.share_link_tasks from authenticated;
revoke all privileges on table public.share_link_tasks from service_role;

revoke all on table public.share_link_resources from public;
revoke all on table public.share_link_resources from anon;
revoke all on table public.share_link_resources from authenticated;
revoke all privileges on table public.share_link_resources from service_role;

revoke all on table public.share_link_updates from public;
revoke all on table public.share_link_updates from anon;
revoke all on table public.share_link_updates from authenticated;
revoke all privileges on table public.share_link_updates from service_role;

revoke all on table public.share_messages from public;
revoke all on table public.share_messages from anon;
revoke all on table public.share_messages from authenticated;
revoke all privileges on table public.share_messages from service_role;

revoke all on table public.share_message_conversions from public;
revoke all on table public.share_message_conversions from anon;
revoke all on table public.share_message_conversions from authenticated;
revoke all privileges
  on table public.share_message_conversions
  from service_role;
