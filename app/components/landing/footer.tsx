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
          href="/use-cases"
          className={jakartaClassName}
          style={footerLinkStyle}
        >
          Use Cases
        </a>

        <a
          href="/resources"
          className={jakartaClassName}
          style={footerLinkStyle}
        >
          Resources
        </a>

        <a
          href="/contact"
          className={jakartaClassName}
          style={footerLinkStyle}
        >
          Contact
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
          href="mailto:support@text2task.com"
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
        Text2Task • Turn messy client messages into organized tasks
        <br />
        Support: support@text2task.com
      </div>
    </footer>
  );
}