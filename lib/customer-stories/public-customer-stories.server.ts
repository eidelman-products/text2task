import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export type PublicCustomerStory = {
  id: string;
  displayName: string;
  roleOrBusinessType: string | null;
  feedbackText: string;
};

type PublicCustomerStoryRow = {
  id: string;
  display_name: string;
  role_or_business_type: string | null;
  feedback_text: string;
};

const PUBLIC_CUSTOMER_STORIES_CACHE_TAG = "public-customer-stories";
const PUBLIC_CUSTOMER_STORIES_REVALIDATE_SECONDS = 60 * 60;
const DEFAULT_LIMIT = 3;
const MIN_LIMIT = 1;
const MAX_LIMIT = 6;

function clampPublicCustomerStoryLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(limit)));
}

function createPublicSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment configuration.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchPublicCustomerStories(
  limit: number
): Promise<PublicCustomerStory[]> {
  const supabase = createPublicSupabaseClient();

  const { data, error } = await supabase
    .from("customer_stories")
    .select(
      `
        id,
        display_name,
        role_or_business_type,
        feedback_text
      `
    )
    .eq("public_permission", true)
    .eq("is_approved", true)
    .order("is_featured", { ascending: false })
    .order("approved_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PublicCustomerStoryRow[]>();

  if (error) {
    throw new Error(`Failed to load public customer stories: ${error.message}`);
  }

  return (data ?? []).map((story) => ({
    id: story.id,
    displayName: story.display_name,
    roleOrBusinessType: story.role_or_business_type,
    feedbackText: story.feedback_text,
  }));
}

const getCachedPublicCustomerStories = unstable_cache(
  async (limit: number) => fetchPublicCustomerStories(limit),
  [PUBLIC_CUSTOMER_STORIES_CACHE_TAG],
  {
    revalidate: PUBLIC_CUSTOMER_STORIES_REVALIDATE_SECONDS,
    tags: [PUBLIC_CUSTOMER_STORIES_CACHE_TAG],
  }
);

export async function getPublicCustomerStories(
  limit = DEFAULT_LIMIT
): Promise<PublicCustomerStory[]> {
  return getCachedPublicCustomerStories(clampPublicCustomerStoryLimit(limit));
}
