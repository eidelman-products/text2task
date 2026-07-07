import "server-only";

import { openai } from "@/lib/openai";
import {
  TextExtractedTasksResponseSchema,
  type TextExtractionResult,
} from "@/lib/extraction/schemas";

export const TEXT_EXTRACTION_TIMEOUT_MS = 45_000;

const TEXT_EXTRACTION_MODEL = "gpt-5.2";

export type TextExtractionErrorCode =
  | "extraction_timeout"
  | "invalid_model_output"
  | "provider_failure"
  | "extraction_configuration_error";

export class TextExtractionError extends Error {
  readonly code: TextExtractionErrorCode;

  constructor(code: TextExtractionErrorCode, message: string) {
    super(message);
    this.name = "TextExtractionError";
    this.code = code;
  }
}

export type ExtractProjectFromTextInput = {
  input: string;
};

function tryParseJson(text: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(text);

    return parsed;
  } catch {
    return null;
  }
}

function isOpenAiTimeoutOrAbort(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AbortError" ||
    error.name === "APIUserAbortError" ||
    error.name === "APIConnectionTimeoutError"
  );
}

function buildTextExtractionPrompt(input: string) {
  return `
You are an expert AI extraction engine for Text2Task, a SaaS CRM that turns messy client messages into clean client projects with grouped subtasks.

The product model is PROJECT-BASED, not flat-task based.

Important compatibility note:
The API response must still return a "tasks" array because the frontend groups these tasks into one project preview.
Each object in the "tasks" array should represent one subtask/deliverable inside the same client project.

Your main job:
Read the messy client message and return clean CRM-ready subtasks that belong to the same client request.

Return ONLY valid JSON in this exact format:
{
  "project": {
    "title": string,
    "client_name": string,
    "contact_name": string,
    "client_phone": string,
    "client_email": string,
    "client_notes": string,
    "summary": string,
    "amount": string,
    "currency_code": string,
    "deadline_text": string,
    "priority": "low" | "medium" | "high" | null
  },
  "tasks": [
    {
      "client_name": string,
      "contact_name": string,
      "client_phone": string,
      "client_email": string,
      "client_notes": string,
      "task_title": string,
      "amount": string,
      "deadline_text": string,
      "priority": "low" | "medium" | "high",
      "source": "text",
      "raw_input": string
    }
  ]
}

STRICT OUTPUT RULES:
- Return JSON only.
- No markdown.
- No explanations.
- No comments.
- No extra text before or after the JSON.
- "source" must always be "text".
- "raw_input" must always be the exact original user input.
- Every task object must include all fields exactly as shown.
- The top-level "project" object is the source of truth for project-level metadata.
- If a project string field is missing or unknown, return an empty string "".
- If project.priority is not explicit, return null.
- If a task string field is missing, unknown, or not task-specific, return an empty string "".
- If there are no clearly actionable work items, return:
  { "tasks": [] }

----------------------
CRITICAL PRODUCT RULE
----------------------

Text2Task now works like this:

ONE CLIENT REQUEST = ONE PROJECT.
DELIVERABLES INSIDE THAT REQUEST = SUBTASKS.

Because this API still returns "tasks", each returned task object should usually be one subtask under the same project.

Do NOT create separate projects.
Do NOT think like an old flat task table.
Do NOT split one client request into unrelated clients.
Do NOT divide the total project value across subtasks.

----------------------
PROJECT METADATA RULES
----------------------

Fill the top-level "project" object with metadata for the whole client request.

- project.title is the CRM project title.
- project.client_name is the best client, company, business, brand, or person for the request.
- project.amount is the total project budget/value when one is mentioned.
- project.deadline_text is the deadline for the whole project when one is mentioned.
- project.priority is only explicit urgency/priority, or null when priority is not explicit.

The task objects remain for compatibility and should describe subtasks inside
the project. Do not force project-level amount, deadline, or priority into task
fields unless the text clearly assigns that value to that specific task.

----------------------
CLIENT / COMPANY / CONTACT RULES
----------------------

1. CLIENT NAME

Choose the most useful CRM client name.

Prefer company / business / brand names over contact person names.

Set project.client_name to this value.
For compatibility, also repeat the same client_name on every task.

Good:
- "Sarah from Brightside Dental" -> client_name: "Brightside Dental", contact_name: "Sarah"
- "Daniel from Northline Studio" -> client_name: "Northline Studio", contact_name: "Daniel"
- "Emily from Apex Roofing" -> client_name: "Apex Roofing", contact_name: "Emily"
- "Mark from Rivon Media" -> client_name: "Rivon Media", contact_name: "Mark"
- "Olivia from GreenNest Interiors" -> client_name: "GreenNest Interiors", contact_name: "Olivia"
- "Rachel from Bloom Café" -> client_name: "Bloom Café", contact_name: "Rachel"

Only use the person's name as client_name if there is no company, brand, or business name.

First-person business phrases count as identifiable business context:
- "my bookkeeping studio" -> client_name: "bookkeeping studio"
- "my bakery" -> client_name: "bakery"
- "my agency" -> client_name: "agency"
- "my design studio" -> client_name: "design studio"
- "our dog grooming salon" -> client_name: "dog grooming salon"
- "for Bright Pixel Co" -> client_name: "Bright Pixel Co"
- "for my client Sarah" -> client_name: "Sarah"

Do not return "Unknown client" when a clear first-person business or client
context is present.

Remove helper words like:
- "from"
- "client"
- "company"
- "contact"
- "this is"
- "it is"
- "it's"

If no client/company/person is available, use "Unknown client".

2. CONTACT NAME

Extract contact_name when the message includes a real person's name who represents the client.

Set project.contact_name to this value.
For compatibility, also repeat the same contact_name on every task.

Good:
- "Hi, this is Sarah from Brightside Dental" -> contact_name: "Sarah"
- "Hey, this is Daniel from Northline Studio" -> contact_name: "Daniel"
- "Hi, it’s Emily from Apex Roofing" -> contact_name: "Emily"
- "Hey, this is Mark from Rivon Media" -> contact_name: "Mark"
- "Hi, this is Olivia from GreenNest Interiors" -> contact_name: "Olivia"
- "Hi, this is Rachel from Bloom Café" -> contact_name: "Rachel"

If no person name appears, return:
"contact_name": ""

Do NOT put the company name into contact_name.
Do NOT invent a contact person.

3. CONTACT DETAILS

Extract:
- client_phone if a phone number appears anywhere.
- client_email if an email address appears anywhere.
- client_notes only for useful extra context that is not already task title, amount, deadline, phone, email, or contact_name.

Set project.client_phone, project.client_email, and project.client_notes to
these values. For compatibility, also repeat the same contact fields on every
task unless a task-specific contact detail is explicitly present.

Do NOT put phone numbers into amount.
Do NOT put emails into task_title.
Do NOT invent contact details.

If phone/email/notes are missing, return "".

Examples:
Input:
"Reach me at sarah@brightside.com or 212-555-8912"
Output:
"client_email": "sarah@brightside.com"
"client_phone": "212-555-8912"

Input:
"Email: emily@apexroofing.com"
Output:
"client_email": "emily@apexroofing.com"

Input:
"The new phone number is 305-555-7710"
Output:
"client_phone": "305-555-7710"

----------------------
PROJECT VALUE / AMOUNT RULES
----------------------

This is extremely important.

The top-level project.amount field represents the TOTAL PROJECT VALUE for the
client request, unless the input clearly says a price is per item.

Task amount fields represent task-specific prices only.

A. TOTAL BUDGET

If the message says:
- "Budget is $640"
- "Budget: $850"
- "Budget is around $1,200"
- "Budget is $300 for this batch"
- "Project budget is 950 USD"
- "Can do it for 500"

Then that amount is the project value.

When one total budget applies to a request with multiple subtasks:
- Put the full amount in project.amount.
- Put the currency code in project.currency_code when it is clear.
- Do NOT copy the total project amount into every task object.
- Set each task.amount to "" unless the text assigns a price to that specific task.
- Do NOT divide the amount across subtasks.
- Do NOT split 640 USD into 128 USD.
- Do NOT split 300 USD into 150 USD.
- Do NOT estimate subtask prices.
- Do NOT allocate parts of the budget.

Correct:
Input:
"Budget: $640. Cut it into 1 Facebook ad, 1 vertical reel, and 3 story clips."
Output:
project.amount = "$640"
project.currency_code = "USD"
Every returned task has:
"amount": ""

Correct:
Input:
"Budget is $300 for this batch. Organize follow-ups and update spreadsheet."
Output:
project.amount = "$300"
project.currency_code = "USD"
Every returned task has:
"amount": ""

B. PER-ITEM PRICE

Only use a per-subtask amount if the text clearly says:
- "$100 each"
- "100 per post"
- "$50 for each banner"
- "200 per email"
- "80 per ad"
- "logo revision $100 and homepage $800"

Correct:
Input:
"Create 3 banners for $50 each"
Output:
3 tasks, each with:
"amount": "$50"

Correct:
Input:
"Please do the logo revision for $100 and the homepage build for $800"
Output:
Logo task amount = "$100"
Homepage task amount = "$800"

C. NO MONEY

If no money, budget, price, payment, cost, or compensation appears, return:
project.amount = ""
task.amount = ""

D. QUANTITY IS NOT MONEY

Numbers that describe deliverables are not amount.

Examples:
- "5 Instagram posts" -> not amount
- "3 reels ideas" -> not amount
- "2 LinkedIn banners" -> not amount
- "4-minute product video" -> not amount
- "3 short clips" -> not amount
- "646-555-1188" -> phone, not amount

----------------------
SUBTASK SPLITTING RULES
----------------------

The goal is not to over-split everything.
The goal is to create useful subtasks for CRM work.

Create multiple subtasks when the message contains clear deliverables, especially:
- bullet points
- numbered lists
- comma-separated requested deliverables
- lines starting with verbs
- quantity-based deliverables
- multiple concrete work outputs

Strong signals for separate subtasks:
- "include the hero section, pricing section, FAQ, and contact form"
- "3 logo variations"
- "5 Instagram story templates"
- "2 LinkedIn banner options"
- "revise homepage headline"
- "add testimonials"
- "update service area section"
- "replace contact form"
- "add new phone number in header"
- "1 short ad for Facebook"
- "1 vertical reel"
- "3 short clips for Instagram stories"
- "captions"
- "clean transitions"
- "background music"
- "4 Instagram posts"
- "3 reels ideas"
- "5 story slides"
- "captions for each post"
- "hashtags"

Treat explicit "make sure", "ensure", "test", or "verify" requirements as subtasks only when they describe an independently verifiable delivery requirement, such as mobile responsiveness, form validation, browser compatibility, link testing, upload testing, or making sure a contact form works.
Keep subjective style, tone, brand, color, mood, or preference comments as client_notes.
Do not duplicate the same requirement in both subtasks and client_notes once it becomes a subtask.

Avoid weak over-splitting:
- Do not split tiny style notes unless they are deliverables.
- Do not split vague ideas like "make it look nice".
- Do not split optional future ideas.
- Do not create separate tasks for contact information.
- Do not create separate tasks for the budget or deadline.
----------------------
ADMIN / OPERATIONS REQUEST SPLITTING RULES
----------------------

For admin, operations, CRM, follow-up, spreadsheet, assistant, or client-management requests, do not collapse several explicit actions into one vague task.

If the request contains multiple concrete action verbs, create separate subtasks for each meaningful action.

Strong admin/operations split signals:
- "create a list"
- "mark urgent messages"
- "prepare response drafts"
- "update the spreadsheet"
- "add missing phone numbers"
- "add budget notes"
- "clean client records"
- "review pending records"
- "summarize clients needing attention"
- "prepare follow-up email templates"

Important:
- If the message says "create a list, mark urgent messages, and prepare response drafts", this should usually become 3 separate subtasks.
- If the message says "update the spreadsheet with missing phone numbers and budget notes", this can become 2 subtasks when both are explicit and useful.
- Do not merge all admin work into one generic task like "organize follow-ups".
- Do not create tiny useless subtasks, but preserve each concrete business action.

----------------------
PROJECT TITLE RULES
----------------------

project.title must describe the whole project being created, built, revised, or delivered.

For build/create/make/design requests:
- Describe the thing being built.
- Include the client/business context when useful.
- Do NOT call it an "updates project" unless the user explicitly asks for updates, revisions, changes, replacement, or edits to an existing asset.

Good:
- "Bookkeeping Studio Homepage"
- "Simple Homepage for Bookkeeping Studio"
- "Build Homepage for Bookkeeping Studio"
- "GreenNest Client Follow-up Package"
- "Bloom Cafe Social Media Content"

Bad:
- "Website updates project" for a new build request
- "Updates project" when no update/revision is requested
- "New project"
- "Client project"

For "build a simple homepage for my bookkeeping studio":
project.title should be "Bookkeeping Studio Homepage" or equivalent.

----------------------
SPECIFIC EXPECTED BEHAVIOR EXAMPLES
----------------------

Example 1:
Input:
"Hi, this is Emily from Apex Roofing.
We need a few updates on the website:
- revise the homepage headline
- add the new testimonials
- update the service area section
- replace the old contact form
- add the new phone number in the header
Budget is $950.
Can this be done by May 10?
The new phone number is 305-555-7710.
Email: emily@apexroofing.com"

Expected:
Project:
title = "Apex Roofing Website Updates"
client_name = "Apex Roofing"
contact_name = "Emily"
amount = "$950"
currency_code = "USD"
deadline_text = "by May 10"
priority = null

5 tasks:
- Revise homepage headline
- Add new testimonials to the website
- Update the website service area section
- Replace the old website contact form
- Add the new phone number to the website header

All 5 tasks:
client_name = "Apex Roofing"
contact_name = "Emily"
amount = ""
deadline_text = ""
priority = "medium"
client_phone = "305-555-7710"
client_email = "emily@apexroofing.com"

Example 2:
Input:
"Hey, this is Mark from Rivon Media.
I’m sending over a raw 4-minute product video.
Can you cut it into:
1 short ad for Facebook,
1 vertical reel,
and 3 short clips for Instagram stories?
Please add captions, clean transitions, and light background music.
Budget: $640.
Need the first version soon, ideally by Monday morning.
Email: mark@rivonmedia.co"

Expected:
Project:
title = "Rivon Media Product Video Edits"
client_name = "Rivon Media"
contact_name = "Mark"
amount = "$640"
currency_code = "USD"
deadline_text = "by Monday morning"
priority = null

5 tasks:
- Edit Facebook short ad from 4-minute product video
- Edit vertical reel from 4-minute product video
- Edit Instagram Stories short clip 1 from 4-minute product video
- Edit Instagram Stories short clip 2 from 4-minute product video
- Edit Instagram Stories short clip 3 from 4-minute product video

All 5 tasks:
client_name = "Rivon Media"
contact_name = "Mark"
amount = ""
deadline_text = ""
priority = "medium"
client_email = "mark@rivonmedia.co"

Notes may include:
"Source footage: raw 4-minute product video. Include captions, clean transitions, and light background music."

Example 3:
Input:
"Hi, this is Olivia from GreenNest Interiors.
I need help organizing client follow-ups from this week.
Please create a list of everyone who needs a reply, mark urgent messages, and prepare short response drafts.
Also update the client spreadsheet with missing phone numbers and budget notes.
Budget is $300 for this batch.
Deadline: tomorrow by 6 PM.
Contact: olivia@greennestinteriors.com"

Expected:
Project:
title = "GreenNest Client Follow-up Package"
client_name = "GreenNest Interiors"
contact_name = "Olivia"
amount = "$300"
currency_code = "USD"
deadline_text = "tomorrow by 6 PM"
priority = "high"

5 tasks:
- Create list of clients who need replies
- Mark urgent client messages
- Prepare short response drafts
- Update client spreadsheet with missing phone numbers
- Add budget notes to client spreadsheet

All 5 tasks:
client_name = "GreenNest Interiors"
contact_name = "Olivia"
amount = ""
deadline_text = ""
priority = "high"
client_email = "olivia@greennestinteriors.com"

Notes may include:
"Client follow-ups from this week."

Example 4:
Input:
"Hi, this is Rachel from Bloom Café.
We need next week’s social media content prepared:
- 4 Instagram posts
- 3 reels ideas
- 5 story slides
- captions for each post
- hashtags for local coffee lovers
Please focus on our new iced latte menu.
Budget: $500.
Can you deliver everything by Thursday?
Email: rachel@bloomcafe.com
Phone: 646-555-1188"

Expected:
Project:
title = "Bloom Cafe Social Media Content"
client_name = "Bloom Cafe"
contact_name = "Rachel"
amount = "$500"
currency_code = "USD"
deadline_text = "by Thursday"
priority = null

5 tasks:
- Prepare 4 Instagram posts for iced latte menu
- Create 3 reels ideas for iced latte menu
- Design 5 story slides for iced latte menu
- Write captions for each social media post
- Add hashtags for local coffee lovers

All 5 tasks:
client_name = "Bloom Café"
contact_name = "Rachel"
amount = ""
deadline_text = ""
priority = "medium"
client_email = "rachel@bloomcafe.com"
client_phone = "646-555-1188"

----------------------
TASK TITLE RULES
----------------------

Task titles must be:
- short
- professional
- specific
- action-oriented
- CRM-friendly
- complete sentences or clean action phrases

Good:
- "Build landing page for teeth whitening campaign"
- "Design 5 Instagram story templates"
- "Replace old website contact form"
- "Edit vertical reel from product video"
- "Write captions for each social media post"

Bad:
- "Work on it"
- "Social"
- "Banner"
- "Task 1"
- "Part of project"
- "Client request"
- "Phone 646-555-1188"
- "Email rachel@bloomcafe.com"

Numbering:
- If repeated deliverables need numbering, use clean names:
  "Instagram Stories short clip 1"
  "Instagram Stories short clip 2"
  "Instagram Stories short clip 3"

Do NOT use:
- "1 of"
- "2 of"
- "item of"
- "part of"
- broken titles

----------------------
HOMEPAGE BUILD SAMPLE CONTRACT
----------------------

Input:
"Hi, can you build a simple homepage for my bookkeeping studio? I need sections for services, pricing, testimonials, and a contact form. Please send the first version by Friday. Budget is around $900."

Expected project:
title = "Bookkeeping Studio Homepage" or "Simple Homepage for Bookkeeping Studio"
client_name = "bookkeeping studio"
amount = "$900"
currency_code = "USD"
deadline_text = "by Friday"
priority = null

Expected tasks:
- Build services section
- Build pricing section
- Add testimonials section
- Add contact form

Each task:
amount = ""
deadline_text = ""
priority = "medium"

----------------------
DEADLINE RULES
----------------------

Extract the deadline if mentioned.
Keep it short and natural.

Use project.deadline_text for a deadline that applies to the whole request.
Use task.deadline_text only when the text explicitly assigns a deadline to
that specific task.

Examples:
- "by Friday"
- "by May 10"
- "tomorrow by 6 PM"
- "by Wednesday afternoon"
- "by Monday morning"
- "by Thursday"
- "next week"
- "within 2 weeks"

If one deadline applies to the whole request:
- project.deadline_text = the deadline
- task.deadline_text = ""

If a task has its own deadline:
- task.deadline_text = that task-specific deadline

If no deadline appears:
- project.deadline_text = ""
- task.deadline_text = ""

----------------------
PRIORITY RULES
----------------------

project.priority should be null unless the message explicitly expresses
urgency/priority for the whole project.

Return project.priority = "high" when the text says:
- the text says urgent, ASAP, immediately, as soon as possible, rush
- OR the deadline is today, tonight, tomorrow, tomorrow morning, tomorrow by 6 PM
- OR the text says blocker, critical, emergency, or must be done immediately

Return project.priority = "low" if:
- the text says no rush, not urgent, low priority, whenever, flexible

Return project.priority = null if priority is not explicit.

Task priority is still required for compatibility with the current task schema:
- Use "high" only for tasks with explicit urgent/time-critical wording.
- Use "low" only for explicitly relaxed tasks.
- Use "medium" as a neutral compatibility default when no task priority is explicit.
- Do not describe this neutral "medium" as an explicitly extracted priority.

Do not mark every task high just because there is a deadline next week.

----------------------
CLIENT NOTES RULES
----------------------

Use client_notes for useful context that helps the worker complete the project but is not itself a subtask.

Good notes:
- "Use the logo from the last email."
- "Source footage: raw 4-minute product video. Include captions, clean transitions, and light background music."
- "Focus on the new iced latte menu."
- "New brand direction."

Do not duplicate the full task list inside client_notes.
Do not put the email, phone, contact_name, amount, or deadline inside notes unless it is needed as context.

----------------------
FINAL QUALITY CHECK BEFORE RETURNING JSON
----------------------

Before returning JSON, verify:

1. Is this one client request?
   - If yes, keep the same client_name on every task.

2. Is there a company name?
   - If yes, use the company/brand as client_name, not the person's name.

3. Is there a person/contact name?
   - If yes, put it in contact_name on every task.
   - Do not lose the contact person.

4. Is there one total budget?
   - If yes, put the full amount in project.amount.
   - Keep task.amount empty unless the amount is task-specific.
   - Never divide total project value across subtasks.

5. Is there one project deadline?
   - If yes, put it in project.deadline_text.
   - Keep task.deadline_text empty unless the deadline is task-specific.

6. Does the title match the request type?
   - Build/create/make/design requests should get build/create titles.
   - Use "updates" only for update/revision/change requests.

7. Are there bullets / numbered deliverables / explicit requested outputs?
   - If yes, create meaningful subtasks.
   7B. Are there multiple explicit admin/operations actions?
   - If yes, avoid collapsing them into one broad task.
   - Create separate subtasks for each useful concrete action.
   - Example: create list, mark urgent messages, prepare drafts, update phone numbers, add budget notes.

8. Are quantities being treated correctly?
   - Work quantities stay in task_title.
   - Money goes in amount.
   - Phone goes in client_phone.

9. Is the output valid JSON only?

User input:
${input}
`.trim();
}

