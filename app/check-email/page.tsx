"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = useMemo(() => {
    const rawEmail = searchParams.get("email")?.trim();

    if (!rawEmail || rawEmail.length > 140) {
      return "your email";
    }

    return rawEmail;
  }, [searchParams]);

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
          <h1 style={styles.title}>Check your email</h1>

          <p style={styles.description}>
            We sent a confirmation link to <strong>{email}</strong>.
          </p>

          <p style={styles.secondary}>
            Open the email and click the confirmation link before logging in.
          </p>
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => router.push("/login")}
          >
            Go to Login
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push("/signup")}
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

  .check-email-card button:focus-visible,
  .check-email-page a:focus-visible {
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