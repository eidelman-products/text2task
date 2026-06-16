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

function isExplicitClientRecordNote(rawInput: string) {
  const normalized = String(rawInput || "").toLowerCase();

  return [
    /\b(?:update|change|set|replace|add)\s+(?:the\s+)?(?:client|customer)\s+notes?\b/,
    /\b(?:client|customer)\s+notes?\s*[:=-]/,
    /\bnotes?\s+(?:for|on)\s+(?:the\s+)?(?:client|customer)\s+record\b/,
    /\b(?:client|customer)\s+record\s+notes?\s*[:=-]/,
  ].some((pattern) => pattern.test(normalized));
}

function hasExplicitClientRecordFieldIntent(
  rawInput: string,
  field:
    | "clientName"
    | "contactName"
    | "phone"
    | "email"
    | "notes"
) {
  const normalized = String(rawInput || "").toLowerCase();

  if (field === "notes") {
    return isExplicitClientRecordNote(rawInput);
  }

  const fieldPatterns: Record<
    "clientName" | "contactName" | "phone" | "email",
    RegExp[]
  > = {
    clientName: [
      /\b(?:update|change|set|replace)\s+(?:the\s+)?(?:client|customer)\s+(?:name|company|company\s+name)\b/,
      /\b(?:client|customer)\s+(?:name|company|company\s+name)\s*(?:is|to|=|:)\b/,
      /\b(?:company|business)\s+name\s*(?:is|to|=|:)\b/,
    ],
    contactName: [
      /\b(?:update|change|set|replace)\s+(?:the\s+)?(?:client|customer)\s+contact\s+(?:name|person)\b/,
      /\b(?:client|customer)\s+contact\s+(?:name|person)?\s*(?:is|to|=|:)\b/,
      /\bcontact\s+person\s*(?:is|to|=|:)\b/,
    ],
    phone: [
      /\b(?:update|change|set|replace)\s+(?:the\s+)?(?:client|customer|contact)\s+(?:phone|mobile|number)\b/,
      /\b(?:client|customer|contact)\s+(?:phone|mobile|number)\s*(?:is|to|=|:)\b/,
      /\b(?:phone|mobile)\s+(?:for|on)\s+(?:the\s+)?(?:client|customer|contact)\s+record\b/,
    ],
    email: [
      /\b(?:update|change|set|replace)\s+(?:the\s+)?(?:client|customer|contact)\s+email\b/,
      /\b(?:client|customer|contact)\s+email\s*(?:is|to|=|:)\b/,
      /\bemail\s+(?:for|on)\s+(?:the\s+)?(?:client|customer|contact)\s+record\b/,
    ],
  };

  return fieldPatterns[field].some((pattern) => pattern.test(normalized));
}

