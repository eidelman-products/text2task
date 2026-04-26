import React from "react";

type SearchParams = {
  error?: string;
  confirmed?: string;
  reset?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_credentials":
      return "Invalid login credentials.";
    case "invalid_confirmation_link":
      return "The confirmation link is invalid or incomplete.";
    case "confirmation_failed":
      return "We could not confirm your email. Please try again.";
    default:
      return "";
  }
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(params.error);
  const confirmed = params.confirmed === "1";
  const reset = params.reset === "1";

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
            Log in
          </h1>

          <p
            style={{
              margin: 0,
              color: "#b6c3e1",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            Access your CRM and continue working from where you left off.
          </p>
        </div>

        {confirmed ? (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(34, 197, 94, 0.16)",
              border: "1px solid rgba(34, 197, 94, 0.32)",
              color: "#dcfce7",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Email confirmed successfully. You can log in now.
          </div>
        ) : null}

        {reset ? (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(34, 197, 94, 0.16)",
              border: "1px solid rgba(34, 197, 94, 0.32)",
              color: "#dcfce7",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Password updated successfully. Log in with your new password.
          </div>
        ) : null}

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

        <form action="/api/auth/login" method="post">
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
            autoComplete="email"
            placeholder="you@example.com"
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
            htmlFor="password"
            style={{
              display: "block",
              marginBottom: 10,
              fontSize: 13,
              color: "#b6c3e1",
              fontWeight: 700,
            }}
          >
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
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
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 16,
            }}
          >
            <a
              href="/forgot-password"
              style={{
                color: "#9fb4ff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Forgot password?
            </a>
          </div>

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
            Login
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            color: "#b6c3e1",
            fontSize: 14,
          }}
        >
          Don't have an account?{" "}
          <a
            href="/signup"
            style={{
              color: "#9fb4ff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Sign up
          </a>
        </div>
      </section>
    </main>
  );
}