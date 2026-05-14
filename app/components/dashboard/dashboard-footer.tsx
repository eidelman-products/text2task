"use client";

import type React from "react";

type FooterColumn = {
  title: string;
  links: {
    label: string;
    href: string;
  }[];
};

const footerColumns: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", href: "/login" },
      { label: "Start free", href: "/signup" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "support@text2task.com", href: "mailto:support@text2task.com" },
      { label: "Contact support", href: "/contact" },
    ],
  },
];

export default function DashboardFooter() {
  return (
    <footer className="dashboard-footer" style={styles.footer}>
      <style>{responsiveCss}</style>

      <div style={styles.softGlowOne} />
      <div style={styles.softGlowTwo} />

      <div style={styles.inner}>
        <div className="dashboard-footer-brand" style={styles.brandBlock}>
          <div style={styles.logoCrop}>
            <img
              src="/text2task-logo.png"
              alt="Text2Task"
              style={styles.logoImage}
            />
          </div>

          <p style={styles.brandDescription}>
            Turn messy client messages, screenshots, notes, and work requests
            into organized projects and tasks with AI.
          </p>

          <a href="mailto:support@text2task.com" style={styles.supportBox}>
            <span style={styles.supportLabel}>Support</span>
            <span style={styles.supportLink}>support@text2task.com</span>
          </a>
        </div>

        <div className="dashboard-footer-columns" style={styles.columns}>
          {footerColumns.map((column) => (
            <div key={column.title} style={styles.column}>
              <div style={styles.columnTitle}>{column.title}</div>

              <div style={styles.linkList}>
                {column.links.map((link) => (
                  <a
                    key={link.href + link.label}
                    href={link.href}
                    style={styles.link}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.bottomBar}>
        <div style={styles.copyright}>
          © 2026 Text2Task. All rights reserved.
        </div>

        <div style={styles.bottomLinks}>
          <a href="/privacy" style={styles.bottomLink}>
            Privacy
          </a>
          <span style={styles.dotSeparator}>•</span>
          <a href="/terms" style={styles.bottomLink}>
            Terms
          </a>
          <span style={styles.dotSeparator}>•</span>
          <a href="/contact" style={styles.bottomLink}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

const responsiveCss = `
  .dashboard-footer,
  .dashboard-footer * {
    box-sizing: border-box;
  }

  .dashboard-footer a {
    transition:
      color 160ms ease,
      transform 160ms ease,
      opacity 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .dashboard-footer a:hover {
    color: #4f46e5 !important;
    transform: translateY(-1px);
  }

  @media (max-width: 900px) {
    .dashboard-footer {
      width: calc(100% + 28px) !important;
      margin-left: -14px !important;
      margin-right: -14px !important;
      margin-top: 20px !important;
      margin-bottom: 0 !important;
      border-radius: 22px 22px 0 0 !important;
      padding: 15px 14px 12px !important;
    }

    .dashboard-footer > div:nth-child(3) {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }

    .dashboard-footer-brand {
      max-width: 100% !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 13px !important;
    }
  }

  @media (max-width: 520px) {
    .dashboard-footer {
      padding: 14px 14px 12px !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: 1fr !important;
    }
  }

  @media (min-width: 901px) {
    .dashboard-footer {
      width: calc(100vw - 260px) !important;
      margin-left: -28px !important;
      margin-right: -28px !important;
      margin-top: 24px !important;
      margin-bottom: 0 !important;
      border-radius: 22px 22px 0 0 !important;
      padding: 13px 28px 10px !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: repeat(4, minmax(112px, 1fr)) !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  footer: {
    width: "100%",
    marginTop: 24,
    marginBottom: 0,
    padding: "13px 28px 10px",
    borderRadius: "22px 22px 0 0",
    border: "1px solid rgba(199,210,254,0.68)",
    borderBottom: "0",
    background:
      "radial-gradient(circle at top left, rgba(255,255,255,0.9) 0%, transparent 26%), radial-gradient(circle at top right, rgba(219,234,254,0.56) 0%, transparent 28%), linear-gradient(135deg, rgba(238,242,255,0.9) 0%, rgba(248,250,252,0.92) 50%, rgba(250,245,255,0.84) 100%)",
    boxShadow:
      "0 -8px 24px rgba(79,70,229,0.04), 0 8px 20px rgba(15,23,42,0.025), inset 0 1px 0 rgba(255,255,255,0.9)",
    position: "relative",
    overflow: "hidden",
  },

  softGlowOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    right: -78,
    top: -125,
    background:
      "radial-gradient(circle, rgba(99,102,241,0.11) 0%, rgba(99,102,241,0.00) 70%)",
    pointerEvents: "none",
  },

  softGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    left: -62,
    bottom: -100,
    background:
      "radial-gradient(circle, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0.00) 72%)",
    pointerEvents: "none",
  },

  inner: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(210px, 0.62fr) minmax(0, 2fr)",
    gap: 22,
    alignItems: "start",
  },

  brandBlock: {
    minWidth: 0,
    maxWidth: 340,
    display: "grid",
    gap: 6,
  },

  logoCrop: {
    width: 142,
    height: 34,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  logoImage: {
    width: 142,
    height: 34,
    objectFit: "contain",
    objectPosition: "left center",
    display: "block",
  },

  brandDescription: {
    margin: 0,
    color: "#475569",
    fontSize: 11.5,
    lineHeight: 1.38,
    fontWeight: 700,
    maxWidth: 320,
  },

  supportBox: {
    width: "fit-content",
    display: "grid",
    gap: 1,
    padding: "7px 10px",
    borderRadius: 13,
    border: "1px solid rgba(129,140,248,0.32)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(238,242,255,0.56) 100%)",
    boxShadow: "0 7px 15px rgba(79,70,229,0.045)",
    textDecoration: "none",
  },

  supportLabel: {
    color: "#64748b",
    fontSize: 8.5,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  supportLink: {
    color: "#3730a3",
    fontSize: 10.75,
    fontWeight: 950,
  },

  columns: {
    minWidth: 0,
    display: "grid",
    gap: 18,
  },

  column: {
    minWidth: 0,
    display: "grid",
    gap: 6,
  },

  columnTitle: {
    color: "#111827",
    fontSize: 11.5,
    fontWeight: 950,
    letterSpacing: "-0.025em",
  },

  linkList: {
    display: "grid",
    gap: 4,
  },

  link: {
    color: "#475569",
    fontSize: 11.25,
    fontWeight: 760,
    lineHeight: 1.18,
    textDecoration: "none",
  },

  bottomBar: {
    position: "relative",
    zIndex: 2,
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(165,180,252,0.30)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },

  copyright: {
    color: "#64748b",
    fontSize: 10.25,
    fontWeight: 760,
  },

  bottomLinks: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  bottomLink: {
    color: "#334155",
    fontSize: 10.25,
    fontWeight: 900,
    textDecoration: "none",
  },

  dotSeparator: {
    color: "#818cf8",
    fontSize: 9.5,
    fontWeight: 950,
  },
};
