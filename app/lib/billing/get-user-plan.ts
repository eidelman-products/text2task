import { createClient } from "@/lib/supabase/client";
import { Plan } from "./plan";

export async function getUserPlan(userId: string): Promise<Plan> {
  if (!userId) return "free";

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("users")
      .select("plan")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to get user plan:", error);
      return "free";
    }

    return data?.plan === "pro" ? "pro" : "free";
  } catch (error) {
    console.error("Unexpected error while getting user plan:", error);
    return "free";
  }
}