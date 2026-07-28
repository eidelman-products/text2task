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
const CompletionScopeSchema = z.enum(["full", "partial", "unclear"]);

const NullableStringSchema = z.string().trim().min(1).nullable();

// Evidence array elements intentionally skip `.min(1)` so a single blank
// entry from the model can't fail the whole response's zod parse -- empty
// entries are dropped during normalization in repairFactsShape instead.
const EvidenceListSchema = z.array(z.string()).default([]);

const ExtractedSubtaskFactSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: NullableStringSchema,
  deadlineText: NullableStringSchema,
  amount: NullableStringSchema,
  status: StatusSchema.nullable(),
  priority: PrioritySchema.nullable(),
  completedEvidence: EvidenceListSchema,
  incompleteEvidence: EvidenceListSchema,
  completionScope: CompletionScopeSchema.nullable(),
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

function normalizeForGroundingComparison(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Evidence excerpts are only trustworthy if they actually appear in the
 * client's own text. This is a groundedness check, not a scope/negation
 * classifier -- it never decides completion status, it only discards
 * evidence strings the model invented instead of quoting.
 */
function normalizeEvidenceEntries(values: string[], normalizedRawInput: string) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed.length > 300) continue;

    const comparable = normalizeForGroundingComparison(trimmed);
    if (!comparable || !normalizedRawInput.includes(comparable)) continue;
    if (seen.has(comparable)) continue;

    seen.add(comparable);
    result.push(trimmed);
    if (result.length >= 8) break;
  }

  return result;
}

/**
 * The model's self-reported completionScope is trusted only when it isn't
 * contradicted by its own evidence arrays, and only when there is at least
 * one grounded completedEvidence excerpt. This is the fail-safe net for
 * requirement 6 of the partial-completion fix: a proposed Done with missing
 * or self-contradictory evidence must normalize to "unclear" rather than
 * being taken at face value, so the Judge blocks it instead of an
 * automatic apply.
 */
