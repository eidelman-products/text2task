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

export const CreateCalendarEventInputSchema = z
  .object({
    title: TitleSchema,
    eventDate: DateOnlySchema,
    eventTime: TimeOnlySchema.nullable(),
    notes: NotesSchema,
    projectId: UuidSchema.nullable(),
    clientId: UuidSchema.nullable(),
  })
  .strict();

export const UpdateCalendarEventInputSchema = z
  .object({
    title: TitleSchema.optional(),
    eventDate: DateOnlySchema.optional(),
    eventTime: TimeOnlySchema.nullable().optional(),
    notes: NotesSchema.optional(),
    projectId: UuidSchema.nullable().optional(),
    clientId: UuidSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });
