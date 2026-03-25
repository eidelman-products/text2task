import DashboardClient from "../components/dashboard-client";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const connectedEmail = user?.email ?? null;
  const userId = user?.id ?? "";

  let initialPlan: "free" | "pro" = "free";

  if (userId) {
    const { data: dbUser } = await supabase
      .from("users")
      .select("plan")
      .eq("id", userId)
      .single();

    if (dbUser?.plan === "pro") {
      initialPlan = "pro";
    }
  }

  return (
    <DashboardClient
      email={connectedEmail || "Not connected"}
      userId={userId}
      initialPlan={initialPlan}
    />
  );
}