# Text2Task Repository Guardrails

Text2Task is an active production SaaS. Prefer small, phase-scoped changes with durable security properties over broad rewrites.

## Global Rules

1. Do not run production database commands, apply migrations, deploy, push, merge, rebase, reset, clean, stash, or commit unless the user explicitly asks for that exact action.
2. Treat untracked or modified files as user-owned work. Do not overwrite, delete, restore, or clean them without explicit instruction.
3. Do not weaken tests, suppress lint/type failures, use unsafe casts, or introduce temporary schema shortcuts.
4. Do not run full builds unless the user explicitly asks for a build.
5. Preserve existing production behavior unless the current task explicitly requires a behavior change.

## Client Share Link Permanent Rules

1. Client share pages expose only a server-built, allowlisted projection. Never use `select("*")`, never spread a database row, and never return raw project, task, client, resource, or storage objects on a public route.
2. Client comments never mutate projects, tasks, clients, resources, timelines, or CRM data automatically. Conversion requires an authenticated owner using the existing Client Updates analyze/review/apply flow.
3. Client communication remains separate from `project_timeline_events`. Do not add share or communication event types to that table.
4. Shared Resources remain private storage objects. Never make the `task-resources` bucket public, never copy files to a public bucket, and never return `storage_path`, `file_name`, `mime_type`, or `size_bytes` to a client.
5. Never grant anything to the `anon` Postgres role for Client Share data. Anonymous access goes through service-role server code behind a verified share session.
6. Public share routes and `/share/**` pages must be excluded from analytics and replay tools through the centralized analytics path exclusion.
7. Share secrets never appear in plaintext, analytics, logs, error messages, or telemetry, and never in an unrestricted or general-purpose reversible database column. The only permitted exception is a dedicated, fully closed table (separate from `project_share_links`) storing AES-256-GCM encrypted secret material so an authenticated owner can re-copy or re-share an already-active link; that table must have RLS enabled with no user-facing policies and no direct grant to `anon`, `authenticated`, or `service_role`. That exception additionally requires a dedicated, versioned encryption key with fail-closed loading (missing, malformed, unknown-version, or incorrect keys must all fail closed), additional authenticated data bound to the owning share link's id, access only through narrowly-scoped owner-authenticated `security definer` RPCs that verify `auth.uid()` ownership internally and never return plaintext from PostgreSQL, and decryption performed only in server-only TypeScript, never in the database and never in the browser. No other reversible storage of a share secret, PIN, or comparable credential is permitted anywhere in the schema.
8. Every public read must revalidate link state, expiry, `projects.deleted_at is null`, and mapping membership at read time.
9. Every share mapping table needs database-level relationship integrity checks; RLS is not a substitute for those checks.
10. Every public route failure must avoid revealing whether a public id exists.
11. Every share migration must ship with colocated static migration tests for grants, constraints, indexes, triggers, RLS posture, and absence of `anon` grants.
12. New read-only RPCs default to `security invoker` with a safe `search_path`, revoked execution from `public`/`anon`, and execution granted only where explicitly needed. A transactional owner mutation that must run without direct table DML grants may instead use a narrowly scoped `security definer` RPC only when it obtains and validates `auth.uid()`, explicitly verifies ownership and project/link relationships, uses a fixed safe `search_path`, contains no dynamic SQL, exposes no generic table-operation parameters, revokes `execute` from `public` and `anon`, grants `execute` only to the exact intended role, and ships focused static plus executable runtime tests. The other permitted model is a service-role-only locked server operation with authenticated ownership verified before invocation.
13. Every sequential Client Share migration must leave the database secure if it commits by itself; positive privileges must never precede the integrity triggers or constraints they rely on.
14. Authenticated owners must never be able to manufacture client-authored communication. Client-authored rows must enter only through the service-role public path after share-session verification.
15. Link revocation and share-session grant revocation are monotonic: do not clear `revoked_at`, do not revive terminal revoked links, and do not decrease configuration or granted versions.
16. Security/access changes to a share link must invalidate stale grants through a monotonic `configuration_version` increase.
17. Integrity triggers must remain compatible with FK cleanup actions such as `ON DELETE SET NULL`; append-only user-facing surfaces must not block administrative FK maintenance.
18. Never expose direct table DML when a Client Share product invariant depends on a transactional RPC or equivalent locked server operation.
19. Curated-content changes and `configuration_version` changes are one transaction: lock `project_share_links`, apply the mutation, increment the version exactly once, and commit atomically.
20. Browser-session and per-link-grant identity fields are immutable after insert; revocation is monotonic and historical revoked rows remain preserved.
21. Public service-role privileges must be column-minimal. Do not grant broad INSERT/UPDATE when only public counters or client-comment input columns are required.
22. Stored password/PIN work factors must use reviewed versioned profiles, not arbitrary user- or owner-controlled parameter ranges.
