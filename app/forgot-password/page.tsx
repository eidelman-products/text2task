import React from "react";

type SearchParams = {
  sent?: string;
  email?: string;
  error?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_email":
      return "Please enter a valid email address.";
    case "unable_to_send":
      return "We could not send the reset email right now. Please try again.";
    default:
      return "";
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps) {
  const params = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(params.error);
  const sent = params.sent === "1";
  const email = params.email ?? "";

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
            Reset your password
          </h1>

          <p
            style={{
              margin: 0,
              color: "#b6c3e1",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            Enter your email and we will send you a secure reset link.
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

        {sent ? (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(34, 197, 94, 0.16)",
              border: "1px solid rgba(34, 197, 94, 0.32)",
              color: "#dcfce7",
              fontSize: 14,
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            We sent a reset link to <strong>{email}</strong>.
            <br />
            Open the email and continue to the password reset page.
          </div>
        ) : null}

        <form action="/api/auth/forgot-password" method="post">
          <label
            htmlFor="email"
            style={{
              display: "block",
              marginBottom: 10,
              fontSize: 13,
              color: "#b6c3e1",
              fontWeight: 700,
            }}
          >
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={email}
            placeholder="you@example.com"
            autoComplete="email"
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
            Send reset link
          </button>
        </form>

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
          <a
            href="/signup"
            style={{ color: "#9fb4ff", textDecoration: "none", fontWeight: 700 }}
          >
            Create account
          </a>
        </div>
      </section>
    </main>
  );
}