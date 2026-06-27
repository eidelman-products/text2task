import { z } from "zod";

export const TextExtractedTaskSchema = z.object({
  client_name: z.string(),
  contact_name: z.string(),
  client_phone: z.string(),
  client_email: z.string(),
  client_notes: z.string(),
  task_title: z.string(),
  amount: z.string(),
  deadline_text: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  source: z.literal("text"),
  raw_input: z.string(),
});

export const TextExtractedTasksResponseSchema = z.object({
  tasks: z.array(TextExtractedTaskSchema),
});

export type TextExtractedTask = z.infer<typeof TextExtractedTaskSchema>;
export type TextExtractionResult = z.infer<
  typeof TextExtractedTasksResponseSchema
>;
