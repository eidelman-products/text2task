"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type PortalData = {
  customerPortalUrl: string | null;
  updatePaymentMethodUrl: string | null;
  updateSubscriptionUrl: string | null;
  plan: string;
  status: string;
};

type ViewState = "loading" | "ready" | "error";

type StatCard = {
  icon: string;
  eyebrow: string;
  value: string;
  description: string;
  accent: "blue" | "green" | "violet" | "amber";
};

type FeatureRow = {
  feature: string;
  free: string;
  pro: string;
};

function getAccentStyles(accent: StatCard["accent"]) {
  switch (accent) {
    case "blue":
      return {
        softBg: "#eff6ff",
        iconBg: "#dbeafe",
        iconColor: "#2563eb",
        border: "#bfdbfe",
        glow: "0 10px 24px rgba(37, 99, 235, 0.08)",
      };
    case "green":
      return {
        softBg: "#f0fdf4",
        iconBg: "#dcfce7",
        iconColor: "#16a34a",
        border: "#bbf7d0",
        glow: "0 10px 24px rgba(34, 197, 94, 0.08)",
      };
    case "violet":
      return {
        softBg: "#faf5ff",
        iconBg: "#ede9fe",
        iconColor: "#7c3aed",
        border: "#ddd6fe",
        glow: "0 10px 24px rgba(124, 58, 237, 0.08)",
      };
    case "amber":
      return {
        softBg: "#fff7ed",
        iconBg: "#fed7aa",
        iconColor: "#ea580c",
        border: "#fdba74",
        glow: "0 10px 24px rgba(249, 115, 22, 0.08)",
      };
    default:
      return {
        softBg: "#f8fafc",
        iconBg: "#e2e8f0",
        iconColor: "#475569",
        border: "#cbd5e1",
        glow: "0 10px 24px rgba(15, 23, 42, 0.06)",
      };
  }
}

