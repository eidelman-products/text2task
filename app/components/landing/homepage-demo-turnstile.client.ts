"use client";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const HOMEPAGE_DEMO_TURNSTILE_ACTION = "homepage_demo_extract";
const DEFAULT_SCRIPT_LOAD_TIMEOUT_MS = 10_000;
const DEFAULT_EXECUTION_TIMEOUT_MS = 120_000;

export type HomepageDemoTurnstileClientErrorCode =
  | "challenge_error"
  | "challenge_expired"
  | "challenge_timeout"
  | "container_unavailable"
  | "disposed"
  | "execution_failed"
  | "execution_in_progress"
  | "execution_reset"
  | "not_initialized"
  | "render_failed"
  | "script_load_failed"
  | "script_load_timeout"
  | "site_key_missing";

export class HomepageDemoTurnstileClientError extends Error {
  readonly code: HomepageDemoTurnstileClientErrorCode;

  constructor(code: HomepageDemoTurnstileClientErrorCode) {
    super("Homepage Demo challenge is unavailable.");
    this.name = "HomepageDemoTurnstileClientError";
    this.code = code;
  }
}

export type HomepageDemoTurnstileAdapter = Readonly<{
  execute: () => Promise<string>;
  reset: () => void;
  dispose: () => void;
}>;

export type CreateHomepageDemoTurnstileAdapterInput = Readonly<{
  siteKey: string;
  container: HTMLElement;
  scriptLoadTimeoutMs?: number;
  executionTimeoutMs?: number;
}>;

type TurnstileWidgetId = string;

type TurnstileRenderOptions = Readonly<{
  sitekey: string;
  action: typeof HOMEPAGE_DEMO_TURNSTILE_ACTION;
  execution: "execute";
  appearance: "interaction-only";
  "response-field": false;
  retry: "never";
  "refresh-expired": "never";
  "refresh-timeout": "never";
  callback: (token: string) => void;
  "error-callback": (_errorCode?: unknown) => true;
  "expired-callback": () => void;
  "timeout-callback": () => void;
}>;

