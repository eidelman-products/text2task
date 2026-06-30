import "server-only";

import { z } from "zod";

import { TextExtractedTasksResponseSchema } from "@/lib/extraction/schemas";
import { HomepageDemoRepositoryError } from "@/lib/homepage-demo/errors";
import type { HomepageDemoJsonObject } from "@/lib/homepage-demo/json-validation";
import type { HomepageDemoReviewDraft } from "@/lib/homepage-demo/review-repository.server";
import { parseAmount } from "@/lib/tasks/parse-amount";
import { parseDeadline } from "@/lib/tasks/parse-deadline";

type TextExtractedTask = z.infer<
  typeof TextExtractedTasksResponseSchema
>["tasks"][number];

export type HomepageDemoPublicReviewPriority =
  | "Low"
  | "Medium"
  | "High";

export type HomepageDemoPublicReviewSubtask = Readonly<{
  task: string;
  priority: HomepageDemoPublicReviewPriority | null;
  deadlineText: string | null;
  deadlineDate: string | null;
  amountText: string | null;
  amountValue: number | null;
  currencyCode: string | null;
  order: number;
}>;

export type HomepageDemoPublicReviewPayload = Readonly<{
  title: string;
  summary: string | null;
  clientName: string | null;
  contactName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientNotes: string | null;
  amountText: string | null;
  amountValue: number | null;
  currencyCode: string | null;
  deadlineText: string | null;
  deadlineDate: string | null;
  priority: HomepageDemoPublicReviewPriority | null;
  subtasks: HomepageDemoPublicReviewSubtask[];
}>;

const PublicReviewPrioritySchema = z.union([
  z.literal("Low"),
  z.literal("Medium"),
  z.literal("High"),
]);

const PublicReviewSubtaskSchema = z
  .object({
    task: z.string().min(1),
    priority: PublicReviewPrioritySchema.nullable(),
    deadlineText: z.string().min(1).nullable(),
    deadlineDate: z.string().min(1).nullable(),
    amountText: z.string().min(1).nullable(),
    amountValue: z.number().finite().nullable(),
    currencyCode: z.string().min(1).nullable(),
    order: z.number().int().positive(),
  })
  .strict();

const PublicReviewPayloadSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1).nullable(),
    clientName: z.string().min(1).nullable(),
    contactName: z.string().min(1).nullable(),
    clientEmail: z.string().min(1).nullable(),
    clientPhone: z.string().min(1).nullable(),
    clientNotes: z.string().min(1).nullable(),
    amountText: z.string().min(1).nullable(),
    amountValue: z.number().finite().nullable(),
    currencyCode: z.string().min(1).nullable(),
    deadlineText: z.string().min(1).nullable(),
    deadlineDate: z.string().min(1).nullable(),
    priority: PublicReviewPrioritySchema.nullable(),
    subtasks: z.array(PublicReviewSubtaskSchema),
  })
  .strict();

