"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { HOMEPAGE_DEMO_CLAIM_LOGIN_PATH } from "@/lib/auth/homepage-demo-auth-intent";
import { readHomepageDemoClientJsonResponse } from "@/lib/homepage-demo/client-response-reader";

const CLAIM_SAVE_ENDPOINT = "/api/homepage-demo/claim/save" as const;
const CLAIM_SAVE_ANYWAY_ENDPOINT =
  "/api/homepage-demo/claim/save-anyway" as const;
const DASHBOARD_DESTINATION = "/dashboard" as const;
const CLAIM_RESPONSE_MAX_BYTES = 16 * 1024;

type DuplicateNotice = "default" | "confirm_again" | "save_failed";
type FailedClaimOperation = "normal_save" | "save_anyway";

type ClaimContinuationState =
  | Readonly<{ status: "claiming" }>
  | Readonly<{
      status: "duplicate_detected";
      notice: DuplicateNotice;
    }>
  | Readonly<{ status: "saving_anyway" }>
  | Readonly<{ status: "expired" }>
  | Readonly<{ status: "claim_unavailable" }>
  | Readonly<{
      status: "temporarily_unavailable";
      failedOperation: FailedClaimOperation;
    }>;

type ClaimSaveResult =
  | "saved"
  | "already_claimed"
  | "duplicate_detected"
  | "expired"
  | "claim_unavailable"
  | "unauthorized"
  | "temporarily_unavailable";

type ClaimSaveAnywayResult =
  | "saved"
  | "already_claimed"
  | "duplicate_detected"
  | "duplicate_authority_unavailable"
  | "duplicate_authority_expired"
  | "expired"
  | "claim_unavailable"
  | "unauthorized"
  | "temporarily_unavailable";

type JsonRecord = Record<string, unknown>;
type DataPropertyDescriptor = PropertyDescriptor & Readonly<{ value: unknown }>;

