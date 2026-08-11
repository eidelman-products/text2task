# Text2Task Client Share Link — Phase 1C Implementation Report

## Phase 1C — Durable Project-Level Publication Intent

**Status: PHASE 1C — COMPLETE AND RUNTIME VERIFIED.** Not staged, not
committed, not pushed, not deployed. Migration created but NOT applied to
Production. Production not accessed, not modified, not enabled.

**Phase 1C final acceptance: PASS.** Static/targeted tests 1113/1113
PASS; TypeScript 0 errors; user-run full production Build PASS (Next.js
compilation PASS, static generation 89/89 PASS); real disposable-project
PostgreSQL/Supabase runtime verification complete —
`total_tests = 47, passed_tests = 47, failed_tests = 0, runtime_status =
PHASE_1C_RUNTIME_PASS`, no FAIL rows. Full detail in §9 and §10 below and
in `docs/client-share-phase1c-runtime/04_CAPTURE_RESULTS.md`. Ready to be
committed as its own checkpoint; **Phase 2B is the next authorized phase
after that checkpoint commit.**

---

## 1. What Phase 1C Solves

The Client Share foundation already had durable, explicit owner controls
for client-facing subtitle, content direction, comments-enabled, the
selected task set, task public metadata, the selected Resource set,
Resource public metadata and the latest published update. It had no
durable representation of the owner's publication intent for three
project-level fields the eventual public projection may show: the
project **title**, a safe public **status**, and the **target date**.

Phase 1C adds exactly that — three durable, private-by-default boolean
flags recording only whether the owner has explicitly authorized each
safe projection. It does **not** copy the title/status/target-date
values themselves anywhere — `public.projects` remains the sole
authoritative source for those values.

---

## 2. Migration

**File**: `supabase/migrations/202608110001_client_share_publication_intent.sql`

One new, additive, forward-only migration. No historical migration was
rewritten. It:

1. Adds three columns to `public.project_share_links`.
2. Extends `public.get_share_link_management_state` (same signature,
   `create or replace function`, no DROP+recreate needed since the
   return type stays `jsonb`).
3. Extends `public.save_share_configuration` (same signature, same
   `create or replace function` treatment).
4. Changes nothing else — no new table, no new RPC, no grant/RLS/trigger
   change of any kind.

---

## 3. New Columns

| Column | Type | Nullability | Default |
|---|---|---|---|
| `title_visible` | `boolean` | `NOT NULL` | `false` |
| `status_visible` | `boolean` | `NOT NULL` | `false` |
| `target_date_visible` | `boolean` | `NOT NULL` | `false` |

**Safe-default rationale**: matches `project_share_links.comments_enabled`'s
exact existing pattern (`boolean not null default false`) rather than
inventing a second convention. Deterministic for every existing row (the
`ALTER TABLE` back-fills every pre-existing row to `false`) and for every
future row (draft creation never sets these columns, so they start
`false` until an owner explicitly opts in via `save_share_configuration`).
No nullable tri-state was used — there is no product reason for `NULL` to
mean anything different from `false` here.

**Never a duplicate value column**: no `title`, `status`, or
`target_date`/`deadline` column was added anywhere in this migration.
`project_share_links` stores only the three visibility flags;
`public.projects` remains authoritative for the values themselves.

---

## 4. Management-Read RPC Change

`public.get_share_link_management_state(p_project_id uuid)` — same
signature, same `SECURITY INVOKER`, same `search_path`, same ownership
resolution and error semantics. The returned `link` object gains exactly
three new keys: `titleVisible`, `statusVisible`, `targetDateVisible`, each
always present as a real boolean (never omitted, never a raw project
value). No private project field, no secret material, and no change to
any other field in the response.

---

## 5. Configuration-Save RPC Change

`public.save_share_configuration(...)` — same signature, same `SECURITY
DEFINER`, same `search_path`, same project-then-link locking order, same
task/Resource/update-publication sub-operations. Its existing `p_settings`
group gains three new optional keys — `titleVisible`, `statusVisible`,
`targetDateVisible` — validated with the exact same has-key/strict-boolean
pattern `commentsEnabled` already uses (no coercion of `"true"`/`"false"`
strings or any other truthy value). No new RPC was created (no
`save_title_visibility` etc.) — the existing merged
`save_share_configuration` remains the single atomic configuration-write
path, per AGENTS.md rule 19.

