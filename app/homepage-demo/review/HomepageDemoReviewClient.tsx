"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  HOMEPAGE_DEMO_CLAIM_LOGIN_PATH,
} from "@/lib/auth/homepage-demo-auth-intent";

import HomepageDemoReviewPanel, {
  type HomepageDemoPublicReviewDraft,
  type HomepageDemoPublicReviewSubtask,
  type HomepageDemoReviewPriority,
} from "./HomepageDemoReviewPanel";
import styles from "./homepage-demo-review.module.css";

const REVIEW_PAGE_PATH = "/homepage-demo/review";
const REVIEW_API_PATH = "/api/homepage-demo/review";
const CLAIM_PREPARE_API_PATH = "/api/homepage-demo/claim/prepare";
const CLAIM_SIGNUP_PATH = `/signup?intent=${HOMEPAGE_DEMO_CLAIM_AUTH_INTENT}`;
const PUBLIC_REVIEW_FRAGMENT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HOMEPAGE_DEMO_REVIEW_RESPONSE_MAX_BYTES = 256 * 1024;
const MAX_POLL_ATTEMPTS = 18;
const MAX_POLL_ELAPSED_MS = 75_000;

type ReviewState =
  | { status: "waiting_for_extraction" }
  | { status: "loading_review" }
  | { status: "review_ready"; draft: HomepageDemoPublicReviewDraft }
  | { status: "review_unavailable" }
  | { status: "review_expired" }
  | { status: "temporarily_unavailable" }
  | { status: "network_error" };

type ReviewApiResult =
  | { status: "review_ready"; draft: HomepageDemoPublicReviewDraft }
  | { status: "review_not_ready" }
  | { status: "review_unavailable" }
  | { status: "review_expired" }
  | { status: "temporarily_unavailable" };

type AuthPreparationDestination = "signup" | "login";

type AuthPreparationState =
  | { status: "idle" }
  | { status: "preparing"; destination: AuthPreparationDestination }
  | { status: "temporarily_unavailable" };

type ClaimPrepareResult =
  | { status: "prepared" }
  | { status: "review_unavailable" }
  | { status: "review_expired" }
  | { status: "temporarily_unavailable" };

type JsonRecord = Record<string, unknown>;

const DRAFT_KEYS = [
  "title",
  "summary",
  "clientName",
  "contactName",
  "clientEmail",
  "clientPhone",
  "clientNotes",
  "amountText",
  "amountValue",
  "currencyCode",
  "deadlineText",
  "deadlineDate",
  "priority",
  "subtasks",
] as const;

const SUBTASK_KEYS = [
  "task",
  "priority",
  "deadlineText",
  "deadlineDate",
  "amountText",
  "amountValue",
  "currencyCode",
  "order",
] as const;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: JsonRecord, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(record);

  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullablePriority(value: unknown): value is HomepageDemoReviewPriority | null {
  return value === null || value === "Low" || value === "Medium" || value === "High";
}

function parseSubtask(value: unknown): HomepageDemoPublicReviewSubtask | null {
  if (!isJsonRecord(value) || !hasExactKeys(value, SUBTASK_KEYS)) {
    return null;
  }

  const {
    task,
    priority,
    deadlineText,
    deadlineDate,
    amountText,
    amountValue,
    currencyCode,
    order,
  } = value;

  if (
    typeof task !== "string" ||
    !isNullablePriority(priority) ||
    !isNullableString(deadlineText) ||
    !isNullableString(deadlineDate) ||
    !isNullableString(amountText) ||
    !isNullableFiniteNumber(amountValue) ||
    !isNullableString(currencyCode) ||
    typeof order !== "number" ||
    !Number.isInteger(order) ||
    order <= 0
  ) {
    return null;
  }

  return {
    task,
    priority,
    deadlineText,
    deadlineDate,
    amountText,
    amountValue,
    currencyCode,
    order,
  };
}

