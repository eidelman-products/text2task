import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Text2Task for support, billing questions, privacy requests, and product feedback.",
};

type ContactPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = searchParams ? await searchParams : {};
  const cameFromDashboard = params?.from === "dashboard";

  const backHref = cameFromDashboard ? "/dashboard" : "/";
  const backLabel = cameFromDashboard ? "Back to workspace" : "Back to Home";
  const footerHomeLabel = cameFromDashboard ? "Dashboard" : "Home";

  return (
    <main style={pageStyle}>
      <style>{responsiveCss}</style>

      <div className="contact-container" style={containerStyle}>
        <header className="contact-header" style={headerStyle}>
          <Link href={backHref} style={brandStyle}>
            <span style={brandDotStyle} />
            Text2Task
          </Link>

          <Link href={backHref} style={backButtonStyle}>
            {backLabel}
          </Link>
        </header>

        <section className="contact-hero" style={heroStyle}>
          <div style={badgeStyle}>Contact</div>

          <h1 className="contact-title" style={h1Style}>
            Need help with Text2Task?
          </h1>

          <p className="contact-lead" style={leadStyle}>
            For support, billing questions, privacy requests, product feedback,
            or general questions, contact us by email.
          </p>
        </section>

        <section className="contact-cards-grid" style={cardsGridStyle}>
          <div style={cardStyle}>
            <div style={iconStyle}>✉️</div>
            <h2 style={cardTitleStyle}>Support</h2>
            <p style={cardTextStyle}>
              Questions about your account, dashboard, extracts, tasks, billing,
              or subscription status.
            </p>
            <a
              className="contact-action-button"
              href="mailto:support@text2task.com"
              style={emailButtonStyle}
            >
              support@text2task.com
            </a>
          </div>

          <div style={cardStyle}>
            <div style={iconStyle}>🔐</div>
            <h2 style={cardTitleStyle}>Privacy requests</h2>
            <p style={cardTextStyle}>
              Contact us to request account deletion, data deletion, or privacy
              support.
            </p>
            <a
              className="contact-action-button"
              href="mailto:support@text2task.com"
              style={secondaryButtonStyle}
            >
              Send privacy request
            </a>
          </div>
        </section>

        <section className="contact-info-box" style={infoBoxStyle}>
          <h2 style={infoTitleStyle}>Before contacting us</h2>

          <div style={infoGridStyle}>
            <InfoRow
              label="Billing"
              text="Include the email address used for your Text2Task account."
            />
            <InfoRow
              label="Bug report"
              text="Describe what happened, what you expected, and include screenshots if possible."
            />
            <InfoRow
              label="Account deletion"
              text="Use the email address connected to your account so we can verify the request."
            />
          </div>
        </section>

        <footer className="contact-footer" style={footerStyle}>
          <span>© 2026 Text2Task. All rights reserved.</span>

          <div style={footerLinksStyle}>
            <Link href="/privacy" style={footerLinkStyle}>
              Privacy
            </Link>
            <Link href="/terms" style={footerLinkStyle}>
              Terms
            </Link>
            <Link href={backHref} style={footerLinkStyle}>
              {footerHomeLabel}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function InfoRow({ label, text }: { label: string; text: string }) {
  return (
    <div style={infoRowStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoTextStyle}>{text}</div>
    </div>
  );
}

const responsiveCss = `
  @media (max-width: 700px) {
    .contact-container {
      max-width: 100% !important;
    }

    .contact-header {
      margin-bottom: 32px !important;
    }

    .contact-hero {
      padding: 32px 26px !important;
      border-radius: 30px !important;
    }

    .contact-title {
      font-size: 42px !important;
      line-height: 1.05 !important;
    }

    .contact-lead {
      font-size: 17px !important;
      line-height: 1.68 !important;
    }

    .contact-cards-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .contact-action-button {
      width: 100% !important;
      box-sizing: border-box !important;
      overflow-wrap: anywhere !important;
      text-align: center !important;
    }

    .contact-info-box {
      padding: 22px !important;
      border-radius: 26px !important;
    }

    .contact-footer {
      display: grid !important;
      gap: 14px !important;
    }
  }

  @media (max-width: 430px) {
    .contact-header {
      align-items: flex-start !important;
    }

    .contact-header a:last-child {
      min-height: 40px !important;
      padding: 0 14px !important;
      font-size: 13px !important;
    }

    .contact-hero {
      padding: 30px 22px !important;
    }

    .contact-title {
      font-size: 38px !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "28px 24px 56px",
  background:
    "radial-gradient(circle at top left, #eef4ff 0%, #f8fafc 46%, #ffffff 100%)",
  color: "#0f172a",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 48,
  flexWrap: "wrap",
};

const brandStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

const brandDotStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "linear-gradient(135deg, #60a5fa, #6366f1, #8b5cf6)",
  boxShadow: "0 0 0 8px rgba(99,102,241,0.10)",
};

const backButtonStyle: React.CSSProperties = {
  minHeight: 42,
  padding: "0 16px",
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 14px 28px rgba(15,23,42,0.14)",
};

const heroStyle: React.CSSProperties = {
  borderRadius: 34,
  padding: 38,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(239,246,255,0.55))",
  border: "1px solid rgba(191,219,254,0.90)",
  boxShadow:
    "0 28px 70px rgba(37,99,235,0.10), inset 0 1px 0 rgba(255,255,255,0.94)",
  marginBottom: 24,
};

const badgeStyle: React.CSSProperties = {
  width: "fit-content",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 18,
};

const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(42px, 6vw, 64px)",
  lineHeight: 1.08,
  letterSpacing: "-0.055em",
  fontWeight: 780,
  color: "#111827",
  marginBottom: 18,
};

const leadStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 18,
  lineHeight: 1.75,
  maxWidth: 760,
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 18,
  marginBottom: 24,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 26,
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(226,232,240,0.96)",
  boxShadow: "0 24px 60px rgba(15,23,42,0.07)",
};

const iconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(99,102,241,0.10)",
  fontSize: 22,
  marginBottom: 16,
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 24,
  lineHeight: 1.2,
  letterSpacing: "-0.035em",
  fontWeight: 850,
  color: "#0f172a",
};

const cardTextStyle: React.CSSProperties = {
  margin: "0 0 18px",
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.7,
};

const emailButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 14,
  background: "#4f46e5",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 14px 28px rgba(79,70,229,0.20)",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  border: "1px solid #cbd5e1",
};

const infoBoxStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 26,
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(226,232,240,0.96)",
  boxShadow: "0 24px 60px rgba(15,23,42,0.07)",
};

const infoTitleStyle: React.CSSProperties = {
  margin: "0 0 18px",
  fontSize: 24,
  lineHeight: 1.2,
  letterSpacing: "-0.035em",
  fontWeight: 850,
  color: "#0f172a",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const infoRowStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 850,
  marginBottom: 4,
};

const infoTextStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.65,
};

const footerStyle: React.CSSProperties = {
  marginTop: 26,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const footerLinksStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#475569",
  textDecoration: "none",
};