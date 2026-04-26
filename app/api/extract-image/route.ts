import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FREE_EXTRACT_LIMIT = 30;

const ExtractedTaskSchema = z.object({
  client_name: z.string(),
  task_title: z.string(),
  amount: z.string(),
  deadline_text: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  source: z.literal("image"),
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
            // Safe to ignore in route handlers where cookies may be read-only.
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

    const formData = await req.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const prompt = `
You are an AI assistant that extracts structured tasks from uploaded images for a CRM system.

Your job:
Analyze the uploaded image and convert any visible client request, message, screenshot, note, email, chat, or work brief into a clean list of actionable tasks.

Important:
Text inside images may be short, messy, incomplete, unpunctuated, or formatted like notes, bullets, screenshots, or chat snippets.
You must still infer the most realistic structured tasks without inventing unsupported details.

Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "client_name": string,
      "task_title": string,
      "amount": string,
      "deadline_text": string,
      "priority": "low" | "medium" | "high",
      "source": "image",
      "raw_input": "Extracted from uploaded image"
    }
  ]
}

STRICT OUTPUT RULES:
- Return JSON only
- No markdown
- No explanations
- No comments
- No extra text before or after the JSON
- "source" must always be "image"
- "raw_input" must always be exactly "Extracted from uploaded image"
- If there are no clearly actionable tasks, return:
  { "tasks": [] }

----------------------
CORE RULES
----------------------

1. TASK SPLITTING
- Extract multiple tasks ONLY if they are clearly separate actionable deliverables or work items.
- Do NOT split ideas, suggestions, optional thoughts, or vague future possibilities into separate tasks.
- Avoid over-splitting.
- If unclear, prefer fewer, higher-quality tasks.
- If multiple details belong to one package/service, keep them as one task.

Examples:
- "need logo + landing page + banner" -> 3 tasks
- "need branding package including logo, colors, typography" -> 1 task
- "maybe later also do social media" -> do NOT create a separate task unless it is clearly requested as real work

2. CLIENT NAME
- Extract the most useful clean client name if mentioned.
- Remove helper words like "client", "company", "from", "contact".
- If missing, use "Unknown client".

3. TASK TITLE
- Must be clear, specific, short, and professional.
- Rewrite messy image text into a clean actionable task title.
- Keep quantity inside the title when quantity describes the work itself.
- Avoid vague titles.

Good examples:
- "Design website banner for homepage"
- "Write 2 marketing emails for campaign"
- "Build landing page"

Bad examples:
- "Banner"
- "Emails"
- "Work on project"

4. AMOUNT LOGIC (VERY IMPORTANT)

You must clearly distinguish between:
- MONEY / PRICE / BUDGET / PAYMENT / COST / COMPENSATION -> amount
- QUANTITY OF WORK / NUMBER OF ITEMS -> NOT amount

IMPORTANT:
- Return amount as TEXT, not as a number.
- Preserve the original money expression when possible.
- Keep currency if it exists.
- Good outputs:
  "$500"
  "500 USD"
  "1,200 EUR"
  "₪700"
- If there is no money amount, return "".

Examples:
- "5 Instagram posts" -> amount = ""
- "2 emails" -> amount = ""
- "budget $500" -> amount = "$500"
- "paying 200" -> amount = "200"
- "600 dollars" -> amount = "600 dollars"
- "1,200 EUR" -> amount = "1,200 EUR"

A. PER-ITEM / EACH LOGIC
If the image text clearly says that a money amount is PER ITEM, PER TASK, or EACH, such as:
- "$100 each"
- "100 per post"
- "200 per email"
- "$50 for each banner"
- "3 ads, 80 each"

Then:
- treat that money as the amount for each matching task
- if the quantity refers to multiple separate deliverables, create multiple tasks when appropriate
- each created task should carry that per-item amount as text

Example:
"Write 2 emails for $100 each"
-> 2 tasks
-> each task amount = "$100"

If the work is naturally better represented as separate repeated tasks, split it.
If the work is naturally one grouped deliverable, keep one task title with quantity in title only when that is clearly better.
But when the text explicitly says "each" or "per item", prefer separate tasks when possible.

B. TOTAL BUDGET LOGIC
If one total budget is mentioned for multiple tasks:
- do NOT copy the full amount to every task
- split it intelligently between tasks
- if tasks look equal in size/effort -> split evenly
- if tasks are clearly uneven -> estimate a more realistic split
- bigger deliverables should receive a larger share
- smaller/simple tasks should receive a smaller share
- amounts should add up approximately to the total mentioned budget
- if unsure, split evenly
- preserve currency if mentioned

Example:
"Mike needs a landing page and 2 emails, budget 2000 USD, not urgent"
Good output amounts:
- landing page -> "1500 USD"
- 2 emails -> "500 USD"

C. NO MONEY
If no money amount is mentioned, use "".

5. QUANTITY VS MONEY
- Numbers describing work quantity must stay in the task title, not in amount.
- Numbers describing payment must go to amount.
- If both exist, preserve both correctly.

Examples:
- "Create 3 banners for $50 each"
  -> quantity = 3 deliverables
  -> amount per task = "$50"
- "Write 2 emails for a total budget of $100"
  -> 2 work items
  -> total budget = "$100"
  -> split intelligently
- "Need 5 posts"
  -> amount = ""

6. DEADLINE
- Extract deadline if mentioned.
- Keep it as short natural text.
- Examples:
  - "by Friday"
  - "by May 1st"
  - "tomorrow"
  - "next week"
  - "within 2 weeks"
- If one deadline applies to all tasks, copy it to all relevant tasks.
- If none is mentioned, return "".

7. PRIORITY
Set priority using smart judgment:

Return "high" if:
- the text includes urgency words like: urgent, ASAP, immediately, as soon as possible
- OR the deadline is extremely soon: today, tonight, tomorrow

Return "low" if:
- the text clearly says: no rush, not urgent, low priority, whenever

Return "medium" if:
- there is a deadline but it is not urgent
- OR the task seems normal business priority

8. QUALITY BAR
- Prefer fewer, stronger tasks over many weak ones.
- Preserve the real business meaning.
- Keep outputs CRM-friendly and realistic.
- Do not invent details that are not supported by the image.

9. REPEATED DELIVERABLES
When the image text contains repeated deliverables with explicit per-item pricing, such as:
- "2 emails for $100 each"
- "3 banners at $50 each"
- "4 posts, $30 per post"

Prefer:
- splitting into separate tasks when that makes the CRM more actionable
- each task should have its own amount
- each task title should stay clear and natural

Good examples:
- "Write marketing email 1"
- "Write marketing email 2"
- "Design banner 1"
- "Design banner 2"

Do NOT create awkward robotic titles if a cleaner title is possible.

TITLE CLEANUP RULE (VERY IMPORTANT):
- Never generate incomplete or broken titles.
- Do NOT use phrases like:
  "1 of", "2 of", "part of", "item of"
- If numbering is needed, use clean formats:
  "Email 1", "Email 2"
  "Banner 1", "Banner 2"
- Titles must always be complete and natural.
- If unsure, prefer removing numbering over producing a broken title.
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5.4",
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
    console.error("Extract image API error:", error);

    return NextResponse.json(
      { error: "Failed to extract tasks from image" },
      { status: 500 }
    );
  }
}