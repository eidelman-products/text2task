import { supabaseAdmin } from "@/lib/supabase/admin";

type EnsureUserInput = {
  id: string;
  email: string;
};

export type AppUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
};

type UserRow = {
  id: string;
  email: string;
  plan: string | null;
  extract_count: number | null;
  subscription_status: string | null;
};

const USER_SELECT =
  "id, email, plan, extract_count, subscription_status" as const;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeAppUser(user: {
  id: string;
  email: string;
  plan: string | null;
}): AppUser {
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    plan: user.plan === "pro" ? "pro" : "free",
  };
}

function buildMissingDefaultsPatch(user: UserRow, normalizedEmail: string) {
  const patch: Partial<{
    email: string;
    plan: "free";
    extract_count: number;
    subscription_status: "free";
  }> = {};

  if (normalizeEmail(user.email) !== normalizedEmail) {
    patch.email = normalizedEmail;
  }

  if (!user.plan) {
    patch.plan = "free";
  }

  if (user.extract_count === null || user.extract_count === undefined) {
    patch.extract_count = 0;
  }

  if (!user.subscription_status) {
    patch.subscription_status = "free";
  }

  return patch;
}

async function fetchUserById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT)
    .eq("id", id)
    .maybeSingle<UserRow>();

  if (error) {
    console.error("ensureUser select by id error:", error);
    throw new Error("Failed to check user by id");
  }

  return data;
}

async function fetchUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT)
    .eq("email", email)
    .maybeSingle<UserRow>();

  if (error) {
    console.error("ensureUser select by email error:", error);
    throw new Error("Failed to check user by email");
  }

  return data;
}

async function normalizeExistingUser(user: UserRow, normalizedEmail: string) {
  const patch = buildMissingDefaultsPatch(user, normalizedEmail);

  if (Object.keys(patch).length === 0) {
    return normalizeAppUser(user);
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", user.id)
    .select(USER_SELECT)
    .single<UserRow>();

  if (error) {
    console.error("ensureUser normalize existing user error:", error);
    throw new Error("Failed to normalize existing user");
  }

  return normalizeAppUser(data);
}

export async function ensureUser({
  id,
  email,
}: EnsureUserInput): Promise<AppUser> {
  const normalizedEmail = normalizeEmail(email);

  if (!id || !normalizedEmail) {
    throw new Error("Missing user id or email");
  }

  const existingById = await fetchUserById(id);

  if (existingById) {
    return normalizeExistingUser(existingById, normalizedEmail);
  }

  const existingByEmail = await fetchUserByEmail(normalizedEmail);

  if (existingByEmail) {
    if (existingByEmail.id !== id) {
      console.error("ensureUser email belongs to a different auth user:", {
        email: normalizedEmail,
        existingUserId: existingByEmail.id,
        incomingUserId: id,
      });

      throw new Error("User email is already linked to another auth identity");
    }

    return normalizeExistingUser(existingByEmail, normalizedEmail);
  }

  const { data: insertedUser, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      id,
      email: normalizedEmail,
      plan: "free",
      extract_count: 0,
      subscription_status: "free",
    })
    .select(USER_SELECT)
    .single<UserRow>();

  if (!insertError && insertedUser) {
    return normalizeAppUser(insertedUser);
  }

  if (insertError?.code === "23505") {
    const duplicateById = await fetchUserById(id);

    if (duplicateById) {
      return normalizeExistingUser(duplicateById, normalizedEmail);
    }

    const duplicateByEmail = await fetchUserByEmail(normalizedEmail);

    if (duplicateByEmail) {
      if (duplicateByEmail.id !== id) {
        console.error("ensureUser insert conflict with different auth id:", {
          email: normalizedEmail,
          existingUserId: duplicateByEmail.id,
          incomingUserId: id,
        });

        throw new Error("User email is already linked to another auth identity");
      }

      return normalizeExistingUser(duplicateByEmail, normalizedEmail);
    }
  }

  console.error("ensureUser insert error:", insertError);
  throw new Error("Failed to create user");
}