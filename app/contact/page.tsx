import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Text2Task for support, billing questions, privacy requests, partnerships, and product feedback.",
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
  const privacyHref = cameFromDashboard ? "/privacy?from=dashboard" : "/privacy";
  const termsHref = cameFromDashboard ? "/terms?from=dashboard" : "/terms";

  const supportMailto =
    "mailto:support@text2task.com?subject=Text2Task%20support%20request";
  const privacyMailto =
    "mailto:support@text2task.com?subject=Text2Task%20privacy%20request";
  const feedbackMailto =
    "mailto:support@text2task.com?subject=Text2Task%20product%20feedback";

  return (
    <main style={pageStyle}>
      <style>{responsiveCss}</style>

      <div className="contact-container" style={containerStyle}>
        <header className="contact-header" style={headerStyle}>
          <Link href={backHref} style={brandStyle} aria-label="Text2Task home">
            <Image
              src="/text2task-logo.png"
              alt="Text2Task"
              width={170}
              height={52}
              priority
              style={logoStyle}
            />
          </Link>

          <Link href={backHref} style={backButtonStyle}>
            {backLabel}
          </Link>
        </header>

        <section className="contact-hero" style={heroStyle}>
          <div style={heroCopyStyle}>
            <div style={statusPillStyle}>
              <span style={statusDotStyle} />
              Contact Text2Task
            </div>

            <h1 className="contact-title" style={h1Style}>
              Contact Text2Task support.
            </h1>

            <p className="contact-lead" style={leadStyle}>
              Need help with your account, billing, privacy, feedback, or
              partnerships? Email the Text2Task team directly.
            </p>
          </div>

          <div className="contact-primary-card" style={primaryCardStyle}>
            <div style={primaryIconStyle}>✉</div>

            <div style={primaryCardCopyStyle}>
              <div style={primaryLabelStyle}>Main support email</div>
              <a href={supportMailto} style={primaryEmailStyle}>
                support@text2task.com
              </a>
              <p style={primaryTextStyle}>
                Use this email for account help, billing questions, product
                feedback, and partnership messages.
              </p>
            </div>

            <a href={supportMailto} style={primaryButtonStyle}>
              Email Text2Task Support
            </a>
          </div>
        </section>

        <section className="contact-help-list" style={helpSectionStyle}>
          <h2 style={helpTitleStyle}>What we can help with</h2>

          <div style={helpListStyle}>
            <ContactCard
              title="Support & billing"
              text="Account access, dashboard questions, extracts, billing, subscription status."
              href={supportMailto}
              cta="Send support email"
            />

            <ContactCard
              title="Privacy requests"
              text="Account deletion, data deletion, privacy help, or data questions."
              href={privacyMailto}
              cta="Send privacy request"
            />

            <ContactCard
              title="Feedback & partnerships"
              text="Product feedback, unclear flows, partnerships."
              href={feedbackMailto}
              cta="Send feedback"
            />
          </div>
        </section>

        <section className="contact-info-box" style={infoBoxStyle}>
          <div style={infoHeaderStyle}>
            <div>
              <h2 style={infoTitleStyle}>Before contacting us</h2>
              <p style={infoSubtitleStyle}>
                A little context helps us answer faster.
              </p>
            </div>
          </div>

          <div style={infoGridStyle}>
            <InfoRow
              label="Billing or subscription"
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
            <Link href={privacyHref} style={footerLinkStyle}>
              Privacy
            </Link>
            <Link href={termsHref} style={footerLinkStyle}>
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

function ContactCard({
  title,
  text,
  href,
  cta,
}: {
  title: string;
  text: string;
  href?: string;
  cta?: string;
}) {
  return (
    <article style={cardStyle}>
      <div style={cardContentStyle}>
        <h2 style={cardTitleStyle}>{title}</h2>
        <p style={cardTextStyle}>{text}</p>
      </div>

      {href && cta ? (
        <a className="contact-action-button" href={href} style={secondaryButtonStyle}>
          {cta}
        </a>
      ) : null}
    </article>
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
  @media (max-width: 900px) {
    .contact-hero {
      grid-template-columns: 1fr !important;
    }

    .contact-primary-card {
      max-width: 100% !important;
    }

    .contact-help-list {
      margin-bottom: 24px !important;
    }
  }

  @media (max-width: 700px) {
    .contact-container {
      max-width: 100% !important;
    }

    .contact-header {
      margin-bottom: 28px !important;
    }

    .contact-hero {
      border-radius: 0 !important;
      padding: 0 !important;
    }

    .contact-title {
      font-size: 42px !important;
      line-height: 1.04 !important;
    }

    .contact-lead {
      font-size: 16px !important;
      line-height: 1.65 !important;
    }

    .contact-primary-card {
      padding: 20px 0 !important;
      border-radius: 0 !important;
    }

    .contact-action-button {
      width: 100% !important;
      box-sizing: border-box !important;
      overflow-wrap: anywhere !important;
      text-align: center !important;
    }

    .contact-help-list article {
      grid-template-columns: 1fr !important;
      justify-items: start !important;
      gap: 10px !important;
    }

    .contact-info-box {
      padding: 24px 0 0 !important;
      border-radius: 0 !important;
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

    .contact-title {
      font-size: 38px !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "30px 24px 56px",
  background:
    "linear-gradient(180deg, #ffffff 0%, #f8fafc 56%, #ffffff 100%)",
  color: "#0f172a",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 34,
  flexWrap: "wrap",
};

const brandStyle: React.CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const logoStyle: React.CSSProperties = {
  width: 170,
  height: "auto",
  objectFit: "contain",
  objectPosition: "left center",
  display: "block",
};

const backButtonStyle: React.CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  background: "rgba(239,246,255,0.72)",
  color: "#1d4ed8",
  border: "1px solid rgba(191,219,254,0.86)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.06fr 0.94fr",
  gap: 28,
  alignItems: "stretch",
  borderRadius: 0,
  padding: 0,
  background: "transparent",
  border: "none",
  boxShadow: "none",
  marginBottom: 28,
};

const heroCopyStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "center",
  gap: 16,
};

const statusPillStyle: React.CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(239,246,255,0.72)",
  border: "1px solid rgba(191,219,254,0.86)",
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#22c55e",
  boxShadow: "0 0 0 4px rgba(34,197,94,0.14)",
};

const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(42px, 5vw, 60px)",
  lineHeight: 1.02,
  letterSpacing: "-0.055em",
  fontWeight: 950,
  color: "#0f172a",
};

const leadStyle: React.CSSProperties = {
  margin: 0,
  color: "#5f6b85",
  fontSize: 18,
  lineHeight: 1.72,
  maxWidth: 680,
};

const primaryCardStyle: React.CSSProperties = {
  borderRadius: 0,
  padding: "22px 0",
  background: "transparent",
  borderTop: "1px solid rgba(226,232,240,0.92)",
  borderBottom: "1px solid rgba(226,232,240,0.92)",
  boxShadow: "none",
  display: "grid",
  alignContent: "center",
  gap: 18,
};

const primaryIconStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(239,246,255,0.82)",
  color: "#1d4ed8",
  border: "1px solid rgba(191,219,254,0.82)",
  fontSize: 24,
  fontWeight: 900,
};

const primaryCardCopyStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const primaryLabelStyle: React.CSSProperties = {
  color: "#667085",
  fontSize: 13,
  fontWeight: 800,
};

const primaryEmailStyle: React.CSSProperties = {
  width: "fit-content",
  color: "#102045",
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: "-0.035em",
  textDecoration: "none",
  overflowWrap: "anywhere",
};

const primaryTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#667085",
  fontSize: 14,
  lineHeight: 1.65,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 14,
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 14px 28px rgba(37,99,235,0.20)",
};

const helpSectionStyle: React.CSSProperties = {
  marginBottom: 22,
};

const helpTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: "-0.035em",
};

const helpListStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  borderTop: "1px solid rgba(226,232,240,0.92)",
};

const cardStyle: React.CSSProperties = {
  minHeight: 74,
  padding: "14px 0",
  background: "transparent",
  borderBottom: "1px solid rgba(226,232,240,0.92)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 18,
};

const cardContentStyle: React.CSSProperties = {
  minWidth: 0,
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 5px",
  fontSize: 16,
  lineHeight: 1.18,
  letterSpacing: "-0.025em",
  fontWeight: 900,
  color: "#0f172a",
};

const cardTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#5f6b85",
  fontSize: 14,
  lineHeight: 1.58,
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 999,
  background: "#ffffff",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 900,
  border: "1px solid rgba(191,219,254,0.82)",
};

const infoBoxStyle: React.CSSProperties = {
  borderRadius: 0,
  padding: "24px 0 0",
  background: "transparent",
  borderTop: "1px solid rgba(226,232,240,0.92)",
  boxShadow: "none",
};

const infoHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
  marginBottom: 18,
};

const infoTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.18,
  letterSpacing: "-0.04em",
  fontWeight: 900,
  color: "#0f172a",
};

const infoSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: 14,
  lineHeight: 1.6,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  borderTop: "1px solid rgba(226,232,240,0.92)",
};

const infoRowStyle: React.CSSProperties = {
  padding: "13px 0",
  background: "transparent",
  borderBottom: "1px solid rgba(226,232,240,0.92)",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 5,
};

const infoTextStyle: React.CSSProperties = {
  color: "#5f6b85",
  fontSize: 13,
  lineHeight: 1.62,
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
