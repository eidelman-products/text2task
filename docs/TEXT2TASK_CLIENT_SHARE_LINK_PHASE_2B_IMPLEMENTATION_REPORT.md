# Text2Task Client Share Link — Phase 2B Implementation Report

## Phase 2B — Owner Content-Configuration Editor + Mapping-Read Corrective Foundation

**Status: PHASE 2B — COMPLETE AND RUNTIME VERIFIED.** Not staged, not
committed, not pushed, not deployed. Migration
`202608110002_client_share_management_mapping_metadata.sql` created but
**NOT applied to Production**. `TEXT2TASK_CLIENT_SHARE_ENABLED` remains
disabled. Production not accessed, not modified, not enabled at any
point.

**Phase 2B final acceptance: PASS.** Static/targeted tests 2058/2058
PASS (migration static tests included in that verified targeted suite);
TypeScript 0 errors; user-run full production Build PASS (Next.js 16.1.6
compilation with Turbopack PASS, TypeScript during Build PASS, static
generation 89/89 PASS); real disposable-project PostgreSQL/Supabase
runtime verification of the corrective migration complete —
`total_tests = 46, passed_tests = 46, failed_tests = 0, runtime_status =
PHASE_2B_MAPPING_RUNTIME_PASS`, no FAIL rows. Full detail in §7–§9 below
and in
`docs/client-share-phase2b-mapping-read-runtime/04_CAPTURE_RESULTS.md`.
Ready to be committed as its own checkpoint — **the only remaining step
is the user's Git checkpoint commit; Phase 2C does not begin until that
commit exists.**

---

## 1. What Phase 2B Delivers

Phase 2B extends the Phase 2A management shell into a full owner
content-configuration editor over the durable contracts Phase 1B/1C
already established:

- The three Phase 1C publication-intent toggles (`titleVisible`,
  `statusVisible`, `targetDateVisible`).
- Existing share settings (`commentsEnabled`, `clientFacingSubtitle`,
  `contentDirection`).
- Task sharing: explicit per-task selection, `publicGroup`,
  `waitingForClientFeedback`, `displayOrder`.
- Resource sharing: explicit per-Resource selection, `publicLabel`,
  `canDownload`, `displayOrder` — **Note Resources excluded from V1**
  (see §4).
- Deliberate publishing of a new latest update.

All five groups save through **one atomic `PATCH /api/share-links/[id]/config`
call**, reusing the existing merged `save_share_configuration` RPC
contract unchanged. No new endpoint, no new table.

During acceptance review, a real persistence-integrity defect was found
in the initial implementation (§3) and corrected via one additive
migration (§2) before this phase could be accepted.

---

## 2. Corrective Migration

**File**: `supabase/migrations/202608110002_client_share_management_mapping_metadata.sql`

One new, additive, forward-only migration — same pattern as every prior
Client Share RPC extension (`create or replace function`, no new RPC, no
new table, no historical migration rewritten). It extends
`public.get_share_link_management_state(uuid)` in place (same signature,
same `SECURITY INVOKER`, same `search_path`, same grants) so that its
`mappedTaskIds`/`mappedResourceIds` bare-id arrays are **replaced** —
not supplemented — by structured arrays carrying the complete persisted
per-item mapping metadata:

```
mappedTasks:     [{ subtaskId, publicGroup, waitingForClientFeedback, displayOrder }, ...]
mappedResources: [{ resourceId, publicLabel, canDownload, displayOrder }, ...]
```

Ordered `display_order, id`, exactly as persisted — never renumbered on
read. `public.save_share_configuration` was **not** changed: its
exact-set / omitted-means-unchanged / empty-clears-mapping semantics and
`configuration_version` change-detection group are untouched.

The bare-id arrays were removed entirely rather than kept alongside the
structured ones because Client Share is still feature-gated off, no
Client Share migration has ever reached Production, and every current
application consumer was migrated in the same repository change — so
carrying a second, redundant read shape forward would have been a
duplicate contract for no real compatibility need.

