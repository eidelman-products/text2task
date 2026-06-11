import Image from "next/image";
import Link from "next/link";
import type React from "react";

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

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(params.error);
  const sent = params.sent === "1";
  const email = params.email ?? "";

  return (
    <main className="forgot-password-page" style={pageStyle}>
      <style>{responsiveCss}</style>

      <section className="forgot-password-card" style={cardStyle}>
        <Link href="/" style={brandStyle} aria-label="Back to Text2Task home">
          <Image
            src="/text2task-logo.png"
            alt="Text2Task"
            width={164}
            height={44}
            priority
            style={logoStyle}
          />
        </Link>

        <div style={headerStyle}>
          <p style={kickerStyle}>Password reset</p>

          <h1 style={titleStyle}>Reset your password</h1>

          <p style={subtitleStyle}>
            Enter your email address and we’ll send you a secure link to create
            a new password.
          </p>
        </div>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

        {sent ? (
          <div style={successStyle}>
            We sent a reset link to <strong>{email || "your email"}</strong>.
            Open the email and continue to the password reset page.
          </div>
        ) : null}

        <form action="/api/auth/forgot-password" method="post" style={formStyle}>
          <div style={fieldGroupStyle}>
            <label htmlFor="email" style={labelStyle}>
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
              style={inputStyle}
            />
          </div>

          <button type="submit" style={buttonStyle}>
            Send reset link
          </button>
        </form>

        <div style={noteBoxStyle}>
          <div style={noteIconStyle} aria-hidden="true">
            ✓
          </div>
          <p style={noteTextStyle}>
            For your security, the reset link is sent only to the email address
            connected to your Text2Task account.
          </p>
        </div>

        <div style={footerStyle}>
          <Link href="/login" style={primaryLinkStyle}>
            Back to login
          </Link>

          <p style={bottomTextStyle}>
            New to Text2Task?{" "}
            <Link href="/signup" style={bottomLinkStyle}>
              Create account
            </Link>
          </p>

          <Link href="/" style={backLinkStyle}>
            Back to home
          </Link>
        </div>

        <p style={supportTextStyle}>
          Need help?{" "}
          <a href="mailto:support@text2task.com" style={supportLinkStyle}>
            support@text2task.com
          </a>
        </p>
      </section>
    </main>
  );
}

const responsiveCss = `
  html,
  body,
  main {
    overflow-x: hidden;
  }

  .forgot-password-card button,
  .forgot-password-card a {
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .forgot-password-card button:hover {
    transform: translateY(-1px);
  }

  .forgot-password-card input:focus {
    border-color: #93c5fd !important;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
  }

  .forgot-password-card button:focus-visible,
  .forgot-password-card a:focus-visible,
  .forgot-password-card input:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.25);
    outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .forgot-password-page {
      padding: 16px !important;
      align-items: center !important;
    }

    .forgot-password-card {
      border-radius: 24px !important;
      padding: 28px 22px !important;
      gap: 18px !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100svh",
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(circle at 50% 0%, rgba(219, 234, 254, 0.92) 0, rgba(219, 234, 254, 0) 36%), radial-gradient(circle at 12% 18%, rgba(226, 232, 240, 0.72) 0, rgba(226, 232, 240, 0) 28%), linear-gradient(135deg, #f8fbff 0%, #eef5ff 48%, #ffffff 100%)",
  color: "#0f172a",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 444,
  borderRadius: 28,
  background: "rgba(255, 255, 255, 0.95)",
  border: "1px solid rgba(203, 213, 225, 0.82)",
  boxShadow: "0 28px 90px rgba(15, 23, 42, 0.13)",
  padding: "34px 30px",
  display: "grid",
  gap: 20,
};

const brandStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  justifySelf: "center",
  textDecoration: "none",
  marginBottom: 2,
};

const logoStyle: React.CSSProperties = {
  width: 164,
  height: "auto",
  objectFit: "contain",
  display: "block",
};

const headerStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  textAlign: "center",
};

const kickerStyle: React.CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 850,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "clamp(28px, 4.8vw, 34px)",
  lineHeight: 1.06,
  letterSpacing: "-0.04em",
  fontWeight: 850,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.65,
};

const successStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.5,
  textAlign: "center",
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.5,
  textAlign: "center",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 15px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  border: "none",
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 850,
  cursor: "pointer",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.22)",
};

const noteBoxStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1fr",
  gap: 10,
  alignItems: "start",
  padding: "13px 14px",
  borderRadius: 18,
  border: "1px solid #dbeafe",
  background: "#f8fbff",
};

const noteIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eff6ff",
  color: "#2563eb",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
};

const noteTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};

const footerStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  textAlign: "center",
  paddingTop: 4,
};

const primaryLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 14,
  fontWeight: 850,
  textDecoration: "none",
};

const bottomTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
};

const bottomLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 850,
};

const backLinkStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 14,
  fontWeight: 800,
  textDecoration: "none",
};

const supportTextStyle: React.CSSProperties = {
  margin: "0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
  textAlign: "center",
};

const supportLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 850,
  textDecoration: "none",
};