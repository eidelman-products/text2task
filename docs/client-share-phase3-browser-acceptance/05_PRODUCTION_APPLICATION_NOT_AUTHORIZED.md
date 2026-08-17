# Production Application — Not Authorized

Read this even if every check in this package passes.

## What passing this package proves

A `browser_fixture_status = READY` result from
`03_BROWSER_FIXTURE_VERIFICATION.sql` confirms that, against the same
disposable Supabase project `docs/client-share-phase3-runtime/` already
verified: `public.users` exists with the exact columns
`lib/supabase/ensureUser.ts` requires; `projects`/`tasks`/`clients`/
`task_resources` carry every column the real dashboard code
(`app/api/tasks/route.ts`, `lib/tasks/load-dashboard-tasks.server.ts`)
and the Phase 3 public projection (`buildPublicClientShareProjection`)
actually select or insert; one disposable owner, client, project, task,
and safe link-resource exist and are correctly owned/linked; owner-scoped
write grants and RLS are in place with no `anon` access; and the Client
Share RPCs this browser-acceptance pass depends on are still present,
unmodified.

## What passing this package does NOT prove or authorize

- It does not prove that browser/webview acceptance has happened.
  `docs/client-share-phase3-runtime/PHASE3_BROWSER_WEBVIEW_CHECKLIST.md`
  is the actual acceptance record, and it requires a real Preview
  deployment and a real signed-in browser session — neither of which this
  package performs.
- It does not authorize applying anything in this package, or in
  `docs/client-share-phase3-runtime/`, to the real Production Text2Task
  project. This fixture's column *types* are deliberately permissive and
  do not attempt to match Production's actual schema — it is not a
  candidate for Production application under any circumstance.
- It does not authorize enabling `TEXT2TASK_CLIENT_SHARE_ENABLED` in
  Production. That remains a separate, explicit, later decision.
- It does not authorize a Vercel Preview deployment by itself — deploying
  is a separate, explicit action the user takes after reviewing this
  package's results.
- A successfully *prepared* package (files written, `MANIFEST.md`
  generated) is not by itself proof of anything — only an actual run of
  Files 01 → 02 → 03, captured in `04_CAPTURE_RESULTS.md`, is.

## Hard rules

- The Production Text2Task project must never receive any file from this
  package.
- No Production migration, RPC, table, or grant is created, modified, or
  implied by this package — every object it creates lives only in the
  disposable project's own `public` schema, additively, gated by the
  existing runtime-package sentinel.
- No disposable Auth user, Preview deployment, or environment variable
  was created by the agent that produced this package — only the SQL/
  Markdown files themselves were written.
- No real client, project, or user data was copied into this package —
  every fixture value is synthetic and clearly labeled as such.
