"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = useMemo(() => {
    return searchParams.get("email") || "your email";
  }, [searchParams]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>✉️</div>

        <h1 style={styles.title}>Check your email</h1>

        <p style={styles.description}>
          We sent a confirmation link to <strong>{email}</strong>.
        </p>

        <p style={styles.secondary}>
          Open the email and click the confirmation link before logging in.
        </p>

        <button style={styles.primaryButton} onClick={() => router.push("/login")}>
          Go to Login
        </button>

        <button style={styles.secondaryButton} onClick={() => router.push("/signup")}>
          Back to Sign Up
        </button>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div style={styles.container} />}>
      <CheckEmailContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#111827",
    borderRadius: "16px",
    padding: "32px 28px",
    display: "grid",
    gap: "14px",
    textAlign: "center",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  },
  icon: {
    fontSize: "34px",
    lineHeight: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: "28px",
    fontWeight: 800,
    margin: 0,
  },
  description: {
    color: "#cbd5e1",
    fontSize: "15px",
    lineHeight: 1.6,
    margin: 0,
  },
  secondary: {
    color: "#94a3b8",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: 0,
  },
  primaryButton: {
    marginTop: "8px",
    padding: "12px 14px",
    borderRadius: "8px",
    border: "none",
    background: "#22c55e",
    color: "#04130a",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "11px 14px",
    borderRadius: "8px",
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#e5e7eb",
    fontWeight: 700,
    cursor: "pointer",
  },
};