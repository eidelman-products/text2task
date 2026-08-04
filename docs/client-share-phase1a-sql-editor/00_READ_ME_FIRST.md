# Client Share Link — Phase 1A SQL Editor Verification Package

## READ THIS FIRST

```
##############################################################
#                                                              #
#   TEMPORARY TEST PROJECT ONLY                                #
#   DO NOT RUN FILES 01-03 IN TEXT2TASK PRODUCTION              #
#   DO NOT MODIFY THE SQL WHILE COPYING                         #
#   STOP IMMEDIATELY IF ANY SCRIPT RETURNS AN ERROR              #
#                                                              #
##############################################################
```

This package lets you verify the Client Share Link database design in a
**brand-new, throwaway Supabase project**, using only a web browser and
copy-paste. You do not need a terminal, Docker, or any developer tools.
ChatGPT (or Claude) can walk you through every step below in real time —
just tell it which step you're on if you get stuck.

You do **not** need to understand what RLS, a migration, a trigger, or a
JWT is to complete this. Just follow the numbered steps in order.

---

## What this package proves (and does not prove)

Passing these tests proves the Client Share Link database design behaves
correctly in an isolated test project. **It does not, by itself,
authorize applying anything to the real Text2Task production database.**
See file `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` for why, and what
happens next after these tests pass.

---

## Step-by-step instructions

### 1. Create a brand-new, temporary Supabase project

Go to [supabase.com](https://supabase.com) in your browser, sign in, and
click **New Project**. Give it any throwaway name, e.g.
`text2task-share-phase1a-test`. Pick any region. Wait a minute or two for
it to finish provisioning.

**Never open or reuse the real Text2Task production project for these
steps.** If you are not 100% sure which project you're looking at, check
the project name at the top of the Supabase dashboard before continuing.

### 2. Open the SQL Editor

In the left sidebar of your new temporary project, click **SQL Editor**.
Click **New query** for each file below — use a fresh query tab per file,
so results don't get mixed up.

### 3. Run file `01_CREATE_TEMP_TEST_FIXTURE.sql` first

Open `01_CREATE_TEMP_TEST_FIXTURE.sql` in a text editor, select all the
text, copy it, and paste it into the SQL Editor. Click **Run**.

**What this file does, in plain language:** it builds a small, fake
practice version of the handful of Text2Task tables (projects, tasks,
etc.) that the Client Share Link feature needs to exist alongside. It
also plants an invisible marker (a "sentinel") that proves this project
is a disposable test project and not somewhere real. If this project
already has real-looking tables in it, the script refuses to run and
tells you so — that is a safety feature working correctly, not a bug.

You should see one result row at the end that says `fixture_status =
READY`. If you see an error instead, **stop and copy the exact error
text** — do not try to fix it yourself or re-run with changes.

### 4. Run file `02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` second

Same process: open it, copy all, paste into a new SQL Editor query tab,
click **Run**.

**What this file does, in plain language:** it applies the actual Client
Share Link database design — the same exact file that would eventually
go into the real Text2Task database — to your temporary project only.
This is the part being tested. The file refuses to run unless it can see
the sentinel from step 3, so it cannot be run somewhere unsafe by
accident.

You should see a final result table listing every expected table and
trigger with a `found` column that says `true` for all of them. If
anything says `false`, or you see an error, stop and copy the exact
output.

### 5. Run file `03_RUN_PHASE1A_RUNTIME_TESTS.sql` third

Same process again. This is the biggest file and may take a few seconds
to run.

**What this file does, in plain language:** it actually tries to do
things — like one person trying to see another person's private data, or
a link being deleted to make sure everything attached to it is cleaned up
— and checks that the database blocks the things that should be blocked
and allows the things that should be allowed. All of this happens inside
a practice transaction that is automatically undone at the end
(`ROLLBACK`), so it leaves no trace in your temporary project either way.

You should see a final summary row with `runtime_status = PASS` and a
count of tests that passed. If it says `FAIL`, or the query itself errors
out partway through, stop and copy the exact output, including any
earlier PASS/FAIL rows visible above it.

### 6. Save your results

Copy the full output of steps 3–5 (all three files) into
`04_CAPTURE_RESULTS.md`, or paste it directly back into your ChatGPT/
Claude conversation, along with a screenshot if useful.

### 7. Do not go further without a separate, explicit decision

Do not run any of these three files against the real Text2Task production
project. Read `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` — production
application requires a separate, explicit approval step later, after
these results are reviewed.

### 8. Clean up

Once you're done and results are saved, you can delete the temporary
Supabase project from the Supabase dashboard (**Project Settings → General
→ Delete Project**). Nothing about it needs to be kept.

---

## What each file is

| File | Purpose |
|---|---|
| `00_READ_ME_FIRST.md` | This file. |
| `01_CREATE_TEMP_TEST_FIXTURE.sql` | Builds a fake, minimal practice copy of the existing Text2Task tables this feature depends on, plus the safety sentinel. Run first. |
| `02_APPLY_PHASE1A_TO_TEMP_PROJECT.sql` | The real Client Share Link database design, exactly as written, wrapped in a safety check. Run second. |
| `03_RUN_PHASE1A_RUNTIME_TESTS.sql` | Real behavioral tests — permissions, privacy rules, and cleanup rules — run inside a practice transaction that undoes itself. Run third. |
| `04_CAPTURE_RESULTS.md` | A simple template for writing down what happened. |
| `05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md` | Explains why passing these tests does not by itself mean anything gets applied to the real production database. |
| `MANIFEST.md` | A technical record of exactly what is in this package and how it was built, for anyone auditing it later. |
