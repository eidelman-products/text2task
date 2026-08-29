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

**Status update (2026-08-29, later same day):** the P1 pre-implementation mapping/audit this section previously called for is now **COMPLETE** — see **Section 11**. The route `/features/client-project-tracker` has **NOT** been created. No production code was changed during the mapping phase; only this document was updated.

> **NEXT PLANNED IMPLEMENTATION PHASE: P1A — Client Project Tracker Feature Page (core build)**
> - **Candidate route:** `/features/client-project-tracker`
> - **Primary keyword:** client project tracker
> - **Page type:** Feature (matches the existing 5-Feature-page pattern)
> - **Full spec:** Section 11 (this document)

**Before implementation, the next session must:**

1. Re-read Section 11 in full — chosen architecture reference, verified Client Share capability matrix, exact content blueprint, portal-language rules, schema/sitemap/test plans, and file map are all already decided.
2. Implement exactly the P1A file set listed in §11.13 — no more, no less, unless a new audit finding requires otherwise.
3. Follow the portal-language SAFE / CONDITIONAL / AVOID rules in §11.6 verbatim; do not introduce new marketing language not covered there without flagging it first.
4. Run the full verification ritual established throughout this project: `npx tsc --noEmit`, `npm run build`, targeted ESLint, `git diff --check`.
5. Stop after P1A and report for review before proceeding to P1B (broader internal linking) or P1C (visual enhancement) — see §11.14.

**The next Claude session should begin exactly here — Section 10 — after first re-reading Section 11 in full, and Sections 4, 5, and 6 for the underlying product-truth and cannibalization context.**

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

> **Next action:** Implement P1A exactly as specified in §11.5, §11.6, §11.7, §11.8, §11.12, and §11.13 — pending explicit user approval to begin implementation. No file has been created or modified as part of this mapping phase.
