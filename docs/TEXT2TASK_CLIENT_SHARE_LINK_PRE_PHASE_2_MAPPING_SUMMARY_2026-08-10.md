# Text2Task Client Share Link — Pre-Phase-2 Mapping Summary

**Status:** Pre-Phase-2 delta mapping complete. Phase 2 implementation NOT
started. Production NOT authorized.

This is the concise, operational navigation document above the detailed
Pre-Phase-2 Delta Mapping report (delivered in-conversation on 2026-08-10,
not a separate file). That report remains the full evidence source; this
document exists so a future work session can resume correctly without
re-reading or repeating the full mapping.

---

## 1. Executive Decision

**VERDICT: READY FOR PHASE 2** — starting with Phase 2A only.

Client Share's Phase 1 backend (7 migrations, 14 owner-facing RPCs, full
application layer) is complete and runtime-verified. Phase 2A
(feature-gated owner integration + management shell) can be implemented
today against this foundation with **no migration**, using only
already-verified RPCs. Phase 2A also establishes the production
availability gate that must exist before any Client Share UI is exposed.

A small **Phase 1C** schema extension is required, but only before Phase 2B
(the full configuration editor, which needs durable project-level
publication settings) and Phase 2D (authoritative Preview). Phase 1C is not
required before Phase 2A, because Phase 2A only integrates the
already-complete lifecycle/read backend and does not expose or edit the
missing project-level publication fields. See §4.

**Authoritative sequence**: Phase 2A → Phase 1C → Phase 2B → Phase 2C →
Phase 2D → Phase 3 onward (full order in §18). Migration work does **not**
precede Phase 2A, but it does precede Phase 2B. Production remains
completely untouched — the 7 Client Share migrations have not been applied
there, and nothing in this document authorizes applying them. The exact
first implementation slice is specified in §10.

---

## 2. Completed Sequence

```
Phase 0 (repo mapping)
  → Phase 1A (DB foundation)
  → Phase 1A runtime verification (207/207 PASS, disposable project)
  → Phase 1B mapping (architecture)
  → Phase 1B.1 (owner reads)
  → Phase 1B.2 (lifecycle operations)
  → Phase 1B.3 (access operations)
  → Phase 1B.4 (atomic configuration save)
  → Phase 1B.5 (runtime verification, 520/520 PASS, disposable project)
  → Pre-Phase-2 Delta Mapping (this checkpoint)
```

- **Nothing was skipped.** Every phase has exactly one authoritative
  mapping/implementation artifact.
- **Nothing was unnecessarily repeated.** Multiple correction passes within
  Phase 1A and Phase 1B.5 were in-place revisions to the same artifact
  (driven by real runtime failures), never independent re-mappings of
  already-covered ground.
- **Nothing was implemented out of order.** Mapping preceded schema;
  schema preceded RPCs; RPCs preceded runtime verification; runtime
  verification preceded this delta mapping. No Phase 2 code exists.

Future sessions must treat Phase 0 through Phase 1B.5 as closed historical
checkpoints and must not reopen or redesign them without a new, explicit
mapping decision.

---

## 3. Current Architecture We Must Reuse

Phase 1 delivered a complete, runtime-verified backend:

- 11 tables (`project_share_links` core + tasks/resources/updates mapping
  tables + fully-closed secret material + Phase-3-only session/grant/event/
  rate-limit foundation tables).
- 14 SECURITY DEFINER/INVOKER RPCs: owner reads, draft creation, activation,
  disable/re-enable, PIN set/clear, expiry set/clear, secret rotation,
  reveal, revoke, and one atomic `save_share_configuration` covering
  settings/tasks/resources/latest-update together.
- Deterministic task/resource mapping tables (explicit selection only,
  never automatic).
- Immutable, versioned `share_link_updates` publication.
- `configuration_version` monotonic bump on every access-sensitive change.
- Owner authorization fully internal to each RPC (`auth.uid()`), no
  `user_id`/`project_id` parameters accepted, cross-tenant protection
  verified at runtime.
- Private-by-default behavior verified structurally (nothing enters a
  public-facing table except through an explicit, owner-authenticated RPC
  call).
- A thin, faithful `lib/share/**` + `app/api/share-links/**` application
  layer: one repository function per RPC, one zod contract file, exact-
  message error mapping, `no-store` headers everywhere, no service-role
  client anywhere in this feature.

