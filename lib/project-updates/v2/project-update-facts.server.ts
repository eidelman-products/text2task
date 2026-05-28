import { z } from "zod";

import { openai } from "@/lib/openai";

import type {
  ProjectUpdateExtractedFacts,
  ProjectUpdateFactsExtractionInput,
  ProjectUpdateFactsExtractionResult,
} from "@/lib/project-updates/v2/project-update-facts.types";

const PROJECT_UPDATE_FACTS_MODEL = "gpt-4.1-mini";

const PrioritySchema = z.enum(["Low", "Medium", "High"]);
const StatusSchema = z.enum(["New", "In Progress", "Review", "Urgent", "Done"]);

const NullableStringSchema = z.string().trim().min(1).nullable();

const ExtractedSubtaskFactSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: NullableStringSchema,
  deadlineText: NullableStringSchema,
  amount: NullableStringSchema,
  status: StatusSchema.nullable(),
  priority: PrioritySchema.nullable(),
});

const ExtractedProjectChangesSchema = z.object({
  deadlineText: NullableStringSchema,
  amount: NullableStringSchema,
  priority: PrioritySchema.nullable(),
  status: StatusSchema.nullable(),
});

const ExtractedClientChangesSchema = z.object({
  clientName: NullableStringSchema,
  contactName: NullableStringSchema,
  phone: NullableStringSchema,
  email: NullableStringSchema,
  notes: NullableStringSchema,
});

const ExtractedNoteFactSchema = z.object({
  note: z.string().trim().min(1).max(1000),
  scope: z.enum(["project", "client"]),
});

const ExtractedFactsSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  requestedSubtasks: z.array(ExtractedSubtaskFactSchema).default([]),
  projectChanges: ExtractedProjectChangesSchema,
  clientChanges: ExtractedClientChangesSchema,
  notes: z.array(ExtractedNoteFactSchema).default([]),
  confidence: z.number().min(0).max(1).nullable(),
});

