import { openai } from "@/lib/openai";
import { z } from "zod";

const PROJECT_UPDATE_IMAGE_MODEL = "gpt-5.4";
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const ImageInstructionExtractionSchema = z.object({
  rawTranscription: z.string().default(""),
  requestedTasks: z.array(z.string()).default([]),
  deadlineMentions: z.array(z.string()).default([]),
  priorityMentions: z.array(z.string()).default([]),
  budgetMentions: z.array(z.string()).default([]),
  clientNotes: z.array(z.string()).default([]),
});

export type ProjectUpdateImageExtraction = z.infer<typeof ImageInstructionExtractionSchema>;

export class ProjectUpdateImageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProjectUpdateImageError";
    this.status = status;
  }
}

export function validateProjectUpdateImageFile(file: File) {
  if (file.size <= 0) {
    throw new ProjectUpdateImageError("The uploaded image is empty.", 400);
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new ProjectUpdateImageError(
      "This image is too large. Upload screenshots up to 10MB.",
      413
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new ProjectUpdateImageError(
      "Unsupported image type. Upload a PNG, JPG, JPEG, WEBP, or GIF screenshot.",
      400
    );
  }
}

function parseJsonFromImageOutput(rawText: string): unknown {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new ProjectUpdateImageError(
      "Text2Task could not read a clear client update from this image. Try a clearer screenshot.",
      400
    );
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fence/object extraction below.
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Continue to object extraction below.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new ProjectUpdateImageError(
      "Text2Task could not structure the screenshot. Try a clearer image or crop around the message.",
      502
    );
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function cleanInstructionLine(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bwith\s+our\s+new\b/gi, "with new")
    .replace(/\bwith\s+the\s+new\b/gi, "with new")
    .replace(/[.;]+$/g, "")
    .trim();
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();

  return values
    .map(cleanInstructionLine)
    .filter((value) => {
      if (!value) return false;

      const key = value.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

export function buildRawInputFromImageExtraction(
  extraction: ProjectUpdateImageExtraction
) {
  const rawTranscription = extraction.rawTranscription.trim();
  const requestedTasks = uniqueNonEmpty(extraction.requestedTasks);
  const deadlineMentions = uniqueNonEmpty(extraction.deadlineMentions);
  const priorityMentions = uniqueNonEmpty(extraction.priorityMentions);
  const budgetMentions = uniqueNonEmpty(extraction.budgetMentions);
  const clientNotes = uniqueNonEmpty(extraction.clientNotes);
  const lines = ["[Image update transcription]"];

  if (rawTranscription) {
    lines.push(rawTranscription.slice(0, 1600));
    lines.push("");
  }

  if (requestedTasks.length > 0) {
    lines.push("Client requested:");
    requestedTasks.forEach((task) => lines.push(`- ${task}`));
  }

  if (deadlineMentions.length > 0) {
    lines.push(`Deadline: ${deadlineMentions.join("; ")}`);
  }

  if (priorityMentions.length > 0) {
    lines.push(`Priority: ${priorityMentions.join("; ")}`);
  }

  if (budgetMentions.length > 0) {
    lines.push(`Budget: ${budgetMentions.join("; ")}`);
  }

  if (clientNotes.length > 0) {
    lines.push("Client notes:");
    clientNotes.forEach((note) => lines.push(`- ${note}`));
  }

  return lines.join("\n").slice(0, 4000);
}

export async function extractProjectUpdateImageInstructions(file: File) {
  validateProjectUpdateImageFile(file);

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const prompt = [
    "You are Text2Task's screenshot instruction extraction engine for Project Updates.",
    "Read the uploaded image and return a simple, stable JSON extraction of visible client instructions.",
    "The image may be a screenshot of WhatsApp, email, chat, notes, a brief, or a marked-up client request.",
    "",
    "Important:",
    "- This is NOT a new-project extraction task.",
    "- The text will be analyzed against an existing project in a later step.",
    "- Do not create projects.",
    "- Do not create project update audit items.",
    "- Do not classify anything as new_subtask or update_subtask.",
    "- Do not return item types, project_update_items, ids, or audit records.",
    "- Return JSON only. No markdown. No comments. No extra text.",
    "- Do not invent unseen details.",
    "",
    "Output exact shape:",
    "{",
    '  "rawTranscription": "string",',
    '  "requestedTasks": ["string"],',
    '  "deadlineMentions": ["string"],',
    '  "priorityMentions": ["string"],',
    '  "budgetMentions": ["string"],',
    '  "clientNotes": ["string"]',
    "}",
    "",
    "Extraction rules:",
    "- rawTranscription: concise faithful visible text summary/transcription.",
    "- requestedTasks: each visible requested deliverable, section, task, or work item.",
    "- Treat each requested deliverable/section as a requested task.",
    "- Preserve action wording like add, create, build, update, prepare, include.",
    "- For text like update X with our new Y, requestedTasks should include: Update X with new Y.",
    "- deadlineMentions: deadline changes or deadline text only.",
    "- priorityMentions: urgency/priority clues only.",
    "- budgetMentions: budget/scope money mentions only.",
    "- clientNotes: useful visible context, names, company names, contact details, or notes that are not tasks.",
    "- If there are no requested tasks but there are deadline/priority/budget/client detail changes, still return those fields.",
    "- If no useful client update text is visible, return empty strings/arrays.",
    "",
    "Example visible text:",
    "Can you please add a customer reviews section to the homepage, update the service area section with our new locations, and move the project deadline to next Friday? Also mark this as high priority.",
    "",
    "Example JSON:",
    "{",
    '  "rawTranscription": "Can you please add a customer reviews section to the homepage, update the service area section with our new locations, and move the project deadline to next Friday? Also mark this as high priority.",',
    '  "requestedTasks": ["Add customer reviews section to homepage", "Update service area section with new locations"],',
    '  "deadlineMentions": ["next Friday"],',
    '  "priorityMentions": ["high priority"],',
    '  "budgetMentions": [],',
    '  "clientNotes": []',
    "}",
    "",
    "Final check:",
    "- Do not use update_subtask.",
    "- Do not use new_subtask.",
    "- Do not decide whether a task is new or existing.",
    "- Only extract visible instructions into the simple JSON fields above.",
  ].join("\n");

  const response = await openai.responses.create({
    model: PROJECT_UPDATE_IMAGE_MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: dataUrl,
            detail: "auto",
          },
        ],
      },
    ],
  });

  const text = response.output_text?.trim() ?? "";
  const parsedJson = parseJsonFromImageOutput(text);
  const parsedExtraction = ImageInstructionExtractionSchema.safeParse(parsedJson);

  if (!parsedExtraction.success) {
    throw new ProjectUpdateImageError(
      "Text2Task could not structure the screenshot. Try a clearer image or crop around the message.",
      502
    );
  }

  const extraction = parsedExtraction.data;
  const hasUsefulText =
    extraction.rawTranscription.trim().length > 0 ||
    extraction.requestedTasks.length > 0 ||
    extraction.deadlineMentions.length > 0 ||
    extraction.priorityMentions.length > 0 ||
    extraction.budgetMentions.length > 0 ||
    extraction.clientNotes.length > 0;

  if (!hasUsefulText) {
    throw new ProjectUpdateImageError(
      "Text2Task could not read a clear client update from this image. Try a clearer screenshot.",
      400
    );
  }

  return {
    extraction,
    rawInput: buildRawInputFromImageExtraction(extraction),
  };
}

export async function transcribeProjectUpdateImage(file: File) {
  const result = await extractProjectUpdateImageInstructions(file);

  return result.rawInput;
}
