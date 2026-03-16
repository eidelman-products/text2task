import { supabaseAdmin } from "@/lib/supabase/admin";

type EnsureUserInput = {
  id: string;
  email: string;
};

export async function ensureUser({ id, email }: EnsureUserInput) {
  const { data: existingUser, error: selectError } = await supabaseAdmin
    .from("users")
    .select("id, email, plan, weekly_cleanup_used, weekly_reset_date")
    .eq("id", id)
    .maybeSingle();

  if (selectError) {
    console.error("ensureUser select error:", selectError);
    throw new Error("Failed to check user");
  }

  if (existingUser) {
    return existingUser;
  }

  const { data: newUser, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      id,
      email,
      plan: "free",
      weekly_cleanup_used: 0,
    })
    .select("id, email, plan, weekly_cleanup_used, weekly_reset_date")
    .single();

  if (insertError) {
    console.error("ensureUser insert error:", insertError);
    throw new Error("Failed to create user");
  }

  return newUser;
}