export default function PrivacyTrust() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <section
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          padding: "28px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "36px", fontWeight: 800 }}>
          Privacy & Trust
        </h1>

        <p style={{ marginTop: "10px", color: "#64748b", lineHeight: 1.7 }}>
          InboxShaper is designed to help you clean your Gmail inbox while
          respecting your privacy. We only access the Gmail data required to
          provide inbox organization features, and nothing happens without your
          permission.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "16px",
            marginTop: "24px",
          }}
        >
          <div className="trust-card">
            <h3>Metadata only</h3>
            <p>
              InboxShaper analyzes sender, subject, labels, and message metadata
              required for inbox organization.
            </p>
          </div>

          <div className="trust-card">
            <h3>No automatic actions</h3>
            <p>
              Emails are never deleted, archived, or modified automatically.
              Every action requires your confirmation.
            </p>
          </div>

          <div className="trust-card">
            <h3>Disconnect anytime</h3>
            <p>
              You can disconnect your Gmail account anytime from the dashboard.
            </p>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          padding: "28px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>How InboxShaper protects your data</h2>

        <ul style={{ lineHeight: 1.8 }}>
          <li>InboxShaper does not permanently store email content.</li>
          <li>All Gmail data processing happens in real time.</li>
          <li>Scan results are temporary and exist only during your session.</li>
          <li>InboxShaper does not build a database of your emails.</li>
          <li>No Gmail user data is sold or transferred to third parties.</li>
        </ul>
      </section>

      <section
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          padding: "28px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>Your control</h2>

        <p style={{ color: "#64748b", lineHeight: 1.7 }}>
          InboxShaper only works when you start a scan. The system never scans
          your inbox automatically in the background.
        </p>

        <ul style={{ lineHeight: 1.8 }}>
          <li>You decide when to start a scan.</li>
          <li>You decide which emails to review.</li>
          <li>You decide which cleanup action to apply.</li>
        </ul>
      </section>

      <section
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          padding: "28px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>Helpful links</h2>

        <div style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </div>
      </section>
    </div>
  );
}