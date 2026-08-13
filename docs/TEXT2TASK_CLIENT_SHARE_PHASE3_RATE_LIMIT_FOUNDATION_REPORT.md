# Text2Task — Client Share Link — Phase 3 Rate-Limit Foundation Report

**Narrow, authorized database-foundation correction — now RUNTIME VERIFIED against a disposable Supabase project, including true concurrency. Phase 3 application implementation (session exchange, cookies, grants, the public route, the PIN flow, the projection read, security headers, analytics isolation) remains paused.**

---

## 1. Original blocker

While inspecting Phase 3's requirements, `public.share_rate_limit_buckets` (created by `202608030004_client_share_session_foundation.sql`) was found to have no way to be incremented atomically. That migration's own header comment already anticipated this: *"Enforcement happens inside a future server operation performing an atomic upsert and increment against the unique bucket key below — never in application memory."* No such operation had ever been built. A prior turn reported this as `PHASE 3 STATUS: BLOCKED — MIGRATION/ARCHITECTURE AUTHORIZATION REQUIRED` and stopped before writing any SQL. The user has now explicitly authorized creating one narrow, additive migration to close exactly this gap — nothing else.

## 2. Why an application-only increment is unsafe

Every Supabase JS/PostgREST call is its own transaction; a client-side "SELECT `request_count`, then UPDATE to `request_count + 1`" is two separate round trips with no lock held between them. Under concurrent requests — precisely the burst scenario rate limiting exists to survive — two callers can both read the same count and both write `count + 1`, permanently losing an increment and letting the true attempt count silently exceed the configured limit. This repository already has an established precedent for solving exactly this class of problem correctly: `202606280004_homepage_demo_admission_rpc.sql` performs `insert ... on conflict do update set request_count = bucket.request_count + 1 ... returning bucket.request_count` for the unrelated homepage-demo-admission tables. This migration follows that same established atomic-upsert idiom for `public.share_rate_limit_buckets` specifically.

## 3. Exact RPC signature

```sql
public.increment_share_rate_limit_bucket(
  p_scope text,
  p_action text,
  p_identity_digest text,
  p_identity_digest_version smallint,
  p_share_link_id uuid,
  p_window_seconds integer
) returns jsonb
```

## 4. Exact underlying SQL types reused

Every parameter type was taken directly from `public.share_rate_limit_buckets`' own column definitions (202608030004), never re-derived: `identity_digest text`, `identity_digest_version smallint`, `share_link_id uuid`, `window_seconds integer`. `scope`/`action` are plain `text`, matching the table's own columns (their vocabularies are closed by `CHECK` constraints, not by a SQL enum type — this migration validates against those exact same constraint vocabularies rather than declaring a new one).

## 5. Atomic conflict key

```sql
insert into public.share_rate_limit_buckets (...)
values (...)
on conflict on constraint share_rate_limit_buckets_identity_unique
do update set
  request_count = public.share_rate_limit_buckets.request_count + 1,
  updated_at = now()
returning public.share_rate_limit_buckets.request_count into v_request_count;
```

The **named existing constraint** (`share_rate_limit_buckets_identity_unique`, over `scope, action, identity_digest, share_link_key, window_start, window_seconds`) is used as the conflict target — never a re-listed column set — so this statement can never silently drift from the table's real bucket identity if that constraint is ever changed. `share_link_key` is the table's own existing generated column (`coalesce(share_link_id::text, '-')`), reused unchanged.

## 6. Window calculation

`window_start` is computed inside the function from a deterministic fixed-window floor of `now()`, never accepted from the caller (no `p_window_start` parameter exists at all):

```sql
v_window_start := to_timestamp(
  floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
);
```

`v_now` is captured once as `now()` (the transaction start time), not `clock_timestamp()`/`statement_timestamp()`: this function issues exactly one `INSERT`, so `window_start` and `expires_at` must derive from the same instant for internal consistency, and each RPC call is its own independent transaction, so `now()` already reflects real wall-clock time at call time. Concurrent calls landing in the same logical window each independently compute the identical floored `window_start`, which is exactly what makes them collide on the same unique bucket key and serialize correctly through `ON CONFLICT`.

