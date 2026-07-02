"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleAuthButton } from "../components/auth/google-auth-button";
import type React from "react";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH,
  HOMEPAGE_DEMO_CLAIM_LOGIN_PATH,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";

function getSafeImmediateSignupDestination(destination: unknown) {
  if (
    destination === "/dashboard" ||
    destination === "/api/billing/continue" ||
    destination === HOMEPAGE_DEMO_CLAIM_CONTINUATION_PATH
  ) {
    return destination;
  }

  return "/dashboard";
}

function getSignupErrorMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return "Signup failed";
  }

  const error = data.error;

  return typeof error === "string" && error.trim()
    ? error
    : "Signup failed";
}

function getImmediateSignupDestination(data: unknown) {
  if (
    !data ||
    typeof data !== "object" ||
    !("needsEmailConfirmation" in data) ||
    data.needsEmailConfirmation !== false
  ) {
    return null;
  }

  return getSafeImmediateSignupDestination(
    "destination" in data ? data.destination : null
  );
}

function getCheckEmailHref(
  email: string,
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null
) {
  const query = new URLSearchParams({ email });

  if (homepageDemoClaimIntent !== null) {
    query.set("intent", HOMEPAGE_DEMO_CLAIM_AUTH_INTENT);
  }

  return `/check-email?${query.toString()}`;
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
    searchParams.getAll("intent")
  );
  const loginHref =
    homepageDemoClaimIntent === null
      ? "/login"
      : HOMEPAGE_DEMO_CLAIM_LOGIN_PATH;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setGeneratedMessage("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(homepageDemoClaimIntent === null
            ? {}
            : { intent: homepageDemoClaimIntent }),
        }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        setError(getSignupErrorMessage(data));
        return;
      }

      const immediateDestination = getImmediateSignupDestination(data);

      if (immediateDestination) {
        if (immediateDestination === "/api/billing/continue") {
          window.location.assign(immediateDestination);
          return;
        }

        router.push(immediateDestination);
        return;
      }

      router.push(getCheckEmailHref(email.trim(), homepageDemoClaimIntent));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function generateStrongPassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    let generated = "";

    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      const values = new Uint32Array(16);
      window.crypto.getRandomValues(values);

      for (let i = 0; i < values.length; i += 1) {
        generated += chars[values[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 16; i += 1) {
        generated += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    setPassword(generated);
    setShowPassword(true);
    setGeneratedMessage("Strong password generated.");
  }

  return (
    <main className="signup-page" style={pageStyle}>
      <style>{responsiveCss}</style>

      <section className="signup-card" style={cardStyle}>
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
          <p style={kickerStyle}>Start free</p>

          <h1 style={titleStyle}>Create your Text2Task workspace</h1>

          <p style={subtitleStyle}>
            Paste a client message, email, note, or screenshot. Text2Task turns
            it into organized work you can review and save.
          </p>
        </div>

        <GoogleAuthButton label="Continue with Google" next="/dashboard" />

        <div style={dividerStyle}>
          <span style={dividerLineStyle} />
          <span style={dividerTextStyle}>or sign up with email</span>
          <span style={dividerLineStyle} />
        </div>

        <form onSubmit={handleSignup} style={formStyle}>
          <div style={fieldGroupStyle}>
            <label htmlFor="email" style={labelStyle}>
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>

            <div style={passwordWrapStyle}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                required
                minLength={6}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setGeneratedMessage("");
                }}
                style={passwordInputStyle}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={eyeButtonStyle}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div style={passwordActionsStyle}>
              <button
                type="button"
                onClick={generateStrongPassword}
                style={suggestButtonStyle}
              >
                Suggest strong password
              </button>

              {generatedMessage ? (
                <span style={generatedTextStyle}>{generatedMessage}</span>
              ) : null}
            </div>
          </div>

          {error ? <div style={errorStyle}>{error}</div> : null}

          <button type="submit" disabled={loading} style={submitButtonStyle}>
            {loading ? "Creating workspace..." : "Create my workspace"}
          </button>
        </form>

        <div style={noteBoxStyle}>
          <div style={noteIconStyle} aria-hidden="true">
            ✓
          </div>
          <p style={noteTextStyle}>
            Use Google to open your workspace faster, or sign up with email and
            confirm your address. You can start free with 30 AI extracts.
          </p>
        </div>

        <div style={footerStyle}>
          <p style={footerTextStyle}>
            Already have an account?{" "}
            <Link href={loginHref} style={footerLinkStyle}>
              Log in
            </Link>
          </p>

          <Link href="/" style={backLinkStyle}>
            Back to home
          </Link>
        </div>

        <p style={supportTextStyle}>
          Questions?{" "}
          <a href="mailto:support@text2task.com" style={supportLinkStyle}>
            support@text2task.com
          </a>
        </p>
      </section>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="signup-page" style={pageStyle} />}>
      <SignupPageContent />
    </Suspense>
  );
}

const responsiveCss = `
  html,
  body,
  main {
    overflow-x: hidden;
  }

  .signup-card button,
  .signup-card a {
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .signup-card button:hover {
    transform: translateY(-1px);
  }

  .signup-card button:disabled {
    cursor: not-allowed !important;
    opacity: 0.72;
    transform: none !important;
  }

  .signup-card input:focus {
    border-color: #93c5fd !important;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
  }

  .signup-card button:focus-visible,
  .signup-card a:focus-visible,
  .signup-card input:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.25);
    outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .signup-page {
      padding: 16px !important;
      align-items: center !important;
    }

    .signup-card {
      border-radius: 24px !important;
      padding: 26px 22px !important;
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
  maxWidth: 462,
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

const passwordWrapStyle: React.CSSProperties = {
  position: "relative",
  display: "grid",
};

const passwordInputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 74px 0 15px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 9,
  top: "50%",
  transform: "translateY(-50%)",
  height: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
};

const passwordActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 9,
};

const suggestButtonStyle: React.CSSProperties = {
  width: "fit-content",
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 850,
  cursor: "pointer",
};

const generatedTextStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 750,
  lineHeight: 1.5,
};

const submitButtonStyle: React.CSSProperties = {
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

const footerTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
};

const footerLinkStyle: React.CSSProperties = {
  color: "#2563eb",
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
