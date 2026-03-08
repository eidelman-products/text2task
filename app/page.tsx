"use client";

export default function Home() {
  return (
    <main
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
        padding: "0",
        margin: "0",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "90px 24px 70px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "#e0f2fe",
            color: "#0369a1",
            padding: "8px 14px",
            borderRadius: "999px",
            fontSize: "14px",
            fontWeight: "bold",
            marginBottom: "24px",
          }}
        >
          Gmail cleanup made simple
        </div>

        <h1
          style={{
            fontSize: "64px",
            lineHeight: "1.1",
            marginBottom: "24px",
            fontWeight: "bold",
            maxWidth: "900px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Clean your Gmail inbox in minutes.
        </h1>

        <p
          style={{
            fontSize: "22px",
            color: "#475569",
            maxWidth: "760px",
            margin: "0 auto 36px",
            lineHeight: "1.6",
          }}
        >
          InboxShaper helps you remove clutter, unsubscribe from unwanted emails,
          and clean your inbox faster without manual work.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "42px",
          }}
        >
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            style={{
              padding: "18px 34px",
              fontSize: "18px",
              borderRadius: "14px",
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 10px 25px rgba(37, 99, 235, 0.25)",
            }}
          >
            Sign in with Google
          </button>

          <button
            style={{
              padding: "18px 34px",
              fontSize: "18px",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              background: "white",
              color: "#0f172a",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            See how it works
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "28px",
            flexWrap: "wrap",
            fontSize: "15px",
            color: "#64748b",
            marginBottom: "60px",
          }}
        >
          <span>Google OAuth</span>
          <span>Privacy-first</span>
          <span>No email storage</span>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "28px",
            maxWidth: "900px",
            margin: "0 auto",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            border: "1px solid #e2e8f0",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "22px", fontWeight: "bold" }}>
                Inbox overview
              </div>
              <div style={{ fontSize: "14px", color: "#64748b", marginTop: "6px" }}>
                A simple preview of your cleanup dashboard
              </div>
            </div>

            <div
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "8px 14px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              Ready to clean
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "18px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "14px", color: "#64748b" }}>Promotions</div>
              <div style={{ fontSize: "30px", fontWeight: "bold", marginTop: "8px" }}>
                4,281
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "18px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "14px", color: "#64748b" }}>Newsletters</div>
              <div style={{ fontSize: "30px", fontWeight: "bold", marginTop: "8px" }}>
                1,932
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "18px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "14px", color: "#64748b" }}>Unsubscribes</div>
              <div style={{ fontSize: "30px", fontWeight: "bold", marginTop: "8px" }}>
                146
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              borderRadius: "18px",
              padding: "18px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "16px",
                fontWeight: "bold",
                fontSize: "16px",
              }}
            >
              <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    fontWeight: "bold",
    fontSize: "16px",
    flexWrap: "wrap",
    gap: "10px",
  }}
>
  <span>Smart filters for faster cleanup</span>
  <span style={{ color: "#2563eb" }}>Built for bulk cleanup</span>
</div>

<div
  style={{
    fontSize: "14px",
    color: "#64748b",
    marginBottom: "16px",
    lineHeight: "1.6",
  }}
>
  Filter emails by sender, date, attachment size, and category — then clean them in one click.
</div>

<div
  style={{
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "18px",
  }}
>
  <span
    style={{
      background: "#eff6ff",
      color: "#1d4ed8",
      padding: "6px 10px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: "bold",
    }}
  >
    By sender
  </span>

  <span
    style={{
      background: "#f8fafc",
      color: "#334155",
      padding: "6px 10px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: "bold",
      border: "1px solid #e2e8f0",
    }}
  >
    By date
  </span>

  <span
    style={{
      background: "#f8fafc",
      color: "#334155",
      padding: "6px 10px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: "bold",
      border: "1px solid #e2e8f0",
    }}
  >
    By size
  </span>

  <span
    style={{
      background: "#f8fafc",
      color: "#334155",
      padding: "6px 10px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: "bold",
      border: "1px solid #e2e8f0",
    }}
  >
    By category
  </span>
</div>

<div style={{ display: "grid", gap: "12px" }}>
  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
    }}
  >
    <span>📩 Amazon — 248 emails</span>
    <span style={{ color: "#2563eb", fontWeight: "bold" }}>Review</span>
  </div>

  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
    }}
  >
    <span>🛍️ AliExpress — 516 emails</span>
    <span style={{ color: "#2563eb", fontWeight: "bold" }}>Unsubscribe</span>
  </div>

  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
    }}
  >
    <span>🕒 Older than 1 year — 1,942 emails</span>
    <span style={{ color: "#2563eb", fontWeight: "bold" }}>Archive</span>
  </div>

  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
    }}
  >
    <span>📎 Attachments over 10 MB — 73 emails</span>
    <span style={{ color: "#2563eb", fontWeight: "bold" }}>Delete</span>
  </div>
</div>

<div
  style={{
    marginTop: "16px",
    fontSize: "13px",
    color: "#64748b",
  }}
>
  See exactly what will be cleaned before you apply changes.
</div>

        <div style={{ marginTop: "50px", fontSize: "14px" }}>
          <a href="/privacy" style={{ color: "#475569", marginRight: "16px" }}>
            Privacy Policy
          </a>
          <a href="/terms" style={{ color: "#475569" }}>
            Terms of Service
          </a>
        </div>
      </section>
    </main>
  );
}