---

## 6. `configuration_version` Semantics

The three new flags join the existing settings change-detection group
(`comments_enabled`, `client_facing_subtitle`, `content_direction`) inside
`save_share_configuration`'s `v_settings_changed` expression:

- A genuine `IS DISTINCT FROM` change to **any** of the six settings
  fields bumps `configuration_version` by exactly one.
- Submitting identical values again does not bump it.
- Task, Resource and update-publication changes still never touch it —
  unchanged from Phase 1B.

---

## 7. Application (TypeScript/Zod) Contract Changes

**File**: `lib/share/share-contracts.ts`

- `managedShareLinkSchema` (the management-read response, `.strict()`)
  gains three new **required** fields: `titleVisible: z.boolean()`,
  `statusVisible: z.boolean()`, `targetDateVisible: z.boolean()` — required,
  not optional, because the RPC always returns all three.
- `saveShareConfigurationSettingsSchema` (the configuration-save request,
  `.strict()`) gains three new **optional** fields:
  `titleVisible: z.boolean().optional()`, `statusVisible: z.boolean().optional()`,
  `targetDateVisible: z.boolean().optional()` — following the exact
  omitted-means-unchanged convention the existing three settings fields
  already use.
- No `any`, no broadened `.passthrough()`, no weakened allowlisting.
- No route (`app/api/share-links/route.ts`,
  `app/api/share-links/[id]/config/route.ts`) and no repository function
  (`lib/share/share-links-repository.server.ts`) needed a code change —
  both are pure schema-driven pass-throughs that automatically carry the
  extended contract. Verified directly by reading both files: the
  repository never manually enumerates fields, it only
  `.safeParse()`s the RPC's raw jsonb result through the schema.
- Phase 2A's UI layer is unaffected in behavior — `ShareLinkPanel` does
  not render these fields — but its TypeScript test fixtures needed the
  three new required fields added (a mechanical consequence of the
  stricter read contract, not a behavior change): `share-link-panel.test.tsx`,
  `use-share-link.test.ts`, and `lib/share/share-links-repository.server.test.ts`.

---

## 8. Tests Added

### Migration static tests
`supabase/migrations/202608110001_client_share_publication_intent.test.ts`
— 42 tests, static text-inspection only (no live database), covering:
schema (exactly three new columns, correct type/default/nullability, no
duplicate value column, no new table/index/policy/trigger); the extended
read RPC (signature/security/search_path unchanged, selects and returns
all three new columns, exact allowlisted key set, never returns a raw
project value); the extended save RPC (signature/security/search_path
unchanged, settings allowlist includes all six keys, strict boolean
validation per new key, has-flags declared, old values fetched under the
same lock, change-detection expression includes all three via `IS
DISTINCT FROM`, UPDATE statement writes all three with the same
omitted-means-unchanged CASE pattern, version bump still exactly one
statement); no separate per-flag RPCs; grants unchanged (revoked from
public/anon/service_role, granted only to authenticated); no dynamic SQL;
no down/rollback migration.

### Application contract tests
`lib/share/share-contracts.test.ts` — new tests covering: all-false and
all-true acceptance on the read schema; each of the three fields required
(rejects when missing); each rejects a non-boolean value (including a
literal string title value, proving only booleans are ever accepted);
each of the three accepted alone or together on the write schema;
omission of all three leaves them `undefined` (not defaulted) on the
parsed request.

### Phase 2A fixture updates (mechanical, not behavioral)
`share-link-panel.test.tsx`, `use-share-link.test.ts`,
`lib/share/share-links-repository.server.test.ts` — the shared "valid
managed link" fixture in each file gained the three new required fields
(`false` — private by default), keeping every existing Phase 2A test
passing against the now-stricter read contract.

---

## 9. Static Test Results

**Targeted run** (`lib/share`, the new migration test file,
`app/components/dashboard/tasks/share-link`, `app/api/share-links`):
**1113 / 1113 passed, 0 failed.**

**`npx tsc --noEmit -p tsconfig.json` across the full repository: 0
errors.**

**User-run full production Build: PASS.** Next.js compilation PASS,
TypeScript during Build PASS, static generation 89/89 PASS. `git status
--short` before and after the Build contained the same working-tree file
set — the Build created no new source changes.

