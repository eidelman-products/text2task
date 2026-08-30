# Text2Task SEO Master Blueprint

**Permanent Source of Truth — SEO Architecture, Keyword Ownership, Cannibalization Rules, and Implementation Priorities**

- Document created: 2026-08-29
- Status: Living document — update in place as new research or implementation occurs
- Scope: www.text2task.com public marketing surface (Homepage, Solutions, Features, Resources, Use Cases)
- Companion file: `Text2Task_SEO_Master_Blueprint_2026-08-29.docx` (the formatted, distributable version — this Markdown file is the editable source)

### Research sources informing this document

- Google Search Console (GSC) — impressions, average position, query-level signal
- Google Ads Keyword Planner — United States / English database, avg. monthly searches, competition, bid ranges
- Semrush — keyword volume, keyword difficulty (KD), CPC
- Live SERP / search-intent analysis
- Direct repository and page-architecture audit (titles, H1s, metadata, schema, internal links, sitemap)

### How to use this document

This file is self-contained and does not assume access to prior chat history. Read **Section 10** first if you only need to know where to resume work; if you're resuming the Client Project Tracker phase specifically, **Section 11** has the full implementation spec. Sections 1–9 are the full reference: positioning, completed technical work, keyword ownership, the Client Share decision, cannibalization rules, linking architecture, implementation history, priorities, and an explicit do-not-create list.

---

## 1. Product SEO Positioning

**Core positioning workflow** (the closed loop this architecture is built around):

Incoming client communication and requests → structured projects/tasks → organized project workflow → deadlines / resources / updates → client feedback / messages → selected progress shared back to the client.

**Key differentiation rule:** Text2Task must NOT be positioned primarily as another generic project-management platform. Its strongest SEO and product story is turning incoming client communication into structured work, then managing that work through the full client lifecycle — including sharing selected progress back out. This closed-loop story is what differentiates it from broad PM tools (Asana/Monday-class competitors), and every architecture decision in this document defers to it.

**Secondary areas** (real, but not the core story):

- Screenshots → tasks
- AI task extraction (generic text engine)
- Client feedback / revisions
- Deadlines / calendar
- Client sharing (Client Share / future Client Project Tracker)

---

## 2. Technical SEO Work Completed

All items below are **COMPLETE**. Do not repeat this work unless new evidence proves a regression.

### 2.1 SoftwareApplication structured-data cleanup — `[COMPLETE]`

Commit `41a320a` — "Fix structured data architecture for SEO pages" (2026-08-26)

- Removed the homepage's own invalid SoftwareApplication entity (it had no aggregateRating/review data and would remain factually incomplete if kept).
- Removed the duplicated, invalid SoftwareApplication object that the shared Use Case template embedded on all 12 Use Case pages (via the WebPage.about field).
- Removed 7 dangling `{"@id": ...}` references to the now-undeclared SoftwareApplication entity, across the Solutions page, 4 Feature pages, and the About page.
- Removed the now-fully-unused `SITE_SCHEMA_ENTITY_IDS.softwareApplication` constant from `app/lib/schema.ts`.
- No fake ratings, reviews, or aggregateRating values were fabricated at any point — the decision was to remove the claim entirely rather than invent supporting data.
- Valid Organization, WebSite, WebPage, and BreadcrumbList schema were preserved and confirmed intact on every affected page.
- Regression tests added: `app/page.test.ts`, `app/components/use-cases/use-case-detail-page.test.tsx`, `app/lib/schema-dangling-entity-references.test.ts`.
- `npx tsc --noEmit` and `npm run build` both passed clean at the time of this fix.

### 2.2 Legacy /index.html redirect — `[COMPLETE]`

Commit `e327a0c` — "Redirect legacy index.html to homepage" (2026-08-26)

- Root cause: Google Search Console reported a 404 for `http://www.text2task.com/index.html` — a legacy path with zero internal references anywhere in the codebase (no link, sitemap entry, or canonical pointed to it).
- Fix: a single `redirects()` rule in `next.config.ts` — the first and only redirect rule in the project (no `middleware.ts`, no `vercel.json` redirect rules exist).
- Behavior: `/index.html` → 308 permanent redirect → `/` (single hop, no chain).
- Host/protocol normalization (non-www → www, HTTP → HTTPS) is handled entirely by Vercel's own domain configuration, outside this repository — untouched and unrelated to this fix.
- Production verification (reported by the user): `/index.html` → 308 → `/`; homepage → 200; an unrelated unknown URL correctly remains 404; Google Search Console validation was started.
- Regression test added: `next.config.test.ts`.

### 2.3 Sitemap / indexing — `[COMPLETE / MONITORED]`

No dedicated commit — existing infrastructure, status as reported.

- `app/sitemap.ts` is a deterministic, code-driven sitemap covering the homepage, all Use Cases (via `getAllUseCases()`), all Resources, the one Solution, and all Features, with sensible per-route priority/changeFrequency values.
- Reported as valid and successfully processed by Google.
- 9 previously discovered-but-not-indexed URLs were manually live-tested in Search Console and indexing was requested (per user report).
- Per user report, the crawled-not-indexed set found at that time was mostly static assets plus canonical/non-www crawl artifacts, not content-quality problems — noted here as reported context, not independently re-verified this session.

### 2.4 Client Share factual-accuracy correction — `[COMPLETE]`

Commit `0d0f99a` — "Update client sharing product limitation" (2026-08-27)

- Page: `/solutions/freelancer-project-management-software`
- Problem: the "Not intended to replace" list publicly claimed Text2Task does not provide "A shared client portal" — this became factually inaccurate once the Client Share feature shipped (it now provides exactly a shared, owner-controlled client view).
- Fix: replaced with "A full client account system" — a limitation that remains genuinely true, since Client Share is link-based and anonymous (no client user account or login is ever created).
- No other copy, title, H1, meta, or canonical on the page was touched.

### 2.5 Freelancer Solution secondary-keyword reinforcement (P0 content phase) — `[COMPLETE]`

Commit `0c67460` — "Strengthen freelancer solution SEO positioning" (2026-08-29)

- Page: `/solutions/freelancer-project-management-software` (only file changed).
- Two sentence-level edits, no H1/title/meta/canonical/schema/CTA change:
  - Intake section: "...Without a simple project request management process, the useful details are often spread across paragraphs and follow-up messages..." — reinforces **project request management** as a secondary cluster.
  - "Built for client work" section: "Text2Task is client project management software for freelancers who need to keep client requests, tasks, and follow-ups organized..." — reinforces **client project management software** as a secondary cluster while keeping "for freelancers" in the same sentence.
- Primary page identity (title, H1, meta description) remains "freelancer project management software" — unchanged.
- Verified: targeted ESLint clean, `npx tsc --noEmit` clean, `npm run build` clean (90/90 static pages), `git diff --check` clean.

---

## 3. Master Keyword-to-Page Map

Search-evidence values are quoted exactly as validated in Google Search Console / Google Ads Keyword Planner / Semrush research to date. Where no reportable volume was found, this is stated explicitly rather than omitted — absence of data is itself a decision input, not a gap to fill with assumption. This section is split into three logical sub-tables (3A/3B/3C) — matching the layout used in the companion DOCX for landscape-page readability — purely for readability; every cluster, keyword, metric, and decision from the original master map is preserved unchanged.

### 3A. Core commercial / informational clusters

The anchor Solution page and its two core commercial/informational supporting clusters (Email, Freelancer PM, Messages).

| Cluster | Primary Keyword | Secondary | Search Evidence | Intent | Current Owner | Type | Confidence | Cannib. Risk | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|
| Email — Informational | turn emails into tasks | convert email to task; create task from email; create a task from an email | Semrush: vol. 30, KD 18%, CPC $9.50. GSC currently ranks this page for this exact phrase. | Informational / how-to | `/resources/how-to-turn-emails-into-tasks` | Resource | High | None | Validated / stable | Keep as-is |
| Email — Commercial | email to task | email task management; email to task app | Keyword Planner: ~50/mo, Low competition, meaningful commercial bid range. | Commercial, tool-specific | `/features/email-to-tasks` | Feature | High | None (H1 differentiation completed 2026-08-30 — §12) | Validated / stable / H1 differentiated | Complete — see §12 |
| Freelancer Project Management | freelancer project management software | — | Established primary page identity; not independently re-quantified this round. | Commercial, category/end-to-end | `/solutions/freelancer-project-management-software` | Solution | High | None (this is the anchor page) | Validated / stable / reinforced | Keep as primary; do not reposition |
| Client Project Management (secondary) | client project management software | client project management tool; client and project management software; best client project management software; customer project management software | Keyword Planner: ~500/mo, Low competition (idx 8). Do NOT sum the 3 close-500 variants as 1,500 — they share substantial overlap. | Commercial, broad category | `/solutions/freelancer-project-management-software` (secondary) | Solution (secondary) | Medium-High | High if forked into a new page | Reinforced 2026-08-29 (commit 0c67460) | No new page. Monitor. |
| Project Request Management (secondary) | project request management software | project request management; project request software; request management software | Keyword Planner: ~50/mo, Low competition. | Commercial, narrow (intake step) | `/solutions/freelancer-project-management-software` (secondary) | Solution (secondary) | Medium | High if forked into a new page | Reinforced 2026-08-29 (commit 0c67460) | No new page. Monitor. |
| Messages → Tasks | turn client messages into tasks | turn messages into tasks automatically | Semrush: ~20/mo (automatically variant). Homepage doubles as the de facto commercial anchor for this cluster. | Informational + light commercial | `/resources/turn-client-messages-into-tasks` | Resource | Medium | None | Validated / stable | Keep as-is |

### 3B. Feature / supporting clusters

Narrower, capability-specific clusters, including the not-yet-built Client Project Tracker.

| Cluster | Primary Keyword | Secondary | Search Evidence | Intent | Current Owner | Type | Confidence | Cannib. Risk | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|
| Client Project Tracker / Client Share | client project tracker | share project progress with client; project updates for clients; client project updates; client update link; project share link; project status for clients (none independently validated for volume) | Keyword Planner: ~50/mo, Medium competition (idx 57), CPC $21.42–$54.75. | Commercial, narrow (outbound client visibility) | Future: `/features/client-project-tracker` | Feature (future) | Medium | Low vs. most pages; Medium vs. Client Feedback to Tasks (direction overlap) | Decision made: YES, justified. NOT YET implemented. | P1 — build after this document's Section 10 spec |
| AI Task Extraction | ai task extractor | task extractor; extract action items from text; extract tasks from text | Weak/no non-brand GSC signal currently. | Commercial, generic engine (hub, not a channel) | `/features/ai-task-extractor` | Feature | Low | Low (soft overlap: "client messages" language shared with Messages cluster) | Needs differentiation | P3: sharpen copy away from "client messages" phrasing |
| Screenshot → Tasks | screenshot to tasks / turn screenshots into tasks | project screenshot | GSC: "project screenshot" → Resource, 1 impression, avg. position ~35. No assumed primary from route name. | Commercial + informational | `/features/screenshot-to-tasks` + `/resources/how-to-turn-screenshots-into-tasks` | Feature + Resource | Low-Medium | None | Validated pattern, weak signal | Keep as-is |
| Client Feedback / Revisions | client feedback to tasks | manage client revisions | Secondary priority per original research scope. | Commercial + informational, INBOUND (client → owner) | `/features/client-feedback-to-tasks` + `/resources/how-to-turn-client-feedback-into-tasks` | Feature + Resource | Low-Medium | Medium vs. future Client Project Tracker (direction confusion risk) | Keep as-is; secondary positioning | P2: direction-explicit cross-linking once Tracker exists |

