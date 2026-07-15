import Image from "next/image";
import Link from "next/link";
import { SITE_SOCIAL_LINKS } from "@/app/lib/site-config";

const productLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Demo", href: "/#demo" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About", href: "/about" },
  { label: "Resources", href: "/resources" },
];

const useCaseLinks = [
  { label: "All use cases", href: "/use-cases" },
  { label: "Web designers", href: "/use-cases/web-designers" },
  { label: "WordPress freelancers", href: "/use-cases/wordpress-freelancers" },
  { label: "Graphic designers", href: "/use-cases/graphic-designers" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

const accountLinks = [
  { label: "Log in", href: "/login" },
  { label: "Start for free", href: "/signup" },
];

export default function LandingFooter() {
  return (
    <footer className="t2t-footer">
      <style>{footerStyles}</style>

      <div className="t2t-footer-inner">
        <div className="t2t-footer-brand">
          <Link href="/" className="t2t-footer-logo" aria-label="Text2Task home">
            <Image
              src="/text2task-logo.png"
              alt="Text2Task"
              width={190}
              height={54}
            />
          </Link>

          <p>
            Turn client messages, screenshots, and notes into organized projects
            and tasks—without retyping.
          </p>

          <a className="t2t-footer-support" href="mailto:support@text2task.com">
            <span>Support</span>
            <strong>support@text2task.com</strong>
          </a>

          <div className="t2t-footer-follow">
            <span>FOLLOW</span>
            <div className="t2t-footer-social-links">
              <a
                className="t2t-footer-social"
                href={SITE_SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Text2Task on Facebook"
              >
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                  <path d="M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V4a22 22 0 0 0-2.4-.1c-2.4 0-4.1 1.5-4.1 4.2V10H8v3h2.5v8h3.2Z" />
                </svg>
              </a>

              <a
                className="t2t-footer-social"
                href={SITE_SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Text2Task on LinkedIn"
              >
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.44-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28h-.01ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <nav className="t2t-footer-nav" aria-label="Footer navigation">
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Use cases" links={useCaseLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
          <FooterColumn title="Account" links={accountLinks} />
        </nav>
      </div>

      <div className="t2t-footer-bottom">
        <span>© 2026 Text2Task. All rights reserved.</span>

        <div>
          <Link href="/privacy">Privacy</Link>
          <span>•</span>
          <Link href="/terms">Terms</Link>
          <span>•</span>
          <Link href="/about">About</Link>
          <span>•</span>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="t2t-footer-column">
      <h3>{title}</h3>

      <div>
        {links.map((link) => (
          <Link key={`${title}-${link.label}`} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

const footerStyles = `
  .t2t-footer {
    width: 100%;
    margin: 0;
    border-top: 1px solid rgba(226, 232, 240, 0.58);
    background: rgba(255, 255, 255, 0.92);
  }

  .t2t-footer,
  .t2t-footer * {
    box-sizing: border-box;
    min-width: 0;
  }

  .t2t-footer-inner {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.95fr);
    gap: 64px;
    padding: 42px 4px 36px;
    align-items: start;
  }

  .t2t-footer-brand {
    max-width: 370px;
  }

  .t2t-footer-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .t2t-footer-logo img {
    width: 168px;
    height: auto;
    display: block;
    object-fit: contain;
    object-position: left center;
  }

  .t2t-footer-brand p {
    margin: 17px 0 0;
    max-width: 360px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.65;
    font-weight: 560;
  }

  .t2t-footer-support {
    margin-top: 21px;
    display: inline-grid;
    gap: 4px;
    max-width: 100%;
    padding: 0;
    border-radius: 0;
    border: 0;
    background: transparent;
    color: #2563eb;
    text-decoration: none;
    box-shadow: none;
  }

  .t2t-footer-support span {
    color: #94a3b8;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  .t2t-footer-support strong {
    color: #2563eb;
    font-size: 13px;
    font-weight: 750;
    transition: color 160ms ease;
    overflow-wrap: anywhere;
  }

  .t2t-footer-support:hover strong {
    color: #1d4ed8;
  }

  .t2t-footer-follow {
    margin-top: 18px;
    display: grid;
    justify-items: start;
    gap: 8px;
  }

  .t2t-footer-follow > span {
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.15em;
  }

  .t2t-footer-social-links {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .t2t-footer-social {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    color: #1d4ed8;
    background: #ffffff;
    text-decoration: none;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }

  .t2t-footer-social svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .t2t-footer-social:hover {
    border-color: #60a5fa;
    color: #2563eb;
    background: #eff6ff;
  }

  .t2t-footer-social:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.25);
    outline-offset: 3px;
  }

  .t2t-footer-nav {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 36px;
    padding-top: 5px;
  }

  .t2t-footer-column h3 {
    margin: 0 0 16px;
    color: #334155;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: -0.01em;
  }

  .t2t-footer-column div {
    display: grid;
    gap: 11px;
  }

  .t2t-footer-column a {
    color: #64748b;
    text-decoration: none;
    font-size: 12.5px;
    line-height: 1.35;
    font-weight: 560;
    transition: color 160ms ease;
  }

  .t2t-footer-column a:hover {
    color: #1d4ed8;
  }

  .t2t-footer-bottom {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    border-top: 1px solid rgba(226, 232, 240, 0.58);
    padding: 20px 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 560;
  }

  .t2t-footer-bottom div {
    display: flex;
    align-items: center;
    gap: 11px;
    flex-wrap: wrap;
  }

  .t2t-footer-bottom a {
    color: #64748b;
    text-decoration: none;
    font-weight: 650;
    transition: color 160ms ease;
  }

  .t2t-footer-bottom a:hover {
    color: #1d4ed8;
  }

  .t2t-footer-bottom div span {
    color: #cbd5e1;
  }

  @media (max-width: 980px) {
    .t2t-footer-inner {
      grid-template-columns: 1fr;
      gap: 42px;
    }

    .t2t-footer-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 34px 28px;
    }
  }

  @media (max-width: 640px) {
    .t2t-footer-inner,
    .t2t-footer-bottom {
      width: min(100% - 24px, 1180px);
    }

    .t2t-footer {
      margin-top: 50px;
    }

    .t2t-footer-inner {
      padding: 32px 0;
      gap: 34px;
    }

    .t2t-footer-logo img {
      width: 150px;
    }

    .t2t-footer-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 30px 20px;
    }

    .t2t-footer-column {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .t2t-footer-bottom {
      padding: 22px 0;
      align-items: flex-start;
      flex-direction: column;
      gap: 16px;
      font-size: 12px;
    }
  }
`;