function hasFormRoutingEmailContext(value: string) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, " ");

  return [
    /\bcontact\s+form\b.{0,80}\b(?:send|sends|route|routes|forward|forwards|deliver|delivers|go|goes|email|message|messages|submission|submissions)\b/,
    /\b(?:send|route|forward|deliver)\b.{0,80}\b(?:website\s+)?(?:inquiries|messages|submissions|contact\s+form\s+submissions)\b.{0,40}\bto\b/,
    /\b(?:website\s+)?(?:inquiries|messages|submissions|contact\s+form\s+submissions)\b.{0,80}\b(?:send|route|forward|deliver|go)\b.{0,40}\bto\b/,
    /\bform\s+(?:recipient|recipients|email|emails|destination|destinations|inbox|inboxes)\b/,
    /\bwebsite\s+(?:contact\s+email|inquiry\s+email|inquiries\s+email|inquiry\s+inbox|inquiries\s+inbox|inquiry\s+recipient|inquiries\s+recipient)\b/,
    /\bcontact\s+form\s+email\b/,
    /\breply-?to\s+address\s+for\s+(?:the\s+)?form\b/,
    /\bsupport\s+inbox(?:es)?\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isClientEmailSuppressedByRoutingContext(
  rawInput: string,
  email: string | null
) {
  if (!email) {
    return false;
  }

  const raw = String(rawInput || "");
  const lowerRaw = raw.toLowerCase();
  const lowerEmail = email.toLowerCase();
  const index = lowerRaw.indexOf(lowerEmail);

  if (index === -1) {
    return hasFormRoutingEmailContext(raw);
  }

  const start = Math.max(0, index - 160);
  const end = Math.min(raw.length, index + email.length + 160);
  const localContext = raw.slice(start, end);

  return hasFormRoutingEmailContext(localContext);
}

function hasTaskCompletionCue(value: string | null) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, " ");

  return [
    /\b(?:is|are|was|were|be|been|being|has been|have been)\s+(?:approved|done|completed|complete|ready)\b/,
    /\b(?:approved|done|completed|ready)\s+now\b/,
    /\b(?:client|customer|they|he|she|we)\s+(?:approved|completed)\b/,
    /\bsigned\s+off\b/,
    /\blooks?\s+good\b/,
    /\b(?:is|are|was|were|be|been|being|seems?|looks?)\s+ready\b/,
  ].some((pattern) => pattern.test(normalized));
}

