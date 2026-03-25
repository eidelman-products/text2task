import { Plan } from "./plan";

// ⚠️ זמני – בהמשך נחליף ל-DB / Stripe
export async function getUserPlan(userId: string): Promise<Plan> {
  // TODO: להביא מ-Supabase / Stripe
  return "free";
}