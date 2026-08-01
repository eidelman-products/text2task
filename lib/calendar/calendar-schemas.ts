import { z } from "zod";

import { compareDateOnly, parseDateOnly, type DateOnly } from "@/lib/tasks/date-only";
import { parseTimeOnly, type TimeOnly } from "@/lib/calendar/time-only";

/**
 * Zod validation for the Work Calendar's API/server boundary. These schemas
 * are the only place raw request input is branded into `DateOnly`/
 * `TimeOnly` for this feature -- every other module receives already-typed
 * values.
 */

const DateOnlySchema = z.string().transform((value, ctx): DateOnly => {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be a valid YYYY-MM-DD date.",
    });
    return z.NEVER;
  }

  return parsed;
});

const TimeOnlySchema = z.string().transform((value, ctx): TimeOnly => {
  const parsed = parseTimeOnly(value);

  if (!parsed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be a valid HH:MM 24-hour time.",
    });
    return z.NEVER;
  }

  return parsed;
});

const TitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(240, "Title must be 240 characters or fewer.");

// Accepts `null` or a string; blank/whitespace-only strings normalize to
// `null` (matches the repo's established NullableStringSchema idiom, e.g.
// lib/project-updates/v2/project-update-facts.server.ts) rather than
// storing an empty string as if it were real content.
const NotesSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((value) => value === null || value.length <= 5000, {
    message: "Notes must be 5000 characters or fewer.",
  });

const UuidSchema = z.string().uuid();

/**
 * Shared limit for both `customProjectName` and `customClientName` -- the
 * single JS-side source of truth mirrored by the database's own
 * `calendar_events_custom_{project,client}_name_check` CHECK constraints
 * (supabase/migrations/202607310001_calendar_events_custom_names.sql).
 * Matches `TitleSchema`'s own 240-character limit rather than inventing an
 * unrelated number.
 */
export const CUSTOM_ENTITY_NAME_MAX_LENGTH = 240;

// Same blank-to-null normalization idiom as NotesSchema above; a custom
// Project/Client name is optional free text, never a required field.
const CustomEntityNameSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((value) => value === null || value.length <= CUSTOM_ENTITY_NAME_MAX_LENGTH, {
    message: `Must be ${CUSTOM_ENTITY_NAME_MAX_LENGTH} characters or fewer.`,
  });

/**
 * A linked id and a custom name for the same relationship (Project or
 * Client) must never both be non-null on the same request -- enforced here
 * (the schema layer), again in lib/calendar/calendar-link-validation.server.ts
 * (the repository layer), and again by a database CHECK constraint: the
 * same "enforced at every layer" convention this feature already applies to
 * project/client ownership.
 */
function refineExclusiveRelationships<
  T extends {
    projectId?: string | null;
    customProjectName?: string | null;
    clientId?: string | null;
    customClientName?: string | null;
  },
>(schema: z.ZodType<T>) {
  return schema
    .refine((value) => !(value.projectId != null && value.customProjectName != null), {
      message: "A Project cannot be both linked and custom.",
      path: ["customProjectName"],
    })
    .refine((value) => !(value.clientId != null && value.customClientName != null), {
      message: "A Client cannot be both linked and custom.",
      path: ["customClientName"],
    });
}

export const CalendarRangeQuerySchema = z
  .object({
    start: DateOnlySchema,
    end: DateOnlySchema,
  })
  .strict()
  .refine((value) => compareDateOnly(value.start, value.end) <= 0, {
    message: "start must not be after end.",
    path: ["end"],
  });

export const CreateCalendarEventInputSchema = refineExclusiveRelationships(
  z
    .object({
      title: TitleSchema,
      eventDate: DateOnlySchema,
      eventTime: TimeOnlySchema.nullable(),
      notes: NotesSchema,
      projectId: UuidSchema.nullable(),
      customProjectName: CustomEntityNameSchema,
      clientId: UuidSchema.nullable(),
      customClientName: CustomEntityNameSchema,
    })
    .strict()
);

export const UpdateCalendarEventInputSchema = refineExclusiveRelationships(
  z
    .object({
      title: TitleSchema.optional(),
      eventDate: DateOnlySchema.optional(),
      eventTime: TimeOnlySchema.nullable().optional(),
      notes: NotesSchema.optional(),
      projectId: UuidSchema.nullable().optional(),
      customProjectName: CustomEntityNameSchema.optional(),
      clientId: UuidSchema.nullable().optional(),
      customClientName: CustomEntityNameSchema.optional(),
    })
    .strict()
).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided.",
});
