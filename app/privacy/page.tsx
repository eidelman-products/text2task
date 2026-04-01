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

  const backButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontWeight: 800,
    textDecoration: "none",
    fontSize: "14px",
    lineHeight: 1,
    marginBottom: "18px",
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
          <a href="/dashboard" style={backButtonStyle}>
            ← Back to Dashboard
          </a>

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

          <p
            style={{
              ...pStyle,
              fontSize: "18px",
              color: "#475569",
              maxWidth: "860px",
            }}
          >
            InboxShaper is designed with privacy as a core principle. This
            Privacy Policy explains what information InboxShaper accesses, how
            it is used, and how it is protected.
          </p>

          <p
            style={{
              ...pStyle,
              fontWeight: 800,
              color: "#0f172a",
              maxWidth: "860px",
            }}
          >
            InboxShaper only accesses Gmail metadata required to provide its
            functionality. It does not read or permanently store email content.
          </p>

          <h2 style={h2Style}>1. Information Access</h2>
          <p style={pStyle}>
            When you connect your Gmail account, InboxShaper requests access
            only to the Gmail data necessary to provide inbox cleanup and
            organization features.
          </p>

          <h2 style={h2Style}>2. Gmail Data Usage</h2>
          <p style={pStyle}>
            InboxShaper accesses limited Gmail data such as sender information,
            subject lines, message labels, and message metadata in order to
            identify sender groups, detect promotions categories, show inbox
            insights, and perform actions requested by the user.
          </p>

          <p style={pStyle}>
            InboxShaper only accesses Gmail data required to provide inbox
            organization features.
          </p>

          <p style={pStyle}>
            InboxShaper does not use Gmail data for advertising, marketing,
            profiling, or any unrelated purposes.
          </p>

          <p style={pStyle}>
            Gmail data is processed in real time and is not permanently stored
            by InboxShaper servers.
          </p>

          <h2 style={h2Style}>3. No Email Storage</h2>
          <p style={pStyle}>
            InboxShaper does not store, copy, or permanently archive your email
            content. Processing happens in real time through the Gmail API.
          </p>

          <h2 style={h2Style}>4. User Actions</h2>
          <p style={pStyle}>
            InboxShaper only performs actions that are explicitly initiated by
            the user. No emails are modified or deleted automatically.
          </p>

          <h2 style={h2Style}>5. Data Protection</h2>
          <p style={pStyle}>
            InboxShaper uses secure authentication and access controls to
            protect user data.
          </p>

          <h2 style={h2Style}>6. Contact</h2>
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

          <h2 style={h2Style}>Google API Services Disclosure</h2>
          <p style={pStyle}>
            InboxShaper’s use of information received from Google APIs will
            adhere to the Google API Services User Data Policy, including the
            Limited Use requirements.
          </p>

          <p style={pStyle}>
            InboxShaper only accesses Gmail metadata required to provide inbox
            organization features. InboxShaper does not sell or transfer Gmail
            user data to third parties.
          </p>

          <p style={pStyle}>
            All access to Gmail data is used solely to provide functionality
            requested by the user.
          </p>

          <div style={footerStyle}>
            Questions? Contact us at{" "}
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
          </div>
        </div>
      </div>
    </main>
  );
}