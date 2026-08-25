# Client Share Link — Phase 8 Access Epoch Runtime Results

**Status: RUNTIME VERIFICATION ACCEPTED (disposable Postgres), and the
corrective fix has since been PRODUCTION-DEPLOYED AND PRODUCTION-VERIFIED
(2026-08-26) — see the "Production verification addendum" at the bottom
of this document.** This package was executed against a disposable,
non-Production Supabase project across a sequence of runs, each fixing a
harness-only defect found by the previous run's own evidence. The final
SCRIPTED run against the disposable project reported — this is the
historical runtime-script record and is preserved exactly as it
occurred, not restated as a clean pass:

```
total_tests = 139
passed_tests = 138
failed_tests = 1
status = PHASE_8_ACCESS_EPOCH_RUNTIME_FAIL
```

The single failing row (`H9`, Section H) was mechanically classified as a
**harness expectation bug** — not a defect in the migration, any trigger,
or any RPC — and was independently confirmed correct at the database
level by a direct, read-only PostgreSQL catalog query (see "H9
disposition" below). `H9`'s own assertion in
`03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql` has since been corrected to match
the actual intended privilege surface. **This correction has not yet been
re-verified by another scripted run of file 03** — do not read this
document as claiming a subsequent 139/139 script execution occurred. The
disposition below is ACCEPTED on the combined weight of the 138/139
scripted result plus the independent direct-query confirmation of the
one remaining row, not on an unclaimed clean re-run.

Zero implementation or migration defects were found across the entire
runtime verification effort. The original Production same-browser
Disable→Re-enable regression (Runtime Requirement B) is runtime-proven
fixed.

## Run log

| Run | Outcome | Notes |
|---|---|---|
| 1–N | Sequence of harness-only failures, each diagnosed and fixed | See `git` history / prior conversation record for the full sequence — schema-dependency gaps, timestamp-order fixture errors, privilege-grant gaps, RPC smallint-overload mismatches, fixture-uniqueness collisions, Section F's `now()`/`clock_timestamp()` and `configuration_version`/trigger semantics, Section C's wrong `configuration_version` expectations, Section H's `information_schema` domain-type array comparison, Section I's `public_id` length typo, Section J1's comment-vs-executable-logic false positive |
| Final scripted run | `total_tests=139, passed_tests=138, failed_tests=1, status=PHASE_8_ACCESS_EPOCH_RUNTIME_FAIL` | Sole failure: `H9` (Section H) |
| Direct read-only catalog query (same disposable project) | Confirmed `H9`'s underlying database state was correct | See below |

### Final scripted run — sole failure

```
seq    = (H9's row)
section = H
name    = "authenticated's grant on the base-table stand-ins is exactly
           {projects,tasks}.{INSERT,UPDATE,DELETE} +
           task_resources.{INSERT,UPDATE} -- no broader"
status  = FAIL
```

### H9 disposition — HARNESS_EXPECTATION_BUG, independently confirmed

A direct, read-only PostgreSQL catalog query was run against the same
disposable project (no write, no state change):

```sql
select
  table_name::text as table_name,
  array_agg(privilege_type::text order by privilege_type::text) as privileges
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in ('projects', 'tasks', 'task_resources', 'clients')
group by table_name
order by table_name;
```

Actual result:

```
clients:         SELECT
projects:        DELETE, INSERT, SELECT, UPDATE
task_resources:  INSERT, SELECT, UPDATE
tasks:            DELETE, INSERT, SELECT, UPDATE
```

This is exactly the intended, correct effective privilege surface:
`01_PREPARE_RUNTIME_FIXTURES.sql` intentionally grants `authenticated`
`SELECT` on all four base-table stand-ins (needed for owner-scoped RLS
reads to work at all), and `01B_GRANT_AUTHENTICATED_MUTATION_PRIVILEGES.sql`
separately adds the evidenced mutation privileges. `H9`'s own expected
array had only ever included the mutation subset, so it flagged the
already-intended `SELECT` grant as unexpected "broader" access — a wrong
expectation, not a real over-grant. No anon grant, no `clients` mutation
grant, and no `task_resources` `DELETE` were ever present at any point.

`H9`'s assertion has been corrected in
`03_RUN_ACCESS_EPOCH_RUNTIME_TESTS.sql` to require the complete union
(`projects`/`tasks`: `SELECT,INSERT,UPDATE,DELETE`; `task_resources`:
`SELECT,INSERT,UPDATE`) and still fails on any privilege beyond that
exact set. Static regression coverage was added
(`scripts/client-share/build-phase8-access-epoch-runtime-package.test.ts`)
re-deriving the expected surface from both source files independently, so
this cannot silently regress back to the mutation-only shape.

## Security-critical behaviors proven PASS (across the run sequence)

- Same-browser Disable → Re-enable recovery (the exact original
  Production regression) — **PASS**
- Configuration/settings authorization continuity (all nine sub-scenarios,
  C1–C9 — including the security-relevant "existing grant remains
  authorized" assertion for every one) — **PASS**
- `access_epoch` / `pin_epoch` backfill — **PASS**
- Secret rotation invalidates old grant — **PASS**
- PIN recovery cannot cross an `access_epoch` mismatch — **PASS**
- PIN change / reverification — **PASS**
- Expiry live-check behavior (link expiry and session TTL, independently
  enforced) — **PASS**
- Revoke is unconditionally terminal — **PASS**
- RLS remains enabled; anon has no privilege of any kind on
  `project_share_links`/`share_session_grants`; `authenticated` has only
  `SELECT` on `project_share_links` — **PASS**
- No epoch is ever client-controllable; only the intended RPC
  self-increments each epoch — **PASS**
- The live, installed function catalog genuinely contains the new
  `access_epoch`/`pin_epoch` logic (Section J) — **PASS**

## Notes

- No Production project was touched by any file in this package, at any
  point, regardless of outcome.
- This disposition authorizes proceeding to the Production rollout steps
  documented in the implementation report and rollout plan — it does not
  itself perform a commit, push, or deploy.

## Production verification addendum (2026-08-26)

**The disposable-runtime record above (138/139 scripted, `H9` harness bug,
independent direct-query confirmation) is preserved exactly as it
occurred and is not restated here as a clean pass.** Separately, and
subsequently, the corrective migration this package verifies
(`202608250001_client_share_access_epoch.sql`, SHA-256
`dbc8af2f6581abb8c4dcbe74d8a94ddce46a26854491d24d579d9e6302a2be4e`) was
committed (`fa86c99`), pushed to `origin/main`, deployed to Production via
Vercel, and applied to the real Production database. The exact original
Production regression this whole engagement exists to fix — same-browser
Disable → Re-enable — was then re-run live in Production: fresh Incognito
load (PASS) → Disable denies the same session (PASS) → Re-enable, same
tab, same URL, no new browser or secret exchange, restores access (PASS).

This is a genuinely separate verification event from the disposable-
Postgres runtime package this document otherwise records — it is real
Production, not a disposable instance, and it exercises the live HTTP/UI
path end-to-end rather than this package's own SQL-level RPC calls. Full
detail: `docs/TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md`
§14 and `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_8_AUDIT_AND_ROLLOUT_PLAN_2026-08-24.md`'s
own `ROLLOUT_STATUS` banner and §25 blocker-table row.
