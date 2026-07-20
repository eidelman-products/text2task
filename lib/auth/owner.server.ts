import "server-only";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export function getOwnerEmails() {
  return (process.env.TEXT2TASK_OWNER_EMAILS ?? "")
    .split(/[\s,]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return getOwnerEmails().includes(normalizedEmail);
}

export async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email || !isOwnerEmail(user.email)) {
    notFound();
  }
}