export default function HomepageDemoClaimContinuationClient() {
  const [state, setState] = useState<ClaimContinuationState>({
    status: "claiming",
  });
  const hasStartedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const requestRunIdRef = useRef(0);
  const mountedRef = useRef(true);

  const beginRequest = useCallback(() => {
    if (requestInFlightRef.current) {
      return null;
    }

    requestInFlightRef.current = true;
    requestRunIdRef.current += 1;

    return requestRunIdRef.current;
  }, []);

  const isActiveRequest = useCallback((requestRunId: number) => {
    return mountedRef.current && requestRunIdRef.current === requestRunId;
  }, []);

  const finishRequest = useCallback((requestRunId: number) => {
    if (requestRunIdRef.current === requestRunId) {
      requestInFlightRef.current = false;
    }
  }, []);

  const goToDashboard = useCallback(() => {
    if (requestInFlightRef.current) {
      return;
    }

    window.location.replace(DASHBOARD_DESTINATION);
  }, []);

  const attemptClaimSave = useCallback(async () => {
    const requestRunId = beginRequest();

    if (requestRunId === null) {
      return;
    }

    setState({ status: "claiming" });

    try {
      const result = await requestClaimSave();

      if (!isActiveRequest(requestRunId)) {
        return;
      }

      switch (result) {
        case "saved":
        case "already_claimed":
          window.location.replace(DASHBOARD_DESTINATION);
          return;
        case "duplicate_detected":
          setState({ status: "duplicate_detected", notice: "default" });
          return;
        case "expired":
          setState({ status: "expired" });
          return;
        case "claim_unavailable":
          setState({ status: "claim_unavailable" });
          return;
        case "unauthorized":
          window.location.replace(HOMEPAGE_DEMO_CLAIM_LOGIN_PATH);
          return;
        case "temporarily_unavailable":
          setState({
            status: "temporarily_unavailable",
            failedOperation: "normal_save",
          });
          return;
      }
    } catch {
      if (isActiveRequest(requestRunId)) {
        setState({
          status: "temporarily_unavailable",
          failedOperation: "normal_save",
        });
      }
    } finally {
      finishRequest(requestRunId);
    }
  }, [beginRequest, finishRequest, isActiveRequest]);

  const attemptSaveAnyway = useCallback(async () => {
    const requestRunId = beginRequest();

    if (requestRunId === null) {
      return;
    }

    setState({ status: "saving_anyway" });

    try {
      const result = await requestClaimSaveAnyway();

      if (!isActiveRequest(requestRunId)) {
        return;
      }

      switch (result) {
        case "saved":
        case "already_claimed":
          window.location.replace(DASHBOARD_DESTINATION);
          return;
        case "duplicate_authority_unavailable":
        case "duplicate_authority_expired": {
          let refreshResult: ClaimSaveResult;

          try {
            refreshResult = await requestClaimSave();
          } catch {
            if (isActiveRequest(requestRunId)) {
              setState({
                status: "temporarily_unavailable",
                failedOperation: "normal_save",
              });
            }

            return;
          }

          if (!isActiveRequest(requestRunId)) {
            return;
          }

          switch (refreshResult) {
            case "saved":
            case "already_claimed":
              window.location.replace(DASHBOARD_DESTINATION);
              return;
            case "duplicate_detected":
              setState({
                status: "duplicate_detected",
                notice: "confirm_again",
              });
              return;
            case "expired":
              setState({ status: "expired" });
              return;
            case "claim_unavailable":
              setState({ status: "claim_unavailable" });
              return;
            case "unauthorized":
              window.location.replace(HOMEPAGE_DEMO_CLAIM_LOGIN_PATH);
              return;
            case "temporarily_unavailable":
              setState({
                status: "temporarily_unavailable",
                failedOperation: "normal_save",
              });
              return;
          }
        }
        case "duplicate_detected":
          setState({
            status: "duplicate_detected",
            notice: "confirm_again",
          });
          return;
        case "expired":
          setState({ status: "expired" });
          return;
        case "claim_unavailable":
          setState({ status: "claim_unavailable" });
          return;
        case "unauthorized":
          window.location.replace(HOMEPAGE_DEMO_CLAIM_LOGIN_PATH);
          return;
        case "temporarily_unavailable":
          setState({
            status: "temporarily_unavailable",
            failedOperation: "save_anyway",
          });
          return;
      }
    } catch {
      if (isActiveRequest(requestRunId)) {
        setState({
          status: "temporarily_unavailable",
          failedOperation: "save_anyway",
        });
      }
    } finally {
      finishRequest(requestRunId);
    }
  }, [beginRequest, finishRequest, isActiveRequest]);

  const returnToDuplicateConfirmation = useCallback(() => {
    if (requestInFlightRef.current) {
      return;
    }

    setState({ status: "duplicate_detected", notice: "save_failed" });
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestRunIdRef.current += 1;
      requestInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    void attemptClaimSave();
  }, [attemptClaimSave]);

  return (
    <section
      style={cardStyle}
      aria-labelledby="homepage-demo-claim-continuation-heading"
    >
      {renderState({
        state,
        onRetry: attemptClaimSave,
        onSaveAnyway: attemptSaveAnyway,
        onBackToConfirmation: returnToDuplicateConfirmation,
        onGoToDashboard: goToDashboard,
        retryDisabled:
          state.status === "claiming" || state.status === "saving_anyway",
      })}
    </section>
  );
}

