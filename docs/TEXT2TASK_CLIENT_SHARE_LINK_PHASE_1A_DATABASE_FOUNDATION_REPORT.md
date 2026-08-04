# Text2Task Client Share Link Phase 1A Database Foundation Report

Date: 2026-08-04

## Verdict

Phase 1A database foundation remains a repository-only review artifact. The final pre-runtime-test schema correction pass has been completed against the untracked migration files, and the targeted static migration tests pass.

The migrations are **not applied**. Runtime database behavior is **not verified**.

## Migration Files

- `supabase/migrations/202608030003_client_share_owner_foundation.sql`
- `supabase/migrations/202608030004_client_share_session_foundation.sql`
- `supabase/migrations/202608030005_client_share_integrity_and_security.sql`

## Test Files

- `supabase/migrations/202608030003_client_share_owner_foundation.test.ts`
- `supabase/migrations/202608030004_client_share_session_foundation.test.ts`
- `supabase/migrations/202608030005_client_share_integrity_and_security.test.ts`

## Scope Completed

The Phase 1A SQL foundation defines owner-facing share-link tables, service-role-only anonymous-session/support tables, relationship-integrity trigger functions, least-privilege grants, RLS posture, indexes, constraints, comments, and static migration tests.

This correction pass specifically fixed the security architecture found during manual review:

- Migration 003 now creates owner-facing tables, policies, constraints, indexes, RLS and helper triggers, but grants no positive table privilege.
- Migration 004 now creates service-role-only session/grant/event/rate-limit tables, RLS and revokes, but grants no positive table privilege.
- Migration 005 now installs every relationship-integrity trigger first, revokes direct trigger-function execution from `public`, `anon`, `authenticated` and `service_role`, and only then applies final table grants.
- Authenticated table access is read-only in Phase 1A. Direct owner INSERT/UPDATE/DELETE table access remains intentionally closed until Phase 1B transactional owner operations exist.
- No committed intermediate migration state exposes tables before their integrity triggers exist.

No application code was implemented.

## Production Status

- Migrations applied: **no**.
- Production data changes: **none**.
- Production data accessed by this work: **no**.
- Runtime database behavior verified: **no**.

The SQL files are review artifacts until the owner manually applies them through the approved production workflow.

## Manual Security Review Findings And Corrections

1. **No insecure intermediate migration state.** Earlier grant placement would have exposed owner-facing tables before cross-table integrity triggers existed. Positive grants are now withheld until migration 005, after trigger installation.
2. **Grant history and reissue.** `share_session_grants` no longer uses a permanent full-pair unique constraint on `(browser_session_id, share_link_id)`. It uses a partial unique index on that pair where `revoked_at is null`, preserving revoked history while allowing a future atomic re-exchange after revocation.
3. **Link lifecycle and configuration version.** `enforce_project_share_link_integrity()` now rejects reassignment of owner/project/public id/created time, configuration-version decreases, view-count decreases, backwards `last_viewed_at`, clearing `revoked_at`, leaving terminal revoked state, security/access changes without a configuration-version increase, and malformed rotations.
4. **FK SET NULL compatibility.** `share_message_conversions_enforce_integrity` is now INSERT-only. Authenticated owners have no conversion UPDATE policy or UPDATE grant, and FK-driven `ON DELETE SET NULL` cleanup of optional `project_update_id` and `target_task_id` remains possible.
5. **Owner cannot impersonate client.** Phase 1A now has no authenticated mutation policy at all. Client-authored messages require the `service_role` execution context in the integrity trigger, and owner-authored messages are reserved for the future transactional owner mutation path.
6. **No feature-owned global extension mutation.** Migration 003 no longer installs `pgcrypto`; Phase 1A does not create, alter or drop extensions.
7. **No speculative trigger-function EXECUTE grants.** Trigger functions are callable only by triggers. Direct `EXECUTE` is revoked from every relevant role, including `service_role`.
8. **No direct authenticated mutation bypass.** Migration 005 grants authenticated owners SELECT only on owner-facing tables. V1 one-active-link enforcement, row locking, configuration-version increments, curated task/resource replacement, publication/current-update changes and conversion state changes must enter through Phase 1B transactional operations.
9. **Configuration-version atomicity.** Future shared task, shared Resource, publication/current-update, security/access and comments-enabled mutations must lock `project_share_links`, verify ownership and project/link state, apply the requested mutation, increment `configuration_version` exactly once, and commit atomically.
10. **Browser-session lifecycle hardening.** `enforce_share_browser_session_integrity()` keeps session digest, digest version, creation time and expiry immutable; `last_seen_at` cannot clear or move backwards; and revocation cannot be cleared or backdated.
11. **Grant-time state/version/PIN checks.** `enforce_share_session_grant_integrity()` now requires a live unrevoked session, active unexpired link, live non-deleted project, exact current link configuration version, bounded grant expiry and PIN verification presence matching the link PIN requirement.
12. **Complete link transition model.** Link state transitions are explicit, active/disabled/expired links cannot return to draft, revoked links remain terminal, and lifecycle timestamps cannot be cleared or moved backwards.
13. **Exact scrypt v1 profile.** PIN hash version 1 requires `N=16384`, `r=8`, `p=1`, `key_length=32`. Stronger profiles require a reviewed migration with a new `pin_hash_version`.
14. **Column-level service-role privileges.** `service_role` can update only `view_count` and `last_viewed_at` on `project_share_links`, and can insert into `share_messages` only through a column whitelist that excludes owner-review lifecycle fields.
15. **Client-comment database eligibility.** Client-authored message inserts require an active, unexpired, comments-enabled link whose project exists and is not soft-deleted. A client reply may reference only a parent message visible to the client.
16. **Client-only conversions.** `share_message_conversions` may reference only client-authored source messages. The trigger still performs no conversion, no message-status update and no CRM/project/task mutation.
17. **Read-only RLS posture.** Migration 003 now defines exactly six authenticated SELECT policies and no authenticated INSERT, UPDATE or DELETE policies.

