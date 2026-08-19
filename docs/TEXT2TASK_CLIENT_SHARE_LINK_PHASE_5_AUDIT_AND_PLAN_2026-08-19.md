# Text2Task Client Share — Phase 5 Audit & Implementation Plan

**Scope of this document: READ-ONLY AUDIT / PLAN ONLY.** No application
code, test, migration, SQL, Storage, ENV, or Production change occurred
this turn. Every finding below is drawn from directly reading the actual
current repository state at checkpoint `a38edda` (Phase 4 COMPLETE /
PASS), not from the task's own framing assumptions — several of which
this audit corrects with evidence.

---

## 1. Executive verdict

**Phase 5's data model already exists, in full, unused.** Phase 1A
(`202608030003_client_share_owner_foundation.sql`,
`202608030005_client_share_integrity_and_security.sql`) already created
`public.share_messages` and `public.share_message_conversions` with a
complete, carefully-designed schema, integrity trigger, RLS, and partial
grants — apparently built ahead of need, in anticipation of this exact
phase, and never wired into any application code (confirmed: zero
references outside migrations/tests). This changes the shape of Phase 5
from "design a communication schema" to "audit an existing one for
gaps, then build the application layer against it." Two concrete,
evidence-based gaps were found (owner-write grants are incomplete;
`comments_enabled` has no path to `true` from the current simplified
owner UI) — both are small, additive, and do not require redesigning
anything already accepted.

**PHASE 5 IMPLEMENTATION READINESS: READY** (see §21 for the exact
qualified reasoning and the one small additive migration this finding
requires).

---

## 2. Current communication schema inventory

