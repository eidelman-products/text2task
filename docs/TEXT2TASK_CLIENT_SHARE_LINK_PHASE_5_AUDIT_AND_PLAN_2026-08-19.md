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

---

# PHASE 5B — PUBLIC CLIENT MESSAGE SUBMISSION

Checkpoint at the start of this slice: `3e07fe4 Add Client Share Phase
5A communication foundation`. Scope, exactly as scoped: `POST
/api/share/[publicId]/messages`, its own `comment_submission` rate
limit, and nothing else -- no public history read, no public/owner UI,
no Phase 6 conversion. The Phase 5A migration still has not been
executed against any environment; this slice does not depend on it,
since a public client insert uses the Phase 1 `service_role` grant, not
the Phase 5A owner RPCs.

## 1. Endpoint contract

`POST /api/share/[publicId]/messages`

Request: `{ body: string, authorDisplayName?: string }`, parsed by a
`.strict()` Zod schema (`shareMessageSubmissionRequestSchema` in
`lib/share/share-public-message.server.ts`) -- any unrecognized extra
key (`id`, `projectId`, `shareLinkId`, `authorType`, `status`,
`parentId`, anything) causes the whole request to be rejected with
`INVALID_REQUEST` before any of its fields are read individually; there
is no path through which a caller-supplied identity field could reach
the insert.

Success response: `{ ok: true }`, HTTP 200. No row, id, or internal
field is ever returned.

This endpoint creates only top-level client messages (`parent_id` is
always `null`, hardcoded server-side) -- public reply-to-owner-message
behavior is out of scope for this slice.

## 2. Authorization chain

Implemented in `app/api/share/[publicId]/messages/route.ts`, in this
exact order:

1. `assertClientShareEnabled()`
2. `validateSharePublicRequestOrigin` -- requires the request's `Origin`
   header to exactly match the request URL's own origin, and, when
   present, `Sec-Fetch-Site: same-origin`. This is the same POST-shaped
   origin validator `POST /api/share/session` already established
   (deliberately NOT the GET-routes' `isRejectableCrossSiteRequest`,
   whose tolerance for a direct top-level navigation makes sense for a
   browser-typed GET URL but not for a same-origin `fetch()`-only POST).
3. `isValidSharePublicId(publicId)`
4. Browser-session cookie presence + shape validation, then
   `hashShareBrowserSessionSecret`
5. `checkShareRateLimit({ action: "comment_submission", scope:
   "browser_session", identityDigest: sessionDigest })`
6. `verifyShareProjectionAuthorization({ cookieValue, publicId })` --
   the exact same function `GET /projection` and the file-delivery route
   already share; re-verifies session live+unrevoked, link
   active+unexpired+project-not-deleted, grant
   same-session+same-link+unexpired+unrevoked+exact-configuration-
   version-match+PIN-requirement-satisfied. Not modified in any way by
   this slice.
7. `resolveShareLinkCommentsEnabled(shareLinkId, userId)` -- a new,
   narrow, additive read added to `lib/share/share-session-grant.server.ts`
   (deliberately NOT folded into `verifyShareProjectionAuthorization`'s
   own return shape, which is shared by two already-shipped routes with
   their own exact-shape tests). Fails closed (`false`) on any error or
   not-found.
8. Body read (`readSharePublicRequestJson`, with a message-specific
   20,000-byte limit -- see §5) + schema parse + semantic validation
   (`validateShareMessageSubmission`)
9. Trusted server-side insert (`insertPublicShareMessage`)
10. Generic `{ ok: true }`

Every authorization/link/session failure (steps 1-2-3-4-6-7) returns the
exact same `401 { code: "UNAVAILABLE" }` body -- indistinguishable,
matching the projection route's own no-enumeration-oracle posture
exactly. `commentsEnabled=false` is included in that same generic
bucket, not given its own distinguishable error.

## 3. Request-security behavior

POST-only. `validateSharePublicRequestOrigin` requires an `Origin`
header (unlike the GET routes' tolerance for a missing `Sec-Fetch-Site`)
-- this matches the session-exchange route's own existing behavior
exactly, not a new architecture. No CSRF token was introduced; the
existing Origin+Sec-Fetch-Site check plus the HttpOnly, `SameSite=Lax`
session cookie remain this feature's whole defense here, unchanged from
Phase 3.

## 4. Validation / normalization rules

Implemented in `lib/share/share-public-message.server.ts`
(`validateShareMessageSubmission`), covered by 38 unit tests:

- **Body**: line endings normalized (`\r\n`/`\r` → `\n`); every C0
  control character and DEL stripped EXCEPT tab and newline; emptiness
  judged on the trimmed value (`SHARE_MESSAGE_BODY_EMPTY`); max length
  judged on the untrimmed, sanitized value against **4000 Unicode
  codepoints** (`SHARE_MESSAGE_BODY_TOO_LONG`) -- counted with
  `[...value].length`, not `.length`, so it matches Postgres's own
  `char_length()` exactly rather than JS's UTF-16-code-unit count (which
  would otherwise reject legitimate astral-plane content, e.g. most
  emoji, roughly twice as early as it should). The sanitized value is
  stored exactly as submitted otherwise -- never trimmed, never
  truncated -- matching `send_share_message_reply`'s own "store as
  submitted" convention. Verified for Hebrew, Arabic, emoji, multiline
  text, and HTML-like content (stored verbatim as plain text, never
  interpreted).
- **authorDisplayName**: optional; trimmed (unlike body -- a display
  name is a convenience field, not preserved-verbatim content); empty
  or whitespace-only after trimming normalizes to `null`, never
  rejected; max 80 codepoints (`SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG`);
  never validated as an email/phone/identity of any kind, matching the
  instruction that it is display convenience only.

## 5. Rate-limit policy

`comment_submission` added to `ShareRateLimitAction` in
`lib/share/share-rate-limit.server.ts`: `{ limit: 10, windowSeconds:
300 }`, scoped by `browser_session` (matching `projection_read`'s own
scope choice, since by the time this bucket is checked the caller
already has a valid session). Uses the exact same atomic
`increment_share_rate_limit_bucket` RPC every other Client Share action
already uses -- `comment_submission` was already present in that RPC's
own `p_action` CHECK constraint (202608130001), unused until now, so
**no migration was needed** for this. Independent bucket from
`projection_read` -- verified by a dedicated test.

## 6. Insert trust boundary

`insertPublicShareMessage` in `lib/share/share-public-message.server.ts`
performs the one and only insert a public client may ever cause,
through `supabaseAdmin`, writing exactly the 8 columns
`service_role` is grant-scoped to
(202608030005): `user_id, share_link_id, project_id, author_type,
author_display_name, body, parent_id, is_visible_to_client`.
`author_type='client'`, `parent_id=null`, and `is_visible_to_client=true`
are hardcoded, never derived from any input. `status`, `reviewed_at`,
`resolved_at`, `id`, `created_at`, `updated_at` are never in the
payload at all -- `service_role` has no INSERT grant on those columns
regardless, so a client-authored row always takes their table DEFAULTs
(`status` defaults to `'new'`). `user_id`/`share_link_id`/`project_id`
come only from the already-verified `authorization` object returned by
`verifyShareProjectionAuthorization`, never from the request body (which
the `.strict()` schema would reject outright if such fields were even
present). The existing `enforce_share_message_integrity` trigger
(202608030005) remains the unconditional second line of defense under
this insert, re-checking link active/comments_enabled/unexpired/project-
alive independently, exactly as it already did before this slice.

## 7. Privacy / error behavior

- Authorization/link/session/commentsEnabled failures: one generic,
  indistinguishable `401 { code: "UNAVAILABLE" }`.
- Validation failures (empty body, body too long, name too long, schema
  mismatch): specific, user-correctable `400` codes
  (`SHARE_MESSAGE_BODY_EMPTY`, `SHARE_MESSAGE_BODY_TOO_LONG`,
  `SHARE_MESSAGE_AUTHOR_NAME_TOO_LONG`, `INVALID_REQUEST`) -- never
  leaking internal ids, SQL, or constraint names.
- Rate limit: existing `429` + `Retry-After` contract, unchanged.
- Unexpected/DB error (including an insert rejected by the integrity
  trigger): generic `500 { code: "INTERNAL_ERROR" }` externally; a fixed,
  safe stage tag logged server-side only (`logShareRouteError`, matching
  every sibling route), never the underlying error's message.
- Every response (success and every error branch) carries `Cache-
  Control: private, no-store`, `Pragma: no-cache`, `Referrer-Policy:
  no-referrer`, `X-Content-Type-Options: nosniff` -- verified by
  dedicated tests. `/share/**`'s existing analytics/cookie-consent
  exclusion (§7 of the Phase 5A section above) is unaffected, since
  this is an API route, not a page.

## 8. Phase 6 boundary confirmation

`lib/share/share-public-message.server.ts` and its test file each carry
a dedicated, comment-stripped-source hard test proving: no reference to
`share_message_conversions`, `project_updates`, or
`project_timeline_events`; no `.from("tasks")`/`.from("subtasks")` call;
no occurrence of the string `"converted"` anywhere in executable code;
and that the module's only `.from(...)` target, anywhere, is
`share_messages`. The route file itself performs no direct database
call of its own (all reads/writes go through the already-existing
`verifyShareProjectionAuthorization`/`resolveShareLinkCommentsEnabled`/
`insertPublicShareMessage` functions), so it has no additional surface
to boundary-test.

## 9. Files changed

New:
- `app/api/share/[publicId]/messages/route.ts`
- `app/api/share/[publicId]/messages/route.test.ts`
- `lib/share/share-public-message.server.ts`
- `lib/share/share-public-message.server.test.ts`

Modified:
- `lib/share/share-rate-limit.server.ts` (added `comment_submission`)
- `lib/share/share-public-request.server.ts` (added an optional
  `maxBytes` parameter to `readSharePublicRequestJson` and its internal
  helpers, defaulting to the existing `SHARE_PUBLIC_REQUEST_MAX_BYTES`
  so the session-exchange route's behavior is unchanged; added
  `SHARE_PUBLIC_MESSAGE_REQUEST_MAX_BYTES = 20_000`)
- `lib/share/share-public-request.server.test.ts` (added coverage for
  the new `maxBytes` parameter, both via `Content-Length` and via actual
  streamed size)
- `lib/share/share-session-grant.server.ts` (added
  `resolveShareLinkCommentsEnabled`, purely additive)
- `lib/share/share-session-grant.server.test.ts` (added coverage for
  the new function)

## 10. A defect found and fixed during implementation

While adding the `maxBytes` parameter to `readSharePublicRequestJson`,
the parameter was threaded into `enforceContentLengthLimit` correctly
but the *streaming* size check inside `readBoundedRequestBodyText` was
left hardcoded to the module's old fixed
`SHARE_PUBLIC_REQUEST_MAX_BYTES` constant. Left uncaught, this would
have silently capped every client message at ~4096 bytes regardless of
the intended 20,000-byte limit -- rejecting any body over roughly 1000
non-ASCII characters as "too large" even though it was well within the
real limit. Caught by inspection before any test was written against
it, fixed by using the function's own `maxBytes` parameter, and now
covered by two dedicated regression tests in
`share-public-request.server.test.ts` (one via `Content-Length`, one via
actual streamed byte count) that would have failed against the
unfixed code.

## 11. Exact tests / counts (all actually executed this turn)

- `lib/share/share-public-message.server.test.ts`: **38/38** (new)
- `app/api/share/[publicId]/messages/route.test.ts`: **40/40** (new)
- `lib/share/share-public-request.server.test.ts`: **19/19** (15
  pre-existing + 4 new)
- `lib/share/share-session-grant.server.test.ts`: **66/66** (62
  pre-existing + 4 new)
- Full regression sweep -- `lib/share`, `app/api/share`, every
  Client-Share dashboard component, `app/share`, plus the Phase 5A
  migration test, run together: **48 test files, 1802 tests, all
  passing**.

## 12. TypeScript / eslint / diff results

- `tsc --noEmit`: clean.
- `eslint` on every file touched this turn: **0 errors, 0 warnings**.
- `git diff --check`: clean (only expected LF→CRLF line-ending notices).
- No `npm run build` was run this turn -- no compile issue arose that
  required it.

Nothing was staged, committed, or pushed this turn. No migration was
executed against any database, disposable or Production. No Supabase
project, ENV variable, or deployment was touched.

---

# PHASE 5B STATUS: IMPLEMENTED

# PHASE 5C READINESS: READY

---

# PHASE 5C — MESSAGE HISTORY + OWNER COMMUNICATION APIs

Checkpoint at the start of this slice: `5ca667d Add Client Share Phase
5B public message submission`. Scope: the API/repository/contracts
layer for two-way communication -- public history read, owner history
read, owner reply, owner status change. No public/owner UI, no Phase 6
conversion. The Phase 5A migration still has not been executed against
any environment; owner reply/status routes depend on it existing at
runtime but every test in this slice uses mocks, so nothing here
required executing it.

## 1. Public GET contract

`GET /api/share/[publicId]/messages`, added alongside the existing POST
handler in the same route file
(`app/api/share/[publicId]/messages/route.ts`). Reuses the exact same
authorization architecture as `GET /projection` -- no new model was
created:

1. `assertClientShareEnabled()`
2. `isRejectableCrossSiteRequest` (the GET-appropriate Sec-Fetch-Site
   check the projection/file routes already use -- deliberately NOT
   POST's `validateSharePublicRequestOrigin`, since a GET has no body
   and tolerates a missing `Sec-Fetch-Site`)
