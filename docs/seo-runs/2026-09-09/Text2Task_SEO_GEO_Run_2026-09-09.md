# Text2Task SEO + GEO + AEO Run — 2026-09-09

**STATUS: ACTIVE**
**RUN START DATE: 2026-09-09**
**TIMEZONE: Asia/Jerusalem**
**CURRENT PHASE: Phase 1 — IMPLEMENTATION**
**PHASE 0A STATUS: COMPLETE / OWNER REVIEWED**
**PHASE 0B STATUS: COMPLETE / OWNER REVIEWED**
**PHASE 0 OVERALL: COMPLETE / OWNER REVIEWED**
**PHASE 1 STATUS: IMPLEMENTATION IN PROGRESS**
**PHASE 1 IMPLEMENTATION: MILESTONE 1 PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**
**PHASE 1 MILESTONE 2: PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**
**PHASE 1 MILESTONE 3: NOT STARTED**

Companion file: `Text2Task_SEO_GEO_Run_2026-09-09.docx` (formatted, distributable Source of Truth — this Markdown file is the version-controllable editable source; both are maintained together for this run only).

This document belongs only to the 2026-09-09 run. It does not overwrite or supersede `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` ("the Blueprint"), which remains the historical implementation record for the SEO package shipped 2026-08-26 → 2026-09-01. Where this run's fresh verification confirms, updates, or contradicts a Blueprint claim, that is recorded explicitly in §25 (Prior Audit Reconciliation) rather than silently assumed.

Phase 1 Milestone 1 implementation changed application code and tests through PR #2. The implementation PR has now been merged to `main` and deployed by Vercel Production. The current closeout update records documentation-only evidence. No database schema, migration, environment variable, Vercel configuration, Google/Bing/Supabase production setting, manual production deploy, or production configuration change was performed by this documentation task.

Owner-review update recorded 2026-09-10 00:38 Asia/Jerusalem: Phase 0A (Repository Mapping + Technical Audit) is complete and owner-reviewed, but Phase 0 overall is not complete. The current phase is Phase 0B (External Baseline Completion). Phase 1 implementation has not started. Historical `2026-09-09/10` timestamps in this document are retained as originally recorded; exact timestamp not captured.

Phase 0B update recorded 2026-09-10 00:57 Asia/Jerusalem: GA4 live collection and the shared Google-tag destination architecture were externally verified from Google Analytics Admin evidence supplied by the owner. Later Phase 0B work completed the remaining external baseline checks.

Phase 0B update recorded 2026-09-10 01:30 Asia/Jerusalem: GSC Core Web Vitals field baseline and PageSpeed Insights homepage lab baseline were recorded from owner-supplied external evidence. Later Phase 0B work recorded GSC Links, Manual Actions, Security Issues, Bing Webmaster Tools baseline/setup, IndexNow status/setup, and the external authority/profile/entity footprint baseline.

Phase 0B update recorded 2026-09-10 01:51 Asia/Jerusalem: Google Search Console Links baseline was recorded from owner-supplied external evidence. Later Phase 0B work recorded GSC Manual Actions, GSC Security Issues, Bing Webmaster Tools baseline/setup, IndexNow status/setup, and the external authority/profile/entity footprint baseline.

Phase 0B update recorded 2026-09-10 01:56 Asia/Jerusalem: Google Search Console Manual Actions and Security Issues baselines were recorded from owner-supplied external evidence. Later Phase 0B work recorded Bing Webmaster Tools baseline/setup, IndexNow status/setup, and the external authority/profile/entity footprint baseline.

Phase 0B update recorded 2026-09-13 13:06 Asia/Jerusalem: Bing Webmaster Tools onboarding, Bing sitemap submission, IndexNow setup-path baseline, Bing AI Performance baseline, and Bing Backlinks pending-processing baseline were recorded from owner-supplied external evidence. At that point, external authority/profile/entity footprint was still pending; it was completed in the 2026-09-13 13:17 Asia/Jerusalem update below.

Phase 0B completion update recorded 2026-09-13 13:17 Asia/Jerusalem: the external authority/profile/entity footprint baseline was recorded from owner-supplied external research. Phase 0B is now complete / owner-reviewed, and Phase 0 overall is complete / ready for Phase 1 planning. Bing Backlinks/Search Performance/Site Explorer remain a scheduled follow-up because Bing is still processing the newly onboarded property; this follow-up does not block Phase 0 completion.

Phase 1 planning update recorded 2026-09-13 13:26 Asia/Jerusalem: a Phase 1 Master Implementation Plan was added to this run document. Phase 0 remains complete / owner-reviewed. Phase 1 is now planning; implementation has not started.

Phase 1 Milestone 1 update recorded 2026-09-13 15:12:33 Asia/Jerusalem and correction pass recorded 2026-09-13 16:55:06 Asia/Jerusalem: Measurement Foundation was implemented locally on branch `feat/seo-measurement-foundation` from baseline commit `92050bd1d21111192157bd3b8305861fb9208192`, then corrected after the pre-commit owner review gate. The local implementation added production-grade, server-authoritative, idempotent `first_extract_created`, `project_saved`, and `paid_conversion` analytics using the existing `analytics_events` pipeline. No database migration was required. Local tests/typecheck/changed-file lint/build completed as recorded in §40. At that time, production verification had not started.

Pre-merge Preview verification update recorded 2026-09-13 18:59:27 Asia/Jerusalem: PR #2 (`Phase 1: add SEO funnel measurement foundation`) existed for implementation commit `10846aa0c9dfc7a2f6a2a215374d75eb6a5103f6`, and Vercel created a READY Preview deployment for branch `feat/seo-measurement-foundation`. Owner-verified Vercel environment isolation confirmed Preview used the separate `text2task-staging` Supabase project, not Production Supabase. Preview/Staging runtime checks passed for first text extraction, `first_extract_created`, first project save / `project_saved`, and second-extraction deduplication. Manual image extraction runtime verification was deferred by owner as non-blocking. Manual `paid_conversion` runtime verification was deferred pending a safe Creem verification strategy. At that gate, Milestone 1 was preview verified and owner approved for merge review; production verification had not started.

Production closeout update recorded 2026-09-14 11:58:23 Asia/Jerusalem: PR #2 (`Phase 1: add SEO funnel measurement foundation`) was merged successfully to `main` as merge commit `b3e372c`. Vercel Production deployment for environment `Production`, branch `main`, commit `b3e372c` reached READY. The owner manually performed a post-deployment production smoke test on `https://www.text2task.com/` and verified Homepage, Dashboard, Extract, Tasks, and Calendar load and function normally. Result: PASS — no user-visible regression observed. Manual Production Image Extract runtime verification, manual Production `paid_conversion` verification, production `paid_conversion` row verification, production `first_extract_created` re-verification, and production `project_saved` re-verification were not performed in this production gate. Image Extract manual runtime remains DEFERRED / NON-BLOCKING. `paid_conversion` manual runtime remains DEFERRED / SAFE VERIFICATION REQUIRED.

Phase 1 Milestone 2 mapping update recorded 2026-09-14 12:57:49 Asia/Jerusalem: Entity / Brand Disambiguation mapping has started as audit/planning only. Current source confirms strong product/category/domain signals and a meaningful external footprint, but on-site founder/person identity remains absent, `Person` schema remains absent, and `Organization.sameAs` currently includes only company Facebook and company LinkedIn. Brand disambiguation strength is **PARTIAL**: enough signals exist to understand `text2task.com` as a freelancer/small-team SaaS, but the founder/person relationship and expanded canonical external profile graph require owner decisions before implementation. Milestone 2 is not implemented.

Phase 1 Milestone 2 implementation update recorded 2026-09-14 13:56:50 Asia/Jerusalem: the owner made a deliberate privacy decision to keep founder identity private for now. No founder name, no `Person` schema, no founder metadata, no personal-profile `sameAs`, and no personal social/profile link were added. Milestone 2 was implemented locally on branch `feat/seo-entity-disambiguation` by strengthening Text2Task's canonical Organization/product/domain signals only: shared site constants now define the canonical brand name, URL, logo, and description; homepage `Organization`/`WebSite` JSON-LD uses those constants; root metadata uses the canonical description and brand constants; the About page now visibly identifies `text2task.com` as the official Text2Task product site without naming the founder; and tests lock the allowed company-only `sameAs` inventory and the absence of `Person`/founder schema. Production remains unchanged.

Phase 1 Milestone 2 production closeout update recorded 2026-09-14 18:08:27 Asia/Jerusalem: PR #4 was merged successfully to `main` as production merge commit `80b3318`. Vercel Production reached READY. Owner manual Production smoke verification passed: Homepage loads correctly; About page loads correctly; the new "ABOUT TEXT2TASK" eyebrow is live; the new About opening paragraph is live; existing About photos remain; founder personal name is not published; no `Person` schema was intentionally added; no personal social/profile links were introduced; no visible regression was observed in the reviewed About sections; and the owner privacy decision remains preserved. Milestone 2 is now production deployed, production smoke verified, and complete. Milestone 3 has not started.

---

## 1. Cover / Run Metadata

| Field | Value |
|---|---|
| Product | Text2Task (www.text2task.com) — Next.js 16.1.6 App Router, Supabase, Vercel |
| Run date | 2026-09-09 |
| Timezone | Asia/Jerusalem |
| Phase | Phase 1 — IMPLEMENTATION |
| Phase 0A status | COMPLETE / OWNER REVIEWED |
| Phase 0B status | COMPLETE / OWNER REVIEWED |
| Phase 0 overall | COMPLETE / OWNER REVIEWED |
| Phase 1 status | IMPLEMENTATION IN PROGRESS |
| Phase 1 implementation | MILESTONE 1 PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE |
| Phase 1 Milestone 2 | PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE |
| Phase 1 Milestone 3 | NOT STARTED |
| Author | Claude Code (Sonnet 5), directed by the site owner |
| Repository | `C:\Users\Home\projects\inboxshaper` (git branch `main`, clean at run start) |
| Prior internal reference | `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` (found in repo, read in full, used for reconciliation) |
| Named prior audit files | `Text2Task_SEO_GEO_AEO_Master_Audit_2026-09-09_HE(1).docx` and `text2task_full_audit.docx` — **searched for and NOT FOUND** anywhere in the workspace or filesystem. Their claims could not be independently inspected in this run; see §25. |
| Application code changed | YES — Phase 1 Milestone 1 implementation and Phase 1 Milestone 2 implementation through merged PRs; this documentation closeout changed no application code |
| Production changed | YES — PR #2 and PR #4 were merged and Vercel Production deployed before their respective documentation closeouts; this documentation task changed no Production configuration |
| Commit/push/deploy performed | PR #4 merge and automatic Vercel Production deployment already occurred before this documentation closeout; this documentation task performs no commit, push, or deploy |

---

## 2. Executive Summary

Text2Task's technical SEO foundation is materially healthier than a surface read of the GSC baseline suggests: the sitemap, robots policy, canonical/host redirect chain, admin/private-route access control, and the core structured-data architecture (Organization/WebSite/WebPage/BreadcrumbList/FAQPage/Article, with `SoftwareApplication` and rating/review schema deliberately and correctly never fabricated) are all confirmed correct and live. The 33-URL sitemap exactly matches the 33 "discovered" pages GSC reported. Admin routes are genuinely protected by server-side owner-email auth (not just `robots.txt`), and the Client Share/`share/[publicId]` surface has a real, re-verified-per-request server-side access gate, not a client-side one.

The real, evidence-backed problems are narrower and more specific than "the site has no SEO":

1. **Two of the four newly-flagged Use Case pages are hub-only / contextually isolated, not literal orphan pages** (`freelance-developers`, `seo-freelancers`). They are linked from the real SSR `/use-cases` hub, but have zero additional contextual inbound links from the homepage, footer, Features, Solutions, Resources, or sibling use-case pages. They also have the thinnest content of any use case on the site (missing the "visual differentiation layer" — transformation example, signature module, proof, related-links — that 8 of 12 use cases have). This plausibly explains, at the level the repository can speak to, why Google discovered but did not prioritize crawling/indexing them.
2. **No founder/Person entity exists anywhere** — no full name, no Person schema, no personal professional profile link. Given the confirmed unrelated Microsoft Marketplace product sharing the "Text2Task" name, this is a real, verified entity-disambiguation gap, not a hypothetical one.
3. **The acquisition funnel had a real measurement blocker past signup, and Phase 1 Milestone 1 is now production deployed and production smoke verified**: the P0 measurement items are `paid_conversion` from the authoritative Creem confirmed-payment webhook path, `first_extract_created`, and `project_saved`. `email_confirmed` remains P1. `client_update_created` and `client_update_applied` remain P2/product analytics. Production event-row re-verification was not performed in the production smoke gate, and `paid_conversion` manual runtime verification still requires a safe Creem strategy.
4. **GA4 live collection is now externally VERIFIED**: Google Analytics Admin evidence supplied by the owner showed the `Text2Task Website` web stream for `https://www.text2task.com` (Stream ID `14978713002`, Measurement ID `G-TP2F4HWZN4`) with "Data collection is active in the past 48 hours" and "Data flowing." Enhanced Measurement is enabled. The shared Google-tag architecture is also externally verified: Google tag `AW-670652067` sends data to both the Google Ads destination `AW-670652067` and the Google Analytics destination `Text2Task Website`, with tag quality `Good`. No GA4 application-code change is required.
5. **Core Web Vitals field data is unavailable, and PageSpeed lab data shows no demonstrated site-wide SEO performance blocker**: GSC reported "Not enough usage data in the last 90 days for this device type" for both Mobile and Desktop. PageSpeed Insights homepage lab results are strong overall, with Desktop Performance 99 and Mobile Performance 88, but Mobile LCP is materially weaker at 3.8s and the approximately 15 MB homepage demo video is the dominant performance anomaly. This is a targeted P1 Performance/CRO candidate, not evidence of broken performance architecture and not enough to explain the current non-brand average position around 78 by itself.
6. **GSC Links baseline now independently supports authority as a major constraint, but Text2Task does have an early external footprint**: Google Search Console currently reports 3 external link URLs from 2 linking domains, all pointing to the homepage, with no externally-linked Feature/Solution/Resource money page surfaced in this report. External research also verified current Text2Task surfaces across LinkedIn, GetApp, Capterra, Uneed, Peerlist, StartupFortune, SaaSHub, UIComet, and FounderDB / Peer Push discovery data. The problem is not total absence of mentions; the current weakness is limited referring-domain diversity, limited externally recognized link authority, almost no external links to high-value topic/money pages, and limited independent editorial/reference coverage.
7. **GSC Manual Actions and Security Issues are now externally VERIFIED with no issues detected**: Google Search Console currently reports no manual action and no security issue for the Text2Task property. This should not be overstated as proof that every SEO issue is absent or as a complete security audit.
8. **Bing Webmaster Tools onboarding is now configured/verified, with Bing data still processing**: Text2Task has been added to Bing Webmaster Tools as `text2task.com`; `https://www.text2task.com/sitemap.xml` was submitted successfully on 2026-09-13 and initially showed Processing. Initial 0 discovered URLs and no last crawl are expected at this stage and are not an indexing defect. IndexNow setup path was verified, but application implementation has not started. Bing AI Performance currently reports 0 citations and 0 cited pages for the selected 3-month period; do not claim Copilot has never mentioned Text2Task. Bing Backlinks shows data not yet available / pending processing; do not record this as 0 backlinks.
9. **External founder/entity evidence exists, and the owner privacy decision is now closed for this milestone**: indexed external surfaces associate the founder with Text2Task, but the Text2Task website intentionally does not publicly name the founder. The owner has decided not to publish founder identity at this time, so Milestone 2 strengthens Organization/product/domain/profile signals without adding `Person` schema, `Organization.founder`, founder metadata, or personal-profile links.
10. **The Text2Task name collision remains real and externally verified**: the unrelated older Microsoft Marketplace product named "Text2Task" by Target Energy Solutions remains live, is an Outlook/email assistant for enterprise employees, and is unrelated to `text2task.com`. This continues to support the existing HIGH/P0 entity-disambiguation priority.
11. A set of smaller, real, low-risk consistency gaps remains, but owner review corrected their priority: contextual internal-link/content-depth strengthening and Bing/IndexNow foundation are P1; OG/Twitter image completion, homepage `FAQPage` schema consistency, breadcrumb/date consistency, billing API cache headers, robots.txt crawl-courtesy completeness, and client-update analytics are P2.

No P0 finding in this audit is a live security breach, a broken redirect, or an actual indexing catastrophe — the sitemap/robots/canonical/admin-auth architecture is sound. At Phase 0, the confirmed P0s were the founder/entity-disambiguation decision and the core measurement blockers (`paid_conversion`, `first_extract_created`, `project_saved`), rather than "the site is currently broken." Phase 1 Milestone 1 is now production deployed, production smoke verified, and complete, with the explicitly deferred runtime follow-ups preserved.

---

## 3. Business Goal

Restated from the run brief, unchanged: the objective is not an SEO score. It is to grow Google non-brand visibility → rankings → organic clicks → Live Demo usage → signups → activated users → paying users, while making Text2Task a clearly-understood, trustworthy entity that Google Search, Google Generative AI features, ChatGPT Search, Bing/Copilot, and other AI answer engines can surface, cite, or recommend accurately — distinct from the unrelated, pre-existing "Text2Task" product on the Microsoft Marketplace.

---

## 4. Known Baseline Before Changes

Recorded exactly as supplied by the site owner from Google Search Console on 2026-09-09. No repository data was used to produce these numbers; they are external, owner-supplied, and treated as ground truth for this section. GSC's own UI is known to present partial/sampled data in some table views — this limitation is inherited, not resolved, by this document.

---

## 5. Google Search Console Baseline

**Web Search — last 3 months (all queries, including brand):**

| Metric | Value |
|---|---|
| Total clicks | 37 |
| Total impressions | 909 |
| Average CTR | 4.1% |
| Average position | 49 |

**Visible non-brand report (Text2Task brand variants excluded):**

| Metric | Value |
|---|---|
| Impressions | 361 |
| Clicks | 0 |
| CTR | 0% |
| Average position | 78.1 |

**Confirmed conclusion carried into this run unchanged:** this is a **non-brand ranking problem**, not primarily a CTR problem. Brand-query volume was materially inflating some page-level average positions that look strong until brand traffic is excluded.

**Major confirmed non-brand page opportunities (owner-supplied):**

| Page | Non-brand impressions | Avg. position |
|---|---|---|
| `/solutions/freelancer-project-management-software` | 171 | ~81.1 |
| `/features/email-to-tasks` | 94 | ~79.5 |
| `/resources/how-to-turn-emails-into-tasks` | 31 | ~77.6 |
| `/use-cases/wordpress-freelancers` | 27 | ~74.0 |

All four pages were independently confirmed to exist, to be included in `app/sitemap.ts`, and to carry real, non-templated, page-specific metadata and structured data in this audit (see §9, §14, §15). None of these four pages have a code-level defect that would explain a ~75–81 average position on their own — the gap here is competitive/authority/content-depth, which is outside what a repository audit alone can diagnose, and is correctly deferred to Phase 1 content/authority work rather than a technical fix.

---

## 6. Google Generative AI Baseline

Owner-supplied GSC Generative AI report: **28 impressions over 3 months**, with the homepage accounting for the large majority (24 of 28 page impressions at `https://www.text2task.com/`). Other pages have also appeared, though per-page Generative-AI impressions are known to overlap and should not be summed against the report total.

**Confirmed conclusion:** Text2Task already has observed visibility in Google's Generative AI features. AI visibility is not purely theoretical for this site — it is a real, if currently thin, starting signal. This weakly but genuinely supports treating GEO/AEO work as continuous with SEO rather than speculative.

---

## 7. Indexing Baseline