### `public.share_messages` (202608030003, lines 569–667; trigger in 202608030005, lines 583–734)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | owner |
| `share_link_id` | `uuid not null references public.project_share_links(id) on delete cascade` | |
| `project_id` | `uuid not null references public.projects(id) on delete cascade` | **denormalized**, enforced equal to the link's own project by the trigger — deliberately, so the owner's per-project panel is a single-table read (see the column's own comment) |
| `author_type` | `text not null`, `check (author_type in ('client','owner'))` | closed vocabulary |
| `author_display_name` | `text null`, 1–80 chars if present | **optional name field already exists** |
| `body` | `text not null`, 1–4000 chars (`btrim` length checked) | plain text only |
| `parent_id` | `uuid null references public.share_messages(id) on delete cascade`, `check (parent_id <> id)` | self-referencing thread support |
| `is_visible_to_client` | `boolean not null default true` | |
| `status` | `text not null default 'new'`, `check (status in ('new','reviewed','resolved','dismissed','converted'))` | owner workflow state |
| `reviewed_at` / `resolved_at` | `timestamptz null` | consistency-checked against `status` and `created_at` |
| `created_at` / `updated_at` | `timestamptz not null default now()` | `updated_at` trigger installed |

No `email`/`phone` column of any kind (directly asserted by
`202608030003_client_share_owner_foundation.test.ts:510-515`, reconfirmed
by reading the actual column list). **No browser-session id column** — the
table's own comment states this is deliberate: "Browser-session and
per-link grant validation remains in the public server operation because
`share_messages` deliberately stores no browser-session id." No parent/
reply relationship beyond the single self-FK. No archive/soft-delete
column — deletion, if ever needed, would be a real `DELETE`, not a flag
(none exists today).

**Indexes**: `(share_link_id, created_at)` — primary thread read;
`(user_id, project_id, created_at desc)` — owner's per-project panel
across every link on that project; a **partial** index
`(user_id, share_link_id) where status='new' and author_type='client'`
— an unread-client-feedback counter, already built for exactly this
purpose; `(parent_id) where parent_id is not null` — thread expansion.

**RLS**: enabled; one policy, `for select to authenticated using
(auth.uid() = user_id)` — owner read-only.

**Grants** (202608030005, lines 1229-1266): `authenticated` → `select`
only. `service_role` → `select` **and** a column-scoped `insert (user_id,
share_link_id, project_id, author_type, author_display_name, body,
parent_id, is_visible_to_client)`. **No `update` grant to anyone, and no
`insert` grant to `authenticated`.**

**Trigger `enforce_share_message_integrity`** (before insert or update):
on UPDATE, only `is_visible_to_client`/`status`/`reviewed_at`/
`resolved_at`/`updated_at` may change — every other column raises
`SHARE_MESSAGE_IMMUTABLE`. On INSERT: owner/project must match the link;
`author_type='owner'` requires `auth.uid() = new.user_id` (a real
authenticated JWT session); `author_type='client'` requires
`current_role = 'service_role'` **and** the link is `active`,
`comments_enabled`, unexpired, and the project exists and is not
soft-deleted **and** the new row's `status='new'`,
`reviewed_at`/`resolved_at` are both null, `is_visible_to_client=true`
(a client can never insert a pre-reviewed or hidden row). A `parent_id`
must belong to the same link and owner, and if the new row is
client-authored, the parent must itself be `is_visible_to_client=true`
(a client can only reply to something already shown to them). The
function performs zero writes to any other table.

### `public.share_message_conversions` (202608030003, lines 680–729; trigger in 202608030005, lines 754–846)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | |
| `message_id` | `uuid not null references public.share_messages(id) on delete cascade`, **`unique`** | at most one conversion per message |
| `project_update_id` | `uuid null references public.project_updates(id) on delete set null` | the existing Client Update the conversion produced, if any |
| `target_task_id` | `bigint null references public.tasks(id) on delete set null` | optional specific subtask targeted |
| `converted_by` | `uuid not null references auth.users(id) on delete cascade` | enforced `= user_id = auth.uid()` by the trigger |
| `converted_at` | `timestamptz not null default now()` | append-only, no `updated_at` |

**Why it exists**: pure **traceability**, written only *after* an
authenticated owner has already converted a message through the
existing Client Updates analyze/review/apply flow — its own migration
comment states this explicitly and repeatedly ("Nothing in this
migration analyses a message, creates a project update, creates a task,
changes a project or task status, or writes a project timeline row").
**It was designed for Phase 6, not Phase 5** — every column and the
trigger's own validation logic assume the conversion has *already
happened* elsewhere; nothing here performs a conversion.

**Duplicate protection**: yes, structurally — `unique (message_id)`,
deliberately not a composite key including the nullable
`project_update_id` (the migration's own comment explains why a
composite would have let two null-`project_update_id` rows both pass).

**Grants**: `authenticated` → `select` only. `service_role` → **no
grant of any kind** (confirmed: the revoke block for this table has no
matching positive grant anywhere in either migration). **Nothing can
currently insert into this table at all** — correct for Phase 5 (Phase 5
must never write here), but also means Phase 6 will need its own new
grant/RPC when it actually arrives.

### Classification

| Table | Classification | Reasoning |
|---|---|---|
| `share_messages` — **structure, RLS, trigger, indexes** | **A — ready as-is** | Complete, correct, matches every Phase 5 product rule already (never mutates projects/tasks/CRM/timeline; comments_enabled/active/unexpired/project-alive already enforced for client writes) |
| `share_messages` — **grants for owner writes** | **B — usable with additive changes** | No path exists today for an owner-authored insert or ANY status/review update (see §17 §21) |
| `share_message_conversions` | **D — Phase 6-only** | By design and by its own migration's explicit statement; Phase 5 must not write to it |

### Every repository reference to both tables (exhaustive)

Both names appear **only** in: `supabase/migrations/202608030003_*.sql`
(definition), `supabase/migrations/202608030005_*.sql` (trigger/grants),
their two `.test.ts` files (schema-shape tests against the migration
source text), and `scripts/client-share/build-phase1b-runtime-package.test.ts`
(the same kind of source-text assertion, part of the disposable runtime
package generator's own test suite). **Zero references in any
`app/**`/`lib/**` application file.** No repository function, no API
route, no React component, no Zod contract references either table
today. Phase 5 is a greenfield application layer against an existing
schema.

---

## 3. `commentsEnabled` audit

1. **Where stored**: `project_share_links.comments_enabled`, `boolean
   not null default false` (202608030003, line 109). New links are
   comment-disabled by default, matching the same opt-in-by-default
   posture as `share_link_resources.can_download`.
2. **How configured today**: via `save_share_configuration`'s
   `p_settings` JSON (`commentsEnabled` key), called from
   `share-link-configuration-editor.tsx`'s `ToggleRow` ("Allow client
   comments", line 472-476) — but **only from that advanced editor
   component**. Direct grep confirmed `share-link-quick-share.tsx` (the
   current, simplified, actually-used-by-owners "Share with client"
   panel per the Phase 3 UX simplification) **does not reference
   `commentsEnabled` anywhere except in a code comment** — no toggle, no
   field, no default override.
3. **Visible in the simplified UI**: **no.** This is a real, concrete
   gap: since the column defaults to `false` and quick-share never sets
   it, **every share link created through the current primary owner flow
   has `comments_enabled = false` permanently, with no UI path to ever
   change it.** Phase 5 cannot ship without addressing this — flagged as
   implementation slice 5A/5D's first concrete task, not a schema
   change.
4. **Part of the public projection**: **yes, already** —
   `ClientProjectProjection.commentsEnabled: z.boolean()`
   (`client-share-projection-contracts.ts`, confirmed present and
   already populated by `assembleClientProjection` from
   `link.commentsEnabled` in both the owner-preview and public code
   paths). **Currently unused by `ClientProjectView`** — read directly:
   the component never references `projection.commentsEnabled` anywhere
   in its render body. A prepared, unconsumed flag, exactly matching the
   schema's own "built ahead of need" pattern.
5. **What should happen when `commentsEnabled=false`**: the public page
   must not render any message-composition affordance, and the public
   submission endpoint must reject a write attempt regardless of session/
   grant validity — already enforced twice over at the data layer (the
   trigger's own `SHARE_MESSAGE_CLIENT_COMMENTS_DISABLED` check) and
   must be enforced a third time at the application layer before ever
   reaching that insert, mirroring this feature's own established
   defense-in-depth convention (never rely on the DB trigger alone).
6. **Does changing it bump `configuration_version`?** **Yes, confirmed
   directly** from `save_share_configuration`
   (`202608060003_client_share_configuration_save.sql`, lines 510-529):
   `commentsEnabled` is one of exactly three fields
   (`comments_enabled`, `client_facing_subtitle`, `content_direction`)
   whose change increments `configuration_version` — this is pre-existing
   Phase 1B/3 behavior, not something Phase 5 introduces.
7. **Would that invalidate the current grant?** **Yes** — per the
   already-audited Phase 3 contract (`grant.granted_configuration_version
   !== link.configurationVersion` → `verifyShareProjectionAuthorization`
   fails), toggling comments on/off forces every existing visitor's grant
   stale, requiring re-authorization (re-entering the link/PIN) on next
   read.
8. **Is that intentional/useful for feedback?** **Yes** — this is the
   correct, already-proven security behavior: an owner turning comments
   ON should not silently let stale, already-issued grants (minted before
   the owner decided to accept public writes) start submitting messages
   without a fresh authorization pass. No change needed; Phase 5 simply
   inherits this correctly by reusing the existing gate unmodified.

---

## 4. Public UI findings

Read `app/share/[publicId]/**`, `share-view.client.tsx`, `ClientProjectView`
in full (all three already deeply familiar from Phase 4). No existing
form, textarea, or message-related placeholder of any kind exists
anywhere in the public page today — this is a genuinely blank slate for
the UI portion.

**Cleanest UI location**: the bottom of `ClientProjectView`'s existing
column, as its own new `<section>` (matching the existing
Progress/Latest-update/Tasks/Attachments section pattern exactly —
`aria-label`, `sectionStyle`, consistent spacing), rendered only when
`projection.commentsEnabled` is true. The task's own preferred direction
(a single "Send a message" textarea + optional name field + Send button)
matches this component's existing minimalist, single-column, no-chrome
design philosophy exactly — no new visual language needed.

**Threaded chat vs. chronological history — audited, not assumed**: the
schema supports one level of `parent_id` threading, but nothing in the
product requirement, the schema design, or the existing UI's own
minimalist posture calls for a live/real-time chat surface. A **simple
reverse-chronological list of visible messages** (client's own messages
plus any owner replies, oldest-or-newest-first as a static list,
refreshed on page reload) is the better V1 fit: it needs no
read-receipt/typing-indicator/live-update machinery, matches "keep it
lightweight," and the existing `is_visible_to_client` +
`parent_id`-scoped-to-visible-parent design already supports rendering a
reply directly under its message without needing a general-purpose
threading UI. **Recommendation: chronological communication history,
not a chat UI, for V1** — a genuine one-level "message + reply"
relationship is enough given `parent_id` exists, without building
arbitrary-depth thread UI.

**Identifying field**: `author_display_name` already exists and is
optional (nullable, 1–80 chars *if* provided — an empty/absent value is
valid). No email/phone column exists at all, confirming Locked Principle
#6's default (email stays out) is already the schema's own decision, not
something Phase 5 needs to newly decide.

**Mobile/RTL**: `ClientProjectView`'s existing `dir={projection.contentDirection}`
wrapper already covers any new section added inside the same column —
no separate RTL handling needed for the new section itself.

---

## 5. Owner UI findings

No `project-surface-activity.tsx` or similar "activity feed" component
exists (a grep for the name only matched a `.test.ts` file, i.e. it does
not currently exist as a real component — do not assume it does). The
existing, most relevant seams:

- **`share-link-panel.tsx`** — the current owner Share panel (quick-share
  + Preview). The most natural home for a **compact** "Client messages"
  entry point (e.g. a small section/button near the existing Preview
  action), not a full inline history — the panel is deliberately kept
  short per the Phase 3 simplification.
- **`project-update-history-modal.tsx`** (`app/components/dashboard/tasks/project-updates/`)
  — the existing pattern for "a modal showing a chronological list of
  past project-level events, opened from a small trigger button." This
  is the **closest existing reusable UX pattern** for a "Client
  Communication History" modal — same interaction shape (open a modal,
  see a list, close it), different data source, and **critically**
  already a separate surface from the professional Project Timeline —
  reusing its *pattern* (not its component directly, since it's
  Client-Update-specific) satisfies Locked Principle #3 (separate from
  Project Timeline) essentially for free, by construction.
- **`app/components/dashboard/ui/badge.tsx`** — an existing, generic
  badge component, reusable for an unread-count indicator without
  inventing new UI primitives.

**Unread counts — cheap to derive**: yes. The partial index
`share_messages_unread_client_idx (user_id, share_link_id) where
status='new' and author_type='client'` was **already built specifically
for this** — a `count(*)` against it, or a `select share_link_id,
count(*) group by share_link_id` for a project's links, is an
index-only scan. No new index or schema change needed for unread counts
at either the per-link or per-project level (the `(user_id, project_id,
created_at desc)` index covers the project-level read too).

**Project list/card badge**: **defer past Phase 5.** The task's own
framing correctly separates "can we derive it cheaply" (yes) from
"should the project list surface it in V1" (a broader product-surface
change touching the dashboard's own list/card components, which are
out of this audit's traced scope and not required for Phase 5's stated
goal of capture + management). Recommend: Phase 5 ships the unread count
inside the Client Messages panel/modal itself only; a dashboard-wide
badge is a natural, low-risk follow-up once the underlying data exists,
not a Phase 5 blocker.

**What must stay separate from existing History**: confirmed
structurally, not just by convention — `share_messages` has **no**
foreign key, trigger, or any other relationship to
`project_timeline_events` (directly asserted by
`202608030003_client_share_owner_foundation.test.ts:804-810`, and
reconfirmed by reading the trigger body, which writes to no other table
at all). This separation is already a database-level guarantee, not
something the UI has to enforce on its own.

---

## 6. Communication model recommendation

Answering each, from actual schema + the audited product intent:

- **A. Client sends a top-level message**: yes — `parent_id null`, `author_type='client'`.
- **B. Owner can reply**: yes, schema-supported (`author_type='owner'`, `parent_id` pointing at the client's message) — **but currently ungranted** (§2, §17); needs the additive fix.
- **C. Client can reply again**: yes, schema-supported (client `parent_id` → owner's reply), gated by the trigger's own rule that a client may only reply to an already-`is_visible_to_client` message (always true for an owner reply, since nothing in this design ever hides an owner's own reply from the client it was written to).
- **D. True thread vs. one chronological conversation**: **one chronological conversation per share link is sufficient for V1** (§4) — the schema's one-level `parent_id` is enough to associate a reply with what it replies to without needing arbitrary-depth thread UI.
- **E. Message direction model**: `author_type` (`client`|`owner`) **is** the direction model — already exactly "client → owner" / "owner → client," no richer model exists or is needed.
- **F. Commenter name required**: **no** — `author_display_name` is nullable.
- **G. Commenter email required**: **no** — no email column exists at all; per Locked Principle #6, stays out.
- **H. Anonymous identity tied only to the authorized browser session**: **yes, by design** — the table stores no browser-session id at all (the schema comment says so explicitly); identity for authorization purposes is proven at write time by the server (browser-session + grant check, mirroring Phase 4's file route exactly), not stored on the row itself. `author_display_name`, if provided, is purely a **display** convenience, never an identity/authorization mechanism.
- **I. Display when no name supplied**: needs a UI-level fallback label (e.g. "Client") — no schema concern, a presentational decision for 5C/5D.
- **J–O. Link rotation / revoke / disable-re-enable / expiry / PIN change / `configuration_version` change**: none of these ever delete or hide existing `share_messages` rows (no cascade from any of these operations touches this table at all — confirmed: the only `on delete cascade` into `share_messages` is from `project_share_links` itself, i.e. link *deletion*, not rotation/revocation/disabling/expiry, none of which are row deletions). They all affect only **whether a client can currently read/send** (the live authorization gate, re-run fresh every request, exactly like Phase 4), never the stored history. See §14 for the full lifecycle table.
- **P. Historical owner communication survives public-link revocation**: **confirmed from schema, not assumed** — `share_messages.share_link_id` cascades only from `project_share_links` row deletion (not from state transitions), and the owner's own RLS `select` policy is scoped by `user_id`, entirely independent of the link's current `state`. A revoked/disabled/expired link's messages remain fully owner-readable forever (until the owner deletes the *project*, which cascades transitively through `project_share_links → share_messages`).

---

## 7. Owner reply recommendation

**Include owner replies in Phase 5** — the audit supports this: the
schema, trigger, and RLS already fully anticipate it (`author_type='owner'`
branch exists, checked against `auth.uid()`), and the only gap is a
missing grant (§2, §17), a small additive fix, not a design gap.

- **Authorization**: the RLS-bound, cookie-authenticated owner client
  (`createClient()`, matching every other authenticated dashboard
  mutation in this codebase) — **not** `supabaseAdmin`, since the
  trigger's `auth.uid() = new.user_id` check requires a real session JWT,
  which service-role calls do not carry.
- **API route**: owner-authenticated, new (see §10).
- **Author/direction representation**: `author_type='owner'`, exactly as
  already modeled — no new column needed.
- **Public projection inclusion**: yes — a public read of a link's
  messages must include visible owner replies (`is_visible_to_client`
  is already `true` by default and the trigger never lets a client set
  it to anything else on their own inserts; an owner reply's own
  `is_visible_to_client` should default `true` too, matching "reply to
  the client" as the whole point of the feature).
- **Visible after refresh**: yes — this is a stored, queried history,
  not an ephemeral live feed; a plain reload re-fetches it exactly like
  the existing projection does today.
- **Ordering**: `created_at` ascending within a conversation (oldest
  first, matching a natural reading order) — the existing
  `(share_link_id, created_at)` index already supports this directly.
- **Timestamp semantics**: `created_at` only for display; no
  "delivered"/"seen" semantics anywhere in the schema, and none should
  be added.
- **Client can reply again**: yes (§6.C).
- **No email delivery in this phase**: confirmed correct — nothing in
  the schema or this codebase's existing infrastructure suggests
  otherwise (see §12).

**Realtime/WebSockets: audited, default NO, confirmed correct.** No
Supabase Realtime channel, WebSocket server, or polling infrastructure
exists anywhere in this repository for any feature, Client Share or
otherwise. Introducing one would be a materially larger, riskier
architectural addition than anything else in this feature to date.
**Manual refresh / reload is sufficient for V1** — the existing
projection-refresh pattern (a plain `fetch()` on load, no live
subscription) already establishes this as the accepted product pattern
for this exact page.

---

## 8. Public message submission security

Confirmed the natural authorization chain by re-reading the exact same
primitives Phase 4's file route already proved out — this **is** a
direct reuse, not a new design:

1. Feature flag (`assertClientShareEnabled`).
2. `isRejectableCrossSiteRequest` (Phase 4B Defect #1's fix — but note:
   this is a **POST**, not a GET/navigation, so the `Sec-Fetch-Site:
   none` + `Mode: navigate` carve-out is irrelevant here; a message
   submission will always be a same-origin `fetch()` from the loaded
   page, so the simpler `same-origin`-or-absent check alone is sufficient
   — confirm this doesn't need the navigation-specific broadening Phase
   4B needed, since there is no legitimate "type this POST directly into
   the address bar" scenario).
3. `isValidSharePublicId(publicId)`.
4. HttpOnly browser-session cookie present + shape-valid.
5. **Rate limit — `comment_submission` already exists in the DB
   vocabulary.** Read `202608130001_client_share_rate_limit_increment.sql`
   directly: the `p_action` CHECK constraint already lists
   `'comment_submission'` and **`'file_access'`** alongside the four
   actions currently wired into application code
   (`session_exchange`, `pin_verification`, `projection_read`,
   `invalid_link_access`). **Neither `comment_submission` nor
   `file_access` has ever been added to `lib/share/share-rate-limit.server.ts`'s
   own `ShareRateLimitAction` union/`RATE_LIMIT_POLICY` table** — they
   exist in the database's own allowed vocabulary, unused, exactly like
   the two communication tables themselves. **This means Phase 5 can
   give message submission its own dedicated, tighter rate-limit bucket
   with zero migration** — simply add `comment_submission` to the
   existing TypeScript union and pick a V1 limit/window (recommend
   something meaningfully tighter than `projection_read`'s 120/300s,
   given a message-spam bucket is a more sensitive abuse surface than a
   read — e.g. 10/300s as a starting point, a product decision to
   confirm before implementation, not decided here). *(Side note,
   outside Phase 5's own scope but worth flagging: Phase 4's own
   decision to reuse `projection_read` for file access, made without
   knowing `file_access` already existed in the DB vocabulary, could be
   revisited later with zero migration cost — not a Phase 5 blocker,
   recorded here only because this audit surfaced it.)*
6. `verifyShareProjectionAuthorization` (unmodified, full reuse).
7. **New**: `commentsEnabled` re-check at the application layer
   (defense-in-depth on top of the trigger's own check — matching every
   other double-enforced Client Share invariant).
8. **New**: body validation, then `supabaseAdmin` insert (the trigger
   does the rest — link/project/state/comments-enabled/expiry/project-alive
   checks all re-verified server-side by the trigger itself, a second
   independent layer beneath the application's own check in step 7).

**Body validation, audited against the schema's own constraints**:
`share_messages_body_check` already enforces `char_length(btrim(body))
>= 1 and char_length(body) <= 4000` at the database level — **the
application layer must still validate this itself before ever attempting
the insert** (fail fast with a clean client-facing error, not a raw
Postgres constraint-violation surfaced to the visitor), but the
**ceiling is already fixed by the schema**: 4000 characters. Recommend:
trim whitespace before length-checking (matching the check constraint's
own `btrim` usage exactly, so the two never disagree), reject empty/
whitespace-only bodies client-side and server-side, reject anything over
4000 chars with a clear message rather than a truncation. **HTML**:
`body` is `text`, no `body_html` column exists (confirmed,
`202608030003_client_share_owner_foundation.test.ts:517-522`) — store
raw plain text, **render escaped** (React's default JSX text rendering
already does this — no `dangerouslySetInnerHTML` anywhere in this
component tree, and none should ever be introduced for message bodies).
**URLs/markdown**: no link-ification, no markdown rendering in V1 — plain
text only, matching "store plain text, render escaped text" exactly.
**Control characters**: strip the same class this project already strips
elsewhere (`share-file-response.server.ts`'s own C0-control-stripping
pattern is a directly reusable precedent, not a new technique to
invent). **Repeated identical spam / double-submit**: no existing
idempotency-key mechanism exists in this codebase for any POST endpoint
— recommend client-side (disable the Send button during submission,
matching the existing PIN-form submission UX pattern already used on
this same page) plus the rate limit itself as the actual defense;
building a server-side idempotency-key system is more machinery than a
V1 comment box needs and isn't precedented anywhere else in this
codebase.

---

## 9. Privacy model

Public message payload must contain, and only contain: `id` (a decision
point, see below), `authorType`, `authorDisplayName` (nullable),
`body`, `createdAt`, and (if threading is rendered) a way to associate a
reply with its parent. **Never**: `user_id`, `project_id`, `share_link_id`,
any internal DB id beyond what's decided below, `status`/`reviewed_at`/
`resolved_at` (owner-only workflow state — a client learning their
message was "dismissed" is exactly the kind of owner-private state this
feature's own trigger comment already protects: "it never affects what
the client can read"), `converted`/conversion state, service-role
material, Storage paths (not applicable to messages but restated for
completeness), analytics identifiers.

**Opaque public message reference — is one needed?** Given the
recommended V1 model (§4: reverse-chronological read, `refresh`-only, no
per-message client-side action like edit/delete), **no per-message
public identifier is strictly required for V1** — the client only ever
needs to *render* the list, never reference an individual message by id
in a subsequent request. If future UI needs (e.g. "reply to this
specific message") requires addressing one message from the client,
the same `fileRef`-style opaque-HMAC-reference pattern Phase 4 already
proved out (`lib/share/share-file-ref.server.ts`, now correctly using
its **own dedicated** HMAC key, not a reused one — the Phase 4 lesson
this audit deliberately does not repeat mis-stating) is the established,
directly reusable precedent — not a new design problem if it becomes
needed later. **Recommendation: omit any public message id from the V1
response entirely**; the raw database `id` never needs to leave the
server for the read-only, no-per-message-action V1 UI this audit
recommends.

Owner-side reads use real internal ids freely, behind the existing
authenticated/RLS boundary — no opacity needed there, matching every
other owner-facing Client Share read in this codebase.

**Headers/isolation**: reuse the exact existing `NO_STORE_HEADERS`
shape (`Cache-Control: private, no-store`, `Pragma: no-cache`,
`Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`) both
Phase 3/4 public routes already share — no new header policy needed.
**noindex/noarchive**: the public share page's existing metadata
posture was not re-audited in depth this turn (out of this audit's
traced scope; recommend a quick confirmation pass in 5B, not a Phase 5
blocker either way since it's a page-level concern, not specific to
messages). **CSP**: the file route's `Content-Security-Policy: sandbox`
is specific to file delivery; the messages endpoints return JSON, not a
document/file, so that specific header does not apply — no new CSP
concern identified. **Analytics isolation**: `/share/**` is already
excluded from analytics/session-replay/cookie-consent
(`lib/analytics/analytics-paths.test.ts`,
`app/components/analytics/cookie-consent-banner.test.tsx`, both
reconfirmed passing during Phase 4C) — a new route under
`/api/share/[publicId]/messages` and a new section on the existing
`/share/[publicId]` page both inherit this exclusion automatically,
since the exclusion is path-prefix-based, not route-by-route
allow-listed (confirm the exact prefix match in 5B rather than assuming,
but no evidence suggests it would exclude the new surface).

---

## 10. API surface recommendation

Prefer **two** public endpoints and **two** owner endpoints — fewer than
the task's own illustrative sketch by merging owner reply into a single
owner-side write endpoint, matching this codebase's existing preference
for narrow, single-purpose routes over a generic CRUD shape (see every
existing Client Share route: one action per route file).

| Endpoint | Caller | Auth | Input | Output | Side effects | Rate limit | Cache | Ids exposed |
|---|---|---|---|---|---|---|---|---|
| `GET /api/share/[publicId]/messages` | anonymous | full chain (§8 steps 1-6) | none | `{ok:true, data: {commentsEnabled, messages: [...]}}` | none | `projection_read` (reused — a read, matching the projection route's own action) | `private, no-store` | none (opaque-free per §9) |
| `POST /api/share/[publicId]/messages` | anonymous | full chain (§8) | `{body, authorDisplayName?}` | `{ok:true}` or generic denial | one `share_messages` insert, `author_type='client'` | **new** `comment_submission` (already in DB vocabulary, §8) | `private, no-store` | none |
| `GET /api/share-links/[id]/messages` | owner | existing authenticated-owner pattern (mirrors `/api/share-links/[id]/preview`) | none | full message list incl. `status`/internal ids | none | none needed (authenticated, not public-abuse-surface) | normal | internal ids fine (owner-only) |
| `POST /api/share-links/[id]/messages` | owner | existing authenticated-owner pattern | `{body, parentId?, status?}` (reply and/or status update in one narrow route, or split into two if the two write shapes turn out not to share enough logic during 5C build-out — a build-time judgment call, not decided here) | `{ok:true, data: message}` | insert (`author_type='owner'`) and/or update (`status`/`reviewed_at`/`resolved_at`) | none needed | normal | internal ids fine |

**Error philosophy**: the two **public** routes must follow the exact
established Client Share convention — one generic, indistinguishable
denial shape for every authorization failure (AGENTS.md rule 10, already
proven in Phase 3/4), never leaking *why* a request was rejected. The
two **owner** routes follow the existing authenticated-route convention
elsewhere in this codebase (specific, helpful error messages are fine
and already the norm there — see `/api/share-links/[id]/preview`'s own
error shapes).

---

## 11. Phase 5 / Phase 6 boundary

Audited the existing Client Updates engine's route surface
(`/api/project-updates/analyze`, `/analyze-image`, `/apply`, `/history`,
plus the review modal / "Already handled" UI) only to the depth needed
to confirm the boundary, per this turn's own scope — not a full
re-audit of that engine's internals.

**`share_message_conversions` already IS the intended bridge** — this is
not a Phase 5 design decision to make, it is already true by
construction (§2). The exact, already-encoded boundary:

```
PHASE 5 owns:  communication capture (client → share_messages insert)
               + communication management (owner reply, status transitions)

PHASE 6 owns:  an explicit owner action that:
               1. reads a share_messages row through the EXISTING
                  Client Updates analyze/review/apply flow (as input
                  context, not a new AI pathway)
               2. on owner-confirmed apply, writes the existing
                  project_updates row exactly as that flow already does
               3. ONLY THEN inserts one share_message_conversions row
                  pointing at the message and the resulting update,
                  setting share_messages.status = 'converted'
```

Phase 5 may add a **UI-only, inert placeholder** affordance (e.g. an
owner-facing "Turn into work" button in the Client Messages panel that
is either hidden, disabled, or clearly labeled "coming soon" in V1) if
that materially helps ship a coherent owner workflow story — but it must
perform **zero** conversion logic, and should not be treated as required
for Phase 5's own completion. Recommend deferring even the placeholder
to Phase 6's own first slice unless 5D's implementation finds a concrete
UX reason to stub it earlier.

---

## 12. Notification recommendation

No email-sending infrastructure was found wired into any Client Share
flow today (Phase 3/4 are entirely notification-free — no email is ever
sent on link creation, PIN change, view, or anything else). A broader
transactional-email system may exist elsewhere in this codebase for
other features (billing, auth) but was not in scope to re-audit this
turn, and reusing it for Client Share would be a materially separate
decision from anything already accepted in this feature.

| Notification | Recommendation |
|---|---|
| In-app unread badge (owner) | **A — required for Phase 5** — cheap (§5), directly serves "owner should be able to see... that communication," no new infrastructure |
| Email to owner on new client message | **C — Phase 6+** — no existing safe, proven path in this feature; adding one now would meaningfully broaden Phase 5's own scope beyond "capture + management" |
| Email/notification to client on owner reply | **C — Phase 6+ (or never)** — the client has no persistent identity (no email required, §6.G) to notify through in the first place; would require collecting an email, a product-scope expansion this audit was not asked to evaluate |
| Push/browser notification | **B — nice-to-have later**, not evaluated further this turn |

---

## 13. Lifecycle behavior

| Event | Can client read/send NOW? | Does owner retain historical communication? |
|---|---|---|
| Owner deletes project | N/A — link cascades away too | **No** — `projects → project_share_links` cascade (pre-existing) then `project_share_links → share_messages` cascade (confirmed, §2) means project deletion is the one real communication-destroying event. Same behavior already exists for every other Client Share child table (tasks/resources/updates mappings) — not a Phase 5-specific risk. |
| Owner revokes share link | No (trigger's `link_state <> 'active'` check fails closed) | **Yes** — no cascade from a state change, only from row deletion (§6.J-P) |
| Owner disables link | No | **Yes** |
| Link expires | No | **Yes** |
| Link rotates (secret rotation) | Depends only on session/grant re-authorization, unrelated to messages | **Yes** — rotation never touches `share_messages` at all |
| Resource/task mappings change | Unrelated | **Yes** |
| `configuration_version` changes | No, until the visitor re-authorizes (§3.7) | **Yes** |
| Browser grant expires | No, until re-authorization | **Yes** |
| Client clears cookies | No, until a fresh session/grant is established (existing Phase 3 re-entry flow) | **Yes** (nothing about a message is tied to a specific browser session anyway, §6.H) |
| Owner deletes/dismisses a message | N/A (no delete capability recommended for V1 — `dismissed` is a status, not a deletion, and no soft-delete/archive column exists) | `dismissed` is retained, not erased — it is exactly a workflow-state value, never a removal |
| Owner archives project | Not investigated this turn — `projects.is_archived`/`archived_at` were seen in the fixture schema audit (Phase 4 turn) but this flag's exact interaction with Client Share link availability was not re-traced this turn; flag as a §20 open item rather than assume |

**No dangerous cascade found.** The only communication-destroying
cascade is project deletion, which is already the expected, universal
behavior for every other piece of Client Share data tied to that
project — not a new risk Phase 5 introduces.

---

## 14. RLS / service-role / trust boundaries

Already fully audited in §2. Summary: `authenticated` (owner) has
`select`-only on both tables today — correct for reads, insufficient for
owner writes. `service_role` has `select` + a narrow column-scoped
`insert` on `share_messages` only — correct and sufficient for the
**client** write path (mirrors Phase 4's `supabaseAdmin`-mediated
pattern exactly: public writes always go through service-role after the
application's own full authorization chain, never a direct anonymous
grant of any kind — Locked Principle #1 and #2 are already structurally
satisfied by the existing grant shape). No `anon` grant exists on either
table, anywhere, in either migration — confirmed by reading every
`revoke`/`grant` line in both files.

**Is a new RPC (`SECURITY DEFINER`) actually needed, or is a plain
authenticated insert/update grant sufficient for owner writes?** This
codebase's own established, explicitly-stated convention (Phase 1A's own
migration comment, §17) is: **owner mutations go through narrow RPCs**,
never broad direct-table DML grants to `authenticated` — every existing
owner mutation in this entire feature (`set_share_link_pin`,
`clear_share_link_pin`, `set_share_link_expiry`, `revoke_share_link`,
`rotate_share_link_secret`, `save_share_configuration`, etc.) follows
this pattern without exception. **Recommendation: two new narrow
`SECURITY DEFINER` RPCs** (`send_share_message_reply`,
`set_share_message_status`, or one combined RPC — a build-time judgment
call for 5C), not a direct `grant insert/update ... to authenticated`.
This is both **more consistent** with the existing 100%-RPC convention
and **more minimal attack surface** (the RPC can enforce exactly the
invariants the trigger already partially enforces, in one reviewable
place, exactly like every sibling RPC already does).

---

## 15. Test matrix

**PUBLIC AUTHORIZED**
- `commentsEnabled=true` + valid session/grant → GET returns messages, POST succeeds.
- Owner reply appears in the next public GET.
- Refresh (new request, same valid session/grant) → same history returned.

**PUBLIC DENIED**
- `commentsEnabled=false` → GET/POST denied, even with an otherwise-valid session/grant.
- Missing browser session → denied.
- Missing grant → denied.
- Expired grant → denied.
- Stale `configuration_version` → denied.
- Disabled link → denied.
- Revoked link → denied.
- Expired link → denied.
- PIN required but unverified → denied.
- Project deleted/unavailable → denied.

**MESSAGE VALIDATION**
- Empty body → denied (client- and server-side).
- Whitespace-only body → denied.
- Body over 4000 chars → denied with a clear error, not a raw constraint violation.
- HTML in body is stored and rendered as literal text, never executed.
- A URL in the body is not link-ified or fetched.
- Control characters are stripped.
- Rapid identical duplicate submissions are throttled by `comment_submission` rate limiting.
- A resubmission after a browser refresh (no client-side idempotency key) is treated as a genuinely new message — document this as expected V1 behavior, not a defect, given §8's reasoning.

**OWNER READ**
- Owner sees only their own project's/link's messages (RLS + route scoping).
- `status`/`reviewed_at`/`resolved_at`/internal ids are visible to the owner, never to the public routes.
- Cross-owner isolation: owner A cannot read owner B's messages (existing RLS `auth.uid() = user_id`, reconfirm at the route layer too).

**OWNER REPLY**
- Owner reply inserts with `author_type='owner'`, `auth.uid() = user_id` enforced.
- A non-owner (or an unauthenticated caller) cannot insert an owner-attributed reply.
- Reply appears in the public projection/messages read immediately (no caching gap).
- Reply visible after a public refresh.
- Ordering is `created_at` ascending.

**OWNER STATUS MANAGEMENT**
- `new → reviewed → resolved` and `new → dismissed` transitions succeed.
- `reviewed_at`/`resolved_at` are set consistently with the check constraint's own rules.
- A status/timestamp update never changes `body`/`author_type`/`author_display_name`/`parent_id`/`share_link_id`/`project_id`/`user_id`/`created_at` (trigger already enforces this — test that the RPC/route never even attempts it).
- Status changes are invisible to the public read (`is_visible_to_client` is the only client-facing visibility signal, per the trigger's own comment).

**LIFECYCLE**
- Every scenario in §13's table, both halves (can-read/send vs. does-owner-retain).

**PRIVACY**
- No `user_id`/`project_id`/`share_link_id`/internal message id/status/conversion state in any public response.
- No service-role material, no Storage-adjacent leakage (N/A but worth an explicit empty-set assertion, matching this feature's existing toxic-fixture-test convention).
- Generic, indistinguishable public error shape across every denial reason.
- No analytics/session-replay firing on the new public routes or the new page section (reconfirm the existing exclusion covers them, per §9).

**RATE LIMIT / ABUSE**
- `comment_submission` bucket enforced independently of `projection_read`'s own bucket (a visitor exhausting one must not be blocked from the other unless intentionally shared — recommend independent buckets given the different sensitivity, per §8).
- Exceeding the bucket returns the existing `RATE_LIMITED`/429 shape.

**RTL / MOBILE / ACCESSIBILITY**
- New section renders correctly under `dir="rtl"`.
- Textarea/Send button are usable at mobile width (reuse existing responsive column constraints — no new breakpoint work anticipated).
- Labeled `<section aria-label="...">` landmark, matching every existing section.

**PHASE 6 BOUNDARY**
- No `share_messages` write ever creates a `project_update` row.
- No `share_messages` write ever creates/modifies a `task`/`subtask`.
- No `share_messages` write ever modifies `projects` (status/priority/deadline/CRM fields).
- No `share_messages` write ever inserts a `project_timeline_events` row.
- No `share_message_conversions` row is ever created by any Phase 5 code path.

---

## 16. Schema verdict

**B — SMALL ADDITIVE SCHEMA CHANGE NEEDED.**

Not because the existing design is wrong (it is not — classification A
for structure, §2) but because the **grants** are incomplete for the
owner-write half of the feature this audit recommends including (§7).
Exact proposed migration (**not created this turn**):

- **Two new `SECURITY DEFINER` RPCs** (matching every existing owner
  mutation in this feature, §14): `send_share_message_reply(p_link_id
  uuid, p_body text)` and `set_share_message_status(p_message_id uuid,
  p_status text)` (or one combined RPC if 5C's own build finds that
  cleaner — not decided here). Each independently verifies
  `auth.uid()` ownership of the link/message before writing, exactly
  like `set_share_link_pin`/`revoke_share_link`/etc. already do.
- **No table/column/index/RLS-policy change** — the existing structure,
  trigger, indexes, and RLS already fully support everything these RPCs
  need to do.
- **Why required**: confirmed by direct grant inspection (§2, §14) — no
  currently-granted path exists for either operation.
- **Backward compatibility**: fully additive; touches no existing row,
  column, or behavior of any currently-shipped Client Share feature.
- **Production implications**: none beyond the normal add-two-functions
  migration review — no data migration, no existing-row backfill, no
  behavior change to Phase 1–4.

Separately, **no schema change** is needed to activate `comment_submission`
rate limiting (§8) — that is a pure application-code change to
`lib/share/share-rate-limit.server.ts`'s existing TypeScript union, since
the database vocabulary already permits the value.

**DO NOT CREATE THIS MIGRATION THIS TURN**, per this turn's own
constraint — recorded here as the exact, evidence-justified content for
whenever implementation begins.

---

## 17. Implementation slices

| Slice | Scope | Files likely touched | Tests | Disposable runtime proof | Browser acceptance | Stop/go criterion |
|---|---|---|---|---|---|---|
| **5A** | Communication schema/repository proof + the one additive migration (§16) + quick-share `commentsEnabled` toggle (§3.3 gap) | new migration; `lib/share/share-messages-repository.server.ts` (new, mirroring `share-links-repository.server.ts`'s pattern); `share-link-quick-share.tsx` (add toggle) | RPC-shape tests (mirroring existing `*.test.ts` migration-source-assertion style), repository unit tests | disposable SQL fixture package, mirroring every prior phase's own `docs/client-share-phaseN-.../` convention | not required yet | RPCs exist, grants correct, toggle visible and wired to the existing `save_share_configuration` call |
| **5B** | Public message submission (`POST /api/share/[publicId]/messages`), `comment_submission` rate-limit wiring | new route + test; `share-rate-limit.server.ts` (add action) | full auth-chain denial matrix (§15), body-validation matrix | none beyond existing local test mocks | not required yet | route matches the established Phase 4 route-scaffolding conventions exactly, all denial tests pass |
| **5C** | Public read (`GET /api/share/[publicId]/messages`) + owner read/reply/status routes | new public route + test; new owner routes + tests; `lib/share/share-messages-repository.server.ts` extended | owner-read/reply/status matrix (§15) | none | not required yet | public read never exposes forbidden fields (§9), owner routes correctly scoped |
| **5D** | Public UI section (`ClientProjectView` + `share-view.client.tsx`) + owner "Client messages" panel/modal (reusing `project-update-history-modal.tsx`'s pattern, §5) | `client-project-view.tsx`, `share-view.client.tsx`, new owner component(s) | UI test matrix (RTL/mobile/no-forbidden-fields, mirroring Phase 4C's own A–I style) | none | **yes** — real disposable-project send/reply/refresh pass, mirroring Phase 4's own acceptance style | end-to-end send → owner sees it → owner replies → client sees it, in a disposable environment |
| **5E** | Status/unread workflow polish (badge in the owner panel, §5) | owner component(s) only | unread-count tests | none | light manual pass | badge count matches the partial-index-backed query exactly |
| **5F** | Lifecycle/security/browser acceptance | none (verification only) | full §15 matrix, real Preview retest | none | **yes** — real Vercel Preview pass, mirroring Phase 4B/4C's own disposable-Preview acceptance discipline exactly | every §13 lifecycle row confirmed against a real deployment, not just mocks |
| **5G** | Phase 5 closure | doc only | full regression + `tsc`/`eslint`/`git diff --check`/`npm run build` | none | none | all green, doc updated to COMPLETE/PASS |

This sequence follows the task's own suggested shape with one
adjustment: `commentsEnabled`'s quick-share gap (§3.3) is pulled into 5A
rather than left implicit, since without it no real link can ever
receive messages regardless of how correct the rest of the stack is.

---

## 18. Risks / open decisions

- **`commentsEnabled` UI gap (§3.3)** — must be decided/scheduled explicitly (recommended: 5A), not discovered mid-slice.
- **One combined vs. two owner RPCs** (§14, §16) — a build-time ergonomics call, not a security-relevant decision either way.
- **`comment_submission` bucket's exact limit/window** — a product decision (this audit recommends ~10/300s as a starting point, not a final number).
- **Public message id necessity** (§9) — recommended omitted for V1; revisit only if a future UI need requires addressing an individual message from the client.
- **`projects.is_archived` interaction with Client Share availability** (§13) — not retraced this turn; a small, cheap confirmation item for 5A/5F, not expected to be a blocker.
- **noindex/page-metadata posture on `/share/[publicId]`** (§9) — not re-audited this turn; a quick confirmation, not expected to be a blocker.
- **Phase 4's own `file_access`/`projection_read` rate-limit choice** — not a Phase 5 blocker, noted only because this audit's own §8 research surfaced that `file_access` already exists unused in the DB vocabulary; worth a note to revisit independently of Phase 5.

---

## 19. Exact recommended next implementation slice

**5A** — the one additive migration (two owner-write RPCs) plus the
`commentsEnabled` quick-share toggle. Both are prerequisites every later
slice depends on (5B/5C cannot test owner writes without the RPCs; 5D's
end-to-end browser acceptance cannot produce a single real message
without the toggle), and both are small, low-risk, fully additive
changes with no behavior change to anything already shipped.

---

# PHASE 5 IMPLEMENTATION READINESS:
READY

---

# PHASE 5A — COMMUNICATION FOUNDATION — OWNER WRITE RPCs + COMMENTS ENABLEMENT

Scope for this slice, exactly as scoped in §17's own table: the one
additive migration (two owner-write RPCs), the smallest owner-side
repository layer needed for later slices, and the `commentsEnabled`
quick-share toggle (§3.3's gap). No public message UI, no Phase 6
conversion logic, nothing executed against Production.

## 1. Migration — `202608190001_client_share_message_owner_rpcs.sql`

One additive migration. No table changes, no new columns, no new
indexes, no new RLS policies — the existing `share_messages` RLS
(owner-only select via `auth.uid() = user_id`) and the existing
`enforce_share_message_integrity` trigger (immutability + insert
provenance) are untouched and still the enforcing layer underneath both
new RPCs. Both functions follow the exact conventions established by
`revoke_share_link`/`set_share_link_pin`/etc.
(`202608060002_client_share_access_operations.sql`): `SECURITY DEFINER`,
`language plpgsql`, `set search_path = public, pg_temp`, `v_user_id uuid
:= auth.uid()` null-checked to `UNAUTHORIZED`, owner-scoped resolution,
project-soft-delete check, `revoke all ... from public, anon,
service_role` followed by `grant execute ... to authenticated` only.

### `send_share_message_reply(p_share_link_id uuid, p_parent_message_id uuid, p_body text)`

1. Requires `auth.uid()`.
2. Resolves the link and proves `link.user_id = auth.uid()` (else
   `SHARE_LINK_NOT_FOUND`).
3. Checks the owning project is not soft-deleted (`v_project_deleted_at
   is not null` → `SHARE_LINK_NOT_FOUND`) — **`is_archived` is
   deliberately not checked here**; see §10's finding below.
4. Resolves the parent message and proves it exists
   (`SHARE_MESSAGE_PARENT_NOT_FOUND`) and belongs to the same link
   (`SHARE_MESSAGE_PARENT_LINK_MISMATCH`).
5. Validates the body: `btrim` length must be 1–4000
   (`SHARE_MESSAGE_BODY_EMPTY` / `SHARE_MESSAGE_BODY_TOO_LONG`), matching
   the table's own `body` check constraint exactly.
6. Inserts exactly one row: `user_id = auth.uid()`, `share_link_id` /
   `project_id` = the verified link's own values (never caller-supplied),
   `author_type = 'owner'`, `parent_id` = the verified parent,
   `is_visible_to_client = true`, `body` = the validated value,
   `status = 'reviewed'`, `reviewed_at = now()` (the owner's own reply
   does not need further owner review; the unread-counter definition in
   §8 only ever counts `author_type = 'client'` rows, so this choice has
   no effect on it either way).
7. Never touches the parent row, project/task/client data,
   `project_updates`, `project_timeline_events`, or
   `share_message_conversions`. Never sends email. Never sets
   `status = 'converted'`.

### `set_share_message_status(p_message_id uuid, p_status text)`

1. Requires `auth.uid()`.
2. Validates `p_status` is one of exactly `'new' | 'reviewed' | 'resolved'
   | 'dismissed'` — `'converted'` and anything else is rejected with
   `SHARE_MESSAGE_STATUS_INVALID` before any row is touched (Phase 6's
   exclusive value can never be reached through this RPC).
3. Locks the message row `for update`, scoped to `user_id = auth.uid()`
   (`SHARE_MESSAGE_NOT_FOUND` on any cross-owner or unknown id — the
   error is identity-hiding, not `UNAUTHORIZED`, matching the same
   not-found-vs-forbidden convention used elsewhere in Client Share).
4. Checks the owning project is not soft-deleted.
5. Applies exact timestamp semantics, derived from
   `share_messages_status_timestamps_check`:
   - `new` → `reviewed_at = null`, `resolved_at = null`
   - `reviewed` → `reviewed_at = now()`, `resolved_at = null`
   - `resolved` → `reviewed_at = coalesce(existing reviewed_at, now())`,
     `resolved_at = now()`
   - `dismissed` → `reviewed_at = now()`, `resolved_at = null`
6. The `update` statement's `set` clause touches only `status`,
   `reviewed_at`, `resolved_at`. `body`, `author_type`, `share_link_id`,
   `project_id`, `parent_id`, `user_id`, `created_at` are never in the
   set list — the integrity trigger would reject any attempt to touch
   them regardless, but the RPC itself never tries.

## 2. RPC security model

Both functions were proven, by the 40 static source-assertion tests in
`202608190001_client_share_message_owner_rpcs.test.ts`, to: declare
`SECURITY DEFINER` and a safe `search_path`; require `auth.uid()` with no
`p_user_id`/`p_author_type`/`p_status`-as-`converted` bypass possible;
contain no dynamic SQL; `revoke all` from `public`/`anon`/`service_role`
and `grant execute` to `authenticated` only, with no broader
`insert`/`update` grant added anywhere in the migration; never write
`share_message_conversions`, `project_updates`, or
`project_timeline_events` in **executable** SQL (checked against
`normalizedExecutable`, i.e. with `comment on function ... is '...'`
doc-strings stripped, so the functions' own explanatory comments naming
those tables while describing their exclusion do not produce a false
pass); and correctly reject `'converted'` and unknown status values.

## 3. Owner repository layer — `lib/share/share-messages-repository.server.ts`

Mirrors `share-links-repository.server.ts`'s established shape exactly:
unconstrained generic `Client` + `as ShareMessagesSupabaseLikeClient` cast
at point of use, `{ok:true,data}|{ok:false,error:{code}}` result type,
Zod-parsed rows. Exposes exactly what later slices need and nothing more:

- `listShareLinkMessages(supabase, {shareLinkId, userId})` — owner- and
  link-scoped, chronological ascending.
- `listProjectMessages(supabase, {projectId, userId})` — owner- and
  project-scoped, chronological descending.
- `countUnreadClientMessages(supabase, {shareLinkId, userId})` —
  `author_type = 'client' and status = 'new'`, matching the existing
  partial index; a null count fails closed to `UNEXPECTED` rather than
  silently reporting zero.
- `sendShareMessageReply(supabase, {shareLinkId, parentMessageId, body})`
  — calls `send_share_message_reply`, maps RPC errors by exact
  `{code,message}`.
- `setShareMessageStatus(supabase, {messageId, status})` — calls
  `set_share_message_status`, same mapping discipline; `status` is typed
  to the 4 Phase 5 values only (`SHARE_MESSAGE_PHASE5_STATUSES`), so
  `'converted'` is not even constructible as an input at the TypeScript
  layer, though a read can still return it (the row schema accepts all 5
  values since Phase 6 may have set it).

No direct `insert`/`update` against `share_messages` exists anywhere in
this file — all writes go through the two RPCs, proven by both a regex
check and a comment-stripped source scan in the accompanying 32-test
file (`share-messages-repository.server.test.ts`).

## 4. `commentsEnabled` Quick Share UX

Added as the first checkbox inside the existing Security section of
`share-link-quick-share.tsx`, above the PIN checkbox, labeled exactly
"Allow client messages" — no second modal, no "Manage comments", no
second flag, no new database field. Behavior:

- Local `commentsEnabled` state initializes from `link?.commentsEnabled
  ?? false` and resets alongside the panel's other draft state whenever
  the panel receives a fresh authoritative read (now also keyed on
  `initialCommentsEnabled` in the reset effect's dependency list, next to
  the existing `[link?.id, link?.configurationVersion, initialHasPin]`).
- Toggling the checkbox alone changes only local draft state — nothing
  is persisted until the owner clicks "Share update", identical to every
  other quick-share draft field.
- On submit, `commentsEnabled` is always included in the `onShare(...)`
  payload sent to `useShareLink`'s `shareUpdate`.

## 5. `configuration_version` behavior — unchanged, verified

`shareUpdate` in `use-share-link.ts` now includes `commentsEnabled` in
its settings payload only when it actually differs from the
link's last-known persisted value
(`dataAtStart?.link?.commentsEnabled ?? false`), for an **existing**
link. This was a deliberate design correction made mid-implementation:
an earlier draft always included it unconditionally, reasoning that
`save_share_configuration`'s own `IS DISTINCT FROM` comparison would
make a same-value resend a safe no-op — but that would have made
`saveShareConfiguration` fire on every single "Share update" click
regardless of what changed, which directly contradicts the pre-existing
"PIN is opt-in" test's assertion that `saveShareConfiguration` must not
be called when nothing meaningful changed. The corrected version
preserves that contract exactly: `saveShareConfiguration` is called
(and `configuration_version` bumps, via existing backend behavior — no
client-side increment was added anywhere) if and only if `commentsEnabled`
is one of the fields that actually changed, identical in spirit to how
every other settings field already behaves. A brand-new (first-time)
link continues to always include the full settings object, as before,
now carrying the owner's chosen `commentsEnabled` value instead of a
hardcoded `false`.

## 6. Archived-project finding (read-only, §10 — no change made)

Traced every place `projects.is_archived` gates Client Share behavior.
It is checked in exactly three owner-mutation RPCs —
`activate_share_link` / `reenable_share_link`
(`202608060001_client_share_lifecycle_operations.sql`) and
`save_share_configuration`
(`202608060003_client_share_configuration_save.sql`,
`202608110001_client_share_publication_intent.sql`) — all three raising
`PROJECT_ARCHIVED` when the owner tries to activate, re-enable, or
reconfigure a share link whose project is archived. It is **not**
checked anywhere in the ongoing public-access path: the session-grant
integrity trigger (`enforce_share_session_grant_integrity`) and the
client-message-insert integrity trigger
(`enforce_share_message_integrity`) both gate only on
`project.deleted_at`, never `is_archived`. In other words: an
already-active share link keeps working for its client even after the
owner archives the project — only a project soft-delete revokes it.
Phase 5A's two new RPCs correctly inherit this exact same,
already-established contract by checking only `deleted_at`, consistent
with `revoke_share_link` and both integrity triggers. This is a
pre-existing Phase 3/4 design point, not a gap Phase 5A introduced, and
no change was made.

## 7. Privacy / noindex confirmation (read-only, §11 — no change made)

Reconfirmed all four layers are still intact and unmodified: page-level
`export const metadata.robots = { index:false, follow:false, noarchive:
true }` in `app/share/[publicId]/page.tsx`; `proxy.ts`'s
`SHARE_PUBLIC_PAGE_HEADERS` applying `Cache-Control: private, no-store`,
`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow,
noarchive`, and a minimal CSP to every `/share` and `/share/*` request;
`app/robots.ts`'s `/share/` disallow entry; and
`shouldSkipAnalyticsPath` (`lib/analytics/analytics-paths.ts`), which
excludes `/share` and every `/share/*` path from both
`ConsentAwareVercelAnalytics` and `CookieConsentBanner` — so the public
Client Share surface still loads no analytics script and shows no cookie
banner. No regression found; no change made.

## 8. Phase 6 boundary confirmation

The migration, the migration test, the repository, and the repository
test each contain a dedicated check (regex/AST-level, run against
comment-stripped executable source, not raw source) proving no reference
to `share_message_conversions`, no write to `project_updates` or
`project_timeline_events`, no `tasks`/`subtasks` mutation, and no
`status = 'converted'` reachable through either RPC. The two quick-share
UI files touched this slice (`share-link-quick-share.tsx`,
`use-share-link.ts`) make no direct database calls at all — they only
ever call the pre-existing `save_share_configuration` path — so they are
structurally incapable of crossing the Phase 6 boundary; no additional
test was needed for them beyond the existing full suite passing.

## 9. Files changed

New:
- `supabase/migrations/202608190001_client_share_message_owner_rpcs.sql`
- `supabase/migrations/202608190001_client_share_message_owner_rpcs.test.ts`
- `lib/share/share-messages-repository.server.ts`
- `lib/share/share-messages-repository.server.test.ts`

Modified:
- `app/components/dashboard/tasks/share-link/share-link-quick-share.tsx`
- `app/components/dashboard/tasks/share-link/share-link-quick-share.test.tsx`
- `app/components/dashboard/tasks/share-link/use-share-link.ts`
- `app/components/dashboard/tasks/share-link/use-share-link.test.ts`

## 10. Verification — exact counts, all actually executed this turn

- Migration test: 40/40 passing.
- Repository test: 32/32 passing.
- `use-share-link.test.ts` and `share-link-quick-share.test.tsx`: all
  passing (17 and 3 call sites respectively updated for the new required
  `commentsEnabled` field, no assertion content otherwise changed).
- Full regression sweep — `lib/share`, `app/api/share`,
  `app/components/dashboard/tasks/share-link`, `app/share`, plus the new
  migration test, run together: **46 test files, 1717 tests, all
  passing**.
- `tsc --noEmit`: clean.
- `eslint` on every file touched this turn: 0 errors. 4 pre-existing-style
  warnings (`no-unused-vars` on intentionally-unused fake-client mock
  parameters in the repository test, matching this repo's global
  `warn`-level, no-`argsIgnorePattern` convention); one genuinely dead
  type (`PostgrestLikeResult`, superseded mid-implementation by
  `ShareMessagesQueryResolution`) was found and removed from
  `share-messages-repository.server.ts`, re-verified clean after removal.
- `git diff --check`: no whitespace errors (only expected LF→CRLF
  line-ending notices on touched files).
- No `npm run build` was run this turn, per instruction — no compile
  issue arose that required it.

Nothing was staged, committed, or pushed. No migration was executed
against any database, disposable or Production.

---

# PHASE 5A STATUS: IMPLEMENTED

# PHASE 5B READINESS: READY