3. `isValidSharePublicId`
4. Browser-session cookie validation
5. `checkShareRateLimit({ action: "projection_read", scope:
   "browser_session" })` -- reuses the projection route's own bucket; a
   history read is a read, not a write, so it does not consume the
   `comment_submission` bucket
6. `verifyShareProjectionAuthorization` (unmodified, shared with two
   other routes)
7. `resolveShareLinkCommentsEnabled` (the same Phase 5B check, reused)
8. `listPublicShareMessages` (new, `lib/share/share-public-message.server.ts`)
9. Allowlisted projection, `{ ok: true, data: { messages: [...] } }`
10. No-store response

## 2. Public projection / privacy model

Each message: `{ authorType, authorDisplayName, body, createdAt }`
only. `listPublicShareMessages` selects exactly those 4 columns at the
query level (never `select("*")`) and filters `is_visible_to_client =
true` in the query itself, ordered `created_at asc`. No `id`,
`parent_id`, `status`, `reviewed_at`, `resolved_at`, or
`is_visible_to_client` is ever read, let alone returned -- there is no
raw-row passthrough to later widen. Scoped by all three of
`shareLinkId`/`projectId`/`userId` from the route's own already-verified
authorization object, never anything client-supplied. `commentsEnabled
= false` denies the read with the same generic `401 UNAVAILABLE` every
other auth failure uses -- the owner's own history is untouched by this
(§8 below), only the public reader's ability to see it is gated.

## 3. Owner GET contract

`GET /api/share-links/[id]/messages`
(`app/api/share-links/[id]/messages/route.ts`), mirroring the
`preview`/`revoke` routes' exact skeleton: `assertClientShareEnabled` →
uuid param validation → `createClient()` (RLS-bound) →
`auth.getUser()` → `getOwnerShareLinkMessages(supabase, {shareLinkId,
userId})` (new, `lib/share/share-messages-repository.server.ts`) →
`{ ok: true, data: { messages: [...], unreadCount } }`.

`getOwnerShareLinkMessages` resolves link ownership FIRST (a direct,
state-unfiltered `project_share_links` read scoped by `id` + `user_id`)
before calling the pre-existing `listShareLinkMessages`/
`countUnreadClientMessages` -- without that pre-check, a cross-owner or
nonexistent link id would silently resolve to an empty, `200`-shaped
history rather than a `404 SHARE_LINK_NOT_FOUND`, which is the wrong
signal for an owner-facing route. The ownership check has NO state
filter at all, so revoked/disabled/expired links remain fully
owner-readable (§8).

Owner messages include the full `ShareMessage` shape (`id`, `authorType`,
`authorDisplayName`, `body`, `parentId`, `isVisibleToClient`, `status`,
`reviewedAt`, `resolvedAt`, `createdAt`, `updatedAt`) -- internal ids and
workflow state are fine here; only the public surface (§2) is
allowlisted down.

## 4. Owner reply behavior

`POST /api/share-links/[id]/messages/reply`
(`app/api/share-links/[id]/messages/reply/route.ts`). Input:
`{ parentMessageId, body }`. Body is validated with
`validateShareMessageBody` -- refactored out of
`lib/share/share-public-message.server.ts` (previously a private
`validateBody` helper, now exported) specifically so this route reuses
the exact same normalization the public submission path already
applies (line-ending/control-character handling,
1-4000-codepoint `share_messages_body_check` matching), rather than a
second, potentially-diverging validator. Verified for Hebrew, Arabic,
and emoji through to the repository call.

The insert itself happens entirely inside `send_share_message_reply`
(Phase 5A) via the existing `sendShareMessageReply` repository function
-- this route never touches `share_messages` directly. The RPC already
takes `p_share_link_id` and independently re-verifies the parent
message belongs to that SAME link
(`SHARE_MESSAGE_PARENT_LINK_MISMATCH`), so no separate ownership
pre-check was needed here (unlike the status route -- see §5).

**Owner-reply + unread audit (§11 of the task, confirmed by test)**:
`send_share_message_reply` inserts the reply with `status='reviewed'`
on the NEW REPLY ROW ITSELF, not the parent client message -- the RPC
never issues an `update` at all (only `insert`), so the parent's own
`status`/`reviewed_at`/`resolved_at` are untouched by a reply. The route
passes only `{shareLinkId, parentMessageId, body}` to
`sendShareMessageReply` -- there is no parameter through which it could
even attempt to touch the parent's workflow state, and the route's own
source contains no reference to `setShareMessageStatus` at all
(confirmed by a dedicated test). Reviewing/resolving/dismissing the
parent remains a fully separate, explicit owner action via the status
route.

## 5. Owner status behavior

`PATCH /api/share-links/[id]/messages/[messageId]`
(`app/api/share-links/[id]/messages/[messageId]/route.ts`). Input:
`{ status }`, validated by `setShareMessageStatusRequestSchema`
(`lib/share/share-contracts.ts`) -- a `.strict()` Zod enum of exactly
the 4 Phase 5 values. `'converted'` and any unknown value fail Zod
parsing before any repository/RPC call, returning `400
SHARE_MESSAGE_STATUS_INVALID`.

`set_share_message_status` itself scopes only by `auth.uid()` and the
message id -- it takes no link-id parameter at all. Without an
additional check, a same-owner PATCH to
`/api/share-links/LINK_A/messages/[a messageId actually on LINK_B]`
would silently succeed, making the route's own `[id]` path segment
purely decorative. To close that gap, a new repository function,
`verifyOwnedShareMessageBelongsToLink` (`share-messages-repository.server.ts`),
runs FIRST -- a direct read scoped by `id` (message) + `share_link_id` +
`user_id` together -- and the route only calls `setShareMessageStatus`
after that succeeds. Covered by a dedicated cross-link test.

The RPC remains the sole source of truth for `reviewed_at`/
`resolved_at` -- the route returns exactly what
`set_share_message_status` returned, never recomputing a timestamp
itself.

## 6. Unread behavior

Unchanged definition (`author_type='client' AND status='new'`), served
by the pre-existing `countUnreadClientMessages`
(`share_messages_unread_client_idx`), now surfaced through
`getOwnerShareLinkMessages`'s combined response as `unreadCount`. No new
index. No dashboard-level badge/UI added this slice.

## 7. Lifecycle behavior

