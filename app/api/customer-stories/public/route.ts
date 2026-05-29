import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicCustomerStoryRow = {
  id: string;
  display_name: string;
  role_or_business_type: string | null;
  rating: number | null;
  feedback_text: string;
  is_featured: boolean;
  approved_at: string | null;
  created_at: string;
};

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_stories")
    .select(
      `
        id,
        display_name,
        role_or_business_type,
        rating,
        feedback_text,
        is_featured,
        approved_at,
        created_at
      `
    )
    .eq("public_permission", true)
    .eq("is_approved", true)
    .order("is_featured", { ascending: false })
    .order("approved_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("customer stories public fetch error:", error);

    return NextResponse.json(
      {
        error: "Failed to load customer stories",
      },
      { status: 500 }
    );
  }

  const stories = ((data || []) as PublicCustomerStoryRow[]).map((story) => ({
    id: story.id,
    displayName: story.display_name,
    roleOrBusinessType: story.role_or_business_type,
    rating: story.rating,
    feedbackText: story.feedback_text,
    isFeatured: story.is_featured,
    approvedAt: story.approved_at,
    createdAt: story.created_at,
  }));

  return NextResponse.json({
    stories,
  });
}