function renderState({
  state,
  onRetry,
  onSaveAnyway,
  onBackToConfirmation,
  onGoToDashboard,
  retryDisabled,
}: {
  state: ClaimContinuationState;
  onRetry: () => void;
  onSaveAnyway: () => void;
  onBackToConfirmation: () => void;
  onGoToDashboard: () => void;
  retryDisabled: boolean;
}) {
  switch (state.status) {
    case "claiming":
      return (
        <div role="status" aria-live="polite" style={contentStyle}>
          <p style={kickerStyle}>Text2Task</p>
          <h1
            id="homepage-demo-claim-continuation-heading"
            style={titleStyle}
          >
            Saving your project...
          </h1>
          <p style={bodyStyle}>
            We are saving your prepared project to your workspace.
          </p>
        </div>
      );
    case "saving_anyway":
      return (
        <div role="status" aria-live="polite" style={contentStyle}>
          <p style={kickerStyle}>Text2Task</p>
          <h1
            id="homepage-demo-claim-continuation-heading"
            style={titleStyle}
          >
            Saving another copy...
          </h1>
          <p style={bodyStyle}>
            We are saving this prepared project to your workspace.
          </p>
        </div>
      );
    case "duplicate_detected":
      return (
        <div role="alert" style={contentStyle}>
          <p style={kickerStyle}>Review needed</p>
          <h1
            id="homepage-demo-claim-continuation-heading"
            style={titleStyle}
          >
            A similar project was found
          </h1>
          <p style={bodyStyle}>
            Text2Task found a potentially similar project in your account.
            You can return to your dashboard or save another copy.
          </p>
          {renderDuplicateNotice(state.notice)}
          <div style={actionsStyle}>
            <button
              type="button"
              onClick={onSaveAnyway}
              disabled={retryDisabled}
              style={primaryButtonStyle}
            >
              Save anyway
            </button>
            <button
              type="button"
              onClick={onGoToDashboard}
              disabled={retryDisabled}
              style={secondaryButtonStyle}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      );
    case "expired":
      return (
        <div role="alert" style={contentStyle}>
          <p style={kickerStyle}>Preview expired</p>
          <h1
            id="homepage-demo-claim-continuation-heading"
            style={titleStyle}
          >
            This project preview has expired.
          </h1>
          <p style={bodyStyle}>
            Return to the homepage to create a new preview.
          </p>
          <Link href="/" style={primaryLinkStyle}>
            Return to homepage
          </Link>
        </div>
      );
    case "claim_unavailable":
      return (
        <div role="alert" style={contentStyle}>
          <p style={kickerStyle}>Preview unavailable</p>
          <h1
            id="homepage-demo-claim-continuation-heading"
            style={titleStyle}
          >
            This project preview is no longer available.
          </h1>
          <p style={bodyStyle}>
            Return to the homepage to create a new preview.
          </p>
          <Link href="/" style={primaryLinkStyle}>
            Return to homepage
          </Link>
        </div>
      );
    case "temporarily_unavailable":
      if (state.failedOperation === "save_anyway") {
        return (
          <div role="alert" style={contentStyle}>
            <p style={kickerStyle}>Try again</p>
            <h1
              id="homepage-demo-claim-continuation-heading"
              style={titleStyle}
            >
              We couldn&apos;t save another copy right now.
            </h1>
            <p style={bodyStyle}>Please try again.</p>
            <button
              type="button"
              onClick={onBackToConfirmation}
              disabled={retryDisabled}
              style={primaryButtonStyle}
            >
              Back to confirmation
            </button>
          </div>
        );
      }

      return (
        <div role="alert" style={contentStyle}>
          <p style={kickerStyle}>Try again</p>
          <h1
            id="homepage-demo-claim-continuation-heading"
            style={titleStyle}
          >
            We couldn&apos;t save your project right now.
          </h1>
          <p style={bodyStyle}>Please try again.</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
            style={primaryButtonStyle}
          >
            Try again
          </button>
        </div>
      );
  }
}

async function requestClaimSave(): Promise<ClaimSaveResult> {
  const response = await fetch(CLAIM_SAVE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });

  return parseClaimSaveResponse(response);
}

async function requestClaimSaveAnyway(): Promise<ClaimSaveAnywayResult> {
  const response = await fetch(CLAIM_SAVE_ANYWAY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });

  return parseClaimSaveAnywayResponse(response);
}

async function parseClaimSaveResponse(
  response: Response
): Promise<ClaimSaveResult> {
  if (response.redirected) {
    return "temporarily_unavailable";
  }

  if (!hasJsonContentType(response.headers)) {
    return "temporarily_unavailable";
  }

  const body = await readHomepageDemoClientJsonResponse(
    response,
    CLAIM_RESPONSE_MAX_BYTES
  );

  if (!isJsonRecord(body)) {
    return "temporarily_unavailable";
  }

  if (response.status === 200) {
    return parseSuccessResponse(body);
  }

  if (response.status === 409) {
    return hasExactStringCode(body, "duplicate_detected")
      ? "duplicate_detected"
      : "temporarily_unavailable";
  }

  if (response.status === 410) {
    return hasExactStringCode(body, "expired")
      ? "expired"
      : "temporarily_unavailable";
  }

  if (response.status === 404) {
    return hasExactStringCode(body, "claim_unavailable")
      ? "claim_unavailable"
      : "temporarily_unavailable";
  }

  if (response.status === 401) {
    return hasExactStringCode(body, "unauthorized")
      ? "unauthorized"
      : "temporarily_unavailable";
  }

  if (response.status === 503) {
    return hasExactStringCode(body, "temporarily_unavailable")
      ? "temporarily_unavailable"
      : "temporarily_unavailable";
  }

  return "temporarily_unavailable";
}

