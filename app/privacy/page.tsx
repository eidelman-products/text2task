import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Text2Task — how we collect, use, protect, and manage your information.",
};

export default function PrivacyPage() {
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
            Privacy Policy
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
            Your data should stay private, clear, and protected.
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
            This Privacy Policy explains how Text2Task collects, uses, stores,
            and protects information when you use our website, account system,
            AI extraction tools, dashboard, and paid subscription features.
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
          <PolicyBlock title="1. Information we collect">
            <p>
              When you use Text2Task, we may collect the information you provide
              directly, including your email address, account details, submitted
              text, uploaded screenshots or images, extracted tasks, client
              names, deadlines, budgets, task notes, and other information you
              choose to save in your workspace.
            </p>
            <p>
              We also collect basic technical information such as browser type,
              device information, IP-related metadata, usage events, page views,
              authentication activity, and subscription-related events needed to
              operate and secure the service.
            </p>
          </PolicyBlock>

          <PolicyBlock title="2. How we use your information">
            <p>
              We use your information to provide the Text2Task service, process
              AI extraction requests, create structured task previews, save tasks
              to your workspace, maintain your account, process subscriptions,
              improve reliability, prevent abuse, and provide support.
            </p>
            <p>
              We may also use aggregated or anonymized information to understand
              product usage, improve onboarding, improve user experience, and
              make the product better.
            </p>
          </PolicyBlock>

          <PolicyBlock title="3. AI processing">
            <p>
              Text2Task uses AI services to extract structured task information
              from the text or images you submit. This may include client names,
              task descriptions, budgets, deadlines, priority, contact details,
              and related work information.
            </p>
            <p>
              You should not submit sensitive personal information, confidential
              third-party information, medical records, government IDs, payment
              card numbers, passwords, or other highly sensitive data unless it
              is necessary and you have the right to use it.
            </p>
          </PolicyBlock>

          <PolicyBlock title="4. Payments and subscriptions">
            <p>
              Paid subscriptions are processed through our payment provider. We
              do not store full payment card numbers on our servers. Payment
              providers may collect billing details, transaction information,
              and payment method information according to their own policies.
            </p>
            <p>
              We store subscription status information such as plan type,
              subscription status, payment provider identifiers, and related
              timestamps so we can unlock paid features for your account.
            </p>
          </PolicyBlock>

          <PolicyBlock title="5. Cookies and authentication">
            <p>
              Text2Task uses cookies and similar technologies to keep you signed
              in, secure your session, remember authentication state, and operate
              the dashboard. Some cookies are necessary for the service to work.
            </p>
          </PolicyBlock>

          <PolicyBlock title="6. Data storage and security">
            <p>
              We use reasonable technical and organizational measures to protect
              your information, including account-based access controls,
              database security rules, and secure service providers. However, no
              internet service can guarantee absolute security.
            </p>
            <p>
              You are responsible for keeping your login credentials secure and
              for using strong passwords where applicable.
            </p>
          </PolicyBlock>

          <PolicyBlock title="7. Data sharing">
            <p>
              We do not sell your personal information. We may share limited
              information with trusted service providers that help us operate
              Text2Task, including hosting, database, authentication, AI
              processing, analytics, email, and payment services.
            </p>
            <p>
              We may also disclose information if required by law, to protect
              our rights, prevent fraud or abuse, or enforce our terms.
            </p>
          </PolicyBlock>

          <PolicyBlock title="8. Your choices and rights">
            <p>
              Depending on your location, you may have rights to access, update,
              delete, or request a copy of your personal information. You can
              also choose not to provide certain information, but some features
              may not work without it.
            </p>
            <p>
              To request account or data deletion, contact us using the contact
              information below.
            </p>
          </PolicyBlock>

          <PolicyBlock title="9. Data retention">
            <p>
              We retain information for as long as needed to provide the
              service, maintain your account, comply with legal obligations,
              resolve disputes, prevent abuse, and enforce agreements. You may
              request deletion of your account data, subject to legal and
              operational requirements.
            </p>
          </PolicyBlock>

          <PolicyBlock title="10. Children’s privacy">
            <p>
              Text2Task is not intended for children under 13. We do not
              knowingly collect personal information from children under 13. If
              you believe a child has provided us with personal information,
              please contact us.
            </p>
          </PolicyBlock>

          <PolicyBlock title="11. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. When we make
              changes, we will update the “Last updated” date above. Continued
              use of Text2Task after changes means you accept the updated
              policy.
            </p>
          </PolicyBlock>

          <PolicyBlock title="12. Contact us">
            <p>
              If you have questions about this Privacy Policy or want to make a
              privacy request, contact us at:
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
          </PolicyBlock>
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
            <Link href="/terms" style={footerLinkStyle}>
              Terms
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

function PolicyBlock({
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