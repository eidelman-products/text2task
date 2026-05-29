import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SubmitCustomerStorySchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  roleOrBusinessType: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => {
      const clean = String(value || "").trim();
      return clean ? clean : null;
    }),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  feedbackText: z.string().trim().min(20).max(1200),
  publicPermission: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  const parsed = SubmitCustomerStorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const {
    displayName,
    roleOrBusinessType,
    rating,
    feedbackText,
    publicPermission,
  } = parsed.data;

  const { data: story, error: insertError } = await supabase
    .from("customer_stories")
    .insert({
      user_id: user.id,
      display_name: displayName,
      role_or_business_type: roleOrBusinessType,
      rating: rating ?? null,
      feedback_text: feedbackText,
      public_permission: publicPermission,

      // Approval fields are always controlled by the server/admin flow.
      // The client can never approve or feature its own story.
      is_approved: false,
      is_featured: false,
      approved_at: null,
    })
    .select(
      `
        id,
        display_name,
        role_or_business_type,
        rating,
        feedback_text,
        public_permission,
        is_approved,
        is_featured,
        created_at
      `
    )
    .single();

  if (insertError) {
    console.error("customer story submit insert error:", insertError);

    return NextResponse.json(
      {
        error: "Failed to submit feedback",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    story,
    message:
      "Thanks — your feedback was sent for review. If you allowed public display, it may appear after approval.",
  });
}