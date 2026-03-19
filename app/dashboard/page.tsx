import DashboardClient from "../components/dashboard-client";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current authenticated user from Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const connectedEmail = user?.email ?? null;

  return <DashboardClient email={connectedEmail || "Not connected"} />;
}