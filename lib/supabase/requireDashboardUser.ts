import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUser, type AppUser } from "@/lib/supabase/ensureUser";

/**
 * The shared server-side auth guard for every dashboard route
 * (`/dashboard`, `/dashboard/calendar`, ...): confirms an authenticated
 * Supabase session exists, redirects to `/login` if not, and returns the
 * app-level user row via the existing `ensureUser` loader. Extracted once
 * this pattern needed to exist identically in two route files, so it can't
 * drift between them.
 */
export async function requireDashboardUser(): Promise<AppUser> {
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

  return ensureUser({ id: user.id, email: user.email });
}
