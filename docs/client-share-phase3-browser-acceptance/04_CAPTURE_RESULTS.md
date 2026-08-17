# Client Share Link — Phase 3 Browser Acceptance Fixture Results

## FINAL STATUS: PHASE 3 BROWSER ACCEPTANCE COMPLETE — PASS

A fresh Vercel Preview containing every fix through the PIN-disable UX gap
(implementation report item 40) received a final, comprehensive real-browser
acceptance pass. Full checklist recorded in
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md` item 41
-- summarized here:

**PASS** — simplified owner UI; Share update; "Project shared" success
state; owner Preview; Copy client link; anonymous public access with no
login; fragment/secret removed from the visible URL after exchange;
refresh via the established browser session; latest client update render;
mapped task render; mapped LINK attachment render + external navigation;
no private/internal field exposure; Native Share; WhatsApp handoff; Email
`mailto:` handoff.

**PIN PASS** — existing-PIN checkbox state shown correctly (plaintext PIN
never shown); wrong PIN rejected; correct PIN grants access; project loads
after correct PIN; PIN disabled via the same checkbox; Share update clears
PIN through the existing secure `clear_share_pin` path; the same client
link then opens directly with no PIN gate; refresh continues to work.

**PRIVACY PASS** — analytics cookie-consent banner no longer renders on
`/share/**`; the underlying analytics/session-replay exclusion (Clarity,
Google Ads/GA, Vercel Analytics/Speed Insights, attribution capture)
remains independently asserted by existing test coverage.

**Known fixture note (not a Text2Task defect):** "Phase 3 Browser Fixture
Resource" is a LINK fixture pointing at a dummy external URL. Text2Task
correctly opens the exact configured external URL; the destination's own
availability is fixture data, not an application defect.

This closes the real-browser-defect investigation that began below with
the resource-publicLabel timing defect (#1) and continued through the
activation-environment-variable defect (#3), the correct-PIN
grant-timestamp defect (#4), the analytics-banner finding, and the
PIN-disable UX gap — every one of which is preserved in full below and in
the implementation report, unedited. **No prior result in this file was
rewritten, minimized, or removed to reach this closure.**

---

**BROWSER FIXTURE PREPARATION: COMPLETE AND VERIFIED — 16/16 PASS,
`browser_fixture_status = READY`.** Files 01 and 02 both succeeded and
persisted; the disposable Auth owner (`phase3-browser-owner@example.invalid`)
was created successfully. File 03's first run reported 15 of 16 checks
passing, with the 1 failing check's own detail temporarily unrecoverable
because File 03's own trailing `raise exception` rolled back the
temporary results table along with everything else in the same implicit
SQL Editor transaction — corrected (File 03 now never raises). A
read-only probe run directly against the disposable database confirmed
check **B2** (`tasks` column closure) as the exact failure —
`public.tasks` was missing an `is_archived` column the real
`app/api/tasks/route.ts` task-insert path also explicitly sets on every
task it creates. The incremental patch `01A_PATCH_TASKS_IS_ARCHIVED.sql`
was then run successfully
(`patch_status = DISPOSABLE_TASKS_IS_ARCHIVED_PATCHED`), and both the
`03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql` diagnostic and the corrected
`03_BROWSER_FIXTURE_VERIFICATION.sql` itself now report
**`total_checks = 16, passed_checks = 16, failed_checks = 0,
browser_fixture_status = READY`**. The `01A_PATCH_TASKS_IS_ARCHIVED.sql`
patch resolved the only fixture-schema gap this package's preparation
found (the missing `tasks.is_archived` column, check B2) — no other
check ever failed, in either run. **The disposable Supabase environment
is now ready for Vercel Preview browser acceptance.** This completes
disposable browser fixture *preparation* — it does **not** mean Phase 3
browser/webview acceptance itself has happened; that still requires a
real Vercel Preview deployment, real sign-in, and the full manual
`PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` pass, none of which have occurred
yet. No Production project was touched at any point.

## Run log

| Run | Project | File 01 | Auth user created | File 02 | File 03 | Outcome |
|---|---|---|---|---|---|---|
| 1 | `text2task-phase3-application-runtime-temp` (disposable) | Succeeded | Yes | Succeeded | 15/16 PASS, 1 FAIL (B2, confirmed via direct DB probe: `tasks.is_archived` missing) — failure detail initially lost to a transaction rollback caused by File 03's own trailing `raise exception` | File 03 corrected (never raises); File 03A diagnostic prepared; File 01 corrected for future setups; File 01A patch prepared |
| 2 | `text2task-phase3-application-runtime-temp` (disposable, same project; 01/02 not re-run) | N/A — not re-run | N/A — already created | N/A — not re-run | `01A_PATCH_TASKS_IS_ARCHIVED.sql` succeeded (`DISPOSABLE_TASKS_IS_ARCHIVED_PATCHED`); `03A` diagnostic and corrected `03` both report **16/16, READY** | **Browser fixture preparation COMPLETE AND VERIFIED** |

## Run 1

Disposable Supabase project `text2task-phase3-application-runtime-temp`
(the same project `docs/client-share-phase3-runtime/` already uses —
confirmed **not** the Text2Task production project).

### Result from File 01 (`01_EXTEND_DISPOSABLE_APP_SCHEMA.sql`)

- Status: ☑ Succeeded ☐ Errored
- `schema_extension_status` value: `DISPOSABLE_APP_SCHEMA_EXTENDED`

### Disposable Auth user

- Created via Supabase dashboard "Add user"? ☑ Yes ☐ No
- Email used: `phase3-browser-owner@example.invalid` ☑ confirmed exact match
- "Auto Confirm User" enabled? ☑ Yes (implied by successful File 02 owner resolution)

### Result from File 02 (`02_SEED_DISPOSABLE_OWNER_CONTENT.sql`)

- Status: ☑ Succeeded ☐ Errored
- `seed_status` value: `DISPOSABLE_OWNER_CONTENT_SEEDED`

### Result from File 03 (`03_BROWSER_FIXTURE_VERIFICATION.sql`), first attempt

**Reached its own final gate and correctly identified a failure — the
migration/schema extension was not blindly accepted. What went wrong was
purely about result *visibility* after that point, not about the
pass/fail determination itself.**

- Status: ☐ `browser_fixture_status = READY` ☑ FAIL (correctly detected) ☐ Errored before completing
- Total checks / Passed / Failed: **16 / 15 / 1**
- Exact error surfaced to the user: `ERROR: P0001: PHASE3_BROWSER_FIXTURE_NOT_READY: 1 of 16 checks failed. See the FAIL-only table above for details.`
- Isolated FAIL-row evidence: **not recoverable** — see root cause below.
- Follow-up `select * from browser_fixture_checks where status = 'FAIL';` (run as a separate, later query): `ERROR: 42P01: relation "browser_fixture_checks" does not exist`.

#### Root cause of the lost FAIL-row evidence (harness-only, now corrected)

`create temporary table browser_fixture_checks` is a session-scoped
temporary table with no explicit `begin;`/`rollback;` anywhere in the
original File 03. When the whole file is pasted into the Supabase SQL
Editor and run, Postgres receives it as one multi-statement query string
and executes it as a single implicit transaction, even though the script
itself contains no explicit `BEGIN`. The original File 03's own final
`do $$ ... raise exception ... $$` block — written specifically to make
a failed verification "unambiguously FAILED" — therefore aborted that
entire implicit transaction. Because `CREATE TEMPORARY TABLE` is DDL, and
DDL is transactional in PostgreSQL, the abort rolled back the table's
creation itself, not just its rows. The three `select` result sets
earlier in the same script (all-checks, totals, FAIL-only) had already
been computed and may have been transiently displayed by the SQL
Editor's UI, but the underlying table they were computed from ceased to
exist the instant the transaction aborted — so a later, separate query
against `browser_fixture_checks` correctly reports `42P01: relation
does not exist`. This was a harness-only design defect in how File 03
reported failure, not a bug in any check's own logic, and not a
migration/application defect of any kind.

**Correction applied:** File 03's trailing block no longer raises an
exception under any circumstance. It now ends with a plain, always-
returned verdict `select` (`browser_fixture_status = 'READY'` or
`'NOT_READY'`, with `total_checks`/`passed_checks`/`failed_checks`), so
all four of its result sets remain visible and queryable regardless of
outcome, and a failure is still unambiguous (`NOT_READY` plus a nonzero
`failed_checks`) without needing an exception to say so.

#### Failing check confirmed (static analysis + direct database probe)

Comparing `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql`'s actual `ALTER TABLE
public.tasks` column list against File 03's own `v_tasks_expected` array
found a genuine mismatch: the expected array includes `'is_archived'`,
but neither the original runtime-package fixture
(`docs/client-share-phase3-runtime/01_CREATE_TEMP_TEST_FIXTURE.sql`, not
modified by this package) nor this package's own File 01 (as originally
written) ever added an `is_archived` column to `public.tasks` (unlike
`public.projects`, which already had it from the original runtime
fixture). A read-only probe run directly against the disposable database
confirmed this exactly:

```sql
select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'tasks'
    and column_name = 'is_archived'
) as tasks_is_archived_exists;
-- tasks_is_archived_exists = false
```

This means File 03's own `B2` check (`tasks has every column the real
dashboard/projection code selects or inserts`) found only 21 of the 22
expected columns — exactly accounting for "1 of 16 checks failed." This
is not merely a verification-script bug: `app/api/tasks/route.ts`'s real
task INSERT explicitly sets `is_archived: false` on every task it
creates, so this was a genuine gap — a real task creation through the
actual dashboard against this fixture would have failed with "column
is_archived of relation tasks does not exist" the moment it tried.

#### Corrections prepared

Two corrections were prepared in response, per the explicit repository
inspection above (no committed migration defines `public.tasks`, so
`boolean not null default false` was chosen as the best-supported
canonical contract — matching every real write path and the sibling
`projects.is_archived` column already in this fixture):

- `01_EXTEND_DISPOSABLE_APP_SCHEMA.sql` itself corrected to include
  `tasks.is_archived boolean not null default false` — for any *future*,
  brand-new disposable project only. This corrected file was **not**
  re-applied to the already-extended project (see Run 2 below instead).
- `01A_PATCH_TASKS_IS_ARCHIVED.sql` — a new, minimal, idempotent,
  additive-only patch (`add column if not exists`) for the
  **already-extended** disposable project this Run 1 actually used. It
  adds only the one missing column, touches no other schema, and
  preserves the already-seeded fixture task (which receives the new
  column's default value, `false`, automatically). Executed successfully
  in Run 2, below.

## Run 2

Same disposable Supabase project as Run 1,
`text2task-phase3-application-runtime-temp`. Files 01 and 02 (both the
runtime package's and this package's) were **not** re-run — neither was
ever implicated by the B2 failure, and the disposable Auth owner already
existed.

### Result from File 01A (`01A_PATCH_TASKS_IS_ARCHIVED.sql`)

- Status: ☑ Succeeded ☐ Errored
- `patch_status` value: `DISPOSABLE_TASKS_IS_ARCHIVED_PATCHED`
- Destructive operation used? ☐ Yes ☑ No — additive only (`ADD COLUMN IF
  NOT EXISTS`), no `DROP`/`DELETE`/`TRUNCATE`, no Client Share table
  touched, already-seeded fixture task preserved.

### Result from `03A_DIAGNOSE_BROWSER_FIXTURE_FAILURE.sql` (post-patch)

- Status: ☑ `browser_fixture_status = READY` ☐ NOT_READY
- Total checks / Passed / Failed: **16 / 16 / 0**
- FAIL-only result set: empty.

### Result from `03_BROWSER_FIXTURE_VERIFICATION.sql` (official, post-patch) — AUTHORITATIVE

**This is the authoritative, user-executed final browser-fixture runtime
result** for `text2task-phase3-application-runtime-temp`.

- Status: ☑ `browser_fixture_status = READY` ☐ NOT_READY
- Total checks / Passed / Failed: **16 / 16 / 0**
- FAIL-only result set: empty.
- All four result sets (all-checks, totals, FAIL-only, verdict) returned
  normally — no exception, confirming the File 03 result-visibility
  correction itself works as intended, in addition to confirming the
  schema patch closed the B2 gap.

**Browser fixture preparation is now COMPLETE AND VERIFIED for this
disposable project.**

### Preview deployment and manual acceptance

- Preview deployed (CLI, no `git push`)? ☐ Yes ☐ No — not reached yet
- Signed in through Preview as the disposable owner? ☐ Yes ☐ No
- Real Client Share operations performed through the Preview UI: none yet
- `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` progress: not started

This section remains entirely unstarted — reaching `browser_fixture_status
= READY` prepares the disposable environment for browser acceptance, it
does not perform browser acceptance itself.

## Post-`READY` update 6: real browser defect #4 + analytics-banner CONFIRMED CLOSED; final PIN-disable UX gap fixed, not yet retested

A fresh Vercel Preview containing update 5's fixes was real-browser
retested and **confirmed**: PIN gate displays correctly, wrong PIN is
rejected correctly, correct PIN now grants access, the public project
loads correctly afterward, and the analytics cookie banner no longer
renders on `/share/**`. **Real browser defect #4 and the analytics-banner
finding are both CLOSED.**

The retest surfaced one remaining, purely owner-side UX gap: once a share
link had PIN protection enabled, the simplified owner panel had no control
to disable it. Fixed without adding any new UI surface -- the existing
"Protect with a PIN (optional)" checkbox is now itself the enable/disable
control (checked = protected, unchecked = not protected), routed through
the same two pre-existing, unchanged, already-security-reviewed
`set_share_pin`/`clear_share_pin` paths. Full detail in
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md` item
40. **This fix has not been browser-tested.**

## Post-`READY` update 5: real browser defect #3 CONFIRMED CLOSED; real browser defect #4 (correct PIN → 404) + analytics-banner fix, not yet retested

A fresh Vercel Preview containing update 4's activation fix was
real-browser retested and **confirmed working**: Share update, "Project
shared", owner Preview, Copy client link, and the full anonymous no-PIN
public flow (load, refresh, latest update, mapped task, mapped LINK
attachment opening its external URL, Native Share, WhatsApp, Email mailto)
all verified end to end. **Real browser defect #3 is CLOSED.**

Testing then moved to optional PIN protection and found a new, fourth real
browser defect: wrong PIN correctly showed "Incorrect PIN. Please try
again.", but the correct PIN produced `POST /api/share/session -> 404`
(`{"ok":false,"code":"UNAVAILABLE","error":"This shared link is not
available."}`). Full trace, root cause, and fix are recorded in
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md` item
39. Summary: `ensureCurrentGrant`'s grant-insert computed `pin_verified_at`
in Node.js BEFORE the network round trip to Postgres, while
`created_at` is the database's own `now()` evaluated AFTER that round
trip -- deterministically (never flakily) violating
`share_session_grants_lifecycle_check`'s `pin_verified_at >= created_at`
requirement on every single PIN-protected grant. Fixed by supplying one
literal timestamp for both columns in the same insert. **This is an
application code defect (Classification A), not a disposable-fixture
schema gap** -- no SQL patch was needed. Safe stage-specific diagnostic
logging was also added to the whole grant-creation path for any future
failure.

A separate, lower-severity finding from the same browser session: the
cookie-consent banner rendered on the public `/share/**` page even though
every actual analytics/session-replay script there was already confirmed
suppressed (Finding A: banner-only, not a real tracking leak). Fixed by
making the banner share the exact same `/share/**` exclusion every
analytics component already uses.

**Neither this turn's fixes have been browser-tested yet.**

## Post-`READY` update 4: real browser defect #3 (activate endpoint 500) + final UI simplification, not yet retested

A fresh Vercel Preview retest of update 3's fix below produced Chrome
DevTools Network evidence proving `PATCH .../config` now succeeds (200)
but the immediately following `POST .../activate` returns 500 with the
same generic `{"ok":false,"code":"INTERNAL_ERROR","error":"Failed to
activate the share link."}` body. **This proves update 3's own fix was not
the runtime root cause** -- save configuration is no longer implicated;
activation specifically is. Full trace, root cause, and fix are recorded
in `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md`
item 38. Summary: `activateShareLink` generates and encrypts a fresh
secret in Node.js before ever calling the RPC, and previously discarded
any failure from that step with a bare `catch {}` -- a missing/malformed
`TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` (or
`TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1`) environment variable reproduces the
captured response byte-for-byte. Cross-checking this file's own sibling
`00_READ_ME_FIRST.md` "Preview ENV" checklist found direct, independent
confirmation: it listed the HMAC key but **never listed the separate
encryption key at all** -- now fixed in that file. No application code
was changed to alter activation's own fail-closed behavior (that would be
a real security regression); instead, safe structured diagnostic logging
was added to `lib/share/share-links-repository.server.ts` so the very
next Preview activation attempt's Vercel function logs will show exactly
`{operation: "activate_share_link", reason: "<safe code>"}` and settle
this conclusively. **This is a Preview-environment-configuration finding,
not an application code defect and not a disposable-database schema gap**
-- no SQL patch was needed or prepared. The owner "Share with client"
panel was also given its final simplification this same turn: "Edit what
client sees", "Manage link", and the duplicate "Share project update"
heading were all removed, with no replacement entry point of any kind
inside the panel. **This fix has not been browser-tested.**

## Post-`READY` update 3: real browser defect #2 (Quick Share orchestration), fixed, not yet retested

A fresh Vercel Preview deployment of the Objective B redesign (update 2
below) surfaced a second real browser defect: clicking the new primary
"Share update" action against an already-configured Draft link (existing
persisted title/status visibility, one mapped task, one mapped Resource
with its own publicLabel, PIN off, an owner-typed Client update) failed
with `"That action could not be completed."`. Full root-cause trace,
fix, and regression tests are recorded in
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md` item
37. Summary: the `shareUpdate` orchestration's own call sequence was
proven correct against the real `save_share_configuration`/
`activate_share_link` contracts (no reordering was needed); the concrete
code defect found and fixed was a repository-level error-mapping gap —
`enforce_share_link_update_integrity`'s four defense-in-depth trigger
codes were not mapped to a safe error category the way the equivalent
task/Resource trigger codes already were, so any real occurrence would
silently collapse into the same generic message this browser session
saw. Stage-tagged structured error tracking was also added so any future
failure in this same orchestration identifies the exact failed step
directly. **This fix has not been browser-tested.** Real browser defect
#1 (below) and its browser-confirmed fix are unaffected and remain
correct.

## Post-`READY` update 2: owner UX redesign (Objective B), not yet browser-tested

After the item-35 fix below was confirmed via a real-browser retest (owner
confirmed: selected Resource survives reopen, persisted publicLabel is
restored, client-facing label visible again after reload), the owner
"Share with client" UI was substantially redesigned around a single
"Share project update" workflow — see
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md` item
36 for the full design/implementation record. This redesign reuses every
existing secure endpoint/RPC unchanged (no migration, no new RPC) but
replaces the owner-facing panel and lightly reorders/relabels the public
client page. **The redesigned UI has not been browser-tested.** The
"Preview deployment and manual acceptance" section below remains accurate
as originally written: a fresh Preview deployment containing this
redesign, followed by a full manual pass through the new quick-share flow
and the redesigned client page, is required before browser/webview
acceptance can be considered complete.

## Post-`READY` finding: real browser defect (resource publicLabel), fixed

After this file's Run 2 result (`browser_fixture_status = READY`), a first
real-browser owner session against a Vercel Preview deployment connected to
this same disposable project found a genuine application defect: a
Resource's `publicLabel` appeared to be lost after closing and reopening the
"Share with client" panel, and a second Save then failed with a generic
error. This was root-caused to a client-side React state-initialization race
in `share-link-configuration-editor.tsx` (the owner Resources fetch resolving
after the editor had already mounted) — not a defect in this fixture, in any
migration, or in any RPC. Full details, root cause, and the fix are recorded
in `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_3_IMPLEMENTATION_REPORT.md`,
item 35. **This does not change the `READY`/16/16 result above** — the
fixture itself remains correctly prepared. It does mean the "Preview
deployment and manual acceptance" section below remains accurate as written
(not started/not complete): a **fresh** Preview deployment containing the
item-35 fix, followed by a full re-run of the manual "Share with client"
flow, is still required before browser/webview acceptance can be considered
complete.

## Notes

- No Production project may be touched by any file in this package.
- This package does not itself constitute Phase 3 browser/webview
  acceptance — it only prepares the disposable project to make that
  acceptance possible. `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` (in
  `docs/client-share-phase3-runtime/`) remains the actual acceptance
  record.
- Enabling `TEXT2TASK_CLIENT_SHARE_ENABLED` in Production remains a
  separate, explicit, later decision — this package does not authorize it.
- The `13 checks` figure quoted in this repository's own prior turn
  summary (before this Run 1 record) was a plain counting error in that
  summary text — File 03 has always defined exactly 16 checks (A: 2,
  B: 4, C: 5, D: 4, E: 1). No code or check was ever added or removed;
  only the earlier prose miscounted them.
- If any file in this package is run again against this same disposable
  project (for example, once real Preview/browser acceptance begins and
  something needs re-verifying), add a new "Run 3" section above
  following the same structure, and update the summary line at the top
  of this file to point at whichever run is then current and
  authoritative.
