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

This file is self-contained and does not assume access to prior chat history. Read **Section 10** first if you only need to know where to resume work. Sections 1–9 are the full reference: positioning, completed technical work, keyword ownership, the Client Share decision, cannibalization rules, linking architecture, implementation history, priorities, and an explicit do-not-create list.

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
| Email — Commercial | email to task | email task management; email to task app | Keyword Planner: ~50/mo, Low competition, meaningful commercial bid range. | Commercial, tool-specific | `/features/email-to-tasks` | Feature | High | Low (H1 phrasing softly echoes the Resource's phrase — cosmetic only) | Validated / stable | P1/P2: tighten H1 toward commercial framing |
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
| Use Case — Web Designers vs. Revisions Resource | (audience-specific) | web designers; manage client revisions | GSC: manage-client-revisions-web-designers ~16 impr., avg. pos. ~15.2 (queries hidden). Use Case is mostly branded traffic. | Audience fit vs. informational how-to — same audience+problem combo | `/use-cases/web-designers` AND `/resources/manage-client-revisions-web-designers` | Use Case + Resource | Low | Medium-High — unresolved | Flagged, not yet resolved | P2: deliberate content differentiation pass |

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
- Email Feature H1 commercial-framing differentiation.
- General internal-linking improvements identified in §6.1.

**P2**
- Client Project Tracker ↔ Client Feedback to Tasks direction-explicit cross-links.
- Web Designers Use Case vs. Revisions Resource differentiation pass (§5, rule 7).
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

> **NEXT PLANNED IMPLEMENTATION PHASE: P1 — Client Project Tracker Feature Page**
> - **Candidate route:** `/features/client-project-tracker`
> - **Primary keyword:** client project tracker
> - **Page type:** Feature (matches the existing 5-Feature-page pattern)

**Before implementation, the next session must:**

1. Inspect the existing Feature page architecture (all 5 current Feature pages) to reuse established components/conventions rather than inventing a new pattern.
2. Define metadata (title, description, canonical) and H1 content — must not overstate the product (§4.2).
3. Define the exact content structure, grounded strictly in the product truth in §4.1.
4. Define schema (WebPage + BreadcrumbList, matching the established convention — see §2.1's fix for what NOT to do: no invalid SoftwareApplication).
5. Define sitemap inclusion (add to the `featureRoutes` array in `app/sitemap.ts`, matching existing priority/changeFrequency conventions).
6. Define internal links per §6.2 (Homepage, Freelancer Solution, Client Feedback to Tasks, relevant Use Cases) — natural anchors only, no stuffing.
7. Add regression coverage where appropriate, following the pattern already established for other pages in this codebase (structured-data tests, redirect tests) — no test convention currently exists specifically for Feature-page content, so this is a judgment call for that session, not a rule to blindly apply.

**The next Claude session should begin exactly here — Section 10 — after first re-reading Sections 4, 5, and 6 for full context on product truth, cannibalization boundaries, and linking requirements.**
