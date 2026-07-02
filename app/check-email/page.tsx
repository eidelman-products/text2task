"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  parseHomepageDemoClaimAuthIntent,
  type HomepageDemoClaimAuthIntent,
} from "@/lib/auth/homepage-demo-auth-intent";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAuthPathWithHomepageDemoClaimIntent(
  path: "/login" | "/signup",
  homepageDemoClaimIntent: HomepageDemoClaimAuthIntent | null
) {
  if (homepageDemoClaimIntent === null) {
    return path;
  }

  const query = new URLSearchParams({
    intent: HOMEPAGE_DEMO_CLAIM_AUTH_INTENT,
  });

  return `${path}?${query.toString()}`;
}

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const homepageDemoClaimIntent = parseHomepageDemoClaimAuthIntent(
    searchParams.getAll("intent")
  );
  const hasConfirmationLinkError =
    error === "confirmation_failed" || error === "invalid_link";

  const queryEmail = useMemo(() => {
    const rawEmail = searchParams.get("email")?.trim();

    if (!rawEmail || rawEmail.length > 140 || !isValidEmail(rawEmail)) {
      return "";
    }

    return rawEmail;
  }, [searchParams]);
  const [resendEmail, setResendEmail] = useState(queryEmail);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [resendMessage, setResendMessage] = useState("");
  const [coolingDown, setCoolingDown] = useState(false);

  const displayEmail = queryEmail || "your email";
  const shouldShowEmailInput = !queryEmail;

  async function handleResendConfirmation() {
    const email = (queryEmail || resendEmail).trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      setResendStatus("error");
      setResendMessage("Enter a valid email address.");
      return;
    }

    setResendStatus("sending");
    setResendMessage("");

    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          ...(homepageDemoClaimIntent === null
            ? {}
            : { intent: homepageDemoClaimIntent }),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to resend confirmation email.");
      }

      setResendStatus("success");
      setResendMessage(
        "If this email still needs confirmation, we sent a new link."
      );
      setCoolingDown(true);

      window.setTimeout(() => {
        setCoolingDown(false);
      }, 60000);
    } catch {
      setResendStatus("error");
      setResendMessage(
        "We couldn\u2019t send a new confirmation email. Please try again."
      );
    }
  }

  return (
    <main className="check-email-page" style={styles.page}>
      <section className="check-email-card" style={styles.card}>
        <Link href="/" aria-label="Text2Task home" style={styles.logoLink}>
          <Image
            src="/text2task-logo.png"
            alt="Text2Task"
            width={154}
            height={40}
            priority
            style={styles.logo}
          />
        </Link>

        <div style={styles.iconWrap} aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.75 6.75h14.5v10.5H4.75V6.75Z"
              stroke="#2563eb"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="m5.25 7.25 6.75 5.2 6.75-5.2"
              stroke="#2563eb"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={styles.copy}>
          <h1 style={styles.title}>
            {hasConfirmationLinkError ? "Confirmation link expired" : "Check your email"}
          </h1>

          {hasConfirmationLinkError ? (
            <p style={styles.description}>
              This confirmation link is invalid or expired. Send a new
              confirmation email.
            </p>
          ) : (
            <p style={styles.description}>
              We sent a confirmation link to <strong>{displayEmail}</strong>.
            </p>
          )}

          <p style={styles.secondary}>
            {homepageDemoClaimIntent === null
              ? "Check your inbox and click the confirmation link to activate your account."
              : "Your project is ready. Confirm your email to continue saving it."}
          </p>
        </div>

        <div style={styles.resendBox}>
          {shouldShowEmailInput ? (
            <label style={styles.resendField}>
              <span style={styles.resendLabel}>Email address</span>
              <input
                type="email"
                value={resendEmail}
                onChange={(event) => {
                  setResendEmail(event.target.value);
                  if (resendStatus === "error") {
                    setResendStatus("idle");
                    setResendMessage("");
                  }
                }}
                placeholder="you@example.com"
                autoComplete="email"
                style={styles.resendInput}
              />
            </label>
          ) : null}

          <button
            type="button"
            style={styles.resendButton}
            disabled={resendStatus === "sending" || coolingDown}
            onClick={handleResendConfirmation}
          >
            {resendStatus === "sending"
              ? "Sending..."
              : "Resend confirmation email"}
          </button>

          {resendMessage ? (
            <p
              style={
                resendStatus === "success"
                  ? styles.resendSuccess
                  : styles.resendError
              }
            >
              {resendMessage}
            </p>
          ) : null}
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() =>
              router.push(
                getAuthPathWithHomepageDemoClaimIntent(
                  "/login",
                  homepageDemoClaimIntent
                )
              )
            }
          >
            Go to Login
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() =>
              router.push(
                getAuthPathWithHomepageDemoClaimIntent(
                  "/signup",
                  homepageDemoClaimIntent
                )
              )
            }
          >
            Back to Sign Up
          </button>
        </div>

        <p style={styles.helpText}>
          Didn&apos;t receive it? Check your spam folder or contact{" "}
          <a href="mailto:support@text2task.com" style={styles.supportLink}>
            support@text2task.com
          </a>
          .
        </p>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div style={styles.page} />}>
      <CheckEmailContent />
    </Suspense>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at 50% 0%, rgba(219, 234, 254, 0.9) 0, rgba(219, 234, 254, 0) 34%), linear-gradient(135deg, #f8fbff 0%, #eef5ff 48%, #ffffff 100%)",
    color: "#0f172a",
  },
  card: {
    width: "100%",
    maxWidth: "430px",
    borderRadius: "28px",
    background: "rgba(255, 255, 255, 0.94)",
    border: "1px solid rgba(203, 213, 225, 0.82)",
    boxShadow: "0 28px 90px rgba(15, 23, 42, 0.13)",
    padding: "34px 30px",
    display: "grid",
    justifyItems: "center",
    gap: "18px",
    textAlign: "center",
  },
  logoLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    marginBottom: "4px",
  },
  logo: {
    width: "154px",
    height: "auto",
    objectFit: "contain",
  },
  iconWrap: {
    width: "58px",
    height: "58px",
    borderRadius: "18px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 16px 36px rgba(37, 99, 235, 0.12)",
  },
  copy: {
    display: "grid",
    gap: "10px",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "30px",
    lineHeight: 1.08,
    letterSpacing: "-0.035em",
    fontWeight: 850,
  },
  description: {
    margin: 0,
    color: "#334155",
    fontSize: "15px",
    lineHeight: 1.65,
  },
  secondary: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.65,
  },
  actions: {
    width: "100%",
    display: "grid",
    gap: "10px",
    marginTop: "4px",
  },
  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "13px 16px",
    fontSize: "14px",
    fontWeight: 850,
    cursor: "pointer",
    boxShadow: "0 18px 38px rgba(15, 23, 42, 0.22)",
  },
  secondaryButton: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  resendBox: {
    width: "100%",
    display: "grid",
    gap: "10px",
  },
  resendField: {
    width: "100%",
    display: "grid",
    gap: "8px",
    textAlign: "left",
  },
  resendLabel: {
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: 850,
  },
  resendInput: {
    width: "100%",
    height: 50,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
    fontSize: 15,
    boxSizing: "border-box",
  },
  resendButton: {
    width: "100%",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 850,
    cursor: "pointer",
  },
  resendSuccess: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.5,
  },
  resendError: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.5,
  },
  helpText: {
    margin: "2px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  supportLink: {
    color: "#2563eb",
    fontWeight: 800,
    textDecoration: "none",
  },
};

const responsiveCss = `
  .check-email-card button {
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease;
  }

  .check-email-card button:hover {
    transform: translateY(-1px);
  }

  .check-email-card button:disabled {
    cursor: not-allowed !important;
    opacity: 0.72;
    transform: none !important;
  }

  .check-email-card input:focus {
    border-color: #93c5fd !important;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
  }

  .check-email-card button:focus-visible,
  .check-email-page a:focus-visible,
  .check-email-card input:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.28);
    outline-offset: 3px;
  }

  @media (max-width: 640px) {
    .check-email-page {
      padding: 16px !important;
      align-items: center !important;
    }

    .check-email-card {
      border-radius: 24px !important;
      padding: 28px 22px !important;
      gap: 16px !important;
    }
  }
`;
