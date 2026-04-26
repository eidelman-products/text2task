import React from "react";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  error?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing_session":
      return "This reset link is invalid or has expired. Please request a new one.";
    case "password_too_short":
      return "Password must be at least 8 characters long.";
    case "passwords_do_not_match":
      return "The passwords do not match.";
    case "update_failed":
      return "We could not update your password. Please try again.";
    default:
      return "";
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: PageProps) {
  const params = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(params.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasRecoverySession = Boolean(user);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, #0d1b3b 0%, #08142d 45%, #061127 100%)",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          background: "rgba(9, 20, 45, 0.92)",
          border: "1px solid rgba(86, 109, 160, 0.28)",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.35)",
          color: "#ffffff",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#9fb4ff",
              marginBottom: 10,
            }}
          >
            Text2Task
          </div>

          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 10,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            Set a new password
          </h1>

          <p
            style={{
              margin: 0,
              color: "#b6c3e1",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            Choose a strong password for your account.
          </p>
        </div>

        {errorMessage ? (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(125, 31, 54, 0.28)",
              border: "1px solid rgba(239, 68, 68, 0.38)",
              color: "#ffd5d9",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {!hasRecoverySession ? (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(101, 120, 168, 0.28)",
              color: "#d7e0f6",
              lineHeight: 1.7,
            }}
          >
            Your recovery session is missing.
            <br />
            Please request a new password reset email.
            <div style={{ marginTop: 16 }}>
              <a
                href="/forgot-password"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 46,
                  padding: "0 16px",
                  borderRadius: 12,
                  textDecoration: "none",
                  background: "#22c55e",
                  color: "#031321",
                  fontWeight: 900,
                }}
              >
                Request new reset link
              </a>
            </div>
          </div>
        ) : (
          <form action="/api/auth/update-password" method="post">
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 10,
                fontSize: 13,
                color: "#b6c3e1",
                fontWeight: 700,
              }}
            >
              New password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              style={{
                width: "100%",
                height: 54,
                borderRadius: 14,
                border: "1px solid rgba(101, 120, 168, 0.35)",
                background: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                padding: "0 16px",
                outline: "none",
                fontSize: 16,
                marginBottom: 14,
                boxSizing: "border-box",
              }}
            />

            <label
              htmlFor="confirmPassword"
              style={{
                display: "block",
                marginBottom: 10,
                fontSize: 13,
                color: "#b6c3e1",
                fontWeight: 700,
              }}
            >
              Confirm new password
            </label>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Repeat the new password"
              style={{
                width: "100%",
                height: 54,
                borderRadius: 14,
                border: "1px solid rgba(101, 120, 168, 0.35)",
                background: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                padding: "0 16px",
                outline: "none",
                fontSize: 16,
                marginBottom: 14,
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              style={{
                width: "100%",
                height: 54,
                border: "none",
                borderRadius: 14,
                background: "#22c55e",
                color: "#031321",
                fontWeight: 900,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "0 18px 35px rgba(34, 197, 94, 0.18)",
              }}
            >
              Update password
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 14,
          }}
        >
          <a href="/login" style={{ color: "#c8d5f2", textDecoration: "none" }}>
            Back to login
          </a>
        </div>
      </section>
    </main>
  );
}