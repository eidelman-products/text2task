import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_EVENT_NAMES = new Set([
  "page_view",
  "signup_attribution_captured",
  "signup_success",
  "email_confirmed",
  "login_success",
  "first_extract_created",
  "project_saved",
  "client_update_created",
  "client_update_applied",
  "homepage_demo_extract_attempt",
  "homepage_demo_extract_succeeded",
  "homepage_demo_extract_failed",
] as const);

const MAX_METADATA_BYTES = 2000;
const MAX_METADATA_DEPTH = 3;
const MAX_OBJECT_KEYS = 25;
const MAX_ARRAY_ITEMS = 20;
const ANALYTICS_INSERT_TIMEOUT_MS = 1250;

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|message|raw|screenshot|task_text|project_summary|resource|content|private|client_message)/i;

type AnalyticsEventName = typeof ALLOWED_EVENT_NAMES extends Set<infer T>
  ? T
  : never;

type AnalyticsAttribution = {
  anonymous_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
  page_path?: string | null;
};

type AnalyticsMetadata = Record<string, unknown>;
type InsertAttemptResult =
  | {
      status: "completed";
      error: PostgrestError | null;
    }
  | {
      status: "failed";
      error: unknown;
    };
type InsertTimeoutResult = {
  status: "timed_out";
};
type InsertAnalyticsEventResult = InsertAttemptResult | InsertTimeoutResult;

export type LogAnalyticsEventInput = {
  eventName: string;
  occurredAt?: string | Date | null;
  userId?: string | null;
  anonymousId?: string | null;
  attribution?: AnalyticsAttribution | null;
  pagePath?: string | null;
  countryCode?: string | null;
  metadata?: AnalyticsMetadata | null;
  idempotencyKey?: string | null;
};

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function isAllowedEventName(value: string): value is AnalyticsEventName {
  return ALLOWED_EVENT_NAMES.has(value as AnalyticsEventName);
}

function sanitizeUuid(value: unknown) {
  const text = clampText(value, 80);

  if (!text) {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text
  )
    ? text
    : null;
}

function sanitizeCountryCode(value: unknown) {
  const text = clampText(value, 12);

  if (!text) {
    return null;
  }

  const normalized = text.toUpperCase();

  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : null;
}

function sanitizeOccurredAt(value: string | Date | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "string" ? value.slice(0, 180) : value;
  }

  if (depth >= MAX_METADATA_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const cleanObject: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS
    );

    for (const [key, item] of entries) {
      const cleanKey = key.trim().slice(0, 80);

      if (!cleanKey || SENSITIVE_KEY_PATTERN.test(cleanKey)) {
        continue;
      }

      cleanObject[cleanKey] = sanitizeMetadataValue(item, depth + 1);
    }

    return cleanObject;
  }

  return null;
}

function sanitizeMetadata(metadata: AnalyticsMetadata | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const sanitized = sanitizeMetadataValue(metadata, 0);

  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return {};
  }

  const serialized = JSON.stringify(sanitized);

  if (serialized.length <= MAX_METADATA_BYTES) {
    return sanitized as AnalyticsMetadata;
  }

  return {
    truncated: true,
  };
}

function isDuplicateIdempotencyKeyError(
  error: { code?: string; message?: string } | null | undefined,
  idempotencyKey: string | null
) {
  return Boolean(idempotencyKey && error?.code === "23505");
}

async function insertAnalyticsEventWithTimeout(
  event: Record<string, unknown>
): Promise<InsertAnalyticsEventResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const insertPromise = (async (): Promise<InsertAttemptResult> => {
    try {
      const { error } = await supabaseAdmin
        .from("analytics_events")
        .insert(event);

      return {
        status: "completed",
        error,
      };
    } catch (error) {
      return {
        status: "failed",
        error,
      };
    }
  })();

  const timeoutPromise = new Promise<InsertTimeoutResult>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ status: "timed_out" }),
      ANALYTICS_INSERT_TIMEOUT_MS
    );
  });

  const result = await Promise.race([insertPromise, timeoutPromise]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
}

export async function logAnalyticsEventSafe(
  input: LogAnalyticsEventInput
): Promise<boolean> {
  try {
    if (!isAllowedEventName(input.eventName)) {
      return false;
    }

    const attribution = input.attribution ?? {};
    const anonymousId =
      clampText(input.anonymousId, 120) ??
      clampText(attribution.anonymous_id, 120);
    const idempotencyKey = clampText(input.idempotencyKey, 180);

    const result = await insertAnalyticsEventWithTimeout({
      event_name: input.eventName,
      occurred_at: sanitizeOccurredAt(input.occurredAt),
      user_id: sanitizeUuid(input.userId),
      anonymous_id: anonymousId,
      utm_source: clampText(attribution.utm_source, 120),
      utm_medium: clampText(attribution.utm_medium, 120),
      utm_campaign: clampText(attribution.utm_campaign, 160),
      utm_content: clampText(attribution.utm_content, 160),
      referrer: clampText(attribution.referrer, 500),
      landing_page: clampText(attribution.landing_page, 500),
      page_path:
        clampText(input.pagePath, 500) ?? clampText(attribution.page_path, 500),
      country_code: sanitizeCountryCode(input.countryCode),
      metadata: sanitizeMetadata(input.metadata),
      idempotency_key: idempotencyKey,
    });

    if (result.status === "timed_out") {
      console.warn("Analytics event insert timed out:", {
        eventName: input.eventName,
      });

      return false;
    }

    if (result.status === "failed") {
      console.warn("Analytics event insert failed:", {
        eventName: input.eventName,
        message:
          result.error instanceof Error
            ? result.error.message
            : "Unknown analytics error",
      });

      return false;
    }

    if (isDuplicateIdempotencyKeyError(result.error, idempotencyKey)) {
      return false;
    }

    if (result.error) {
      console.warn("Analytics event insert failed:", {
        eventName: input.eventName,
        message: result.error.message,
      });

      return false;
    }

    return true;
  } catch (error) {
    console.warn("Analytics event logging failed:", {
      eventName: input.eventName,
      message: error instanceof Error ? error.message : "Unknown analytics error",
    });

    return false;
  }
}
