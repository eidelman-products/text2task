"use client";

type FooterProps = {
  jakartaClassName: string;
};

export default function Footer({ jakartaClassName }: FooterProps) {
  const footerLinkStyle = {
    color: "#475569",
    textDecoration: "none",
    fontWeight: 750,
    fontSize: "14px",
    lineHeight: 1.35,
  } as const;

  return (
    <footer className="text2task-app-footer" style={footerStyle}>
      <style>{footerCss}</style>

      <div className="text2task-app-footer-inner" style={footerInnerStyle}>
        <div className="text2task-app-footer-brand" style={brandStyle}>
          <div style={logoRowStyle}>
            <span style={dotStyle} />
            <span>Text2Task</span>
          </div>

          <p className={jakartaClassName} style={brandTextStyle}>
            Turn messy client messages, screenshots, notes, and work requests
            into structured tasks with AI.
          </p>

          <a
            href="mailto:support@text2task.com"
            className={jakartaClassName}
            style={supportBoxStyle}
          >
            <span style={supportLabelStyle}>Support</span>
            <span style={supportEmailStyle}>support@text2task.com</span>
          </a>
        </div>

        <nav className="text2task-app-footer-links" style={linksGridStyle}>
          <div className="text2task-app-footer-group">
            <div className={jakartaClassName} style={groupTitleStyle}>
              Product
            </div>

            <a
              href="#pricing"
              className={jakartaClassName}
              style={footerLinkStyle}
            >
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
          </div>

          <div className="text2task-app-footer-group">
            <div className={jakartaClassName} style={groupTitleStyle}>
              Legal
            </div>

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
              href="/contact"
              className={jakartaClassName}
              style={footerLinkStyle}
            >
              Contact
            </a>
          </div>

          <div className="text2task-app-footer-group">
            <div className={jakartaClassName} style={groupTitleStyle}>
              Account
            </div>

            <a
              href="/login"
              className={jakartaClassName}
              style={footerLinkStyle}
            >
              Login
            </a>

            <a
              href="/signup"
              className={jakartaClassName}
              style={footerLinkStyle}
            >
              Start free
            </a>
          </div>

          <div className="text2task-app-footer-group">
            <div className={jakartaClassName} style={groupTitleStyle}>
              Support
            </div>

            <a
              href="mailto:support@text2task.com"
              className={jakartaClassName}
              style={supportLinkStyle}
            >
              support@text2task.com
            </a>

            <a
              href="/contact"
              className={jakartaClassName}
              style={footerLinkStyle}
            >
              Contact support
            </a>
          </div>
        </nav>

        <div className="text2task-app-footer-bottom" style={bottomStyle}>
          <span className={jakartaClassName}>
            © 2026 Text2Task. All rights reserved.
          </span>

          <div className="text2task-app-footer-bottom-links" style={bottomLinksStyle}>
            <a href="/privacy" className={jakartaClassName} style={bottomLinkStyle}>
              Privacy
            </a>
            <span style={bottomDotStyle}>•</span>
            <a href="/terms" className={jakartaClassName} style={bottomLinkStyle}>
              Terms
            </a>
            <span style={bottomDotStyle}>•</span>
            <a href="/contact" className={jakartaClassName} style={bottomLinkStyle}>
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

const footerStyle = {
  marginTop: "52px",
  padding: "28px 28px 20px",
  borderTop: "1px solid rgba(226,232,240,0.86)",
  borderRadius: "28px 28px 0 0",
  background:
    "linear-gradient(135deg, rgba(248,250,252,0.94) 0%, rgba(238,242,255,0.58) 100%)",
  boxShadow: "0 -18px 44px rgba(15,23,42,0.035)",
  overflow: "hidden",
} as const;

const footerInnerStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 360px) minmax(0, 1fr)",
  gap: "42px",
  alignItems: "start",
  width: "100%",
  maxWidth: "100%",
} as const;

const brandStyle = {
  minWidth: 0,
  maxWidth: "100%",
} as const;

const logoRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: 950,
  letterSpacing: "-0.035em",
  marginBottom: "12px",
} as const;

const dotStyle = {
  width: "13px",
  height: "13px",
  borderRadius: 999,
  background: "linear-gradient(135deg,#4f46e5,#60a5fa)",
  boxShadow: "0 0 0 5px rgba(99,102,241,0.12)",
  flexShrink: 0,
} as const;