function cleanCompletionCueFromTitle(value: string) {
  const cleaned = String(value || "")
    .trim()
    .replace(
      /\b(?:is|are|was|were|be|been|being|has been|have been)\s+(?:approved|done|completed|complete)(?:\s+now)?\b/gi,
      " "
    )
    .replace(/\b(?:approved|done|completed)(?:\s+now)?\b/gi, " ")
    .replace(
      /\b(?:is|are|was|were|be|been|being|has been|have been)\s+signed\s+off(?:\s+now)?\b/gi,
      " "
    )
    .replace(/\bsigned\s+off(?:\s+now)?\b/gi, " ")
    .replace(/\blooks?\s+good(?:\s+now)?\b/gi, " ")
    .replace(
      /\b(?:is|are|was|were|be|been|being|seems?|looks?)\s+ready(?:\s+now)?\b/gi,
      " "
    )
    .replace(/\bready\s+now\b/gi, " ")
    .replace(/\bnow\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/g, "")
    .trim();

  return cleaned || value.trim();
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
    "- If the client says an existing deliverable is approved, signed off, done, completed, complete, looks good, or ready, extract that deliverable as a requestedSubtask with status \"Done\".",
    "- For completion/approval language, keep the title focused on the deliverable itself and do not include status filler like approved now, signed off, done, completed, looks good, ready, or now in the title.",
    "- Use requestedSubtasks[].status = \"Done\" for task-specific approval/completion. Only use projectChanges.status when the whole project status changed.",
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
    "- Only use clientChanges when the update explicitly changes the saved client/customer/contact record.",
    "- Do not use clientChanges just because a name, phone number, or email address appears.",
    "- Valid client record examples: client email is X, change the client email to X, update client contact email to X, the client phone is X, update client contact name to X, customer notes should say X, client notes should say X.",
    "- Website/contact-form recipient emails are project work, not client details. For example, contact form should send messages to X, send website inquiries to X, form recipient, website contact email, contact form email, reply-to address for the form, and form submissions should go to X should become requestedSubtasks, with clientChanges.email = null.",
    "- Only use clientChanges.notes for explicit client/customer record note changes, such as 'client note:', 'customer note:', 'update client notes', or 'change client notes'.",
    "- Do not put general project instructions, website form routing, goals, tone, screenshot summaries, or plain 'Note:' lines into clientChanges.",
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
    "Form routing example input:",
    "The contact form should send messages to support@example.com.",
    "",
    "Form routing example JSON:",
    "{",
    '  "summary": "Client requested the website contact form route messages to a support email address.",',
    '  "requestedSubtasks": [',
    "    {",
    '      "title": "Update contact form to send messages to support@example.com",',
    '      "description": "Client asked for the website contact form to route messages to this email address.",',
    '      "deadlineText": null,',
    '      "amount": null,',
    '      "status": null,',
    '      "priority": null',
    "    }",
    "  ],",
    '  "projectChanges": {',
    '    "deadlineText": null,',
    '    "amount": null,',
    '    "priority": null,',
    '    "status": null',
    "  },",
    '  "clientChanges": {',
    '    "clientName": null,',
    '    "contactName": null,',
    '    "phone": null,',
    '    "email": null,',
    '    "notes": null',
    "  },",
    '  "notes": [],',
    '  "confidence": 0.94',
    "}",
    "",
    "Completion example input:",
    "The homepage hero headline and subheadline are approved now.",
    "",
    "Completion example JSON:",
    "{",
    '  "summary": "Client approved the homepage hero headline and subheadline.",',
    '  "requestedSubtasks": [',
    "    {",
    '      "title": "Homepage hero headline and subheadline",',
    '      "description": "Client approved this deliverable.",',
    '      "deadlineText": null,',
    '      "amount": null,',
    '      "status": "Done",',
    '      "priority": null',
    "    }",
    "  ],",
    '  "projectChanges": {',
    '    "deadlineText": null,',
    '    "amount": null,',
    '    "priority": null,',
    '    "status": null',
    "  },",
    '  "clientChanges": {',
    '    "clientName": null,',
    '    "contactName": null,',
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

function repairFactsShape(value: ProjectUpdateExtractedFacts, rawInput: string) {
  const clientName = value.clientChanges.clientName?.trim() || null;
  const contactName = value.clientChanges.contactName?.trim() || null;
  const phone = value.clientChanges.phone?.trim() || null;
  const email = value.clientChanges.email?.trim() || null;
  const clientNotes = value.clientChanges.notes?.trim() || null;
  const hasExplicitClientName =
    clientName !== null &&
    hasExplicitClientRecordFieldIntent(rawInput, "clientName");
  const hasExplicitContactName =
    contactName !== null &&
    hasExplicitClientRecordFieldIntent(rawInput, "contactName");
  const hasExplicitPhone =
    phone !== null && hasExplicitClientRecordFieldIntent(rawInput, "phone");
  const hasExplicitEmail =
    email !== null &&
    hasExplicitClientRecordFieldIntent(rawInput, "email") &&
    !isClientEmailSuppressedByRoutingContext(rawInput, email);
  const hasExplicitClientRecordNote =
    clientNotes !== null &&
    hasExplicitClientRecordFieldIntent(rawInput, "notes");

  return {
    ...value,
    requestedSubtasks: value.requestedSubtasks.map((subtask) => {
      const title = subtask.title.trim();
      const description = subtask.description?.trim() || null;
      const hasCompletionCue =
        hasTaskCompletionCue(title) || hasTaskCompletionCue(description);

      return {
        ...subtask,
        title: hasCompletionCue ? cleanCompletionCueFromTitle(title) : title,
        description,
        deadlineText: subtask.deadlineText?.trim() || null,
        amount: subtask.amount?.trim() || null,
        status: hasCompletionCue ? "Done" : subtask.status,
      };
    }),
    projectChanges: {
      deadlineText: value.projectChanges.deadlineText?.trim() || null,
      amount: value.projectChanges.amount?.trim() || null,
      priority: value.projectChanges.priority,
      status: value.projectChanges.status,
    },
    clientChanges: {
      clientName: hasExplicitClientName ? clientName : null,
      contactName: hasExplicitContactName ? contactName : null,
      phone: hasExplicitPhone ? phone : null,
      email: hasExplicitEmail ? email : null,
      notes: hasExplicitClientRecordNote ? clientNotes : null,
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
      facts: repairFactsShape(parsedFacts.data, normalizedRawInput),
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
