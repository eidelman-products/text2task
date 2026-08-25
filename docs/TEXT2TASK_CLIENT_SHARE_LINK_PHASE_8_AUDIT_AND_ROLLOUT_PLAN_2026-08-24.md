# Text2Task Client Share — Phase 8
## Final Audit / Production Rollout Planning — Mapping / Audit Only
## 2026-08-24

---

## ⚠ ROLLOUT STATUS UPDATE — 2026-08-26 ⚠

```
ROLLOUT_STATUS: CORRECTIVE FIX VERIFIED / READY FOR PRODUCTION ROLLOUT
```

**This rollout was PAUSED 2026-08-25, and is now UN-PAUSED for the local-verification portion of the corrective fix — Production application itself has not yet occurred.** After this document's own §22 smoke-test checklist was actually run (below, as originally written: "Disable — verify the public link stops working" / "Re-enable — verify it works again"), the Re-enable step **failed**: an already-authorized browser, holding the same unchanged URL, remained permanently denied after Disable → Re-enable, with no recovery path short of a brand-new browser/incognito session. Root cause (full detail in the implementation report linked below): `project_share_links.configuration_version` was, since Phase 1B, overloaded as **both** a presentation/owner-editor freshness signal **and** the sole security-grant staleness predicate `share_session_grants` was checked against at public read time. A mechanical, broader audit (not just this one bug) proved the same defect family also affects `clear_share_link_pin`, `set_share_link_expiry`, `clear_share_link_expiry`, and `save_share_configuration`'s settings sub-block — every one of them bumps `configuration_version` for legitimate presentation reasons, and every one of them was therefore silently, permanently stranding already-authorized browsers.

**Corrective fix implemented and now runtime-verified against a real, disposable, non-Production PostgreSQL engine — not yet applied to Production.** A new forward-only migration, `supabase/migrations/202608250001_client_share_access_epoch.sql`, introduces two dedicated security-generation counters — `access_epoch` (bumped only by `rotate_share_link_secret`) and `pin_epoch` (bumped only by `set_share_link_pin`) — fully separating security-grant invalidation from `configuration_version`, which is left completely unchanged and continues to serve presentation freshness exactly as before. A companion expiry-staleness defect (grant expiry frozen at grant-creation time, unable to reflect a later-lengthened or cleared link expiry) was closed in the same change.

**Runtime disposition (2026-08-26):** a disposable Supabase runtime-verification package (`docs/client-share-phase8-access-epoch-runtime/`) was built and executed against a real disposable Postgres instance. The final scripted run reported **138/139 PASS**; the sole failure was a harness-only privilege-assertion bug (not a migration/trigger/RPC defect), independently confirmed correct at the database level by a direct read-only PostgreSQL catalog query and since corrected in the harness. Zero implementation or migration defects were found. The exact original Production regression (same-browser Disable → Re-enable) is runtime-proven fixed. Full evidence: `docs/client-share-phase8-access-epoch-runtime/04_CAPTURE_RESULTS.md`. Implementation rationale and full test evidence: **`docs/TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md`**.

**This rollout plan (§1–27 below) is otherwise still accurate** for everything it covers (migration chain, risk matrix, env inventory, security audits of every OTHER capability, rollback strategy, etc.) — it was previously superseded only on the one point the smoke test disproved: §25's "No BLOCKER exists" conclusion and the §22 smoke-test checklist's Disable/Re-enable rows. That defect is now RESOLVED and runtime-verified (disposable Postgres); the remaining gap before rollout may fully resume is the **Production** re-verification itself, per the checklist below.

**Before this rollout may resume in Production**:
1. The corrective migration (`202608250001`) must be added to the chain in §4/§5/§20 as chain position 18 (Client Share migration count becomes 15, total required count becomes 18) — applied strictly after chain position 17 (`202608230002`).
2. The full corrective change has been re-tested per the implementation report's own test evidence (2904/2904 Client Share-suite tests passing, TypeScript clean, production build clean) **and** runtime-verified against a disposable, non-Production Postgres engine (138/139 scripted PASS, sole failure independently confirmed harness-only — see above). The **Production** smoke test itself, including the exact Phase 8 regression scenario (Disable → same browser blocked → Re-enable → same browser recovers), must still be run against Production and must PASS before §21 (flag enablement) may proceed — disposable-instance verification does not substitute for this step, it only de-risks it.
3. §25's blocker table has been amended to add this defect (RESOLVED, disposable-runtime-verified, pending Production re-verification) — see the implementation report for the full corrected classification.

**No code, migration, or fix has been applied to Production at any point in this effort.** The feature flag remains untouched. Runtime verification occurred exclusively against a disposable, non-Production Postgres instance. This status update is documentation only.

---

**This document is mapping/audit/rollout-plan design only.** No application code, test, migration, generator, or SQL was written or executed to produce it. No Production system was accessed or modified. No full build was run. No stage/commit/push/deploy occurred. The feature flag was not touched. Production rollout is **not authorized** by this document.

---

## 1. Executive summary

Phase 8 audited, with direct repository evidence (not filenames, not prior summaries), whether the Client Share feature is technically ready for Production rollout. **Conclusion: technically ready, with zero true blockers, contingent on five PRE_ROLLOUT_CHECK items the user has not yet run** (§25) — none of which is a defect, all of which are verification work. The audit found the true required migration chain is larger than a filename-based scan would suggest (§4): **17 migrations total — 3 pre-existing, non-Client-Share prerequisites + 14 Client Share migrations**, mechanically recounted and enumerated this turn (§4.0) after a prior turn's own chat-only summary mis-stated the total as "16" (an arithmetic slip that never appeared in this document's own body — see §4.0's correction record). The 3 prerequisites are genuine, load-bearing dependencies, but near-certainly already live in Production as part of an unrelated, older feature, not a gap to close — verified via §9.2's preflight, not assumed. A migration's own contemporaneous header states explicitly, as of 2026-08-11, that **no Client Share migration has ever been applied to Production** — meaning every Client Share table starts genuinely empty, which trivially satisfies existing-data compatibility for 13 of the 14 Client Share migrations (§8). The one migration that alters a real, populated production table — `202608210001_client_share_project_update_provenance.sql`, Phase 6A, chain position 15 (§4.2) — does so with `NOT VALID`/`VALIDATE CONSTRAINT` splits and a provably-non-breaking backward-compatibility argument already written into its own header; this is the one MODERATE-risk item in the chain (§7), re-verified this turn directly against the live file header, not from memory. Every migration's dependency was mechanically checked to resolve against an earlier chain position — `MIGRATION_CHAIN_VERIFIED` (§6.1). The feature flag (§11) fails closed **at the code level** by default and is enforced independently at every one of 21 API route files / 25 call sites (§11.3), not merely hidden in the owner UI; the public `/share/[publicId]` page itself carries no direct gate but is functionally inert because 100% of its own data comes from those same 4 gated public route files (§11.3a) — but this turn corrected an unproven claim that flipping the flag takes effect instantly on a running deployment: that is a **hosting-platform** question this repository does not answer, and the plan now treats it as an explicit PRE_ROLLOUT_CHECK (§11.2) rather than an assumption. The global flag, once confirmed active, is intentionally an all-or-nothing kill switch — including for retained owner history — which is documented as a deliberate tradeoff separate from, and not a rewrite of, the Phase 6 per-link lifecycle rule (§11.4). Rate-limiting/cleanup grants (§17) were confirmed already correctly issued. **The Client-Share-specific environment inventory reconciles to exactly 6 variables** (§12): 1 control variable (the feature flag) + 5 crypto/security keys — corrected this turn from a prior report that stated "5" while describing only the crypto-key subset, omitting the flag itself from that specific count. No code, test, or migration change was made this turn.

**No blocker was found.** Every finding classifies as PASS, PRE_ROLLOUT_CHECK, or ROLLOUT_STEP (§25) — four PRE_ROLLOUT_CHECK items gate everything after them, none of which is itself a reason rollout would be unsafe or impossible.

---

## 2. Current checkpoint

| | |
|---|---|
| Repository | `c:\Users\Home\projects\inboxshaper` |
| Branch | `main` |
| HEAD | `e37b133` — "Complete Client Share Phase 7 hardening" |
| Branch vs. remote | `main...origin/main [ahead 19]` |
| Working tree | Clean |
| Recent commits | `e37b133` → `027629a` (Phase 6/7 handoff doc) → `0958167` (Phase 6C) → `0b10e61` (Phase 6B) → `70f2858` (Phase 6A) → `8142245` (Phase 5) |

Verified live via `git rev-parse --short HEAD`, `git log --oneline -8`, and `git status -sb` at the start of this turn — matches the prompt's own stated checkpoint exactly.

---

## 3. Phase 8 contract

Reconstructed from this turn's own instructions and `docs/Text2Task_CLIENT_SHARE_LINK_FULL_HANDOFF_2026-08-24_v7.docx` / `docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_7_AUDIT_AND_PLAN_2026-08-24.md`: Phase 6 and Phase 7 are both COMPLETE (the latter as of commit `e37b133`, with 2141/2141 regression passing, TypeScript clean, and the user's own full production build passing — 90/90 static pages, Next.js 16.1.6/Turbopack). Phase 8 is explicitly scoped to **mapping/audit and rollout-plan design only** — determining whether Production rollout is technically ready, the exact migration chain and order, preflight checks, migration risk, rollback/recovery strategy, monitoring requirements, and any remaining blocker. **No rollout execution, no Production access, no SQL, and no feature-flag change is authorized this turn.**

---

## 4. Complete migration inventory

### 4.0 — Correction record: mechanical recount (this turn)

A prior turn's own chat-only summary stated "16 total — 3 hidden prerequisites + 14 client_share migrations." **3 + 14 = 17, not 16** — an arithmetic slip in that summary's prose, confirmed by re-running `Glob supabase/migrations/*client_share*.sql` (returns exactly 14 files) and re-confirming all three prerequisite files still exist by exact filename (`ls`). The markdown document below never itself asserted "16" anywhere — that number existed only in the accompanying chat response and, separately, in the v8 handoff DOCX's own section heading (now corrected, see §"v8 handoff" record). The correct, mechanically-recounted numbered chain:

1. `202605250001_project_update_engine.sql` — **PREREQUISITE** — general Project Update Engine — creates `project_updates` — Client Share's provenance column (migration 12 below) points into it — Production must already have this (near-certain, pre-existing feature; verify via §9.2, do not re-apply)
2. `202606150001_project_update_apply_hardening.sql` — **PREREQUISITE** — general Project Update Engine — adds `project_updates`' apply-lifecycle columns/status values the shared apply transaction depends on — Production must already have this (verify via §9.2, do not re-apply)
3. `202607270001_project_completion_reconciliation.sql` — **PREREQUISITE** — general Project Update Engine — defines the CURRENT `apply_project_update_transaction`, the exact function migration 17 below reconstructs from — Production must already have this (verify via §9.2, do not re-apply)
4. `202608030003_client_share_owner_foundation.sql` — **CLIENT_SHARE** — Phase 1A — owner-facing tables foundation — Production must newly apply
5. `202608030004_client_share_session_foundation.sql` — **CLIENT_SHARE** — Phase 1A — public/ephemeral session tables — Production must newly apply
6. `202608030005_client_share_integrity_and_security.sql` — **CLIENT_SHARE** — Phase 1A — integrity triggers + first positive grants (incl. the cleanup-sweep `DELETE` grants §17 depends on) — Production must newly apply
7. `202608050001_client_share_owner_reads.sql` — **CLIENT_SHARE** — Phase 1B.1 — owner read RPCs — Production must newly apply
8. `202608060001_client_share_lifecycle_operations.sql` — **CLIENT_SHARE** — Phase 1B.2 — lifecycle RPCs + secret-material table — Production must newly apply
9. `202608060002_client_share_access_operations.sql` — **CLIENT_SHARE** — Phase 1B.3 — PIN/expiry/rotate/revoke/reveal RPCs — Production must newly apply
10. `202608060003_client_share_configuration_save.sql` — **CLIENT_SHARE** — Phase 1B.4 — `save_share_configuration` RPC — Production must newly apply
11. `202608110001_client_share_publication_intent.sql` — **CLIENT_SHARE** — Phase 1C — title/status/date visibility columns — Production must newly apply
12. `202608110002_client_share_management_mapping_metadata.sql` — **CLIENT_SHARE** — Phase 2B corrective foundation — structured mapping metadata — Production must newly apply
13. `202608130001_client_share_rate_limit_increment.sql` — **CLIENT_SHARE** — Phase 3 — atomic rate-limit increment RPC — Production must newly apply
14. `202608190001_client_share_message_owner_rpcs.sql` — **CLIENT_SHARE** — Phase 5A — reply/status-change owner RPCs — Production must newly apply
15. `202608210001_client_share_project_update_provenance.sql` — **CLIENT_SHARE** — **Phase 6A** — provenance column/FK/CHECKs on `project_updates` — Production must newly apply — **the one MODERATE-risk migration, see §7**
16. `202608230001_client_share_apply_boundary.sql` — **CLIENT_SHARE** — **Phase 6B** — apply-boundary trigger on `project_updates` — Production must newly apply
17. `202608230002_client_share_apply_conversion_closure.sql` — **CLIENT_SHARE** — **Phase 6C** — mechanically generated conversion closure — Production must newly apply

