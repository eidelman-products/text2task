import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Text2Task — how we collect, use, protect, and manage your information.",
};

type PrivacyPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const params = searchParams ? await searchParams : {};
  const cameFromDashboard = params?.from === "dashboard";

  const backHref = cameFromDashboard ? "/dashboard" : "/";
  const backLabel = cameFromDashboard ? "Back to workspace" : "Back to Home";
  const footerHomeHref = cameFromDashboard ? "/dashboard" : "/";
  const footerHomeLabel = cameFromDashboard ? "Dashboard" : "Home";
  const termsHref = cameFromDashboard ? "/terms?from=dashboard" : "/terms";
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
            Privacy Policy
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
            Privacy, security, and your workspace data.
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
            Text2Task uses your information to run your workspace, process AI
            extracts, manage subscriptions, and keep your account secure.
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
            <p>
              <strong>Google sign-in.</strong> If you choose to sign in with
              Google, Text2Task uses Google only to create and access your
              Text2Task account. We may receive basic account information such
              as your name and email address. Text2Task does not request access
              to your Gmail, Google Drive, Google Calendar, Google Contacts, or
              your Google files.
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
            <Link href={termsHref} style={footerLinkStyle}>
              Terms
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
