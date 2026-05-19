import Image from "next/image";
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
        <aside className="auth-brand-panel" style={brandPanelStyle}>
          <Link href="/" style={brandStyle} aria-label="Back to Text2Task home">
            <Image
              src="/text2task-logo.png"
              alt="Text2Task"
              width={180}
              height={55}
              priority
              style={logoStyle}
            />
          </Link>

          <div style={brandContentStyle}>
            <div style={badgeStyle}>Welcome back</div>
            <h1 style={heroTitleStyle}>Continue managing your client work.</h1>
            <p style={heroTextStyle}>
              Log in to access your CRM, saved tasks, dashboard analytics, and
              client workspace.
            </p>

            <div style={trustListStyle}>
              <div style={bulletItemStyle}>✓ Structured task workspace</div>
              <div style={bulletItemStyle}>✓ Client and revenue tracking</div>
              <div style={bulletItemStyle}>✓ AI extraction history</div>
            </div>
          </div>
        </aside>

        <div className="auth-card" style={cardStyle}>
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
        </div>
      </section>
    </main>
  );
}

const responsiveCss = `
  /* prevent horizontal overflow on small screens */
  html, body, main { overflow-x: hidden; }

  @media (max-width: 980px) {
    .auth-shell {
      grid-template-columns: 1fr !important;
      max-width: calc(100% - 48px) !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
    }

    .auth-brand-panel {
      padding: 30px !important;
      gap: 20px !important;
      border-right: none !important;
      border-bottom: 1px solid #e7e9f2 !important;
      min-height: auto !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .auth-card {
      padding: 28px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
  }

  @media (max-width: 640px) {
    .auth-brand-panel h1,
    .auth-brand-panel p {
      max-width: 100% !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
    }

    .auth-brand-panel h1 {
      font-size: 28px !important;
      line-height: 1.08 !important;
    }

    .auth-brand-panel, .auth-card {
      padding: 24px !important;
      box-sizing: border-box !important;
    }

    .auth-card {
      border-radius: 24px !important;
      max-width: 100% !important;
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
  maxWidth: 1180,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  background: "#ffffff",
  borderRadius: 32,
  overflow: "hidden",
  border: "1px solid #e8eaf2",
  boxShadow: "0 32px 80px rgba(15, 23, 42, 0.10)",
};

const brandPanelStyle: React.CSSProperties = {
  minHeight: 620,
  padding: 42,
  display: "grid",
  alignContent: "start",
  gap: 28,
  background:
    "linear-gradient(180deg, #f6f4ff 0%, #f8f8ff 52%, #fbfcff 100%)",
  borderRight: "1px solid #e7e9f2",
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
  width: "100%",
  maxWidth: 420,
  padding: 34,
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid #eceef5",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: 24,
};

const kickerStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#102045",
  fontSize: 24,
  lineHeight: 1.1,
  letterSpacing: "-0.035em",
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#6b7280",
  fontSize: 15,
  lineHeight: 1.6,
};

const logoStyle: React.CSSProperties = {
  width: 180,
  height: "auto",
  objectFit: "contain",
  display: "block",
};

const bulletItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: "#344054",
  fontSize: 15,
  fontWeight: 700,
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