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
              How can we help?
            </h1>

            <p className="contact-lead" style={leadStyle}>
              For support, billing, privacy requests, partnerships, or product
              feedback — email the Text2Task team directly.
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

        <section className="contact-cards-grid" style={cardsGridStyle}>
          <ContactCard
            icon="💬"
            title="Support & billing"
            text="For account access, dashboard questions, extracts, billing, or subscription status, use the main support email above."
            href={supportMailto}
            cta="Send support email"
          />

          <ContactCard
            icon="🔐"
            title="Privacy requests"
            text="Request account deletion, data deletion, privacy help, or information about your data."
            href={privacyMailto}
            cta="Send privacy request"
          />

          <ContactCard
            icon="✨"
            title="Feedback & partnerships"
            text="Share product feedback, report unclear flows, or contact us about partnerships."
            href={feedbackMailto}
            cta="Send feedback"
          />
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

function ContactCard({
  icon,
  title,
  text,
  href,
  cta,
}: {
  icon: string;
  title: string;
  text: string;
  href?: string;
  cta?: string;
}) {
  return (
    <article style={cardStyle}>
      <div style={iconStyle}>{icon}</div>
      <h2 style={cardTitleStyle}>{title}</h2>
      <p style={cardTextStyle}>{text}</p>

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
      padding: 30px !important;
    }

    .contact-primary-card {
      max-width: 100% !important;
    }

    .contact-cards-grid {
      grid-template-columns: 1fr !important;
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
      border-radius: 28px !important;
      padding: 24px !important;
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
      padding: 22px !important;
      border-radius: 24px !important;
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

    .contact-title {
      font-size: 38px !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "30px 24px 56px",
  background:
    "radial-gradient(circle at 12% 8%, rgba(91,91,214,0.10), transparent 30%), radial-gradient(circle at 90% 20%, rgba(79,124,255,0.08), transparent 28%), linear-gradient(180deg, #fcfcfe 0%, #f8f9fc 100%)",
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
  marginBottom: 42,
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
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 16px 34px rgba(15,23,42,0.16)",
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.06fr 0.94fr",
  gap: 28,
  alignItems: "stretch",
  borderRadius: 34,
  padding: 34,
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(246,244,255,0.72))",
  border: "1px solid #e7e9f2",
  boxShadow:
    "0 30px 80px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.92)",
  marginBottom: 20,
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
  background: "#eeecff",
  border: "1px solid #ddd9ff",
  color: "#4f46e5",
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
  fontSize: "clamp(44px, 5.5vw, 66px)",
  lineHeight: 1.02,
  letterSpacing: "-0.06em",
  fontWeight: 900,
  color: "#102045",
};

const leadStyle: React.CSSProperties = {
  margin: 0,
  color: "#5f6b85",
  fontSize: 18,
  lineHeight: 1.72,
  maxWidth: 680,
};

const primaryCardStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 26,
  background: "#ffffff",
  border: "1px solid #eceef5",
  boxShadow: "0 24px 60px rgba(15,23,42,0.08)",
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
  background: "#f5f3ff",
  color: "#5550d6",
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
  background: "linear-gradient(135deg, #5b5bd6 0%, #4a49c7 100%)",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 16px 32px rgba(91,91,214,0.22)",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 26,
  padding: 22,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #eceef5",
  boxShadow: "0 22px 56px rgba(15,23,42,0.06)",
};

const iconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  background: "#f5f3ff",
  fontSize: 21,
  marginBottom: 16,
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 9px",
  fontSize: 21,
  lineHeight: 1.18,
  letterSpacing: "-0.035em",
  fontWeight: 900,
  color: "#102045",
};

const cardTextStyle: React.CSSProperties = {
  margin: "0 0 18px",
  color: "#5f6b85",
  fontSize: 14,
  lineHeight: 1.68,
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  padding: "0 14px",
  borderRadius: 13,
  background: "#ffffff",
  color: "#102045",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 900,
  border: "1px solid #d8dce8",
};

const infoBoxStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 26,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #eceef5",
  boxShadow: "0 22px 56px rgba(15,23,42,0.06)",
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
  color: "#102045",
};

const infoSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: 14,
  lineHeight: 1.6,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const infoRowStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "#f8f9fc",
  border: "1px solid #e6e8f0",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#102045",
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
  marginTop: 24,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  color: "#667085",
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
