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
            <b>Effective date:</b> March 2026
          </p>

          <p style={{ ...pStyle, fontSize: "18px", color: "#475569" }}>
            InboxShaper is built as a privacy-first service. This Privacy Policy
            explains what data is accessed, how it is used, and how it is
            protected.
          </p>

          <p style={{ ...pStyle, fontWeight: 800, color: "#0f172a" }}>
            InboxShaper only accesses Gmail metadata required to provide its
            functionality and does not read or store email content.
          </p>

          <h2 style={h2Style}>1. Information Access</h2>
          <p style={pStyle}>
            When you connect your Gmail account, InboxShaper requests access
            only to the data necessary to provide inbox analysis and cleanup
            features.
          </p>

          <h2 style={h2Style}>2. Gmail Data Usage</h2>
          <p style={pStyle}>
            InboxShaper accesses limited Gmail data such as sender information,
            subject lines, message labels, and metadata in order to:
          </p>
          <p style={pStyle}>
            • Analyze inbox structure
            <br />
            • Identify sender groups
            <br />
            • Detect promotions and categories
            <br />
            • Provide insights and statistics
            <br />
            • Perform actions requested by the user
          </p>

          <p style={pStyle}>
            InboxShaper requests Gmail modification permissions (gmail.modify)
            only to perform actions explicitly initiated by the user, such as:
            archiving emails, moving messages to trash, or marking messages as
            read.
          </p>

          <p style={pStyle}>
            InboxShaper does not perform any actions automatically.
          </p>

          <p style={pStyle}>
            InboxShaper does not use Gmail data for advertising, profiling, or
            any unrelated purposes.
          </p>

          <h2 style={h2Style}>3. No Email Content Storage</h2>
          <p style={pStyle}>
            InboxShaper does not store, copy, or permanently archive email
            content or message bodies.
          </p>

          <h2 style={h2Style}>4. Token Storage & Authentication</h2>
          <p style={pStyle}>
            InboxShaper securely stores OAuth tokens (access tokens and refresh
            tokens) required to maintain your Gmail connection.
          </p>

          <p style={pStyle}>
            These tokens are encrypted and used only to perform actions
            requested by the user.
          </p>

          <h2 style={h2Style}>5. Data Retention</h2>
          <p style={pStyle}>
            InboxShaper does not permanently store email content.
          </p>

          <p style={pStyle}>
            Aggregated analytics data (such as sender counts, categories, and
            inbox statistics) may be stored temporarily to provide dashboard
            functionality.
          </p>

          <h2 style={h2Style}>6. User Control</h2>
          <p style={pStyle}>
            All actions performed by InboxShaper require explicit user
            initiation. Users remain in full control of their data and actions.
          </p>

          <h2 style={h2Style}>7. Data Deletion & Access Revocation</h2>
          <p style={pStyle}>
            Users can revoke access to InboxShaper at any time through their
            Google Account settings.
          </p>

          <p style={pStyle}>
            Users can also disconnect their account directly from the
            InboxShaper dashboard.
          </p>

          <h2 style={h2Style}>8. Third-Party Services</h2>
          <p style={pStyle}>
            InboxShaper relies on trusted third-party infrastructure providers
            (such as cloud hosting and database services) to operate.
          </p>

          <p style={pStyle}>
            These services process data only as required to provide the
            functionality of InboxShaper and are not permitted to use data for
            other purposes.
          </p>

          <h2 style={h2Style}>9. Security</h2>
          <p style={pStyle}>
            InboxShaper uses industry-standard security practices including
            encryption, secure authentication flows, and restricted access to
            sensitive data.
          </p>

          <h2 style={h2Style}>10. Google API Services Disclosure</h2>
          <p style={pStyle}>
            InboxShaper’s use of information received from Google APIs adheres
            to the Google API Services User Data Policy, including Limited Use
            requirements.
          </p>

          <p style={pStyle}>
            InboxShaper does not sell or transfer Gmail user data to third
            parties.
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
            InboxShaper • Privacy-first Gmail cleanup and analytics
          </div>
        </div>
      </div>
    </main>
  );
}