async function parseClaimSaveAnywayResponse(
  response: Response
): Promise<ClaimSaveAnywayResult> {
  if (response.redirected) {
    return "temporarily_unavailable";
  }

  if (!hasJsonContentType(response.headers)) {
    return "temporarily_unavailable";
  }

  const body = await readHomepageDemoClientJsonResponse(
    response,
    CLAIM_RESPONSE_MAX_BYTES
  );

  if (!isJsonRecord(body)) {
    return "temporarily_unavailable";
  }

  if (response.status === 200) {
    return parseSuccessResponse(body);
  }

  if (response.status === 401) {
    return hasExactStringCode(body, "unauthorized")
      ? "unauthorized"
      : "temporarily_unavailable";
  }

  if (response.status === 404) {
    return hasExactStringCode(body, "claim_unavailable")
      ? "claim_unavailable"
      : "temporarily_unavailable";
  }

  if (response.status === 409) {
    if (hasExactStringCode(body, "duplicate_authority_unavailable")) {
      return "duplicate_authority_unavailable";
    }

    return hasExactStringCode(body, "duplicate_detected")
      ? "duplicate_detected"
      : "temporarily_unavailable";
  }

  if (response.status === 410) {
    if (hasExactStringCode(body, "duplicate_authority_expired")) {
      return "duplicate_authority_expired";
    }

    return hasExactStringCode(body, "expired")
      ? "expired"
      : "temporarily_unavailable";
  }

  if (response.status === 503) {
    return hasExactStringCode(body, "temporarily_unavailable")
      ? "temporarily_unavailable"
      : "temporarily_unavailable";
  }

  if (
    response.status === 400 ||
    response.status === 403 ||
    response.status === 413 ||
    response.status === 415
  ) {
    return hasExactStringCode(body, "invalid_request")
      ? "temporarily_unavailable"
      : "temporarily_unavailable";
  }

  return "temporarily_unavailable";
}

function hasJsonContentType(headers: Headers): boolean {
  const contentType = headers.get("content-type");

  if (contentType === null) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();

  return mediaType === "application/json";
}

function parseSuccessResponse(body: JsonRecord): ClaimSaveResult {
  const record = readExactPlainRecord(body, ["code", "destination", "created"]);

  if (
    record.code === "saved" &&
    record.destination === DASHBOARD_DESTINATION &&
    record.created === true
  ) {
    return "saved";
  }

  if (
    record.code === "already_claimed" &&
    record.destination === DASHBOARD_DESTINATION &&
    record.created === false
  ) {
    return "already_claimed";
  }

  return "temporarily_unavailable";
}

function hasExactStringCode(
  body: JsonRecord,
  code: ClaimSaveResult | ClaimSaveAnywayResult | "invalid_request"
): boolean {
  const record = readExactPlainRecord(body, ["code"]);

  return record.code === code;
}

function renderDuplicateNotice(notice: DuplicateNotice) {
  switch (notice) {
    case "default":
      return null;
    case "confirm_again":
      return (
        <p style={noticeStyle}>
          Please confirm again before saving another copy.
        </p>
      );
    case "save_failed":
      return (
        <p style={noticeStyle}>
          We couldn&apos;t save another copy. Please try again.
        </p>
      );
  }
}

function readExactPlainRecord(
  value: JsonRecord,
  expectedKeys: readonly string[]
): JsonRecord {
  let descriptors: PropertyDescriptorMap;

  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return {};
  }

  const propertyKeys = Reflect.ownKeys(descriptors);

  if (
    propertyKeys.length !== expectedKeys.length ||
    propertyKeys.some((propertyKey) => typeof propertyKey !== "string")
  ) {
    return {};
  }

  const record: JsonRecord = {};

  for (const key of expectedKeys) {
    const descriptor = descriptors[key];

    if (!isEnumerableDataDescriptor(descriptor)) {
      return {};
    }

    record[key] = descriptor.value;
  }

  return record;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined
): descriptor is DataPropertyDescriptor {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor &&
    descriptor.get === undefined &&
    descriptor.set === undefined
  );
}

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  borderRadius: 28,
  background: "rgba(255, 255, 255, 0.95)",
  border: "1px solid rgba(203, 213, 225, 0.82)",
  boxShadow: "0 28px 90px rgba(15, 23, 42, 0.13)",
  padding: "34px 30px",
};

const contentStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 14,
  textAlign: "center",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 10,
};

const kickerStyle: CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 850,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "clamp(28px, 5vw, 34px)",
  lineHeight: 1.08,
  letterSpacing: "-0.035em",
  fontWeight: 850,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.65,
};

const noticeStyle: CSSProperties = {
  margin: 0,
  color: "#1d4ed8",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.5,
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 48,
  border: "none",
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  padding: "0 18px",
  fontSize: 14,
  fontWeight: 850,
  cursor: "pointer",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.22)",
};

const primaryLinkStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  padding: "0 18px",
  fontSize: 14,
  fontWeight: 850,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.22)",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 18px",
  fontSize: 14,
  fontWeight: 850,
  cursor: "pointer",
};
