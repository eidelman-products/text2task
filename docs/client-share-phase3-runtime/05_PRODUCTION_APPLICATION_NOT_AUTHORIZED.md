# Production Application — Not Authorized

Read this even if every test in this package passed.

## What passing these tests proves

A `PHASE_3_APPLICATION_RUNTIME_PASS` result from
`03_RUN_PHASE3_APPLICATION_RUNTIME_TESTS.sql` confirms that, against a
clean disposable PostgreSQL database with all ten already-authorized
Client Share migrations applied exactly as committed:

- `202608030003_client_share_owner_foundation.sql`
- `202608030004_client_share_session_foundation.sql`
- `202608030005_client_share_integrity_and_security.sql`
- `202608050001_client_share_owner_reads.sql`
- `202608060001_client_share_lifecycle_operations.sql`
- `202608060002_client_share_access_operations.sql`
- `202608060003_client_share_configuration_save.sql`
- `202608110001_client_share_publication_intent.sql`
- `202608110002_client_share_management_mapping_metadata.sql`
- `202608130001_client_share_rate_limit_increment.sql`

the existing `share_browser_sessions`/`share_session_grants` integrity
triggers (delivered by `202608030005_client_share_integrity_and_security.sql`,
already structurally verified by
`docs/client-share-phase2b-mapping-read-runtime/`) enforce, against a real
database, every invariant the NEW Phase 3 application code in
`lib/share/share-session-grant.server.ts` is written to depend on: a
PIN-required link can never receive a grant without `pin_verified_at`; a
grant can never be issued against a stale `configuration_version`; a
grant's expiry can never exceed either the browser session's own expiry
or a sooner link expiry; one browser session can hold independent current
grants for multiple links at once; disabling a link blocks new grants
without silently mutating existing grant rows. It also confirms the exact
rate-limit scope/action combinations Phase 3 application code calls
(`session_exchange`+`network_identity`, `pin_verification`+`share_link`,
`projection_read`+`browser_session`, `invalid_link_access`+`network_identity`)
are all accepted, and that the exact bounded column set
`buildPublicClientShareProjection()` selects resolves correctly against a
real fixture row.

## What this package is, and is not

**No new migration was added for Phase 3 application implementation.**
Session exchange, the browser-session cookie, the public `/share/**`
route, the PIN flow, and the projection read are Node application code
in `lib/share/*.server.ts` and `app/api/share/**` — not new database
objects. This package therefore applies the SAME ten migrations the
Phase 3 rate-limit-foundation package already runtime-verified, and its
file 03 proves the EXISTING triggers/RPC correctly enforce what that new
application code assumes, by issuing the same INSERT/UPDATE statements
the service-role application code issues, directly from SQL.

This package does **not** re-prove the entire Client Share surface —
`docs/client-share-phase1b-runtime/` (520/520 PASS),
`docs/client-share-phase1c-runtime/` (47/47 PASS),
`docs/client-share-phase2b-mapping-read-runtime/` (46/46 PASS) and
`docs/client-share-phase3-rate-limit-runtime/` (23/23 PASS + N=25
concurrency PASS) already did that for the owner-facing surface, the
mapping-read surface, and the atomic rate-limit counter itself. This
package's file 03 is deliberately scoped to the session/grant integrity
invariants and the small set of read paths that are new in Phase 3.

## What passing these tests does NOT prove or authorize

- The disposable test fixture (`01_CREATE_TEMP_TEST_FIXTURE.sql`) is a
  deliberately minimal stand-in for the real production tables. It does
  not, and is not intended to, match the real production schema in every
  column, constraint, trigger or default the production tables actually
  carry.
- Passing this package does **not** authorize applying any of the ten
  migrations above to the real Text2Task production project — they were
  already authorized and, per the project's own record, already applied
  in Production prior to this package existing; this package is a
  disposable-project re-verification only, never a Production action
  itself.
- It does not prove or authorize enabling `TEXT2TASK_CLIENT_SHARE_ENABLED`
  in Production. That remains a separate, explicit, later decision.
- It does not prove or authorize the browser/webview acceptance checklist
  in `PHASE3_BROWSER_WEBVIEW_CHECKLIST.md` — that requires an actual
  browser against an actual deployed environment and is tracked
  separately.
- It does not replace `npm run build`, staging, or any deploy step — none
  of those were run to produce this package.
- A successfully *generated* package (file `02` mechanically assembled)
  is not by itself runtime proof of anything — only an actual run of file
  `03`, captured in `04_CAPTURE_RESULTS.md`, is.

## Hard rules

- The Production Text2Task project must never receive file `01` or file
  `03` from this package.
- Only the ten original, committed migration files under
  `supabase/migrations/` are ever candidates for Production application —
  and only exactly as written, never as edited copies, and never as the
  generated bundle in file `02` (which exists solely for temporary-project
  SQL Editor convenience).
- No Production access, no Build, no deploy, no `git add`/commit/push, and
  no feature-flag change was performed by this package or by the agent
  that produced it.
