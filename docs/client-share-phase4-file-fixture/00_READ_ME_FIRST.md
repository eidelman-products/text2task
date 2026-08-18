# Client Share Link — Phase 4 Disposable File Fixture Package

DISPOSABLE TEST PROJECT ONLY. PRODUCTION APPLICATION NOT AUTHORIZED.

This package prepares exactly one disposable, harmless ~9.5 MiB FILE
Resource inside the **existing** disposable Supabase project
(`text2task-phase3-application-runtime-temp`, confirmed READY —
16/16 PASS — in `docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md`)
so the Phase 4B outbound streamed-delivery route
(`GET /api/share/[publicId]/resources/[fileRef]`) can be proven against a
file near the product's 10MB limit, without depending on the app's own
upload endpoint — which is separately blocked (see "Confirmed defect"
below).

**Nothing in this package was executed this turn.** Every file here is
prepared text only, for a human to review and run themselves in the
disposable project's own SQL Editor / Storage dashboard.

## Confirmed defect (separate from this fixture, do not fix here)

Uploading a ~9.5 MiB file through the existing owner Resources UI
(`app/api/task-resources/upload-and-create/route.ts`) on a real Vercel
Preview failed before reaching Supabase with:

```
Request Entity Too Large
FUNCTION_PAYLOAD_TOO_LARGE
```

The product's own upload contract (`MAX_FILE_SIZE_BYTES = 10 * 1024 *
1024`, and the visible copy "Maximum size is 10MB") says files up to
10MB are supported — this Vercel-platform-level request-body ceiling
means the *upload* path cannot actually deliver on that contract for
files above Vercel's inbound limit, independent of anything Phase 4
does. This is a **pre-existing, real product defect**, now confirmed
against a live deployment rather than merely inferred from the 10MB
constant. It is recorded as a separate, unresolved item in the main
Phase 4 audit doc's new §11 ("Confirmed separate defect") — **not fixed
in this package or this turn**. This fixture package exists specifically
*because* that defect makes the normal upload UI unusable for the
near-10MB Phase 4 proof, so the file is placed directly via the
Supabase Storage dashboard instead.

## What this reuses vs. what this adds

Reused, unchanged, from the already-seeded, already-verified Phase 3
browser-acceptance fixture
(`docs/client-share-phase3-browser-acceptance/02_SEED_DISPOSABLE_OWNER_CONTENT.sql`):

- **Disposable owner**: `phase3-browser-owner@example.invalid` (its `auth.users`/`public.users` id is dashboard-assigned, not a fixed literal — resolved by email, exactly as the existing package already does).
- **Fixture project**: id `33333333-3333-4333-8333-333333333333`, "Phase 3 Browser Acceptance Fixture Project".

Added by this package (nothing above is modified):

- One new `task_resources` row, id `66666666-6666-4666-8666-666666666666` — chosen to continue this repository's existing single-repeated-digit UUID convention for disposable fixtures (`11111111…`, `22222222…`, `33333333…`, `44444444…` are all already used by earlier packages; `55555555…` is already used as a *unit-test* sentinel value (`VALID_RESOURCE_ID_2` in `lib/share/client-share-projection.server.test.ts`) — `66666666…` and `77777777…` below are the next unused values in that family, chosen specifically to avoid any collision with either prior SQL fixture or existing unit-test fixture data).
- One new Storage object at `<owner_id>/33333333-3333-4333-8333-333333333333/project/77777777-7777-4777-8777-777777777777.txt` in the `task-resources` bucket.

## Project-level, not task-level

The new resource is created **project-level** (`project_id` set,
`task_id` left null) rather than attached to the existing "Phase 3
browser fixture task". Reasoning:

- `enforce_share_link_resource_integrity` (the real integrity trigger,
  `202608030005_client_share_integrity_and_security.sql`) only requires
  a mapped resource to have *either* a non-null `project_id` or a
  non-null `task_id` — project-level satisfies this with one fewer
  foreign-key hop than resolving the existing fixture task's
  identity-column id.
- The storage path convention's task segment becomes the literal string
  `"project"` (see `createSafeStoragePath` in
  `app/api/task-resources/upload-and-create/route.ts`) when `task_id` is
  null — one less variable to get right by hand when constructing the
  path manually via the dashboard.
- The owner's Attachments/quick-share picker filters only by Resource
  *type* (`isShareableResource` = not-a-Note and (file-or-link)), not by
  whether a Resource happens to be task-scoped — a project-level file
  Resource is exactly as shareable as a task-level one.
- This keeps the fixture orthogonal to the existing LINK fixture
  resource (which *is* task-level) — the two exercise different
  attachment shapes without either depending on the other.

## Unconfirmed prerequisite — check before uploading

This package's own prior files (`01_EXTEND_DISPOSABLE_APP_SCHEMA.sql`,
`02_SEED_DISPOSABLE_OWNER_CONTENT.sql`) only ever touched Postgres
tables — none of them created or confirmed a Supabase **Storage**
bucket named `task-resources` in this disposable project. Storage
buckets are a separate subsystem from the Postgres schema and are not
visible to, or created by, any SQL file. **Before uploading**, open the
disposable project's Dashboard → Storage and confirm a bucket literally
named `task-resources` already exists. If it does not:

1. Storage → **New bucket**.
2. Name: `task-resources` (must match exactly — the app hardcodes this bucket name).
3. **Public bucket: OFF** — must stay private, matching Production's own bucket privacy posture and the entire premise of Phase 4 (private-bucket, server-mediated delivery).
4. Create.

## Exact sequence

1. Run `01_LOOKUP_OWNER_ID.sql` in the disposable project's SQL Editor. It is read-only and prints the owner's `auth.users.id` — copy this UUID; you need it for the next step.
2. Create the local harmless test file (`phase4-stream-test-9.5mb.txt`, plain text, ~9.5 MiB — e.g. `powershell -Command "[System.IO.File]::WriteAllBytes('phase4-stream-test-9.5mb.txt', (New-Object byte[] (9.5*1024*1024)))"` or any equivalent — content is irrelevant, this is a byte-count proof, not a content proof).
3. Confirm the `task-resources` bucket exists (see prerequisite above).
4. In Dashboard → Storage → `task-resources`, upload the local file to the exact path `<owner_id from step 1>/33333333-3333-4333-8333-333333333333/project/77777777-7777-4777-8777-777777777777.txt` (create the folder path via the upload dialog, or navigate/create folders first — either way the *final* object path must match exactly, since `02_INSERT_FILE_RESOURCE.sql` hardcodes it in the `task_resources.storage_path` value it inserts).
5. Run `02_INSERT_FILE_RESOURCE.sql` in the SQL Editor.
6. Run `03_VERIFY_FILE_RESOURCE.sql` and confirm every check passes.
7. Sign in as `phase3-browser-owner@example.invalid` on a real Vercel Preview, open "Phase 3 Browser Acceptance Fixture Project", confirm the new file Resource appears in the Resources/Attachments panel, select it under "Share with client" → Attachments, and complete the Phase 4B manual Preview proof already described in the main Phase 4 audit doc's Phase 4B §10.
8. After the proof is captured, run `04_CLEANUP.sql`, then manually delete the uploaded object from Dashboard → Storage → `task-resources` (SQL cannot delete Storage objects — they are a separate subsystem; deleting the `task_resources` row does not remove the underlying object).

No file in this package touches Production, creates a migration, or is
executed by anyone other than the person following these steps by hand.