function parseDraft(value: unknown): HomepageDemoPublicReviewDraft | null {
  if (!isJsonRecord(value) || !hasExactKeys(value, DRAFT_KEYS)) {
    return null;
  }

  const {
    title,
    summary,
    clientName,
    contactName,
    clientEmail,
    clientPhone,
    clientNotes,
    amountText,
    amountValue,
    currencyCode,
    deadlineText,
    deadlineDate,
    priority,
    subtasks,
  } = value;

  if (
    typeof title !== "string" ||
    !isNullableString(summary) ||
    !isNullableString(clientName) ||
    !isNullableString(contactName) ||
    !isNullableString(clientEmail) ||
    !isNullableString(clientPhone) ||
    !isNullableString(clientNotes) ||
    !isNullableString(amountText) ||
    !isNullableFiniteNumber(amountValue) ||
    !isNullableString(currencyCode) ||
    !isNullableString(deadlineText) ||
    !isNullableString(deadlineDate) ||
    !isNullablePriority(priority) ||
    !Array.isArray(subtasks)
  ) {
    return null;
  }

  const parsedSubtasks: HomepageDemoPublicReviewSubtask[] = [];

  for (const subtask of subtasks) {
    const parsedSubtask = parseSubtask(subtask);

    if (parsedSubtask === null) {
      return null;
    }

    parsedSubtasks.push(parsedSubtask);
  }

  return {
    title,
    summary,
    clientName,
    contactName,
    clientEmail,
    clientPhone,
    clientNotes,
    amountText,
    amountValue,
    currencyCode,
    deadlineText,
    deadlineDate,
    priority,
    subtasks: parsedSubtasks,
  };
}

function parseContentLength(value: string | null): "ok" | "invalid" | "too_large" {
  if (value === null) {
    return "ok";
  }

  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    return "invalid";
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return "invalid";
  }

  return parsed > HOMEPAGE_DEMO_REVIEW_RESPONSE_MAX_BYTES ? "too_large" : "ok";
}

function getPollDelay(completedAttempts: number): number {
  if (completedAttempts <= 1) {
    return 1_000;
  }

  if (completedAttempts === 2) {
    return 2_000;
  }

  if (completedAttempts === 3) {
    return 4_000;
  }

  return 5_000;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) && error.name === "AbortError"
  );
}

function hasJsonContentType(response: Response): boolean {
  const contentType = response.headers.get("content-type");

  if (contentType === null) {
    return false;
  }

  return contentType.split(";")[0]?.trim().toLowerCase() === "application/json";
}

async function readBoundedJsonResponse(response: Response): Promise<unknown | null> {
  const contentLengthState = parseContentLength(response.headers.get("content-length"));

  if (contentLengthState !== "ok") {
    return null;
  }

  const responseText = await readBoundedResponseText(response);

  if (responseText === null) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
}

async function readBoundedResponseText(response: Response): Promise<string | null> {
  if (response.body === null) {
    return null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!(value instanceof Uint8Array)) {
        return null;
      }

      const prospectiveBytes = totalBytes + value.byteLength;

      if (prospectiveBytes > HOMEPAGE_DEMO_REVIEW_RESPONSE_MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Best-effort cancellation only; the caller receives a sanitized failure.
        }
        return null;
      }

      chunks.push(value);
      totalBytes = prospectiveBytes;
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function parseReviewApiResponse(response: Response): Promise<ReviewApiResult> {
  if (response.redirected) {
    return { status: "temporarily_unavailable" };
  }

  const body = await readBoundedJsonResponse(response);

  if (!isJsonRecord(body)) {
    return { status: "temporarily_unavailable" };
  }

  if (response.status === 200) {
    if (!hasExactKeys(body, ["code", "draft"]) || body.code !== "review_ready") {
      return { status: "temporarily_unavailable" };
    }

    const draft = parseDraft(body.draft);

    return draft === null
      ? { status: "temporarily_unavailable" }
      : { status: "review_ready", draft };
  }

  if (response.status === 202) {
    return hasExactKeys(body, ["code"]) && body.code === "review_not_ready"
      ? { status: "review_not_ready" }
      : { status: "temporarily_unavailable" };
  }

  if (response.status === 404) {
    return hasExactKeys(body, ["code"]) &&
      (body.code === "review_unavailable" || body.code === "not_found")
      ? { status: "review_unavailable" }
      : { status: "temporarily_unavailable" };
  }

  if (response.status === 410) {
    return hasExactKeys(body, ["code"]) && body.code === "review_expired"
      ? { status: "review_expired" }
      : { status: "temporarily_unavailable" };
  }

  if (response.status === 503) {
    return hasExactKeys(body, ["code"]) && body.code === "temporarily_unavailable"
      ? { status: "temporarily_unavailable" }
      : { status: "temporarily_unavailable" };
  }

  return { status: "temporarily_unavailable" };
}

