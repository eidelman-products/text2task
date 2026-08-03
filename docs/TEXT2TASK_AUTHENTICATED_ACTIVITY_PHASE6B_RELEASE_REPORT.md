# Text2Task Authenticated Activity Phase 6B Release Report

Date: August 3, 2026

## 1. Exact Pre-Push Verdict

PASS. The authenticated activity rollout is ready for the owner push approval gate.

No SQL was executed by Codex. No migrations were applied by Codex. No Supabase CLI database commands were run. No production deployment was started. The only untracked workspace item is the unrelated `.claude/` directory, which remains untouched.

## 2. Production Database Verification Summary

The owner manually applied and verified both production migrations in the Supabase Production SQL Editor before this Phase 6B report.

Migration 1 production state:

- `public.authenticated_product_events` exists.
- Intended columns, constraints, indexes, and RLS state were verified.
- There are zero user-facing policies.
- `public`, `anon`, and `authenticated` have no table privileges.
- `service_role` has `SELECT` and `INSERT` only.
- `service_role` does not have `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`.
- Table row count is `0`.

Migration 2 production state:

- `public.get_owner_authenticated_activity_summary(uuid[])` exists.
- `public.get_owner_user_activity_timeline(uuid, integer)` exists.
- Both functions return `jsonb`.
- Both functions are `LANGUAGE SQL`.
- Both functions are `STABLE`.
- Both functions are `SECURITY INVOKER`.
- Both functions use `search_path = public`.
- `public`, `anon`, and `authenticated` cannot execute either function.
- `service_role` can execute both functions.
- Israel-time day bucketing, returning-user calculation, deterministic ordering, and timeline limit clamping were verified.
- Empty functional checks returned JSON arrays.
- `authenticated_product_events` row count remained `0`.
- `analytics_events` remained unchanged.

## 3. Git/Remote State

Pre-report verification:

- Current branch: `main`
- `origin/main` was fetched successfully.
- Local branch was ahead of `origin/main` by 9 commits before this report commit.
- `origin/main` was ahead of local `main` by 0 commits.
- No divergence was detected.
- `git diff --check` passed.
- Working tree contained no tracked changes before the report file was created.
- `.claude/` remained untracked and untouched.

## 4. Complete Release Commit List

Commits ready for release before this report commit:

- `7232b4e Add authenticated activity data foundation`
- `89beecb Add authenticated activity tracking endpoint`
- `0d4a4ae Instrument authenticated top-level activity`
- `d629233 Instrument authenticated surface activity`
- `2fa63d0 Show authenticated activity in owner analytics`
- `d51fda5 Correct authenticated activity migration documentation`
- `c8153a7 Enforce least privilege for authenticated activity table`
- `39949a8 Enforce least privilege for authenticated activity RPCs`
- `401166b Clarify authenticated operational activity privacy`

This report is intended to be committed separately as:

- `Document authenticated activity production rollout`

No earlier commit was amended, squashed, rebased, or rewritten.

## 5. Privacy Wording Review

Verdict: PASS after a narrow additive wording correction.

The repository now distinguishes optional anonymous marketing/traffic analytics from minimal authenticated operational product-view records tied to a signed-in account.

The Privacy Policy update states that authenticated operational activity may include product surface viewed, route, safe entity type or ID, and timestamp; that it is used for product operation, support, security, and internal usage understanding; that it is separate from anonymous marketing or traffic analytics; that it is not used for advertising attribution; and that it remains operational if non-essential analytics are rejected.

No consent behavior changed. No data collection behavior changed. No legal conclusion was added.

## 6. Files Changed During Phase 6B

Phase 6B changed:

- `app/privacy/page.tsx`
- `docs/TEXT2TASK_AUTHENTICATED_ACTIVITY_PHASE6B_RELEASE_REPORT.md`

No runtime application behavior was changed during Phase 6B. The privacy file change is a copy-only disclosure clarification.

## 7. Security Review

Verdict: PASS.

Authenticated event creation resolves the user from the authenticated Supabase session. The client cannot supply `userId`, `user_id`, `createdAt`, `idempotencyKey`, `metadata`, or arbitrary fields through the event contract.

The write path is best-effort and does not block product workflows. Insert failures remain invisible to normal product use.