## Safe Migration Activation Sequence

The intended sequence is:

1. Apply `202608030003_client_share_owner_foundation.sql`. It creates owner-facing objects and leaves them inaccessible.
2. Apply `202608030004_client_share_session_foundation.sql`. It creates service-side objects and leaves them inaccessible.
3. Apply `202608030005_client_share_integrity_and_security.sql`. It creates integrity triggers, hardens trigger-function privileges, repeats table revokes, and then grants final least-privilege access: read-only authenticated owner access plus column-minimal service-role access.

If migration 003 or 004 commits and migration 005 is not applied, the new tables remain revoked from `authenticated`, `anon`, `public` and `service_role`.

## Grant-History And Reissue Model

`share_session_grants` preserves historical revoked grants. At most one current non-revoked grant can exist for a `(browser_session_id, share_link_id)` pair.

A future exchange transaction must lock the current grant for that session/link, mark it revoked or superseded when stale/expired, insert the replacement row, and commit atomically. Clearing `revoked_at` is rejected.

## Runtime Verification Boundary

The current tests are static migration tests only. They validate intended SQL structure but do not prove runtime behavior.

Executable isolated-Supabase integration tests remain mandatory before later phases rely on this schema. They must verify, at minimum:

- RLS and privilege behavior for `anon`, `authenticated`, and `service_role`.
- Constraint enforcement.
- Relationship-integrity trigger firing on insert and update.
- Cross-owner and cross-project rejection paths.
- Service-role-only anonymous session/grant/event/rate-limit access.
- Cascade and `on delete set null` behavior.
- No automatic Client Share message conversion into project, task, CRM, or timeline data.
- Link lifecycle/version rejection paths.
- Authenticated-owner inability to insert client-authored messages.
- Service-role client-message insertion through the intended server path.
- Trigger-function direct execution remains unavailable to user-facing roles and `service_role`.
- Authenticated table privileges are SELECT-only.
- Browser-session identity/expiry and grant identity/version/expiry are immutable.
- Grant creation rejects inactive, expired, revoked or deleted-project links and stale configuration versions.
- PIN-protected links reject unverified grants, while non-PIN links reject unexpected PIN verification timestamps.
- Column-level service-role grants allow only public counters and public client-message input columns.

## Targeted Static Test Result

Command used:

```powershell
npx.cmd vitest run supabase/migrations/202608030003_client_share_owner_foundation.test.ts supabase/migrations/202608030004_client_share_session_foundation.test.ts supabase/migrations/202608030005_client_share_integrity_and_security.test.ts
```

Result:

- Test files: 3 passed.
- Tests: 336 passed.

## Existing Migration Status

No existing tracked historical migration was changed.

The Phase 1A migration SQL files are new untracked repository artifacts and were corrected in place before first application.

## Existing `task_resources` Constraint Conflict

The known overlapping `public.task_resources` `resource_type` CHECK-constraint conflict remains deferred. It must be resolved before Shared Resources work, but it is intentionally not included in Phase 1A.

## Non-Actions

- No SQL was executed.
- No migration was applied.
- No production database was accessed.
- No production data was modified.
- No application code was implemented.
- No build was run.
- Nothing was staged.
- Nothing was committed.
- Nothing was pushed.