---

## 10. Runtime-Verification Package

**Path**: `docs/client-share-phase1c-runtime/`

Generated and statically self-verified (the generator's own internal
staged-output hash verification passed; `PACKAGE_VERIFICATION_STATUS:
PASS`). Contains:

- `00_READ_ME_FIRST.md`
- `01_CREATE_TEMP_TEST_FIXTURE.sql` — same fixture as the Phase 1B
  package, renamed sentinel (`DISPOSABLE_PHASE_1C_RUNTIME_TEST_PROJECT`)
  so the two packages can never be confused with each other.
- `02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql` — mechanically generated
  from all eight authoritative migrations (the original seven, unchanged,
  plus `202608110001`), via a new generator script,
  `scripts/client-share/build-phase1c-runtime-package.ps1`, modeled
  directly on the existing Phase 1B generator.
- `03_RUN_PHASE1C_RUNTIME_TESTS.sql` — hand-authored real PostgreSQL
  runtime tests (Sections A–M) proving: the three new columns exist with
  correct defaults; a fresh draft reads back false/false/false; an owner
  can set all three true in one call with `configuration_version`
  bumping exactly once; an identical re-save does not bump it again;
  turning a flag back off persists and bumps correctly; non-boolean
  values are rejected; a POST-WRITE atomic-rollback test proving a
  genuine flag change already applied by the settings `UPDATE` inside
  `save_share_configuration` is rolled back -- together with its
  `configuration_version` bump -- when a later sub-operation in the same
  call fails (using a syntactically valid task attached to the wrong
  project, rejected only by the later owner/project-attribution check,
  not by earlier shape validation); cross-tenant owner B cannot alter
  or even read owner A's flags; direct `anon` execution of both extended
  RPCs is denied (`42501`); the existing task/Resource/update-publication
  behavior still works correctly combined with the new flags in one
  atomic call; a revoked link still rejects a flags-only save with
  `SHARE_LINK_REVOKED`; and the security posture (SECURITY mode, grants)
  of both extended RPCs is unchanged. This file is deliberately scoped to
  Phase 1C's own delta plus a light regression pass — it does not
  re-prove the entire Phase 1B surface, which the existing 520/520-PASS
  Phase 1B package already covers.
- `04_CAPTURE_RESULTS.md` — filled in with the completed, authoritative
  run (see below).
