import { redirect } from "next/navigation";
import DashboardClient from "../components/dashboard-client";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/supabase/ensureUser";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  if (!user.email) {
    redirect("/login");
  }

  const appUser = await ensureUser({
    id: user.id,
    email: user.email,
  });

  return (
    <DashboardClient
      email={appUser.email}
      userId={appUser.id}
      initialPlan={appUser.plan}
    />
  );
}