import Link from "next/link";
import type React from "react";

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
    <main style={pageStyle}>
      <style>{responsiveCss}</style>

      <section className="auth-shell" style={shellStyle}>
        <div className="auth-brand-panel" style={brandPanelStyle}>
          <Link href="/" style={brandStyle}>
            <span style={brandDotStyle} />
            Text2Task
          </Link>

          <div style={brandContentStyle}>
            <div style={badgeStyle}>Welcome back</div>
            <h1 style={heroTitleStyle}>Continue managing your client work.</h1>
            <p style={heroTextStyle}>
              Log in to access your CRM, saved tasks, dashboard analytics, and
              client workspace.
            </p>

            <div style={trustListStyle}>
              <span>✓ Structured task workspace</span>
              <span>✓ Client and revenue tracking</span>
              <span>✓ AI extraction history</span>
            </div>
          </div>
        </div>

        <section className="auth-card" style={cardStyle}>
          <div>
            <div style={kickerStyle}>Text2Task</div>
            <h2 style={titleStyle}>Log in</h2>
            <p style={subtitleStyle}>
              Access your CRM and continue working from where you left off.
            </p>
          </div>

          {confirmed ? (
            <div style={successStyle}>
              Email confirmed successfully. You can log in now.
            </div>
          ) : null}

          {reset ? (
            <div style={successStyle}>
              Password updated successfully. Log in with your new password.
            </div>
          ) : null}

          {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

          <form action="/api/auth/login" method="post" style={formStyle}>
            <div style={fieldGroupStyle}>
              <label htmlFor="email" style={labelStyle}>
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Your password"
                style={inputStyle}
              />
            </div>

            <div style={forgotRowStyle}>
              <Link href="/forgot-password" style={forgotLinkStyle}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" style={buttonStyle}>
              Log in
            </button>
          </form>

          <p style={bottomTextStyle}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={bottomLinkStyle}>
              Sign up
            </Link>
          </p>

          <Link href="/" style={backLinkStyle}>
            ← Back to home
          </Link>
        </section>
      </section>
    </main>
  );
}

const responsiveCss = `
  @media (max-width: 860px) {
  .auth-shell {
    grid-template-columns: 1fr !important;
    max-width: 520px !important;
  }

  .auth-brand-panel {
    min-height: auto !important;
    padding: 20px !important;
    gap: 12px !important;
  }

  .auth-card {
    padding: 22px !important;
  }

  .auth-brand-panel h1 {
    font-size: 28px !important;
    line-height: 1.15 !important;
  }

  .auth-brand-panel p {
    font-size: 14px !important;
  }

  .auth-brand-panel span {
    font-size: 13px !important;
  }
}

  @media (max-width: 430px) {
    .auth-shell {
      border-radius: 28px !important;
    }

    .auth-brand-panel {
      padding: 24px !important;
      border-radius: 28px 28px 0 0 !important;
    }

    .auth-card {
      padding: 24px !important;
      border-radius: 0 0 28px 28px !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background:
    "radial-gradient(circle at top left, #eef4ff 0%, #f8fafc 46%, #ffffff 100%)",
};

const shellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  borderRadius: 34,
  overflow: "hidden",
  background: "rgba(255,255,255,0.74)",
  border: "1px solid rgba(191,219,254,0.78)",
  boxShadow: "0 34px 90px rgba(15,23,42,0.12)",
};

const brandPanelStyle: React.CSSProperties = {
  minHeight: 620,
  padding: 34,
  display: "grid",
  alignContent: "space-between",
  background:
    "linear-gradient(180deg, rgba(239,246,255,0.94), rgba(224,231,255,0.52))",
};

const brandStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  width: "fit-content",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

const brandDotStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "linear-gradient(135deg, #60a5fa, #6366f1, #8b5cf6)",
  boxShadow: "0 0 0 8px rgba(99,102,241,0.10)",
};

const brandContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const badgeStyle: React.CSSProperties = {
  width: "fit-content",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: "clamp(36px, 5vw, 54px)",
  lineHeight: 1.04,
  letterSpacing: "-0.055em",
  fontWeight: 850,
};

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 17,
  lineHeight: 1.75,
};

const trustListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
};

const cardStyle: React.CSSProperties = {
  padding: 38,
  background: "rgba(255,255,255,0.96)",
  display: "grid",
  alignContent: "center",
  gap: 18,
};

const kickerStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 34,
  lineHeight: 1.05,
  letterSpacing: "-0.045em",
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.65,
};

const successStyle: React.CSSProperties = {
  padding: "13px 14px",
  borderRadius: 14,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
};

const errorStyle: React.CSSProperties = {
  padding: "13px 14px",
  borderRadius: 14,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 850,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 54,
  borderRadius: 15,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  padding: "0 16px",
  outline: "none",
  fontSize: 16,
  boxSizing: "border-box",
};

const forgotRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const forgotLinkStyle: React.CSSProperties = {
  color: "#4f46e5",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  height: 54,
  border: "none",
  borderRadius: 15,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 18px 34px rgba(15,23,42,0.16)",
};

const bottomTextStyle: React.CSSProperties = {
  margin: 0,
  textAlign: "center",
  color: "#64748b",
  fontSize: 14,
};

const bottomLinkStyle: React.CSSProperties = {
  color: "#4f46e5",
  textDecoration: "none",
  fontWeight: 900,
};

const backLinkStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#475569",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 800,
};