export default function PrivacyTrust() {
  const sectionStyle = {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "30px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  } as const;

  const smallCardStyle = {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "18px",
    minHeight: "150px",
    boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
  } as const;

  const cardTitleStyle = {
    margin: "0 0 10px 0",
    fontSize: "18px",
    fontWeight: 800,
    color: "#0f172a",
  } as const;

  const cardTextStyle = {
    margin: 0,
    color: "#475569",
    lineHeight: 1.7,
    fontSize: "15px",
  } as const;

  const listStyle = {
    margin: "14px 0 0 0",
    paddingLeft: "18px",
    color: "#334155",
    lineHeight: 1.9,
    fontSize: "16px",
  } as const;

  const statPillStyle = {
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
  } as const;

  const linkButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    borderRadius: "14px",
    fontWeight: 800,
    textDecoration: "none",
    fontSize: "15px",
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
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
            marginBottom: "22px",
          }}
        >
          <div style={{ maxWidth: "920px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <a href="/dashboard" style={backButtonStyle}>
                ← Back to Dashboard
              </a>

              <div style={statPillStyle}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "999px",
                    background: "#2563eb",
                  }}
                />
                Metadata access only
              </div>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "42px",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: "#0f172a",
              }}
            >
              Privacy & Trust at InboxShaper
            </h1>

            <p
              style={{
                marginTop: "14px",
                marginBottom: "10px",
                color: "#64748b",
                lineHeight: 1.8,
                fontSize: "18px",
                maxWidth: "980px",
              }}
            >
              InboxShaper is built to help you organize and clean your Gmail
              inbox while keeping you in control. Access is limited, actions are
              user-initiated, and privacy is treated as a core product
              principle.
            </p>

            <p
              style={{
                margin: 0,
                color: "#334155",
                lineHeight: 1.8,
                fontSize: "17px",
                fontWeight: 700,
                maxWidth: "980px",
              }}
            >
              InboxShaper only accesses Gmail metadata required to provide inbox
              analysis and cleanup features. It does not read or permanently
              store email content or message bodies.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          <div style={smallCardStyle}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                marginBottom: "14px",
              }}
            >
              🔎
            </div>
            <h3 style={cardTitleStyle}>Metadata only</h3>
            <p style={cardTextStyle}>
              InboxShaper analyzes sender, subject line, labels, categories,
              and other metadata required for inbox organization and analytics.
            </p>
          </div>

          <div style={smallCardStyle}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                marginBottom: "14px",
              }}
            >
              🛡️
            </div>
            <h3 style={cardTitleStyle}>No automatic actions</h3>
            <p style={cardTextStyle}>
              Emails are never deleted, archived, modified, or cleaned
              automatically. Every action requires explicit user confirmation.
            </p>
          </div>

          <div style={smallCardStyle}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "#ecfdf5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                marginBottom: "14px",
              }}
            >
              🔐
            </div>
            <h3 style={cardTitleStyle}>Encrypted connection tokens</h3>
            <p style={cardTextStyle}>
              Gmail connection tokens are stored securely in encrypted form and
              are used only to keep your account connected and perform
              user-requested actions.
            </p>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: "22px",
            alignItems: "start",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 850,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              How InboxShaper protects your data
            </h2>

            <p
              style={{
                marginTop: "10px",
                marginBottom: 0,
                color: "#64748b",
                lineHeight: 1.75,
                fontSize: "16px",
              }}
            >
              The service is designed around limited access, minimal retention,
              and user-controlled behavior.
            </p>

            <ul style={listStyle}>
              <li>InboxShaper does not store email content or message bodies.</li>
              <li>Gmail metadata is accessed only as needed to provide the service.</li>
              <li>
                Aggregated scan analytics such as counts, sender groups, and
                category summaries may be stored to power dashboard insights.
              </li>
              <li>InboxShaper does not build a permanent archive of your inbox.</li>
              <li>No Gmail user data is sold or used for advertising.</li>
            </ul>
          </div>

          <div
            style={{
              borderRadius: "20px",
              border: "1px solid #dbeafe",
              background:
                "linear-gradient(180deg, rgba(239,246,255,1) 0%, rgba(248,250,252,1) 100%)",
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#2563eb",
                marginBottom: "10px",
              }}
            >
              Gmail permission usage
            </div>

            <div
              style={{
                fontSize: "15px",
                lineHeight: 1.75,
                color: "#334155",
                fontWeight: 600,
              }}
            >
              InboxShaper requests Gmail modification access only to perform
              actions explicitly initiated by the user, such as archiving
              emails, moving messages to trash, or marking messages as read.
            </div>

            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop: "1px solid #dbeafe",
                fontSize: "14px",
                lineHeight: 1.7,
                color: "#1e3a8a",
                fontWeight: 700,
              }}
            >
              InboxShaper’s use of Google API data follows the Google API
              Services User Data Policy, including Limited Use requirements.
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "22px",
            alignItems: "start",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 850,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              Your control
            </h2>

            <p
              style={{
                marginTop: "10px",
                color: "#64748b",
                lineHeight: 1.75,
                fontSize: "16px",
              }}
            >
              InboxShaper only works when you choose to use it. The system never
              scans your inbox automatically in the background.
            </p>

            <ul style={listStyle}>
              <li>You decide when to connect Gmail.</li>
              <li>You decide when to start a scan.</li>
              <li>You decide which emails or senders to review.</li>
              <li>You decide which cleanup action to apply.</li>
              <li>You can revoke access at any time.</li>
            </ul>
          </div>

          <div
            style={{
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#475569",
                marginBottom: "12px",
              }}
            >
              What InboxShaper never does
            </div>

            <ul
              style={{
                margin: 0,
                paddingLeft: "18px",
                color: "#334155",
                lineHeight: 1.85,
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              <li>Never starts scans without the user.</li>
              <li>Never auto-deletes or auto-archives emails.</li>
              <li>Never stores email content as a permanent archive.</li>
              <li>Never sells Gmail user data.</li>
              <li>Never uses Gmail data for advertising or profiling.</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "22px",
            alignItems: "start",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 850,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              Data deletion & disconnect
            </h2>

            <p
              style={{
                marginTop: "10px",
                color: "#64748b",
                lineHeight: 1.75,
                fontSize: "16px",
              }}
            >
              You can revoke InboxShaper’s access to your Gmail account at any
              time through your Google Account permissions or from within the
              product when disconnect options are available.
            </p>

            <p
              style={{
                marginTop: "12px",
                marginBottom: 0,
                color: "#334155",
                lineHeight: 1.75,
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              If you need help removing access or requesting deletion of related
              app data, contact support and we will assist you.
            </p>
          </div>

          <div
            style={{
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: "20px",
              boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#475569",
                marginBottom: "12px",
              }}
            >
              Trusted infrastructure
            </div>

            <div
              style={{
                color: "#334155",
                lineHeight: 1.8,
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              InboxShaper uses trusted infrastructure providers such as hosting,
              database, and queue services to operate the product securely.
              These services process data only as needed to provide the
              functionality of InboxShaper.
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 850,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Helpful links
        </h2>

        <p
          style={{
            marginTop: "10px",
            marginBottom: "16px",
            color: "#64748b",
            lineHeight: 1.7,
            fontSize: "15px",
          }}
        >
          Review our legal documents and public policy pages.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...linkButtonStyle,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
            }}
          >
            Privacy Policy
          </a>

          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...linkButtonStyle,
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
            }}
          >
            Terms of Service
          </a>
        </div>

        <div
          style={{
            paddingTop: "16px",
            borderTop: "1px solid #e2e8f0",
            fontSize: "15px",
            color: "#475569",
            lineHeight: 1.7,
          }}
        >
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
      </section>
    </div>
  );
}