**PHASE 2 MUST BUILD ON THIS.** Do not create a second owner/share API
surface, a second project/task/resource model, a second secret-encryption
or PIN-hashing implementation, or a client-side re-derivation of any
lifecycle rule already enforced by these RPCs.

---

## 4. Phase 1C Decision

**PHASE 1C REQUIRED: YES** — narrowly, and positioned immediately AFTER
Phase 2A and BEFORE Phase 2B.

**Sequencing**: Phase 2A intentionally comes before Phase 1C because it
only integrates the already-complete lifecycle/read backend (draft,
activate, disable, re-enable, revoke, copy link, and the availability
gate) and never exposes or edits the missing project-level publication
fields. Phase 1C then comes immediately after Phase 2A so the durable
publication model is complete **before** the full Phase 2B configuration
editor is built — Phase 2B must consume the completed Phase 1C model
rather than being retrofitted later.

**Missing durable foundation**: no column anywhere records durable,
owner-confirmed publication intent for project **title**, **status**, or
**target date**. The handoff's own locked rule requires these be
explicitly confirmed before publication; today there is nowhere to persist
that confirmation.

**Why UI-first would be wrong**: without a durable column, a UI "confirm to
publish" toggle for these fields would have to live only in React/session
state — a UI-only publication-consent pattern the project's own quality bar
explicitly rejects, and a duplicated-state risk.

**Exact minimal Phase 1C scope**:
- A small number of new nullable/boolean columns on `project_share_links`
  (e.g. `title_visible`, `status_visible`, `target_date_visible` — exact
  naming decided at implementation time), following the existing
  `comments_enabled` pattern exactly.
- Extend `save_share_configuration`'s existing "settings" group and its
  existing `configuration_version` change-detection logic to include them.
- Extend `get_share_link_management_state`'s return shape with the three
  new booleans.
- **No new table. No new RPC. No new route.**

**Migration required**: Yes — one small, additive migration.
**API/contract change**: Yes — extension of two existing RPCs' shapes, not
new ones.

**Must NOT expand into**: a general project-settings system, a branding/
logo system, or anything touching tasks/resources/updates/PIN/expiry/
rotation/revoke — all of which are already fully supported.

---

## 5. Publication-Intent Matrix

| Public capability | Current support | Gap / action |
|---|---|---|
| Project title visibility | MISSING | Phase 1C column |
| Public status | MISSING | Phase 1C column |
| Public progress | PARTIAL (derivable from selected tasks) | No explicit override; acceptable for V1 |
| Target date visibility | MISSING | Phase 1C column |
| Client-facing subtitle | SUPPORTED | Existing column, versioned |
| Content direction / RTL | SUPPORTED | Existing column, versioned |
| Comments enabled | SUPPORTED | Existing column, versioned |
| Selected tasks | SUPPORTED | `share_link_tasks`, explicit RPC only |
| Task public group | SUPPORTED | Same table |
| Waiting for client feedback | SUPPORTED | Same table |
| Task display order | SUPPORTED | Same table |
| Selected Resources | SUPPORTED | `share_link_resources`, explicit RPC only |
| Resource public label | SUPPORTED | Same table |
| Resource canDownload | SUPPORTED | Same table |
| Resource display order | SUPPORTED | Same table |
| Latest published update | SUPPORTED | `share_link_updates`, immutable/versioned |
| Business/owner identity | MISSING (platform-wide, not Client-Share-specific) | Not required for Phase 2A; do not expose an email address or email-derived value merely because it is available on the account — deferred until the projection/public-view design, and must use a deliberately safe field/contract, not accidental derivation from private account data |
| Logo/branding | MISSING, explicitly deferred | CAN-DEFER — do not build a branding system |

---

## 6. Phase 2 Capability Status

