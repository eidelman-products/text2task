#!/usr/bin/env node
/**
 * Text2Task Client Share Link -- Phase 3 Rate-Limit Foundation Runtime
 * Verification Package
 * File 06: True-concurrency proof for public.increment_share_rate_limit_bucket
 *
 * NOT EXECUTED BY THE AGENT THAT PRODUCED THIS PACKAGE. This file is
 * prepared, read-reviewed, and documented only -- it has never been run
 * against any Supabase project, disposable or otherwise. You (the
 * repository owner) run it, manually, after files 01 and 02 have been
 * applied in a brand-new, empty, TEMPORARY Supabase project.
 *
 * WHY THIS EXISTS
 * A single SQL Editor connection executes statements sequentially, so
 * 03_RUN_PHASE3_RATE_LIMIT_RUNTIME_TESTS.sql -- however many sequential
 * calls it makes -- can never observe a genuine race between two
 * concurrent increments. This script is the only thing in this package
 * that actually proves the atomic INSERT ... ON CONFLICT ... DO UPDATE
 * statement inside increment_share_rate_limit_bucket survives real
 * concurrent load without losing an increment: it fires N simultaneous
 * RPC calls at one identical bucket identity from N separate network
 * connections and then reads back the single persisted row's
 * request_count, asserting it equals exactly N.
 *
 * SAFETY
 *   - Reads its Supabase project URL and service_role key ONLY from the
 *     two environment variables named below. Neither is hard-coded, has a
 *     default, or is read from this repository's own .env.local -- doing
 *     so would risk silently running this against the wrong (dev/staging/
 *     production-adjacent) project. You must export both explicitly,
 *     every time, pointed at the DISPOSABLE test project from this
 *     package's own file 01/02, never at the real Text2Task project.
 *   - Refuses to run (exits nonzero immediately) if either required
 *     environment variable is missing.
 *   - Prints no secret: the service_role key itself is never logged, not
 *     even partially/masked. The identity digest used for the test bucket
 *     is a fixed, clearly-synthetic, non-secret 64-hex-character value
 *     (not derived from any real user, IP, or session) and is safe to log
 *     if needed for debugging, but this script does not log it by default
 *     either.
 *   - Uses no other package/library beyond @supabase/supabase-js, which
 *     is already a dependency of this repository (see
 *     lib/supabase/admin.ts and scripts/test-connection.ts for the exact
 *     same import).
 *   - Requires no Docker, no new dependency, and no build step -- run
 *     directly with plain Node (ESM `.mjs`), from the repository root:
 *
 *       PHASE3_RATE_LIMIT_DISPOSABLE_SUPABASE_URL="https://<disposable-project-ref>.supabase.co" \
 *       PHASE3_RATE_LIMIT_DISPOSABLE_SERVICE_ROLE_KEY="<disposable-project-service-role-key>" \
 *       node docs/client-share-phase3-rate-limit-runtime/06_concurrency_runner.mjs
 *
 *     (PowerShell equivalent:)
 *
 *       $env:PHASE3_RATE_LIMIT_DISPOSABLE_SUPABASE_URL = "https://<disposable-project-ref>.supabase.co"
 *       $env:PHASE3_RATE_LIMIT_DISPOSABLE_SERVICE_ROLE_KEY = "<disposable-project-service-role-key>"
 *       node docs/client-share-phase3-rate-limit-runtime/06_concurrency_runner.mjs
 *
 * WHAT IT PROVES
 * Fires CONCURRENCY_COUNT (default 25, override with
 * PHASE3_RATE_LIMIT_CONCURRENCY_COUNT) simultaneous calls to
 * increment_share_rate_limit_bucket, all targeting the exact same bucket
 * identity (scope='network_identity', action='session_exchange', one
 * fixed synthetic identity_digest, no share link, window_seconds=3600 --
 * a full hour, chosen so every call in one test run lands in the same
 * logical window even if the run takes a few seconds). Every returned
 * requestCount is collected. The script then independently re-reads the
 * persisted row from public.share_rate_limit_buckets directly and
 * asserts request_count === N. It also asserts the N returned
 * requestCount values, sorted, form the exact contiguous set {1, 2, ...,
 * N} with no duplicate and no gap -- the strongest possible evidence that
 * no two concurrent calls ever observed or wrote the same intermediate
 * count, which is exactly what a lost update would produce (a duplicate
 * value and a gap).
 *
 * Exits 0 and prints CONCURRENCY_RESULT: PASS on success. Exits 1 and
 * prints CONCURRENCY_RESULT: FAIL with the exact mismatch on failure.
 *
 * PRODUCTION IS NOT AUTHORIZED. See
 * 05_PRODUCTION_APPLICATION_NOT_AUTHORIZED.md. This script must never be
 * pointed at the real Text2Task Supabase project.
 */

import { createClient } from "@supabase/supabase-js";

const URL_ENV = "PHASE3_RATE_LIMIT_DISPOSABLE_SUPABASE_URL";
const KEY_ENV = "PHASE3_RATE_LIMIT_DISPOSABLE_SERVICE_ROLE_KEY";
const COUNT_ENV = "PHASE3_RATE_LIMIT_CONCURRENCY_COUNT";

const DEFAULT_CONCURRENCY_COUNT = 25;