Public GET re-runs the FULL authorization chain (identical to
`verifyShareProjectionAuthorization`'s own re-verification) on every
call -- a link that becomes disabled/revoked/expired, a
`configuration_version` bump, or an expired grant all deny the NEXT
read the same way they already deny the projection route, with no
caching of a prior "authorized" result. Re-authorizing (a fresh
session/grant/PIN verification) restores access to the same stored
history, since nothing about the read path depends on session/grant
identity beyond the moment of the read itself.

Owner GET has no such gate at all -- it is scoped only by
ownership, never by the link's own state, so history is readable
regardless of disable/revoke/expiry/secret-rotation/browser-session-loss/
configuration_version changes on the owner side. Project soft-deletion
remains governed by the table's own existing cascade/RLS behavior,
unchanged by this slice.

## 8. Phase 6 boundary confirmation

- `share-messages-repository.server.ts`'s existing Phase-6-boundary test
  block (comment-stripped source scan) automatically covers the two new
  functions added this slice (`getOwnerShareLinkMessages`,
  `verifyOwnedShareMessageBelongsToLink`) since it scans the whole file.
- `share-public-message.server.ts`'s existing equivalent test block
  likewise automatically covers the new `listPublicShareMessages`.
- A new dedicated static test file,
  `app/api/share-links/[id]/messages/phase6-boundary.test.ts` (12
  tests), scans all three owner route files for
  `share_message_conversions`/`project_updates`/
  `project_timeline_events`/`'converted'` in executable code, task/
  subtask/project-table mutation calls, and email/AI-analysis imports --
  all clean.
- The public GET/POST route continues to rely on the repository-level
  boundary tests (it performs no direct DB call of its own).

## 9. Exact files changed

New:
- `app/api/share-links/[id]/messages/route.ts` + `.test.ts`
- `app/api/share-links/[id]/messages/reply/route.ts` + `.test.ts`
- `app/api/share-links/[id]/messages/[messageId]/route.ts` + `.test.ts`
- `app/api/share-links/[id]/messages/phase6-boundary.test.ts`

Modified:
- `app/api/share/[publicId]/messages/route.ts` (added `GET`) + `.test.ts`
- `lib/share/share-contracts.ts` (extended `shareLinkApiErrorCodeSchema`
  with 4 message-specific codes; added `shareMessageIdParamSchema`,
  `sendShareMessageReplyRequestSchema`,
  `setShareMessageStatusRequestSchema`)
- `lib/share/share-messages-repository.server.ts` (added
  `getOwnerShareLinkMessages`, `verifyOwnedShareMessageBelongsToLink`;
  extended the internal query-builder type with `maybeSingle`) + `.test.ts`
- `lib/share/share-public-message.server.ts` (exported the previously-private
  body validator as `validateShareMessageBody`; added
  `listPublicShareMessages`)

## 10. Exact tests / counts (all actually executed this turn)

- `app/api/share/[publicId]/messages/route.test.ts`: **58/58** (40
  pre-existing POST + 18 new GET)
- `lib/share/share-messages-repository.server.test.ts`: **41/41** (32
  pre-existing + 9 new)
- `app/api/share-links/[id]/messages/route.test.ts`: **12/12** (new)
- `app/api/share-links/[id]/messages/reply/route.test.ts`: **22/22** (new)
- `app/api/share-links/[id]/messages/[messageId]/route.test.ts`:
  **23/23** (new)
- `app/api/share-links/[id]/messages/phase6-boundary.test.ts`:
  **12/12** (new)
- Full regression sweep -- `lib/share`, `app/api/share`,
  `app/api/share-links`, every Client-Share dashboard component,
  `app/share`, plus the Phase 5A migration test, run together: **52
  test files, 1898 tests, all passing**.

## 11. TypeScript / eslint / diff results

- `tsc --noEmit`: clean.
- `eslint` on every file touched this turn: **0 errors**; 3 pre-existing
  `no-unused-vars` warnings on intentionally-unused fake-client mock
  parameters (same convention already accepted in Phase 5A).
- `git diff --check`: clean (only expected LF→CRLF line-ending notices).
- No `npm run build` was run this turn -- no compile issue required it.

Nothing was staged, committed, or pushed this turn. No migration was
executed against any database, disposable or Production. No Supabase
project, ENV variable, or deployment was touched.

---

# PHASE 5C STATUS: IMPLEMENTED

# PHASE 5D READINESS: READY

---

# PHASE 5D — PUBLIC MESSAGE UI + OWNER CLIENT COMMUNICATION HISTORY

Checkpoint at the start of this slice: `b760d6f Add Client Share Phase
5C communication APIs`. Scope: the complete V1 user-facing UI on top of
the already-implemented 5A-5C API layer -- public send/view, owner
history/reply/status. No realtime, no polling, no Phase 6. The Phase 5A
migration still has not been executed against any environment.

## 1. Public Client Messages UI

New: `public-messages-section.tsx` + `use-public-share-messages.ts`
(`app/components/dashboard/tasks/share-link/`). Rendered as a sibling of
`ClientProjectView` inside `ShareView`'s own "ready" state
(`app/share/[publicId]/share-view.client.tsx`) -- deliberately NOT
added inside `ClientProjectView` itself, which is documented as purely
presentational/data-free and reused unchanged by the owner's own
authenticated Preview modal (`share-link-panel.tsx`'s `PreviewView`,
which renders `ClientProjectView` with no `publicId` at all). Keeping
the fetch-owning component out of `ClientProjectView` means the owner
Preview never gains a live public-message fetch of its own.

Renders only when `projection.commentsEnabled === true`; the underlying
hook performs zero fetches when it is false, and the section returns
`null` outright (verified: "no fetch at all when disabled").

## 2. Public state/data flow

`usePublicShareMessages(publicId, enabled)` follows
`share-view.client.tsx`'s own established fetch conventions exactly
(`credentials: "same-origin"`, `cache: "no-store"`, a `safeJson` that
never throws): `GET /api/share/[publicId]/messages` once when `enabled`
becomes true, `POST` on submit, one more `GET` after a successful `POST`.
No polling. A monotonic request-id guards against a slow, stale GET
overwriting a fresher one (tested explicitly). Component-level state
(`name`, `body`) lives in `PublicMessagesSection` itself, not the hook --
name is preserved across a send (session-only, not persisted to
storage), body is cleared only on send success.

## 3. Public validation / error behavior

Client-side validation mirrors the server contract exactly: trimmed
non-empty check, `[...value].length` codepoint counting (not
`.length`) for the 4000/80 limits, matching Postgres `char_length`
semantics the same way the Phase 5B/5C server validators already do.
Errors are the exact copy specified: "Enter a message.", "Message must
be 4,000 characters or fewer.", "Name must be 80 characters or fewer."
Server error codes are mapped to safe, generic copy (rate limit →
"Too many messages sent..."; anything else → a single generic fallback)
-- never a raw server error string. A failed history GET renders its
own inline error and leaves the send form fully usable; it cannot throw
past the component boundary (verified: rendering continues after a
rejected fetch).

## 4. Owner Client Communication UI

Entry point: a "Client messages [unread badge]" button added directly
inside `ShareLinkPanel` (`share-link-panel.tsx`), visible whenever a
link exists, in both the "quick" and "result" panel views (not gated to
only the post-share result screen, since a returning owner's panel
always opens back at "quick" -- see §13 below).

New: `client-communication-history-modal.tsx`. **Architecture
decision**: this is NOT a second, independent `ResponsiveDialog`. It is
rendered as swapped-in CONTENT inside `ShareLinkPanel`'s own
already-open `ResponsiveDialog`, exactly the same pattern
`PreviewView` already uses for "Client preview" (`state.previewOpen`).
Two independent top-level `ResponsiveDialog`s would each run their own
Escape-key/focus-trap handling with no coordination between them (a
`ResponsiveDialog`'s nested-overlay context is designed for a much
smaller popover-from-inside-a-dialog case, e.g. `DatePickerPopover`, not
a second full-size dialog) -- swapping content inside the ONE already-open
dialog sidesteps that entirely, at the cost of the view being a "Back"
affordance rather than its own close button. This mirrors the UX shape
of `project-update-history-modal.tsx` (header + toolbar + chronological
list, loading/empty/error states) but shares none of its data, types,
or styles -- confirmed by a dedicated test that no import statement in
the new file names any Project Timeline/Project Update module, and no
executable code references `project_timeline_events`.

Opening the view performs exactly one `GET
/api/share-links/[id]/messages` and mutates nothing -- verified
explicitly (§9's "opening does not mark reviewed" requirement).

## 5. Owner unread strategy (§12 decision, documented as required)

**Chosen: Option A**, fetched via the SAME endpoint the full modal uses
(no new endpoint was added). `useOwnerShareMessages(shareLinkId,
enabled)` is instantiated **twice, independently**: once inside
`ShareLinkPanel` itself (`enabled = state.isOpen && linkId !== null`,
for the badge only) and once inside
`ClientCommunicationHistoryModal` (`enabled = true` while that view is
mounted, for the full list). Each instance performs its own isolated
fetch; there is no shared cache or lifted state between them. This
means opening the modal shortly after the panel opens issues a second,
independent `GET` -- an accepted, small cost in exchange for keeping
both call sites simple, decoupled, and independently testable (Phase
5D's own "failure isolation" principle: a badge-fetch failure can never
prevent the modal from opening or fetching on its own). No polling in
either instance -- each fetches once when its own `enabled` flag
transitions to true (verified: the badge re-fetches on each panel
re-open, not merely once when the link id first appears).

## 6. Owner reply UX

Each client-authored message card offers a "Reply" button; only ONE
reply composer can be open at a time (`replyingToId` is a single piece
of state in the modal, not per-message state) -- verified with two
client messages present, confirming only one "Submit reply" control
ever renders. "Cancel" discards the draft without calling the API.
Submitting calls `sendShareMessageReply(shareLinkId, {parentMessageId,
body})` (`share-link-client.ts`, added this slice, itself calling `POST
/api/share-links/[id]/messages/reply`) with the exact clicked message's
id as `parentMessageId` -- never inferred, never defaulted. On success:
composer closes, history refetches. Reply is offered ONLY on
client-authored messages (verified: an owner-authored message in the
same list never gets its own Reply control) -- no
owner-reply-to-owner-reply UI exists.

**Confirmed (§11 of the task, verified by a dedicated test)**: replying
never calls `setShareMessageStatus`. The reply RPC's own
`status='reviewed'` (Phase 5A) applies only to the new reply row it
creates, never to the parent client message -- reviewing/resolving/
dismissing the parent remains a fully separate, explicit action.

## 7. Owner status UX

Each client message shows a compact status label (`New` / `Reviewed` /
`Resolved` / `Dismissed`, or `Converted` on a row Phase 6 has already
touched -- read-only, no action ever produces it) plus three always-visible
action buttons: "Mark reviewed", "Resolve", "Dismiss". Each calls
`setShareMessageStatus(shareLinkId, messageId, status)` → `PATCH
/api/share-links/[id]/messages/[messageId]`. No "Convert"/"Turn into
task"/"Apply update" button exists anywhere in the component (verified
by both a rendered-DOM check and a source-level regex check for the
literal word "convert" outside the read-only status label). A failed
status change shows one generic, safe error string, never the
underlying `ShareLinkClientError`'s raw code/message. A successful
change refetches history, so `unreadCount` updates from the server's
own recomputed value -- never decremented client-side.

## 8. RTL / mobile / accessibility

Every message body (public and owner) renders inside a `<p dir="auto">`
(or the compose `<textarea dir="auto">`) -- individual human-entered
text auto-detects its own direction regardless of the surrounding
page's `dir`, matching the task's own "prefer dir=auto over hardcoding"
guidance. The public section's own root carries an explicit
`dir={contentDirection}` (never omitted, matching
`ClientProjectView`'s own established convention for the same prop).
Every input has a real `<label htmlFor>` association (`Your name
(optional)`, `Message`, `Reply`). Long unbroken text/URLs cannot break
mobile layout (`overflowWrap: "anywhere"` + `wordBreak: "break-word"`
on every message-body/bubble style). Loading and error states use
`role="status"`/`role="alert"` so they are announced to assistive
tech. Verified directly for Hebrew, Arabic, and emoji rendering in both
the public section and (via the owner test file's own reply-body
pass-through) the owner reply path.

## 9. Failure isolation

`usePublicShareMessages` and `useOwnerShareMessages` are each fully
self-contained -- neither is part of `ShareView`'s own state machine nor
`useShareLink`'s central reducer. A Messages fetch/send failure can
never put the projection/tasks/resources view, or the Share panel's own
core management request, into an error state (verified: a rejected
history fetch still renders the compose form; a rejected badge fetch in
`ShareLinkPanel`'s tests never affects any other panel assertion, and
the panel's own test file was updated with a network-free `fetch` stub
specifically so this hook's own fetch attempt never becomes a source of
flakiness for unrelated panel tests).

## 10. Phase 6 boundary confirmation

Both new components' source is scanned (comment-stripped, matching the
`code`/`normalizedExecutable` distinction established in Phase 5A-5C)
for `share_message_conversions`, `project_updates`,
`project_timeline_events`, and the literal word "convert" outside the
read-only status label -- all clean. Neither component imports any
task/project/CRM mutation function, an email module, or an AI-analysis
module. No disabled "Convert" placeholder was added, per the explicit
instruction not to even stub one this slice.

## 11. A defect found and fixed during implementation

Adding `messagesOpen`'s reset logic to `ShareLinkPanel`'s existing
"fresh open always starts at quick-share" `useEffect` tripped this
repo's `react-hooks/set-state-in-effect` lint rule -- and running eslint
on the file surfaced a SECOND, pre-existing violation of the same rule
(the unrelated `setView("result")` effect, present in the file before
this turn, confirmed via `git show HEAD`). Both were fixed by converting
to the render-time state-adjustment pattern
`project-update-history-modal.tsx` already established elsewhere in
this codebase (comparing a snapshot to the latest props/state during
render, rather than in a committed effect) -- re-verified against the
full pre-existing `share-link-panel.test.tsx` suite (all 13
pre-existing assertions about the result-view transition still pass
unchanged) before adding any new tests.

## 12. Owner link selection (§13 -- documented, not changed)

Unchanged V1 behavior, preserved as-is: `ShareLinkPanel` already
operates on exactly one link (`state.data?.link`), the same one the
Quick Share/Channels views already manage -- no new link-selection UI
was introduced for Client Messages. `getOwnerShareLinkMessages`
(Phase 5C) already reads history regardless of the link's own state
(revoked/disabled/expired all remain owner-readable), so this carries
through unchanged to the new UI with no additional work needed.

## 13. commentsEnabled UI relationship (§14 -- confirmed, not changed)

Verified directly: turning the Quick Share "Allow client messages"
toggle off hides the PUBLIC section only (`PublicMessagesSection`
returns `null`, `use-public-share-messages` performs no fetch) -- it has
no effect on the owner's `ClientCommunicationHistoryModal`, which reads
via `getOwnerShareLinkMessages` (an owner-scoped read with no
`comments_enabled` gate at all, per Phase 5C's own design). Owner
history is never hidden by turning comments off.

## 14. Exact files changed

New:
- `app/components/dashboard/tasks/share-link/use-public-share-messages.ts`
- `app/components/dashboard/tasks/share-link/public-messages-section.tsx` + `.test.tsx`
- `app/components/dashboard/tasks/share-link/use-owner-share-messages.ts`
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx` + `.test.tsx`

Modified:
- `app/share/[publicId]/share-view.client.tsx` (renders
  `PublicMessagesSection` after `ClientProjectView` in the "ready"
  state) + `.test.tsx`
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx`
  (Client messages entry point + badge + messages-view swap; two
  pre-existing/newly-introduced `set-state-in-effect` lint violations
  fixed, see §11) + `.test.tsx`
- `app/components/dashboard/tasks/share-link/share-link-client.ts`
  (added `getShareLinkMessages`/`sendShareMessageReply`/
  `setShareMessageStatus` client wrappers) + `.test.ts`
- `lib/share/share-contracts.ts` (added the owner communication
  response schemas these wrappers validate against)

## 15. Exact tests / counts (all actually executed this turn)

- `public-messages-section.test.tsx`: **34/34** (new)
- `client-communication-history-modal.test.tsx`: **29/29** (new)
- `share-view.client.test.tsx`: **17/17** (15 pre-existing + 2 new)
- `share-link-panel.test.tsx`: **20/20** (13 pre-existing + 7 new)
- `share-link-client.test.ts`: **23/23** (17 pre-existing + 6 new)
- Full Client Share regression sweep (`lib/share`, `app/api/share`,
  `app/api/share-links`, every share-link dashboard component,
  `app/share`, plus the Phase 5A migration test), run together: **54
  test files, 1976 tests, all passing**.
- Analytics isolation suite (`lib/analytics`, `app/components/analytics`):
  **23/23, all passing** -- `/share/**`'s exclusion from
  `ConsentAwareVercelAnalytics`/`CookieConsentBanner` is unaffected by
  this slice's new UI.

## 16. TypeScript / eslint / diff / build

- `tsc --noEmit`: clean.
- `eslint` on every file touched this turn (13 files): **0 errors, 0
  warnings**.
- `git diff --check`: clean (only expected LF→CRLF line-ending notices).
- **`npm run build`**: succeeded. Compiled successfully; all new routes
  registered correctly (`/api/share-links/[id]/messages`,
  `/api/share-links/[id]/messages/[messageId]`,
  `/api/share-links/[id]/messages/reply`,
  `/api/share/[publicId]/messages`); no new warnings.

Nothing was staged, committed, or pushed this turn. No migration was
executed against any database, disposable or Production. No Supabase
project, ENV variable, or deployment was touched.

## 17. Next manual step — Phase 5D runtime/browser acceptance (PLAN ONLY, not executed this turn)

1. Apply ONLY the Phase 5A migration
   (`202608190001_client_share_message_owner_rpcs.sql`) to the existing
   disposable Supabase project -- no other migration is pending.
2. Deploy the current branch to a disposable Vercel Preview.
3. On a real project's share link (disposable, non-Production): turn on
   "Allow client messages" via Quick Share, share it.
4. Open the public link in an incognito/second browser context; confirm
   the Messages section renders and is empty.
5. Client sends a message (with and without a name); confirm it appears
   after send, confirm the DB row look correct via the disposable
   project's own SQL console (never Production).
6. Owner opens "Client messages" from the Share panel; confirm the
   message appears, confirm the unread badge count, confirm opening did
   NOT mark it reviewed.
7. Owner clicks Reply on the client message, sends a reply; confirm the
   composer closes and the reply appears in the owner list.
8. Client refreshes the public page; confirm the owner's reply now
   appears in the public history, in order.
9. Owner explicitly clicks Mark reviewed / Resolve / Dismiss in turn on
   a client message; confirm each status transition and confirm the
   unread badge updates correctly after "Mark reviewed" (client message
   leaves the unread definition).
10. Owner turns "Allow client messages" back OFF; confirm the public
    Messages section disappears (or denies) on the client's next
    refresh, while the owner's Client Communication History still shows
    the full prior conversation.
11. Confirm no console errors, no unexpected network polling (verify in
    devtools that GET requests occur only on the specific actions listed
    above, never on an interval), and no regression in the rest of the
    public project view or the Share panel's own management flows.

No step above should be executed without the user's explicit go-ahead;
this is a plan for the next turn, not an instruction executed now.

---

# PHASE 5D IMPLEMENTATION STATUS: IMPLEMENTED

# PHASE 5D RUNTIME ACCEPTANCE READINESS: READY

---

# PHASE 5D RUNTIME DEFECT — STALE OWNER UNREAD BADGE (found in real Vercel Preview acceptance, fixed)

Found during the real-browser acceptance pass this doc's own §17 plan
called for. Repro: client sends a message → panel badge shows `Client
messages [1]` → owner opens the modal (correctly shows `1 unread`) →
owner moves the message through New → Reviewed → Resolved → Dismissed
(modal correctly updates to `0 unread`) → owner clicks Back → **panel
still shows `Client messages [1]`** until the whole Share panel is
closed and reopened.

## Root cause

Exactly the tradeoff the Phase 5D doc's own §5 ("Owner unread
strategy") already named explicitly: `ShareLinkPanel`'s badge and
`ClientCommunicationHistoryModal`'s own list are two deliberately
**independent** `useOwnerShareMessages` instances, each with its own
isolated fetch and no shared state. A status mutation made through the
modal's instance updates only that instance's state; nothing was ever
wired to tell the panel's separate badge instance that server truth had
changed. The database/API were correct the entire time — only the
already-fetched badge value in the panel's own hook instance was stale.

## Exact fix

`app/components/dashboard/tasks/share-link/share-link-panel.tsx`: the
`onClose` callback passed to `ClientCommunicationHistoryModal` (fired
by the modal's own "Back" button) now also calls
`badgeMessages.refetch()`, in addition to `setMessagesOpen(false)`.
This is the "refetch badge when transitioning from communication-history
view back to the main Share panel" option from the original Phase 5D
instructions — chosen over threading a new
`onMessagesChanged`/`onUnreadChanged` callback prop through the modal
because it requires no change to the modal's own props/API at all, is
triggered unconditionally (not gated on detecting which specific
mutation happened), and therefore also covers any future owner action
inside the modal that could affect the unread count without needing a
new callback wired for each one. The two `useOwnerShareMessages`
instances remain fully isolated, exactly as designed — this fix adds
one explicit, user-action-triggered refetch call at the exact moment
the owner leaves the modal, not a subscription, not shared state, not
polling. `refetch()` already had a monotonic request-id staleness guard
from Phase 5D's original implementation, so this call is race-safe
against the badge's own initial fetch by construction.

No change was made to `client-communication-history-modal.tsx`,
`use-owner-share-messages.ts`, or any API route — the defect and its
fix are both entirely contained to how `ShareLinkPanel` reacts to the
modal closing.

## Files changed

- `app/components/dashboard/tasks/share-link/share-link-panel.tsx` (the
  fix: one added `refetch()` call in the modal's `onClose` handler)
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx`
  (4 new regression tests)

## Tests / counts (all actually executed this turn)

- `share-link-panel.test.tsx`: **24/24** (20 pre-existing + 4 new),
  covering: the exact repro (badge 1 → modal open → explicit status
  mutation → modal shows 0 unread → Back → panel badge reflects 0
  immediately, dialog never unmounted/remounted); a **failed** status
  mutation leaves the panel badge showing the correct still-unread
  server truth (1) after Back, never silently cleared; a reply-only
  interaction (no status change) leaves the badge unchanged after Back;
  and a fixed, non-growing GET count across the whole scenario (4 total:
  badge-on-mount, modal-on-open, modal-refetch-after-mutation,
  badge-refetch-on-Back), re-checked after an extra tick to prove
  nothing keeps firing on its own -- no polling was introduced.
- `client-communication-history-modal.test.tsx`: **29/29** (unchanged,
  re-run to confirm the modal itself was untouched by this fix).
- `public-messages-section.test.tsx` + `share-view.client.test.tsx`:
  **34/34 + 17/17** (unchanged, re-run as part of the full Phase 5D UI
  sweep).
- Full Client Share regression sweep (`lib/share`, `app/api/share`,
  `app/api/share-links`, every share-link dashboard component,
  `app/share`, plus the Phase 5A migration test), run together: **54
  test files, 1980 tests, all passing** (1976 + the 4 new regression
  tests).

## TypeScript / eslint / diff

- `tsc --noEmit`: clean.
- `eslint` on both touched files: **0 errors, 0 warnings** (one
  transient `no-unused-vars` warning from an unused counter variable in
  a first draft of the new test was found and removed before this
  final run).
- `git diff --check`: clean (only expected LF→CRLF line-ending
  notices).

Nothing was staged, committed, or pushed this turn. No SQL was
executed, no deploy was performed, Production was not touched.

## Whether a new Preview deployment is required

**Yes.** This fix changes application code
(`share-link-panel.tsx`) that is already running on the Preview
deployment where the defect was observed — the currently-deployed
Preview still has the stale-badge bug. A new deployment of the current
branch is needed before this specific fix can be re-verified in the
same real-browser acceptance flow that found it. No database/migration
change is involved, so no other part of the disposable environment
needs to change.

---

# PHASE 5D RUNTIME DEFECT STATUS: FIXED, RE-VERIFIED IN PREVIEW (PASS)

Confirmed by real Preview re-verification (see Phase 5F's own §0 below):
badge 1 → status mutation → modal 0 unread → Back → panel badge
disappears immediately, no Share panel close/reopen required.

---

# PHASE 5F — LIFECYCLE / SECURITY / FINAL ACCEPTANCE

Checkpoint at the start of this slice: `f4ff8e1 Complete Client Share
Phase 5D communication UI`. This is a **verification-only** turn — no
application code was changed. Every claim below is backed by an exact
file/line citation or a passing test, not an assumption.

## 0. Phase 5D real Preview evidence carried forward

Already proven in a real disposable Vercel Preview (reported by the
user, not re-run this turn per the task's own "do not waste time
re-running proven flows" instruction): comments-enable via Quick Share,
public Messages section appears, client sends a real message, message
persists across refetch, owner unread badge shows 1, owner opens
Communication History, owner sees the message, owner replies
successfully without mutating the parent's status, client sees the
reply after refresh, public history exposes only client-safe fields,
owner moves the message New → Reviewed → Resolved → Dismissed with the
unread count correctly dropping 1 → 0, the stale-badge defect was found
and the fix (`share-link-panel.tsx`'s `onClose` handler now also calls
`badgeMessages.refetch()`) was re-verified live, comments-off removes
the public section entirely while owner history remains fully retained
and readable, and all other public project content keeps working.

## 1. Expected lifecycle contract (established BEFORE testing, from the actual Phase 3/4/5A-C implementation — not guessed)

The single load-bearing fact underneath this entire table:
`verifyShareProjectionAuthorization`
(`lib/share/share-session-grant.server.ts`) is called, **unmodified**,
by all four public routes —
`GET /api/share/[publicId]/projection`,
`GET /api/share/[publicId]/resources/[fileRef]`,
`GET /api/share/[publicId]/messages`, and
`POST /api/share/[publicId]/messages`
(confirmed by direct grep: all four import and call the same function
from the same module, zero divergence). That function re-verifies, on
every single call: session live+unrevoked, link
active+unexpired+project-not-deleted, grant
same-session+same-link+unexpired+unrevoked+exact-
`configuration_version`-match+PIN-requirement-satisfied — the exact
contract `share-session-grant.server.test.ts`'s existing 66 tests
already exhaustively prove. Phase 5 messaging therefore inherits every
lifecycle guarantee below **by construction**, not by re-implementing
or approximating it.

The one Phase-5-specific addition on top of that shared gate is
`resolveShareLinkCommentsEnabled` (an additive read, called after
authorization succeeds, by both the GET and POST messages routes) — see
§4.

| Event | A. Load project? | B. GET messages? | C. POST message? | D. Existing auth valid? | E. Re-auth required? | F. Owner keeps history? | G. Owner reply/status? |
|---|---|---|---|---|---|---|---|
| PIN off | Yes | Yes (if comments on) | Yes | Yes | No | Yes | Yes |
| PIN on, unverified | No | No | No | No | Yes (PIN) | Yes | Yes |
| PIN on, wrong PIN | No | No | No | No | Yes (retry) | Yes | Yes |
| PIN on, correct PIN | Yes | Yes | Yes | New grant issued | — | Yes | Yes |
| Link disabled | No | No | No | No (`link_not_active`) | Only if re-enabled | Yes | Yes |
| Link re-enabled | Yes | Yes | Yes | No — stale grant, needs fresh exchange | Yes | Yes | Yes |
| Link revoked | No | No | No | No, permanently (`link_revoked`) | N/A — V1 has no un-revoke | Yes | Yes |
| Link expired | No | No | No | No (`link_not_active`) | Only if owner clears/extends expiry | Yes | Yes |
| Secret rotated | Yes, with NEW secret | Yes | Yes | No — `configuration_version` bumped | Yes (new secret) | Yes | Yes |
| `configuration_version` changed (any config field) | Yes, after re-auth | Yes, after re-auth | Yes, after re-auth | No — exact-match check fails | Yes | Yes | Yes |
| Grant expired (TTL) | No | No | No | No | Yes | Yes | Yes |
| Browser session cookie missing/malformed | No | No | No | No | Yes | Yes | Yes |
| Archived project, link still active | Yes (unaffected) | Yes | Yes | Yes | No | Yes | Owner mutation RPCs blocked (`PROJECT_ARCHIVED`) — unrelated to messaging |
| Project soft-deleted (`deleted_at`) | No | No | No | No | N/A | Yes (rows remain, just unreachable via the dead link) | Owner RPCs return not-found too (project gate is shared) |
| Project hard-deleted (FK cascade; not a path this product currently uses) | No (row gone) | No | No | N/A | N/A | No — cascades away by schema design (the one documented exception) | N/A |

## 2. PIN lifecycle — PASS, no code change

Reuses the shared gate unchanged. `verifyShareProjectionAuthorization`'s
own PIN check: `linkRequiresPin && grant.pin_verified_at === null` →
deny (`share-session-grant.server.ts` line ~611). `POST
/api/share/session`'s PIN-verification branch
(`app/api/share/session/route.ts`) is untouched by Phase 5 — grep
confirms no Phase 5 file imports `verifySharePin` or touches PIN
material at all. Public denials remain the single generic `401
{code:"UNAVAILABLE"}` for every one of PIN-unverified /
PIN-wrong-before-retry / link-not-found — verified by
`app/api/share/[publicId]/messages/route.test.ts`'s existing
authorization-chain tests (both GET and POST), which assert the exact
same generic body/status `verifyShareProjectionAuthorization` returning
`null` always produces, regardless of which internal check failed.

## 3. Disable / re-enable — PASS, no code change

`isShareLinkCurrentlyPubliclyActive` requires `link.state === "active"`
— a disabled link fails this on every messaging call exactly as it
already fails it for projection/file reads. `reenable_share_link`
(`202608060001_client_share_lifecycle_operations.sql`) is one of the
RPCs the access-operations file's own header comment documents as
bumping `configuration_version` on every genuine transition — so a
grant issued before disable is stale after re-enable too, requiring a
fresh `/api/share/session` exchange before messaging works again
(matches column E above). No duplicate/lost history: none of
`disable_share_link`/`reenable_share_link` reference `share_messages`
at all (confirmed by source inspection of
`202608060001_client_share_lifecycle_operations.sql` — those two
functions only ever touch `project_share_links`).

## 4. Revocation — PASS, no code change

`resolveShareLinkByPublicId` treats `state === 'revoked'` as
structurally equivalent to "not found" (`link_revoked` →
`null`) — the exact same no-enumeration-oracle posture every other
denial already uses. Once revoked, V1 has no un-revoke RPC at all (no
`unrevoke_share_link` function exists anywhere in the migrations) —
correctly not invented here. `revoke_share_link`
(`202608060002_client_share_access_operations.sql`) only touches
`project_share_links`; owner history remains fully readable via
`getOwnerShareLinkMessages`, which has no link-state filter at all (by
design, confirmed in the Phase 5C section above).

## 5. Expiry — PASS, no code change

Two independent expiry dimensions, both already gate messaging: (a)
`link.expiresAt` checked in `isShareLinkCurrentlyPubliclyActive`
(`new Date(link.expiresAt).getTime() <= Date.now()` → inactive); (b)
grant TTL checked separately in `verifyShareProjectionAuthorization`
(`grant.expires_at`). `computeGrantExpiresAt`
(`share-session-grant.server.ts`) takes `Math.min(sessionExpiry,
linkExpiry)` — a grant can never outlive its own link's expiry, so
session/grant TTL cannot extend communication access past link expiry
by construction. Owner history read is unaffected (no expiry check in
`getOwnerShareLinkMessages`).

## 6. `configuration_version` invalidation — PASS, no code change (security-sensitive, verified explicitly)

This is the exact mechanism §21's Phase 5A finding already exercises
for `commentsEnabled`: `save_share_configuration` only bumps
`configuration_version` when a supplied field's value genuinely differs
(`IS DISTINCT FROM`) — confirmed in `use-share-link.ts`'s own
`shareUpdate` design (Phase 5A turn) and the RPC's own no-op-preserving
behavior. Once bumped, `verifyShareProjectionAuthorization`'s
`grant.granted_configuration_version !== link.configurationVersion` →
deny, on the VERY NEXT call — this is not a per-route reimplementation,
it is the identical single check every Phase 5 route already goes
through. No client can bypass this: `configuration_version` is never
client-supplied anywhere in the request surface (not in the public
GET/POST messages routes, not in the exchange route) — it is read only
from the live `project_share_links` row, server-side.

## 7. Secret rotation — PASS, no code change

`rotate_share_link_secret`
(`202608060002_client_share_access_operations.sql`) is explicitly
documented, in that migration's own header comment (lines 25-47, quoted
directly), as one of the operations that "increases
`configuration_version` exactly once" — the same invalidation
mechanism as §6. The OLD secret cannot establish a new session at all
post-rotation: `POST /api/share/session` compares the supplied secret's
digest against the link's CURRENT `secret_digest`
(`constantTimeHexEqual`), which rotation overwrites — an old secret
fails secret verification outright, before configuration_version even
matters. Message history is untouched (rotation only writes
`project_share_links`/`project_share_secret_material`, confirmed by the
same source inspection as §3-4 — no `share_messages` reference exists
in `202608060002_client_share_access_operations.sql`).

## 8. Browser session / grant loss — PASS, no code change

`resolveBrowserSessionFromCookie` returns `null` for a missing,
malformed, expired, or revoked session — every one of those collapses
into the same generic denial through `verifyShareProjectionAuthorization`.
Clearing cookies never deletes `share_messages` rows (no cookie/session
table is ever joined into a delete path) — a returning visitor simply
needs to re-enter through the normal fragment-secret/PIN flow again, no
persistent client identity was added or would be needed.

## 9. Archived project — CONFIRMED CONSISTENT, not a Phase 5 blocker (inherited pre-existing behavior, unchanged)

Re-verified this turn with a fresh grep across
`202608030005_client_share_integrity_and_security.sql` (every
ongoing-access trigger): **zero** occurrences of `is_archived`. Every
occurrence of `is_archived` across the whole Client Share feature is
confined to exactly three OWNER MUTATION RPCs —
`activate_share_link`/`reenable_share_link`
(`202608060001`), and `save_share_configuration`
(`202608060003`/`202608110001`) — all raising `PROJECT_ARCHIVED` only
when the OWNER tries to activate/re-enable/reconfigure. **Actual
behavior**: an archived project's already-active share link remains
fully publicly accessible, and Phase 5 messaging inherits that exactly
(no new check was added, none was needed, since messaging reuses the
same gate). This is the pre-existing Phase 3/4 contract, not a Phase 5
regression or inconsistency — filed informationally, exactly as it was
in the Phase 5A audit, not as a blocker. A product decision on whether
archiving *should* revoke public access is out of this turn's scope.

## 10. Project deletion — PASS, no code change, confirmed via schema

This product only ever soft-deletes projects (`deleted_at`) — confirmed
by a repo-wide search finding zero hard `DELETE FROM projects` call
sites anywhere in application code. Soft-delete is already the
mechanism every gate checks (`project.deleted_at is not null` → deny),
proven since Phase 3. As defense-in-depth for the schema's own
documented "this is the one lifecycle event that is communication-
destructive by design" case: `share_messages.project_id`,
`.share_link_id`, `.user_id`, and `.parent_id` are ALL declared `on
delete cascade` (confirmed directly:
`202608030003_client_share_owner_foundation.sql` lines 572-580), and
`project_share_links.project_id` is also `on delete cascade`
(line 99) — so even a genuine hard delete (not currently reachable
through any code path) would cascade cleanly with no orphaned
communication rows, exactly as expected.

## 11. `commentsEnabled` API defense-in-depth — PASS, no code change, re-confirmed independent of UI

Both `GET` and `POST /api/share/[publicId]/messages` call
`resolveShareLinkCommentsEnabled` AFTER `verifyShareProjectionAuthorization`
succeeds, denying generically if `false` — proven directly by
`route.test.ts`'s existing tests for both handlers
("generic-unavailable when commentsEnabled=false", checked for GET and
POST independently, each asserting the downstream read/insert function
is never called). The DB's own `enforce_share_message_integrity`
trigger independently re-checks `comments_enabled` for any
`author_type='client'` insert regardless of what the application layer
does — confirmed present in
`202608030005_client_share_integrity_and_security.sql` (unchanged since
Phase 1A) — so even a hypothetical application-layer bug could not
turn into a real bypass; the DB is the final, independent write guard,
exactly as designed.

## 12. Cross-owner / cross-link / cross-project isolation — PASS, no code change

Already proven by automated tests built directly for this purpose in
Phase 5C, re-run clean this turn:
- Public: `listPublicShareMessages` scoped by all three of
  `shareLinkId`/`projectId`/`userId` from the route's own verified
  authorization, never request input;
  `shareMessageSubmissionRequestSchema` is `.strict()` with only
  `body`/`authorDisplayName` — no `shareLinkId`/`projectId`/`userId`
  field exists for a caller to even attempt to supply.
- Owner: `getOwnerShareLinkMessages` proves link ownership before any
  read (`SHARE_LINK_NOT_FOUND` for cross-owner);
  `verifyOwnedShareMessageBelongsToLink` proves a `messageId` belongs to
  BOTH the path's own `shareLinkId` AND the authenticated owner before
  any status PATCH (closing the exact gap where
  `set_share_message_status`'s own RPC signature has no link-scoping
  parameter); `send_share_message_reply`'s RPC independently re-verifies
  the parent belongs to the same link
  (`SHARE_MESSAGE_PARENT_LINK_MISMATCH`). All three layers (repository,
  API route, RPC) fail closed.

## 13. Public privacy / projection — PASS, no code change

`listPublicShareMessages` selects exactly `author_type,
author_display_name, body, created_at` at the query level (never
`select("*")`) — there is no raw-row passthrough for a later bug to
widen. Verified by 3 dedicated tests in
`public-messages-section.test.tsx` (no internal id in rendered DOM) and
by the route's own test asserting the exact 4-key response shape.

## 14. Hidden message visibility — PASS, no code change, confirmed as engineered but currently dormant

Every current write path (public client insert, owner reply RPC)
hardcodes `is_visible_to_client = true` — grep confirms there is
currently no RPC/route/UI action anywhere that ever sets it `false`.
The defense-in-depth is nonetheless already fully in place for when a
future feature needs it: `listPublicShareMessages`'s query filters
`.eq("is_visible_to_client", true)` at the DB level (not a React-only
hide), and the integrity trigger independently requires
`new.is_visible_to_client is true` for any client-authored insert
(`202608030005`, line 690). Status (`new`/`reviewed`/`resolved`/
`dismissed`) has no effect on public visibility at all — confirmed
structurally, since the public query never reads or filters on
`status`.

## 15. Rate limit / abuse — PASS, no code change

`comment_submission` exists in the TypeScript action union
(`share-rate-limit.server.ts`) and in the DB's own `p_action` CHECK
constraint (`202608130001_client_share_rate_limit_increment.sql`);
`increment_share_rate_limit_bucket` is a single atomic `insert ... on
conflict ... do update`, never read-then-write. The bucket is scoped
`browser_session`, independent from `projection_read`'s own bucket
(confirmed: GET /messages uses `projection_read`, POST /messages uses
`comment_submission` — different action strings, different DB rows).
The identity key is the session-cookie digest only — no client-supplied
body field can influence it, so rate limiting cannot be bypassed by
supplying fake fields. The rate-limit check in
`POST /api/share/[publicId]/messages` runs and can return 429 BEFORE
authorization, `commentsEnabled`, validation, or the insert are ever
reached (confirmed by reading the route's own top-to-bottom order) — so
no DB row is ever inserted after a 429. Client-side double-submission is
already prevented (`PublicMessagesSection` disables its submit button
while `send.status === "pending"`, tested). A real 11x-click browser
test was deliberately NOT performed, per this turn's own explicit
instruction to prefer automated proof of the policy/ordering over
manual spam.

## 16. Public request security — PASS, no code change

GET routes (`projection`, `messages`, file delivery) use
`isRejectableCrossSiteRequest` (tolerant of a missing `Sec-Fetch-Site`,
matching Phase 4B's own real-browser-proven direct-navigation fix).
`POST /messages` uses `validateSharePublicRequestOrigin` — the same
strict same-origin+matching-Origin-header policy `POST /api/share/session`
already used before Phase 5 existed. No Phase 5 file weakens or
duplicates Phase 4's shared `share-request-security.server.ts` helper;
both GET and POST request-security paths are exercised by existing
passing tests (cross-site rejected, missing Sec-Fetch-Site accepted for
GET, Origin mismatch rejected for POST).

## 17. Message content safety — PASS, no code change

Re-confirmed via the existing, still-passing test suites: plain-text
only (React text nodes, `dangerouslySetInnerHTML` absent by grep across
every Phase 5 UI file), HTML-like input stored/rendered verbatim as
text, Hebrew/Arabic/emoji/multiline preserved, control characters
stripped consistently by the SAME shared `validateShareMessageBody`
function used by both the public route and the owner reply route (no
second, divergent validator), 4000-codepoint / 80-codepoint limits
counted via `[...value].length` (codepoints, matching Postgres
`char_length`) on both client and server. The Phase 5B streaming-limit
defect (found and fixed in that turn) remains covered by its own
regression tests in `share-public-request.server.test.ts`, re-run clean
this turn — confirming a non-ASCII message under 4000 characters is
never rejected merely for exceeding the old 4096-byte ceiling.

## 18. Owner workflow invariants — PASS, no code change

Reply creates only a new owner-authored row (`send_share_message_reply`
is `insert`-only, no `update` statement exists in its body at all —
confirmed by direct reading of the RPC and by the migration's own
40-test static-source suite). Status changes are the ONLY path that
touches `status`/`reviewed_at`/`resolved_at`, always an explicit owner
action (`set_share_message_status`), never automatic. `'converted'` is
unreachable from every Phase 5 surface: rejected by the route's Zod
schema before any DB call, and absent from the RPC's own accepted-value
list. Opening or refreshing the modal performs only a `GET` — confirmed
by dedicated tests ("opening the modal never calls
setShareMessageStatus") — reading is never workflow mutation.

## 19. Unread consistency — PASS, no code change (plus the now-closed stale-badge regression)

Definition unchanged (`author_type='client' AND status='new'`), served
by the existing partial index, never recomputed client-side anywhere —
every unread number displayed (badge and modal) comes directly from a
server response. `'new'` remains a settable target status through
`set_share_message_status` (confirmed in the RPC body), so an owner CAN
reopen a message via the API even though no UI button currently exposes
it — permitted, not required, matching the task's own phrasing. The
Phase 5D stale-badge defect (two isolated hook instances, no
synchronization) is closed: `ShareLinkPanel`'s modal-`onClose` handler
now also calls its own badge hook's `refetch()`, re-verified by 4
regression tests and by real Preview re-verification (§0). No
optimistic decrement was introduced, and no polling/global cache was
introduced to fix it.

## 20. Owner-history retention matrix

| Event | Owner history retained? | Evidence |
|---|---|---|
| Comments disabled | Yes | `getOwnerShareLinkMessages` has no `comments_enabled` gate |
| Link disabled | Yes | `disable_share_link` touches only `project_share_links` |
| Link revoked | Yes | `revoke_share_link` touches only `project_share_links` |
| Link expired | Yes | Expiry is a public-read-time check only, never a write |
| Secret rotated | Yes | `rotate_share_link_secret` touches only `project_share_links`/secret material |
| `configuration_version` changed | Yes | `save_share_configuration` never references `share_messages` |
| Browser grant expired | Yes | Grant expiry is public-side only, irrelevant to owner reads |
| Client cookie deleted | Yes | No session/cookie join exists in any owner read path |
| Project archived | Yes | `is_archived` never gates reads, only owner activation/reconfig RPCs |
| Project soft-deleted | Rows persist in DB but become unreachable via the now-dead link/project | Owner routes share the same `deleted_at` gate as everything else |
| Project hard-deleted (schema-only; not a reachable path today) | **No — cascades away by design** | `on delete cascade` on every relevant FK (§10) |

## 21. Analytics / session replay — PASS, no code change

`shouldSkipAnalyticsPath` (`lib/analytics/analytics-paths.ts`) excludes
`/share` and every `/share/*` path from both
`ConsentAwareVercelAnalytics` and `CookieConsentBanner` — a path-based
check with no knowledge of Messages at all, so it applies unchanged. No
Phase 5 file (public or owner) imports any analytics/tracking module —
confirmed by grep across every new/modified Phase 5 file. The 23-test
analytics isolation suite re-ran clean this turn.

## 22. Public security headers / indexing — PASS, no code change

Unchanged since Phase 3/5A: page-level `robots: {index:false,
follow:false, noarchive:true}` (`app/share/[publicId]/page.tsx`);
`proxy.ts`'s `SHARE_PUBLIC_PAGE_HEADERS` (`Cache-Control: private,
no-store`, `Referrer-Policy: no-referrer`, minimal CSP) applied to
every `/share` and `/share/*` request, which covers the page but not
the API routes; the two `/api/share/[publicId]/messages` handlers set
their own `NO_STORE_HEADERS` (`Cache-Control: private, no-store`,
`Pragma: no-cache`, `Referrer-Policy: no-referrer`,
`X-Content-Type-Options: nosniff`) on every response branch, matching
the projection/file routes' own established convention exactly.

## 23. Failure isolation — PASS, no code change

Both `usePublicShareMessages` and `useOwnerShareMessages` remain fully
outside `ShareView`'s and `useShareLink`'s own state machines — proven
by dedicated tests: a rejected public history fetch still renders the
compose form and never blanks `ClientProjectView`; `ShareLinkPanel`'s
own tests run with a stubbed, always-failing `fetch` for the badge hook
specifically to prove the rest of the panel (PIN controls, copy/share
actions, configuration) is unaffected by a Messages-layer failure.

## 24. Phase 6 boundary — final hard check, PASS

Every Phase 5 file's own dedicated comment-stripped static test
(migration: 40 tests; repository: covered in its own boundary describe
block; public-message module: covered; three owner routes: 12 dedicated
tests in `phase6-boundary.test.ts`) re-ran clean this turn as part of
the full regression sweep. No Phase 5 file references
`share_message_conversions`, writes `project_updates`, writes
`project_timeline_events`, sets `status='converted'`, or imports any
task/project/CRM mutation, email, or AI-analysis module.

## 25. Regression against Phases 1-4 — PASS

Full Client Share suite (`lib/share`, `app/api/share`,
`app/api/share-links`, every share-link dashboard component,
`app/share`, the Phase 5A migration test, plus `lib/analytics`/
`app/components/analytics`), run together this turn: **57 test files,
2003 tests, all passing** — covering owner activation, copy-link,
native share, WhatsApp, email, PIN set/clear, expiry set/clear,
disable/re-enable, revoke, preview, public projection, task mapping,
resource mapping, LINK attachments, secure FILE delivery, fileRef
privacy, and analytics isolation, none of which regressed.

## 26. Exact tests / counts (all actually executed this turn)

- Full Client Share + analytics regression sweep, run together: **57
  test files, 2003 tests, all passing** (no new tests were added this
  turn — verification-only, no defect found).
- `tsc --noEmit`: clean.
- `npm run build`: succeeded, all routes (including every Phase 5
  route) registered correctly.
- `git diff --check` / `git status`: clean — zero files modified this
  turn (one stray, empty isolated-agent worktree directory left over
  from a failed tool invocation earlier in this turn was found and
  removed via `git worktree remove`; it contained no changes and was
  not part of the tracked repository).

## 27. Remaining real-Preview acceptance gap (minimal, targeted)

Every lifecycle event in §1's table is proven either by (a) Phase 3/4's
own already-accepted real-browser evidence acting on the identical,
unmodified authorization gate Phase 5 reuses, or (b) Phase 5D's own
already-completed real Preview acceptance (§0). Two genuinely new
combinations remain unobserved in any real browser so far:

**Check 1 — Revoke with real message history present.**
Purpose: prove revocation denies public messaging while owner history
survives, in the one combination (revoke + existing messages) neither
Phase 3/4 nor Phase 5D's own acceptance list directly exercised
together.
Starting state: an active, comments-enabled share link with at least
one real client message and one owner reply already exchanged (reuse
the state from the already-proven flow).
Action: owner clicks Revoke in the Share panel.
Expected: the client's tab (on refresh) shows the generic unavailable
state; a direct POST to the messages endpoint (e.g. via browser
devtools) also fails generically; the owner still sees the full,
unchanged message history in Client Communication History.

**Check 2 — Live `configuration_version` invalidation with an already-open client tab.**
Purpose: directly observe the security-sensitive §6 guarantee in a real
two-tab scenario, not just via code+unit-test proof.
Starting state: a client tab already loaded and authorized (grant at
version N), Messages section visible; owner's Share panel open
separately.
Action: owner changes any share configuration field (e.g. toggles
"Allow client messages" off and back on), bumping
`configuration_version` to N+1, without the client refreshing.
Expected: the client's already-rendered page is unaffected until its
next action (no realtime push, expected); the client's next
GET/POST (either an explicit refresh or a send attempt) is denied
generically until the browser re-authorizes through the normal
fragment/PIN flow, proving the stale grant was never silently honored.

No other item in §1-§26 requires a new manual check.

---

# PHASE 5F VERIFICATION STATUS (SUPERSEDED BY THE REAL DEFECT BELOW):
~~PASS~~ -- see "PHASE 5F REAL PREVIEW DEFECT" section immediately below.
The lifecycle/security verification in §1-§26 above remains valid and
unchanged; this new section documents a UI-reachability defect the real
Preview acceptance pass this doc's own §27 called for actually found.

---

# PHASE 5F REAL PREVIEW DEFECT — REVOKED LINK HIDES OWNER CLIENT COMMUNICATION HISTORY

Found during the exact "revoke with real message history present" real
Preview check this doc's own §27 recommended. Disposable fixture:
share link `39e539e1-598f-4df8-ac2f-a20f55e65e45`, revoked, with real
Phase 5 message history (client message → owner reply → client
message) still in the database. Left untouched by this turn, exactly as
instructed, for post-fix re-verification.

## Public revoke security — PASS (unchanged)

`POST /api/share-links/<linkId>/revoke` returned 200; the client's
existing tab, on refresh, correctly showed "This shared project view is
not available." This is exactly Phase 5F's own §4 revocation contract,
already verified by code+tests before this defect was found, now also
confirmed live. No change was needed or made here.

## Owner-history UI accessibility — FAIL (now fixed, pending redeploy)

After revoking, the owner reopened "Share with client" and the panel
reset to a fresh sharing configuration -- the "Client messages" entry
point had disappeared entirely, even though the link's real message
history remained fully intact in the database (`getOwnerShareLinkMessages`
was, and remains, correctly state-unfiltered — this was never a data
problem, only a UI-reachability one).

## Exact root cause

`get_share_link_management_state` (the RPC behind `ShareLinkPanel`'s
`state.data.link`) filters `link.state <> 'revoked'` by design
(`202608110002_client_share_management_mapping_metadata.sql` line 167,
and identically in `list_share_link_summaries`,
`202608050001_client_share_owner_reads.sql` line 272) -- correct and
intentional for that RPC's own purpose (which link can the owner
activate/reconfigure right now), never previously a problem because
nothing else depended on it for anything but that purpose. Once an
owner's only link is revoked, this RPC deterministically returns
`link: null`. `ShareLinkPanel`'s "Client messages" entry point,
however, was conditioned directly on that same `link` being non-null --
a conflation of two genuinely different questions ("what can I manage"
vs. "what history can I still read") that had never previously mattered,
since every other lifecycle event that clears `link` to `null` (a
freshly-created project with no share history at all) is indistinguishable
from "no history exists" -- revoke is the one event that creates a real
gap between the two.

No RPC, migration, or SQL was touched or needed to fix this -- it was a
pure application-layer link-selection gap, exactly as the task's own
root-cause hypothesis anticipated.

## Exact minimal fix

A new, deliberately separate, read-only fallback resolution path, used
ONLY when `get_share_link_management_state` has already returned
`link: null` for the project:

1. **`resolveMostRecentShareLink`**
   (`lib/share/share-messages-repository.server.ts`) -- a direct
   RLS-bound read (not an RPC; no migration needed) of
   `project_share_links`, scoped by `project_id` + `user_id`, with
   **no state filter at all**. This needs no new grant or policy: the
   table's existing "Users can view own project share links" RLS
   policy (`auth.uid() = user_id`, 202608030003) already has no state
   restriction of its own -- only the two "managed link" RPCs
   deliberately narrow it for their own purpose. Selection is
   deterministic, not arbitrary: it reuses the IDENTICAL tie-break
   order both existing RPCs already establish (`updated_at desc,
   created_at desc, id desc`, `limit 1`). Documented explicitly as a
   fallback-only helper, never a replacement for the RPC's own
   selection logic -- callers must only invoke it after confirming
   `link: null`.
2. **`GET /api/share-links/history-link?projectId=`**
   (new route) + **`getMostRecentShareLink`** (`share-link-client.ts`
   wrapper) -- read-only, returns `{linkId, state} | {linkId:null,
   state:null}`. Never activates, re-enables, or otherwise mutates
   anything; a dedicated test greps the route's own source to prove it
   imports no activate/reenable/revoke/create function at all.
3. **`useShareLinkHistory`** (new hook,
   `use-share-link-history.ts`) -- mirrors `useOwnerShareMessages`'s
   own isolation rationale exactly: fetched only when
   `state.isOpen && linkId === null` (no active/manageable link), never
   on an interval, and its own failure cannot affect the rest of the
   panel.
4. **`ShareLinkPanel`** now computes `messagesLinkId = linkId ??
   historicalLinkId` and uses THAT (not `link?.id` alone) for both the
   "Client messages" entry-point condition and the unread badge's own
   `useOwnerShareMessages` instance. The entry point still renders when
   no active link exists but a historical one does, now captioned "From
   a previous share" so the owner cannot mistake it for a live share.

No multi-link selector, inbox, or history list was built: the
resolution always yields exactly one deterministic link id, matching
the task's own explicit "do not build multi-link management" constraint.
A fresh project with genuinely zero share links ever created still
correctly shows no entry point at all (the fallback query simply finds
no row).

## Revoked-link selection semantics (confirmed unambiguous, not arbitrary)

`get_share_link_management_state`'s own `state <> 'revoked'` filter
means that by the time the new fallback is ever invoked, the only rows
it can possibly find are `state = 'revoked'` -- every other state
already satisfies that filter and would already have been returned by
the primary RPC. There is no scenario, in this V1 schema, where the
fallback must choose among multiple DIFFERENT non-revoked states; if a
project happens to have multiple revoked links, the existing
deterministic tie-break (already proven correct and already used twice
elsewhere in this codebase) picks exactly one, never arbitrarily.

## Owner read/reply/status behavior after revoke (audited, decision documented)

- **Read**: unaffected and unchanged -- `getOwnerShareLinkMessages` was
  already, and remains, fully state-unfiltered (Phase 5C's own explicit
  design).
- **Status** (`set_share_message_status`): unaffected -- the RPC has no
  link-state check at all (only message ownership), and status is
  purely the owner's own private workflow bookkeeping, never
  client-visible in the first place. Left exactly as-is; no reason to
  restrict it on a revoked link.
- **Reply** (`send_share_message_reply`): audited and found to have no
  link-state check either -- an owner reply on a revoked link would be
  silently ACCEPTED by the RPC yet could never reach the client, since
  public access to a revoked link is already (correctly) denied. This
  is not a security defect (still fully owner-scoped, no cross-tenant
  issue) but a real UX trap: an action that looks successful but is
  functionally meaningless. **Decision (UI-layer only, RPC
  unchanged)**: `ClientCommunicationHistoryModal` now accepts a
  `canReply` prop; `ShareLinkPanel` passes `canReply={false}` exactly
  when the resolved link's own state is `'revoked'` (`isRevokedMessagesLink`,
  derived from `historicalLinkState`, not merely "no active link
  exists" -- a deliberately precise condition). The Reply trigger and
  composer are both suppressed; status actions remain fully available.
  A visible notice ("This share link has been revoked. Clients can no
  longer send or receive messages here, but the history below is
  preserved.") reinforces that the owner must not infer the link still
  works. `set_share_message_status`'s own RPC security was **not**
  altered, per the explicit instruction not to change RPC security
  without a concrete defect -- none was found there.

## Files changed

New:
- `lib/share/share-messages-repository.server.ts` --
  `resolveMostRecentShareLink` (added function; file already existed)
- `app/api/share-links/history-link/route.ts` + `.test.ts`
- `app/components/dashboard/tasks/share-link/use-share-link-history.ts`

Modified:
- `lib/share/share-messages-repository.server.ts` (added function +
  `.limit()` added to the internal query-builder type) + `.test.ts`
- `lib/share/share-contracts.ts` (added `anyShareLinkStateSchema`,
  `mostRecentShareLinkDataSchema`/`Response` -- purely additive, the
  existing `shareLinkManagementStateDataSchema` contract was not
  touched)
- `app/components/dashboard/tasks/share-link/share-link-client.ts`
  (added `getMostRecentShareLink`) + `.test.ts`
- `app/components/dashboard/tasks/share-link/share-link-panel.tsx`
  (resolves and uses `messagesLinkId`/`isHistoricalMessagesLink`/
  `isRevokedMessagesLink`; the entry point and badge hook now key off
  the resolved link, not `link` alone) + `.test.ts`
- `app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx`
  (new optional `isHistorical`/`canReply` props, both defaulting to
  the prior unchanged behavior) + `.test.ts`

## Tests / counts (all actually executed this turn)

- `share-messages-repository.server.test.ts`: **47/47** (41 pre-existing
  + 6 new, covering `resolveMostRecentShareLink`'s row resolution,
  null-when-no-link, fail-closed error handling, exact scoping/order/
  limit, and a source-level check that it applies no state filter of
  its own)
- `app/api/share-links/history-link/route.test.ts`: **11/11** (new)
- `share-link-client.test.ts`: **26/26** (23 pre-existing + 3 new)
- `share-link-panel.test.tsx`: **31/31** (24 pre-existing + 7 new,
  including the exact real-Preview repro: badge/entry point survives
  revoke, resolves the correct revoked link id, renders retained
  history, keeps public-link controls separate from history access, no
  automatic re-enable/new-link creation, no multi-link selector, no
  polling, no Project Timeline/Phase 6 reference)
- `client-communication-history-modal.test.tsx`: **35/35** (29
  pre-existing + 6 new, covering default-unchanged behavior,
  `isHistorical` notice, `canReply=false` suppressing Reply while
  leaving status actions available, and unaffected read access)
- Full Client Share + analytics regression sweep, run together: **58
  test files, 2036 tests, all passing**.

## TypeScript / eslint / diff / build

- `tsc --noEmit`: clean.
- `eslint` on every file touched this turn: **0 errors**; 3 pre-existing
  `no-unused-vars` warnings on intentionally-unused fake-client mock
  parameters (same accepted convention as every earlier Phase 5 slice).
- `git diff --check`: clean (only expected LF→CRLF notices).
- `npm run build`: succeeded -- `/api/share-links/history-link`
  registered correctly alongside every other route; no new warnings.

Nothing was staged, committed, or pushed this turn. No SQL was executed,
no migration was run, no Supabase state was modified, no new share link
was created, and the revoked disposable fixture
(`39e539e1-598f-4df8-ac2f-a20f55e65e45`) was left exactly as found.

## Exact real Preview re-verification required (after redeploy)

1. Deploy this branch to the same disposable Preview.
2. Owner reopens "Share with client" for the project that owns the
   already-revoked link `39e539e1-598f-4df8-ac2f-a20f55e65e45`.
3. Confirm the panel now shows a "Client messages" entry point
   (captioned "From a previous share"), even though the panel is
   otherwise back in its fresh quick-share state.
4. Click it; confirm the full retained history renders (client message
   → owner reply → client message), unread/status metadata intact.
5. Confirm the notice "This share link has been revoked..." is shown,
   and that no Reply control is offered anywhere in the view.
6. Confirm status actions (Mark reviewed / Resolve / Dismiss) remain
   available and functional on the historical messages.
7. Confirm the original public URL for this link is still denied
   (regression check -- should already be unaffected, since no public
   route or authorization code was touched).
8. Confirm creating/sharing a brand-new link for the same project does
   not alter or remove the historical link's own retained messages.

---

# PHASE 5F VERIFICATION STATUS (SUPERSEDED — see PHASE 5G FINAL CLOSURE at the end of this document):
~~BLOCKED~~ → **PASS**. At the time this line was first written, the
revoked-owner-history-UI defect had been fixed in code but not yet
re-verified in a real Preview deployment. It has since been re-verified
live (fresh deploy + hard-refresh, per the follow-up investigation
immediately below) and confirmed working. All other Phase 5F findings
(§1-§26 above) remain PASS and unaffected. Do not read this line in
isolation -- the PHASE 5G FINAL CLOSURE section at the end of this
document is the authoritative final status.

---

# PHASE 5F FOLLOW-UP — FRONTEND WIRING INVESTIGATION

Real Preview diagnostics narrowed the remaining defect to
frontend-only, having confirmed `resolveMostRecentShareLink`, the
`history-link` API, and revoked-state detection all PASS in isolation
(the endpoint was confirmed returning the correct
`{linkId: "39e539e1-...", state: "revoked"}` for the affected project
when called directly), yet `ShareLinkPanel` still did not render the
"Client messages" entry point live.

## Investigation performed

Re-read `use-share-link-history.ts`, `share-link-panel.tsx`'s full
`messagesLinkId`/`historicalLinkId`/`historyEnabled` computation, the
render condition for the entry point, and `useShareLink.ts`'s exact
`isLoading`/`data` transition sequence during `openPanel()` (the real
sequence: `isLoading:true, data:null` → `isLoading:false, data:{link:
null,...}` once `get_share_link_management_state` resolves). Confirmed
`ShareLinkPanel` is mounted unconditionally by its one caller
(`tasks-view.tsx`), so it never unmounts/remounts merely from
`state.isOpen` toggling -- ruling out a stale-`isMountedRef` theory.
Confirmed no duplicate/shadow component file exists.

Wrote and ran six test scenarios reproducing the exact real state
(`state.data.link === null`, `linkHistory` resolved to
`{linkId:"...", state:"revoked"}`) plus the surrounding conditions most
likely to expose a timing/wiring bug if one existed:
1. Pre-settled render (management state and history both already
   resolved).
2. The REAL `openPanel()` transition sequence, replayed via
   `rerender()`: active-link session → close → reopen with
   `isLoading:true/data:null` → settle on `isLoading:false/data.link:
   null`.
3. History fetch left deliberately pending (in-flight), confirming the
   entry is correctly absent while loading and appears the instant the
   fetch resolves -- its absence during loading is not permanent/sticky.
4. A slower, stale history response arriving AFTER a fresher one,
   confirming the existing request-id staleness guard discards it
   rather than overwriting the already-resolved (and already-rendered)
   link id.
5. No active link + no historical link → correctly no entry point.
6. Active link + a historical link also existing → the active link
   correctly wins, and the historical-fallback fetch is never even
   triggered.

**All six passed against the code exactly as shipped in the previous
turn.** No test scenario reproduced the reported symptom.

## Root cause

**Could not be conclusively reproduced or isolated to a specific code
defect.** The `messagesLinkId`/`historicalLinkId` computation, the
`historyEnabled` gate, the render condition, and the fetch/race-safety
logic all behave correctly under exhaustive code review and under every
realistic and adversarial timing scenario tested. Given the API layer
is independently confirmed correct and the frontend logic withstood
every test constructed to break it, the most plausible explanation for
a live discrepancy is environmental rather than a code defect in the
reviewed files -- most likely a stale client-side JS bundle in the
tested Preview deployment (Vercel/CDN edge caching can serve an updated
server-side API route alongside an unrefreshed client bundle after a
deploy, especially without a hard browser refresh) rather than a logic
error in `ShareLinkPanel`/`useShareLinkHistory`.

## Fix applied (defensive hardening, not a confirmed bug fix)

`historyEnabled` in `share-link-panel.tsx` changed from depending on
`!state.isLoading && !state.loadError` to depending on `state.data !==
null` directly:

```
- const historyEnabled = state.isOpen && linkId === null && !state.isLoading && !state.loadError;
+ const historyEnabled = state.isOpen && state.data !== null && linkId === null;
```

This is a strictly more direct signal ("has the management-state call
actually produced a result we can read `link` from") than the previous
proxy (`isLoading`/`loadError`, whose true purpose is the panel's own
top-level loading spinner, not this fallback's trigger condition) --
shipped as a genuine robustness improvement even though no test
scenario distinguished the old and new gates' behavior. All 6 scenarios
above, plus the full existing suite, pass identically under both the
old and new gate, which is itself further evidence this was not the
actual root cause -- included anyway because it removes a real,
if unconfirmed, class of risk (an accidental extra dependency on an
unrelated loading flag) at zero behavioral cost.

## Files changed

- `app/components/dashboard/tasks/share-link/share-link-panel.tsx`
  (`historyEnabled` gate condition only)
- `app/components/dashboard/tasks/share-link/share-link-panel.test.tsx`
  (3 new tests: the real `openPanel()` transition sequence, the
  in-flight/pending-fetch case, and the stale-response race)

## Tests / counts

- `share-link-panel.test.tsx`: **34/34** (31 pre-existing + 3 new)
- Full Client Share + analytics regression sweep: **58 test files, 2039
  tests, all passing**
- `tsc --noEmit`: clean
- `eslint` on both touched files: **0 errors, 0 warnings**
- `git diff --check`: clean
- `npm run build`: succeeded

## Recommended next step

Before further code investigation: **redeploy this branch to a fresh
Preview and hard-refresh (bypass cache) the browser tab before
re-testing** the exact revoked fixture
(`39e539e1-598f-4df8-ac2f-a20f55e65e45`). If the entry point still does
not appear after a confirmed-fresh client bundle, capture the browser's
Network tab during the exact repro (does `GET
/api/share-links/history-link?projectId=...` fire at all from the app
itself, not just when hit directly? what does it return in that
in-app call specifically?) and the React DevTools component tree for
`ShareLinkPanel` at the moment of the bug (`historyEnabled`,
`linkHistory.state`, `messagesLinkId` values) -- that direct evidence
would let this investigation move from "could not reproduce" to an
exact fix, if a real code defect still exists after ruling out a stale
bundle.

---

# PHASE 5G CLOSURE READINESS (SUPERSEDED — see PHASE 5G FINAL CLOSURE below):
~~BLOCKED~~ → **READY**. The real Preview re-verification requested
above has since been completed: a fresh deploy with a hard-refreshed
client bundle confirmed "Client messages" / "From a previous share"
renders correctly for the revoked historical link, full history is
readable, Reply is suppressed with a clear revoked notice, and explicit
owner status actions (including a genuine mixed-state check across two
independent client messages) succeed correctly. See the PHASE 5G FINAL
CLOSURE section immediately below for the complete, authoritative final
record.

---

# PHASE 5G — FINAL CLOSURE

This section is the authoritative, final summary of the entire Client
Share Communication (Phase 5) effort. Where an earlier section in this
document reads as an in-progress plan or carries a since-resolved
BLOCKED marker, THIS section supersedes it. Nothing below required a
new application-code change -- Phase 5G is a documentation/verification
closure turn only.

## 1. Implementation results, phase by phase

- **Phase 5A** (owner communication foundation): two narrow
  SECURITY DEFINER RPCs (`send_share_message_reply`,
  `set_share_message_status`), `commentsEnabled` exposed in Quick Share,
  owner repository foundation. Migration:
  `supabase/migrations/202608190001_client_share_message_owner_rpcs.sql`
  -- applied to the disposable Supabase project only, confirmed **not**
  applied to Production.
- **Phase 5B** (public submission): `POST
  /api/share/[publicId]/messages`, the dedicated `comment_submission`
  rate-limit bucket, trusted server-side insert. Uses only the
  Phase 1A `service_role` grant -- no new migration required.
- **Phase 5C** (communication APIs): public history `GET`, owner
  history `GET`, owner reply `POST`, owner status `PATCH`. All reuse
  the Phase 3/4 public authorization gate and Phase 1 RLS unchanged.
- **Phase 5D** (UI): public Messages section, owner Client
  Communication History modal, unread badge, reply UX, explicit
  reviewed/resolved/dismissed workflow. Full build passed; full real
  Preview core flow passed (§0 of the Phase 5D defect section above).
- **Phase 5F** (lifecycle/security verification + 2 real defects found
  and closed): see §2-§3 below.

## 2. Stale unread badge defect — CLOSED / PASS

Root cause: the panel badge and the Communication History modal used
two deliberately isolated `useOwnerShareMessages` instances (by
design, for failure isolation); a status mutation made through the
modal updated only its own state, never the panel badge's. Fix: the
modal's `onClose` handler (fired by "Back") now also calls the panel's
own badge hook's `refetch()`. Real Preview re-verification: badge
showed 1 → status mutation inside the modal → modal showed 0 unread →
Back → panel badge disappeared immediately, with no Share panel
close/reopen required. **CLOSED / PASS.**

## 3. Revoked owner-history accessibility defect — CLOSED / PASS

Root cause: `get_share_link_management_state` deliberately excludes
revoked links from what it calls "managed" (correct for its own "what
can the owner activate/reconfigure" purpose) -- but the "Client
messages" entry point was incorrectly conditioned on that same,
necessarily-null result, with no separate path to the link's own
still-fully-retained message history. `getOwnerShareLinkMessages`
itself was never affected -- it remained state-unfiltered throughout,
confirmed both before and after this fix.

Fix (read-only, additive, no SQL): `resolveMostRecentShareLink`
(a direct RLS-bound read of `project_share_links`, no state filter,
reusing the exact deterministic tie-break `get_share_link_management_state`/
`list_share_link_summaries` already establish) → `GET
/api/share-links/history-link` → `useShareLinkHistory` → `ShareLinkPanel`
now computes `messagesLinkId = manageable link id ?? historical
fallback link id` (never the reverse), used for both the entry point
and the badge.

An initial real Preview check appeared not to show the result even
though the API itself was independently confirmed correct
(`{"linkId":"39e539e1-598f-4df8-ac2f-a20f55e65e45","state":"revoked"}`).
Extensive code review plus six adversarial/timing test scenarios (the
real `openPanel()` loading-state transition, an in-flight/pending
fetch, a stale-response race, no-link/no-history, active-link-wins, and
the pre-settled case) could not reproduce a frontend logic defect
against the code as shipped. One defensible hardening change was made
regardless (`historyEnabled` now keys directly off `state.data !==
null` rather than the more indirect `!state.isLoading` proxy). A fresh
deploy with a hard-refreshed client bundle then confirmed the entry
point renders correctly, resolving what had most likely been a stale
client bundle from the prior deploy rather than a code defect.

Full real Preview re-verification, final pass:
- "Client messages" / "From a previous share" renders for the project
  owning the revoked link, with no active/manageable link present.
- Opening it shows the full retained history (client message → owner
  reply → client message).
- A clear notice is shown: clients can no longer send or receive
  messages on this link; the history is preserved.
- Reply is correctly suppressed (the RPC has no link-state check of its
  own -- a reply would be silently accepted yet undeliverable to the
  client, so this is a UI-layer decision, not an RPC change).
- Owner-private workflow status actions (Mark reviewed / Resolve /
  Dismiss) remain fully available and were exercised successfully on
  the revoked history.

**CLOSED / PASS.**

## 4. Correction: discarded false "status isolation" suspicion

During the final revoked-history real Preview pass, a status action
applied to one client message appeared, briefly, to have also changed
a second message's status -- raising a suspected "one status action
changes multiple rows" defect. **This suspicion is false and is
explicitly retracted.** The user clarified both client messages had
already been independently changed during earlier manual testing in
the same session, before the final check. A clean, final real Preview
state proved correct, independent per-row status:

- Message A: `REVIEWED`
- Message B: `RESOLVED`

This is exactly what `set_share_message_status`'s own `where id =
p_message_id and user_id = v_user_id` scoping (a single-row `update`,
confirmed by that RPC's own 40-test static-source suite) already
guarantees -- there was never a code path capable of mutating more than
one row per call. **No status-isolation defect exists. No fix was
needed or made.** (This document contained no prior claim of such a
defect to retract -- the suspicion was raised and resolved entirely
within the same live testing session; this section exists solely to
place the correction on the record, per instruction.)

## 5. Final lifecycle acceptance matrix

| Event | Real Preview evidence | Status |
|---|---|---|
| Core communication (enable → send → badge → reply → refresh → owner status workflow) | Full flow items 1-16 (see PHASE 5F REAL PREVIEW DEFECT section evidence list) | PASS |
| `configuration_version` stale-grant invalidation | Owner changed config; the client's already-open, previously-valid tab, on refresh, got "This shared project view is not available." -- the existing grant did not silently inherit the new configuration | PASS |
| Revoke (public denial) | Fresh valid client access existed; owner revoked `39e539e1-598f-4df8-ac2f-a20f55e65e45`; the same already-authorized client tab, on refresh, got the same generic unavailable message; no bypass | PASS |
| Revoke (owner-history retention + UI accessibility) | See §3 above | PASS (after fix + re-verification) |
| PIN / disable / expiry / secret rotation / browser-session loss / archived project | Verified by code+test evidence reusing the identical, unmodified Phase 3/4 authorization gate every Phase 5 route calls (§1-§8 of the original Phase 5F verification, unchanged and still valid) | PASS |
| Project (hard) deletion | Schema-level `on delete cascade` on every `share_messages` FK confirmed; this product only ever soft-deletes in practice | PASS (by design) |

## 6. Final owner-history retention matrix

| Event | Owner history retained? |
|---|---|
| Comments disabled | Yes |
| Link disabled | Yes |
| Link revoked | Yes (now also UI-reachable, per §3) |
| Link expired | Yes |
| Secret rotated | Yes |
| `configuration_version` changed | Yes |
| Browser grant expired / client cookie deleted | Yes |
| Project archived | Yes |
| Project soft-deleted | Rows persist, unreachable via the dead link -- consistent with every other gate |
| Project hard-deleted (schema-only; not a path this product uses) | No -- cascades away by design, the one documented exception |

## 7. Phase 6 boundary — final confirmation

Re-confirmed clean across every Phase 5 file (migration, repository,
public routes, owner routes, public UI, owner UI, the new
`history-link` route/resolver/hook added this closure). No Phase 5 path
inserts `share_message_conversions`, sets `status='converted'`,
creates or mutates `project_updates`, creates/updates tasks, changes
project status/priority/deadline, mutates CRM/client data, writes
`project_timeline_events`, sends email, or triggers AI analysis. No
disabled "Convert" placeholder was added anywhere. Phase 6 remains a
deliberately separate, not-yet-started future phase.

## 8. Uncommitted-diff audit (this turn)

`git status --short` / `git diff --stat` reviewed file by file; every
uncommitted file classified:

**A. Required Phase 5F fix:**
`app/components/dashboard/tasks/share-link/client-communication-history-modal.tsx`,
`app/components/dashboard/tasks/share-link/share-link-client.ts`,
`app/components/dashboard/tasks/share-link/share-link-panel.tsx`,
`app/components/dashboard/tasks/share-link/use-share-link-history.ts` (new),
`lib/share/share-contracts.ts`,
`lib/share/share-messages-repository.server.ts`,
`app/api/share-links/history-link/route.ts` (new)

**B. Required test:**
`app/components/dashboard/tasks/share-link/client-communication-history-modal.test.tsx`,
`app/components/dashboard/tasks/share-link/share-link-client.test.ts`,
`app/components/dashboard/tasks/share-link/share-link-panel.test.tsx`,
`lib/share/share-messages-repository.server.test.ts`,
`app/api/share-links/history-link/route.test.ts` (new)

**C. Required documentation:**
`docs/TEXT2TASK_CLIENT_SHARE_LINK_PHASE_5_AUDIT_AND_PLAN_2026-08-19.md`

**D. Accidental/unrelated:** none found. Every uncommitted file belongs
to Phase 5F/5G closure.

## 9. Final revoked-history architecture confirmation (re-audited this turn)

- `get_share_link_management_state` is unchanged in purpose and source
  -- still correctly excludes revoked links; no SQL/RPC/migration
  change was made merely to support history lookup.
- The fallback (`resolveMostRecentShareLink`) is read-only, RLS-bound
  (relies entirely on `project_share_links`'s existing owner-scoped
  `auth.uid() = user_id` policy, no new grant), owner-scoped,
  project-scoped, and deterministic (identical tie-break to the two
  existing RPCs).
- The active/manageable link always wins:
  `messagesLinkId = linkId ?? historicalLinkId`, never the reverse --
  confirmed both by direct source reading and by a dedicated test
  ("active link + historical fallback => active link wins, historical
  fetch never even triggered").
- The fallback fetch is enabled only when the primary management-state
  call has resolved with no link (`state.data !== null && linkId ===
  null`) -- never fetched merely because the panel is open.
- No multi-link management UI was introduced -- the resolution always
  yields exactly one deterministic id, and a project with zero share
  links ever created still shows no entry point.
- No revoked link can become publicly active through this path -- the
  fallback is a plain, unauthenticated-irrelevant OWNER-side read; no
  public route, public authorization check, or `project_share_links`
  write was touched anywhere in Phase 5F.
- No secret/PIN/configuration is copied from the revoked link into any
  future link -- `resolveMostRecentShareLink` selects only `id, state`;
  nothing else is read, carried forward, or reused.

## 10. Final revoked-history UX contract (confirmed, unchanged from §3 above)

- **Active/manageable link**: ordinary "Client messages" entry,
  ordinary communication behavior, no revoked-mode indicators.
- **No manageable link + revoked history exists**: "Client messages"
  entry remains visible, captioned "From a previous share"; opening it
  uses the exact historical revoked link id; a clear revoked notice is
  shown; Reply is suppressed; owner-private status actions (Mark
  reviewed / Resolve / Dismiss) remain fully available.
- **No current link + no history**: no entry point rendered at all.

No additional states were introduced this turn.

## 11. Final public security contract (reconfirmed, architecture unchanged)

Public communication (`GET`/`POST /api/share/[publicId]/messages`)
still requires, unconditionally: the feature flag enabled, a valid
session exchange, a valid browser-session cookie, a valid link-specific
grant, an active/non-disabled/non-revoked/non-expired link, an
exact-matching `configuration_version`, PIN verification where
required, `commentsEnabled=true`, request-origin/security checks
(GET tolerant of missing `Sec-Fetch-Site`, POST strict same-origin),
and the `comment_submission` rate limit on POST. Revoke and
configuration changes remain fail-closed, both verified live in this
turn's real Preview evidence (§5 above). The historical-link owner
lookup added in Phase 5F has zero code-path overlap with any of this --
it is a separate, owner-authenticated, read-only endpoint that never
touches session/grant/public authorization state.

## 12. Final owner communication contract (V1, confirmed)

**Client**: top-level messages only, optional display name,
chronological public history, no threading UI, no realtime, no read
receipts. **Owner**: chronological history (both directions), unread =
`author_type='client' AND status='new'`, Reply to client messages while
communication is viable (suppressed only on revoked-history), explicit
reviewed/resolved/dismissed status actions (owner-private, never
public), revoked history remains readable, communication stays
structurally separate from Project Timeline throughout. No automatic
project/task mutation exists anywhere in Phase 5.

## 13. Temporary diagnostic / debug audit

Every Phase 5F runtime file (`client-communication-history-modal.tsx`,
`share-link-client.ts`, `share-link-panel.tsx`,
`use-share-link-history.ts`, `share-contracts.ts`,
`share-messages-repository.server.ts`,
`app/api/share-links/history-link/route.ts`) was scanned for
`console.log`, hardcoded fixture/project ids, `TODO`/`FIXME`/`XXX`, and
`debugger` statements -- **none found**. No temporary browser-acceptance
scaffolding, diagnostic-only UI, or hypothesis-as-fact comments remain
in application code. Existing structured diagnostics retained from
earlier phases (e.g. `logShareRouteError`'s fixed-stage-tag console
logging) were left exactly as they already were -- not Phase 5F debug
code, not touched.

## 14. Final test / verification counts (all actually executed this turn)

- Full Client Share + analytics regression sweep (`lib/share`,
  `app/api/share`, `app/api/share-links`, every share-link dashboard
  component, `app/share`, the Phase 5A migration test,
  `lib/analytics`, `app/components/analytics`), run together:
  **58 test files, 2039 tests, all passing.**
- `tsc --noEmit`: clean.
- `eslint` on every file touched across Phase 5F: **0 errors**; 3
  pre-existing `no-unused-vars` warnings on intentionally-unused
  fake-client mock parameters (same accepted convention throughout
  this feature).
- `git diff --check`: clean (only expected LF→CRLF line-ending
  notices).
- `npm run build`: succeeded; every Phase 5 route (public and owner,
  including `/api/share-links/history-link`) registered correctly.

This sweep covers, by file, every item the closure test matrix
requested: Phase 5A migration source tests, share-messages repository
tests (including `resolveMostRecentShareLink`), public message
validation, public GET/POST message routes, owner GET/reply/status
routes, the history-link route and resolver, public Messages UI, the
owner Communication modal (including historical/revoked mode), the
three Phase 5 hooks (`useOwnerShareMessages`, `usePublicShareMessages`,
`useShareLinkHistory`), `ShareLinkPanel` (stale-badge regression,
revoked-historical entry, no-history case, active-link-wins,
loading/race cases), session/grant tests, `configuration_version`
invalidation, PIN, revoke, expiry/disable, rate-limit, public
projection/privacy, analytics isolation, security headers, the Phase 6
aggregate boundary, and the full Phase 1-4 Client Share regression --
all green in the one sweep above (no test in any of these categories
was skipped or is failing).

## 15. Production rollout prerequisites — PLAN ONLY, not executed

**Known fact**: Production does not yet have
`202608190001_client_share_message_owner_rpcs.sql` applied. Every other
Client Share migration was already live in Production before this
Phase 5 engagement began (the feature has been in active Production use
since Phase 4's own closure) -- but this document cannot independently
re-confirm that from the repository alone, and does not assume it
without a check.

**Every Client Share migration, in chronological order** (for
reference -- all except the last are believed already Production-applied
from prior phases, not re-verified this turn):
1. `202608030003_client_share_owner_foundation.sql`
2. `202608030004_client_share_session_foundation.sql`
3. `202608030005_client_share_integrity_and_security.sql`
4. `202608050001_client_share_owner_reads.sql`
5. `202608060001_client_share_lifecycle_operations.sql`
6. `202608060002_client_share_access_operations.sql`
7. `202608060003_client_share_configuration_save.sql`
8. `202608110001_client_share_publication_intent.sql`
9. `202608110002_client_share_management_mapping_metadata.sql`
10. `202608130001_client_share_rate_limit_increment.sql`
11. **`202608190001_client_share_message_owner_rpcs.sql`** -- confirmed
    NOT yet applied to Production. This is the ONE migration Phase 5
    requires that Production does not yet have.

**Why the release order matters**: Phase 5C's owner reply/status routes
(`POST/PATCH /api/share-links/[id]/messages/**`) call
`send_share_message_reply`/`set_share_message_status` directly. If the
Phase 5 application code were deployed to Production before
`202608190001` is applied, those two owner actions would fail (the RPC
would not exist) -- safely, as a generic `500 INTERNAL_ERROR` (the
existing `mapReplyRpcError`/`mapStatusRpcError` fail closed on any
unrecognized Postgres error, never a raw crash), but visibly broken to
any owner who tries to reply or change a message's status. Public
message send/view (Phase 5B/5C) would work fine even in that
misordered state, since they depend only on the pre-existing Phase 1A
`service_role` grant, not on the new migration. The correct order
nonetheless applies the migration first, so no owner-facing capability
is ever partially broken, even briefly.

**This document cannot establish Production's exact current migration
state without querying Production, which this turn explicitly must
not do.** The recommended, read-only first step of the actual future
rollout (not executed now, not scheduled, just documented) is:

> Run a read-only migration-status check against Production (e.g.
> `supabase migration list --linked` against the Production project, or
> an equivalent read-only query of Supabase's own migration-history
> table) to confirm exactly which of the 11 migrations above are
> already applied, before applying anything.

**Expected high-level rollout sequence** (plan only):
1. Final Phase 5 commit (this turn's reviewed diff, once approved).
2. Push branch/history.
3. Read-only Production migration-status check (above).
4. Apply only the migration(s) the check reveals are actually missing
   -- expected to be exactly `202608190001`, but confirm rather than
   assume.
5. Verify the new RPCs (`send_share_message_reply`,
   `set_share_message_status`) exist and have the expected grants in
   Production.
6. Confirm required existing Client Share Production ENV values are
   already present (no new ENV variable was introduced by Phase 5 at
   any point).
7. Deploy Production.
8. If a feature flag / staged-rollout convention is already
   established for this repository, keep Client Share communication
   gated behind it initially, exactly as that existing convention
   already dictates -- this document does not invent a new flag.
9. Owner-only smoke checks on a real (non-disposable) Production
   project: open Share panel, confirm Client messages entry/badge
   behave correctly, confirm no error for a project with no share
   history.
10. Enable/release according to whatever staged-rollout plan already
    governs this repository's other recent feature launches.

## 16. Known out-of-scope item (unchanged, not touched this turn)

Owner resource upload UI claims support for roughly 10 MB, but a real
~9.5 MiB upload through the current Vercel inbound route produced
`FUNCTION_PAYLOAD_TOO_LARGE` in earlier testing. This is unrelated to
Client Share communication and is not a Phase 5 blocker. Recorded here
only as a separate, later platform/product issue -- not addressed in
Phase 5G.

## 17. Disposable environment — final state (left untouched this turn)

- The Phase 5A migration (`202608190001`) is applied there.
- Real communication rows exist (client messages, an owner reply, and
  the final mixed-status pair used to disprove the false
  status-isolation suspicion in §4).
- Share link `39e539e1-598f-4df8-ac2f-a20f55e65e45` is revoked and
  intentionally left that way -- its original public URL is
  confirmed unavailable; its owner-side history remains fully
  accessible via the fix in §3.
- No SQL was executed, and no fixture data was created, modified, or
  deleted by this turn. If cleanup of the disposable fixture is ever
  wanted, that should be its own separate, explicitly-requested step --
  not bundled into any future rollout turn.

## 18. Final working-tree state (see exact command output below)

Nothing was staged, committed, or pushed this turn. `git status
--short` / `git diff --check` at the end of this turn are reproduced
verbatim in the final chat response, not restated here.

---

# PHASE 5 STATUS:
COMPLETE / PASS

# PHASE 6 READINESS:
READY
