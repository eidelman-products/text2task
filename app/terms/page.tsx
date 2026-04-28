import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Text2Task — rules, subscriptions, acceptable use, AI output, and user responsibilities.",
};

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #eef4ff 0%, #f8fafc 42%, #ffffff 100%)",
        padding: "28px 24px 56px",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 48,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "#0f172a",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #60a5fa, #6366f1, #8b5cf6)",
                boxShadow: "0 0 0 8px rgba(99,102,241,0.10)",
              }}
            />
            Text2Task
          </Link>

          <Link
            href="/"
            style={{
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
            }}
          >
            Back to Home
          </Link>
        </header>

        <section
          style={{
            borderRadius: 34,
            padding: "38px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(239,246,255,0.55))",
            border: "1px solid rgba(191,219,254,0.90)",
            boxShadow:
              "0 28px 70px rgba(37,99,235,0.10), inset 0 1px 0 rgba(255,255,255,0.94)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
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
            }}
          >
            Terms of Service
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(42px, 6vw, 64px)",
              lineHeight: 1.08,
              letterSpacing: "-0.055em",
              fontWeight: 780,
              color: "#111827",
              marginBottom: 18,
            }}
          >
            Clear rules for using Text2Task responsibly.
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
            These Terms of Service explain how you can use Text2Task, what we
            provide, what responsibilities you have, and how subscriptions,
            feature limits, AI output, and acceptable use work.
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
            <span style={pillStyle}>Last updated: April 27, 2026</span>
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

          <TermsBlock title="8. Service availability">
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

          <TermsBlock title="9. User responsibility">
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

          <TermsBlock title="10. Limitation of liability">
            <p>
              Text2Task is provided “as is” and “as available.” We are not
              responsible for missed deadlines, incorrect AI output, lost
              revenue, business interruption, data entry mistakes, or other
              indirect or consequential losses.
            </p>
          </TermsBlock>

          <TermsBlock title="11. Termination">
            <p>
              We may suspend or terminate access to Text2Task if an account
              violates these Terms, abuses the service, creates security risks,
              or causes harm to the platform or other users.
            </p>
          </TermsBlock>

          <TermsBlock title="12. Changes to these Terms">
            <p>
              We may update these Terms of Service from time to time. When we
              make changes, we will update the “Last updated” date above.
            </p>
            <p>
              Continued use of Text2Task after changes means you accept the
              updated Terms.
            </p>
          </TermsBlock>

          <TermsBlock title="13. Contact us">
            <p>
              If you have questions about these Terms of Service, contact us at:
            </p>
            <div
              style={{
                marginTop: 12,
                borderRadius: 18,
                padding: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#0f172a",
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
            <Link href="/privacy" style={footerLinkStyle}>
              Privacy
            </Link>
            <Link href="/contact" style={footerLinkStyle}>
              Contact
            </Link>
            <Link href="/" style={footerLinkStyle}>
              Home
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
        padding: "24px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          color: "#0f172a",
          fontSize: 24,
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
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#334155",
};

const contentCardStyle: React.CSSProperties = {
  borderRadius: 30,
  padding: "12px 34px",
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(226,232,240,0.96)",
  boxShadow: "0 24px 60px rgba(15,23,42,0.07)",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#475569",
  textDecoration: "none",
};