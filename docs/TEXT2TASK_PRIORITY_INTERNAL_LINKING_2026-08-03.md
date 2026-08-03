# Text2Task Priority Internal Linking — 2026-08-03

## 1. Exact verdict

Completed. Six contextual internal links were added across four existing
source pages, pointing to two of the three GSC-flagged target pages
(`/features/screenshot-to-tasks` and `/use-cases/wordpress-freelancers`).
No new links were added to `/use-cases/web-designers` — the audit found it
already has extensive, genuine inbound internal linking (see §8), and the
task's own anti-overoptimization rules ("do not add links from unrelated
pages merely to increase count," "no forced/unnatural links") ruled out
padding it further. No new pages were created. No target page's URL,
metadata, title, H1, canonical, structured data, sitemap entry, primary
CTA, or intent was changed.

## 2. GSC opportunity summary

Google Search Console data for July 26 – August 1 identified three
near-page-one pages as internal-linking opportunities:

| Target page | Impressions | Avg. position |
|---|---|---|
| `/features/screenshot-to-tasks` | ~20 | ~10.05 |
| `/use-cases/web-designers` | ~6 | ~12.5 |
| `/use-cases/wordpress-freelancers` | ~7 | ~15 |

## 3. The three target pages

- `/features/screenshot-to-tasks` — `app/features/screenshot-to-tasks/page.tsx`
- `/use-cases/web-designers` — `app/lib/use-cases/cases/web-designers.ts` (rendered via `app/use-cases/[slug]/page.tsx`)
- `/use-cases/wordpress-freelancers` — `app/lib/use-cases/cases/wordpress-freelancers.ts` (rendered via `app/use-cases/[slug]/page.tsx`)

None of these three files were modified.

## 4. Every source page modified

1. `app/resources/manage-client-revisions-web-designers/page.tsx` — 2 links added (one to each of two different targets)
2. `app/resources/turn-client-messages-into-tasks/page.tsx` — 1 link added
3. `app/resources/how-to-organize-client-requests-as-a-freelancer/page.tsx` — 1 link added
4. `app/features/client-feedback-to-tasks/page.tsx` — 1 link added (existing `audienceLinks` grid, one new entry)
5. `app/solutions/freelancer-project-management-software/page.tsx` — 1 link added (existing `useCaseLinks` grid, one new entry)

No other files were changed.

## 5. Exact source → target mapping

| Source page | Target | Placement |
|---|---|---|
| `/resources/manage-client-revisions-web-designers` | `/features/screenshot-to-tasks` | Inline sentence, "Where Text2Task fits" section |
| `/resources/manage-client-revisions-web-designers` | `/use-cases/wordpress-freelancers` | Inline sentence, same section |
| `/resources/turn-client-messages-into-tasks` | `/features/screenshot-to-tasks` | Inline sentence, "How Text2Task speeds this up" section |
| `/resources/how-to-organize-client-requests-as-a-freelancer` | `/features/screenshot-to-tasks` | Inline sentence, "How Text2Task helps" section |
| `/features/client-feedback-to-tasks` | `/use-cases/wordpress-freelancers` | Existing `audienceLinks` card grid (new card) |
| `/solutions/freelancer-project-management-software` | `/use-cases/wordpress-freelancers` | Existing `useCaseLinks` card grid (new card) |

Total: 3 links into `/features/screenshot-to-tasks`, 3 links into
`/use-cases/wordpress-freelancers`, 0 new links into `/use-cases/web-designers`.

## 6. Final anchor text used

- "screenshots into structured tasks" (manage-client-revisions-web-designers → screenshot-to-tasks)
- "WordPress freelancers" (manage-client-revisions-web-designers → wordpress-freelancers)
- "screenshots into organized tasks" (turn-client-messages-into-tasks → screenshot-to-tasks)
- "upload a screenshot" (how-to-organize-client-requests-as-a-freelancer → screenshot-to-tasks)
- "WordPress freelancers" / card title (client-feedback-to-tasks audience card)
- "WordPress freelancers" / card title (freelancer-project-management-software use-case card)