async function parseClaimPrepareResponse(response: Response): Promise<ClaimPrepareResult> {
  if (response.redirected || !hasJsonContentType(response)) {
    return { status: "temporarily_unavailable" };
  }

  const body = await readBoundedJsonResponse(response);

  if (!isJsonRecord(body)) {
    return { status: "temporarily_unavailable" };
  }

  if (response.status === 200) {
    return hasExactKeys(body, ["code", "authenticated"]) &&
      body.code === "claim_prepared" &&
      typeof body.authenticated === "boolean"
      ? { status: "prepared" }
      : { status: "temporarily_unavailable" };
  }

  if (response.status === 404) {
    return hasExactKeys(body, ["code"]) &&
      (body.code === "draft_unavailable" || body.code === "not_found")
      ? { status: "review_unavailable" }
      : { status: "temporarily_unavailable" };
  }

  if (response.status === 410) {
    return hasExactKeys(body, ["code"]) && body.code === "expired"
      ? { status: "review_expired" }
      : { status: "temporarily_unavailable" };
  }

  if (response.status === 409) {
    return hasExactKeys(body, ["code", "authenticated"]) &&
      (body.code === "claim_in_progress" || body.code === "already_claimed") &&
      typeof body.authenticated === "boolean"
      ? { status: "temporarily_unavailable" }
      : { status: "temporarily_unavailable" };
  }

  return { status: "temporarily_unavailable" };
}

function getClaimAuthDestinationPath(destination: AuthPreparationDestination): string {
  return destination === "signup" ? CLAIM_SIGNUP_PATH : HOMEPAGE_DEMO_CLAIM_LOGIN_PATH;
}