export default function ManageSubscription() {
  const [data, setData] = useState<PortalData | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadBillingData() {
    try {
      setViewState("loading");
      setErrorMessage("");

      const res = await fetch("/api/billing/portal", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json?.error || "Failed to load billing details.");
        setViewState("error");
        return;
      }

      setData(json);
      setViewState("ready");
    } catch (error) {
      console.error(error);
      setErrorMessage("We could not load your billing details right now.");
      setViewState("error");
    }
  }

  useEffect(() => {
    loadBillingData();
  }, []);

  const isPro = data?.plan === "pro";
  const planLabel = isPro ? "Pro" : "Free";

  const statusLabel = useMemo(() => {
    if (!data?.status) {
      return isPro ? "Active" : "Limited";
    }
    return data.status.charAt(0).toUpperCase() + data.status.slice(1);
  }, [data?.status, isPro]);

  async function handleOpenPortal() {
    try {
      setOpeningPortal(true);
      setErrorMessage("");

      const res = await fetch("/api/billing/portal", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json?.error || "Failed to open billing portal.");
        return;
      }

      if (!json?.customerPortalUrl) {
        setErrorMessage("No billing portal is available for this account yet.");
        return;
      }

      window.open(json.customerPortalUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while opening the billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  async function handleUpgradeToPro() {
    try {
      setStartingCheckout(true);
      setErrorMessage("");

      const res = await fetch("/api/creem/checkout", {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json?.error || "Failed to start checkout.");
        return;
      }

      if (!json?.url) {
        setErrorMessage("Checkout URL is missing.");
        return;
      }

      window.location.href = json.url;
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while starting checkout.");
    } finally {
      setStartingCheckout(false);
    }
  }

  function handleBackToDashboard() {
    window.location.href = "/dashboard";
  }

  const featureComparison: FeatureRow[] = [
    { feature: "Full inbox scan", free: "Sample only", pro: "Included" },
    { feature: "Cleanup actions", free: "Weekly limits", pro: "Unlimited" },
    { feature: "Billing portal access", free: "Locked", pro: "Included" },
    { feature: "Advanced workflow", free: "Limited", pro: "Included" },
  ];

  const statCards: StatCard[] = isPro
    ? [
        {
          icon: "✦",
          eyebrow: "Current plan",
          value: "Pro",
          description: "Full access to premium billing and subscription controls.",
          accent: "blue",
        },
        {
          icon: "✓",
          eyebrow: "Subscription status",
          value: statusLabel,
          description: "Your subscription is active and securely managed by Creem.",
          accent: "green",
        },
        {
          icon: "⌘",
          eyebrow: "Billing access",
          value: "Portal ready",
          description: "Manage invoices, payment details, and plan settings in one place.",
          accent: "violet",
        },
      ]
    : [
        {
          icon: "🆓",
          eyebrow: "Current plan",
          value: "Free",
          description: "Your account is currently on the Free plan with limited access.",
          accent: "amber",
        },
        {
          icon: "🔒",
          eyebrow: "Subscription status",
          value: statusLabel,
          description: "Upgrade to unlock premium billing and subscription controls.",
          accent: "blue",
        },
        {
          icon: "🚀",
          eyebrow: "Upgrade path",
          value: "Go Pro",
          description: "Unlock full scan, unlimited cleanup, and a premium billing experience.",
          accent: "violet",
        },
      ];

  const pageShell: CSSProperties = {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  };

  const outerCard: CSSProperties = {
    background: "#ffffff",
    border: isPro ? "1px solid #dbeafe" : "1px solid #fde68a",
    borderRadius: "32px",
    padding: "28px",
    boxShadow: isPro
      ? "0 30px 80px rgba(37, 99, 235, 0.18)"
  : "0 30px 80px rgba(249, 115, 22, 0.18)",
  };

  const topSectionGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.85fr",
    gap: "18px",
    alignItems: "stretch",
  };

  const heroCard: CSSProperties = {
    borderRadius: "28px",
    border: isPro ? "1px solid #bfdbfe" : "1px solid #fde68a",
    background: isPro
      ? "linear-gradient(135deg, #0f172a 0%, #111827 45%, #1e3a8a 100%)"
      : "linear-gradient(135deg, #7c2d12 0%, #9a3412 45%, #ea580c 100%)",
    padding: "26px",
    boxShadow: isPro
      ? "0 24px 60px rgba(37, 99, 235, 0.14)"
      : "0 24px 60px rgba(249, 115, 22, 0.14)",
    transition: "all 0.3s ease",
  };

  const sideSummaryCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.04)",
  borderRadius: "28px",
  padding: "22px",
  boxShadow: isPro
    ? "0 14px 34px rgba(37, 99, 235, 0.06)"
    : "0 14px 34px rgba(249, 115, 22, 0.06)",
  height: "100%",
  alignSelf: "stretch",
};

  if (viewState === "loading") {
    return (
      <div style={pageShell}>
        <div style={outerCard}>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: "12px",
            }}
          >
            Manage Subscription
          </div>
          <div
            style={{
              fontSize: "16px",
              color: "#64748b",
              lineHeight: 1.7,
            }}
          >
            Loading your billing details...
          </div>
        </div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div style={pageShell}>
        <div style={outerCard}>
          <button
            type="button"
            onClick={handleBackToDashboard}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: "14px",
              padding: "11px 16px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            ← Back to Dashboard
          </button>

          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: "10px",
            }}
          >
            Manage Subscription
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: "16px",
              lineHeight: 1.7,
              marginBottom: "18px",
            }}
          >
            {errorMessage || "We could not load your billing details right now."}
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: "none",
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: "14px",
              padding: "12px 18px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <div style={outerCard}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "999px",
                background: isPro ? "#dbeafe" : "#fff7ed",
                color: isPro ? "#1d4ed8" : "#c2410c",
                fontSize: "13px",
                fontWeight: 800,
                marginBottom: "14px",
              }}
            >
              {isPro ? "Billing Center" : "Upgrade Center"}
            </div>

            <div
              style={{
                fontSize: "50px",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 0.98,
                color: "#0f172a",
                marginBottom: "14px",
              }}
            >
              Manage Subscription
            </div>

            <div
              style={{
                fontSize: "17px",
                color: "#64748b",
                lineHeight: 1.8,
                maxWidth: "760px",
              }}
            >
              {isPro
                ? "Open your secure billing portal to manage your subscription, update your payment method, review invoices, and control your billing settings from one place."
                : "Upgrade to Pro to unlock full billing access, advanced subscription controls, unlimited cleanup, and the complete premium InboxShaper workflow."}
            </div>
          </div>

          <button
            type="button"
            onClick={handleBackToDashboard}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: "14px",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "22px",
          }}
        >
          {(isPro
            ? [
                { label: "🔒 Secure billing active", bg: "#eff6ff", color: "#1d4ed8" },
                { label: "⚡ Managed by Creem", bg: "#f5f3ff", color: "#7c3aed" },
                { label: "✅ 1 active subscription", bg: "#ecfdf5", color: "#166534" },
              ]
            : [
                { label: "🟠 Free plan active", bg: "#fff7ed", color: "#c2410c" },
                { label: "🚀 Upgrade available", bg: "#eff6ff", color: "#1d4ed8" },
                { label: "🔒 Limited access", bg: "#f8fafc", color: "#475569" },
              ]
          ).map((chip) => (
            <div
              key={chip.label}
              style={{
                borderRadius: "999px",
                padding: "10px 14px",
                background: chip.bg,
                color: chip.color,
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              {chip.label}
            </div>
          ))}
        </div>

        <div style={topSectionGrid}>
          <div
            style={heroCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.01)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "44px",
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                {planLabel}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "999px",
                  padding: "9px 14px",
                  background: isPro ? "rgba(34,197,94,0.18)" : "rgba(251,191,36,0.18)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 800,
                  border: isPro
                    ? "1px solid rgba(34,197,94,0.35)"
                    : "1px solid rgba(251,191,36,0.35)",
                }}
              >
                <span
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "999px",
                    background: isPro ? "#22c55e" : "#f59e0b",
                    display: "inline-block",
                  }}
                />
                {statusLabel}
              </div>
            </div>

            <div
              style={{
                color: "rgba(255,255,255,0.86)",
                fontSize: "16px",
                lineHeight: 1.8,
                maxWidth: "620px",
                marginBottom: "20px",
              }}
            >
              {isPro
                ? "Your subscription is active and your billing is already connected. Open the secure customer portal to update payment details, review invoices, and manage your plan."
                : "You are currently on the Free plan. Upgrade to Pro to unlock the full InboxShaper billing experience, unlimited cleanup, and premium subscription controls."}
            </div>

            <button
              type="button"
              onClick={isPro ? handleOpenPortal : handleUpgradeToPro}
              disabled={openingPortal || startingCheckout}
              style={{
                border: "none",
                background: isPro
                  ? "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)"
                  : "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                color: "#ffffff",
                borderRadius: "16px",
                padding: "15px 22px",
                fontSize: "15px",
                fontWeight: 800,
                cursor: openingPortal || startingCheckout ? "not-allowed" : "pointer",
                boxShadow: isPro
  ? "0 30px 80px rgba(37, 99, 235, 0.18)"
  : "0 30px 80px rgba(249, 115, 22, 0.18)",

opacity: openingPortal || startingCheckout ? 0.85 : 1,
              }}
            >
              {isPro
                ? openingPortal
                  ? "Opening Billing Portal..."
                  : "Manage Billing & Subscription"
                : startingCheckout
                ? "Starting Checkout..."
                : "Unlock Pro – Full Access"}
            </button>

            {errorMessage ? (
              <div
                style={{
                  marginTop: "14px",
                  color: "#fecaca",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div style={sideSummaryCard}>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "10px",
                letterSpacing: "-0.02em",
              }}
            >
              {isPro ? "Billing overview" : "Upgrade overview"}
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                lineHeight: 1.8,
                marginBottom: "18px",
              }}
            >
              {isPro
                ? "Everything important about your current billing access in one quick summary."
                : "A quick look at what changes when you move from Free to Pro."}
            </div>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              <SummaryLine
                label="Plan"
                value={planLabel}
                good={isPro}
              />
              <SummaryLine
                label="Status"
                value={statusLabel}
                good={isPro}
              />
              <SummaryLine
                label="Portal access"
                value={isPro ? "Available" : "Locked"}
                good={isPro}
              />
              <SummaryLine
                label="Cleanup"
                value={isPro ? "Unlimited" : "Weekly limits"}
                good={isPro}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginTop: "26px",
            marginBottom: "20px",
          }}
        >
          {statCards.map((card) => (
            <StatCardView key={card.eyebrow} card={card} />
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "18px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "24px",
              padding: "22px",
              boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "8px",
                letterSpacing: "-0.02em",
              }}
            >
              Free vs Pro
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#64748b",
                lineHeight: 1.7,
                marginBottom: "18px",
              }}
            >
              Compare what you get with the Free plan versus the full Pro experience.
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 0.8fr 0.8fr",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <HeaderCell align="left">Feature</HeaderCell>
                <HeaderCell free>Free</HeaderCell>
                <HeaderCell pro>Pro</HeaderCell>
              </div>

              {featureComparison.map((row, index) => (
                <FeatureComparisonRow
                  key={row.feature}
                  row={row}
                  isLast={index === featureComparison.length - 1}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "24px",
              padding: "22px",
              boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "10px",
                letterSpacing: "-0.02em",
              }}
            >
              {isPro ? "Included with Pro" : "Why upgrade"}
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                lineHeight: 1.8,
                marginBottom: "18px",
              }}
            >
              {isPro
                ? "Your current plan already includes the core premium billing benefits below."
                : "Pro is designed for users who want full control, fewer limits, and a complete billing workflow."}
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {(isPro
                ? [
                    "Secure customer billing portal",
                    "Invoice and payment access",
                    "Premium subscription controls",
                    "Unlimited cleanup workflow",
                  ]
                : [
                    "Full scan instead of sample-only",
                    "Unlimited cleanup actions",
                    "Billing portal and invoices",
                    "Premium account management",
                  ]
              ).map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "12px 14px",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isPro ? "#dcfce7" : "#dbeafe",
                      color: isPro ? "#166534" : "#1d4ed8",
                      fontSize: "12px",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>

                  <span
                    style={{
                      color: "#0f172a",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#64748b",
              lineHeight: 1.8,
            }}
          >
            Your billing is securely managed by Creem. You can safely update or cancel your subscription at any time from the billing portal.
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "12px 14px",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: good ? "#166534" : "#92400e",
          fontSize: "13px",
          fontWeight: 800,
          padding: "5px 10px",
          borderRadius: "999px",
          background: good ? "#ecfdf5" : "#fff7ed",
          border: good ? "1px solid #bbf7d0" : "1px solid #fed7aa",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatCardView({ card }: { card: StatCard }) {
  const accent = getAccentStyles(card.accent);

  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${accent.border}`,
        borderRadius: "20px",
        padding: "14px",
        boxShadow: accent.glow,
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "14px",
          background: accent.iconBg,
          color: accent.iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "17px",
          marginBottom: "10px",
        }}
      >
        {card.icon}
      </div>

      <div
        style={{
          fontSize: "11px",
          fontWeight: 800,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "8px",
        }}
      >
        {card.eyebrow}
      </div>

      <div
        style={{
          fontSize: "20px",
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.03em",
          marginBottom: "6px",
        }}
      >
        {card.value}
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: "14px",
          lineHeight: 1.65,
        }}
      >
        {card.description}
      </div>
    </div>
  );
}

function HeaderCell({
  children,
  align = "center",
  free,
  pro,
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  free?: boolean;
  pro?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        fontWeight: 800,
        color: free ? "#9a3412" : pro ? "#166534" : "#0f172a",
        textAlign: align,
        background: free ? "#fff7ed" : pro ? "#ecfdf5" : "#f8fafc",
      }}
    >
      {children}
    </div>
  );
}

function FeatureComparisonRow({
  row,
  isLast,
}: {
  row: FeatureRow;
  isLast: boolean;
}) {
  const borderBottom = isLast ? "none" : "1px solid #e2e8f0";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.8fr 0.8fr",
        borderBottom,
      }}
    >
      <div
        style={{
          padding: "16px",
          color: "#0f172a",
          fontSize: "15px",
          fontWeight: 700,
          background: "#ffffff",
        }}
      >
        {row.feature}
      </div>

      <div
        style={{
          padding: "16px",
          color: "#64748b",
          fontSize: "14px",
          fontWeight: 600,
          textAlign: "center",
          background: "#ffffff",
        }}
      >
        {row.free}
      </div>

      <div
        style={{
          padding: "16px",
          color: "#166534",
          fontSize: "14px",
          fontWeight: 800,
          textAlign: "center",
          background: "#f0fdf4",
        }}
      >
        {row.pro}
      </div>
    </div>
  );
}