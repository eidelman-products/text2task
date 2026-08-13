# Client Share Link — Phase 3 Rate-Limit Foundation Runtime Results

**Runtime verification is COMPLETE: Run 1 below is the final, authoritative
result — SQL runtime `total_tests = 23, passed_tests = 23, failed_tests = 0`
(`runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS`), plus a true-concurrency
run (`N = 25`) reporting `CONCURRENCY_RESULT: PASS` with no lost increments.**
Production was never accessed at any point, and Production application
remains NOT AUTHORIZED regardless of this result — see
`05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`. This result also does not
authorize resuming Phase 3 application implementation (session exchange,
cookies, grants, the public route, the PIN flow, the projection read,
security headers, analytics isolation) — that remains paused.

## Run log

| Run | Project | File 01 | File 02 | File 03 | Concurrency runner | Outcome |
|---|---|---|---|---|---|---|
| 1 | `text2task-phase3-rate-limit-runtime-temp` (disposable) | Succeeded | Succeeded | Failed twice on harness-only defects, corrected, re-run to completion | Succeeded (`N=25`) | `PHASE_3_RATE_LIMIT_RUNTIME_PASS` (23/23) + `CONCURRENCY_RESULT: PASS` |

## Run 1 — current, authoritative

Disposable Supabase project `text2task-phase3-rate-limit-runtime-temp`,
created solely for this Phase 3 rate-limit foundation runtime verification.
Confirmed **not** the Text2Task production project.

### Result from file 01 (`01_CREATE_TEMP_TEST_FIXTURE.sql`)

- Status: ☑ Succeeded ☐ Errored
- `fixture_status` value: `READY`

### Result from file 02 (`02_APPLY_CLIENT_SHARE_THROUGH_PHASE3_RATE_LIMIT.sql`)

- Status: ☑ Succeeded ☐ Errored
- Final verification table: all rows `found = true`? ☑ Yes ☐ No — every
  expected structural object reported `found = true`, including
  `increment_share_rate_limit_bucket(text,text,text,smallint,uuid,integer)`.

### Result from file 03 (`03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql`)

**Two harness-only defects were found and corrected before the final passing run. The migration and the RPC itself were never changed at any point.**

**First attempt: FAILED before entering the RPC body.**
- Error: `ERROR: 42883: function public.increment_share_rate_limit_bucket(unknown,unknown,text,integer,unknown,integer) does not exist`.
- Root cause: the harness passed a bare integer literal (`1`) for
  `p_identity_digest_version smallint`. PostgreSQL's function-argument
  resolution only implicitly widens `smallint → integer`, never narrows
  `integer → smallint`, so the call failed to resolve to the one real
  function before it was ever invoked.
- Correction: every call site cast the literal explicitly (`1::smallint`,
  `0::smallint` for the one negative-test case), and `null::uuid` was
  added defensively wherever a bare `null` filled `p_share_link_id`.
  22 call sites corrected across Sections C–K.

**Second attempt: FAILED inside the RPC's own validation.**
- Error: `ERROR: P0001: INVALID_RATE_LIMIT_IDENTITY_DIGEST`.
- Root cause: positive-path synthetic identity digests in Sections G, H,
  I, J, K used section-letter-derived tags (`repeat('g1',32)` etc.) whose
  letters `g`/`h`/`i`/`j`/`k` fall outside the hex alphabet the production
  contract requires (`^[0-9a-f]{64}$`, `share_rate_limit_buckets_identity_digest_check`).
  The RPC's own input validation correctly rejected them — this proved the
  RPC's fail-closed validation works, not a defect in it.
- Correction: those five positive-path identities were replaced with
  deterministic, valid, lowercase 64-character hex values
  (`repeat('07',32)` / `'08'` / `'09'` / `'0a'` / `'0b'`). Section K3's
  intentional **negative** test (`'not-a-valid-hex-digest'`, which must
  remain invalid) was left untouched. A separate 63-character truncated
  synthetic digest was also found and fixed in `06_concurrency_runner.mjs`
  during this same pass (see below).

**Final, corrected run: PASS.**
- Status: ☑ `runtime_status = PHASE_3_RATE_LIMIT_RUNTIME_PASS` ☐ FAIL ☐ Errored before completing
- Total tests / Passed / Failed: **23 / 23 / 0**
- Isolated FAIL-row evidence: none — the FAIL-only table was empty.
- Reached its own trailing `rollback;`? ☑ Yes — no fixture row or
  test-only object this file created (the shared project/`project_share_links`
  rows, any bucket row produced by Sections C–K) survives; files 01/02's
  own committed schema/grants/RLS/sentinel are untouched by that rollback.

### Result from `06_concurrency_runner.mjs`

Before running the concurrency test, a separate authenticated read check
against `public.share_rate_limit_buckets` using the disposable project's
`service_role` key confirmed `AUTH_READ_RESULT: PASS` with **0** existing
bucket rows — confirming the correct disposable project, working
service-role access, and a clean bucket table before the concurrency run.

- Ran? ☑ Yes ☐ No
- N (concurrent calls issued): **25**
- Returned `requestCount` values, sorted: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]` — the exact contiguous set `{1..25}`, no duplicate, no gap.
- Final persisted `request_count` (read back directly from the table, independent of the RPC's own returned values): **25**
- Final result line: `CONCURRENCY_RESULT: PASS -- all 25 concurrent calls produced the exact contiguous set {1..25} with no duplicate and no gap, and persisted request_count independently confirmed 25.`
- Exit code: **0** (matched N exactly — no lost increment observed)
- Environment variables (`PHASE3_RATE_LIMIT_DISPOSABLE_SUPABASE_URL`, `PHASE3_RATE_LIMIT_DISPOSABLE_SERVICE_ROLE_KEY`) were cleared from the PowerShell session immediately after the run. No credential or API key value was recorded anywhere in this file or in this repository.

## Notes

- No Production project was touched at any point, in any of the two
  harness-correction attempts or the final passing run.
- Production application of `202608130001_client_share_rate_limit_increment.sql`
  (or any Client Share migration) remains a separate, explicit, later
  decision — this result does not authorize it.
- Phase 3 application implementation (session exchange, cookies, grants,
  the public route, the PIN flow, the projection read, security headers,
  analytics isolation) remains paused. This result authorizes nothing
  beyond the narrow rate-limit foundation itself.
- No numeric rate-limit threshold (requests per minute, PIN attempts per
  window, etc.) was decided by this run or by any harness correction —
  that remains a separate, unresolved product decision for whenever Phase
  3 application implementation resumes.
- The browser-session/grant TTL for that later Phase 3 application work
  remains the previously agreed **7 days** — unchanged by this runtime
  verification, which does not touch session/grant code at all.
- If this package is ever rerun again in the future (for example, after a
  genuine subsequent change to the migration or to file 03/06 itself), add
  a new "Run 2" section above following the same structure, and update the
  summary line at the top of this file to point at whichever run is then
  current and authoritative.