type TurnstileApi = Readonly<{
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => TurnstileWidgetId;
  execute: (widgetId: TurnstileWidgetId) => void;
  getResponse?: (widgetId: TurnstileWidgetId) => string;
  isExpired?: (widgetId: TurnstileWidgetId) => boolean;
  reset: (widgetId: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
}>;

type InitializationState = "uninitialized" | "initializing" | "ready" | "disposed";

type WidgetGenerationStatus =
  | "rendering"
  | "ready"
  | "executing"
  | "terminal"
  | "removed";

type WidgetGenerationContext = {
  readonly generationId: number;
  callbackDuringRender: boolean;
  currentExecutionId: number | null;
  executionConsumed: boolean;
  pendingExecution: PendingExecution | null;
  renderFailure: HomepageDemoTurnstileClientErrorCode | null;
  status: WidgetGenerationStatus;
  widgetId: TurnstileWidgetId | null;
};

type PendingExecution = {
  readonly executionId: number;
  readonly generationId: number;
  resolve: (token: string) => void;
  reject: (error: HomepageDemoTurnstileClientError) => void;
  armed: boolean;
  settled: boolean;
  timeoutId: ReturnType<typeof globalThis.setTimeout> | null;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let sharedScriptPromise: Promise<TurnstileApi> | null = null;

export async function createHomepageDemoTurnstileAdapter({
  siteKey,
  container,
  scriptLoadTimeoutMs = DEFAULT_SCRIPT_LOAD_TIMEOUT_MS,
  executionTimeoutMs = DEFAULT_EXECUTION_TIMEOUT_MS,
}: CreateHomepageDemoTurnstileAdapterInput): Promise<HomepageDemoTurnstileAdapter> {
  return BrowserHomepageDemoTurnstileAdapter.create({
    siteKey,
    container,
    scriptLoadTimeoutMs,
    executionTimeoutMs,
  });
}

class BrowserHomepageDemoTurnstileAdapter implements HomepageDemoTurnstileAdapter {
  private activeContext: WidgetGenerationContext | null = null;
  private api: TurnstileApi | null = null;
  private readonly container: HTMLElement;
  private disposed = false;
  private readonly executionTimeoutMs: number;
  private initializationPromise: Promise<void> | null = null;
  private initializationState: InitializationState = "uninitialized";
  private nextExecutionId = 1;
  private nextGenerationId = 1;
  private readonly siteKey: string;

  static async create({
    siteKey,
    container,
    scriptLoadTimeoutMs,
    executionTimeoutMs,
  }: Readonly<{
    siteKey: string;
    container: HTMLElement;
    scriptLoadTimeoutMs: number;
    executionTimeoutMs: number;
  }>): Promise<HomepageDemoTurnstileAdapter> {
    const adapter = new BrowserHomepageDemoTurnstileAdapter({
      siteKey,
      container,
      executionTimeoutMs,
    });

    await adapter.#initialize(scriptLoadTimeoutMs);

    return adapter;
  }

  constructor({
    siteKey,
    container,
    executionTimeoutMs,
  }: Readonly<{
    siteKey: string;
    container: HTMLElement;
    executionTimeoutMs: number;
  }>) {
    this.siteKey = normalizeSiteKey(siteKey);
    this.container = validateConnectedHTMLElement(container);
    this.executionTimeoutMs = validatePositiveTimeout(
      executionTimeoutMs,
      DEFAULT_EXECUTION_TIMEOUT_MS
    );
  }

  async #initialize(scriptLoadTimeoutMs: number): Promise<void> {
    if (this.disposed) {
      throw new HomepageDemoTurnstileClientError("disposed");
    }

    if (this.initializationState === "ready") {
      return;
    }

    if (this.initializationState === "initializing") {
      const initializationPromise = this.initializationPromise;

      if (initializationPromise !== null) {
        await initializationPromise;
      }

      return;
    }

    const initializePromise = this.#initializeOnce(scriptLoadTimeoutMs);

    this.initializationState = "initializing";
    this.initializationPromise = initializePromise;

    try {
      await initializePromise;
    } finally {
      if (this.initializationPromise === initializePromise) {
        this.initializationPromise = null;
      }
    }
  }

  execute(): Promise<string> {
    if (this.disposed) {
      return Promise.reject(new HomepageDemoTurnstileClientError("disposed"));
    }

    const context = this.activeContext;

    if (
      context === null ||
      this.activeContext !== context ||
      this.api === null ||
      !isValidWidgetId(context.widgetId)
    ) {
      return Promise.reject(new HomepageDemoTurnstileClientError("not_initialized"));
    }

    if (context.pendingExecution !== null) {
      return Promise.reject(
        new HomepageDemoTurnstileClientError("execution_in_progress")
      );
    }

    if (context.executionConsumed) {
      return Promise.reject(new HomepageDemoTurnstileClientError("execution_failed"));
    }

    if (!this.#isReadyContext(context)) {
      return Promise.reject(new HomepageDemoTurnstileClientError("not_initialized"));
    }

    const api = this.api;
    const widgetId = context.widgetId;

    return new Promise<string>((resolve, reject) => {
      const pendingExecution = this.#createPendingExecution(
        context,
        resolve,
        reject
      );

      context.status = "executing";
      context.executionConsumed = true;

      try {
        api.execute(widgetId);
      } catch {
        this.#rejectExactPendingExecution(
          context,
          pendingExecution,
          "execution_failed"
        );
      }
    });
  }

  reset(): void {
    if (this.disposed) {
      return;
    }

    this.#retireActiveContext("execution_reset");

    if (this.disposed || this.api === null) {
      return;
    }

    this.initializationState = "uninitialized";
    this.#renderFreshWidget(this.api);
    this.initializationState = "ready";
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.initializationState = "disposed";
    this.initializationPromise = null;
    this.#retireActiveContext("disposed");

    this.api = null;
  }

  async #initializeOnce(scriptLoadTimeoutMs: number): Promise<void> {
    try {
      validateConnectedHTMLElement(this.container);

      const api = await loadTurnstileApi(
        validatePositiveTimeout(scriptLoadTimeoutMs, DEFAULT_SCRIPT_LOAD_TIMEOUT_MS)
      );

      if (this.disposed) {
        throw new HomepageDemoTurnstileClientError("disposed");
      }

      validateConnectedHTMLElement(this.container);

      this.api = api;
      this.#renderFreshWidget(api);

      if (this.disposed) {
        this.#retireActiveContext("disposed");
        throw new HomepageDemoTurnstileClientError("disposed");
      }

      this.initializationState = "ready";
    } catch (error) {
      if (this.disposed) {
        this.initializationState = "disposed";
      } else if (this.activeContext === null) {
        this.api = null;
        this.initializationState = "uninitialized";
      }

      if (error instanceof HomepageDemoTurnstileClientError) {
        throw error;
      }

      throw new HomepageDemoTurnstileClientError("render_failed");
    }
  }

  #renderFreshWidget(api: TurnstileApi): void {
    if (this.disposed) {
      throw new HomepageDemoTurnstileClientError("disposed");
    }

    if (this.activeContext !== null) {
      throw new HomepageDemoTurnstileClientError("render_failed");
    }

    validateConnectedHTMLElement(this.container);

    const context = this.#createWidgetGenerationContext();

    this.activeContext = context;

    let widgetId: TurnstileWidgetId;

    try {
      widgetId = api.render(this.container, {
        sitekey: this.siteKey,
        action: HOMEPAGE_DEMO_TURNSTILE_ACTION,
        execution: "execute",
        appearance: "interaction-only",
        "response-field": false,
        retry: "never",
        "refresh-expired": "never",
        "refresh-timeout": "never",
        callback: (token) => this.#handleSuccess(context, token),
        "error-callback": (_errorCode?: unknown) => {
          void _errorCode;
          return this.#handleError(context);
        },
        "expired-callback": () => this.#handleExpiry(context),
        "timeout-callback": () => this.#handleTimeout(context),
      });
    } catch {
      this.#clearActiveContext(context);
      context.status = "removed";
      throw new HomepageDemoTurnstileClientError("render_failed");
    }

    if (!isValidWidgetId(widgetId)) {
      this.#clearActiveContext(context);
      context.status = "removed";
      throw new HomepageDemoTurnstileClientError("render_failed");
    }

    context.widgetId = widgetId;

    if (context.renderFailure !== null) {
      this.#removeContextWidget(context);
      throw new HomepageDemoTurnstileClientError(context.renderFailure);
    }

    context.status = "ready";
  }

  #handleSuccess(context: WidgetGenerationContext, token: string): void {
    if (this.#recordRenderCallbackFailure(context)) {
      return;
    }

    const pendingExecution = this.#getExactPendingExecution(context);

    if (pendingExecution === null) {
      this.#markCallbackOnlyTerminal(context);
      return;
    }

    if (typeof token !== "string" || token.length === 0 || token.trim() !== token) {
      this.#rejectExactPendingExecution(
        context,
        pendingExecution,
        "execution_failed"
      );
      return;
    }

    if (!this.#isCurrentWidgetResponse(context, token)) {
      return;
    }

    this.#resolveExactPendingExecution(context, pendingExecution, token);
  }

  #handleError(context: WidgetGenerationContext): true {
    if (this.#recordRenderCallbackFailure(context)) {
      return true;
    }

    const pendingExecution = this.#getExactPendingExecution(context);

    if (pendingExecution !== null) {
      this.#rejectExactPendingExecution(
        context,
        pendingExecution,
        "challenge_error"
      );
    } else {
      this.#markCallbackOnlyTerminal(context);
    }

    return true;
  }

  #handleExpiry(context: WidgetGenerationContext): void {
    if (this.#recordRenderCallbackFailure(context)) {
      return;
    }

    const pendingExecution = this.#getExactPendingExecution(context);

    if (!this.#isCurrentWidgetExpired(context)) {
      return;
    }

    if (pendingExecution === null) {
      this.#markCallbackOnlyTerminal(context);
      return;
    }

    this.#rejectExactPendingExecution(
      context,
      pendingExecution,
      "challenge_expired"
    );
  }

  #handleTimeout(context: WidgetGenerationContext): void {
    if (this.#recordRenderCallbackFailure(context)) {
      return;
    }

    const pendingExecution = this.#getExactPendingExecution(context);

    if (pendingExecution === null) {
      this.#markCallbackOnlyTerminal(context);
      return;
    }

    this.#rejectExactPendingExecution(
      context,
      pendingExecution,
      "challenge_timeout"
    );
  }

  #createWidgetGenerationContext(): WidgetGenerationContext {
    return {
      callbackDuringRender: false,
      currentExecutionId: null,
      executionConsumed: false,
      generationId: this.#allocateGenerationId(),
      pendingExecution: null,
      renderFailure: null,
      status: "rendering",
      widgetId: null,
    };
  }

  #createPendingExecution(
    context: WidgetGenerationContext,
    resolve: (token: string) => void,
    reject: (error: HomepageDemoTurnstileClientError) => void
  ): PendingExecution {
    const pendingExecution: PendingExecution = {
      executionId: this.#allocateExecutionId(),
      generationId: context.generationId,
      reject,
      resolve,
      settled: false,
      timeoutId: null,
      armed: false,
    };

    pendingExecution.timeoutId = globalThis.setTimeout(() => {
      this.#rejectExactPendingExecution(
        context,
        pendingExecution,
        "challenge_timeout"
      );
    }, this.executionTimeoutMs);
    pendingExecution.armed = true;
    context.currentExecutionId = pendingExecution.executionId;
    context.pendingExecution = pendingExecution;

    return pendingExecution;
  }

  #getExactPendingExecution(
    context: WidgetGenerationContext
  ): PendingExecution | null {
    const pendingExecution = context.pendingExecution;

    if (pendingExecution === null) {
      return null;
    }

    return this.#isCurrentPendingExecution(context, pendingExecution)
      ? pendingExecution
      : null;
  }

  #isCurrentPendingExecution(
    context: WidgetGenerationContext,
    pendingExecution: PendingExecution
  ): boolean {
    return (
      !this.disposed &&
      this.activeContext === context &&
      context.generationId === pendingExecution.generationId &&
      context.status === "executing" &&
      context.currentExecutionId === pendingExecution.executionId &&
      context.pendingExecution === pendingExecution &&
      context.widgetId !== null &&
      pendingExecution.generationId === context.generationId &&
      !pendingExecution.settled &&
      pendingExecution.armed
    );
  }

  #resolveExactPendingExecution(
    context: WidgetGenerationContext,
    pendingExecution: PendingExecution,
    token: string
  ): void {
    if (!this.#isCurrentPendingExecution(context, pendingExecution)) {
      return;
    }

    const resolve = pendingExecution.resolve;

    this.#markContextTerminal(context, pendingExecution);
    resolve(token);
  }

  #rejectExactPendingExecution(
    context: WidgetGenerationContext,
    pendingExecution: PendingExecution,
    code: HomepageDemoTurnstileClientErrorCode
  ): void {
    if (!this.#isCurrentPendingExecution(context, pendingExecution)) {
      return;
    }

    const reject = pendingExecution.reject;

    this.#markContextTerminal(context, pendingExecution);
    reject(new HomepageDemoTurnstileClientError(code));
  }

  #rejectOwnedPendingExecution(
    context: WidgetGenerationContext,
    pendingExecution: PendingExecution,
    code: HomepageDemoTurnstileClientErrorCode
  ): void {
    if (context.pendingExecution !== pendingExecution || pendingExecution.settled) {
      return;
    }

    const reject = pendingExecution.reject;

    this.#clearPendingExecution(context, pendingExecution);
    reject(new HomepageDemoTurnstileClientError(code));
  }

  #clearPendingExecution(
    context: WidgetGenerationContext,
    pendingExecution: PendingExecution
  ): void {
    pendingExecution.settled = true;
    pendingExecution.armed = false;

    if (pendingExecution.timeoutId !== null) {
      globalThis.clearTimeout(pendingExecution.timeoutId);
      pendingExecution.timeoutId = null;
    }

    pendingExecution.resolve = noopResolve;
    pendingExecution.reject = noopReject;

    if (context.pendingExecution === pendingExecution) {
      context.pendingExecution = null;
      context.currentExecutionId = null;
    }
  }

  #markContextTerminal(
    context: WidgetGenerationContext,
    pendingExecution: PendingExecution
  ): void {
    context.executionConsumed = true;
    context.status = "terminal";
    this.#clearPendingExecution(context, pendingExecution);
  }

  #markCallbackOnlyTerminal(context: WidgetGenerationContext): void {
    if (
      this.disposed ||
      this.activeContext !== context ||
      context.status === "removed" ||
      context.status === "rendering"
    ) {
      return;
    }

    context.executionConsumed = true;
    context.status = "terminal";
  }

  #recordRenderCallbackFailure(context: WidgetGenerationContext): boolean {
    if (this.activeContext !== context || context.status !== "rendering") {
      return false;
    }

    context.callbackDuringRender = true;
    context.executionConsumed = true;
    context.renderFailure = "render_failed";

    return true;
  }

  #isCurrentWidgetResponse(
    context: WidgetGenerationContext,
    token: string
  ): boolean {
    if (
      this.api === null ||
      context.widgetId === null ||
      typeof this.api.getResponse !== "function"
    ) {
      return true;
    }

    try {
      return this.api.getResponse(context.widgetId) === token;
    } catch {
      return false;
    }
  }

  #isCurrentWidgetExpired(context: WidgetGenerationContext): boolean {
    if (
      this.api === null ||
      context.widgetId === null ||
      typeof this.api.isExpired !== "function"
    ) {
      return true;
    }

    try {
      return this.api.isExpired(context.widgetId);
    } catch {
      return false;
    }
  }

  #isReadyContext(
    context: WidgetGenerationContext | null
  ): context is WidgetGenerationContext & { widgetId: TurnstileWidgetId } {
    return (
      context !== null &&
      !this.disposed &&
      this.activeContext === context &&
      this.initializationState === "ready" &&
      context.status === "ready" &&
      !context.executionConsumed &&
      context.pendingExecution === null &&
      isValidWidgetId(context.widgetId)
    );
  }

  #retireActiveContext(code: HomepageDemoTurnstileClientErrorCode): void {
    const context = this.activeContext;

    if (context === null) {
      return;
    }

    this.#retireContext(context, code);
  }

  #retireContext(
    context: WidgetGenerationContext,
    code: HomepageDemoTurnstileClientErrorCode
  ): void {
    const widgetId = context.widgetId;
    const pendingExecution = context.pendingExecution;

    context.executionConsumed = true;
    context.status = "removed";
    context.widgetId = null;

    if (this.activeContext === context) {
      this.activeContext = null;
    }

    if (pendingExecution !== null) {
      pendingExecution.armed = false;
      this.#rejectOwnedPendingExecution(context, pendingExecution, code);
    }

    if (this.api !== null && widgetId !== null) {
      try {
        this.api.remove(widgetId);
      } catch {
        // Best-effort widget cleanup only; callers receive sanitized errors.
      }
    }
  }

  #removeContextWidget(context: WidgetGenerationContext): void {
    this.#retireContext(context, "render_failed");
  }

  #clearActiveContext(context: WidgetGenerationContext): void {
    if (this.activeContext === context) {
      this.activeContext = null;
    }
  }

  #allocateExecutionId(): number {
    if (!Number.isSafeInteger(this.nextExecutionId)) {
      throw new HomepageDemoTurnstileClientError("execution_failed");
    }

    const executionId = this.nextExecutionId;

    this.nextExecutionId += 1;

    return executionId;
  }

  #allocateGenerationId(): number {
    if (!Number.isSafeInteger(this.nextGenerationId)) {
      throw new HomepageDemoTurnstileClientError("render_failed");
    }

    const generationId = this.nextGenerationId;

    this.nextGenerationId += 1;

    return generationId;
  }
}

