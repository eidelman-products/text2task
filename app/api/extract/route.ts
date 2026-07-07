import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import {
  extractProjectFromText,
  TextExtractionError,
} from "@/lib/extraction/text-extraction.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FREE_EXTRACT_LIMIT = 30;

const ExtractRequestSchema = z.object({
  input: z.string().min(1, "Input is required"),
});

type UserPlan = "free" | "pro";

type UsageProfile = {
  userId: string;
  email: string;
  plan: UserPlan;
  extractCount: number;
};

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

function buildExtractionErrorResponse(error: TextExtractionError) {
  console.error("Text extraction failed:", {
    errorCode: error.code,
  });

  if (error.code === "invalid_model_output") {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  if (error.code === "extraction_timeout") {
    return NextResponse.json(
      { error: "Failed to extract tasks" },
      { status: 504 }
    );
  }

  if (error.code === "extraction_configuration_error") {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "Failed to extract tasks" },
    { status: 500 }
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

    let extractionResult: Awaited<ReturnType<typeof extractProjectFromText>>;

    try {
      extractionResult = await extractProjectFromText({
        input: parsedBody.data.input,
      });
    } catch (error) {
      if (error instanceof TextExtractionError) {
        return buildExtractionErrorResponse(error);
      }

      throw error;
    }

    const nextExtractCount = await incrementExtractCount(profile);
    const remainingExtracts =
      profile.plan === "pro"
        ? null
        : Math.max(FREE_EXTRACT_LIMIT - nextExtractCount, 0);

    return NextResponse.json({
      success: true,
      tasks: extractionResult.tasks,
      ...(extractionResult.project !== undefined
        ? { project: extractionResult.project }
        : {}),
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