## 7. Expiry calculation

```sql
v_expires_at := v_window_start + (p_window_seconds * interval '1 second');
```

No `p_expires_at` parameter exists — the caller cannot supply an arbitrary expiry. This satisfies the table's own `share_rate_limit_buckets_expiry_check` (`expires_at >= window_start + window_seconds * interval '1 second'`) with exact equality.

## 8. Return contract

```json
{
  "requestCount": 3,
  "windowStart": "2026-08-13T00:00:00+00:00",
  "windowSeconds": 60,
  "expiresAt": "2026-08-13T00:01:00+00:00"
}
```

Deliberately small and operational-only. Never returns the identity digest, the share link id, or the bucket's own internal id — the caller already supplied all three. **No `allowed` boolean is returned** — no rate-limit threshold has been decided in this task (see §21), so no threshold comparison belongs in this foundation; the future calling application code compares the returned `requestCount` against its own server-side limit.

## 9. Privilege model

`SECURITY DEFINER` (required — `service_role` is deliberately not given a broad, arithmetic-capable `UPDATE` grant on this table per AGENTS.md rule 21's column-minimal posture; the atomic increment expression can only live inside a function body regardless of `INVOKER`/`DEFINER` choice, since PostgREST cannot express `column = column + 1` through any grant-only configuration), explicit `set search_path = public, pg_temp`, no dynamic SQL anywhere in the body, every table reference fully qualified with `public.`. Revoked from `public`/`anon`/`authenticated`/`service_role`, then granted execute **only to `service_role`** — the first `service_role`-executed `SECURITY DEFINER` RPC in the entire Client Share feature (every other one is `authenticated`-owner-only), since this is the anonymous/public surface's own operation, callable only by trusted server code already holding the service-role key.

## 10. Input validation

Every parameter is validated against `public.share_rate_limit_buckets`' own **existing** `CHECK` constraint vocabularies — never a second, redeclared vocabulary that could silently drift from the table's real one:

| Check | Mirrors |
|---|---|
| `scope` in `('browser_session','network_identity','share_link')` | `share_rate_limit_buckets_scope_check` |
| `action` in the six-value closed set | `share_rate_limit_buckets_action_check` |
| `window_seconds` in `(60, 300, 3600, 86400)` | `share_rate_limit_buckets_window_seconds_check` |
| `identity_digest` matches `^[0-9a-f]{64}$` | `share_rate_limit_buckets_identity_digest_check` |
| `identity_digest_version > 0` | same constraint |
| `scope = 'share_link'` requires `share_link_id is not null` | `share_rate_limit_buckets_share_link_scope_check` |
| `action = 'invalid_link_access'` requires `share_link_id is null` | `share_rate_limit_buckets_invalid_link_action_check` |

Every failure raises a stable `P0001` message before any write is attempted. No existing `CHECK` constraint was weakened, removed, or bypassed.

## 11. Static tests — exact PASS result

```
npx vitest run supabase/migrations/202608130001_client_share_rate_limit_increment.test.ts
```
→ **1 test file passed, 38 tests passed.**

```
npx vitest run supabase/migrations
```
→ **16 test files passed, 952 tests passed** (all prior Client Share and other migration static tests unaffected — no regression).

## 12. TypeScript result

```
npx tsc --noEmit -p tsconfig.json
```
→ **Exit code 0. Zero errors**, across the full repository.

## 13. Disposable runtime package files

`docs/client-share-phase3-rate-limit-runtime/`:

- `00_READ_ME_FIRST.md` — step-by-step instructions.
- `01_CREATE_TEMP_TEST_FIXTURE.sql` — minimal disposable-project fixture (renamed sentinel: `text2task_client_share_phase3_rate_limit_runtime_sentinel` / `DISPOSABLE_PHASE_3_RATE_LIMIT_RUNTIME_TEST_PROJECT`), adapted from the Phase 2B package's own proven fixture.
- `02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql` — **mechanically generated** (not hand-written) by the new generator script, concatenating all ten Client Share migrations verbatim, in order, each with a generated source-path + SHA-256 comment, plus a safety preamble and a final structural verification query.
- `03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql` — hand-authored real-PostgreSQL runtime tests, Sections A–K, covering all ten required SQL/runtime checks plus input-validation fail-closed behavior. Always wrapped in `begin; ... rollback;` — safe to re-run repeatedly.
- `04_CAPTURE_RESULTS.md` — results record, now **RUNTIME VERIFIED** (see §22).
- `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` — explicit non-authorization statement, including that no rate-limit threshold/policy was decided.
- `06_concurrency_runner.mjs` — the true-concurrency proof (see §13 below).
- `MANIFEST.md` — mechanically generated file inventory and SHA-256 hashes.

Generator: `scripts/client-share/build-phase3-rate-limit-runtime-package.ps1` — was **run locally** (pure local file text processing: reads the ten committed migration files, computes SHA-256 hashes, writes the two generated package files) to produce file 02 and `MANIFEST.md` deterministically. This is *not* SQL execution and *not* a Supabase connection — it never touches a database. Its own console output ended with `PACKAGE_VERIFICATION_STATUS: PASS`.

## 14. True concurrency test approach

A single SQL Editor connection executes statements sequentially and can never observe a genuine race, so file 03 alone cannot prove concurrency safety. `06_concurrency_runner.mjs` is a plain Node ESM script (no new dependency — reuses `@supabase/supabase-js`, exactly as `lib/supabase/admin.ts`/`scripts/test-connection.ts` already do) that:

- reads the disposable project's URL and `service_role` key **only** from two dedicated environment variables (`PHASE3_RATE_LIMIT_DISPOSABLE_SUPABASE_URL`, `PHASE3_RATE_LIMIT_DISPOSABLE_SERVICE_ROLE_KEY`) — never from this repo's own `.env.local`, never hard-coded, never logged;
- fires N (default 25, configurable, capped at 500) simultaneous RPC calls at one identical bucket identity via `Promise.allSettled`;
- asserts the N returned `requestCount` values, sorted, form the exact contiguous set `{1..N}` with no duplicate and no gap;
- independently re-reads the persisted row directly from `share_rate_limit_buckets` and asserts `request_count === N`;
- exits nonzero and prints the exact mismatch on any failure, prints no secret ever.

**Executed by the user** against the disposable project, after files 01/02/03 had already succeeded there. Result: `CONCURRENCY_RESULT: PASS`, `N = 25`, no lost increment. Full detail in §22.

## 15. No policy thresholds invented

No requests-per-minute, PIN-attempts-per-window, session-exchange, or projection-read numeric threshold was decided or hard-coded anywhere in the migration, the tests, or the runtime package. `docs/`, `AGENTS.md`, and every prior Client Share constant were inspected; none defines such a threshold. This remains an **open, separate product decision** — see §21.

## 16. No Production/Supabase execution

No SQL was executed by the assistant. No Supabase project (disposable or Production) was connected to. The only command run was the local PowerShell generator (§13), which performs no network I/O.

## 17. Phase 3 application implementation remains paused

No public route, session-exchange endpoint, browser-session cookie code, PIN-flow code, projection-read endpoint, security-header change, or analytics-isolation change was created or modified in this turn. `lib/share/client-share-projection.server.ts`, the Phase 2D Preview route, and every other previously-completed Client Share file are untouched.

## 18. `git diff --check`

→ **Exit code 0.** No whitespace errors. (No tracked file has any diff — every change this turn is a new, untracked file.)

## 19. `git status --short`

```
?? docs/client-share-phase3-rate-limit-runtime/
?? scripts/client-share/build-phase3-rate-limit-runtime-package.ps1
?? supabase/migrations/202608130001_client_share_rate_limit_increment.sql
?? supabase/migrations/202608130001_client_share_rate_limit_increment.test.ts
```

Nothing staged. Nothing outside these four new paths is dirty.

## 20. Confirmation: no existing migration changed

Confirmed by `git status --short` (§19, only untracked additions) and by the new static test suite's own `"historical migrations remain untouched"` assertions. No `alter table`, no `create or replace function` targeting an existing function name, and no `drop` of any kind appears in the new migration.

## 21. Unresolved separate rate-limit threshold/product decision

**Yes, one remains, explicitly out of this task's scope per its own instructions.** This foundation makes atomic counting possible; it does not decide what count is "too many." Before Phase 3 application code can actually enforce a limit, a separate decision is needed for at least:

- `session_exchange` attempts allowed per window (and which window(s): per browser-session, per network-identity, or both, combined per the table's `scope` design).
- `pin_verification` attempts allowed per window before lockout, and what the lockout UX should be.
- `projection_read` / `invalid_link_access` thresholds.

No such thresholds exist in any current doc or constant. This should be resolved as its own explicit decision when Phase 3 application implementation resumes — not invented silently now.

## 22. Runtime evidence (user-run, disposable project)

Full detail recorded in `docs/client-share-phase3-rate-limit-runtime/04_CAPTURE_RESULTS.md`, Run 1. Summary:

- **Disposable project**: `text2task-phase3-rate-limit-runtime-temp`. Production never accessed.
- **File 01**: `fixture_status = READY`.
- **File 02**: every expected structural object reported `found = true`, including `increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)`.
- **File 03 — two harness-only defects found and corrected, migration/RPC never changed**:
  1. First attempt failed with `42883` (function-does-not-exist) before ever entering the RPC — a bare integer literal `1` could not implicitly narrow to the `smallint` parameter `p_identity_digest_version`. Fixed by casting every call site (`1::smallint`/`0::smallint`, plus defensive `null::uuid`), 22 call sites.
  2. Second attempt failed with `P0001: INVALID_RATE_LIMIT_IDENTITY_DIGEST` — the RPC's own validation correctly rejected five positive-path synthetic identities (Sections G–K) whose letters (`g`,`h`,`i`,`j`,`k`) fall outside the required `^[0-9a-f]{64}$` hex alphabet. Fixed by replacing those five with valid deterministic hex tags (`07`,`08`,`09`,`0a`,`0b`); the intentional negative test (`'not-a-valid-hex-digest'`) was left unchanged. A separately-discovered 63-character truncated digest in `06_concurrency_runner.mjs` was also corrected to a construction-guaranteed 64-char value.
  3. **Final corrected run: `total_tests = 23, passed_tests = 23, failed_tests = 0`, `runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS`.** Reached its own trailing `rollback;` — no fixture or test row persists.
- **Concurrency runner**: a pre-flight authenticated read (`AUTH_READ_RESULT: PASS`, 0 existing bucket rows) confirmed the correct disposable project and a clean table. The runner then executed with `N = 25`: returned `requestCount` values, sorted, formed the exact contiguous set `{1..25}` with no duplicate and no gap; the persisted `request_count` read back independently from the table also equaled `25`; final line `CONCURRENCY_RESULT: PASS`, exit code `0`. No lost increment observed under genuine concurrent load.
- Environment variables were cleared from the PowerShell session immediately after the run. No credential, API key, or secret value was recorded anywhere in this repository.
- This runtime evidence changes nothing about §21 (numeric rate-limit thresholds remain an unresolved, separate product decision) or about the previously agreed 7-day browser-session/grant TTL for the later Phase 3 application implementation (unaffected — this foundation touches no session/grant code).

---

# PHASE 3 RATE-LIMIT FOUNDATION STATUS: COMPLETE AND RUNTIME VERIFIED. PRODUCTION APPLICATION REMAINS NOT AUTHORIZED. PHASE 3 APPLICATION IMPLEMENTATION REMAINS PAUSED.