### 3C. Use Case / overlap clusters

Audience-segmented pages, including the one unresolved overlap flagged for future differentiation.

| Cluster | Primary Keyword | Secondary | Search Evidence | Intent | Current Owner | Type | Confidence | Cannib. Risk | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|
| Use Case — WordPress | (audience-specific, no forced primary) | wordpress related tasks; wordpress tasks | GSC: "wordpress related tasks" ~7 impr./pos. ~77; "wordpress tasks" ~5 impr./pos. ~66.6 — page-only, no cannibalization observed. | Audience fit | `/use-cases/wordpress-freelancers` | Use Case | Low (thin but clean) | None | Validated, no conflict | Keep as-is |
| Use Case — Web Designers vs. Revisions Resource | (audience-specific) | web designers; manage client revisions | GSC: manage-client-revisions-web-designers ~16 impr., avg. pos. ~15.2 (queries hidden). Use Case is mostly branded traffic. | Audience fit vs. informational how-to — same audience+problem combo | `/use-cases/web-designers` AND `/resources/manage-client-revisions-web-designers` | Use Case + Resource | Low | Medium-High — audited, fix mapped, not yet implemented | Audited 2026-08-30 — see §13 | Implement per §13 blueprint (pending explicit approval) |

---

## 4. Client Share / Client Project Tracker — Architecture Decision

Client Share is a shipped, real production capability. This section is the authoritative product-truth reference for any future copy about it.

### 4.1 What Client Share actually is

- One project-specific, external, owner-created share link.
- The owner controls exactly what is visible — nothing is shared by default.
- Can include: selected status / target date, selected tasks, selected resources, selected updates, progress where applicable.
- Optional PIN protection.
- Optional expiration / access controls (disable, re-enable, revoke, rotate).
- Optional client comments/messages, which can feed back into the owner's workflow.
- Private/internal project information always remains separate from what the client can see.

### 4.2 What Client Share is NOT — must never be claimed

> **Do not claim any of the following:**
> - A full client account system (already corrected once — see §2.4; do not reintroduce this claim in any new form)
> - A persistent, multi-project client login
> - A self-service, account-based client dashboard
> - A generic CRM / chat / support communication platform

### 4.3 Future Feature page specification (NOT built yet)

- **Candidate route:** `/features/client-project-tracker`
- **Type:** Feature (not Solution — this is a specific capability, not a category claim)
- **Primary keyword:** client project tracker
- **Supporting language** (NOT independently validated for volume — use as natural supporting copy only, never document as validated primary keywords): share project progress with client; project updates for clients; client project updates; client update link; project share link; project status for clients.
- **Exact distinct user intent:** "I want my client to see current status/progress/selected tasks/resources on this one project, without giving them a full account, and without me manually re-sending updates."

**What this page must NOT claim:**

- Full client accounts/login
- A persistent multi-project client dashboard
- Client-side task editing/assignment/management (the client views and may comment — they do not manage tasks)
- Real-time sync guarantees beyond what is true
- Any fabricated rating, review, or testimonial
- "Portal" language implying account-based access

---

## 5. Cannibalization Rules

Permanent rules. Any future page or content addition must be checked against these before implementation.

1. **Email Feature vs. Email Resource** — Commercial (`/features/email-to-tasks`) vs. informational (`/resources/how-to-turn-emails-into-tasks`). This is the healthy reference model. Do not merge.
2. **Freelancer Solution vs. Client Project Management** — The existing Solution page owns both intents. Do NOT create `/solutions/client-project-management-software`.
3. **Freelancer Solution vs. Project Request Management** — The existing Solution page owns this as a secondary phrase. Do NOT create `/solutions/project-request-management-software`.
4. **Client Project Tracker vs. Client Feedback to Tasks** — Tracker = outbound (owner → client). Feedback = inbound (client → owner). Both share "client"/"update" vocabulary — future copy on BOTH pages must be direction-explicit, not just implicitly separated.
5. **Client Project Tracker vs. Freelancer Solution** — Feature = narrow, specific capability. Solution = complete workflow/category. Low risk if kept at these two distinct layers — Solution may briefly mention and link out; Feature owns the deep content.
6. **Use Cases** — Audience-segmented intent, not category intent. Must support Features/Solutions via linking — never target the same primary keyword as a Feature or Solution page.
7. **Web Designers overlap — unresolved** — `/use-cases/web-designers` vs. `/resources/manage-client-revisions-web-designers` both target "web designers" + "revisions." Medium-High risk, documented as future work — not resolved in this document.

---

## 6. Internal Linking Architecture

**Intended hierarchy:** Homepage → Solutions → Features → Resources → Use Cases (contextual cross-links flow in both directions once established; this is the primary discovery hierarchy, not a strict one-way funnel).

### 6.1 Known current gaps

- Homepage currently has weak contextual deep-page linking — no body-content link into any Solution or Feature page (footer-only).
- `/features/project-deadline-calendar` has weaker persistent site-wide navigation than its sibling Features (missing from the footer nav).
- Email Feature ↔ Email Resource bidirectional linking is the proven, preferred model — genuinely working today and should be the template for future clusters.

### 6.2 Future Client Project Tracker relationships (not implemented)

- Homepage → Tracker: one contextual mention in an existing benefits/how-it-works section.
- Freelancer Solution ↔ Tracker: reciprocal links — Solution mentions sharing briefly and links out; Tracker links back to "see the full freelancer workflow."
- Client Feedback ↔ Tracker: direction-explicit anchors on both sides (e.g. "share progress back with your client" / "turn a client's reply into tasks").
- Email / Messages Resources → Tracker: optional, lower priority — a soft "what happens next" mention.
- Relevant Use Cases (project-managers, small-agencies, virtual-assistants) → Tracker: only where each Use Case's existing copy genuinely supports it — checked per page, never forced.
- No keyword-stuffed anchors in any of the above — natural anchor concepts only.

---

## 7. Implementation History

| Date | Commit | Description | Status |
|---|---|---|---|
| 2026-08-26 | `41a320a` | Fix structured data architecture for SEO pages (SoftwareApplication removal + dangling @id cleanup, 13 files) | COMPLETE |
| 2026-08-26 | `e327a0c` | Redirect legacy index.html to homepage (next.config.ts redirects()) | COMPLETE |
| 2026-08-27 | `0d0f99a` | Update client sharing product limitation ("shared client portal" → "full client account system") | COMPLETE |
| 2026-08-29 | `0c67460` | Strengthen freelancer solution SEO positioning (client project management + project request management secondary reinforcement) | COMPLETE |

Only commit hashes directly confirmed via `git log` are listed above. No hash is invented for any change not independently verified in this repository's history.

---

## 8. Current Priorities

**P0 — COMPLETE**
- Technical SEO cleanup (structured data, redirect) — §2.1, §2.2
- Factual Client Share limitation correction — §2.4
- Freelancer Solution secondary-cluster reinforcement — §2.5

**P1 — NEXT**
- Build `/features/client-project-tracker` (full spec in §4.3 and §10).
- Add contextual homepage/solution linking to the new Feature — as part of the same controlled phase, or immediately following.

**P1 / P2**
- Email Feature H1 commercial-framing differentiation. [COMPLETE 2026-08-30 — see §12]
- General internal-linking improvements identified in §6.1. [Substantially addressed by P1A+P1B — see §11.20]

**P2**
- Client Project Tracker ↔ Client Feedback to Tasks direction-explicit cross-links.
- Web Designers Use Case vs. Revisions Resource differentiation pass (§5, rule 7). [MAPPED, NOT IMPLEMENTED 2026-08-30 — see §13]
- `/features/project-deadline-calendar` footer/navigation reinforcement.

**P3**
- AI Task Extractor copy differentiation (away from "client messages" phrasing).
- Periodic GSC / Keyword Planner re-validation of all clusters in §3, especially thin-evidence ones.
- Lower-priority Use Case optimizations.

---

## 9. Do Not Create / Do Not Do

> **Do NOT create these pages right now:**
> - `/solutions/client-project-management-software` — would cannibalize the existing Freelancer Solution page (§5, rule 2)
> - `/solutions/project-request-management-software` — would cannibalize the existing Freelancer Solution page (§5, rule 3)
> - Do not create `/features/client-project-tracker` outside of a deliberate, scoped implementation phase (see §10 for the required prep steps)

> **Permanent rules — apply to all future SEO work:**
> - Do not create multiple pages targeting close keyword variants of the same query.
> - Do not delete any Use Case page.
> - Do not call Client Share a full account-based portal, or any equivalent overstated claim (§4.2).
> - Do not fabricate ratings, reviews, or aggregateRating schema.
> - Do not keyword-stuff — natural, user-first copy always wins over exact-match density.
> - Do not change a working URL, route, canonical, or title merely to chase a keyword.
> - Do not repeat completed technical SEO work (§2) unless new evidence proves an actual regression.

---

## 10. Current Stop Point / Next Phase

**Status update (2026-08-30, P2 Web Designers audit pass):** P1A **COMPLETE**. P1B **COMPLETE**. P1C **COMPLETE**. Email Feature H1 commercial-framing differentiation **COMPLETE**. P2 Web Designers vs. Revisions Resource differentiation: **MAPPED, NOT IMPLEMENTED** (§13) — audit and implementation blueprint only, no production code changed. Client Project Tracker is fully built, integrated, and discoverable (§11.17–§11.20). The Email Feature's H1 no longer echoes the Resource's informational phrasing (§12). Nothing was staged, committed, pushed, or deployed as part of any of these phases — the working tree changes are ready for review.

> **NEXT PLANNED PHASE: implement the §13 Web Designers blueprint, OR the other unstarted P2 item — neither authorized to start automatically**
> - **Option A:** Implement §13.10's blueprint (title/H1/description refinement on `app/lib/use-cases/cases/web-designers.ts` only) — requires its own explicit instruction to begin; exact final copy is not yet decided (§13.12).
> - **Option B:** `/features/project-deadline-calendar` footer/navigation reinforcement — remains unstarted AND unaudited; would need its own audit turn first.
> - **Status:** NEITHER started. This document does not authorize beginning either on its own.

**Before starting the next phase, the next session must:**

