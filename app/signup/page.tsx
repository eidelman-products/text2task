"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type React from "react";

export default function SignupPage() {
  const router = useRouter();

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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      router.push(`/check-email?email=${encodeURIComponent(email.trim())}`);
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

    for (let i = 0; i < 16; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setPassword(generated);
    setShowPassword(true);
    setGeneratedMessage("Strong password generated.");
  }

  return (
    <main style={pageStyle}>
      <style>{responsiveCss}</style>

      <section className="signup-shell" style={shellStyle}>
        <aside className="signup-left" style={leftPanelStyle}>
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

          <div style={leftContentStyle}>
            <h1 style={heroTitleStyle}>
              <span className="signup-hero-line" style={heroLineStyle}>
                Turn client requests into
              </span>
              <span className="signup-hero-accent" style={heroAccentStyle}>
                ready-to-work projects.
              </span>
            </h1>

            <p style={heroTextStyle}>
              Paste a message, email, note, or screenshot. Text2Task extracts
              the task, deadline, budget, and client details for you.
            </p>

            <div style={bulletListStyle}>
              <div style={bulletItemStyle}>
                <span style={bulletIconStyle}>✓</span>
                <span>Extract tasks, deadlines, and budget</span>
              </div>

              <div style={bulletItemStyle}>
                <span style={bulletIconStyle}>✓</span>
                <span>See urgent work clearly in your dashboard</span>
              </div>

              <div style={bulletItemStyle}>
                <span style={bulletIconStyle}>✓</span>
                <span>Keep client work organized in one place</span>
              </div>
            </div>
          </div>

          <div style={supportRowStyle}>
            <span style={supportDotStyle} />
            <span style={supportTextStyle}>
              Questions?{" "}
              <a href="mailto:support@text2task.com" style={supportLinkStyle}>
                support@text2task.com
              </a>
            </span>
          </div>
        </aside>

        <div className="signup-right" style={rightPanelStyle}>
          <div className="signup-card" style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h2 style={cardTitleStyle}>Create your account</h2>
              <p style={cardSubtitleStyle}>
                Start organizing client requests with Text2Task.
              </p>
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

                <button
                  type="button"
                  onClick={generateStrongPassword}
                  style={suggestButtonStyle}
                >
                  Suggest strong password
                </button>

                {generatedMessage ? (
                  <div style={generatedTextStyle}>{generatedMessage}</div>
                ) : null}
              </div>

              {error ? <div style={errorStyle}>{error}</div> : null}

              <button type="submit" disabled={loading} style={submitButtonStyle}>
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div style={cardFooterStyle}>
              <p style={footerTextStyle}>
                Already have an account?{" "}
                <Link href="/login" style={footerLinkStyle}>
                  Log in
                </Link>
              </p>

              <Link href="/" style={backLinkStyle}>
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const responsiveCss = `
  /* Prevent any accidental horizontal scroll from this page */
  html, body, main { overflow-x: hidden; }

  @media (max-width: 980px) {
    .signup-shell {
      grid-template-columns: 1fr !important;
      max-width: calc(100% - 48px) !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
    }

    .signup-left {
      padding: 30px !important;
      gap: 28px !important;
      border-right: none !important;
      border-bottom: 1px solid #e7e9f2 !important;
      min-height: auto !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }

    .signup-right {
      padding: 30px !important;
      min-height: auto !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }

    .signup-card {
      max-width: 100% !important;
      padding: 28px !important;
      box-sizing: border-box !important;
    }
  }

  @media (max-width: 640px) {
    .signup-hero-line,
    .signup-hero-accent {
      white-space: normal !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
    }

    .signup-left {
      padding: 24px !important;
    }

    .signup-right {
      padding: 24px !important;
    }

    .signup-card {
      padding: 24px !important;
      border-radius: 24px !important;
      max-width: 100% !important;
    }

    .signup-left h1,
    .signup-left h1 span {
      font-size: 28px !important;
      line-height: 1.08 !important;
      max-width: 100% !important;
    }

    .signup-left * {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 12% 8%, rgba(91,91,214,0.10), transparent 30%), radial-gradient(circle at 90% 20%, rgba(79,124,255,0.08), transparent 28%), linear-gradient(180deg, #fcfcfe 0%, #f8f9fc 100%)",
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

const leftPanelStyle: React.CSSProperties = {
  minHeight: 620,
  padding: 42,
  display: "grid",
  alignContent: "space-between",
  gap: 36,
  background:
    "linear-gradient(180deg, #f6f4ff 0%, #f8f8ff 52%, #fbfcff 100%)",
  borderRight: "1px solid #e7e9f2",
};

const brandStyle: React.CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const logoStyle: React.CSSProperties = {
  width: 180,
  height: "auto",
  objectFit: "contain",
  objectPosition: "left center",
  display: "block",
};

const leftContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
  maxWidth: 540,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#102045",
  fontSize: "clamp(33px, 3.55vw, 42px)",
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  maxWidth: 620,
};

const heroLineStyle: React.CSSProperties = {
  display: "block",
  whiteSpace: "nowrap",
};

const heroAccentStyle: React.CSSProperties = {
  display: "block",
  color: "#5550d6",
  whiteSpace: "nowrap",
};

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#5f6b85",
  fontSize: 17,
  lineHeight: 1.72,
  maxWidth: 470,
};

const bulletListStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 8,
};

const bulletItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: "#344054",
  fontSize: 15,
  fontWeight: 700,
};

const bulletIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#eeecff",
  color: "#5550d6",
  fontSize: 14,
  fontWeight: 900,
  flex: "0 0 auto",
};

const supportRowStyle: React.CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 16px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.74)",
  border: "1px solid #e5e7f1",
};

const supportDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#22c55e",
  boxShadow: "0 0 0 4px rgba(34,197,94,0.14)",
  flex: "0 0 auto",
};

const supportTextStyle: React.CSSProperties = {
  color: "#5f6b85",
  fontSize: 13,
  fontWeight: 700,
};

const supportLinkStyle: React.CSSProperties = {
  color: "#4f46e5",
  textDecoration: "none",
  fontWeight: 900,
};

const rightPanelStyle: React.CSSProperties = {
  minHeight: 620,
  padding: 42,
  display: "grid",
  placeItems: "center",
  background: "#fcfcfe",
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

const cardHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#102045",
  fontSize: 24,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: "-0.035em",
};

const cardSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 15,
  lineHeight: 1.6,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 54,
  padding: "0 16px",
  borderRadius: 14,
  border: "1px solid #d8dce8",
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
  height: 54,
  padding: "0 74px 0 16px",
  borderRadius: 14,
  border: "1px solid #d8dce8",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  height: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const suggestButtonStyle: React.CSSProperties = {
  width: "fit-content",
  height: 36,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid #e2e6f5",
  background: "#f5f3ff",
  color: "#574fcf",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const generatedTextStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: 12,
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 700,
};

const submitButtonStyle: React.CSSProperties = {
  width: "100%",
  height: 54,
  border: "none",
  borderRadius: 14,
  background: "linear-gradient(135deg, #5b5bd6 0%, #4a49c7 100%)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 16px 32px rgba(91, 91, 214, 0.22)",
};

const cardFooterStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const footerTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 14,
  textAlign: "center",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontWeight: 900,
  textDecoration: "none",
};

const backLinkStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 14,
  fontWeight: 800,
  textDecoration: "none",
  textAlign: "center",
};