---

## 3. The Defect This Migration Corrects

A read-only acceptance trace of the first Phase 2B implementation found
that `get_share_link_management_state` (as delivered through
`202608110001`) had never returned per-item task/Resource metadata — only
bare id arrays. Because `save_share_configuration`'s task/Resource groups
are a deterministic **full-set replacement**, the owner editor could not
reopen an already-saved configuration losslessly: editing one item forced
resubmission of the *entire* set, and every untouched sibling's
`publicGroup`/`waitingForClientFeedback`/`publicLabel`/`canDownload`/
`displayOrder` had to be reconstructed from guesses (the internal task
status, the Resource's own title, hardcoded defaults) — silently
overwriting real persisted values the moment any sibling in the same
section was edited. `displayOrder` was additionally always recomputed
from list position, never preserved.

This was classified `PHASE 2B ACCEPTANCE: BLOCKED — OWNER MAPPING READ
CONTRACT INCOMPLETE` and required a genuine read-contract change at the
RPC level — which §2's migration provides.

---

## 4. Owner Editor — Lossless Reopen/Edit/Resave Behavior

**File**: `app/components/dashboard/tasks/share-link/share-link-configuration-editor.tsx`

`buildInitialTaskDrafts`/`buildInitialResourceDrafts` now initialize an
already-mapped item's draft **directly from the persisted `mappedTasks`/
`mappedResources` metadata** — never from `suggestPublicGroup`,
`resource.title`, or a hardcoded default. Those fallbacks apply
exclusively to a genuinely unmapped item becoming a brand-new selection.

`displayOrder` handling: there is no reorder interaction in this UI, so a
retained item's real persisted `displayOrder` is carried through
`buildSaveRequest` unchanged; only a brand-new selection receives a
freshly computed value (one past the highest retained order in that
save) — a sibling's persisted order is never disturbed by editing another
item.

`tasksTouched`/`resourcesTouched` still gate whether a group is included
in the save payload at all (an untouched section is omitted entirely,
relying on the RPC's own omitted-means-unchanged semantics) — but now,
when a touched group **is** submitted, every retained-but-unedited
sibling carries its real persisted metadata forward, not a guess.

**Note Resources excluded from V1** (locked decision): selectability is
`!isNoteResource(r) && (isFileResource(r) || isLinkResource(r))`, reusing
the existing exported classifiers from `resource-api.ts` (data-driven —
based on `url`/`storage_path`/`file_name` presence, never the
`resource_type` label alone). Notes are never listed, never selectable,
and no new Resource system or public Notes design was built.

**Latest-update behavior**: unchanged and unaffected by this correction.
`currentUpdate.body`/`version`/`publishedAt` were already returned by the
read RPC; the editor displays the currently published update read-only
and composes a **new** update via an empty draft — it never attempts to
reconstruct or edit the existing immutable update in place.

---

## 5. Exact Regression Tests Added

**File**: `app/components/dashboard/tasks/share-link/share-link-configuration-editor.test.tsx`

Two exact reopen/edit/save regression scenarios prove the corrected
behavior directly, not just via fresh-fixture unit tests:

- **Tasks**: Task A (`waiting_for_feedback` / `true` / `displayOrder 8`)
  and Task B (`completed` / `false` / `displayOrder 4`) are persisted;
  the editor is initialized from that state; only Task B's `publicGroup`
  is changed; on save, Task A's outgoing payload is asserted to equal
  its original values byte-for-byte (`toEqual`, not `toMatchObject`).
- **Resources**: Resource A (`"Final logo"` / `canDownload: false` /
  `displayOrder 9`) and Resource B are persisted; only Resource B is
  edited; Resource A's outgoing payload is asserted unchanged, including
  a separate `canDownload: true` variant so neither boolean direction
  can be silently defaulted.

Also added: new-unmapped-item default tests (a task/Resource only
receives its safe new-selection default once explicitly selected, never
on open), and confirmation that defaults never run over a persisted
mapping.

---

## 6. Application (TypeScript/Zod) Contract Changes

**File**: `lib/share/share-contracts.ts`

- `noManagedShareLinkDataSchema`/`withManagedShareLinkDataSchema` gained
  `mappedTasks`/`mappedResources` (structured, bounded at
  `MAX_CONFIGURATION_ITEMS`, duplicate-checked) **replacing**
  `mappedTaskIds`/`mappedResourceIds` entirely.
- New exported schemas/types: `mappedShareLinkTaskSchema` /
  `MappedShareLinkTask`, `mappedShareLinkResourceSchema` /
  `MappedShareLinkResource`, `sharePublicGroupSchema`.
- `saveShareConfigurationTaskItemSchema` is now a direct alias of the
  same shared `shareLinkTaskMappingItemSchema` the read side uses (task
  items have no read/write case-transform asymmetry) — a single source
  of truth, not a re-declared duplicate. `saveShareConfigurationResourceItemSchema`
  stays a distinct object (owner-input `canonicalUuidSchema` vs.
  RPC-output `uuidSchema` for `resourceId` — the same read/write
  uuid-schema split this file already uses everywhere else), but reuses
  the same shared `publicLabelSchema`/`displayOrderSchema` leaves.
- No `any`, no unsafe cast, no `.passthrough()`, no duplicate vocabulary.
- The repository (`lib/share/share-links-repository.server.ts`) and the
  route (`app/api/share-links/route.ts`) needed **no code change** — both
  are pure schema-driven pass-throughs, verified directly by reading
  both files.

---

## 7. Tests Added / Updated

### Migration static tests
`supabase/migrations/202608110002_client_share_management_mapping_metadata.test.ts`
— 31 tests, static text-inspection only (no live database): exactly the
existing RPC is replaced (no new RPC); task/Resource mapping JSON
contains all four required fields each; deterministic `order by
display_order, <id>` retained, no renumbering; owner/auth guard and
revoked-link behavior retained; no secret/PIN material added; grants
remain authenticated-only; historical migrations (`202608050001`,
`202608110001`) confirmed untouched (still return the prior bare-id
shape, byte-checked).

### Application contract tests
`lib/share/share-contracts.test.ts` — new `describe` block covering:
complete-item acceptance; out-of-sequence `displayOrder` preserved
exactly through parsing (8/4 stay 8/4); every `publicGroup` value
accepted, every invalid value rejected (including the internal status
vocabulary); non-boolean `waitingForClientFeedback`/`canDownload`
rejected outright (never cast); out-of-range/non-integer `displayOrder`
rejected; missing-field and unknown-key rejection (`.strict()`);
duplicate `subtaskId`/`resourceId` rejection; explicit rejection of the
retired bare-id-array shape as `mappedTasks`/`mappedResources`.

### Editor tests
`share-link-configuration-editor.test.tsx` — see §5.

### Mechanical fixture updates (not behavioral)
`lib/share/share-links-repository.server.test.ts`,
`share-link-panel.test.tsx`, `use-share-link.test.ts`,
`share-link-client.test.ts`, `app/api/share-links/route.test.ts` — every
fixture building a management-state payload updated from
`mappedTaskIds`/`mappedResourceIds` to `mappedTasks`/`mappedResources`,
keeping every existing Phase 2A/1C test passing against the corrected
contract.

---

## 8. Static Test Results

**Targeted run** (`lib/share`, `app/components/dashboard/tasks/share-link`,
`app/api/share-links`, `supabase/migrations`): **2058 / 2058 passed, 0
failed**, across 38 test files.

**`npx tsc --noEmit -p tsconfig.json` across the full repository: 0
errors.**

**User-run full production Build: PASS.** `npm run build`, Next.js
16.1.6 (Turbopack):

- Compiled successfully in 26.7s.
- TypeScript finished successfully in 33.9s.
- Page data collection succeeded.
- Static generation succeeded: 89/89 pages.
- Final page optimization succeeded.
- No Build errors.

---

## 9. Runtime-Verification Package

**Path**: `docs/client-share-phase2b-mapping-read-runtime/`

Generated and statically self-verified (`PACKAGE_VERIFICATION_STATUS:
PASS`). Contains:

- `00_READ_ME_FIRST.md`
- `01_CREATE_TEMP_TEST_FIXTURE.sql` — same fixture pattern as the Phase
  1B/1C packages, renamed sentinel
  (`DISPOSABLE_PHASE_2B_MAPPING_RUNTIME_TEST_PROJECT`) so no package can
  be confused with another.
- `02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql` — mechanically generated
  from all nine authoritative migrations (the original eight, unchanged,
  plus `202608110002`), via a new generator script,
  `scripts/client-share/build-phase2b-mapping-read-runtime-package.ps1`,
  modeled directly on the Phase 1C generator.
- `03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql` — hand-authored real
  PostgreSQL runtime tests (Sections A–M) proving, against a real
  database: persisted task mapping metadata is returned exactly;
  persisted Resource mapping metadata is returned exactly; `displayOrder`
  is not normalized on read (8/4 and 9/2 stay 8/4 and 9/2); a partial
  edit through `save_share_configuration` preserves an untouched
  sibling's metadata byte-for-byte; exact-set replacement, empty-set
  clearing, and omitted-group-unchanged semantics all still work;
  cross-tenant management read is denied; revoked-link management state
  reads back as `link: null` with empty mapping arrays; `anon` cannot
  execute the RPC; the authenticated-only grant posture and `SECURITY
  INVOKER` mode are unchanged; the managed link object and each mapping
  item expose exactly their documented keys (no secret/PIN material, no
  storage path, no extra field); the Phase 1C publication flags and the
  latest-update body/version/publishedAt round-trip correctly. Scoped
  deliberately to this migration's own delta — it does not re-prove the
  entire Phase 1B/1C surface, which the existing 520/520-PASS and
  47/47-PASS packages already cover.
- `04_CAPTURE_RESULTS.md` — filled in with the completed, authoritative
  run (see below).
- `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md`.
- `MANIFEST.md` — mechanically generated, full file inventory and
  SHA-256 hashes.

**Runtime verification has been run and PASSED.** The user executed
files 01, 02 and (after one harness correction) file 03, in order,
against a fresh disposable Supabase project (`text2task-phase2b-runtime-temp`,
never Production):

- File 01: `fixture_status = READY`.
- File 02: every structural verification row `found = true`.
- File 03: `total_tests = 46, passed_tests = 46, failed_tests = 0,
  runtime_status = PHASE_2B_MAPPING_RUNTIME_PASS`. No FAIL rows on the
  final run.

Full evidence is recorded in
`docs/client-share-phase2b-mapping-read-runtime/04_CAPTURE_RESULTS.md`.
No Supabase project was created, accessed, or deleted by this agent at
any point — every real database interaction was performed by the user.

### Runtime harness defect and correction (2026-08-12)

The first attempt at file 03 failed immediately at Section A (`A1`,
draft creation) with `SQLSTATE P0001: INVALID_PUBLIC_ID`. Read-only
investigation found **one defect in the runtime test harness itself, not
in the product, the migration, or any RPC**:

- `create_share_link_draft(uuid,text)` requires `p_public_id` to match
  `^[A-Za-z0-9_-]{24}$` — exactly 24 characters.
- Section A1's original literal, `phase2bMappingRuntimeA1Lnk1`, was
  mechanically confirmed to be **27 characters**, failing that check.
- **Fix**: corrected to `phase2bMapReadA1Link0001` — mechanically
  verified to be exactly 24 characters and to match the required regex.
  `create_share_link_draft` itself was not touched, and no product or
  migration validation was weakened. This is the same class of defect
  (and the same fix pattern) as the Phase 1C runtime harness's own B1
  correction. No other public-id literal exists anywhere else in file 03
  (audited — `create_share_link_draft` is called exactly once).

**File 02 / migration-hash consistency, mechanically verified**: after
correcting file 03 and regenerating the package, `02_APPLY_CLIENT_SHARE_THROUGH_PHASE2B.sql`
hashed to the exact same value before and after the correction
(`90528cbfb690b99e4a6ceab64bf04a59dd18aea4ddf66a425906f4a83739dd55`), and
all nine source-migration hashes were unchanged — file 02 is built only
from the nine migrations, never from file 03. The failed first attempt
at file 03 left nothing committed (it aborted inside its own
`begin;`-opened transaction, before any `commit;`, which this script
never issues), so the same disposable project was reused for the
corrected run rather than recreated. Full detail in
`04_CAPTURE_RESULTS.md`.

---

## 10. Production State

- Migration `202608110002_client_share_management_mapping_metadata.sql`:
  **CREATED. NOT APPLIED TO PRODUCTION** (applied only to the user's own
  disposable Phase 2B runtime-verification project, per §9).
- All prior Client Share migrations: unchanged — still not applied to
  Production.
- `TEXT2TASK_CLIENT_SHARE_ENABLED`: unchanged — still disabled.
- This agent never ran SQL and never accessed, created or deleted any
  Supabase project at any point in Phase 2B — every real database
  interaction (disposable-project runtime verification, per §9) was
  performed by the user.

---

## 11. Scope Boundary Confirmation

Not implemented in this task, per the accepted Phase 2B scope: PIN/
expiry/rotation UI, native Share/WhatsApp (Phase 2C); Preview, public
projection, the public `/share/[publicId]` route, anonymous/session
exchange (Phase 2D/Phase 3); client comments, Communication History,
notifications, feedback conversion; pricing/Free/Pro logic;
email-derived owner/business identity exposure; any Production migration
application or feature enablement.

---

## 12. Exact Next Manual Verification Steps

1. ✅ Owner content-configuration editor implemented, reviewed for
   lossless reopen/edit/resave, and corrected via the additive migration
   in §2 after acceptance review found the original bare-id read
   contract insufficient.
2. ✅ Targeted static/application tests: 2058/2058 PASS. TypeScript: 0
   errors.
3. ✅ User ran files 01 and 02 of the runtime package against a
   disposable Supabase project (`fixture_status = READY`; every
   structural verification row `found = true`).
4. ✅ File 03's first run surfaced a runtime-harness-only defect
   (invalid test public-id length); read-only investigation confirmed it
   was not a product/migration defect; corrected; `02` mechanically
   confirmed byte-identical before/after.
5. ✅ User re-ran the corrected
   `docs/client-share-phase2b-mapping-read-runtime/03_RUN_PHASE2B_MAPPING_READ_RUNTIME_TESTS.sql`
   in the same disposable project: `total_tests = 46, passed_tests = 46,
   failed_tests = 0, runtime_status = PHASE_2B_MAPPING_RUNTIME_PASS`.
   Recorded in `04_CAPTURE_RESULTS.md`.
6. ✅ User ran the full production Build: Next.js 16.1.6 (Turbopack)
   compilation PASS (26.7s), TypeScript PASS (33.9s), page data
   collection succeeded, static generation 89/89 PASS, final page
   optimization succeeded, no Build errors.
7. **Pending — not yet done**: Phase 2B checkpoint commit.

**Phase 2B has passed static review, the full production Build, and real
PostgreSQL/Supabase runtime verification. The only remaining step is the
user's checkpoint commit — Phase 2C does not begin until that commit
exists.**
