import {
  CANONICAL_HOST,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  assertIndexNowKeyIsProtocolValid,
} from "./indexnow-config.mjs";
import { mapChangedFiles } from "./changed-file-mapper.mjs";
import { canonicalUrlFromPath, getSitemapUrls } from "./public-url-inventory.mjs";
import { safeDisplayUrl, validateAndDedupeUrls } from "./url-validator.mjs";

export function buildIndexNowRequestBody(urlList) {
  assertIndexNowKeyIsProtocolValid();

  return {
    host: CANONICAL_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };
}

export function canSubmitInEnvironment(env = process.env) {
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();

  if (vercelEnv && vercelEnv !== "production") {
    return {
      ok: false,
      reason: "VERCEL_ENV_NOT_PRODUCTION",
      environment: vercelEnv,
    };
  }

  return {
    ok: true,
    reason: "SUBMISSION_ENVIRONMENT_ALLOWED",
    environment: vercelEnv || env.NODE_ENV || "local",
  };
}

export async function buildCandidateUrls({ urls = [], files = [] } = {}) {
  const mappedFiles = await mapChangedFiles(files);
  const mappedPaths = mappedFiles.flatMap((result) =>
    result.reviewRequired ? [] : result.candidatePaths,
  );
  const reviewRequired = mappedFiles.filter((result) => result.reviewRequired);

  return {
    candidateUrls: [
      ...urls,
      ...mappedPaths.map((pathname) => canonicalUrlFromPath(pathname)),
    ],
    mappedFiles,
    reviewRequired,
  };
}

export async function runIndexNowSubmission(options = {}) {
  const startedAt = Date.now();
  const mode = options.submit ? "submit" : "dry-run";
  const sitemapUrls = await getSitemapUrls();
  const { candidateUrls, mappedFiles, reviewRequired } = await buildCandidateUrls({
    urls: options.urls ?? [],
    files: options.files ?? [],
  });
  const validation = validateAndDedupeUrls(candidateUrls, sitemapUrls);
  const body = buildIndexNowRequestBody(validation.accepted);
  const environment = canSubmitInEnvironment(options.env ?? process.env);

  const report = {
    mode,
    environment: environment.environment,
    canonicalHost: CANONICAL_HOST,
    candidateSource: {
      urls: (options.urls ?? []).map(safeDisplayUrl),
      files: options.files ?? [],
    },
    mappedFiles,
    reviewRequired,
    candidateUrlCount: candidateUrls.length,
    acceptedCount: validation.accepted.length,
    rejectedCount: validation.rejected.length,
    duplicateCount: validation.duplicateCount,
    acceptedUrls: validation.accepted,
    rejectedUrls: validation.rejected,
    requestWouldBeSent:
      Boolean(options.submit) &&
      environment.ok &&
      validation.accepted.length > 0 &&
      reviewRequired.length === 0,
    endpoint: INDEXNOW_ENDPOINT,
    keyLocation: INDEXNOW_KEY_LOCATION,
    requestBody: body,
    statusCode: null,
    elapsedMs: null,
    retryCount: 0,
    overallResult: "DRY_RUN_NO_REQUEST_SENT",
  };

  if (!options.submit) {
    report.elapsedMs = Date.now() - startedAt;
    return report;
  }

  if (!environment.ok) {
    report.overallResult = environment.reason;
    report.elapsedMs = Date.now() - startedAt;
    return report;
  }

  if (reviewRequired.length > 0) {
    report.overallResult = "REVIEW_REQUIRED_NO_REQUEST_SENT";
    report.elapsedMs = Date.now() - startedAt;
    return report;
  }

  if (validation.accepted.length === 0) {
    report.overallResult = "NO_ACCEPTED_URLS_NO_REQUEST_SENT";
    report.elapsedMs = Date.now() - startedAt;
    return report;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });

    report.statusCode = response.status;
    report.overallResult = response.ok
      ? "SUBMISSION_ACCEPTED"
      : "SUBMISSION_FAILED_NON_BLOCKING";
  } catch (error) {
    report.overallResult = "SUBMISSION_ERROR_NON_BLOCKING";
    report.error = error instanceof Error ? error.message : "Unknown IndexNow error";
  }

  report.elapsedMs = Date.now() - startedAt;
  return report;
}
