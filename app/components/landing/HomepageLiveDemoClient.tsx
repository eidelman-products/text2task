"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";

import {
  isHomepageDemoOpaqueToken,
  parseHomepageDemoBootstrapClientResponse,
  parseHomepageDemoExtractClientResponse,
  readHomepageDemoClientJsonResponse,
  type HomepageDemoExtractPublicResponseCode,
} from "@/lib/homepage-demo/client-response-reader";

import {
  HomepageDemoTurnstileClientError,
  createHomepageDemoTurnstileAdapter,
  type HomepageDemoTurnstileAdapter,
} from "./homepage-demo-turnstile.client";
import styles from "./homepage-live-demo.module.css";

export type HomepageLiveDemoClientProps = Readonly<{
  turnstileSiteKey: string;
}>;

const BOOTSTRAP_API_PATH = "/api/homepage-demo/bootstrap";
const EXTRACT_API_PATH = "/api/homepage-demo/extract";
const REVIEW_PAGE_PATH = "/homepage-demo/review";
const REVIEW_WINDOW_NAME = "text2task_homepage_demo_review";
const DESKTOP_REVIEW_MEDIA_QUERY =
  "(min-width: 900px) and (hover: hover) and (pointer: fine)";
const PUBLIC_RESPONSE_MAX_BYTES = 16 * 1024;
const TEXT_INPUT_MAX_CHARACTERS = 8000;
const TEXT_INPUT_MAX_UTF8_BYTES = TEXT_INPUT_MAX_CHARACTERS * 4;
const DISALLOWED_CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

type LiveDemoStep = "bootstrapping" | "verifying_challenge" | "extracting" | "opening_review";

type LiveDemoState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "working"; step: LiveDemoStep }>
  | Readonly<{ status: "error"; code: LiveDemoErrorCode }>;

type LiveDemoErrorCode =
  | "challenge_failed"
  | "expired"
  | "invalid_request"
  | "invalid_text_input"
  | "not_found"
  | "processing_conflict"
  | "processing_failed"
  | "processing_cleanup_unavailable"
  | "rate_limited"
  | "request_conflict"
  | "request_too_large"
  | "temporarily_unavailable"
  | "trial_already_used"
  | "trial_unavailable";

type ValidatedTextResult =
  | Readonly<{ ok: true; text: string }>
  | Readonly<{ ok: false; code: Extract<LiveDemoErrorCode, "invalid_text_input" | "request_too_large"> }>;

type BootstrapTokens = Readonly<{
  idempotencyToken: string;
  publicToken: string;
  text: string;
}>;

type ReviewTarget =
  | Readonly<{ kind: "current" }>
  | Readonly<{ kind: "prepared"; windowRef: Window }>;

class HomepageLiveDemoFlowError extends Error {
  readonly code: LiveDemoErrorCode;

  constructor(code: LiveDemoErrorCode) {
    super("Homepage Demo live demo flow failed.");
    this.name = "HomepageLiveDemoFlowError";
    this.code = code;
  }
}

class StaleHomepageLiveDemoRunError extends Error {
  constructor() {
    super("Homepage Demo live demo run is no longer active.");
    this.name = "StaleHomepageLiveDemoRunError";
  }
}

const textEncoder = new TextEncoder();

