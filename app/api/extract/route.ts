import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FREE_EXTRACT_LIMIT = 30;

const ExtractRequestSchema = z.object({
  input: z.string().min(1, "Input is required"),
});

const ExtractedTaskSchema = z.object({
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

const ExtractedTasksResponseSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
});

type UserPlan = "free" | "pro";

type UsageProfile = {
  userId: string;
  email: string;
  plan: UserPlan;
  extractCount: number;
};

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe to ignore in route handlers where cookies are read-only.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getOrCreateUsageProfile(): Promise<UsageProfile | null> {
  const user = await getAuthenticatedUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,email,plan,extract_count,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to read user usage profile:", error);
    throw new Error("Failed to read user usage profile");
  }

  if (!data) {
    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: user.id,
        email: user.email,
        plan: "free",
        extract_count: 0,
        subscription_status: "free",
      })
      .select("id,email,plan,extract_count,subscription_status")
      .single();

    if (insertError || !insertedUser) {
      console.error("Failed to create user usage profile:", insertError);
      throw new Error("Failed to create user usage profile");
    }

    return {
      userId: insertedUser.id,
      email: insertedUser.email,
      plan: "free",
      extractCount: insertedUser.extract_count ?? 0,
    };
  }

  const isPro = data.plan === "pro" || data.subscription_status === "active";

  return {
    userId: data.id,
    email: data.email,
    plan: isPro ? "pro" : "free",
    extractCount: data.extract_count ?? 0,
  };
}

function buildLimitResponse(profile: UsageProfile) {
  return NextResponse.json(
    {
      success: false,
      error: "FREE_EXTRACT_LIMIT_REACHED",
      message:
        "You have used all 30 free extracts. Upgrade to Pro to continue extracting tasks.",
      plan: profile.plan,
      extract_count: profile.extractCount,
      extract_limit: FREE_EXTRACT_LIMIT,
      remaining_extracts: 0,
      upgrade_required: true,
    },
    { status: 402 }
  );
}

