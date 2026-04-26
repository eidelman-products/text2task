export default function PrivacyPage() {
  const pageStyle = {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "40px 20px 80px",
  } as const;

  const containerStyle = {
    maxWidth: "920px",
    margin: "0 auto",
  } as const;

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    padding: "32px",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  } as const;

  const pillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontWeight: 800,
    fontSize: "13px",
    letterSpacing: "0.01em",
    marginBottom: "18px",
  } as const;

  const h2Style = {
    fontSize: "22px",
    fontWeight: 850,
    color: "#0f172a",
    marginTop: "28px",
    marginBottom: "10px",
    letterSpacing: "-0.02em",
  } as const;

  const pStyle = {
    color: "#334155",
    lineHeight: 1.8,
    fontSize: "16px",
    marginTop: 0,
    marginBottom: "14px",
  } as const;

  const mutedStyle = {
    color: "#64748b",
    lineHeight: 1.8,
    fontSize: "16px",
    marginTop: 0,
    marginBottom: "14px",
  } as const;

  const listStyle = {
    color: "#334155",
    lineHeight: 1.8,
    fontSize: "16px",
    marginTop: 0,
    marginBottom: "14px",
    paddingLeft: "22px",
  } as const;

  const footerStyle = {
    marginTop: "28px",
    paddingTop: "18px",
    borderTop: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.7,
  } as const;

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={pillStyle}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                background: "#2563eb",
              }}
            />
            Privacy Policy
          </div>

          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: "42px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#0f172a",
            }}
          >
            InboxShaper Privacy Policy
          </h1>

          <p style={mutedStyle}>
            <b>Effective date:</b> April 2026
          </p>

          <p style={{ ...pStyle, fontSize: "18px", color: "#475569" }}>
            InboxShaper is built as a privacy-first service. This Privacy Policy
            explains what Google user data is accessed, how it is used, how it
            is protected, and what control users have over their connection.
          </p>

          <p style={{ ...pStyle, fontWeight: 800, color: "#0f172a" }}>
            InboxShaper accesses limited Gmail user data only to provide inbox
            analysis and insights features. InboxShaper does not sell Gmail user
            data, does not use it for advertising, and does not use it to train
            AI models.
          </p>

          <h2 style={h2Style}>1. Google User Data Access</h2>
          <p style={pStyle}>
            When you connect your Google account through Google OAuth,
            InboxShaper may access limited Gmail user data required to provide
            its core functionality.
          </p>

          <p style={pStyle}>
            InboxShaper may access the following Gmail user data:
          </p>
          <ul style={listStyle}>
            <li>
              Email metadata such as sender information, subject lines, message
              labels, categories, and related inbox classification signals
            </li>
            <li>
              Message identifiers required to analyze and group emails for
              insights
            </li>
            <li>
              Gmail account email address used to identify the connected user
              account
            </li>
          </ul>

          <p style={pStyle}>
            InboxShaper does not access, read, or store the full content of
            Gmail messages.
          </p>

          <p style={pStyle}>
            InboxShaper does <b>not</b> use Gmail user data for advertising,
            marketing profiling, resale, or any unrelated purpose.
          </p>

          <h2 style={h2Style}>2. How Gmail User Data Is Used</h2>
          <p style={pStyle}>
            InboxShaper uses the data listed above only to provide the features
            of the product, including:
          </p>
          <ul style={listStyle}>
            <li>Analyzing inbox structure and email volume</li>
            <li>Identifying sender groups and high-volume senders</li>
            <li>Detecting promotions and other inbox patterns</li>
            <li>Displaying inbox insights, statistics, and dashboard summaries</li>
          </ul>

          <p style={pStyle}>
            InboxShaper does not delete, archive, move, or modify emails in the
            user's mailbox.
          </p>

          <h2 style={h2Style}>3. Gmail Scope Justification</h2>

          <p style={pStyle}>
            InboxShaper uses read-only Gmail access (<b>gmail.readonly</b>) to
            analyze email metadata and provide insights about inbox activity.
          </p>

          <p style={pStyle}>
            InboxShaper does not modify, delete, archive, or change any emails
            in the user&apos;s mailbox.
          </p>

          <p style={pStyle}>
            This limited read-only access ensures user data safety while
            allowing InboxShaper to deliver analytics and insights features.
          </p>

          <h2 style={h2Style}>4. Email Content Handling</h2>
          <p style={pStyle}>
            InboxShaper is designed as a metadata-first product. It does not
            permanently store, copy, or archive full email bodies or email
            content as part of normal operation.
          </p>

          <p style={pStyle}>
            InboxShaper primarily uses metadata such as sender, subject line,
            labels, categories, and message IDs to provide analysis and
            insights.
          </p>

          <h2 style={h2Style}>5. Token Storage & Authentication</h2>
          <p style={pStyle}>
            InboxShaper securely stores OAuth tokens, including access tokens
            and refresh tokens, required to maintain your Gmail connection and
            analyze inbox metadata.
          </p>

          <p style={pStyle}>
            These tokens are encrypted and used only for authentication and for
            providing the analytics and insights explicitly requested by the
            user.
          </p>

          <h2 style={h2Style}>6. Data Retention</h2>
          <p style={pStyle}>
            InboxShaper does not permanently store full email content.
          </p>

          <p style={pStyle}>
            Limited aggregated analytics data, such as sender counts,
            categories, inbox metrics, scan summaries, and related statistics,
            may be stored temporarily to provide dashboard functionality.
          </p>

          <h2 style={h2Style}>7. Data Sharing and Third Parties</h2>
          <p style={pStyle}>
            InboxShaper does not sell, share, or transfer Gmail user data to
            third parties except as necessary to operate the service through
            trusted infrastructure providers.
          </p>

          <p style={pStyle}>
            These service providers may include hosting, database, and cloud
            infrastructure vendors. They may process data only as needed to
            support InboxShaper&apos;s functionality and are not permitted to use
            the data for unrelated purposes.
          </p>

          <h2 style={h2Style}>8. Security</h2>
          <p style={pStyle}>
            InboxShaper uses industry-standard security practices, including
            encryption, secure authentication flows, restricted access controls,
            and secure token handling to protect user data.
          </p>

          <h2 style={h2Style}>9. User Control, Revocation, and Deletion</h2>
          <p style={pStyle}>
            Users remain in control of their Gmail connection and may revoke
            access to InboxShaper at any time through their Google Account
            settings.
          </p>

          <p style={pStyle}>
            Users can also disconnect their account directly from the
            InboxShaper dashboard, which stops further Gmail access by the
            application unless the user reconnects.
          </p>

          <h2 style={h2Style}>10. Google API Services Disclosure</h2>
          <p style={pStyle}>
            InboxShaper&apos;s use of information received from Google APIs adheres
            to the Google API Services User Data Policy, including the Limited
            Use requirements.
          </p>

          <p style={pStyle}>
            InboxShaper does not use Google user data to develop, improve, or
            train generalized AI or machine learning models.
          </p>

          <h2 style={h2Style}>11. Contact</h2>
          <p style={pStyle}>
            For questions please contact:{" "}
            <a
              href="mailto:support@inboxshaper.com"
              style={{
                color: "#2563eb",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              support@inboxshaper.com
            </a>
          </p>

          <div style={footerStyle}>
            InboxShaper • Privacy-first Gmail analytics and insights
          </div>
        </div>
      </div>
    </main>
  );
}