- `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- `MANIFEST.md` — mechanically generated, full file inventory and
  SHA-256 hashes.

**Runtime verification has been run and PASSED.** The user executed
files 01, 02 and the corrected file 03, in order, against a fresh
disposable Supabase project (never Production):

- File 01: `fixture_status = READY`.
- File 02: every structural verification row `found = true`.
- File 03: `total_tests = 47, passed_tests = 47, failed_tests = 0,
  runtime_status = PHASE_1C_RUNTIME_PASS`. No FAIL rows were produced.

Full evidence is recorded in
`docs/client-share-phase1c-runtime/04_CAPTURE_RESULTS.md`. No Supabase
project was created, accessed, or deleted by this agent at any point —
every real database interaction was performed by the user.

### Pre-runtime harness review and correction (2026-08-11)

Before the user ran file 03, a static read-through of the package found
**two defects in the runtime test harness itself** — no defect was found
in the migration, the extended RPCs, or any application code.

1. **B1 used an invalid `NULL` public id.** `create_share_link_draft`
   (`202608060001_client_share_lifecycle_operations.sql`) requires
   `p_public_id` to match `^[A-Za-z0-9_-]{24}$`; `NULL` fails that check
   and raises `INVALID_PUBLIC_ID`, so the harness would have failed at
   its very first RPC call. **Fix**: B1 now supplies a deterministic,
   verified 24-character literal (`phase1cRuntimeA1Link0001`; mechanically
   confirmed to be exactly 24 characters and to match the required
   regex). `create_share_link_draft` itself was not touched.
2. **Section G did not prove post-write rollback.** The original
   malformed task item (`"subtaskId": "not-a-number"`) is rejected by
   `save_share_configuration`'s initial JSON shape validation, which runs
   *before* any lock is acquired or any row is written — so the original
   test proved only "invalid input causes no mutation," not the stronger,
   intended claim that an already-applied settings write is rolled back
   when a later sub-operation fails. **Fix**: added a new fixture task
   (`task_a2`, owner A, attached to project A2) and Section G now submits
   a fully shape-valid task item referencing it. Because the share link
   under test belongs to project A1, this task passes initial validation,
   the settings `UPDATE` (and its `configuration_version` bump) executes,
   and only the later owner/project-attribution check rejects it with
   `INVALID_TASKS`. G2–G4 now assert both the publication-intent flags
   **and** `configurationVersion` equal their pre-call values, proving
   the already-applied write was rolled back, not merely that nothing was
   ever written.

**File 02 / migration-hash consistency, mechanically verified**: after
correcting file 03 and regenerating the package
(`build-phase1c-runtime-package.ps1`), `02_APPLY_CLIENT_SHARE_THROUGH_PHASE1C.sql`
hashes to the exact same value as before the correction
(`8bd980081b47d2ded75b72c69d427082f9c3f8d366d601fea7279706d39c991f`),
and all eight source-migration hashes are unchanged — because file 02 is
built only from the eight migrations, never from file 03, and none of the
migrations were touched. The bundle already applied to the disposable
Supabase project (file 01 `READY`, file 02 all `found = true`) remained
valid, so it did not need to be reapplied; only `MANIFEST.md` and file 03
itself changed hash. The corrected file 03 was then run in that same
disposable project and produced the final `PHASE_1C_RUNTIME_PASS` result
recorded in §10 above and in `04_CAPTURE_RESULTS.md`.

**Static regression protection**: this package has no existing
`build-phase1c-runtime-package.test.ts` (unlike the Phase 1B package,
which has a ~1,900-line static self-test of its generator). Adding an
equivalent test subsystem solely to guard against this one harness
mistake would be disproportionate. No new test file was created; this
section documents the correction and its verification instead, per
explicit instruction.

---

## 11. Production State

- Migration: **CREATED. NOT APPLIED TO PRODUCTION** (applied only to the
  user's own disposable Phase 1C runtime-verification project, per §10).
- Production Client Share migrations: unchanged — still not applied.
- Production Client Share feature: unchanged — still not enabled.
- This agent never ran SQL and never accessed, created or deleted any
  Supabase project at any point in Phase 1C — every real database
  interaction (disposable-project runtime verification, per §10) was
  performed by the user.

---

## 12. Scope Boundary Confirmation

Not implemented in this task, per the accepted Phase 1C scope: Phase 2B
configuration UI, task/Resource selection UI, subtitle/comments/direction
UI, PIN/expiry/rotation UI, Preview, the public `/share/[publicId]`
route, anonymous/session exchange, public Resource access, client
feedback, branding/logo system, public owner identity, public progress
override, client-name publication, pricing/Free/Pro logic, and any
Production migration application or feature enablement. Phase 2A's
existing UI was not changed to render or otherwise use the new fields.

---

## 13. Exact Next Manual Verification Steps

1. ✅ User reviewed the complete diff (migration, contracts, tests,
   runtime package).
2. ✅ User ran files 01 and 02 of the runtime package against a
   disposable Supabase project (`fixture_status = READY`; every
   structural verification row `found = true`).
3. ✅ Pre-runtime harness review found and corrected two test-harness
   defects (§10a above) — no product/migration defect. File 02 was
   regenerated and mechanically confirmed byte-identical (same hash) to
   the bundle already applied in that same disposable project, so it did
   not need to be reapplied.
4. ✅ User ran the corrected
   `docs/client-share-phase1c-runtime/03_RUN_PHASE1C_RUNTIME_TESTS.sql`
   in that same disposable project: `total_tests = 47, passed_tests = 47,
   failed_tests = 0, runtime_status = PHASE_1C_RUNTIME_PASS`. Recorded in
   `04_CAPTURE_RESULTS.md`.
5. ✅ User ran the full production Build after the harness correction:
   Next.js compilation PASS, TypeScript PASS, static generation 89/89
   PASS.
6. **Next**: Phase 1C is committed as its own checkpoint.

**Phase 1C has passed static review, the full production Build, and real
PostgreSQL/Supabase runtime verification. The only remaining step is the
user's checkpoint commit — Phase 2B does not begin until that commit
exists.**
