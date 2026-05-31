import Image from "next/image";
import Link from "next/link";

const productLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Demo", href: "#demo" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "/about" },
];

const useCaseLinks = [
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
  { label: "Start free", href: "/signup" },
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
            Turn messy client messages, screenshots, and notes into structured
            work with AI.
          </p>

          <a className="t2t-footer-support" href="mailto:support@text2task.com">
            <span>Support</span>
            <strong>support@text2task.com</strong>
          </a>
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
    width: min(1180px, calc(100% - 40px));
    margin: 46px auto 0;
    overflow: hidden;
    border-radius: 30px;
    border: 1px solid #e2e8f0;
    background:
      radial-gradient(circle at 12% 0%, rgba(99,102,241,0.10), transparent 34%),
      linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92));
    box-shadow: 0 24px 80px rgba(15, 23, 42, 0.07);
  }

  .t2t-footer,
  .t2t-footer * {
    box-sizing: border-box;
    min-width: 0;
  }

  .t2t-footer-inner {
    display: grid;
    grid-template-columns: 1.05fr 1.95fr;
    gap: 58px;
    padding: 34px 34px 32px;
    align-items: start;
  }

  .t2t-footer-brand {
    max-width: 390px;
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
    margin: 18px 0 0;
    max-width: 360px;
    color: #475569;
    font-size: 14px;
    line-height: 1.72;
    font-weight: 650;
  }

  .t2t-footer-support {
    margin-top: 20px;
    display: inline-grid;
    gap: 4px;
    max-width: 100%;
    padding: 11px 15px;
    border-radius: 16px;
    border: 1px solid #c7d2fe;
    background: rgba(238, 242, 255, 0.72);
    color: #4338ca;
    text-decoration: none;
    box-shadow:
      0 12px 30px rgba(79, 70, 229, 0.08),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .t2t-footer-support span {
    color: #64748b;
    font-size: 10px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  .t2t-footer-support strong {
    color: #4338ca;
    font-size: 13px;
    font-weight: 950;
    overflow-wrap: anywhere;
  }

  .t2t-footer-nav {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 30px;
    padding-top: 8px;
  }

  .t2t-footer-column h3 {
    margin: 0 0 14px;
    color: #0f172a;
    font-size: 13px;
    font-weight: 950;
    letter-spacing: -0.01em;
  }

  .t2t-footer-column div {
    display: grid;
    gap: 10px;
  }

  .t2t-footer-column a {
    color: #475569;
    text-decoration: none;
    font-size: 13px;
    line-height: 1.35;
    font-weight: 720;
    transition: color 160ms ease;
  }

  .t2t-footer-column a:hover {
    color: #4f46e5;
  }

  .t2t-footer-bottom {
    border-top: 1px solid rgba(226,232,240,0.9);
    padding: 18px 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    color: #64748b;
    font-size: 13px;
    font-weight: 680;
  }

  .t2t-footer-bottom div {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .t2t-footer-bottom a {
    color: #334155;
    text-decoration: none;
    font-weight: 850;
    transition: color 160ms ease;
  }

  .t2t-footer-bottom a:hover {
    color: #4f46e5;
  }

  .t2t-footer-bottom div span {
    color: #818cf8;
  }

  @media (max-width: 980px) {
    .t2t-footer {
      width: min(100% - 40px, 1180px);
    }

    .t2t-footer-inner {
      grid-template-columns: 1fr;
      gap: 34px;
    }

    .t2t-footer-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .t2t-footer {
      width: min(100% - 24px, 1180px);
      margin-top: 38px;
      border-radius: 26px;
    }

    .t2t-footer-inner {
      padding: 28px 22px;
      gap: 28px;
    }

    .t2t-footer-logo img {
      width: 150px;
    }

    .t2t-footer-nav {
      grid-template-columns: 1fr;
      gap: 22px;
    }

    .t2t-footer-column {
      padding-bottom: 18px;
      border-bottom: 1px solid rgba(226,232,240,0.8);
    }

    .t2t-footer-column:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }

    .t2t-footer-bottom {
      padding: 18px 22px;
      align-items: flex-start;
      flex-direction: column;
      font-size: 12px;
    }
  }
`;
