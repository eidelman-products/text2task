import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Text2Task — rules, subscriptions, acceptable use, AI output, and user responsibilities.",
};

type TermsPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const params = searchParams ? await searchParams : {};
  const cameFromDashboard = params?.from === "dashboard";

  const backHref = cameFromDashboard ? "/dashboard" : "/";
  const backLabel = cameFromDashboard ? "Back to workspace" : "Back to Home";
  const footerHomeHref = cameFromDashboard ? "/dashboard" : "/";
  const footerHomeLabel = cameFromDashboard ? "Dashboard" : "Home";
  const privacyHref = cameFromDashboard
    ? "/privacy?from=dashboard"
    : "/privacy";
  const contactHref = cameFromDashboard
    ? "/contact?from=dashboard"
    : "/contact";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #ffffff 0%, #f8fafc 56%, #ffffff 100%)",
        padding: "30px 24px 56px",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 34,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={backHref}
            style={brandStyle}
            aria-label="Text2Task home"
          >
            <Image
              src="/text2task-logo.png"
              alt="Text2Task"
              width={170}
              height={52}
              priority
              style={logoStyle}
            />
          </Link>

          <Link
            href={backHref}
            style={{
              minHeight: 42,
              padding: "0 16px",
              borderRadius: 999,
              background: "rgba(239,246,255,0.72)",
              color: "#1d4ed8",
              border: "1px solid rgba(191,219,254,0.86)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            {backLabel}
          </Link>
        </header>

        <section
          style={{
            padding: "0 0 26px",
            background: "transparent",
            border: "none",
            boxShadow: "none",
            marginBottom: 0,
          }}
        >
          <div
            style={{
              width: "fit-content",
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(239,246,255,0.72)",
              border: "1px solid rgba(191,219,254,0.86)",
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Terms of Service
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(38px, 4.8vw, 56px)",
              lineHeight: 1.04,
              letterSpacing: "-0.052em",
              fontWeight: 950,
              color: "#0f172a",
              marginBottom: 18,
            }}
          >
            Terms for using Text2Task.
          </h1>

          <p
            style={{
              margin: 0,
              color: "#475569",
              fontSize: 18,
              lineHeight: 1.75,
              maxWidth: 760,
            }}
          >
            These terms explain how Text2Task works, what you are responsible
            for, and how subscriptions, AI output, limits, and acceptable use
            are handled.
          </p>

          <div
            style={{
              marginTop: 22,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              color: "#334155",
              fontSize: 14,
              fontWeight: 750,
            }}
          >
            <span style={pillStyle}>Last updated: June 19, 2026</span>
            <span style={pillStyle}>Applies to text2task.com</span>
            <span style={pillStyle}>AI + SaaS product</span>
          </div>
        </section>

        <section style={contentCardStyle}>
          <TermsBlock title="1. Using Text2Task">
            <p>
              Text2Task is an AI-powered CRM-style workspace that helps users
              extract structured tasks from text, screenshots, messages, notes,
              and similar inputs.
            </p>
            <p>
              You agree to use Text2Task only for lawful purposes and in a way
              that does not harm the platform, other users, service providers,
              or third parties.
            </p>
          </TermsBlock>

          <TermsBlock title="2. Accounts">
            <p>
              You are responsible for maintaining the security of your account,
              login credentials, and any activity that happens under your
              account.
            </p>
            <p>
              You should use accurate account information and notify us if you
              believe your account has been accessed without permission.
            </p>
          </TermsBlock>

          <TermsBlock title="3. AI-generated output">
            <p>
              Text2Task uses AI to help extract clients, tasks, budgets,
              deadlines, contact details, priorities, and related work
              information.
            </p>
            <p>
              AI output may be incomplete, inaccurate, or require correction.
              You are responsible for reviewing, editing, and verifying all
              extracted information before relying on it.
            </p>
          </TermsBlock>

          <TermsBlock title="4. Acceptable use">
            <p>
              You agree not to upload, process, or store illegal content,
              harmful content, malware, spam, abusive data, or information you
              do not have permission to use.
            </p>
            <p>
              You should not submit passwords, payment card numbers, government
              IDs, medical records, or highly sensitive personal information
              unless it is necessary and you have the legal right to process it.
            </p>
          </TermsBlock>

          <TermsBlock title="5. Subscriptions and billing">
            <p>
              Text2Task offers a Free plan and a paid Pro plan. Paid features
              are unlocked only after successful payment and subscription
              activation.
            </p>
            <p>
              Subscriptions may be billed monthly through our payment provider.
              Billing, payment processing, taxes, and related payment details may
              be handled by third-party payment services.
            </p>
          </TermsBlock>

          <TermsBlock title="6. Feature limits">
            <p>
              Free users are limited to 30 total AI extracts. This limit does
              not renew automatically unless Text2Task changes the plan rules in
              the future.
            </p>
            <p>
              Pro users receive expanded or unlimited access according to the
              current Pro plan. We may update plan limits, features, pricing, or
              availability from time to time.
            </p>
          </TermsBlock>

          <TermsBlock title="7. CSV export and Pro features">
            <p>
              CSV export is currently a Pro feature. Free users can create and
              save tasks, but CSV export may require an active Pro subscription.
            </p>
            <p>
              Future features may be added to Free or Pro plans depending on
              product development and pricing decisions.
            </p>
          </TermsBlock>

          <TermsBlock title="8. Analytics and similar technologies">
            <p>
              Text2Task may use analytics, cookies, localStorage, and similar
              technologies to operate, protect, improve, and measure the service,
              subject to the Privacy Policy and your available consent choices.
            </p>
          </TermsBlock>

          <TermsBlock title="9. Service availability">
            <p>
              We aim to keep Text2Task reliable and available, but we do not
              guarantee uninterrupted access, error-free operation, or permanent
              availability of any feature.
            </p>
            <p>
              The service may be affected by maintenance, updates, third-party
              outages, infrastructure issues, API limits, or unexpected errors.
            </p>
          </TermsBlock>

          <TermsBlock title="10. User responsibility">
            <p>
              You are responsible for how you use Text2Task and for any business
              decisions, client communication, deadlines, pricing, or work
              management decisions you make based on extracted data.
            </p>
            <p>
              Text2Task is a productivity tool and does not replace professional
              judgment, manual review, or your responsibility to manage your own
              work.
            </p>
          </TermsBlock>

          <TermsBlock title="11. Limitation of liability">
            <p>
              Text2Task is provided “as is” and “as available.” We are not
              responsible for missed deadlines, incorrect AI output, lost
              revenue, business interruption, data entry mistakes, or other
              indirect or consequential losses.
            </p>
          </TermsBlock>

          <TermsBlock title="12. Termination">
            <p>
              We may suspend or terminate access to Text2Task if an account
              violates these Terms, abuses the service, creates security risks,
              or causes harm to the platform or other users.
            </p>
          </TermsBlock>

          <TermsBlock title="13. Changes to these Terms">
            <p>
              We may update these Terms of Service from time to time. When we
              make changes, we will update the “Last updated” date above.
            </p>
            <p>
              Continued use of Text2Task after changes means you accept the
              updated Terms.
            </p>
          </TermsBlock>

          <TermsBlock title="14. Contact us">
            <p>
              If you have questions about these Terms of Service, contact us at:
            </p>
            <div
              style={{
                marginTop: 12,
                width: "fit-content",
                borderRadius: 999,
                padding: "9px 13px",
                background: "rgba(239,246,255,0.72)",
                border: "1px solid rgba(191,219,254,0.86)",
                color: "#1d4ed8",
                fontWeight: 850,
              }}
            >
              support@text2task.com
            </div>
          </TermsBlock>
        </section>

        <footer
          style={{
            marginTop: 26,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            color: "#64748b",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>© 2026 Text2Task. All rights reserved.</span>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href={privacyHref} style={footerLinkStyle}>
              Privacy
            </Link>
            <Link href={contactHref} style={footerLinkStyle}>
              Contact
            </Link>
            <Link href={footerHomeHref} style={footerLinkStyle}>
              {footerHomeLabel}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function TermsBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article
      style={{
        padding: "23px 0",
        borderBottom: "1px solid rgba(226,232,240,0.92)",
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          color: "#0f172a",
          fontSize: 22,
          lineHeight: 1.2,
          letterSpacing: "-0.035em",
          fontWeight: 850,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: "grid",
          gap: 12,
          color: "#475569",
          fontSize: 16,
          lineHeight: 1.75,
          fontWeight: 500,
        }}
      >
        {children}
      </div>
    </article>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(191,219,254,0.72)",
  color: "#334155",
};

const contentCardStyle: React.CSSProperties = {
  borderRadius: 0,
  padding: "8px 0",
  background: "#ffffff",
  borderTop: "1px solid rgba(226,232,240,0.92)",
  boxShadow: "none",
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

const footerLinkStyle: React.CSSProperties = {
  color: "#475569",
  textDecoration: "none",
};
