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
| AI Task Extraction | ai task extractor | task extractor; extract action items from text; extract tasks from text | Weak/no non-brand GSC signal currently. | Commercial, generic engine (hub, not a channel) | `/features/ai-task-extractor` | Feature | Low | Low (soft overlap reduced: "client message(s)" no longer leads any supporting-copy sentence — 2026-08-30, §18) | Differentiation complete | Complete — see §18 |
| Screenshot → Tasks | screenshot to tasks / turn screenshots into tasks | project screenshot | GSC: "project screenshot" → Resource, 1 impression, avg. position ~35. No assumed primary from route name. | Commercial + informational | `/features/screenshot-to-tasks` + `/resources/how-to-turn-screenshots-into-tasks` | Feature + Resource | Low-Medium | None | Validated pattern, weak signal | Keep as-is |
| Client Feedback / Revisions | client feedback to tasks | manage client revisions | Secondary priority per original research scope. | Commercial + informational, INBOUND (client → owner) | `/features/client-feedback-to-tasks` + `/resources/how-to-turn-client-feedback-into-tasks` | Feature + Resource | Low-Medium | Medium vs. future Client Project Tracker (direction confusion risk) | Keep as-is; secondary positioning | P2: direction-explicit cross-linking once Tracker exists |

### 3C. Use Case / overlap clusters

Audience-segmented pages, including the one unresolved overlap flagged for future differentiation.

| Cluster | Primary Keyword | Secondary | Search Evidence | Intent | Current Owner | Type | Confidence | Cannib. Risk | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|
| Use Case — WordPress | (audience-specific, no forced primary) | wordpress related tasks; wordpress tasks | GSC: "wordpress related tasks" ~7 impr./pos. ~77; "wordpress tasks" ~5 impr./pos. ~66.6 — page-only, no cannibalization observed. | Audience fit | `/use-cases/wordpress-freelancers` | Use Case | Low (thin but clean) | None | Validated, no conflict | Keep as-is |
| Use Case — Web Designers vs. Revisions Resource | (audience-specific) | web designers; manage client revisions | GSC: manage-client-revisions-web-designers ~16 impr., avg. pos. ~15.2 (queries hidden). Use Case is mostly branded traffic. | Audience fit vs. informational how-to — same audience+problem combo | `/use-cases/web-designers` AND `/resources/manage-client-revisions-web-designers` | Use Case + Resource | Low | Low (identity-layer differentiation implemented 2026-08-30 — §14) | Resolved 2026-08-30 — implemented (§14) | None — complete |

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

**P1 — COMPLETE** [corrected 2026-08-30, §19.17 — was stale as "NEXT"]
- Build `/features/client-project-tracker` (full spec in §4.3 and §10). [COMPLETE — see §11]
- Add contextual homepage/solution linking to the new Feature. [COMPLETE — see §11.20]

**P1 / P2**
- Email Feature H1 commercial-framing differentiation. [COMPLETE 2026-08-30 — see §12]
- General internal-linking improvements identified in §6.1. [Substantially addressed by P1A+P1B — see §11.20]

**P2 — COMPLETE**
- Client Project Tracker ↔ Client Feedback to Tasks direction-explicit cross-links. [COMPLETE — confirmed reciprocal in code, see §19.9; was stale/unmarked, corrected 2026-08-30]
- Web Designers Use Case vs. Revisions Resource differentiation pass (§5, rule 7). [COMPLETE 2026-08-30 — see §14]
- `/features/project-deadline-calendar` footer/navigation reinforcement. [COMPLETE 2026-08-30 — see §16; was stale/unmarked, corrected 2026-08-30]

**P3 — COMPLETE**
- AI Task Extractor copy differentiation (away from "client messages" phrasing). [COMPLETE 2026-08-30 — see §18]
- Periodic GSC / Keyword Planner re-validation of all clusters in §3, especially thin-evidence ones. [Standing monitoring item — safe to defer past deployment]
- Lower-priority Use Case optimizations. [Standing monitoring item — safe to defer past deployment]

**FINAL SEO PACKAGE AUDIT — COMPLETE, BLOCKED.** See §19. One technical SEO defect (Calendar title-tag doubling) must be resolved in its own scoped follow-up phase before this package is fully release-ready. See §10.

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

**CURRENT SEO PACKAGE:**
**FINAL AUDIT PASSED**

**BLOCKER:**
**RESOLVED — Project Deadline Calendar duplicate title suffix**

**NEXT:**
**Create one meaningful local commit for the remaining verified SEO working-tree changes, then perform final Git verification before push.**

**Status update (2026-08-30, Blocker Resolution):** The §19 Final SEO Package Audit's sole blocker — `/features/project-deadline-calendar` rendering a doubled `<title>` suffix — is now fixed, verified via a fresh live dev-server render, covered by 7 new regression tests, and confirmed via a repository-wide read-only scan to be the only live public SEO page that had this defect (2 unrelated `noindex`/`nofollow` demo-funnel pages share the same code pattern but are out of the SEO package's scope — see §20.5/§20.9). Every dimension the original audit checked remains clean; the focused delta re-verification in §20.12 confirms nothing else was disturbed. Nothing has been staged, committed, pushed, or deployed — the fix exists only in the working tree, alongside the pre-existing verified Calendar-discovery and P3 AI Task Extractor changes.

