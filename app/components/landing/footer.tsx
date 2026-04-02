"use client";

type FooterProps = {
  jakartaClassName: string;
};

export default function Footer({ jakartaClassName }: FooterProps) {
  const footerLinkStyle = {
    color: "#475569",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "15px",
  } as const;

  return (
    <footer
      style={{
        marginTop: "52px",
        paddingTop: "22px",
        borderTop: "1px solid #e2e8f0",
        display: "grid",
        gap: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <a href="#pricing" className={jakartaClassName} style={footerLinkStyle}>
          Pricing
        </a>

        <a
          href="/privacy"
          className={jakartaClassName}
          style={footerLinkStyle}
        >
          Privacy Policy
        </a>

        <a
          href="/terms"
          className={jakartaClassName}
          style={footerLinkStyle}
        >
          Terms of Service
        </a>

        <a
          href="mailto:support@inboxshaper.com"
          className={jakartaClassName}
          style={footerLinkStyle}
        >
          Support
        </a>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: "14px",
          color: "#64748b",
          lineHeight: 1.8,
          fontWeight: 500,
        }}
      >
        InboxShaper • Privacy-first Gmail cleanup and analytics
        <br />
        Support: support@inboxshaper.com
      </div>
    </footer>
  );
}