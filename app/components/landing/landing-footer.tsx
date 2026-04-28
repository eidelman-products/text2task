import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer style={footerStyle}>
      <div style={footerTopStyle}>
        {/* LEFT */}
        <div style={footerBrandStyle}>
          <div style={logoRowStyle}>
            <span style={dotStyle} />
            Text2Task
          </div>

          <p style={footerTextStyle}>
            Turn messy client messages into structured work with AI.
          </p>
        </div>

        {/* RIGHT LINKS */}
        <div style={linksGridStyle}>
          <div>
            <div style={titleStyle}>Product</div>
            <FooterLink href="#product" label="How it works" />
            <FooterLink href="#features" label="Features" />
            <FooterLink href="#pricing" label="Pricing" />
          </div>

          <div>
            <div style={titleStyle}>Legal</div>
            <FooterLink href="/privacy" label="Privacy Policy" />
            <FooterLink href="/terms" label="Terms of Service" />
            <FooterLink href="/contact" label="Contact" />
          </div>

          <div>
            <div style={titleStyle}>Account</div>
            <FooterLink href="/login" label="Login" />
            <FooterLink href="/signup" label="Start free" />
          </div>
        </div>
      </div>

      <div style={footerBottomStyle}>
        © 2026 Text2Task. All rights reserved.
      </div>
    </footer>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={linkStyle}>
      {label}
    </Link>
  );
}

/* STYLES */

const footerStyle: React.CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  paddingTop: 40,
};

const footerTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 40,
  flexWrap: "wrap",
};

const footerBrandStyle: React.CSSProperties = {
  maxWidth: 260,
};

const logoRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 900,
  fontSize: 18,
  marginBottom: 10,
};

const dotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "linear-gradient(135deg,#60a5fa,#6366f1)",
};

const footerTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.6,
};

const linksGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 40,
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const linkStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#64748b",
  textDecoration: "none",
};

const footerBottomStyle: React.CSSProperties = {
  marginTop: 30,
  color: "#94a3b8",
  fontSize: 14,
};