function normalizeCompletionScope({
  status,
  modelScope,
  completedEvidence,
  incompleteEvidence,
}: {
  status: string | null;
  modelScope: "full" | "partial" | "unclear" | null;
  completedEvidence: string[];
  incompleteEvidence: string[];
}): "full" | "partial" | "unclear" | null {
  if (status !== "Done") {
    return null;
  }

  if (completedEvidence.length > 0 && incompleteEvidence.length > 0) {
    return "partial";
  }

  if (completedEvidence.length === 0) {
    return "unclear";
  }

  if (modelScope === "full") {
    return "full";
  }

  return modelScope === "partial" ? "partial" : "unclear";
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
    '      "completedEvidence": ["short verbatim excerpt(s) from the client update that support completion, or []"],',
    '      "incompleteEvidence": ["short verbatim excerpt(s) from the client update showing remaining, pending, or excluded work, or []"],',
    '      "completionScope": "full | partial | unclear | null",',
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
    "1a. Completion evidence (completedEvidence, incompleteEvidence, completionScope)",
    "- Whenever you set status to \"Done\" for a requestedSubtask, you must also fill in completedEvidence, incompleteEvidence, and completionScope for that item. For every other status, leave completedEvidence and incompleteEvidence as [] and completionScope as null.",
    "- completedEvidence: one or more short excerpts copied from the client update, as close to verbatim as possible, that state or clearly imply this deliverable (or the part of it being described) is finished/approved/signed off/ready.",
    "- incompleteEvidence: one or more short excerpts copied from the client update that show part of this same deliverable is NOT yet finished -- for example remaining work, an exception, a pending approval, or a stated fraction/quantity that is not the whole thing. Leave this [] only when nothing in the update qualifies or limits the completion claim.",
    "- Never invent, infer, or paraphrase evidence that is not actually present in the update text. If you cannot find a real excerpt, leave the array empty rather than making one up.",
    "- completionScope:",
    '  - "full" -- the entire deliverable is described as complete, with no stated exception, remaining piece, or pending step.',
    '  - "partial" -- part of the deliverable is complete while another part, aspect, or exception is still remaining, pending, or excluded, even within the same sentence.',
    '  - "unclear" -- completion language is present but the text does not make it clear whether the whole deliverable is covered.',
    "- Watch for language that limits or qualifies a completion claim even when strong completion words are also present in the same sentence -- for example: but, however, still, only, partially, not yet, remaining, except, excluding, aside from, pending, waiting on, yet to, in progress, left to do. When you see this kind of language describing the same deliverable, this is a partial completion: keep status \"Done\" only if that reflects what the text actually says about the completed part, but you must also populate incompleteEvidence and set completionScope to \"partial\". Do not silently drop the remaining/exception part.",
    "- A deliverable can be reported complete for one described component while remaining incomplete for another described component of the same deliverable (for example, one language version, platform, or section finished while another is still in progress). When that happens, extract it as ONE requestedSubtask with both completedEvidence and incompleteEvidence populated, unless the client's wording clearly describes two independent, separately-titled deliverables.",
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
    '      "completedEvidence": ["approved now"],',
    '      "incompleteEvidence": [],',
    '      "completionScope": "full",',
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
    "Partial/mixed completion example input:",
    "The English version of the brochure is complete, and the Spanish version is still in progress.",
    "",
    "Partial/mixed completion example JSON:",
    "{",
    '  "summary": "Client reported the English brochure is complete while the Spanish version is still in progress.",',
    '  "requestedSubtasks": [',
    "    {",
    '      "title": "Brochure (English and Spanish versions)",',
    '      "description": "English version of the brochure is complete; Spanish version is still in progress.",',
    '      "deadlineText": null,',
    '      "amount": null,',
    '      "status": "Done",',
    '      "completedEvidence": ["The English version of the brochure is complete"],',
    '      "incompleteEvidence": ["the Spanish version is still in progress"],',
    '      "completionScope": "partial",',
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
    '  "confidence": 0.9',
    "}",
    "",
    "Note on the partial/mixed example above: even though the status is \"Done\" and completion language is present, this is NOT a clean full completion, because the same update also states that part of the same deliverable is still in progress. That is exactly why completedEvidence, incompleteEvidence, and completionScope exist -- so the next system step can tell full completion apart from partial completion instead of only seeing a single status value.",
    "",
    "Client update input:",
    input.rawInput,
  ].join("\n");
}

function repairFactsShape(value: ProjectUpdateExtractedFacts, rawInput: string) {
  const normalizedRawInputForGrounding = normalizeForGroundingComparison(rawInput);
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

      // hasTaskCompletionCue is title-cleanup only (stripping filler like
      // "is approved now" out of the extracted title). It must never decide
      // status -- the model's own `status` field is trusted as-is, and
      // whether a Done is safe to auto-apply is decided later by the Judge,
      // based on the evidence fields normalized below.
      const hasCompletionCueForTitleCleanup =
        hasTaskCompletionCue(title) || hasTaskCompletionCue(description);

      const completedEvidence = normalizeEvidenceEntries(
        subtask.completedEvidence,
        normalizedRawInputForGrounding
      );
      const incompleteEvidence = normalizeEvidenceEntries(
        subtask.incompleteEvidence,
        normalizedRawInputForGrounding
      );

      return {
        ...subtask,
        title: hasCompletionCueForTitleCleanup
          ? cleanCompletionCueFromTitle(title)
          : title,
        description,
        deadlineText: subtask.deadlineText?.trim() || null,
        amount: subtask.amount?.trim() || null,
        status: subtask.status,
        completedEvidence,
        incompleteEvidence,
        completionScope: normalizeCompletionScope({
          status: subtask.status,
          modelScope: subtask.completionScope,
          completedEvidence,
          incompleteEvidence,
        }),
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