> **NEXT: Create the final local commit**
> The full accumulated SEO package — P1 Client Project Tracker, Email H1 differentiation, Web Designers differentiation, Calendar discovery reinforcement, P3 AI Task Extractor, and the Calendar title-tag fix — is release-ready. The remaining step is to create **one meaningful local commit** for the working-tree changes still uncommitted (Calendar discovery's 4 files, P3's 2 files, the Calendar title fix's 2 files, plus the docs), then run final Git verification before push. **This still requires its own explicit instruction — do not create the commit or push without being told to.**

**Before starting the next phase, the next session must:**

1. Re-read §19 (the Final Audit) and §20 (the blocker resolution) in full before doing anything else — together they are the authoritative, current state of the whole package.
2. Confirm with the user that the batching instruction is being lifted for this specific commit — the standing rule has been "do not commit after each phase"; creating the final commit is the explicit milestone this rule was building toward, but still needs its own go-ahead.
3. When authorized, stage exactly the expected working-tree files (§20.13), write a commit message describing the whole batch, and create ONE commit — do not split it into multiple commits unless asked.
4. Do not push without a further, separate explicit instruction, even after the commit exists.
5. Run the standard verification ritual one more time immediately before committing, as a final sanity check: `npx tsc --noEmit`, `npm run build`, `git diff --check`.

**The next Claude session should begin exactly here — Section 10 — after first re-reading §19 and §20 in full, then proceed only when given explicit instruction to create the final local commit.**

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

> **Next action (superseded — see §14):** The §13.10 blueprint was implemented on 2026-08-30. §13.1–§13.12 above are preserved unchanged as decision history — the plan they describe is exactly what was built. §14 records the implementation result.

---

## 14. P2 — Web Designers vs. Revisions Resource Differentiation — Implementation (2026-08-30) — COMPLETE

Implements the §13.10 blueprint exactly, with one deliberate, evidence-based deviation from the literally-recommended SEO title string (§14.2). No route, canonical, schema, capabilities, workflow, FAQ, proof, or CTA was touched. The Resource page was not modified.

### 14.1 Old → final copy

- **SEO title — old:** "Website Revision Task Manager for Web Designers"
- **SEO title — final:** "Web Designer Task Management for Client Projects"
- **Meta description — old:** "Turn client revision emails, WhatsApp messages, and marked-up screenshots into tracked website tasks, organized by page and reviewed before saving."
- **Meta description — final:** "Turn client emails, WhatsApp messages, screenshots, and revision feedback into organized website tasks, reviewed before saving."
- **Rendered H1 — old:** "Stop rebuilding revision emails into task lists. Start tracking each page change."
- **Rendered H1 — final:** "Turn client requests into organized website tasks." (`hero.title` "Turn client requests into" + `hero.highlight` "organized website tasks.")
- **Hero support copy — final:** "Text2Task helps web designers turn emails, WhatsApp messages, screenshots, and revision feedback into clear, reviewable tasks organized by page before saving."

### 14.2 Deliberate deviation from the recommended SEO title string

> **The literal recommended title ("...Client Projects | Text2Task") was NOT used verbatim:**
> - The root layout (`app/layout.tsx`) declares `title.template: "%s | Text2Task"`, which Next.js applies automatically to every descendant page's plain-string title.
> - Empirically confirmed by rendering the page before this change: `seo.title` "Website Revision Task Manager for Web Designers" (no suffix in the config) already rendered as `<title>Website Revision Task Manager for Web Designers | Text2Task</title>`.
> - Baking "| Text2Task" into `seo.title` literally would have produced a doubled suffix ("... | Text2Task | Text2Task") in both the `<title>` tag and the route's own `brandedTitle` construction used for OpenGraph/Twitter — a real, verifiable bug, and also inconsistent with every other Use Case's `seo.title` (none of the other 11 include the suffix).
> - Final `seo.title` omits the suffix, exactly matching sibling convention; the rendered `<title>` was re-verified after the change: "Web Designer Task Management for Client Projects | Text2Task" — correct, single suffix, matching the recommended visible result.

### 14.3 H1 field-split rationale

- The rendered H1 is `hero.title` + " " + `hero.highlight` (confirmed by reading `app/components/use-cases/use-case-hero.tsx`'s "editorial" variant, the variant this page uses).
- The recommended H1 concept was a single short sentence ("Turn client requests into organized website tasks."). Rather than forcing two separate, artificially-distinct sentences into title/highlight (the page's OLD pattern, and a pattern that risks reading as two disconnected statements), the sentence was split at its natural midpoint — `hero.title` carries the first clause, `hero.highlight` (rendered in blue) carries the outcome noun phrase — mirroring the cleaner single-sentence pattern already used by the project-managers Use Case.
- Result verified by rendering: one natural, un-stuffed sentence, no duplicated or awkward phrasing.

### 14.4 Why the Use Case now has a distinct intent

- Title and H1 no longer lead with "revision" — they lead with the broader "client request → organized website task" workflow, matching the permanent intent boundary in §13.5.
- Revision language remains present and real, not erased: `hero.description` explicitly lists "revision feedback" as one of several input types (alongside emails, WhatsApp messages, screenshots), and every mid-page section (capabilities, workflow, painPoints, clientUpdates, FAQ, proof) — none of which were touched — still covers revisions in depth.
- The Resource remains the clear, sole owner of "manage client revisions" as a dedicated topic; the Use Case now clearly owns the broader audience-fit workflow question instead of duplicating the Resource's narrow topic.

### 14.5 Confirmation: Resource unchanged

- `app/resources/manage-client-revisions-web-designers/page.tsx`: zero lines changed. Verified by `git diff` (file does not appear in the diff) and by re-rendering the page: H1 "How Web Designers Can Manage Client Revisions Faster" and `<title>` "How Web Designers Can Manage Client Revisions Faster | Text2Task" — identical to §13.1's recorded pre-implementation state.

### 14.6 Cross-link status

- NO CHANGE, as predicted in §13.8. Use Case → Resource (relatedLinks card) and Resource → Use Case (inline link in "Where Text2Task fits") both verified still present and correct after the change — neither anchor text quoted the old H1, so nothing needed updating.
- No duplicate link was added.

### 14.7 Cannibalization / SEO QA

| Check | Result |
|---|---|
| Use Case and Resource H1s clearly distinct? | YES — "Turn client requests into organized website tasks." vs. "How Web Designers Can Manage Client Revisions Faster" |
| Use Case and Resource titles clearly distinct? | YES — "Web Designer Task Management for Client Projects" vs. "How Web Designers Can Manage Client Revisions Faster" |
| "Revision" no longer the Use Case's dominant identity? | YES — absent from title and H1; present only as one input type in `hero.description` and in the untouched mid-page sections |
| Revision language still exists naturally? | YES — confirmed by an automated test asserting the rendered page still contains "revision" |
| Route/canonical/schema changed? | NO — none touched |
| Existing cross-links intact? | YES — verified by automated tests in both directions |
| New cannibalization with `/solutions/freelancer-project-management-software`? | NO — verified by an automated test that the rendered page does not contain "freelancer project management software" |

### 14.8 Exact production files changed

- `app/lib/use-cases/cases/web-designers.ts` — 4 fields changed: `seo.title`, `seo.description`, `hero.title`, `hero.highlight`, `hero.description` (5 string values across 4 named fields; `hero.title`/`hero.highlight` together form the single rendered H1).
- No other file was touched. `capabilities`, `workflow`, `faq`, `proof`, `clientUpdates`, `relatedLinks`, `finalCta`, and the top-level unused `title` field are all unchanged.

### 14.9 Tests

- `app/lib/use-cases/cases/web-designers.test.tsx` — NEW. 8 tests: rendered H1 matches the new intent; H1 doesn't lead with revision framing; H1 not near-identical to the Resource's H1; SEO title distinct and revision-free; revision language still present; no new Freelancer Solution cannibalization; no automatic inbox/WhatsApp-sync overclaim; Use Case → Resource link present.
- `app/resources/manage-client-revisions-web-designers/page.test.tsx` — NEW. 3 tests: H1 unchanged; title/canonical unchanged; Resource → Use Case link present.

### 14.10 Verification results

- Targeted tests: 62 passed across 3 files (2 new files + the shared `app/components/use-cases/use-case-detail-page.test.tsx`, re-run since it renders every Use Case including web-designers).
- Full project test suite: 5,078 tests passed across 188 test files — zero regressions.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; both `/use-cases/web-designers` and `/resources/manage-client-revisions-web-designers` confirmed present in the route output.
- `git diff --check`: clean (one harmless LF/CRLF line-ending notice).
- Full diff reviewed line by line — exactly one production file changed, 4 fields, nothing else.
- Rendered `<title>`/H1 verified empirically for both pages via the dev server both before and after the change (see §14.2), not assumed from source alone.

### 14.11 Next SEO roadmap phase

> **Next action (superseded — see §15):** This pointed at the Project Deadline Calendar discovery item next. That item has since been AUDITED and MAPPED in §15 (not yet implemented).

---

## 15. P2 — Project Deadline Calendar Discovery Audit (2026-08-30)

> **Status: PROJECT DEADLINE CALENDAR DISCOVERY — MAPPED, NOT IMPLEMENTED**
> This section is an audit and implementation blueprint only. No production code was changed. Nothing here is authorized to be implemented without a separate, explicit instruction.

### 15.1 Calendar page audit — current state

- Route/file: `app/features/project-deadline-calendar/page.tsx`
- Title: "Project Deadline Calendar for Freelancers & Small Teams | Text2Task" — description, canonical (`/features/project-deadline-calendar`), H1 ("A Project Deadline Calendar Built for Client Work"), schema (WebPage + BreadcrumbList + FAQPage, no SoftwareApplication), and sitemap entry (priority 0.84, monthly, identical to all 5 siblings) are all healthy and are NOT recommended for change.
- Structural anomaly, unrelated to discovery: this is the only one of the 6 Feature pages with no relatedLinks section at all — its only outbound links are 4 audienceLinks (Freelancer Solution, small-agencies, project-managers, web-designers). Noted for completeness; not part of this phase's recommendation (would be a content change, out of scope for a discovery-only phase).
- Confirms this phase is genuinely a discovery-only question — the page itself is healthy.

### 15.2 Feature discovery matrix (all 6 Features)

| Feature | Footer | Header/Nav | Homepage | Contextual inbound links | Sitemap | Discovery strength |
|---|---|---|---|---|---|---|
| Email to Tasks | YES | NO (none have it) | NO | Solution featureLinks; inbound from AI Task Extractor | YES | Strong |
| AI Task Extractor | YES | NO | NO | Solution featureLinks; inbound from Screenshot-to-Tasks, Email-to-Tasks, Client Feedback to Tasks | YES | Strong |
| Screenshot to Tasks | YES | NO | NO | Solution featureLinks; inbound from AI Task Extractor, Client Feedback to Tasks | YES | Strong |
| Client Feedback to Tasks | YES | NO | NO | Solution featureLinks; inbound from Client Project Tracker | YES | Strong |
| Client Project Tracker | YES | NO | YES | Solution featureLinks; inbound from Client Feedback to Tasks | YES | Strong |
| Project Deadline Calendar | NO | NO | YES | 4 Use Cases (web-designers, wordpress-freelancers, project-managers, small-agencies) — NOT in Solution featureLinks | YES | Medium — strong contextual/Homepage linking, but missing both sitewide-template surfaces (Footer, Solution grid) |

Header/Nav is uniformly NO for all 6 — no Feature page is individually listed in `landing-header.tsx` ("Features" points to the homepage `#features` anchor). This is the established, uniform pattern, not a Calendar-specific gap.

### 15.3 Footer audit

1. **Is Calendar currently listed** in `app/components/landing/landing-footer.tsx`'s `productLinks`? NO — confirmed by direct inspection. 5 of 6 Features are listed (Email to tasks, Screenshot to tasks, AI task extractor, Client feedback to tasks, Client project tracker); Calendar/Work Calendar is the sole omission. The historical issue is CONFIRMED CURRENT, not stale.
2. **Should it be added?** YES — matches every sibling Feature; no evidenced reason found to treat Calendar differently.
3. **Where should it appear?** Appended after "Client project tracker" (the last Feature entry), preserving the existing feature-launch-order pattern and requiring no reordering of the other 11 entries.
4. **Does adding it create an overly long Product column?** LOW risk — the column already holds 12 entries in production today; one more (13) is a minor addition, not a structural change. Recommend a quick visual check at implementation time, not a blocker to the recommendation.
5. **Is the current footer ordering logical?** YES — grouped by type (general nav, Solution, then Features in launch order); no reordering recommended.
6. **Add only Calendar, or is the footer architecture already complete otherwise?** Add only Calendar — no other Feature, Solution, Resource, or Use Case is missing from its respective footer column.

### 15.4 Header / navigation

- `landing-header.tsx`'s `navigation` array has 6 entries, none of which are individual Feature links ("Features" → homepage `#features` anchor). No Features dropdown/menu exists anywhere in the codebase.
- **Recommendation: NO CHANGE.** Creating a dropdown or individually surfacing Calendar in header nav would be architecturally inconsistent with how all 5 sibling Features are treated, and is explicitly out of scope for this phase.

### 15.5 Homepage

- The Homepage (via `homepage-post-extraction-section.tsx`'s capabilities list, "Everything you need after the first request") ALREADY links to Calendar: capability #5, "Plan client work on a calendar" → `/features/project-deadline-calendar`, "Explore the Work Calendar." This link already existed prior to this project's SEO work and was not added by any prior phase.
- **Decision: LINK already exists. NO ACTION NEEDED.** This directly resolves what would otherwise be Part 5's question — the Homepage does not need a new section or a new link.

### 15.6 Contextual internal-link audit

| Candidate | Decision | Reason |
|---|---|---|
| Freelancer Solution (featureLinks grid) | LINK | Confirmed gap: the Solution page's "Explore Text2Task features" grid lists all 5 OTHER Features (including Client Project Tracker, added in P1B) but not Calendar — the only Feature missing from this grid. This is a newly-confirmed finding from this audit, not previously documented in §6.1. |
| Use Case — project-managers | Already linked | relatedLinks: "Project deadline calendar" → Calendar, already present. No action. |
| Use Case — small-agencies | Already linked | relatedLinks: "Plan client deadlines in one calendar" → Calendar, already present. No action. |
| Use Case — web-designers | Already linked | relatedLinks: "Calendar for project deadlines" → Calendar, already present. No action. |
| Use Case — wordpress-freelancers | Already linked | relatedLinks: "Client work calendar" → Calendar, already present. No action. |
| Use Case — virtual-assistants | DO NOT LINK | No natural scheduling/deadline emphasis found in its actual current copy (per the P1B audit of this page); forcing a link would not reflect existing content. |
| Email to Tasks / AI Task Extractor / Screenshot to Tasks / Client Feedback to Tasks (sibling Features) | DO NOT LINK | "Deadline" appears only as one extractable data field on these pages, not as a workflow tie-in to a calendar view; no sibling Feature currently cross-links to any other Feature purely for a shared field mention, and forcing one here would be inconsistent with that established pattern. |

Net new recommendation from this audit: exactly ONE contextual link (Freelancer Solution) is a genuine, confirmed gap. Every other strong candidate is either already linked (4 Use Cases) or has no natural fit (virtual-assistants, sibling Features).

### 15.7 Sitemap

- Confirmed present in `app/sitemap.ts`'s `featureRoutes` array: `{ path: "/features/project-deadline-calendar", priority: 0.84, changeFrequency: "monthly" }` — identical to all 5 sibling Feature routes.
- NO CHANGE needed.

### 15.8 Discovery severity

- Classification: **LOW** (downgraded from an assumed MEDIUM/HIGH, based on evidence gathered in this audit — not preserved from the original prior note, which only ever specifically named the footer).
- Reasoning: the page already has UNUSUALLY STRONG contextual discovery — 4 Use Cases link to it (more than any other single Feature receives from Use Cases) plus a direct Homepage link (shared only with Client Project Tracker among the 6 Features) plus a correct sitemap entry. The only real gaps are the two sitewide-template surfaces every OTHER Feature has 100% coverage on: the Footer and the Freelancer Solution's featureLinks grid.
- A footer-only fix would resolve the originally-flagged, sitewide-template gap. Footer + the one Solution-grid link (newly confirmed by this audit) together achieve full structural parity with all 5 sibling Features on every surface this audit checked.
- Broader discovery work (new sections, additional Use Case links, header/nav changes) is NOT justified — the evidence does not support it, and Part 6's own instruction against "site-wide link stuffing" applies.

### 15.9 Exact minimal future implementation plan (NOT executed this turn)

| File | Current state | Proposed change | Why | Discovery benefit | SEO risk |
|---|---|---|---|---|---|
| `app/components/landing/landing-footer.tsx` | `productLinks` has 12 entries; Calendar is the only Feature missing | Add one entry: `{ label: "Project deadline calendar" (or "Work Calendar", to be finalized at implementation), href: "/features/project-deadline-calendar" }`, appended after "Client project tracker" | Matches the exact pattern used for all 5 sibling Features and for Client Project Tracker in P1A | Sitewide footer presence on every page, matching siblings | None — single array entry, no copy/route/canonical change |
| `app/solutions/freelancer-project-management-software/page.tsx` | `featureLinks` has 5 entries (all Features except Calendar) | Add one entry: `{ href: "/features/project-deadline-calendar", title: <TBD, e.g. "Work Calendar">, text: <TBD, e.g. "Plan project deadlines and scheduled client work in one calendar."> }` | Matches the exact pattern used for Client Project Tracker's addition to this same grid in P1B; closes the one confirmed gap in this grid | Highest-authority Solution page now links to all 6 Features, matching sibling parity | None — single array entry, no copy/route/canonical change; this file has been edited under narrow, explicitly-scoped instructions 5 times this session and would need its own explicit approval again |
| Any other file | n/a | NO CHANGE recommended | No other confirmed gap found by this audit | n/a | n/a |

### 15.10 Test plan (not created this turn)

- Likely new file: `app/components/landing/landing-footer.test.tsx` (first test file for this component) — asserts the Calendar href is present exactly once, alongside the other 5 Feature hrefs, with no duplicate.
- Likely new file: `app/solutions/freelancer-project-management-software/page.test.tsx` already exists (from §14) — extend it with one assertion that the featureLinks grid now includes Calendar's href.
- Re-run (not modify) `app/components/landing/homepage-post-extraction-section.test.tsx` and `app/lib/schema-dangling-entity-references.test.ts` as regression sanity checks — neither needs new assertions, since the Homepage link and schema are already correct and unchanged by this plan.
- Do not snapshot the footer or Solution page in full; assert only href presence/uniqueness, matching this project's established minimal-assertion convention.

### 15.11 Unresolved issues

- Exact footer link label is not finalized — candidates are "Project deadline calendar" (matches the page's own URL/topic framing, and the exact wording already used by the project-managers Use Case's relatedLinks entry) or "Work Calendar" (matches the page's own H1 eyebrow/breadcrumb name). Both are accurate; the choice should be made at implementation time, not assumed here.
- Exact Freelancer Solution featureLinks title/description text is not finalized — should follow the established pattern of the other 5 entries on that page (short title + one-sentence benefit description) once approved.
- The Calendar page's own missing relatedLinks section (§15.1) is a real structural anomaly but is a content change, not a discovery change — explicitly out of scope for this phase; not included in the §15.9 plan.

### 15.12 Exact next action

> **Next action (superseded — see §16):** The §15.9 blueprint was implemented on 2026-08-30. §15.1–§15.11 above are preserved unchanged as decision history — the plan they describe is exactly what was built. §16 records the implementation result.

---

## 16. P2 — Project Deadline Calendar Discovery Reinforcement — Implementation (2026-08-30) — COMPLETE

Implements the §15.9 blueprint exactly, both recommended copy strings used verbatim after accuracy verification against the Calendar page's own copy. The Calendar Feature page itself, the Homepage, all Use Cases, header/nav, and the sitemap were not touched.

### 16.1 Final copy

- **Footer label:** "Project deadline calendar"
- **Footer href:** `/features/project-deadline-calendar`
- **Solution-grid title:** "Project Deadline Calendar"
- **Solution-grid description:** "See project deadlines and upcoming work in one calendar built for client projects."
- **Solution-grid href:** `/features/project-deadline-calendar`

The recommended description was verified against the Calendar page's own hero lead ("See project deadlines, schedule client work, and add manual events in one clear calendar") and FAQ ("A project deadline calendar gives you one calendar view of your project deadlines and scheduled work, along with the project and client context behind each date") before use — it accurately reflects the real feature (deadlines + manual/scheduled work, in a client-project context) with no automation overclaim. No wording adjustment was needed; used verbatim as recommended.

### 16.2 Exact production files changed

- `app/components/landing/landing-footer.tsx` — one new `productLinks` entry, appended after "Client project tracker."
- `app/solutions/freelancer-project-management-software/page.tsx` — one new `featureLinks` entry, appended after "Client Project Tracker."
- No other production file was touched.

### 16.3 Confirmations

| Item | Result |
|---|---|
| Calendar Feature page (`app/features/project-deadline-calendar/`) untouched? | CONFIRMED — `git diff` against this path returns empty |
| Homepage / `homepage-post-extraction-section.tsx` untouched? | CONFIRMED — `git diff` returns empty |
| All Use Cases untouched? | CONFIRMED — no Use Case file appears in the diff |
| Header/Nav (`landing-header.tsx`) untouched? | CONFIRMED — `git diff` returns empty |
| Sitemap (`app/sitemap.ts`) untouched? | CONFIRMED — `git diff` returns empty |
| Calendar metadata/title/H1/canonical/schema unchanged? | CONFIRMED — the page file itself has zero diff |
| Freelancer Solution title/meta/H1/canonical/schema unchanged? | CONFIRMED — only the `featureLinks` array changed; verified by the existing identity test (still passing) |

### 16.4 Tests

- `app/components/landing/landing-footer.test.tsx` — NEW. First test file for this component. 3 tests: Calendar link renders with exact label/href; Calendar link appears exactly once; all 6 Feature pages now have exactly one footer link each.
- `app/solutions/freelancer-project-management-software/page.test.tsx` — MODIFIED. One new describe block, 1 new test: Calendar link present with exact href. The existing identity tests (canonical/title/H1/no-keyword-stuffing) were re-run unmodified and still pass.

### 16.5 Verification results

- Targeted tests: 75 passed across 5 files (2 new/modified files + `homepage-post-extraction-section.test.tsx` + `schema-dangling-entity-references.test.ts` + `app/page.test.ts`, all re-run as regression sanity checks).
- No sitemap test file exists in this codebase (confirmed by direct check) — `sitemap.ts` was not touched, so there was nothing to re-run there; consistent with the §15.7 audit finding.
- Full project test suite: 5,082 tests passed across 189 test files — zero regressions.
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; all 6 Feature routes, the Solution route, and every other route confirmed present in the output.
- `git diff --check`: clean (harmless LF/CRLF line-ending notices only).
- Full diff reviewed line by line — exactly 2 production files changed (one array entry each), 1 new test file, 1 modified test file. The production diff did not become materially broader than expected.

### 16.6 Discovery QA

| Check | Result |
|---|---|
| All 6 Feature pages now have Footer Product exposure? | YES — verified by an automated test |
| Calendar no longer the sole Footer omission? | YES |
| All 6 Feature pages now appear in the Freelancer Solution feature grid? | YES — verified by an automated test |
| Header/Nav unchanged? | YES — confirmed empty diff |
| Homepage unchanged? | YES — confirmed empty diff |
| Existing Use Case → Calendar links unchanged? | YES — no Use Case file touched |
| Sitemap unchanged? | YES — confirmed empty diff |
| Calendar Feature page byte/line unchanged? | YES — confirmed empty diff |
| Calendar metadata/H1 unchanged? | YES |
| Freelancer Solution H1/title/meta unchanged? | YES — verified by the pre-existing identity test |
| No exact-match keyword stuffing introduced? | YES — one new short array entry per file, natural non-repetitive copy |

### 16.7 Roadmap status

- Project Deadline Calendar footer/navigation reinforcement: COMPLETE. This closes the last unstarted item in the §8 P2 tier.
- Note for roadmap accuracy (§6.1): the historical observation that project-deadline-calendar was missing from the footer is now resolved.

### 16.8 Next SEO roadmap phase

> **Next action (superseded — see §17):** This pointed at the AI Task Extractor differentiation item next. That item has since been AUDITED and MAPPED in §17 (not yet implemented).

---

## 17. P3 — AI Task Extractor Pre-Implementation Audit (2026-08-30)

> **Status: AI TASK EXTRACTOR DIFFERENTIATION — MAPPED, NOT IMPLEMENTED**
> This section is an audit and implementation blueprint only. No production code was changed. Nothing here is authorized to be implemented without a separate, explicit instruction.

### 17.1 Current page identity

- Route/file: `app/features/ai-task-extractor/page.tsx`
- Title: "AI Task Extractor: Extract Tasks and Action Items From Text" — already generic, channel-agnostic, no overlap found.
- Meta description: "Paste notes, client messages, or other text to create a reviewable project and task draft. Edit supported fields, remove tasks, and save only after approval." — "client messages" appears once, as the second of three listed input types, not leading.
- Canonical: `/features/ai-task-extractor` — unchanged, no issue found.
- H1: "Extract tasks and action items from text" — already generic, no overlap found.
- Hero support copy: "Paste client messages, notes, or other unstructured text. Text2Task organizes project context and related tasks into a draft you can review before saving." — "client messages" is the FIRST word of the FIRST sentence directly under the H1. This is the single most prominent instance of channel-centric framing on the page.
- No test file exists for this page today — only the shared, generic `schema-dangling-entity-references.test.ts` touches it (schema shape only, no content assertions).
- Product truth was verified directly against source code, not assumed from copy: `app/api/extract/route.ts` accepts a plain string `input` (no channel-specific parameters), calling `extractProjectFromText`; `lib/extraction/schemas.ts`'s `TextExtractedProjectMetadataSchema`/`TextExtractedTaskSchema` confirm the exact extracted fields — title, summary, client_name, contact_name, client_phone, client_email, client_notes, amount, currency_code, deadline_text, priority — which matches every capability the page claims, field for field. No inbox/WhatsApp/email connection logic exists anywhere in this code path.

### 17.2 Adjacent-page intent matrix

| Page | Primary intent | Channel owned | Terminology it owns | AI Task Extractor should avoid leading with |
|---|---|---|---|---|
| Email to Tasks (Feature) | Commercial tool, email-specific intake | Email | "email to task" | "email" as a leading example (already not an issue — no overlap found) |
| Screenshot to Tasks (Feature) | Commercial tool, screenshot-specific intake | Screenshot/image | "screenshot to tasks" | "screenshot" as a leading example (already correctly secondary/absent) |
| Turn Client Messages Into Tasks (Resource) | Informational how-to, message-based intake generally | "Client messages" (chat-style) | "client messages", "turn client messages into tasks" | "client message(s)" as the FIRST/default example — this is the central finding of this audit |
| How to Turn Emails Into Tasks (Resource) | Informational how-to, email-specific | Email | "turn emails into tasks" | No meaningful overlap found on the AI Task Extractor page |
| How to Turn Screenshots Into Tasks (Resource) | Informational how-to, screenshot-specific | Screenshot | "turn screenshots into tasks" | No meaningful overlap found on the AI Task Extractor page |
| How to Extract Action Items From Text (Resource) | AI Task Extractor's OWN healthy informational counterpart (Feature/Resource pairing, same pattern as Email and Screenshot) | None — generic text | "extract action items from text" | N/A — this pairing is healthy and out of scope |

### 17.3 Verified product-truth matrix

| Claim | Safe to state? | Evidence |
|---|---|---|
| Paste text | YES | `app/api/extract/route.ts`: `ExtractRequestSchema` requires a plain string `input` |
| Analyze unstructured text | YES | `extractProjectFromText` processes the raw string; no structural/format requirement enforced |
| Identify project/task information | YES | `TextExtractedProjectMetadataSchema` + `TextExtractedTaskSchema` |
| Extract tasks | YES | `tasks: z.array(TextExtractedTaskSchema)` |
| Extract deadlines | YES | `deadline_text` field |
| Extract priorities | YES | `priority`: low/medium/high enum |
| Extract budget/amount details | YES | `amount`, `currency_code` fields |
| Extract client/contact information | YES | `client_name`, `contact_name`, `client_phone`, `client_email`, `client_notes` fields |
| Produce a reviewable project | YES | project metadata object returned separately from tasks, matches the page's "draft you review" framing |
| Allow review before saving | YES | confirmed sitewide pattern; page's own FAQ explicitly states no auto-save |
| Automatic inbox monitoring | UNSAFE — not claimed, and must not be | No inbox/mailbox logic anywhere in this code path |
| Autonomous task creation from messages | UNSAFE — not claimed, and must not be | FAQ: "Does Text2Task save or assign tasks automatically? No." |
| Automatic saving | UNSAFE — not claimed, and must not be | Same FAQ answer |
| Universal document/file parsing | UNSAFE — not claimed, and must not be | API only accepts a string; no file upload in this schema |
| Background integrations | UNSAFE — not claimed, and must not be | No integration code found |

Finding: the page currently makes NO unsafe claims. Every claim on the page today is accurate and evidenced. The issue this audit identifies is purely one of example-ordering emphasis, not overclaiming.

### 17.4 Overlap analysis

| Element | Current wording | Overlaps with | Severity | Why it matters | Recommended action |
|---|---|---|---|---|---|
| Title | "AI Task Extractor: Extract Tasks and Action Items From Text" | None | NONE | Already generic | Keep |
| Meta description | "Paste notes, client messages, or other text..." | Messages Resource | LOW | "client messages" is 2nd of 3 listed items, not leading | Keep (optional low-priority reorder) |
| H1 | "Extract tasks and action items from text" | None | NONE | Already generic | Keep |
| Hero support copy | "Paste client messages, notes, or other unstructured text." | Messages Resource | MEDIUM | "client messages" is the first word of the first sentence under the H1 — the single most prominent instance on the page | Refine — reorder |
| How-it-works step 1 | "Add the client message, notes, brief, or other text..." | Messages Resource | MEDIUM | Second-most-visible instance | Refine — reorder |
| Example input (`id="example"`) | Business-brief-style text ("Website refresh for Acme...") | None | NONE | Already channel-neutral, reads like a written brief, not a chat message | Keep |
| Section 5 intro | "A client message or note may contain the work itself..." | Messages Resource | LOW-MEDIUM | Leads with "client message" a third time | Refine — reorder |
| Final CTA body | "Paste a client message or note, review the organized project..." | Messages Resource | LOW-MEDIUM | Leads with "client message" a fourth time; the page's last impression | Refine — reorder |
| FAQ Q1 answer | "You can paste client messages, notes, briefs, meeting notes..." | Messages Resource | LOW | Lists "client messages" first, but FAQ has lower visual prominence than hero | Optional refine, lower priority |
| relatedLinks / capability list / trust section / audience section | As-is | None found | NONE | Already healthy, appropriately scoped | Keep |

### 17.5 Cannibalization severity

- Overall: **LOW-MEDIUM**. NOT high — no unsafe claims, no title/H1/metadata convergence with any adjacent page, no literal duplication of another page's title or H1.
- The issue is narrowly confined to repeated example-ordering emphasis: "client message(s)" is listed FIRST in 4 separate sentences across the page's supporting copy (hero, how-it-works step 1, section 5, final CTA), which cumulatively risks the page reading as "the client messages tool" rather than "the generic text tool" — even though the title, H1, worked example, and capability list are all already correctly generic.
- This matches and confirms — via direct page-content evidence, not by assumption — the blueprint's existing §3B note ("soft overlap: 'client messages' language shared with Messages cluster").

### 17.6 Permanent intent boundary

1. **AI Task Extractor should own:** the generic, channel-agnostic text/unstructured-input extraction capability — paste any text (notes, briefs, meeting notes, requests, messages) and get a structured project+task draft.
2. **Email to Tasks should own:** the email-specific commercial intent ("email to task").
3. **Screenshot to Tasks should own:** the image/screenshot-specific commercial intent.
4. **Messages Resource should own:** the informational "how to turn client messages into tasks" concept and the primary claim on "client messages" as a leading phrase.
5. **AI Task Extractor should use naturally, not leading:** "client messages" remains accurate and should still appear — just not as the first-listed example, repeatedly.
6. **AI Task Extractor should lead with instead:** "notes," "briefs," "pasted text," "unstructured text," "project details" — neutral terms already used elsewhere on the same page.

This boundary was derived independently from direct evidence (the repeated first-position phrasing found in §17.4), not adopted blindly from the phase's own suggested conceptual model — the two happen to agree.

### 17.7 Title / meta / H1 / hero decisions

- **SEO title:** KEEP. Already generic, already strongly owns the page's identity; no evidence justifies a change.
- **Meta description:** KEEP (default). Low-severity, optional reorder only if convenient alongside other changes — not required on its own merits, and not being changed merely to add keywords.
- **H1:** KEEP. Already generic and correctly positioned; changing it would destabilize an identity that is not actually the problem.
- **Hero support copy:** CHANGE (primary recommended fix). This is the single highest-visibility instance of the pattern this audit exists to fix.

Matches this phase's own default preference exactly: minimum sufficient differentiation, supporting copy only, primary identity (title/H1) left untouched.

### 17.8 Section-by-section decisions

| Section | Decision | Reason |
|---|---|---|
| Hero (title/H1) | KEEP | Already generic; not the source of the issue. |
| Hero support copy (heroLead) | REFINE | Primary fix — reorder so "client messages" is not the first word. |
| Worked example (`id="example"`) | KEEP | Already channel-neutral; no change needed. |
| Problem section (problemPoints) | KEEP | Already channel-neutral ("Instructions and background information are mixed together," etc.) — no channel words at all. |
| How it works — step 1 text | REFINE | Second-most-visible instance of the pattern. |
| How it works — steps 2-3 | KEEP | No channel-centric wording found. |
| Capability list | KEEP | Neutral field descriptions, not channel claims. |
| Section 5 ("A task extractor should preserve the bigger picture") | REFINE | Intro paragraph leads with "client message or note." |
| Trust section | KEEP | No channel-centric wording found. |
| Audience section | KEEP | No channel-centric wording found. |
| Related links | KEEP | Already a healthy, appropriately-scoped capability-hub set. |
| FAQ Q1 answer | REFINE (optional, lower priority) | Same pattern, lower visual prominence than hero. |
| FAQ Q2–Q6 | KEEP | No channel-centric wording found. |
| Final CTA body | REFINE | Leads with "client message or note" — the page's last impression. |

Net scope: 4 required sentence-level refinements + 1 optional. Every other section is KEEP. This is intentionally small — the page should still feel like the same Feature page after implementation.

### 17.9 Example-input strategy

- The page's actual worked example (`id="example"` section) is ALREADY channel-neutral: a business-brief-style paragraph ("Website refresh for Acme. Update the hero copy, fix the mobile menu, and add the pricing section...") that reads like a written brief, not a chat message or email. KEEP as-is — no change needed to the example itself.
- For the 4 REFINE targets, lead with neutral terms already used elsewhere on the page — "notes," "briefs," "pasted text," "unstructured text," "project details" — and mention "client messages" later in the same sentence, not removed entirely. Matches this project's established "rebalance, not erase" approach (same pattern used in the Web Designers Use Case differentiation, §14).
- Do not claim support for file/document formats the product does not accept — confirmed by source code (§17.1) that the extraction API accepts only a plain string, no file upload.

### 17.10 Internal-link decisions

| Candidate | Decision | Reason |
|---|---|---|
| Screenshot to Tasks (existing relatedLinks) | KEEP | Already present, correct sibling-channel cross-link, healthy capability-hub pattern. |
| Email to Tasks (existing relatedLinks) | KEEP | Same. |
| How to Organize Client Requests as a Freelancer (existing relatedLinks) | KEEP | Already present, not part of this audit's concern. |
| How to Extract Action Items From Text (existing relatedLinks) | KEEP | AI Task Extractor's own healthy Resource counterpart. |
| Turn Client Messages Into Tasks (Messages Resource) | DO NOT ADD | Deliberately adding a new link to the Messages Resource during a phase whose entire purpose is de-emphasizing the "client messages" framing would work against this phase's own goal; no evidenced gap exists in the current link architecture. |
| Client Feedback to Tasks | DO NOT ADD | Conceptually different (follow-up feedback on an existing saved project, not initial extraction); no evidenced gap. |

Inbound links to AI Task Extractor were also confirmed healthy: Screenshot to Tasks, Client Feedback to Tasks, and the Freelancer Solution's featureLinks grid, plus the Messages Resource itself, all already link in — this page is not under-discovered. This phase is about internal copy emphasis, not discovery (unlike §15/§16's Calendar work).

### 17.11 Exact minimal future implementation blueprint (NOT executed this turn)

| Field/section | Current | Proposed direction (example only, not final copy) | Why |
|---|---|---|---|
| `hero.heroLead` | "Paste client messages, notes, or other unstructured text. Text2Task organizes project context and related tasks into a draft you can review before saving." | Reorder to lead with neutral terms, e.g. "Paste notes, briefs, client messages, or other unstructured text..." (final wording TBD) | Removes "client messages" as the first word after the H1 — the single strongest overlap signal |
| `workflowSteps[0].text` | "Add the client message, notes, brief, or other text you want to organize." | Reorder similarly | Second-most-visible instance |
| Section 5 intro paragraph | "A client message or note may contain the work itself, background information..." | Reorder / lead with "text" or "note" | Third instance |
| Final CTA body paragraph | "Paste a client message or note, review the organized project and tasks, and save only the result you approve." | Reorder | Fourth instance; the page's last impression |
| `faqs[0].answer` (optional, lower priority) | "You can paste client messages, notes, briefs, meeting notes, or other unstructured text..." | Optional reorder | Consistency once the required four are fixed |
| title, meta description, H1, worked example, capability list, trust section, audience section, related links, CTA hrefs, schema | As-is | NO CHANGE | Already correctly generic/healthy |

`email-to-tasks/page.tsx`, `screenshot-to-tasks/page.tsx`, and `turn-client-messages-into-tasks/page.tsx`: NO CHANGE for any of the three — not the source of the imbalance; each already correctly owns its own channel.

### 17.12 Test plan (not created this turn)

- Likely new file: `app/features/ai-task-extractor/page.test.tsx` (first test file for this page). Recommended assertions: the four refined sentences no longer start with "client message"; H1/title remain unchanged and generic; no automatic inbox/WhatsApp-sync/auto-save overclaim is introduced (mirrors the pattern already established for email-to-tasks and client-project-tracker's own test files); relatedLinks to Screenshot to Tasks and Email to Tasks remain present.
- Do not snapshot the whole page; assert only the specific invariants this phase protects.

### 17.13 SEO evidence discipline

- No search volume was invented in this audit. The blueprint's own recorded evidence (§3B) states weak/no meaningful non-brand GSC signal for the AI Task Extraction cluster, and no strong validated volume for the exact phrase "ai task extractor" was established in prior research.
- The architectural reason for this phase is product clarity and generic-capability ownership, not a fabricated search-demand claim.

### 17.14 Unresolved issues

- Exact final wording for the 4 (or 5, if the optional FAQ item is included) refined sentences is not decided — only the reordering direction was evaluated. Final copy must be proposed and approved in the implementation turn.
- Whether the FAQ Q1 reorder is included is a judgment call for the implementation turn, not resolved here — it is explicitly lower priority than the other four.

### 17.15 Exact next action

> **Next action (superseded — see §18):** Wait for an explicit instruction to implement the §17.11 blueprint. That instruction was given and the blueprint was implemented on 2026-08-30 — see §18.

---

## 18. P3 — AI Task Extractor Implementation (2026-08-30)

> **Status: AI TASK EXTRACTOR COPY DIFFERENTIATION — COMPLETE**
> Implements the blueprint mapped in §17.11 exactly. Narrow sentence-level copy refinement only — no route, title, meta description, canonical, H1, schema, sitemap, worked example, CTA label, page structure, relatedLinks structure, or section-ordering change. Nothing staged, committed, pushed, or deployed.

### 18.1 Exact sentence changes

All 4 required changes plus the optional FAQ change were implemented as minimal single-item reorders — the smallest possible edit that removes "client message(s)" as the first word of each sentence while adding no new claims and changing no other wording.

| # | Location | Old | New |
|---|---|---|---|
| 1 (required) | `hero.heroLead` (`app/features/ai-task-extractor/page.tsx`, rendered under the H1) | "Paste client messages, notes, or other unstructured text. Text2Task organizes project context and related tasks into a draft you can review before saving." | "Paste notes, client messages, or other unstructured text. Text2Task organizes project context and related tasks into a draft you can review before saving." |
| 2 (required) | `workflowSteps[0].text` | "Add the client message, notes, brief, or other text you want to organize." | "Add the notes, brief, client message, or other text you want to organize." |
| 3 (required) | Section 5 intro (`sectionLead` under "Action items are often mixed with project context") | "A client message or note may contain the work itself, background information, dates, amounts, and contact details in the same paragraph. A simple task list can lose that context, while manual restructuring takes additional time." | "A note or client message may contain the work itself, background information, dates, amounts, and contact details in the same paragraph. A simple task list can lose that context, while manual restructuring takes additional time." |
| 4 (required) | Final CTA body | "Paste a client message or note, review the organized project and tasks, and save only the result you approve." | "Paste a note or client message, review the organized project and tasks, and save only the result you approve." |
| 5 (optional) | `faqs[0].answer` | "You can paste client messages, notes, briefs, meeting notes, or other unstructured text containing work you want to organize." | "You can paste notes, briefs, meeting notes, client messages, or other unstructured text containing work you want to organize." |

### 18.2 FAQ decision

**REFINE** (item 5 above was implemented, not just kept). Reasoning: §17.8 already recorded this as a REFINE decision (optional/lower priority, not KEEP), and after the 4 required fixes this remained the one surviving instance of "client message(s)" leading a sentence on the page — leaving it unchanged would have reintroduced the exact pattern this phase exists to remove, for internal consistency with the other four. The question text was not touched; only the answer's example ordering changed. Meaning is unchanged — the same five input types are listed, only reordered.

### 18.3 Confirmations — unchanged elements

- **Title:** unchanged — "AI Task Extractor: Extract Tasks and Action Items From Text" (verified: not present in the diff).
- **Meta description:** unchanged — "Paste notes, client messages, or other text to create a reviewable project and task draft. Edit supported fields, remove tasks, and save only after approval." This sentence already led with "notes," not "client messages" (confirmed by §17.1/§17.4 as already-healthy, KEEP), so it required no edit and received none.
- **Canonical:** unchanged — `/features/ai-task-extractor`.
- **H1:** unchanged — "Extract tasks and action items from text" (verified: not present in the diff).
- **Worked example (`id="example"`):** unchanged — the Acme business-brief text and its output panel (verified: not present in the diff).
- **Schema (WebPage/Breadcrumb/FAQPage JSON-LD):** unchanged — the FAQPage schema pulls `faq.answer` directly from the `faqs` array, so its text automatically reflects change #5 above; no schema *structure*, `@id`, or entity type was touched.
- **relatedLinks, capability list, trust section, audience section, problem section, section ordering:** all unchanged.
- **Adjacent pages:** `app/features/email-to-tasks/page.tsx`, `app/features/screenshot-to-tasks/page.tsx`, `app/resources/turn-client-messages-into-tasks/page.tsx`, `app/resources/how-to-turn-emails-into-tasks/page.tsx`, `app/resources/how-to-turn-screenshots-into-tasks/page.tsx` — none modified, confirmed by `git status --short` showing no entries for any of these paths.

### 18.4 Exact files changed

- **Production file modified:** `app/features/ai-task-extractor/page.tsx` — 5 single-line string edits only (see §18.1). Full diff reviewed line-by-line; confirmed no other lines touched.
- **Test file created (new):** `app/features/ai-task-extractor/page.test.tsx` — first test file for this page. 10 tests across 4 groups: locked identity (title/H1/worked example unchanged), copy-emphasis rebalance (no sentence leads with "client message(s)"; the phrase still appears; workflow step 1 exact text), no-unsafe-claims (no inbox/email/WhatsApp sync claim, no auto-save-without-review claim), and related-links presence (Email to Tasks, Screenshot to Tasks, both informational Resources).

### 18.5 Channel-neutrality QA

Every occurrence of "client message(s)" on the page was re-grepped after the edit (case-insensitive, full file):

| Line | Sentence start | Leads with "client message(s)"? |
|---|---|---|
| Meta description | "Paste notes, client messages, or other text..." | No (already correct pre-edit) |
| `workflowSteps[0].text` | "Add the notes, brief, client message..." | No |
| `faqs[0].answer` | "You can paste notes, briefs, meeting notes, client messages..." | No |
| `hero.heroLead` | "Paste notes, client messages..." | No |
| Section 5 intro | "A note or client message..." | No |
| Final CTA body | "Paste a note or client message..." | No |

Result: **0 of 6 occurrences now lead a sentence.** All 6 still contain the phrase — per §17.6/the core copy rule, "client message" was never meant to be erased, only demoted from the default leading example. The generic-extraction framing (title, H1, hero's overall identity, worked example) was already healthy per §17 and remains unchanged.

### 18.6 Adjacent-page intent QA

Re-confirmed against the §17.2 matrix after implementation — no adjacent page was touched, so no re-audit of their content was needed; intent boundaries stand exactly as recorded in §17.6:

- **AI Task Extractor** = generic, channel-agnostic supplied-text extraction (reinforced, not changed, by this phase).
- **Email to Tasks** = email-specific commercial intake. Unchanged.
- **Screenshot to Tasks** = screenshot/image-specific commercial intake. Unchanged.
- **Turn Client Messages Into Tasks (Resource)** = informational "client messages" how-to, still the sole owner of that phrase as a leading/primary claim. Unchanged — and, if anything, the boundary is now cleaner, since the Feature page no longer leads with the same phrase in 4 places.

### 18.7 Test results

- **Targeted:** `npx vitest run app/features/ai-task-extractor app/features/email-to-tasks app/features/screenshot-to-tasks app/resources/how-to-turn-emails-into-tasks app/resources/how-to-turn-screenshots-into-tasks app/components/landing/landing-footer.test.tsx app/solutions/freelancer-project-management-software/page.test.tsx` → **5 test files, 27 tests, all passed.** (Only 5 files matched — screenshot-to-tasks and how-to-turn-screenshots-into-tasks have no dedicated test files yet, consistent with pre-existing repository state; not a gap introduced by this phase.)
- **Schema regression:** `npx vitest run app/lib/schema-dangling-entity-references.test.ts` → **1 file, 57 tests, all passed.**
- **Full suite:** `npx vitest run` → **190 test files, 5,093 tests, all passed** (up from the pre-existing 189 files / 5,082 tests baseline by exactly +1 file / +11 tests — matching the new `ai-task-extractor/page.test.tsx` file exactly, confirming no other test was silently added, removed, or broken).

### 18.8 TypeScript / build / diff-check

- **TypeScript:** `npx tsc --noEmit` → clean, zero errors.
- **Build:** `npm run build` → succeeded. `○ /features/ai-task-extractor` confirmed present in the route output as a statically prerendered page.
- **`git diff --check`:** exit 0 — only pre-existing LF→CRLF line-ending warnings (Windows checkout convention on this repo, not a conflict marker or trailing-whitespace error), consistent with every prior phase in this project.

### 18.9 Working-tree separation

`git status --short` after implementation:

```
 M app/components/landing/landing-footer.tsx                              <- pre-existing, Calendar phase (§16), untouched this turn
 M app/features/ai-task-extractor/page.tsx                                <- THIS TURN (P3, §18.1)
 M app/solutions/freelancer-project-management-software/page.test.tsx     <- pre-existing, Calendar phase (§16), untouched this turn
 M app/solutions/freelancer-project-management-software/page.tsx          <- pre-existing, Calendar phase (§16), untouched this turn
 M docs/Text2Task_SEO_Master_Blueprint_2026-08-29.docx                    <- cumulative (Calendar phase + this turn)
 M docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md                      <- cumulative (Calendar phase + this turn)
?? app/components/landing/landing-footer.test.tsx                        <- pre-existing, Calendar phase (§16), untouched this turn
?? app/features/ai-task-extractor/page.test.tsx                          <- THIS TURN (P3, new file, §18.4)
```

The 4 Calendar-phase entries were confirmed unchanged (not reverted, staged, or modified) throughout this turn per the working-tree-safety instruction. This turn's own production diff is exactly 2 files: 1 modified (`page.tsx`, 5 lines), 1 new (`page.test.tsx`).

### 18.10 Roadmap status

P0 complete. P1 (Client Project Tracker) complete. P1/P2 tier (Email H1, internal linking) complete. P2 tier (Web Designers, Calendar) complete. **P3 (AI Task Extractor) now COMPLETE.** Every item currently recorded in §8's P0–P3 tiers is now either complete or a standing periodic-maintenance item (GSC/Keyword Planner re-validation, lower-priority Use Case optimizations) — no further new-implementation roadmap item is currently mapped. Per this phase's explicit instruction, the next step is a **Final SEO Package Audit / Verification** reviewing the accumulated P1+P2+P3 batch as a coherent whole, before any commit/push decision — not a new optimization phase. See §10.

---

## 19. FINAL SEO PACKAGE AUDIT — 2026-08-30

> **Result: FINAL AUDIT BLOCKED.** One concrete, pre-existing, previously-undetected technical SEO defect was found on `/features/project-deadline-calendar` — a doubled `<title>` tag suffix (`... | Text2Task | Text2Task`), verified empirically via a live dev-server request. Per this audit's explicit instructions, production code was **not** fixed in this turn. No other blocker was found. Every other audited dimension — routes, metadata elsewhere, intent ownership, Client Share product truth, structured data, internal linking, assets, sitemap/redirects, tests, and full verification — passed cleanly.

### 19.1 Repository state

- Branch: `main`. Upstream: `origin/main` (confirmed via `git status -sb`, not assumed).
- `main` is **7 commits ahead** of `origin/main`.
- Nothing staged (`git diff --cached` empty).
- Working tree: 6 modified + 2 untracked files, all attributable to known SEO-package phases (Calendar discovery, P3 AI Task Extractor, cumulative docs) — no unrelated or unexpected file found.

### 19.2 Local unpushed commit inventory

| Hash | Message | Scope | Result |
|---|---|---|---|
| `382387a` | Differentiate web designer SEO intent | `web-designers.ts`/`.test.tsx`, Revisions Resource test, docs | PASS |
| `81ecb0e` | Map web designer SEO differentiation | docs only (audit) | PASS |
| `373b964` | Differentiate email to tasks SEO intent | `email-to-tasks/page.tsx`, 2 new test files, docs | PASS |
| `e38731a` | Add client project tracker internal links | Homepage section + test, Freelancer Solution page + test, docs | PASS |
| `7dd9ac0` | Add client project tracker feature page | Tracker page/CSS/test, footer link, Client Feedback reciprocal link, sitemap entry, schema test, 2 image assets, docs | PASS |
| `234c7e0` | Map client project tracker SEO implementation | docs only (audit) | PASS |
| `d7eebd3` | Add SEO master blueprint | docs only (creation) | PASS |

Every unpushed commit's file scope is coherent with its message and belongs to the SEO package; no accidental unrelated file in any commit. History was not rewritten, rebased, or squashed.

### 19.3 Working-tree inventory (uncommitted)

| File | Status | Attribution |
|---|---|---|
| `app/components/landing/landing-footer.tsx` | M | Calendar discovery (§16) |
| `app/components/landing/landing-footer.test.tsx` | new | Calendar discovery (§16) |
| `app/solutions/freelancer-project-management-software/page.tsx` | M | Calendar discovery (§16) |
| `app/solutions/freelancer-project-management-software/page.test.tsx` | M | Calendar discovery (§16) |
| `app/features/ai-task-extractor/page.tsx` | M | P3 (§18) |
| `app/features/ai-task-extractor/page.test.tsx` | new | P3 (§18) |
| `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.docx` | M | Cumulative |
| `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` | M | Cumulative |

Unrelated/unexpected files: **NONE.**

### 19.4 Public route / sitemap audit

All 6 Feature routes, the 1 Solution route, all 8 Resource routes, and all 12 Use Case routes (dynamic via `getAllUseCases()`) are present in `app/sitemap.ts` exactly once each. No stale, duplicate, or orphaned sitemap entry found. No auth/dashboard/admin route is exposed in the sitemap. Internal hrefs sampled across Footer, Freelancer Solution, Homepage, Client Feedback ↔ Client Project Tracker, Email Feature ↔ Email Resource, Web Designers ↔ Revisions Resource, and Messages Resource → AI Task Extractor all resolve to real, correctly-spelled routes. **Result: PASS.**

### 19.5 Metadata audit

| Page | Title | Canonical | Result |
|---|---|---|---|
| `/features/client-project-tracker` | Plain string, template-safe; verified via live render: single `\| Text2Task` suffix | Correct | PASS |
| `/features/email-to-tasks` | Plain `pageTitle` for `metadata.title`; separate `ogTitle` (with suffix) used only for OG/Twitter — correct, intentional pattern | Correct | PASS |
| `/features/ai-task-extractor` | Plain string, template-safe | Correct | PASS |
| `/features/screenshot-to-tasks` | Plain string, template-safe | Correct | PASS |
| `/features/client-feedback-to-tasks` | Plain string, template-safe | Correct | PASS |
| **`/features/project-deadline-calendar`** | **`pageTitle` constant already contains a literal `\| Text2Task"` suffix AND is assigned directly to `metadata.title` as a plain string. The root layout's `title.template: "%s \| Text2Task"` applies on top of it.** | Correct | **ISSUE — see §19.14 blocker** |
| `/use-cases/web-designers` | `seo.title` plain, template-safe | N/A (Use Case route) | PASS |
| `/resources/manage-client-revisions-web-designers` | Plain string, template-safe | Correct | PASS |
| `/solutions/freelancer-project-management-software` | Plain string, template-safe | Correct | PASS |
| `/about` | Uses `title: { absolute: pageTitle }` to deliberately bypass the template (title itself already contains "Text2Task") | Correct | PASS (reference pattern) |

**Live verification (dev server, this audit):**
```
/features/client-project-tracker            => Client Project Tracker: Share Project Progress With Clients | Text2Task
/features/email-to-tasks                     => Email to Tasks: Turn Emails Into Projects | Text2Task
/features/ai-task-extractor                  => AI Task Extractor: Extract Tasks and Action Items From Text | Text2Task
/features/screenshot-to-tasks                => Screenshot to Tasks: Turn Screenshots Into Organized Tasks | Text2Task
/features/client-feedback-to-tasks           => Client Feedback to Tasks: Review Project Updates | Text2Task
/solutions/freelancer-project-management-... => Freelancer Project Management Software | Text2Task
/use-cases/web-designers                     => Web Designer Task Management for Client Projects | Text2Task
/resources/manage-client-revisions-web-de... => How Web Designers Can Manage Client Revisions Faster | Text2Task
/resources/how-to-turn-emails-into-tasks     => How to Turn Emails Into Tasks: A Practical Workflow | Text2Task
/about                                        => About Text2Task | Our Story and Product Principles
/features/project-deadline-calendar          => Project Deadline Calendar for Freelancers & Small Teams | Text2Task | Text2Task  <- BROKEN
```

This is the exact `\| Text2Task \| Text2Task` doubling pattern this audit was asked to check for. It is **isolated to this one page** — every other page checked (10 pages, positive controls) renders a single, correct suffix. **Root cause:** `app/features/project-deadline-calendar/page.tsx` bakes the brand suffix into its own `pageTitle` constant and assigns it directly to `metadata.title` as a plain string, instead of either (a) omitting the suffix and letting the template add it once (the pattern every other Feature/Resource/Solution page uses), or (b) wrapping it as `title: { absolute: pageTitle }` (the pattern `/about` uses when a title must carry its own brand string verbatim). **Not fixed this turn** per explicit instruction. **Pre-existing:** `app/features/project-deadline-calendar/page.tsx` was never modified at any point in this SEO package (confirmed empty diff in §16 and again this turn) — this defect predates the package and was not introduced by it, but was not previously caught because this specific empirical-render check had only ever been run against the Web Designers page (during its implementation), never against Calendar.

### 19.6 H1 / search-intent ownership audit

| Pair | Classification |
|---|---|
| Email commercial vs. Email informational | CLEAR |
| Freelancer PM (anchor) vs. Client Project Management (secondary) vs. Project Request Management (secondary) | CLEAR — single page, no fork, "a simple project request management process" appears naturally once, not stuffed |
| Client Project Tracker (outbound) vs. Client Feedback to Tasks (inbound) | CLEAR — direction-explicit reciprocal cross-links confirmed both directions in current code |
| Web Designers Use Case (broad) vs. Client Revisions Resource (focused) | CLEAR — H1s verified distinct: "Turn client requests into organized website tasks." vs. "How Web Designers Can Manage Client Revisions Faster" |
| AI Task Extraction (generic) vs. Screenshot (image-specific) vs. Messages Resource (client-message how-to) | CLEAR — all 6 Feature H1s verified distinct via direct grep, no collision |
| Client Project Management / Project Request Management vs. any future forked page | ACCEPTABLE OVERLAP — deliberately kept as secondary positioning on the Freelancer Solution anchor page per standing rule; monitored, no fork |

No POTENTIAL CONFLICT found anywhere in the audited set. **Result: PASS.**

### 19.7 Client Share product-truth audit

Searched for `client portal`, `client account`, `client login`, `Client Project Tracker`, `Client Share`, `Share with Client` across `app/`. The only matches for unsafe-sounding terms (`client portal`, `client account`) are in `app/solutions/freelancer-project-management-software/page.tsx`'s `notReplacements` list — a "what Text2Task does NOT provide" disclaimer (§2.4's factual correction), not a positive claim. `app/features/client-project-tracker/page.tsx` was read in full: every claim (one project share link, selected visibility, optional PIN, optional expiration, revoke/regenerate, optional comments reviewed by the owner before anything is added, no Text2Task account required for the client, internal data stays separate) matches the locked safe-claims list exactly. No full-account, persistent-login, CRM/chat/helpdesk, or unrestricted-workspace claim found anywhere in public copy. **Result: PASS.**

### 19.8 Structured-data audit

Searched for `SoftwareApplication`, `aggregateRating`, `"@type": "Review"`, and `SITE_SCHEMA_ENTITY_IDS.softwareApplication` across `app/`. Every match is either an explanatory code comment documenting the 2026-08-26 historical fix, or a test assertion confirming the *absence* of these — none is live production schema. `app/lib/schema-dangling-entity-references.test.ts` covers all 7 relevant WebPage JSON-LD exports (Freelancer Solution, AI Task Extractor, Screenshot, Calendar, Email, Client Feedback, Client Project Tracker) plus the About page and the `SITE_SCHEMA_ENTITY_IDS` constant itself. No dangling `@id`, no fabricated rating/review/testimonial data anywhere. **Result: PASS.**

### 19.9 Internal-linking audit

- Client Project Tracker: Footer ✓, Homepage ✓, Freelancer Solution ✓, reciprocal Client Feedback link (both directions) ✓, outbound relatedLinks ✓.
- Project Deadline Calendar: Footer ✓, Homepage ✓, Freelancer Solution ✓, 4 Use Cases (web-designers, project-managers, wordpress-freelancers, small-agencies) ✓, sitemap ✓.
- Email Feature ↔ Email Resource: reciprocal, both directions confirmed.
- Web Designers Use Case ↔ Revisions Resource: reciprocal, both directions confirmed, plus Calendar cross-link.
- No malformed path, no accidental duplicate link, no keyword-stuffed repeated exact-match anchor found in any file sampled. No orphaned public page found among the pages audited. **Result: PASS.**

### 19.10 Asset audit

Both Client Project Tracker images (`client-project-tracker-share-progress-with-clients.png`, `client-share-project-link-management.png`) exist exactly once at the correct path, referenced correctly (`Image` with `fill` + `sizes`, alt text present on both), OG/Twitter image path resolves via `absoluteUrl()`. Commit history confirms both were net-new file additions (`Bin 0 -> ...`), not overwrites of any existing asset. No stale duplicate copy found elsewhere in `public/`. **Result: PASS.**

### 19.11 Sitemap / redirect / indexability audit

`app/sitemap.ts`: Client Project Tracker and Project Deadline Calendar each appear exactly once; all 6 Features, the Solution, all 8 Resources, and all Use Cases present; no auth/dashboard/admin route exposed. `next.config.ts`: exactly one redirect (`/index.html` → `/`, permanent), no loop, no wildcard; confirmed no `middleware.ts` or `vercel.json` exists to introduce a second, competing redirect mechanism. `app/robots.ts`: disallows only `/api/`, `/auth/`, `/dashboard`, `/admin/`, `/share` — Feature/Solution/Resource paths are not explicitly listed in `allow` but are not disallowed either, so they remain crawlable by default robots.txt semantics; noted as informational only, not an issue. **Result: PASS (not modified).**

### 19.12 Test inventory health

17 SEO-relevant test files inventoried (Footer, homepage section, Use Case detail template + Web Designers, 6 Feature pages' worth of coverage, 2 Resource pages, Freelancer Solution, schema regression, homepage schema). Spot-checked `web-designers.test.tsx` assertions against current file content — still accurate. No duplicate/redundant, brittle, or obsolete-copy assertion found in the files reviewed. No sitemap-specific or redirect-specific test file exists (pre-existing gap, not introduced by this package — noted as a non-blocking follow-up). **Result: HEALTHY.**

### 19.13 Full verification (this audit turn)

- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded. All required routes confirmed present, including `/`, all 6 Features, the Solution, `/use-cases/web-designers`, and `/resources/manage-client-revisions-web-designers`/`how-to-turn-emails-into-tasks`.
- Full test suite (this audit's own fresh run): **190 test files, 5,093 tests — 189 files/5,092 tests passed, 1 file/1 test failed** (`app/share/[publicId]/share-view.client.test.tsx`, a `findByText` timing assertion in the Client Share public view — entirely unrelated to any file touched by this SEO package). Re-ran that single file in isolation: **44/44 passed**, confirming a timing-sensitive flake under full-suite parallel load, not a real regression. The identical full suite had already passed 190/5093 with zero failures earlier the same day (P3 implementation turn), with no change to that file in between. **Not classified as a blocker** — unrelated file, non-reproducible in isolation.
- `git diff --check`: exit 0, only pre-existing LF→CRLF warnings.
- `git status --short`: matches the exact expected inventory (§19.3), no unrelated file.

### 19.14 Blockers

1. **`/features/project-deadline-calendar` renders a doubled title-tag suffix** (`... | Text2Task | Text2Task`) — see §19.5 for full evidence and root cause. Pre-existing (not introduced by this SEO package's diffs), but directly relevant because this package is actively adding inbound links to this exact page. **Not fixed this turn per explicit instruction.**

### 19.15 Non-blocking follow-ups

- Fix the Calendar title-doubling bug (§19.14) in a small, dedicated, explicitly-scoped follow-up phase — remove the baked-in `\| Text2Task` from `pageTitle` (or switch to `title: { absolute: pageTitle }`), leaving H1/meta description/canonical/schema untouched.
- `app/share/[publicId]/share-view.client.test.tsx` shows timing-sensitive flakiness under full-suite parallel load (§19.13) — worth a look outside SEO scope, not urgent.
- No sitemap-specific or redirect-specific test file exists (§19.12) — a pre-existing coverage gap, low priority given both are simple and currently correct.
- §8's roadmap bullets for "Client Project Tracker ↔ Client Feedback to Tasks direction-explicit cross-links" and "`/features/project-deadline-calendar` footer/navigation reinforcement" were stale (work is actually complete in code, per §19.9, but wasn't marked `[COMPLETE]`) — corrected in §8 as part of this audit's documentation update, since accurate roadmap bookkeeping is itself part of what this final audit checks.
- Periodic GSC/Keyword Planner re-validation and lower-priority Use Case optimizations remain standing monitoring items — explicitly fine to happen after deployment, not required before ship.

### 19.16 Final cannibalization matrix

| Cluster | Primary owner | Secondary/supporting | Intent | Risk after package | Status |
|---|---|---|---|---|---|
| Email commercial | `/features/email-to-tasks` | — | Commercial, tool-specific | None | Validated / stable |
| Email informational | `/resources/how-to-turn-emails-into-tasks` | — | Informational/how-to | None | Validated / stable |
| Freelancer PM | `/solutions/freelancer-project-management-software` | — | Commercial, category/end-to-end (anchor) | None (anchor) | Validated / stable |
| Client Project Management | `/solutions/freelancer-project-management-software` (secondary) | — | Commercial, broad category | High if forked — monitored, no fork | Reinforced, monitor |
| Project Request Management | `/solutions/freelancer-project-management-software` (secondary) | — | Commercial, narrow (intake) | High if forked — monitored, no fork | Reinforced, monitor |
| Client Project Tracker | `/features/client-project-tracker` | — | Commercial, narrow (outbound client visibility) | Low (direction-explicit vs. Client Feedback) | COMPLETE |
| Client Feedback | `/features/client-feedback-to-tasks` | — | Commercial + informational, INBOUND (client→owner) | Low | Keep as-is; secondary positioning |
| AI Task Extraction | `/features/ai-task-extractor` | — | Commercial, generic engine | Low (soft overlap reduced 2026-08-30) | COMPLETE |
| Screenshot | `/features/screenshot-to-tasks` + Resource | — | Commercial + informational | None | Validated, weak signal |
| Messages | `/resources/turn-client-messages-into-tasks` | Homepage (de facto anchor) | Informational + light commercial | None | Validated / stable |
| Web Designers | `/use-cases/web-designers` | — | Broader client-work/task workflow | None (differentiated) | COMPLETE |
| Client Revisions | `/resources/manage-client-revisions-web-designers` | — | Focused revisions/how-to | None (differentiated) | COMPLETE |
| Project Deadline Calendar (bonus, not in required list) | `/features/project-deadline-calendar` | — | Commercial, scheduling/deadlines | None keyword-wise; **technical metadata defect, §19.14** | Discovery COMPLETE; **title bug BLOCKING** |

### 19.17 P0–P3 roadmap status

- **P0 — COMPLETE.** All 3 items pushed (technical SEO cleanup, Client Share correction, Freelancer secondary reinforcement).
- **P1 — COMPLETE.** Client Project Tracker built and linked (Footer, Homepage, Freelancer Solution). (§8's "P1 — NEXT" header was stale; corrected to COMPLETE in this audit's doc update.)
- **P1/P2 — COMPLETE.** Email H1 differentiation; general internal linking substantially addressed.
- **P2 — COMPLETE.** All 3 items: Tracker↔Feedback cross-links, Web Designers differentiation, Calendar footer/navigation reinforcement. (Two of these three were done in code but unmarked in §8; corrected in this audit's doc update.)
- **P3 — COMPLETE.** AI Task Extractor copy differentiation.
- **Required before ship:** the §19.14 Calendar title-tag fix is a real technical defect but is explicitly deferred (not to be fixed this turn) — it is the one item standing between this package and a clean gate.
- **Safe to defer past deployment (monitor only):** periodic GSC/Keyword Planner re-validation; lower-priority Use Case optimizations.

### 19.18 FINAL RELEASE GATE

> **NOT READY — BLOCKER(S)**
> Blocker: `/features/project-deadline-calendar` renders a doubled `<title>` tag (`\| Text2Task \| Text2Task`) — see §19.14. Everything else audited in this package (routes, other pages' metadata, intent ownership, Client Share product truth, structured data, internal linking, assets, sitemap/redirects, tests, build, TypeScript) passed cleanly. The blocker is narrow, well-understood, and was intentionally left unfixed this turn per this audit's own instructions not to make production changes during an audit.

---

## 20. Final Audit Blocker Resolution — Calendar Title (2026-08-30)

> **Status: BLOCKER RESOLVED.** The §19.14 Calendar title-doubling defect is fixed, verified empirically via live dev-server render, and covered by new regression tests. No other page shares the live, public-facing version of this defect. Nothing staged, committed, pushed, or deployed this turn.

### 20.1 Exact bug

`/features/project-deadline-calendar` rendered `<title>Project Deadline Calendar for Freelancers & Small Teams | Text2Task | Text2Task</title>` — a doubled brand suffix, confirmed via live dev-server curl during the §19 Final SEO Package Audit.

### 20.2 Root cause

The root layout (`app/layout.tsx`) declares `title: { default: "...", template: "%s | Text2Task" }`. Any descendant page that sets `metadata.title` as a plain string has that template applied automatically, appending `" | Text2Task"`. The Calendar page's own `pageTitle` constant already contained the literal suffix `"| Text2Task"` and was assigned directly to `metadata.title` as a plain string — so the template appended the suffix a second time. This root-layout mechanism itself is correct and working exactly as intended for every other page; it was not touched.

### 20.3 Fix — exact old → new

| Field | Old | New |
|---|---|---|
| `pageTitle` (used for `metadata.title` and `webPageJsonLd.name`) | `"Project Deadline Calendar for Freelancers & Small Teams \| Text2Task"` | `"Project Deadline Calendar for Freelancers & Small Teams"` (suffix removed) |
| `ogTitle` (new constant, used only for `openGraph.title` / `twitter.title`) | *(did not exist — OG/Twitter previously reused the suffixed `pageTitle`)* | `"Project Deadline Calendar for Freelancers & Small Teams \| Text2Task"` |

This follows the established sibling convention exactly: `/features/email-to-tasks` already uses this identical two-constant pattern (a plain, unsuffixed `pageTitle` for `metadata.title`/schema `name`, and a separately-declared, fully-suffixed `ogTitle` for `openGraph.title`/`twitter.title`, since OpenGraph/Twitter metadata does not inherit `title.template` and therefore must carry the complete brand string explicitly). `/features/client-project-tracker` was also compared; it uses a single unsuffixed constant everywhere including OG/Twitter (meaning its OG tag currently omits the brand suffix) — a different, minor, out-of-scope characteristic not touched or replicated here, since the email-to-tasks pattern is the one that correctly keeps OG/Twitter fully suffixed while keeping `metadata.title` template-safe, matching this fix's exact goal.

### 20.4 Final rendered title

**Confirmed via live dev-server render** (not inferred from source): `curl http://localhost:3000/features/project-deadline-calendar` after the fix returned:

```
<title>Project Deadline Calendar for Freelancers &amp; Small Teams | Text2Task</title>
<meta property="og:title" content="Project Deadline Calendar for Freelancers &amp; Small Teams | Text2Task"
```

Exactly one `| Text2Task` suffix — matches the expected final title exactly. The dev server was started fresh for this verification and stopped immediately after.

### 20.5 Repository-wide duplicate-suffix scan (read-only, before editing)

Searched every `page.tsx` for `pageTitle` usage and for the literal string `"| Text2Task"`, and classified each occurrence:

| File | Classification | Reason |
|---|---|---|
| `app/layout.tsx` | SAFE | This is the template definition itself, not a consumer of it. |
| `app/page.tsx` (Homepage) | SAFE | `metadata.title` uses unsuffixed `homepageTitle`; OG/Twitter hardcode the full suffixed string directly (correct, template-independent fields). |
| `app/use-cases/page.tsx` | SAFE | `metadata.title` is unsuffixed; OG/Twitter carry the suffix — correct pattern. |
| `app/about/page.tsx` | SAFE | Deliberately uses `title: { absolute: pageTitle } }` to bypass the template, since its own title already carries "Text2Task". |
| `app/solutions/freelancer-project-management-software/page.tsx` | SAFE | Same two-constant pattern as email-to-tasks (unsuffixed `pageTitle`, separate suffixed `ogTitle`). |
| `app/features/email-to-tasks/page.tsx` | SAFE | Same two-constant pattern — the reference convention this fix replicates. |
| `app/resources/how-to-turn-emails-into-tasks/page.tsx` | SAFE | Same two-constant pattern. |
| `app/features/client-project-tracker/page.tsx`, `ai-task-extractor`, `screenshot-to-tasks`, `client-feedback-to-tasks` | SAFE | Single unsuffixed `pageTitle` used everywhere; template-safe (OG/Twitter lack the suffix, a separate minor characteristic, not the doubling bug). |
| `app/components/use-cases/use-case-detail-page.test.tsx` | SAFE | Test fixture text only, not live production metadata. |
| **`app/features/project-deadline-calendar/page.tsx`** | **SAME BUG (fixed this turn)** | The defect this section resolves. |
| `app/homepage-demo/review/page.tsx` | **SAME MECHANICAL PATTERN, but NOT a public SEO page** | `metadata.title: "Review your project \| Text2Task"` is a plain string with the suffix baked in — the identical rendering mechanism would double it. However, this page carries `robots: { index: false, follow: false, ... }` (explicit noindex/nofollow) and is a transient step in the anonymous demo-to-signup funnel — never part of the sitemap, never linked from any SEO surface, never in scope of the SEO package or its §19 audit. Not fixed this turn (out of scope); flagged here for transparency. |
| `app/homepage-demo/claim/continue/page.tsx` | **SAME MECHANICAL PATTERN, but NOT a public SEO page** | Identical situation: `metadata.title: "Saving your project \| Text2Task"`, also `robots: { index: false, follow: false }`, also a transient funnel step. Not fixed this turn (out of scope); flagged here for transparency. |

**Conclusion: Calendar was genuinely the only live, public, indexable SEO page with this defect.** The two `homepage-demo` pages share the identical code-level pattern but are explicitly excluded from indexing and were never part of the SEO package's scope — they are noted as a non-blocking, out-of-scope observation (§20.9), not a second blocker, and were not modified.

### 20.6 Exact production file changed

`app/features/project-deadline-calendar/page.tsx` — a `pageTitle`/`ogTitle` split (2 lines changed to 3) plus 2 field reassignments (`openGraph.title` and `twitter.title` now reference `ogTitle` instead of `pageTitle`). No other line touched — confirmed via full diff review. `webPageJsonLd.name` was not edited directly; it already referenced `pageTitle`, which now automatically resolves to the unsuffixed value.

### 20.7 Test file created

`app/features/project-deadline-calendar/page.test.tsx` — new, first test file for this page. 7 tests across 2 groups: title-template doubling fix (local title doesn't end with the suffix, local title is exactly the unsuffixed string, composing local title + root template yields exactly one suffix, OG/Twitter carry the full suffixed string exactly once), and identity-unchanged (H1, canonical, meta description all still match their pre-fix values).

### 20.8 Confirmations

- **H1 unchanged:** confirmed — "A Project Deadline Calendar Built for Client Work", verified both by live render and by the new test.
- **Meta description unchanged:** confirmed — verified both by live render and by the new test.
- **Canonical unchanged:** confirmed — `/features/project-deadline-calendar`, verified both by live render and by the new test.
- **Body copy unchanged:** confirmed — the diff touches only the metadata block (title/OG/Twitter fields); no section, FAQ, or visible copy was touched.

### 20.9 Non-blocking follow-ups (new this turn)

- `app/homepage-demo/review/page.tsx` and `app/homepage-demo/claim/continue/page.tsx` share the identical "suffix baked into a plain-string `metadata.title`" code pattern as the fixed Calendar bug (§20.5). Both are `noindex`/`nofollow` transient funnel pages, outside the SEO package's scope, so this is not a package blocker — but the same narrow fix pattern (drop the baked-in suffix, or use `title: { absolute: ... }`) would resolve it if ever brought into scope.

### 20.10 Verification results

- Targeted: `npx vitest run app/features/project-deadline-calendar app/lib/schema-dangling-entity-references.test.ts` → **2 test files, 64 tests, all passed.**
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build`: succeeded; `○ /features/project-deadline-calendar` confirmed present in the route output.
- Full test suite: see §20.11.
- `git diff --check`: exit 0, only pre-existing LF→CRLF warnings.

### 20.11 Full-suite result and flaky-test status

**191 test files, 5,100 tests — all passed, zero failures.** Exactly +1 file / +7 tests over the pre-fix baseline (190 files / 5,093 tests), matching the new `project-deadline-calendar/page.test.tsx` file exactly (7 tests) — confirming no other test was silently added, removed, or broken. The previously-observed `app/share/[publicId]/share-view.client.test.tsx` flake (1/1 failed in the §19 audit's full-suite parallel run, 44/44 passed in isolation) **passed cleanly in this run** — consistent with the earlier isolated-pass evidence that it was a transient timing flake under parallel load, not a real regression. It was not modified this turn, per explicit instruction.

### 20.12 Re-run final release gate (focused delta verification)

- Metadata/title defect: **RESOLVED** (§20.4).
- No second duplicated-title occurrence on any live public SEO page: **CONFIRMED** (§20.5).
- Structured data still clean: **CONFIRMED** — `webPageJsonLd.name` now correctly unsuffixed (matching sibling convention), schema regression suite still 57/57 passing, no SoftwareApplication/aggregateRating/review introduced.
- Sitemap/routes still clean: **CONFIRMED** — `app/sitemap.ts` untouched, Calendar route still present exactly once, build output confirms the route.
- Working tree contains only expected SEO changes: **CONFIRMED** — see §20.13 for the exact separation.
- Tests, TypeScript, build, `git diff --check`: all clean (§20.10–§20.11).

### 20.13 Working-tree separation (this turn)

```
 M app/components/landing/landing-footer.tsx                              <- pre-existing, Calendar discovery phase (§16), untouched this turn
 M app/features/ai-task-extractor/page.tsx                                <- pre-existing, P3 (§18), untouched this turn
 M app/features/project-deadline-calendar/page.tsx                        <- THIS TURN (blocker fix, §20.3/§20.6)
 M app/solutions/freelancer-project-management-software/page.test.tsx     <- pre-existing, Calendar discovery phase (§16), untouched this turn
 M app/solutions/freelancer-project-management-software/page.tsx          <- pre-existing, Calendar discovery phase (§16), untouched this turn
 M docs/Text2Task_SEO_Master_Blueprint_2026-08-29.docx                    <- cumulative
 M docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md                      <- cumulative
?? app/components/landing/landing-footer.test.tsx                        <- pre-existing, Calendar discovery phase (§16), untouched this turn
?? app/features/ai-task-extractor/page.test.tsx                          <- pre-existing, P3 (§18), untouched this turn
?? app/features/project-deadline-calendar/page.test.tsx                  <- THIS TURN (blocker fix, new test file, §20.7)
```

This turn's own diff is exactly 2 files: 1 modified (`page.tsx`, metadata block only), 1 new (`page.test.tsx`). Every pre-existing entry was confirmed unchanged.