export function createHomepageDemoPublicReviewPayload(
  repositoryDraft: HomepageDemoReviewDraft
): HomepageDemoPublicReviewPayload {
  if (repositoryDraft.inputType !== "text") {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  const parsedDraft = TextExtractedTasksResponseSchema.safeParse(
    getEffectiveDraftResult(repositoryDraft)
  );

  if (!parsedDraft.success || parsedDraft.data.tasks.length === 0) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  const tasks = parsedDraft.data.tasks;
  const primaryAmount = parseAmount(firstOptionalText(tasks, "amount"));
  const primaryDeadlineText = firstOptionalText(tasks, "deadline_text");
  const primaryDeadline = parseDeadline(primaryDeadlineText);
  const payload: HomepageDemoPublicReviewPayload = {
    title: inferPayloadTitle(tasks),
    summary: buildPayloadSummary(tasks),
    clientName: firstOptionalText(tasks, "client_name"),
    contactName: firstOptionalText(tasks, "contact_name"),
    clientEmail: firstOptionalText(tasks, "client_email"),
    clientPhone: firstOptionalText(tasks, "client_phone"),
    clientNotes: firstOptionalText(tasks, "client_notes"),
    amountText: toNullableText(
      primaryAmount.displayAmount ?? primaryAmount.rawText
    ),
    amountValue: primaryAmount.amountValue,
    currencyCode: primaryAmount.currencyCode,
    deadlineText: primaryDeadlineText,
    deadlineDate: primaryDeadline.deadlineDate,
    priority: getGroupPriority(tasks),
    subtasks: tasks.map((task, index) =>
      createPublicReviewSubtask(task, index)
    ),
  };
  const parsedPayload = PublicReviewPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return parsedPayload.data;
}

function getEffectiveDraftResult(
  repositoryDraft: HomepageDemoReviewDraft
): HomepageDemoJsonObject {
  return repositoryDraft.editedResult ?? repositoryDraft.normalizedResult;
}

function createPublicReviewSubtask(
  task: TextExtractedTask,
  index: number
): HomepageDemoPublicReviewSubtask {
  const deadlineText = toNullableText(task.deadline_text);
  const deadline = parseDeadline(deadlineText);
  const amount = parseAmount(task.amount);

  return {
    task: toRequiredText(task.task_title),
    priority: toPublicPriority(task.priority),
    deadlineText,
    deadlineDate: deadline.deadlineDate,
    amountText: toNullableText(amount.displayAmount ?? amount.rawText),
    amountValue: amount.amountValue,
    currencyCode: amount.currencyCode,
    order: index + 1,
  };
}

function inferPayloadTitle(tasks: readonly TextExtractedTask[]): string {
  if (tasks.length === 1) {
    return cleanTitle(toRequiredText(tasks[0].task_title));
  }

  const combinedTasks = tasks
    .map((task) => task.task_title)
    .join(" ")
    .toLowerCase();

  if (
    combinedTasks.includes("homepage") ||
    combinedTasks.includes("website") ||
    combinedTasks.includes("contact form") ||
    combinedTasks.includes("testimonials") ||
    combinedTasks.includes("service area") ||
    combinedTasks.includes("header")
  ) {
    return "Website updates project";
  }

  if (
    combinedTasks.includes("social") ||
    combinedTasks.includes("post") ||
    combinedTasks.includes("posts") ||
    combinedTasks.includes("reel") ||
    combinedTasks.includes("reels") ||
    combinedTasks.includes("story") ||
    combinedTasks.includes("stories")
  ) {
    return "Social media content package";
  }

  if (
    combinedTasks.includes("video") ||
    combinedTasks.includes("clip") ||
    combinedTasks.includes("clips") ||
    combinedTasks.includes("facebook ad") ||
    combinedTasks.includes("product video")
  ) {
    return "Video editing package";
  }

  return "Client project";
}

function buildPayloadSummary(
  tasks: readonly TextExtractedTask[]
): string | null {
  if (tasks.length === 1) {
    return null;
  }

  const titles = tasks
    .map((task) => toRequiredText(task.task_title))
    .slice(0, 3);
  const suffix =
    tasks.length > titles.length ? `, +${tasks.length - titles.length} more` : "";

  return `${titles.join(", ")}${suffix}`;
}

function firstOptionalText(
  tasks: readonly TextExtractedTask[],
  field: keyof Pick<
    TextExtractedTask,
    | "amount"
    | "client_email"
    | "client_name"
    | "client_notes"
    | "client_phone"
    | "contact_name"
    | "deadline_text"
  >
): string | null {
  for (const task of tasks) {
    const value = toNullableText(task[field]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getGroupPriority(
  tasks: readonly TextExtractedTask[]
): HomepageDemoPublicReviewPriority | null {
  const priorities = tasks.map((task) => task.priority);

  if (priorities.includes("high")) {
    return "High";
  }

  if (priorities.includes("medium")) {
    return "Medium";
  }

  if (priorities.includes("low")) {
    return "Low";
  }

  return null;
}

function toPublicPriority(
  value: TextExtractedTask["priority"]
): HomepageDemoPublicReviewPriority {
  switch (value) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

function toNullableText(value: string | null | undefined): string | null {
  const clean = String(value ?? "").trim();

  return clean.length > 0 ? clean : null;
}

function toRequiredText(value: string): string {
  const clean = value.trim();

  if (!clean) {
    throw new HomepageDemoRepositoryError("repository_response_invalid");
  }

  return clean;
}

function cleanTitle(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