function normalizeRawInput(value: string) {
  return String(value || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .slice(0, 8000);
}

function parseJsonFromModelOutput(rawText: string): unknown {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error("The model returned an empty response.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fallback parsing below.
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
    throw new Error("The model response did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function buildProjectUpdateFactsPrompt(input: {
  rawInput: string;
  sourceType: string;
}) {
  return [
    "You are Text2Task's Project Update V2 facts extraction engine.",
    "",
    "Your only job is to extract simple factual information from a client follow-up update.",
    "Do NOT decide whether anything is new, duplicated, already existing, unchanged, safe to apply, or needs review.",
    "Do NOT compare against the existing project.",
    "Do NOT create project_update_items.",
    "Do NOT output item types like new_subtask, update_subtask, duplicate_warning, no_action, deadline_change, or priority_change.",
    "",
    "The next system step will compare these facts against the existing project and decide what should be applied.",
    "",
    "Return JSON only. No markdown. No comments. No extra text.",
    "",
    "Output exact JSON shape:",
    "{",
    '  "summary": "short factual summary of the client update",',
    '  "requestedSubtasks": [',
    "    {",
    '      "title": "client-requested work item",',
    '      "description": "short factual explanation or null",',
    '      "deadlineText": "deadline for this specific work item or null",',
    '      "amount": "budget/price for this specific work item or null",',
    '      "status": "New | In Progress | Review | Urgent | Done | null",',
    '      "priority": "Low | Medium | High | null"',
    "    }",
    "  ],",
    '  "projectChanges": {',
    '    "deadlineText": "project-wide deadline or null",',
    '    "amount": "project-wide budget/amount or null",',
    '    "priority": "Low | Medium | High | null",',
    '    "status": "New | In Progress | Review | Urgent | Done | null"',
    "  },",
    '  "clientChanges": {',
    '    "clientName": "client/company name or null",',
    '    "contactName": "contact person or null",',
    '    "phone": "phone number or null",',
    '    "email": "email or null",',
    '    "notes": "client record notes or null"',
    "  },",
    '  "notes": [',
    "    {",
    '      "note": "useful context that is not a task",',
    '      "scope": "project | client"',
    "    }",
    "  ],",
    '  "confidence": 0.0',
    "}",
    "",
    "Facts extraction rules:",
    "",
    "1. Requested subtasks",
    "- Extract each client-requested deliverable, task, section, update, or work item.",
    "- Use requestedSubtasks for work that someone needs to perform.",
    "- Keep titles short, professional, and action-oriented.",
    "- Preserve important words like add, create, update, replace, revise, design, prepare.",
    "- If the client says update X with new Y, keep that as a requested subtask title, for example: Update service area section with new locations.",
    "- Do not decide whether it already exists. Just extract the requested work.",
    "",
    "2. Project-level changes",
    "- Use projectChanges.deadlineText for a project-wide deadline.",
    "- Use projectChanges.amount for a project-wide budget or amount.",
    "- Use projectChanges.priority for a project-wide priority.",
    "- Use projectChanges.status for a project-wide status.",
    "- Do not create requestedSubtasks for deadline, budget, priority, or status alone.",
    "",
    "3. Client/contact changes",
    "- Extract client/company, contact person, phone, email, and client notes only if they are present.",
    "- Do not invent contact details.",
    "",
    "4. Notes",
    "- Use notes only for useful context that is not a task and not a project-level field.",
    "- Do not duplicate the full request as a note.",
    "",
    "5. Missing values",
    "- Use null for unknown or missing values.",
    "- Use [] for empty arrays.",
    "- confidence should be a number from 0 to 1, or null if unsure.",
    "",
    "6. Source",
    `- The input source type is: ${input.sourceType}.`,
    "- Source type does not change the JSON shape.",
    "- Text and screenshot transcription must produce the same kind of facts when the visible/requested text is the same.",
    "",
    "Example input:",
    "Hi Emily here from Apex Roofing. Can you please add a customer reviews section to the homepage, update the service area section with our new locations, and move the project deadline to next Friday? Also, please mark this as high priority.",
    "",
    "Example JSON:",
    "{",
    '  "summary": "Client requested website updates, a deadline move, and high priority.",',
    '  "requestedSubtasks": [',
    "    {",
    '      "title": "Add customer reviews section to homepage",',
    '      "description": "Client asked to add a customer reviews section to the homepage.",',
    '      "deadlineText": null,',
    '      "amount": null,',
    '      "status": null,',
    '      "priority": null',
    "    },",
    "    {",
    '      "title": "Update service area section with new locations",',
    '      "description": "Client asked to update the service area section with new locations.",',
    '      "deadlineText": null,',
    '      "amount": null,',
    '      "status": null,',
    '      "priority": null',
    "    }",
    "  ],",
    '  "projectChanges": {',
    '    "deadlineText": "next Friday",',
    '    "amount": null,',
    '    "priority": "High",',
    '    "status": null',
    "  },",
    '  "clientChanges": {',
    '    "clientName": "Apex Roofing",',
    '    "contactName": "Emily",',
    '    "phone": null,',
    '    "email": null,',
    '    "notes": null',
    "  },",
    '  "notes": [],',
    '  "confidence": 0.94',
    "}",
    "",
    "Client update input:",
    input.rawInput,
  ].join("\n");
}

function repairFactsShape(value: ProjectUpdateExtractedFacts) {
  return {
    ...value,
    requestedSubtasks: value.requestedSubtasks.map((subtask) => ({
      ...subtask,
      title: subtask.title.trim(),
      description: subtask.description?.trim() || null,
      deadlineText: subtask.deadlineText?.trim() || null,
      amount: subtask.amount?.trim() || null,
    })),
    projectChanges: {
      deadlineText: value.projectChanges.deadlineText?.trim() || null,
      amount: value.projectChanges.amount?.trim() || null,
      priority: value.projectChanges.priority,
      status: value.projectChanges.status,
    },
    clientChanges: {
      clientName: value.clientChanges.clientName?.trim() || null,
      contactName: value.clientChanges.contactName?.trim() || null,
      phone: value.clientChanges.phone?.trim() || null,
      email: value.clientChanges.email?.trim() || null,
      notes: value.clientChanges.notes?.trim() || null,
    },
    notes: value.notes
      .map((note) => ({
        ...note,
        note: note.note.trim(),
      }))
      .filter((note) => note.note.length > 0),
  };
}

export async function extractProjectUpdateFacts(
  input: ProjectUpdateFactsExtractionInput
): Promise<ProjectUpdateFactsExtractionResult> {
  const normalizedRawInput = normalizeRawInput(input.rawInput);

  if (!normalizedRawInput) {
    return {
      ok: false,
      error: "Project update text is required.",
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: PROJECT_UPDATE_FACTS_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildProjectUpdateFactsPrompt({
            rawInput: normalizedRawInput,
            sourceType: input.sourceType,
          }),
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content ?? "";
    const parsedJson = parseJsonFromModelOutput(rawContent);
    const parsedFacts = ExtractedFactsSchema.safeParse(parsedJson);

    if (!parsedFacts.success) {
      return {
        ok: false,
        error: "Model returned invalid project update facts.",
        details: parsedFacts.error.flatten(),
      };
    }

    return {
      ok: true,
      facts: repairFactsShape(parsedFacts.data),
      normalizedRawInput,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown project update facts error.";

    return {
      ok: false,
      error: `Could not extract project update facts: ${message}`,
    };
  }
}