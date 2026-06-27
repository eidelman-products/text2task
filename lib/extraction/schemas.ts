import { z } from "zod";

const ExtractedTaskBaseSchema = {
  client_name: z.string(),
  contact_name: z.string(),
  client_phone: z.string(),
  client_email: z.string(),
  client_notes: z.string(),
  task_title: z.string(),
  amount: z.string(),
  deadline_text: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  raw_input: z.string(),
};

export const TextExtractedTaskSchema = z.object({
  ...ExtractedTaskBaseSchema,
  source: z.literal("text"),
});

export const ImageExtractedTaskSchema = z.object({
  ...ExtractedTaskBaseSchema,
  source: z.literal("image"),
});

export const TextExtractedTasksResponseSchema = z.object({
  tasks: z.array(TextExtractedTaskSchema),
});

export const ImageExtractedTasksResponseSchema = z.object({
  raw_input: z.string().optional().default(""),
  tasks: z.array(ImageExtractedTaskSchema),
});

export type TextExtractedTask = z.infer<typeof TextExtractedTaskSchema>;
export type TextExtractionResult = z.infer<
  typeof TextExtractedTasksResponseSchema
>;

export type ImageExtractedTask = z.infer<typeof ImageExtractedTaskSchema>;
export type ImageExtractionResult = z.infer<
  typeof ImageExtractedTasksResponseSchema
>;
