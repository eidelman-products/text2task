import "server-only";

import { z } from "zod";

import {
  ProductEntityTypeSchema,
  ProductEventNameSchema,
  type ProductEntityType,
  type ProductEventName,
  validateProductEventInput,
} from "@/lib/activity/product-event-contracts";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_SUMMARY_USER_IDS = 2000;
const DEFAULT_TIMELINE_LIMIT = 200;
const MAX_TIMELINE_LIMIT = 500;
const MAX_ROUTE_LENGTH = 300;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TimestampSchema = z.string().refine((value) => {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp);
});

const NullableTimestampSchema = TimestampSchema.nullable();
const InternalRouteSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ROUTE_LENGTH)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"));

const SummaryRowSchema = z
  .object({
    user_id: z.string().regex(UUID_PATTERN),
    last_seen_at: NullableTimestampSchema,
    last_viewed_route: InternalRouteSchema.nullable(),
    last_event_name: ProductEventNameSchema.nullable(),
    total_authenticated_views: z.number().int().min(0),
    distinct_active_days: z.number().int().min(0),
    is_returning: z.boolean(),
  })
  .strict();

const TimelineRowSchema = z
  .object({
    created_at: TimestampSchema,
    event_name: ProductEventNameSchema,
    route: InternalRouteSchema,
    entity_type: ProductEntityTypeSchema.nullable(),
    entity_id: z.string().max(64).nullable(),
  })
  .strict();

export type OwnerAuthenticatedActivitySummaryRow = {
  userId: string;
  lastSeenAt: string | null;
  lastViewedRoute: string | null;
  lastEventName: ProductEventName | null;
  totalAuthenticatedViews: number;
  distinctActiveDays: number;
  isReturning: boolean;
};

export type OwnerAuthenticatedActivityTimelineRow = {
  createdAt: string;
  eventName: ProductEventName;
  route: string;
  entityType: ProductEntityType | null;
  entityId: string | null;
};

export type OwnerAuthenticatedActivityLoadResult<T> =
  | { status: "ready"; rows: T[] }
  | { status: "unavailable"; rows: [] };

export function isOwnerAuthenticatedActivityUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function dedupeValidUserIds(userIds: string[]) {
  const scopedUserIds: string[] = [];
  const seen = new Set<string>();

  for (const userId of userIds) {
    if (!isOwnerAuthenticatedActivityUuid(userId) || seen.has(userId)) {
      continue;
    }

    seen.add(userId);
    scopedUserIds.push(userId);

    if (scopedUserIds.length >= MAX_SUMMARY_USER_IDS) {
      break;
    }
  }

  return scopedUserIds;
}

function parseSummaryRows(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: OwnerAuthenticatedActivitySummaryRow[] = [];

  for (const item of value) {
    const parsed = SummaryRowSchema.safeParse(item);

    if (!parsed.success) {
      continue;
    }

    rows.push({
      userId: parsed.data.user_id,
      lastSeenAt: parsed.data.last_seen_at,
      lastViewedRoute: parsed.data.last_viewed_route,
      lastEventName: parsed.data.last_event_name,
      totalAuthenticatedViews: parsed.data.total_authenticated_views,
      distinctActiveDays: parsed.data.distinct_active_days,
      isReturning: parsed.data.is_returning,
    });
  }

  return rows;
}

function parseTimelineRows(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: OwnerAuthenticatedActivityTimelineRow[] = [];

  for (const item of value) {
    const parsed = TimelineRowSchema.safeParse(item);

    if (!parsed.success) {
      continue;
    }

    const validated = validateProductEventInput({
      eventName: parsed.data.event_name,
      route: parsed.data.route,
      entityType: parsed.data.entity_type,
      entityId: parsed.data.entity_id,
    });

    if (!validated.ok) {
      continue;
    }

    rows.push({
      createdAt: parsed.data.created_at,
      eventName: validated.event.eventName,
      route: validated.event.route,
      entityType: validated.event.entityType,
      entityId: validated.event.entityId,
    });
  }

  return rows;
}

export async function loadOwnerAuthenticatedActivitySummary(
  userIds: string[]
): Promise<
  OwnerAuthenticatedActivityLoadResult<OwnerAuthenticatedActivitySummaryRow>
> {
  const scopedUserIds = dedupeValidUserIds(userIds);

  if (scopedUserIds.length === 0) {
    return { status: "ready", rows: [] };
  }

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "get_owner_authenticated_activity_summary",
      { p_user_ids: scopedUserIds }
    );

    if (error) {
      console.warn("Owner authenticated activity summary RPC failed:", error.message);
      return { status: "unavailable", rows: [] };
    }

    const rows = parseSummaryRows(data);

    if (rows === null) {
      console.warn(
        "Owner authenticated activity summary RPC returned malformed data."
      );
      return { status: "unavailable", rows: [] };
    }

    return { status: "ready", rows };
  } catch (error) {
    console.warn("Owner authenticated activity summary query failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: "unavailable", rows: [] };
  }
}

export async function loadOwnerUserActivityTimeline(
  userId: string,
  limit = DEFAULT_TIMELINE_LIMIT
): Promise<
  OwnerAuthenticatedActivityLoadResult<OwnerAuthenticatedActivityTimelineRow>
> {
  if (!isOwnerAuthenticatedActivityUuid(userId)) {
    return { status: "unavailable", rows: [] };
  }

  const scopedLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, MAX_TIMELINE_LIMIT)
      : DEFAULT_TIMELINE_LIMIT;

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "get_owner_user_activity_timeline",
      { p_user_id: userId, p_limit: scopedLimit }
    );

    if (error) {
      console.warn("Owner authenticated activity timeline RPC failed:", error.message);
      return { status: "unavailable", rows: [] };
    }

    const rows = parseTimelineRows(data);

    if (rows === null) {
      console.warn(
        "Owner authenticated activity timeline RPC returned malformed data."
      );
      return { status: "unavailable", rows: [] };
    }

    return { status: "ready", rows };
  } catch (error) {
    console.warn("Owner authenticated activity timeline query failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: "unavailable", rows: [] };
  }
}
