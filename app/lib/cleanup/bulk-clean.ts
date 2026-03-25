import { Plan, canCleanEmails } from "@/app/lib/billing/plan";

type Sender = {
  ids?: string[];
  count: number;
};

export function prepareBulkClean(
  rows: Sender[],
  plan: Plan,
  remaining: number
) {
  const ids = rows.flatMap((r) => r.ids || []);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (!ids.length) {
    throw new Error("No emails found");
  }

  if (!canCleanEmails(plan, total, remaining)) {
    throw new Error(
      `Free plan limit reached (${remaining} left). Upgrade to Pro.`
    );
  }

  return {
    ids,
    total,
  };
}