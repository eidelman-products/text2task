export type Plan = "free" | "pro";

export const FREE_WEEKLY_LIMIT = 250;

export function isPro(plan: Plan) {
  return plan === "pro";
}

export function getWeeklyLimit(plan: Plan) {
  return plan === "pro" ? Infinity : FREE_WEEKLY_LIMIT;
}

export function canCleanEmails(plan: Plan, requested: number, remaining: number) {
  if (plan === "pro") return true;
  return requested <= remaining;
}