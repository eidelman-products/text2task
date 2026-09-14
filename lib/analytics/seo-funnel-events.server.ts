import "server-only";

import { after, type NextRequest } from "next/server";

import { logAnalyticsEventSafe } from "@/lib/analytics/internal-events.server";
import {
  readRequestAttribution,
  toAnalyticsAttributionPayload,
  type AnalyticsAttributionPayload,
} from "@/lib/analytics/request-attribution.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AnalyticsContext = Readonly<{
  anonymousId: string | null;
  attribution: AnalyticsAttributionPayload | null;
  pagePath: string | null;
  countryCode: string | null;
}>;

type ExtractionSource = "text" | "image";
type ProjectSaveSource =
  | "project_import"
  | "homepage_demo_claim"
  | "tasks_project_create";

const EMPTY_ANALYTICS_CONTEXT: AnalyticsContext = Object.freeze({
  anonymousId: null,
  attribution: null,
  pagePath: null,
  countryCode: null,
});

function readAnalyticsContextFromRequest(
  request: NextRequest
): AnalyticsContext {
  const snapshot = readRequestAttribution(request);

  if (!snapshot) {
    return EMPTY_ANALYTICS_CONTEXT;
  }

  return Object.freeze({
    anonymousId: snapshot.anonymousId,
    attribution: toAnalyticsAttributionPayload(snapshot),
    pagePath: snapshot.pagePath,
    countryCode: snapshot.countryCode,
  });
}

async function recordSuccessfulExtraction(userId: string) {
  const { error } = await supabaseAdmin.rpc("record_successful_extraction", {
    p_user_id: userId,
  });

  return !error;
}

export function scheduleSuccessfulExtractionActivityAndFirstExtractAnalytics({
  request,
  userId,
  successfulExtractCountBefore,
  source,
}: {
  request: NextRequest;
  userId: string;
  successfulExtractCountBefore: number;
  source: ExtractionSource;
}): void {
  const context = readAnalyticsContextFromRequest(request);

  try {
    after(async () => {
      try {
        const activityRecorded = await recordSuccessfulExtraction(userId);

        if (!activityRecorded || successfulExtractCountBefore !== 0) {
          return;
        }

        await logAnalyticsEventSafe({
          eventName: "first_extract_created",
          userId,
          anonymousId: context.anonymousId,
          attribution: context.attribution,
          pagePath: context.pagePath,
          countryCode: context.countryCode,
          metadata: {
            source,
          },
          idempotencyKey: `first_extract_created:${userId}`,
        });
      } catch (error) {
        console.warn("SEO funnel extract analytics failed:", {
          message:
            error instanceof Error ? error.message : "Unknown analytics error",
        });
      }
    });
  } catch (error) {
    console.warn("SEO funnel extract analytics scheduling failed:", {
      message: error instanceof Error ? error.message : "Unknown analytics error",
    });
  }
}

export function scheduleProjectSavedAnalytics({
  request,
  userId,
  hadProjectBefore,
  source,
  createdProjectCount,
}: {
  request: NextRequest;
  userId: string;
  hadProjectBefore: boolean;
  source: ProjectSaveSource;
  createdProjectCount: number;
}): void {
  if (hadProjectBefore || createdProjectCount < 1) {
    return;
  }

  const context = readAnalyticsContextFromRequest(request);

  try {
    after(async () => {
      try {
        await logAnalyticsEventSafe({
          eventName: "project_saved",
          userId,
          anonymousId: context.anonymousId,
          attribution: context.attribution,
          pagePath: context.pagePath,
          countryCode: context.countryCode,
          metadata: {
            source,
            created_project_count: createdProjectCount,
          },
          idempotencyKey: `project_saved:${userId}`,
        });
      } catch {
        // Operational analytics is best-effort and must never affect saves.
      }
    });
  } catch {
    // Scheduling analytics is best-effort and must never affect saves.
  }
}

export async function hasActiveProjectBeforeSave(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1);

    if (error) {
      console.warn("SEO funnel project preflight failed:", {
        message: error.message,
      });

      return true;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.warn("SEO funnel project preflight failed:", {
      message: error instanceof Error ? error.message : "Unknown analytics error",
    });

    return true;
  }
}

export async function schedulePaidConversionAnalytics({
  userId,
  provider,
  eventType,
  processingStatus,
  reasonCode,
  environment,
}: {
  userId: string | null;
  provider: "creem";
  eventType: string;
  processingStatus: string;
  reasonCode: string;
  environment: string | null;
}): Promise<void> {
  if (
    !userId ||
    eventType !== "subscription.paid" ||
    processingStatus !== "processed" ||
    reasonCode !== "creem_webhook_processed"
  ) {
    return;
  }

  try {
    await logAnalyticsEventSafe({
      eventName: "paid_conversion",
      userId,
      metadata: {
        provider,
        event_type: eventType,
        processing_status: processingStatus,
        reason_code: reasonCode,
        environment,
      },
      idempotencyKey: `paid_conversion:${userId}`,
    });
  } catch {
    // Paid-conversion analytics is best-effort; Creem processing is authoritative.
  }
}
