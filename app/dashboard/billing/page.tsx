"use client";

import { useEffect, useState } from "react";
import DashboardUserMenu from "@/app/components/dashboard/dashboard-user-menu";

type AccountInfo = {
  email: string;
  plan: "free" | "pro";
};

export default function BillingPage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

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
            email: data.email,
            plan: data.plan === "pro" ? "pro" : "free",
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

  async function startCheckout() {
    if (isCheckoutLoading) return;

    try {
      setIsCheckoutLoading(true);

      const res = await fetch("/api/creem/checkout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Checkout URL missing");
    } catch (error) {
      console.error(error);
      alert("Could not open checkout. Please try again.");
      setIsCheckoutLoading(false);
    }
  }

  const isPro = account?.plan === "pro";

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
              ...(isPro ? styles.proBadge : styles.freeBadge),
            }}
          >
            {isLoading ? "Loading" : isPro ? "Pro plan" : "Free plan"}
          </div>
        </div>

        <div style={styles.hero}>
          <div style={styles.iconBox}>💳</div>

          <div>
            <div style={styles.kicker}>Billing</div>
            <h1 style={styles.title}>Manage your plan</h1>
            <p style={styles.subtitle}>
              Review your current plan, upgrade to Pro, and manage billing access for
              Text2Task.
            </p>
          </div>
        </div>

        <div style={styles.planCard}>
          <div>
            <div style={styles.planName}>
              {isPro ? "Text2Task Pro" : "Text2Task Free"}
            </div>

            <div style={styles.planDescription}>
              {isPro
                ? "Unlimited AI extracts, image extraction, CSV export, archive workflow, and dashboard analytics are unlocked."
                : "Free users can use the workspace with limited access. Upgrade to unlock unlimited extracts and CSV export."}
            </div>
          </div>

          <div style={styles.priceBox}>
            <div style={styles.price}>{isPro ? "$12.90" : "$0"}</div>
            <div style={styles.priceNote}>{isPro ? "/ month" : "Free plan"}</div>
          </div>
        </div>

        <div style={styles.featureGrid}>
          <Feature title="AI text extraction" enabled />
          <Feature title="AI image extraction" enabled />
          <Feature title="Task CRM" enabled />
          <Feature title="Archive & restore" enabled />
          <Feature title="Dashboard analytics" enabled />
          <Feature title="CSV export" enabled={isPro} />
        </div>

        <div style={styles.actions}>
          {isPro ? (
            <>
              <a href="/contact" style={styles.secondaryButton}>
                Contact billing support
              </a>

              <div style={styles.note}>
                Customer portal management will be connected after Creem live review is
                fully approved.
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={startCheckout}
              disabled={isCheckoutLoading}
              style={{
                ...styles.primaryButton,
                opacity: isCheckoutLoading ? 0.7 : 1,
                cursor: isCheckoutLoading ? "not-allowed" : "pointer",
              }}
            >
              {isCheckoutLoading ? "Opening checkout..." : "Upgrade to Pro"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function Feature({ title, enabled }: { title: string; enabled: boolean }) {
  return (
    <div style={styles.featureItem}>
      <span
        style={{
          ...styles.featureDot,
          background: enabled ? "#22c55e" : "#cbd5e1",
        }}
      />
      <span style={styles.featureText}>{title}</span>
      <span style={enabled ? styles.enabledText : styles.lockedText}>
        {enabled ? "Included" : "Pro"}
      </span>
    </div>
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
    maxWidth: 960,
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

  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 24,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#ffffff",
    fontSize: 26,
    fontWeight: 950,
    boxShadow: "0 18px 38px rgba(79,70,229,0.24)",
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
    maxWidth: 640,
  },

  planCard: {
    borderRadius: 24,
    border: "1px solid rgba(199,210,254,0.72)",
    background:
      "linear-gradient(135deg, rgba(238,242,255,0.85), rgba(255,255,255,0.95))",
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
  },

  planName: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    marginBottom: 6,
  },

  planDescription: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    maxWidth: 620,
  },

  priceBox: {
    textAlign: "right",
    flexShrink: 0,
  },

  price: {
    color: "#4f46e5",
    fontSize: 32,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  priceNote: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },

  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  featureItem: {
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid rgba(226,232,240,0.95)",
    background: "#ffffff",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  featureDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    flexShrink: 0,
  },

  featureText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 850,
    flex: 1,
  },

  enabledText: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: 950,
  },

  lockedText: {
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 950,
  },

  actions: {
    marginTop: 24,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },

  primaryButton: {
    minHeight: 46,
    padding: "0 20px",
    borderRadius: 15,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
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

  note: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
  },
};