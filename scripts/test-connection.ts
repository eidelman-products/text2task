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

async function testConnection() {
  console.log("🚀 Testing Supabase connection...");

  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .limit(1);

  if (error) {
    console.error("❌ Connection failed:");
    console.error(error);
    process.exit(1);
  }

  console.log("✅ Connected successfully");
  console.log("Sample row:", data);
}

testConnection().catch((err) => {
  console.error("❌ Unexpected error:");
  console.error(err);
  process.exit(1);
});