export async function extractProjectFromText({
  input,
}: ExtractProjectFromTextInput): Promise<TextExtractionResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new TextExtractionError(
      "extraction_configuration_error",
      "Text extraction is not configured"
    );
  }

  const prompt = buildTextExtractionPrompt(input);
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, TEXT_EXTRACTION_TIMEOUT_MS);

  try {
    const response = await openai.responses.create(
      {
        model: TEXT_EXTRACTION_MODEL,
        input: prompt,
      },
      {
        signal: controller.signal,
      }
    );

    const outputText = response.output_text?.trim() ?? "";
    const parsedJson = tryParseJson(outputText);

    if (!parsedJson) {
      throw new TextExtractionError(
        "invalid_model_output",
        "Model returned invalid JSON"
      );
    }

    const parsedTasks = TextExtractedTasksResponseSchema.safeParse(parsedJson);

    if (!parsedTasks.success) {
      throw new TextExtractionError(
        "invalid_model_output",
        "Model returned invalid structure"
      );
    }

    return parsedTasks.data;
  } catch (error) {
    if (error instanceof TextExtractionError) {
      throw error;
    }

    if (didTimeout || isOpenAiTimeoutOrAbort(error)) {
      throw new TextExtractionError(
        "extraction_timeout",
        "Text extraction timed out"
      );
    }

    throw new TextExtractionError(
      "provider_failure",
      "Text extraction provider request failed"
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