export default function HomepageDemoReviewClient() {
  const [state, setState] = useState<ReviewState>({ status: "waiting_for_extraction" });
  const [authPreparationState, setAuthPreparationState] =
    useState<AuthPreparationState>({ status: "idle" });
  const [retryInProgress, setRetryInProgress] = useState(false);
  const publicTokenRef = useRef<string | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const authPreparationInFlightRef = useRef(false);
  const pollingTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const pollAttemptsRef = useRef(0);
  const runIdRef = useRef(0);
  const focusTargetRef = useRef<HTMLDivElement | null>(null);

  function clearPollingTimer() {
    if (pollingTimerRef.current !== null) {
      globalThis.clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }

  function abortActiveRequest() {
    if (activeRequestRef.current !== null) {
      activeRequestRef.current.abort();
      activeRequestRef.current = null;
    }
  }

  function cancelActiveReviewWork() {
    clearPollingTimer();
    abortActiveRequest();
  }

  function removeReviewFragment() {
    window.history.replaceState(null, "", REVIEW_PAGE_PATH);
  }

  function isActiveRun(runId: number): boolean {
    return runIdRef.current === runId;
  }

  function startReviewLoad(publicToken: string, options: { retry: boolean } = { retry: false }) {
    cancelActiveReviewWork();
    if (!options.retry) {
      setRetryInProgress(false);
    }
    setAuthPreparationState({ status: "idle" });
    publicTokenRef.current = publicToken;
    pollStartedAtRef.current = Date.now();
    pollAttemptsRef.current = 0;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    void loadReview(publicToken, runId);
  }

  function processCurrentFragment() {
    const rawHash = window.location.hash;

    if (rawHash.length === 0) {
      if (publicTokenRef.current === null) {
        setState({ status: "waiting_for_extraction" });
      }
      return;
    }

    const fragmentValue = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
    removeReviewFragment();

    if (!PUBLIC_REVIEW_FRAGMENT_PATTERN.test(fragmentValue)) {
      cancelActiveReviewWork();
      publicTokenRef.current = null;
      runIdRef.current += 1;
      setState({ status: "review_unavailable" });
      return;
    }

    startReviewLoad(fragmentValue);
  }

  function scheduleNextPoll(publicToken: string, runId: number) {
    if (!isActiveRun(runId)) {
      return;
    }

    const elapsedMs = Date.now() - pollStartedAtRef.current;

    if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS || elapsedMs >= MAX_POLL_ELAPSED_MS) {
      setRetryInProgress(false);
      setState({ status: "temporarily_unavailable" });
      return;
    }

    const delayMs = Math.min(getPollDelay(pollAttemptsRef.current), MAX_POLL_ELAPSED_MS - elapsedMs);

    if (delayMs <= 0) {
      setRetryInProgress(false);
      setState({ status: "temporarily_unavailable" });
      return;
    }

    clearPollingTimer();
    pollingTimerRef.current = globalThis.setTimeout(() => {
      pollingTimerRef.current = null;

      if (!isActiveRun(runId)) {
        return;
      }

      if (Date.now() - pollStartedAtRef.current >= MAX_POLL_ELAPSED_MS) {
        setRetryInProgress(false);
        setState({ status: "temporarily_unavailable" });
        return;
      }

      void loadReview(publicToken, runId);
    }, delayMs);
  }

  async function loadReview(publicToken: string, runId: number) {
    if (!isActiveRun(runId)) {
      return;
    }

    pollAttemptsRef.current += 1;
    setState({ status: "loading_review" });

    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      const response = await fetch(REVIEW_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      if (!isActiveRun(runId)) {
        return;
      }

      const result = await parseReviewApiResponse(response);

      if (!isActiveRun(runId)) {
        return;
      }

      if (result.status === "review_not_ready") {
        scheduleNextPoll(publicToken, runId);
        return;
      }

      if (result.status === "review_ready") {
        setRetryInProgress(false);
        setState({ status: "review_ready", draft: result.draft });
        return;
      }

      setRetryInProgress(false);
      setState({ status: result.status });
    } catch (error) {
      if (!isActiveRun(runId) || isAbortError(error)) {
        return;
      }

      setRetryInProgress(false);
      setState({ status: "network_error" });
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }

  function retryReviewLoad() {
    const publicToken = publicTokenRef.current;

    if (publicToken === null) {
      return;
    }

    if (retryInProgress) {
      return;
    }

    setRetryInProgress(true);
    startReviewLoad(publicToken, { retry: true });
  }

  async function prepareClaimAndNavigate(destination: AuthPreparationDestination) {
    if (authPreparationInFlightRef.current) {
      return;
    }

    const publicToken = publicTokenRef.current;

    if (publicToken === null) {
      setState({ status: "review_unavailable" });
      return;
    }

    authPreparationInFlightRef.current = true;
    setAuthPreparationState({ status: "preparing", destination });

    try {
      const response = await fetch(CLAIM_PREPARE_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      const result = await parseClaimPrepareResponse(response);

      if (result.status === "prepared") {
        window.location.assign(getClaimAuthDestinationPath(destination));
        return;
      }

      if (result.status === "review_expired" || result.status === "review_unavailable") {
        setState({ status: result.status });
        return;
      }

      setAuthPreparationState({ status: "temporarily_unavailable" });
    } catch {
      setAuthPreparationState({ status: "temporarily_unavailable" });
    } finally {
      authPreparationInFlightRef.current = false;
    }
  }

  const handleFragmentChange = useEffectEvent(() => {
    processCurrentFragment();
  });

  const handleReviewCleanup = useEffectEvent(() => {
    cancelActiveReviewWork();
  });

  useEffect(() => {
    handleFragmentChange();

    const handleHashChange = () => {
      handleFragmentChange();
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      runIdRef.current += 1;
      handleReviewCleanup();
      publicTokenRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      state.status === "review_ready" ||
      state.status === "review_unavailable" ||
      state.status === "review_expired" ||
      state.status === "temporarily_unavailable" ||
      state.status === "network_error"
    ) {
      focusTargetRef.current?.focus();
    }
  }, [state.status]);

  if (state.status === "review_ready") {
    const preparingDestination =
      authPreparationState.status === "preparing"
        ? authPreparationState.destination
        : null;
    const isPreparing = preparingDestination !== null;
    const notice = (
      <div className={styles.previewNotice}>
        <p className={styles.previewNoticeLabel}>Temporary preview</p>
        <p className={styles.previewNoticeText}>
          This preview has not been saved to an account.
        </p>
      </div>
    );
    const footer = (
      <div className={styles.previewFooter}>
        <div className={styles.actionRow} aria-label="Review actions">
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              void prepareClaimAndNavigate("signup");
            }}
            disabled={isPreparing}
          >
            {preparingDestination === "signup"
              ? "Preparing..."
              : "Start for free"}
          </button>
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => {
              void prepareClaimAndNavigate("login");
            }}
            disabled={isPreparing}
          >
            {preparingDestination === "login" ? "Preparing..." : "Log in"}
          </button>
          <Link href="/" prefetch={false} className={styles.secondaryAction}>
            Back to homepage
          </Link>
        </div>
        {authPreparationState.status === "preparing" ? (
          <p className={styles.statusText} role="status" aria-live="polite">
            Preparing your project...
          </p>
        ) : null}
        {authPreparationState.status === "temporarily_unavailable" ? (
          <p className={styles.statusText} role="alert">
            We couldn&apos;t prepare your project. Please try again.
          </p>
        ) : null}
      </div>
    );

    return (
      <div ref={focusTargetRef} tabIndex={-1} className={styles.focusRegion}>
        <HomepageDemoReviewPanel
          draft={state.draft}
          notice={notice}
          footer={footer}
        />
      </div>
    );
  }

  if (state.status === "waiting_for_extraction") {
    return (
      <section className={styles.statusCard} aria-live="polite">
        <p className={styles.kicker}>Waiting</p>
        <h2 className={styles.statusTitle}>Waiting for your draft</h2>
        <p className={styles.statusText}>
          This page will open the review when a temporary draft is ready in this browser session.
        </p>
        <div className={styles.actionRow}>
          <Link href="/" prefetch={false} className={styles.secondaryAction}>
            Back to homepage
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "loading_review") {
    return (
      <section className={styles.statusCard} role="status" aria-live="polite">
        <p className={styles.kicker}>Loading</p>
        <h2 className={styles.statusTitle}>Loading your review</h2>
        <p className={styles.statusText}>
          If the draft is still being prepared, this page will keep checking briefly.
        </p>
      </section>
    );
  }

  const errorCopy = getErrorCopy(state.status);
  const canRetry =
    publicTokenRef.current !== null &&
    (state.status === "temporarily_unavailable" || state.status === "network_error");

  return (
    <section
      ref={focusTargetRef}
      tabIndex={-1}
      className={styles.statusCard}
      role="alert"
      aria-labelledby="homepage-demo-review-error-title"
    >
      <p className={styles.kicker}>Review</p>
      <h2 id="homepage-demo-review-error-title" className={styles.statusTitle}>
        {errorCopy.title}
      </h2>
      <p className={styles.statusText}>{errorCopy.body}</p>
      <div className={styles.actionRow}>
        {canRetry ? (
          <button
            type="button"
            className={styles.primaryAction}
            onClick={retryReviewLoad}
            disabled={retryInProgress}
          >
            Try again
          </button>
        ) : null}
        <Link href="/" prefetch={false} className={styles.secondaryAction}>
          Back to homepage
        </Link>
        {state.status === "review_unavailable" || state.status === "review_expired" ? (
          <Link href="/signup" prefetch={false} className={styles.secondaryAction}>
            Start for free
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function getErrorCopy(status: Exclude<ReviewState["status"], "waiting_for_extraction" | "loading_review" | "review_ready">): {
  title: string;
  body: string;
} {
  switch (status) {
    case "review_unavailable":
      return {
        title: "This review is unavailable",
        body: "The review link is invalid, no longer accessible in this browser session, or cannot be opened.",
      };
    case "review_expired":
      return {
        title: "This review has expired",
        body: "For privacy, temporary reviews are available only for a limited time.",
      };
    case "temporarily_unavailable":
      return {
        title: "We couldn't load the review",
        body: "The review service is temporarily unavailable. Please try again.",
      };
    case "network_error":
      return {
        title: "Check your connection",
        body: "We couldn't reach the review service.",
      };
  }
}
