import Link from "next/link";

export default function HeroSection() {
  return (
    <section
      style={{
        padding: "24px 24px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 40,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #60a5fa 0%, #6366f1 55%, #8b5cf6 100%)",
                boxShadow:
                  "0 0 0 8px rgba(96,165,250,0.08), 0 10px 24px rgba(99,102,241,0.18)",
                flexShrink: 0,
              }}
            />

            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "#0f172a",
              }}
            >
              Text2Task
            </div>
          </div>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link href="/login" style={topLinkStyle}>
              Log in
            </Link>

            <Link href="/signup" style={topPrimaryStyle}>
              Start free
            </Link>
          </nav>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(360px, 0.95fr)",
            gap: 40,
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 24 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "fit-content",
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(59,130,246,0.12)",
                background: "rgba(255,255,255,0.82)",
                color: "#2563eb",
                fontSize: 14,
                fontWeight: 700,
                boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
              }}
            >
              Text2Task • AI CRM for messy messages
            </div>

            <div style={{ display: "grid", gap: 18 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(56px, 7vw, 88px)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.07em",
                  fontWeight: 950,
                  color: "#0f172a",
                  maxWidth: 640,
                }}
              >
                Turn any message into clear tasks.
              </h1>

              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  lineHeight: 1.75,
                  color: "#334155",
                  maxWidth: 720,
                }}
              >
                Paste text or upload an image. Text2Task extracts the client,
                task, amount, deadline, and turns messy messages into a clean
                workspace you can actually manage.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Link href="/signup" style={primaryButtonStyle}>
                Start free
              </Link>

              <Link href="/login" style={secondaryButtonStyle}>
                Sign in
              </Link>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {[
                "Paste text or image",
                "AI extracts structured data",
                "Manage everything in one CRM",
              ].map((item) => (
                <div key={item} style={pillStyle}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 28,
              padding: 20,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.94) 100%)",
              border: "1px solid rgba(226,232,240,0.96)",
              boxShadow:
                "0 22px 48px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.92)",
              display: "grid",
              gap: 18,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#475569",
              }}
            >
              Example extraction
            </div>

            <div
              style={{
                borderRadius: 22,
                padding: "18px 18px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#334155",
                fontSize: 16,
                lineHeight: 1.8,
              }}
            >
              “Hi, I need a logo and landing page for my new business. Budget is
              around $800. Can you send me a quote by Friday?”
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Row label="Client" value="New business lead" />
              <Row label="Task" value="Logo + landing page quote" />
              <Row label="Amount" value="$800" />
              <Row label="Deadline" value="Friday" />
              <Row label="Priority" value="High" />
              <Row label="Status" value="New" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        alignItems: "center",
        borderRadius: 18,
        padding: "14px 16px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#64748b",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#0f172a",
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const topLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  color: "#334155",
  fontSize: 15,
  fontWeight: 700,
  textDecoration: "none",
};

const topPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 12,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "0 12px 24px rgba(15,23,42,0.12)",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 180,
  padding: "16px 22px",
  borderRadius: 16,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "0 18px 34px rgba(15,23,42,0.14)",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 180,
  padding: "16px 22px",
  borderRadius: 16,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 800,
  textDecoration: "none",
  border: "1px solid #cbd5e1",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.8)",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 14,
  fontWeight: 700,
};