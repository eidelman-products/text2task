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

function normalizeAppUser(user: {
  id: string;
  email: string;
  plan: string | null;
}): AppUser {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan === "pro" ? "pro" : "free",
  };
}

export async function ensureUser({
  id,
  email,
}: EnsureUserInput): Promise<AppUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingById, error: selectByIdError } = await supabaseAdmin
    .from("users")
    .select("id, email, plan")
    .eq("id", id)
    .maybeSingle();

  if (selectByIdError) {
    console.error("ensureUser select by id error:", selectByIdError);
    throw new Error("Failed to check user by id");
  }

  if (existingById) {
    return normalizeAppUser(existingById);
  }

  const { data: existingByEmail, error: selectByEmailError } =
    await supabaseAdmin
      .from("users")
      .select("id, email, plan")
      .eq("email", normalizedEmail)
      .maybeSingle();

  if (selectByEmailError) {
    console.error("ensureUser select by email error:", selectByEmailError);
    throw new Error("Failed to check user by email");
  }

  if (existingByEmail) {
    if (existingByEmail.id !== id) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({ id })
        .eq("email", normalizedEmail)
        .select("id, email, plan")
        .single();

      if (updateError) {
        console.error("ensureUser update existing email error:", updateError);
        throw new Error("Failed to link existing user");
      }

      return normalizeAppUser(updatedUser);
    }

    return normalizeAppUser(existingByEmail);
  }

  const { data: insertedUser, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      id,
      email: normalizedEmail,
      plan: "free",
    })
    .select("id, email, plan")
    .single();

  if (!insertError && insertedUser) {
    return normalizeAppUser(insertedUser);
  }

  if (insertError?.code === "23505") {
    const { data: duplicateUser, error: duplicateFetchError } =
      await supabaseAdmin
        .from("users")
        .select("id, email, plan")
        .eq("email", normalizedEmail)
        .maybeSingle();

    if (duplicateFetchError) {
      console.error(
        "ensureUser duplicate fetch error after insert conflict:",
        duplicateFetchError
      );
      throw new Error("Failed to recover existing user");
    }

    if (duplicateUser) {
      if (duplicateUser.id !== id) {
        const { data: relinkedUser, error: relinkError } = await supabaseAdmin
          .from("users")
          .update({ id })
          .eq("email", normalizedEmail)
          .select("id, email, plan")
          .single();

        if (relinkError) {
          console.error(
            "ensureUser relink error after duplicate conflict:",
            relinkError
          );
          throw new Error("Failed to relink existing user");
        }

        return normalizeAppUser(relinkedUser);
      }

      return normalizeAppUser(duplicateUser);
    }
  }

  console.error("ensureUser insert error:", insertError);
  throw new Error("Failed to create user");
}