```
PREREQUISITE_COUNT:    3
CLIENT_SHARE_COUNT:    14
TOTAL_REQUIRED_COUNT:  17
```

**Phase 6A/6B/6C filename/purpose re-verification (headers re-read live, this turn, not from memory):**

| File | Header's own title (verbatim) |
|---|---|
| `202608210001_client_share_project_update_provenance.sql` | "Text2Task Client Share Link -- Phase 6A: Durable Client Update Source Provenance Foundation" |
| `202608230001_client_share_apply_boundary.sql` | "Text2Task Client Share Link -- Phase 6B DB Apply Boundary" |
| `202608230002_client_share_apply_conversion_closure.sql` | "Text2Task Client Share Link -- Phase 6C Atomic Apply + Conversion Closure" |

This matches what §4.2 (below) and §7 (risk matrix) already stated correctly — **the one MODERATE-risk migration is `202608210001` (Phase 6A, provenance), not `202608230001`.** A prior turn's own chat-only "Final Output" summary mislabeled this once, writing `"202608230001... project_update_provenance"` — conflating migration 16's filename with migration 15's purpose. That error existed only in that chat response's prose; it never propagated into this markdown document's own §4.2/§7 content, both of which have always correctly attributed provenance/MODERATE-risk to `202608210001`. No content correction was needed in this document for that specific claim — only this explicit re-verification record, added this turn so the fact is traceable rather than re-asserted from memory.

### 4.1 — Methodology (why this is not merely the 14 `client_share`-prefixed files)

Filtering `supabase/migrations/` by filename for `client_share` yields exactly 14 files. **That list alone is incomplete.** Cross-referencing this feature's own historical runtime-verification packages (`docs/client-share-phase6a-runtime/MANIFEST.md`) proved Client Share has real, load-bearing dependencies on **three earlier migrations that carry no `client_share` prefix**, because Client Share's Phase 6 provenance/Apply integration hooks directly into Text2Task's pre-existing, general-purpose Project Update Engine (first created 2026-05-25, three months before Client Share began):

| Migration | Dated | Role for Client Share |
|---|---|---|
| `202605250001_project_update_engine.sql` | 2026-05-25 | Creates `project_updates` — the table Client Share's provenance column later points into. |
| `202606150001_project_update_apply_hardening.sql` | 2026-06-15 | Adds `project_updates`' apply-lifecycle columns/status values the shared apply transaction depends on. |
| `202607270001_project_completion_reconciliation.sql` | 2026-07-27 | Defines the CURRENT, authoritative `apply_project_update_transaction` — the exact function Client Share's own closure migration (item 14 below) reconstructs from. |

These three are **prerequisite, not part of the Client Share set to newly apply** — see §4.3/§9 for the exact preflight check that verifies this assumption rather than asserting it.

### 4.2 — The 14 Client Share migrations, full detail

