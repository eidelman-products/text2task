import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type React from "react";

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

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(params.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasRecoverySession = Boolean(user);
  const visibleErrorMessage = hasRecoverySession ? errorMessage : "";

  return (
    <main className="reset-password-page" style={pageStyle}>
      <style>{responsiveCss}</style>

      <section className="reset-password-card" style={cardStyle}>
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

          <h1 style={titleStyle}>Set a new password</h1>

          <p style={subtitleStyle}>
            Choose a strong password for your Text2Task account.
          </p>
        </div>

        {visibleErrorMessage ? (
          <div style={errorStyle}>{visibleErrorMessage}</div>
        ) : null}

        {!hasRecoverySession ? (
          <>
            <div style={warningBoxStyle}>
              <div style={warningIconStyle} aria-hidden="true">
                !
              </div>
              <p style={warningTextStyle}>
                Your recovery session is missing or expired. Please request a
                new password reset email.
              </p>
            </div>

            <Link href="/forgot-password" style={buttonLinkStyle}>
              Request new reset link
            </Link>
          </>
        ) : (
          <>
            <form
              action="/api/auth/update-password"
              method="post"
              style={formStyle}
            >
              <div style={fieldGroupStyle}>
                <label htmlFor="password" style={labelStyle}>
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
                  style={inputStyle}
                />
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="confirmPassword" style={labelStyle}>
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
                  style={inputStyle}
                />
              </div>

              <button type="submit" style={buttonStyle}>
                Update password
              </button>
            </form>

            <div style={noteBoxStyle}>
              <div style={noteIconStyle} aria-hidden="true">
                ✓
              </div>
              <p style={noteTextStyle}>
                After updating your password, we’ll send you back to login.
              </p>
            </div>
          </>
        )}

        <div style={footerStyle}>
          <Link href="/login" style={primaryLinkStyle}>
            Back to login
          </Link>

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

  .reset-password-card button,
  .reset-password-card a {
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .reset-password-card button:hover,
  .reset-password-card a:hover {
    transform: translateY(-1px);
  }

  .reset-password-card input:focus {
    border-color: #93c5fd !important;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
  }

  .reset-password-card button:focus-visible,
  .reset-password-card a:focus-visible,
  .reset-password-card input:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.25);
    outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .reset-password-page {
      padding: 16px !important;
      align-items: center !important;
    }

    .reset-password-card {
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

const warningBoxStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1fr",
  gap: 10,
  alignItems: "start",
  padding: "13px 14px",
  borderRadius: 18,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
};

const warningIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffedd5",
  color: "#c2410c",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
};

const warningTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#9a3412",
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 750,
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

const buttonLinkStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 850,
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