const brandTextStyle = {
  margin: 0,
  color: "#475569",
  fontSize: "15px",
  lineHeight: 1.65,
  fontWeight: 650,
  maxWidth: "340px",
} as const;

const supportBoxStyle = {
  display: "inline-grid",
  gap: "3px",
  marginTop: "18px",
  padding: "10px 14px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(199,210,254,0.82)",
  color: "#4338ca",
  textDecoration: "none",
  boxShadow:
    "0 12px 26px rgba(79,70,229,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
  maxWidth: "100%",
} as const;

const supportLabelStyle = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

const supportEmailStyle = {
  color: "#4338ca",
  fontSize: "13px",
  fontWeight: 900,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
} as const;

const linksGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
  gap: "34px",
  minWidth: 0,
  maxWidth: "100%",
} as const;

const groupTitleStyle = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: 950,
  letterSpacing: "-0.015em",
  marginBottom: "12px",
} as const;

const supportLinkStyle = {
  display: "block",
  marginBottom: "9px",
  color: "#4338ca",
  textDecoration: "none",
  fontSize: "13px",
  lineHeight: 1.35,
  fontWeight: 850,
  width: "100%",
  maxWidth: "100%",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "normal",
} as const;

const bottomStyle = {
  gridColumn: "1 / -1",
  marginTop: "28px",
  paddingTop: "18px",
  borderTop: "1px solid rgba(226,232,240,0.82)",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 650,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
} as const;

const bottomLinksStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
} as const;

const bottomLinkStyle = {
  color: "#334155",
  textDecoration: "none",
  fontWeight: 820,
} as const;

const bottomDotStyle = {
  color: "#818cf8",
} as const;

const footerCss = `
  .text2task-app-footer,
  .text2task-app-footer * {
    box-sizing: border-box;
    min-width: 0;
  }

  .text2task-app-footer a {
    transition: color 160ms ease, opacity 160ms ease;
  }

  .text2task-app-footer a:hover {
    color: #4338ca !important;
  }

  .text2task-app-footer-group {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  @media (max-width: 980px) {
    .text2task-app-footer-inner {
      grid-template-columns: 1fr !important;
      gap: 30px !important;
    }

    .text2task-app-footer-links {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 26px 34px !important;
    }
  }

  @media (max-width: 640px) {
    .text2task-app-footer {
      margin-top: 42px !important;
      padding: 28px 18px 18px !important;
      border-radius: 24px 24px 0 0 !important;
      overflow: hidden !important;
    }

    .text2task-app-footer-inner {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 24px !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    .text2task-app-footer-brand {
      width: 100% !important;
      max-width: 100% !important;
    }

    .text2task-app-footer-brand p {
      max-width: 100% !important;
    }

    .text2task-app-footer-brand a {
      width: 100% !important;
      max-width: 100% !important;
    }

    .text2task-app-footer-links {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 20px !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    .text2task-app-footer-group {
      width: 100% !important;
      max-width: 100% !important;
      padding-bottom: 18px !important;
      border-bottom: 1px solid rgba(226,232,240,0.72) !important;
    }

    .text2task-app-footer-group:last-child {
      padding-bottom: 0 !important;
      border-bottom: none !important;
    }

    .text2task-app-footer-group a {
      width: 100% !important;
      max-width: 100% !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    .text2task-app-footer-bottom {
      display: grid !important;
      justify-content: stretch !important;
      text-align: left !important;
      gap: 10px !important;
      font-size: 12px !important;
      width: 100% !important;
      max-width: 100% !important;
      margin-top: 4px !important;
    }
  }

  @media (max-width: 430px) {
  .text2task-app-footer {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }

  .text2task-app-footer-inner {
    grid-template-columns: 1fr !important;
  }

  .text2task-app-footer-links {
    grid-template-columns: 1fr !important;
    gap: 18px !important;
  }

  .text2task-app-footer-group {
    width: 100% !important;
    max-width: 100% !important;
  }

  .text2task-app-footer-group a {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }

  .text2task-app-footer-bottom {
    grid-template-columns: 1fr !important;
    width: 100% !important;
  }
}
  `;