No exact-match anchor is repeated across the three inline-sentence links
into screenshot-to-tasks; each uses different wording ("structured tasks"
vs. "organized tasks" vs. "upload a screenshot"). The two card-grid anchors
share the title "WordPress freelancers" because that is the established,
consistent audience-card-title convention already used by every other card
in those same grids (e.g., "Web designers," "Small agencies," "Project
managers") — matching the existing pattern rather than deviating from it
for two isolated cards was judged more natural than inventing new titles.

## 7. Why each link is contextually relevant

- **manage-client-revisions-web-designers → screenshot-to-tasks**: the
  existing sentence already states that Text2Task turns "revision messages
  and screenshots into structured tasks" — the page's own hero example
  and body copy revolve around a marked-up screenshot round of feedback.
- **manage-client-revisions-web-designers → wordpress-freelancers**: the
  existing sentence already names "WordPress freelancers" as one of the
  audiences this content serves, alongside web designers and Webflow
  freelancers.
- **turn-client-messages-into-tasks → screenshot-to-tasks**: the existing
  sentence already states Text2Task "helps turn messy client messages and
  screenshots into organized tasks."
- **how-to-organize-client-requests-as-a-freelancer → screenshot-to-tasks**:
  the existing sentence already instructs the reader to "upload a
  screenshot" as one of the two intake paths described.
- **client-feedback-to-tasks → wordpress-freelancers**: this feature page's
  entire premise is comparing a new client message against a saved
  project; the WordPress freelancers use case's own "Client Updates"
  section is built around distinguishing a new bug report from
  already-tracked maintenance work — a direct thematic match, and the same
  `audienceLinks` grid already served this exact purpose for Web
  designers, Project managers, and Small agencies.
- **freelancer-project-management-software → wordpress-freelancers**: this
  solutions page already lists Web designers, Solo project managers,
  Virtual assistants, and Small agencies in its `useCaseLinks` grid as
  freelance audiences the product serves; WordPress freelancers were a
  clear, previously-missing peer in that same list.

## 8. Existing links intentionally left unchanged

The audit found `/use-cases/web-designers` already has substantial,
genuine inbound linking and no new link was added to it:

- Automatic `relatedSlugs` cross-links from 8 other use-case pages
  (`wordpress-freelancers`, `webflow-freelancers`, `virtual-assistants`,
  `small-agencies`, `shopify-freelancers`, `seo-freelancers`,
  `project-managers`, `graphic-designers`, `freelance-developers`) via the
  existing `UseCaseRelated` component.
- Card-grid links from `/features/screenshot-to-tasks`,
  `/features/client-feedback-to-tasks`, `/features/project-deadline-calendar`,
  and `/solutions/freelancer-project-management-software`.
- A genuine inline editorial link from
  `/resources/manage-client-revisions-web-designers` ("See the full web
  designers use case for a closer look…").
- Site-wide footer and homepage use-case section links.

Adding further links here would have meant either duplicating an
already-covered relationship or forcing a link from an unrelated page
purely to hit a count — both explicitly disallowed by this task's rules.
`/features/screenshot-to-tasks` and `/use-cases/wordpress-freelancers`, by
contrast, had at most one genuine inline editorial inbound link each before
this change (screenshot-to-tasks had one, from
`/resources/how-to-turn-screenshots-into-tasks`; wordpress-freelancers had
none), which is why they received the new links.

No existing link on any of the three target pages was changed, reordered,
or removed.

## 9. Confirmation target titles/H1/metadata unchanged

Verified by re-reading each target file after the change:

- `app/features/screenshot-to-tasks/page.tsx` — not modified in this
  change set (absent from `git diff --stat`).
- `app/lib/use-cases/cases/web-designers.ts` — not modified.
- `app/lib/use-cases/cases/wordpress-freelancers.ts` — not modified.

`git diff --stat` (below, §10) confirms only the five source pages
changed; none of the three target files appear in it.

## 10. Tests and verification results

No test file exists for any page under `app/features/`, `app/resources/`,
`app/solutions/`, or `app/use-cases/` anywhere in the repository — this
entire class of marketing/landing/SEO page currently has no established
test convention to extend. Per this task's own instruction to add tests
"only where the repo's current page-test convention supports it
naturally," no new test files were created rather than inventing a
first-of-its-kind test pattern for this page class.

Verification performed:

- `npx tsc --noEmit` — clean, no errors.
- Targeted ESLint on all 5 touched files — clean, no warnings/errors.
- `npx eslint .` (full repo) — clean, no warnings/errors.
- `git diff --check` — clean (only benign LF/CRLF autocrlf warnings, no
  conflict markers or trailing whitespace).
- Full Vitest suite: **94 test files, 1342 tests, all passing.**
- `npm run build` — succeeded. All five touched routes
  (`/resources/manage-client-revisions-web-designers`,
  `/resources/turn-client-messages-into-tasks`,
  `/resources/how-to-organize-client-requests-as-a-freelancer`,
  `/features/client-feedback-to-tasks`,
  `/solutions/freelancer-project-management-software`) and all three
  target routes (`/features/screenshot-to-tasks`,
  `/use-cases/web-designers`, `/use-cases/wordpress-freelancers`) built
  and statically generated successfully. No font-implementation changes
  were made.

## 11. Recommended GSC reindexing URLs

- `https://text2task.com/features/screenshot-to-tasks`
- `https://text2task.com/use-cases/wordpress-freelancers`
- `https://text2task.com/resources/manage-client-revisions-web-designers`
- `https://text2task.com/resources/turn-client-messages-into-tasks`
- `https://text2task.com/resources/how-to-organize-client-requests-as-a-freelancer`
- `https://text2task.com/features/client-feedback-to-tasks`
- `https://text2task.com/solutions/freelancer-project-management-software`

(`/use-cases/web-designers` is not listed — it was not modified.)

## 12. Suggested measurement window

7–14 days from deployment, comparing GSC impressions and average position
for `/features/screenshot-to-tasks` and `/use-cases/wordpress-freelancers`
against the July 26 – August 1 baseline in §2.

## 13. Git status and commit hash

Pre-commit working tree (after verification, before staging):

```
## main...origin/main
 M app/features/client-feedback-to-tasks/page.tsx
 M app/resources/how-to-organize-client-requests-as-a-freelancer/page.tsx
 M app/resources/manage-client-revisions-web-designers/page.tsx
 M app/resources/turn-client-messages-into-tasks/page.tsx
 M app/solutions/freelancer-project-management-software/page.tsx
```

5 files changed, 30 insertions(+), 8 deletions(-). Branch `main` was even
with `origin/main` before this package's commit. This report and the five
source-page edits are staged together into one isolated local commit,
"Strengthen internal links to priority SEO pages." The exact resulting
commit hash is reported in the final chat response, not pushed.