// A fixed, clearly-synthetic 64-hex-character identity -- never derived
// from any real IP address, browser session, or user. Safe to appear in
// output; this script does not log it regardless. Built by repeating an
// 8-char hex block exactly 8 times (never hand-typed as one long
// literal), so its length is 64 by construction and cannot silently drift
// by a stray/missing character the way a manually-counted literal can --
// matching public.share_rate_limit_buckets_identity_digest_check's exact
// `^[0-9a-f]{64}$` requirement.
const TEST_IDENTITY_DIGEST = "c0ffee00".repeat(8);
const TEST_SCOPE = "network_identity";
const TEST_ACTION = "session_exchange";
const TEST_WINDOW_SECONDS = 3600;

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(
      `CONCURRENCY_RESULT: FAIL -- missing required environment variable ${name}. Refusing to run. See this file's own header comment for the exact required environment variables and command.`
    );
    process.exit(1);
  }
  return value;
}

function readConcurrencyCount() {
  const raw = process.env[COUNT_ENV];
  if (!raw) return DEFAULT_CONCURRENCY_COUNT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 500) {
    console.error(
      `CONCURRENCY_RESULT: FAIL -- ${COUNT_ENV} must be an integer between 2 and 500 if supplied. Got: ${raw}`
    );
    process.exit(1);
  }
  return parsed;
}

async function main() {
  const supabaseUrl = readRequiredEnv(URL_ENV);
  const serviceRoleKey = readRequiredEnv(KEY_ENV);
  const concurrencyCount = readConcurrencyCount();

  console.log(
    `Phase 3 rate-limit concurrency runner starting. N=${concurrencyCount}. Target project host: ${new URL(supabaseUrl).host}`
  );
  console.log(
    "This script never logs the service_role key. Confirm the host above is your DISPOSABLE test project, never the real Text2Task project, before proceeding."
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const calls = Array.from({ length: concurrencyCount }, () =>
    supabase.rpc("increment_share_rate_limit_bucket", {
      p_scope: TEST_SCOPE,
      p_action: TEST_ACTION,
      p_identity_digest: TEST_IDENTITY_DIGEST,
      p_identity_digest_version: 1,
      p_share_link_id: null,
      p_window_seconds: TEST_WINDOW_SECONDS,
    })
  );

  // Fired together (not awaited one at a time), so all N requests are
  // genuinely in flight concurrently against separate connections in the
  // client's own connection pool -- this is the entire point of this
  // script versus the sequential SQL Editor test in file 03.
  const settled = await Promise.allSettled(calls);

  const rejected = settled.filter((r) => r.status === "rejected");
  const errored = settled
    .filter((r) => r.status === "fulfilled" && r.value.error)
    .map((r) => r.value.error);

  if (rejected.length > 0 || errored.length > 0) {
    console.error(
      `CONCURRENCY_RESULT: FAIL -- ${rejected.length} request(s) rejected at the transport level and ${errored.length} returned a Postgres error. None of these should occur for well-formed, valid input.`
    );
    for (const r of rejected) console.error("  transport rejection:", r.reason);
    for (const e of errored) console.error("  rpc error:", e.message ?? e);
    process.exit(1);
  }

  const returnedCounts = settled
    .map((r) => r.value.data?.requestCount)
    .filter((v) => typeof v === "number")
    .sort((a, b) => a - b);

  if (returnedCounts.length !== concurrencyCount) {
    console.error(
      `CONCURRENCY_RESULT: FAIL -- expected ${concurrencyCount} numeric requestCount values, got ${returnedCounts.length}.`
    );
    process.exit(1);
  }

  const expectedSet = Array.from({ length: concurrencyCount }, (_, i) => i + 1);
  const returnedMatchesExpected =
    JSON.stringify(returnedCounts) === JSON.stringify(expectedSet);

  const { data: bucketRow, error: readError } = await supabase
    .from("share_rate_limit_buckets")
    .select("request_count")
    .eq("scope", TEST_SCOPE)
    .eq("action", TEST_ACTION)
    .eq("identity_digest", TEST_IDENTITY_DIGEST)
    .eq("window_seconds", TEST_WINDOW_SECONDS)
    .maybeSingle();

  if (readError) {
    console.error("CONCURRENCY_RESULT: FAIL -- could not read back the persisted bucket row:", readError.message);
    process.exit(1);
  }

  const persistedCount = bucketRow?.request_count;
  const persistedMatchesN = persistedCount === concurrencyCount;

  console.log(`Returned requestCount values (sorted): [${returnedCounts.join(", ")}]`);
  console.log(`Persisted request_count read back directly from the table: ${persistedCount}`);

  if (!returnedMatchesExpected || !persistedMatchesN) {
    console.error(
      `CONCURRENCY_RESULT: FAIL -- lost-update behaviour detected. returnedMatchesExpected=${returnedMatchesExpected} persistedMatchesN=${persistedMatchesN} (expected persisted request_count = ${concurrencyCount}, got ${persistedCount}). A duplicate or missing value in the returned set, or a persisted count below N, means two concurrent calls raced and one increment was lost.`
    );
    process.exit(1);
  }

  console.log(
    `CONCURRENCY_RESULT: PASS -- all ${concurrencyCount} concurrent calls produced the exact contiguous set {1..${concurrencyCount}} with no duplicate and no gap, and the persisted request_count independently confirms ${concurrencyCount}.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("CONCURRENCY_RESULT: FAIL -- unexpected error:", error?.message ?? error);
  process.exit(1);
});