1. Re-read §11.17–§11.20 and §12 to confirm Client Project Tracker and the Email Feature H1 work are both fully finished — neither should be revisited without new evidence.
2. Re-read §13 in full (especially §13.10's blueprint and §13.12's unresolved items) before implementing the Web Designers differentiation — final title/H1/description copy still needs to be proposed and approved, it was not finalized in the audit.
3. Wait for an explicit instruction identifying which next item to work on; do not assume either, and do not begin without direction.
4. Follow this project's established discipline: audit first, propose, wait for approval, then implement in a narrow, single-purpose diff.
5. Run the same full verification ritual used for every phase so far: `npx tsc --noEmit`, `npm run build`, targeted tests, `git diff --check`.

**The next Claude session should begin exactly here — Section 10 — after first re-reading §11.17–§11.20 and §12 to confirm what is already finished, then §13 in full before implementing the Web Designers differentiation — which requires its own explicit instruction to begin.**

---

## 11. P1 Client Project Tracker — Pre-Implementation Mapping

Completed 2026-08-29 (P1 mapping/audit-only phase; no production code was changed). This section is the authoritative, self-contained implementation spec for P1A — a future session should be able to implement from this section alone, without chat history. Findings below are grounded in a direct repository audit (Feature-page source files, Client Share production code and tests, `app/sitemap.ts`, navigation/footer components) performed on this date.

### 11.1 Chosen reference architecture

- All 5 existing Feature pages share the same core rhythm: hero → problem → how-it-works → capability checklist → trust/control section → audience grid → related-links grid → FAQ → final CTA, each with 3 JsonLd renders (WebPage, 2-level BreadcrumbList, FAQPage) and identical metadata/OG/Twitter shape.
- 4 of 5 pages (ai-task-extractor, screenshot-to-tasks, client-feedback-to-tasks, and structurally email-to-tasks) share `app/features/feature-page.module.css` plus one small page-local module for a single page-specific visual/example section. `project-deadline-calendar` is the outlier (no problem section, no related-links section, missing from the footer) and is already flagged in §6.1/§8 as a gap to fix, not a pattern to copy.
- **Decision:** use `ai-task-extractor` / `screenshot-to-tasks` as the primary structural and CSS reference (shared module + one local `page.module.css` for a page-specific preview section, standard section rhythm, 2-level breadcrumb). Client Project Tracker's "preview" section should borrow the before/after comparison concept used by ai-task-extractor (pasted text → draft) and screenshot-to-tasks (screenshot → tasks), generalized as "your private workspace" vs. "what your client sees."
- `client-feedback-to-tasks`'s unique 3-level breadcrumb (with an intermediate "Features" crumb) is treated as an undocumented anomaly, not a standard to propagate — Tracker uses the 2-level pattern shared by the other 4 pages.

### 11.2 Verified Client Share capability matrix

Condensed from a full source-code and test audit. Full behavioral detail lives in the implementation session's own working notes; this table carries only the decision-relevant facts and the exact safe/unsafe claim boundary.

| Capability | Implemented? | Safe public claim | Avoid claiming | Key files |
|---|---|---|---|---|
| Share link creation | YES | Create a private link to share one project | A public/discoverable project page | `share-public-id.server.ts` |
| Owner-controlled visibility | YES — opt-in, closed by default | Choose exactly what's visible before sharing | Everything in the project is shared automatically | `share-link-configuration-editor.tsx` |
| Status & target date | YES — opt-in, mapped vocabulary | Show project status and target date, if you choose to | Real-time internal status tracking | `client-share-projection.server.ts` |
| Tasks | YES — individually curated | Show selected tasks to your client | Client can manage, edit, or reassign tasks | `client-share-projection.server.ts` |
| Resources | YES — individually curated, no raw storage path | Share selected files and links with your client | Client has access to your file storage | `share-file-ref.server.ts` |
| Updates / progress | YES — owner-authored, versioned | Post a progress update your client will see | Automatic real-time progress sync | `client-share-projection.server.ts` |
| PIN protection | YES — hashed, recovery-safe | Protect a shared link with an optional PIN | Secure client account login | `share-pin.server.ts` |
| Expiration | YES — live-enforced on every request | Set a link to expire automatically | A time-limited client account | `share-session-grant.server.ts` |
| Disable / Re-enable / Revoke / Rotate | YES — 4 distinct owner actions | Turn access off, back on, or permanently revoke it | An access-history or audit log visible to the client | `share-link-channels.tsx` |
| Client comments | YES — opt-in, structurally separate from project data | Let your client leave a comment on the shared view | A live chat or messaging platform | `share-message-conversion.server.ts` |
| Privacy boundary | YES — strict allowlist schema, page is noindex | Everything else in your project stays private | (this is itself the safe claim — no unsafe variant) | `client-share-projection-contracts.ts` |
| Client account / login | NO — confirmed absent | No account or login required for your client | "Client account", "client login", "client dashboard" | `share-browser-session.server.ts` |

### 11.3 Search-intent boundary

Confirmed: the locked primary keyword remains **client project tracker** — YES, no repository evidence contradicts it. Exact intent (unchanged from §4.3): "I want my client to see current status/progress/selected tasks/resources on this one project, without giving them a full account, and without me manually re-sending updates."

| Adjacent intent | Overlap | Why Tracker stays distinct | Language to avoid |
|---|---|---|---|
| freelancer project management software | Both freelancer-oriented | PM software = owner's internal workflow across many projects. Tracker = one project's outbound client-facing visibility. | Calling Tracker a PM tool or implying multi-project management |
| client project management software | Shares "client" + "project" words | That phrase is a broad owner-side category already owned by the Freelancer Solution as secondary (§5, rule 2). Tracker is one narrow capability. | Using this phrase as Tracker's title/H1 |
| project request management software | Adjacent workflow stage | Intake-focused (before work starts) vs. Tracker's post-intake, ongoing outbound sharing. | Blending intake language into Tracker copy |
| client feedback to tasks | Both "client" + workflow concepts | Feedback = inbound (client to owner). Tracker = outbound (owner to client). Direction-explicit per Cannibalization Rule 4. | Framing Tracker as primarily a feedback-collection tool |
| project status tracking (generic) | Literal "status"/"tracking" words | Tracker is specifically about sharing status with a client via a link, not a generic internal Kanban/status tool. | Writing as if this is a generic internal tracking feature |
| client portal / project management client portal | Adjacent competitor framing | No account/login exists — see §11.6 for the full language matrix. | "Client portal" as primary positive framing |
| client communication software | Comments capability exists | Messaging is a secondary, opt-in feature of one link, not a communication platform. | Positioning Tracker as a chat/CRM tool |
| generic project management software | Shares "project management" words | Narrow capability, not a category claim (§5). | Broad category framing anywhere on the page |

### 11.4 Terminology decision

- Internal/product feature name: "Client Share" (dashboard UI: `ShareLinkConfigurationEditor`, `ShareLinkPanel`). SEO search concept: "Client Project Tracker" (validated keyword, not an official in-app feature name).
- Precedent already exists in this codebase for this split: `project-deadline-calendar`'s public page/URL uses the SEO-friendly name while its own hero eyebrow and breadcrumb say "Work Calendar" internally.
- Page title and H1: lead with the "Client Project Tracker" / "share project progress" concept, paraphrased naturally (matching how the other 4 pages paraphrase rather than exact-match their keyword in the H1).
- Body copy: name the real in-app feature ("Client Share") at least once where describing the concrete workflow, so a user can find it after logging in — do not hide it.
- "Client Project Tracker" must be treated strictly as the page's SEO/category framing (title, H1, URL) — never inserted into the dashboard UI or used elsewhere as if it were an official product name.

### 11.5 Page content blueprint

- **SEO title:** Client Project Tracker: Share Project Progress With Clients
- **Meta description:** Create a link to share selected project status, tasks, and updates with a client. Choose what's visible, protect it with a PIN, and keep the rest private.
- **Canonical:** `/features/client-project-tracker`
- **H1:** Share project status and progress with your client.
- **Hero support line:** Create one link that shows exactly what you choose — selected tasks, updates, and status — while everything else in your workspace stays private.
- **Primary CTA:** "Try Text2Task free" → `/signup` (majority CTA copy, 3 of 5 sibling pages).
- **Secondary CTA:** Hero: in-page anchor to the how-it-works section. Final CTA: cross-link to `/features/client-feedback-to-tasks` (the direction-paired sibling), e.g. "See Client Feedback to Tasks."

