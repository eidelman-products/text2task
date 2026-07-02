import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { GoogleAuthButton } from "../components/auth/google-auth-button";
import type React from "react";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

type SearchParams = {
  error?: string;
  email?: string;
  confirmed?: string;
  reset?: string;
  intent?: string | string[];
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_credentials":
      return "Invalid login credentials.";
    case "email_not_confirmed":
      return "Please confirm your email before logging in. We sent you a confirmation link.";
    case "invalid_confirmation_link":
      return "The confirmation link is invalid or incomplete.";
    case "confirmation_failed":
      return "We could not confirm your email. Please try again.";
    case "oauth_start_failed":
      return "Could not start Google sign-in. Please try again.";
    case "oauth_cancelled":
      return "Google sign-in was cancelled.";
    case "oauth_callback_failed":
      return "Google sign-in could not be completed. Please try again.";
    case "oauth_missing_email":
      return "Google did not return an email address. Please use another account.";
    case "account_link_conflict":
      return "This email is already linked to a different login method. Please log in with email and password, or contact support.";
    default:
      return "";
  }
}

function getSafeEmailParam(email?: string) {
  const value = email?.trim() ?? "";

  if (!value || value.length > 140) {
    return "";
  }

  return value;
}

function getAuthPathWithHomepageDemoClaimIntent(
  path: "/check-email" | "/login" | "/signup",
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null,
  email?: string
) {
  const query = new URLSearchParams();

  if (email) {
    query.set("email", email);
  }

  if (homepageDemoClaimIntent !== null) {
    query.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  const queryString = query.toString();

  return queryString ? `${path}?${queryString}` : path;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(params.error);
  const confirmed = params.confirmed === "1";
  const reset = params.reset === "1";
  const email = getSafeEmailParam(params.email);
  const homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
    params.intent
  );
  const checkEmailHref = getAuthPathWithHomepageDemoClaimIntent(
    "/check-email",
    homepageDemoClaimIntent,
    email
  );
  const signupHref = getAuthPathWithHomepageDemoClaimIntent(
    "/signup",
    homepageDemoClaimIntent
  );
  const showCheckEmailLink = params.error === "email_not_confirmed";

  return (
    <main className="login-page" style={pageStyle}>
      <style>{responsiveCss}</style>

      <section className="login-card" style={cardStyle}>
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
          <p style={kickerStyle}>Welcome back</p>

          <h1 style={titleStyle}>Log in to Text2Task</h1>

          <p style={subtitleStyle}>
            Continue managing your client requests, projects, deadlines, and
            follow-ups from your workspace.
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

        {showCheckEmailLink ? (
          <Link href={checkEmailHref} style={confirmationLinkStyle}>
            Open confirmation instructions
          </Link>
        ) : null}

        <GoogleAuthButton label="Continue with Google" next="/dashboard" />

        <div style={dividerStyle}>
          <span style={dividerLineStyle} />
          <span style={dividerTextStyle}>or log in with email</span>
          <span style={dividerLineStyle} />
        </div>

        <form
          id="login-form"
          action="/api/auth/login"
          method="post"
          style={formStyle}
        >
          {homepageDemoClaimIntent !== null ? (
            <input
              type="hidden"
              name="intent"
              value={homepageDemoClaimIntent}
            />
          ) : null}

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
              defaultValue={email}
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <div style={passwordLabelRowStyle}>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>

              <Link href="/forgot-password" style={forgotLinkStyle}>
                Forgot password?
              </Link>
            </div>

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

          <button id="login-submit" type="submit" style={buttonStyle}>
            Log in
          </button>
        </form>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const form = document.getElementById("login-form");
                const submitButton = document.getElementById("login-submit");

                if (!form || !submitButton) return;

                form.addEventListener("submit", (event) => {
                  if (!form.checkValidity()) return;

                  if (form.dataset.submitting === "true") {
                    event.preventDefault();
                    return;
                  }

                  form.dataset.submitting = "true";
                  submitButton.disabled = true;
                  submitButton.textContent = "Logging in...";
                });
              })();
            `,
          }}
        />

        <div style={noteBoxStyle}>
          <div style={noteIconStyle} aria-hidden="true">
            ✓
          </div>
          <p style={noteTextStyle}>
            Access your saved projects, client updates, resources, and organized
            task workspace.
          </p>
        </div>

        <div style={footerStyle}>
          <p style={bottomTextStyle}>
            Don&apos;t have an account?{" "}
            <Link href={signupHref} style={bottomLinkStyle}>
              Sign up
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

  .login-card button,
  .login-card a {
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .login-card button:hover {
    transform: translateY(-1px);
  }

  .login-card button:disabled {
    cursor: not-allowed !important;
    opacity: 0.72;
    transform: none !important;
  }

  .login-card input:focus {
    border-color: #93c5fd !important;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
  }

  .login-card button:focus-visible,
  .login-card a:focus-visible,
  .login-card input:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.25);
    outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .login-page {
      padding: 16px !important;
      align-items: center !important;
    }

    .login-card {
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

const confirmationLinkStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 14,
  fontWeight: 850,
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  boxSizing: "border-box",
};

const dividerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 12,
};

const dividerLineStyle: React.CSSProperties = {
  height: 1,
  background: "#e2e8f0",
};

const dividerTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const passwordLabelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
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

const forgotLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 850,
  whiteSpace: "nowrap",
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
