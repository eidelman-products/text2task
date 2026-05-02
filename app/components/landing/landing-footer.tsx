import Link from "next/link";
import type { CSSProperties } from "react";

export default function LandingFooter() {
  return (
    <footer style={footerStyle}>
      <div style={footerTopStyle}>
        <div style={footerBrandStyle}>
          <div style={logoRowStyle}>
            <span style={dotStyle} />
            <span>Text2Task</span>
          </div>

          <p style={footerTextStyle}>
            Turn messy client messages, screenshots, and notes into structured
            work with AI.
          </p>
        </div>

        <div style={linksGridStyle}>
          <div>
            <div style={titleStyle}>Product</div>
            <FooterLink href="#product" label="Product" />
            <FooterLink href="#how-it-works" label="How it works" />
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
            <FooterLink href="/login" label="Log in" />
            <FooterLink href="/signup" label="Try Text2Task" />
          </div>
        </div>
      </div>

      <div style={footerBottomStyle}>© 2026 Text2Task. All rights reserved.</div>
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

const footerStyle: CSSProperties = {
  marginTop: 72,
  paddingTop: 34,
  borderTop: "1px solid #e2e8f0",
};

const footerTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 32,
  flexWrap: "wrap",
};

const footerBrandStyle: CSSProperties = {
  maxWidth: 320,
};

const logoRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontWeight: 900,
  fontSize: 22,
  color: "#0f172a",
  marginBottom: 12,
};

const dotStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "linear-gradient(135deg,#8b5cf6,#60a5fa)",
  boxShadow: "0 0 0 5px rgba(99,102,241,0.12)",
};

const footerTextStyle: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 16,
  lineHeight: 1.75,
};

const linksGridStyle: CSSProperties = {
  display: "flex",
  gap: 44,
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontWeight: 900,
  marginBottom: 12,
  color: "#0f172a",
  fontSize: 16,
};

const linkStyle: CSSProperties = {
  display: "block",
  marginBottom: 10,
  color: "#64748b",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 700,
};

const footerBottomStyle: CSSProperties = {
  marginTop: 28,
  paddingTop: 18,
  borderTop: "1px solid #eef2f7",
  color: "#94a3b8",
  fontSize: 14,
};