| Capability | Backend | Owner UI |
|---|---|---|
| Share with client entry point | SUPPORTED NOW | MISSING (no UI exists) |
| Management/read state | SUPPORTED NOW | MISSING |
| Configuration editing (settings/tasks/resources/update) | SUPPORTED NOW | MISSING |
| Task selection | SUPPORTED NOW | MISSING |
| Resource selection | SUPPORTED NOW | MISSING |
| Latest update publish | SUPPORTED NOW | MISSING |
| Comments setting | SUPPORTED NOW | MISSING |
| PIN | SUPPORTED NOW | MISSING |
| Expiry | SUPPORTED NOW | MISSING |
| Activation | SUPPORTED NOW | MISSING |
| Disable / re-enable | SUPPORTED NOW | MISSING |
| Rotate | SUPPORTED NOW | MISSING |
| Revoke | SUPPORTED NOW | MISSING |
| Copy link | SUPPORTED NOW (via reveal) | MISSING |
| Native Share | SUPPORTED NOW (browser API only) | MISSING |
| WhatsApp | SUPPORTED NOW (`wa.me` link only) | MISSING |
| Preview | PARTIAL — needs a new projection function | MISSING; DEFERRED to Phase 2D + Phase 1C |

Every backend capability except Preview is already fully supported; the
entire gap is owner UI, which is exactly what Phase 2 exists to build.

---

## 7. Safe Defaults

A brand-new share setup must never accidentally publish private data:

- No automatic publication of anything on draft creation.
- No task selected by default — `share_link_tasks` starts empty.
- No Resource selected by default — `share_link_resources` starts empty.
- No amount, priority, or internal status (e.g. "Urgent") ever appears in
  any RPC return shape; the public task-group vocabulary is entirely
  separate and closed.