function loadTurnstileApi(timeoutMs: number): Promise<TurnstileApi> {
  const existingApi = getTurnstileApi();

  if (existingApi !== null) {
    return Promise.resolve(existingApi);
  }

  if (sharedScriptPromise !== null) {
    return sharedScriptPromise;
  }

  sharedScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      sharedScriptPromise = null;
      reject(new HomepageDemoTurnstileClientError("script_load_failed"));
      return;
    }

    const script = findExistingTurnstileScript() ?? document.createElement("script");
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    function cleanupListeners(): void {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function fail(code: HomepageDemoTurnstileClientErrorCode): void {
      cleanupListeners();

      const api = getTurnstileApi();

      if (api !== null) {
        resolve(api);
        return;
      }

      sharedScriptPromise = null;

      if (isMatchingTurnstileScript(script) && script.parentNode !== null) {
        script.parentNode.removeChild(script);
      }

      reject(new HomepageDemoTurnstileClientError(code));
    }

    function handleLoad(): void {
      const api = getTurnstileApi();

      if (api === null) {
        fail("script_load_failed");
        return;
      }

      cleanupListeners();
      resolve(api);
    }

    function handleError(): void {
      fail("script_load_failed");
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    timeoutId = globalThis.setTimeout(() => {
      fail("script_load_timeout");
    }, timeoutMs);

    if (!script.parentNode) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return sharedScriptPromise;
}

function getTurnstileApi(): TurnstileApi | null {
  if (typeof window === "undefined") {
    return null;
  }

  return isTurnstileApi(window.turnstile) ? window.turnstile : null;
}

function findExistingTurnstileScript(): HTMLScriptElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  for (const script of Array.from(document.scripts)) {
    if (isMatchingTurnstileScript(script)) {
      return script;
    }
  }

  return null;
}

