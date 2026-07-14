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
      { label: "Pricing", href: "/#pricing" },
      { label: "About", href: "/about?from=dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy?from=dashboard" },
      { label: "Terms of Service", href: "/terms?from=dashboard" },
      { label: "Contact", href: "/contact?from=dashboard" },
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
      { label: "Contact support", href: "/contact?from=dashboard" },
    ],
  },
];

export default function DashboardFooter() {
  return (
    <footer className="dashboard-footer" style={styles.footer}>
      <style>{responsiveCss}</style>
      <div style={styles.topAccent} />

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
            Turn messy client messages into organized projects, tasks, and next
            steps.
          </p>

          <a href="mailto:support@text2task.com" style={styles.supportLinkBox}>
            support@text2task.com
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
          <a href="/privacy?from=dashboard" style={styles.bottomLink}>
            Privacy
          </a>
          <span style={styles.dotSeparator}>•</span>
          <a href="/terms?from=dashboard" style={styles.bottomLink}>
            Terms
          </a>
          <span style={styles.dotSeparator}>•</span>
          <a href="/about?from=dashboard" style={styles.bottomLink}>
            About
          </a>
          <span style={styles.dotSeparator}>•</span>
          <a href="/contact?from=dashboard" style={styles.bottomLink}>
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
      opacity 160ms ease,
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .dashboard-footer a:hover {
    color: #1d4ed8 !important;
  }

  .dashboard-footer a:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.20);
    border-radius: 10px;
  }

  @media (max-width: 900px) {
    .dashboard-footer {
      width: calc(100% + 28px) !important;
      margin-left: -14px !important;
      margin-right: -14px !important;
      margin-top: 28px !important;
      padding: 22px 14px 16px !important;
    }

    .dashboard-footer > div:first-child {
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }

    .dashboard-footer-brand {
      max-width: 100% !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 18px 16px !important;
    }
  }

  @media (max-width: 520px) {
    .dashboard-footer-columns {
      grid-template-columns: 1fr !important;
    }

    .dashboard-footer > div:last-child {
      align-items: flex-start !important;
      flex-direction: column !important;
    }
  }

  @media (min-width: 901px) {
    .dashboard-footer {
      width: calc(100vw - 260px) !important;
      margin-left: -28px !important;
      margin-right: -28px !important;
      margin-top: 34px !important;
      padding: 24px 28px 16px !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: repeat(4, minmax(112px, 1fr)) !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  footer: {
    width: "100%",
    marginTop: 34,
    marginBottom: 0,
    padding: "24px 28px 16px",
    borderTop: "1px solid rgba(191, 219, 254, 0.95)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 58%, rgba(239,246,255,0.72) 100%)",
    boxShadow:
      "0 -1px 0 rgba(37, 99, 235, 0.045), inset 0 1px 0 rgba(255,255,255,0.92)",
    position: "relative",
    overflow: "hidden",
  },

  topAccent: {
    position: "absolute",
    top: 0,
    left: 28,
    right: 28,
    height: 2,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(37,99,235,0.0) 0%, rgba(37,99,235,0.42) 18%, rgba(37,99,235,0.24) 50%, rgba(37,99,235,0.0) 100%)",
    pointerEvents: "none",
  },

  inner: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(230px, 0.72fr) minmax(0, 2fr)",
    gap: 34,
    alignItems: "start",
  },

  brandBlock: {
    minWidth: 0,
    maxWidth: 360,
    display: "grid",
    gap: 9,
  },

  logoCrop: {
    width: 136,
    height: 32,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  logoImage: {
    width: 136,
    height: 32,
    objectFit: "contain",
    objectPosition: "left center",
    display: "block",
  },

  brandDescription: {
    margin: 0,
    maxWidth: 330,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 650,
  },

  supportLinkBox: {
    width: "fit-content",
    color: "#1d4ed8",
    fontSize: 11.5,
    lineHeight: 1,
    fontWeight: 850,
    textDecoration: "none",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(191, 219, 254, 0.88)",
    background: "rgba(239, 246, 255, 0.54)",
  },

  columns: {
    minWidth: 0,
    display: "grid",
    gap: 22,
  },

  column: {
    minWidth: 0,
    display: "grid",
    gap: 8,
    alignContent: "start",
  },

  columnTitle: {
    color: "#0f172a",
    fontSize: 11.5,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "0.01em",
  },

  linkList: {
    display: "grid",
    gap: 6,
  },

  link: {
    width: "fit-content",
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 700,
    lineHeight: 1.15,
    textDecoration: "none",
  },

  bottomBar: {
    marginTop: 22,
    paddingTop: 13,
    borderTop: "1px solid rgba(191, 219, 254, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },

  copyright: {
    color: "#64748b",
    fontSize: 10.75,
    lineHeight: 1,
    fontWeight: 700,
  },

  bottomLinks: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  bottomLink: {
    color: "#475569",
    fontSize: 10.75,
    lineHeight: 1,
    fontWeight: 800,
    textDecoration: "none",
  },

  dotSeparator: {
    color: "#cbd5e1",
    fontSize: 10,
    lineHeight: 1,
    fontWeight: 900,
  },
};