Owner analytics reads remain behind `requireOwner()`. The user timeline route calls `requireOwner()` before using the dynamic user id. Owner/test rows remain hidden by default in the private owner analytics UI.

No product page reads owner analytics.

## 8. Analytics Isolation Review

Verdict: PASS.

Authenticated product events are written only to `public.authenticated_product_events`. The implementation does not write authenticated product events into `public.analytics_events`, product-domain tables, or owner report RPCs.

The existing `record_dashboard_visit` path remains unchanged.

The existing anonymous/marketing analytics table, `public.analytics_events`, remains separate. The authenticated activity migrations do not alter that table.

Non-blocking source review note: `app/api/activity/product-event/route.ts` still contains an old comment saying the route is not yet called from an application page. That comment is stale after the instrumentation commits, but the Phase 6B gate forbids runtime application edits unless required for privacy wording. It was left unchanged because it does not affect schema, runtime behavior, security, or production rollout.

## 9. Test Results

All requested tests passed:

- Phase 1-5 targeted authenticated activity tests: 14 files passed, 251 tests passed.
- Migration test sweep: 6 files passed, 133 tests passed.
- Owner analytics tests: 5 files passed, 36 tests passed.
- Full repository Vitest suite: 93 files passed, 1335 tests passed.

## 10. Type-Check Result

PASS.

Command:

```powershell
npx.cmd tsc --noEmit
```

## 11. ESLint Result

PASS.

Commands:

```powershell
npx.cmd eslint <authenticated activity and privacy files>
npx.cmd eslint .
```

## 12. Build Result

PASS.

Initial sandboxed build failed because Next.js could not fetch the existing Google Fonts resources under restricted network access. No font implementation was changed. The same build command passed after approval for network access.

Command:

```powershell
npm.cmd run build
```

## 13. Confirmation That .claude/ Is Untouched

Confirmed. `.claude/` remains untracked and was not touched, staged, deleted, cleaned, or committed.

## 14. Confirmation That No Migration Was Executed By Codex

Confirmed. Codex did not execute SQL, apply migrations, run Supabase CLI database commands, reconcile remote migration history, or modify Supabase migration-history tables.

## 15. Exact Intended Push Command

```powershell
git push origin main
```

This command must be run only after explicit owner approval. No force push will be used.

## 16. Production Smoke-Test Plan

After Vercel reports a successful production deployment from `main`, use the owner/test account and include owner/test activity in the private analytics UI.

Manual product checks:

1. Open `/dashboard`.
2. Open Extract.
3. Open Tasks.
4. Return to Dashboard.
5. Open `/dashboard/calendar`.
6. Expand one existing project.
7. Open Resources.
8. Open History.
9. Open Add Client Update, but do not submit content.
10. Open one calendar day.
11. Open one existing manual calendar event, if available.

Verify that each primary product surface still works normally.

Then run the owner-controlled read-only production SQL:

```sql
select
  created_at,
  user_id,
  event_name,
  route,
  entity_type,
  entity_id
from public.authenticated_product_events
order by created_at desc
limit 50;
```

Expected:

- Only deliberate owner/test activity from the smoke test.
- Correct authenticated owner/test `user_id`.
- No client content.
- No project title.
- No task text.
- No metadata.
- Correct routes.
- Correct safe entity IDs.

Owner UI checks:

- `/admin/analytics/users` loads.
- Show owner/test accounts reveals the owner/test row.
- Last authenticated activity is correct.
- Last viewed surface is correct.
- Total views is greater than zero.
- Active days is `1` on the first day.
- Returning is false on the first activity day.
- View timeline opens.
- Timeline order is newest first.
- Timestamps display in Israel time.
- Owner/test accounts remain hidden by default.

Do not delete smoke-test activity rows. They are legitimate internal/test activity and remain hidden by default.

## 17. Rollback Plan

Authenticated activity is isolated and supplementary.

If production deployment succeeds but authenticated tracking fails:

- Do not roll back product-domain data.
- Do not drop the analytics table.
- Do not modify `analytics_events`.
- Do not disable normal product workflows.
- Investigate the isolated endpoint/logging path.

If a severe client-side regression is discovered:

- Stop further smoke testing.
- Identify the exact release commit.
- Use a normal forward fix or an explicitly approved revert.
- Do not force push.
- Do not reset production history.