- No private contact info, client notes, raw input, or internal timeline
  ever appears in any RPC return shape (verified directly against every
  RPC's return statement).
- Target date / title / status: currently cannot leak because no column
  exists yet to expose them (see §4) — the absence is itself safe, if
  incomplete.
- Latest update: nothing is published until the owner explicitly submits
  through `save_share_configuration`; no draft-state auto-publish exists.
- **UI prefill vs. durable consent**: selecting a task/resource in an
  open, unsaved form is not publication — only a successful
  `save_share_configuration` call is. Phase 2 UI must never treat local
  selection state as equivalent to durable authorization.

---

## 8. Owner UI Integration Point

- No dedicated project route/component exists today — a "project" is a
  client-side grouping of tasks; the "project card" is the table row/card
  itself.
- **Desktop**: `app/components/dashboard/tasks/desktop-tasks-table.tsx`.
- **Mobile**: `app/components/dashboard/tasks/mobile-task-card.tsx` — a
  separate, parallel implementation, not shared with desktop; both mount,
  CSS-toggled.
- **Where "Share with client" belongs**: the existing expanded-project
  action row in both files, alongside the existing Resources / Add update
  / History buttons — same `onOpenX(project)` callback convention already
  used by those three features.
- **Reuse**: `ResponsiveDialog`
  (`app/components/dashboard/ui/responsive-dialog.tsx`) — the one modal
  primitive with focus-trap, scroll-lock, and desktop/mobile auto-switching,
  and the only one with real test coverage. Do not extend the legacy
  hand-rolled `createPortal` modal pattern for a feature carrying secrets.
- **Must be isolated** into a dedicated feature component + hook (e.g.
  `share-link-panel.tsx` / `use-share-link.ts`), following the same
  isolation convention already used for the Update and Resources features.
  **Must NOT** be inlined into `DesktopTasksTable`/`MobileTaskCard`
  directly — both files are already large, and Client Share carries real
  state complexity (lifecycle, PIN, expiry, secret reveal).

---

## 9. Recommended Phase 2 Decomposition

### Phase 2A — Feature-gated owner integration + management shell
Objective: establish the Client Share availability gate, then wire "Share
with client" into the project card; show link state; create draft,
activate, disable, re-enable, revoke, copy link.
Migration required: NO.
APIs reused: `get_share_link_management_state`, `create_share_link_draft`,
`activate_share_link`, `disable_share_link`, `reenable_share_link`,
`revoke_share_link`, `reveal_share_link_secret`.
Safe while hidden (flag off): YES.
Dependency: none for merging while hidden; the 7 migrations must be
applied to Production before the gate is switched on (§15).

### Phase 1C — Durable project-level publication intent
Objective: add durable, versioned publication-intent columns for project
title/status/target-date visibility (§4).
Migration required: YES — one small, additive migration.
APIs reused/extended: `save_share_configuration`, `get_share_link_management_state`.
Safe while hidden: YES (additive schema only; no UI exposure by itself).

### Phase 2B — Configuration editor
Objective: task/resource selection, comments toggle, subtitle/direction,
and the Phase 1C publication-intent controls.
Migration required: NO (consumes Phase 1C's schema, adds none of its own).
APIs reused: `save_share_configuration`.
Safe while hidden: YES.

### Phase 2C — Access controls
Objective: PIN, expiry, rotation, Copy/Share/WhatsApp UX per §12.
Migration required: NO.
APIs reused: `set/clear_share_link_pin`, `set/clear_share_link_expiry`,
`rotate_share_link_secret`.
Safe while hidden: YES.

### Phase 2D — Authoritative Preview
Objective: real server-built projection, owner-authenticated Preview.
Migration required: NO (consumes Phase 1C's schema, adds none of its own).
APIs reused: new read-only projection function (new).
Safe while hidden: YES (still owner-authenticated only).

---

## 10. NEXT AUTHORIZED IMPLEMENTATION

**NEXT AUTHORIZED IMPLEMENTATION: Phase 2A — Feature-gated owner
integration + management shell.**

### Objective
Establish the Client Share production-availability gate, then let an
authenticated project owner see share-link state on their project card (no
link / draft / active / disabled / revoked), create a draft, activate it,
and copy the resulting link.

### What we implement
1. One authoritative server-side Client Share availability gate (e.g. a
   `TEXT2TASK_CLIENT_SHARE_ENABLED`-style env var), modeled on the existing
   `TEXT2TASK_HOMEPAGE_DEMO_ENABLED` fail-closed-to-404 pattern (§15).
2. Fail-closed protection for the existing `/api/share-links/**` surface —
   every route checks the gate first, before any RPC call.
3. A matching client-side visibility gate so "Share with client" is not
   rendered when the feature is disabled — UX only, not a security
   boundary.
4. A neutral gate, independent of any Free/Pro pricing decision — no
   entitlement system is designed here, and Client Share is not hard-coded
   to either plan tier.
5. Share-link entry point wired into both desktop and mobile project
   cards, in the existing expanded-project action row.
6. A dedicated management shell built on `ResponsiveDialog`.
7. Management-state loading via `get_share_link_management_state`.
8. Create draft, activate, copy/reveal link, disable, re-enable, revoke.

### What we explicitly do NOT implement
Phase 1C schema changes; project title/status/target-date publication
controls; task configuration; Resource configuration; subtitle/comments/
direction editor; PIN; expiry; rotation; Preview; the public `/share`
route; anonymous/session exchange; feedback. Also out of scope: any
Free/Pro pricing entitlement design.

### Existing APIs/contracts reused
`get_share_link_management_state`, `create_share_link_draft`,
`activate_share_link`, `disable_share_link`, `reenable_share_link`,
`revoke_share_link`, `reveal_share_link_secret`, and their existing 7
routes/repository functions/zod contracts — unchanged. The gate reuses the
existing `TEXT2TASK_HOMEPAGE_DEMO_ENABLED`/`assertXEnabled()` pattern as its
template, not a new mechanism.

### Expected existing files modified
`app/components/dashboard/tasks/desktop-tasks-table.tsx`,
`app/components/dashboard/tasks/mobile-task-card.tsx`,
`app/components/dashboard/tasks/tasks-view.tsx` (new `onOpenShareLink`
prop/handler, same pattern as Resources/Update/History); every
`app/api/share-links/**` route (add the gate check as the first line).

### Expected new files
A dedicated feature component + hook (e.g.
`app/components/dashboard/tasks/share-link/share-link-panel.tsx`,
`use-share-link.ts`) built on `ResponsiveDialog`; a small gate helper
(e.g. `lib/share/share-availability.server.ts`) mirroring the homepage-demo
gate helper.

### Migration required
**NO.**

### Targeted tests
Component/hook unit tests covering the full lifecycle state matrix
(§7 of the detailed mapping) and the gate's on/off behavior; reuse of
existing route-level tests as regression coverage, extended to assert the
gate blocks every route when disabled.

### Manual checks
With the gate off: confirm no entry point renders and every route 404s.
With the gate on, against a disposable Supabase project (never
Production): create draft → activate → copy link → disable → re-enable →
revoke; confirm both desktop and mobile render correctly.

### User-run Build
REQUIRED (per AGENTS.md — user alone runs full Builds).

### Production dependency
**Merging** this slice while the gate is off does not require Production
schema to exist first. **Enabling** the gate for any real user does
require the 7 Client Share migrations to be applied to and verified in
Production first (§15) — that application is a separate, explicitly
authorized deployment action, not performed by this document.

---

## 11. Preview Decision

Preview is deferred to **Phase 2D**, not Phase 3, and not built now. The
recommendation is **one authoritative, server-built projection function**
(new), called only by an authenticated, ownership-verified owner Preview
action — never the raw Project object, never a client-side mock. This same
function is reused by Phase 3's public route later, avoiding a second
projection implementation. Preview must never increment `view_count`,
create a session, or write a `share_link_events` row. Phase 2D depends on
Phase 1C only insofar as it needs to preview title/status/date.

---

## 12. Copy / Reveal / Share / WhatsApp

`publicId` is a non-secret 24-char random token. The secret is verified
via one-way `secret_digest`; a separate, fully-closed
`project_share_secret_material` table holds an AES-256-GCM encrypted copy
solely so the owner can re-copy an active link, decrypted only in
`share-secret-encryption.server.ts`. Copy Link calls `reveal` (or reuses
plaintext already returned by `activate`/`rotate`) to build
`https://text2task.com/share/<publicId>#<secret>` **client-side only**,
held in a function-scoped variable, never `useState`, never logged.
WhatsApp uses a plain `wa.me/?text=` prefilled URL, no API integration.
Rotation permanently invalidates previously-shared links — UI must warn
first. Reveal/Copy Link require `state = 'active'`; disabled/expired/
revoked all block reveal at the RPC layer and must be reflected in the UI.
The full link/secret must never appear in any analytics or log payload.

---

## 13. Resources Decision

Link, file, and note Resources are all structurally safe to *select* in
Phase 2 — the mapping table (`share_link_resources`) stores only a foreign
key plus presentation metadata (label, canDownload, order), never file
content, storage path, or notes. Note-type Resources' public *rendering*
is an open product decision (§14), not a schema blocker. Selecting a
Resource in Phase 2 only persists a mapping — it exposes nothing publicly
until a future public read path exists. Actual public file access (signed
URLs for anonymous readers) waits for a later phase; existing private
storage/signed-URL code remains authoritative and must not be reused
as-is for any public/anonymous caller. No duplicated upload/storage model
is introduced anywhere in this design.

---

## 14. Open Product Decisions

### Must decide before next implementation (Phase 2A)
- Feature-gate mechanism (§15) — this is now part of Phase 2A itself
  (§10), not a separate prerequisite.

### Must decide before Phase 2B
- Whether Note-type Resources are selectable in the Phase 2B UI. This does
  **not** block Phase 2A, which contains no Resource selection.

### Can safely defer
- Free vs. Pro plan gating — layer on later via the existing plan-gate
  pattern; **do not hard-code pricing tier logic now,** and do not treat
  the Phase 2A availability gate (§15) as a pricing/entitlement mechanism —
  it is a neutral on/off availability switch only.
- Client-comment reply visibility semantics (Phase 3+ scope).
- Branding/logo customization, and any public display of owner identity
  (§5) — deferred to the projection/public-view design, not decided now.
- Update-history owner UX details.

### Already resolved
- One active link per project in the UI, multi-link-capable schema.
- Optional PIN and optional expiry are V1.
- No WhatsApp Business API.
- No client file upload in V1.

---

## 15. Production / Feature-Gate Strategy

Production Client Share **schema is not applied**, and the feature must
remain unavailable to real users until it is. A **server-side gate is
required** — without it, any accidental request to
`/api/share-links/**` today would surface a raw, unmapped Postgres
"function does not exist" error via a 500 fallback. A **client-side gate
is also useful** (never render the entry point) but is not sufficient
alone. Recommended pattern: a `TEXT2TASK_CLIENT_SHARE_ENABLED`-style
env-var gate, checked first in every share-links route and before
rendering the button, mirroring the existing `TEXT2TASK_HOMEPAGE_DEMO_ENABLED`
precedent (fail-closed to a generic 404, never a leaky error).

**Three separate concepts, not to be conflated**:
- **CODE MERGE** — Phase 2A (including the gate itself, the entry point,
  and the routes' gate checks) may be merged to `main` while the
  authoritative feature gate is OFF. This does not require Production
  schema to exist.
- **SCHEMA APPLICATION** — applying the 7 Client Share migrations to
  Production is a separate, explicitly authorized deployment action, done
  independently of any code merge or flag flip. **Not authorized by this
  document.**
- **FEATURE ENABLEMENT** — the gate MUST NOT be switched on until the
  required Production schema is present and verified. Enable-feature
  strictly depends on schema-first; merge-hidden does not.

**Deployment order**: (1) merge Phase 2A (gate off) — safe at any time,
independent of schema; (2) apply the 7 migrations to Production, schema
only, zero exposure; (3) flip the gate on for an internal allowlist;
(4) merge 2B/2C/2D incrementally, same gate; (5) general enablement.

**Rollback**: code rollback is always independent of the schema — all 7
migrations are additive only, so reverting app code never requires
reverting schema. No "down" migration should be authored for routine
rollback; a genuine schema mistake is corrected by a new forward-only
migration.

**No Production action is authorized by this document.**

---

## 16. Highest-Priority Risks

| Risk | Current mitigation | Next action |
|---|---|---|
| Cross-tenant IDOR | RPC-internal `auth.uid()` + RLS, runtime-verified | Reuse as-is |
| Raw project serialization | Every RPC return shape hand-verified allowlisted | Continue discipline for new UI types |
| Publication-intent ambiguity (title/status/date) | None yet | Phase 1C (§4) |
| Full link/secret logging | No route logs message/stack/payload | Client-side click-handler discipline (§12) |
| Stale link after rotation | Digest changes atomically | UI warning before rotate |
| Production missing schema, routes reachable | None today | Feature-gate check (§15), recommended before/alongside Phase 2A |
| Unsafe/fake preview | N/A yet | One real projection function (§11), never a mock |
| Hidden task/resource count leakage | Counts derived only from mapping-table membership | None needed |

---

## 17. What Must NOT Be Built Yet

- Public, anonymous Client View / `/share/[publicId]` route.
- Fragment-to-session public exchange.
- Public Resource file access (signed URLs for anonymous readers).
- Client comment submission.
- Client Communication History UI / replies / notifications.
- Client Update conversion from share messages.
- Full abuse/rate-limit hardening (`share_rate_limit_buckets` wiring).
- Any Production rollout action.

---

## 18. Remaining Roadmap

```
Phase 2A — Feature-gated owner integration + management shell
  → Phase 1C — Durable project-level publication intent (small, additive)
  → Phase 2B — Full configuration editor
  → Phase 2C — Access controls
  → Phase 2D — Authoritative Preview/projection
  → Phase 3 — Public Client View
  → Phase 4 — Shared Resource access
  → Phase 5 — Client Feedback / comments
  → Phase 6 — Existing-flow conversion (share messages → Client Updates)
  → Phase 7 — Hardening (rate limits, CSP, robots/analytics exclusion)
  → Phase 8 — Audit & Production rollout
```

This is the operational order unless a future explicit mapping decision
changes it. **DO NOT SKIP A PHASE WITHOUT AN EXPLICIT NEW MAPPING
DECISION.**

---

## 19. Addendum C Facts

For a future, separate, controlled update to the Full Handoff document
(not performed by this task):

- Phase 0 through Phase 1B.5 complete.
- Final runtime result: `total_tests=520, passed_tests=520, failed_tests=0,
  runtime_status=PHASE_1B_RUNTIME_PASS`.
- Checkpoint commit: `bdd489a0f64a9ae2fea3e2dee66cdf48f60098f7`.
- Production Build: PASS.
- Disposable verification project deleted after evidence committed.
- Production Client Share migrations: NOT APPLIED.
- Production Client Share feature: NOT ENABLED.
- Pre-Phase-2 Delta Mapping: COMPLETE.
- Phase 1C decision: REQUIRED, narrowly scoped; positioned after Phase 2A
  and before Phase 2B (§4, §18) — does not block Phase 2A.
- Next authorized implementation: Phase 2A — feature-gated owner
  integration + management shell (§10 of this document).

The Full Handoff document itself is **not edited** by this task.

---

## 20. Exact Next Action

**NEXT ACTION:**
Implement Phase 2A — Feature-gated owner integration + management shell,
exactly as specified in §10.

**WHY:**
It exercises the already-runtime-verified Phase 1 backend, introduces the
missing production-safety gate before UI exposure, requires no new schema,
and does not depend on the unresolved Phase 1C publication-intent fields.

**DO NOT START YET:**
Phase 1C, Phase 2B, Phase 2C, Phase 2D, public Client View, public
Resource access, comments/feedback, conversion, Production migration
application, or Production feature enablement.