Owner-supplied GSC Page Indexing report: **29 indexed, 18 not indexed** (47 total known URLs — a wider set than the 33-URL sitemap, consistent with GSC's known behavior of also tracking legacy/non-content URLs such as the historical `/index.html` artifact, static/Next.js asset requests, and non-www crawl artifacts, none of which are current content pages; see §12/§25).

Submitted sitemap: `https://www.text2task.com/sitemap.xml` — Status: Success, Discovered pages: **33**, Submitted Aug 30 2026, Last read Aug 30 2026. **This audit independently recomputed the code-driven sitemap's URL count from `app/sitemap.ts` and `getAllUseCases()` and confirmed it is exactly 33** (6 static public routes + 12 use cases + 8 resource routes + 1 solution + 6 features = 33) — CONFIRMED, an exact match to GSC's discovered-page count, with no drift.

**Four public SEO URLs were "Discovered — currently not indexed"** on 2026-09-09 and were submitted to Google's priority crawl queue that day (not repeated in this audit, per instruction):

- `/use-cases/freelance-developers`
- `/use-cases/seo-freelancers`
- `/use-cases/shopify-freelancers`
- `/use-cases/video-editors`

A Live URL Test for `/use-cases/freelance-developers` showed **Breadcrumbs — 1 valid item detected**, already establishing before this audit began that the prior "zero structured data" claim (see §25) does not hold. This audit's own §15 structured-data inventory independently confirms breadcrumb (and WebPage, and FAQPage) JSON-LD is present and code-verified on every one of the 12 use-case pages, including all four flagged ones.

"Crawled – currently not indexed" entries inspected by the owner were mostly Next.js/static resources, favicon, and a historical non-www URL — not rejected public SEO content pages. This audit's own git-history and code review (§25) independently corroborates that no content page has a code-level noindex, canonical, or duplicate-content defect that would explain a legitimate content page being crawled-but-rejected.

---

## 8. Repository Architecture Map

- **Framework**: Next.js 16.1.6, App Router, React 19.2.3, TypeScript, Tailwind v4. `package.json` — no SEO/DOCX-generation package was added or modified for this audit (see §35).
- **Middleware**: `proxy.ts` at repo root — Next.js 16 renamed `middleware.ts` to `proxy.ts`; this is the actual site middleware (matcher: everything except `_next/static`, `_next/image`, `favicon.ico`). Confirmed by direct read, in full (`proxy.ts:1-164`).
- **Auth**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`), cookie-based sessions, checked both in `proxy.ts` (dashboard gate) and independently in several server components (owner gate, homepage-demo claim gate, some dashboard pages — see §11).
- **Billing**: Creem (not Stripe) — `app/api/webhooks/creem/route.ts`, `app/api/billing/{portal,subscription}/route.ts`.
- **Database**: Supabase Postgres. Analytics tables `analytics_events` (marketing/funnel, service-role-only) and `authenticated_product_events` (in-app usage) confirmed via `supabase/migrations/202609040001_canonical_production_closure.sql`.
- **Public marketing surface**: `app/page.tsx` (homepage), `app/about`, `app/contact`, `app/terms`, `app/privacy`, `app/pricing` (redirect only), `app/use-cases` (hub) + `app/use-cases/[slug]` (12 data-driven detail pages, registry in `app/lib/use-cases/index.ts`), `app/resources` (hub) + 7 resource articles, `app/solutions/freelancer-project-management-software` (1 page), `app/features/*` (6 pages, no hub).
- **Private/product surface**: `app/dashboard/*`, `app/admin/*`, `app/api/*`, `app/auth/confirm`, `app/login`, `app/signup`, `app/check-email`, `app/forgot-password`, `app/reset-password`, `app/homepage-demo/*`, `app/share/[publicId]`.
- **Shared SEO/schema infrastructure**: `app/lib/site-config.ts` (canonical origin `https://www.text2task.com`, social `sameAs` links, `absoluteUrl()` helper), `app/lib/schema.ts` (entity `@id` constants, `buildBreadcrumbListJsonLd`, `buildArticleJsonLd`, `buildWebPageEntityId` — no `SoftwareApplication` id, no Person builder), `app/components/JsonLd.tsx` (shared JSON-LD renderer), `app/sitemap.ts`, `app/robots.ts`.
- **Analytics infrastructure**: `app/components/analytics/*` (Google Ads tag/GA4 destination, Microsoft Clarity, Vercel Analytics/Speed Insights, attribution capture, cookie consent), `lib/analytics/*` (internal event write path, owner-traffic exclusion, signup attribution), `app/admin/analytics/*` (owner-only reporting UI).
- **Existing internal SEO reference document**: `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` — 1,730 lines, dated 2026-08-29, last reconciled 2026-09-01, documents the full P0/P1/P2/P3 SEO package that shipped between 2026-08-26 and 2026-09-01 (commit `58cb7ef` and predecessors). Read in full for this audit; see §25.

---

## 9. Public URL Inventory

All 33 sitemap URLs, grouped, with generation mechanism. "Template" = shared rendering component driven by a per-item data file; "Static" = one dedicated `page.tsx`.

| Group | Routes | Count | Generation |
|---|---|---|---|
| Homepage | `/` | 1 | Static — `app/page.tsx` |
| Use Cases (hub) | `/use-cases` | 1 | Static — `app/use-cases/page.tsx`, data-driven listing |
| Use Cases (detail) | `/use-cases/web-designers`, `wordpress-freelancers`, `webflow-freelancers`, `shopify-freelancers`, `freelance-developers`, `seo-freelancers`, `graphic-designers`, `social-media-managers`, `video-editors`, `project-managers`, `virtual-assistants`, `small-agencies` | 12 | Template — `app/use-cases/[slug]/page.tsx` + `app/components/use-cases/use-case-detail-page.tsx` + one data file per slug in `app/lib/use-cases/cases/*.ts` |
| Resources (hub) | `/resources` | 1 | Static — `app/resources/page.tsx` |
| Resources (articles) | `how-to-turn-client-feedback-into-tasks`, `how-to-turn-emails-into-tasks`, `how-to-turn-screenshots-into-tasks`, `how-to-extract-action-items-from-text`, `how-to-organize-client-requests-as-a-freelancer`, `manage-client-revisions-web-designers`, `turn-client-messages-into-tasks` | 7 | Static, one dedicated `page.tsx` each |
| Solutions | `/solutions/freelancer-project-management-software` | 1 | Static — no Solutions hub exists (only 1 page) |
| Features | `email-to-tasks`, `screenshot-to-tasks`, `ai-task-extractor`, `client-feedback-to-tasks`, `project-deadline-calendar`, `client-project-tracker` | 6 | Static, one dedicated `page.tsx` each — **no Features hub page exists** (confirmed: `app/features/page.tsx` not found; the "Features" breadcrumb node on `client-feedback-to-tasks` points to the homepage anchor `/#features` rather than a real hub, since there is no hub) |
| About | `/about` | 1 | Static |
| Pricing | `/pricing` | 0 in sitemap | `app/pricing/page.tsx` is a bare `permanentRedirect("/#pricing")` — not a real indexable page, correctly absent from `app/sitemap.ts` |
| Contact | `/contact` | 1 | Static |
| Legal | `/privacy`, `/terms` | 2 | Static |
| **Total in sitemap** | | **33** | Recomputed and CONFIRMED exact match to GSC's "Discovered pages: 33" |

**Comparison against sitemap / flags:**
- **No public route is missing from the sitemap.** `/pricing` is correctly excluded (it 308-redirects, per §13). No other public page.tsx was found outside the 33 sitemap URLs.
- **No non-public route is accidentally included** — `app/sitemap.ts` (`app/sitemap.ts:89-156`) is a hand-written static array plus one dynamic call, `getAllUseCases()`, which is itself a static, code-level, non-database array (`app/lib/use-cases/index.ts:100-102`). There is no dynamic enumeration of dashboard paths, Client Share links, or any database table — CONFIRMED no path exists for user-generated or private content to leak into the sitemap.
- **No duplicate route variants** were found.
- **Hub-only / contextually isolated pages — CONFIRMED, real finding**: `/use-cases/freelance-developers` and `/use-cases/seo-freelancers` are linked from the real SSR `/use-cases` hub, so they are not literal orphan pages. They have zero additional contextual inbound links from the homepage, footer, Features, Solutions, Resources, or sibling use-case pages. See §19 for full detail and evidence.
- **Weakly-linked pages**: `/use-cases/shopify-freelancers` (exactly one inbound link, itself from the hub-only/contextually isolated `seo-freelancers`); 8 of 12 use cases are unreachable from the homepage entirely (only 6 are homepage-linked); the Resources hub has zero outbound links into Use Cases, Features, or Solutions.

---

## 10. Technical SEO Audit

### 10.1 `robots.txt`

Generated by `app/robots.ts` (Next.js metadata route). Live-verified via `curl https://www.text2task.com/robots.txt` on 2026-09-09/10 — **output matches the source file exactly, byte-for-byte in policy terms**:

```
User-agent: *
Allow: /
Allow: /use-cases
Allow: /use-cases/
Allow: /contact
Allow: /about
Allow: /privacy
Allow: /terms
Disallow: /api/
Disallow: /auth/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /admin/
Disallow: /share
Disallow: /share/
Host: https://www.text2task.com
Sitemap: https://www.text2task.com/sitemap.xml
```

There is a single `userAgent: "*"` rule set — **CONFIRMED no separate policy exists for Googlebot, Bingbot, OAI-SearchBot, or GPTBot**; all four inherit the same wildcard rule. Since the rule set contains no blanket `Disallow: /`, and robots.txt's default behavior is to allow any path with no matching rule, `/solutions/*`, `/features/*`, and `/resources/*` are crawlable by all of these agents even though they are not explicitly named in the `allow` list — CONFIRMED via the actual generated file plus the live production page load. Important AEO-relevant conclusion (§21): **no technical rule in this repository blocks OAI-SearchBot or GPTBot from any public content page** — they receive exactly the same access as Googlebot and Bingbot.

`/dashboard`, `/admin/`, `/share`, `/api/`, `/auth/` are disallowed. Per the run's own instruction, this is treated as a crawl-courtesy signal only, not a security control — the actual protection for each of these families is audited independently in §11.

**Confirmed minor gap (P2, informational)**: the disallow list does not include `/login`, `/signup`, `/check-email`, `/forgot-password`, `/reset-password`, or `/homepage-demo/`, even though every one of those pages independently sets its own `robots: {index:false, follow:false}` meta tag (§11). This has no live indexing consequence — the per-page meta tag is the actual control and is present and correct everywhere it's needed — but adding these paths to the disallow list would reduce unnecessary crawl attempts at zero cost.

### 10.2 Legacy redirect

`next.config.ts` contains exactly one `redirects()` rule: `/index.html` → `/` (308, permanent) — added 2026-08-26 to resolve a legacy GSC 404 report for a static-site artifact with zero internal references. **Live-verified 2026-09-09/10**: `curl -I https://www.text2task.com/index.html` → `308` → `https://www.text2task.com/`. No `middleware.ts`/`proxy.ts` redirect and no `vercel.json` redirect rule exist that could create a second, competing redirect mechanism — CONFIRMED, only one redirect() entry exists in the whole config.

### 10.3 GEO / AI-crawler eligibility

See §21 for the full assessment — summary: no repository-level rule restricts OAI-SearchBot, GPTBot, or Bingbot from any public page; all public SEO content is served as plain, unauthenticated, server-rendered HTML with no JS-only rendering gate that would prevent a non-JS-executing crawler from reading the content.

---

## 11. Private Route / Indexing Safety Audit

This section is both a security and an SEO audit, per the run's framing that `robots.txt` alone never makes private content safe. Every item below was independently verified against source; "live-verified" items were also checked with a real HTTP request on 2026-09-09/10.

### 11.1 `/admin/*` — CONFIRMED PROPERLY PROTECTED

- `app/admin/layout.tsx:4-8` sets `metadata.robots = { index: false, follow: false }` for the whole subtree.
- Every admin page — `app/admin/analytics/page.tsx:1246`, `app/admin/analytics/users/page.tsx:191`, `app/admin/analytics/users/[userId]/page.tsx:132` — calls `await requireOwner()` (`lib/auth/owner.server.ts:22-32`) as the **first** statement in the async server component, before any data is read. `requireOwner()` checks Supabase `auth.getUser()` and an email allowlist (`TEXT2TASK_OWNER_EMAILS` env var via `isOwnerEmail()`); on failure it calls Next.js `notFound()` — a real 404, not merely a redirect. Regression tests assert the call ordering directly.
- **Live-verified**: `curl -s -o /dev/null -w "%{http_code}" https://www.text2task.com/admin/analytics` → **404**, confirming the production behavior matches the source.
- This is real, server-side, defense-in-depth authentication — not merely a `robots.txt` disallow. CONFIRMED SAFE, no action needed.

### 11.2 `/dashboard/*`

- `app/dashboard/layout.tsx:4-9` sets subtree-wide `robots: {index:false, follow:false}`.
- `app/dashboard/page.tsx:11` and `app/dashboard/calendar/page.tsx:18` call `await requireDashboardUser()` (`lib/supabase/requireDashboardUser.ts:13-30`) — real server-side auth in addition to `proxy.ts`'s redirect.
- **CONFIRMED GAP (P1)**: `app/dashboard/billing/page.tsx` and `app/dashboard/profile/page.tsx` are `"use client"` components with **no server-side auth call at all**. They render immediately client-side and only discover an unauthenticated state via a `fetch("/api/billing/subscription")` call that redirects to `/login` on a 401 response. Independently re-confirmed by direct read of `app/dashboard/billing/page.tsx:1-70` in this audit. Every other dashboard route double-gates (middleware + server component); these two rely on `proxy.ts`'s path-prefix check alone. Not directly exploitable today (the middleware gate is real and currently correct), but a single point of failure if `proxy.ts`'s matcher or prefix logic is ever refactored. Recommended fix (Phase 1): add the same `requireDashboardUser()` server-side call these two pages are missing, or convert their outer shell to a server component wrapper.

### 11.3 `/login`, `/signup`, `/check-email`, `/forgot-password`, `/reset-password` — CONFIRMED SAFE

Every one of these explicitly sets `robots: {index:false, follow:false, googleBot:{index:false, follow:false}}` (`app/login/page.tsx:12-21`, `app/signup/layout.tsx:4-13`, `app/check-email/layout.tsx:4-13`, `app/forgot-password/page.tsx:6-15`, `app/reset-password/page.tsx:7-16`). No contradictions found.

### 11.4 `/auth/confirm` — CONFIRMED SAFE

A route handler (`app/auth/confirm/route.ts:32-129`), not a page — every code path ends in `NextResponse.redirect(...)`. It can never render indexable HTML regardless of headers.

### 11.5 `/homepage-demo/*`

- `/homepage-demo/review`: `proxy.ts:74-82` sets `X-Robots-Tag: noindex, nofollow, noarchive` plus no-store cache headers; the page's own `app/homepage-demo/review/page.tsx:10-23` metadata independently sets the same `noindex`/`nofollow` — redundant, non-contradictory, CONFIRMED SAFE.
- `/homepage-demo/claim/continue`: **not** in `proxy.ts`'s special-case list, but self-protected — `app/homepage-demo/claim/continue/page.tsx:27-36` calls `supabase.auth.getUser()` directly and redirects if unauthenticated, and lines 14-25 independently set `robots: {index:false, follow:false, nocache:true}`. CONFIRMED SAFE — protected by page-level logic rather than middleware; worth noting so a future `proxy.ts` refactor doesn't assume this route still needs adding there.

### 11.6 `/share/[publicId]` — CONFIRMED SAFE, real server-side gate

- `proxy.ts:84-92` sets the full `SHARE_PUBLIC_PAGE_HEADERS` (no-store, `X-Robots-Tag: noindex,nofollow,noarchive`, a minimal CSP, restrictive Permissions-Policy) on every `/share*` path.
- The page's own metadata (`app/share/[publicId]/page.tsx:21-23`) independently sets `robots: {index:false, follow:false, noarchive:true}` — redundant by design, documented in a code comment as deliberate belt-and-suspenders.
- The page itself is a documented "data-free server shell" — it makes no Supabase call and never touches the URL fragment (browsers never send fragments to the server). Actual project data is returned only by `GET /api/share/[publicId]/projection`, gated by `verifyShareProjectionAuthorization()` (`lib/share/share-session-grant.server.ts:674-737`), which re-checks, on **every** request against the database: session cookie validity, link active/unexpired state, and an exact access-epoch + pin-epoch match. This is a real, non-bypassable, per-request server-side authorization check — not a client-side gate.

### 11.7 `/api/*` spot check

| Route | Own Cache-Control/X-Robots-Tag headers? |
|---|---|
| `app/api/share/[publicId]/projection/route.ts`, `.../pin/route.ts`, `app/api/share/session/route.ts` | Yes — shared `NO_STORE_HEADERS` block (private/no-store, `X-Robots-Tag: noindex,nofollow,noarchive`, Permissions-Policy) on every response |
| `app/api/homepage-demo/bootstrap/route.ts`, `.../extract/route.ts` | Yes — shared `SECURITY_HEADERS` block (no-store/no-cache, `Expires:0`) plus `Vary: Origin, Cookie` |
| `app/api/billing/subscription/route.ts`, `app/api/billing/portal/route.ts` | **No explicit headers.** Real access control exists (401 without a valid session), and Supabase's `cookies()` usage opts these routes into dynamic, non-cached rendering by default — but this is inconsistent with every sibling PII-returning route, which all set explicit `Cache-Control: private, no-store` even though, by the same logic, they may not strictly need to. **CONFIRMED GAP (P2)** — recommend adding the same explicit header for consistency and defense in depth, since these return billing PII (email, plan, subscription status). Actual live edge/CDN caching behavior is **UNKNOWN — requires a production `curl -I` check**, not verifiable from source alone. |

No `/api/admin*` route family exists — confirmed via grep; `requireOwner()` is only ever called from the three admin **page** components.

### 11.8 Sitemap dynamic-enumeration risk — CONFIRMED SAFE (see §12)

---

## 12. Sitemap Audit

`app/sitemap.ts` (67 lines of static route arrays + 1 dynamic call). Confirmed:

- **Exact URL set**: 33 URLs, recomputed independently in this audit (§7, §9) and matched exactly to GSC's discovered-page count.
- **Host**: every URL is built with `absoluteUrl()` (`app/lib/site-config.ts:13-16`), which resolves against `SITE_ORIGIN = "https://www.text2task.com"` — every sitemap URL is `www`-canonical. CONFIRMED, no non-www or bare-path URL exists in the sitemap.
- **Private routes cannot enter the sitemap** — the file is a hand-written static array plus `getAllUseCases()`, itself a static code-level array (§9) — no database query, no user-generated content, no dashboard/share/admin path can appear here. CONFIRMED.
- **Dynamic URL generation**: only the 12 use cases are generated from a shared array (`useCaseRoutes: MetadataRoute.Sitemap = getAllUseCases().map(...)`); everything else is a hand-written literal. No duplicate-URL risk was found — each of the 33 URLs appears exactly once.
- **`lastmod`**: **CONFIRMED ABSENT** — no route in `app/sitemap.ts` sets a `lastModified` field. Per the run's own instruction, this audit does **not** recommend adding a fake build-time timestamp. A truthful `lastModified` would require the app to track a genuine last-meaningful-content-change date per route (e.g., a frontmatter field on each use-case/resource/feature data file, updated only when copy actually changes) — this is a legitimate Phase 1/2 candidate, not a quick fix, since it requires a new truthful data field, not just a code change to the sitemap generator.

---

## 13. Canonical / Redirect Audit

- **Self-canonical**: every static page sets `alternates.canonical` to its own path via `absoluteUrl()`/a relative path resolved against the root `metadataBase` (`app/layout.tsx:26`, `new URL(SITE_ORIGIN)`). Every use-case, resource, feature, and solution page was confirmed (directly or via the metadata-inventory agent, §14) to set its own canonical — no page was found reusing another page's canonical or omitting one.
- **www vs non-www / HTTPS enforcement — CONFIRMED, live-verified 2026-09-09/10**:

| Request | Result |
|---|---|
| `http://text2task.com/` | 308 → `https://text2task.com/` |
| `https://text2task.com/` | 308 → `https://www.text2task.com/` |
| `https://www.text2task.com/` | 200 (final) |

This is a **2-hop redirect chain** (non-www-http → non-www-https → www-https) enforced entirely by **Vercel's own domain/DNS configuration, outside this repository** — confirmed no `middleware.ts`/`proxy.ts` or `vercel.json` rule performs this (none exists; `proxy.ts` never inspects `request.nextUrl.host`). GSC's historical presence of both www and non-www URLs is therefore **not an active bug** — it reflects Google having crawled the non-www host before, or independently of, this redirect being in place; the current live behavior correctly lands every request on `https://www.text2task.com`. **Confirmed minor optimization opportunity (P2/P3, external to this repo)**: collapsing the 2-hop chain to a single hop (e.g., a direct non-www-http → www-https redirect at the DNS/Vercel layer) would be marginally better for crawl budget and latency, but requires a Vercel/DNS configuration change, not a code change — flagged as a Phase 1 conversation item with the hosting configuration, not a repository fix.
- **Query parameter / preview URL behavior**: not independently load-tested against a live preview deployment in this audit — **UNKNOWN, would require production/preview-environment verification** if this becomes a concern.
- **`/index.html` redirect**: single-hop, confirmed live (§10.2) — no chain, no bypass of the host-level normalization above.

---

## 14. Metadata Audit

Full per-route inventory (title/description/canonical/OG/Twitter/robots) is in the companion research report incorporated below; key confirmed findings:

- **Title-suffix architecture**: root `app/layout.tsx:28-31` sets `title: { default: "Text2Task | Turn Client Messages Into Tasks", template: "%s | Text2Task" }`. Any page whose own `metadata.title` is a plain string gets `" | Text2Task"` appended automatically. **The specific "Text2Task | Text2Task" duplicate-suffix bug the run brief asked about was checked directly and is CONFIRMED NOT PRESENT anywhere**: `/about` explicitly uses `title: { absolute: pageTitle }` (`app/about/page.tsx:20-22`), which bypasses the template entirely — its rendered title is exactly `"About Text2Task | Our Story and Product Principles"`, with no duplicate suffix. Every other checked page either uses the template correctly (plain string → single suffix) or a page-specific `absolute`/pre-suffixed OG title with no double-application found anywhere. This specific defect, if it ever existed, is not present in the current codebase.
- **`/pricing`** correctly has no `metadata` export at all — it is a bare `permanentRedirect("/#pricing")` (`app/pricing/page.tsx`), confirmed by full-file read; nothing here can carry metadata, and its absence from the sitemap is therefore correct, not an omission.
- **No `verification` meta tag exists anywhere in the codebase** beyond the explicit `verification: { google: undefined }` field in `app/layout.tsx:95-97`. No `google-site-verification` or Bing verification string, and no HTML verification file in `public/`, was found. GSC verification is therefore either DNS-TXT-based or otherwise fully external to this repository — **UNKNOWN, cannot be confirmed from source**; if a session ever needs to re-verify GSC ownership, this must be done via the Google Search Console UI/DNS provider, not the codebase.
- **Missing OG/Twitter share images (CONFIRMED, real gap)**: homepage, `/about`, `/contact`, `/terms`, `/privacy`, `/use-cases` hub, all 12 `/use-cases/[slug]` pages, and the `/resources` hub declare no `openGraph.images`/`twitter` image. All 6 Feature pages, the 1 Solution page, and all 7 Resource articles **do** carry real image assets. This is an inconsistent gap across roughly 20 of 33 public routes, not a wholesale absence, and it directly affects how links to these pages preview in social shares, Slack/Discord unfurls, and some AI-answer-engine link cards.
- **`/contact`, `/terms`, `/privacy`** have no `twitter` metadata block at all (OG only) and no JSON-LD — the plainest pages on the site, consistent with their low content-marketing priority, but a real, confirmed gap versus every other public page type.
- **Resource-article title branding inconsistency**: only 1 of 7 resource articles (`how-to-turn-emails-into-tasks`) hand-appends a branded `ogTitle`; the other 6 rely on the plain templated title for OG — a minor, real inconsistency, not a functional defect.

---

## 15. Structured Data Audit

**Confirmed schema types in use, site-wide**: `Organization`, `WebSite`, `WebPage`, `AboutPage`, `BreadcrumbList`, `FAQPage`, `Article`, `CollectionPage`/`ItemList` (use-cases hub). **Confirmed absent, site-wide, and deliberately so**: `SoftwareApplication`, `AggregateRating`, `Review`, and any `Person` entity.

**Owner-reviewed SoftwareApplication decision**: do not re-add `SoftwareApplication` / `WebApplication` schema merely because an external SEO audit suggested it. The current schema architecture already uses truthful `Organization`, `WebSite`, `WebPage`, `BreadcrumbList`, `FAQPage`, `Article`, and collection/list entities. `SoftwareApplication` should only be reconsidered if later evidence shows a truthful implementation serves a real goal and all data reflects visible, factual product information. No implementation is authorized now.

- **Homepage** (`app/page.tsx:64-84`): `Organization` (`@id` `/#organization`, `name`, `url`, `logo`, `sameAs` = company Facebook + LinkedIn only — see §16) and `WebSite` (`@id` `/#website`, `publisher` linked back to the Organization) — real, non-templated data. A detailed in-code comment (`app/page.tsx:86-115`) documents the 2026-08-26 decision to remove the homepage's own `SoftwareApplication` entity specifically **because** it had no legitimate, publicly-visible `aggregateRating`/`review` data, and explicitly states that customer-story submissions do collect an optional 1–5 rating but the public read path deliberately excludes it from ever being shown — so no rating is fabricated anywhere. This is a genuinely disciplined, non-manipulative implementation, independently verified by direct file read, not merely asserted by the Blueprint.
- **Confirmed gap**: the homepage's own visible FAQ section (`app/components/landing/homepage-faq-section.tsx`, 6 real Q&As) has **no matching `FAQPage` JSON-LD anywhere** — grep-confirmed zero hits. Every other page type on the site that has a visible FAQ section (all 6 Features, all 12 Use Cases, the 1 Solution) does emit `FAQPage` schema. The homepage is the one outlier.
- **About** (`app/about/page.tsx:130-150`): `AboutPage` schema, `isPartOf` → WebSite, `publisher` → Organization. No dangling `SoftwareApplication` reference (explicitly removed, comment confirms).
- **Use Cases hub**: `CollectionPage` + `ItemList` + 2-level `BreadcrumbList`, built from real `getAllUseCases()` data.
- **Use Case detail pages (12/12)**: `WebPage` + 3-level `BreadcrumbList` (Home → Use Cases → page) + `FAQPage` (conditional on the case's own `faq` field, populated in all 12 case files) — real, per-case data, matching the shape the Blueprint documented. No `SoftwareApplication`.
- **Resources hub**: `BreadcrumbList` only (2-level) — no `Article`/`CollectionPage`.
- **Resource articles (7/7)**: `Article` (via `buildArticleJsonLd`) + 3-level `BreadcrumbList`. **Confirmed inconsistency**: 3 of 7 articles (`how-to-extract-action-items-from-text`, `how-to-turn-client-feedback-into-tasks`, `how-to-turn-screenshots-into-tasks`) omit `datePublished`/`dateModified` from their `Article` JSON-LD; the other 4 include both. A real, file-verified freshness-signal gap, not previously documented.
- **Solution page**: `WebPage` + `FAQPage` confirmed present via grep; exact breadcrumb depth not independently re-read line-by-line in this pass (LIKELY 2-level, consistent with pattern — not CONFIRMED to the same level as the items above).
- **Feature pages (6/6)**: all share `WebPage` + `FAQPage`, real per-page data, no `SoftwareApplication`/no dangling `@id` (explicit removal comments confirmed in multiple files). **Confirmed, real anomaly**: `client-feedback-to-tasks` (`app/features/client-feedback-to-tasks/page.tsx:236-251`) still uses a **3-level** breadcrumb (Home → Features `/#features` → page) while all 5 sibling Feature pages use a **2-level** breadcrumb (Home → page). The Blueprint's own text describes all Feature pages as sharing "2-level BreadcrumbList" — this was written before `client-project-tracker` (the 6th Feature) existed and never revisited `client-feedback-to-tasks` specifically, so the inconsistency was never caught or fixed in-repo. This is a real, current, cosmetic/consistency defect, independent of and more precise than anything the Blueprint claimed.
- **Breadcrumbs and the "zero structured data" claim**: this audit's own findings, independent of the Live URL Test breadcrumb detection the owner already ran, confirm structured data — specifically `BreadcrumbList`, `WebPage`, and `FAQPage` — is present across effectively the entire public marketing surface. Any prior claim that the site has "zero structured data" is **CONFIRMED FALSE** against the current repository state (see §25).
- **No fake/unsupported schema of any kind was found anywhere** — no `AggregateRating`, no `Review`, no fabricated `Person`. This audit did not add any, per the run's iron rules.

---

## 16. Entity / Brand Disambiguation Audit

There is a confirmed unrelated, pre-existing "Text2Task" product on the Microsoft Marketplace. This audit assessed what currently exists in the repository to establish `text2task.com` as its own distinct, identifiable entity.

**What exists (CONFIRMED):**
- Homepage `Organization` schema: `name: "Text2Task"`, `url`, `logo` (`/text2task-logo.png`), `sameAs`: company Facebook page + company LinkedIn page (`app/lib/site-config.ts:3-11`, `SITE_ORGANIZATION_SAME_AS`).
- A real, substantial `/about` page: first-person founder narrative ("I built Text2Task to reduce the time spent manually copying client requests..."), product principles, a described product journey, explicit "Built independently" framing, a support email, and three real product images of "the founder" (captioned generically, e.g. "Founder and independent builder of Text2Task").
- `AboutPage` JSON-LD linking to the Organization/WebSite entities (§15).
- A genuine (non-fabricated) customer-testimonial system: `app/components/landing/homepage-customer-stories-section.tsx` renders real, database-backed customer stories (`getPublicCustomerStories()`), gated by an approval flow (`is_approved`/`public_permission` checks confirmed in `lib/customer-stories/public-customer-stories.server.ts`) — genuinely opt-in and moderated, not fabricated, and gracefully renders nothing if no approved stories exist.

**What is confirmed MISSING (P0 — serious entity ambiguity, per this run's own priority definitions):**
- **No founder full name is published anywhere on the site.** The About page, the footer, the homepage, and every JSON-LD block were checked — the founder is referred to only as "the founder," "I," or "Founder and independent builder of Text2Task." No first/last name string was found anywhere in `app/about/page.tsx`, `app/layout.tsx`, `app/components/landing/landing-footer.tsx`, or `app/lib/site-config.ts`.
- **No `Person` schema exists anywhere** — `app/lib/schema.ts` (the site's one shared schema-builder module) has no Person builder function of any kind, and no page constructs an inline `Person` object either (grep-confirmed).
- **No personal professional profile link exists** (e.g., a founder's own LinkedIn profile) — `SITE_ORGANIZATION_SAME_AS` and the footer's social links are both **company-only** pages (Facebook business page, LinkedIn company page), not a personal profile.
- **No business physical address, phone number, or other NAP (Name/Address/Phone) signal** exists anywhere in the footer, About, or Contact pages — Contact page content was checked and confirms email-only contact (`support@text2task.com`). Owner review corrected the interpretation: lack of physical address or phone number is **not** classified as an SEO defect for this online SaaS, and no NAP information should ever be invented.

**Why this matters for this specific site**: a real, named, linkable person entity (with a `Person` schema tied to the `Organization` via `founder`, and a genuine personal profile `sameAs` link) is one of the strongest, most standard disambiguation signals against an unrelated same-named product — and it is currently entirely absent by what reads as a deliberate anonymity choice in the current copy ("Built independently," first-person but unnamed). This is flagged as P0 under this run's own definition ("serious entity ambiguity") — not because the current copy is dishonest or low-quality (it isn't), but because the single highest-leverage, lowest-risk fix available (naming the founder and adding a real `Person` entity, if and only if the owner is willing to be named publicly) has not been done and is a real, verified gap, not a hypothetical one. **This audit does not recommend a specific implementation** — publishing a founder's name or professional profile is the owner's decision, not a default this audit should assume. It is recorded here as a confirmed gap for the owner to decide on before Phase 1 entity work is scoped.

---

## 17. Content Intent Map

Restated from the Blueprint (§25 reconciles freshness) plus this run's own additions for pages the Blueprint didn't cover:

| Page | Primary intent | Secondary intent | Funnel stage | Query cluster | Canonical owner |
|---|---|---|---|---|---|
| `/solutions/freelancer-project-management-software` | Commercial, category/end-to-end | Client project management software (secondary, same page — do not fork) | Consideration | freelancer/client project management software | This page (anchor) |
| `/features/email-to-tasks` | Commercial, tool-specific | — | Consideration/decision | email to task(s) app | This page |
| `/resources/how-to-turn-emails-into-tasks` | Informational/how-to | — | Awareness | turn emails into tasks | This page |
| `/features/client-project-tracker` | Commercial, narrow (outbound client visibility) | — | Consideration/decision | client project tracker, share project progress with client | This page |
| `/features/client-feedback-to-tasks` | Commercial + informational, inbound (client→owner) | — | Consideration | client feedback to tasks, manage client revisions | This page + `/resources/how-to-turn-client-feedback-into-tasks` |
| `/features/screenshot-to-tasks` + `/resources/how-to-turn-screenshots-into-tasks` | Commercial + informational | — | Consideration/awareness | screenshot to tasks | Both, differentiated |
| `/features/ai-task-extractor` | Commercial, generic engine (hub) | — | Consideration | AI task extractor, extract action items from text | This page |
| `/features/project-deadline-calendar` | Commercial, narrow | — | Consideration | project deadline calendar | This page |
| `/use-cases/*` (12 pages) | Audience fit | — | Awareness/consideration | audience-specific, no forced primary keyword | Individual use case; must not target the same primary keyword as a Feature/Solution |
| `/use-cases/freelance-developers`, `/seo-freelancers` | Audience fit (thin currently — see §19) | — | Awareness | audience-specific | This page — **currently under-supported by internal linking and content depth relative to its own stated intent** |
| `/about` | Trust/entity | — | Any stage (cross-cutting) | Text2Task founder, who built Text2Task | This page |
| `/pricing` | N/A — redirects to homepage pricing anchor | — | Decision | pricing | `/#pricing` |
| `/contact`, `/terms`, `/privacy` | Utility/legal | — | Any stage | non-commercial | Individual pages |

---

## 18. Cannibalization Assessment

No new cannibalization risk was found in this run. The Blueprint's 7 standing cannibalization rules (§25.3 below) were independently spot-checked against current file contents (title/H1 text on the Email Feature vs. Email Resource pages, and on the Web Designers Use Case vs. the Web Designers Revisions Resource) and remain accurate as of this run — no regression found. The one item the Blueprint flagged as genuinely unresolved (Client Project Tracker vs. Client Feedback to Tasks direction-explicitness) was independently re-checked in the internal-linking research and remains correctly direction-explicit on both pages.

The `/features/email-to-tasks` vs. `/resources/how-to-turn-emails-into-tasks` pair remains the healthy reference model — commercial vs. informational intent, no shared H1 construction, verified live via GSC (§5) already ranking the Resource for the exact-match informational phrase and the Feature separately.

---

## 19. Internal Linking Audit

**Hub → detail (CONFIRMED)**: `/use-cases` (`app/use-cases/page.tsx`) is a plain server component that renders a real, SSR `<Link href="/use-cases/{slug}">` for every one of the 12 use cases, including all four GSC-flagged pages, each with descriptive anchor text ("Explore Freelance Developers →", etc.). No JS-only navigation.

**Detail → hub / detail → detail (CONFIRMED, present but structurally thin for 3 of 4 flagged pages)**: every use-case detail page renders a "View all use cases →" link plus per-case `relatedSlugs` links via `UseCaseRelated`. All four flagged pages populate `relatedSlugs`. However, the separate `relatedLinks` field (which links a use case out to a Feature/Resource page) is populated for only 8 of 12 use cases — **missing on 3 of the 4 flagged pages** (`freelance-developers`, `seo-freelancers`, `shopify-freelancers`); present on `video-editors`.

**Homepage (CONFIRMED)**: `app/components/landing/homepage-use-cases-section.tsx` hard-codes exactly 6 of the 12 use-case slugs (`web-designers`, `wordpress-freelancers`, `graphic-designers`, `social-media-managers`, `project-managers`, `small-agencies`). **None of the four newly-flagged pages, and 6 of 12 use cases overall, are linked from the homepage.**

**Footer (CONFIRMED)**: `app/components/landing/landing-footer.tsx:33-38` links only `web-designers`, `wordpress-freelancers`, `graphic-designers` (plus the hub) — again, none of the four flagged pages.

**Features/Solution → Use Cases, and back (CONFIRMED, one-directional and incomplete)**: all 6 Feature pages and the 1 Solution page link out to a subset of use cases (mostly `project-managers`, `small-agencies`, `virtual-assistants`, `web-designers`, `wordpress-freelancers`, `graphic-designers`, `social-media-managers`) — **zero of the six link to any of the four flagged pages**. The reverse direction exists for only 8 of 12 use cases via `relatedLinks`; `freelance-developers`, `seo-freelancers`, and `shopify-freelancers` have none.

**Hub-only / contextual-isolation finding (CONFIRMED, most significant linking finding of this run)**:

| Use case | Inbound links (excluding the `/use-cases` hub) | Verdict |
|---|---|---|
| `freelance-developers` | **0** | Hub-only / contextually isolated beyond the `/use-cases` hub |
| `seo-freelancers` | **0** | Hub-only / contextually isolated beyond the `/use-cases` hub |
| `shopify-freelancers` | 1 (from `seo-freelancers`, itself hub-only/contextually isolated) | Weak chain — still isolated beyond one weak page |
| `video-editors` | 2 (from `social-media-managers`, `graphic-designers` — both homepage/Feature-linked) | Meaningfully better link equity than the other three |

This directly and plausibly correlates with — though, per the run's own instruction, is not asserted to be the sole cause of — the GSC "Discovered — currently not indexed" status these exact four pages carry.

**Resources hub (CONFIRMED)**: has zero outbound links into Use Cases, Features, or Solutions — the Blueprint's claimed bidirectional Homepage→Solutions→Features→Resources→Use Cases hierarchy is **not implemented** in this specific direction.

**Conclusion**: the Blueprint's §21.2 claim that internal linking is "COMPLETE" and "verified" is accurate for the specific relationships it enumerated (Client Project Tracker's links), but does **not** describe the full use-case internal-link graph — which this run's fresh, independent verification shows has real, structural gaps concentrated on exactly the four pages GSC has flagged as under-crawled.

---

## 20. AEO Assessment

Spot-checked the highest-priority commercial pages (`/solutions/freelancer-project-management-software`, `/features/email-to-tasks`, `/features/client-project-tracker`) against the run's answerability checklist:

- **What is this? Who is it for?** — clearly stated on every checked page, in both the hero and a dedicated "who this helps" section.
- **What input does it accept / what output does it create?** — clearly stated (paste/upload text, emails, notes, screenshots → reviewable project/tasks with deadlines/budgets/client details).
- **How does it work?** — a dedicated "how it works" section exists on every checked page.
- **Does it require inbox/WhatsApp connection?** — explicitly and correctly answered **no** on the homepage trust strip ("NO INBOX CONNECTION REQUIRED... Text2Task doesn't need access to Gmail or WhatsApp") and consistent with the product's actual paste/upload model confirmed elsewhere in this audit.
- **Is human review required? What's saved automatically vs. after approval?** — explicitly and correctly answered on the homepage trust strip ("REVIEW BEFORE SAVING... Nothing is added to your workspace until you approve it"; "NOTHING CHANGES AUTOMATICALLY... Suggested updates stay optional until you approve them.").
- **What does Client Share NOT do?** — the Solution page's "not intended to replace" list correctly and currently states Client Share does not provide "a full client account system" (a factually accurate limitation, corrected 2026-08-27 per the Blueprint and re-confirmed unchanged in this run).
- **No meaningful answerability gap was found requiring new FAQ content** on the pages checked — the run's instruction to avoid mass-adding FAQs is respected; this audit recommends none.

---

## 21. GEO / AI Discovery Assessment

- **Confirmed**: no separate policy exists for OAI-SearchBot or GPTBot versus Googlebot/Bingbot — all four inherit the same permissive wildcard rule in `robots.ts` (§10.1). No technical rule blocks any of them from any public content page.
- **Confirmed**: all public marketing pages are server-rendered plain HTML (Next.js App Router server components) — no client-side-only rendering gate exists that would prevent a non-JS-executing crawler/answer-engine from reading the content. (This audit did not attempt to fetch pages while spoofing an OAI-SearchBot/GPTBot user-agent against production — that would be a legitimate Phase 1 verification step, not performed here.)
- **`llms.txt`**: confirmed absent (`public/` directory listed in full; no such file). Per the run's own instruction, this is recorded as an **optional/experimental** Phase 1 candidate only — **not** a requirement or a P0/P1 gap.
- **No "AI schema" was invented or recommended** — the run's structured-data recommendations (§15/§26–28) are limited to standard, already-in-use schema types (`FAQPage`, `Article` dates), consistent with the instruction not to invent new schema categories.
- **Text2Task already has measured Generative-AI visibility (§6)** — 28 impressions over 3 months, homepage-dominant. This is a genuine, if thin, starting signal that GEO work is building on real traction, not starting from zero.

---

## 22. Measurement / Conversion Tracking Map

**Client-side tag layer** (all consent-gated via `useAnalyticsConsentAccepted()` and path-excluded via `shouldSkipAnalyticsPath()` — confirmed identical gating pattern across all four):

| System | Status | Detail |
|---|---|---|
| Google Ads tag | CONFIRMED, live | `app/components/analytics/google-ads-tag.tsx` — loads one Google tag (`gtag.js`) keyed to `NEXT_PUBLIC_GOOGLE_ADS_ID` (`AW-...`). Fires `gtag('config', GOOGLE_ADS_ID)`. |
| GA4 | **VERIFIED active externally** | Owner-supplied Google Analytics Admin evidence on 2026-09-10 confirmed the `Text2Task Website` web stream for `https://www.text2task.com` (Stream ID `14978713002`, Measurement ID `G-TP2F4HWZN4`) showed "Data collection is active in the past 48 hours" and "Data flowing." Enhanced Measurement is enabled. The code deliberately never calls `gtag('config', 'G-...')` because GA4 is connected as a destination of the same Google tag inside Google's account settings. No GA4 application-code change is required. |
| Microsoft Clarity | CONFIRMED, live, consent-gated | `app/components/analytics/microsoft-clarity.tsx` — loads `clarity.ms/tag/{id}`, actively revokes consent (not just skips re-insertion) on rejection/excluded paths. |
| Vercel Analytics / Speed Insights | CONFIRMED, live, consent-gated | `app/components/analytics/consent-aware-vercel-analytics.tsx`, packages confirmed installed in `package.json`. |
| Custom `gtag` events | CONFIRMED, live | `lib/analytics/events.ts` — 9 bare named events (`hero_live_demo_click`, `live_demo_submit`, `live_demo_success`, `homepage_free_plan_click`, `homepage_pro_plan_click`, etc.) plus 1 Google-Ads-specific conversion ping (`trackBeginCheckout`, hardcoded `send_to: "AW-670652067/IPHJCPi40vICEKOt5b8C"`, fired at "begin checkout," before Creem redirect — **not** at confirmed payment). |

**Internal `analytics_events` table** (Supabase, service-role-only, RLS-enabled, real production schema — `supabase/migrations/202609040001_canonical_production_closure.sql`):

| Funnel stage | Status | Event name |
|---|---|---|
| Landing/pageview | CONFIRMED EXISTS | `page_view` |
| Live Demo attempt/success/fail | CONFIRMED EXISTS | `homepage_demo_extract_attempt` / `_succeeded` / `_failed` |
| Review viewed | CONFIRMED EXISTS | `demo_review_viewed` |
| Signup CTA click | CONFIRMED EXISTS | `demo_account_cta_clicked` |
| Demo → account claim | CONFIRMED EXISTS | `demo_claim_saved` |
| Signup attribution captured | CONFIRMED EXISTS | `signup_attribution_captured` |
| Signup success | CONFIRMED EXISTS | `signup_success` |
| Login success | CONFIRMED EXISTS | `login_success` |
| Email confirmed | **NOT FOUND — allowlisted in code/DB, never emitted anywhere** | `email_confirmed` |
| First extract/task created | Phase 0 finding: **NOT FOUND — allowlisted, never emitted**. Phase 1 Milestone 1: **PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**; production event-row re-verification was not performed in this gate (§40, D020). | `first_extract_created` |
| Project saved | Phase 0 finding: **NOT FOUND — allowlisted, never emitted**. Phase 1 Milestone 1: **PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**; production event-row re-verification was not performed in this gate (§40, D020). | `project_saved` |
| Client update created/applied | **NOT FOUND — allowlisted, never emitted** | `client_update_created` / `client_update_applied` |
| Paid conversion | Phase 0 finding: **NOT FOUND in the internal table at all**. Phase 1 Milestone 1: **PRODUCTION DEPLOYED WITH AUTOMATED COVERAGE; MANUAL RUNTIME AND PRODUCTION ROW VERIFICATION DEFERRED PENDING SAFE CREEM STRATEGY** (§40, D020). | `paid_conversion` now emits from the verified Creem `subscription.paid` webhook path after authoritative processing; manual runtime/row verification remains deferred |

**Attribution (CONFIRMED, real, end-to-end)**: first-touch UTM/referrer captured client-side (`app/components/analytics/attribution-capture.tsx`), dual-persisted to `localStorage` and a 180-day cookie so server routes can read it, and independently confirmed to thread through into both `signup_attribution_captured` and `signup_success` event payloads (`lib/analytics/signup-attribution.server.ts`).

**Owner-traffic exclusion (CONFIRMED, real)**: a dedicated, httpOnly, 180-day cookie (`t2t_owner_analytics_excluded`), set only from a server-verified owner login, checked at every internal-analytics write path — explicitly documented as not an authorization mechanism, only a data-quality measure. It does not exclude the owner's traffic from Google Ads/GA4/Clarity — only from the internal `analytics_events` table.

**Confirmed measurement priority classification (owner-reviewed)**: the acquisition funnel is real and complete through signup, but priority is not flat across all missing events. P0 measurement items are `paid_conversion` (from the authoritative Creem confirmed-payment webhook path, implemented production-grade and idempotently), `first_extract_created`, and `project_saved`. P1 is `email_confirmed`. P2/product analytics are `client_update_created` and `client_update_applied`. Phase 1 Milestone 1 is production deployed and production smoke verified; production event-row re-verification was not performed in this gate, and `paid_conversion` manual runtime verification remains deferred pending a safe Creem strategy.

**GA4 external verification result (Phase 0B, owner-supplied evidence, 2026-09-10 00:57 Asia/Jerusalem)**: GA4 is actively receiving production traffic. Google Analytics Admin showed the `Text2Task Website` stream URL `https://www.text2task.com`, Stream ID `14978713002`, Measurement ID `G-TP2F4HWZN4`, "Data collection is active in the past 48 hours," and "Data flowing." Enhanced Measurement is enabled. Google tag `AW-670652067` is sending to multiple destinations: Google Ads destination `AW-670652067` and Google Analytics destination `Text2Task Website`; tag quality is `Good`. "Manage connected site tags: 0 connected" is not a defect because connected site tags and Google-tag destinations are different concepts. The prior GA4 status "external verification required / unknown" is now **RESOLVED and VERIFIED**.

---

## 22A. Phase 0B Core Web Vitals / PageSpeed Baseline

Source: owner-supplied external evidence from Google Search Console → Experience → Core Web Vitals, and PageSpeed Insights for `https://www.text2task.com/`.

**Google Search Console field data**

For both Mobile and Desktop, Google Search Console reported: "Not enough usage data in the last 90 days for this device type."

Conclusion:
- Field Core Web Vitals data: **UNAVAILABLE**
- Reason: insufficient Chrome UX Report traffic/data
- Do not claim Core Web Vitals PASS
- Do not claim Core Web Vitals FAIL
- No field-data performance blocker is currently demonstrated

**PageSpeed Insights — Homepage — Mobile lab result**

| Metric | Value |
|---|---|
| Performance | 88 |
| Accessibility | 96 |
| Best Practices | 100 |
| SEO | 100 |
| Agentic Browsing | 2/2 |
| FCP | 0.9 s |
| LCP | 3.8 s |
| TBT | 40 ms |
| CLS | 0 |
| Speed Index | 3.7 s |

Important diagnostic:
- Total network payload: approximately **15,465 KiB**
- Dominant resource: `/landing/text2task-demo.mp4`, approximately **14,964 KiB**
- This single video accounts for almost the entire homepage network payload.
- Other diagnostics were comparatively small: image-delivery savings approximately 157 KiB, render-blocking savings approximately 410 ms, unused JavaScript approximately 28 KiB, legacy JavaScript approximately 14 KiB.

**PageSpeed Insights — Homepage — Desktop lab result**

| Metric | Value |
|---|---|
| Performance | 99 |
| Accessibility | 96 |
| Best Practices | 100 |
| SEO | 100 |
| Agentic Browsing | 2/2 |
| FCP | 0.3 s |
| LCP | 0.7 s |
| TBT | 0 ms |
| CLS | 0.007 |
| Speed Index | 1.1 s |

Desktop network payload was also approximately **15,571 KiB**, confirming the large homepage media payload is not mobile-only.

**Final performance conclusion**

- No demonstrated site-wide SEO performance blocker.
- Desktop lab performance is excellent.
- Mobile lab performance is good overall, but LCP is materially weaker.
- The approximately 15 MB homepage demo video is the dominant performance anomaly.
- This does **not** explain the site's current non-brand average position around 78 by itself.
- This is a targeted optimization opportunity rather than evidence of a broken performance architecture.

**Classification**

P1 Performance/CRO candidate: investigate homepage video loading strategy before changing anything.

Future implementation must verify current `<video>` preload behavior, autoplay behavior, whether the entire MP4 downloads during initial page load, poster behavior, codec/compression possibilities, lazy/deferred loading strategy, and effect on product/demo conversion.

Do **not** remove the video or reduce product functionality blindly. Preserve the conversion value of the demo while eliminating unnecessary initial bandwidth where technically appropriate.

No performance implementation is authorized yet.

---

## 22B. Phase 0B Google Search Console Links Baseline

Source: owner-verified Google Search Console Links data.

**External links**

Google Search Console's main Links report showed:

| External links metric | Value |
|---|---|
| Total external links reported | 3 |
| Top linked page | `https://www.text2task.com/` — 3 |

Top linking sites:

| Linking site | Reported links |
|---|---:|
| `reddit.com` | 2 |
| `startupbase.io` | 1 |

Top linking text surfaced:
- `https www text2task com`
- `website`

Exports reviewed by owner:
- Latest links
- More sample links

Both exports contained the same 3 reported source URLs.

Important interpretation: Google Search Console currently reports 3 external link URLs from 2 linking domains. This is a strong signal of weak external-authority diversity, but GSC Links is not an exhaustive backlink index. Do **not** state that Text2Task has only 3 backlinks on the internet.

The two Reddit URLs are variants of the same underlying Reddit thread, so referring-source diversity is particularly limited. All currently reported external links point to the homepage. No externally-linked Feature/Solution/Resource money page is currently surfaced in this GSC report.

**Classification**

P1 HIGH: relevant external authority / mentions / quality-link acquisition.

Explicitly prohibited:
- buying bulk backlinks
- spam directories
- comment/link spam
- PBNs
- fabricated editorial coverage
- manipulative exact-match anchor campaigns

Future authority work must favor genuine relevant editorial mentions, reputable SaaS/product directories, founder/entity profiles, relevant community participation, partnerships/integrations, original evidence/data/assets worth citing, and contextual links that naturally support the product/topic pages.

**Internal links**

Google Search Console reported total internal links on the summary screen: **190**.

The exported "Top target pages" report contained these 13 target URLs:

| Rank | Target URL | Internal links |
|---:|---|---:|
| 1 | `/privacy` | 22 |
| 2 | `/` | 21 |
| 3 | `/use-cases/web-designers` | 16 |
| 4 | `/use-cases/wordpress-freelancers` | 16 |
| 5 | `/contact` | 15 |
| 6 | `/terms` | 15 |
| 7 | `/use-cases` | 15 |
| 8 | `/features/email-to-tasks` | 14 |
| 9 | `/solutions/freelancer-project-management-software` | 14 |
| 10 | `/features/ai-task-extractor` | 11 |
| 11 | `/features/client-feedback-to-tasks` | 11 |
| 12 | `/features/screenshot-to-tasks` | 11 |
| 13 | `/use-cases/small-agencies` | 9 |

Interpretation:
- Privacy, Contact, and Terms having high counts is not itself an SEO defect. They receive sitewide/navigation/footer links and should not be stripped of useful links merely to manipulate internal PageRank.
- The two major current non-brand opportunity pages already have meaningful internal-link presence: `/features/email-to-tasks` has 14 reported internal links and `/solutions/freelancer-project-management-software` has 14 reported internal links.
- Therefore, do **not** characterize the entire site's money-page internal linking as broken.
- The four use-case URLs recently flagged by GSC (`/use-cases/freelance-developers`, `/use-cases/seo-freelancers`, `/use-cases/shopify-freelancers`, `/use-cases/video-editors`) are not surfaced in this exported GSC top-target report.

Combined with the repository audit:
- `freelance-developers`: hub-only / contextually isolated
- `seo-freelancers`: hub-only / contextually isolated
- `shopify-freelancers`: weakly linked
- `video-editors`: better than the other three, but still part of the recently under-crawled group

Conclusion: the evidence now independently supports a targeted P1 contextual-internal-linking improvement for weak use-case pages. Do **not** recommend mass internal-link insertion. Links must be contextually useful, natural, and architecturally justified.

**Business interpretation**

Tie-back to the existing search baseline: non-brand visibility is 361 impressions, 0 clicks, and average position 78.1.

The combined evidence supports the hypothesis that authority is a major constraint:
- Google already understands the site's major topics enough to generate non-brand impressions.
- Technical crawl/index foundations are generally healthy.
- Money pages already receive some internal authority.
- External linking-domain diversity surfaced by GSC is extremely weak.
- Several newer use-case pages remain contextually under-supported internally.

This does **not** prove backlinks alone cause the average position of approximately 78. Authority should be recorded as one major evidence-supported constraint alongside content depth/relevance, entity confidence, topical/internal authority, and domain maturity.

---

## 22C. Phase 0B GSC Manual Actions / Security Issues Baseline

Source: owner-verified Google Search Console evidence.

**Manual Actions**

Google Search Console path: Security & Manual Actions → Manual actions.

Status shown by Google: "No issues detected."

Recorded status: **GSC Manual Actions: VERIFIED — NO ISSUES DETECTED**.

Interpretation:
- No manual action/penalty is currently reported for the Text2Task property.
- Do not overstate this as proof that every SEO issue is absent.
- This specifically confirms that GSC currently reports no manual action.

**Security Issues**

Google Search Console path: Security & Manual Actions → Security issues.

Status shown by Google: "No issues detected."

Recorded status: **GSC Security Issues: VERIFIED — NO ISSUES DETECTED**.

Interpretation:
- Google Search Console currently reports no security issue for the property.
- Do not overstate this as a complete security audit.
- Repository/application security remains governed by its own production-grade controls.

---

## 23. Bing / IndexNow Status

**Phase 0A repository baseline:** whole-repository grep (case-insensitive, whole-word) for `bing` and for `IndexNow` returned zero genuine matches (all superficial substring false-positives like "closing"/"wording" were checked and ruled out). No Bing Webmaster verification meta tag, no HTML verification file in `public/`, no IndexNow key-verification file, and no IndexNow URL-submission logic existed anywhere in the repository at that time. That remains true for the application code in this documentation-only update.

**Phase 0B external update (owner-supplied evidence, 2026-09-13 13:06 Asia/Jerusalem):** Text2Task has now been added to Bing Webmaster Tools.

### 23.1 Bing Webmaster Tools Onboarding

Property: `text2task.com`.

The property was imported/connected successfully. During initial onboarding, Bing stated that reports/data were being processed and could take up to 48 hours to reflect.

Interpretation:
- Do not interpret temporarily empty Bing reports as evidence of zero search/index/backlink activity.
- Recheck after Bing's initial processing window completes.

### 23.2 Bing Sitemap

Submitted sitemap: `https://www.text2task.com/sitemap.xml`.

Submission date: 2026-09-13.

Submission succeeded.

Initial Bing status: **Processing**.

Initial summary immediately after submission:

| Metric | Initial value |
|---|---|
| Known sitemaps | 1 |
| Sitemaps with errors | 0 |
| Sitemaps with warnings | 0 |
| Total URLs discovered | 0 |
| Last crawl | Not yet available |

Interpretation:
- The sitemap had only just been submitted and remained in processing.
- Do **not** treat 0 discovered URLs as an indexing defect at this stage.
- Do **not** submit the sitemap repeatedly.
- Recheck after Bing processing completes.

### 23.3 IndexNow Baseline

Bing Webmaster Tools / IndexNow setup was inspected.

The official custom-site implementation flow shown by Bing is:

1. Generate API Key
2. Host your API key
3. Submit URLs
4. Verify URLs

An IndexNow key was generated during setup exploration.

Important current status:
- IndexNow is **not yet implemented** in the Text2Task application.
- No application file was created.
- No key-verification file was deployed.
- No URL submission integration was added.
- No production change occurred.

Classification: **P1 Search/AI Discovery foundation**.

Future production-grade implementation must use a stable IndexNow key, make the required verification key accessible on the canonical public host, submit only canonical public URLs, never submit private/user/token/dashboard/share/admin URLs, notify on meaningful public URL create/update/delete events, avoid resubmitting the complete site on every deployment, include controlled logging/error handling/retry behavior, and preserve `sitemap.xml` as the complete crawl inventory.

No IndexNow implementation is authorized during Phase 0.

### 23.4 Bing AI Performance Baseline

Source: Bing Webmaster Tools → AI Performance (Beta).

Selected period: 3 months.

Citation sources: Microsoft Copilots and Partners.

Observed baseline:

| Metric | Value |
|---|---|
| Total Citations | 0 |
| Avg. Cited Pages | 0 |

No cited pages / grounding-query activity was surfaced in the report at the time of inspection.

Important interpretation: Bing AI Performance currently reports 0 citations and 0 cited pages for the selected 3-month period. Do **not** claim "Copilot has never mentioned Text2Task."

Bing states that AI Performance represents a sample of overall activity and results may be refined as additional data is processed. The property was also newly onboarded to Bing Webmaster Tools, so this baseline should be rechecked after processing completes.

This creates a useful GEO measurement baseline alongside:
- Google Generative AI: 28 impressions over the previously measured 3-month period.
- Bing AI Performance: 0 reported citations / 0 cited pages at current baseline.

### 23.5 Bing Backlinks Baseline

Source: Bing Webmaster Tools → Backlinks → Backlinks For Your Site.

Current screen showed: "No data available."

Correct status: **Bing Backlinks: DATA NOT YET AVAILABLE / PENDING PROCESSING**.

Important interpretation:
- Do **not** record this as 0 backlinks.
- Do **not** use it as evidence that Bing knows of no backlinks.
- Reason: the Bing Webmaster Tools property was newly onboarded and Bing had already stated that data/reports may take up to 48 hours to process.
- The authoritative backlink baseline currently available for this run remains the previously recorded Google Search Console Links baseline: 3 external link URLs surfaced, 2 linking domains surfaced, all surfaced links target the homepage.
- Bing Backlinks must be rechecked after processing.

### 23.6 Bing Follow-Up

Recheck Bing after its initial data-processing window for:
- sitemap status
- discovered URLs
- Search Performance
- Site Explorer/index state
- Backlinks
- AI Performance changes

Do not fabricate a future exact result.

---

## 23A. Phase 0B External Authority / Entity Footprint Baseline

**Phase 0B external update (owner-supplied external research, 2026-09-13 13:17 Asia/Jerusalem):** the current external authority/profile/entity footprint baseline is now recorded. This section differentiates verified current Text2Task surfaces from ambiguous/name-collision results and from items not verified in this search sweep.

### 23A.1 Verified Current Text2Task External Surfaces

**LinkedIn:** a public indexed founder/profile result exists and explicitly references `Text2Task.com`. Indexed LinkedIn posts also exist from the founder profile and the Text2Task company page. This means a public founder ↔ Text2Task association already exists externally. However, the owner has decided not to publish founder identity on the Text2Task website at this time.

**GetApp:** a current Text2Task listing was externally verified. It clearly matches the current `text2task.com` SaaS, including AI workflow positioning, freelancers/small teams, 30 free AI extracts, Pro price `$12.90/month`, and current project/task/workspace functionality.

**Capterra:** a current Text2Task pricing/listing page was externally verified. It matches the current product: Free plan, 30 total AI extracts, Pro plan `$12.90/month`, and matching feature set.

**Uneed:** current Text2Task listing verified. Observed signals: current positioning, 4 upvotes, 3 user reviews, and Project Management / Productivity / CRM classification.

**Peerlist:** current Text2Task project page verified. The project is associated with the founder and uses the current positioning: "Turn client messages into structured projects and tasks."

**StartupFortune:** a standalone editorial article about the current Text2Task was verified: "Text2Task Turns Messy Client Messages Into Structured Projects and Tasks," published Aug 20, 2026. This is materially different from a basic directory listing and is recorded as a verified editorial mention.

**SaaSHub:** Text2Task was externally surfaced as a recently verified product with the current product positioning.

**Additional discovery surfaces:** Text2Task was also surfaced in UIComet launch discovery and FounderDB / Peer Push discovery data. Treat these as discovery/listing surfaces, not equivalent to editorial authority.

### 23A.2 Current Authority Interpretation

Do **not** state "Text2Task has no external presence." That is false.

Correct interpretation: Text2Task already has a meaningful early external entity footprint across software directories, professional/social profiles, launch/discovery platforms, and at least one editorial publication.

However, Google Search Console currently surfaces only 3 external-link URLs, 2 linking domains, and all surfaced links targeting the homepage.

Therefore, the problem is not total absence of mentions. The current weakness is limited referring-domain diversity, limited externally recognized link authority, almost no external links to high-value Feature/Solution/Resource pages, and limited independent editorial/reference coverage.

Classification: **P1 HIGH — Relevant external authority / mentions / earned links**.

Future work should favor editorial coverage, genuine comparisons/roundups, relevant founder/profile/entity references, useful original data/research/assets, partnerships, relevant community participation, high-quality SaaS/product directories where genuinely useful, and natural contextual links to appropriate topic/money pages.

Do **not** pursue bulk backlink purchases, PBNs, spam directories, comment/link spam, automated backlink blasts, fake reviews, fabricated press/editorial mentions, or manipulative anchor-text campaigns.

### 23A.3 Entity / Founder Signal

External evidence now confirms that the founder identity is already publicly associated with Text2Task through indexed LinkedIn and Peerlist surfaces.

This strengthens the prior recommendation to consider publishing a truthful founder identity on `text2task.com` itself.

The owner decision on founder naming remains **OPEN**. Do not implement until explicitly approved.

### 23A.4 Name Collision — Verified

An unrelated older product named "Text2Task" remains live in Microsoft Marketplace.

Publisher: Target Energy Solutions.

That product is an Outlook/email assistant, creates tasks/events from received email, targets enterprise employees, and is unrelated to `text2task.com`.

Therefore the Text2Task name collision is real and externally verified. This supports the existing HIGH/P0 entity-disambiguation priority.

### 23A.5 Ambiguous / Requires Identity Verification

**G2 — AMBIGUOUS / REQUIRES IDENTITY VERIFICATION**: a G2 result for a product named Text2Task exists. However, current externally visible G2 content does not clearly establish that it refers to the current `text2task.com` SaaS. Do **not** count it as a verified authority asset for current Text2Task.

### 23A.6 Not Verified In This External Sweep

No clearly indexed/current result was verified for Product Hunt or BetaList in this search sweep.

Do **not** record these as absent. Record only: **Not externally verified in this search sweep.**

---

## 24. E-E-A-T / Original Evidence Assessment

**What exists (CONFIRMED, genuine, non-fabricated):**
- A real, database-backed, moderated customer-testimonial system (`is_approved` + `public_permission` gate confirmed server-side before any story is ever publicly served) — currently rendering on the homepage, gracefully hiding itself when zero approved stories exist. This is a legitimate original-evidence asset, and it was built with real moderation, not populated with fabricated reviews.
- A real, substantial About page with a first-person founder narrative, explicit product principles, and an "independently built" framing — genuine positioning copy, not a template placeholder.
- Real product screenshots used as OG/Twitter images and in-page proof sections on the Feature and Solution pages (§14) that do carry them.
- No fabricated ratings, reviews, aggregateRating, or case-study metrics were found anywhere — and the repository's own code comments (§15) show this was a deliberate, repeatedly-reinforced decision, not an oversight.

**Confirmed gaps:**
- No named founder/author identity on the Text2Task website (§16) — the single largest E-E-A-T gap on the site. Phase 0B external research later verified public founder ↔ Text2Task association on indexed LinkedIn and Peerlist surfaces (§23A), but no on-site founder identity has been published yet.
- No case studies with named clients/results (reasonable at this company stage, and not something this audit recommends fabricating).
- No methodology/original-data content (e.g., a data-driven post on client-communication patterns) — a legitimate future authority-content opportunity, not an existing gap in current copy's honesty.
- 3 of 7 Resource articles missing `datePublished`/`dateModified` in their `Article` schema (§15) — a freshness-signal gap that also touches E-E-A-T (dated content is a trust signal for AI answer engines specifically).

---

## 25. Prior Audit Reconciliation

The two prior-audit files named in this run's brief — `Text2Task_SEO_GEO_AEO_Master_Audit_2026-09-09_HE(1).docx` and `text2task_full_audit.docx` — were searched for across the entire workspace and filesystem and **were not found**. Their specific claims could not be independently inspected or quoted in this run. Where the run brief itself surfaced a specific claim attributed to prior audit work (e.g., "zero structured data," the "Text2Task | Text2Task" title-suffix suspicion), that claim is reconciled below using this run's own fresh, direct repository verification. Separately, this run located and read in full an internal, repo-tracked, more recent reference document — `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` ("the Blueprint," 1,730 lines, last reconciled 2026-09-01) — which documents a real, shipped SEO implementation package. Its claims are reconciled here with the same discipline: nothing was carried forward from it without independent re-verification against live file contents in this run.

| Claim | Source | Repository verification (this run) | Production verification | Final confirmed conclusion |
|---|---|---|---|---|
| "The site has zero structured data" | Attributed to a prior audit, per the run brief | **FALSE.** `Organization`, `WebSite`, `WebPage`/`AboutPage`, `BreadcrumbList`, `FAQPage`, and `Article` JSON-LD are confirmed present and code-verified across the homepage, About, both hubs, all 12 Use Cases, all 6 Features, the 1 Solution, and all 7 Resource articles (§15). | The owner's own 2026-09-09 Live URL Test on `/use-cases/freelance-developers` already independently detected "Breadcrumbs — 1 valid item" before this audit began. | **Confirmed outdated/false.** Do not carry this claim forward. |
| Possible "Text2Task \| Text2Task" duplicate title-suffix bug | Raised as a specific thing to check in the run brief | **Not present anywhere checked.** `/about` explicitly bypasses the title template via `title: { absolute: ... }`; every other page's plain-string title receives exactly one `" | Text2Task"` suffix from the root template, confirmed by direct read of the metadata-generation code across all 33 routes. | Not separately re-checked live (metadata-generation code is deterministic and was read directly). | **Confirmed not present.** If this defect ever existed, it has since been fixed or never affected the current route set. |
| "Internal linking is COMPLETE and verified" (Blueprint §21.2, dated 2026-09-01) | `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md:1676-1678` | **Partially accurate, materially incomplete.** Accurate for the specific relationships it names (Client Project Tracker's own links). Does not describe — and this run's fresh audit found real gaps in — the broader use-case internal-link graph: `freelance-developers` and `seo-freelancers` are linked from the SSR `/use-cases` hub but have zero additional contextual inbound links; 6 of 12 use cases aren't homepage-linked; the Resources hub links nowhere into Use Cases/Features/Solutions (§19). | N/A — internal linking is a static code property, fully verifiable from source. | **Confirmed drift/gap since 2026-09-01.** This is new, actionable information for Phase 1, not a contradiction of anything the Blueprint got wrong when it was written — the Blueprint's own scope (§11–§20) never claimed to audit the full use-case-to-use-case link graph. |
| "All Feature pages share... a 2-level BreadcrumbList" (Blueprint §11.2, written before the 6th Feature existed) | `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md:294` | **Confirmed one real exception exists today**: `client-feedback-to-tasks` still uses a 3-level breadcrumb (§15). | N/A — static code property. | **Confirmed real, current, minor defect** — not previously caught because the Blueprint's own claim predates the page count it's describing. |
| "`robots.ts` unchanged and correct... no new orphaned page found" (Blueprint §21.7, dated 2026-09-01) | `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md:1696-1698` | `robots.ts` is confirmed unchanged (`git diff 58cb7ef..HEAD -- app/robots.ts` returns no output) and still correct. Owner review corrected the terminology: `freelance-developers` and `seo-freelancers` are not literal orphans because they are linked from the SSR `/use-cases` hub; the current finding is hub-only/contextual isolation beyond that hub (§19). | Live-verified — `robots.txt` matches source exactly (§10.1). | **`robots.ts` claim: confirmed still true. Internal-linking claim: refined by owner review** — see §19 for the current, corrected finding. |
| "No P0/P1/P2 open work... zero commits since `58cb7ef` touching any SEO-relevant path" (Blueprint §21.8, dated 2026-09-01) | `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md:1700-1703` | **Technically now false, but the substance holds.** `git log 58cb7ef..HEAD` shows 5 commits touching `app/components/landing/` (Live Demo UX, homepage trust-strip, customer-stories section) since that checkpoint — but none touch metadata, schema, `sitemap.ts`, `robots.ts`, or any Feature/Solution/Resource/Use-Case content file. Re-diffed directly in this run: `app/page.tsx`, `app/lib/schema.ts`, `app/sitemap.ts`, `app/robots.ts`, and every `app/lib/use-cases/cases/*.ts` file are unchanged since that commit. | N/A | **Confirmed: the SEO-relevant technical architecture has not regressed since 2026-09-01.** The "zero commits" framing needs updating to "zero SEO-relevant commits," but no actual SEO claim from that section is contradicted. |
| Client Share / SoftwareApplication / cannibalization decisions (Blueprint §2, §4, §5, §9) | Various, `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` | **Independently re-verified and confirmed accurate** in this run via direct file reads of `app/page.tsx`, `app/lib/schema.ts`, `app/solutions/freelancer-project-management-software/page.tsx`, and the Email/Web-Designers page pairs (§15, §18). | N/A | **Confirmed accurate, no drift.** Do not reopen without new evidence, per the Blueprint's own §21.12 standing rule — this run finds no such evidence. |
| GSC "Crawled – currently not indexed... mostly static/favicon/non-www artifacts, not content pages" | Owner-supplied, this run's own brief | Consistent with this run's independent finding that the 47 total GSC-known URLs exceed the 33-URL sitemap, and that no content page was found with a code-level noindex/duplicate/canonical defect. | Not independently re-run in GSC this session (owner-supplied baseline is treated as ground truth, per §4). | **Confirmed consistent, no contradiction found.** |

---

## 26. Confirmed P0 Issues

Per the run's own priority definitions (correctness, security/privacy, indexability blocker, **serious entity ambiguity**, broken canonical/redirect, **measurement blocker required before implementation**):

1. **No founder/Person entity exists on the Text2Task website by owner privacy decision** — no on-site published founder name, no `Person` schema, no personal profile link from `text2task.com` — against a confirmed, real, unrelated same-named product on the Microsoft Marketplace. Phase 0B external research verified a public founder association through indexed external surfaces, but the owner has decided not to publish founder identity in this milestone. (§16, §23A, §42)
2. **Core P0 measurement was incomplete at Phase 0 and is now production deployed / production smoke verified in Phase 1 Milestone 1**: no reliable `paid_conversion` signal existed from the authoritative Creem confirmed-payment webhook path, and `first_extract_created` / `project_saved` were allowlisted but never emitted. The implementation now exists, Preview/Staging verification passed for `first_extract_created` and `project_saved`, PR #2 was merged, and Vercel Production is READY at merge commit `b3e372c`. Manual Production Image Extract runtime verification, manual Production `paid_conversion` verification, and production event-row re-verification were not performed in this gate. (§22, §40, D020)

**Phase 0B external verification result**: GA4's actual live data-collection status has now been externally verified from owner-supplied Google Analytics Admin evidence. GA4 is actively receiving production traffic, and the repository's documented shared-Google-tag architecture is confirmed: GA4 is connected as a destination of the existing `AW-670652067` Google tag. No GA4 application-code change is required. (§22)

No P0 in this audit is a live security breach or a broken indexing/canonical mechanism — those were all checked and confirmed sound (§10, §11, §12, §13).

---

## 27. Confirmed P1 Issues

1. **`freelance-developers` and `seo-freelancers` are hub-only / contextually isolated beyond the `/use-cases` hub** and carry the thinnest content on the site (missing transformation example, signature module, proof, and related-links sections that 8 of 12 use cases have) — this plausibly contributes to their GSC "discovered, not indexed" status. `shopify-freelancers` is one step better but still weakly linked. (§19, §9)
2. **The use-case internal-linking hierarchy the Blueprint described as "complete" is only partially implemented** — 6 of 12 use cases (including all 4 flagged pages) are not linked from the homepage, and Features/Solution ↔ Use Cases linking is one-directional and covers only a subset. (§19)
3. **Bing Search/AI Discovery foundation remains P1**: Bing Webmaster Tools is now configured/verified and the sitemap is submitted/processing, but IndexNow application implementation has not started and Bing data requires processing follow-up. (§23)
4. **`email_confirmed` is allowlisted but never emitted**, classified by owner review as P1 rather than part of the P0 measurement blocker. (§22)
5. **`app/dashboard/billing` and `app/dashboard/profile` rely solely on `proxy.ts` middleware for auth**, with no independent server-side check, unlike every other dashboard route. Low current exploitability, real defense-in-depth gap. (§11.2)
6. **Homepage video loading strategy should be investigated as a Performance/CRO candidate** before any implementation: PageSpeed lab data shows the approximately 15 MB `/landing/text2task-demo.mp4` is the dominant homepage payload and Mobile LCP is materially weaker, while Desktop lab performance is excellent and GSC field CWV data is unavailable. (§22A)
7. **Relevant external authority / mentions / quality-link acquisition is P1 HIGH**: GSC currently reports 3 external link URLs from 2 linking domains, all pointing to the homepage, while Phase 0B external research verifies a meaningful early entity footprint across directories, professional/social profiles, launch/discovery platforms, and at least one editorial publication. The problem is not total absence of mentions; the weakness is limited referring-domain diversity, limited externally recognized link authority, almost no external links to high-value Feature/Solution/Resource pages, and limited independent editorial/reference coverage. Future work must avoid bulk backlinks, spam directories, comment/link spam, PBNs, fabricated editorial coverage, and manipulative exact-match anchor campaigns. (§22B, §23A)

---

## 28. P2/P3 Opportunities

**P2:**
- OG/Twitter image completion for the ~20 routes currently missing share images. (§14)
- Homepage `FAQPage` schema consistency for the existing visible 6-item FAQ section. (§15)
- `client-feedback-to-tasks`'s 3-level breadcrumb, inconsistent with all 5 sibling Feature pages (2-level). (§15)
- 3 of 7 Resource articles missing `datePublished`/`dateModified` in `Article` schema. (§15, §24)
- OG-title branding inconsistency across Feature/Use-Case/Resource pages (some hand-suffix `" | Text2Task"`, most don't). (§14)
- `/api/billing/subscription` and `/api/billing/portal` missing explicit `Cache-Control` headers, inconsistent with every sibling PII-returning route. (§11.7)
- `robots.txt` disallow list omits `/login`, `/signup`, `/check-email`, `/forgot-password`, `/reset-password`, `/homepage-demo/` (no live indexing impact — per-page `noindex` meta already covers all of them). (§10.1)
- Two-hop non-www→www redirect chain at the Vercel/DNS layer (correct destination, one avoidable extra hop). (§13)
- `client_update_created` / `client_update_applied` analytics, classified as P2/product analytics by owner review. (§22)
- Truthful, per-route `lastmod` in the sitemap — requires a new truthful last-content-change data field per route, not a quick sitemap-code change. (§12)

**P3:**
- Optional homepage contextual body link into the Freelancer Solution page (standing item from the Blueprint, still low-urgency). (§25)
- A possible future "How to share project progress with clients" Resource — Blueprint's own decision stands: wait for Client Project Tracker GSC signal, no new evidence yet. (§25)
- `llms.txt` — optional/experimental only, per this run's own instruction.

---

## 29. Unresolved Questions

Resolved in Phase 0B:
- GA4 live collection / Google-tag destination status is **RESOLVED and VERIFIED** from owner-supplied Google Analytics Admin evidence on 2026-09-10. GA4 is actively receiving production traffic through the existing `AW-670652067` Google tag; no GA4 application-code change is required. (§22, D010)
- GSC Links baseline is **RESOLVED and VERIFIED** from owner-supplied Google Search Console Links evidence on 2026-09-10. (§22B, D012)
- GSC Manual Actions baseline is **RESOLVED and VERIFIED — NO ISSUES DETECTED** from owner-supplied Google Search Console evidence on 2026-09-10. (§22C, D013)
- GSC Security Issues baseline is **RESOLVED and VERIFIED — NO ISSUES DETECTED** from owner-supplied Google Search Console evidence on 2026-09-10. (§22C, D013)
- Bing Webmaster Tools property status is **CONFIGURED / VERIFIED** from owner-supplied Bing Webmaster Tools evidence on 2026-09-13; property `text2task.com` was imported/connected successfully. (§23, D014)
- Bing sitemap status is **SUBMITTED / PROCESSING** from owner-supplied Bing Webmaster Tools evidence on 2026-09-13; sitemap `https://www.text2task.com/sitemap.xml` was submitted successfully, with initial errors 0, warnings 0, discovered URLs 0, and last crawl not yet available while processing. (§23.2, D014)
- Bing AI Performance baseline is **CAPTURED** for the selected 3-month period: 0 reported citations and 0 cited pages, with Bing's sampled/report-refinement caveat and no claim that Copilot has never mentioned Text2Task. (§23.4, D014)
- IndexNow setup path is **VERIFIED** but application implementation is **NOT STARTED**; this remains a P1 Search/AI Discovery foundation candidate, with no Phase 0 implementation authorized. (§23.3, D014)
- Bing Backlinks baseline is captured as **DATA NOT YET AVAILABLE / PENDING PROCESSING**, not as 0 backlinks and not as evidence Bing knows of no backlinks. (§23.5, D014)
- External authority/profile/entity footprint baseline is **RESOLVED and VERIFIED** from owner-supplied external research on 2026-09-13. Current Text2Task surfaces verified: LinkedIn, GetApp, Capterra, Uneed, Peerlist, StartupFortune, SaaSHub, UIComet launch discovery, and FounderDB / Peer Push discovery data. G2 is ambiguous / requires identity verification; Product Hunt and BetaList were not externally verified in this search sweep. (§23A, D015)

Resolved in Phase 1 Milestone 1 through production deployment and production smoke verification:
- P0 Measurement Foundation implementation is **PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**. PR #2 was merged to `main` as `b3e372c`, Vercel Production is READY for `main` / `b3e372c`, and the owner smoke-tested Homepage, Dashboard, Extract, Tasks, and Calendar successfully. Manual Production Image Extract runtime verification, manual Production `paid_conversion` verification, production `paid_conversion` row verification, production `first_extract_created` re-verification, and production `project_saved` re-verification were not performed in this gate. (§40, D020)

Still unresolved:
1. Is the owner willing to be publicly named (full name + a personal professional profile link) for entity-disambiguation purposes, and if so, what should the `Person`↔`Organization` schema relationship look like? This is an owner decision, not a technical one. (§16)
2. What is the actual live response-header behavior (Cache-Control, CDN caching) for `/api/billing/subscription` and `/api/billing/portal` in production — cannot be confirmed from source alone. (§11.7)
3. Does any edge/CDN layer sit in front of the two billing API routes that could make the missing explicit no-store header a real (not just theoretical) caching risk? (§11.7)
4. Query-parameter and preview-deployment canonical/duplicate behavior was not load-tested against a live Vercel preview URL in this audit — is this a real concern worth a dedicated check? (§13)
5. Should the four newly-priority-crawled use-case pages be revisited for content depth and internal linking as a distinct Phase 1 workstream, given this run's finding that 3 of the 4 lack the "visual differentiation layer" 8 of 12 siblings have? (§19, §27)

Scheduled follow-up, not blocking Phase 0 completion:
- Recheck Bing Backlinks/Search Performance/Site Explorer after Bing finishes processing the newly onboarded property. This is a scheduled external follow-up, not a reason to keep Phase 0 open. (§23, D014, D015)

---

## 30. Proposed Next Plan

Phase 0B is complete / owner-reviewed. Phase 0 overall is complete / ready for Phase 1 planning. No Phase 1 implementation has started, and no implementation is authorized by this plan.

**Phase 0B — External Baseline Completion (complete / owner-reviewed):**
1. [x] Verify GA4 live collection / Google tag destination status in Google Ads/GA4 admin — **VERIFIED 2026-09-10** from owner-supplied Google Analytics Admin evidence; GA4 is receiving production traffic, Google tag `AW-670652067` sends to both Google Ads and GA4 destinations, tag quality `Good`, no code change required.
2. [x] Verify Google-tag destination architecture — **VERIFIED 2026-09-10** from owner-supplied Google Analytics Admin evidence; Google tag `AW-670652067` sends to the Google Ads destination `AW-670652067` and Google Analytics destination `Text2Task Website`.
3. [x] Verify GSC Core Web Vitals field baseline — **VERIFIED 2026-09-10**; insufficient field data for both Mobile and Desktop, so do not claim PASS or FAIL.
4. [x] Verify PageSpeed homepage lab baseline — **VERIFIED 2026-09-10**; Mobile Performance 88, Desktop Performance 99, dominant anomaly is the approximately 15 MB homepage demo video payload.
5. [x] Verify GSC External Links baseline — **VERIFIED 2026-09-10**; GSC reports 3 external link URLs from 2 linking domains, all to the homepage; this is a weak authority/diversity signal, not an exhaustive backlink count.
6. [x] Verify GSC Internal Links baseline — **VERIFIED 2026-09-10**; GSC reports 190 internal links summary total and a 13-URL top-target export; major money pages `/features/email-to-tasks` and `/solutions/freelancer-project-management-software` each show 14 reported internal links, while the four recently flagged use-case URLs are absent from the exported top-target report.
7. [x] Verify GSC Manual Actions — **VERIFIED 2026-09-10**; Google Search Console reports "No issues detected."
8. [x] Verify GSC Security Issues — **VERIFIED 2026-09-10**; Google Search Console reports "No issues detected."
9. [x] Verify Bing Webmaster Tools property — **CONFIGURED / VERIFIED 2026-09-13**; property `text2task.com` was imported/connected successfully, with reports/data processing for up to 48 hours.
10. [x] Verify Bing sitemap — **SUBMITTED / PROCESSING 2026-09-13**; `https://www.text2task.com/sitemap.xml` submission succeeded, initial errors 0, warnings 0, total URLs discovered 0, and last crawl not yet available because processing had just begun. Do not submit repeatedly.
11. [x] Capture Bing AI Performance baseline — **CAPTURED 2026-09-13**; selected 3-month period showed 0 reported citations and 0 cited pages from Microsoft Copilots and Partners, with sampled/newly-processing caveats.
12. [x] Verify IndexNow setup path — **SETUP PATH VERIFIED 2026-09-13**; application implementation not started, no key-verification file deployed, no URL submission integration added, classified P1 Search/AI Discovery foundation.
13. [x] Capture Bing Backlinks baseline — **DATA NOT YET AVAILABLE / PENDING PROCESSING 2026-09-13**; not recorded as 0 backlinks and not evidence Bing knows of no backlinks.
14. [x] Build the current external authority/profile/entity footprint inventory beyond GSC — **VERIFIED 2026-09-13**; current Text2Task surfaces verified across LinkedIn, GetApp, Capterra, Uneed, Peerlist, StartupFortune, SaaSHub, UIComet launch discovery, and FounderDB / Peer Push discovery data; G2 ambiguous / requires identity verification; Product Hunt and BetaList not externally verified in this search sweep.

**Phase 0B status: COMPLETE / OWNER REVIEWED. Phase 0 overall: COMPLETE / READY FOR PHASE 1 PLANNING.**

**Phase 1 — Implementation (not started; requires owner approval after Phase 1 planning):**
1. **Owner decision + (if approved) entity work**: decide on founder naming; if approved, add a truthful `Person` entity (`founder` relationship on `Organization`, a real personal profile `sameAs` link) — code work only after the owner's decision, never assumed. (P0)
2. **Close the P0 post-signup measurement gap**: add `paid_conversion` from the authoritative Creem confirmed-payment webhook path, implemented production-grade/idempotently, plus `first_extract_created` and `project_saved` at their real trigger points. (P0)
3. **Use-case internal linking + content-depth pass for `freelance-developers`, `seo-freelancers`, `shopify-freelancers`**: add the missing "visual differentiation layer" (transformation example, signature module, proof, related-links) these three lack relative to 8 siblings, and add genuine contextual inbound links from at least one Feature/Solution page and/or the homepage for each — evidenced, not cosmetic, per the Blueprint's own standing "no keyword-stuffed anchors" and "natural copy" rules. (P1)
4. **Bing Search/AI Discovery foundation** after Phase 0B and owner approval: recheck Bing after processing, then implement production-grade IndexNow only if authorized. (P1)
5. **Emit `email_confirmed`** at the real confirmation point. (P1)
6. **Fix `dashboard/billing` and `dashboard/profile`** to carry an independent server-side auth check, matching every other dashboard route. (P1)
7. **Investigate homepage video loading strategy** before changing anything: verify current `<video>` preload/autoplay behavior, whether the entire MP4 downloads during initial page load, poster behavior, codec/compression options, lazy/deferred loading strategy, and effect on product/demo conversion. Preserve the conversion value of the demo while eliminating unnecessary initial bandwidth where technically appropriate. (P1 Performance/CRO candidate)
8. **Relevant external authority / mentions / earned links**: build on the verified early external footprint by favoring genuine editorial coverage, useful comparisons/roundups, relevant founder/profile/entity references, relevant community participation, partnerships/integrations, original evidence/data/assets worth citing, high-quality SaaS/product directories where genuinely useful, and contextual links that naturally support the product/topic pages. Do not buy bulk backlinks, use spam directories, comment/link spam, PBNs, automated backlink blasts, fake reviews, fabricated press/editorial mentions, or manipulative anchor-text campaigns. (P1 HIGH)
9. P2 cleanup batch (OG/Twitter image completion, homepage `FAQPage` schema consistency, breadcrumb depth on `client-feedback-to-tasks`, missing Article dates on 3 resource articles, OG-title branding consistency, billing API cache headers, robots.txt disallow completeness, `client_update_created`/`client_update_applied` analytics) — batched as lower-priority consistency/product-analytics work.

No item above should be implemented without explicit owner approval of this Phase 0 document first, per the run's iron rules.

---

## 31. Acceptance Criteria

Phase 1 work items above are considered correctly implemented only when, for each:
- The specific confirmed gap cited above no longer reproduces on direct file re-read (for code items) or is independently owner-confirmed (for the entity-naming decision).
- No new cannibalization, duplicate-title, or duplicate-canonical issue is introduced (checked against §17/§18's intent map and §25's standing cannibalization rules).
- No fake schema, rating, review, or evidence is introduced — every structured-data addition reflects real, visible page content only.
- Existing, already-correct behavior (sitemap, robots, canonical/redirect chain, admin/dashboard/share auth) is verified unchanged by a fresh diff against this run's baseline before considering any Phase 1 item complete.
- `npx tsc --noEmit` and the full test suite pass clean, consistent with the discipline the Blueprint's own implementation history (§7) already established.

---

## 32. Verification Plan

1. **Code-level**: re-diff every SEO-relevant path (`app/lib/use-cases/`, `app/features/`, `app/solutions/`, `app/resources/`, `app/lib/schema.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/components/landing/`) against this run's baseline commit before and after each Phase 1 change.
2. **Production, read-only HTTP checks** (as used in this audit): `curl -I`/`-w` against the live site for canonical/redirect behavior, `robots.txt` content, and any new headers added to the billing API routes.
3. **Google Search Console**: re-check the four flagged use-case pages' indexing status no sooner than ~1–2 weeks after the 2026-09-09 priority-crawl submission (do not re-submit before then, per this run's own instruction); re-check the Generative AI report and non-brand impressions/positions monthly against this run's §5/§6 baseline.
4. **Google Ads/GA4 admin console**: GA4 live collection / Google-tag destination status has been externally verified (§22, §29, D010). No GA4 code change is required.
5. **Analytics data spot-check**: once the new post-signup events (Phase 1 item 2) ship, confirm rows actually appear in `analytics_events` for a real test signup + extraction + a real Creem test-mode payment, before trusting the admin funnel dashboard's numbers for decision-making.

---

## 33. Run Decision Log

Historical note: existing `2026-09-09/10` values below are retained exactly as historical carryover timestamps; exact timestamp not captured.

| ID | Date/time | Decision | Reason | Evidence | Alternatives rejected | Status |
|---|---|---|---|---|---|---|
| SEO-2026-09-09-D001 | 2026-09-09/10 | Use `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` as the working prior-state reconciliation baseline, since the two run-brief-named reference files could not be located. | The two named files were searched for repo-wide and filesystem-wide and not found; the Blueprint is a repo-tracked, dated, previously-verified document covering the same subject matter with concrete file:line evidence. | Filesystem/workspace search returned zero matches for either named file. | Fabricating or guessing at the missing files' content — rejected outright, would violate "verify first" and could introduce false claims into the Source of Truth. | Closed |
| SEO-2026-09-09-D002 | 2026-09-09/10 | Treat `/admin/*` as CONFIRMED SAFE without further escalation, despite `proxy.ts` not mentioning it. | Direct read of `lib/auth/owner.server.ts` and all 3 admin page components, plus a live production `curl` returning 404, confirms real server-side owner-email auth independent of `robots.txt`. | `app/admin/layout.tsx`, `lib/auth/owner.server.ts:22-32`, 3 admin `page.tsx` files, live curl result. | Escalating this to P0 purely because it's absent from `proxy.ts` — rejected, would have been a false positive not supported by the actual auth mechanism found. | Closed |
| SEO-2026-09-09-D003 | 2026-09-09/10 | Classify the missing founder/Person entity as P0 ("serious entity ambiguity"), not P1/P2. | The run's own P0 definition explicitly names "serious entity ambiguity" as P0-qualifying, and this is a confirmed, verified, currently-real gap against a confirmed unrelated same-named product. | `app/about/page.tsx`, `app/lib/schema.ts`, `app/lib/site-config.ts`, `landing-footer.tsx` — full text search for a founder name, zero hits. | Classifying as P1 to be conservative — rejected because the run brief's own priority definitions place entity ambiguity explicitly at P0. | Closed |
| SEO-2026-09-09-D004 | 2026-09-09/10 | Initial Phase 0A classification of the post-signup/paid-conversion measurement gap as P0 ("measurement blocker required before implementation"). | 5 of 12 allowlisted funnel events are defined but never fired; no paid-conversion event exists at all; the business goal explicitly includes "paying users." Owner review later narrowed P0 measurement scope to `paid_conversion`, `first_extract_created`, and `project_saved`; see D009 and §22/§26. | `lib/analytics/internal-events.server.ts:7-23` (allowlist) cross-referenced against a repo-wide grep for each event name's call sites; `app/api/webhooks/creem/route.ts` full read (zero analytics references). | Deferring all measurement work to P1 since no code is technically broken — rejected because the run's own definition ties core measurement blockers to "required before implementation," for the stated business goal. | Superseded by D009 priority correction |
| SEO-2026-09-09-D005 | 2026-09-09/10 | Do not re-request indexing for the four flagged use-case pages during this audit. | Explicit run instruction. | Run brief. | N/A | Closed |
| SEO-2026-09-09-D006 | 2026-09-09/10 | Perform no application-code implementation in this phase, including for the P0 items identified. | Explicit run instruction — Phase 0 is mapping/audit only. | Run brief iron rules. | Implementing the "easy" fixes (e.g., FAQPage schema) opportunistically during the audit — rejected, would violate the phase boundary. | Closed |
| SEO-2026-09-09-D007 | 2026-09-09/10 | Generate the companion `.docx` using the `docx` npm package installed only inside an isolated scratchpad directory (its own `package.json`, outside the repository), not added to the project's `package.json`/lockfile. | Run instruction: no application/package dependency may be added for DOCX generation; a local one-off script is acceptable if not added to production dependencies. | `npm init`/`npm install docx` run inside the session's scratchpad path, never touching `C:\Users\Home\projects\inboxshaper\package.json`. | Using `pandoc` (not installed on this machine) or a hand-rolled ZIP/OOXML writer (unnecessarily complex, higher defect risk for a one-off) — rejected in favor of a small, isolated, removable script. | Closed |
| SEO-2026-09-09-D008 | 2026-09-09/10 | Use four parallel read-only research agents to cover the highest-fan-out audit areas (public metadata/JSON-LD inventory, private-route/API protection, internal linking + content-duplication, analytics/measurement), each with a self-contained brief citing what this session had already independently verified. | The audit spans ~440 TS/TSX files across 37 required sections; parallel, narrowly-scoped, cited research was more reliable and efficient than a single sequential pass, while every agent's output was independently cross-checked against direct reads (e.g., `proxy.ts`, `app/lib/schema.ts`, `app/page.tsx`, live `curl` checks) before being included as CONFIRMED. | Four agent reports (metadata inventory, route protection, internal linking, analytics) plus this session's own ~25 direct file reads and 7 live HTTP checks. | A single agent covering everything — rejected as higher risk of shallow coverage across 37 sections; doing 100% of the reading in the main session — rejected as unnecessarily context-expensive for a research task this size. | Closed |
| SEO-2026-09-09-D009 | 2026-09-10 00:38 Asia/Jerusalem | Record owner-review corrections without rewriting audit history: Phase 0A is complete/owner-reviewed; Phase 0B is current; Phase 0 overall is not complete; Phase 1 implementation has not started; terminology and priority classifications are corrected in-place in the active run documents. | Owner handoff explicitly corrected phase state, literal-orphan terminology, measurement priorities, GA4 classification, FAQ/OG/Bing/IndexNow priorities, NAP interpretation, and the SoftwareApplication decision. | Owner handoff pasted into this Codex session; re-read of active Markdown run document and DOCX companion; git status showed only the run docs untracked before edits. | Creating a new SEO run document or starting Phase 1 implementation — rejected because the active run remains 2026-09-09 and implementation is not authorized. | Closed |
| SEO-2026-09-09-D010 | 2026-09-10 00:57 Asia/Jerusalem | Close the GA4 live-collection / Google-tag destination question as RESOLVED and VERIFIED. | Owner-supplied Google Analytics Admin evidence showed the `Text2Task Website` stream for `https://www.text2task.com` (Stream ID `14978713002`, Measurement ID `G-TP2F4HWZN4`) with "Data collection is active in the past 48 hours" and "Data flowing"; Enhanced Measurement is enabled; Google tag `AW-670652067` sends to both Google Ads destination `AW-670652067` and Google Analytics destination `Text2Task Website`; tag quality is `Good`. | Owner-supplied Google Analytics Admin evidence recorded in §22 and §29. | Treating "Manage connected site tags: 0 connected" as a defect — rejected because connected site tags and Google-tag destinations are different concepts. Changing GA4 application code — rejected because the external architecture is verified and no code change is required. | Closed |
| SEO-2026-09-09-D011 | 2026-09-10 01:30 Asia/Jerusalem | Record Core Web Vitals field baseline and PageSpeed Insights homepage lab baseline as Phase 0B external verification, without classifying performance as a demonstrated site-wide SEO blocker. | Owner-supplied GSC Core Web Vitals evidence showed insufficient field data for both Mobile and Desktop in the last 90 days; owner-supplied PageSpeed Insights evidence for `https://www.text2task.com/` showed Mobile Performance 88 and Desktop Performance 99, with the approximately 15 MB homepage demo video payload as the dominant anomaly. | GSC Experience → Core Web Vitals; PageSpeed Insights homepage Mobile/Desktop lab results recorded in §22A. | Claiming Core Web Vitals PASS or FAIL — rejected because field data is unavailable. Removing or blindly reducing the homepage video — rejected because product/demo conversion value must be preserved and implementation is not authorized. Treating the video payload as explaining the site's non-brand average position around 78 by itself — rejected because no such causal evidence is demonstrated. | Closed |
| SEO-2026-09-09-D012 | 2026-09-10 01:51 Asia/Jerusalem | Record Google Search Console Links baseline as Phase 0B external verification and classify relevant external authority / mentions / quality-link acquisition as P1 HIGH. | Owner-verified GSC Links data showed 3 reported external link URLs from 2 linking domains (`reddit.com` 2, `startupbase.io` 1), all pointing to the homepage; the two Reddit URLs are variants of the same underlying Reddit thread; no externally-linked Feature/Solution/Resource money page is surfaced. GSC internal-links summary reported 190 total, with money pages `/features/email-to-tasks` and `/solutions/freelancer-project-management-software` each at 14, while the four recently flagged use-case URLs are absent from the exported top-target report. | Owner-verified GSC Links main report plus Latest links, More sample links, and Top target pages exports recorded in §22B. | Stating "Text2Task has only 3 backlinks on the internet" — rejected because GSC Links is not an exhaustive commercial backlink index. Characterizing all money-page internal linking as broken — rejected because major money pages already show meaningful internal-link presence. Recommending mass internal-link insertion or manipulative link acquisition — rejected; future links must be natural, useful, and architecturally justified. | Closed |
| SEO-2026-09-09-D013 | 2026-09-10 01:56 Asia/Jerusalem | Record Google Search Console Manual Actions and Security Issues baselines as Phase 0B external verification, both with no issues detected. | Owner-verified GSC evidence showed Security & Manual Actions → Manual actions status "No issues detected" and Security & Manual Actions → Security issues status "No issues detected." | Owner-verified Google Search Console Manual actions and Security issues screens recorded in §22C. | Overstating this as proof every SEO issue is absent — rejected because Manual Actions only confirms no current GSC manual action. Overstating this as a complete security audit — rejected because GSC Security Issues is not a substitute for repository/application security controls. Changing Google configuration, production, code, environment, or database — rejected because this is documentation-only external baseline recording. | Closed |
| SEO-2026-09-09-D014 | 2026-09-13 13:06 Asia/Jerusalem | Record Bing Webmaster Tools onboarding, Bing sitemap submission, IndexNow setup-path baseline, Bing AI Performance baseline, and Bing Backlinks pending-processing baseline as Phase 0B external verification. | Owner-supplied Bing Webmaster Tools evidence showed property `text2task.com` imported/connected successfully; Bing stated initial reports/data may take up to 48 hours; sitemap `https://www.text2task.com/sitemap.xml` was submitted successfully and initially showed Processing; IndexNow setup path was inspected and a key was generated during setup exploration, but no app implementation occurred; AI Performance selected 3-month period showed 0 reported citations / 0 cited pages; Backlinks showed "No data available." | Owner-supplied Bing Webmaster Tools onboarding, Sitemaps, IndexNow, AI Performance (Beta), and Backlinks screens recorded in §23. | Treating temporarily empty Bing reports as evidence of zero search/index/backlink activity — rejected because the property was newly onboarded and processing. Treating 0 discovered URLs immediately after sitemap submission as an indexing defect — rejected because the sitemap was Processing. Claiming Copilot has never mentioned Text2Task — rejected because Bing AI Performance is sampled and newly-processing. Recording Bing Backlinks as 0 backlinks — rejected because the status is data not yet available / pending processing. Implementing IndexNow during Phase 0 — rejected because no implementation was authorized. | Closed |
| SEO-2026-09-09-D015 | 2026-09-13 13:17 Asia/Jerusalem | Close Phase 0B external baseline completion as COMPLETE / OWNER REVIEWED after recording the external authority/profile/entity footprint baseline. | Owner-supplied external research verified current Text2Task surfaces across LinkedIn, GetApp, Capterra, Uneed, Peerlist, StartupFortune, SaaSHub, UIComet launch discovery, and FounderDB / Peer Push discovery data. This establishes that Text2Task has a meaningful early external entity footprint while GSC still shows limited external-link diversity and no surfaced links to high-value Feature/Solution/Resource pages. Bing Backlinks/Search Performance/Site Explorer remain a scheduled processing follow-up, but this does not block Phase 0 completion. | Owner-supplied external authority/profile/entity sweep recorded in §23A, plus existing GSC Links baseline (§22B) and Bing baseline (§23). | Saying "Text2Task has no external presence" — rejected as false. Counting G2 as a verified current Text2Task authority asset — rejected because current externally visible G2 content does not clearly establish identity. Recording Product Hunt or BetaList as absent — rejected because they were only not externally verified in this search sweep. Starting Phase 1 implementation — rejected because only documentation update was authorized. | Closed |
| SEO-2026-09-09-D016 | 2026-09-13 13:26 Asia/Jerusalem | Add the Phase 1 Master Implementation Plan and move the run into Phase 1 planning without starting implementation. | Phase 0 is complete / owner-reviewed and established the evidence base for the Phase 1 order: measurement foundation first, then entity disambiguation, internal authority for weak use cases, core non-brand ranking pages, Bing/IndexNow foundation, external authority program, and homepage performance/CRO investigation. The plan is documentation-only and intentionally preserves Phase 0 findings as historical evidence. | Current run document read in full; Phase 0 evidence in §§5-23A and backlog in §§26-30. | Starting implementation immediately — rejected because the owner requested planning only. Changing application code, database, environment, external consoles, Vercel, DNS, Google, Bing, or production — rejected because this update is documentation-only. Reordering the first milestone away from measurement — rejected because Phase 1 work aimed at paying users cannot be measured until the P0 measurement foundation is closed. | Closed |
| SEO-2026-09-09-D017 | 2026-09-13 15:12:33 Asia/Jerusalem | Implement Phase 1 Milestone 1 Measurement Foundation locally without a database migration. | The existing `analytics_events` table already supports `event_name`, `user_id`, attribution fields, sanitized metadata, service-role-only inserts, and a unique partial `idempotency_key` index; `users.successful_extract_count` and `record_successful_extraction()` already support the first-extract boundary; Creem's verified webhook RPC already returns `result_resolved_user_id` after authoritative entitlement processing. | Direct inspection of `lib/analytics/internal-events.server.ts`, `lib/analytics/request-attribution.server.ts`, `app/api/extract/route.ts`, `app/api/extract-image/route.ts`, `app/api/projects/import/route.ts`, `app/api/homepage-demo/claim/save/route.ts`, `app/api/homepage-demo/claim/save-anyway/route.ts`, `app/api/webhooks/creem/route.ts`, and `supabase/migrations/202609040001_canonical_production_closure.sql`; targeted and relevant regression tests; local typecheck/build. | Creating a new analytics system — rejected because the existing server pipeline is sufficient. Adding a migration/RPC change — rejected because existing schema and RPCs are adequate. Emitting paid conversion from checkout/browser redirect — rejected because only verified Creem webhook processing is authoritative. Counting every save as `project_saved` — rejected because Phase 1 needs an activation/value milestone, so the event is first successful persisted project save per user. | Implemented locally / awaiting owner review |
| SEO-2026-09-09-D018 | 2026-09-13 16:55:06 Asia/Jerusalem | Preserve normalized acquisition storage and resolve acquisition -> paid attribution through a tested `user_id` / linked `anonymous_id` reporting helper instead of copying UTM/source fields onto `paid_conversion`. | Owner-approved correction pass explicitly rejected duplicated attribution fields on revenue events when normalized attribution can reliably resolve them. `analytics_events` already stores user-linked signup/acquisition rows and anonymous browser identifiers; `paid_conversion` has the authenticated `user_id`, which is the stable join key. | `lib/analytics/acquisition-attribution-resolver.server.ts`; `lib/analytics/acquisition-attribution-resolver.server.test.ts`; `app/admin/analytics/page.tsx` existing signup-attribution query pattern; `lib/analytics/signup-attribution.server.ts`; existing `analytics_events` schema. | Copying UTM/source/medium/campaign/referrer fields into every `paid_conversion` row — rejected as duplicated attribution storage. Adding a database migration — rejected because the existing event table and indexes are sufficient. Building a new admin dashboard UI in this milestone — rejected because the milestone only requires a queryable/testable contract. | Implemented locally / awaiting owner review |
| SEO-2026-09-09-D019 | 2026-09-13 18:59:27 Asia/Jerusalem | Accept the Phase 1 Milestone 1 Preview/Staging runtime verification as sufficient for merge review, with image extraction and `paid_conversion` manual runtime checks explicitly deferred. | Owner-verified Vercel configuration showed Preview and Production use different Supabase project URLs, and Preview runtime was confirmed against `text2task-staging`. Vercel created a READY Preview deployment for PR #2 / implementation commit `10846aa0c9dfc7a2f6a2a215374d75eb6a5103f6`. Preview/Staging runtime checks passed for first authenticated text extraction, exactly-one `first_extract_created`, first project save / `project_saved`, and second-extraction deduplication. Route-level image extraction tests already pass, and paid-conversion semantics are covered by automated tests, but their manual runtime checks were intentionally deferred. | Owner-supplied Vercel/Supabase environment-isolation evidence; Preview/Staging test user `eidelman.yan+seo-m1-preview@gmail.com`; Staging `analytics_events` observations for `first_extract_created` and `project_saved`; persisted Staging project `Website Launch Updates and QA`; local automated test/build/typecheck/lint evidence recorded in §40.5. | Blocking merge review until manual image extraction runtime verification — rejected because the owner accepted it as a non-blocking follow-up after text extraction and deduplication runtime proof. Performing a Preview Creem payment/webhook mutation test during this gate — rejected because Creem environment variables require a separate safe verification strategy. Marking Milestone 1 production-verified — rejected because production verification has not started. | Preview verified / owner approved for merge review |
| SEO-2026-09-09-D020 | 2026-09-14 11:58:23 Asia/Jerusalem | Close Phase 1 Milestone 1 as production deployed, production smoke verified, and complete, while preserving deferred Image Extract and `paid_conversion` runtime follow-ups. | PR #2 was merged successfully to `main` as merge commit `b3e372c`; Vercel Production deployment for environment `Production`, branch `main`, commit `b3e372c` reached READY; owner production smoke testing on `https://www.text2task.com/` passed for Homepage, Dashboard, Extract, Tasks, and Calendar with no user-visible regression observed. The production gate did not include manual Production Image Extract runtime verification, manual Production `paid_conversion` verification, production `paid_conversion` row verification, production `first_extract_created` re-verification, or production `project_saved` re-verification. | Owner-supplied merge/deployment facts; owner post-deployment smoke-test report; git reconciliation confirming `origin/main` and local `main` contain merge commit `b3e372c`, implementation commit `10846aa`, and preview-verification docs commit `b153e8a`. | Marking Image Extract manual runtime as verified — rejected because it was not performed. Marking `paid_conversion` runtime or row verification as complete — rejected because it was not performed and still requires a safe Creem strategy. Merging/deploying manually during this documentation task — rejected because the task is documentation-only and the production deployment already existed. | Production deployed / production smoke verified / complete |
| SEO-2026-09-09-D021 | 2026-09-14 12:57:49 Asia/Jerusalem | Start Phase 1 Milestone 2 as mapping / audit / planning only, with implementation blocked on owner decisions for public founder identity and canonical external profile policy. | Milestone 2 is privacy- and reputation-sensitive: the strongest entity-disambiguation move would publish a founder/person identity and link it to the Organization, but the current website intentionally uses generic founder language and no `Person` schema. Existing source supports `Organization`, `WebSite`, `WebPage`, `AboutPage`, `CollectionPage`/`ItemList`, `BreadcrumbList`, `FAQPage`, and `Article`; it does not support hidden schema-only founder claims. External documentation verifies a real Text2Task footprint and external founder association, but owner approval is required before making that identity visible on-site. | Direct reads of `app/lib/site-config.ts`, `app/lib/schema.ts`, `app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/layout.tsx`, `app/components/landing/landing-footer.tsx`, `app/components/use-cases/use-case-detail-page.tsx`, `app/use-cases/page.tsx`, representative Feature/Solution/Resource pages, and §23A external-profile baseline. | Implementing `Person` schema before visible founder copy — rejected because structured data must reflect visible truth. Adding unverified directory/profile URLs to `Organization.sameAs` — rejected until exact current URLs are owner-verified. Adding `SoftwareApplication`/`Product` schema during this milestone — rejected unless a separate truthful, visible product-schema basis is approved. | Mapping / owner decisions required |
| SEO-2026-09-09-D022 | 2026-09-14 13:56:50 Asia/Jerusalem | Implement Phase 1 Milestone 2 using Organization/product/domain/profile signals only, while keeping founder identity private. | The owner explicitly decided not to publish the founder's personal name at this time. Therefore the implementation must strengthen Text2Task's canonical entity without adding a `Person` node, founder metadata, `Organization.founder`, personal-profile `sameAs`, or personal social/profile links. Existing About-page photos may remain as unnamed human trust signals. | Owner instruction for Milestone 2 implementation; direct source reads of `app/lib/site-config.ts`, `app/lib/schema.ts`, `app/page.tsx`, `app/layout.tsx`, `app/about/page.tsx`, `app/components/landing/landing-footer.tsx`; existing external-profile inventory in §23A and §41. | Publishing the founder name — rejected by owner privacy decision. Adding `Person` schema or `Organization.founder` without visible named support — rejected. Adding founder/personal LinkedIn or Peerlist links — rejected. Expanding `Organization.sameAs` to GetApp/Capterra/Uneed/SaaSHub/Peerlist/UIComet/FounderDB without exact canonical URL verification from repo/current run evidence — rejected/deferred. Reintroducing `SoftwareApplication`/`Product` schema — rejected because no new truthful visible basis was approved. | Implemented locally / awaiting owner review |

---

## 34. Run Action Log

Historical note: existing `2026-09-09/10` values below are retained exactly as historical carryover timestamps; exact timestamp not captured.

| Date/time | Phase | Action | Evidence/input | Files inspected | Files changed | Result | Verification | Status |
|---|---|---|---|---|---|---|---|---|
| 2026-09-09/10 | Phase 0 | Repository structure mapping (route inventory, package.json, use-case registry) | Direct file reads/globs | `package.json`, `app/**/page.tsx` (33 routes), `app/lib/use-cases/index.ts` | None | 33-route inventory built, use-case count (12) confirmed | Cross-checked against GSC's 33-discovered-page count — exact match | Complete |
| 2026-09-09/10 | Phase 0 | Sitemap/robots/redirect/middleware audit | Direct file reads + live `curl` checks | `app/sitemap.ts`, `app/robots.ts`, `next.config.ts`, `proxy.ts` | None | Confirmed sitemap/robots logic exact, redirect chain live-verified (2-hop www enforcement, 1-hop /index.html) | Live `curl -I`/`-w` against production, robots.txt live-fetched and diffed against source | Complete |
| 2026-09-09/10 | Phase 0 | Admin auth verification | Direct file reads + live `curl` | `app/admin/layout.tsx`, `lib/auth/owner.server.ts`, 3 admin `page.tsx` files | None | Confirmed real server-side owner-email gate, 404 on unauthorized | Live `curl` to `/admin/analytics` → 404 | Complete |
| 2026-09-09/10 | Phase 0 | Schema/entity architecture review | Direct file reads | `app/lib/schema.ts`, `app/page.tsx`, `app/about/page.tsx`, `landing-footer.tsx`, `site-config.ts` | None | Confirmed Organization/WebSite/AboutPage schema, confirmed no Person entity/founder name anywhere | Full-text search for founder name across all entity/copy files, zero hits | Complete |
| 2026-09-09/10 | Phase 0 | Parallel agent: public metadata + JSON-LD full inventory | Background research agent (general-purpose) | ~30 page/template files across homepage/about/contact/legal/use-cases/resources/solutions/features | None | Full metadata table (§14), structured-data inventory (§15), title-suffix bug ruled out, breadcrumb anomaly found | Cross-checked homepage/about/schema.ts findings against this session's own direct reads — consistent | Complete |
| 2026-09-09/10 | Phase 0 | Parallel agent: private route + API protection audit | Background research agent (general-purpose) | ~25 files across `app/dashboard/`, `app/login` family, `app/homepage-demo/`, `app/share/[publicId]`, `lib/share/`, `app/api/**` | None | Confirmed dashboard/admin/share/auth protection map (§11), found billing-page and billing-API gaps | Cross-checked against this session's own `proxy.ts` full read and live admin-route curl | Complete |
| 2026-09-09/10 | Phase 0 | Parallel agent: internal linking + use-case content-duplication assessment | Background research agent (general-purpose) | `app/use-cases/page.tsx`, `use-case-detail-page.tsx`, `use-case-related.tsx`, `homepage-use-cases-section.tsx`, `landing-footer.tsx`, all 12 `app/lib/use-cases/cases/*.ts` | None | Confirmed hub-only/contextual-isolation finding (§19), content-depth risk ranking for the 4 flagged pages | Cross-checked footer/homepage use-case link lists directly in this session | Complete |
| 2026-09-09/10 | Phase 0 | Parallel agent: analytics/measurement/Bing/IndexNow audit | Background research agent (general-purpose) | ~20 files across `app/components/analytics/`, `lib/analytics/`, `app/api/analytics/`, `app/api/homepage-demo/`, `app/api/webhooks/creem/`, 1 Supabase migration file | None | Confirmed GA4/Google Ads/Clarity/Vercel Analytics wiring, full funnel event map, owner-exclusion mechanism, Bing/IndexNow absence | Cross-checked `google-ads-tag.tsx` and `lib/analytics/events.ts` directly in this session before accepting the agent's GA4 conclusion | Complete |
| 2026-09-09/10 | Phase 0 | Reconciliation against `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` | Direct read of the full 1,730-line document + targeted `git diff`/`git log` against its checkpoint commit `58cb7ef` | `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` + `git log`/`git diff` output | None | Produced §25's claim-by-claim reconciliation table | `git diff 58cb7ef..HEAD` re-run against every SEO-relevant path named in the Blueprint's own §21.8 | Complete |
| 2026-09-09/10 | Phase 0 | Documentation authoring | This document | N/A | **Created**: `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.md`, `.docx` (companion) | Both files created per run instructions | Content cross-checked against every finding above before writing | Complete |
| 2026-09-10 00:38 Asia/Jerusalem | Phase 0B | Owner-review documentation correction and context recovery | Owner handoff; active run Markdown; active run DOCX; historical Blueprint; git status | `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.md`, `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.docx`, `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` | Current run Markdown and DOCX only | Status/phase and owner-review priority corrections recorded; no implementation started | Git status and app-path status confirmed no application files changed | Complete |
| 2026-09-10 00:57 Asia/Jerusalem | Phase 0B | GA4 live collection and Google-tag destination verification recorded | Owner-supplied Google Analytics Admin evidence | Current run Markdown and DOCX | Current run Markdown and DOCX only | GA4 status changed from external-verification-required/unknown to RESOLVED and VERIFIED; Phase 0B checklist updated; unresolved GA4 question closed | DOCX regenerated from updated Markdown and inspected for D010 / GA4 verification text | Complete |
| 2026-09-10 01:30 Asia/Jerusalem | Phase 0B | Core Web Vitals field baseline and PageSpeed homepage lab baseline recorded | Owner-supplied GSC Core Web Vitals and PageSpeed Insights evidence | Current run Markdown and DOCX | Current run Markdown and DOCX only | CWV field data marked unavailable due to insufficient CrUX data; PageSpeed homepage Mobile/Desktop lab metrics recorded; homepage video payload classified as P1 Performance/CRO investigation candidate; Phase 0B checklist updated | DOCX regenerated from updated Markdown and inspected for D011 / CWV / PageSpeed text | Complete |
| 2026-09-10 01:51 Asia/Jerusalem | Phase 0B | Google Search Console Links baseline recorded | Owner-verified GSC Links main report, Latest links export, More sample links export, and Top target pages export | Current run Markdown and DOCX | Current run Markdown and DOCX only | External links baseline recorded as 3 GSC-reported external link URLs from 2 linking domains, all to homepage; internal links baseline recorded as 190 summary total with 13 exported top-target URLs; authority classified as a major evidence-supported constraint and P1 HIGH opportunity | DOCX regenerated from updated Markdown and inspected for D012 / GSC Links text | Complete |
| 2026-09-10 01:56 Asia/Jerusalem | Phase 0B | Google Search Console Manual Actions and Security Issues baselines recorded | Owner-verified GSC Manual actions and Security issues screens | Current run Markdown and DOCX | Current run Markdown and DOCX only | GSC Manual Actions recorded as VERIFIED — NO ISSUES DETECTED; GSC Security Issues recorded as VERIFIED — NO ISSUES DETECTED; Phase 0B checklist updated | DOCX regenerated from updated Markdown and inspected for D013 / Manual Actions / Security Issues text | Complete |
| 2026-09-13 13:06 Asia/Jerusalem | Phase 0B | Bing Webmaster Tools onboarding baseline recorded | Owner-verified Bing Webmaster Tools property, sitemap, IndexNow setup, AI Performance, and Backlinks evidence | Current run Markdown and DOCX | Current run Markdown and DOCX only | Bing Webmaster Tools property recorded as CONFIGURED / VERIFIED; Bing sitemap recorded as SUBMITTED / PROCESSING; Bing AI Performance baseline captured; IndexNow setup path verified but implementation not started; Bing Backlinks recorded as DATA NOT YET AVAILABLE / PENDING PROCESSING; Phase 0B checklist updated | DOCX regenerated from updated Markdown and inspected for D014 / Bing baseline text | Complete |
| 2026-09-13 13:17 Asia/Jerusalem | Phase 0B | External authority/profile/entity footprint baseline recorded and Phase 0B closed | Owner-supplied external authority/profile/entity research | Current run Markdown and DOCX | Current run Markdown and DOCX only | Verified current Text2Task surfaces recorded; G2 marked ambiguous / requires identity verification; Product Hunt and BetaList marked not externally verified in this search sweep; Phase 0B marked COMPLETE / OWNER REVIEWED; Phase 0 overall marked COMPLETE / READY FOR PHASE 1 PLANNING; Bing processing recheck recorded as non-blocking scheduled follow-up | DOCX regenerated from updated Markdown and inspected for D015 / Phase 0 completion / external footprint text | Complete |
| 2026-09-13 13:26 Asia/Jerusalem | Phase 1 Planning | Phase 1 Master Implementation Plan added | Owner request to create a detailed production-grade Phase 1 plan based on completed Phase 0 evidence | Current run Markdown and DOCX; full current run Markdown read before writing | Current run Markdown and DOCX only | Milestone order, dependencies, owner decisions, acceptance criteria, verification plan, measurable outcomes, rollback criteria, database/external-console requirements, and recommended first milestone recorded; Phase 1 marked PLANNING; implementation not started | DOCX regenerated from updated Markdown and inspected for D016 / Phase 1 Master Implementation Plan / Phase 1 Recommended First Milestone text | Complete |
| 2026-09-13 15:12:33 Asia/Jerusalem | Phase 1 Milestone 1 | Measurement Foundation implemented locally | Owner-approved Phase 1 Milestone 1 request | Active run Markdown, analytics/event helpers, extraction routes, project import/demo save routes, Creem webhook route/RPC, tests, build/lint/typecheck outputs | Local application/test/docs changes only; no database/environment/production/external-console changes | Added server-authoritative `first_extract_created`, `project_saved`, and `paid_conversion` implementation using existing `analytics_events` pipeline and idempotency support; no DB migration required | Targeted tests 5 files / 26 tests passed; broader relevant regression set 16 files / 236 tests passed; `npx.cmd tsc --noEmit` passed; changed-file ESLint passed; full repo `npm.cmd run lint` failed only on pre-existing unrelated share-link lint error; `npm.cmd run build` passed after approved network access for Google Fonts | Implemented locally / awaiting owner review |
| 2026-09-13 16:55:06 Asia/Jerusalem | Phase 1 Milestone 1 correction pass | Pre-commit owner-review gate corrections completed locally | Owner-review gate returned CHANGES REQUIRED BEFORE COMMIT | Active run Markdown/DOCX, analytics helpers, acquisition resolver, extraction routes/tests, project import/tests, tasks route/tests, homepage-demo claim/save tests, Creem webhook tests, project-persistence repo search | Local application/test/docs changes only; no database/migration/environment/configuration/production/external-console changes | Added missing distinct-renewal paid-conversion tests, completed `project_saved` coverage for `app/api/tasks/route.ts -> createProjectWithSubtasks`, added route-level image extraction tests, added analytics failure isolation tests across all seven requested paths, and added a tested acquisition -> paid attribution resolver contract | Targeted tests 10 files / 129 tests passed; relevant regression suite 21 files / 323 tests passed; `npx.cmd tsc --noEmit` passed; changed-file ESLint passed; full repo lint still failed only on unrelated pre-existing files; first `npm.cmd run build` failed on sandboxed Google Fonts fetch, network-enabled rerun passed | Correction pass complete / ready for commit review |
| 2026-09-13 18:59:27 Asia/Jerusalem | Phase 1 Milestone 1 pre-merge Preview gate | Preview deployment, Preview/Staging isolation, and core runtime measurement checks recorded | Owner-supplied Vercel Preview/Supabase/Staging runtime evidence for PR #2 and implementation commit `10846aa0c9dfc7a2f6a2a215374d75eb6a5103f6` | Active run Markdown/DOCX and current git status only | Current run Markdown and DOCX only | PR #2 opened; Vercel Preview READY; Preview/Staging Supabase isolation verified; first text extraction runtime PASS; `first_extract_created` runtime PASS; second extraction deduplication PASS; first project save / `project_saved` runtime PASS; image runtime manually deferred by owner; `paid_conversion` runtime deferred pending safe Creem strategy; owner approved Milestone 1 for merge review | Documentation-only update; application/test files unchanged by this task; no database/environment/Vercel configuration/production change; no merge or production deploy | Preview verified / owner approved for merge review |
| 2026-09-14 11:58:23 Asia/Jerusalem | Phase 1 Milestone 1 production closeout | Merge, Production deployment, and owner production smoke verification recorded | Owner-supplied PR #2 merge/deployment facts and production smoke-test report | Active run Markdown/DOCX, git branch/status/history only | Current run Markdown and DOCX only | PR #2 merged successfully; merge commit `b3e372c`; Vercel Production deployment READY for environment `Production`, branch `main`, commit `b3e372c`; owner production smoke test PASS for Homepage, Dashboard, Extract, Tasks, and Calendar; no user-visible regression observed; Image Extract manual runtime remains deferred / non-blocking; `paid_conversion` manual runtime remains deferred / safe verification required | Git reconciliation confirmed local `main` fast-forwarded to `origin/main` at `b3e372c`; `10846aa` and `b153e8a` are ancestors of `main`; documentation-only branch used; no application/test/config/database files changed by this task; no manual deploy | Production deployed / production smoke verified / complete |
| 2026-09-14 12:57:49 Asia/Jerusalem | Phase 1 Milestone 2 mapping | Entity / Brand Disambiguation mapping and implementation plan recorded | Owner request to start Milestone 2 as mapping/audit/planning only; active run document; direct source reads | Current run Markdown/DOCX; `app/lib/site-config.ts`; `app/lib/schema.ts`; `app/page.tsx`; `app/about/page.tsx`; `app/contact/page.tsx`; `app/layout.tsx`; `app/components/landing/landing-footer.tsx`; `app/components/use-cases/use-case-detail-page.tsx`; `app/use-cases/page.tsx`; representative Feature/Solution/Resource pages | Current run Markdown and DOCX only | Current on-site entity graph inventoried; founder/person absence reconfirmed; brand disambiguation classified PARTIAL; external-profile baseline converted into sameAs suitability policy; canonical entity graph and owner-decision checklist recorded; implementation sequence proposed without code changes | Git status confirmed clean before documentation edit; no application/test/database/environment/config/production changes; DOCX synchronized from Markdown and validated for Milestone 2 markers | Mapping / owner decisions required |
| 2026-09-14 13:56:50 Asia/Jerusalem | Phase 1 Milestone 2 implementation | Entity / Brand Disambiguation implemented locally without publishing founder identity | Owner privacy decision; current run Markdown; Blueprint; direct source reads; local verification | `app/lib/site-config.ts`; `app/page.tsx`; `app/layout.tsx`; `app/about/page.tsx`; `app/page.test.ts`; `app/about/page.test.ts`; `app/lib/schema-dangling-entity-references.test.ts`; current run Markdown/DOCX | `app/lib/site-config.ts`; `app/page.tsx`; `app/layout.tsx`; `app/about/page.tsx`; `app/page.test.ts`; `app/about/page.test.ts`; current run Markdown and DOCX | Canonical brand constants added; homepage Organization/WebSite schema normalized; root metadata aligned to canonical description; About copy strengthened as official product-site/entity copy; `Organization.sameAs` kept to company Facebook and LinkedIn only; no `Person`, founder metadata, founder name, personal-profile link, legalName, address, phone, Product, or SoftwareApplication schema added | Targeted tests: 3 files / 71 tests PASS; relevant regression: 9 files / 105 tests PASS; `npx tsc --noEmit` PASS; changed-file ESLint PASS; production build PASS after network-enabled rerun for Google Fonts; full lint still fails only on unrelated pre-existing share-link lint error plus warnings | Implemented locally / awaiting owner review |
| 2026-09-14 18:08:27 Asia/Jerusalem | Phase 1 Milestone 2 production closeout | PR #4 merge, Production deployment, and owner Production smoke verification recorded | Owner-supplied PR #4 merge/deployment facts and Production smoke-test report | Active run Markdown/DOCX, git branch/status/history only | Current run Markdown and DOCX only | PR #4 merged successfully; production merge commit `80b3318`; Vercel Production READY; owner Production smoke test PASS for Homepage and About; new "ABOUT TEXT2TASK" eyebrow and opening paragraph verified live; existing About photos remain; founder personal name remains unpublished; `Person` schema remains intentionally absent; no personal-profile `sameAs` links introduced; no visible regression observed; privacy decision preserved | Git reconciliation confirmed local `main` fast-forwarded to `origin/main` at `80b3318`; documentation-only branch used; no application/test/config/database/environment files changed by this task; no deploy performed by this task | Production deployed / production smoke verified / complete |

Phase 1 Milestone 1 changed application code and tests through PR #2. Phase 1 Milestone 2 changed application code, tests, and documentation through PR #4 and is now production deployed, production smoke verified, and complete. This closeout task changes documentation only. **Application code changed by this documentation task: NO. Test files changed by this documentation task: NO. Database changed: NO. Migration required: NO. Environment changed: NO. Vercel configuration changed by this task: NO. Production changed by this task: NO. Google configuration changed: NO. Bing application integration changed: NO. Manual deploy performed: NO.**

---

## 35. Files Inspected

Representative, non-exhaustive list by category (this audit does not claim a single exact repo-wide file count; the categories below reflect what was directly read or independently cross-checked, including everything cited by file:line throughout this document):

- **Config/infrastructure**: `package.json`, `next.config.ts`, `next.config.test.ts`, `proxy.ts`, `proxy.test.ts`, `.vercel/repo.json`
- **SEO core**: `app/sitemap.ts`, `app/robots.ts`, `app/lib/site-config.ts`, `app/lib/schema.ts`, `app/components/JsonLd.tsx`, `app/layout.tsx`
- **Public pages** (33 sitemap routes + `/pricing`): `app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/pricing/page.tsx`, `app/use-cases/page.tsx`, `app/use-cases/[slug]/page.tsx`, `app/resources/page.tsx`, all 7 resource article `page.tsx` files, `app/solutions/freelancer-project-management-software/page.tsx`, all 6 `app/features/*/page.tsx` files
- **Use-case data files** (all 12): `app/lib/use-cases/index.ts`, `app/lib/use-cases/types.ts`, and every file in `app/lib/use-cases/cases/`
- **Use-case/shared rendering components**: `app/components/use-cases/use-case-detail-page.tsx`, `use-case-related.tsx`, `use-case-related-links.tsx`, `use-case-transformation.tsx`, `use-case-proof.tsx`
- **Landing/homepage components**: `homepage-hero.tsx`, `homepage-faq-section.tsx`, `homepage-use-cases-section.tsx`, `homepage-trust-strip.tsx`, `homepage-customer-stories-section.tsx`, `homepage-post-extraction-section.tsx`, `landing-footer.tsx`, `landing-header.tsx`
- **Private-route/auth**: `app/admin/layout.tsx`, `lib/auth/owner.server.ts`, all 3 `app/admin/**/page.tsx`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/billing/page.tsx`, `app/dashboard/profile/page.tsx`, `app/dashboard/calendar/page.tsx`, `lib/supabase/requireDashboardUser.ts`, `app/login/page.tsx`, `app/signup/layout.tsx`, `app/check-email/layout.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/auth/confirm/route.ts`, `app/homepage-demo/review/page.tsx`, `app/homepage-demo/claim/continue/page.tsx`, `app/share/[publicId]/page.tsx`, `lib/share/share-session-grant.server.ts`
- **API routes spot-checked**: `app/api/share/[publicId]/{projection,pin}/route.ts`, `app/api/share/session/route.ts`, `app/api/homepage-demo/{bootstrap,extract,review}/route.ts`, `app/api/billing/{subscription,portal}/route.ts`, `app/api/webhooks/creem/route.ts`, `app/api/auth/login/route.ts`, `app/api/analytics/event/route.ts`
- **Analytics/measurement**: `app/components/analytics/{google-ads-tag,microsoft-clarity,consent-aware-vercel-analytics,attribution-capture,cookie-consent-banner,analytics-error-boundary}.tsx`, `lib/analytics/{events,internal-events.server,owner-exclusion.server,signup-attribution.server,request-attribution.server,analytics-consent,analytics-paths,live-demo-funnel,owner-analytics-window}.ts`, `app/admin/analytics/page.tsx`, `supabase/migrations/202609040001_canonical_production_closure.sql`
- **Phase 1 Milestone 1 implementation mapping**: `app/api/extract/route.ts`, `app/api/extract-image/route.ts`, `app/api/projects/import/route.ts`, `app/api/homepage-demo/claim/save/route.ts`, `app/api/homepage-demo/claim/save-anyway/route.ts`, `app/api/webhooks/creem/route.ts`, `lib/analytics/internal-events.server.ts`, `lib/analytics/request-attribution.server.ts`, and `supabase/migrations/202609040001_canonical_production_closure.sql`
- **Customer stories**: `app/api/customer-stories/{submit,public}/route.ts`, `lib/customer-stories/public-customer-stories.server.ts`
- **Reference documentation**: `docs/Text2Task_SEO_Master_Blueprint_2026-08-29.md` (read in full)
- **Git history**: `git log`/`git diff` against commit `58cb7ef` and the repository's full recent commit history

---

## 36. Files Changed

Current Codex update: Phase 1 Milestone 2 Entity / Brand Disambiguation has been implemented locally and is awaiting owner review. The owner privacy decision is recorded: founder identity remains private for now, so no founder name, `Person` schema, founder metadata, personal-profile `sameAs`, or personal social/profile link was added. This local milestone changed only the application/test/documentation files listed below. No database schema/migration, environment variable, Vercel configuration, Google/Bing/Supabase production setting, production service, manual production deploy, push, or production configuration change was performed.

Phase 1 Milestone 2 application files changed:
- `app/lib/site-config.ts`
- `app/page.tsx`
- `app/layout.tsx`
- `app/about/page.tsx`

Phase 1 Milestone 2 test files changed/added:
- `app/page.test.ts`
- `app/about/page.test.ts`

Phase 1 Milestone 2 documentation files changed:
- `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.md`
- `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.docx`

Application files changed:
- `lib/analytics/internal-events.server.ts`
- `lib/analytics/seo-funnel-events.server.ts`
- `app/api/extract/route.ts`
- `app/api/extract-image/route.ts`
- `app/api/projects/import/route.ts`
- `app/api/homepage-demo/claim/save/route.ts`
- `app/api/homepage-demo/claim/save-anyway/route.ts`
- `app/api/webhooks/creem/route.ts`

Test files changed/added:
- `lib/analytics/internal-events.server.test.ts`
- `lib/analytics/seo-funnel-events.server.test.ts`
- `app/api/extract/route.test.ts`
- `app/api/projects/import/route.test.ts`
- `app/api/webhooks/creem/route.test.ts`
- `app/api/homepage-demo/claim/save/route.test.ts`
- `app/api/homepage-demo/claim/save-anyway/route.test.ts`

Documentation files changed:
- `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.md`
- `docs/seo-runs/2026-09-09/Text2Task_SEO_GEO_Run_2026-09-09.docx`

---

## 37. Current Run Status

**STATUS: ACTIVE**
**PHASE 0A — Repository Mapping + Technical Audit: COMPLETE / OWNER REVIEWED**
**PHASE 0B — External Baseline Completion: COMPLETE / OWNER REVIEWED**
**PHASE 0 OVERALL: COMPLETE / OWNER REVIEWED**
**PHASE 1 STATUS: IMPLEMENTATION IN PROGRESS**
**PHASE 1 IMPLEMENTATION: MILESTONE 1 PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**
**PHASE 1 MILESTONE 2: PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE**
**PHASE 1 MILESTONE 3: NOT STARTED**

Phase 0A exit criteria (per the run brief) are met and owner-reviewed: exact public route inventory (§9), exact sitemap logic (§12), exact robots policy (§10.1), exact private indexing protection map (§11), exact canonical/host logic (§13), exact metadata inventory (§14), exact structured-data inventory (§15), entity-disambiguation gap analysis (§16), content/intent map (§17), internal-link map (§19), analytics/measurement map (§22), prior-audit reconciliation (§25), confirmed P0/P1/P2 backlog (§26–§28), a proposed next plan (§30), and a verification plan (§32) all exist above.

Phase 0B external baseline completion is complete / owner-reviewed. Phase 1 Milestone 1 is production deployed, production smoke verified, and complete. Milestone 2 is production deployed, production smoke verified, and complete. The owner privacy decision remains preserved: founder identity remains private for now, so Milestone 2 deliberately excludes founder name publication, `Person` schema, founder metadata, personal-profile `sameAs`, and personal social/profile links. Milestone 3 has not started.

**Application code changed: YES — Phase 1 Milestone 1 and Phase 1 Milestone 2 implementation through merged PRs; this documentation task changed no application/test files. Database changed: NO. Environment changed: NO. Production changed by this documentation task: NO. Google configuration changed: NO. Bing application integration changed: NO. Manual deploy performed: NO.**

---

## 38. Phase 1 Master Implementation Plan

**Status:** IMPLEMENTATION IN PROGRESS. Milestone 1 is complete and production deployed. Milestone 2 is production deployed, production smoke verified, and complete. Milestone 3 has not started.

**Planning timestamp:** 2026-09-13 13:26 Asia/Jerusalem.

**Evidence base:** completed Phase 0 run evidence in §§5-23A, confirmed backlog in §§26-30, and the owner-approved Phase 0 status in §37.

**Milestone order**

| Order | Milestone | Priority | Expected impact | Effort/risk | Depends on |
|---:|---|---|---|---|---|
| 1 | Measurement Foundation | P0 | Makes paying-user SEO/GEO growth measurable and prevents blind Phase 1 optimization | Medium/high because it touches analytics, Creem webhook semantics, and possible idempotency storage | Owner approval to implement; staging/test database workflow |
| 2 | Entity / Brand Disambiguation | P0 | Distinguishes current `text2task.com` from the unrelated Microsoft Marketplace product and strengthens E-E-A-T/GEO entity confidence | Low/medium; privacy/reputation-sensitive | Owner privacy decision recorded: no public founder identity, no `Person` schema, no personal-profile `sameAs` |
| 3 | Internal Authority / Weak Use Cases | P1 | Improves crawl priority, topical support, and uniqueness for the weakest discovered-but-under-crawled use cases | Medium; content and linking quality risk if done mechanically | Milestone 1 preferred first for measurement; no database dependency |
| 4 | Core Non-Brand Ranking Pages | P1 | Improves the pages with the largest current non-brand impression opportunity | Medium; cannibalization risk if intent boundaries are blurred | Milestone 1 preferred first; keep Feature vs Resource intent differentiated |
| 5 | Bing / IndexNow Foundation | P1 | Adds faster Microsoft/Bing discovery for canonical public URLs | Medium; private URL leak risk if whitelist is wrong | Owner approval; stable key decision; staging verification |
| 6 | External Authority Program | P1 HIGH | Builds relevant referring-domain diversity and independent entity references | Medium/high operational effort; reputational risk if spammy | Entity decision helps, but program can start ethically without fake founder claims |
| 7 | Homepage Performance / CRO | P1 Performance/CRO candidate | Reduces unnecessary initial payload while preserving demo conversion value | Medium; conversion regression risk if video is removed blindly | Measurement foundation strongly preferred first |

**Cross-milestone dependencies**

- Milestone 1 should run first because Phase 1 work aimed at paying users cannot be evaluated until `paid_conversion`, `first_extract_created`, and `project_saved` are reliable.
- Milestone 2 owner decision is recorded: founder identity remains private for now, so entity disambiguation must rely on Organization/product/domain/profile signals and must not add founder name, personal profile link, `Person` schema, or `Organization.founder`.
- Milestones 3, 4, 6, and 7 should be measured against the Milestone 1 funnel where possible; otherwise they risk optimizing impressions without knowing whether activation or paid conversion improved.
- Milestone 5 must not submit private, dashboard, admin, token, or share URLs. URL eligibility must be code-reviewed before any external IndexNow submission goes live.
- Bing Backlinks/Search Performance/Site Explorer should be rechecked after Bing finishes processing the newly onboarded property; this follow-up informs Milestones 5 and 6 but does not block Phase 1 planning.

### 38.1 Milestone 1 — Measurement Foundation

**Priority:** P0.

**Business objective:** make the organic acquisition funnel measurable through activation and paid conversion, so Phase 1 SEO/GEO work can be evaluated against signups, real product activation, and paying users rather than impressions alone.

**Evidence supporting the milestone:** Phase 0 confirmed that the funnel is tracked through signup, but `paid_conversion` does not exist, `first_extract_created` and `project_saved` are allowlisted but never emitted, and `email_confirmed`, `client_update_created`, and `client_update_applied` are lower-priority missing events (§22).

**Exact scope**

- Add `paid_conversion` from the authoritative Creem confirmed-payment webhook path only.
- Add `first_extract_created` exactly once for the user's true first successful extract.
- Add `project_saved` on authoritative successful project persistence, with duplicate/repeat semantics defined before implementation.
- Preserve the existing internal `analytics_events` architecture, owner-traffic exclusion rules, and signup/acquisition attribution where available.
- Plan `email_confirmed` as P1 follow-up and `client_update_created` / `client_update_applied` as P2 product analytics, not part of the P0 milestone unless separately approved.

**Explicit non-scope**

- No client-only paid-conversion counting.
- No counting failed, pending, canceled, refunded, unverified, or duplicate Creem payments as paid conversion.
- No GA4 architecture change unless separately approved; GA4 collection is already externally verified.
- No admin dashboard redesign unless required to verify the new events.
- No production database migration without explicit approval and staged migration verification.

**Files/components likely affected**

- `app/api/webhooks/creem/route.ts` for confirmed-payment source of truth.
- `lib/analytics/internal-events.server.ts` for internal event insertion and allowlist alignment.
- `lib/analytics/request-attribution.server.ts` and `lib/analytics/signup-attribution.server.ts` for attribution preservation where the server can connect payment or activation to prior acquisition data.
- `supabase/migrations/*` if idempotency requires a new uniqueness constraint, event key, or supporting table.
- Homepage demo/product extraction routes likely including `app/api/homepage-demo/extract/route.ts` and product extraction/persistence routes discovered during implementation planning for `first_extract_created` and `project_saved`.
- Existing analytics/admin reporting files only if the owner wants the new events surfaced immediately.

**Event semantics**

| Event | Authoritative boundary | Count once? | Required exclusions |
|---|---|---|---|
| `paid_conversion` | Creem webhook event that proves a payment/subscription is confirmed and accepted by the app | Yes, per authoritative payment/subscription identity | Failed, pending, test-mode if not intended for production metrics, duplicate webhook deliveries, replayed events, unknown users, unverified signatures |
| `first_extract_created` | First successful extraction that produces usable extracted task/project data for an authenticated user or claimable demo-to-account flow, after server success is known | Yes, per user | Failed extracts, validation errors, rate-limit failures, client retries without successful server result |
| `project_saved` | Successful authoritative persistence of a project in the database | Define before implementation: likely first saved project plus optional every-save event only if separately named | Failed saves, rolled-back transactions, duplicate retry writes |

**Idempotency strategy**

- Use Creem's stable webhook event id and/or payment/subscription id as the idempotency key for `paid_conversion`.
- Prefer a database-enforced uniqueness model for events that must be exactly once; do not rely only on application memory or log text.
- For `first_extract_created`, query or maintain a durable first-event marker per user before insert, protected against race conditions.
- For `project_saved`, define whether the event means "first project saved" or "each successful project saved." If both are useful, use two distinct event names rather than overloading one.
- Treat webhook retries and concurrent requests as expected production behavior.

**Attribution strategy**

- Preserve existing first-touch UTM/referrer fields where the user and attribution cookie/session can be connected.
- For paid conversion, join to the authenticated user/customer record created during checkout/signup rather than trusting browser state.
- Store source/medium/campaign/referrer/landing-page fields consistently with existing `signup_attribution_captured` and `signup_success` payloads.
- If attribution is unavailable for a valid paid conversion, record the event with explicit null/unknown attribution rather than dropping the conversion.

**Database/event integrity considerations**

- Confirm current `analytics_events` schema, RLS, service-role write path, event allowlist, and indexes before changing anything.
- If adding idempotency fields or constraints, write a forward-only Supabase migration and static migration tests.
- Staging/test first: apply migration to a non-production database, verify `schema_migrations`, inspect constraints/indexes, and verify migration list alignment.
- Production database work requires explicit owner approval after staging passes.

**Data/security/privacy risks**

- Payment webhooks contain sensitive customer/payment data; event payloads must be minimal and must not store secrets, raw webhook bodies, card data, or unnecessary PII.
- Webhook signature verification and existing billing behavior must not be weakened.
- Analytics events must not expose owner-only, dashboard, client share, or private user data.

**SEO/GEO risks**

- None direct, but bad attribution would make SEO decisions misleading.
- Counting duplicate paid conversions would distort ROI and could incorrectly prioritize low-quality traffic.

**Test plan**

- Unit tests for event allowlist and event payload shape.
- Webhook tests for confirmed, failed, pending, duplicate, replayed, and malformed Creem webhook events.
- Idempotency tests proving duplicate webhook delivery creates one `paid_conversion`.
- Server-route tests for first successful extract and failed extract behavior.
- Persistence tests for `project_saved` success/failure/duplicate semantics.
- Regression tests proving owner-excluded traffic behavior remains unchanged where applicable.

**Staging verification**

- Apply any migration to staging/test first.
- Run Creem test-mode payment through the webhook path and confirm one `paid_conversion`.
- Run a real test signup, first extraction, and project save; confirm exactly expected analytics rows.
- Confirm failed extraction and failed payment do not emit success events.
- Confirm attribution fields are present when UTM/referrer inputs exist and explicit null/unknown when unavailable.

**Production verification**

- After approved deploy, perform one controlled production-safe payment verification path only if the owner approves the exact method.
- Verify event rows in production analytics for a known test path.
- Verify no duplicate event rows after a webhook retry scenario if such retry can be safely simulated.
- Monitor logs for webhook or analytics-write errors.

**Success metrics**

- 100% of confirmed paid conversions generate exactly one `paid_conversion`.
- 0 failed/pending/duplicate payments counted as paid conversions.
- First successful extract produces exactly one `first_extract_created` per user.
- Successful project persistence emits `project_saved` according to the approved semantics.
- Attribution coverage reported for signup-to-paid paths where data exists.

**Rollback criteria**

- Any duplicate paid conversions.
- Any failed/pending payment counted as paid.
- Any billing webhook regression.
- Any analytics write causing product-path failure rather than fail-open/controlled telemetry behavior.

**Documentation updates required**

- Update this run document with implemented event semantics, files changed, migration status, staging/prod verification, and final decision IDs.
- Update any internal analytics/event taxonomy docs if present.

**Database migration required:** possible/likely if durable idempotency cannot be guaranteed with the current schema.

**External-console work required:** Creem test webhook/payment verification likely; GA4 console change not required by this milestone.

### 38.2 Milestone 2 — Entity / Brand Disambiguation

**Priority:** P0, owner decision required.

**Business objective:** clearly establish current `text2task.com` Text2Task as a distinct, trustworthy entity separate from the unrelated older Microsoft Marketplace Text2Task.

**Evidence supporting the milestone:** Phase 0 confirmed no on-site founder full name, no `Person` schema, and no personal professional profile link (§16). Phase 0B externally verified that the founder is already publicly associated with Text2Task through indexed external surfaces (§23A). The unrelated Microsoft Marketplace Text2Task by Target Energy Solutions remains live and unrelated (§23A.4). The owner has now decided not to publish founder identity in this milestone.

**Exact scope**

- If owner approves, publish the founder full name on the About page.
- Add a short factual founder bio aligned with existing first-person product story.
- Add a genuine professional profile `sameAs` link, likely the founder LinkedIn profile already externally associated with Text2Task.
- Add truthful `Person` schema with stable `@id`.
- Link `Organization.founder` to the `Person` `@id`.
- Keep `Organization`, `WebSite`, `AboutPage`, and homepage entity references stable and internally consistent.

**Explicit non-scope**

- No invented physical address, phone number, NAP, awards, credentials, press, reviews, ratings, client names, or case-study metrics.
- No fake `sameAs` profile.
- No attempt to impersonate or rewrite external Microsoft Marketplace data.
- No implementation until the owner explicitly approves founder-name/profile publication.

**Files/components likely affected**

- `app/about/page.tsx` for visible founder copy and AboutPage alignment.
- `app/lib/schema.ts` for any reusable `Person` builder or stable entity IDs.
- `app/lib/site-config.ts` for founder/entity constants and approved profile link.
- `app/page.tsx` if homepage Organization/WebSite JSON-LD or visible entity copy needs alignment.
- `app/components/landing/landing-footer.tsx` only if the owner wants a visible founder/profile link there.

**Data/security/privacy risks**

- Publishing a founder name/profile is a privacy and reputation decision.
- The site must not expose private contact data or imply credentials that are not true.

**SEO/GEO risks**

- Incorrect schema or unsupported claims could reduce trust.
- Conflicting `@id` values could weaken entity consolidation.
- Over-optimizing around the founder could distract from product clarity.

**Test plan**

- Typecheck schema builders and page metadata.
- Unit/static tests for valid JSON-LD shape if existing test patterns support it.
- Snapshot or parser check that homepage and About JSON-LD contain stable linked `Organization` and `Person` IDs only after owner approval.
- Confirm no `AggregateRating`, `Review`, fake NAP, or invented credentials are introduced.

**Staging verification**

- Inspect visible About page copy and rendered JSON-LD.
- Validate schema with a structured-data parser where available.
- Check canonical/metadata unchanged except approved entity additions.

**Production verification**

- Fetch live About and homepage HTML after approved deploy.
- Validate that the `Person` and `Organization.founder` relationship is present and stable.
- Recheck Google/Bing entity and rich-result surfaces over time; do not expect immediate ranking movement.

**Success metrics**

- On-site founder identity matches approved owner text and approved professional profile.
- `Person` schema exists, links to the Organization, and contains no fabricated fields.
- Text2Task entity references become consistent across website, LinkedIn, Peerlist, and external listings.

**Rollback criteria**

- Owner withdraws approval to publish founder information.
- Schema validation fails in a way that cannot be quickly corrected.
- Visible copy creates privacy, legal, or factual concerns.

**Documentation updates required**

- Record owner decision, exact published founder/profile details, schema IDs, files changed, and verification results.

**Database migration required:** no.

**External-console work required:** no required console change; optional profile/listing alignment may be handled manually by the owner.

### 38.3 Milestone 3 — Internal Authority / Weak Use Cases

**Priority:** P1.

**Business objective:** improve crawl priority, internal topical support, and usefulness of the weakest use-case pages while preserving their audience-specific intent.

**Evidence supporting the milestone:** `/use-cases/freelance-developers`, `/use-cases/seo-freelancers`, `/use-cases/shopify-freelancers`, and `/use-cases/video-editors` were discovered but initially not crawled and submitted once through GSC. Phase 0 confirmed `freelance-developers` and `seo-freelancers` are hub-only/contextually isolated, `shopify-freelancers` is weakly linked, `video-editors` has stronger contextual support, and none appear in the current GSC internal-link top-target export (§19, §22B).

**Exact scope**

- Add contextual inbound links from relevant existing pages where the link helps the reader.
- Strengthen related-content relationships between use cases and relevant Feature/Solution/Resource pages.
- Add unique workflow/problem/example differentiation for the weakest pages.
- Add or improve transformation examples, signature modules, proof sections, and related-links where missing.
- Preserve audience-specific use-case intent.

**Explicit non-scope**

- No mass link insertion.
- No sitewide footer stuffing.
- No doorway-page patterns.
- No thin-template multiplication.
- No forced exact-match anchors.
- No canonicalization, deletion, or merging without new evidence.

**Files/components likely affected**

- `app/lib/use-cases/cases/freelance-developers.ts`
- `app/lib/use-cases/cases/seo-freelancers.ts`
- `app/lib/use-cases/cases/shopify-freelancers.ts`
- `app/lib/use-cases/cases/video-editors.ts`
- Related use-case data files that should naturally link to these pages.
- Relevant Feature/Solution/Resource page files if contextual inbound links are added from them.
- Shared use-case rendering components only if an existing field cannot support the needed content.

**Data/security/privacy risks**

- Low direct data risk; content must not include private customer details or invented proof.
- No user-generated content should be surfaced without existing moderation/permission controls.

**SEO/GEO risks**

- Overlapping page intent could create cannibalization.
- Mechanical internal links could look manipulative or reduce UX.
- Thin additions could worsen quality signals.

**Test plan**

- Typecheck all changed content data files.
- Static route/render tests if present.
- Link integrity checks for new internal links.
- Metadata/schema regression checks for the four use-case pages.
- Confirm sitemap count and canonical paths remain unchanged unless explicitly approved.

**Staging verification**

- Render all four use-case pages.
- Verify added links are visible, contextual, and point to canonical public URLs.
- Confirm no layout breakage or repeated generic copy.

**Production verification**

- Fetch live pages and verify canonical, robots, JSON-LD, and internal links.
- Recheck GSC indexing/crawl status no sooner than the planned post-submission window.
- Track internal-link visibility over the next GSC Links/Internal Links refresh.

**Success metrics**

- Each weak use-case page has at least one meaningful contextual inbound link beyond the `/use-cases` hub.
- `freelance-developers`, `seo-freelancers`, and `shopify-freelancers` gain unique workflow/proof/related-link depth comparable to stronger sibling use cases.
- No new duplicate-intent or canonical issue.
- GSC eventually crawls and evaluates the pages; indexing is an observed outcome, not guaranteed by implementation alone.

**Rollback criteria**

- New content reads generic, inaccurate, or doorway-like.
- Internal links feel forced or cause user-flow confusion.
- Any metadata/canonical/schema regression.

**Documentation updates required**

- Record exact pages updated, internal links added, acceptance checks, and later GSC follow-up results.

**Database migration required:** no.

**External-console work required:** GSC recheck later; do not repeatedly request indexing unless explicitly approved.

### 38.4 Milestone 4 — Core Non-Brand Ranking Pages

**Priority:** P1.

**Business objective:** improve the pages with the largest current non-brand impression opportunities while maintaining clear commercial vs informational intent.

**Evidence supporting the milestone:** Phase 0 non-brand baseline showed `/solutions/freelancer-project-management-software` at 171 impressions / average position ~81.1, `/features/email-to-tasks` at 94 impressions / ~79.5, and `/resources/how-to-turn-emails-into-tasks` at 31 impressions / ~77.6 (§5). Phase 0 confirmed no technical indexability defect explains those rankings.

**Exact scope**

- Improve search intent match and answerability on the Freelancer Project Management solution page.
- Improve commercial clarity, workflows, proof, and conversion path on `/features/email-to-tasks`.
- Improve informational completeness and how-to usefulness on `/resources/how-to-turn-emails-into-tasks`.
- Preserve differentiated intent between the Feature and Resource pages.
- Strengthen internal links among relevant pages with natural, user-helpful anchors.
- Add concrete workflows/examples and evidence where true.

**Explicit non-scope**

- Do not merge, canonicalize, delete, or redirect the Feature and Resource email pages without new evidence.
- Do not keyword-stuff.
- Do not fabricate customer proof, reviews, ratings, or claims.
- Do not create near-duplicate pages for minor keyword variants.

**Files/components likely affected**

- `app/solutions/freelancer-project-management-software/page.tsx`
- `app/features/email-to-tasks/page.tsx`
- `app/resources/how-to-turn-emails-into-tasks/page.tsx`
- Related Feature/Resource/Solution pages only for contextual links.
- Shared schema helpers only if visible content changes require truthful schema alignment.

**Data/security/privacy risks**

- Content must not imply integrations the product does not have, especially inbox/WhatsApp access.
- Product claims must match actual paste/upload/review-before-save behavior.

**SEO/GEO risks**

- Cannibalization between commercial and informational email pages.
- Over-broad category copy could dilute the Freelancer Project Management page.
- Adding unsupported FAQ/schema content could become spammy.

**Test plan**

- Typecheck changed pages.
- Verify metadata titles/descriptions/canonicals remain unique and intent-aligned.
- Verify JSON-LD still reflects visible content only.
- Link checks for new internal links.
- Visual smoke checks at desktop/mobile if copy/layout changes are substantial.

**Staging verification**

- Review pages side-by-side for differentiated intent.
- Confirm primary CTA paths still work.
- Confirm no overlap that would make one page a duplicate of another.

**Production verification**

- Fetch live pages after approved deploy.
- Verify canonical, title, description, JSON-LD, internal links, and CTA paths.
- Track GSC non-brand impressions, average position, and clicks over 30/60/90 days.

**Success metrics**

- Improved topical completeness without cannibalization.
- Increased non-brand impressions and/or position movement for the three primary URLs.
- Increased qualified Live Demo/sign-up starts from these URLs after Milestone 1 tracking exists.

**Rollback criteria**

- Ranking/traffic drops correlate strongly with changed intent or metadata.
- Feature/Resource pages begin cannibalizing each other.
- Conversion path becomes less clear.

**Documentation updates required**

- Record before/after page intent, content changes, internal links, and GSC follow-up windows.

**Database migration required:** no.

**External-console work required:** GSC performance monitoring only.

### 38.5 Milestone 5 — Bing / IndexNow Foundation

**Priority:** P1.

**Business objective:** establish controlled, production-grade URL discovery for Bing/Microsoft surfaces while preserving sitemap-based crawl inventory.

**Evidence supporting the milestone:** Bing Webmaster Tools is configured, sitemap is submitted/processing, IndexNow setup path was inspected, an IndexNow key was generated during setup exploration, and no app implementation exists yet (§23).

**Exact scope**

- Choose and store a stable IndexNow key using an approved secret/configuration path.
- Host the required verification key file on the canonical public host.
- Submit only canonical public/indexable URLs.
- Trigger submissions only for meaningful public URL create/update/delete events.
- Preserve `sitemap.xml` as the complete crawl inventory.
- Add controlled logging, error handling, and retry behavior.

**Explicit non-scope**

- No private, dashboard, share, token, auth, admin, API, or user-generated private URLs.
- No full-site submission every deployment.
- No Bing console changes without owner approval.
- No production URL submissions until staging and whitelist verification pass.

**Files/components likely affected**

- `public/{indexnow-key}.txt` or a route-based equivalent if approved.
- `app/sitemap.ts` as a source of canonical public URL inventory, if reused read-only.
- New or existing server-only utility under `lib/` for URL eligibility and submission.
- Content mutation paths only if Text2Task gains dynamic public content; current public routes are mostly static.
- Tests near URL eligibility and submission client.

**Data/security/privacy risks**

- The main risk is accidentally submitting private or tokenized URLs.
- Logs must not record secrets, private URLs, share IDs, tokens, or customer data.
- Key handling must be stable and not exposed beyond the public verification requirement.

**SEO/GEO risks**

- Over-submission can waste crawl resources or look noisy.
- Wrong canonical host can split signals.
- Submitting non-indexable URLs creates low-quality discovery noise.

**Test plan**

- Unit tests for public URL whitelist and explicit private URL denylist.
- Tests proving canonical host normalization to `https://www.text2task.com`.
- Tests for delete/update/create submission payloads.
- Tests for retry/backoff and controlled failure behavior.
- Tests proving no submission occurs for dashboard/share/admin/auth/API paths.

**Staging verification**

- Verify key file is reachable on staging only if staging IndexNow behavior is intentionally enabled.
- Dry-run submission mode preferred before real external calls.
- Inspect logs for redaction and safe errors.

**Production verification**

- After approved deploy, verify key file on canonical host.
- Submit a small approved canonical public URL set.
- Check Bing Webmaster Tools / IndexNow verification status and processing later.

**Success metrics**

- Verification key reachable on canonical host.
- Only approved canonical public URLs are submitted.
- No private URL appears in logs or external submissions.
- Bing reports successful/accepted submissions where available.

**Rollback criteria**

- Any private/noncanonical URL submission.
- Repeated submission failures or noisy retries.
- Key exposure beyond intended verification-file behavior.

**Documentation updates required**

- Record key strategy, whitelist/denylist, files changed, tests, and Bing verification results.

**Database migration required:** likely no for static public URLs; possible only if durable submission queue/retry state is required.

**External-console work required:** Bing Webmaster Tools / IndexNow verification and later status checks.

### 38.6 Milestone 6 — External Authority Program

**Priority:** P1 HIGH.

**Business objective:** increase relevant authority and independent references that help search engines and answer engines understand, trust, and cite current Text2Task.

**Evidence supporting the milestone:** GSC currently surfaces 3 external-link URLs from 2 linking domains, all to the homepage (§22B). Phase 0B verified an early external footprint across LinkedIn, GetApp, Capterra, Uneed, Peerlist, StartupFortune, SaaSHub, UIComet, and FounderDB / Peer Push (§23A).

**Exact scope**

- Build ethical earned authority through editorial mentions, relevant SaaS/product directories, comparison/roundup inclusion, founder/entity profiles, partnerships, useful community participation, and original research/data/assets.
- Seek natural contextual links to relevant Feature/Solution/Resource URLs where editorially appropriate.
- Keep listings accurate and consistent with current product positioning, pricing, and functionality.

**Explicit non-scope**

- No PBNs.
- No bulk paid backlinks.
- No automated directory spam.
- No comment spam.
- No fake reviews.
- No fabricated press.
- No manipulative exact-match anchor campaigns.
- No claims that Product Hunt/BetaList are absent; they were only not externally verified in the Phase 0 sweep.

**Files/components likely affected**

- No application files required by default.
- Possible future content assets under `app/resources/` if original research/data/assets are approved.
- About/entity pages may be affected only after Milestone 2 owner decision.
- Documentation/tracking spreadsheet or CRM outside this repo may be useful, but no external app connection is required for this plan.

**Data/security/privacy risks**

- Outreach must not disclose private customer data.
- Testimonials/reviews must be real, permissioned, and consistent with existing moderation principles.
- Founder/profile work must respect owner privacy decisions.

**SEO/GEO risks**

- Low-quality link acquisition can harm trust.
- Repetitive exact-match anchors can look manipulative.
- Inaccurate directory information can confuse entity understanding.

**Test plan**

- Manual QA of every claimed listing/mention before recording it as verified.
- Confirm any linked URL is canonical and relevant.
- Check that public claims match live product behavior and pricing.

**Staging verification**

- Not generally applicable unless new website content/assets are created.
- For any new resource asset, verify staging copy, links, metadata, and schema before production.

**Production verification**

- Recheck live external links/mentions after publication.
- Monitor GSC Links, Bing Backlinks after processing, referral traffic, branded search, non-brand impressions, and AI visibility.

**30/60/90-day authority KPIs**

| Window | KPI target |
|---|---|
| 30 days | Verify and clean up priority existing profiles/listings; secure or pitch at least 3 relevant new authority opportunities; establish a tracking sheet of target/source/status/canonical URL/anchor/context |
| 60 days | Add 3-5 new relevant referring domains or high-quality unlinked entity mentions; obtain at least 1 contextual link to a non-homepage Feature/Solution/Resource URL if editorially appropriate |
| 90 days | Reach 6-10 total new relevant authority placements/mentions, with at least 2 non-homepage deep links and measurable movement in GSC/Bing link surfaces or referral traffic |

**Success metrics**

- More referring-domain diversity, not just more raw backlinks.
- At least some links/mentions point to relevant Feature/Solution/Resource URLs.
- No fake reviews or fabricated editorial claims.
- Increased branded/entity consistency across external profiles.

**Rollback criteria**

- Any acquired placement is spammy, inaccurate, paid in a non-disclosed/manipulative way, or creates reputational risk.
- Any review/testimonial cannot be verified as genuine and permissioned.

**Documentation updates required**

- Maintain a dated authority inventory: source, URL, type, verified/current status, linked target URL, anchor/context, owner, and follow-up date.

**Database migration required:** no.

**External-console work required:** directory/profile updates and manual external outreach; GSC/Bing monitoring.

### 38.7 Milestone 7 — Homepage Performance / CRO

**Priority:** P1 Performance/CRO candidate.

**Business objective:** reduce unnecessary initial homepage bandwidth and improve mobile LCP while preserving the conversion value of the demo.

**Evidence supporting the milestone:** PageSpeed homepage lab baseline showed Mobile Performance 88, Mobile LCP 3.8s, total mobile payload approximately 15,465 KiB, Desktop Performance 99, Desktop LCP 0.7s, desktop payload approximately 15,571 KiB, and dominant resource `/landing/text2task-demo.mp4` at approximately 14,964 KiB (§22A).

**Exact scope**

- Investigate current `<video>` preload behavior.
- Verify autoplay/loading behavior and actual browser download behavior.
- Confirm poster behavior.
- Assess compression/codec opportunities.
- Assess deferred/lazy-loading options.
- Preserve or improve the demo's conversion value.

**Explicit non-scope**

- Do not blindly remove the video.
- Do not reduce product/demo functionality without evidence.
- Do not trade a measurable conversion lift for a cosmetic performance score.
- Do not claim field CWV pass/fail; GSC field data is unavailable.

**Files/components likely affected**

- `app/components/landing/homepage-hero.tsx` or the component that renders `/landing/text2task-demo.mp4`.
- `public/landing/text2task-demo.mp4` or replacement media assets if compression is approved.
- Poster image assets if introduced or changed.
- PageSpeed/CRO documentation and possibly analytics instrumentation only after Milestone 1.

**Data/security/privacy risks**

- Low direct data risk.
- Do not load third-party video tooling that introduces tracking or privacy changes without approval.

**SEO/GEO risks**

- Aggressive lazy loading could hide important product-demonstration context from users or crawlers.
- Removing visual proof could reduce trust and conversion even if lab score improves.

**Test plan**

- Browser network tests for whether the MP4 downloads on initial load.
- Mobile and desktop PageSpeed/Lighthouse before/after.
- Visual regression checks for hero/demo rendering.
- CTA and demo-start analytics checks after measurement foundation exists.

**Staging verification**

- Use browser devtools or automated network inspection to compare initial payload.
- Verify poster/video behavior across mobile and desktop.
- Confirm no layout shift or broken media state.

**Production verification**

- Re-run PageSpeed after approved deploy.
- Monitor real user signals as available; field CWV may remain unavailable until traffic increases.
- Compare homepage demo starts, signup starts, and downstream events after Milestone 1.

**Success metrics**

- Meaningful reduction in initial homepage payload, especially mobile.
- Mobile LCP improvement without conversion decline.
- No regression in demo CTA engagement or signups.

**Rollback criteria**

- Demo engagement drops materially.
- Media fails to render or becomes confusing.
- LCP/payload improvement is negligible relative to complexity.

**Documentation updates required**

- Record measurement method, before/after payload, LCP, video behavior, conversion signals, and final implementation decision.

**Database migration required:** no.

**External-console work required:** PageSpeed/Lighthouse/GSC performance checks; no Google/Bing configuration change.

### 38.8 Global Acceptance Rules For Every Milestone

For every Phase 1 milestone, the implementation plan and completion report must include:

1. Business objective.
2. Evidence supporting the milestone.
3. Exact implementation scope.
4. Explicit non-scope.
5. Files/components affected.
6. Data/security/privacy risks.
7. SEO/GEO risks.
8. Test plan.
9. Staging verification.
10. Production verification.
11. Success metrics.
12. Rollback criteria.
13. Documentation updates required.
14. Whether a database migration is required.
15. Whether external-console work is required.

All engineering, database, and security work must follow Text2Task production-grade rules and the repository guardrails.

For any Supabase database change:
- Use staging/test first.
- Define the exact migration workflow before production.
- Verify the schema after migration.
- Verify `schema_migrations`.
- Confirm migration list alignment.
- Proceed to production only after explicit owner approval.

### 38.9 Phase 1 Verification Plan

- Before implementation: confirm the working tree and identify unrelated user-owned changes.
- During implementation: keep each milestone in its own small, reviewable change set.
- After implementation: run focused tests first, then broader type/test checks appropriate to the blast radius.
- For website changes: verify metadata, canonical, robots behavior, JSON-LD, internal links, and responsive rendering.
- For analytics changes: verify event insertion, idempotency, attribution, privacy boundaries, owner-exclusion behavior, and admin/report visibility if in scope.
- For database changes: complete staging migration and schema verification before requesting production approval.
- For external consoles: record exact console action, date/time, observed status, and follow-up window.
- After production: monitor logs and the relevant GSC/Bing/GA4/internal analytics baselines on 7/30/60/90-day windows where applicable.

### 38.10 Measurable Outcomes

| Area | Primary outcomes |
|---|---|
| Measurement | `paid_conversion`, `first_extract_created`, and `project_saved` are reliable, idempotent, and usable for funnel reporting |
| Entity | Owner-approved founder/entity signals are visible, truthful, schema-valid, and consistent with external profiles |
| Internal authority | Weak use-case pages gain contextual inbound links and stronger differentiated content without doorway patterns |
| Core ranking pages | Non-brand opportunity pages improve intent match, answerability, proof, and conversion paths without cannibalization |
| Bing/IndexNow | Canonical public URL submission is controlled, safe, and verified; private URLs are never submitted |
| External authority | Referring-domain diversity and relevant independent references increase ethically |
| Performance/CRO | Homepage initial payload and mobile LCP improve without harming demo conversion |

## 39. Phase 1 Recommended First Milestone

**Recommendation:** start Phase 1 with **Milestone 1 — Measurement Foundation**.

Reason: Phase 0 established that the business goal is not merely rankings; it is organic visibility through Live Demo usage, signups, activated users, and paying users. The current system cannot reliably measure the paying-user outcome because `paid_conversion` does not exist and `first_extract_created` / `project_saved` are allowlisted but never emitted. Implementing content, authority, Bing, or performance work before this foundation would make the next phase harder to evaluate.

**First implementation package, when explicitly approved**

1. Re-read the Creem webhook, internal analytics writer, signup attribution, owner-exclusion, extraction, and project-persistence paths.
2. Finalize event semantics for `paid_conversion`, `first_extract_created`, and `project_saved`.
3. Decide whether a database migration is required for durable idempotency.
4. Implement behind production-grade tests.
5. Verify in staging/test first.
6. Request explicit approval before any production database migration or production deployment.

**Owner decisions required before Phase 1 implementation**

- Approve starting Milestone 1.
- Approve any database migration if idempotency requires schema support.
- Decide whether founder full name and professional profile may be published for Milestone 2.
- Approve any external-console work for Bing/IndexNow or production verification.

**Current status after the Phase 1 Milestone 2 production closeout**

- Phase 0: COMPLETE / OWNER REVIEWED.
- Phase 1: IMPLEMENTATION IN PROGRESS.
- Phase 1 implementation: MILESTONE 1 COMPLETE; MILESTONE 2 PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE.
- Milestone 2: PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE.
- Milestone 3: NOT STARTED.
- Application code changed: YES — Phase 1 Milestone 1 and Phase 1 Milestone 2 implementation through merged PRs; this documentation task changed no application code.
- Database changed: NO.
- Environment changed: NO.
- Production deployment: READY at merge commit `80b3318` for Milestone 2.
- Production smoke verification: PASS.
- Production changed by this documentation task: NO.
- Manual deployment performed by this task: NO.

---

## 40. Phase 1 Milestone 1 — Measurement Foundation Local Implementation

**Status:** PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE.

**Implementation timestamp:** 2026-09-13 15:12:33 Asia/Jerusalem.

**Correction-pass timestamp:** 2026-09-13 16:55:06 Asia/Jerusalem.

**Starting branch / HEAD:** `main` at `92050bd1d21111192157bd3b8305861fb9208192`.

**Feature branch:** `feat/seo-measurement-foundation`.

**Implementation commit:** `10846aa0c9dfc7a2f6a2a215374d75eb6a5103f6`.

**PR:** #2, `Phase 1: add SEO funnel measurement foundation`.

**Merge commit on `main`:** `b3e372c`.

**Production deployment:** Vercel Production READY for branch `main` / commit `b3e372c`.

### 40.1 Mapping Findings

- Existing analytics writer: `lib/analytics/internal-events.server.ts` writes to `analytics_events` through `supabaseAdmin`, sanitizes metadata, clamps fields, validates event names through an allowlist, and treats duplicate idempotency-key collisions as expected no-ops.
- Existing attribution: `lib/analytics/request-attribution.server.ts` reads accepted-consent first-party attribution/anonymous cookies and maps UTM/referrer/landing/page-path fields into the analytics writer format.
- Existing storage: `analytics_events` already has `event_name`, `user_id`, attribution columns, sanitized JSON metadata, and `analytics_events_idempotency_key_unique_idx`; no enum/check constraint blocks the new `paid_conversion` name.
- Existing first-extract backend state: `users.successful_extract_count` and `record_successful_extraction(p_user_id)` already provide an owner-analytics-only persisted extraction count separate from free-plan quota.
- Existing Creem webhook idempotency: `process_creem_webhook_event(...)` already verifies/records provider event processing with replay protection and returns `result_resolved_user_id` after authoritative processing.

### 40.2 Event Contracts

| Event | Authoritative boundary | Dedupe/idempotency | Metadata policy |
|---|---|---|---|
| `first_extract_created` | Authenticated text/image extraction succeeds, free-plan quota update succeeds where applicable, and scheduled `record_successful_extraction()` returns without error. | `first_extract_created:{user_id}`; route passes prior `successful_extract_count`, so only count `0` can emit, with DB uniqueness protecting races/retries. | Only `source: text|image`; no raw prompt, task, project, screenshot, message, or private content. |
| `project_saved` | First successful persisted project save per authenticated user from project import, homepage-demo claim save, homepage-demo save-anyway, or `app/api/tasks/route.ts -> createProjectWithSubtasks`. Replays, duplicate review, failed saves, update-only paths, and zero-project outcomes do not count. | `project_saved:{user_id}`; preflight checks whether the user already has an active project and fails closed if that check cannot be trusted; DB uniqueness protects races and cross-flow duplicate attempts. | Only source and created project count; no titles, task text, client names, notes, or free-form content. |
| `paid_conversion` | Verified Creem webhook, normalized as `subscription.paid`, processed by `process_creem_webhook_event(...)` as `processed` / `creem_webhook_processed`, with a resolved user id. | `paid_conversion:{user_id}`; webhook replay/idempotency remains in the Creem ledger and analytics uniqueness prevents repeated conversion rows. Duplicate/pending/cancelled/unmatched events do not count. | Only provider/status labels and environment; no raw provider payload, customer id, subscription id, amount, email, or payment-sensitive data. |

### 40.3 Project-Save Path Inventory

| Authoritative path | Persistence boundary | Emits `project_saved` | Test coverage |
|---|---|---:|---:|
| `app/api/projects/import/route.ts` compatibility fallback | `createProjectGroup(...)` creates persisted project/task rows | Yes, after all requested project groups persist | Yes |
| `app/api/projects/import/route.ts` transactional path | `executeClaimedProjectImport(...)` returns committed `kind: "saved"` result from `import_projects_transaction(...)` | Yes, only for `saved`, not replay | Yes |
| `app/api/homepage-demo/claim/save/route.ts` | `claimHomepageDemoProject(...)` returns `outcome: "saved"` | Yes, only on genuine save | Yes |
| `app/api/homepage-demo/claim/save-anyway/route.ts` | `claimHomepageDemoProjectWithDuplicateOverride(...)` returns `outcome: "saved"` | Yes, only on genuine save | Yes |
| `app/api/tasks/route.ts` | `createProjectWithSubtasks(...)` inserts the `projects` row and related `tasks`/resources | Yes, after helper success, with `source: "tasks_project_create"` | Yes |

Repository-wide persistence search did not identify another legitimate first-project-save boundary requiring this milestone event. Read/update/archive/delete/resource-only paths were intentionally not instrumented.

### 40.4 Acquisition -> Paid Attribution Contract

The milestone keeps `paid_conversion` lean and uses `user_id` as the stable reporting join key. `lib/analytics/acquisition-attribution-resolver.server.ts` resolves a paid user to acquisition evidence by first reading consented signup/acquisition rows with the same authenticated `user_id`; when needed, it follows the existing linked `anonymous_id` to earlier acquisition rows. It returns `unknown` safely when no consented acquisition row exists or a query fails. It does not fabricate source data and does not allow another user's attribution to bleed into the paid user.

### 40.5 Local Verification

Commands/results:
- Correction pass: `npm.cmd test -- lib/analytics/internal-events.server.test.ts lib/analytics/seo-funnel-events.server.test.ts lib/analytics/acquisition-attribution-resolver.server.test.ts app/api/extract/route.test.ts app/api/extract-image/route.test.ts app/api/projects/import/route.test.ts app/api/tasks/route.test.ts app/api/homepage-demo/claim/save/route.test.ts app/api/homepage-demo/claim/save-anyway/route.test.ts app/api/webhooks/creem/route.test.ts` - PASSED, 10 files / 129 tests.
- Correction pass: `npm.cmd test -- lib/analytics app/api/analytics/event/route.test.ts app/api/auth/signup/route.test.ts app/api/auth/login/route.test.ts app/auth/confirm/route.test.ts app/api/billing/portal/creem-response.test.ts app/api/homepage-demo/claim/save/route.test.ts app/api/homepage-demo/claim/save-anyway/route.test.ts app/api/homepage-demo/extract/route.test.ts app/api/homepage-demo/review/route.test.ts app/api/extract/route.test.ts app/api/extract-image/route.test.ts app/api/projects/import/route.test.ts app/api/tasks/route.test.ts app/api/webhooks/creem/route.test.ts` - PASSED, 21 files / 323 tests.
- Correction pass: `npx.cmd tsc --noEmit` - PASSED.
- Correction pass: `npx.cmd eslint [changed files]` - PASSED.
- Correction pass: `npm.cmd run build` - first attempt FAILED because sandboxed network access prevented `next/font` from fetching Google Fonts (`DM Sans`, `Inter`); rerun with approved network access PASSED.
- Correction pass: `npm.cmd run lint` - FAILED due to pre-existing unrelated lint issues: `app/components/dashboard/tasks/share-link/share-link-channels.tsx:160` (`react-hooks/set-state-in-effect`) plus unrelated warnings in share/project-update tests and share-link access controls. No changed-file lint errors were found.
- `npm.cmd test -- lib/analytics/internal-events.server.test.ts lib/analytics/seo-funnel-events.server.test.ts app/api/extract/route.test.ts app/api/projects/import/route.test.ts app/api/webhooks/creem/route.test.ts` — PASSED, 5 files / 26 tests.
- `npm.cmd test -- lib/analytics app/api/analytics/event/route.test.ts app/api/auth/signup/route.test.ts app/api/auth/login/route.test.ts app/auth/confirm/route.test.ts app/api/billing/portal/creem-response.test.ts app/api/homepage-demo/claim/save/route.test.ts app/api/homepage-demo/claim/save-anyway/route.test.ts app/api/extract/route.test.ts app/api/projects/import/route.test.ts app/api/webhooks/creem/route.test.ts` — PASSED, 16 files / 236 tests.
- `npx.cmd tsc --noEmit` — PASSED.
- `npx.cmd eslint [changed files]` — PASSED.
- `npm.cmd run build` — first attempt FAILED because sandboxed network access prevented `next/font` from fetching Google Fonts; rerun with approved network access PASSED.
- `npm.cmd run lint` — FAILED due to pre-existing unrelated lint issues, including `app/components/dashboard/tasks/share-link/share-link-channels.tsx:160` (`react-hooks/set-state-in-effect`) plus unrelated warnings. No changed file lint errors were found.

### 40.6 Owner Review Gate Corrections

- `paid_conversion` first-conversion semantics: PASS locally. Tests now prove a same-user distinct later `subscription.paid` renewal dedupes through `paid_conversion:{user_id}`, while a different user gets an independent conversion key.
- Acquisition -> paid attribution contract: PASS locally. A tested resolver can deterministically resolve a paid user to consented acquisition evidence by `user_id` and linked `anonymous_id`; missing acquisition returns `unknown`.
- `project_saved` coverage: PASS locally. All currently identified legitimate first-project-save paths are instrumented through the shared helper.
- Image extraction route coverage: PASS locally. Route-level tests cover first success, repeat success, failed extraction, and analytics insertion failure.
- Analytics write failure isolation: PASS locally for text extract, image extract, project import/save, tasks project creation, homepage-demo claim save, homepage-demo save-anyway, and Creem `subscription.paid`; Creem analytics helper calls are isolated so analytics failure cannot create a false webhook retry.
- Idempotency/concurrency: PASS locally via stable DB-backed idempotency keys and tests for same-user dedupe / different-user independence.
- Security/privacy: PASS locally. New metadata is limited to source/count/status labels and environment; no prompt/message text, task/project content, image content, client messages, payment amount, Creem customer/subscription IDs, webhook payload, email address, secrets, or tokens are intentionally written.
- Database decision: no migration required.

### 40.7 Pre-Merge Preview Verification Gate

**Gate timestamp:** 2026-09-13 18:59:27 Asia/Jerusalem.

**Preview deployment:** VERIFIED. Vercel created a successful READY Preview deployment for branch `feat/seo-measurement-foundation` at implementation commit `10846aa0c9dfc7a2f6a2a215374d75eb6a5103f6`.

**Production deployment:** NO.

**Environment isolation:** VERIFIED. The owner manually verified that `NEXT_PUBLIC_SUPABASE_URL` exists separately for Preview and Production in Vercel, and that the Preview Supabase project URL is different from the Production Supabase project URL. Preview runtime was confirmed against Supabase project `text2task-staging`: a newly created Preview test user appeared in `text2task-staging` Authentication. No secrets, anon keys, service-role keys, or full UUIDs are recorded in this documentation.

**Preview/Staging runtime evidence:**
- Fresh Preview/Staging test user: `eidelman.yan+seo-m1-preview@gmail.com`.
- First authenticated text extraction: PASS. Owner performed the first successful authenticated text extraction; result was a successful project draft extraction with 6 subtasks.
- `first_extract_created`: PASS. Staging `analytics_events` contained exactly one `first_extract_created` event for the new user.
- First project save / `project_saved`: PASS. Owner explicitly saved the first extracted project. The persisted project observed in Staging Tasks was `Website Launch Updates and QA`, with 6 tasks and budget `1,200 USD`. Staging `analytics_events` contained `project_saved` metadata `source = project_import` and `created_project_count = 1`; idempotency behavior matched the user-level `project_saved` contract.
- Second text extraction / deduplication: PASS. Owner performed a second successful authenticated text extraction using different content; the second project was not saved during this check. After refreshing Staging `analytics_events`, `first_extract_created` remained at exactly one event for the user, no second `first_extract_created` was created, and `project_saved` remained at exactly one event from the first saved project.

**Deferred runtime checks:**
- Image extraction manual Preview/Staging runtime verification: DEFERRED / NON-BLOCKING FOR MERGE. Route-level automated coverage already exists and passes. The owner intentionally deferred manual image extraction runtime verification after successful text extraction and deduplication proof. Do not record image extraction as manually verified.
- `paid_conversion` manual Preview runtime verification: DEFERRED / REQUIRES SAFE CREEM VERIFICATION STRATEGY. Automated tests prove first paid conversion semantics, distinct renewal dedupe, different-user independence, webhook failure isolation, and idempotency. Vercel showed several Creem environment variables scoped to Production and Preview, so no Preview payment/webhook mutation test was performed during this gate. Do not record `paid_conversion` runtime as manually verified.

**Owner decision:** The owner accepts the remaining manual image extraction runtime verification as a non-blocking follow-up and accepts that `paid_conversion` runtime verification will occur separately through a safe strategy that does not risk false Production payments or conversions. These deferred checks do not invalidate the passing automated coverage. Milestone 1 is approved to proceed to merge review based on local implementation verification, automated test coverage, build/typecheck/lint verification, Preview deployment success, Preview/Staging isolation proof, `first_extract_created` runtime proof, `first_extract_created` deduplication runtime proof, and `project_saved` runtime proof.

### 40.8 Production Deployment / Smoke Verification

**Closeout timestamp:** 2026-09-14 11:58:23 Asia/Jerusalem.

**Merge status:** VERIFIED. PR #2 (`Phase 1: add SEO funnel measurement foundation`) was merged successfully to `main` as merge commit `b3e372c`.

**Production deployment:** VERIFIED. Vercel Production deployment was READY for environment `Production`, branch `main`, commit `b3e372c`.

**Owner production smoke test:** PASS. The owner manually tested `https://www.text2task.com/` after deployment and verified:
- Homepage: PASS.
- Dashboard: PASS.
- Extract: PASS.
- Tasks: PASS.
- Calendar: PASS.

No user-visible regression was observed in this production smoke gate.

**Accuracy limits for this gate:**
- Manual Production Image Extract runtime verification was not performed.
- Manual Production `paid_conversion` verification was not performed.
- Production `paid_conversion` row verification was not performed.
- Production `first_extract_created` re-verification was not performed.
- Production `project_saved` re-verification was not performed.

**Preserved follow-ups:**
- Image Extract manual runtime: DEFERRED / NON-BLOCKING.
- `paid_conversion` manual runtime: DEFERRED / SAFE VERIFICATION REQUIRED.

### 40.9 Remaining Verification / Follow-Ups

- No database migration is required for this milestone.
- Manual image extraction runtime verification remains a non-blocking follow-up.
- Manual `paid_conversion` runtime verification requires a safe Creem strategy before execution.

---

## 41. Phase 1 Milestone 2 — Entity / Brand Disambiguation Mapping

**Status:** HISTORICAL MAPPING SNAPSHOT / SUPERSEDED BY §42 LOCAL IMPLEMENTATION.

**Mapping timestamp:** 2026-09-14 12:57:49 Asia/Jerusalem.

**Branch / HEAD at mapping start:** `main` at `bb2dc2154562e3f1488c0e9bac28a49b09aa2973`.

**Milestone objective:** build a truthful production-grade entity / brand disambiguation plan so search engines and AI systems can identify `text2task.com` Text2Task as the current freelancer/small-team SaaS, distinct from the unrelated Microsoft Marketplace / Target Energy Solutions product named Text2Task.

### 41.1 On-Site Entity Inventory

| Signal | Source | Component/function | Schema type | Entity name / URL / IDs | sameAs | Visible-content support | Consistency issues |
|---|---|---|---|---|---|---|---|
| Canonical origin | `app/lib/site-config.ts` | `SITE_ORIGIN`, `absoluteUrl()` | N/A | `https://www.text2task.com` | N/A | Supported by sitemap/canonical architecture. | Strong; all generated absolute URLs use www canonical origin. |
| Organization social constants | `app/lib/site-config.ts` | `SITE_SOCIAL_LINKS`, `SITE_ORGANIZATION_SAME_AS` | N/A feeding Organization | Facebook company page; LinkedIn company page | Facebook business URL and LinkedIn company URL only | Footer visibly links the same two company profiles. | `sameAs` is narrow but truthful; does not include verified directories or founder profile. |
| Site entity IDs | `app/lib/schema.ts` | `SITE_SCHEMA_ENTITY_IDS` | Organization, WebSite IDs | `https://www.text2task.com/#organization`, `https://www.text2task.com/#website` | N/A | Referenced by page schemas. | No `Person` ID and no `SoftwareApplication` ID by design. |
| Breadcrumb helper | `app/lib/schema.ts` | `buildBreadcrumbListJsonLd()` | `BreadcrumbList` | Per-page `@id = {canonicalUrl}#breadcrumb` | N/A | Breadcrumb item names/URLs match visible navigation intent. | One known feature-page breadcrumb-depth inconsistency remains outside this milestone. |
| Article helper | `app/lib/schema.ts` | `buildArticleJsonLd()` | `Article` | Per-article `@id = {url}#article`; `mainEntityOfPage.@id = {url}#webpage`; publisher `/#organization` | N/A | Supported by visible resource articles. | Some articles omit dates as already recorded in §15; not an entity-disambiguation blocker. |
| Homepage Organization | `app/page.tsx` | `organizationJsonLd` rendered through `JsonLd` | `Organization` | Name `Text2Task`; `@id` `/#organization`; URL `/`; logo `/text2task-logo.png` | `SITE_ORGANIZATION_SAME_AS` only | Homepage visibly brands Text2Task, logo, product positioning. | No `founder`; no alternateName; `sameAs` omits verified directory/entity surfaces. |
| Homepage WebSite | `app/page.tsx` | `websiteJsonLd` | `WebSite` | Name `Text2Task`; `@id` `/#website`; URL `/`; publisher `/#organization` | N/A | Supported by visible site and homepage copy. | Strong and stable. |
| Homepage WebPage | `app/page.tsx` | `homepageWebPageJsonLd` | `WebPage` | `@id` `/#webpage`; name `Turn Client Messages Into Projects and Tasks`; publisher `/#organization`; isPartOf `/#website` | N/A | Supported by homepage title/hero/product copy. | No issue for entity work. |
| About page | `app/about/page.tsx` | `aboutJsonLd` | `AboutPage` | `@id` `/about#webpage`; URL `/about`; publisher `/#organization`; isPartOf `/#website` | N/A | Visible copy says Text2Task is independently built, has product principles, and includes generic founder images/captions. | No named founder; AboutPage has no `about` or `mainEntity` after prior SoftwareApplication cleanup. |
| Use Cases hub | `app/use-cases/page.tsx` | inline `collectionJsonLd`, `itemListJsonLd`, breadcrumb | `CollectionPage`, `ItemList`, `BreadcrumbList` | Name `Text2Task Use Cases`; item URLs under `/use-cases/*`; item-list `@id` `/use-cases#item-list` | N/A | Visible hub lists current use cases. | `CollectionPage` has no explicit `@id` and no publisher/isPartOf, but it is not the primary entity-disambiguation surface. |
| Use Case details | `app/components/use-cases/use-case-detail-page.tsx` | `webPageJsonLd`, `faqJsonLd`, breadcrumb | `WebPage`, `FAQPage`, `BreadcrumbList` | Per-slug `@id = /use-cases/{slug}#webpage`; publisher `/#organization`; isPartOf `/#website` | N/A | Real visible page, FAQ, breadcrumbs. | `FAQPage` currently has no explicit `@id`; acceptable but less normalized than Feature/Solution FAQ schema. |
| Solution page | `app/solutions/freelancer-project-management-software/page.tsx` | `webPageJsonLd`, `faqJsonLd`, breadcrumb | `WebPage`, `FAQPage`, `BreadcrumbList` | `@id = /solutions/freelancer-project-management-software#webpage`; publisher `/#organization`; FAQ `@id = #faq` | N/A | Visible commercial/product category copy and FAQ. | No SoftwareApplication mainEntity, intentionally. |
| Feature pages | `app/features/*/page.tsx` | per-page `webPageJsonLd`, `faqJsonLd`, breadcrumb | `WebPage`, `FAQPage`, `BreadcrumbList` | Per-feature `#webpage`, `#faq`, breadcrumb IDs; publisher `/#organization` | N/A | Visible feature copy and FAQ. | Breadcrumb depth inconsistency on `client-feedback-to-tasks` remains P2; not blocking Milestone 2. |
| Resource articles | `app/resources/*/page.tsx` | `buildArticleJsonLd()`, breadcrumb | `Article`, `BreadcrumbList` | Per-article `#article`; publisher `/#organization`; mainEntityOfPage `#webpage` | N/A | Visible long-form resource articles. | 3 of 7 articles lack published/modified dates; not blocking entity graph. |
| Contact page | `app/contact/page.tsx` | page metadata only | None | Canonical `/contact`; support email `support@text2task.com` | N/A | Visible support/privacy/feedback email routes. | No Organization/ContactPoint JSON-LD. Do not invent address/phone. |
| Footer | `app/components/landing/landing-footer.tsx` | `LandingFooter` | None | Visible logo alt `Text2Task`; support email; copyright `© 2026 Text2Task` | Company Facebook and LinkedIn links | Supports Organization name, logo, support email, company profiles. | No founder/person link; no legal company name beyond brand. |
| Root metadata | `app/layout.tsx` | `metadata` | Metadata, not JSON-LD | `applicationName`, `authors`, `creator`, `publisher` all `Text2Task`; category `Productivity Software` | N/A | Brand/product category support. | No individual author/founder; correct until owner approves person identity. |
| JSON-LD renderer | `app/components/JsonLd.tsx` | `JsonLd` | Renderer | Emits JSON-LD safely with `<` escaped | N/A | N/A | Safe shared renderer; no entity content itself. |

### 41.2 Founder / Person Entity Mapping

Current answers:

1. Founder publicly named on-site: **NO**. The About page uses first-person founder narrative and generic captions such as "Founder and independent builder of Text2Task," but no full name is visible.
2. `Person` schema present: **NO**. `app/lib/schema.ts` has no Person ID/builder and no page constructs an inline Person object.
3. Founder name used in metadata/schema: **NO**. Metadata authors/creator/publisher are all `Text2Task`, not an individual.
4. Founder identity linked to Organization: **NO**. Organization JSON-LD has no `founder` relationship.
5. Founder identity linked to external profiles: **NO on-site**. Phase 0B documents external LinkedIn and Peerlist evidence associating the founder with Text2Task, but the website does not link a founder profile.
6. Founder identity visible to users or schema-only: **neither**. It is visible externally in owner-supplied evidence, but not on the website.
7. Would adding a founder entity currently be truthful and supported by visible content: **NO, not yet**. It may be truthful based on external evidence, but structured data must reflect visible on-site content. A schema-only founder claim would be the wrong order.
8. Required visible content before Person schema: owner-approved full founder name on `/about`; a short factual founder role/bio; optionally an approved professional profile link; visible copy that explicitly states the founder relationship to Text2Task; and, if using a fragment URL, a stable visible section/anchor such as `/about#founder`.

### 41.3 Brand Disambiguation Assessment

**Classification:** PARTIAL.

Current strong signals:
- Canonical domain is consistently `https://www.text2task.com`.
- Product category and copy consistently describe a SaaS for freelancers, agencies, and client-service teams that turns client messages/emails/notes/screenshots into reviewable projects and tasks.
- Logo and brand name are consistent on homepage, footer, contact, About, metadata, and Organization schema.
- Company LinkedIn and Facebook are in both footer links and `Organization.sameAs`.
- External baseline verifies multiple current Text2Task surfaces and an unrelated older Microsoft Marketplace / Target Energy Solutions product.

Current weak points:
- No named founder/person identity appears on-site.
- No `Person` schema or `Organization.founder` relationship exists.
- Organization `sameAs` includes only two company social profiles, while the verified external footprint is broader.
- Many verified external surfaces do not yet have exact canonical profile URLs recorded in the repository/run doc, so they cannot safely be added to schema without owner-supplied URLs.
- Ambiguous/unverified profiles (G2, Product Hunt, BetaList) must remain excluded.

Conclusion: search engines and AI systems can probably distinguish `text2task.com` from the unrelated Outlook/email-assistant product by domain, audience, category, and product copy, but the entity graph is not yet strong enough for high-confidence consolidation across founder, company, product, and external profiles. The next implementation should strengthen truthful on-site identity and canonical external references without inventing unsupported claims.

### 41.4 External Profile / Entity Inventory

| Surface | Current verification state | Refers clearly to this Text2Task? | Brand/domain/category match | Founder/company identity visible | Suitable for `sameAs`? |
|---|---|---:|---|---|---|
| LinkedIn company page | Verified in repo/source as current company social link; Phase 0B also notes indexed company posts | Yes | Company link uses Text2Task brand; domain/profile exactness should be owner-confirmed before any URL changes | Company identity visible; founder posts exist externally per run doc | YES, already in Organization `sameAs` as company profile |
| Facebook business page | Present in source and footer | Likely yes based on source-owned link | Brand profile only; not independently enriched in Phase 0B external sweep | Company profile only | YES, already in Organization `sameAs` if owner still considers it canonical |
| Founder LinkedIn profile | Phase 0B owner-supplied external evidence says an indexed founder/profile result exists and references `Text2Task.com` | Yes per run doc | Founder relationship matches external evidence | Founder identity visible externally, not on-site | Rejected for this milestone by owner privacy decision; future `Person.sameAs` only if founder is named visibly on-site and exact URL is owner-approved |
| GetApp | Externally verified current listing | Yes | Matches current SaaS, AI workflow, freelancers/small teams, 30 free AI extracts, Pro `$12.90/month`, project/task/workspace functionality | Founder/company identity not recorded in run doc | Candidate Organization/Product profile `sameAs` after exact URL owner verification |
| Capterra | Externally verified current pricing/listing page | Yes | Matches Free plan, 30 total AI extracts, Pro `$12.90/month`, feature set | Founder/company identity not recorded in run doc | Candidate Organization/Product profile `sameAs` after exact URL owner verification |
| Uneed | Current listing verified | Yes | Current positioning; Project Management / Productivity / CRM classification | Founder/company identity not recorded in run doc | Candidate profile `sameAs` after exact URL owner verification |
| Peerlist | Current project page verified | Yes | Uses positioning "Turn client messages into structured projects and tasks" | Associated with the founder | Deferred; exact URL and owner policy would be required, and no founder/person graph is allowed in this milestone |
| StartupFortune | Verified standalone editorial article | Yes | Editorial title matches current positioning | Not a profile surface | Not recommended for `sameAs`; cite/authority asset, not identity-equivalent profile |
| SaaSHub | Externally surfaced as recently verified product | Yes per run doc | Current product positioning | Founder/company identity not recorded | Candidate profile `sameAs` after exact URL/currentness verification |
| UIComet | Surfaced in launch discovery | Likely, but lower-authority discovery surface | Launch/discovery match only | Not recorded | Usually exclude from initial canonical `sameAs` unless exact URL is stable and owner wants a broad profile graph |
| FounderDB / Peer Push | Surfaced in discovery data | Likely | Discovery data, not full profile detail in run doc | May relate to founder/entity but details are not recorded | Exclude until exact current public URLs and identity details are owner-verified |
| Product Hunt | Not externally verified in Phase 0B sweep | Unknown | Unknown | Unknown | NO; do not include unless verified later |
| BetaList | Not externally verified in Phase 0B sweep | Unknown | Unknown | Unknown | NO; do not include unless verified later |
| G2 | Ambiguous / requires identity verification | Unknown | Current visible G2 result does not clearly establish current `text2task.com` identity | Unknown | NO; explicitly exclude until verified |

### 41.5 Recommended Canonical Entity Graph

Recommended nodes:

| Node | Canonical `@id` | Canonical URL | Name | Description / role | Relationships |
|---|---|---|---|---|---|
| Organization | `https://www.text2task.com/#organization` | `https://www.text2task.com/` | `Text2Task` | Company/product organization behind the Text2Task SaaS | `url`, `logo`, conservative `sameAs`; future `founder` only after owner approval |
| WebSite | `https://www.text2task.com/#website` | `https://www.text2task.com/` | `Text2Task` | Website for the Text2Task SaaS | `publisher` -> Organization |
| Homepage WebPage | `https://www.text2task.com/#webpage` | `https://www.text2task.com/` | `Turn Client Messages Into Projects and Tasks` | Primary product landing page | `isPartOf` -> WebSite; `publisher` -> Organization |
| AboutPage | `https://www.text2task.com/about#webpage` | `https://www.text2task.com/about` | `About Text2Task | Our Story and Product Principles` | Trust/entity page | `isPartOf` -> WebSite; `publisher` -> Organization; future `mainEntity` or visible founder section only if approved |
| Person, if approved | Recommended `https://www.text2task.com/about#founder` | `https://www.text2task.com/about#founder` | Owner-approved founder full name | Founder of Text2Task | `sameAs` -> approved founder profile(s); Organization `founder` -> Person `@id` |
| WebPage pages | `{canonicalUrl}#webpage` | Each canonical route | Page-specific title | Public content/product/use-case/resource page | `isPartOf` -> WebSite; `publisher` -> Organization |
| Article pages | `{articleUrl}#article` | Resource article URL | Article headline | Resource article | `mainEntityOfPage` -> `{articleUrl}#webpage`; `publisher` -> Organization |

`sameAs` policy:
- Keep only exact, current, public profiles that clearly identify this `text2task.com` entity.
- Use Organization `sameAs` for official company/product profiles and reputable directory/product profiles after exact URL verification.
- Use Person `sameAs` only for the founder's personal profiles after the founder is visibly named on-site and owner approves.
- Exclude ambiguous, unverified, scraped, stale, or name-collision-prone profiles.
- Do not use editorial articles as `sameAs`; they are citations/mentions, not identity-equivalent profiles.

SoftwareApplication/Product policy:
- Do not add `SoftwareApplication` or `Product` schema in Milestone 2 by default. The current owner-reviewed decision remains valid: prior `SoftwareApplication` schema was removed because rating/review requirements could not be truthfully met with visible public content.
- Reconsider only in a separate P2 schema-normalization task if the implementation uses truthful visible offers/features and no fabricated ratings/reviews.

### 41.6 Owner Decisions Required

| Decision | Consequence | Recommended choice | Blocking? |
|---|---|---|---|
| Publicly name the founder on Text2Task? | Enables truthful `Person` schema and `Organization.founder`; improves disambiguation; creates privacy/reputation exposure. | YES if the owner is comfortable being publicly associated; otherwise do not add Person schema. | BLOCKING for Person/founder implementation |
| Where should founder identity be visible? | Determines whether schema has visible support. | Add a concise `/about` founder section with stable anchor `/about#founder`; optionally mention in footer only if desired. | BLOCKING for Person schema |
| Link founder social/profile URLs? | Enables `Person.sameAs`; exposes personal profile(s). | Use only owner-approved professional profile URLs, likely the externally verified LinkedIn profile first. | BLOCKING for Person `sameAs`; non-blocking for Organization work |
| Organization `sameAs` breadth? | More profiles can strengthen consolidation but stale/weak/ambiguous URLs can confuse entity identity. | Start conservative: company LinkedIn, company Facebook, plus owner-verified high-trust product/directory profiles with exact URLs (GetApp/Capterra/Uneed/SaaSHub/Peerlist as appropriate). | BLOCKING for `sameAs` expansion |
| Strengthen About page copy? | Visible copy supports schema and improves user trust. | YES: add factual founder/company identity and entity-disambiguating product description if owner approves. | BLOCKING for founder schema; P1 for copy quality |
| Use `alternateName` or tagline? | Can help distinguish "Text2Task" from similarly named products. | Consider Organization `alternateName` such as `Text2Task.com` or a visible tagline only if the same phrase appears in copy/metadata. | NON-BLOCKING |
| Exclude ambiguous profiles? | Avoids contaminating the canonical entity graph. | YES: exclude G2, Product Hunt, BetaList, and any profile without exact current identity verification. | BLOCKING for safe `sameAs` policy |

### 41.7 Implementation Plan

| Priority | Step | Scope | Acceptance criteria |
|---|---|---|---|
| P0 | Entity source-of-truth definition | Define constants for Organization, WebSite, optional Person IDs, approved profile URLs, logo, and descriptions. | One canonical source in `site-config`/schema helpers; no duplicated profile URLs. |
| P0 | Owner founder decision | Owner approves or rejects public founder name/profile publication. | Written owner decision recorded before code. |
| P0 | About visible-entity reinforcement | If approved, add visible founder name, role, concise bio, and optional professional profile link on `/about`. | Visible content supports all future Person fields. |
| P0 | Organization schema normalization | Keep stable Organization/WebSite IDs; add `founder` only if Person is approved and visible. | Organization remains truthful; no hidden-only claims. |
| P0 | Person schema, if approved | Add `Person` node with stable `@id`, name, URL, role, approved `sameAs`; link Organization `founder` to it. | Schema validates and matches visible About content exactly. |
| P1 | `sameAs` normalization | Expand Organization `sameAs` only with exact owner-verified profile URLs. | Ambiguous/unverified profiles excluded; high-trust current profiles included according to owner policy. |
| P1 | Metadata consistency | Ensure titles/descriptions/OG naming still use consistent Text2Task positioning and do not overuse founder identity. | No duplicate title suffix; brand/category language stays consistent. |
| P1 | Schema graph consistency tests | Add focused tests for Organization/WebSite/About/Person links once implementation is authorized. | Tests prove stable IDs and no dangling entity references. |
| P1 HIGH | External profile consistency work | Update external profiles manually where needed so name, domain, category, logo, description, and founder/company identity align. | Profiles match `text2task.com` canonical entity; no fake reviews/claims. |
| P2 | Optional product schema revisit | Separate task only if owner wants it and visible product/offer data supports it. | No ratings/reviews unless publicly visible and legitimate. |
| P2 | Search/AI follow-up measurement | Recheck branded/entity SERP, GSC/Bing visibility, AI citations, and external profile indexing after implementation. | Changes tracked over time; no immediate ranking claims fabricated. |

### 41.8 Milestone 2 Current Conclusion

This mapping snapshot has been superseded by the owner privacy decision and local implementation recorded in §42. The owner decided not to publish founder identity in this milestone, so no `Person`, `Organization.founder`, founder metadata, personal-profile link, or expanded unverified `sameAs` implementation shipped locally.

---

## 42. Phase 1 Milestone 2 — Entity / Brand Disambiguation Local Implementation

**Status:** PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE.

**Implementation timestamp:** 2026-09-14 13:56:50 Asia/Jerusalem.

**Branch:** `feat/seo-entity-disambiguation`.

**Owner privacy decision:** founder identity remains private for now. Do not publish a founder name, do not add `Person` schema, do not add founder metadata, do not add founder `sameAs`, do not add personal social/profile links, and do not infer or expose owner identity from repository/internal documentation. Existing unnamed About-page photos may remain as human trust signals.

### 42.1 Implemented Canonical Entity Graph

| Entity | Current implementation |
|---|---|
| Organization `@id` | `https://www.text2task.com/#organization` |
| WebSite `@id` | `https://www.text2task.com/#website` |
| Homepage WebPage `@id` | `https://www.text2task.com/#webpage` |
| AboutPage `@id` | `https://www.text2task.com/about#webpage` |
| Organization name | `Text2Task` |
| Organization URL | `https://www.text2task.com/` |
| Organization logo | `https://www.text2task.com/text2task-logo.png` |
| Organization description | `Text2Task turns client messages, emails, WhatsApp messages, notes, and supported screenshots into reviewable projects and tasks for freelancers, small agencies, and client-service teams.` |
| WebSite publisher | `https://www.text2task.com/#organization` |
| Homepage WebPage `isPartOf` | `https://www.text2task.com/#website` |
| Homepage WebPage publisher | `https://www.text2task.com/#organization` |
| AboutPage `isPartOf` | `https://www.text2task.com/#website` |
| AboutPage publisher | `https://www.text2task.com/#organization` |
| Person entity | Not present by owner privacy decision |
| `Organization.founder` | Not present by owner privacy decision |
| `SoftwareApplication` / `Product` | Not present; prior owner-reviewed no-fabricated-schema decision preserved |

### 42.2 Final `sameAs` Inventory

Accepted in `Organization.sameAs`:

| URL | Reason |
|---|---|
| `https://www.facebook.com/profile.php?id=61588954785433` | Existing source-owned company profile, also visible in footer. |
| `https://www.linkedin.com/company/text2task/` | Existing source-owned company profile, also visible in footer. |

Rejected or deferred:

| Candidate | Status | Reason |
|---|---|---|
| Founder/personal profiles | Rejected | Owner privacy decision: no founder name, no personal-profile link, no `Person.sameAs`. |
| GetApp | Deferred | Current listing verified in run evidence, but exact canonical URL is not recorded in the repository/current run evidence. |
| Capterra | Deferred | Current listing verified in run evidence, but exact canonical URL is not recorded in the repository/current run evidence. |
| Uneed | Deferred | Current listing verified in run evidence, but exact canonical URL is not recorded in the repository/current run evidence. |
| SaaSHub | Deferred | Current product surface verified in run evidence, but exact canonical URL/currentness is not recorded in the repository/current run evidence. |
| Peerlist | Deferred | Current project surface verified, but personal/founder exposure is privacy-sensitive and exact canonical Organization/Product use is not owner-approved. |
| StartupFortune | Rejected for `sameAs` | Editorial mention/article, not an identity-equivalent profile. |
| UIComet | Deferred | Discovery/listing surface only; exact stable canonical URL and owner policy not verified. |
| FounderDB / Peer Push | Deferred | Discovery data only; exact URLs and identity details not verified for safe public schema use. |
| G2 | Rejected | Ambiguous identity; do not include until current `text2task.com` identity is clearly verified. |
| Product Hunt | Rejected/deferred | Not externally verified in this search sweep. |
| BetaList | Rejected/deferred | Not externally verified in this search sweep. |

### 42.3 About Page Changes

The About page now more clearly establishes that:

- `text2task.com` is the official Text2Task product site.
- Text2Task is the SaaS product at `text2task.com`.
- Text2Task turns client messages, emails, WhatsApp messages, notes, and supported screenshots into reviewable projects and tasks.
- The product is for freelancers, small agencies, and client-service teams.
- Existing unnamed founder/owner photos remain unchanged.

No founder name, personal profile, phone number, location, legal entity name, address, or personal email was added.

### 42.4 Source / Schema Normalization

Implemented source-of-truth constants in `app/lib/site-config.ts`:

- `SITE_BRAND_NAME`
- `SITE_CANONICAL_DESCRIPTION`
- `SITE_CANONICAL_LOGO_PATH`
- `SITE_CANONICAL_LOGO_URL`
- `SITE_CANONICAL_URL`
- existing `SITE_ORIGIN`, `SITE_SOCIAL_LINKS`, and `SITE_ORGANIZATION_SAME_AS`

Homepage `Organization` and `WebSite` JSON-LD now consume these canonical constants for name, URL, logo, and description. Root metadata now uses the canonical brand/description constants. Entity IDs remain stable and unchanged.

### 42.5 Verification Results

| Check | Result |
|---|---|
| Targeted schema/SEO tests | PASS — 3 files / 71 tests (`app/page.test.ts`, `app/about/page.test.ts`, `app/lib/schema-dangling-entity-references.test.ts`) |
| Relevant regression tests | PASS — 9 files / 105 tests across public page/schema/footer regressions |
| TypeScript typecheck | PASS — `npx tsc --noEmit` |
| Changed-file ESLint | PASS — `app/lib/site-config.ts`, `app/page.tsx`, `app/layout.tsx`, `app/about/page.tsx`, `app/page.test.ts`, `app/about/page.test.ts` |
| Production build | PASS after network-enabled rerun for Google Fonts; first sandboxed run failed only because Next could not fetch Google Fonts |
| Full lint | FAILS on unrelated pre-existing lint issue in `app/components/dashboard/tasks/share-link/share-link-channels.tsx` (`react-hooks/set-state-in-effect`) plus unrelated warnings; not changed in this milestone |

### 42.6 Privacy Review

Result: PASS.

- Founder name introduced: NO.
- `Person` schema introduced: NO.
- `Organization.founder` introduced: NO.
- Founder metadata introduced: NO.
- Personal email introduced: NO.
- Phone introduced: NO.
- Home/location details introduced: NO.
- Personal social/profile links introduced: NO.
- Repository/internal owner identity leaked into public metadata or schema: NO.
- Existing About-page photos changed: NO.

### 42.7 Final Milestone 2 State

- Phase 0: COMPLETE / OWNER REVIEWED.
- Phase 1: IMPLEMENTATION IN PROGRESS.
- Milestone 1: COMPLETE.
- Milestone 2: PRODUCTION DEPLOYED / PRODUCTION SMOKE VERIFIED / COMPLETE.
- Milestone 3: NOT STARTED.
- Production: Vercel Production READY; owner smoke verification PASS.
- Database migration required: NO.
- Database changed: NO.
- Environment/config changed: NO.
- Commit created by this documentation task: NO.
- Push performed by this documentation task: NO.
- Deploy performed by this documentation task: NO.

### 42.8 Production Verification Closeout

**Closeout timestamp:** 2026-09-14 18:08:27 Asia/Jerusalem.

**Production merge:** PR #4 merged successfully to `main`.

**Production merge commit:** `80b3318`.

**Vercel Production status:** READY.

**Owner Production smoke verification:** PASS.

Verified live in Production:

- Homepage loads correctly: PASS.
- About page loads correctly: PASS.
- New "ABOUT TEXT2TASK" eyebrow is live: PASS.
- New About opening paragraph is live: PASS.
- Existing About photos remain: PASS.
- Founder personal name is not published: PASS.
- `Person` schema remains intentionally absent: PASS.
- Personal social/profile links were not introduced: PASS.
- No visible regression observed in reviewed About sections: PASS.
- Owner privacy decision remains preserved: PASS.

No new Decision Log ID was created for this closeout because no new product or technical decision was made; this entry records deployment and production verification evidence only.
