export default function TermsPage() {
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
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
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

          <div style={pillStyle}>Terms of Service</div>

          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: "42px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#0f172a",
            }}
          >
            InboxShaper Terms of Service
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
            InboxShaper is a tool designed to help users organize and clean
            their Gmail inbox using simple, user-controlled actions.
          </p>

          <h2 style={h2Style}>1. Use of Service</h2>
          <p style={pStyle}>
            By using InboxShaper, you authorize the application to access
            limited Gmail data necessary to provide features such as inbox
            analysis, sender grouping, promotions detection, and user-requested
            cleanup actions.
          </p>

          <h2 style={h2Style}>2. User Control</h2>
          <p style={pStyle}>
            InboxShaper only performs actions that are explicitly triggered by
            the user. The application does not automatically delete, modify, or
            archive emails without user interaction.
          </p>

          <h2 style={h2Style}>3. No Email Storage</h2>
          <p style={pStyle}>
            InboxShaper does not store, copy, or permanently archive your
            emails. Operations are performed directly through the Gmail API in
            real time.
          </p>

          <h2 style={h2Style}>4. User Responsibility</h2>
          <p style={pStyle}>
            Users are responsible for reviewing actions before applying changes
            to their inbox. InboxShaper is a helper tool, and users remain
            responsible for the final decision to delete, archive, or otherwise
            manage their email.
          </p>

          <h2 style={h2Style}>5. Limitation of Liability</h2>
          <p style={pStyle}>
            InboxShaper is provided &quot;as is&quot; without warranties of any
            kind. To the maximum extent permitted by law, InboxShaper shall not
            be liable for any damages, losses, or consequences resulting from
            the use of the service.
          </p>

          <h2 style={h2Style}>6. Contact</h2>
          <p style={pStyle}>
            For questions regarding these Terms of Service, please contact:{" "}
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

          <h2 style={h2Style}>Google API Services</h2>
          <p style={pStyle}>
            InboxShaper’s use of Google APIs complies with the Google API
            Services User Data Policy.
          </p>

          <p style={pStyle}>
            Users may revoke access to their Gmail account at any time through
            their Google Account security settings or through the Disconnect
            feature inside InboxShaper.
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