export default function HomepageLiveDemoClient({
  turnstileSiteKey,
}: HomepageLiveDemoClientProps) {
  const textAreaId = useId();
  const helpTextId = useId();
  const countTextId = useId();
  const statusTextId = useId();
  const [text, setText] = useState("");
  const [state, setState] = useState<LiveDemoState>({ status: "idle" });
  const activeControllerRef = useRef<AbortController | null>(null);
  const adapterPromiseRef = useRef<Promise<HomepageDemoTurnstileAdapter> | null>(
    null
  );
  const adapterRef = useRef<HomepageDemoTurnstileAdapter | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const bootstrapTokensRef = useRef<BootstrapTokens | null>(null);
  const mountedRef = useRef(false);
  const runIdRef = useRef(0);
  const submissionActiveRef = useRef(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileExecutionConsumedRef = useRef(false);

  const isWorking = state.status === "working";
  const isTextError =
    state.status === "error" &&
    (state.code === "invalid_text_input" || state.code === "request_too_large");
  const characterCount = text.length;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      submissionActiveRef.current = false;
      abortActiveRequest(activeControllerRef);
      disposeTurnstileAdapter(adapterRef, adapterPromiseRef);
    };
  }, []);

  useEffect(() => {
    if (state.status !== "error") {
      return;
    }

    if (isTextError) {
      textAreaRef.current?.focus();
      return;
    }

    alertRef.current?.focus();
  }, [isTextError, state.status]);

  function handleTextChange(value: string): void {
    setText(value);
    bootstrapTokensRef.current = null;

    if (state.status === "error") {
      setState({ status: "idle" });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (submissionActiveRef.current) {
      return;
    }

    const validatedText = validateLiveDemoTextInput(text);

    if (!validatedText.ok) {
      setState({ status: "error", code: validatedText.code });
      return;
    }

    if (turnstileSiteKey.trim().length === 0) {
      setState({ status: "error", code: "temporarily_unavailable" });
      return;
    }

    const reviewTarget = prepareReviewTarget();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    submissionActiveRef.current = true;
    setState({ status: "working", step: "bootstrapping" });

    try {
      const bootstrap = await getBootstrapTokens(validatedText.text, runId);
      assertActiveRun(runId, mountedRef, runIdRef);
      setState({ status: "working", step: "verifying_challenge" });

      const challengeToken = await executeTurnstileChallenge(runId);
      assertActiveRun(runId, mountedRef, runIdRef);
      setState({ status: "working", step: "extracting" });

      await requestExtract({
        challengeToken,
        idempotencyToken: bootstrap.idempotencyToken,
        publicToken: bootstrap.publicToken,
        runId,
        text: validatedText.text,
      });

      assertActiveRun(runId, mountedRef, runIdRef);
      setState({ status: "working", step: "opening_review" });
      navigateToReview(reviewTarget, bootstrap.publicToken);
    } catch (error) {
      if (isIgnorableRunError(error)) {
        return;
      }

      if (mountedRef.current && runIdRef.current === runId) {
        setState({ status: "error", code: toLiveDemoErrorCode(error) });
      }
    } finally {
      if (runIdRef.current === runId) {
        submissionActiveRef.current = false;
      }
    }
  }

  async function getBootstrapTokens(
    validatedText: string,
    runId: number
  ): Promise<BootstrapTokens> {
    const existingTokens = bootstrapTokensRef.current;

    if (existingTokens !== null && existingTokens.text === validatedText) {
      return existingTokens;
    }

    const bootstrap = await requestBootstrap(runId);

    if (
      !isHomepageDemoOpaqueToken(bootstrap.publicToken) ||
      !isHomepageDemoOpaqueToken(bootstrap.idempotencyToken)
    ) {
      throw new HomepageLiveDemoFlowError("temporarily_unavailable");
    }

    const tokens = {
      idempotencyToken: bootstrap.idempotencyToken,
      publicToken: bootstrap.publicToken,
      text: validatedText,
    } satisfies BootstrapTokens;

    bootstrapTokensRef.current = tokens;

    return tokens;
  }

  async function requestBootstrap(runId: number) {
    const response = await fetchJson(BOOTSTRAP_API_PATH, "{}", runId);
    const value = response.value;

    if (response.status !== 200) {
      const parsedError = parseHomepageDemoExtractClientResponse(value);
      throw new HomepageLiveDemoFlowError(
        mapPublicResponseCode(parsedError.code)
      );
    }

    return parseHomepageDemoBootstrapClientResponse(value);
  }

  async function requestExtract({
    challengeToken,
    idempotencyToken,
    publicToken,
    runId,
    text: requestText,
  }: Readonly<{
    challengeToken: string;
    idempotencyToken: string;
    publicToken: string;
    runId: number;
    text: string;
  }>): Promise<void> {
    const response = await fetchJson(
      EXTRACT_API_PATH,
      JSON.stringify({
        text: requestText,
        challengeToken,
        publicToken,
        idempotencyToken,
      }),
      runId
    );
    const parsed = parseHomepageDemoExtractClientResponse(response.value);

    if (response.status === 200 && parsed.code === "review_ready") {
      return;
    }

    throw new HomepageLiveDemoFlowError(mapPublicResponseCode(parsed.code));
  }

  async function fetchJson(
    path: string,
    body: string,
    runId: number
  ): Promise<Readonly<{ status: number; value: unknown }>> {
    assertActiveRun(runId, mountedRef, runIdRef);
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      assertActiveRun(runId, mountedRef, runIdRef);

      if (response.redirected) {
        throw new HomepageLiveDemoFlowError("temporarily_unavailable");
      }

      const value = await readHomepageDemoClientJsonResponse(
        response,
        PUBLIC_RESPONSE_MAX_BYTES
      );

      assertActiveRun(runId, mountedRef, runIdRef);

      return {
        status: response.status,
        value,
      };
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  }

  async function executeTurnstileChallenge(runId: number): Promise<string> {
    assertActiveRun(runId, mountedRef, runIdRef);
    const adapter = await getTurnstileAdapter();
    assertActiveRun(runId, mountedRef, runIdRef);

    if (turnstileExecutionConsumedRef.current) {
      resetTurnstileAdapter(adapter);
      turnstileExecutionConsumedRef.current = false;
    }

    const execution = adapter.execute();
    turnstileExecutionConsumedRef.current = true;

    return await execution;
  }

  async function getTurnstileAdapter(): Promise<HomepageDemoTurnstileAdapter> {
    const existingAdapter = adapterRef.current;

    if (existingAdapter !== null) {
      return existingAdapter;
    }

    const existingPromise = adapterPromiseRef.current;

    if (existingPromise !== null) {
      return await existingPromise;
    }

    const container = turnstileContainerRef.current;

    if (container === null) {
      throw new HomepageLiveDemoFlowError("temporarily_unavailable");
    }

    const adapterPromise = createHomepageDemoTurnstileAdapter({
      siteKey: turnstileSiteKey,
      container,
    });

    adapterPromiseRef.current = adapterPromise;

    try {
      const adapter = await adapterPromise;

      if (!mountedRef.current) {
        adapter.dispose();
        throw new StaleHomepageLiveDemoRunError();
      }

      adapterRef.current = adapter;

      return adapter;
    } finally {
      if (adapterPromiseRef.current === adapterPromise) {
        adapterPromiseRef.current = null;
      }
    }
  }

  const statusCopy =
    state.status === "working" ? getWorkingCopy(state.step) : null;
  const errorCopy = state.status === "error" ? getErrorCopy(state.code) : null;

  return (
    <section
      className={styles.shell}
      aria-labelledby="homepage-live-demo-heading"
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <p className={styles.kicker}>Live preview</p>
          <h2 id="homepage-live-demo-heading" className={styles.title}>
            Turn a client message into an organized project
          </h2>
          <p className={styles.description}>
            Paste a short request. Text2Task opens a temporary review so you can
            see the tasks, deadline, budget, and client details it finds.
          </p>
          <p className={styles.trustLine}>
            Text only · Temporary review · Nothing is saved to your account
          </p>
        </div>

        <form className={styles.composer} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor={textAreaId}>
              Client message
            </label>
            <textarea
              ref={textAreaRef}
              id={textAreaId}
              className={styles.textarea}
              value={text}
              onChange={(event) => handleTextChange(event.target.value)}
              aria-describedby={`${helpTextId} ${countTextId}`}
              aria-invalid={isTextError}
              disabled={isWorking}
              maxLength={TEXT_INPUT_MAX_CHARACTERS}
              placeholder="Example: Build a homepage for a bookkeeping studio and send the first version by Friday."
              rows={7}
            />
            <div className={styles.fieldMeta}>
              <p id={helpTextId} className={styles.helpText}>
                Text only for now. Tabs and line breaks are fine.
              </p>
              <p
                id={countTextId}
                className={
                  characterCount > TEXT_INPUT_MAX_CHARACTERS
                    ? styles.countOverLimit
                    : styles.countText
                }
              >
                {characterCount}/{TEXT_INPUT_MAX_CHARACTERS}
              </p>
            </div>
          </div>

          <div ref={turnstileContainerRef} className={styles.challengeMount} />

          {statusCopy !== null ? (
            <div
              id={statusTextId}
              className={styles.status}
              role="status"
              aria-live="polite"
            >
              <p className={styles.statusTitle}>{statusCopy.title}</p>
              <p className={styles.statusText}>{statusCopy.body}</p>
            </div>
          ) : null}

          {errorCopy !== null ? (
            <div
              ref={alertRef}
              className={styles.error}
              role="alert"
              tabIndex={-1}
            >
              <p className={styles.errorTitle}>{errorCopy.title}</p>
              <p className={styles.errorText}>{errorCopy.body}</p>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isWorking}
            >
              {isWorking ? "Creating preview…" : "Preview my project"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function validateLiveDemoTextInput(value: string): ValidatedTextResult {
  if (DISALLOWED_CONTROL_CHARACTER_PATTERN.test(value)) {
    return { ok: false, code: "invalid_text_input" };
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { ok: false, code: "invalid_text_input" };
  }

  if (trimmedValue.length > TEXT_INPUT_MAX_CHARACTERS) {
    return { ok: false, code: "request_too_large" };
  }

  if (textEncoder.encode(trimmedValue).length > TEXT_INPUT_MAX_UTF8_BYTES) {
    return { ok: false, code: "request_too_large" };
  }

  return { ok: true, text: trimmedValue };
}

function prepareReviewTarget(): ReviewTarget {
  if (!isDesktopReviewHandoffCapable()) {
    return { kind: "current" };
  }

  try {
    const windowRef = window.open(REVIEW_PAGE_PATH, REVIEW_WINDOW_NAME);

    if (windowRef !== null) {
      return {
        kind: "prepared",
        windowRef,
      };
    }
  } catch {
    // Popup failures are expected in some browsers; current-tab navigation remains.
  }

  return { kind: "current" };
}

function isDesktopReviewHandoffCapable(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(DESKTOP_REVIEW_MEDIA_QUERY).matches
  );
}

function navigateToReview(target: ReviewTarget, publicToken: string): void {
  const reviewUrl = `${REVIEW_PAGE_PATH}#${publicToken}`;

  if (target.kind === "prepared") {
    try {
      if (!target.windowRef.closed) {
        target.windowRef.location.replace(reviewUrl);
        target.windowRef.focus();
        return;
      }
    } catch {
      // If the prepared same-origin tab is unavailable, fall through safely.
    }
  }

  window.location.assign(reviewUrl);
}

function assertActiveRun(
  runId: number,
  mountedRef: Readonly<{ current: boolean }>,
  runIdRef: Readonly<{ current: number }>
): void {
  if (!mountedRef.current || runIdRef.current !== runId) {
    throw new StaleHomepageLiveDemoRunError();
  }
}

function abortActiveRequest(
  activeControllerRef: MutableRefObject<AbortController | null>
): void {
  activeControllerRef.current?.abort();
  activeControllerRef.current = null;
}

function disposeTurnstileAdapter(
  adapterRef: MutableRefObject<HomepageDemoTurnstileAdapter | null>,
  adapterPromiseRef: MutableRefObject<Promise<HomepageDemoTurnstileAdapter> | null>
): void {
  adapterRef.current?.dispose();
  adapterRef.current = null;
  adapterPromiseRef.current = null;
}

function resetTurnstileAdapter(adapter: HomepageDemoTurnstileAdapter): void {
  try {
    adapter.reset();
  } catch {
    throw new HomepageLiveDemoFlowError("temporarily_unavailable");
  }
}

function isIgnorableRunError(error: unknown): boolean {
  return error instanceof StaleHomepageLiveDemoRunError || isAbortError(error);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === "AbortError"
  );
}

function toLiveDemoErrorCode(error: unknown): LiveDemoErrorCode {
  if (error instanceof HomepageLiveDemoFlowError) {
    return error.code;
  }

  if (error instanceof HomepageDemoTurnstileClientError) {
    switch (error.code) {
      case "challenge_error":
      case "challenge_expired":
      case "challenge_timeout":
      case "execution_failed":
      case "execution_in_progress":
      case "execution_reset":
      case "not_initialized":
        return "challenge_failed";

      case "container_unavailable":
      case "disposed":
      case "render_failed":
      case "script_load_failed":
      case "script_load_timeout":
      case "site_key_missing":
        return "temporarily_unavailable";
    }
  }

  return "temporarily_unavailable";
}

function mapPublicResponseCode(
  code: HomepageDemoExtractPublicResponseCode
): LiveDemoErrorCode {
  switch (code) {
    case "challenge_failed":
    case "invalid_challenge_input":
      return "challenge_failed";

    case "expired":
      return "expired";

    case "invalid_request":
    case "invalid_request_body":
    case "invalid_request_content_type":
    case "invalid_request_origin":
    case "unsupported_request_encoding":
      return "invalid_request";

    case "invalid_text_input":
      return "invalid_text_input";

    case "not_found":
      return "not_found";

    case "processing_conflict":
      return "processing_conflict";

    case "processing_failed":
      return "processing_failed";

    case "processing_cleanup_unavailable":
      return "processing_cleanup_unavailable";

    case "rate_limited":
      return "rate_limited";

    case "request_body_too_large":
    case "request_too_large":
      return "request_too_large";

    case "request_conflict":
      return "request_conflict";

    case "trial_already_used":
      return "trial_already_used";

    case "trial_unavailable":
      return "trial_unavailable";

    case "review_ready":
    case "temporarily_unavailable":
    case "timeout":
    case "extraction_failed":
      return "temporarily_unavailable";
  }
}

function getWorkingCopy(step: LiveDemoStep): Readonly<{
  body: string;
  title: string;
}> {
  switch (step) {
    case "bootstrapping":
      return {
        title: "Preparing a private preview",
        body: "This usually takes a moment.",
      };
    case "verifying_challenge":
      return {
        title: "Checking the browser challenge",
        body: "Keep this tab open while the request is verified.",
      };
    case "extracting":
      return {
        title: "Creating your project preview",
        body: "The review page will open when it is ready.",
      };
    case "opening_review":
      return {
        title: "Opening the review",
        body: "Your temporary preview is ready.",
      };
  }
}

function getErrorCopy(code: LiveDemoErrorCode): Readonly<{
  body: string;
  title: string;
}> {
  switch (code) {
    case "invalid_text_input":
      return {
        title: "Add a valid request",
        body: "Use plain text with at least one visible character.",
      };
    case "request_too_large":
      return {
        title: "Shorten the request",
        body: "Keep the request under 8,000 characters.",
      };
    case "challenge_failed":
      return {
        title: "Challenge verification failed",
        body: "Please try again to confirm this browser session.",
      };
    case "rate_limited":
      return {
        title: "Too many attempts",
        body: "Please wait a bit before trying the live demo again.",
      };
    case "expired":
      return {
        title: "This demo session expired",
        body: "Refresh the page and start a new demo request.",
      };
    case "trial_already_used":
      return {
        title: "This demo was already used",
        body: "For privacy, each browser session can open one temporary review.",
      };
    case "not_found":
    case "trial_unavailable":
      return {
        title: "The live demo is unavailable",
        body: "Please try again later.",
      };
    case "invalid_request":
      return {
        title: "The request could not be accepted",
        body: "Refresh the page and try again.",
      };
    case "processing_conflict":
    case "request_conflict":
      return {
        title: "That request is already being handled",
        body: "Please wait a moment, then try again.",
      };
    case "processing_failed":
    case "processing_cleanup_unavailable":
    case "temporarily_unavailable":
      return {
        title: "The demo is temporarily unavailable",
        body: "Please try again in a moment.",
      };
  }
}
