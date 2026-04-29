"use client";

import { useEffect, useState } from "react";
import DashboardUserMenu from "@/app/components/dashboard/dashboard-user-menu";

type AccountInfo = {
  id: string;
  email: string;
  plan: "free" | "pro";
  created_at?: string | null;
};

export default function ProfilePage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      try {
        const res = await fetch("/api/billing/subscription", {
          method: "GET",
          cache: "no-store",
        });

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        const data = await res.json();

        if (res.ok) {
          setAccount({
            id: data.id,
            email: data.email,
            plan: data.plan === "pro" ? "pro" : "free",
            created_at: data.created_at || null,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadAccount();
  }, []);

  const displayName = account?.email?.split("@")[0] || "Text2Task user";

  return (
    <main style={styles.page}>
      <div style={styles.accountMenu}>
        <DashboardUserMenu />
      </div>

      <section style={styles.card}>
        <div style={styles.topRow}>
          <a href="/dashboard" style={styles.backLink}>
            ← Back to workspace
          </a>

          <div
            style={{
              ...styles.planBadge,
              ...(account?.plan === "pro" ? styles.proBadge : styles.freeBadge),
            }}
          >
            {account?.plan === "pro" ? "Pro plan" : "Free plan"}
          </div>
        </div>

        <div style={styles.hero}>
          <div style={styles.avatar}>
            {(account?.email || "U").charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={styles.kicker}>Profile</div>
            <h1 style={styles.title}>{displayName}</h1>
            <p style={styles.subtitle}>
              Manage your Text2Task account details and workspace identity.
            </p>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.fieldCard}>
            <div style={styles.label}>Email</div>
            <div style={styles.value}>
              {isLoading ? "Loading..." : account?.email || "Unavailable"}
            </div>
          </div>

          <div style={styles.fieldCard}>
            <div style={styles.label}>Current plan</div>
            <div style={styles.value}>
              {isLoading
                ? "Loading..."
                : account?.plan === "pro"
                  ? "Pro"
                  : "Free"}
            </div>
          </div>

          <div style={styles.fieldCard}>
            <div style={styles.label}>Workspace</div>
            <div style={styles.value}>Text2Task CRM</div>
          </div>

          <div style={styles.fieldCard}>
            <div style={styles.label}>Support</div>
            <a href="mailto:support@text2task.com" style={styles.linkValue}>
              support@text2task.com
            </a>
          </div>
        </div>

        <div style={styles.actions}>
          <a href="/dashboard/billing" style={styles.primaryButton}>
            Open billing
          </a>

          <a href="/contact" style={styles.secondaryButton}>
            Contact support
          </a>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    background:
      "radial-gradient(circle at top left, #eef4ff 0%, #f8fafc 46%, #ffffff 100%)",
    color: "#0f172a",
  },

  accountMenu: {
    position: "fixed",
    top: 24,
    right: 32,
    zIndex: 1000,
  },

  card: {
    width: "100%",
    maxWidth: 900,
    margin: "70px auto 0",
    borderRadius: 30,
    border: "1px solid rgba(226,232,240,0.95)",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 24px 70px rgba(15,23,42,0.08)",
    padding: 30,
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 26,
  },

  backLink: {
    color: "#4f46e5",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },

  planBadge: {
    height: 30,
    padding: "0 12px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  proBadge: {
    color: "#166534",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.22)",
  },

  freeBadge: {
    color: "#1d4ed8",
    background: "rgba(59,130,246,0.10)",
    border: "1px solid rgba(59,130,246,0.18)",
  },

  hero: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginBottom: 28,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #f97316, #f59e0b)",
    color: "#ffffff",
    fontSize: 26,
    fontWeight: 950,
    boxShadow: "0 18px 38px rgba(249,115,22,0.22)",
  },

  kicker: {
    color: "#6366f1",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    marginBottom: 6,
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.055em",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.6,
    fontWeight: 650,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },

  fieldCard: {
    borderRadius: 20,
    border: "1px solid rgba(226,232,240,0.95)",
    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
    padding: 18,
  },

  label: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 7,
  },

  value: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
    wordBreak: "break-word",
  },

  linkValue: {
    color: "#4338ca",
    fontSize: 15,
    fontWeight: 900,
    wordBreak: "break-word",
    textDecoration: "none",
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
  },

  primaryButton: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 15,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
    textDecoration: "none",
    boxShadow: "0 14px 28px rgba(79,70,229,0.22)",
  },

  secondaryButton: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 15,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(203,213,225,0.95)",
    fontSize: 14,
    fontWeight: 950,
    textDecoration: "none",
  },
};