import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

type TaskRow = {
  id: number;
  amount: string | null;
  amount_value: number | null;
  currency_code: string | null;
};

function parseAmount(amount: string | null): {
  amount_value: number | null;
  currency_code: string | null;
} {
  if (!amount) {
    return {
      amount_value: null,
      currency_code: null,
    };
  }

  const raw = amount.trim();

  if (!raw) {
    return {
      amount_value: null,
      currency_code: null,
    };
  }

  let currency_code: string | null = null;

  if (raw.includes("€") || /\bEUR\b/i.test(raw)) {
    currency_code = "EUR";
  } else if (raw.includes("$") || /\bUSD\b/i.test(raw)) {
    currency_code = "USD";
  }

  const normalized = raw.replace(/,/g, "");
  const numberMatch = normalized.match(/-?\d+(\.\d+)?/);

  const amount_value = numberMatch ? Number(numberMatch[0]) : null;

  return {
    amount_value: Number.isNaN(amount_value) ? null : amount_value,
    currency_code,
  };
}

async function runBackfill() {
  console.log("🚀 Starting backfill...");

  const { data, error } = await supabase
    .from("tasks")
    .select("id, amount, amount_value, currency_code")
    .order("id", { ascending: true });

  if (error) {
    console.error("❌ Failed to fetch tasks");
    console.error(error);
    process.exit(1);
  }

  const tasks = (data ?? []) as TaskRow[];

  console.log(`📦 Found ${tasks.length} tasks`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const task of tasks) {
    const parsed = parseAmount(task.amount);

    const sameAmountValue = task.amount_value === parsed.amount_value;
    const sameCurrencyCode = task.currency_code === parsed.currency_code;

    if (sameAmountValue && sameCurrencyCode) {
      skippedCount++;
      continue;
    }

    console.log(
      `🛠 Updating task ${task.id}:`,
      {
        old_amount: task.amount,
        old_amount_value: task.amount_value,
        old_currency_code: task.currency_code,
        new_amount_value: parsed.amount_value,
        new_currency_code: parsed.currency_code,
      }
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        amount_value: parsed.amount_value,
        currency_code: parsed.currency_code,
      })
      .eq("id", task.id);

    if (updateError) {
      failedCount++;
      console.error(`❌ Failed to update task ${task.id}`);
      console.error(updateError);
      continue;
    }

    updatedCount++;
  }

  console.log("✅ Backfill finished");
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed: ${failedCount}`);
}

runBackfill().catch((err) => {
  console.error("❌ Unexpected backfill error");
  console.error(err);
  process.exit(1);
});