function isMatchingTurnstileScript(script: HTMLScriptElement): boolean {
  return (
    script.getAttribute("src") === TURNSTILE_SCRIPT_URL ||
    script.src === TURNSTILE_SCRIPT_URL
  );
}

function isTurnstileApi(value: unknown): value is TurnstileApi {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as {
    execute?: unknown;
    getResponse?: unknown;
    isExpired?: unknown;
    remove?: unknown;
    render?: unknown;
    reset?: unknown;
  };

  return (
    typeof record.execute === "function" &&
    (record.getResponse === undefined ||
      typeof record.getResponse === "function") &&
    (record.isExpired === undefined || typeof record.isExpired === "function") &&
    typeof record.remove === "function" &&
    typeof record.render === "function" &&
    typeof record.reset === "function"
  );
}

function isValidWidgetId(value: unknown): value is TurnstileWidgetId {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeSiteKey(value: unknown): string {
  if (typeof value !== "string") {
    throw new HomepageDemoTurnstileClientError("site_key_missing");
  }

  const normalizedSiteKey = value.trim();

  if (!normalizedSiteKey) {
    throw new HomepageDemoTurnstileClientError("site_key_missing");
  }

  return normalizedSiteKey;
}

function validateConnectedHTMLElement(value: unknown): HTMLElement {
  if (
    typeof window === "undefined" ||
    typeof window.HTMLElement !== "function" ||
    !(value instanceof window.HTMLElement) ||
    !value.isConnected
  ) {
    throw new HomepageDemoTurnstileClientError("container_unavailable");
  }

  return value;
}

function validatePositiveTimeout(value: number, fallback: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function noopResolve(_token: string): void {
  void _token;
}

function noopReject(_error: HomepageDemoTurnstileClientError): void {
  void _error;
}
