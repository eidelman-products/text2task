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
          <div style={styles.brandRow}>
            <span style={styles.brandDot} />
            <span style={styles.brandName}>Text2Task</span>
          </div>

          <p style={styles.brandDescription}>
            Turn messy client messages, screenshots, notes, and work requests
            into structured tasks with AI.
          </p>

          <div style={styles.supportBox}>
            <div style={styles.supportLabel}>Support</div>
            <a href="mailto:support@text2task.com" style={styles.supportLink}>
              support@text2task.com
            </a>
          </div>
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
      opacity 160ms ease;
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
      margin-top: 24px !important;
      margin-bottom: 0 !important;
      border-radius: 22px 22px 0 0 !important;
      padding: 18px 16px 14px !important;
    }

    .dashboard-footer-brand {
      max-width: 100% !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 14px !important;
    }
  }

  @media (max-width: 520px) {
    .dashboard-footer {
      padding: 18px 14px 14px !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: 1fr !important;
    }
  }

  @media (min-width: 901px) {
    .dashboard-footer {
      width: calc(100vw - 292px) !important;
      margin-left: -32px !important;
      margin-right: -32px !important;
      margin-top: 28px !important;
      margin-bottom: 0 !important;
      border-radius: 24px 24px 0 0 !important;
      padding: 20px 32px 14px !important;
    }

    .dashboard-footer-columns {
      grid-template-columns: repeat(4, minmax(120px, 1fr)) !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  footer: {
    width: "100%",
    marginTop: 28,
    marginBottom: 0,
    padding: "20px 32px 14px",
    borderRadius: "24px 24px 0 0",
    border: "1px solid rgba(199,210,254,0.92)",
    borderBottom: "0",
    background:
      "linear-gradient(135deg, rgba(238,242,255,0.98) 0%, rgba(239,246,255,0.96) 45%, rgba(250,245,255,0.92) 100%)",
    boxShadow:
      "0 -8px 34px rgba(79,70,229,0.065), 0 12px 34px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.88)",
    position: "relative",
    overflow: "hidden",
  },

  softGlowOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    right: -80,
    top: -130,
    background:
      "radial-gradient(circle, rgba(99,102,241,0.16) 0%, rgba(99,102,241,0.00) 68%)",
    pointerEvents: "none",
  },

  softGlowTwo: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    left: -72,
    bottom: -120,
    background:
      "radial-gradient(circle, rgba(59,130,246,0.13) 0%, rgba(59,130,246,0.00) 70%)",
    pointerEvents: "none",
  },

  inner: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.8fr) minmax(0, 2fr)",
    gap: 24,
    alignItems: "start",
  },

  brandBlock: {
    minWidth: 0,
    maxWidth: 360,
    display: "grid",
    gap: 9,
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    display: "inline-block",
    background:
      "linear-gradient(135deg, rgba(79,70,229,1) 0%, rgba(37,99,235,1) 100%)",
    boxShadow: "0 8px 18px rgba(79,70,229,0.32)",
  },

  brandName: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.045em",
  },

  brandDescription: {
    margin: 0,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.48,
    fontWeight: 700,
  },

  supportBox: {
    width: "fit-content",
    display: "grid",
    gap: 2,
    padding: "8px 11px",
    borderRadius: 14,
    border: "1px solid rgba(129,140,248,0.45)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(238,242,255,0.70) 100%)",
    boxShadow: "0 9px 18px rgba(79,70,229,0.065)",
  },

  supportLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  supportLink: {
    color: "#3730a3",
    fontSize: 11.5,
    fontWeight: 950,
    textDecoration: "none",
  },

  columns: {
    minWidth: 0,
    display: "grid",
    gap: 20,
  },

  column: {
    minWidth: 0,
    display: "grid",
    gap: 8,
  },

  columnTitle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "-0.025em",
  },

  linkList: {
    display: "grid",
    gap: 6,
  },

  link: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 760,
    lineHeight: 1.25,
    textDecoration: "none",
  },

  bottomBar: {
    position: "relative",
    zIndex: 2,
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid rgba(165,180,252,0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },

  copyright: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 760,
  },

  bottomLinks: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  bottomLink: {
    color: "#334155",
    fontSize: 11,
    fontWeight: 900,
    textDecoration: "none",
  },

  dotSeparator: {
    color: "#818cf8",
    fontSize: 10.5,
    fontWeight: 950,
  },
};