Every file read in full. Ordered exactly as filenames sort (confirmed to be the true dependency order — every file's header explicitly cross-references only its *predecessors* by filename; none references a later file).

**1. `202608030003_client_share_owner_foundation.sql`** — Creates the six owner-facing tables (`project_share_links`, `share_link_tasks`, `share_link_resources`, `share_link_updates`, `share_messages`, `share_message_conversions`), each with inline CHECK/UNIQUE constraints, one shared `set_client_share_updated_at()` trigger function + 4 triggers, 13 indexes (one partial-unique). RLS enabled with one owner-scoped SELECT policy per table. **28 GRANT/REVOKE statements, zero positive grants** — every table/function is revoked from every role; positive grants are deliberately deferred to file 3. Plain `create table` (no `if not exists`) — **one-time-only**, fails loudly on re-run. No backfill (brand-new, empty tables). Own header: "Applying it changes no production row and no existing production behaviour."

**2. `202608030004_client_share_session_foundation.sql`** — Creates 4 service-role-only ephemeral tables (`share_browser_sessions`, `share_session_grants`, `share_link_events`, `share_rate_limit_buckets`), 8 indexes (one more partial-unique), RLS enabled with **zero policies** (default-deny). 16 revoke statements, **zero positive grants** (explicitly deferred to file 3, same pattern as file 1). One-time-only table creation. No backfill.

**3. `202608030005_client_share_integrity_and_security.sql`** — Creates 8 cross-table integrity trigger functions + matching triggers (7 `before insert or update`, 1 `before insert` only, by design). **No table/column/index created.** ~72 GRANT/REVOKE statements — this is where the feature's **first positive grants** appear: `authenticated` gets `SELECT` on the 6 owner-facing tables; `service_role` gets `SELECT` (+ narrow column-scoped `UPDATE`/`INSERT` on two tables) plus **full `SELECT, INSERT, UPDATE, DELETE`** on `share_browser_sessions`/`share_session_grants`/`share_rate_limit_buckets` and `SELECT, INSERT, DELETE` on `share_link_events` — this is the exact grant §17 confirms the Phase 7B cleanup sweep depends on. Fully idempotent (`create or replace` + revoke/grant throughout — the first idempotent file in the chain). No backfill.

**4. `202608050001_client_share_owner_reads.sql`** — Two read-only `SECURITY INVOKER` RPCs, `get_share_link_management_state`/`list_share_link_summaries`. No table/grant-pattern change beyond function-level revoke/grant to `authenticated`. Idempotent. No backfill.

**5. `202608060001_client_share_lifecycle_operations.sql`** — Creates `project_share_secret_material` (RLS enabled, **zero policies** — the 4 new `SECURITY DEFINER` RPCs below read/write it via definer-owner implicit privilege, needing no grant). Adds 4 `SECURITY DEFINER` RPCs: `create_share_link_draft`, `activate_share_link`, `disable_share_link`, `reenable_share_link`. Table creation one-time-only (no `if not exists`); functions idempotent. No backfill.

**6. `202608060002_client_share_access_operations.sql`** — 7 more `SECURITY DEFINER` RPCs: `set_share_link_pin`, `clear_share_link_pin`, `set_share_link_expiry`, `clear_share_link_expiry`, `rotate_share_link_secret`, `revoke_share_link`, `reveal_share_link_secret`. No table/column/index/trigger/policy change — "does not add, alter or drop any RLS policy, table grant, trigger, state constraint, index or column." Idempotent. No backfill.

**7. `202608060003_client_share_configuration_save.sql`** — One `SECURITY DEFINER` RPC, `save_share_configuration` (the atomic task/resource/settings/update-publish save). No schema change of any kind. Idempotent. No backfill.

**8. `202608110001_client_share_publication_intent.sql`** — `ALTER TABLE project_share_links ADD COLUMN title_visible/status_visible/target_date_visible boolean not null default false` — a NOT-NULL-with-constant-default addition (Postgres metadata-only, no table rewrite; the `NOT VALID`/`VALIDATE` split doesn't apply to this constraint form). Two existing RPCs (`get_share_link_management_state`, `save_share_configuration`) extended in place, same signatures. One-time-only for the `ADD COLUMN` (fails if column exists); functions idempotent. Backfill is **implicit** via the constant default, applied atomically by Postgres to every pre-existing row with no explicit `UPDATE` statement and no table rewrite — own header explicitly states this is deterministic and safe for every existing row.

**9. `202608110002_client_share_management_mapping_metadata.sql`** — Extends `get_share_link_management_state` in place to return structured per-item mapping metadata instead of bare id arrays. No schema change. Idempotent. No backfill. **Load-bearing evidentiary statement, quoted directly from this migration's own header, dated 2026-08-11**: *"Client Share is still feature-gated off (`TEXT2TASK_CLIENT_SHARE_ENABLED`), no Client Share migration has ever been applied to Production, and no real user depends on the prior response shape."* This is the migration authors' own contemporaneous confirmation that, as of that date, Production had zero Client Share data — directly grounding §8's existing-data-compatibility conclusion.

**10. `202608130001_client_share_rate_limit_increment.sql`** — One `SECURITY DEFINER` RPC, `increment_share_rate_limit_bucket` (the atomic upsert-and-increment `share_rate_limit_buckets` needed all along but never implemented until this file). No new table/column/index/trigger/constraint. Notably the **only** Client Share RPC granted to `service_role` rather than `authenticated`. Idempotent. No backfill.

**11. `202608190001_client_share_message_owner_rpcs.sql`** — Two `SECURITY DEFINER` RPCs: `send_share_message_reply`, `set_share_message_status`. No schema change — explicitly fulfills a grant deferral `share_messages`' own creation migration (file 1) had documented as intentional. Idempotent. No backfill.

**12. `202608210001_client_share_project_update_provenance.sql`** — **The one migration in this set that alters a real, pre-existing, populated production table**, `project_updates` (from the unrelated Project Update Engine). Adds nullable `source_share_message_id uuid`, a `NOT VALID` FK to `share_messages(id)` **validated in the same migration**, a partial unique index, a redeclared `source_type` CHECK (adds `'client_share'` to the allowed set) also `NOT VALID` then validated immediately, a new coupling CHECK (`(source_type='client_share') = (source_share_message_id is not null))`), and one new immutability trigger. **This is the only file using the `NOT VALID`/`VALIDATE CONSTRAINT` split anywhere in the 14-file set** — used correctly, and validated in the same transaction rather than deferred. **Idempotency is mixed**: `ADD COLUMN IF NOT EXISTS` and the unique index are idempotent, but the two `ADD CONSTRAINT` statements have no preceding `DROP CONSTRAINT IF EXISTS` — a second run would fail on "constraint already exists." No explicit backfill `UPDATE`; own header states the assumption instead: *"Every existing `project_updates` row (`source_type` in `'text'/'image'/'email'/'manual'`, `source_share_message_id` null) already satisfies this constraint and is completely unaffected."* Extensive production-safety section in the header, including: *"no application code anywhere in this repository hard-deletes `public.projects`, `public.tasks`, `public.project_share_links`, or `public.share_messages` — every 'delete' action in this codebase is a soft-delete... never a real SQL DELETE."*

**13. `202608230001_client_share_apply_boundary.sql`** — One new trigger function + trigger on `project_updates` (`enforce_project_update_client_share_apply_boundary`), closing a raw-write bypass gap ahead of Phase 6C. No table/column/index/constraint change. Idempotent (`create or replace` + `drop trigger if exists`). No backfill — own header states Phase 6B application code "has never written `status='applying'` or `'applied'` for any row" as of this migration, so there is no existing data this guard could conflict with.

**14. `202608230002_client_share_apply_conversion_closure.sql`** — **Mechanically generated** (see §5). Adds one new function (`finalize_share_message_conversion`), and redefines three existing functions **in place, same signatures** (`apply_project_update_transaction`, reconstructed from file 0c/`202607270001`; `set_share_message_status`, reconstructed from file 11; `enforce_project_update_client_share_apply_boundary`, narrowed from file 13 — trigger object itself never dropped). No new table, no new column, no `ALTER TABLE` at all. Only 4 GRANT/REVOKE statements in the whole file (for the one genuinely new function) — the three redefined functions keep their existing ACLs automatically via same-signature `CREATE OR REPLACE`, independently proven by the migration's own paired test file. Fully idempotent. No backfill — own header's "SECURITY DESIGN" section documents a prior insecure draft caught by a dedicated security audit and the row-bound transaction-capability fix that resolved it.

### 4.3 — Exact ordered chain for Production (= §5)

```
0a. 202605250001_project_update_engine.sql                          [PREREQUISITE — verify already live, §9.2]
0b. 202606150001_project_update_apply_hardening.sql                 [PREREQUISITE — verify already live, §9.2]
0c. 202607270001_project_completion_reconciliation.sql              [PREREQUISITE — verify already live, §9.2]
 1. 202608030003_client_share_owner_foundation.sql
 2. 202608030004_client_share_session_foundation.sql
 3. 202608030005_client_share_integrity_and_security.sql
 4. 202608050001_client_share_owner_reads.sql
 5. 202608060001_client_share_lifecycle_operations.sql
 6. 202608060002_client_share_access_operations.sql
 7. 202608060003_client_share_configuration_save.sql
 8. 202608110001_client_share_publication_intent.sql
 9. 202608110002_client_share_management_mapping_metadata.sql
10. 202608130001_client_share_rate_limit_increment.sql
11. 202608190001_client_share_message_owner_rpcs.sql
12. 202608210001_client_share_project_update_provenance.sql
13. 202608230001_client_share_apply_boundary.sql
14. 202608230002_client_share_apply_conversion_closure.sql
```

**Why 0a/0b/0c are prerequisite, not "to apply"**: near-certainly already live (dated 3+ months before Client Share began, part of an unrelated, already-functioning feature). §9.2 defines the exact read-only check to confirm this before migrations 1–14 are applied — if it reveals Production is on an older shape, that is a real blocker (§25) requiring separate resolution first.

---

## 5. Exact migration order

See §4.3 above (kept as one section per the task's own numbered structure, cross-referenced rather than duplicated).

---

## 6. Migration dependency graph

Textual graph, built from every migration's own explicit, quoted predecessor reference (§4.2) — no dependency was inferred or assumed beyond what each file's own header states:

```
202605250001 (project_updates table)
   └─▶ 202606150001 (apply-lifecycle columns/status)
          └─▶ 202607270001 (apply_project_update_transaction, reconcile_project_completion)
                 └─▶ 202608210001 (source_share_message_id provenance column + FK to share_messages)
                        └─▶ 202608230001 (apply-boundary trigger on project_updates)
                               └─▶ 202608230002 (conversion closure — reconstructs from 202607270001,
                                                  202608190001, AND 202608230001 simultaneously)

202608030003 (owner tables: project_share_links, share_link_tasks/resources/updates, share_messages,
               share_message_conversions)
   ├─▶ 202608030004 (session/grant/rate-limit ephemeral tables — depends on project_share_links existing)
   │      └─▶ 202608030005 (integrity triggers + first positive grants — depends on ALL tables from
   │                         003 and 004 existing)
   │             ├─▶ 202608050001 (owner read RPCs — depends on 005's SELECT grants/RLS)
   │             │      └─▶ 202608110001 (visibility columns + extends 050001's RPC)
   │             │             └─▶ 202608110002 (further extends the same RPC)
   │             ├─▶ 202608060001 (lifecycle RPCs + secret-material table)
   │             │      └─▶ 202608060002 (access-op RPCs — depends on 060001's lifecycle state machine)
   │             │             └─▶ 202608060003 (save_share_configuration — depends on 060001's locking
   │             │                                pattern)
   │             ├─▶ 202608130001 (rate-limit increment RPC — depends on 004's bucket table design)
   │             └─▶ 202608190001 (message owner RPCs — depends on 003's share_messages, fulfills a
   │                                grant deferral documented IN 003's own header)
   │                    └─▶ 202608230002 (also reconstructs from here — see the cross-branch merge above)
   └── (share_messages, created here, is also the FK target for 202608210001 above)
```

**Two independent root chains merge at the final migration** (14/`202608230002`): the pre-existing Project-Update-Engine chain (0a→0b→0c→12→13) and the Client-Share-native chain (1→3→11). This is why migration 14 is the single highest-complexity file in the set — it is the only one with real dependencies reaching into both chains simultaneously, confirmed directly from its own generator script's three-source reconstruction design (§5 hash audit, below is folded into §4's own inventory — see item 14's entry).

**No circular dependency exists.** No migration references a later one.

### 6.1 — Formal per-migration dependency verification

Mechanical check: for each migration (in chain position order), what does it reference that must already exist, and which earlier chain position created it. "Resolves?" is YES only when the referenced object's creating migration is confirmed to sit at an earlier chain position.

| Pos | Migration | References | Created by (pos) | Resolves? |
|---|---|---|---|---|
| 1 | `202605250001` | (nothing — root of its chain) | — | YES (no dependency) |
| 2 | `202606150001` | `project_updates` table | 1 | YES |
| 3 | `202607270001` | `project_updates` + its apply-lifecycle columns/status values | 1, 2 | YES |
| 4 | `202608030003` | (nothing — root of the Client Share chain) | — | YES (no dependency) |
| 5 | `202608030004` | `project_share_links` (FK/reference context) | 4 | YES |
| 6 | `202608030005` | Every table from positions 4 and 5 | 4, 5 | YES (own header: "already have created every table referenced here") |
| 7 | `202608050001` | `project_share_links`/`share_link_tasks`/`share_link_resources`/`share_link_updates` SELECT grants + RLS | 6 | YES |
| 8 | `202608060001` | `project_share_links` (lifecycle state machine target) | 4 | YES |
| 9 | `202608060002` | `202608060001`'s lifecycle state machine + `project_share_secret_material` | 8 | YES |
| 10 | `202608060003` | `202608060001`'s ownership/locking pattern | 8 | YES |
| 11 | `202608110001` | `project_share_links` (ADD COLUMN target) + extends `202608050001`/`202608060003` RPCs in place | 4, 7, 10 | YES |
| 12 | `202608110002` | Extends `202608050001`'s RPC in place | 7 | YES |
| 13 | `202608130001` | `share_rate_limit_buckets` (from 5), its documented-but-unimplemented atomic-increment design | 5 | YES |
| 14 | `202608190001` | `share_messages` (from 4) + fulfills a grant deferral `202608030003`'s own header documented | 4 | YES |
| 15 | `202608210001` | `project_updates` (from 1) + `share_messages` (from 4, FK target) | 1, 4 | YES |
| 16 | `202608230001` | `project_updates` (from 1) + the `source_type='client_share'`/`source_share_message_id` shape from 15 | 1, 15 | YES |
| 17 | `202608230002` | Reconstructs from `202607270001` (3), `202608190001` (14), `202608230001` (16) simultaneously | 3, 14, 16 | YES — this is the only migration with a genuine 3-way merge dependency, and all three sources sit strictly earlier in the chain |

**Every reference resolves to an earlier chain position. No forward reference exists anywhere in the 17-migration chain.**

```
MIGRATION_CHAIN_VERIFIED
```

---

## 7. Migration risk matrix

| # | Migration | Risk | Why |
|---|---|---|---|
| 0a–0c | Project Update Engine chain | **N/A — not applied this rollout** | Prerequisite-verification only (§9.2), not something Phase 8 applies. |
| 1 | `client_share_owner_foundation` | **LOW** | Brand-new tables, zero existing rows, no lock contention possible, one-time-only creation fails loudly rather than silently drifting. |
| 2 | `client_share_session_foundation` | **LOW** | Same — brand-new, empty ephemeral tables. |
| 3 | `client_share_integrity_and_security` | **LOW** | Trigger functions + grants only; no table/column/index; fully idempotent; operates only on tables created in 1–2, which are empty. |
| 4 | `client_share_owner_reads` | **LOW** | Two new read-only functions; no schema change. |
| 5 | `client_share_lifecycle_operations` | **LOW** | One new empty table + 4 new functions; no existing-table alteration. |
| 6 | `client_share_access_operations` | **LOW** | Functions only, explicitly no schema change. |
| 7 | `client_share_configuration_save` | **LOW** | One function, explicitly no schema change. |
| 8 | `client_share_publication_intent` | **LOW** | `ADD COLUMN ... NOT NULL DEFAULT` on `project_share_links` — metadata-only in Postgres (no table rewrite for a constant default), and the table is still empty in Production at this point in the chain (nothing has activated a link yet, since activation itself is gated behind the feature flag which has never been on). |
| 9 | `client_share_management_mapping_metadata` | **LOW** | Function-only change; own header explicitly confirms zero Production data exists for this feature as of its own authoring date. |
| 10 | `client_share_rate_limit_increment` | **LOW** | One new function, explicitly no new table/column/index/constraint. |
| 11 | `client_share_message_owner_rpcs` | **LOW** | Functions only. |
| 12 | `client_share_project_update_provenance` | **MODERATE** | The one migration altering a real, populated production table (`project_updates`). Mitigants directly in its own header: nullable column (no rewrite forcing function), `NOT VALID`→immediate `VALIDATE` split used correctly (avoids a long exclusive table lock scanning the whole table under a blocking `ADD CONSTRAINT`), and an explicit, checked argument that every existing row already satisfies the new coupling CHECK. Residual risk is entirely about lock duration on a live table during `VALIDATE CONSTRAINT` (which takes a lock weaker than `ACCESS EXCLUSIVE` but still scans the full table) — proportional to `project_updates`' current row count, which this audit did not and could not measure (Production access is out of scope this turn). **This is the one migration where the user should confirm current row count via §9's preflight before applying**, purely to set expectations for how long `VALIDATE CONSTRAINT` will take — not because it is unsafe. |
| 13 | `client_share_apply_boundary` | **LOW** | Trigger-only addition to `project_updates`; own header confirms no existing row could conflict (Phase 6B application code had never written the guarded status value as of this migration). |
| 14 | `client_share_apply_conversion_closure` | **LOW** | No `ALTER TABLE`, no new trigger, no new table — pure function redefinition (`CREATE OR REPLACE`, same signatures) plus one new function. Mechanically generated and hash-verified (§4.2 item 14). |

**No HIGH_RISK migration exists in this chain.** The single MODERATE item (12) is moderate only in the "touches a live table" sense, not in the "could silently corrupt or break existing behavior" sense — its own header already anticipated and argued the exact concern this risk classification raises.

---

## 8. Existing-data compatibility

**Foundational fact, not assumed**: migration 9's own header (§4.2) states explicitly, as of 2026-08-11, that *"no Client Share migration has ever been applied to Production."* Combined with the feature flag's fail-closed default (§11) and the fact that every Client Share table is created fresh by migrations 1–2 with **zero pre-existing rows possible** (they don't exist yet), **13 of the 14 migrations have no existing-Client-Share-data compatibility question at all** — there is no data to be compatible or incompatible with.

The one exception is migration 12, against the **pre-existing** `project_updates` table, which does have real rows (from the unrelated Project Update Engine, live since 2026-05-25). Compatibility question: does every existing row already satisfy the new `source_type` CHECK (widened to include `'client_share'`) and the new coupling CHECK? Migration 12's own header answers yes, by construction — every existing row has `source_type` in the original four values and `source_share_message_id` null, which trivially satisfies `(source_type='client_share') = (source_share_message_id is not null)` (both sides false). No nullable-column-without-default risk, no unique-index risk (partial index only applies where the new column is non-null, which is never true for a pre-existing row), no FK-validation risk (same reasoning — the FK only constrains non-null values).

**Preflight query to independently confirm this, read-only** (extends §9.2):
```sql
select source_type, count(*), count(*) filter (where source_share_message_id is not null) as with_provenance
from public.project_updates
group by source_type;
```
Expected: `with_provenance = 0` for every row (since the column doesn't exist in Production yet, this query itself would fail with "column does not exist" until AFTER migration 12 applies — the real pre-migration check is simply confirming `source_type` never already contains the literal string `'client_share'`, which migration 12's own `NOT VALID` CHECK would otherwise reject on `VALIDATE`):
```sql
select count(*) from public.project_updates where source_type = 'client_share';
-- Expected: 0 (this value cannot exist yet — no code path writes it before this migration chain applies)
```

**No other existing-data compatibility question exists in this migration set.**

---

## 9. Production preflight — required evidence map

### 9.1 — Purpose

Exact read-only queries the user will run against Production before applying anything — this turn does not access or query Production itself. Classifies every relevant object as **EXISTS_CORRECT**, **MISSING**, **EXISTS_DIFFERENT**, or **UNKNOWN**.

### 9.2 — Prerequisite-chain verification (§4.3's 0a/0b/0c)

```sql
-- project_updates: does it exist with the expected apply-lifecycle shape?
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'project_updates'
order by ordinal_position;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.project_updates'::regclass
  and conname = 'project_updates_status_check';

-- Is the CURRENT (post-202607270001) apply_project_update_transaction / reconcile_project_completion
-- already installed?
select pg_get_functiondef(oid) from pg_proc
where proname = 'apply_project_update_transaction' and pronamespace = 'public'::regnamespace;

select pg_get_functiondef(oid) from pg_proc
where proname = 'reconcile_project_completion' and pronamespace = 'public'::regnamespace;

-- Does source_type = 'client_share' already exist anywhere (should be impossible pre-migration 12)?
select count(*) from public.project_updates where source_type = 'client_share';
```

Expected: `EXISTS_CORRECT` for the first four checks (presumed pre-existing infrastructure); `0` for the last. Any deviation is a blocker (§25) — investigate before migrations 1–14 proceed.

### 9.3 — Client Share objects (expected MISSING before rollout)

```sql
-- Tables
select table_name from information_schema.tables
where table_schema = 'public' and table_name in (
  'project_share_links', 'share_browser_sessions', 'share_session_grants',
  'share_rate_limit_buckets', 'share_link_events', 'project_share_secret_material',
  'share_link_tasks', 'share_link_resources', 'share_link_updates', 'share_messages',
  'share_message_conversions'
);

-- Functions/RPCs
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in (
  'get_share_link_management_state', 'list_share_link_summaries', 'save_share_configuration',
  'create_share_link_draft', 'activate_share_link', 'disable_share_link', 'reenable_share_link',
  'set_share_link_pin', 'clear_share_link_pin', 'set_share_link_expiry', 'clear_share_link_expiry',
  'rotate_share_link_secret', 'revoke_share_link', 'reveal_share_link_secret',
  'increment_share_rate_limit_bucket', 'send_share_message_reply', 'set_share_message_status',
  'finalize_share_message_conversion', 'enforce_project_update_client_share_apply_boundary',
  'set_client_share_updated_at'
);

-- Triggers
select tgname, tgrelid::regclass from pg_trigger
where tgname ilike '%client_share%' or tgname ilike '%share_%';

-- RLS enabled state
select relname, relrowsecurity, relforcerowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relname in (
  'project_share_links', 'share_browser_sessions', 'share_session_grants',
  'share_rate_limit_buckets', 'share_messages', 'share_message_conversions',
  'project_share_secret_material'
);

-- Policies
select schemaname, tablename, policyname, roles, cmd, qual from pg_policies
where schemaname = 'public' and (tablename ilike 'share_%' or tablename = 'project_share_links');

-- Grants — the specific check §17 depends on
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('share_rate_limit_buckets', 'share_session_grants', 'share_browser_sessions')
order by table_name, grantee, privilege_type;
```

Expected: `MISSING` for every object (brand-new rollout). Any `EXISTS_*` result is unexpected and should be investigated as a blocker before proceeding — it would mean someone hand-applied a partial/older version outside this migration chain.

**No destructive SQL anywhere in this document** — every query above is a pure read.

---

## 10. App/schema compatibility matrix

| Codebase surface | Hard schema dependency |
|---|---|
| Owner dashboard "Open Share Link" entry point | Nothing beyond the feature flag itself (client-side hide only) |
| `app/api/share-links/**` (17 routes) | Migrations 1–11 (owner tables, RPCs) |
| `app/share/[publicId]` page shell | None (renders unconditionally, data-free) |
| `app/api/share/session`, `/projection`, `/messages`, `/resources/[fileRef]` | Migrations 1–3, 10 (public tables, integrity triggers, rate-limit RPC) |
| Owner "Analyze as client update" | Migrations 11–12 (message RPCs, provenance column) |
| Owner "Apply" (shared with the general Project Update Engine) | Migrations 0a–0c (pre-existing) + 12–14 (Client Share's own boundary/closure) |
| Phase 7B cleanup sweep (`share-state-cleanup.server.ts`) | Migration 3 (the `service_role` DELETE grants) |

**Deployment-order scenarios, derived from the live code (not guessed):**

- **A. App deployed before all migrations land**: Safe. Every Client Share route independently calls `assertClientShareEnabled()` first (§11) — with the flag off (its default, fail-closed), every route 404s regardless of whether the underlying tables/functions exist yet. The one exception, `app/share/[publicId]/page.tsx`, renders unconditionally but is "a DATA-FREE server shell" (confirmed by Agent evidence) that performs no Supabase call itself — it hands off to a client component whose own data fetches are the gated routes. No 500 error, no partial-schema crash is possible from app code running ahead of migrations, because the flag being off (the actual state until the user explicitly flips it) makes the schema question moot.
- **B. Migrations land before app deploy**: Safe and the recommended order (§20) — the schema simply sits unused (new tables, empty, no route calls them yet) until the matching app code deploys.
- **C. App deploy partially fails**: No schema-side consequence — migrations are independent of the app deploy transaction (this repo has no CI-driven combined deploy; migrations are applied by hand via SQL Editor, per this feature's own established convention, confirmed by `docs/client-share-phase*-runtime/` packages). A partially-failed app deploy simply means the old app code (which also gates on the same flag) keeps serving.
- **D. Old app version runs against new (post-migration) schema**: Safe — old code never references any new table/function; new tables/columns are additive only (13 of 14 migrations touch nothing the old app reads; migration 12's new column on `project_updates` is nullable and ignored by old code that doesn't select it).
- **E. New app version runs against old (pre-migration) schema**: **Unsafe if the flag were on**, but the flag's own default (off) prevents this from mattering — every Client Share route would 404 before reaching any RPC that doesn't exist yet. This is exactly why §20's rollout order applies migrations before ever flipping the flag on, even though the flag itself would technically make the ordering forgiving.

**Safest order, derived from the above**: migrations first (B), app deploy second (regardless of A/D since the flag keeps both safe), flag last (§20/§21) — not because A or D would break anything, but because there's no reason to rely on the flag as the only safety net when a strictly safer order is free.

---

## 11. Feature-flag audit

### 11.1 — A. Code semantics (directly evidenced from the repository)

**Exact env var**: `TEXT2TASK_CLIENT_SHARE_ENABLED` (confirmed the only spelling used anywhere in the repo).

**Parsing** (`lib/share/share-availability.server.ts:33-39`): `value?.trim().toLowerCase() === "true"` — exact-literal match only (`"1"`, `"yes"` do NOT enable it), case-insensitive, trimmed.

**Read timing**: `process.env.TEXT2TASK_CLIENT_SHARE_ENABLED` is read **fresh on every call** to `isClientShareEnabled()`/`assertClientShareEnabled()` — not captured once into a module-level constant at import time, not memoized. Confirmed directly from the function body: the `process.env` read happens *inside* `isClientShareEnabled()`'s own function body, executed at call time, not at module top-level. This module additionally `import`s `"server-only"`, so it cannot be bundled into client code at all.

**Default when absent**: **disabled** (fail-closed) — `undefined === "true"` is `false`. Independently confirmed by the module's own test file.

**Not `NEXT_PUBLIC_`-prefixed** — never baked into the client bundle at build time; this is a server-only variable by Next.js's own convention (only `NEXT_PUBLIC_*` variables are inlined into client bundles at build time — this one is not).

**What this proves, precisely**: *within a single running Node.js process*, if `process.env.TEXT2TASK_CLIENT_SHARE_ENABLED` changes (e.g. because the host mutates the process's environment in place), the very next call to `isClientShareEnabled()` would observe the new value — there is no in-process caching to go stale. **This is a narrower claim than "no rebuild/redeploy is needed"** — it says nothing about whether the specific hosting platform actually mutates a *running* process's environment when a dashboard/CLI env-var change is made, versus only applying the new value to a *subsequently started* process (a redeploy/restart). That is a hosting-platform question, not a code question, and code alone cannot answer it (§11.2).

### 11.2 — B. Hosting / deployment activation semantics (NOT proven by this repository — conservative wording required)

No `vercel.json`, no deployment-configuration file, and no repository evidence of any kind was found that proves how this specific project's hosting platform propagates an environment-variable change to already-running server instances. Confirmed absent by direct check (`vercel.json` does not exist in this repo). **This audit does not assume Vercel's general platform behavior** — general platform knowledge is not repository evidence, and the task's own instruction is explicit that hosting behavior must not be guessed.

**Conservative operational requirement, adopted verbatim in place of any assumption**:

> Environment-variable activation semantics must be confirmed at rollout; do not assume a changed Vercel environment variable affects an already running deployment without redeployment/restart.

**Consequence for planning**: §20 (rollout order) and §23 (kill-switch) must both be read as requiring the user to **verify, at the moment they change the flag (in either direction), whether their specific hosting setup requires a redeploy/restart for it to take effect** — and to treat "redeploy required" as the default planning assumption unless/until the user confirms otherwise for their own environment. This does not change §11.1's code-level conclusion (the *code* itself reads live, has no in-process staleness) — it only withholds an unproven claim about the *host's* propagation behavior.

### 11.3 — What the flag gates, and exact route/file/call-site count (mechanically recounted this turn)

- **UI-only** (`app/components/dashboard/tasks-view.tsx:734-738,779`): whether the "Open Share Link" entry point is wired to a real handler or `undefined` — hides a dashboard button only, gates no route or RPC by itself. Own code comment states this explicitly: *"the real security boundary is each `app/api/share-links/**` route's own server-side `assertClientShareEnabled()` call, which this prop never replaces."*
- **Server-side, independently, on every route that touches Client Share data** — re-grepped this turn directly (`grep -rn "assertClientShareEnabled()" app/`), full enumeration:

| # | File | Surface | Call site(s) | Disabled behavior |
|---|---|---|---|---|
| 1 | `app/api/share-links/route.ts` | Owner | line 60 (GET), line 120 (POST) — 2 sites | Generic 404 |
| 2 | `app/api/share-links/summary/route.ts` | Owner | line 53 | 404 |
| 3 | `app/api/share-links/history-link/route.ts` | Owner | line 62 | 404 |
| 4 | `app/api/share-links/[id]/activate/route.ts` | Owner | line 55 | 404 |
| 5 | `app/api/share-links/[id]/disable/route.ts` | Owner | line 53 | 404 |
| 6 | `app/api/share-links/[id]/enable/route.ts` | Owner | line 53 | 404 |
| 7 | `app/api/share-links/[id]/revoke/route.ts` | Owner | line 48 | 404 |
| 8 | `app/api/share-links/[id]/rotate/route.ts` | Owner | line 50 | 404 |
| 9 | `app/api/share-links/[id]/reveal/route.ts` | Owner | line 50 | 404 |
| 10 | `app/api/share-links/[id]/pin/route.ts` | Owner | line 52 (PUT), line 133 (DELETE) — 2 sites | 404 |
| 11 | `app/api/share-links/[id]/expiry/route.ts` | Owner | line 52 (PUT), line 143 (DELETE) — 2 sites | 404 |
| 12 | `app/api/share-links/[id]/config/route.ts` | Owner | line 209 | 404 |
| 13 | `app/api/share-links/[id]/preview/route.ts` | Owner | line 61 | 404 |
| 14 | `app/api/share-links/[id]/messages/route.ts` | Owner | line 53 | 404 |
| 15 | `app/api/share-links/[id]/messages/reply/route.ts` | Owner | line 63 | 404 |
| 16 | `app/api/share-links/[id]/messages/[messageId]/route.ts` | Owner | line 63 | 404 |
| 17 | `app/api/share-links/[id]/messages/[messageId]/analyze/route.ts` | Owner | line 72 | 404 |
| 18 | `app/api/share/session/route.ts` | Public | line 118 | 404 |
| 19 | `app/api/share/[publicId]/projection/route.ts` | Public | line 89 | 404 |
| 20 | `app/api/share/[publicId]/messages/route.ts` | Public | line 149 (POST), line 323 (GET) — 2 sites | 404 |
| 21 | `app/api/share/[publicId]/resources/[fileRef]/route.ts` | Public | line 156 | 404 |

**Corrected count, mechanically verified**:

```
OWNER_API_ROUTE_FILE_COUNT:      17
PUBLIC_API_ROUTE_FILE_COUNT:      4
API_ROUTE_FILE_TOTAL:            21
API_GATE_CALL_SITE_COUNT:        25   (21 files; 4 of them — share-links/route.ts,
                                        pin/route.ts, expiry/route.ts,
                                        share/[publicId]/messages/route.ts —
                                        gate two HTTP methods separately)
```

This matches the prior report's "21" figure as a **file** count, but that figure was previously presented ambiguously ("every one of 21 routes") without distinguishing file count from call-site count. Both are now stated explicitly.

### 11.3a — Public page surface, reconciled separately (not conflated with the API route count)

`app/share/[publicId]/page.tsx` — the actual public **page**, distinct from the 4 public **API route files** counted above — carries **no direct `assertClientShareEnabled()` call of its own** and returns HTTP 200 unconditionally regardless of the flag. **It is not counted as a gated file, and this document does not artificially call it an API route to make the counts match:**

```
PUBLIC_PAGE_GATE_SURFACE_COUNT:   0   (the page file itself has zero direct gate calls)
```

The page is nonetheless rendered **functionally inert** when the flag is off, but *indirectly*, not through its own gate: it is confirmed, directly from its own source, to be "a DATA-FREE server shell" that performs no Supabase call itself and hands off entirely to a client component (`ShareView`). Every one of that client component's own data-fetching calls (`POST /api/share/session`, `GET /api/share/[publicId]/projection`, `GET/POST /api/share/[publicId]/messages`, `GET /api/share/[publicId]/resources/[fileRef]`) targets one of the 4 public API route files already counted in `API_ROUTE_FILE_TOTAL` above, each of which independently 404s when the flag is off. `proxy.ts` (the header-attaching layer for `/share/**`) does not read the flag at all and does not gate anything — confirmed by grep, it contains no reference to `CLIENT_SHARE`.

**Final global-flag-coverage statement, suitable for Production documentation, using only what was actually proven**:

> The global Client Share flag is enforced directly across 21 API route files (25 HTTP-method gate call sites: 17 owner-authenticated files, 20 call sites; 4 public files, 5 call sites). The public `/share/[publicId]` page itself carries no direct gate and renders unconditionally, but is rendered functionally inert when the flag is off because 100% of its own data comes from the 4 gated public API route files already counted above — there is no third, separate gating mechanism on the page or in `proxy.ts`.

### 11.4 — Global flag vs. per-link lifecycle (two separate controls — neither rewrites the other)

**These are two distinct, independent mechanisms, and this audit does not conflate them:**

1. **Per-link lifecycle** (established Phase 6 rule, unchanged, not touched by anything in Phase 7 or Phase 8): a specific link being disabled/expired/revoked does **not**, by itself, block the owner from reading Communication History or performing Analyze/Apply on that link's retained messages — confirmed in §15/§16, e.g. message history and Analyze routes apply no link-state filter, only ownership. **This rule stands exactly as Phase 6 established it and is not being rewritten here.**
2. **Global feature flag** (`TEXT2TASK_CLIENT_SHARE_ENABLED`, a completely separate control): re-verified directly from row 14 (`messages/route.ts:53`) and row 17 (`analyze/route.ts:72`) of §11.3's table above — **both call `assertClientShareEnabled()` as their first statement, with no exception for retained/historical data.** When the *global* flag is off, these routes 404 **regardless of any individual link's own state.**

**Conclusion, stated plainly so it cannot be misread as a change to the Phase 6 rule**: a *single link* being disabled/expired/revoked never blocks retained-history Analyze/Apply (Phase 6 rule, intact). The *global* flag being off blocks **everything**, including retained-history Analyze/Apply, for **every** link, as a deliberate, documented emergency-kill-switch tradeoff — not as a rewrite of the per-link rule, but as a second, independent, coarser control layered on top of it. §23 documents this tradeoff prominently as required.

---

## 12. Environment / secret inventory

### 12.0 — Correction record: category reconciliation (this turn)

A prior turn's own correction pass reported "Env-key names and verified count: 5" — accurate **only for the crypto/HMAC key category**, but the original Phase 8 contract asked for ALL environment variables/secrets required by Client Share, which also includes the feature flag itself (`TEXT2TASK_CLIENT_SHARE_ENABLED`, §11) — a Client-Share-specific env var in its own right, just not a crypto key. That prior "5" was never wrong as a crypto-key count, but calling it "the complete Client Share-specific environment inventory" without the flag was imprecise. Reconciled into three explicit categories below, mechanically re-verified this turn:

```
CLIENT_SHARE_CONTROL_ENV_COUNT:          1   (the feature flag)
CLIENT_SHARE_CRYPTO_ENV_COUNT:           5   (unchanged from the prior count)
TOTAL_CLIENT_SHARE_SPECIFIC_ENV_COUNT:   6   (1 + 5)
```

Also corrected in the same pass: the "generic infrastructure" category previously listed only 2 variables (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`) — re-tracing the actual Supabase client factories Client Share code calls (`lib/supabase/server.ts`, used by every owner/public route's `createClient()`; `lib/supabase/admin.ts`, used by `supabaseAdmin` calls) found a **third** generic variable, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`lib/supabase/server.ts:9`), previously missed. Now 3, not 2.

### 12.A — Category A: Client Share CONTROL env vars

```
1. TEXT2TASK_CLIENT_SHARE_ENABLED     (lib/share/share-availability.server.ts:38)
```

Confirmed the only variable of this kind (re-grepped `TEXT2TASK_CLIENT_SHARE_[A-Z_]+` across `lib/` this turn — no second flag/control variable exists).

### 12.B — Category B: Client Share CRYPTO/SECURITY key env vars

```
1. TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1              (lib/share/share-secret.server.ts:41)
2. TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1         (lib/share/share-secret-encryption.server.ts:43)
3. TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1             (lib/share/share-file-ref.server.ts:29)
4. TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1              (lib/share/share-browser-session.server.ts:31)
5. TEXT2TASK_SHARE_NETWORK_IDENTITY_HMAC_KEY_V1     (lib/share/share-identity.server.ts:48)
```

Re-confirmed unchanged. All 5 are read lazily (per-call, never at module load), decoded from base64url, length-validated, and **fail closed with a typed error if missing or malformed** — no silent fallback exists for any of them. No value of any of these is printed anywhere in this document.

### 12.C — Category C: generic application infrastructure env vars (not Client-Share-specific)

```
1. NEXT_PUBLIC_SUPABASE_URL          (lib/supabase/server.ts:8, lib/supabase/admin.ts:4)
2. NEXT_PUBLIC_SUPABASE_ANON_KEY     (lib/supabase/server.ts:9)   -- newly identified this turn
3. SUPABASE_SERVICE_ROLE_KEY         (lib/supabase/admin.ts:5)
```

These back the two Supabase client factories every Client Share route ultimately calls (`createClient()` for the RLS-bound/cookie-authenticated client every owner and public route uses; `supabaseAdmin` for the 7 files needing service-role access) — but the variables themselves are app-wide, pre-existing configuration, not something Client Share defines or owns. Client Share would fail the same way any other feature reading these clients would if they were absent.

### 12.1 — Required-vs-conditional semantics, precisely stated

| Env var | Category | Required when feature **disabled**? | Required when feature **enabled**? | Default if absent | Failure behavior | Read timing | Changing it affects existing links/grants/fileRefs/reveal? |
|---|---|---|---|---|---|---|---|
| `TEXT2TASK_CLIENT_SHARE_ENABLED` | A (control) | **No** — its own absence *is* how the feature stays disabled; nothing else in the app depends on it being set | N/A — setting it to `"true"` is what defines "enabled" | Disabled (fail-closed) | No exception — every gated route simply 404s | Server-runtime, read fresh per-call (§11.1) | No — it is not a secret and holds no cryptographic material; changing it only changes availability, never invalidates existing data |
| `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` | B (crypto) | **No** — never read by any code path unless a Client Share route is actually invoked, and every such route already 404s first when the flag is off (§11.3), so this key is never reached while disabled | **Yes** — a genuine deployment prerequisite for enabling the feature, not a requirement for running the rest of Text2Task | None — throws | `ShareSecretError("hmac_key_missing")`; ≥32 bytes or `hmac_key_too_short` | Server-runtime, lazy, per-call | **Yes** — changing it after real links exist breaks verification for every existing link's secret (§13) |
| `TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` | B (crypto) | **No** — same reasoning | **Yes** — deployment prerequisite for enabling | None — throws | `ShareSecretEncryptionError("encryption_key_missing")`; exactly 32 bytes or `encryption_key_wrong_length` | Server-runtime, lazy, per-call | **Yes** — breaks the reveal/re-copy path for every existing encrypted secret (§13) |
| `TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1` | B (crypto) | **No** — same reasoning | **Yes** — deployment prerequisite for enabling | None — throws | `ShareFileRefError("hmac_key_missing")`; ≥32 bytes | Server-runtime, lazy, per-call | **Yes** — silently invalidates every previously-issued file URL (§13) |
| `TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1` | B (crypto) | **No** — same reasoning | **Yes** — deployment prerequisite for enabling | None — throws | `ShareBrowserSessionError("hmac_key_missing")`; ≥32 bytes | Server-runtime, lazy, per-call | **Yes** — logs out every open anonymous browser session (§13) |
| `TEXT2TASK_SHARE_NETWORK_IDENTITY_HMAC_KEY_V1` | B (crypto) | **No** — same reasoning | **Yes** — deployment prerequisite for enabling | None — throws | `ShareIdentityError("identity_configuration_invalid")`; ≥32 bytes | Server-runtime, lazy, per-call | No access-invalidation consequence — ephemeral bucketing only (§13) |
| `NEXT_PUBLIC_SUPABASE_URL` | C (generic) | **Yes** — required for the app generally, unrelated to Client Share | Yes | None — non-null-asserted | Downstream Supabase client construction failure; app-wide, not Client-Share-specific | Build/module load (`NEXT_PUBLIC_`) | Not a Client-Share-specific concern |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | C (generic) | **Yes** — required for the app generally | Yes | None — non-null-asserted | Downstream Supabase client construction failure | Build/module load (`NEXT_PUBLIC_`) | Not a Client-Share-specific concern |
| `SUPABASE_SERVICE_ROLE_KEY` | C (generic) | **Yes** — required for the app generally (used well beyond Client Share) | Yes | None — non-null-asserted | Downstream Supabase client construction failure | Server-runtime | Not a Client-Share-specific concern |

**Key clarification, precisely worded per this turn's own instruction**: `TEXT2TASK_CLIENT_SHARE_ENABLED` is **not** a crypto key and is the only Client Share env var that defaults safely to a working (disabled) state when absent. The 5 Category B crypto keys are **not required to run the rest of Text2Task with Client Share disabled** — they are only reached once a route call actually passes the flag gate — but they **are** a genuine deployment prerequisite that must be in place **before** the flag is ever switched on, since the first request against an enabled-but-unkeyed deployment would throw rather than degrade gracefully.

**No PIN pepper/global salt exists** — `share-pin.server.ts` uses only a per-row random 16-byte salt (`randomBytes(16)`), no environment variable read anywhere in that file.

**No app-origin/base-URL environment variable exists for share-link construction** — grepped and confirmed absent from `lib/share/**`/`app/api/share-links/**`. The owner-facing share URL's origin is built **client-side** from `window.location.origin` at copy/share time — Production simply needs to be served from its real domain for this to be correct, no server env var configures it.

---

## 13. Crypto / key-preservation requirements

Every one of the five Client-Share-specific HMAC/encryption keys (§12) has a **version column already designed into its schema** specifically to allow future rotation without mass invalidation (`secret_digest_version`, `encryption_version`, `digest_version`) — **but no dual-key/version-dispatch verification code was found evidenced in the application layer for any of them.** This means, as currently implemented, each key is effectively a single active value: changing it accidentally in Production, after real links exist, has a real and specific consequence per key:

| Key | Consequence if changed after links exist |
|---|---|
| `TEXT2TASK_SHARE_SECRET_HMAC_KEY_V1` | Every existing public URL's secret would no longer verify against its stored `secret_digest` — **all existing links break** (client-side "invalid/expired link" outcome), until re-activated/rotated under the new key. |
| `TEXT2TASK_SHARE_SECRET_ENCRYPTION_KEY_V1` | `reveal_share_link_secret`'s decrypt step (GCM auth-tag check) fails closed for every already-encrypted row — **owners lose the ability to re-copy/re-share any existing active link's URL** until re-encrypted; the link itself, if the client already has the URL, may still work (this key doesn't affect the digest-verification path, only the reveal/re-copy convenience path) — but this needs confirming against the real code before relying on it, not assumed here as certain. |
| `TEXT2TASK_SHARE_FILE_REF_HMAC_KEY_V1` | `fileRef` values are never persisted (re-derived on every request) — changing this key **silently and immediately invalidates every previously-issued file URL** a client browser might have open or bookmarked; no version dispatch exists to soften this. |
| `TEXT2TASK_SHARE_SESSION_HMAC_KEY_V1` | Every existing anonymous browser session's cookie digest stops matching — **all currently-open client browser sessions are logged out** of their Client Share access, forcing re-exchange (which itself works fine if the client still has the original link URL — the fragment secret, not the session, is the durable credential). |
| `TEXT2TASK_SHARE_NETWORK_IDENTITY_HMAC_KEY_V1` | No access-invalidation consequence — used only for ephemeral rate-limit bucketing and audit-event digests; a change simply starts fresh buckets, old ones expire on their own TTL. |

**Key-preservation requirement before rollout**: the four `Required` keys in §12 (secret, secret-encryption, fileRef, session) must be generated **once**, stored securely in the Production environment, and **never regenerated/rotated casually** — each has a real, user-visible breakage mode if changed unexpectedly, as tabulated above. This is a one-time setup requirement, not a rollout blocker (§25) — it only becomes a risk if someone changes these values *after* go-live without understanding the consequence table above.

---

## 14. Public route security final audit

Re-verified against the LIVE current code for all five anonymous public routes.

| Route | no-store | X-Robots-Tag | Referrer-Policy | nosniff | CSP | Permissions-Policy |
|---|---|---|---|---|---|---|
| `/share/[publicId]` (page) | ✓ | ✓ | ✓ | ✓ | ✓ `frame-ancestors 'none'; object-src 'none'; base-uri 'none'` | ✓ |
| `POST /api/share/session` | ✓ | ✓ | ✓ | ✓ | — (JSON API) | ✓ |
| `GET /api/share/[publicId]/projection` | ✓ | ✓ | ✓ | ✓ | — (JSON API) | ✓ |
| `GET/POST /api/share/[publicId]/messages` | ✓ | ✓ | ✓ | ✓ | — (JSON API) | ✓ |
| `.../resources/[fileRef]` — error branches | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `.../resources/[fileRef]` — success (file-stream) | ✓ | ✓ | ✓ | ✓ | ✓ `sandbox; frame-ancestors 'none'` (a different string than the page's CSP) | ✓ |

**Nuance, not a defect**: CSP is present only where an HTML/streamable body exists — JSON API routes correctly never carry one; the file route's success branch carries its own, intentionally different `sandbox`-based CSP to prevent a streamed file from ever being framed/executed as the page. Matches the Phase 7A implementation record exactly.

**Rate limiting** (`lib/share/share-rate-limit.server.ts:39-71`): `session_exchange` 10/300s, `pin_verification` 5/300s, `projection_read` 120/300s, `invalid_link_access` 20/300s, `comment_submission` 10/300s, `file_access` 60/300s. Fails closed on limiter RPC error.

**Malformed-request metering**: confirmed the rate-limit check is the literal first statement in both `POST /api/share/session` and `POST /api/share/[publicId]/messages`, before origin validation and before body parsing.

**Stale-tab revalidation**: unchanged since Phase 7C — 60s interval + focus/visibility triggers, fail-closed on access loss.

**No third-party analytics/session replay on `/share/**`**: `shouldSkipAnalyticsPath()` independently wired into all five analytics-capable components, each gating before rendering/capturing anything.

**Result: PASS on every item.** No code change made or needed.

---

## 15. Owner route final audit

Every owner-authenticated capability, re-verified. **Global facts** (not repeated per row): auth via `supabase.auth.getUser()`; feature-flag gate is `assertClientShareEnabled()`, first statement in every handler; every response carries `SHARE_LINKS_NO_STORE_HEADERS`; every RPC call goes through the RLS-bound client, never `supabaseAdmin`.

| Capability | Ownership check | Destructive/terminal? |
|---|---|---|
| Create/draft | Project `user_id` match, not deleted/archived | No |
| Save configuration | Link `user_id` match + row lock | No — versioned, set-replace |
| Activate | Link `user_id` match, re-verified at lock | No |
| Disable | Link `user_id` match + lock | No — reversible |
| Re-enable | Link `user_id` match | No |
| Revoke | Link `user_id` match + lock | **Yes — terminal.** Already-revoked returns a state conflict rather than replaying; schema comment: "permanently revokes ... terminal." |
| Rotate secret | Link `user_id` match | Link stays usable; **old secret permanently unusable** — primary leaked-link remediation |
| Set/clear PIN | Link `user_id` match + lock, both directions | No — reversible, idempotent clear |
| Set/clear expiry | Link `user_id` match + lock | No — reversible, except clearing while expired is rejected (state restriction, not destruction) |
| Reveal secret | Link `user_id` match, plain read | No — repeatable, "not a new grant of access," no side effects |
| Preview | `userId`-scoped projection build | No — pure read, no view-count/session side effects |
| Management-state/summary/history | Project/link `user_id` scoping throughout; history variant deliberately includes revoked links | No — pure reads |
| Message history | Link ownership verified BEFORE the messages read | No — readable regardless of link state |
| Reply | Link `user_id` match + cross-link-mismatch rejection even for the same owner | No — append-only, immutable after insert |
| Message status change | `messageId` verified to belong to link+owner BEFORE calling the RPC | No, except `converted` is terminal (§16) |
| Analyze | Message scoped to link+owner + client-authored-only restriction | No at this stage — only reserves a `draft`/`analyzed` `project_updates` row |

**Result: PASS on every item.** Ownership checks are consistently enforced at the SQL layer, not merely the route layer. Destructive/terminal semantics correctly scoped to exactly Revoke (fully terminal) plus two state-specific restrictions (not full destruction). No code change made or needed.

---

## 16. Analyze / Apply / conversion final audit

- **No public conversion route exists**: full grep of the anonymous `app/api/share/**` surface for `analyze|apply|convert` returned zero matches.
- **Original client message retained, never deleted/overwritten**: immutable-after-insert both by explicit trigger guard (`SHARE_MESSAGE_IMMUTABLE` on any attempt to change `body`/`author_type`/`parent_id`) and structurally (`authenticated` has only `SELECT` on `share_messages` — no `UPDATE`/`DELETE` grant exists at all).
- **`converted` is DB-enforced terminal**: `set_share_message_status` rejects any further change once `status='converted'` (`SHARE_MESSAGE_STATUS_TERMINAL`), checked immediately after row lock; `finalize_share_message_conversion` independently re-checks the same thing.
- **The capability GUC is transaction-local and row-bound**: `set_config('text2task.client_share_apply_update_id', p_update_id::text, true)` — the `true` (`is_local`) argument means the value exists only for the remainder of the current transaction, never persisted or visible cross-session. `finalize_share_message_conversion` requires the GUC to textually equal the exact update id being converted (not merely "be set to something"); the boundary trigger checks the identical thing a second time.
- **A raw/direct write cannot reach the post-Apply state**: for `share_messages.status`, structurally impossible (zero UPDATE grant to `authenticated`). For `project_updates.status='applied'` — which DOES carry a broad, pre-existing, owner-scoped RLS UPDATE policy from the unrelated Project Update Engine, with no Client-Share-specific grant restriction layered on — the boundary trigger closes exactly this gap: any INSERT/UPDATE setting `source_type='client_share' AND status='applied'` is rejected unless the capability GUC matches the row's own id in the same transaction. Even if bypassed, `finalize_share_message_conversion` independently re-requires the same GUC — a second, independent layer by explicit design.
- **Owner can still Analyze/Apply retained history after public link revoke/expiry/disable**: message history and Analyze remain reachable/actionable regardless of link state (no state filter); only Reply is gated off for a revoked link (UX correctness, since a reply on a revoked link could never reach the client anyway).

**Result: PASS on every item.** The chain is closed at the database layer with independent, redundant guards on the single highest-risk transition (a raw write forging `project_updates.status='applied'`). No code change made or needed.

---

## 17. Rate-limit / cleanup Production audit

`lib/share/share-state-cleanup.server.ts`: `CLEANUP_TRIGGER_PROBABILITY = 0.02` (~1-in-50 calls); 24h grace (`CLEANUP_GRACE_PERIOD_SECONDS = 86400`, `.lt("expires_at", now-24h)`); `CLEANUP_BATCH_LIMIT = 200` per table per call; role used is genuine `service_role` (`supabaseAdmin`, backed by `SUPABASE_SERVICE_ROLE_KEY`); tables swept: exactly `share_rate_limit_buckets`, `share_session_grants`, `share_browser_sessions`.

**The critical Production-permission question, resolved definitively**: does `service_role` already hold `DELETE` on all three swept tables? Migration 2 (`202608030004`, the table-creation migration) deliberately issues **only REVOKEs** — own comment: *"Positive service_role grants are issued only by 202608030005."* The actual grants are there, verbatim:

```sql
grant select, insert, update, delete on table public.share_browser_sessions to service_role;
grant select, insert, update, delete on table public.share_session_grants to service_role;
grant select, insert, delete on table public.share_link_events to service_role;
grant select, insert, update, delete on table public.share_rate_limit_buckets to service_role;
```

**All three swept tables already have an explicit `delete` grant to `service_role`, at migration 3 in the ordered chain.** No additional Production DB permission is needed for cleanup beyond what migration 3 already establishes — once migrations 1–3 are applied, the cleanup sweep is immediately fully functional.

**Result: PASS.** This was the single item explicitly flagged as "critical" by this turn's own instructions; it resolves cleanly from the migration chain itself.

---

## 18. Observability / monitoring plan

**Infrastructure available**: hosting is Vercel (`@vercel/analytics`, `@vercel/speed-insights` in `package.json`); no dedicated error-tracking/APM package (no Sentry, LogRocket, Datadog, PostHog) is installed anywhere. The only observability substrate that genuinely exists is (a) Vercel's own operational function/request log stream, and (b) whatever the application writes via `console.warn`/`console.error`, which flows into that same stream.

**Critical distinction**: Vercel's own platform request logs are operational server logging — not "third-party analytics/session replay." The existing `shouldSkipAnalyticsPath()` gate excluding visitor-tracking SDKs from `/share/**` is about user tracking and is unaffected by, and does not conflict with, the host's own operational logs, which every route on the platform already produces regardless of this feature. **No new monitoring tool is proposed or installed by this document.**

| Signal | Where it surfaces | What to watch for |
|---|---|---|
| Server errors on `/share/**` | Vercel function logs (5xx) | Any 5xx — every route is try/catch-wrapped, so a real 5xx is unexpected. |
| 401/403/404/429 patterns | Response status codes | A spike against one specific link/identity is the attack signature — already contained by the rate limiter; this is detection, not a new control. |
| Session-exchange / PIN / file-fetch / message-submission failures | Per-route response codes | Elevated rates immediately post-launch could indicate a regression rather than real misuse. |
| Owner lifecycle mutation failures | `ShareUpdateStageError` stage tags already recorded in `actionErrorStage` | Already pinpoints which stage failed, directly from logs. |
| Apply/conversion failures | RPC errors from `apply_project_update_transaction`/`finalize_share_message_conversion` | Highest priority — mutates real project/task state. |
| Cleanup failures | `console.warn` from `share-state-cleanup.server.ts` | Already non-blocking by design; a *pattern* (not a single warning) would indicate the sweep itself needs attention. |
| Feature-flag transition | Routes flipping from 404 to real responses | Only worth watching once, at the exact moment the flag is flipped on, to confirm the transition took effect. |

No new monitoring is implemented in this turn.

---

## 19. Privacy / data-retention final audit

| Record | Nature | Retention |
|---|---|---|
| `project_share_links` | Durable | Retained indefinitely, including revoked rows — never deleted (schema comment: "retained rather than deleted so revocation stays auditable"). |
| `share_browser_sessions` / `share_session_grants` / `share_rate_limit_buckets` | Ephemeral | Swept once >24h past `expires_at`, bounded, probabilistic, non-blocking on failure. |
| `share_messages` | Durable, audit history | Never deleted; original body/author retained permanently, including after conversion and after the parent link is later revoked/expired. |
| `share_message_conversions` | Durable, audit trail | Written once per conversion, never deleted. |
| `project_updates` (Client-Share-originated) | Durable | Governed by the pre-existing Project Update Engine's own retention, unchanged by Client Share. |
| `share_link_events` | Durable, audit trail | Deliberately excluded from the Phase 7B cleanup sweep — its own retention policy remains "a separate, still-open product decision" by design, not oversight. |

**No unresolved retention decision blocks launch.** The one explicitly-still-open item (`share_link_events`' long-term policy) is an operational/product decision independent of technical rollout readiness — no constraint would fail or degrade at any data volume the feature's own rate limits could plausibly produce before that decision is made. This document does not invent a policy for it.

---

## 20. Exact Production rollout order

Derived from the live code's own actual safety properties (§10/§11), not the task's own suggested template blindly adopted:

1. **Repository/Git checkpoint verification** — confirm HEAD, clean tree, correct commit range (§2, §24).
2. **Production env/secret verification** — confirm the 5 Category B crypto keys (§12.B) are set, correctly shaped, and — critically — that they are the **final** values (§13: changing any of them later breaks existing links/sessions/fileRefs). `VERIFY_OR_GENERATE_ONCE` (§26): if these already exist in the target environment from prior setup, verify them; only generate if genuinely absent — do not regenerate keys that already exist. Separately, confirm the Category A control variable, `TEXT2TASK_CLIENT_SHARE_ENABLED` (§12.A), is set to its intended **initial OFF state** (unset, or explicitly `false`) — do not conflate "verify the crypto keys are ready" with "verify the flag is off"; they are two different checks on two different variable categories.
3. **Production schema preflight** — run §9's read-only queries; every check must resolve to the expected classification (§26 acceptance criteria).
4. **Backup/recovery checkpoint** — a standard Supabase point-in-time-recovery/backup checkpoint immediately before migration application (this document does not invent a Client-Share-specific backup mechanism — use whatever the Production project's existing backup facility already is).
5. **Apply migrations in exact order** (§4.3's 17-item chain — 3 prerequisite-verify-only + 14 to newly apply), confirming each one's own success before the next begins — pay particular attention to migration 15/`202608210001` (§7's one MODERATE item, Phase 6A) for lock-duration awareness on the live `project_updates` table.
6. **Post-migration DB verification** — re-run §9.3's queries; every object should now read `EXISTS_CORRECT`.
7. **App push/deploy** (§24) — with `TEXT2TASK_CLIENT_SHARE_ENABLED` still unset/false.
8. **Post-deploy verification while the flag remains OFF** — confirm every public/owner Client Share route still 404s as expected (proves the flag itself is correctly wired in the new deploy, not merely that the old deploy worked).
9. **Owner-authenticated smoke test with flag OFF** — confirm the dashboard still renders normally and the "Open Share Link" entry point is correctly absent (§11.3's UI-only gate).
10. **Feature-flag enablement** (§21) — **before this step, confirm §11.2's conservative requirement**: verify, for the actual hosting setup being used, whether an environment-variable change requires a redeploy/restart to take effect. Do not assume it applies instantly.
11. **Public Client Share smoke test** (§22).
12. **Owner lifecycle smoke test** (§22).
13. **Client message → Analyze → Review → Apply smoke test** (§22).
14. **Monitoring window** (§18) — watch the listed signals for an explicit period before considering the rollout settled.
15. **Rollback/disable decision point** (§23) — if anything in steps 11–14 shows a real problem, disable via the flag first (§23), **verify via §18's monitoring that the change actually took effect** (per §11.2, do not assume it did instantly), investigate, and only escalate to a DB-level response if the flag alone doesn't resolve it.

This order matches the task's own suggested template closely because the live code's actual properties (flag fails closed at the code level, independently enforced per-route) genuinely support exactly this sequence — nothing here was blindly adopted without checking against §10/§11's evidence first. Step 10's activation-timing question (§11.2) is the one place this order deliberately does NOT assert a stronger guarantee than the evidence supports.

---

## 21. Feature-flag rollout strategy

**The flag, as implemented, is a single boolean/global switch** — `TEXT2TASK_CLIENT_SHARE_ENABLED` has no owner-scoping, no percentage-rollout, no canary/allowlist mechanism of any kind anywhere in the code (confirmed by §11's full trace — the parse function takes only the raw env value, nothing per-user). **No canary mechanism is invented here** since none exists to use.

**Recommended sequence, the safest one the actual implementation supports**: immediate global ON, but only after §20's steps 1–9 (everything up through a flag-off post-deploy verification) — there is no way to soften this into a gradual rollout without building new functionality this document does not authorize adding. Once flipped on, it is on for every user simultaneously; the safety net is entirely in the pre-flip verification (§20 steps 1–9) and the kill switch (§23) if something is wrong — and, per §11.2, the user must confirm at that moment whether their hosting setup needs a redeploy/restart for the flip to actually take effect, rather than assuming an instant, code-only guarantee.

---

## 22. Production smoke-test checklist

Not executed this turn.

**OWNER:**
- [ ] Open a project's Share Link panel
- [ ] Create/configure via the quick-share flow
- [ ] Open "Edit what client sees" — verify task/resource mapping and visibility controls save correctly
- [ ] Open "Manage access" — set a PIN, verify it persists; set an expiry, verify it persists
- [ ] Activate
- [ ] Copy link / reveal link
- [ ] Rotate — verify the old URL now fails, the new one works
- [ ] Disable — verify the public link stops working
- [x] Re-enable — verify it works again — **FAILED 2026-08-25 in the exact form below; see the ROLLOUT STATUS UPDATE banner at the top of this document and §25's amended row. Fix implemented in `202608250001_client_share_access_epoch.sql` and RUNTIME-VERIFIED 2026-08-26 against a disposable, non-Production Postgres engine (Runtime Requirement B — PASS, no FAIL rows; see `docs/client-share-phase8-access-epoch-runtime/04_CAPTURE_RESULTS.md`). The sub-items below are the PRODUCTION re-run and remain unchecked until actually run against Production — disposable-instance verification does not check these boxes:**
  - [ ] Active link → open in a fresh browser → loads
  - [ ] Disable → refresh the SAME browser/tab → correctly unavailable
  - [ ] Re-enable → refresh the SAME browser/tab, SAME URL, no re-copy, no new incognito, no raw secret → **must load again**
- [ ] Revoke — verify it is terminal, Communication History remains reachable afterward

**CLIENT:**
- [ ] Open a valid link
- [ ] Enter PIN if configured; verify a wrong PIN is rejected and rate-limited after repeated attempts
- [ ] Verify projection data matches exactly what the owner configured
- [ ] Open a file attachment; verify download/open behaves per its configured permission
- [ ] Send a message
- [ ] Test on a narrow/mobile viewport
- [ ] Test with an RTL project and confirm layout remains usable
- [ ] Leave the tab open, have the owner disable the link, confirm the open tab revalidates within ~60s or on refocus

**COMMUNICATION:**
- [ ] Client sends a message
- [ ] Owner sees it in Communication History with correct unread badge
- [ ] Owner replies; client sees the reply
- [ ] Owner marks reviewed/resolved/dismissed; status updates correctly

**CONVERSION:**
- [ ] Owner clicks "Analyze as client update"
- [ ] Review modal opens with the analyzed content
- [ ] Owner Applies
- [ ] Task/project state changes as expected
- [ ] The message's status becomes `converted` and stays terminal
- [ ] The original message body is still visible, unchanged

**SECURITY:**
- [ ] An old, rotated-away URL fails
- [ ] A revoked link fails
- [ ] A stale already-open tab loses access within the revalidation window
- [ ] An unmapped/removed file's fileRef fails on next request
- [ ] Repeated wrong-PIN attempts get rate-limited well before entropy exhaustion
- [ ] Response headers match §14's table

---

## 23. Rollback / kill-switch plan

**Fastest available containment**: set `TEXT2TASK_CLIENT_SHARE_ENABLED=false` (or unset it). **Per §11.2, this document does NOT assume that alone is instantaneous against an already-running deployment** — the code itself would observe the new value on its very next read (§11.1: no in-process caching), but whether the *hosting platform* propagates an environment-variable change to already-running instances without a redeploy/restart is unproven from this repository and must be confirmed by the user for their actual environment at the moment they need it. **Plan for a redeploy/restart step being required, and treat "instant" as a pleasant surprise, not the plan's assumption.**

**What flipping the flag off actually stops, confirmed by §11.3's evidence, ONCE the environment change has actually taken effect (see above)**: every owner route (create/configure/activate/disable/PIN/expiry/rotate/reveal/preview/messages/reply/analyze) and every public route (session exchange, projection, messages, file access) independently 404s — this is not merely a UI hide, it is enforced server-side on every one of the 21 files/25 call sites (§11.3), so it stops **new public sessions, public projection reads, message submission, and file access** exactly as required.

**What remains reachable after the flag is disabled — an intentional, prominent tradeoff, not an oversight (§11.4)**: nothing found in `app/api/share-links/**`'s own gating is scoped to exclude "retained owner history" specifically — the flag gate is applied uniformly, first-statement, in every one of those 17 owner route files, **including** message-history reads and Analyze/Apply. **Disabling the global flag also blocks the owner from viewing Communication History or performing Analyze/Apply on already-retained messages** — there is no code path evidenced that keeps owner-side historical access available while blocking only new public sharing. This is separate from, and does not change, the Phase 6 **per-link** lifecycle rule that a specific disabled/expired/revoked link's own retained history stays Analyze/Apply-capable (§11.4) — the global flag is a second, coarser, all-or-nothing control layered on top of that per-link rule, not a replacement for it. **The user should treat the global flag as a full feature kill switch, not a "public access only" switch**, when deciding whether to use it for an issue that only affects the public surface.

**First response to a serious issue**: flip the flag off (above), then **verify via §18's monitoring that the 404 rate actually changed** before assuming containment — do not assume the flip is instant (§11.2).

**App rollback, if needed**: only relevant if the flag itself is somehow insufficient (e.g. the issue is in code the flag doesn't gate, like `proxy.ts`'s header logic) — standard Vercel deployment rollback to the immediately-prior deploy, independent of any database state.

**DB rollback vs. forward-fix**: **forward-fix is strongly preferred** for every migration in this chain once any of it has been used by live data — 13 of the 14 Client Share migrations create brand-new objects (a rollback would just mean dropping them, safe only if truly nothing has written to them yet); migration 15/`202608210001` alters a real, populated table with an additive, nullable column and two validated CHECK constraints — dropping those after real Client Share rows exist would orphan data, not fix it. If that migration specifically needs undoing, the safe path is a new, forward corrective migration, not a raw rollback.

**When rollout must stop immediately (not merely be flagged off)**: if §9's preflight (post-migration re-check) shows any object in an `EXISTS_DIFFERENT` state, or if migration application itself fails partway through the ordered chain (§20 step 5) — do not proceed to app deploy/flag enablement until the specific failed migration's cause is understood and resolved, since later migrations in the chain assume earlier ones succeeded (§6.1's dependency verification).

**Monitoring confirmation**: after flipping the flag off, confirm via §18's signals that the 404 rate on `/share/**`/`/api/share-links/**` actually returns to 100% (i.e. the flag change actually took effect, not merely that the command to change it was issued) before considering the incident contained.

---

## 24. Push / deploy strategy

**All 19 commits ahead of `origin/main` are Client Share work exclusively** — confirmed via `git log --oneline origin/main..HEAD`: every commit subject names a Client Share phase (1C through 7), no unrelated work interleaved.

- **No reason to split the push, rewrite history, or squash** — every commit is a real, distinct, already-reviewed phase boundary; squashing would destroy that audit trail for no benefit.
- **No CI/CD pipeline exists in this repository** (no `.github/workflows/`). Hosting is Vercel — if this repo is connected via Vercel's standard GitHub integration, **a push to `main` triggers an automatic Production app deploy**. This must be confirmed by the user before push, not assumed — it directly affects §20's ordering (push and app-deploy become the same event if so).
- **Recommended timing**: push exactly at §20 step 7 — after migrations are applied and preflight-verified, with the flag still off. Pushing earlier deploys gated-off code harmlessly but out of the safest documented order; pushing all 19 commits together, in one push, at that point is correct.

---

## 25. Final blocker classification

**AMENDED 2026-08-25, updated 2026-08-26 — see the ROLLOUT STATUS UPDATE banner at the top of this document.** The row immediately below was added after this document's original conclusion of "No BLOCKER exists" was disproven by actually running this document's own §22 smoke test, and was updated again once disposable-Postgres runtime verification completed. It is the only row in this table added or changed since 2026-08-24 — every other row's PASS/PRE_ROLLOUT_CHECK/ROLLOUT_STEP classification is unchanged and still accurate for the capability it covers.

| Finding | Classification | Notes |
|---|---|---|
| Same-browser Disable→Re-enable recovery (§22 smoke test) | **RESOLVED, disposable-runtime-verified — pending Production re-verification** | Found 2026-08-25 by actually running this document's own §22 smoke-test checklist: Disable → same browser correctly denied → Re-enable → same browser, same URL, still denied — no recovery without a brand-new browser. Root cause: `configuration_version` was overloaded as both presentation-freshness signal and the sole security-grant staleness predicate; every operation that bumps it for a legitimate presentation reason (disable, re-enable, clear PIN, set/clear expiry, `save_share_configuration` settings) was silently invalidating already-authorized browsers. Corrective fix: new migration `202608250001_client_share_access_epoch.sql` (dedicated `access_epoch`/`pin_epoch` security counters, `configuration_version` left untouched) — full detail in `docs/TEXT2TASK_CLIENT_SHARE_LINK_ACCESS_EPOCH_IMPLEMENTATION_REPORT_2026-08-25.md`. Locally verified (2904/2904 Client Share suite passing, TypeScript clean, production build clean) **and runtime-verified 2026-08-26 against a disposable, non-Production Postgres engine** — final scripted run 138/139 PASS, sole failure independently confirmed a harness-only bug via a direct read-only catalog query, zero implementation/migration defects found (`docs/client-share-phase8-access-epoch-runtime/04_CAPTURE_RESULTS.md`). **Not yet applied to or re-tested against Production** — this is what keeps §21 (flag enablement) gated until the Production re-run of this exact scenario passes. |
| Migration chain completeness (§4) | PASS | Fully reconstructed and mechanically recounted this turn: 3 prerequisite + 14 Client Share = **17 total** (corrects a prior chat-only "16" arithmetic slip — the document itself was never wrong, see §4.0). |
| Migration dependency verification (§6.1) | PASS | `MIGRATION_CHAIN_VERIFIED` — every one of the 17 migrations' references resolves to an earlier chain position; no forward reference found. |
| Prerequisite-chain Production presence (§4.3, §9.2) | **PRE_ROLLOUT_CHECK** | Near-certainly already true; must be confirmed, not assumed, before applying the 14 Client Share migrations. |
| Migration hash/source-of-truth (§4.2 item 17/`202608230002`) | PASS | Committed file confirmed byte-identical to the last verified generator output via read-only SHA-256 comparison; no drift. |
| Migration risk (§7) | PASS | No HIGH_RISK item; one MODERATE item (position 15, `202608210001`, Phase 6A) with its own mitigations already in place. |
| Existing-data compatibility (§8) | PASS | 13 of 14 Client Share migrations touch only empty, brand-new tables; the one populated-table alteration (position 15) is additive/nullable with a proven-safe coupling argument. |
| Production preflight itself (§9) | **PRE_ROLLOUT_CHECK** | Not yet run — the one thing gating everything after it. This is the sole substantive gate this audit found. |
| App/schema compatibility (§10) | PASS | Every deployment-order scenario (A–E) is safe given the flag's fail-closed default at the code level. |
| Feature-flag code semantics (§11.1) | PASS | Fails closed by default, enforced independently per-route (21 files / 25 call sites, §11.3), reads live within a running process. |
| Feature-flag hosting/activation semantics (§11.2) | **PRE_ROLLOUT_CHECK** | **New this turn.** Whether a changed env var affects an already-running deployment without redeploy/restart is unproven from this repository — must be confirmed by the user for their actual hosting setup before relying on it as an instant kill switch. |
| Environment/secret inventory (§12) | PASS | Reconciled into 3 categories this turn: 1 control var (the flag), 5 crypto keys, 3 generic infrastructure vars (a 3rd, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, was found and added this turn) — `TOTAL_CLIENT_SHARE_SPECIFIC_ENV_COUNT = 6`. All fail closed if missing, none silently defaults to an insecure value. |
| Key-preservation requirements (§13) | **PRE_ROLLOUT_CHECK** (`VERIFY_OR_GENERATE_ONCE`) | Not necessarily "generate" — verify the 5 Category B crypto keys already exist correctly in the target environment; generate only if genuinely absent. Do not rotate them casually post-launch (§13's consequence table). Not itself a blocker. |
| Feature-flag initial-state verification (§12.A/§20 step 2) | **PRE_ROLLOUT_CHECK** | The Category A control variable (`TEXT2TASK_CLIENT_SHARE_ENABLED`) must be confirmed set to its intended initial OFF state before rollout begins — a distinct check from the crypto-key verification above, on a different variable category. |
| Public route security (§14) | PASS | No code change needed. |
| Owner route security (§15) | PASS | No code change needed. |
| Apply/conversion integrity (§16) | PASS | Independently double-guarded on the highest-risk transition. |
| Rate-limit/cleanup grants (§17) | PASS | The one item flagged "critical" by this turn's own instructions — resolves cleanly, already granted at chain position 6 (`202608030005`). |
| Observability (§18) | ROLLOUT_STEP | Plan defined; watching it is a step during/after rollout, not a precondition. |
| Privacy/retention (§19) | PASS | No unresolved decision blocks launch. |
| Global flag vs. per-link lifecycle (§11.4) | PASS | Two independent, non-conflicting controls, both directly verified; the Phase 6 per-link rule is intact and unchanged; the global flag's all-or-nothing tradeoff is now documented prominently, not merely noted in passing. |
| Migration application (§20 step 5) | ROLLOUT_STEP | Execution, not a precondition — gated by the PRE_ROLLOUT_CHECK items above it. |
| Feature-flag enablement (§21) | ROLLOUT_STEP | Simple global boolean; the step itself, not a precondition — gated by §11.2's PRE_ROLLOUT_CHECK. |
| Smoke tests (§22) | POST_ROLLOUT_CHECK | Run after flag enablement, before considering rollout complete. |
| Rollback/kill-switch readiness (§23) | PASS, with a documented dependency | Flag-off is a real containment for the entire feature once it has taken effect — but its *speed* now correctly depends on the §11.2 PRE_ROLLOUT_CHECK (hosting activation semantics) rather than being asserted as instant; the all-or-nothing (not public-only) scope caveat remains documented. |
| Push/deploy strategy (§24) | ROLLOUT_STEP | Timing defined; needs one user confirmation (GitHub→Vercel auto-deploy status) before execution. |

**No BLOCKER exists.** Five items are correctly classified PRE_ROLLOUT_CHECK (not blockers — verifiable, expected-to-pass checks the user has simply not run yet): the prerequisite-chain Production presence (§9.2), the Production preflight itself (§9), the feature-flag hosting/activation semantics confirmation (§11.2, replacing an unproven "no rebuild needed" claim), the one-time crypto-key verify-or-generate requirement (§13), and the feature-flag initial-OFF-state verification (§12.A, new this turn — a distinct check on the control variable, separate from the crypto-key check). None of these represents a concrete reason rollout would be unsafe or impossible — they represent verification work that has not yet happened.

---

## 26. Acceptance criteria

Before any step in §20 proceeds past its own gate:

1. §9's preflight checks have actually been run against Production — no `UNKNOWN` remains for any object in §9.2/§9.3.
2. §9.2's prerequisite-chain check confirms Production's Project Update Engine is already on the post-`202607270001` shape — if not, resolved as its own separate matter first.
3. §9.3's Client Share object checks return `MISSING` for everything (expected), or an `EXISTS_CORRECT` explicitly confirmed intentional by the user; any `EXISTS_DIFFERENT` blocks progress.
4. The 14 Client Share migrations (§4.3, chain positions 4–17) applied in exact order, each success confirmed before the next.
5. A second read of §9.3's queries, post-migration, confirms every object now reads `EXISTS_CORRECT`.
6. §12.B's 5 crypto keys are confirmed present and correctly shaped in the target environment (`VERIFY_OR_GENERATE_ONCE` — generate only if genuinely absent) and treated as final (§13).
6a. §12.A's control variable (`TEXT2TASK_CLIENT_SHARE_ENABLED`) is confirmed set to its intended initial OFF state — a separate check from item 6, on a different variable category.
7. The app is deployed with the flag still off; §20 step 8's flag-off verification passes.
8. **§11.2 is explicitly resolved for the actual hosting setup**: the user has confirmed whether an env-var change requires redeploy/restart to take effect, before relying on the flag as an instant switch in either direction.
9. The flag is flipped on only after items 1–8 above (§21).
10. §22's full smoke-test checklist passes.
11. §18's monitoring signals are watched for an explicit window before considering the rollout settled.

## 27. STOP boundary

This document is mapping/audit/rollout-plan design output only. No application code, test, migration, generator, or SQL was written or executed to produce it. No Production system was accessed, queried, or modified. No full build was run this turn. No stage, commit, push, or deploy occurred. The feature flag was not touched. **No Production rollout, migration application, or feature-flag change is authorized by this document.** The next action is the user's own decision: run §9's preflight against Production, then, if clean, proceed through §20's rollout order at the user's own pace — this document is the plan, not the execution.

**STOP.**
