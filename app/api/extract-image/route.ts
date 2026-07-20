import { after, NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  extractProjectFromImage,
  ImageExtractionError,
} from "@/lib/extraction/image-extraction.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const FREE_EXTRACT_LIMIT = 30;

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

/**
 * Owner-analytics only. Scheduled AFTER the extraction response has already
 * been prepared, via next/server after(). Applies to both Free and Pro
 * users. Must never affect the extraction response, and must never touch
 * extract_count or Free-plan quota state -- see
 * public.record_successful_extraction() (migration
 * 202607210002_user_activity_write_rpcs.sql).
 */
function scheduleSuccessfulExtractionActivity(userId: string): void {
  try {
    after(async () => {
      try {
        await supabaseAdmin.rpc("record_successful_extraction", {
          p_user_id: userId,
        });
      } catch (error) {
        console.warn("Owner activity tracking (image extraction) failed:", {
          message:
            error instanceof Error ? error.message : "Unknown activity error",
        });
      }
    });
  } catch (error) {
    console.warn("Owner activity tracking scheduling failed:", {
      message:
        error instanceof Error ? error.message : "Unknown activity error",
    });
  }
}

function getImageExtractionErrorStatus(error: ImageExtractionError) {
  if (error.code === "image_extraction_timeout") {
    return 504;
  }

  if (error.code === "invalid_model_output") {
    return 502;
  }

  return 500;
}

function getImageExtractionClientMessage(error: ImageExtractionError) {
  if (error.code === "extraction_configuration_error") {
    return "Missing OPENAI_API_KEY";
  }

  if (error.code === "invalid_model_output") {
    return error.message === "Model returned invalid JSON"
      ? "Model returned invalid JSON"
      : "Model returned invalid structure";
  }

  return "Failed to extract tasks from image";
}

function logExtractImageFailure({
  error,
  startedAt,
}: {
  error: unknown;
  startedAt: number;
}) {
  console.error("Extract image API error:", {
    route: "image",
    category:
      error instanceof ImageExtractionError ? error.code : "unexpected_error",
    elapsedMs: Date.now() - startedAt,
  });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
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

    const extractionResult = await extractProjectFromImage({ dataUrl });

    const nextExtractCount = await incrementExtractCount(profile);
    const remainingExtracts =
      profile.plan === "pro"
        ? null
        : Math.max(FREE_EXTRACT_LIMIT - nextExtractCount, 0);

    scheduleSuccessfulExtractionActivity(profile.userId);

    return NextResponse.json({
      success: true,
      tasks: extractionResult.tasks,
      raw_input: extractionResult.raw_input,
      usage: {
        plan: profile.plan,
        extract_count: nextExtractCount,
        extract_limit: profile.plan === "pro" ? null : FREE_EXTRACT_LIMIT,
        remaining_extracts: remainingExtracts,
      },
    });
  } catch (error) {
    logExtractImageFailure({ error, startedAt });

    if (error instanceof ImageExtractionError) {
      return NextResponse.json(
        { error: getImageExtractionClientMessage(error) },
        { status: getImageExtractionErrorStatus(error) }
      );
    }

    return NextResponse.json(
      { error: "Failed to extract tasks from image" },
      { status: 500 }
    );
  }
}