| Section | Purpose | Key content |
|---|---|---|
| 1. Preview (hero-adjacent) | Show the product truth before any text | Two-panel comparison: your private workspace vs. what your client sees. Realistic placeholder data only, never a real screenshot with real customer data. |
| 2. The problem | Why owners need this vs. manual updates | Clients want visibility; ad hoc screenshots/emails don't scale. No competitor disparagement. |
| 3. How it works (#how-it-works) | Concrete workflow, 3-4 steps | Create a link → choose what's visible → optional PIN/expiry → client opens the link, no account needed. |
| 4. What you control | Capability checklist | Status & date, tasks, resources, updates, PIN, expiration, disable/re-enable, revoke/rotate — grounded in §11.2. |
| 5. Keep the rest private | Trust section; operationalizes §4.2 | Explicitly state what's never shared: internal notes, raw storage paths, other projects, budget/priority fields, client contact info, no login/account. |
| 6. Client comments (optional) | Opt-in messaging capability | Client can comment; owner reviews and may turn it into a task via the normal review flow. Direction-explicit link to Client Feedback to Tasks here. |
| 7. Who uses this | Audience fit | Links to Freelancer Solution and relevant Use Cases (see §11.9 for which ones are cleared to link). |
| 8. Related ways to organize client work | Standard related-links grid | Email to Tasks, Client Feedback to Tasks, Freelancer Solution. |
| 9. FAQ | Matches established pattern, 5-6 Q&As | Does the client need an account? What if I disable the link? Can the client edit tasks? Is the file path ever exposed? Can I have more than one link? |
| 10. Final CTA | Standard close | Primary + secondary CTA as specified above. |

### 11.6 Client portal language rules

| Phrase | Rule | Reasoning |
|---|---|---|
| shared client view | SAFE | Accurately describes exactly what it is — an owner-curated view, no account implication. |
| client-facing project page | SAFE | Accurate, plain description. |
| client project tracker | SAFE — as page label only | Fine as the page's SEO/category label; do not imply tracking across multiple projects — it is per-project. |
| project status page | SAFE | Accurate for the status/progress-sharing aspect specifically. |
| private project link | SAFE | Accurate — anonymous, non-indexed, secret-bearing URL (confirmed by noindex + no-store headers). |
| client portal | CONDITIONAL | Usable only in a negation/comparison ("not a full client portal — a single shared link"), never as positive self-description. |
| simple client portal | AVOID | "Simple" doesn't remove the account/login implication most readers attach to "portal." |
| client project portal | AVOID | Same portal-implies-account risk, plus conflates with the Solution-level cannibalization concern (§5, rule 2). |
| project portal for clients | AVOID | Same reasoning as above. |
| project management client portal | AVOID | Compounds two risky phrases. |
| client account / client login / client dashboard / sign in (client-context) | AVOID | No account or login exists anywhere in this feature — confirmed by direct code audit (§11.2). |

### 11.7 Schema plan

- `webPageJsonLd`: WebPage, `@id` via `buildWebPageEntityId(canonicalUrl)`, `isPartOf`/`publisher` as `@id` references to the existing `SITE_SCHEMA_ENTITY_IDS` entries — no `mainEntity`, matching the established post-cleanup pattern (§2.1).
- `breadcrumbJsonLd`: 2-level, Home → Client Project Tracker, via `buildBreadcrumbListJsonLd` — matches 4 of 5 sibling pages.
- `faqJsonLd`: FAQPage, matching the established pattern exactly.
- No SoftwareApplication — no new factual evidence (aggregateRating/review) exists; none is added.
- No new schema type is introduced (e.g. Service/WebApplication were considered and rejected — the ~50/mo keyword volume does not justify the added validation surface of an unprecedented schema type on this site).
- No dangling `@id` references — follows the identical construction pattern as the other 5 Feature pages, which is already covered by `app/lib/schema-dangling-entity-references.test.ts` (to be extended, see §11.12).

### 11.8 Sitemap plan

- Add one entry to `featureRoutes` in `app/sitemap.ts`: `{ path: "/features/client-project-tracker", priority: 0.84, changeFrequency: "monthly" as const }` — identical values to all 5 existing Feature routes.
- No other `sitemap.ts` behavior needs to change — the existing `features.map()` logic generically handles any new `featureRoutes` entry.

### 11.9 Internal linking plan

| Source | Location | Priority | Anchor concept |
|---|---|---|---|
| Client Feedback to Tasks | relatedLinks grid (existing array) | Required — Cannibalization Rule 4 | Direction-explicit: "See how shared progress differs from client feedback" |
| Footer (`landing-footer.tsx` `productLinks`) | New array entry | Required — matches 4-of-5 baseline convention | "Client project tracker" |
| Freelancer Solution | End of "Built for client work" section | Recommended — §6.2 reciprocal link; needs its own explicit approval given this file's edit history | "...if you also want to share selected progress with a client, see Client Project Tracker." |
| Homepage (`homepage-post-extraction-section.tsx`) | Capability list (1 of 5 Features currently present) | Recommended, defer to P1B | "Share progress with your client" |
| Email to Tasks / Messages Resource | relatedLinks / body mention | Optional, lower priority per §6.2 | "What happens next" soft mention |
| project-managers / small-agencies / virtual-assistants Use Cases | Not yet located | **DO NOT LINK FROM THESE PAGES YET** | Pending a dedicated per-page copy audit — not performed this turn, per §6.2's "checked per page, never forced" rule |

Outbound links FROM Client Project Tracker: Freelancer Solution (up), Client Feedback to Tasks (sibling, direction-explicit), Email to Tasks (sibling, optional), `/use-cases` hub link (matches sibling convention), `/signup`.

### 11.10 Navigation / discovery decision

- Header nav: NO change — zero of the 5 existing Feature pages appear in header nav (Features nav item points to the homepage `#features` anchor, not individual pages).
- Footer: REQUIRED — 4 of 5 existing Feature pages are in `productLinks`; only `project-deadline-calendar` is missing, and that is already a flagged gap (§6.1, §8 P2), not a pattern to repeat.
- Homepage capability card: Recommended, not required (only 1 of 5 existing pages has one) — defer to P1B.
- No dedicated "features directory" hub page exists anywhere in the codebase — sitemap + footer are the correct baseline discovery surfaces.

### 11.11 Visual asset plan

- 3 of 5 sibling pages use a real product screenshot; 2 of 5 use a styled HTML/CSS "worked example" mockup instead. Both are established, valid patterns.
- Preview section (§11.5, section 1): recommend a styled mockup (like ai-task-extractor's worked-example pattern) rather than a literal screenshot, for full control over demo data and to eliminate any risk of a real customer's data appearing.
- How-it-works section: a real screenshot of the `ShareLinkConfigurationEditor` toggle UI would be authentic and valuable, but requires a seeded demo dataset — not a production screenshot. Defer to P1C.
- Must exclude from any screenshot: real project/client names, real PINs, real share URLs/secrets, any other tenant's data.
- No new marketing screenshot is required to ship P1A — the mockup/text sections can carry the page initially.

### 11.12 Test plan

- No per-Feature-page test file exists today for any of the 5 sibling pages — the only current Feature-page test coverage is `app/lib/schema-dangling-entity-references.test.ts`, which asserts `webPageJsonLd` shape across all 5 pages plus Solutions and About.
- MODIFY `app/lib/schema-dangling-entity-references.test.ts` — add the new page's `webPageJsonLd` export to the existing `describe.each` list. Required; protects the project's most hard-won invariant.
- CREATE `app/features/client-project-tracker/page.test.tsx` — new, because this page introduces a real invariant no sibling has: the forbidden-claims boundary from §4.2/§11.6. Recommended assertions: canonical metadata check; a product-truth/forbidden-claims check that the rendered page text does NOT contain phrases like "client account", "client login", "client dashboard", "full client portal" (matched against rendered copy, not code comments, to avoid false positives); 2-level breadcrumb shape.
- Do not add brittle tests that merely duplicate all visible copy — matches this project's established testing philosophy.
- Internal-link presence: not recommended as a dedicated test (would duplicate copy); verify manually/at build time instead.

### 11.13 File-by-file implementation map (P1A scope)

| File | Action | Reason |
|---|---|---|
| `app/features/client-project-tracker/page.tsx` | CREATE | The new page itself. |
| `app/features/client-project-tracker/page.module.css` | CREATE | Local styles for the page-specific preview section, mirroring the ai-task-extractor/screenshot-to-tasks pattern. |
| `app/features/client-project-tracker/page.test.tsx` | CREATE | Metadata + product-truth/forbidden-claims regression coverage (§11.12). |
| `app/sitemap.ts` | MODIFY | One new `featureRoutes` entry (§11.8). |
| `app/components/landing/landing-footer.tsx` | MODIFY | One new `productLinks` entry — required baseline discovery (§11.10). |
| `app/lib/schema-dangling-entity-references.test.ts` | MODIFY | Extend `describe.each` to cover the new page (§11.12). |
| `app/features/client-feedback-to-tasks/page.tsx` | MODIFY | One new relatedLinks entry, direction-explicit — required by Cannibalization Rule 4. |
| `app/lib/schema.ts` | UNCHANGED | Existing `buildWebPageEntityId`/`buildBreadcrumbListJsonLd`/`SITE_SCHEMA_ENTITY_IDS` are sufficient as-is. |
| `app/components/JsonLd.tsx` | UNCHANGED | No change needed. |
| `app/components/landing/landing-header.tsx` | UNCHANGED | Zero precedent for individual Feature links in header nav. |
| `app/solutions/freelancer-project-management-software/page.tsx` | UNCHANGED in P1A | Reciprocal link deferred to P1B — this file has already been edited under narrow, explicitly-scoped instructions 3 times this session; a future edit needs its own explicit approval. |
| `app/components/landing/homepage-post-extraction-section.tsx` | UNCHANGED in P1A | Homepage card is Recommended, not Required; deferred to P1B. |
| All 12 Use Case pages | UNCHANGED | DO NOT LINK FROM THESE PAGES YET — pending a dedicated per-page copy audit (§11.9). |
| Any Client Share dashboard component or migration | UNCHANGED | This phase is public-marketing-page-only; the feature itself is already complete. |

### 11.14 Implementation phasing

- **P1A — Core page:** the CREATE/MODIFY file set in §11.13 exactly. Smallest complete, coherent, shippable, fully tested and discoverable unit, with zero orphaned-schema risk and zero cannibalization risk.
- **P1B — Broader internal linking / discovery:** Freelancer Solution reciprocal link (needs its own approval), homepage capability card, the deferred Use Case audit and any resulting links, optional Email/Messages cross-links.
- **P1C — Visual enhancement:** real product screenshots (`ShareLinkConfigurationEditor`, the public share view) once a safe demo dataset exists, replacing or supplementing the initial mockup.
- This mirrors the project's established pattern throughout this session: small, single-purpose, explicitly-approved diffs rather than one large batch.

### 11.15 Unresolved questions / blockers

- No contradiction was found between repository evidence and any locked master-blueprint decision — nothing required stopping mid-audit to report.
- project-managers, small-agencies, and virtual-assistants Use Case pages were NOT independently audited this turn for a natural Tracker-link insertion point — explicitly deferred to P1B, not guessed at.
- No demo/seed dataset currently exists for producing safe, non-sensitive product screenshots — needs a decision before P1C.
- `client-feedback-to-tasks`'s 3-level-breadcrumb anomaly and the unresolved Web Designers/Revisions Resource overlap (§5, rule 7) are pre-existing issues, unrelated to this phase, and were not touched.

### 11.16 Exact next action

> **Next action (superseded — see §11.17):** This action item ("implement P1A") was completed on 2026-08-29. §11.1 through §11.16 above are preserved unchanged as decision history — the plan they describe is exactly what was built. §11.17 records the implementation result.

### 11.17 P1A implementation status (2026-08-29) — COMPLETE

P1A shipped exactly as scoped in §11.1–§11.13, with the deviations disclosed below. Nothing was staged, committed, pushed, or deployed — this record describes a reviewed, verified, uncommitted working-tree change set.

**Route created:** `/features/client-project-tracker` — confirmed present in the production build's static output (○ prerendered).

| File | Action | Result |
|---|---|---|
| `app/features/client-project-tracker/page.tsx` | CREATE | New Feature page — hero, preview comparison, problem, how-it-works, capability checklist, privacy trust section, opt-in comments section, audience note, related links, FAQ, final CTA. |
| `app/features/client-project-tracker/page.module.css` | CREATE | Local styles for the private-workspace vs. shared-view preview comparison. |
| `app/features/client-project-tracker/page.test.tsx` | CREATE | 13 tests: metadata/canonical, H1 intent, forbidden-claims boundary, required internal link, FAQ/schema parity, WebPage/Breadcrumb/FAQPage schema correctness, no SoftwareApplication/aggregateRating. |
| `app/sitemap.ts` | MODIFY | One new `featureRoutes` entry, values identical to all 5 sibling Feature routes (priority 0.84, monthly). |
| `app/lib/schema-dangling-entity-references.test.ts` | MODIFY | New page's `webPageJsonLd` added to the existing `describe.each` list. |
| `app/features/client-feedback-to-tasks/page.tsx` | MODIFY | One new relatedLinks entry, direction-explicit ("Share selected project status and progress back with your client") — satisfies Cannibalization Rule 4. |
| `app/components/landing/landing-footer.tsx` | MODIFY | One new `productLinks` entry — matches the 4-of-5 baseline convention identified in §11.10. |

No other file was touched. `app/solutions/freelancer-project-management-software/page.tsx`, `homepage-post-extraction-section.tsx`, `landing-header.tsx`, `app/lib/schema.ts`, `app/components/JsonLd.tsx`, all 12 Use Case pages, and every Client Share dashboard/migration file remain exactly as specified **UNCHANGED** in §11.13.

**Metadata implemented:**
- Title: "Client Project Tracker: Share Project Progress With Clients" — matches §11.5 exactly.
- Description: matches §11.5 exactly.
- Canonical: `/features/client-project-tracker`.
- H1: "Share project status and progress with your client." — matches §11.5 exactly.
- OpenGraph/Twitter: title/description implemented; image intentionally omitted (see Deviations below).

**Schema implemented:**
- WebPage (`@id` via `buildWebPageEntityId`, `isPartOf`/`publisher` as `@id` references, no `mainEntity`) — matches §11.7 exactly.
- BreadcrumbList — 2-level, Home → Client Project Tracker — matches §11.7 exactly.
- FAQPage — 6 questions, JSON-LD count verified equal to visible FAQ count by an automated test.
- No SoftwareApplication, no aggregateRating/review, no dangling `@id` references — verified by both the extended shared test suite and the new page's own test file.

**Client Share claims used (verified against §11.2 capability matrix):**
- "No Text2Task account is required" for the client — matches the audited "Client account/login: NO, confirmed absent" row (wording refined 2026-08-29, see §11.18 — the original "no account, login, or sign-in required" phrasing risked implying a PIN-protected link needs no access step at all).
- "Choose exactly what's visible... status, target date, selected tasks, resources, and updates" — matches the audited opt-in-visibility rows.
- "Add a PIN" / "expire automatically" / "disable, re-enable, revoke, or generate a new link" — matches the audited PIN, expiration, and lifecycle-action rows ("rotate" was rendered in plain language as "generate a new link" for a public audience).
- "Internal notes, priority, budget, other projects, and your raw files stay private" — matches the audited privacy-boundary row exactly.
- "Your client can leave a comment... nothing is added to the project automatically" — matches the audited opt-in-comments row, including the explicit-owner-action requirement before anything reaches the project.
- No sentence on the page claims anything broader than a row in §11.2 — each was checked individually before finalizing copy, per this phase's explicit verification requirement.

**Tests and verification results:**
- Targeted tests (new + modified files): 134 tests passed across 5 test files.
- Full project test suite: 5,048 tests passed across 182 test files — zero regressions from the footer/relatedLinks/sitemap/schema-test edits.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; `/features/client-project-tracker` confirmed present in the route output as a statically prerendered page.
- `git diff --check`: clean (only harmless LF/CRLF line-ending notices, no whitespace errors).
- Full diff reviewed line by line — confirmed to touch only the 4 modified files' intended single insertions, plus the 3 new files.

**Deviations from the original §11.1–§11.13 mapping, and why:**
- OpenGraph/Twitter image omitted (not specified either way in §11.5). Reusing an existing sibling page's screenshot would misrepresent this specific feature, and no new screenshot was permitted in P1A (§11.11). The root layout has no site-wide default image either, so this degrades gracefully rather than showing a broken or misleading image. Revisit in P1C once an authentic Client Share screenshot exists.
- "Who this helps" implemented as a single prose paragraph with one inline link to the Freelancer Solution, rather than the multi-card audienceGrid pattern every sibling page uses. This is a deliberate, disclosed deviation: an audienceGrid on this page would need Use Case links, and §11.9/§11.15 explicitly deferred that audit to P1B ("DO NOT LINK FROM THESE PAGES YET") — a one-card grid would look visually broken, so a short paragraph was used instead, per this phase's explicit instruction not to force identical section counts.
- Two-column preview comparison (private workspace vs. what the client sees) instead of client-feedback-to-tasks' three-column layout — matches ai-task-extractor/screenshot-to-tasks' simpler before/after pattern, appropriate to Tracker's simpler one-step comparison.
- No other deviations. Route, primary keyword, terminology split (Client Project Tracker as SEO framing, Client Share named explicitly in body copy), portal-language rules, schema graph, sitemap values, and the two P1A-required internal links all match §11.1–§11.13 exactly.

**Remaining P1B work (not started):**
- Freelancer Solution reciprocal link — needs its own explicit approval (this file has now been edited 4 times this project under narrow scope each time).
- Homepage capability-card entry in `homepage-post-extraction-section.tsx`.
- Per-page copy audit of project-managers, small-agencies, and virtual-assistants Use Cases, and any resulting links.
- Optional Email to Tasks / Messages Resource cross-links.

**Remaining P1C work (not started):**
- A real Client Share screenshot (ShareLinkConfigurationEditor and/or the public share view) captured from a safe demo/seed dataset — no real customer or tenant data.
- An OpenGraph/Twitter image for the page once that screenshot exists.

### 11.18 Post-P1A copy refinement (2026-08-29, same day)

Six narrow, product-truth-motivated copy edits were made to the shipped page after initial review. No layout, metadata, H1, route, schema, sitemap, or link was touched.

| Location | Old | New | Reason |
|---|---|---|---|
| How-it-works step 1 | "Generate a private link for one project directly from Text2Task." | "Generate a project share link directly from Text2Task." | Plainer phrasing. |
| How-it-works step 4 | "Your client opens it directly. No account or sign-in is required." | "Your client opens it directly. No Text2Task account is required." | Precision — avoids implying a PIN-protected link needs no access step. |
| Capability checklist | "Selected tasks, grouped as in progress, waiting on feedback, or completed" | "Selected tasks and their shared status" | The specific 3-way grouping is not a guaranteed implementation contract; do not assert it publicly. |
| Never-shared checklist | Two items: raw files/folders; client account/login | One item: "Resources you haven't chosen to share" | The no-account point doesn't belong in a list of private workspace data; it's covered elsewhere. |
| FAQ — account question | "No. Your client opens the link directly. There's no account, login, or sign-in required." | "No. Your client opens the link directly without a Text2Task account. If you protect the link with a PIN, they'll enter that PIN before viewing it." | Same PIN-access-step precision fix, applied to the FAQ answer. |
| Problem section closing line | "...That's why Text2Task includes a simple client project tracker built into every project." | "...That's why Text2Task gives you a simple client-facing project view you can share directly from a project." | Keeps "Client Project Tracker" as SEO/category framing rather than an implied official feature name (§11.4); removes the unnecessary absolute "every project" claim. |

- `app/features/client-project-tracker/page.test.tsx`: one assertion updated to match the new safe phrasing (the old regex checked for "login"/"sign-in" wording that no longer exists in the copy) — the underlying invariant (no Text2Task account required) is unchanged.
- Verification re-run after this pass: targeted tests (69 passed, 2 files), `npx tsc --noEmit` clean, `npm run build` succeeded with `/features/client-project-tracker` still statically prerendered, `git diff --check` clean.

### 11.19 P1C — Client Project Tracker Visual Integration (2026-08-29) — COMPLETE

Two real Client Share marketing visuals were relocated to the correct asset directory and integrated into the P1A page. No SEO copy, H1, metadata title/description, schema, sitemap entry, or P1A internal link was changed beyond what P1C itself required (the OG/Twitter image re-evaluation).

**Asset discovery and relocation:**
- Two newly added PNGs were found misplaced under `app/features/project-deadline-calendar/`'s sibling asset folder, both untracked in git (never previously referenced by any code — confirmed by a repo-wide search before moving).
- Original filenames/location: `public/landing/features/project-deadline-calendar/"Client project tracker showing how project progress is shared with a client.png"` (1672×941) and `.../"Text2Task Client Share controls for managing a shared project link.png"` (1448×1086).
- Confirmed distinct from, and did not disturb, the existing legitimate tracked asset in that folder: `text2task-project-deadline-calendar.png`.
- Moved (not copied, not re-encoded — byte sizes and pixel dimensions confirmed identical before/after) into the new directory `public/landing/features/client-project-tracker/`, renamed to:
  - `client-project-tracker-share-progress-with-clients.png` (primary, wide, 1672×941)
  - `client-share-project-link-management.png` (secondary, 1448×1086)
- Verified afterward: the old `project-deadline-calendar` folder contains only its own legitimate asset; the new folder contains exactly the two relocated files.

**Visual integration:**
- Primary image (the 3-step "Configure sharing → Manage link & access → Client sees a clean overview" workflow graphic) placed immediately after the Hero, **replacing** the CSS-generated "Your workspace (private) / What your client sees" comparison section.
- Reason for replacing rather than keeping both: the new image tells a more complete and credible product story (it also shows PIN/expiry/rotate/revoke controls the CSS mockup didn't), and keeping both would have been a redundant demonstration of the same idea immediately after the Hero.
- All CSS selectors that became unused as a result (`previewSection`, `previewGrid`, `previewColumn`, `previewPrivatePanel`, `previewSharedPanel`, `previewArrow`, `previewResultRow`, `previewTaskList`, `previewNotShared`, `previewNote`, and their one media-query block) were removed from `page.module.css`. No other selector or shared stylesheet was touched.
- Secondary image (the more editorial, annotated "You control what's shared" collage) placed after the "What you control" capability checklist and before "Keep the rest private" — it visually reinforces exactly that checklist's PIN/expiry/disable/revoke/rotate items, and sits with a full section of separation from the primary image on both sides, avoiding placing the two images too close together.
- Both images use next/image with the `fill` strategy inside an aspect-ratio-locked container (`aspect-ratio: 1672/941` and `1448/1086` respectively) plus a `sizes` attribute — matching the established sibling convention (screenshot-to-tasks, project-deadline-calendar). A restrained card treatment (subtle border, border-radius, soft shadow, near-white background) was added around each frame, since — unlike the raw UI screenshots those siblings use — these two images already carry their own marketing typography and did not need additional decoration, only a clean frame.
- No essential product-truth or SEO copy was moved into either image — every claim the images illustrate is already present as real HTML text elsewhere on the page (per this phase's explicit accessibility requirement).

**Alt text (exact, as required):**
- Primary: "Client project tracker showing how project progress is shared with a client"
- Secondary: "Text2Task Client Share controls for managing a shared project link"

**Loading / priority decision:** Neither image uses `priority`. Reasoning: real mobile viewport QA (390×844) showed the Hero content alone (eyebrow, H1, lead paragraph, two stacked CTA buttons, note) nearly fills the initial viewport, so the primary image is not reliably above the fold on the most important breakpoint for this phase. Using `priority` on an image that may render below the fold would preload roughly 1.1 MB ahead of genuinely critical resources without a guaranteed LCP benefit — this follows the explicit instruction not to blindly apply priority. Both images use normal lazy loading, matching screenshot-to-tasks' sibling precedent (which also omits `priority` on its hero-adjacent image).

**OpenGraph / Twitter metadata — re-evaluated:**
- P1A intentionally omitted a social-preview image because no accurate visual existed yet (§11.17). Now that the primary asset exists, `openGraph.images` and `twitter.images` were both added, using the primary wide asset only — no new image was created.
- `openGraph.images`: the primary asset with explicit width 1672 / height 941 and the primary alt text, matching the exact pattern already used by `email-to-tasks/page.tsx` for its own OG image.
- `twitter.card` was upgraded from `"summary"` (P1A, no image) to `"summary_large_image"` (matching every other Feature page's convention now that a real image backs it), with the same primary asset.
- The focused metadata test was updated accordingly (see Tests below).

**Desktop visual QA (1440×900, real headless-browser rendering):**
- Rendered via a real Chromium browser (Playwright, installed in an isolated scratchpad location — not added to the project's own dependencies) against the local dev server, not merely inspected as static code.
- Both images render crisp and undistorted at their card widths (1180px primary, 760px secondary); the restrained frame (border/radius/shadow) reads as an intentional design choice consistent with the rest of the site, not a raw pasted screenshot.
- Section rhythm, spacing, Hero-to-primary-image transition, How it works, What you control, secondary image, privacy section, comments section, related links, FAQ, final CTA, and footer (showing the new "Client project tracker" link) all inspected directly — no visual compromise found.

**Mobile visual QA (~390px, real headless-browser rendering):**
- Confirmed no horizontal overflow: `document.documentElement.scrollWidth === clientWidth === 390` at the 390×844 viewport.
- Both images render full-width and responsively with their natural aspect ratio preserved — no cropping, matching the explicit instruction not to crop away UI when the image becomes small on mobile.
- The Hero is not overwhelmed by the primary image (it doesn't appear until after a full scroll past the Hero), and the secondary image does not create an oversized dead zone — its height scales naturally with the section's normal rhythm.
- Section spacing, FAQ, and final CTA are unaffected.
- **Honest finding:** the small in-image UI-mockup text (checkbox labels, button captions) inside both graphics is genuinely hard to read at 390px width — this is an inherent characteristic of rendering these particular wide, detail-rich marketing graphics responsively without cropping, which this phase explicitly required rather than inventing a separate mobile asset. Every claim those images illustrate remains available as legible real HTML text elsewhere on the page, so no essential information is lost — only supplementary visual detail is harder to make out at a glance on the smallest breakpoint.

**Exact production files changed:**
- `app/features/client-project-tracker/page.tsx` — image imports/constants added, metadata OG/Twitter images added, CSS-mockup section replaced with the primary image, secondary image section inserted.
- `app/features/client-project-tracker/page.module.css` — obsolete preview-comparison selectors removed; new `primaryShowcase*`/`secondaryDetail*` selectors added.
- `app/features/client-project-tracker/page.test.tsx` — new "P1C visuals" describe block (5 tests: primary image path+alt, secondary image path+alt, no accidental duplicate of either image, OpenGraph image, Twitter card/image).
- `public/landing/features/client-project-tracker/` (new directory) — the two relocated, renamed image assets.
- No other file was touched. P1A's four modified files (`sitemap.ts`, `schema-dangling-entity-references.test.ts`, `client-feedback-to-tasks/page.tsx`, `landing-footer.tsx`) are unchanged by this phase.

**Tests and verification results:**
- `app/features/client-project-tracker/page.test.tsx`: 17 tests passed (13 from P1A/P1A-refinement, 5 new for P1C).
- Full project test suite: 5,053 tests passed across 182 test files — zero regressions.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; `/features/client-project-tracker` confirmed present in the route output as a statically prerendered page.
- `git diff --check`: clean (only harmless LF/CRLF line-ending notices).
- Full diff reviewed line by line — confirmed to touch only the intended files; the four P1A files show no unexpected changes.

### 11.20 P1B — Client Project Tracker Internal Linking / Discovery (2026-08-30) — COMPLETE

Every candidate page named in §11.9 was re-inspected by reading its actual current content before any edit — the deferred Use Case and Email/Messages decisions were not assumed from the P1 mapping, they were independently re-verified against live copy. Two links were implemented; all other candidates were left untouched with a recorded reason. Direction discipline was maintained throughout: Client Project Tracker (owner → client, outbound) was never blurred with Client Feedback to Tasks (client → owner, inbound).

**Candidate audit table:**

| Candidate | Decision | Reason |
|---|---|---|
| Homepage (homepage-post-extraction-section.tsx) | LINK | The "Everything you need after the first request" capability list already had a matching entry for outbound calendar sharing (project-deadline-calendar); it was missing the closing-the-loop capability entirely. |
| Freelancer Solution (reciprocal) | LINK | The existing "Explore Text2Task features" link grid already lists all other Feature pages by the same card pattern; Tracker was the one sibling Feature missing from it. |
| Use Case — project-managers | DO NOT LINK | Its clientUpdates section is entirely inbound (comparing a new stakeholder message against the saved project); no sentence anywhere on the page discusses sharing status back out. |
| Use Case — small-agencies | DO NOT LINK | Same inbound-only pattern; "client" in this page's copy means the agency's own end client being coordinated internally, not a recipient of an outbound share link. |
| Use Case — virtual-assistants | DO NOT LINK | Page is about a VA organizing their principal's admin requests; the VA is not the one who would share project status externally, and no outbound-sharing language exists on the page. |
| Email to Tasks Feature | DO NOT LINK | Its "Continue organizing client work" related-links section and every FAQ stop at saving the draft; no post-intake/progress-sharing moment exists in the current copy to hook a link onto. |
| Email Resource (how-to-turn-emails-into-tasks) | DO NOT LINK | Article scope ends at "review before saving"; its own Related guides already reach Freelancer Solution, one hop from Tracker. |
| Messages Resource (turn-client-messages-into-tasks) | DO NOT LINK | Same — article scope ends at saving the task; forcing a link would distort its intake-focused intent. |

**Exact links implemented:**
- Homepage → Tracker: new capability list entry in `app/components/landing/homepage-post-extraction-section.tsx`. Title "Share progress with your client"; description "Share selected status, tasks, and updates through a private link — nothing else in your workspace is shown."; link label "Explore Client Project Tracker" → `/features/client-project-tracker`.
- Freelancer Solution → Tracker: new card in the existing "Explore Text2Task features" link grid (`featureLinks` array) in `app/solutions/freelancer-project-management-software/page.tsx`. Title "Client Project Tracker"; description "Share selected project progress with your client through a private link." → `/features/client-project-tracker`.

**Navigation / footer:**
- NO CHANGE. Tracker was already added to the footer in P1A (§11.10/§11.13); this phase did not duplicate it.
- Header nav: no individual Feature links exist for ANY Feature page (Features nav item points to the homepage `#features` anchor); no change made or needed.
- No dedicated Feature-directory route exists anywhere in the codebase; none was created.

**Tracker outbound links:**
- NO CHANGE TO THE TRACKER PAGE ITSELF. Its existing outbound set (Client Feedback to Tasks, Email to Tasks, Freelancer Solution — all shipped in P1A) was reviewed and judged already sufficient; the already-approved Feature page was not reopened.

**Anchor language used:**
- Both new links use natural, non-repetitive concepts ("share progress with your client" / "share selected project progress with your client through a private link") rather than the bare exact-match phrase "client project tracker" repeated across pages — matching the anchor-text rules in this phase's own instructions.
- The literal phrase "client project tracker" appears exactly once in each modified page's own main content (verified by an automated test on the Freelancer Solution page; the site-wide footer's separate P1A occurrence is excluded from that count).

**Exact production files changed:**
- `app/components/landing/homepage-post-extraction-section.tsx` — one new `capabilities` array entry.
- `app/solutions/freelancer-project-management-software/page.tsx` — one new `featureLinks` array entry.
- `app/components/landing/homepage-post-extraction-section.test.tsx` — NEW. First test file for this component; 2 tests (new Tracker link present; existing Work Calendar link untouched).
- `app/solutions/freelancer-project-management-software/page.test.tsx` — NEW. First test file for this page; 4 tests (new Tracker link present; canonical/title identity unchanged; H1 still leads with the locked primary keyword; no keyword-stuffing of "client project tracker" within the page's own main content).
- No other file was touched. The Tracker page itself, all Use Case pages, all Email/Messages pages, navigation, and the footer are unchanged by this phase.

**Cannibalization / SEO QA:**

| Check | Result |
|---|---|
| H1 changed on any modified page? | NO |
| Metadata (title/description/canonical) changed on any modified page? | NO |
| Primary keyword ownership changed? | NO — verified by an automated test that the Freelancer Solution H1 still leads with "freelancer project management software" |
| "client project tracker" unnecessarily repeated? | NO — appears once per modified page's own content, in natural non-exact-match anchor contexts elsewhere |
| Freelancer Solution still clearly owns broad freelancer/client project management? | YES — untouched hero/positioning/FAQ; only one link card added to an existing grid |
| Tracker still clearly owns the narrow outbound client-visibility capability? | YES — Tracker page itself was not modified in this phase |
| Any Use Case started targeting a Feature keyword? | NO — all three Use Cases were left unmodified |
| Email/Message pages retained their original intent? | YES — all three were left unmodified |

**Tests and verification results:**
- Targeted tests: 71 passed across 4 files (2 new files + `schema-dangling-entity-references.test.ts` + `app/page.test.ts`, re-run as a sanity check since the homepage tree was touched).
- Full project test suite: 5,059 tests passed across 184 test files — zero regressions.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; both `/features/client-project-tracker` and `/solutions/freelancer-project-management-software` confirmed present in the route output as statically prerendered pages.
- `git diff --check`: clean (one harmless LF/CRLF line-ending notice).
- Full diff reviewed line by line — exactly two production files changed, one array entry each; no unrelated code touched.

**Remaining work after P1B:**
- P1A, P1B, and P1C are all now COMPLETE for Client Project Tracker. No further Tracker-specific linking work is planned or recommended — the deferred Use Case and Email/Messages candidates were evaluated on their merits and genuinely do not warrant a link with the content as it exists today; revisit only if/when those pages' own copy changes to include an outbound-sharing narrative.
- Note for roadmap accuracy (§8): the P2 item "Client Project Tracker ↔ Client Feedback to Tasks direction-explicit cross-links" was already satisfied by P1A's relatedLinks addition on `client-feedback-to-tasks/page.tsx` — it does not require separate P1B/future work.
- Per §8's existing priority order, the next unstarted item in the P1/P2 tier is: Email Feature H1 commercial-framing differentiation (§3, Email — Commercial cluster's own recorded next action: "tighten H1 toward commercial framing"). General internal-linking improvements (§6.1) are now substantially addressed by the combined P1A+P1B work; any further items there would need their own fresh audit, not an assumption of remaining scope.

---

## 12. Email Feature H1 Commercial-Framing Differentiation (2026-08-30) — COMPLETE

This is a separate roadmap item from Client Project Tracker (Section 11) — the next unstarted P1/P2-tier item per §8's existing priority order, not reordered or invented. Scope: a single H1 refinement on `/features/email-to-tasks`, resolving the low-grade cannibalization risk §3A had flagged against `/resources/how-to-turn-emails-into-tasks`. No route, canonical, schema, sitemap, FAQ, CTA, or Resource content was touched.

### 12.1 Audit — both pages, as found

| Field | Feature (`/features/email-to-tasks`) | Resource (`/resources/how-to-turn-emails-into-tasks`) |
|---|---|---|
| Title | Email to Tasks: Turn Emails Into Projects | How to Turn Emails Into Tasks: A Practical Workflow |
| Meta description | Paste an email into Text2Task to extract a reviewable project, tasks, deadlines, priorities, budget details, and client information before saving. | Learn a practical workflow for turning client emails into organized tasks, deadlines, priorities, and a reviewable project before saving. |
| H1 (before) | Turn emails into organized projects and tasks. | How to turn emails into tasks without losing project context (unchanged) |
| Primary CTA | "Start for free" → /signup | "Explore Email to Tasks" → /features/email-to-tasks |
| Schema | WebPage + 2-level BreadcrumbList + FAQPage | Article (buildArticleJsonLd) + 3-level BreadcrumbList (Home / Resources / article) |
| Intent signal | Commercial/tool: capability checklist, "How it works" steps, FAQ about the tool itself | Informational/how-to: worked example, 5-step manual workflow, "Common mistakes" section |

- Internal links between the two pages were already bidirectional before this phase: Feature → Resource via its relatedLinks card ("How to turn emails into tasks"); Resource → Feature via an inline sentence in its "How Text2Task supports this workflow" section ("turn selected email text into a reviewable project and task draft").
- No test file existed for either page before this phase.
- Repeated phrase: the Feature's old H1 ("Turn emails into organized projects and tasks") and the Resource's H1/primary keyword ("how to turn emails into tasks" / "turn emails into tasks") shared the same "turn emails into tasks" construction — the exact overlap §3A had already flagged as a low cannibalization risk.

### 12.2 Cannibalization analysis

- Is the Feature's H1 too close to the Resource's informational intent? **YES** — both led with the identical "turn emails into tasks" construction, which is also the Resource's own validated informational keyword and the phrase GSC already ranks the Resource for.
- Does the current Feature title already provide enough commercial differentiation? **YES** — "Email to Tasks: Turn Emails Into Projects" already leads with the product name and is distinct from the Resource's "How to Turn Emails Into Tasks" title. No title change was needed.
- Does the H1 itself need changing? **YES** — it was the one element still echoing the Resource's phrasing.
- Would changing the H1 risk weakening a useful phrase already supported by GSC? **NO** — the GSC ranking cited in this project's research is for the Resource page's "turn emails into tasks" query, not for any Feature-page ranking tied to the old H1 string. No evidence exists that the Feature's exact old H1 wording itself was driving any tracked ranking.
- Can the commercial distinction be improved with a narrow H1 refinement rather than broader copy changes? **YES** — confirmed and implemented as the only change (§12.3).
- Is any metadata change actually needed? **NO** — title/description/canonical/OG/Twitter already commercially differentiate the page adequately; none was changed, per this phase's default expectation.

### 12.3 H1 decision

- **Old H1:** "Turn emails into organized projects and tasks."
- **Final H1:** "Paste an email. Get an organized project and tasks."

- Structurally breaks the "Turn emails into tasks" pattern entirely (rather than a word-swap within the same construction), which is what actually resolves the overlap with the Resource's H1/keyword — a synonym substitution alone would not have.
- Leads with the real, product-accurate user action ("Paste an email") rather than an instructional "how to" framing, reinforcing commercial/tool intent (describing what the tool does for the user) instead of tutorial intent.
- "Get an organized project and tasks" is outcome-focused, transactional phrasing consistent with the "email to task" commercial cluster's intent, without exact-matching the phrase awkwardly.
- No mailbox/inbox-sync claim: "Paste" is the explicit, correct action — Text2Task does not connect to Gmail/Outlook or monitor an inbox (confirmed against the page's own existing "No inbox connection" / "Your inbox stays separate" copy, which was not touched and remains accurate alongside the new H1).
- Reads naturally to a US audience (short action → outcome pattern, a common and effective SaaS landing-page convention) rather than a keyword-first construction.

### 12.4 Implementation

- Single line changed: the `<h1>` text in `app/features/email-to-tasks/page.tsx`. No hero-support copy, section, CTA, schema, metadata, canonical, or route was touched.
- The Resource page (`app/resources/how-to-turn-emails-into-tasks/page.tsx`) was not modified — no contradiction was found that would have justified touching it.

### 12.5 Internal-link relationship after the change

- Both existing links (Feature → Resource card; Resource → Feature inline sentence) use descriptive anchor text unrelated to the literal old H1 string, so neither needed updating and neither was touched.
- No duplicate link was added.

### 12.6 SEO QA

| Check | Result |
|---|---|
| Feature H1 is not a near-copy of Resource H1 | CONFIRMED — verified by an automated test |
| Resource left untouched | CONFIRMED — zero lines changed in the Resource page |
| No exact-match keyword stuffing | CONFIRMED — new H1 does not repeat "email to task" verbatim |
| No mailbox-integration overclaim | CONFIRMED — verified by an automated test asserting the absence of sync/connect/monitor phrasing |
| No automatic-ingestion overclaim | CONFIRMED — H1 explicitly says "Paste," matching the page's existing paste-only product truth |
| No broad positioning drift | CONFIRMED — title, hero lead, all H2s, FAQ, and CTA are unchanged |
| No metadata drift | CONFIRMED — title/description/canonical/OG/Twitter unchanged, verified by an automated test |

### 12.7 Exact production files changed

- `app/features/email-to-tasks/page.tsx` — one line (H1 text).
- `app/features/email-to-tasks/page.test.tsx` — NEW. First test file for this page; 5 tests.
- `app/resources/how-to-turn-emails-into-tasks/page.test.tsx` — NEW. First test file for this page; 3 tests (protects that it stays unmodified over time).
- No other file was touched.

### 12.8 Tests and verification results

- Targeted tests: 65 passed across 3 files (2 new files + `schema-dangling-entity-references.test.ts`, re-run since `email-to-tasks/page.tsx` changed).
- Full project test suite: 5,067 tests passed across 186 test files — zero regressions.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; `/features/email-to-tasks` confirmed present in the route output as a statically prerendered page.
- `git diff --check`: clean (one harmless LF/CRLF line-ending notice).
- Full diff reviewed line by line — exactly one line changed in one production file; no unrelated code touched.

### 12.9 Next SEO roadmap item

> **Next action (superseded — see §13):** This pointed at the P2 tier next. Web Designers Use Case vs. Revisions Resource has since been AUDITED and MAPPED in §13 (not yet implemented). `/features/project-deadline-calendar` footer/navigation reinforcement remains unstarted and unaudited.

---

## 13. P2 — Web Designers vs. Revisions Resource Pre-Implementation Audit (2026-08-30)

> **Status: P2 WEB DESIGNERS DIFFERENTIATION — MAPPED, NOT IMPLEMENTED**
> This section is an audit and implementation blueprint only. No production code was changed. Nothing here is authorized to be implemented without a separate, explicit instruction.

### 13.1 Current state — both pages, as found

| Field | Use Case (`/use-cases/web-designers`) | Resource (`/resources/manage-client-revisions-web-designers`) |
|---|---|---|
| Route/file | `app/lib/use-cases/cases/web-designers.ts` (data) rendered via `app/use-cases/[slug]/page.tsx` + the shared `UseCaseDetailPage` template | `app/resources/manage-client-revisions-web-designers/page.tsx` (standalone article) |
| Title (meta) | "Website Revision Task Manager for Web Designers" (`seo.title`) | "How Web Designers Can Manage Client Revisions Faster" |
| Meta description | "Turn client revision emails, WhatsApp messages, and marked-up screenshots into tracked website tasks, organized by page and reviewed before saving." | "Learn how web designers can organize client revision feedback, spot new scope early, and turn feedback into clear, reviewable tasks." |
| Canonical | `/use-cases/web-designers` | `/resources/manage-client-revisions-web-designers` |
| H1 (rendered) | "Stop rebuilding revision emails into task lists. Start tracking each page change." (`hero.title` + `hero.highlight`, editorial variant) | "How Web Designers Can Manage Client Revisions Faster" (H1 = title, standard Resource convention) |
| Hero/lead copy | "Paste a client's revision email, WhatsApp message, or a marked-up screenshot. Text2Task extracts the page or section it affects, the deadline, and whether it looks like a quick fix or bigger scope..." | "Client revision feedback rarely arrives once. A hero headline note today, a photo swap and a deadline change tomorrow, then a marked-up screenshot a day later..." |
| Major sections | signatureModule (revision triage board), transformation (before/after example), painPoints, workflow (3 steps), clientUpdates, faq (4 Qs), capabilities, proof, relatedLinks, related, finalCta | Why revision feedback gets disorganized; One project, three rounds of feedback; Is it a revision or new scope?; A better workflow for revisions; Keeping a record of what changed; Common mistakes; Where Text2Task fits; final CTA |
| CTA | "Try Text2Task" (hero) / "Start free" (final) | "Try Text2Task free" (final only, no hero CTA — standard article shell) |
| Schema | WebPage + BreadcrumbList (Home / Use Cases / page) + FAQPage — shared template, no SoftwareApplication | Article (`buildArticleJsonLd`) + BreadcrumbList (Home / Resources / article) — no FAQPage (no FAQ section) |
| Existing internal links | → Resource via relatedLinks card ("How web designers can manage client revisions faster") | → Use Case via inline link in "Where Text2Task fits" ("web designers use case") |

- No test file exists for either page's specific content. Only the shared, generic `app/components/use-cases/use-case-detail-page.test.tsx` (schema-shape checks, parameterized over all 12 Use Cases) touches `web-designers.ts`, and it asserts nothing about visible copy/H1 text.
- GSC evidence used (nothing beyond what was already observed/recorded is claimed here): Resource ~16 impressions, avg. position ~15.2, exact queries privacy-thresholded/hidden; Use Case traffic in the observed data is mostly branded, with very weak non-brand signal.

### 13.2 Ideal intent of each page

- **Use Case** (`/use-cases/web-designers`) — SHOULD be an audience-segmented page answering "how does Text2Task fit a web designer's overall client-work workflow": turning an initial client request into a project AND tracking revisions/feedback rounds against it — matching how the other 11 Use Cases are structured (revisions/feedback as one workflow moment among several, not the entire page identity).
- **Resource** (`/resources/manage-client-revisions-web-designers`) — SHOULD be, and already is, a single-topic, evergreen how-to article: managing client revisions well as a web designer — round-tracking discipline, revision-vs-new-scope judgment, common mistakes. This does not change.

### 13.3 Overlap matrix

| Element | Use Case wording | Resource wording | Severity | SEO risk | UX risk | Recommended action |
|---|---|---|---|---|---|---|
| Title | "Website Revision Task Manager for Web Designers" | "How Web Designers Can Manage Client Revisions Faster" | HIGH | Both titles center on "revision(s)" + "Web Designers" as the same core topic | Low | Broaden Use Case title beyond revisions |
| H1 | "Stop rebuilding revision emails into task lists..." | "How Web Designers Can Manage Client Revisions Faster" | MEDIUM | Not verbatim, but "revision emails/revisions" is the leading idea on both | Low | Reframe Use Case H1 around the fuller request+revisions workflow |
| Hero/intro | Client revision email/WhatsApp/screenshot arriving, extracted into tasks | Client revision feedback arriving in rounds across channels, described almost identically | HIGH | Near-identical scenario description | Medium — a reader of both would feel deja vu | Rebalance Use Case hero to include first-request intake, not only revisions |
| "Revision(s)" density | Heavy — used throughout hero, painPoints, workflow, capabilities, FAQ, finalCta | Heavy — the article's entire subject | HIGH (combined with title/H1) | Appropriate depth for the Resource; over-weighted for a Use Case that should span broader ground | Low individually | Reduce revisions' share of the Use Case's overall content mix; Resource unchanged |
| Revision-vs-new-scope distinction | FAQ Q1, short answer | Dedicated H2, full explanation | MEDIUM | Same specific concept covered at different depths | Low — Use Case is a pointer, Resource is the depth | No action — this depth split is already healthy |
| Multi-round tracking | clientUpdates section (standard template section on every Use Case) | H2 "Keeping a record of what changed" + a 3-round worked example | MEDIUM | Same underlying concept | Low — clientUpdates is shared template structure, not bespoke to this pair | No action — template-level, not specific to this page pair |
| Screenshot/marked-up feedback | FAQ Q3 + hero mention | One paragraph in "Where Text2Task fits" | LOW | Low | Low | No action |
| Workflow steps | 3 tool-UI steps (capture / check page / save) | 5-step general methodology (separate / keep note / flag / link / mark status) | LOW-MEDIUM | Different granularity and framing (tool steps vs. methodology) | Low | No action — appropriately different |
| Audience references | "Web Designers" only | "Web designers" + WordPress/Webflow freelancers + small agencies | LOW | Low | Low | No action |
| CTA language | "Try Text2Task" / "Start free" | "Try Text2Task free" | LOW | Generic sitewide phrasing | Low | No action |
| Internal anchors | → Resource, descriptive, non-exact-match | → Use Case, descriptive, non-exact-match | N/A (healthy) | N/A | N/A | Keep as-is |

The severity concentration is specific and useful — HIGH-severity items are all in the page's top-level identity layer (title, H1, hero intro), while mid-page and deep sections (workflow steps, FAQ depth, audience references, CTAs, the existing cross-links) are already appropriately differentiated. This significantly narrows the actual fix required.

### 13.4 Cannibalization severity conclusion

- Overall: Medium-High, confirming the master blueprint's existing flag — but concentrated specifically in title, H1, and hero-intro framing, not spread evenly across the whole page.
- Root cause: the Use Case's page identity (title/H1) was authored narrowly around "revisions" specifically, rather than the broader web-designer client-work workflow every other Use Case covers — this is what created the overlap with the Resource, which correctly and deliberately owns the narrow "revisions" topic.
- Supporting evidence the imbalance is real and fixable at the identity layer only: the page's own `listing.title`/`listing.description` (used on the `/use-cases` index grid, not the detail page) are already broader ("Organize website revision requests" / "Turn client website feedback, mobile fixes, copy changes, assets, deadlines, and budgets into reviewable tasks.") than the detail page's own `seo.title`/H1 — the broader framing already exists elsewhere in the same config and simply was not carried into the page's own title/H1.

### 13.5 Permanent intent boundary

1. **What should the Use Case own?** The full web-designer audience-fit story — an initial client request becoming a project, AND revisions/feedback rounds tracked against it. Breadth, matching the other 11 Use Cases.
2. **What should the Resource own?** The single, deep, evergreen "how to manage client revisions" topic — unchanged.
3. **Stronger for "manage client revisions"?** The Resource.
4. **Stronger for "web designer project/task workflow" broadly?** The Use Case, once rebalanced.
5. **Reason to merge/delete/canonicalize?** None found. Default (keep both) holds — the overlap is a one-sided Use Case positioning imbalance, not a true duplicate-intent problem requiring structural change.

### 13.6 Change decision per page

- **Use Case (`/use-cases/web-designers`):** SUBSTANTIVE DIFFERENTIATION — but narrowly scoped to the page's identity layer only (interventions B + E: H1/hero refinement + title/description refinement). Not a full restructuring (F): capabilities, workflow, FAQ, proof, and the existing cross-link are already appropriately scoped and are NOT recommended for change.
- **Resource (`/resources/manage-client-revisions-web-designers`):** NO CHANGE. It already correctly, narrowly, and deeply owns its topic; nothing on it contradicts the intent boundary in §13.5.

### 13.7 Title / H1 / metadata decisions

- Use Case `seo.title`: SHOULD CHANGE. Currently narrows the whole page's identity around "revisions," the same topic the Resource already deeply owns — this is the HIGH-severity item driving the overlap.
- Use Case `seo.description`: LIKELY SHOULD CHANGE, as a secondary/consistency follow-on if the title changes — not required standalone, and not being changed merely because keywords overlap; the reason is that its current lead phrase ("revision emails") is narrower than the page's true intended scope.
- Use Case H1 (`hero.title`/`hero.highlight`): SHOULD CHANGE, for the same reason as the title — this is the page's actual rendered `<h1>`.
- Resource title/description/H1: NO CHANGE on all three — already correctly scoped, no evidence justifies touching them.
- Canonicals, routes, schema types, and the FAQ (Use Case) are NOT recommended for change on either page.

### 13.8 Internal-link relationship

- The current bidirectional relationship is ALREADY the healthy pattern this phase looked for: Use Case → Resource (relatedLinks card, "How web designers can manage client revisions faster") and Resource → Use Case (inline link in "Where Text2Task fits," "web designers use case").
- Recommendation: KEEP AS-IS. Neither anchor text quotes the other page's literal H1, so a future H1/title change to the Use Case will not make either anchor read awkwardly or require an update.
- No new link is recommended in either direction.

### 13.9 Product positioning check

- Risk confirmed: as currently written, the Use Case's title, H1, and hero all lead with "revision(s)" first, before any mention of an initial client request — this is exactly the drift §1/§8 warn against ("ensure the Web Designers Use Case does not make Text2Task sound like a revision-management-only tool").
- None of the other 3 Use Cases audited in P1B (project-managers, small-agencies, virtual-assistants) has this problem — each leads with general request/intake framing, with revision/follow-up handling appearing later as one section (clientUpdates), not as the page's entire identity.
- This is independent, corroborating evidence (beyond pure keyword-overlap reasoning) that the Use Case's identity layer — not the Resource — is what needs to change.

### 13.10 Exact minimal future implementation plan (NOT executed this turn)

| File | Current | Proposed direction (examples only, not final copy) | Why | Cannibalization effect |
|---|---|---|---|---|
| `app/lib/use-cases/cases/web-designers.ts` — `seo.title` | "Website Revision Task Manager for Web Designers" | Broaden beyond revisions, e.g. "Website Project & Revision Tracker for Web Designers" or "Client Project Task Manager for Web Designers" (examples only) | Resolves the HIGH-severity title overlap; matches the page's own broader `listing.title` already in the same file | Directly reduces overlap; Resource remains the clear "manage revisions" claimant |
| same file — `seo.description` | "Turn client revision emails, WhatsApp messages, and marked-up screenshots into tracked website tasks..." | Broaden lead phrase to include an initial request, e.g. "Turn client website requests and revision feedback..." (example only) | Keeps description consistent with a broadened title | Same direction; secondary priority, implement only alongside the title |
| same file — `hero.title` / `hero.highlight` (rendered H1) | "Stop rebuilding revision emails into task lists." / "Start tracking each page change." | Reframe around the fuller request→project→revisions arc, e.g. "Turn client website requests into organized, trackable projects." / "From the first brief to the latest revision." (examples only) | Resolves the MEDIUM-severity H1 overlap and the §13.9 positioning risk | Removes the "revision emails" lead phrase that echoed the Resource |
| same file — `hero.description` | Leads with "a client's revision email, WhatsApp message, or a marked-up screenshot" | Lightly broaden to mention an initial request alongside revisions; keep the existing channel examples (email/WhatsApp/screenshot) | Aligns supporting copy with the new H1 | Reduces the HIGH-severity intro overlap |
| `app/lib/use-cases/cases/web-designers.ts` — capabilities, workflow, FAQ, proof, relatedLinks | As-is | NO CHANGE recommended | Already appropriately scoped/differentiated per §13.3 | None needed |
| `app/resources/manage-client-revisions-web-designers/page.tsx` | As-is (entire file) | NO CHANGE | Already correctly owns its narrow, deep topic; source of the imbalance is one-sided (Use Case only) | None — not the cause |

### 13.11 Test plan (not created this turn)

- Likely new file: a focused test asserting the Use Case's H1 (`hero.title` + `hero.highlight`) does not lead with/consist solely of "revision" framing, and is not a near-duplicate of the Resource's H1 string.
- Likely new file: `app/resources/manage-client-revisions-web-designers/page.test.tsx` — protects the Resource's title/H1/description stay exactly as recorded in §13.1 (i.e., that this phase's NO CHANGE decision holds over time).
- Both: assert the existing bidirectional link relationship (href-based) still holds after any future edit.
- Do not snapshot full visible copy; do not add brittle assertions for sections this audit found already healthy (workflow, FAQ, capabilities, CTAs).

### 13.12 Unresolved issues

- Final wording for the Use Case's title/description/H1 is NOT decided — only candidate directions were evaluated (§13.10). Exact copy must be proposed and approved in the implementation turn, not assumed from this audit.
- Whether the meta description needs to change is a judgment call to finalize alongside the title, not resolved independently here.
- The top-level (unused-in-rendering) `title` field on the UseCase config ("AI Website Revision Task Manager for Web Designers") was found to not be consumed anywhere in the current rendering pipeline (confirmed by inspecting the detail-page template, the metadata generator, and the `/use-cases` listing grid) — noted for completeness; not part of this differentiation fix.

### 13.13 Exact next action

> **Next action:** Wait for an explicit instruction to implement the §13.10 blueprint (title/H1/description refinement on `app/lib/use-cases/cases/web-designers.ts` only). This document does not authorize implementation on its own. Do not begin `/features/project-deadline-calendar` footer/navigation reinforcement (the other unstarted P2 item) without its own separate instruction either.
