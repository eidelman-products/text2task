import { z } from "zod";

const ExtractedPrioritySchema = z.enum(["low", "medium", "high"]);

const ExtractedTaskBaseSchema = {
  client_name: z.string(),
  contact_name: z.string(),
  client_phone: z.string(),
  client_email: z.string(),
  client_notes: z.string(),
  task_title: z.string(),
  amount: z.string(),
  deadline_text: z.string(),
  priority: ExtractedPrioritySchema,
  raw_input: z.string(),
};

export const TextExtractedProjectMetadataSchema = z
  .object({
    title: z.string().optional(),
    client_name: z.string().optional(),
    contact_name: z.string().optional(),
    client_phone: z.string().optional(),
    client_email: z.string().optional(),
    client_notes: z.string().optional(),
    summary: z.string().optional(),
    amount: z.string().optional(),
    currency_code: z.string().optional(),
    deadline_text: z.string().optional(),
    priority: ExtractedPrioritySchema.nullable().optional(),
  })
  .strict();

export const TextExtractedTaskSchema = z.object({
  ...ExtractedTaskBaseSchema,
  source: z.literal("text"),
});

export const ImageExtractedTaskSchema = z.object({
  ...ExtractedTaskBaseSchema,
  source: z.literal("image"),
});

export const TextExtractedTasksResponseSchema = z
  .object({
    project: TextExtractedProjectMetadataSchema.optional(),
    tasks: z.array(TextExtractedTaskSchema),
  })
  .strict();

export const ImageExtractedTasksResponseSchema = z.object({
  raw_input: z.string().optional().default(""),
  tasks: z.array(ImageExtractedTaskSchema),
});

export type TextExtractedProjectMetadata = z.infer<
  typeof TextExtractedProjectMetadataSchema
>;
export type TextExtractedTask = z.infer<typeof TextExtractedTaskSchema>;
export type TextExtractionResult = z.infer<
  typeof TextExtractedTasksResponseSchema
>;

export type ImageExtractedTask = z.infer<typeof ImageExtractedTaskSchema>;
export type ImageExtractionResult = z.infer<
  typeof ImageExtractedTasksResponseSchema
>;
