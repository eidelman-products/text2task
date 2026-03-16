import { ensureUser } from "@/lib/supabase/ensureUser";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CleanupStatus = {
  userId: string;
  email: string;
  plan: string;
  weekly_cleanup_used: number;
  weekly_reset_date: string;
  remaining: number;
  limit: number | null;
};

const FREE_WEEKLY_LIMIT = 250;

function getNextWeeklyResetDate() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return next.toISOString();
}

export async function getCleanupStatus(
  userId: string,
  email: string
): Promise<CleanupStatus> {
  const user = await ensureUser({ id: userId, email });

  let weeklyUsed = user.weekly_cleanup_used ?? 0;
  let weeklyResetDate = user.weekly_reset_date ?? getNextWeeklyResetDate();
  const plan = user.plan ?? "free";

  const now = new Date();
  const resetDate = new Date(weeklyResetDate);

  if (resetDate <= now) {
    const nextReset = getNextWeeklyResetDate();

    const { data: updatedUser, error } = await supabaseAdmin
      .from("users")
      .update({
        weekly_cleanup_used: 0,
        weekly_reset_date: nextReset,
      })
      .eq("id", userId)
      .select("id, email, plan, weekly_cleanup_used, weekly_reset_date")
      .single();

    if (error) {
      console.error("quota reset error:", error);
      throw new Error("Failed to reset weekly cleanup quota");
    }

    weeklyUsed = updatedUser.weekly_cleanup_used ?? 0;
    weeklyResetDate = updatedUser.weekly_reset_date ?? nextReset;
  }

  if (plan === "pro") {
    return {
      userId,
      email,
      plan,
      weekly_cleanup_used: weeklyUsed,
      weekly_reset_date: weeklyResetDate,
      remaining: Number.MAX_SAFE_INTEGER,
      limit: null,
    };
  }

  const remaining = Math.max(0, FREE_WEEKLY_LIMIT - weeklyUsed);

  return {
    userId,
    email,
    plan,
    weekly_cleanup_used: weeklyUsed,
    weekly_reset_date: weeklyResetDate,
    remaining,
    limit: FREE_WEEKLY_LIMIT,
  };
}

export async function addCleanupUsage(userId: string, amount: number) {
  if (amount <= 0) return;

  const { data: currentUser, error: selectError } = await supabaseAdmin
    .from("users")
    .select("plan, weekly_cleanup_used")
    .eq("id", userId)
    .single();

  if (selectError) {
    console.error("addCleanupUsage select error:", selectError);
    throw new Error("Failed to load user cleanup usage");
  }

  if (currentUser.plan === "pro") {
    return;
  }

  const currentUsed = currentUser.weekly_cleanup_used ?? 0;

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({
      weekly_cleanup_used: currentUsed + amount,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("addCleanupUsage update error:", updateError);
    throw new Error("Failed to update cleanup usage");
  }
}