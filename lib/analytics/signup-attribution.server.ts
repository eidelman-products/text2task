import "server-only";

import { after } from "next/server";
import type { NextRequest } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
import {
  readRequestAttribution,
  toAnalyticsAttributionPayload,
} from "@/lib/analytics/request-attribution.server";

const SIGNUP_ATTRIBUTION_CAPTURED_EVENT = "signup_attribution_captured";
const SIGNUP_SUCCESS_EVENT = "signup_success";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const AUTH_FLOWS = new Set([
  "email_signup",
  "email_confirmation",
  "google_oauth",
] as const);

export type SignupAttributionAuthFlow =
  | "email_signup"
  | "email_confirmation"
  | "google_oauth";

type ScheduleSignupAttributionInput = {
  request: NextRequest;
  userId: string | null | undefined;
  authFlow: SignupAttributionAuthFlow;
};

type ScheduleEmailSignupAttributionCaptureInput = {
  request: NextRequest;
  userId: string | null | undefined;
  authFlow: "email_signup";
};

type ScheduleSignupAnalyticsEventInput = {
  request: NextRequest;
  userId: string | null | undefined;
  authFlow: SignupAttributionAuthFlow;
  eventName:
    | typeof SIGNUP_ATTRIBUTION_CAPTURED_EVENT
    | typeof SIGNUP_SUCCESS_EVENT;
};

function sanitizeUserId(userId: string | null | undefined) {
  const text = typeof userId === "string" ? userId.trim() : "";

  return UUID_PATTERN.test(text) ? text : null;
}

function isSignupAttributionAuthFlow(
  value: string
): value is SignupAttributionAuthFlow {
  return AUTH_FLOWS.has(value as SignupAttributionAuthFlow);
}

function scheduleSignupAnalyticsEvent({
  request,
  userId,
  authFlow,
  eventName,
}: ScheduleSignupAnalyticsEventInput): void {
  try {
    const safeUserId = sanitizeUserId(userId);

    if (!safeUserId || !isSignupAttributionAuthFlow(authFlow)) {
      return;
    }

    const attribution = readRequestAttribution(request);

    if (!attribution) {
      return;
    }

    const analyticsAttribution = toAnalyticsAttributionPayload(attribution);
    const countryCode = attribution.countryCode;
    const idempotencyKey = `${eventName}:${safeUserId}`;

    after(async () => {
      await logAnalyticsEventSafe({
        eventName,
        userId: safeUserId,
        anonymousId: attribution.anonymousId,
        attribution: analyticsAttribution,
        pagePath: attribution.pagePath,
        countryCode,
        metadata: {
          auth_flow: authFlow,
        },
        idempotencyKey,
      });
    });
  } catch {
    // Signup attribution is optional and must never affect auth responses.
  }
}

export function scheduleEmailSignupAttributionCapture({
  request,
  userId,
  authFlow,
}: ScheduleEmailSignupAttributionCaptureInput): void {
  scheduleSignupAnalyticsEvent({
    request,
    userId,
    authFlow,
    eventName: SIGNUP_ATTRIBUTION_CAPTURED_EVENT,
  });
}

export function scheduleSignupAttribution({
  request,
  userId,
  authFlow,
}: ScheduleSignupAttributionInput): void {
  scheduleSignupAnalyticsEvent({
    request,
    userId,
    authFlow,
    eventName: SIGNUP_SUCCESS_EVENT,
  });
}