async function incrementExtractCount(profile: UsageProfile) {
  if (profile.plan === "pro") {
    return profile.extractCount;
  }

  const nextCount = profile.extractCount + 1;

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      extract_count: nextCount,
    })
    .eq("id", profile.userId);

  if (error) {
    console.error("Failed to increment extract count:", error);
    throw new Error("Failed to update extract usage");
  }

  return nextCount;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const profile = await getOrCreateUsageProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      profile.plan === "free" &&
      profile.extractCount >= FREE_EXTRACT_LIMIT
    ) {
      return buildLimitResponse(profile);
    }

    const body = await req.json();
    const parsedBody = ExtractRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { input } = parsedBody.data;

    const prompt = `
You are an expert AI extraction engine for Text2Task, a SaaS CRM that turns messy client messages into clean client projects with grouped subtasks.

The product model is PROJECT-BASED, not flat-task based.

Important compatibility note:
The API response must still return a "tasks" array because the frontend groups these tasks into one project preview.
Each object in the "tasks" array should represent one subtask/deliverable inside the same client project.

Your main job:
Read the messy client message and return clean CRM-ready subtasks that belong to the same client request.

Return ONLY valid JSON in this exact format:
{
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
- If a field is missing or unknown, return an empty string "".
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
CLIENT / COMPANY / CONTACT RULES
----------------------

1. CLIENT NAME

Choose the most useful CRM client name.

Prefer company / business / brand names over contact person names.

Good:
- "Sarah from Brightside Dental" -> client_name: "Brightside Dental", contact_name: "Sarah"
- "Daniel from Northline Studio" -> client_name: "Northline Studio", contact_name: "Daniel"
- "Emily from Apex Roofing" -> client_name: "Apex Roofing", contact_name: "Emily"
- "Mark from Rivon Media" -> client_name: "Rivon Media", contact_name: "Mark"
- "Olivia from GreenNest Interiors" -> client_name: "GreenNest Interiors", contact_name: "Olivia"
- "Rachel from Bloom Café" -> client_name: "Bloom Café", contact_name: "Rachel"

Only use the person's name as client_name if there is no company, brand, or business name.

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

The "amount" field represents the TOTAL PROJECT VALUE for the client request, unless the input clearly says a price is per item.

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
- Copy the SAME total amount into every returned task object.
- Do NOT divide the amount across subtasks.
- Do NOT split 640 USD into 128 USD.
- Do NOT split 300 USD into 150 USD.
- Do NOT estimate subtask prices.
- Do NOT allocate parts of the budget.

Correct:
Input:
"Budget: $640. Cut it into 1 Facebook ad, 1 vertical reel, and 3 story clips."
Output:
Every returned task has:
"amount": "$640"

Correct:
Input:
"Budget is $300 for this batch. Organize follow-ups and update spreadsheet."
Output:
Every returned task has:
"amount": "$300"

B. PER-ITEM PRICE

Only use a per-subtask amount if the text clearly says:
- "$100 each"
- "100 per post"
- "$50 for each banner"
- "200 per email"
- "80 per ad"

Correct:
Input:
"Create 3 banners for $50 each"
Output:
3 tasks, each with:
"amount": "$50"

C. NO MONEY

If no money, budget, price, payment, cost, or compensation appears, return:
"amount": ""

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
5 tasks:
- Revise homepage headline
- Add new testimonials to the website
- Update the website service area section
- Replace the old website contact form
- Add the new phone number to the website header

All 5 tasks:
client_name = "Apex Roofing"
contact_name = "Emily"
amount = "$950"
deadline_text = "by May 10"
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
5 tasks:
- Edit Facebook short ad from 4-minute product video
- Edit vertical reel from 4-minute product video
- Edit Instagram Stories short clip 1 from 4-minute product video
- Edit Instagram Stories short clip 2 from 4-minute product video
- Edit Instagram Stories short clip 3 from 4-minute product video

All 5 tasks:
client_name = "Rivon Media"
contact_name = "Mark"
amount = "$640"
deadline_text = "by Monday morning"
priority = "medium" or "high"
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
5 tasks:
- Create list of clients who need replies
- Mark urgent client messages
- Prepare short response drafts
- Update client spreadsheet with missing phone numbers
- Add budget notes to client spreadsheet

All 5 tasks:
client_name = "GreenNest Interiors"
contact_name = "Olivia"
amount = "$300"
deadline_text = "tomorrow by 6 PM"
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
5 tasks:
- Prepare 4 Instagram posts for iced latte menu
- Create 3 reels ideas for iced latte menu
- Design 5 story slides for iced latte menu
- Write captions for each social media post
- Add hashtags for local coffee lovers

All 5 tasks:
client_name = "Bloom Café"
contact_name = "Rachel"
amount = "$500"
deadline_text = "by Thursday"
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
DEADLINE RULES
----------------------

Extract the deadline if mentioned.
Keep it short and natural.

Examples:
- "by Friday"
- "by May 10"
- "tomorrow by 6 PM"
- "by Wednesday afternoon"
- "by Monday morning"
- "by Thursday"
- "next week"
- "within 2 weeks"

If one deadline applies to the whole request, copy it to every task object.
If no deadline appears, return "".

----------------------
PRIORITY RULES
----------------------

Return "high" if:
- the text says urgent, ASAP, immediately, as soon as possible, rush
- OR the deadline is today, tonight, tomorrow, tomorrow morning, tomorrow by 6 PM
- OR the message clearly sounds time-critical

Return "low" if:
- the text says no rush, not urgent, low priority, whenever, flexible

Return "medium" if:
- there is a normal deadline
- OR the task seems like normal business work

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
   - If yes, copy the same full amount to every task.
   - Never divide total project value across subtasks.

5. Are there bullets / numbered deliverables / explicit requested outputs?
   - If yes, create meaningful subtasks.
   5B. Are there multiple explicit admin/operations actions?
   - If yes, avoid collapsing them into one broad task.
   - Create separate subtasks for each useful concrete action.
   - Example: create list, mark urgent messages, prepare drafts, update phone numbers, add budget notes.

6. Are quantities being treated correctly?
   - Work quantities stay in task_title.
   - Money goes in amount.
   - Phone goes in client_phone.

7. Is the output valid JSON only?

User input:
${input}
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5.2",
      input: prompt,
    });

    const outputText = response.output_text?.trim() ?? "";
    const parsedJson = tryParseJson(outputText);

    if (!parsedJson) {
      return NextResponse.json(
        {
          error: "Model returned invalid JSON",
          raw: outputText,
        },
        { status: 502 }
      );
    }

    const parsedTasks = ExtractedTasksResponseSchema.safeParse(parsedJson);

    if (!parsedTasks.success) {
      return NextResponse.json(
        {
          error: "Model returned invalid structure",
          raw: parsedJson,
          details: parsedTasks.error.flatten(),
        },
        { status: 502 }
      );
    }

    const nextExtractCount = await incrementExtractCount(profile);
    const remainingExtracts =
      profile.plan === "pro"
        ? null
        : Math.max(FREE_EXTRACT_LIMIT - nextExtractCount, 0);

    return NextResponse.json({
      success: true,
      tasks: parsedTasks.data.tasks,
      usage: {
        plan: profile.plan,
        extract_count: nextExtractCount,
        extract_limit: profile.plan === "pro" ? null : FREE_EXTRACT_LIMIT,
        remaining_extracts: remainingExtracts,
      },
    });
  } catch (error) {
    console.error("Extract API error:", error);

    return NextResponse.json(
      { error: "Failed to extract tasks" },
      { status: 500 }
    );
  }
}